/* 알림 허용 안내 — 전 직원 (2026-11-24 사장님 "전 직원들 알림 다 허용하게 알림 띄워줘")
   이 PC 의 오피스 알림(크롬 알림)이 아직 허용되지 않았으면 화면 가운데에 안내를 띄운다. 이미 허용한 PC 에도 시험 알림을 보내 실제로 보이는지 한 번 묻는다
   (사장님 "그냥 다들 알림허용 다시 창 띄워주는게 어떄"). '네, 보여요'를 누르면 다시는 안 뜬다.
   · 누구에게: 오피스에 들어와 '나는 ○○○' 이름을 고른 모든 사람(업무일지를 안 쓰는 사람 포함). 휴대폰 · 태블릿은 이 방식의 알림이 안 되므로 뺀다.
   · 안 누름(default) = [알림 허용] → 크롬이 묻는 창에서 '허용'. 차단(denied) = 코드로는 못 풀어서 주소창에서 푸는 법을 그림으로, 풀면 저절로 알아챈다.
   · 허용되면 시험 알림을 한 번 띄우고 보이는지 묻는다 — 안 보이면 윈도우(맥) 알림 켜는 법.
   · [나중에] = 1시간 뒤 다시. 글을 쓰는 중이면 다 쓸 때까지 기다렸다 띄운다. 탭이 여럿이어도 한 곳에서 끝내면 같이 닫힌다.
   · '보여요 · 안 보여요' 답은 업무일지 알림 진단 칸(brightbeed_notif_diag_v1)에 적어 notif-state.js 가 올린다(여기서는 서버에 아무것도 안 보냄). index.html 이 맨 끝에서 부른다 */
