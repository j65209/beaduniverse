/* 알림 확인 요청 — 사장님이 보내면 받는 직원 화면에 [확인] 창 + 크롬 알림, 누가 눌렀는지 기록
   (2026-11-24 사장님 "직원들 모두한테 지금 알림을 보내서 알림창이 보이면 확인버튼 눌러달라고하고 확인 누른사람들이랑 안누른사람들 보내줘 연차자들빼고")
   · 보내기 = 서버(Supabase notif_calls 에 한 줄 — targets 에 이름들). 화면에서는 못 보낸다.
   · 받기 = 1분마다 + 실시간 알림선(OfficeLive)으로 바로. 내 이름 앞으로 온 것 가운데 아직 안 누른 것만(notif_call_open).
   · 기록 = 창이 뜨면 '봤음', [확인]을 누르면 '확인' (notif_call_mark). 누가 눌렀는지는 서버에서 watch 열쇠로만 읽는다 — 직원 화면에서는 못 본다.
   · kind 'meeting' = 마케팅 회의록 미작성 알림 (2026-11-24 사장님 "수요일 오후2시까지 미작성 인원들 알림뜨게해줘") — 서버가 수요일 10시 · 13시 · 13시 30분 · 14시에
     아직 아무것도 안 넣은 참여자에게만 보낸다(함수 mkt_meeting_nudge, cron mkt-meeting-nudge-*, 그날 연차는 뺌). [회의록 열기] / [확인], 넣으면 저절로 닫힘, 회의록을 열어 둔 화면엔 창을 안 띄움.
   · kind 'store' = 직원 할인 스토어 [입금 완료] 알림 (2026-11-26, 엣지 함수 staff-store 가 전수빈 앞으로) — [주문 관리 열기] / [확인], 수락 · 취소하면 저절로 닫힘.
   · kind 'ask' = [확인] 창 대신 알림 허용 창(notif-ask.js)을 다시 띄운다 — PC 마다 한 번 (사장님 "알림신청 허용 거부 다시 띄워").
   · 글을 쓰는 중이면 창은 뜨되 글 칸을 빼앗지 않는다. 바깥을 눌러도 안 닫히고, Esc 는 10분 뒤 다시. 휴대폰에서도 뜬다. index.html 이 맨 끝에서 부른다 */
(function () {
'use strict';
try { if (window.parent !== window) return; } catch (e) { return; }
if (/[?&]embed=/.test(location.search) || window.BBNotifCall) return;
const UA = navigator.userAgent;
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const me = () => ls('brightbeed_unlocked') === '1' ? String(ls('brightbeed_diary_me') || '').trim() : '';
const perm = () => { try { return 'Notification' in window ? Notification.permission : 'unsupported'; } catch (e) { return 'unsupported'; } };
const os = () => /iPhone|iPod/.test(UA) ? 'iPhone' : /iPad/.test(UA) ? 'iPad' : /Android/.test(UA) ? 'Android' : /Windows/.test(UA) ? 'Windows' : /Macintosh/.test(UA) ? 'Mac' : '기타';
const typing = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT|IFRAME)$/.test(a.tagName) || a.isContentEditable); };
const onMeeting = () => { const v = document.getElementById('viewMeeting'); return !!v && !v.hidden && !document.hidden; };   // 회의록을 보고 있음
let call = null, el = null, via = 'card', busy = false, rest = 0, sending = false;

