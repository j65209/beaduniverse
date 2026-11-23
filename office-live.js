/* 오피스 실시간 알림선 (2026-11-23 사장님 "바로바로 작성하면 내부 자체 전산에서 바로 동기화되어서 직원들이 실시간으로 볼 수 있게").
   저장소(Supabase)의 표가 바뀌면 트리거 zz_office_live(office_live_tick)가 공개 채널 office-live 로 '어느 표가 바뀌었다' 한 줄만 보낸다.
   줄 내용은 싣지 않는다 — 화면은 이 신호를 받고 자기가 원래 쓰던 길(열쇠 · 권한 그대로)로 바뀐 것만 다시 읽는다.
   깃허브 파일에 저장하는 화면(MD 캘린더 · 메인보드 · 비밀번호 모음 …)은 저장이 끝난 화면이 OfficeLive.send('gh:…') 로 알린다.
   신호가 끊겨도 각 화면의 정기 확인이 그대로 돌아서 늦어질 뿐 빠지지 않는다. 다시 이어지면 그 사이 바뀐 것을 한 번 받는다.

     OfficeLive.on(['erp_rows','erp_map'], fn)   표가 바뀌면 fn (화면이 보일 때만 · 몰려 오면 모아서)
     OfficeLive.send('gh:md-events')             다른 화면들에 알림 (내 화면에는 안 온다)
     OfficeLive.ok()                             지금 이어져 있으면 true

   오피스 안 iframe 은 바깥 화면의 연결을 같이 쓴다. 숨은 탭은 10분 뒤 연결을 끊었다가 다시 보면 잇는다 (무료 한도 200 연결). */
