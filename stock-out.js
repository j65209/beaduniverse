/* 출고 입력 — 지그재그 직진배송 (2026-11-24 사장님 "지그재그 직진배송에 입고시키면 재고 차감해야하는데 입고현황에서 출고 입력 만들어줘")
   홈 입고 현황 [− 출고 입력] · 입고 내역 창 [− 출고 입력] → 상품마다 보낸 수량을 적고 [출고] 하면 재고 ERP 남은 재고에서 바로 빠진다.
   · 쓰는 곳은 모아 입고와 같은 길 하나: 맥미니 프록시 POST /erp/moves (scripts/erp_moves.py, kind out · dest 'zonly') → 원장 erp_moves.
     여기서 재고 ERP 를 직접 고치지 않는다. 원장 ch '지그재그 직진배송' — 판매(공홈 · 플토)가 아니라서 보고서 · 리오더 판매 속도에 안 섞인다.
   · 직진배송 주문은 플레이오토 출고에 안 잡힌다(11-24 확인) → 창고로 보낼 때 한 번 빼는 게 맞고 두 번 안 빠진다. 고객 택배는 자동으로 빠지니 여기 안 적는다.
   · 접수ID 를 화면이 먼저 정해 이 브라우저에 적어 두고 보낸다 — 응답이 끊기거나 창을 닫아도 같은 ID 로 확인 · 다시 보내서 한 번만 빠진다.
   · 적던 수량은 이 브라우저에 남는다(3일). 남은 재고가 빈칸인 줄(아직 안 센 줄)은 못 뺀다.
   · 잘못 넣은 것은 [출고 내역]에서 되돌리기(그 줄만 · 그때 넣은 것 모두) — 도로 더하되 입고로 세지 않는다.
   찾기는 발주 매핑(po-map.js)의 비슷한 이름 찾기를 같이 쓴다. */
(function () {
'use strict';
if (window.StockOut) return;
const LABEL = {'6a': '식스에이', kop: '코페리', apt: '아페티', yar: '야르', pp: '프피', akoi: '아코이', koz: '코즈미'};
const DEST = 'zonly', DEST_NAME = '지그재그 직진배송', LS = 'bb_stock_out_v1', LS_B = 'bb_stock_out_brand', NAME_KEY = 'agents_receive_name';
const CHUNK = 60, SHOW = 250, DRAFT_MS = 3 * 864e5, LOG_DAYS = 45;
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const n = v => Number(v || 0).toLocaleString('ko-KR');
const p2 = v => String(v).padStart(2, '0');
const hm = ms => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const keyOf = x => `${x.b}|${x.n}|${x.o}`;
const wait = ms => new Promise(r => setTimeout(r, ms));
const say = (m, k) => { try { toast(m, k || 'ok'); } catch (e) {} };
const me = () => { try { return (localStorage.getItem('brightbeed_diary_me') || localStorage.getItem(NAME_KEY) || '').trim().slice(0, 20); } catch (e) { return ''; } };
const S = {el: null, view: 'list', rows: null, by: new Map(), at: 0, bad: '', q: '', brand: '', only: false, cart: new Map(), sent: null, res: new Map(), sendErr: '', sending: false, checking: false,
  name: '', log: null, logAt: 0, logBad: '', ask: '', undoing: new Set(), logMsg: '', tm: 0, hold: 0, back: null, ov: ''};

/* ── 이 브라우저에 남기는 것 — 적던 수량 · 보낸(보내던) 묶음 ── */
function keep() {
  try { localStorage.setItem(LS, JSON.stringify({at: Date.now(), cart: [...S.cart.values()], sent: S.sent})); } catch (e) { /* 저장소가 꽉 차도 화면은 그대로 */ }
}
function recall() {
  let d = null; try { d = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}
  S.cart = new Map(); S.sent = null;
  if (!d || typeof d !== 'object') return;
  if (d.sent && Array.isArray(d.sent.items) && d.sent.items.length) S.sent = d.sent;
  if (Date.now() - (d.at || 0) > DRAFT_MS) return;
  (Array.isArray(d.cart) ? d.cart : []).forEach(x => { if (x && LABEL[x.b] && x.n && /^\d+$/.test(String(x.q)) && +x.q > 0) S.cart.set(keyOf(x), {b: x.b, n: x.n, o: x.o || '', cat: x.cat || '', q: +x.q}); });
}

/* ── 서버 ── */
async function api(path, body) {
  const base = await loadProxyBase();
  if (!base) throw new Error('서버에 연결되지 않았어요');
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 40000);
  try {
    const r = await fetch(base + path, {method: body ? 'POST' : 'GET', headers: Object.assign({'X-Brightbeed-PIN': ghPin(), 'Accept': 'application/json'}, body ? {'Content-Type': 'application/json'} : {}),
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: ac.signal});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) { const e = new Error(j.error || 'HTTP ' + r.status); e.no = r.status === 400; throw e; }      // 400 = 서버가 안 받음 (아무것도 안 들어감)
    return j;
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('응답이 늦어요');
    throw e;
  } finally { clearTimeout(tm); }
}
async function loadRows() {
  const j = await api('/erp/catalog?fresh=1');
  const prep = (window.PoMap && window.PoMap._t && window.PoMap._t.prep) || (r => r);
  const rows = (j.items || []).filter(x => !x.t && LABEL[x.b] && !/^B급/.test(x.n)).map(x => prep({b: x.b, lab: LABEL[x.b], r: x.row, n: x.n, o: x.o || '', cat: x.c || '', s: x.s}));
  if (rows.length < 50) throw new Error('재고 줄이 너무 적어요');
  S.rows = rows; S.by = new Map(rows.map(r => [keyOf(r), r])); S.at = Date.now();
}
async function loadLog() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const j = await api('/erp/moves?from=' + (d.getTime() - LOG_DAYS * 864e5));
  S.log = (j.moves || []).filter(m => m.dest === DEST); S.logAt = Date.now(); S.logBad = '';
}
const undoOf = id => (S.log || []).find(x => x.undoOf === id && x.kind === 'in' && x.status !== 'failed');      // 이미 되돌렸거나 되돌리는 중
const at = m => m.at || m.appliedAt || 0;
const today = ms => new Date(ms).toDateString() === new Date().toDateString();
const livOuts = () => (S.log || []).filter(m => m.kind === 'out' && m.status === 'applied' && !((undoOf(m.id) || {}).status === 'applied'));

