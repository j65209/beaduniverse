/* 업무용 툴 '새 도구' 표시 — 직원마다 눌러 보기 전까지
   (2026-11-25 사장님 "업무용 툴 새로 개발하면 해당 직원이 눌러보기 전까지 표시하기" · "모든 직원들 컴퓨터에 뜨게")
   · 새 도구를 만들면 슈퍼베이스 tool_news 에 한 줄(key = 카드 class m-<key> 의 key, title, sub, icon) — 그것만 하면 모든 직원 화면에 뜬다.
   · 뜨는 곳: ① 홈 맨 위 한 줄(대표 PC 는 대표 캘린더 아래) ② 업무용 툴 머리 '새 도구 n' ③ 카드 '새 도구' 딱지 + 고정 카드 바로 뒤 자리.
   · 카드 · 한 줄을 누르거나 그 화면을 열면 그 사람 것만 사라진다. 기록 = tool_news_seen(사람 이름) 이라 다른 PC · 휴대폰에서도 같이 사라진다.
     이름을 안 고른 기기는 그 브라우저에만 기억. 60일 지나면 저절로 끝. 권한이 없어 카드가 안 보이는 사람에게는 안 뜬다.
   · 열어 둔 화면도 실시간 알림선(OfficeLive)으로 바로 뜬다 — 아직 카드가 없는 옛 화면이면 한 줄의 단추가 새로고침. 누가 봤는지는 화면에 안 보인다(SQL 로만). */