async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {method: 'POST', headers: _sbHeaders(), body: JSON.stringify(body), cache: 'no-store'});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const mark = (ack, id) => rpc('notif_call_mark', {p_id: id || call.id, p_name: me(), p_ack: ack, p_os: os(), p_host: location.host, p_perm: perm(), p_via: via});
async function pull() {
  const nm = me(); if (!nm || busy || sending || typeof SUPABASE_URL === 'undefined' || typeof _sbHeaders !== 'function') return;
  busy = true;
  try {
    const all = await rpc('notif_call_open', {p_name: nm}), xs = Array.isArray(all) ? all : [], x = xs.find(c => c.kind !== 'ask') || null;
    xs.filter(c => c.kind === 'ask').forEach(c => { if (x || ls('bb_call_' + c.id) || !window.BBNotifAsk) return; ls('bb_call_' + c.id, '1'); mark(false, c.id).catch(() => { /* noop */ }); window.BBNotifAsk.again(); });          // [확인] 창이 먼저
    if (!x) { call = null; hide(); } else { if (!call || call.id !== x.id) { call = x; via = 'card'; rest = 0; hide(); } draw(); }
  } catch (e) { /* 다음 차례에 다시 */ }
  busy = false;
}
function css() {
  if (document.getElementById('ncCss')) return;
  const s = document.createElement('style'); s.id = 'ncCss';
  s.textContent = `#notifCall{position:fixed;z-index:100020;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(28,25,23,.32);font-family:var(--sans,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif)}
#notifCall>div{width:min(420px,100%);padding:26px 24px 22px;border:1px solid #e3dfd8;border-radius:18px;background:#fff;color:#1f2329;box-shadow:0 24px 70px rgba(0,0,0,.22);text-align:center}
#notifCall h2{margin:0 0 8px;font-size:19px;font-weight:800;line-height:1.4;word-break:keep-all}
#notifCall p{margin:0;font-size:14.5px;line-height:1.65;color:#57534e;word-break:keep-all;white-space:pre-line}
#notifCall button{width:100%;height:50px;margin-top:20px;border:0;border-radius:13px;background:#1f2329;color:#fff;font:700 16px var(--sans,inherit);cursor:pointer}
#notifCall button.sub{margin-top:8px;background:#fff;border:1px solid #ddd8d0;color:#57534e}
#notifCall button:disabled{opacity:.55;cursor:default}
#notifCall button:focus-visible{outline:2px solid #1f2329;outline-offset:3px}
@media print{#notifCall{display:none}}`;
  document.head.appendChild(s);
}
function draw() {
  if (!call || el || Date.now() < rest) return;
  const mt = call.kind === 'meeting' || call.kind === 'store';
  if (call.kind === 'meeting' && onMeeting()) return;
  css();
  el = document.createElement('div'); el.id = 'notifCall';
  el.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="ncT"><h2 id="ncT">${E(call.title)}</h2><p>${E(call.body)}</p>${mt ? `<button type="button" data-n="go">${call.kind === 'store' ? '주문 관리 열기' : '회의록 열기'}</button>` : ''}<button type="button" data-n="ok"${mt ? ' class="sub"' : ''}>확인</button></div>`;
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ok(b.dataset.n === 'go'); });
  document.body.appendChild(el);
  if (!typing()) el.querySelector('button').focus({preventScroll: true});
  mark(false).catch(() => { /* 봤음은 확인할 때 다시 적힌다 */ });
  ring();
}
/* 크롬 알림 — 이 PC 에서 한 번. 눌러 들어오면 '알림으로 봄' */
function ring() {
  const mt = call.kind === 'meeting' || call.kind === 'store', k = 'bb_call_' + call.id; if (ls(k) || perm() !== 'granted') return; ls(k, '1');
  try {
    const n = new Notification(call.title, {body: call.body, tag: 'bb-call-' + call.id, icon: 'assets/icon-192.png?v=2', requireInteraction: true});
    n.onclick = () => { window.focus(); n.close(); via = 'notif'; rest = 0; try { if (window.bbNotifSeen) window.bbNotifSeen(); } catch (e) { /* noop */ } if (mt) { if (call) ok(true); else (call && call.kind === 'store' ? goStore : goMeeting)(); } else draw(); };
  } catch (e) { /* 휴대폰 크롬 등 — 창만 */ }
}
function hide() { if (el) { el.remove(); el = null; } }
function goStore() { ls('store_go', 'admin'); try { if (typeof openStorePage === 'function') { openStorePage(); return; } } catch (e) { /* 아래로 */ } location.hash = 'store'; }
function goMeeting() { try { if (typeof openMeetingPage === 'function') { openMeetingPage(); return; } } catch (e) { /* 아래로 */ } location.hash = 'meeting'; }
async function ok(go) {
  if (!call || sending) return; sending = true;
  const b = el && (el.querySelector('[data-n="' + (go ? 'go' : 'ok') + '"]') || el.querySelector('button')); if (b) { b.disabled = true; b.textContent = go ? '여는 중…' : '보내는 중…'; }
  if (go) {   // 회의록부터 열고 기록은 뒤에서
    const id = call.id, st = call.kind === 'store'; call = null; hide(); (st ? goStore : goMeeting)();
    mark(true, id).then(() => ls('bb_call_ack', id + ' ' + Date.now())).catch(() => { /* 다음 차례에 다시 뜬다 */ });
    setTimeout(() => { sending = false; }, 1500);
    return;
  }
  try {
    await mark(true);
    ls('bb_call_ack', call.id + ' ' + Date.now());          // 다른 탭도 닫기
    if (b) b.textContent = '확인했어요, 고맙습니다';
    call = null; setTimeout(() => { hide(); sending = false; pull(); }, 1100);
  } catch (e) { sending = false; if (b) { b.disabled = false; b.textContent = '다시 눌러 주세요'; } }
}
document.addEventListener('keydown', e => { if (e.key !== 'Escape' || !el || sending) return; e.stopPropagation(); rest = Date.now() + 10 * 60e3; hide(); }, true);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(pull, 300); });
addEventListener('storage', e => { if (e.key === 'bb_call_ack') pull(); });
if (window.OfficeLive) window.OfficeLive.on(['notif_calls', 'mkt_meeting_links', 'staff_orders'], pull);
setInterval(pull, 60e3);
setTimeout(pull, 2500);
window.BBNotifCall = {pull, state: () => ({call, via})};
})();