(function () {
'use strict';
try { if (window.parent !== window) return; } catch (e) { return; }
if (/[?&]embed=/.test(location.search) || window.BBNotifAsk) return;
if (!('Notification' in window) || !window.isSecureContext) return;
const UA = navigator.userAgent, MAC = /Macintosh|Mac OS X/.test(UA);
if (/iPhone|iPad|iPod|Android|KAKAOTALK/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return;

const KEY = 'bb_notif_ask_v1', OK = 'bb_notif_ok_v1', LATER = 60 * 60e3;
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const me = () => ls('brightbeed_unlocked') === '1' ? String(ls('brightbeed_diary_me') || '').trim() : '';
const perm = () => { try { return Notification.permission; } catch (e) { return 'granted'; } };
let el = null, step = '', tried = false, back = null;

/* ── 그림 ── */
const LOCK = '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="6" r="2.2"/><path d="M10.5 6H17M3 6h1.5"/><circle cx="13" cy="14" r="2.2"/><path d="M3 14h7.5M15.5 14H17"/></svg>';
const bar = () => `<div class="na-bar" aria-hidden="true"><span class="na-lock">${LOCK}</span><span>${E(location.host + location.pathname.replace(/index\.html$/, '').replace(/\/$/, ''))}</span></div>`;
const VIEW = {
  ask: () => ({t: `${E(me())}님, 오피스 알림을 켜 주세요`, b: '<p>업무 요청 · 재고 · 상담처럼 바로 봐야 하는 것이 이 PC에 알림으로 떠요. 다른 창을 보고 있어도 보입니다.</p>', f: '<button type="button" class="pri" data-n="allow">알림 허용</button><button type="button" data-n="later">나중에</button>'}),
  wait: () => ({t: '왼쪽 위 창에서 ‘허용’을 눌러 주세요', b: `<p>주소창 아래에 작은 창이 떠 있어요. 안 보이면 주소창 왼쪽의 표시를 눌러 <b>알림</b>을 <b>허용</b>으로 바꿔 주세요.</p>${bar()}`, f: '<button type="button" data-n="allow">다시 묻기</button><button type="button" data-n="later">나중에</button>'}),
  denied: () => ({t: `${E(me())}님, 이 PC에서 오피스 알림이 막혀 있어요`, b: `<p>아래 순서로 풀어 주세요. 허용으로 바꾸면 이 안내는 저절로 닫힙니다.</p>${bar()}<ol><li>주소창 맨 왼쪽의 <b>표시한 모양</b>(또는 자물쇠)을 누르기</li><li><b>알림</b>을 켜기 — ‘허용’ (안 보이면 <b>사이트 설정</b> → <b>알림</b> → <b>허용</b>)</li><li>이 화면으로 돌아오기</li></ol>`, f: '<button type="button" class="pri" data-n="check">바꿨어요</button><button type="button" data-n="later">나중에</button>'}),
  done: () => ({t: '알림이 켜졌어요', b: '<p>방금 화면 ' + (MAC ? '오른쪽 위' : '오른쪽 아래') + '에 시험 알림을 보냈어요. 보이나요?</p>', f: '<button type="button" class="pri" data-n="ok">네, 보여요</button><button type="button" data-n="os">안 보여요</button>'}),
  check: () => ({t: `${E(me())}님, 오피스 알림이 잘 보이나요?`, b: '<p>방금 화면 ' + (MAC ? '오른쪽 위' : '오른쪽 아래') + '에 시험 알림을 보냈어요.</p>', f: '<button type="button" class="pri" data-n="ok">네, 보여요</button><button type="button" data-n="os">안 보여요</button>'}),
  os: () => ({t: MAC ? '맥 알림 설정을 켜 주세요' : '윈도우 알림을 켜 주세요', b: MAC ? '<ol><li><b>시스템 설정</b> → <b>알림</b> → <b>Google Chrome</b></li><li><b>알림 허용</b> 켜기 · 알림 스타일은 <b>배너</b> 또는 <b>지속적</b></li><li><b>집중 모드</b>가 켜져 있으면 끄기</li></ol>' : '<ol><li>윈도우 <b>설정</b> → <b>시스템</b> → <b>알림</b></li><li>맨 위 <b>알림</b>을 켜고, 아래 목록에서 <b>Google Chrome</b>도 켜기</li><li><b>방해 금지</b>(집중 지원)는 끄기</li></ol>', f: '<button type="button" class="pri" data-n="test">시험 알림 다시 보내기</button><button type="button" data-n="ok">이제 보여요</button><button type="button" data-n="later">나중에</button>'})
};
function css() {
  if (document.getElementById('naCss')) return;
  const s = document.createElement('style'); s.id = 'naCss';
  s.textContent = `#notifAsk{position:fixed;z-index:100010;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(28,25,23,.32);font-family:var(--sans,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif)}
#notifAsk .na-card{width:min(440px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:24px 24px 20px;border:1px solid #e3dfd8;border-radius:18px;background:#fff;color:#1f2329;box-shadow:0 24px 70px rgba(0,0,0,.22)}
#notifAsk .na-in{animation:naIn .18s ease-out}
@keyframes naIn{from{opacity:0;transform:translateY(8px)}}
@media (prefers-reduced-motion:reduce){#notifAsk .na-in{animation:none}}
#notifAsk h2{margin:0 0 8px;font-size:18px;font-weight:800;line-height:1.4;word-break:keep-all}
#notifAsk p{margin:0;font-size:14px;line-height:1.65;color:#57534e;word-break:keep-all}
#notifAsk ol{margin:14px 0 0;padding:0 0 0 20px;font-size:14px;line-height:1.75;color:#3b3833;word-break:keep-all}
#notifAsk b{font-weight:700;color:#1f2329}
#notifAsk .na-bar{display:flex;align-items:center;gap:8px;margin-top:14px;padding:6px 12px 6px 6px;border:1px solid #ddd8d0;border-radius:99px;background:#f6f4f1;font-size:13px;color:#78716c;white-space:nowrap;overflow:hidden}
#notifAsk .na-lock{display:flex;flex:none;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#fff;color:#1f2329;box-shadow:0 0 0 2px #dc2626}
#notifAsk footer{display:flex;gap:8px;margin-top:20px}
#notifAsk footer button{height:42px;padding:0 18px;border:1px solid #ddd8d0;border-radius:11px;background:#fff;font:600 14px var(--sans,inherit);color:#57534e;cursor:pointer}
#notifAsk footer .pri{flex:1;border-color:#1f2329;background:#1f2329;color:#fff}
#notifAsk footer button:focus-visible{outline:2px solid #1f2329;outline-offset:2px}
@media print{#notifAsk{display:none}}`;
  document.head.appendChild(s);
}
/* ── 띄우기 · 닫기 ── */
function show(st) {
  if (el && step === st) return;
  css(); step = st;
  const v = VIEW[st](), first = !el;
  if (first) {
    back = document.activeElement;
    el = document.createElement('div'); el.id = 'notifAsk';
    el.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) act(b.dataset.n); });
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="na-card${first ? ' na-in' : ''}" role="dialog" aria-modal="true" aria-labelledby="naT"><h2 id="naT">${v.t}</h2>${v.b}<footer>${v.f}</footer></div>`;
  const b = el.querySelector('footer button'); if (b) b.focus({preventScroll: true});
}
function hide() { if (!el) return; el.remove(); el = null; step = ''; try { if (back && back.focus) back.focus({preventScroll: true}); } catch (e) { /* 사라진 칸 */ } back = null; }
function later() { ls(KEY, String(Date.now() + LATER)); hide(); }
function test() {
  try {
    const n = new Notification('오피스 알림이 켜졌어요', {body: `${me()}님, 이 알림이 보이면 잘 되는 거예요.`, tag: 'bb-notif-ask', icon: 'assets/icon-192.png?v=2'});
    n.onclick = () => { window.focus(); n.close(); sure(); };
  } catch (e) { /* 알림을 못 만드는 창 */ }
}
/* 답 — 보인다고 하면 이 PC 는 끝. 안 보인다고 하면 윈도우 알림이 꺼진 것으로 적어 둔다 */
const diag = v => ls('brightbeed_notif_diag_v1', JSON.stringify({ts: Date.now(), system: v}));
function sure() { ls(OK, String(Date.now())); diag('granted'); if (window.bbNotifSeen) window.bbNotifSeen(); else ls('bb_notif_click', String(Date.now())); hide(); }
function granted() {
  ['_diaryDiagClear', '_diaryRefreshNotifBtn', '_diaryRenderMeBadge', '_diaryUpdateNotifBanner'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { /* 업무일지 화면이 아님 */ } });
  // 안내를 보고 켠 탭에서만 시험 알림 — 다른 탭은 조용히 닫는다
  if (el && !document.hidden) { show('done'); test(); } else hide();          // 다른 탭이 '보여요'를 받으면 저장소로 알아챈다
}
async function ask() {
  tried = true;
  show('wait');
  let p = perm();
  try { p = await Notification.requestPermission(); } catch (e) { /* 아래에서 지금 상태로 */ }
  if (p === 'granted') { if (step !== 'done') granted(); } else if (p === 'denied') show('denied');
}
function act(k) {
  if (k === 'allow') return void ask();
  if (k === 'later') return later();
  if (k === 'ok') return sure();
  if (k === 'os') { diag('blocked'); return show('os'); }
  if (k === 'test') return test();
  if (k === 'check') {
    const p = perm();
    if (p === 'granted') return granted();
    if (p === 'default') return void ask();
    const t = el && el.querySelector('p'); if (t) t.innerHTML = '아직 막혀 있어요. <b>허용</b>으로 바꾼 뒤 <b>F5</b>(새로고침)를 한 번 눌러 주세요.';
  }
}
/* ── 언제 ── */
const typing = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
const busy = () => { const m = document.getElementById('diarySetupModal'); return typing() || !!(m && !m.hidden) || !!document.getElementById('notifCall'); };          // 글 쓰는 중 · 이름 고르는 중 · 확인 요청 창(notif-call.js)이 떠 있음
function tick() {
  const p = perm();
  if (p === 'granted') {
    if (el) { if (step === 'ask' || step === 'wait' || step === 'denied') granted(); return; }
    if (me() && !ls(OK) && !document.hidden && Date.now() >= (+ls(KEY) || 0) && !busy()) { show('check'); test(); }
    return;
  }
  if (!me()) { hide(); return; }
  if (el) { if (p === 'denied' && (step === 'ask' || (step === 'wait' && tried))) show('denied'); if (p === 'default' && step === 'denied') show('ask'); return; }
  if (document.hidden || Date.now() < (+ls(KEY) || 0) || busy()) return;
  show(p === 'denied' ? 'denied' : 'ask');
}
document.addEventListener('keydown', e => { if (e.key !== 'Escape' || !el) return; e.stopPropagation(); later(); }, true);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(tick, 400); });
addEventListener('storage', e => { if (el && ((e.key === KEY && Date.now() < (+ls(KEY) || 0)) || (e.key === OK && ls(OK)))) hide(); });
try { navigator.permissions.query({name: 'notifications'}).then(p => { p.addEventListener('change', () => setTimeout(tick, 100)); }).catch(() => {}); } catch (e) { /* 옛 브라우저 */ }
setInterval(tick, 10e3);
setTimeout(tick, 5000);          // 오피스 첫 화면을 먼저 그린 뒤
window.BBNotifAsk = {tick, show, state: () => ({step, perm: perm()})};
})();
