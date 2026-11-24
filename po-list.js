/* 발주 상품 리스트 — 물류팀 (2026-11-24 사장님 "물류팀안에 발주 상품 리스트는 최근 발주한거 싹다 나오게해줘 … 최근 발주내역을 이미지 잘 넣어서 보관해줘.
   그리고 발주 상품 리스트안에서 똑같은건 다 매핑하고" → "굳이 발주서를 볼필요가 없었어. 발주서 동기화 제거하고 최근 발주내역을 더 잘 보이게")
   · 자료 = 프록시 GET /orders-catalog (PIN) ← 맥미니 scripts/po_catalog.py 5분 ← Supabase po_lines (콰이디에어 두 계정 발주 전부, 콰이디에어에서 빠져도 남음).
     발주서(엑셀) 동기화는 걷어냄. 같은 상품 묶기는 서버(재고 ERP 줄 · 메모 이름 · 업체 번호 · 1688 상품 · 사진).
   · 보기 둘 — [상품별] 같은 상품은 카드 한 장(최근 발주 내역이 카드 안에) · [날짜별] 최근 발주를 날짜마다 한 줄씩.
   · 연결 (같은 날 "다들 연결 시켜줘") — 카드마다 재고 ERP(남은 재고 · 발주일)와 MD시트 발주리스트 줄을 같이 보여 준다. 안 이어진 상품은 [ERP 연결]로 찾아 잇는다
     (아직 매핑할 수 있는 발주면 발주 매핑하기 창 = 발주일까지, 지난 발주면 app_kv 'e:판매번호' = 브랜드|상품|옵션 → 맥미니가 5분 안에 읽어 같은 상품끼리 다시 묶는다. 재고는 안 건드린다).
   · 사람이 더 고칠 것: 합치기 · 나누기 · 이름 바꾸기 · 숨기기 = app_kv 'po_list' (kvSet 3방향 합치기, 판매번호 기준이라 묶음이 바뀌어도 남음). 원본 발주는 안 건드린다.
   · 사진 = 저장소 po-img (엣지 함수 po-img 가 1688 사진을 받아 둔 것) → 없으면 1688 원본 → 그것도 없으면 글자.
   · 단가 · 1688 링크는 기밀 명단(secretOk)에게만. 최근 발주 표의 '이전 N회' 딱지도 여기 자료로 (attachKDHistoryChips 가 PoList.history 를 부름).
   index.html 이 맨 끝에서 부른다. 탭을 열 때 · 물류팀을 열고 3초 뒤에만 받는다 (약 80KB) */
