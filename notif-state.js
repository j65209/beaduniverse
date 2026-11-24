/* 알림 상태 — 이 PC 의 오피스 알림 승인 상태(허용 · 차단 · 미승인)를 서버에 적는다 (2026-11-24).
   알림을 띄우거나 허용을 묻지 않고, 화면에도 아무것도 안 보인다. 서버(Supabase notif_state)는 적기만 되고 화면에서는 못 읽는다.
   바뀌었을 때 바로, 그대로면 6시간에 한 번. 오피스 안 iframe · 시험 주소에서는 안 돈다. */
(function () {
  'use strict';
  try { if (window.parent !== window) return; } catch (e) { return; }
  if (/[?&](app|embed)=/.test(location.search)) return;
  if (!/^(j65209\.github\.io|(www\.)?beaduniverse\.kr)$/.test(location.hostname)) return;
  var URL_ = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/rest/v1/rpc/notif_state_put';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreWpreGJxc3lqb3FwdXF3b2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjI2NzEsImV4cCI6MjA5Mzk5ODY3MX0.C8WIGqf-zIYkCq0dGWTMjIYuPM-IVInMn1p6FaWbVKA';
  var DEV = 'bb_notif_dev', SENT = 'bb_notif_sent', CLICK = 'bb_notif_click', busy = false;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function json(k) { try { return JSON.parse(get(k) || 'null'); } catch (e) { return null; } }
  function dev() {
    var d = get(DEV);
    if (/^[0-9a-f]{16,32}$/.test(d || '')) return d;
    try { var a = new Uint8Array(12); crypto.getRandomValues(a); d = Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); } catch (e) { return null; }
    return set(DEV, d) ? d : null;   // 저장이 안 되는 PC 는 열 때마다 새 줄이 생기므로 안 보낸다
  }
  function os() {
    var u = navigator.userAgent;
    if (/iPhone|iPod/.test(u)) return 'iPhone';
    if (/iPad/.test(u) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/Android/.test(u)) return 'Android';
    if (/Windows/.test(u)) return 'Windows';
    if (/Mac OS X|Macintosh/.test(u)) return 'Mac';
    return '기타';
  }
  function browser() {
    var u = navigator.userAgent;
    if (/Whale\//.test(u)) return 'Whale';
    if (/Edg/.test(u)) return 'Edge';
    if (/SamsungBrowser/.test(u)) return 'Samsung';
    if (/KAKAOTALK/i.test(u)) return 'KakaoTalk';
    if (/CriOS|Chrome\//.test(u)) return 'Chrome';
    if (/Firefox|FxiOS/.test(u)) return 'Firefox';
    if (/Safari/.test(u)) return 'Safari';
    return '기타';
  }
  function iso(ms) { var n = Number(ms); return n > 0 ? new Date(n).toISOString() : null; }
  function run() {
    if (busy || get('brightbeed_unlocked') !== '1') return;
    var me = (get('brightbeed_diary_me') || '').trim();
    if (!me) return;
    var d = dev(); if (!d) return;
    var perm = ('Notification' in window) ? Notification.permission : 'unsupported';
    var diag = json('brightbeed_notif_diag_v1') || {}, click = Number(get(CLICK)) || 0;
    var sig = [me, location.hostname, perm, diag.system || '', click].join('|'), last = json(SENT) || {};
    if (last.sig === sig && Date.now() - (last.at || 0) < 6 * 3600000) return;
    busy = true;
    fetch(URL_, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_dev: d, p_name: me, p_host: location.hostname, p_os: os(), p_browser: browser(), p_perm: perm, p_win: (diag.system === 'granted' || diag.system === 'blocked') ? diag.system : null, p_win_at: iso(diag.ts), p_clicked_at: iso(click) })
    }).then(function (r) { if (r.ok) set(SENT, JSON.stringify({ sig: sig, at: Date.now() })); }).catch(function () { /* 다음 차례에 다시 */ }).then(function () { busy = false; });
  }
  /* 알림을 실제로 눌렀다 = 이 PC 에 알림이 정말 떴다는 증거 (알림을 띄우는 곳들이 부른다) */
  window.bbNotifSeen = function () { set(CLICK, String(Date.now())); setTimeout(run, 500); };
  function boot() {
    setTimeout(run, 8000);
    setInterval(run, 5 * 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(run, 1500); });
    try { navigator.permissions.query({ name: 'notifications' }).then(function (p) { p.onchange = function () { setTimeout(run, 500); }; }).catch(function () { /* noop */ }); } catch (e) { /* 옛 브라우저 */ }
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
