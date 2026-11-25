/* 카톡 급한 호출 — 희선님(지희선) PC 컴퓨터 알림 (2026-11-25 사장님 "에이전트가 해결 못할 문제가 생긴다면 희선님한테 급 알림을 계속 갈겨서 우선 해결할 수 있게"
   · "제일 중요한건 욕하거나 화가 단단히 났거나 발악하는 고객이 있으면 무조건 희선님한테 알림" · "컴퓨터 알림으로 날려줘. 희선님 알림 켜져있을거야").
   · 읽기만 한다 — 카톡 상담 에이전트(sixshop-collector kakao-agent)의 열린 직원 호출 = 프록시 GET /cs/kakao-drafts 의 openCalls (kind 'call' 만, 'todo' 처리할 일은 안 띄움).
     에이전트가 꺼져 있으면({off:true}) 아무것도 안 뜬다.
   · 직원(사람)이 그 방에 답하면 에이전트가 호출을 닫는다 → 여기서도 저절로 멈춤. 그 전까지 되풀이: 화난 고객 3분 · 그 밖 5분마다 (사장님 "계속").
   · 크롬 알림(requireInteraction — 누를 때까지 화면에 남음) + 오피스 화면 오른쪽 아래 빨간 표시. 누르면 오피스 CS팀 채팅방 창으로.
   · 알림에는 브랜드 · 주제 · 이유 · 기다린 시간만 — 고객 이름 · 글은 넣지 않는다. 탭이 여러 개여도 한 번만(되풀이 시각을 localStorage 로 나눠 씀).
   · 받는 사람 = WHO ('나는' 이름). 바꾸려면 이 줄만. 오피스 탭이 하나라도 열려 있어야 뜬다(크롬 알림의 한계). index.html 맨 끝에서 부른다. */