(function () {
  'use strict';
  if (window.OfficeLive) return;
  var GAP = 900, HIDE_MS = 10 * 60000, BEAT = 25000, TOPIC = 'realtime:office-live';
  var WS = 'wss://ckyjkxbqsyjoqpuqwoce.supabase.co/realtime/v1/websocket';
  // 오피스 화면 소스에도 들어 있는 공개 키 (비밀 아님)
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreWpreGJxc3lqb3FwdXF3b2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjI2NzEsImV4cCI6MjA5Mzk5ODY3MX0.C8WIGqf-zIYkCq0dGWTMjIYuPM-IVInMn1p6FaWbVKA';

  /* 바깥 오피스 화면이 이미 이어져 있으면 그 연결을 같이 쓴다 */
  try {
    if (window.parent !== window && window.parent.OfficeLive && window.parent.OfficeLive._child) {
      window.OfficeLive = window.parent.OfficeLive._child(window);
      return;
    }
  } catch (e) { /* 다른 출처 — 따로 잇는다 */ }

  var subs = [], ws = null, ref = 0, joined = false, everJoined = false, fails = 0, lastIn = 0, beatRef = null;
  var tBeat = 0, tRetry = 0, tHide = 0;

  function dead(s) { try { return s.win.closed || !s.win.document; } catch (e) { return true; } }
  function seen(s) {
    try {
      if (s.win.document.visibilityState === 'hidden') return false;
      var fe = s.win.frameElement;
      if (fe && !fe.getClientRects().length) return false;   // 오피스 안에서 숨은 화면
    } catch (e) { /* noop */ }
    return true;
  }
  function run(s) {
    s.timer = 0;
    if (dead(s)) { drop(s); return; }
    if (!seen(s)) { s.dirty = true; return; }
    s.dirty = false; s.at = Date.now();
    var why = s.why; s.why = {};
    try { var p = s.fn(Object.keys(why)); if (p && p.catch) p.catch(function () { }); } catch (e) { /* 화면 쪽 오류가 알림선을 끊지 않게 */ }
  }
  function queue(s, t) {
    if (t) s.why[t] = 1;
    if (s.timer) return;
    var wait = Math.max(60 + Math.random() * 200, GAP - (Date.now() - s.at));   // 전 직원이 같은 순간에 묻지 않게 조금 흩는다
    s.timer = setTimeout(function () { run(s); }, wait);
  }
  function drop(s) { var i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); if (s.timer) clearTimeout(s.timer); }
  function fire(t) { subs.slice().forEach(function (s) { if (s.all || s.topics[t]) queue(s, t); }); }
  function wake() {   // 다시 보이면 그동안 밀린 것
    subs.slice().forEach(function (s) { if (dead(s)) drop(s); else if (s.dirty && seen(s)) queue(s, ''); });
  }

  function put(o) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); return true; } catch (e) { /* noop */ } } return false; }
  function close() {
    joined = false;
    clearInterval(tBeat);
    if (ws) { var w = ws; ws = null; w.onopen = w.onmessage = w.onclose = w.onerror = null; try { w.close(); } catch (e) { /* noop */ } }
  }
  function retry() {
    clearTimeout(tRetry);
    if (!subs.length) return;
    fails++;
    tRetry = setTimeout(open, Math.min(60000, 1000 * Math.pow(2, Math.min(fails, 6))) * (0.7 + Math.random() * 0.6));
  }
  function open() {
    clearTimeout(tRetry);
    if (ws || !('WebSocket' in window) || !subs.length || document.visibilityState === 'hidden') return;
    try { ws = new WebSocket(WS + '?apikey=' + KEY + '&vsn=1.0.0'); } catch (e) { ws = null; retry(); return; }
    var me = ws, tOpen = setTimeout(function () { if (ws === me && !joined) { close(); retry(); } }, 15000);
    ws.onopen = function () {
      lastIn = Date.now();
      put({ topic: TOPIC, event: 'phx_join', ref: String(++ref), join_ref: String(ref), payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [], private: false } } });
      clearInterval(tBeat);
      tBeat = setInterval(function () {
        if (Date.now() - lastIn > BEAT * 2.4) { close(); retry(); return; }   // 답이 없으면 다시 잇는다 (절전에서 깬 뒤 등)
        beatRef = String(++ref);
        put({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: beatRef });
      }, BEAT);
    };
    ws.onmessage = function (ev) {
      lastIn = Date.now();
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.topic !== TOPIC) return;
      if (m.event === 'phx_reply') {
        if (m.payload && m.payload.status === 'ok') {
          if (joined) return;
          joined = true; fails = 0; clearTimeout(tOpen);
          if (everJoined) subs.slice().forEach(function (s) { queue(s, ''); });   // 끊긴 사이 놓친 것
          everJoined = true;
        } else if (!joined) { close(); retry(); }
        return;
      }
      if (m.event === 'broadcast') {
        var p = m.payload || {}, d = p.payload || {};
        if (p.event === 'chg' && typeof d.t === 'string' && d.t.length < 80) fire(d.t);
        return;
      }
      if (m.event === 'phx_error' || m.event === 'phx_close') { close(); retry(); }
    };
    ws.onclose = ws.onerror = function () { if (ws !== me) return; clearTimeout(tOpen); close(); retry(); };
  }

  function on(win, topics, fn) {
    var s = { win: win, topics: {}, all: topics === '*', fn: fn, at: 0, timer: 0, dirty: false, why: {} };
    if (!s.all) [].concat(topics).forEach(function (t) { s.topics[t] = 1; });
    subs.push(s);
    open();
    return function () { drop(s); };
  }
  function api(win) {
    return {
      on: function (topics, fn) { return on(win, topics, fn); },
      send: function (t) { return put({ topic: TOPIC, event: 'broadcast', ref: String(++ref), payload: { type: 'broadcast', event: 'chg', payload: { t: String(t).slice(0, 79) } } }); },
      ok: function () { return joined; }
    };
  }
  var root = api(window);
  root._child = function (win) {
    try {
      win.addEventListener('pagehide', function () { subs.slice().forEach(function (s) { if (s.win === win) drop(s); }); });
      win.addEventListener('focus', wake);
    } catch (e) { /* noop */ }
    return api(win);
  };
  window.OfficeLive = root;

  document.addEventListener('visibilitychange', function () {
    clearTimeout(tHide);
    if (document.visibilityState === 'hidden') { tHide = setTimeout(close, HIDE_MS); return; }
    open(); wake();
  });
  window.addEventListener('online', function () { fails = 0; open(); });
  window.addEventListener('pagehide', function () { close(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { open(); wake(); } });
  setInterval(wake, 1500);   // 오피스 안에서 화면(iframe)을 옮겨 다시 보이게 된 경우 — 묻는 것이 아니라 밀린 표시만 본다
})();