(function () {
'use strict';
try { if (window.parent !== window) return; } catch (e) { return; }
if (/[?&]embed=/.test(location.search) || window.BBToolNew) return;
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const me = () => ls('brightbeed_unlocked') === '1' ? String(ls('brightbeed_diary_me') || '').trim().slice(0, 40) : '';
const SEEN = 'bb_tool_seen_v1', WAIT = 'bb_tool_seen_wait_v1';
const arr = k => { try { const a = JSON.parse(ls(k) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const put = (k, a) => ls(k, JSON.stringify(a.slice(-200)));
const tag = k => k + '|' + me();          // 한 PC 를 여럿이 쓰면 사람마다 따로
let list = [], busy = false;

async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {method: 'POST', headers: _sbHeaders(), body: JSON.stringify(body), cache: 'no-store'});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const ready = () => typeof SUPABASE_URL !== 'undefined' && typeof _sbHeaders === 'function';
async function flush() {                    // 못 보낸 '봤음' 다시 보내기
  for (const w of arr(WAIT)) {
    const i = w.indexOf('|'), key = w.slice(0, i), name = w.slice(i + 1);
    try { await rpc('tool_news_mark', {p_key: key, p_name: name}); put(WAIT, arr(WAIT).filter(x => x !== w)); } catch (e) { return; }
  }
}
async function pull() {
  if (busy || !ready() || ls('brightbeed_unlocked') !== '1') return;
  busy = true;
  try {
    await flush();
    const x = await rpc('tool_news_open', {p_name: me()}), seen = arr(SEEN);
    list = (Array.isArray(x) ? x : []).filter(n => !seen.includes(tag(n.key)));
    draw();
    const h = (location.hash || '').slice(1).split(/[?&/]/)[0]; if (h && list.some(n => n.key === h)) seen(h);   // 주소로 바로 열어 둔 화면
  } catch (e) { /* 다음 차례에 다시 */ }
  busy = false;
}
const cardOf = k => document.querySelector('#viewHome .sub-modules-tools .sub-module.m-' + k) || document.querySelector('#viewHome .sub-modules-admin .sub-module.m-' + k);
const shown = c => !c.hidden && getComputedStyle(c).display !== 'none' && !(c.closest('.sub-modules-section') || c).hidden && getComputedStyle(c.closest('.sub-modules-section') || c).display !== 'none';
// 지금 이 사람에게 보여 줄 것 — 카드가 있는데 권한 때문에 숨었으면 뺀다. 카드가 아예 없으면(옛 화면) 새로고침 안내
const mine = () => list.filter(n => { const c = cardOf(n.key); return !c || shown(c); });

function css() {
  if (document.getElementById('tnCss')) return;
  const s = document.createElement('style'); s.id = 'tnCss';
  s.textContent = `#toolNew{display:flex;flex-direction:column;gap:8px;margin:0 0 var(--hs,16px)}
#toolNew button{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:10px 16px;border:1.5px solid #1f2329;border-radius:14px;background:#fff;color:#1f2329;text-align:left;cursor:pointer;font:500 14px/1.4 var(--sans,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif)}
#toolNew button:hover{background:#faf9f7}
#toolNew .tn-p,.tn-tag,.tn-cnt{flex:none;background:#1f2329;color:#fff;font:700 11.5px/1 var(--sans,inherit);padding:5px 8px;border-radius:999px;letter-spacing:-.01em;white-space:nowrap}
#toolNew .tn-i{font-size:20px;flex:none}#toolNew .tn-t{flex:1;min-width:0;word-break:keep-all}#toolNew .tn-t b{font-weight:800;margin-right:8px}#toolNew .tn-t span{color:#6b6660;font-size:13px}
#toolNew .tn-go{flex:none;font-weight:700;font-size:13px;white-space:nowrap}
.sub-module.tn-on{border-color:#1f2329 !important;box-shadow:0 0 0 1px #1f2329}.sub-module.tn-on .sub-module-tag{display:none}
.sub-module .tn-tag{position:absolute;top:9px;right:9px;z-index:2}
.tn-cnt{display:inline-block;margin-left:8px;border:0;cursor:pointer;vertical-align:middle}
#toolNew button:focus-visible,.tn-cnt:focus-visible{outline:2px solid #1f2329;outline-offset:3px}
@media(max-width:640px){#toolNew button{padding:10px 12px;gap:9px}#toolNew .tn-t b{display:block}#toolNew .tn-t span{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}}
@media print{#toolNew{display:none}}`;
  document.head.appendChild(s);
}
function draw() {
  const home = document.getElementById('viewHome'); if (!home) return;
  css();
  const xs = mine(), on = new Set(xs.map(n => n.key));
  // ① 홈 맨 위 한 줄 (대표 캘린더는 항상 최상위 — 그 아래)
  let bar = document.getElementById('toolNew');
  if (!xs.length) { if (bar) bar.remove(); }
  else {
    if (!bar) { bar = document.createElement('div'); bar.id = 'toolNew'; bar.setAttribute('role', 'status'); const ceo = document.getElementById('homeCeoCalCard'); if (ceo && ceo.parentNode === home) ceo.after(bar); else home.prepend(bar); bar.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) open(b.dataset.k); }); }
    const h = xs.map(n => `<button type="button" data-k="${E(n.key)}"><span class="tn-p">새 도구</span><span class="tn-i" aria-hidden="true">${E(n.icon)}</span><span class="tn-t"><b>${E(n.title)}</b><span>${E(n.sub)}</span></span><span class="tn-go">${cardOf(n.key) ? '열어보기' : '새로고침하고 보기'}</span></button>`).join('');
    if (bar.dataset.h !== h) { bar.dataset.h = h; bar.innerHTML = h; }
  }
  // ③ 카드 딱지
  document.querySelectorAll('.sub-module.tn-on').forEach(c => { if (![...on].some(k => c.classList.contains('m-' + k))) { c.classList.remove('tn-on'); const t = c.querySelector('.tn-tag'); if (t) t.remove(); } });
  let tools = 0;
  xs.forEach(n => {
    const c = cardOf(n.key); if (!c) return;
    if (c.closest('.sub-modules-tools')) tools++;
    if (c.classList.contains('tn-on')) return;
    c.classList.add('tn-on'); const t = document.createElement('div'); t.className = 'tn-tag'; t.textContent = '새 도구'; c.appendChild(t);
    const host = c.parentNode, pins = [...host.children].filter(x => x.dataset && x.dataset.pin && x !== c), last = pins[pins.length - 1];   // 고정 카드(data-pin) 바로 뒤
    if (!c.dataset.pin) { if (last) last.after(c); else host.prepend(c); }
  });
  // ② 업무용 툴 머리
  const meta = document.querySelector('#viewHome .sub-modules-tools .folder-meta'); let cnt = document.getElementById('tnCnt');
  if (meta && tools) { if (!cnt) { cnt = document.createElement('button'); cnt.id = 'tnCnt'; cnt.type = 'button'; cnt.className = 'tn-cnt'; cnt.addEventListener('click', e => { e.stopPropagation(); const c = document.querySelector('.sub-modules-tools .tn-on'); if (c) c.scrollIntoView({block: 'center', behavior: 'smooth'}); }); meta.after(cnt); } const tx = '새 도구 ' + tools; if (cnt.textContent !== tx) cnt.textContent = tx; } else if (cnt) cnt.remove();
}
function seen(key) {
  if (!list.some(n => n.key === key)) return;
  list = list.filter(n => n.key !== key); put(SEEN, arr(SEEN).filter(x => x !== tag(key)).concat(tag(key)));
  if (me()) { put(WAIT, arr(WAIT).filter(x => x !== tag(key)).concat(tag(key))); flush(); }
  draw();
}
function open(key) { const c = cardOf(key); if (!c) { location.reload(); return; } c.click(); seen(key); }
// 카드를 누르면 (카드 안 어디든)
document.addEventListener('click', e => { const c = e.target.closest && e.target.closest('.sub-module.tn-on'); if (c) { const n = list.find(x => c.classList.contains('m-' + x.key)); if (n) setTimeout(() => seen(n.key), 0); } }, true);
window.BBToolNew = {opened: key => seen(key), pull};     // opened = 주소(#adlib)로 바로 열었을 때 index.html toolViewSync 가 부른다
function boot() { if (!ready()) { setTimeout(boot, 1500); return; } pull(); setInterval(() => { if (!document.hidden) pull(); }, 5 * 60e3); }
boot();
const live = () => { if (live.on || !window.OfficeLive) return; live.on = true; OfficeLive.on(['tool_news'], pull); };
live(); setTimeout(live, 3000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
window.addEventListener('storage', e => { if (e.key === SEEN || e.key === 'brightbeed_diary_me') pull(); });
})();