(function () {
'use strict';
if (window.PoList) return;
const LABEL = {apt: '아페티', kop: '코페리', koz: '코즈미', '6a': '식스에이', yar: '야르', pp: '프피', akoi: '아코이', '': '브랜드 미정'};
const BR = ['apt', 'kop', 'koz', '6a', 'yar', 'pp', 'akoi', ''];
const KV = 'po_list', KV_LS = 'bb_po_list_v1', UI_LS = 'bb_po_list_ui_v1';
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const n = v => Number(v || 0).toLocaleString('ko-KR');
const $ = id => document.getElementById(id);
const say = (m, k) => { try { toast(m, k || 'ok'); } catch (e) {} };
const sec = () => { try { return !!secretOk(); } catch (e) { return false; } };
const DOW = '일월화수목금토';
const dayT = d => { const t = new Date(d + 'T00:00:00+09:00'); return isNaN(t) ? d : `${+d.slice(5, 7)}월 ${+d.slice(8, 10)}일 (${DOW[new Date(t.getTime() + 9 * 36e5).getUTCDay()]})`; };
const short = d => { const y = new Date().getFullYear(); return (+d.slice(0, 4) === y ? '' : d.slice(2, 4) + '.') + `${+d.slice(5, 7)}.${+d.slice(8, 10)}`; };
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
const S = {raw: null, at: 0, busy: null, kvOn: false, kv: (() => { try { return JSON.parse(localStorage.getItem(KV_LS) || '{}') || {}; } catch (e) { return {}; } })(), list: [], bySn: new Map(), shown: 60, q: '', tm: 0, open: new Set(),
  ui: (() => { try { return Object.assign({view: 'prod', b: '*', k: '*', st: '*', ln: '*', sort: 'recent'}, JSON.parse(localStorage.getItem(UI_LS) || '{}') || {}); } catch (e) { return {view: 'prod', b: '*', k: '*', st: '*', ln: '*', sort: 'recent'}; } })()};
const keepUi = () => { try { localStorage.setItem(UI_LS, JSON.stringify(S.ui)); } catch (e) {} };

/* ── 자료 ── */
async function load(force) {
  if (S.busy) return S.busy;
  if (!force && S.raw && Date.now() - S.at < 5 * 60e3) return S.raw;
  S.busy = (async () => {
    const get = async f => { const base = await loadProxyBase(f); if (!base) throw new Error('서버 연결 안 됨'); return fetch(`${base}/orders-catalog?cb=${Date.now()}`, {headers: {'X-Brightbeed-PIN': ghPin(), Accept: 'application/json'}, cache: 'no-store'}); };
    let r = null; try { r = await get(false); } catch (e) {}
    if (!r || (r.status >= 502 && r.status <= 504)) r = await get(true);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!d || !Array.isArray(d.products)) throw new Error('모양이 달라요');
    S.raw = d; S.at = Date.now();
    if (!S.kvOn) {
      S.kvOn = true;
      const pull = () => { try { kvPull(KV, KV_LS, v => { S.kv = v && typeof v === 'object' ? v : {}; build(); paint(); }); } catch (e) {} };
      pull();
      try { if (window.OfficeLive) window.OfficeLive.on(['app_kv'], pull); } catch (e) {}
    }
    build();
    return d;
  })();
  try { return await S.busy; } finally { S.busy = null; }
}
/* 서버 묶음 + 사람이 합친 것 · 이름 · 숨김 (app_kv: 'm:판매번호' = 합칠 곳 판매번호 · 'n:판매번호' = 이름 · 'h:판매번호' = 1) */
function build() {
  if (!S.raw) return;
  const ps = S.raw.products.map(p => Object.assign({}, p, {parts: [p]})), home = new Map();
  ps.forEach(p => p.orders.forEach(o => home.set(o.sn, p)));
  const up = new Map(ps.map(p => [p, p])), top = p => { while (up.get(p) !== p) p = up.get(p); return p; };
  Object.keys(S.kv).forEach(k => { if (!k.startsWith('m:')) return; const a = home.get(k.slice(2)), b = home.get(String(S.kv[k])); if (!a || !b) return; const x = top(a), y = top(b); if (x !== y) up.set(x, y); });
  const by = new Map(); ps.forEach(p => { const t = top(p); if (!by.has(t)) by.set(t, []); by.get(t).push(p); });
  S.list = []; S.bySn = new Map();
  const gone = new Set(S.raw.eBad || []);          // ERP 에서 이름이 바뀌거나 없어진 줄에 이어 둔 것 = 다시 안 이어짐으로
  by.forEach((xs, t) => {
    const p = xs.length === 1 ? Object.assign({}, t) : fuse(t, xs);
    const sns = p.orders.map(o => o.sn), nm = sns.map(s => S.kv['n:' + s]).find(Boolean), ek = sns.filter(s => !gone.has(s)).map(s => S.kv['e:' + s]).find(Boolean);
    if (ek && ek !== p.ek) { const [b, nn, oo] = String(ek).split('|'); Object.assign(p, {b, n: nn, o: oo || '', ek, erp: true, er: null}); }          // 방금 이은 것 (남은 재고는 맥미니가 다음 5분에)
    p.name = nm || p.n; p.edited = !!nm; p.hidden = sns.some(s => S.kv['h:' + s]); p.b = p.b || '';
    p.ln = p.kind !== 'item' ? '' : p.erp ? 'erp' : 'no';
    const last = p.orders[0]; p.state = last.in ? 'in' : /출고완료/.test(last.st) ? 'out' : 'go';
    p.hay = norm([p.name, p.n, p.o, LABEL[p.b], p.vend, ...p.orders.map(o => [o.memo, o.sn, o.cs, o.ord].join(' '))].join(' '));
    S.list.push(p); sns.forEach(s => S.bySn.set(s, p));
  });
  const lab = $('lgTabArchiveBadge'); if (lab) lab.textContent = n(S.list.filter(p => !p.hidden).length);
  try { attachKDHistoryChips(); } catch (e) {}
}
function fuse(t, xs) {
  const ep = t.erp ? t : xs.find(x => x.erp), os = xs.flatMap(x => x.orders).sort((a, b) => b.d.localeCompare(a.d) || b.sn.localeCompare(a.sn)), its = os.filter(o => o.k === 'item'), im = xs.find(x => x.img) || t;
  return Object.assign({}, t, ep && ep !== t ? {erp: true, ek: ep.ek, er: ep.er, n: ep.n, o: ep.o, b: ep.b} : {}, {md: [...new Map(xs.flatMap(x => x.md || []).map(m => [m[0] + '|' + m[1], m])).values()], orders: os, parts: xs, sns: os.map(o => o.sn), img: t.img || im.img, ik: t.img ? t.ik : im.ik, is: t.img ? t.is : im.is, kind: its.length ? 'item' : t.kind,
    qty: its.reduce((s, o) => s + (+o.q || 0), 0), cnt: its.length, all: os.length, first: os[os.length - 1].d, last: os[0].d, link: t.link || (xs.find(x => x.link) || {}).link || ''});
}
/* 최근 발주 표 '이전 N회' — 같은 상품의 그보다 앞선 발주 */
function history(sn) {
  const p = S.bySn.get(sn); if (!p) return [];
  const me = p.orders.find(o => o.sn === sn); if (!me) return [];
  return p.orders.filter(o => o.sn !== sn && o.k === 'item' && (o.d < me.d || (o.d === me.d && o.sn < sn))).map(o => ({date: o.d, qty: o.q || 0, price_cny: o.p || 0, kor: p.name, memo: memoT(o), group: stT(o)}));
}
const stT = o => o.in ? '입고' : o.st || '';

/* ── 거르기 ── */
function filtered(skip) {
  const u = S.ui, qs = S.q.toLowerCase().split(/\s+/).filter(Boolean).map(norm);
  return S.list.filter(p => !p.hidden !== !!u.hid && (skip === 'b' || u.b === '*' || p.b === u.b) && (skip === 'k' || u.k === '*' || p.kind === u.k) && (skip === 'st' || u.st === '*' || p.state === u.st) && (skip === 'ln' || u.ln === '*' || p.ln === u.ln) && qs.every(t => p.hay.includes(t)));
}
function sorted(xs) {
  const s = S.ui.sort, f = {recent: (a, b) => b.last.localeCompare(a.last) || b.qty - a.qty, qty: (a, b) => b.qty - a.qty, order: (a, b) => b.cnt - a.cnt || b.qty - a.qty, name: (a, b) => a.name.localeCompare(b.name),
    price_hi: (a, b) => (b.price || 0) - (a.price || 0), price_lo: (a, b) => (a.price || 1e9) - (b.price || 1e9)};
  return xs.slice().sort((s === 'price_hi' || s === 'price_lo') && !sec() ? f.recent : f[s] || f.recent);
}

/* ── 그리기 ── */
function css() {
  if ($('poListCss')) return;
  const s = document.createElement('style'); s.id = 'poListCss';
  s.textContent = `
.pol-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:10px 20px;border-bottom:1px solid var(--line)}
.pol-seg{display:inline-flex;gap:2px;padding:3px;border-radius:9px;background:var(--bg-3)}.pol-seg button{height:30px;padding:0 13px;border:0;border-radius:7px;background:transparent;color:var(--text-2);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}.pol-seg button.on{background:var(--bg-1);color:var(--text-1);font-weight:700;box-shadow:0 1px 2px rgba(15,23,42,.1)}
.pol-chips{display:flex;flex-wrap:wrap;gap:5px}.pol-chips button{height:28px;padding:0 10px;border:1px solid var(--line);border-radius:14px;background:var(--bg-1);color:var(--text-2);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}.pol-chips button.on{background:var(--text-0,#1f2329);border-color:var(--text-0,#1f2329);color:#fff;font-weight:700}.pol-chips em{font-style:normal;margin-left:4px;opacity:.6;font-size:11.5px;font-variant-numeric:tabular-nums}
.pol-day{display:flex;align-items:baseline;gap:10px;margin:18px 2px 8px;font-size:15px;font-weight:700;color:var(--text-1)}.pol-day:first-child{margin-top:4px}.pol-day small{font-size:12px;font-weight:500;color:var(--text-3);font-variant-numeric:tabular-nums}
#polBody{padding:8px 16px 16px;min-height:88vh}
.pol-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.pol-card{position:relative;display:flex;gap:12px;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--bg-1)}
.pol-im{flex:none;width:104px;height:104px;border-radius:8px;object-fit:cover;background:var(--bg-2);border:1px solid var(--line);cursor:zoom-in;display:block}.pol-no{display:grid;place-items:center;color:var(--text-3);font-size:11.5px;cursor:default;text-align:center;line-height:1.35}
.pol-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.pol-top{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-3);padding-right:26px;flex-wrap:wrap}.pol-tag{padding:0 6px;border-radius:5px;background:var(--bg-3);color:var(--text-2);font-size:11px;font-weight:600;line-height:18px}
.pol-nm{font-size:14.5px;font-weight:700;line-height:1.35;color:var(--text-1);overflow-wrap:anywhere}.pol-op{font-size:12px;color:var(--text-2);overflow-wrap:anywhere}
.pol-st{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums}.pol-st b{color:var(--text-1);font-weight:700}
.pol-cns{display:flex;flex-wrap:wrap;gap:5px;margin-top:3px}.pol-cn{max-width:100%;padding:3px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg-2);color:var(--text-2);font:inherit;font-size:11.5px;line-height:1.45;text-align:left;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}button.pol-cn{cursor:pointer}button.pol-cn:hover{border-color:var(--text-3)}.pol-cn b{color:var(--text-1);font-weight:700}.pol-cn.no{border-color:color-mix(in srgb,var(--danger,#dc2626) 45%,transparent);background:transparent;color:var(--danger,#dc2626);font-weight:700}
.pol-os{margin-top:4px;border-top:1px solid var(--line);font-size:12.5px;font-variant-numeric:tabular-nums}
.pol-o{display:grid;grid-template-columns:46px minmax(48px,auto) minmax(0,1fr);gap:2px 8px;padding:4px 0;border-bottom:1px dashed var(--line);align-items:baseline;color:var(--text-2)}.pol-o:last-child{border-bottom:0}.pol-o b{color:var(--text-1);font-weight:700;text-align:right}.pol-o span:last-child{text-align:right;color:var(--text-3)}.pol-o.first span:last-child{color:var(--text-1)}
.pol-o small{grid-column:1/-1;color:var(--text-3);font-size:11.5px;line-height:1.4;overflow-wrap:anywhere}.pol-o.first{color:var(--text-1)}
.pol-more{align-self:flex-start;border:0;background:transparent;color:var(--text-2);font:inherit;font-size:12px;font-weight:600;padding:4px 0;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.pol-ln{font-size:12px}.pol-ln a{color:var(--text-2)}
.pol-dots{position:absolute;right:6px;top:6px;width:28px;height:28px;border:0;border-radius:7px;background:transparent;color:var(--text-3);font-size:16px;line-height:1;cursor:pointer}.pol-dots:hover{background:var(--bg-3);color:var(--text-1)}
.pol-menu{position:absolute;right:6px;top:36px;z-index:20;min-width:150px;padding:5px;border:1px solid var(--line);border-radius:10px;background:var(--bg-1);box-shadow:0 10px 28px rgba(15,23,42,.16)}.pol-menu button{display:block;width:100%;padding:8px 10px;border:0;border-radius:7px;background:transparent;color:var(--text-1);font:inherit;font-size:13px;text-align:left;cursor:pointer}.pol-menu button:hover{background:var(--bg-2)}
.pol-rows{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.pol-r{display:grid;grid-template-columns:56px minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line);background:var(--bg-1)}.pol-r:last-child{border-bottom:0}.pol-r .pol-im{width:56px;height:56px}.pol-r b.nm{display:block;font-size:13.5px;overflow-wrap:anywhere}.pol-r small{display:block;font-size:11.5px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pol-r .q{font-size:15px;font-weight:700;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.pol-r .s{min-width:78px;text-align:right;font-size:12px;color:var(--text-2)}.pol-r .s small{white-space:normal}
.pol-none{padding:40px 0;text-align:center;color:var(--text-3);font-size:13px}
#polMore{display:block;margin:16px auto 4px}
@media (max-width:720px){.lg-pane[data-pane="archive"] .po-section-meta{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;width:100%}.lg-pane[data-pane="archive"] .po-section-meta #arSearch,.lg-pane[data-pane="archive"] .po-section-meta #arSort{width:100%!important;min-width:0}.lg-pane[data-pane="archive"] .po-section-title .kd-section-sub{display:none}.lg-pane[data-pane="archive"] #arCount{text-align:right}.pol-bar{padding:9px 12px;gap:8px}.pol-chips{flex-wrap:nowrap;overflow-x:auto;max-width:100%;scrollbar-width:none;-webkit-overflow-scrolling:touch}.pol-chips::-webkit-scrollbar{display:none}.pol-chips button{height:34px;padding:0 13px;font-size:13px}.pol-seg button{height:36px}#polBody{padding:6px 10px 14px}.pol-grid{grid-template-columns:1fr;gap:9px}.pol-im{width:92px;height:92px}.pol-dots{width:36px;height:36px}.pol-menu button{padding:11px 12px;font-size:14px}.pol-more{padding:8px 0;font-size:13px}.pol-cn{padding:6px 10px;font-size:12px}.pol-r{grid-template-columns:50px minmax(0,1fr) auto;gap:10px;padding:8px 10px}.pol-r .pol-im{width:50px;height:50px}.pol-r .s{grid-column:2/4;text-align:left;min-width:0}.pol-r .s small{display:inline;margin-left:6px}}
@media print{.pol-bar,.pol-dots,#polMore{display:none}}`;
  document.head.appendChild(s);
}
const img = p => {
  if (!p.img) return `<div class="pol-im pol-no">${E(p.kind === 'sample' ? '샘플' : '')}<br>사진 없음</div>`;
  const store = p.ik ? `${SUPABASE_URL}/storage/v1/object/public/po-img/${p.ik}.webp` : '', src = store || p.img;
  return `<img class="pol-im" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="" src="${E(src)}" data-o="${E(p.img)}" onerror="PoList.imgErr(this)" onmouseenter="PoList.zoom(this)" onmouseleave="PoList.unzoom()" onclick="PoList.zoom(this)">`;
};
function imgErr(el) {
  const o = el.dataset.o || '', t = +(el.dataset.t || 0); el.dataset.t = t + 1;
  if (t === 0 && o && el.src !== o) { el.src = /alicdn\.com/.test(o) ? o + '_400x400.jpg' : o; return; }
  if (t === 1 && o && /alicdn\.com/.test(o)) { el.src = o; return; }
  const d = document.createElement('div'); d.className = 'pol-im pol-no'; d.innerHTML = '사진<br>없음'; el.replaceWith(d);
}
const chip = (grp, v, t, c) => `<button type="button" data-f="${grp}" data-v="${E(v)}" class="${S.ui[grp] === v ? 'on' : ''}">${E(t)}<em>${n(c)}</em></button>`;
function barHTML() {
  const bs = filtered('b'), ks = filtered('k'), ss = filtered('st'), ls = filtered('ln'), c = (xs, f) => xs.filter(f).length, hid = S.list.filter(p => p.hidden).length;
  return `<div class="pol-seg" role="tablist"><button type="button" data-f="view" data-v="prod" class="${S.ui.view === 'prod' ? 'on' : ''}">상품별</button><button type="button" data-f="view" data-v="day" class="${S.ui.view === 'day' ? 'on' : ''}">날짜별</button></div>`
    + `<div class="pol-chips">${chip('b', '*', '전체', bs.length)}${BR.filter(b => S.list.some(p => p.b === b)).map(b => chip('b', b, LABEL[b], c(bs, p => p.b === b))).join('')}</div>`
    + `<div class="pol-chips">${[['*', '모두'], ['item', '상품'], ['sample', '샘플'], ['etc', '부자재 · 기타']].map(([k, t]) => chip('k', k, t, k === '*' ? ks.length : c(ks, p => p.kind === k))).join('')}</div>`
    + `<div class="pol-chips">${[['*', '모든 상태'], ['go', '진행 중'], ['out', '출고'], ['in', '입고']].map(([k, t]) => chip('st', k, t, k === '*' ? ss.length : c(ss, p => p.state === k))).join('')}</div>`
    + `<div class="pol-chips">${[['*', '연결 모두'], ['erp', 'ERP 연결됨'], ['no', 'ERP 안 이어짐']].map(([k, t]) => chip('ln', k, t, k === '*' ? ls.length : c(ls, p => p.ln === k))).join('')}</div>`
    + (hid || S.ui.hid ? `<div class="pol-chips"><button type="button" data-f="hid" class="${S.ui.hid ? 'on' : ''}">숨긴 것<em>${n(hid)}</em></button></div>` : '');
}
const memoT = o => sec() ? o.memo : String(o.memo || '').replace(/(?:단가\s*[-:]?\s*)?[+¥￥]?\s*\d+(?:[.,]\d+)?\s*(?:위안|元)/g, ' ').replace(/\s{2,}/g, ' ').trim();          // 메모 속 단가도 기밀
const orderRow = (o, i, all) => `<div class="pol-o${i ? '' : ' first'}" title="${E(o.sn)}"><span>${E(short(o.d))}</span><b>${o.q != null ? n(o.q) + '개' : '—'}</b><span>${o.k === 'sample' ? '샘플 · ' : ''}${E(stT(o))}${sec() && o.p ? ` · ¥${E(o.p)}` : ''}</span>${all ? `<small>${E(o.sn)}${o.ord ? ' · ' + E(o.ord) : ''}${o.memo ? ' · ' + E(memoT(o)) : ''}</small>` : ''}</div>`;
/* 연결 줄 — 재고 ERP(남은 재고 · 마지막 발주일) · MD시트 발주리스트 */
const dayS = t => { const m = String(t || '').match(/(?:20\d\d[-./])?0?(\d{1,2})[-./]0?(\d{1,2})/); return m ? `${m[1]}.${m[2]}` : String(t || '').slice(0, 10); };          // 수량은 바로 아래 발주 줄에 있다
function linkRow(p) {
  const e = p.er, N = e && Array.isArray(e.N) ? e.N.filter(Boolean) : [], L = e ? String(e.L == null ? '' : e.L).trim() : '';
  const erp = p.erp ? `<button type="button" class="pol-cn" data-act="erp" title="재고 ERP 열기">ERP ${L !== '' ? `남은 <b>${E(L)}</b>` : '연결됨'}${N.length ? ` · 발주일 ${E(dayS(N.slice().sort()[N.length - 1]))}${N.length > 1 ? ` 외 ${N.length - 1}` : ''}` : ''}</button>`
    : p.kind === 'item' ? '<button type="button" class="pol-cn no" data-act="link">ERP 연결</button>' : '';
  const m = (p.md || [])[0];
  const md = m ? sec() ? `<button type="button" class="pol-cn" data-act="md" title="MD팀 시트 열기">MD시트 ${E(m[2])} ${E(m[1])}행</button>` : '<span class="pol-cn">MD시트 연결됨</span>' : '';
  return erp || md ? `<div class="pol-cns">${erp}${md}</div>` : '';
}
function card(p) {
  const open = S.open.has(p.id), os = open ? p.orders : p.orders.slice(0, 3), rest = p.orders.length - 3;
  const link = p.link && sec() ? `<div class="pol-ln"><a href="${E(p.link)}" target="_blank" rel="noopener">상품 열기</a></div>` : '';
  const merged = open && p.parts.length > 1 ? p.parts.filter(x => x !== p.parts[0] || true).map(x => x.orders.find(o => S.kv['m:' + o.sn])).filter(Boolean).map(o => `<button type="button" class="pol-more" data-act="split" data-sn="${E(o.sn)}">합친 것 나누기 — ${E(short(o.d))} ${n(o.q)}개</button>`).join('') : '';
  return `<div class="pol-card" data-id="${E(p.id)}">${img(p)}<div class="pol-b"><div class="pol-top"><span>${E(LABEL[p.b])}</span>${p.kind === 'sample' ? '<span class="pol-tag">샘플</span>' : p.kind === 'etc' ? '<span class="pol-tag">부자재 · 기타</span>' : ''}${p.vend ? `<span>${E(p.vend)}</span>` : ''}</div>
<div class="pol-nm">${E(p.name)}</div>${p.o ? `<div class="pol-op">${E(p.o)}</div>` : ''}
<div class="pol-st">${p.cnt ? `<span>누적 <b>${n(p.qty)}</b>개</span><span>발주 <b>${n(p.cnt)}</b>번</span>` : `<span>샘플 <b>${n(p.all)}</b>번</span>`}${sec() && p.price ? `<span>단가 <b>¥${E(p.price)}</b></span>` : ''}</div>
${linkRow(p)}<div class="pol-os">${os.map((o, i) => orderRow(o, i, open)).join('')}</div>${rest > 0 || p.orders.some(o => o.memo) ? `<button type="button" class="pol-more" data-act="open">${open ? '접기' : rest > 0 ? `발주 ${n(p.orders.length)}번 모두 보기` : '메모 보기'}</button>` : ''}${merged}${link}</div>
<button type="button" class="pol-dots" data-act="menu" aria-label="더 보기">⋯</button></div>`;
}
function dayRows(xs) {   // 날짜별 — 발주 한 건이 한 줄
  const rows = [];
  xs.forEach(p => p.orders.forEach(o => rows.push([o, p])));
  const kd = {item: 0, material: 1, excluded: 1, sample: 2};          // 같은 날은 상품 먼저 · 많은 수량부터
  return rows.sort((a, b) => b[0].d.localeCompare(a[0].d) || (kd[a[0].k] || 0) - (kd[b[0].k] || 0) || (+b[0].q || 0) - (+a[0].q || 0) || b[0].sn.localeCompare(a[0].sn));
}
const rowHTML = ([o, p]) => `<div class="pol-r" data-id="${E(p.id)}">${img(p)}<div style="min-width:0"><b class="nm">${E(p.name)}${p.o ? ` <span style="font-weight:500;color:var(--text-2)">${E(p.o)}</span>` : ''}</b><small title="${E(memoT(o))}">${E(LABEL[p.b])}${o.k === 'sample' ? ' · 샘플' : o.k === 'item' ? '' : ' · 부자재'} · ${E(o.sn)}${o.memo ? ' · ' + E(memoT(o)) : ''}</small></div><div class="q">${o.q != null ? n(o.q) + '개' : '—'}</div><div class="s">${E(stT(o))}${p.cnt > 1 && o.k === 'item' ? `<small>누적 ${n(p.qty)}개 · ${n(p.cnt)}번</small>` : ''}</div></div>`;
const dayHead = (d, c, q) => `<div class="pol-day">${E(dayT(d))}<small>${n(c)}건 · ${n(q)}개</small></div>`;
function paint() {
  const body = $('polBody'); if (!body) return;
  css();
  const bar = $('polBar'), upd = $('arUpdated'), cnt = $('arCount');
  if (!S.raw) return;
  bar.innerHTML = barHTML();
  const t = new Date(S.raw.srcAt || S.raw.fetchedAt); if (upd) upd.textContent = isNaN(t) ? '' : `콰이디에어 ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} 기준`;
  const xs = sorted(filtered()), days = S.ui.view === 'day';
  const all = days ? dayRows(xs) : xs;
  if (cnt) cnt.textContent = days ? `발주 ${n(all.length)}건` : `상품 ${n(all.length)}종`;
  const show = all.slice(0, S.shown); let h = '';
  if (!all.length) h = `<div class="pol-none">${S.q ? '찾는 상품이 없어요' : '해당하는 발주가 없어요'}</div>`;
  else if (days) {
    const tot = {}; all.forEach(([o]) => { const x = tot[o.d] = tot[o.d] || [0, 0]; x[0]++; x[1] += +o.q || 0; });
    let cur = '', buf = []; const flush = () => { if (buf.length) h += `<div class="pol-rows">${buf.join('')}</div>`; buf = []; };
    show.forEach(x => { if (x[0].d !== cur) { flush(); cur = x[0].d; h += dayHead(cur, tot[cur][0], tot[cur][1]); } buf.push(rowHTML(x)); }); flush();
  } else if (S.ui.sort === 'recent') {
    const tot = {}; all.forEach(p => { const x = tot[p.last] = tot[p.last] || [0, 0]; p.orders.forEach(o => { if (o.d === p.last) { x[0]++; x[1] += +o.q || 0; } }); });
    let cur = '', buf = []; const flush = () => { if (buf.length) h += `<div class="pol-grid">${buf.join('')}</div>`; buf = []; };
    show.forEach(p => { if (p.last !== cur) { flush(); cur = p.last; h += dayHead(cur, tot[cur][0], tot[cur][1]); } buf.push(card(p)); }); flush();
  } else h = `<div class="pol-grid">${show.map(card).join('')}</div>`;
  if (all.length > S.shown) h += `<button type="button" id="polMore" class="kd-refresh-btn" data-act="more">더 보기 (남은 ${n(all.length - S.shown)})</button>`;
  body.innerHTML = h;
}
const repaint = id => { const p = S.list.find(x => x.id === id), el = document.querySelector(`#polBody .pol-card[data-id="${CSS.escape(id)}"]`); if (p && el) el.outerHTML = card(p); else paint(); };

/* ── 고치기 (app_kv) ── */
function put(set) {
  const v = Object.assign({}, S.kv); Object.keys(set).forEach(k => { if (set[k] == null) delete v[k]; else v[k] = set[k]; });
  S.kv = v; try { kvSet(KV, KV_LS, v); } catch (e) { say('저장하지 못했어요', 'err'); }
  build(); paint();
}
const find = id => S.list.find(p => p.id === id);
function menu(btn, p) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'pol-menu'; m.dataset.id = p.id;
  let erp = ''; try { const it = p.orders.map(o => _pom.bySn[o.sn]).find(x => x && window.PoMap && window.PoMap.canMap(x)); if (it) erp = `<button type="button" data-pmap="${E(it.sn)}">ERP 매핑하기</button>`; } catch (e) {}
  m.innerHTML = `<button type="button" data-act="name">이름 바꾸기</button><button type="button" data-act="merge">같은 상품과 합치기</button>${erp || (p.kind === 'item' || p.erp ? `<button type="button" data-act="link">${p.erp ? 'ERP 연결 바꾸기' : 'ERP 연결'}</button>` : '')}<button type="button" data-act="hide">${p.hidden ? '다시 보이기' : '목록에서 숨기기'}</button>`;
  btn.parentElement.appendChild(m);
}
const closeMenu = () => document.querySelectorAll('.pol-menu').forEach(x => x.remove());
function rename(p) {
  const v = prompt('상품 이름 (비우면 원래 이름으로)', p.name); if (v === null) return;
  const t = v.trim().slice(0, 80), set = {}; p.orders.forEach(o => { if (S.kv['n:' + o.sn]) set['n:' + o.sn] = null; });
  if (t && t !== p.n) set['n:' + p.id] = t;
  put(set); say(t ? '이름을 바꿨어요' : '원래 이름으로 되돌렸어요');
}
function hide(p) {
  const set = {}; if (p.hidden) p.orders.forEach(o => { if (S.kv['h:' + o.sn]) set['h:' + o.sn] = null; }); else set['h:' + p.id] = 1;
  put(set); say(p.hidden ? '다시 보여요' : '목록에서 숨겼어요 — 위 [숨긴 것]에서 되돌릴 수 있어요');
}
/* ERP 연결 — 아직 매핑할 수 있는 발주가 있으면 발주 매핑하기(발주일까지), 아니면 목록 연결만 */
async function linkDlg(p) {
  const PM = window.PoMap; if (!PM) return;
  try { const it = p.orders.map(o => _pom.bySn[o.sn]).find(x => x && PM.canMap(x)); if (it) { PM.open(it.sn); return; } } catch (e) {}
  PM.css();
  const sc = document.createElement('div'); sc.id = 'pmapScrim'; const el = document.createElement('div'); el.id = 'pmapDlg'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'ERP 연결'); el.tabIndex = -1;
  const shut = () => { sc.remove(); el.remove(); document.removeEventListener('keydown', esc, true); }, esc = e => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
  const had = p.orders.map(o => o.sn).filter(x => S.kv['e:' + x]);
  el.innerHTML = `<div class="h"><div><h2>ERP 연결</h2><p>이 발주 상품이 재고 ERP 어느 상품인지 골라 주세요 — 재고 · 발주일 숫자는 바뀌지 않아요</p></div><button type="button" class="x" aria-label="닫기">✕</button></div><div class="b"><div class="src">${img(p).replace('class="pol-im', 'style="width:64px;height:64px" class="pol-im')}<div class="t"><div class="m">${E(LABEL[p.b])} · 발주 ${n(p.cnt || p.all)}번${p.vend ? ' · ' + E(p.vend) : ''}</div><div class="memo"><b>${E(p.name)}</b>${p.o ? ' ' + E(p.o) : ''}<br>${E(memoT(p.orders[0]).slice(0, 120))}</div></div></div><input class="f" type="search" placeholder="상품명 · 옵션 찾기 (비슷한 이름도 나와요)" autocomplete="off" spellcheck="false"><div class="ls"><div class="none">재고 줄을 불러오는 중…</div></div>${had.length ? '<button type="button" class="pol-more" data-off="1" style="margin-top:8px">연결 되돌리기</button>' : ''}</div>`;
  sc.addEventListener('click', shut); document.addEventListener('keydown', esc, true);
  document.body.appendChild(sc); document.body.appendChild(el);
  if (matchMedia('(hover:hover) and (min-width:601px)').matches) el.querySelector('.f').focus(); else el.focus({preventScroll: true});
  let rows = [];
  const k3 = r => `${r.b}|${r.n}|${r.o}`;
  const line = (r, why) => `<button type="button" class="r" data-k="${E(k3(r))}" style="grid-template-columns:minmax(0,1fr) auto"><span class="tx"><b><i>${E(r.lab)}</i>${E(r.n)}${why ? `<span class="w">${E(why)}</span>` : ''}</b><small>${E(r.o || '옵션 없음')}</small></span><span class="q">남은 ${r.L === '' ? '빈칸' : E(r.L)}</span></button>`;
  const draw = q => {
    let h = '';
    if (q) h = PM._t.find(rows, q).slice(0, 40).map(x => line(x.r, x.all ? '' : '비슷한 이름')).join('');
    else {
      const got = new Map(), asks = [...(p.md || []).map(m => m[3]), p.name, ...p.orders.slice(0, 5).map(o => PM._t.memoQuery({memo: o.memo || ''}))].map(x => String(x || '').replace(/[^A-Za-z0-9가-힣'&\s-]/g, ' ').trim()).filter(x => /[A-Za-z]{3,}|[가-힣]{2,}/.test(x.replace(/\b(ring|open|silver|silver925|necklace|bracelet|earrings?|anklet|bag|set|free|color|size|cm|mm|반지|목걸이|팔찌|발찌|귀걸이|신상|샘플|가방|세트|에어|LCL|진행|요청)\b|반지|목걸이|팔찌|발찌|귀걸이|신상|샘플|가방|에어|오픈링|\b[A-Z]{1,3}-?\d{3,}\w*/gi, ' ')));          // 흔한 낱말 · 숫자 · 업체 번호만으로는 추천하지 않는다
      [...new Set(asks)].forEach(t => PM._t.find(rows, t, r => r.b === p.b ? .1 : 0).slice(0, 6).forEach(x => { const o = got.get(k3(x.r)); if (!o || o.s < x.s) got.set(k3(x.r), x); }));
      h = [...got.values()].filter(x => (x.all || x.s >= .6) && (!p.b || x.r.b === p.b)).sort((a, b) => b.all - a.all || b.s - a.s).slice(0, 10).map(x => line(x.r, x.all ? '이름이 맞음' : '비슷한 이름')).join('');
    }
    el.querySelector('.ls').innerHTML = `<div class="s">${q ? '찾은 것' : '추천'}</div><div class="l">${h || `<div class="none">${q ? '없어요 — 다른 낱말로 찾아 보세요' : '비슷한 상품을 못 찾았어요 — 위에서 찾아 주세요'}</div>`}</div>`;
  };
  let tm = 0; el.querySelector('.f').addEventListener('input', e => { clearTimeout(tm); tm = setTimeout(() => { if (rows.length) draw(e.target.value.trim()); }, 100); });
  el.addEventListener('click', e => {
    if (e.target.closest('.x')) return shut();
    const off = e.target.closest('[data-off]'), b = e.target.closest('.r[data-k]'); if (!off && !b) return;
    const set = {}; had.forEach(x => { set['e:' + x] = null; }); if (b) set['e:' + p.id] = b.dataset.k;
    shut(); put(set); say(b ? `이었어요 — ${b.dataset.k.split('|').slice(1).filter(Boolean).join(' · ')}` : '연결을 되돌렸어요 (5분 안에 원래대로)');
  });
  try { rows = await PM.rows(); draw(el.querySelector('.f').value.trim()); } catch (e) { el.querySelector('.ls').innerHTML = '<div class="none">재고 줄을 못 불러왔어요 — 닫고 다시 열어 주세요</div>'; }
}
function split(sn) { put({['m:' + sn]: null}); say('나눴어요'); }
/* 합치기 창 — 발주 매핑하기와 같은 모양 · 같은 찾기(비슷한 이름) */
function mergeDlg(p) {
  const PM = window.PoMap; if (!PM) return;
  const rows = S.list.filter(x => x !== p && !x.hidden).map(x => PM._t.prep({b: x.b, lab: LABEL[x.b], n: x.name, o: x.o || '', r: 0, L: '', N: '', p: x}));
  const near = () => { const a = []; rows.forEach(r => { const x = r.p; let s = 0; if (x.offer && x.offer === p.offer) s += 3; if (x.vend && x.vend === p.vend) s += 3; if (x.b === p.b) s += .3; const v = PM._t.score(p.name, r); s += v.s; if (s >= .9) a.push([s, r]); }); return a.sort((u, v) => v[0] - u[0]).slice(0, 10).map(x => x[1]); };
  const sc = document.createElement('div'); sc.id = 'pmapScrim'; const el = document.createElement('div'); el.id = 'pmapDlg'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '같은 상품과 합치기'); el.tabIndex = -1;
  const shut = () => { sc.remove(); el.remove(); document.removeEventListener('keydown', esc, true); }, esc = e => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
  const row = r => { const x = r.p; return `<button type="button" class="r" data-id="${E(x.id)}" style="grid-template-columns:48px minmax(0,1fr) auto">${img(x).replace('class="pol-im', 'style="width:48px;height:48px" class="pol-im')}<span class="tx"><b><i>${E(LABEL[x.b])}</i>${E(x.name)}</b><small>${E(x.o || memoT(x.orders[0]).slice(0, 60))}</small></span><span class="q">${n(x.cnt || x.all)}번 · ${E(short(x.last))}</span></button>`; };
  el.innerHTML = `<div class="h"><div><h2>같은 상품과 합치기</h2><p>고른 상품과 한 장으로 합쳐요 — 발주 기록은 그대로, 나중에 나눌 수 있어요</p></div><button type="button" class="x" aria-label="닫기">✕</button></div><div class="b"><div class="src">${img(p).replace('class="pol-im', 'style="width:64px;height:64px" class="pol-im')}<div class="t"><div class="m">${E(LABEL[p.b])} · 발주 ${n(p.cnt || p.all)}번</div><div class="memo"><b>${E(p.name)}</b>${p.o ? ' ' + E(p.o) : ''}</div></div></div><input class="f" type="search" placeholder="합칠 상품 찾기 — 이름 · 옵션 (비슷한 이름도)" autocomplete="off" spellcheck="false"><div class="ls"></div></div>`;
  const draw = q => { const xs = q ? PM._t.find(rows, q).slice(0, 30).map(x => x.r) : near(); el.querySelector('.ls').innerHTML = `<div class="s">${q ? '찾은 것' : '비슷한 상품'}</div><div class="l">${xs.length ? xs.map(row).join('') : '<div class="none">없어요 — 이름으로 찾아 보세요</div>'}</div>`; };
  let tm = 0; el.querySelector('.f').addEventListener('input', e => { clearTimeout(tm); tm = setTimeout(() => draw(e.target.value.trim()), 100); });
  el.addEventListener('click', e => { if (e.target.closest('.x')) return shut(); const b = e.target.closest('.r[data-id]'); if (!b) return; const t = find(b.dataset.id); if (!t) return; shut(); put({['m:' + p.id]: t.id}); say(`합쳤어요 — ${t.name}`); });
  sc.addEventListener('click', shut); document.addEventListener('keydown', esc, true);
  document.body.appendChild(sc); document.body.appendChild(el); draw('');
  if (matchMedia('(hover:hover) and (min-width:601px)').matches) el.querySelector('.f').focus(); else el.focus({preventScroll: true});
}
document.addEventListener('click', e => {
  const inMenu = e.target.closest && e.target.closest('.pol-menu'); if (!inMenu && !(e.target.closest && e.target.closest('[data-act="menu"]'))) closeMenu();
  const pane = e.target.closest && e.target.closest('.lg-pane[data-pane="archive"]'); if (!pane) return;
  const f = e.target.closest('[data-f]');
  if (f) { const g = f.dataset.f; if (g === 'hid') S.ui.hid = !S.ui.hid; else S.ui[g] = f.dataset.v; S.shown = 60; const keep = Object.assign({}, S.ui); delete keep.hid; try { localStorage.setItem(UI_LS, JSON.stringify(keep)); } catch (x) {} paint(); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, host = a.closest('[data-id]'), p = host && find(host.dataset.id);
  if (act === 'more') { S.shown += 60; paint(); return; }
  if (act === 'split') return split(a.dataset.sn);
  if (!p) return;
  if (act === 'open') { S.open.has(p.id) ? S.open.delete(p.id) : S.open.add(p.id); repaint(p.id); }
  else if (act === 'menu') { if (a.parentElement.querySelector('.pol-menu')) closeMenu(); else menu(a, p); }
  else { closeMenu(); if (act === 'name') rename(p); if (act === 'merge') mergeDlg(p); if (act === 'hide') hide(p); if (act === 'link') linkDlg(p); if (act === 'erp') { try { openErpPage(); } catch (x) {} } if (act === 'md') { try { triggerMd(); } catch (x) {} } }
});

document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.pol-menu [data-pmap]')) setTimeout(closeMenu, 0); }, true);

/* ── 탭 ── */
async function refresh(force) {
  const body = $('polBody'); if (!body) return;
  css();
  const q = $('arSearch'), so = $('arSort'); if (q && document.activeElement !== q) q.value = S.q; if (so) so.value = S.ui.sort;
  if (S.raw) paint(); else body.innerHTML = '<div class="pol-none">발주 상품을 불러오는 중…</div>';
  const had = S.at;
  try { await load(force); if (S.at !== had || !had) paint(); } catch (e) { if (!S.raw) body.innerHTML = '<div class="pol-none">서버 PC 연결 안 됨 — 잠시 뒤 탭을 다시 열어 주세요</div>'; }
}
window.refreshArchivePane = () => refresh();
window.filterArchive = v => { clearTimeout(S.tm); S.tm = setTimeout(() => { S.q = v || ''; S.shown = 60; paint(); }, 120); };
window.setArchiveSort = v => { S.ui.sort = v; S.shown = 60; keepUi(); paint(); };
// 물류팀을 열고 3초 뒤 한 번 — 탭 숫자 · 최근 발주 표의 '이전 N회' (화면을 안 열면 안 받는다)
const warm = () => { const v = $('viewLg'); if (v && !v.hidden && v.offsetParent !== null && !document.hidden && Date.now() - S.at > 10 * 60e3) load(true).then(() => { const pane = document.querySelector('.lg-tab.active[data-tab="archive"]'); if (pane) paint(); }).catch(() => {}); };
setInterval(warm, 60e3);
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.lg-tab,[onclick*="triggerLogistics"]')) setTimeout(warm, 3000); });
window.PoList = {refresh, history, imgErr, warm, zoom: el => { try { _lgbShowZoom(el); } catch (e) {} }, unzoom: () => { try { _lgbHideZoom(); } catch (e) {} }, _s: S};
})();