/* ── 찾기 ── 안 치면 고른 브랜드 전부, 치면 모든 브랜드에서 — 고른 브랜드 먼저 · 다른 브랜드 · 비슷한 이름 */
const mine = r => S.brand === 'all' || r.b === S.brand;
function search() {
  if (S.only) return {a: [...S.cart.keys()].map(k => S.by.get(k)).filter(Boolean), o: [], b: []};
  const q = S.q.trim();
  if (!q) return {a: S.rows.filter(mine), o: [], b: []};
  const f = window.PoMap && window.PoMap._t && window.PoMap._t.find;
  let hit, near = [];
  if (f) { const x = f(S.rows, q); hit = x.filter(y => y.all).map(y => y.r); near = x.filter(y => !y.all).map(y => y.r); }
  else { const ws = q.toLowerCase().split(/\s+/); hit = S.rows.filter(r => { const t = `${r.lab} ${r.n} ${r.o}`.toLowerCase(); return ws.every(w => t.includes(w)); }); }
  return {a: hit.filter(mine), o: hit.filter(r => !mine(r)), b: hit.length >= 8 ? [] : near.slice(0, 12)};
}

/* ── 창 ── */
function css() {
  if (document.getElementById('soutCss')) return;
  const s = document.createElement('style'); s.id = 'soutCss';
  s.textContent = `
#soutScrim{position:fixed;inset:0;z-index:99970;background:rgba(15,23,42,.45)}
#soutDlg{position:fixed;z-index:99971;left:50%;top:50%;transform:translate(-50%,-50%);width:min(720px,calc(100vw - 24px));height:min(820px,calc(100vh - 32px));height:min(820px,calc(100dvh - 32px));display:flex;flex-direction:column;background:var(--bg-1,#fff);color:var(--text-1,#1f2329);border-radius:14px;box-shadow:0 24px 60px rgba(15,23,42,.28);font-size:13px;line-height:1.5;text-align:left}
#soutDlg button{font:inherit;cursor:pointer}#soutDlg input{font:inherit;color:inherit}
#soutDlg .h{flex:none;display:flex;gap:10px;align-items:flex-start;padding:15px 18px 10px}
#soutDlg .h h2{margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em;color:var(--text-0,#111)}#soutDlg .h h2 span{font-weight:700;color:var(--text-2,#555);margin-left:6px;font-size:14px}
#soutDlg .h p{margin:2px 0 0;font-size:12px;color:var(--text-3,#777)}
#soutDlg .x{margin-left:auto;flex:none;width:34px;height:34px;border:0;border-radius:8px;background:transparent;color:var(--text-3,#777);font-size:17px}
#soutDlg .tb{flex:none;display:flex;gap:6px;padding:0 18px 10px;border-bottom:1px solid var(--line,#e5e7eb)}
#soutDlg .tb button,#soutDlg .ch button{flex:none;border:1px solid var(--line-2,#d5d9e0);background:var(--bg-1,#fff);color:var(--text-1,#333);border-radius:999px;padding:0 13px;height:34px;font-size:12.5px;font-weight:700;white-space:nowrap}
#soutDlg .tb .on,#soutDlg .ch .on{background:#1f2329;border-color:#1f2329;color:#fff}
#soutDlg .b{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px 18px 14px}
#soutDlg .top{position:sticky;top:-12px;z-index:2;margin:-12px -18px 0;padding:12px 18px 8px;background:var(--bg-1,#fff)}
#soutDlg .f{width:100%;height:42px;padding:0 12px;border:1px solid var(--line-2,#d5d9e0);border-radius:10px;font-size:16px;background:var(--bg-1,#fff);outline:0;box-sizing:border-box}
#soutDlg .f:focus{border-color:var(--text-1,#1f2329)}
#soutDlg .ch{display:flex;gap:6px;margin-top:8px;overflow-x:auto;scrollbar-width:none}#soutDlg .ch::-webkit-scrollbar{display:none}#soutDlg .ch button{height:32px;font-size:12px;padding:0 11px}
#soutDlg .s{margin-top:12px;font-size:11.5px;font-weight:700;color:var(--text-3,#777)}
#soutDlg .l{margin-top:6px;border:1px solid var(--line,#e5e7eb);border-radius:10px;overflow:hidden}
#soutDlg .gh{padding:9px 12px 2px;font-size:13.5px;font-weight:700;color:var(--text-0,#111);overflow-wrap:anywhere}
#soutDlg .gh i,#soutDlg .tx i{font-style:normal;font-weight:600;color:var(--text-3,#777);margin-right:6px}
#soutDlg .r{display:grid;grid-template-columns:minmax(0,1fr) auto 92px;gap:12px;align-items:center;min-height:48px;padding:5px 10px 5px 12px;border-bottom:1px solid var(--line,#eef0f3)}
#soutDlg .l>:last-child,#soutDlg .g>:last-child{border-bottom:0}#soutDlg .g{border-bottom:1px solid var(--line,#eef0f3)}#soutDlg .g .r{border-bottom:0;min-height:44px}
#soutDlg .r.on{background:var(--bg-2,#f1f4f8)}
#soutDlg .tx{min-width:0}#soutDlg .tx b{display:block;font-size:13.5px;font-weight:700;color:var(--text-0,#111);overflow-wrap:anywhere}#soutDlg .tx small{display:block;font-size:12.5px;color:var(--text-2,#555);overflow-wrap:anywhere}#soutDlg .g .tx small{font-size:13px;color:var(--text-1,#333)}
#soutDlg .st{font-size:12.5px;color:var(--text-3,#777);white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}#soutDlg .st b{color:var(--text-1,#333);font-weight:700}#soutDlg .st .m{color:var(--danger,#dc2626)}
#soutDlg .r input{width:92px;height:38px;padding:0 10px;border:1px solid var(--line-2,#d5d9e0);border-radius:8px;text-align:right;font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;background:var(--bg-1,#fff);box-sizing:border-box;outline:0}
#soutDlg .r input:focus{border-color:#1f2329;box-shadow:0 0 0 1px #1f2329}#soutDlg .r input::placeholder{color:var(--text-3,#999);opacity:.45;font-weight:500}#soutDlg .r input:disabled{background:var(--bg-2,#f3f4f6)}
#soutDlg .none{padding:22px 12px;color:var(--text-3,#777);font-size:13px;text-align:center}#soutDlg .none button{margin-top:8px;height:36px;padding:0 14px;border:1px solid var(--line-2,#d5d9e0);border-radius:9px;background:var(--bg-1,#fff);font-weight:700}
#soutDlg .p{display:grid;grid-template-columns:minmax(0,1fr) auto auto 34px;gap:12px;align-items:center;padding:8px 8px 8px 12px;border-bottom:1px solid var(--line,#eef0f3)}#soutDlg .p.n3{grid-template-columns:minmax(0,1fr) auto auto}
#soutDlg .p .q{font-size:17px;font-weight:900;color:var(--text-0,#111);font-variant-numeric:tabular-nums;white-space:nowrap}#soutDlg .p .ba{min-width:104px;text-align:right;font-size:12.5px;color:var(--text-2,#555);font-variant-numeric:tabular-nums;white-space:nowrap}
#soutDlg .p .w{grid-column:1/-1;font-size:12px;font-weight:600;color:var(--danger,#dc2626)}#soutDlg .p .w.g0{color:var(--text-2,#555)}
#soutDlg .del{width:34px;height:34px;border:0;border-radius:8px;background:transparent;color:var(--text-3,#999)}
#soutDlg .nm{display:flex;gap:10px;align-items:center;margin-top:14px;font-size:13px;font-weight:700}#soutDlg .nm input{flex:1;max-width:220px;height:40px;padding:0 12px;border:1px solid var(--line-2,#d5d9e0);border-radius:9px;font-size:16px;background:var(--bg-1,#fff)}
#soutDlg .v{margin-top:12px;font-size:12.5px;line-height:1.65;color:var(--text-2,#555)}#soutDlg .e{margin-top:10px;font-size:13px;font-weight:600;color:var(--danger,#dc2626)}#soutDlg .e:empty{display:none}
#soutDlg .e button{margin-left:8px;height:34px;padding:0 12px;border:1px solid var(--danger,#dc2626);border-radius:8px;background:transparent;color:var(--danger,#dc2626);font-weight:700}
#soutDlg .day{margin-top:16px;font-size:13px;font-weight:800;color:var(--text-0,#111);display:flex;gap:8px;align-items:baseline}#soutDlg .day:first-child{margin-top:2px}#soutDlg .day span{font-size:12px;font-weight:600;color:var(--text-3,#777)}
#soutDlg .bt{display:flex;gap:8px;align-items:center;padding:7px 12px;background:var(--bg-2,#f8fafc);border-bottom:1px solid var(--line,#eef0f3);font-size:12px;color:var(--text-2,#555)}#soutDlg .bt b{color:var(--text-0,#111)}#soutDlg .bt .u{margin-left:auto}
#soutDlg .u{border:0;background:transparent;color:var(--text-2,#555);font-size:12px;font-weight:700;text-decoration:underline;text-underline-offset:2px;padding:8px 4px;white-space:nowrap}#soutDlg .u.ask{color:var(--danger,#dc2626)}#soutDlg .u:disabled{opacity:.5;cursor:default;text-decoration:none}
#soutDlg .tag{font-size:12px;font-weight:700;color:var(--text-3,#777);white-space:nowrap}#soutDlg .tag.bad{color:var(--danger,#dc2626)}#soutDlg .p.off .tx b,#soutDlg .p.off .q,#soutDlg .p.off .tx small{text-decoration:line-through;color:var(--text-3,#999)}
#soutDlg .ft{flex:none;display:flex;gap:8px;align-items:center;padding:11px 18px calc(13px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line,#e5e7eb)}#soutDlg .ft:empty{display:none}
#soutDlg .ft .sum{margin-right:auto;font-size:13px;color:var(--text-2,#555);font-variant-numeric:tabular-nums}#soutDlg .ft .sum b{font-size:15px;color:var(--text-0,#111)}
#soutDlg .ft button{height:42px;padding:0 16px;border:1px solid var(--line-2,#d5d9e0);border-radius:10px;background:var(--bg-1,#fff);color:var(--text-1,#333);font-weight:700;white-space:nowrap}
#soutDlg .ft .go{border-color:#1f2329;background:#1f2329;color:#fff}#soutDlg .ft .go:disabled{opacity:.35;cursor:default}
#soutDlg:focus{outline:0}#soutDlg button:focus-visible{outline:2px solid #93c5fd;outline-offset:1px}
@media (max-width:600px){#soutDlg{left:0;right:0;top:auto;bottom:0;transform:none;width:100%;height:94vh;height:94dvh;border-radius:16px 16px 0 0}#soutDlg .h{padding:13px 14px 8px}#soutDlg .tb{padding:0 14px 9px}#soutDlg .b{padding:12px 14px 12px}#soutDlg .top{margin:-12px -14px 0;padding:12px 14px 8px}#soutDlg .r{grid-template-columns:minmax(0,1fr) auto 80px;gap:8px;padding:6px 8px 6px 11px}#soutDlg .r input{width:80px;height:42px}#soutDlg .ft{padding:10px 14px calc(12px + env(safe-area-inset-bottom,0px))}#soutDlg .ft button{padding:0 13px}#soutDlg .p{gap:8px}#soutDlg .p .ba{min-width:0}#soutDlg .log .p{grid-template-columns:minmax(0,1fr) auto auto}#soutDlg .log .p .ba{grid-column:1;grid-row:2;text-align:left}}
@media print{#soutDlg,#soutScrim{display:none}}`;
  document.head.appendChild(s);
}
const showLab = () => S.brand === 'all' || S.only || !!S.q.trim();
const cartSum = () => ({k: S.cart.size, q: [...S.cart.values()].reduce((a, x) => a + x.q, 0)});
const stTxt = r => {
  if (r.s == null) return '<span class="m">남은 재고 빈칸</span>';
  const c = S.cart.get(keyOf(r)), a = c ? r.s - c.q : null;
  return `남은 <b>${n(r.s)}</b>${a == null ? '' : ` → <b${a < 0 ? ' class="m"' : ''}>${n(a)}</b>`}`;
};
function rowHTML(r, withName) {
  const k = keyOf(r), c = S.cart.get(k), blank = r.s == null;
  return `<div class="r${c ? ' on' : ''}" data-row="${E(k)}"><span class="tx">${withName ? `<b>${showLab() ? `<i>${E(r.lab)}</i>` : ''}${E(r.n)}</b>` : ''}${withName && !r.o ? '' : `<small>${E(r.o || '옵션 없음')}</small>`}</span><span class="st">${stTxt(r)}</span>`
    + `<input type="text" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="${blank ? '–' : '0'}" value="${c ? c.q : ''}" data-q="${E(k)}" aria-label="${E(r.n)} ${E(r.o)} 보낸 수량"${blank ? ' disabled title="재고 ERP 에 남은 재고를 먼저 적어 주세요"' : ''}></div>`;
}
function groupHTML(rows) {
  const g = new Map(); rows.forEach(r => { const k = r.b + '|' + r.n; if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
  return [...g.values()].map(rs => rs.length === 1 ? rowHTML(rs[0], true)
    : `<div class="g"><div class="gh">${showLab() ? `<i>${E(rs[0].lab)}</i>` : ''}${E(rs[0].n)}</div>${rs.map(r => rowHTML(r, false)).join('')}</div>`).join('');
}
function listHTML() {
  if (!S.rows) return S.bad ? `<div class="none">${E(S.bad)}<br><button type="button" data-act="reload">다시 불러오기</button></div>` : '<div class="none">재고 ERP 를 불러오는 중…</div>';
  const x = search(), a = x.a.slice(0, SHOW);
  if (S.only && !a.length) return '<div class="none">적은 수량이 없어요</div>';
  if (!a.length && !x.o.length && !x.b.length) return '<div class="none">찾는 상품이 없어요 — 다른 낱말로 찾아 보세요</div>';
  return (a.length ? `<div class="l">${groupHTML(a)}</div>${x.a.length > SHOW ? `<div class="none">${n(x.a.length - SHOW)}개 더 있어요 — 이름으로 찾아 주세요</div>` : ''}` : '')
    + (x.o.length ? `<div class="s">다른 브랜드</div><div class="l">${groupHTML(x.o.slice(0, 60))}</div>` : '')
    + (x.b.length ? `<div class="s">비슷한 이름</div><div class="l">${groupHTML(x.b)}</div>` : '');
}
const chipsHTML = () => ['all', ...Object.keys(LABEL)].map(b => `<button type="button" data-brand="${b}" class="${!S.only && S.brand === b ? 'on' : ''}">${b === 'all' ? '전체' : E(LABEL[b])}</button>`).join('');
function lineHTML(x, right, warn, cls) {
  return `<div class="p ${cls || ''}"><span class="tx"><b><i>${E(LABEL[x.b] || x.b)}</i>${E(x.n)}</b>${x.o ? `<small>${E(x.o)}</small>` : ''}</span>${right}${warn || ''}</div>`;
}
function confirmHTML() {
  const list = [...S.cart.values()], warns = [];
  const rows = list.map(x => {
    const k = keyOf(x), r = S.by.get(k), w = [];
    if (!r) w.push('<span class="w">재고 ERP 에서 이 줄을 못 찾았어요 — ✕ 로 빼고 다시 골라 주세요</span>');
    else if (r.s == null) w.push('<span class="w">남은 재고가 빈칸이라 못 빼요 — 재고 ERP 에 먼저 적어 주세요</span>');
    else if (r.s - x.q < 0) w.push(`<span class="w">남은 재고(${n(r.s)})보다 많아요 — 마이너스가 돼요. 수량을 다시 봐 주세요</span>`);
    const t = livOuts().filter(m => today(at(m)) && `${m.brand}|${m.product}|${m.option || ''}` === k);
    if (t.length) w.push(`<span class="w g0">오늘 이미 출고했어요 — ${t.slice(0, 3).map(m => `${hm(at(m))} ${E(m.by || '')} −${n(m.qty)}`).join(', ')}</span>`);
    if (!r || r.s == null) warns.push(k);
    return lineHTML(x, `<span class="q">−${n(x.q)}</span><span class="ba">${r && r.s != null ? `${n(r.s)} → ${n(r.s - x.q)}` : ''}</span><button type="button" class="del" data-del="${E(k)}" aria-label="빼기">✕</button>`, w.join(''));
  });
  return {html: `<div class="s">${E(DEST_NAME)}으로 이렇게 보내요</div><div class="l">${rows.join('')}</div>
<label class="nm">입력자 <input id="soutName" type="text" maxlength="20" value="${E(S.name)}" placeholder="이름" autocomplete="off"></label>
<div class="v">누르면 재고 ERP 남은 재고에서 바로 빠지고, 몇 시에 누가 넣었는지 남아요. 잘못 넣으면 [출고 내역]에서 되돌릴 수 있어요.</div><div class="e" role="alert">${E(S.sendErr)}</div>`, ok: list.length > 0 && !warns.length};
}
const stWord = m => !m ? (S.sending ? '보내는 중…' : '확인 안 됨') : m.status === 'applied' ? '반영됨' : m.status === 'pending' ? '반영 중…' : '못 뺐어요';
function doneHTML() {
  const items = (S.sent && S.sent.items) || [], rs = items.map(x => S.res.get(x.id)), ok = rs.filter(r => r && r.status === 'applied').length, bad = rs.filter(r => r && (r.status === 'failed' || r.status === 'stuck')).length;
  const rest = items.length - ok - bad, lost = items.filter(x => !S.res.get(x.id)).length;
  const head = S.sending ? (S.checking ? '지난번에 보낸 출고가 들어갔는지 확인하는 중…' : '재고 ERP 에 넣는 중이에요…') : rest ? (lost ? '' : `${n(rest)}건은 아직 반영 중이에요 — 서버가 계속 넣어요. 다시 보내지 마세요`) : bad ? `${n(ok)}건 반영 · ${n(bad)}건은 못 뺐어요` : `${n(ok)}품목 · ${n(items.reduce((a, x) => a + x.q, 0))}개 출고했어요`;
  const err = !S.sending && lost ? `<div class="e" role="alert">${E(S.sendErr || '응답이 끊겨 들어갔는지 확인하지 못했어요')} — 다시 보내도 두 번 빠지지 않아요<button type="button" data-act="resend">다시 보내기</button><button type="button" data-act="drop">보내지 않기</button></div>` : '';
  return `<div class="s">${E(head)}</div>${err}<div class="l">${items.map(x => { const m = S.res.get(x.id), f = m && (m.status === 'failed' || m.status === 'stuck');
    return lineHTML(x, `<span class="q">−${n(x.q)}</span><span class="ba">${m && m.after != null ? `${m.before == null ? '' : n(m.before)} → ${n(m.after)}<br>` : ''}<span class="tag${f ? ' bad' : ''}">${stWord(m)}</span></span>`, f && m.reason ? `<span class="w">${E(m.reason)}</span>` : '', 'n3'); }).join('')}</div>`;
}
function logHTML() {
  if (!S.log) return S.logBad ? `<div class="none">${E(S.logBad)}<br><button type="button" data-act="relog">다시 불러오기</button></div>` : '<div class="none">출고 내역을 불러오는 중…</div>';
  const outs = S.log.filter(m => m.kind === 'out');
  if (!outs.length) return '<div class="none">아직 출고한 것이 없어요</div>';
  const W = '일월화수목금토', days = new Map();
  outs.forEach(m => { const d = new Date(at(m)), k = d.toDateString(); if (!days.has(k)) days.set(k, {d, bs: new Map()}); const bk = `${Math.floor(at(m) / 1000)}|${m.by || ''}`, bs = days.get(k).bs; if (!bs.has(bk)) bs.set(bk, []); bs.get(bk).push(m); });
  let h = S.logMsg ? `<div class="e" role="alert" style="margin:0 0 8px">${E(S.logMsg)}</div>` : '';
  const live = m => m.status === 'applied' && !undoOf(m.id), sum = a => a.filter(live).reduce((x, m) => x + (m.qty || 0), 0);
  days.forEach(({d, bs}) => {
    const all = [...bs.values()].flat();
    h += `<div class="day">${d.getMonth() + 1}월 ${d.getDate()}일 (${W[d.getDay()]})<span>${n(sum(all))}개 출고</span></div>`;
    bs.forEach((ms, bk) => {
      const can = ms.filter(m => live(m) && !S.undoing.has(m.id)), id = 'b:' + bk;
      h += `<div class="l log"><div class="bt"><b>${hm(at(ms[0]))}</b><span>${E(ms[0].by || '이름 없음')}</span><span>${sum(ms) ? `${n(new Set(ms.filter(live).map(m => m.brand + m.product + m.option)).size)}품목 · ${n(sum(ms))}개` : ms.some(m => m.status === 'applied') ? '되돌림' : ''}</span>${can.length > 1 ? `<button type="button" class="u${S.ask === id ? ' ask' : ''}" data-undo="${E(can.map(m => m.id).join(','))}" data-ask="${E(id)}">${S.ask === id ? `정말 ${n(can.length)}줄 되돌리기` : '모두 되돌리기'}</button>` : ''}</div>`
        + ms.map(m => {
          const u = undoOf(m.id), f = m.status === 'failed' || m.status === 'stuck', ing = S.undoing.has(m.id) || (u && u.status === 'pending');
          const r = f ? '<span class="tag bad">못 뺐어요</span>' : m.status === 'pending' ? '<span class="tag">반영 중…</span>' : ing ? '<span class="tag">되돌리는 중…</span>' : u ? `<span class="tag" title="${E(u.by || '')}">되돌림 ${hm(u.appliedAt || at(u))}</span>`
            : `<button type="button" class="u${S.ask === m.id ? ' ask' : ''}" data-undo="${E(m.id)}" data-ask="${E(m.id)}">${S.ask === m.id ? '정말 되돌리기' : '되돌리기'}</button>`;
          return lineHTML({b: m.brand, n: m.product, o: m.option}, `<span class="q">−${n(m.qty)}</span><span class="ba">${!f && m.after != null ? `${m.before == null ? '' : n(m.before)} → ${n(m.after)}<br>` : ''}${r}</span>`, f && m.reason ? `<span class="w">${E(m.reason)}</span>` : '', 'n3' + (u && u.status === 'applied' ? ' off' : ''));
        }).join('') + '</div>';
    });
  });
  return h;
}
function draw() {
  const el = S.el; if (!el) return;
  el.querySelectorAll('.tb button').forEach(b => b.classList.toggle('on', (b.dataset.tab === 'log') === (S.view === 'log')));
  const b = el.querySelector('.b');
  if (S.view === 'list') {
    b.innerHTML = `<div class="top"><input class="f" type="search" placeholder="상품명 · 옵션 찾기 (비슷한 이름도 나와요)" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="상품명 옵션 찾기" value="${E(S.q)}"><div class="ch">${chipsHTML()}</div></div><div id="soutList">${listHTML()}</div>`;
  } else if (S.view === 'confirm') b.innerHTML = confirmHTML().html;
  else if (S.view === 'done') b.innerHTML = doneHTML();
  else b.innerHTML = logHTML();
  foot();
}
function drawList() {
  if (!S.el || S.view !== 'list') return;
  S.el.querySelector('#soutList').innerHTML = listHTML();
  S.el.querySelector('.ch').innerHTML = chipsHTML();
  foot();
}
function foot() {
  const f = S.el && S.el.querySelector('.ft'); if (!f) return;
  const c = cartSum();
  if (S.view === 'list') f.innerHTML = `<span class="sum">${c.k ? `<b>${n(c.k)}</b>품목 · <b>${n(c.q)}</b>개` : '보낸 수량을 적어 주세요 (낱개 기준)'}</span>${c.k ? `<button type="button" data-act="only">${S.only ? '전체 보기' : '적은 것만'}</button>` : ''}<button type="button" class="go" data-act="confirm"${c.k && S.rows ? '' : ' disabled'}>확인</button>`;
  else if (S.view === 'confirm') { const x = confirmHTML(); f.innerHTML = `<span class="sum"><b>${n(c.k)}</b>품목 · <b>${n(c.q)}</b>개</span><button type="button" data-act="back">뒤로</button><button type="button" class="go" data-act="send"${x.ok && !S.sending ? '' : ' disabled'}>출고</button>`; }
  else if (S.view === 'done') f.innerHTML = `<span class="sum"></span><button type="button" data-tab="log">출고 내역</button><button type="button" class="go" data-act="${S.sending ? 'close' : 'more'}">${S.sending ? '닫기' : '확인했어요'}</button>`;
  else f.innerHTML = '';
}
function mark(k) {      // 수량을 치는 동안 그 줄만 — 입력 칸은 다시 안 그린다
  const r = S.by.get(k); if (!r || !S.el) return;
  S.el.querySelectorAll('.r').forEach(x => { if (x.dataset.row === k) { x.classList.toggle('on', S.cart.has(k)); x.querySelector('.st').innerHTML = stTxt(r); } });
  foot();
}

function fresh() {      // 남은 재고 숫자만 새 값으로 — 치던 칸 · 커서는 그대로
  if (!S.el || S.view !== 'list') return;
  S.el.querySelectorAll('.r').forEach(x => { const r = S.by.get(x.dataset.row); if (r) x.querySelector('.st').innerHTML = stTxt(r); });
  foot();
}

/* ── 보내기 ── */
const newId = i => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7).padEnd(5, '0') + i.toString(36).padStart(2, '0');
async function check(ids) {      // 들어갔는지 서버에 묻기 (접수ID)
  for (let i = 0; i < ids.length; i += CHUNK) {
    const j = await api('/erp/moves?ids=' + ids.slice(i, i + CHUNK).join(','));
    (j.moves || []).forEach(m => S.res.set(m.id, m));
  }
}
const open_ = () => S.sent.items.filter(x => { const m = S.res.get(x.id); return !m || m.status === 'pending'; });
async function send() {
  if (S.sending || !S.sent) return;
  const sent = S.sent;
  S.sending = true; S.sendErr = ''; S.view = 'done'; draw();
  try {
    const todo = sent.items.filter(x => !S.res.get(x.id));
    for (let i = 0; i < todo.length; i += CHUNK) {
      const part = todo.slice(i, i + CHUNK);
      try {
        await api('/erp/moves', {by: sent.by, raw: `출고 입력 · ${DEST_NAME}`, moves: part.map(x => ({id: x.id, brand: x.b, product: x.n, option: x.o, category: x.cat || '', kind: 'out', dest: DEST, qty: x.q}))});
        part.forEach(x => S.res.set(x.id, {id: x.id, status: 'pending'}));
      } catch (e) {
        if (e.no) { S.sendErr = '접수하지 못했어요 — ' + e.message; break; }      // 서버가 안 받음
        S.sendErr = '응답이 끊겼어요 (' + e.message + ')';
        try { await check(part.map(x => x.id)); } catch (e2) {}
        if (part.some(x => !S.res.get(x.id))) break;
      }
      if (S.view === 'done') draw();
    }
    const t0 = Date.now();
    while (S.sent === sent && Date.now() - t0 < 75000) {
      const ids = open_().filter(x => S.res.get(x.id)).map(x => x.id);
      if (!ids.length) break;
      await wait(Date.now() - t0 < 12000 ? 1500 : 3000);
      try { await check(ids); } catch (e) {}
      if (S.view === 'done') draw();
    }
  } finally {
    S.sending = false;
    if (S.sent === sent) settle();
    if (S.view === 'done') draw();
    S.log = null;
    try { rcvHomeLoad(); } catch (e) {}
    if (!S.el) { const ok = sent.items.filter(x => (S.res.get(x.id) || {}).status === 'applied').length; if (ok) say(`출고 ${n(ok)}품목 — 재고 ERP 에서 뺐어요`); }
  }
}
function settle() {      // 들어간 줄은 적은 목록에서 뺀다 — 못 뺀 줄은 남겨 고쳐서 다시
  S.sent.items.forEach(x => { const m = S.res.get(x.id); if (m && (m.status === 'applied' || m.status === 'pending')) { const c = S.cart.get(keyOf(x)); if (c && c.q === x.q) S.cart.delete(keyOf(x)); } });
  keep();
}
async function goConfirm() {
  S.hold = Date.now() + 800; S.view = 'confirm'; S.sendErr = ''; S.only = false; S.name = S.name || me();
  draw();
  try { await loadRows(); } catch (e) {}                              // 빼기 직전 값으로 다시
  if (!S.log) try { await loadLog(); } catch (e) {}                   // 오늘 이미 보낸 것 알림
  if (S.view === 'confirm' && S.el) { const i = document.activeElement && document.activeElement.id === 'soutName'; if (!i) draw(); else foot(); }
}
function goSend() {
  const inp = S.el.querySelector('#soutName'); S.name = (inp ? inp.value : S.name).trim().slice(0, 20);
  if (!S.name) { S.sendErr = '입력자 이름을 적어 주세요'; draw(); const i = S.el.querySelector('#soutName'); if (i) i.focus(); return; }
  S.hold = Date.now() + 800;
  if (!me()) try { localStorage.setItem(NAME_KEY, S.name); } catch (e) {}
  S.sent = {at: Date.now(), by: S.name, items: [...S.cart.values()].map((x, i) => Object.assign({id: newId(i)}, x))};
  S.res = new Map();
  keep();                                                              // 보내기 전에 접수ID 부터 적어 둔다
  send();
}
/* 지난번에 보내다 창이 닫혔으면 — 들어갔는지부터 본다 */
async function resume() {
  S.view = 'done'; S.sending = S.checking = true; S.sendErr = ''; draw();
  const sent = S.sent;
  try { await check(sent.items.map(x => x.id)); } catch (e) { S.sendErr = '서버에 연결되지 않아 들어갔는지 확인하지 못했어요'; }
  S.sending = S.checking = false;
  if (S.sent !== sent) return;
  settle();
  if (sent.items.every(x => (S.res.get(x.id) || {}).status === 'applied')) { S.sent = null; keep(); S.view = 'list'; draw(); say('지난번 출고는 모두 들어가 있어요'); return; }
  draw();
}

/* ── 되돌리기 ── */
async function undo(ids) {
  const ms = ids.map(id => (S.log || []).find(m => m.id === id)).filter(m => m && m.status === 'applied' && !undoOf(m.id));
  S.ask = ''; S.logMsg = '';
  if (!ms.length) { draw(); return; }
  ms.forEach(m => S.undoing.add(m.id)); draw();
  try {
    const got = [];
    for (let i = 0; i < ms.length; i += CHUNK) {
      const j = await api('/erp/moves', {by: me() || S.name || '', raw: `출고 되돌리기 · ${DEST_NAME}`, moves: ms.slice(i, i + CHUNK).map(m => ({brand: m.brand, product: m.product, option: m.option || '', category: m.category || '', kind: 'in', dest: DEST, qty: m.qty, undoOf: m.id}))});
      got.push(...(j.moves || []).map(x => x.id));
    }
    let bad = '';
    for (let i = 0; i < 20; i++) {
      await wait(1500);
      const j = await api('/erp/moves?ids=' + got.slice(0, CHUNK).join(',')).catch(() => null);
      const st = j && j.moves ? j.moves : [];
      const f = st.find(x => x.status === 'failed' || x.status === 'stuck'); if (f) bad = f.reason || '되돌리지 못했어요';
      if (st.length && st.every(x => x.status !== 'pending')) break;
    }
    if (bad) S.logMsg = bad; else say(ms.length > 1 ? `출고 ${ms.length}줄을 되돌렸어요` : '출고를 되돌렸어요');
  } catch (e) { S.logMsg = e.no ? e.message : '되돌리지 못했어요 — 내역을 다시 보고 눌러 주세요 (' + e.message + ')'; }
  S.undoing.clear();
  try { await loadLog(); } catch (e) {}
  if (S.view === 'log') draw();
  try { rcvHomeLoad(); } catch (e) {}
}

/* ── 열고 닫기 ── */
async function open(tab) {
  if (S.el) return;
  css();
  if (!S.sending) recall();
  try { S.brand = S.brand || localStorage.getItem(LS_B) || '6a'; } catch (e) { S.brand = S.brand || '6a'; }
  if (S.brand !== 'all' && !LABEL[S.brand]) S.brand = '6a';
  Object.assign(S, {view: tab === 'log' ? 'log' : 'list', q: '', only: false, bad: '', ask: '', logMsg: '', name: me(), back: document.activeElement, ov: document.body.style.overflow});
  const sc = document.createElement('div'); sc.id = 'soutScrim'; sc.addEventListener('click', () => close());
  const el = document.createElement('div'); el.id = 'soutDlg'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '출고 입력'); el.tabIndex = -1;
  el.innerHTML = `<div class="h"><div><h2>출고 입력<span>${E(DEST_NAME)}</span></h2><p>창고로 보낸 수량만 · 고객 택배는 자동으로 빠져요</p></div><button type="button" class="x" data-act="close" aria-label="닫기">✕</button></div>
<div class="tb"><button type="button" data-tab="in">출고 입력</button><button type="button" data-tab="log">출고 내역</button></div><div class="b"></div><div class="ft"></div>`;
  document.body.appendChild(sc); document.body.appendChild(el); S.el = el;
  document.body.style.overflow = 'hidden';
  el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('keydown', onKey);
  if (S.sending) S.view = 'done';
  draw();
  if (matchMedia('(hover:hover) and (min-width:601px)').matches && S.view === 'list') el.querySelector('.f').focus(); else el.focus({preventScroll: true});
  if (S.sent && !S.sending && tab !== 'log') { await resume(); if (S.el !== el) return; }
  await fill();
}
async function fill() {
  if (S.view === 'log') { try { await loadLog(); } catch (e) { S.logBad = '출고 내역을 못 불러왔어요'; } if (S.view === 'log') draw(); }
  if (!S.rows || Date.now() - S.at > 30000) {
    const had = !!S.rows;
    try { await loadRows(); S.bad = ''; } catch (e) { S.bad = '재고 ERP 를 못 불러왔어요 — ' + e.message; }
    if (had) fresh(); else drawList();
  }
}
function close() {
  ['soutScrim', 'soutDlg'].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); });
  if (!S.el) return;
  S.el = null; document.body.style.overflow = S.ov || '';
  keep();
  if (S.back && S.back.isConnected) try { S.back.focus({preventScroll: true}); } catch (e) {}
}
function tabTo(t) {
  if (t === 'log') { S.view = 'log'; S.ask = ''; S.logMsg = ''; S.log = null; S.logBad = ''; draw(); fill(); return; }
  S.view = S.sent && (S.sending || open_().length) ? 'done' : 'list';
  draw(); fill();
}
function onClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (Date.now() < S.hold && b.closest('.ft')) return;                 // 두 번 누름 — [확인] 자리에 곧바로 [출고] · [닫기] 가 와서 눌리지 않게
  if (b.dataset.tab) return tabTo(b.dataset.tab);
  if (b.dataset.brand) { S.brand = b.dataset.brand; S.only = false; try { localStorage.setItem(LS_B, S.brand); } catch (x) {} drawList(); return; }
  if (b.dataset.del) { S.cart.delete(b.dataset.del); keep(); if (!S.cart.size) S.view = 'list'; const i = S.el.querySelector('#soutName'); if (i) S.name = i.value; draw(); return; }
  if (b.dataset.undo) { if (S.ask !== b.dataset.ask) { S.ask = b.dataset.ask; const t = S.el.querySelector('.b').scrollTop; draw(); S.el.querySelector('.b').scrollTop = t; return; } return undo(b.dataset.undo.split(',')); }
  const a = b.dataset.act;
  if (a === 'close') return close();
  if (a === 'only') { S.only = !S.only; drawList(); S.el.querySelector('.b').scrollTop = 0; return; }
  if (a === 'confirm') return goConfirm();
  if (a === 'back') { S.view = 'list'; draw(); return; }
  if (a === 'send') return goSend();
  if (a === 'resend') return send();
  if (a === 'drop') { if (S.sent) { S.sent.items = S.sent.items.filter(x => S.res.get(x.id)); if (!S.sent.items.length) { S.sent = null; S.view = 'list'; } keep(); draw(); } return; }      // 안 들어간 줄만 — 적은 수량은 남는다
  if (a === 'more') { S.sent = null; S.res = new Map(); keep(); if (S.cart.size) { S.view = 'list'; S.only = true; draw(); fill(); } else close(); return; }
  if (a === 'reload') { S.bad = ''; drawList(); return fill(); }
  if (a === 'relog') { S.logBad = ''; draw(); return fill(); }
}
function onInput(e) {
  const t = e.target;
  if (t.classList.contains('f')) { S.q = t.value; S.only = false; clearTimeout(S.tm); S.tm = setTimeout(() => { drawList(); if (S.el) S.el.querySelector('.b').scrollTop = 0; }, 90); return; }
  if (t.dataset.q) {
    const v = t.value.replace(/[^0-9]/g, '').slice(0, 5); if (v !== t.value) t.value = v;
    const k = t.dataset.q, r = S.by.get(k);
    if (r && +v > 0) S.cart.set(k, {b: r.b, n: r.n, o: r.o, cat: r.cat || '', q: +v}); else S.cart.delete(k);
    keep(); mark(k);
  }
  if (t.id === 'soutName') S.name = t.value;
}
function onKey(e) {
  if ((e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.dataset && e.target.dataset.q) {      // 엑셀처럼 위아래 줄로
    const all = [...S.el.querySelectorAll('.r input:not(:disabled)')], i = all.indexOf(e.target), x = all[i + (e.key === 'ArrowUp' ? -1 : 1)];
    e.preventDefault(); if (x) { x.focus(); x.select(); x.scrollIntoView({block: 'nearest'}); }
    return;
  }
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('f') && !e.isComposing) { e.preventDefault(); clearTimeout(S.tm); drawList(); const x = S.el.querySelector('.r input:not(:disabled)'); if (x && S.q.trim()) { x.focus(); x.select(); } return; }
  if (e.key === 'Tab') { const f = [...S.el.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(x => x.offsetParent); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.el && !e.isComposing) { e.stopPropagation(); e.preventDefault(); if (S.view === 'confirm' && !S.sending) { S.view = 'list'; draw(); } else close(); } }, true);
window.StockOut = {open, close, _S: S};
})();
