/* ERP 알림 — ERP 에 문제가 생기면 오피스 어느 화면에서든 위에 뜸 (2026-11-23 사장님 "만약 erp에 문제 생기면 꼭 알림 뜨게 해줘").
   맥미니 ERP 지킴이(sixshop-collector erp/erp-guard.mjs, 5분)가 두 번 보고 적은 것(Supabase erp_alert)을 1분마다 읽는다. 여기서는 읽기만.
   '닫기'는 10분(🔴) · 1시간(그 밖) 뒤 다시 뜸. 지킴이가 20분 넘게 소식이 없으면 그것도 띄움. 크롬 알림을 허용한 PC 는 크롬 알림도.
   index.html · erp/index.html 이 부른다 (오피스 안 iframe 에서는 안 띄움 — 바깥 화면이 띄움). */
(function () {
  'use strict';
  try { if (window.parent !== window) return; } catch (e) { return; }
  if (/[?&](app|embed)=/.test(location.search)) return;
  var SB = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreWpreGJxc3lqb3FwdXF3b2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjI2NzEsImV4cCI6MjA5Mzk5ODY3MX0.C8WIGqf-zIYkCq0dGWTMjIYuPM-IVInMn1p6FaWbVKA';
  var hideUntil = {}, pushed = {}, timer = null, box = null, fails = 0;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  try { hideUntil = JSON.parse(ls('erp_alert_hide') || '{}') || {}; pushed = JSON.parse(ls('erp_alert_push') || '{}') || {}; } catch (e) { hideUntil = {}; pushed = {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hhmm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function css() {
    if (document.getElementById('erpAlertCss')) return;
    var s = document.createElement('style'); s.id = 'erpAlertCss';
    s.textContent = '#erpAlert{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 12px);width:min(560px,calc(100vw - 24px));max-height:min(60vh,520px);overflow:auto;z-index:99990;background:#fff;color:#111827;border:1px solid #e5e7eb;border-left:4px solid #6b7280;border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.22);padding:14px 16px;font:14px/1.5 Pretendard,-apple-system,"Malgun Gothic",sans-serif;box-sizing:border-box;text-align:left}'
      + '#erpAlert.stop{border-left-color:#dc2626}#erpAlert .ea-h{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px}#erpAlert .ea-dot{width:9px;height:9px;border-radius:50%;background:#6b7280;flex:none}#erpAlert.stop .ea-dot{background:#dc2626}'
      + '#erpAlert .ea-x{margin-left:auto;display:flex;gap:6px}#erpAlert button{font:inherit;font-size:13px;min-height:34px;padding:4px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111827;cursor:pointer}'
      + '#erpAlert .ea-i{border-top:1px solid #f1f2f4;margin-top:10px;padding-top:9px}#erpAlert .ea-t{font-weight:600;overflow-wrap:anywhere}#erpAlert .ea-i.stop .ea-t{color:#dc2626}#erpAlert .ea-b{color:#4b5563;font-size:13px;white-space:pre-line;overflow-wrap:anywhere}#erpAlert .ea-s{color:#9ca3af;font-size:12px}'
      + '@media (max-width:600px){#erpAlert{max-height:52vh;padding:12px 13px}}@media print{#erpAlert{display:none}}';
    document.head.appendChild(s);
  }
  function drop() { if (box) { box.remove(); box = null; } }
  function notify(list) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var now = Date.now();
    list.forEach(function (a) {
      if (pushed[a.key] && now - pushed[a.key] < (a.level === 'stop' ? 30 : 180) * 60000) return;
      pushed[a.key] = now;
      try { var n = new Notification((a.level === 'stop' ? '🔴 ERP 문제 — ' : '🟠 ERP 확인 — ') + a.title, { body: String(a.body || '').slice(0, 160), tag: 'erp-' + a.key, requireInteraction: a.level === 'stop', icon: 'assets/icon-192.png?v=2' }); n.onclick = function () { window.focus(); n.close(); }; } catch (e) { /* 휴대폰 크롬 등 */ }
    });
    Object.keys(pushed).forEach(function (k) { if (now - pushed[k] > 86400000) delete pushed[k]; });
    ls('erp_alert_push', JSON.stringify(pushed));
  }
  function draw(list) {
    var now = Date.now(), show = list.filter(function (a) { return !(hideUntil[a.key] > now); });
    if (!show.length) { drop(); return; }
    var stop = show.some(function (a) { return a.level === 'stop'; });
    show.sort(function (a, b) { return a.level === b.level ? 0 : a.level === 'stop' ? -1 : 1; });
    var html = '<div class="ea-h"><span class="ea-dot"></span>' + (stop ? 'ERP에 문제가 생겼어요' : 'ERP 확인이 필요해요') + (show.length > 1 ? ' (' + show.length + ')' : '') + '<span class="ea-x">' + (typeof window.openToolPage === 'function' ? '<button type="button" data-ea="open">ERP 열기</button>' : '') + '<button type="button" data-ea="hide">닫기</button></span></div>'
      + show.slice(0, 12).map(function (a) { return '<div class="ea-i ' + (a.level === 'stop' ? 'stop' : '') + '"><div class="ea-t">' + esc(a.title) + '</div><div class="ea-b">' + esc(a.body) + '</div><div class="ea-s">' + esc(hhmm(a.since)) + '부터</div></div>'; }).join('')
      + (show.length > 12 ? '<div class="ea-i ea-s">그 밖 ' + (show.length - 12) + '건</div>' : '');
    css();
    if (!box) { box = document.createElement('div'); box.id = 'erpAlert'; box.setAttribute('role', 'alert'); box.addEventListener('click', function (e) { var b = e.target.closest('[data-ea]'); if (!b) return; if (b.dataset.ea === 'open') { try { window.openToolPage('erp'); } catch (x) { /* noop */ } } var t = Date.now(); (box.__list || []).forEach(function (a) { hideUntil[a.key] = t + (a.level === 'stop' ? 10 : 60) * 60000; }); ls('erp_alert_hide', JSON.stringify(hideUntil)); drop(); }); document.body.appendChild(box); }
    box.className = stop ? 'stop' : ''; box.__list = show;
    if (box.__html !== html) { box.__html = html; box.innerHTML = html; }
  }
  function tick() {
    clearTimeout(timer); timer = setTimeout(tick, 60000);
    if (document.hidden || ls('brightbeed_unlocked') !== '1') { if (!document.hidden) drop(); return; }
    fetch(SB + '/rest/v1/erp_alert?select=key,level,title,body,since,updated_at&resolved_at=is.null&order=since.asc&limit=60', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) {
        fails = 0;
        var beat = rows.filter(function (a) { return a.key === '_beat'; })[0], list = rows.filter(function (a) { return a.key !== '_beat'; });
        if (beat) { var m = Math.round((Date.now() - new Date(beat.updated_at)) / 60000); if (m > 20) list.push({ key: 'beat', level: 'stop', title: 'ERP 감시가 ' + m + '분째 멈췄어요', body: '맥미니나 자동 작업이 멈췄을 수 있어요. 차감도 멈췄는지 확인이 필요해요.', since: beat.updated_at }); }
        notify(list); draw(list);
      })
      .catch(function () { if (++fails >= 5) draw([{ key: 'net', level: 'warn', title: 'ERP 저장소에 연결이 안 돼요', body: '인터넷이나 저장소 문제일 수 있어요. 재고 화면이 최신이 아닐 수 있어요.', since: Date.now() - fails * 60000 }]); });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  if (document.body) setTimeout(tick, 2500); else document.addEventListener('DOMContentLoaded', function () { setTimeout(tick, 2500); });
})();