(function () {
  'use strict';
  try { if (window.parent !== window) return; } catch (e) { return; }
  if (/[?&](app|embed)=/.test(location.search)) return;
  if (window.KkoUrgent) return;

  var WHO = ['지희선'];
  var POLL = 60000, AGAIN_HOT = 3 * 60000, AGAIN = 5 * 60000;
  var RAGE = /화남|욕설|욕|불쾌|신고|바통|발악/;
  var LS = 'bb_kko_urgent_v1';
  var BR = {kop: '코페리', apt: '아페티', koz: '코즈미', '6a': '식스에이', yar: '야르', akoi: '아코이하우스', pp: '프로덕트피알', ct: '클리어타입'};
  var timer = null, pill = null, notes = {}, last = [];

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function me() { return ls('brightbeed_unlocked') === '1' ? String(ls('brightbeed_diary_me') || '').trim() : ''; }
  function mine() { return WHO.indexOf(me()) >= 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function sent() { try { return JSON.parse(ls(LS) || '{}') || {}; } catch (e) { return {}; } }
  function hot(c) { return RAGE.test(String(c.why || '') + ' ' + String(c.topic || '')); }
  function mins(c) { return Math.max(0, Math.round((Date.now() - Number(c.since || c.firstAt || Date.now())) / 60000)); }
  function name(c) { return c.label || BR[c.brand] || c.brand || '카톡'; }

  function openChat(c) {
    try { window.focus(); } catch (e) { /* noop */ }
    var key = c.pid + ':' + c.chatId;
    try {
      if (typeof triggerCs === 'function' && typeof kkoOpenChat === 'function') {
        triggerCs();
        setTimeout(function () { try { var b = document.getElementById('kkoBox'); if (b) b.scrollIntoView({block: 'start'}); } catch (e) { /* noop */ } }, 500);
        setTimeout(function () { try { kkoOpenChat(key); } catch (e) { /* noop */ } }, 900);
        return;
      }
    } catch (e) { /* noop */ }
    if (c.link) try { window.open(c.link, '_blank', 'noopener'); } catch (e) { /* noop */ }
  }

  function notify(calls) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var at = sent(), now = Date.now(), live = {};
    calls.forEach(function (c) {
      live[c.key] = 1;
      var h = hot(c);
      if (at[c.key] && now - at[c.key] < (h ? AGAIN_HOT : AGAIN)) return;
      at[c.key] = now;
      var title = h ? '🔴 카톡 ' + name(c) + ' — 화난 고객, 바로 봐 주세요' : '🟠 카톡 ' + name(c) + ' — 에이전트가 직원을 불렀어요';
      var body = [c.topic, c.why, mins(c) + '분째 기다림' + (c.more ? ' · 고객 글 ' + (c.more + 1) + '개' : '')].filter(Boolean).join('\n').slice(0, 180);
      try {
        var n = new Notification(title, {body: body, tag: 'kko-call-' + c.key, renotify: true, requireInteraction: true, icon: 'assets/icon-192.png?v=2'});
        n.onclick = function () { n.close(); openChat(c); };
        notes[c.key] = n;
      } catch (e) { /* noop */ }
    });
    Object.keys(at).forEach(function (k) { if (!live[k]) { delete at[k]; if (notes[k]) { try { notes[k].close(); } catch (e) { /* noop */ } delete notes[k]; } } });
    ls(LS, JSON.stringify(at));
  }

  function css() {
    if (document.getElementById('kkoUrgentCss')) return;
    var s = document.createElement('style'); s.id = 'kkoUrgentCss';
    s.textContent = '#kkoUrgent{position:fixed;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);z-index:99991;display:flex;flex-direction:column;gap:6px;align-items:flex-end;font-size:14px}'
      + '#kkoUrgent button{font:inherit;border:1px solid #fecaca;background:#fff;color:#111827;border-left:4px solid #f59e0b;border-radius:10px;padding:8px 12px;min-height:40px;max-width:min(360px,calc(100vw - 32px));text-align:left;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.12)}'
      + '#kkoUrgent button.hot{border-left-color:#dc2626}#kkoUrgent b{display:block;font-weight:700}#kkoUrgent .ku-s{color:#6b7280;font-size:12px}'
      + '#kkoUrgent .ku-perm{border-left-color:#4f7fcf}@media print{#kkoUrgent{display:none}}';
    document.head.appendChild(s);
  }
  function draw(calls) {
    if (!calls.length) { if (pill) { pill.remove(); pill = null; } return; }
    css();
    if (!pill) {
      pill = document.createElement('div'); pill.id = 'kkoUrgent'; pill.setAttribute('role', 'alert');
      pill.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.perm) { try { Notification.requestPermission().then(function () { tick(); }); } catch (x) { /* noop */ } return; }
        var c = last.filter(function (x) { return x.key === b.dataset.k; })[0]; if (c) openChat(c);
      });
      document.body.appendChild(pill);
    }
    var off = !('Notification' in window) || Notification.permission !== 'granted';
    var html = calls.slice(0, 4).map(function (c) {
      return '<button type="button" class="' + (hot(c) ? 'hot' : '') + '" data-k="' + esc(c.key) + '"><b>' + (hot(c) ? '🔴 ' : '🟠 ') + esc(name(c)) + ' 카톡 — ' + esc(hot(c) ? '화난 고객' : '직원 호출') + '</b>'
        + '<span class="ku-s">' + esc([c.topic, mins(c) + '분째'].filter(Boolean).join(' · ')) + '</span></button>';
    }).join('') + (calls.length > 4 ? '<button type="button" data-k="' + esc(calls[4].key) + '"><span class="ku-s">그 밖 ' + (calls.length - 4) + '건</span></button>' : '')
      + (off && 'Notification' in window && Notification.permission !== 'denied' ? '<button type="button" class="ku-perm" data-perm="1"><b>컴퓨터 알림 켜기</b><span class="ku-s">급한 호출을 크롬 알림으로 받아요</span></button>' : '');
    if (pill.__html !== html) { pill.__html = html; pill.innerHTML = html; }
  }

  function tick() {
    clearTimeout(timer); timer = setTimeout(tick, POLL);
    if (!mine()) { draw([]); return; }
    if (typeof loadProxyBase !== 'function' || typeof ghPin !== 'function') return;
    loadProxyBase().then(function (base) {
      if (!base) return null;
      return fetch(base + '/cs/kakao-drafts', {headers: {'X-Brightbeed-PIN': ghPin(), Accept: 'application/json'}, cache: 'no-store'})
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }).then(function (j) {
      if (!j) return;
      var calls = j.off ? [] : (Array.isArray(j.openCalls) ? j.openCalls : []).filter(function (c) { return c && c.key && c.kind !== 'todo'; });
      calls.sort(function (a, b) { return (hot(b) - hot(a)) || (Number(a.since || 0) - Number(b.since || 0)); });
      last = calls; notify(calls); draw(calls);
    }).catch(function () { /* 다음 분에 다시 */ });
  }

  window.KkoUrgent = {tick: tick, who: WHO};
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  if (document.body) setTimeout(tick, 3000); else document.addEventListener('DOMContentLoaded', function () { setTimeout(tick, 3000); });
})();
