/* ============================================================
   디자인팀 업무일지 · 전광판 (2026-11-23 사장님 "업무일지 노션에서 불러오기 → 자체 프로그램으로, 이전 기록 그대로,
   가독성 좋게 자동 정리, 까먹으면 안 되는 루틴은 상단 고정 전광판, 지우거나 수정 쉽게")
   · 저장 = Supabase dlog_pages · dlog_board · dlog_checks — anon 은 표를 못 읽고 열쇠 함수(dlog_*)로만 (MD팀 시트와 같은 열쇠, _mdxRpc)
   · 발주 · 샘플(2026-11-23 노션 '발주 & 샘플' 달력) = 같은 표의 kind 'order' — 공장 · 상태 · 종류 · 끝나는 날은 meta
   · 글 = 납작한 줄 배열 blocks [{id, lv 들여쓰기, t 종류, r 글자조각, k 끝냄, bg 줄 색, st 손으로 고른 상태, o 이어받은 처음 줄, d0 처음 적은 날, src 사진}]
   · 저장 방식 = 0.7초 뒤 저절로 · ver 가 다르면 줄 단위 3방향 합치기 · 못 보낸 글은 이 PC 에 남겨 다시 보냄 · 지움은 전부 되살리기 가능
   · 보이는 꾸밈([업체] · 날짜 · 수량 · ⇒ 결과 · 새로 · n일째 · 상태)은 글자를 안 바꾸고 화면에서만 붙인다
   index.html 은 #wlBoard(전광판) · #wl(업무일지) 자리만 두고 이 파일을 불러온다. 쓰는 전역: _mdxRpc · toast · SUPABASE_URL · SUPABASE_KEY · loadProxyBase · ghPin · _dslHol · designHasAccess
   · 2026-11-23 노션과 연결 끊음 (사장님 "데이터 이전을 완료헀으면 노션이랑 연결 끊어") — 노션을 읽거나 부르는 코드는 없다. 옛 글의 원본은 dlog_pages.src
   ============================================================ */
(function(){
'use strict';
if(window.WL && window.WL.ready) return;

const BUCKET = 'design-log', SAVE_MS = 700, POLL_MS = 8000, RECENT = 30, MORE = 60;
const K = {cache:'wl_cache_v1', dirty:'wl_dirty_v1', ui:'wl_ui_v1', lost:'wl_lost_v1'};
const ESC = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const bid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
const me = () => { try{ return String(localStorage.getItem('brightbeed_diary_me') || '').trim().slice(0, 40); }catch(e){ return ''; } };
const say = (m, t) => { try{ toast(m, t || 'ok'); }catch(e){} };
const clone = x => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rpc = (fn, body) => _mdxRpc(fn, body);

/* ── 날짜 ── */
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const D = s => new Date(s + 'T00:00:00');
const addD = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return ymd(d); };
const dow = s => D(s).getDay();
const WK = ['일', '월', '화', '수', '목', '금', '토'];
const dayDiff = (a, b) => Math.round((D(a) - D(b)) / 864e5);
const md = s => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const hol = () => { try{ return _dslHol(); }catch(e){ return new Set(); } };
const isOff = s => { const w = dow(s); return w === 0 || w === 6 || hol().has(s); };
const monOf = s => addD(s, -((dow(s) + 6) % 7));

const KINDS = {daily:'업무일지', status:'진행상황', memo:'회의 · 메모'};
const KIND_ALL = Object.assign({order:'발주 · 샘플'}, KINDS);
const S = {
  ready:false, booting:null, err:'', max:0, today:ymd(new Date()),
  pages:new Map(), board:new Map(), checks:new Map(),
  cur:null, view:'page', kind:'all', month:'', group:'vendor',
  dirty:new Map(), saving:false, saveT:0, saveAt:0, fails:0, pollT:0, polling:false, defer:false,
  undo:new Map(), sel:null, fTag:'', fSt:'', hideDone:false, navOpen:false, sideOpen:true, find:null, fresh:new Set(), split:new Map(), caches:new Map(), moreBusy:false, oMode:'cal', oFac:'', oKind:'', oWait:false, oMonth:'', lastPage:null
};
try{ Object.assign(S, (u => ({group:u.group || 'vendor', hideDone:!!u.hideDone, boardFold:!!u.boardFold, oMode:u.oMode || 'cal'}))(JSON.parse(localStorage.getItem(K.ui) || '{}') || {})); }catch(e){}
const saveUi = () => { try{ localStorage.setItem(K.ui, JSON.stringify({group:S.group, hideDone:S.hideDone, boardFold:S.boardFold, oMode:S.oMode})); }catch(e){} };

/* ============================================================ 글자 조각 ============================================================ */
const MK = ['b', 'i', 's', 'u', 'c'];
const segText = r => (r || []).map(x => x.t || '').join('');
const bText = b => segText(b.r);
const isEmpty = b => !b.src && b.t !== 'hr' && !bText(b).trim();
const isHead = b => b.t === 'h1' || b.t === 'h2' || b.t === 'h3';
function segNorm(r){
  const out = [];
  for(const s of r || []){
    if(!s || !s.t) continue;
    const p = out[out.length - 1];
    if(p && MK.every(k => !!p[k] === !!s[k]) && (p.h || '') === (s.h || '') && (p.a || '') === (s.a || '')) p.t += s.t;
    else{ const n = {t:s.t}; MK.forEach(k => { if(s[k]) n[k] = 1; }); if(s.h) n.h = s.h; if(s.a) n.a = s.a; out.push(n); }
  }
  return out;
}
function segSlice(r, a, z){
  const out = []; let p = 0;
  for(const s of r || []){
    const l = s.t.length, x = Math.max(a, p), y = Math.min(z, p + l);
    if(y > x) out.push(Object.assign({}, s, {t:s.t.slice(x - p, y - p)}));
    p += l;
  }
  return out;
}
const segLen = r => segText(r).length;
const T = s => [{t:s}];

/* ── 꾸밈 (화면에서만, 글자는 그대로) ── */
const AR = /⇒|=>|→/;
const mmdd = s => { const m = +s.slice(0, 2), d = +s.slice(2, 4); return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${m}/${d}` : ''; };
function decoPlain(t, first, res){
  let out = '', s = t;
  if(first){
    for(let i = 0; i < 2; i++){
      const m = s.match(/^(\s*)\[([^\]\n\[]{1,24})\](\s*)/);
      if(!m) break;
      out += `${E(m[1])}<span class="wl-tag"><i class="wl-br">[</i>${E(m[2])}<i class="wl-br">]</i></span>${E(m[3])}`;
      s = s.slice(m[0].length);
    }
    const d = s.match(/^(\d{4})(_)/), x = d && mmdd(d[1]);
    if(x){ out += `<span class="wl-dt" data-d="${x}">${d[1]}</span><i class="wl-br">_</i>`; s = s.slice(5); }
  }
  const re = /(https?:\/\/[^\s<>"']+)|(\d[\d,]*(?:\.\d+)?\s?(?:ea|EA|Ea|kg|KG))(?![a-zA-Z])/g;
  let p = 0, m;
  while((m = re.exec(s))){
    out += E(s.slice(p, m.index));
    if(m[1]) out += `<a class="wl-al" href="${E(m[1])}" target="_blank" rel="noopener noreferrer">${E(m[1])}</a>`;
    else out += `<span class="wl-q">${E(m[2])}</span>`;
    p = m.index + m[0].length;
  }
  return out + E(s.slice(p));
}
function deco(b){
  const r = b.r || [];
  let out = '', pos = 0, res = false;
  const arrows = b.t === 'li' || b.t === 'todo' || b.t === 'p';
  for(const s of r){
    const parts = [];
    if(arrows && !res && AR.test(s.t)){ const i = s.t.search(AR); if(i > 0) parts.push([s.t.slice(0, i), false]); parts.push([s.t.slice(i), true]); res = true; }
    else parts.push([s.t, res]);
    for(const [t, isRes] of parts){
      let h = decoPlain(t, pos === 0 && !isHead(b), isRes);
      if(isRes){ const m = t.match(/^(⇒|=>|→)/); if(m) h = `<span class="wl-ar">${E(m[0])}</span>` + decoPlain(t.slice(m[0].length), false, true); h = `<span class="wl-res">${h}</span>`; }
      if(s.c) h = `<code>${h}</code>`;
      if(s.b) h = `<b>${h}</b>`;
      if(s.i) h = `<i data-i="1">${h}</i>`;
      if(s.s) h = `<s>${h}</s>`;
      if(s.u) h = `<u>${h}</u>`;
      if(s.h && s.h !== 'default_background') h = `<span class="wl-h-${E(String(s.h).replace(/[^a-z_]/g, ''))}" data-h="${E(s.h)}">${h}</span>`;
      if(s.a) h = `<a class="wl-a" data-a="${E(s.a)}"${/^https?:/.test(s.a) ? ` href="${E(s.a)}" target="_blank" rel="noopener noreferrer"` : ''}>${h}</a>`;
      out += h;
      pos += t.length;
    }
  }
  if(segText(r).endsWith('\n')) out += '<br data-fill="1">';
  return out;
}
/* 화면 → 글자 조각. 꾸밈 표시(wl-tag 등)는 글자만 읽고, 서식은 b · s · u · code · data-h · data-a 만 */
function parseX(el){
  const out = [];
  (function walk(n, m){
    if(n.nodeType === 3){ const t = n.nodeValue.replace(/ /g, ' ').replace(/​/g, ''); if(t) out.push(Object.assign({t}, m)); return; }
    if(n.nodeType !== 1) return;
    const G = n.tagName;
    if(G === 'BR'){ if(!n.dataset.fill && !(n === el.lastChild && out.length && !out[out.length - 1].br)) out.push(Object.assign({t:'\n', br:1}, m)); return; }
    let k = m;
    if(G === 'B' || G === 'STRONG') k = Object.assign({}, k, {b:1});
    if(G === 'EM' || (G === 'I' && n.dataset.i)) k = Object.assign({}, k, {i:1});
    if(G === 'S' || G === 'STRIKE' || G === 'DEL') k = Object.assign({}, k, {s:1});
    if(G === 'U') k = Object.assign({}, k, {u:1});
    if(G === 'CODE') k = Object.assign({}, k, {c:1});
    if(n.dataset && n.dataset.h) k = Object.assign({}, k, {h:n.dataset.h});
    if(G === 'A' && n.dataset.a) k = Object.assign({}, k, {a:n.dataset.a});
    if((G === 'DIV' || G === 'P') && n !== el && out.length) out.push({t:'\n'});
    n.childNodes.forEach(c => walk(c, k));
  })(el, {});
  out.forEach(s => delete s.br);
  return segNorm(out);
}
/* ── 커서 ── */
function selIn(el){
  const s = getSelection();
  if(!s || !s.rangeCount || !el || !el.contains(s.anchorNode) || !el.contains(s.focusNode)) return null;
  const g = s.getRangeAt(0), off = (n, o) => { const r = document.createRange(); r.selectNodeContents(el); r.setEnd(n, o); return r.toString().length; };
  return [off(g.startContainer, g.startOffset), off(g.endContainer, g.endOffset)];
}
function putSel(el, a, z){
  if(!el) return;
  if(document.activeElement !== el) el.focus({preventScroll:true});
  const find = p => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, last = null, left = p;
    while((n = w.nextNode())){ last = n; if(left <= n.nodeValue.length) return [n, left]; left -= n.nodeValue.length; }
    return last ? [last, last.nodeValue.length] : [el, 0];
  };
  const [n1, o1] = find(a), [n2, o2] = find(z == null ? a : z), r = document.createRange(), s = getSelection();
  try{ r.setStart(n1, o1); r.setEnd(n2, o2); s.removeAllRanges(); s.addRange(r); }catch(e){}
}
const lineEl = id => $(`#wl .wl-b[data-id="${CSS.escape(id)}"]`);
const xEl = id => { const l = lineEl(id); return l && $('.wl-x', l); };
function focusB(id, pos){
  const x = xEl(id);
  if(!x) return;
  const n = x.textContent.length;
  putSel(x, pos === 'start' ? 0 : pos === 'end' || pos == null ? n : Math.min(pos, n));
  const r = x.getBoundingClientRect();
  if(r.top < 90 || r.bottom > innerHeight - 40) x.scrollIntoView({block:'nearest'});
}

/* ============================================================ 자료 ============================================================ */
function setPage(x){
  const o = S.pages.get(x.id);
  if(x.d){ S.pages.delete(x.id); return null; }
  if(o && S.dirty.has(x.id)) { return o; }           // 고치는 중 — 저장할 때 합친다
  const p = Object.assign(o || {}, x);
  if(!x.blocks && o && o._bv === x.ver) p.blocks = o.blocks;
  else if(x.blocks){ p.blocks = x.blocks; p._bv = x.ver; }
  else if(!x.blocks && (!o || o._bv !== x.ver)) p.blocks = null;
  S.pages.set(x.id, p);
  return p;
}
const byDay = (a, b) => b.day.localeCompare(a.day) || String(b.ca || '').localeCompare(String(a.ca || ''));
const list = () => [...S.pages.values()].filter(p => p.kind !== 'order').sort(byDay);
const orders = () => [...S.pages.values()].filter(p => p.kind === 'order').sort(byDay);
const dailies = () => list().filter(p => p.kind === 'daily');
const cur = () => S.cur ? S.pages.get(S.cur) : null;
function prevOf(p){ if(!p) return null; return list().filter(x => x.kind === p.kind && x.id !== p.id && x.day < p.day)[0] || null; }
const ckKey = (i, d) => i + '|' + d;
async function loadBlocks(ids){
  const need = ids.filter(i => { const p = S.pages.get(i); return p && !p.blocks; });
  if(!need.length) return;
  const rows = await rpc('dlog_get', {p_ids:need});
  (rows || []).forEach(setPage);
}
function cacheWrite(){
  try{
    const ps = list(), keep = new Set(ps.slice(0, 6).map(p => p.id));
    if(S.cur) keep.add(S.cur);
    const od = orders().filter(p => p.day > addD(S.today, -75)); od.forEach(p => keep.add(p.id));
    localStorage.setItem(K.cache, JSON.stringify({at:Date.now(), today:S.today,
      pages:ps.slice(0, 120).concat(od).map(p => { const o = Object.assign({}, p); delete o._bv; if(!keep.has(p.id)) delete o.blocks; return o; }),
      board:[...S.board.values()], checks:[...S.checks.values()].filter(c => c.day > addD(S.today, -21))}));
  }catch(e){ try{ localStorage.removeItem(K.cache); }catch(e2){} }
}
function cacheRead(){
  try{
    const j = JSON.parse(localStorage.getItem(K.cache) || 'null');
    if(!j || Date.now() - j.at > 14 * 864e5) return false;
    (j.pages || []).forEach(p => { S.pages.set(p.id, Object.assign(p, {_bv:p.blocks ? p.ver : null})); });
    (j.board || []).forEach(b => S.board.set(b.id, b));
    (j.checks || []).forEach(c => S.checks.set(ckKey(c.item, c.day), c));
    return S.pages.size > 0;
  }catch(e){ return false; }
}
async function boot(){
  if(S.booting) return S.booting;
  S.booting = (async () => {
    try{
      const j = await rpc('dlog_boot', {p_recent:RECENT});
      const alive = new Set((j.pages || []).map(p => p.id));
      [...S.pages.keys()].forEach(id => { if(!alive.has(id) && !S.dirty.has(id)) S.pages.delete(id); });
      (j.pages || []).forEach(setPage);
      S.board = new Map((j.board || []).map(b => [b.id, b]));
      S.checks = new Map((j.checks || []).map(c => [ckKey(c.item, c.day), c]));
      S.max = j.max || 0; S.today = j.today || S.today; S.err = ''; S.ready = true;
      cacheWrite();
      loadMore();
    }catch(e){ const m = String(e && e.message || e); S.err = /열쇠|proxy|fetch|Load failed|network/i.test(m) ? '서버에 연결하지 못했어요. 잠시 뒤 다시 불러와 주세요.' : m; }
    finally{ S.booting = null; }
  })();
  return S.booting;
}
async function loadMore(){           // 'n일째' · '지난 기록' 을 위해 조금 더 (뒤에서 조용히)
  if(S.moreBusy) return;
  S.moreBusy = true;
  try{
    const ids = list().filter(p => !p.blocks).slice(0, MORE).map(p => p.id);
    for(let i = 0; i < ids.length; i += 30) await loadBlocks(ids.slice(i, i + 30));
    S.caches.clear();
    if(ids.length){ if(editing() || S.ptr) S.defer = true; else renderAll(); }
  }catch(e){}
  finally{ S.moreBusy = false; }
}
/* ── 고침 → 저장 ── */
/* 누르는 중(mousedown~mouseup)에 화면을 다시 그리면 누름이 사라진다 → 손을 뗀 뒤에 그린다 */
function settle(){
  if(S.ptr || editing()) return;
  if(S.defer){ renderAll(); return; }
  if(S.lineDirty){ S.lineDirty = false; refreshLabels(); }
  if(S.boardDefer){ S.boardDefer = false; renderBoard(); }
}
document.addEventListener('mousedown', e => { S.ptr = true; const t = e.target; if(S.sel && t.closest && !t.closest('#wl, .wl-pop, .wl-bar')) clearSel(); }, true);
document.addEventListener('mouseup', () => { setTimeout(() => { S.ptr = false; setTimeout(settle, 30); }, 0); }, true);
document.addEventListener('dragend', () => { S.ptr = false; setTimeout(settle, 30); }, true);
const editing = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#wl .wl-x, #wl input, #wl textarea, #wl select, #wlBoard input, #wlBoard textarea, #wlBoard select, .wl-pop')); };
function persistDirty(){
  try{
    const o = {};
    S.dirty.forEach((d, id) => { const p = S.pages.get(id); if(p) o[id] = {base:d.base, bb:d.bb, bm:d.bm, isNew:d.isNew, page:{id, day:p.day, title:p.title, kind:p.kind, meta:p.meta || {}, blocks:p.blocks, ca:p.ca, ver:p.ver, origin:p.origin}}; });
    if(Object.keys(o).length) localStorage.setItem(K.dirty, JSON.stringify(o)); else localStorage.removeItem(K.dirty);
  }catch(e){}
}
function restoreDirty(){
  try{
    const o = JSON.parse(localStorage.getItem(K.dirty) || '{}') || {};
    Object.entries(o).forEach(([id, x]) => {
      if(!x || !x.page || !Array.isArray(x.page.blocks)) return;
      S.pages.set(id, Object.assign(S.pages.get(id) || {}, x.page));
      S.dirty.set(id, {base:x.base, bb:x.bb, bm:x.bm, isNew:!!x.isNew, seq:1});
    });
    if(S.dirty.size) scheduleSave(200);
  }catch(e){}
}
let persistT = 0;
function beforeEdit(p){
  if(!S.dirty.has(p.id)) S.dirty.set(p.id, {base:p.ver, bb:clone(p.blocks || []), bm:{title:p.title, day:p.day, kind:p.kind, meta:clone(p.meta || {})}, seq:0});
}
function touch(p){
  if(!p) return;
  const d = S.dirty.get(p.id) || (beforeEdit(p), S.dirty.get(p.id));
  d.seq++;
  S.caches.delete(p.id); S.actAt = Date.now();
  saveTag('saving');
  clearTimeout(persistT); persistT = setTimeout(persistDirty, 250);
  scheduleSave(SAVE_MS);
}
function scheduleSave(ms){ clearTimeout(S.saveT); S.saveT = setTimeout(flush, ms); }
function merge3(base, mine, theirs){
  const B = new Map((base || []).map(b => [b.id, b])), M = new Map(mine.map(b => [b.id, b])), O = new Map(theirs.map(b => [b.id, b]));
  const out = [];
  for(const m of mine){
    const o = O.get(m.id), b = B.get(m.id);
    if(o) out.push(b && same(m, b) ? o : m);
    else if(!b || !same(m, b)) out.push(m);          // 내가 새로 쓴 줄 · 내가 고친 줄은 남긴다
  }
  const has = new Set(out.map(b => b.id));
  theirs.forEach((o, i) => {
    if(has.has(o.id)) return;
    const b = B.get(o.id);
    if(b && same(o, b)) return;                       // 내가 지운 줄 (상대는 안 고침)
    let at = out.length;
    for(let j = i - 1; j >= 0; j--){ const k = out.findIndex(x => x.id === theirs[j].id); if(k >= 0){ at = k + 1; break; } if(j === 0) at = 0; }
    if(i === 0) at = 0;
    out.splice(at, 0, o); has.add(o.id);
  });
  return out;
}
async function flush(){
  clearTimeout(S.saveT);
  if(S.saving){ scheduleSave(250); return; }
  if(!S.dirty.size) return;
  S.saving = true;
  let fail = '';
  for(const [id, d] of [...S.dirty]){
    const p = S.pages.get(id);
    if(!p){ S.dirty.delete(id); continue; }
    const seq = d.seq, sent = {title:p.title, day:p.day, kind:p.kind, meta:clone(p.meta || {})};
    if(p.blocks) sent.blocks = clone(p.blocks);   // 아직 안 받은 글이면 줄은 건드리지 않는다
    try{
      const j = await rpc('dlog_save', {p_id:id, p_base:d.base || 0, p_patch:sent, p_who:me()});
      if(j && j.ok){
        p.ver = j.ver; p._bv = j.ver; p.ua = j.ua; p.ub = me(); d.isNew = false;
        S.max = Math.max(S.max, 0);
        if(d.seq === seq) S.dirty.delete(id);
        else{ d.base = j.ver; if(sent.blocks) d.bb = sent.blocks; d.bm = {title:sent.title, day:sent.day, kind:sent.kind, meta:sent.meta}; scheduleSave(SAVE_MS); }
        S.fails = 0;
      }else if(j && j.conflict){
        const o = j.page;
        p.blocks = p.blocks ? merge3(d.bb, p.blocks, o.blocks || []) : (o.blocks || []);
        ['title', 'day', 'kind'].forEach(f => { if(d.bm && p[f] === d.bm[f]) p[f] = o[f]; });
        { const bm = (d.bm && d.bm.meta) || {}, mm = p.meta || {}, om = o.meta || {}, r = {}; new Set([...Object.keys(mm), ...Object.keys(om)]).forEach(k => { const v = same(mm[k], bm[k]) ? om[k] : mm[k]; if(v !== undefined) r[k] = v; }); p.meta = r; }
        d.base = o.ver; d.bb = o.blocks; d.bm = {title:o.title, day:o.day, kind:o.kind, meta:o.meta || {}}; d.seq++;
        p.ver = o.ver;
        if(id === S.cur){ if(editing() || S.ptr) S.defer = true; else renderPage(); }
        scheduleSave(120);
      }else if(j && j.gone){
        try{ localStorage.setItem(K.lost, JSON.stringify({at:Date.now(), page:p})); }catch(e){}
        S.dirty.delete(id); S.pages.delete(id);
        if(S.cur === id){ S.cur = null; renderAll(); }
        say('다른 곳에서 지운 글이에요 — ⋯ 메뉴 ‘지운 글’ 에서 되살릴 수 있어요', 'err');
      }
    }catch(e){
      const m = String(e && e.message || e);
      if(/too_big/.test(m)){ S.dirty.delete(id); say('글이 너무 길어 저장하지 못했어요 — 나눠서 적어 주세요', 'err'); }
      else fail = m;
    }
  }
  S.saving = false;
  persistDirty();
  if(fail){ S.fails++; saveTag('err'); scheduleSave(Math.min(30000, 2500 * S.fails)); }
  else if(S.dirty.size) saveTag('saving');
  else{ S.saveAt = Date.now(); saveTag('saved'); cacheWrite(); }
}
function saveTag(s){
  $$('.wl-save').forEach(el => {
    el.dataset.s = s;
    el.textContent = s === 'saving' ? '저장 중…' : s === 'err' ? '⚠ 저장 못 함 · 다시 시도 중' : S.saveAt ? `✓ 저장됨 ${hm(S.saveAt)}` : '';
  });
}
/* ── 다른 PC 에서 바뀐 것 ── */
async function poll(){
  if(S.polling || !S.ready || document.hidden || !visible()) return;
  S.polling = true;
  try{
    const j = await rpc('dlog_poll', {p_since:Math.max(0, S.max - 40)});
    let pg = false, bd = false;
    const need = [];
    (j.pages || []).forEach(x => {
      const o = S.pages.get(x.id);
      if(x.d){ if(o && !S.dirty.has(x.id)){ S.pages.delete(x.id); pg = true; if(S.cur === x.id) S.cur = null; } }
      else if(!o || o.ver < x.ver){ if(!S.dirty.has(x.id)) need.push(x.id); }
    });
    if(need.length){ (await rpc('dlog_get', {p_ids:need}) || []).forEach(x => { setPage(x); S.caches.delete(x.id); }); pg = true; }
    (j.board || []).forEach(b => { const o = S.board.get(b.id); if(o && o.ver >= b.ver) return; if(b.deleted_at){ if(o){ S.board.delete(b.id); bd = true; } } else{ S.board.set(b.id, b); bd = true; } });
    (j.checks || []).forEach(c => { const k = ckKey(c.item, c.day), o = S.checks.get(k); if(!o || o.ver < c.ver){ S.checks.set(k, c); bd = true; } });
    if(j.today && j.today !== S.today){ S.today = j.today; bd = pg = true; }
    S.max = Math.max(S.max, j.max || 0);
    if(pg){ S.caches.clear(); if(editing() || S.ptr) S.defer = true; else{ renderAll(); } }
    if(bd) renderBoard();
    if(pg || bd) cacheWrite();
  }catch(e){}
  finally{ S.polling = false; }
}
const visible = () => { const v = document.getElementById('viewDesign'); return !!(v && !v.hidden); };

/* ============================================================ 자동 정리 (계산) ============================================================ */
const SEC = [['goalM', /월간\s*목표|이번\s*달\s*목표/], ['goalW', /주간\s*목표|이번\s*주\s*목표/], ['daily', /데일리\s*체크|매일\s*체크|루틴/], ['tomorrow', /내일\s*할|낼\s*할/], ['today', /오늘\s*할/], ['hold', /홀딩|보류/]];
const secType = h => { const t = h ? bText(h) : ''; for(const [k, re] of SEC) if(re.test(t)) return k; return ''; };
function sections(blocks){
  const out = []; let c = null;
  const push = head => { c = {head, items:[], key:head ? head.id : '', type:secType(head)}; out.push(c); };
  for(const b of blocks || []){
    if(isHead(b)) push(b);
    else if(b.t === 'hr') c = null;
    else{ if(!c) push(null); if(!c.key) c.key = 's_' + b.id; c.items.push(b); }
  }
  return out;
}
/* 보이는 차례 — 오늘 할 일 · 진행 중인 일 먼저, 데일리 체크 · 목표는 뒤로 (적힌 차례는 그대로) */
const SEC_RANK = {today:0, hold:2, tomorrow:3, daily:4, goalW:5, goalM:6};
const secOrder = (p, ss) => p.kind !== 'daily' ? ss : ss.map((s, i) => [s, i]).sort((a, b) => (SEC_RANK[a[0].type] ?? 1) - (SEC_RANK[b[0].type] ?? 1) || a[1] - b[1]).map(x => x[0]);
const norm = s => String(s || '').toLowerCase().replace(/[\s.,·_\-~!?()\[\]{}"'“”‘’:;/\\⇒→=>★※…]+/g, '');
function info(p){           // 글 하나를 한 번 훑어 둔 것 (고치면 버림)
  if(!p || !p.blocks) return null;
  const c = S.caches.get(p.id);
  if(c && c.v === p._bv) return c;
  const lines = [], by = new Map();
  sections(p.blocks).forEach(s => {
    const base = Math.min(...s.items.filter(b => !isEmpty(b)).map(b => b.lv || 0), 9);
    s.items.forEach(b => {
      if(isEmpty(b) && !b.src) return;
      const t = bText(b);
      const l = {b, id:b.id, o:b.o || b.id, t, n:norm(t), hd:norm(t.replace(/^\s*(\[[^\]]{1,24}\]\s*)+/, '').split(AR)[0]), sec:s.type, head:s.head ? bText(s.head) : '', lv:(b.lv || 0) - base};
      lines.push(l); by.set(b.id, l);
    });
  });
  const r = {v:p._bv, lines, by, set:new Set(lines.map(l => l.n).filter(Boolean)), os:new Set(lines.map(l => l.o))};
  S.caches.set(p.id, r);
  return r;
}
const gram = s => { const g = new Map(); for(let i = 0; i < s.length - 1; i++){ const k = s.slice(i, i + 2); g.set(k, (g.get(k) || 0) + 1); } return g; };
function dice(a, b){
  if(a === b) return 1;
  if(a.length < 2 || b.length < 2) return 0;
  const A = gram(a), B = gram(b); let n = 0;
  A.forEach((v, k) => { n += Math.min(v, B.get(k) || 0); });
  return 2 * n / (a.length + b.length - 2);
}
/* 바로 앞 글과 달라진 점 — 새로 · 고침 · 빠짐 */
function diffOf(p){
  const A = info(p), q = prevOf(p), B = info(q);
  if(!A || !B) return null;
  if(A.diff && A.diff.q === q.id && A.diff.qv === q._bv) return A.diff;
  const used = new Set(), st = new Map(), was = new Map();
  const byO = new Map(B.lines.map(l => [l.o, l])), byN = new Map();
  B.lines.forEach(l => { if(!byN.has(l.n)) byN.set(l.n, []); byN.get(l.n).push(l); });
  const rest = [];
  A.lines.forEach(l => {
    if(!l.n){ return; }
    let m = null;
    const ex = (byN.get(l.n) || []).find(x => !used.has(x.id));
    if(ex) m = ex; else { const o = byO.get(l.o); if(o && !used.has(o.id)) m = o; }
    if(m){ used.add(m.id); if(m.n !== l.n){ st.set(l.id, 'chg'); was.set(l.id, m.t); } }
    else rest.push(l);
  });
  const left = B.lines.filter(x => !used.has(x.id) && x.n);
  rest.forEach(l => {
    let best = null, bv = .58;
    left.forEach(x => { if(used.has(x.id)) return; const v = Math.max(dice(l.n, x.n), l.hd.length >= 4 && x.hd.length >= 4 ? dice(l.hd, x.hd) * .96 : 0); if(v > bv){ bv = v; best = x; } });
    if(best){ used.add(best.id); st.set(l.id, 'chg'); was.set(l.id, best.t); } else st.set(l.id, 'new');
  });
  const out = new Set(B.lines.filter(x => !used.has(x.id) && x.n && !x.b.k).map(x => x.id)), gone = [];
  let cover = -1;
  B.lines.forEach(x => { if(cover >= 0 && x.lv > cover){ return; } cover = -1; if(out.has(x.id)){ gone.push(x); cover = x.lv; } });
  return (A.diff = {q:q.id, qv:q._bv, day:q.day, st, was, gone});
}
/* 며칠째 남아 있는 일인지 — 이어받은 줄은 d0, 노션에서 온 줄은 같은 글자가 이어진 날까지 거슬러 */
function ageMap(p){
  const A = info(p);
  if(!A) return new Map();
  if(A.age) return A.age;
  const out = new Map(), past = dailies().filter(x => x.day < p.day && x.blocks);
  const live = new Map(A.lines.filter(l => l.n && !['goalM', 'goalW', 'daily'].includes(l.sec)).map(l => [l.id, l]));
  live.forEach((l, id) => { if(l.b.d0) out.set(id, l.b.d0); });
  const open = new Map([...live].filter(([id, l]) => !l.b.d0));
  for(const q of past){
    if(!open.size) break;
    const Q = info(q);
    open.forEach((l, id) => { if(Q.set.has(l.n) || Q.os.has(l.o)) out.set(id, q.day); else open.delete(id); });
  }
  return (A.age = out);
}
/* 상태 — 줄에 적힌 말로 추측 (⇒ 뒤를 먼저 봄). 손으로 고른 st 가 우선 */
const STS = {go:'진행', chk:'확인 필요', wait:'대기', hold:'보류', done:'완료'};
const ST_RE = [['hold', /홀딩|보류|탈락/], ['go', /(진행|확인|문의|소통|요청|소싱|제작|수배|작업|체크|주문|생산|투입|비딩|서치)\s*중/], ['chk', /필요|여부|결정|확인\s*후|체크\s*(하기|요망)|컨펌/], ['wait', /예정|대기|아직|나오면|오면|들어오면|입고\s*(시|후)|소진\s*후/], ['done', /완료|입고됨|도착\s*완|픽스|확정/]];
function stOf(b, sec){
  if(b.k) return 'done';
  if(b.st) return b.st;
  if(sec === 'hold') return 'hold';
  const t = bText(b), i = t.search(AR), try1 = s => { for(const [k, re] of ST_RE) if(re.test(s)) return k; return ''; };
  return (i >= 0 && try1(t.slice(i))) || try1(i >= 0 ? t.slice(0, i) : t);
}
const tagOf = t => { const m = String(t).match(/^\s*\[([^\]\n\[]{1,24})\]/); return m && !/^[\d\s\-~./]+/.test(m[1]) ? m[1].trim() : ''; };
/* 발주 · 입고 — '[업체] MMDD_상품 200ea' 줄, '… MMDD 입고예정' 줄을 모은다 */
function ordersOf(p){
  const A = info(p); if(!A) return {orders:[], due:[]};
  const y = +p.day.slice(0, 4), iso = (s, future) => {
    const m = +s.slice(0, 2), d = +s.slice(2, 4); if(!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
    let v = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const df = dayDiff(v, p.day);
    if(!future && df > 60) v = (y - 1) + v.slice(4);
    if(future && df < -200) v = (y + 1) + v.slice(4);
    return v;
  };
  const orders = [], due = [];
  A.lines.forEach(l => {
    const m = l.t.match(/^\s*(?:\[([^\]]+)\])?\s*(\d{4})_(.+?)\s*([\d,]+)\s*ea\b/i);
    if(m && mmdd(m[2])) orders.push({id:l.id, v:m[1] || '', day:iso(m[2]), name:m[3].trim(), q:m[4], done:!!l.b.k});
    else{
      const e = l.t.match(/(?:^|[^\d])(\d{1,2})[\/.](\d{1,2})\s*(입고|도착|발송|출고|회신|미팅)?\s*예정/) || l.t.match(/(?:^|[^\d])(\d{2})(\d{2})\s*(입고|도착|발송|출고|회신|미팅)?\s*예정/);
      if(e && !l.b.k){ const v = iso(String(e[1]).padStart(2, '0') + String(e[2]).padStart(2, '0'), true); if(v) due.push({id:l.id, day:v, t:l.t, what:e[3] || ''}); }
    }
  });
  orders.sort((a, b) => a.day.localeCompare(b.day)); due.sort((a, b) => a.day.localeCompare(b.day));
  return {orders, due};
}

/* ============================================================ 업무일지 만들기 · 고치기 ============================================================ */
const nb = (o) => Object.assign({id:bid(), lv:0, t:'li', r:[]}, o);
const BLANK = {
  daily:() => [nb({t:'h3', r:T('오늘 할 일')}), nb(), nb({t:'h3', r:T('제품진행')}), nb(), nb({t:'h3', r:T('디자인')}), nb(), nb({t:'h3', r:T('기타')}), nb(), nb({t:'h3', r:T('내일 할 일')}), nb(), nb({t:'h3', r:T('데일리 체크')}), nb(), nb({t:'h3', r:T('주간목표')}), nb(), nb({t:'h3', r:T('월간목표')}), nb()],
  status:() => [nb({t:'h3', r:T('샘플 투입 진행중')}), nb(), nb({t:'h3', r:T('샘플 예정건')}), nb(), nb({t:'h3', r:T('디벨롭건')}), nb(), nb({t:'h3', r:T('홀딩')}), nb()],
  memo:() => [nb({t:'h3', r:T('회의록')}), nb()]
};
/* 어제 글 → 오늘 글: 끝낸 줄은 빼고, '내일 할 일' 은 '오늘 할 일' 로, 나머지는 그대로 이어받기 */
function carry(src){
  const age = ageMap(src), out = [], keep = b => nb({lv:b.lv || 0, t:b.t, r:clone(b.r || []), bg:b.bg, st:b.st === 'done' ? undefined : b.st, f:b.f, src:b.src, w:b.w, cap:b.cap, href:b.href, name:b.name, size:b.size, o:b.o || b.id, d0:b.d0 || age.get(b.id) || src.day});
  const live = items => { const r = []; let cut = -1; items.forEach(b => { const lv = b.lv || 0; if(cut >= 0 && lv > cut) return; cut = -1; if(b.k){ cut = lv; return; } r.push(b); }); while(r.length && isEmpty(r[r.length - 1])) r.pop(); return r; };
  const ss = sections(src.blocks), todo = [];
  ss.forEach(s => { if(s.type === 'today' || s.type === 'tomorrow') todo.push(...live(s.items).filter(b => !isEmpty(b))); });
  const addHead = () => { out.push(nb({t:'h3', r:T('오늘 할 일')})); if(todo.length) todo.forEach(b => out.push(keep(b))); else out.push(nb()); };
  addHead();
  ss.forEach(s => {
    if(s.type === 'tomorrow' || s.type === 'today') return;
    const its = live(s.items);
    if(!s.head && !its.length) return;
    if(s.head) out.push(keep(s.head)); else if(out.length) out.push(nb({t:'hr'}));
    its.forEach(b => out.push(keep(b)));
    if(s.head && !its.length) out.push(nb());
  });
  out.push(nb({t:'h3', r:T('내일 할 일')}), nb());
  out.forEach(b => { if(isHead(b)){ delete b.d0; } Object.keys(b).forEach(k => b[k] === undefined && delete b[k]); });
  return out;
}
async function newPage(kind, day, opt){
  opt = opt || {};
  if(kind === 'daily'){ const ex = dailies().find(p => p.day === day); if(ex && !opt.force){ openPage(ex.id); return ex; } }
  let blocks = null, title = kind === 'daily' ? '업무일지' : kind === 'status' ? `${day.slice(5, 7)}${day.slice(8, 10)} 진행상황` : (opt.title || '회의록');
  if(!opt.blank && kind !== 'memo'){
    const src = list().find(p => p.kind === kind && p.day <= day);
    if(src){
      try{ await loadBlocks([src.id]); }catch(e){}
      if(src.blocks && src.blocks.length) blocks = kind === 'daily' ? carry(src) : carryPlain(src);
    }
  }
  if(!blocks) blocks = BLANK[kind]();
  const p = {id:uuid(), day, title, kind, meta:{}, blocks, ver:0, _bv:0, n:0, nd:0, origin:'office', ca:new Date().toISOString(), ua:new Date().toISOString(), ub:me()};
  S.pages.set(p.id, p);
  S.dirty.set(p.id, {base:0, bb:[], bm:{title, day, kind, meta:{}}, seq:1, isNew:true});
  S.caches.clear();
  persistDirty(); saveTag('saving'); scheduleSave(60);
  openPage(p.id);
  return p;
}
const carryPlain = src => (src.blocks || []).filter(b => !b.k).map(b => { const x = nb(Object.assign(clone(b), {o:b.o || b.id, id:bid()})); x.id = bid(); return x; });

/* ── 되돌리기 ── */
function mark(p, coalesce){
  const u = S.undo.get(p.id) || {st:[], rd:[], at:0, tag:''};
  S.undo.set(p.id, u);
  const now = Date.now();
  if(coalesce && u.tag === coalesce && now - u.at < 1500){ u.at = now; return; }
  u.st.push(JSON.stringify(p.blocks)); if(u.st.length > 80) u.st.shift();
  u.rd = []; u.at = now; u.tag = coalesce || '';
}
function undo(redo){
  const p = cur(); if(!p) return;
  const u = S.undo.get(p.id), from = u && (redo ? u.rd : u.st);
  if(!from || !from.length){ say(redo ? '다시 할 것이 없어요' : '되돌릴 것이 없어요'); return; }
  const f = focusedId();
  beforeEdit(p);
  (redo ? u.st : u.rd).push(JSON.stringify(p.blocks));
  p.blocks = JSON.parse(from.pop()); u.tag = '';
  touch(p); renderPage(); if(p.kind === 'order') sideSoon();
  if(f && xEl(f)) focusB(f, 'end');
}
const focusedId = () => { const a = document.activeElement, l = a && a.closest && a.closest('#wl .wl-b'); return l ? l.dataset.id : null; };
const idx = (p, id) => (p.blocks || []).findIndex(b => b.id === id);
function subEnd(bs, i){ const lv = bs[i].lv || 0; let j = i + 1; if(isHead(bs[i]) || bs[i].t === 'hr') return j; while(j < bs.length && !isHead(bs[j]) && bs[j].t !== 'hr' && (bs[j].lv || 0) > lv) j++; return j; }
function edit(fn, o){           // 줄 구조를 바꾸는 모든 고침은 여기로
  const p = cur(); if(!p || !p.blocks) return;
  o = o || {};
  beforeEdit(p); mark(p);
  const r = fn(p.blocks, p);
  if(r === false){ const u = S.undo.get(p.id); if(u) u.st.pop(); return; }
  touch(p); renderPage(); if(p.kind === 'order') sideSoon();
  if(r && r.focus) focusB(r.focus, r.pos);
  else if(o.focus) focusB(o.focus, o.pos);
}
function toggleDone(id){
  edit((bs) => { const i = bs.findIndex(b => b.id === id); if(i < 0) return false; const on = !bs[i].k, z = subEnd(bs, i); for(let j = i; j < z; j++){ if(on) bs[j].k = 1; else delete bs[j].k; if(bs[j].st === 'done') delete bs[j].st; } });
}
function removeLines(ids, quiet){
  const p = cur(); if(!p) return;
  const set = new Set(ids), n = ids.length;
  let nextFocus = null;
  edit(bs => {
    const all = new Set();
    bs.forEach((b, i) => { if(set.has(b.id)) for(let j = i, z = set.size > 1 ? i + 1 : subEnd(bs, i); j < z; j++) all.add(bs[j].id); });
    const first = bs.findIndex(b => all.has(b.id));
    if(first < 0) return false;
    const before = bs.slice(0, first).reverse().find(b => b.t !== 'hr' && b.t !== 'img');
    p.blocks = bs.filter(b => !all.has(b.id));
    nextFocus = before ? before.id : null;
  });
  if(!quiet) snack(n > 1 ? `${n}줄 지웠어요` : '지웠어요', () => undo());
  return nextFocus;
}
function moveLine(id, dir){
  edit(bs => {
    const i = bs.findIndex(b => b.id === id); if(i < 0) return false;
    const z = subEnd(bs, i), lv = bs[i].lv || 0, chunk = bs.slice(i, z);
    if(dir < 0){
      let j = i - 1; while(j >= 0 && (bs[j].lv || 0) > lv && !isHead(bs[j])) j--;
      if(j < 0) return false;
      if(isHead(bs[j]) || bs[j].t === 'hr'){ if(j === 0) return false; j = j; }
      bs.splice(i, chunk.length); bs.splice(j, 0, ...chunk);
    }else{
      if(z >= bs.length) return false;
      const e = isHead(bs[z]) || bs[z].t === 'hr' ? z + 1 : subEnd(bs, z);
      bs.splice(i, chunk.length); bs.splice(e - chunk.length, 0, ...chunk);
    }
    return {focus:id, pos:'end'};
  });
}
function indent(ids, dir){
  edit(bs => {
    let ok = false;
    const done = new Set();
    ids.forEach(id => {
      const i = bs.findIndex(b => b.id === id); if(i < 0 || isHead(bs[i]) || done.has(id)) return;
      const lv = bs[i].lv || 0, prev = bs[i - 1];
      if(dir > 0 && (!prev || isHead(prev) || prev.t === 'hr' || (prev.lv || 0) < lv)) return;
      if(dir < 0 && lv === 0) return;
      for(let j = i, z = subEnd(bs, i); j < z; j++){ bs[j].lv = Math.max(0, (bs[j].lv || 0) + dir); done.add(bs[j].id); }
      ok = true;
    });
    return ok ? (ids.length === 1 ? {focus:ids[0], pos:caretPos()} : undefined) : false;
  });
}
const caretPos = () => { const a = document.activeElement, s = a && a.classList && a.classList.contains('wl-x') ? selIn(a) : null; return s ? s[0] : 'end'; };
function setProp(ids, f){ edit(bs => { const set = new Set(ids); bs.forEach(b => { if(set.has(b.id)) f(b); }); }); }
function sendTomorrow(id){
  edit(bs => {
    const i = bs.findIndex(b => b.id === id); if(i < 0) return false;
    const chunk = bs.splice(i, subEnd(bs, i) - i), lv0 = chunk[0].lv || 0;
    chunk.forEach(b => { b.lv = (b.lv || 0) - lv0; });
    let h = bs.findIndex(b => isHead(b) && secType(b) === 'tomorrow');
    if(h < 0){ bs.push(nb({t:'h3', r:T('내일 할 일')})); h = bs.length - 1; }
    let z = h + 1; while(z < bs.length && !isHead(bs[z]) && bs[z].t !== 'hr') z++;
    while(z > h + 1 && isEmpty(bs[z - 1])){ bs.splice(z - 1, 1); z--; }
    bs.splice(z, 0, ...chunk);
  });
  say('‘내일 할 일’ 로 보냈어요');
}

/* ============================================================ 그리기 ============================================================ */
function mount(){
  const w = document.getElementById('wl'), bd = document.getElementById('wlBoard');
  if(!w) return false;
  if(!w._on){ w._on = true; w.innerHTML = '<div class="wl-top" id="wlTop"></div><div class="wl-main" id="wlMain"></div>'; bindLog(w); }
  if(bd && !bd._on){ bd._on = true; bindBoard(bd); }
  return true;
}
function renderAll(){
  if(!mount()) return;
  S.defer = false;
  if(S.view !== 'order' && (!S.cur || !S.pages.has(S.cur) || S.pages.get(S.cur).kind === 'order')) S.cur = (S.lastPage && S.pages.has(S.lastPage) ? S.lastPage : (dailies()[0] || list()[0] || {}).id) || null;
  if(S.view === 'order' && S.cur && (!S.pages.has(S.cur) || S.pages.get(S.cur).kind !== 'order')) S.cur = null;
  renderTop(); renderMain(); renderBoard();
}
function renderTop(){
  const el = document.getElementById('wlTop'); if(!el) return;
  if(el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  const has = dailies().some(p => p.day === S.today), off = isOff(S.today);
  const V = [['page', '일지'], ['over', '한눈에'], ['cal', '달력'], ['order', '발주 · 샘플']];
  el.innerHTML = `<b class="wl-name">📓 업무일지</b><span class="wl-save" data-s="">${S.saveAt ? `✓ 저장됨 ${hm(S.saveAt)}` : ''}</span>
    <span class="wl-sp"></span>
    <label class="wl-search"><span aria-hidden="true">🔍</span><input type="search" id="wlQ" placeholder="지난 기록 찾기 — 상품 · 업체 · 낱말" value="${E(S.find ? S.find.q : '')}" aria-label="지난 기록 찾기"></label>
    <div class="wl-seg" role="tablist">${V.map(([k, t]) => `<button type="button" role="tab" aria-selected="${S.view === k}" class="${S.view === k && !S.find ? 'on' : ''}" data-view="${k}">${t}</button>`).join('')}</div>
    <button type="button" class="wl-btn pri" data-act="today">${has ? '오늘로' : '＋ 오늘 업무일지'}</button>
    <button type="button" class="wl-btn" data-act="new">＋ 새 글</button>
    <button type="button" class="wl-btn ico" data-act="more" aria-label="더 보기" title="지운 글 · 단축키">⋯</button>`;
}
function renderMain(){
  const el = document.getElementById('wlMain'); if(!el) return;
  if(!S.pages.size){
    el.className = 'wl-main one';
    el.innerHTML = S.err ? `<div class="wl-empty"><b>업무일지를 불러오지 못했어요</b><span>${E(S.err)}</span><button type="button" class="wl-btn pri" data-act="reload">다시 불러오기</button></div>`
      : !S.ready ? '<div class="wl-skel"><i></i><i></i><i></i><i></i><i></i></div>' : '<div class="wl-empty"><b>아직 글이 없어요</b><button type="button" class="wl-btn pri" data-act="today">＋ 오늘 업무일지</button></div>';
    return;
  }
  if(S.find){ el.className = 'wl-main one'; el.innerHTML = findHtml(); return; }
  if(S.view === 'cal'){ el.className = 'wl-main one'; el.innerHTML = calHtml(); return; }
  if(S.view === 'over'){ el.className = 'wl-main one'; el.innerHTML = overHtml(); return; }
  if(S.view === 'order'){ el.className = 'wl-main one'; el.innerHTML = orderHtml(); renderOrd(); if(S.cur) renderPage(); return; }
  el.className = 'wl-main';
  el.innerHTML = `<aside class="wl-nav" id="wlNav"></aside><div class="wl-page" id="wlPage"></div><aside class="wl-side" id="wlSide"></aside>`;
  renderNav(); renderPage();
}
/* ── 왼쪽 목록 ── */
function renderNav(){
  const el = document.getElementById('wlNav'); if(!el) return;
  const ps = list(), p = cur();
  if(!S.month) S.month = (p ? p.day : S.today).slice(0, 7);
  const by = new Map(); ps.forEach(x => { if(!by.has(x.day)) by.set(x.day, []); by.get(x.day).push(x); });
  const y = +S.month.slice(0, 4), m = +S.month.slice(5, 7), first = new Date(y, m - 1, 1).getDay(), n = new Date(y, m, 0).getDate();
  let cells = '';
  for(let i = 0; i < first; i++) cells += '<i></i>';
  for(let d = 1; d <= n; d++){
    const s = `${S.month}-${String(d).padStart(2, '0')}`, has = by.get(s);
    cells += `<button type="button" class="${has ? 'has' : ''}${s === S.today ? ' tod' : ''}${p && p.day === s ? ' cur' : ''}${isOff(s) ? ' off' : ''}" data-day="${s}"${has ? ` title="${E(has.map(x => x.title).join(' · '))}"` : ''}>${d}</button>`;
  }
  const kinds = [['all', '전체']].concat(Object.entries(KINDS)), shown = ps.filter(x => S.kind === 'all' || x.kind === S.kind);
  let lastM = '', rows = '';
  shown.slice(0, S.navAll ? 2000 : 40).forEach(x => {
    const mk = x.day.slice(0, 7);
    if(mk !== lastM){ lastM = mk; rows += `<div class="wl-nm">${mk.slice(0, 4) === S.today.slice(0, 4) ? '' : mk.slice(0, 4) + '년 '}${+mk.slice(5)}월</div>`; }
    rows += `<button type="button" class="wl-ni${S.cur === x.id ? ' on' : ''}" data-open="${x.id}"><span class="d">${+x.day.slice(8)}<small>${WK[dow(x.day)]}</small></span><span class="t">${E(x.title || '(제목 없음)')}</span><span class="c">${x.n ? (x.nd ? `${x.nd}/` : '') + x.n : ''}</span></button>`;
  });
  if(shown.length > 40 && !S.navAll) rows += `<button type="button" class="wl-ni more" data-act="navall">더 보기 ${shown.length - 40}개</button>`;
  el.innerHTML = `<div class="wl-mc"><div class="wl-mch"><button type="button" data-mon="-1" aria-label="지난달">‹</button><b>${y}년 ${m}월</b><button type="button" data-mon="1" aria-label="다음달">›</button></div>
    <div class="wl-mcg"><em>일</em><em>월</em><em>화</em><em>수</em><em>목</em><em>금</em><em>토</em>${cells}</div></div>
    <div class="wl-kinds">${kinds.map(([k, t]) => `<button type="button" class="${S.kind === k ? 'on' : ''}" data-kind="${k}">${t}</button>`).join('')}</div>
    <div class="wl-nl">${rows || '<div class="wl-none">글이 없어요</div>'}</div>`;
}
/* ── 글 ── */
function lineHtml(b, s, x){
  const lv = Math.max(0, (b.lv || 0) - x.base), kids = x.kids.has(b.id), st = x.norm ? stOf(b, s.type) : (b.k ? 'done' : ''), nm = x.diff ? x.diff.st.get(b.id) : '', d0 = x.age.get(b.id);
  const days = d0 && !b.k ? dayDiff(x.p.day, d0) : 0, tag = tagOf(bText(b));
  const dim = (S.fSt && x.own.get(b.id) !== S.fSt) || (S.fTag && x.tagOf.get(b.id) !== S.fTag);
  const cls = `wl-b t-${b.t}${b.k ? ' is-done' : ''}${b.bg && b.bg !== 'default_background' ? ' bg-' + String(b.bg).replace(/_background$/, '') : ''}${kids ? ' has-k' : ''}${b.f ? ' is-fold' : ''}${isEmpty(b) ? ' is-empty' : ''}${dim ? ' is-dim' : ''}${st === 'hold' && x.norm ? ' is-hold' : ''}${S.sel && S.sel.ids.has(b.id) ? ' is-sel' : ''}`;
  const grip = '<button type="button" class="wl-grip" draggable="true" data-act="menu" tabindex="-1" aria-label="줄 메뉴" title="누르면 메뉴 · 끌면 옮기기">⠿</button>';
  const del = '<button type="button" class="wl-x2" data-act="del" tabindex="-1" aria-label="이 줄 지우기" title="지우기">×</button>';
  if(b.t === 'img') return `<div class="${cls}" data-id="${b.id}" style="--lv:${lv}">${grip}<figure class="wl-fig"><img src="${E(imgUrl(b.src))}" alt="${E(b.cap || '')}" loading="lazy" data-act="zoom">${b.cap ? `<figcaption>${E(b.cap)}</figcaption>` : ''}</figure>${del}</div>`;
  if(b.t === 'file') return `<div class="${cls}" data-id="${b.id}" style="--lv:${lv}">${grip}<a class="wl-file" href="${E(imgUrl(b.src))}" target="_blank" rel="noopener noreferrer">📎 ${E(b.name || bText(b) || '파일')}${b.size ? `<small>${Math.max(1, Math.round(b.size / 1024)).toLocaleString()}KB</small>` : ''}</a>${del}</div>`;
  const dot = b.t === 'p' || b.t === 'quote' || b.t === 'callout' || b.t === 'code' ? '<span class="wl-dot none"></span>' : `<button type="button" class="wl-dot" data-act="done" tabindex="-1" aria-label="${b.k ? '끝냄 풀기' : '끝냄'}" title="${b.k ? '다시 할 일로' : '끝냈으면 누르기'}"></button>`;
  const side = [nm === 'new' ? '<em class="new">새로</em>' : nm === 'chg' ? `<em class="chg" title="${E('앞글: ' + (x.diff.was.get(b.id) || ''))}">고침</em>` : '',
    x.norm && days >= 5 ? `<em class="age${days >= 14 ? ' old' : ''}" title="${E(d0)} 부터 남아 있어요">${days + 1}일째</em>` : '',
    st && x.norm && lv <= 1 ? `<button type="button" class="st s-${st}" data-act="st" tabindex="-1" title="누르면 상태를 골라요">${STS[st]}</button>` : ''].join('');
  return `<div class="${cls}" data-id="${b.id}" style="--lv:${lv}">${grip}${kids ? '<button type="button" class="wl-fo" data-act="fold" tabindex="-1" aria-label="접기 · 펼치기" title="접기 · 펼치기"></button>' : '<span class="wl-fo"></span>'}${dot}<div class="wl-x" contenteditable="true" spellcheck="false" role="textbox" data-ph="${b.t === 'p' ? '적기' : '할 일 적기'}">${deco(b)}</div>${side ? `<span class="wl-bs">${side}</span>` : ''}${del}</div>`;
}
function ctxOf(p){
  const ss = sections(p.blocks), I = info(p), own = new Map(), tags = new Map();
  ss.forEach(s => { let t0 = '', st0 = '', lv0 = -1; s.items.forEach(b => { const t = tagOf(bText(b)), lv = b.lv || 0; if(lv0 < 0 || lv <= lv0){ t0 = t; st0 = stOf(b, s.type); lv0 = lv; } tags.set(b.id, t || t0); own.set(b.id, ['goalM', 'goalW', 'daily'].includes(s.type) ? '' : stOf(b, s.type) || st0); }); });
  return {p, ss, diff:p.kind === 'memo' ? null : diffOf(p), age:p.kind === 'daily' ? ageMap(p) : new Map(), own, tagOf:tags, I};
}
function secHtml(s, c){
  const items = s.items.filter(b => !(b.t === 'p' && isEmpty(b) && !S.fresh.has(b.id)));
  const base = Math.min(...items.map(b => b.lv || 0), 9), kids = new Set();
  s.items.forEach((b, i) => { const n = s.items[i + 1]; if(n && (n.lv || 0) > (b.lv || 0)) kids.add(b.id); });
  const x = Object.assign({base:base === 9 ? 0 : base, kids, norm:c.p.kind !== 'order' && !['goalM', 'goalW', 'daily'].includes(s.type)}, c);
  let hide = -1, rows = '';
  items.forEach(b => { const lv = b.lv || 0; if(hide >= 0 && lv > hide) return; hide = -1; rows += lineHtml(b, s, x); if(b.f && kids.has(b.id)) hide = lv; });
  const real = s.items.filter(b => !isEmpty(b) && b.t !== 'hr'), dn = real.filter(b => b.k).length;
  const fold = s.head && s.head.f;
  return `<section class="wl-sec${s.type ? ' k-' + s.type : ''}${fold ? ' is-fold' : ''}" data-sec="${s.key}">
    ${s.head ? `<header class="wl-sh wl-b t-h" data-id="${s.head.id}"><button type="button" class="wl-grip" draggable="true" data-act="menu" tabindex="-1" title="누르면 메뉴 · 끌면 구역째 옮기기">⠿</button><button type="button" class="wl-fo" data-act="fold" tabindex="-1" aria-label="접기 · 펼치기" title="접기 · 펼치기"></button><div class="wl-x" contenteditable="true" spellcheck="false" role="textbox" data-ph="구역 이름">${deco(s.head)}</div><span class="wl-cnt">${dn ? `${dn}/` : ''}${real.length || ''}</span><button type="button" class="wl-x2" data-act="delsec" tabindex="-1" title="구역째 지우기">×</button></header>` : ''}
    <div class="wl-bs-list">${rows}</div>
    <button type="button" class="wl-add" data-act="addline" data-sec="${s.key}">＋ 줄</button></section>`;
}
function renderPage(){
  const el = document.getElementById('wlPage'); if(!el) return;
  const p = cur();
  if(!p){ el.innerHTML = S.view === 'order' ? '' : '<div class="wl-empty"><b>글을 골라 주세요</b></div>'; return; }
  if(!p.blocks){ el.innerHTML = '<div class="wl-skel"><i></i><i></i><i></i><i></i></div>'; loadBlocks([p.id]).then(() => { if(S.cur === p.id) renderPage(); }).catch(e => { el.innerHTML = `<div class="wl-empty"><b>글을 불러오지 못했어요</b><button type="button" class="wl-btn" data-act="reload">다시</button></div>`; }); return; }
  const prev = prevOf(p);
  if(prev && !prev.blocks && !prev._try){ prev._try = 1; loadBlocks([prev.id]).then(() => { S.caches.delete(p.id); if(S.cur === p.id && !editing()) renderPage(); }).catch(() => {}); }
  const c = ctxOf(p), seq = list(), i = seq.findIndex(x => x.id === p.id), nx = seq[i - 1], pv = seq[i + 1];
  const vis = secOrder(p, c.ss).filter(s => s.head || s.items.some(b => !isEmpty(b) || S.fresh.has(b.id)));
  // 두 칸 나누기 — 글을 열 때 한 번 정하고 고치는 동안 자리를 안 바꾼다 (카드가 튀지 않게)
  const wide = el.clientWidth >= 860;
  let sp = S.split.get(p.id);
  const keys = vis.map(s => s.key);
  if(!sp || !keys.every(k => sp.has(k))){
    const w = s => 2.2 + s.items.filter(b => !isEmpty(b)).reduce((a, b) => a + Math.max(1, Math.ceil(bText(b).length / 34)), 0), tot = vis.reduce((a, s) => a + w(s), 0);
    const nsp = new Map(); let acc = 0, side = 0;
    vis.forEach((s, k) => { const ww = w(s); if(sp && sp.has(s.key)) side = sp.get(s.key); else if(!sp && side === 0 && k > 0 && acc + ww / 2 > tot / 2) side = 1; nsp.set(s.key, side); acc += ww; });
    sp = nsp; S.split.set(p.id, sp);
  }
  const col = n => vis.filter(s => (wide ? sp.get(s.key) || 0 : 0) === n).map(s => secHtml(s, c)).join('');
  const st = {}, tg = new Map();
  (c.I ? c.I.lines : []).forEach(l => { if(l.lv > 0) return; const s = c.own.get(l.id); if(s) st[s] = (st[s] || 0) + 1; const t = tagOf(l.t); if(t) tg.set(t, (tg.get(t) || 0) + 1); });
  const tags = [...tg].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const tot = c.I ? c.I.lines.length : 0, dn = c.I ? c.I.lines.filter(l => l.b.k).length : 0;
  if(S.fSt && !st[S.fSt]) S.fSt = ''; if(S.fTag && !tg.has(S.fTag)) S.fTag = '';
  const first = dailies()[0], needToday = p === first && p.day < S.today && !isOff(S.today), rest = needToday && c.I ? c.I.lines.filter(l => !l.b.k && !['goalM', 'goalW', 'daily'].includes(l.sec)).length : 0;
  if(p.kind === 'order'){ el.innerHTML = orderPage(p, c, vis); return; }
  el.innerHTML = `${needToday ? `<div class="wl-today"><span><b>${md(S.today)} (${WK[dow(S.today)]})</b> 업무일지가 아직 없어요 — 남은 일 ${rest}줄을 이어받아 시작해요</span><button type="button" class="wl-btn pri" data-act="today">오늘 업무일지 시작</button></div>` : ''}<div class="wl-ph">
      <div class="wl-pd"><button type="button" class="wl-step" data-open="${pv ? pv.id : ''}"${pv ? '' : ' disabled'} title="이전 글" aria-label="이전 글">‹</button>
        <button type="button" class="wl-date" data-act="pickday" title="날짜 바꾸기"><b>${+p.day.slice(5, 7)}월 ${+p.day.slice(8)}일</b> <span>${WK[dow(p.day)]}요일</span>${p.day === S.today ? '<em>오늘</em>' : ''}</button>
        <button type="button" class="wl-step" data-open="${nx ? nx.id : ''}"${nx ? '' : ' disabled'} title="다음 글" aria-label="다음 글">›</button></div>
      <input class="wl-title" id="wlTitle" value="${E(p.title)}" maxlength="120" placeholder="제목" aria-label="제목">
      <select class="wl-kind" id="wlKind" aria-label="글 종류">${Object.entries(KINDS).map(([k, t]) => `<option value="${k}"${p.kind === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <span class="wl-sp"></span>
      <span class="wl-meta">${p.ub && p.ub !== 'notion' ? E(p.ub) + ' · ' : ''}${p.ua ? `${md(ymd(new Date(p.ua)))} ${hm(p.ua)} 수정` : ''}${p.origin === 'notion' ? ' · 노션에서 옮김' : ''}</span>
      <button type="button" class="wl-btn sm" data-act="undo" title="되돌리기 (Ctrl+Z)">되돌리기</button><button type="button" class="wl-btn sm" data-act="copy" title="글자로 복사">복사</button><button type="button" class="wl-btn sm ico" data-act="pagemenu" aria-label="이 글 메뉴">⋯</button></div>
    <div class="wl-fl">${Object.entries(STS).filter(([k]) => st[k]).map(([k, t]) => `<button type="button" class="${S.fSt === k ? 'on' : ''}" data-fst="${k}">${t} <b>${st[k]}</b></button>`).join('')}${tags.length ? '<i></i>' : ''}${tags.map(([t, n]) => `<button type="button" class="tg${S.fTag === t ? ' on' : ''}" data-ftag="${E(t)}">${E(t)} <b>${n}</b></button>`).join('')}<span class="wl-sp"></span>${dn ? `<button type="button" class="${S.hideDone ? 'on' : ''}" data-act="hidedone">${S.hideDone ? `끝낸 일 ${dn} 보기` : `끝낸 일 ${dn} 숨기기`}</button>` : ''}</div>
    <div class="wl-cols${wide && vis.some(s => sp.get(s.key) === 1) ? ' two' : ''}${S.hideDone ? ' hide-done' : ''}"><div>${col(0)}${!wide || !vis.some(s => sp.get(s.key) === 1) ? addSecBtn() : ''}</div>${wide && vis.some(s => sp.get(s.key) === 1) ? `<div>${col(1)}${addSecBtn()}</div>` : ''}</div>`;
  renderSide();
}
const addSecBtn = () => '<button type="button" class="wl-addsec" data-act="addsec">＋ 구역</button>';
/* ── 오른쪽 자동 정리 ── */
function renderSide(){
  const el = document.getElementById('wlSide'); if(!el) return;
  const p = cur(); if(!p || !p.blocks){ el.innerHTML = ''; return; }
  const d = p.kind === 'memo' ? null : diffOf(p), o = ordersOf(p), A = info(p), age = p.kind === 'daily' ? ageMap(p) : new Map();
  const parts = [];
  const go = (id, t, r, cls) => `<button type="button" class="wl-sl${cls ? ' ' + cls : ''}" data-go="${id}"><span>${t}</span>${r ? `<em>${r}</em>` : ''}</button>`;
  const ups = p.kind === 'daily' && p === dailies()[0] ? upcoming() : [];
  if(ups.length || o.due.length) parts.push(`<div class="wl-sc"><h4>입고 예정</h4>${ups.map(x => { const n = dayDiff(x.day, S.today); return `<button type="button" class="wl-sl up" data-open="${x.id}"><span>${md(x.day)} <small>${WK[dow(x.day)]}</small> ${E(oTitle(x))}<i>${E([oFac(x).join(' · '), oLines(x).slice(0, 2).join(' · ')].filter(Boolean).join(' — '))}</i></span><em>${n === 0 ? '오늘' : n > 0 ? 'D-' + n : -n + '일 전'}</em></button>`; }).join('')}${o.due.map(x => { const n = dayDiff(x.day, S.today); return go(x.id, E(x.t), `<b class="${n < 0 ? 'bad' : ''}">${n === 0 ? '오늘' : n > 0 ? 'D-' + n : -n + '일 지남'}</b> ${md(x.day)}`); }).join('')}</div>`);
  if(o.orders.length){
    const wait = o.orders.filter(x => !x.done), sum = wait.reduce((a, x) => a + (+x.q.replace(/,/g, '') || 0), 0);
    parts.push(`<div class="wl-sc"><h4>발주 · 입고 <small>${wait.length}건${sum ? ' · ' + sum.toLocaleString() + 'ea' : ''}${inb.at ? ` · ${hm(inb.at)} 자동 확인` : ''}</small></h4><table class="wl-ot"><tbody>${o.orders.map(x => `<tr class="${x.done ? 'is-done' : ''}"><td><button type="button" class="wl-ock" data-odone="${x.id}" title="${x.done ? '아직 안 들어옴' : '들어왔으면 누르기'}" aria-label="입고"></button></td><td class="d">${x.day ? md(x.day) : ''}</td><td class="n" data-go="${x.id}">${x.v ? `<small>${E(x.v)}</small> ` : ''}${E(x.name)}${(z => z ? `<i class="k-${z.k}">${E(z.t)}</i>` : '')(x.done ? null : inbOf(x))}</td><td class="q">${E(x.q)}</td><td class="a">${x.day && !x.done ? Math.max(0, dayDiff(p.day === dailies()[0]?.day ? S.today : p.day, x.day)) + '일' : ''}</td></tr>`).join('')}</tbody></table></div>`);
  }
  if(d){
    const nw = A.lines.filter(l => d.st.get(l.id) === 'new'), ch = A.lines.filter(l => d.st.get(l.id) === 'chg');
    if(nw.length || ch.length || d.gone.length) parts.push(`<div class="wl-sc"><h4>${md(d.day)} 글과 달라진 점</h4>
      ${nw.length ? `<h5>새로 ${nw.length}</h5>${nw.slice(0, 12).map(l => go(l.id, E(l.t))).join('')}${nw.length > 12 ? `<p>외 ${nw.length - 12}</p>` : ''}` : ''}
      ${ch.length ? `<h5>고침 ${ch.length}</h5>${ch.slice(0, 10).map(l => `<button type="button" class="wl-sl two" data-go="${l.id}"><s>${E(d.was.get(l.id) || '')}</s><span>${E(l.t)}</span></button>`).join('')}` : ''}
      ${d.gone.length ? `<h5>빠짐 ${d.gone.length}</h5>${d.gone.slice(0, 12).map(l => `<div class="wl-sl gone"><span>${E(l.t)}</span><button type="button" data-back="${l.id}" title="이 글로 다시 가져오기">되살리기</button></div>`).join('')}${d.gone.length > 12 ? `<p>외 ${d.gone.length - 12}</p>` : ''}` : ''}</div>`);
  }
  const old = A.lines.filter(l => l.lv === 0 && !l.b.k && age.get(l.id) && dayDiff(p.day, age.get(l.id)) >= 13 && !['goalM', 'goalW', 'daily'].includes(l.sec)).sort((a, b) => age.get(a.id).localeCompare(age.get(b.id)));
  if(old.length) parts.push(`<div class="wl-sc"><h4>2주 넘게 남은 일 <small>${old.length}</small></h4>${old.slice(0, 10).map(l => go(l.id, E(l.t), `<b class="bad">${dayDiff(p.day, age.get(l.id)) + 1}일째</b>`)).join('')}</div>`);
  el.innerHTML = parts.length ? parts.join('') : '<div class="wl-sc mute">발주 줄([업체] 1104_상품 200ea)이나 날짜(1126 입고예정)를 적으면 여기에 저절로 모여요.</div>';
}

/* ── 한눈에 ── */
function overHtml(){
  const p = dailies()[0], G = [['vendor', '업체별'], ['status', '상태별'], ['week', '이번 주']];
  const bar = `<div class="wl-ob"><div class="wl-seg">${G.map(([k, t]) => `<button type="button" class="${S.group === k ? 'on' : ''}" data-group="${k}">${t}</button>`).join('')}</div>${p ? `<span class="wl-meta">${md(p.day)} (${WK[dow(p.day)]}) 업무일지 기준</span>` : ''}<span class="wl-sp"></span>${S.group === 'week' ? '<button type="button" class="wl-btn sm" data-act="copyweek">글자로 복사</button>' : ''}</div>`;
  if(!p) return bar;
  if(!p.blocks){ loadBlocks([p.id]).then(renderMain).catch(() => {}); return bar + '<div class="wl-skel"><i></i><i></i></div>'; }
  if(S.group === 'week') return bar + weekHtml();
  const c = ctxOf(p), groups = new Map();
  const put = (k, l) => { if(!groups.has(k)) groups.set(k, []); groups.get(k).push(l); };
  let key = null, kb = 0;
  c.I.lines.forEach(l => {
    if(['goalM', 'goalW'].includes(l.sec)) return;
    if(S.group === 'status'){ if(l.sec === 'daily') return; if(l.lv > 0){ const s = stOf(l.b, l.sec); if(s && s !== c.own.get(l.id)) return put(key, l); if(key) put(key, l); return; } key = stOf(l.b, l.sec) || 'none'; put(key, l); }
    else{ const t = tagOf(l.t); if(l.lv > 0 && !t){ if(key) put(key, Object.assign({}, l, {lv:Math.max(1, l.lv - kb)})); return; } if(l.sec === 'daily' && !t) { key = null; return; } key = t || (l.head || '기타'); kb = l.lv; put(key, Object.assign({}, l, {lv:0})); }
  });
  const order = S.group === 'status' ? ['chk', 'go', 'wait', 'none', 'hold', 'done'] : [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length);
  const name = k => S.group === 'status' ? (STS[k] || '표시 없음') : k;
  return bar + `<div class="wl-og">${order.filter(k => groups.get(k)).map(k => { const ls = groups.get(k), min = Math.min(...ls.map(l => l.lv)); return `<section class="wl-oc"><h4>${E(name(k))} <small>${ls.filter(l => l.lv === min).length}</small></h4>${ls.map(l => `<button type="button" class="wl-ol${l.b.k ? ' is-done' : ''}" style="--lv:${Math.max(0, l.lv - min)}" data-go="${l.id}" data-pid="${p.id}"><span>${deco({t:'li', r:T(S.group === 'vendor' && tagOf(l.t) ? l.t.replace(/^\s*\[[^\]]+\]\s*/, '') : l.t)})}</span></button>`).join('')}</section>`; }).join('')}</div>`;
}
function weekData(){
  const mon = monOf(S.today), days = dailies().filter(p => p.day >= mon && p.day <= addD(mon, 6)).reverse(), done = [], add = [], seen = new Set();
  days.forEach(p => {
    if(!p.blocks) return;
    const d = diffOf(p), A = info(p);
    A.lines.forEach(l => { if(l.b.k && l.lv === 0 && !seen.has(l.o + 'k')){ seen.add(l.o + 'k'); done.push({day:p.day, t:l.t}); } });
    if(d){ d.gone.filter(l => l.lv === 0 && l.sec !== 'goalM' && l.sec !== 'goalW').forEach(l => { if(!seen.has(l.n)){ seen.add(l.n); done.push({day:p.day, t:l.t}); } }); A.lines.filter(l => l.lv === 0 && d.st.get(l.id) === 'new' && !l.b.k).forEach(l => { if(!seen.has(l.n + 'a')){ seen.add(l.n + 'a'); add.push({day:p.day, t:l.t, id:l.id, pid:p.id}); } }); }
  });
  const last = days[days.length - 1], A = last && info(last), chk = A ? A.lines.filter(l => l.lv === 0 && !l.b.k && stOf(l.b, l.sec) === 'chk' && !['goalM', 'goalW', 'daily'].includes(l.sec)).map(l => ({day:last.day, t:l.t, id:l.id, pid:last.id})) : [];
  return {mon, done, add, chk};
}
function weekHtml(){
  const w = weekData(), box = (h, xs, none) => `<section class="wl-oc"><h4>${h} <small>${xs.length}</small></h4>${xs.map(x => `<button type="button" class="wl-ol" ${x.id ? `data-go="${x.id}" data-pid="${x.pid}"` : 'disabled'}><span>${E(x.t)}</span><em>${md(x.day)}</em></button>`).join('') || `<p class="wl-none">${none}</p>`}</section>`;
  return `<div class="wl-og three">${box('끝내거나 정리한 일', w.done, '아직 없어요')}${box('새로 시작한 일', w.add, '아직 없어요')}${box('확인이 필요한 일', w.chk, '없어요')}</div>`;
}
function weekText(){
  const w = weekData(), f = (h, xs) => `[${h}]\n` + (xs.map(x => `- ${x.t} (${md(x.day)})`).join('\n') || '- 없음');
  return `디자인팀 이번 주 (${md(w.mon)} ~ ${md(addD(w.mon, 4))})\n\n${f('끝내거나 정리한 일', w.done)}\n\n${f('새로 시작한 일', w.add)}\n\n${f('확인이 필요한 일', w.chk)}`;
}
/* ── 달력 ── */
function calHtml(){
  if(!S.month) S.month = S.today.slice(0, 7);
  const y = +S.month.slice(0, 4), m = +S.month.slice(5, 7), start = addD(`${S.month}-01`, -new Date(y, m - 1, 1).getDay()), by = new Map();
  list().forEach(x => { if(!by.has(x.day)) by.set(x.day, []); by.get(x.day).push(x); });
  const pins = [...S.board.values()].filter(b => b.kind === 'pin' && b.due && !b.done_at), due = dailies()[0] ? ordersOf(dailies()[0]).due : [];
  const ords = orders().filter(x => x.day >= start && x.day <= addD(start, 41));
  let c = '';
  for(let i = 0; i < 42; i++){
    const s = addD(start, i), out = s.slice(0, 7) !== S.month;
    if(i >= 35 && out && addD(start, 35).slice(0, 7) !== S.month) break;
    c += `<div class="wl-cd${out ? ' out' : ''}${s === S.today ? ' tod' : ''}${isOff(s) ? ' off' : ''}" data-cday="${s}"><b>${+s.slice(8)}</b>${(by.get(s) || []).map(x => `<button type="button" class="wl-ce" data-open="${x.id}">${E(x.title || '(제목 없음)')}${x.n ? `<small>${x.n}</small>` : ''}</button>`).join('')}${pins.filter(b => b.due === s).map(b => `<span class="wl-cp">📌 ${E(b.title)}</span>`).join('')}${due.filter(x => x.day === s).map(x => `<span class="wl-cp">${E(x.t)}</span>`).join('')}${ords.filter(x => x.day === s).map(x => `<button type="button" class="wl-co${arrDone(x) ? ' is-done' : ''}" data-open="${x.id}">${E(oTitle(x))}</button>`).join('')}</div>`;
  }
  return `<div class="wl-ob"><button type="button" class="wl-step" data-mon="-1" aria-label="지난달">‹</button><b class="wl-cm">${y}년 ${m}월</b><button type="button" class="wl-step" data-mon="1" aria-label="다음달">›</button></div><div class="wl-cal">${WK.map(w => `<em>${w}</em>`).join('')}${c}</div>`;
}
/* ── 찾기 ── */
let findT = 0, findGen = 0;
function findRun(q){
  clearTimeout(findT);
  q = String(q || '').trim();
  if(!q){ if(S.find){ S.find = null; renderMain(); } return; }
  findT = setTimeout(async () => {
    const g = ++findGen;
    S.find = {q, busy:true, rows:S.find && S.find.rows || []};
    renderMain();
    try{ const rows = await rpc('dlog_find', {p_q:q, p_limit:200}); if(g !== findGen) return; S.find = {q, rows:rows || []}; }
    catch(e){ if(g !== findGen) return; S.find = {q, rows:[], err:1}; }
    renderMain();
  }, 300);
}
function hl(t, q){ let h = E(t); q.split(/\s+/).filter(Boolean).forEach(w => { h = h.replace(new RegExp(E(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), x => `\u0001${x}\u0002`); }); return h.replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>'); }
function findHtml(){
  const f = S.find, n = f.rows.reduce((a, r) => a + (r.lines ? r.lines.length : 0), 0);
  let last = '';
  return `<div class="wl-ob"><b class="wl-cm">‘${E(f.q)}’</b><span class="wl-meta">${f.busy ? '찾는 중…' : f.err ? '찾지 못했어요 — 다시 해 주세요' : `${f.rows.length}개 글 · ${n}줄`}</span><span class="wl-sp"></span><button type="button" class="wl-btn sm" data-act="findoff">닫기</button></div>
    <div class="wl-fr">${f.rows.map(r => { const ls = (r.lines || []).map(t => { const same = t.trim() === last; last = t.trim(); return `<button type="button" class="wl-fl1${same ? ' same' : ''}" data-open="${r.id}" data-find="${E(t)}">${hl(t, f.q)}</button>`; }).join(''); return `<div class="wl-fg"><button type="button" class="wl-fd" data-open="${r.id}"><b>${md(r.day)}</b> ${WK[dow(r.day)]} <span>${E(r.title)}${r.kind === 'order' ? ' · 발주 샘플' : ''}</span></button><div>${ls || '<p class="wl-none">제목 · 여러 줄에 나뉘어 있어요</p>'}</div></div>`; }).join('') || (f.busy ? '' : '<p class="wl-none">없어요</p>')}</div>`;
}
function openPage(id, opt){
  if(!id || !S.pages.has(id)) return;
  opt = opt || {};
  flushSoon();
  const isO = S.pages.get(id).kind === 'order';
  S.cur = id; S.view = isO ? 'order' : 'page'; if(!isO) S.lastPage = id; S.sel = null; S.fTag = ''; S.fSt = ''; S.find = null; S.fresh.clear(); S.split.delete(id);
  if(isO) S.oMonth = S.pages.get(id).day.slice(0, 7); else S.month = S.pages.get(id).day.slice(0, 7);
  renderTop(); renderMain();
  const q = document.getElementById('wlQ'); if(q) q.value = '';
  if(opt.line) flash(opt.line);
  if(opt.find){ const t = opt.find.trim(); const go = () => { const p = cur(), b = p && p.blocks && p.blocks.find(x => bText(x).replace(/\n/g, ' ').trim() === t); if(b) flash(b.id); }; if(S.pages.get(id).blocks) go(); else setTimeout(go, 900); }
}
function flash(id){
  const p = cur(); if(!p || !p.blocks) return;
  // 접힌 줄 안에 있으면 화면에서만 펼친다
  const i = idx(p, id); if(i < 0) return;
  let lv = p.blocks[i].lv || 0, opened = false;
  for(let j = i - 1; j >= 0 && lv > 0; j--){ const b = p.blocks[j]; if(isHead(b)){ if(b.f){ delete b.f; opened = true; } break; } if((b.lv || 0) < lv){ lv = b.lv || 0; if(b.f){ delete b.f; opened = true; } } }
  if(opened) renderPage();
  const l = lineEl(id); if(!l) return;
  l.scrollIntoView({block:'center', behavior:'smooth'});
  l.classList.remove('is-flash'); void l.offsetWidth; l.classList.add('is-flash');
  setTimeout(() => l.classList.remove('is-flash'), 2200);
}
const flushSoon = () => { if(S.dirty.size) scheduleSave(30); };

/* ============================================================ 발주 · 샘플 (노션 '발주 & 샘플' 달력) ============================================================ */
const OKN = {po:'발주', in:'입고', sreq:'샘플 요청', sin:'샘플 입고', ship:'발송', etc:'기타'};
const OST = ['미입고', '파샬 입고', '국외발송완료', '국외입고완료', '국내입고완료', '입고 완료'];
const okAuto = t => /휴무|휴일|연휴/.test(t) ? 'etc' : /재샘플|(샘플|원단)\s*(요청|투입|발주|주문)/.test(t) ? 'sreq' : /샘플.*(입고|도착)/.test(t) ? 'sin' : /발송|출고/.test(t) ? 'ship' : /입고|도착/.test(t) ? 'in' : /발주|주문/.test(t) ? 'po' : 'etc';
const okOf = p => (p.meta && p.meta.ok) || okAuto(String(p.title || ''));
const oTitle = p => String(p.title || '').replace(/^\s*\d{4}\s+/, '').trim() || OKN[okOf(p)];
const oFac = p => (p.meta && p.meta.fac) || [];
const oSt = p => (p.meta && p.meta.st) || [];
const oLines = p => (p.blocks || []).filter(b => !isEmpty(b) && b.t !== 'hr' && !b.src).map(b => bText(b).replace(/\s+/g, ' ').trim());
const arrDone = p => { const s = oSt(p); return s.some(x => /입고\s*완료|파샬/.test(x)) || (okOf(p) === 'ship' && s.some(x => /발송\s*완료/.test(x))); };
const oWaits = p => oSt(p).includes('미입고') && !arrDone(p);
/* 전광판 — 앞으로 30일 안에 들어올 것 + 지난 10일 안에 왔어야 하는데 '미입고' 인 것 */
const upcoming = () => orders().filter(p => ['in', 'sin', 'ship'].includes(okOf(p)) && !arrDone(p) && ((p.day >= S.today && dayDiff(p.day, S.today) <= 30) || (p.day < S.today && dayDiff(S.today, p.day) <= 10 && oSt(p).includes('미입고')))).sort((a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title));
const facList = () => { const c = new Map(); orders().forEach(p => oFac(p).forEach(f => c.set(f, (c.get(f) || 0) + 1))); return [...c].sort((a, b) => (a[0] === '그외') - (b[0] === '그외') || b[1] - a[1]); };
function ordSet(p, patch){
  beforeEdit(p);
  p.meta = Object.assign({}, p.meta || {}, patch);
  Object.keys(p.meta).forEach(k => { const v = p.meta[k]; if(v === '' || v == null || (Array.isArray(v) && !v.length)) delete p.meta[k]; });
  touch(p);
}
function ordMove(p, day){          // 날짜 옮기기 — 제목 앞 MMDD 가 그 날짜였으면 같이 바꾼다
  if(!day || day === p.day) return;
  beforeEdit(p);
  const old = p.day.slice(5, 7) + p.day.slice(8), now = day.slice(5, 7) + day.slice(8), end = (p.meta || {}).end;
  if(String(p.title || '').startsWith(old)) p.title = now + p.title.slice(4);
  if(end) p.meta = Object.assign({}, p.meta, {end:addD(end, dayDiff(day, p.day))});
  p.day = day; touch(p);
}
function ordDone(id){
  const p = S.pages.get(id); if(!p) return;
  const was = clone(p.meta || {});
  ordSet(p, {st:['입고 완료']}); renderBoard(); if(S.view === 'order'){ renderOrd(); if(S.cur === id) renderPage(); }
  snack(`${md(p.day)} ${oTitle(p)} — 입고 완료`, () => { beforeEdit(p); p.meta = was; touch(p); renderBoard(); if(S.view === 'order'){ renderOrd(); if(S.cur === id) renderPage(); } });
}
function orderHtml(){ return '<div class="wl-ob" id="wlOb"></div><div class="wl-ow" id="wlOw"><div class="wl-om" id="wlOm"></div><aside class="wl-od"><div id="wlPage"></div></aside></div>'; }
function renderOrd(){
  const bar = document.getElementById('wlOb'), om = document.getElementById('wlOm'), ow = document.getElementById('wlOw'); if(!om) return;
  const c = cur(), sel = c && c.kind === 'order' ? c.id : '';
  ow.classList.toggle('has-d', !!sel);
  if(!S.oMonth) S.oMonth = S.today.slice(0, 7);
  const A = orders(), kinds = Object.keys(OKN).map(k => [k, A.filter(p => okOf(p) === k).length]).filter(x => x[1]), w = A.filter(oWaits).length;
  const L = A.filter(p => (!S.oFac || oFac(p).includes(S.oFac)) && (!S.oKind || okOf(p) === S.oKind) && (!S.oWait || oWaits(p)));
  const y = +S.oMonth.slice(0, 4), m = +S.oMonth.slice(5, 7);
  bar.innerHTML = `<div class="wl-seg"><button type="button" class="${S.oMode === 'cal' ? 'on' : ''}" data-omode="cal">달력</button><button type="button" class="${S.oMode === 'list' ? 'on' : ''}" data-omode="list">목록</button></div>
    ${S.oMode === 'cal' ? `<button type="button" class="wl-step" data-omon="-1" aria-label="지난달">‹</button><b class="wl-cm">${y}년 ${m}월</b><button type="button" class="wl-step" data-omon="1" aria-label="다음달">›</button>${S.oMonth !== S.today.slice(0, 7) ? '<button type="button" class="wl-btn sm" data-oact="now">이번 달</button>' : ''}` : `<span class="wl-meta">${L.length}건</span>`}
    <span class="wl-sp"></span><button type="button" class="wl-btn pri" data-oact="new">＋ 새 일정</button>
    <div class="wl-fl ord">${kinds.map(([k, n]) => `<button type="button" class="${S.oKind === k ? 'on' : ''}" data-okind="${k}">${OKN[k]} <b>${n}</b></button>`).join('')}<i></i>${facList().map(([f, n]) => `<button type="button" class="${S.oFac === f ? 'on' : ''}" data-ofac="${E(f)}">${E(f)} <b>${n}</b></button>`).join('')}<i></i><button type="button" class="${S.oWait ? 'on' : ''}" data-oact="wait">미입고만 <b>${w}</b></button></div>`;
  const late = p => ['in', 'sin', 'ship'].includes(okOf(p)) && p.day < S.today && oWaits(p) && dayDiff(S.today, p.day) <= 30;
  if(S.oMode === 'cal'){
    const start = addD(`${S.oMonth}-01`, -new Date(y, m - 1, 1).getDay());
    let h = '';
    for(let i = 0; i < 42; i++){
      const s = addD(start, i), out = s.slice(0, 7) !== S.oMonth;
      if(i >= 35 && out && addD(start, 35).slice(0, 7) !== S.oMonth) break;
      const xs = L.filter(p => p.day <= s && ((p.meta || {}).end || p.day) >= s).sort((a, b) => a.title.localeCompare(b.title));
      h += `<div class="wl-cd o${out ? ' out' : ''}${s === S.today ? ' tod' : ''}${isOff(s) ? ' off' : ''}" data-oday="${s}"><b>${+s.slice(8)}</b>${xs.map(p => { const ls = oLines(p); return `<button type="button" class="wl-oe${arrDone(p) ? ' is-done' : ''}${late(p) ? ' late' : ''}${p.id === sel ? ' on' : ''}" draggable="true" data-oid="${p.id}"><strong>${E(oTitle(p))}${oSt(p).length ? `<em>${E(oSt(p).join(' · '))}</em>` : ''}</strong>${oFac(p).length ? `<small>${E(oFac(p).join(' · '))}</small>` : ''}${ls.slice(0, 2).map(t => `<span>${E(t)}</span>`).join('')}${ls.length > 2 ? `<span>외 ${ls.length - 2}</span>` : ''}</button>`; }).join('')}</div>`;
    }
    om.innerHTML = `<div class="wl-cal">${WK.map(x => `<em>${x}</em>`).join('')}${h}</div>`;
  }else{
    let mo = '', h = '';
    L.forEach(p => {
      const k = p.day.slice(0, 7);
      if(k !== mo){ mo = k; h += `<tr class="mo"><td colspan="6">${k.slice(0, 4) === S.today.slice(0, 4) ? '' : k.slice(0, 4) + '년 '}${+k.slice(5)}월</td></tr>`; }
      const n = dayDiff(p.day, S.today), st = oSt(p), opts = [...new Set([...OST, ...st])];
      h += `<tr class="${arrDone(p) ? 'is-done' : ''}${late(p) ? ' late' : ''}${p.id === sel ? ' on' : ''}" data-oid="${p.id}"><td class="d">${md(p.day)}<small>${WK[dow(p.day)]}</small></td><td class="k">${OKN[okOf(p)]}</td><td class="t"><b>${E(oTitle(p))}</b>${oLines(p).map(t => `<span>${E(t)}</span>`).join('')}</td><td class="f">${E(oFac(p).join(', '))}</td><td class="s"><select data-om="lst" data-opid="${p.id}" aria-label="상태"><option value="">상태 없음</option>${opts.map(o => `<option value="${E(o)}"${st[st.length - 1] === o ? ' selected' : ''}>${E(o)}</option>`).join('')}</select></td><td class="a">${n === 0 ? '오늘' : n > 0 ? 'D-' + n : oWaits(p) ? `${-n}일` : ''}</td></tr>`;
    });
    om.innerHTML = h ? `<table class="wl-olt"><thead><tr><th>날짜</th><th>종류</th><th>내용</th><th>공장</th><th>상태</th><th></th></tr></thead><tbody>${h}</tbody></table>` : '<p class="wl-none">해당하는 일정이 없어요</p>';
  }
}
/* 오른쪽 상세 — 줄 고치기는 업무일지와 같은 편집기 */
function orderPage(p, c, vis){
  const ok = okOf(p), st = oSt(p), fac = oFac(p), facs = [...new Set([...facList().map(x => x[0]), ...fac])], chip = (k, v, t, on) => `<button type="button" class="${on ? 'on' : ''}" data-oset="${k}" data-v="${E(v)}">${E(t)}</button>`;
  return `<div class="wl-ph"><input class="wl-title" id="wlTitle" value="${E(p.title)}" maxlength="120" placeholder="제목 (예: 1126 입고예정)" aria-label="제목"><span class="wl-sp"></span><button type="button" class="wl-btn sm" data-act="undo" title="되돌리기 (Ctrl+Z)">되돌리기</button><button type="button" class="wl-btn sm" data-act="copy">복사</button><button type="button" class="wl-btn sm ico" data-act="pagemenu" aria-label="이 일정 메뉴">⋯</button><button type="button" class="wl-btn sm ico" data-oact="close" aria-label="닫기">×</button></div>
    <dl class="wl-of"><dt>날짜</dt><dd><input type="date" data-om="day" value="${p.day}" aria-label="날짜"><i>~</i><input type="date" data-om="end" value="${E((p.meta || {}).end || '')}" aria-label="끝나는 날 (없어도 돼요)"></dd>
      <dt>종류</dt><dd class="wl-chips sm">${Object.entries(OKN).map(([k, t]) => chip('ok', k, t, ok === k)).join('')}</dd>
      <dt>공장</dt><dd class="wl-chips sm">${facs.map(f => chip('fac', f, f, fac.includes(f))).join('')}<button type="button" data-oact="facadd" aria-label="공장 더하기">＋</button></dd>
      <dt>상태</dt><dd class="wl-chips sm">${[...new Set([...OST, ...st])].map(x => chip('st', x, x, st.includes(x))).join('')}</dd></dl>
    <div class="wl-cols">${vis.map(s => secHtml(s, c)).join('') || '<button type="button" class="wl-addsec" data-act="addfirst">＋ 상품 · 수량 적기</button>'}</div>
    <p class="wl-meta">${p.ub && p.ub !== 'notion' ? E(p.ub) + ' · ' : ''}${p.ua ? `${md(ymd(new Date(p.ua)))} ${hm(p.ua)} 수정` : ''}${p.origin === 'notion' ? ' · 노션에서 옮김' : ''}</p>`;
}
function openOrd(id){
  if(!S.pages.has(id)) return;
  flushSoon(); S.cur = id; S.sel = null; S.fresh.clear(); S.split.delete(id);
  renderOrd(); renderPage();
}
function ordField(t){
  const k = t.dataset.om;
  if(k === 'lst'){ const p = S.pages.get(t.dataset.opid); if(!p) return; ordSet(p, {st:t.value ? [t.value] : []}); renderBoard(); if(S.cur === p.id) renderPage(); t.blur(); renderOrd(); return; }
  const p = cur(); if(!p || p.kind !== 'order') return;
  if(k === 'day' && t.value){ ordMove(p, t.value); S.oMonth = p.day.slice(0, 7); const i = document.getElementById('wlTitle'); if(i) i.value = p.title; }
  if(k === 'end') ordSet(p, {end:t.value && t.value > p.day ? t.value : ''});
  renderOrd(); renderBoard();
}
function newOrder(at, day){
  const facs = facList().map(x => x[0]);
  pop(at, `<label>날짜<input type="date" data-k="day" value="${day || S.today}"></label><div class="wl-pl">종류</div><div class="wl-chips sm" data-f="ok">${Object.entries(OKN).map(([k, t]) => `<button type="button" data-v="${k}" class="${k === 'in' ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="wl-pl">공장</div><div class="wl-chips sm" data-f="fac">${facs.map(f => `<button type="button" data-v="${E(f)}">${E(f)}</button>`).join('')}</div><input type="text" data-k="fac" maxlength="40" placeholder="새 공장이면 적기"><div class="wl-pf"><span class="wl-sp"></span><button type="button" class="wl-btn" data-x="no">닫기</button><button type="button" class="wl-btn pri" data-x="ok">만들기</button></div>`, 'form', (e, box, close) => {
    const c = e.target.closest('.wl-chips button');
    if(c){ if(c.parentNode.dataset.f === 'ok') $$('button', c.parentNode).forEach(b => b.classList.toggle('on', b === c)); else c.classList.toggle('on'); return; }
    const x = e.target.closest('[data-x]'); if(!x) return;
    if(x.dataset.x === 'no') return close();
    const d = $('[data-k="day"]', box).value || S.today, ok = ($('[data-f="ok"] .on', box) || {dataset:{v:'in'}}).dataset.v, nf = $('[data-k="fac"]', box).value.trim(), fac = [...new Set([...$$('[data-f="fac"] .on', box).map(b => b.dataset.v), ...(nf ? [nf] : [])])];
    close();
    const name = {po:'발주', in:'입고예정', sreq:'샘플요청', sin:'샘플입고예정', ship:'발송예정', etc:''}[ok], title = `${d.slice(5, 7)}${d.slice(8)} ${name}`.trim(), b = nb(), meta = {ok};
    if(fac.length) meta.fac = fac;
    if(['po', 'in', 'sin'].includes(ok)) meta.st = ['미입고'];
    const p = {id:uuid(), day:d, title, kind:'order', meta, blocks:[b], ver:0, _bv:0, n:0, nd:0, origin:'office', ca:new Date().toISOString(), ua:new Date().toISOString(), ub:me()};
    S.pages.set(p.id, p); S.dirty.set(p.id, {base:0, bb:[], bm:{title, day:d, kind:'order', meta:clone(meta)}, seq:1, isNew:true});
    persistDirty(); saveTag('saving'); scheduleSave(60);
    S.oMonth = d.slice(0, 7); S.cur = p.id; S.fresh.clear(); S.fresh.add(b.id);
    renderOrd(); renderPage(); renderBoard(); focusB(b.id);
  });
}
function onOrdClick(e){
  const t = e.target, q = s => t.closest(s);
  let a;
  if((a = q('[data-omode]'))){ S.oMode = a.dataset.omode; saveUi(); renderOrd(); return true; }
  if((a = q('[data-omon]'))){ S.oMonth = ymd(new Date(+S.oMonth.slice(0, 4), +S.oMonth.slice(5, 7) - 1 + +a.dataset.omon, 1)).slice(0, 7); renderOrd(); return true; }
  if((a = q('[data-okind]'))){ S.oKind = S.oKind === a.dataset.okind ? '' : a.dataset.okind; renderOrd(); return true; }
  if((a = q('[data-ofac]'))){ S.oFac = S.oFac === a.dataset.ofac ? '' : a.dataset.ofac; renderOrd(); return true; }
  if((a = q('[data-oset]'))){
    const p = cur(); if(!p) return true;
    const k = a.dataset.oset, v = a.dataset.v;
    if(k === 'ok') ordSet(p, {ok:v});
    if(k === 'st') ordSet(p, {st:oSt(p).includes(v) ? oSt(p).filter(x => x !== v) : [v]});
    if(k === 'fac') ordSet(p, {fac:oFac(p).includes(v) ? oFac(p).filter(x => x !== v) : [...oFac(p), v]});
    renderPage(); renderOrd(); renderBoard(); return true;
  }
  if((a = q('[data-oact]'))){
    const k = a.dataset.oact;
    if(k === 'wait'){ S.oWait = !S.oWait; renderOrd(); }
    if(k === 'now'){ S.oMonth = S.today.slice(0, 7); renderOrd(); }
    if(k === 'new') newOrder(a, S.oMonth === S.today.slice(0, 7) ? S.today : S.oMonth + '-01');
    if(k === 'close'){ flushSoon(); S.cur = null; const pg = document.getElementById('wlPage'); if(pg) pg.innerHTML = ''; renderOrd(); }
    if(k === 'facadd'){ const v = (prompt('공장 · 업체 이름') || '').trim().slice(0, 40), p = cur(); if(v && p){ ordSet(p, {fac:[...new Set([...oFac(p), v])]}); renderPage(); renderOrd(); } }
    return true;
  }
  if((a = q('[data-oid]'))){ if(!q('select')) openOrd(a.dataset.oid); return true; }
  if((a = q('[data-oday]'))){ newOrder(a, a.dataset.oday); return true; }
  return false;
}

/* ============================================================ 입고 · 발송 자동 확인 ============================================================
   업무일지의 발주 줄([업체] MMDD_상품 200ea)을 콰이디에어 발주(맥미니 /erp/po-match)와 재고 ERP 코페리(erp_rows 발주일 칸)에 맞춰 지금 어디까지 왔는지 적는다.
   읽기만 — 재고 · 발주일은 절대 건드리지 않는다 (자동 입고 금지, 2026-11-23 사장님) */
const inb = {at:0, busy:null, err:'', po:null, rows:null};
const INB_P = [['2way', /투웨이|2\s*-?\s*way|2\s*웨이/], ['puppy', /퍼피|퍼퍼|puppy/], ['cordu', /코듀|cordu/], ['dot', /도트|dot/], ['firstq', /퍼스트\s*큐|퍼큐|first[\s-]*q/], ['cobal', /코발트니|코발티니|cobaltin/], ['bunny', /버니|bunny/], ['mori', /모리|mori/], ['you', /\byou\b|y\.\s*o\.\s*u/], ['strap', /스트랩|strap/], ['belt', /벨트|belt/], ['keyring', /키링|key\s*ring/], ['dump', /덤핑|dumping/], ['mush', /머쉬|mush/], ['luna', /루나|luna/], ['star', /스타|star/], ['backpack', /백팩|backpack/], ['nylon', /나일론|nylon/], ['shirring', /셔링|shirring/], ['vinta', /빈타|vinta/], ['buk', /버클리|buk?ley|buckl/], ['hobo', /보부|호보|hobo/], ['pouch', /파우치|pouch/], ['beanie', /비니|beanie/], ['cushion', /쿠션|cushion/], ['leopard', /호피|leopard/], ['air', /에어|air\b/], ['ribbon', /리본|ribbon/]];
const INB_C = [['black', /블랙|black|\(b\)|\(bl\)/], ['white', /화이트|white|\(w\)/], ['brown', /브라운|brown|\(br\)/], ['gray', /그레이|gr[ae]y/], ['charcoal', /차콜|charcoal/], ['beige', /베이지|beige/], ['ivory', /아이보리|ivory/], ['mint', /민트|mint/], ['lime', /라임|lime/], ['silver', /실버|silver/], ['teal', /틸|팁\s*블루|teal/], ['blue', /블루|blue/], ['olive', /올리브|olive/], ['green', /그린|green/], ['red', /레드|\bred\b/], ['pink', /핑크|pink/], ['navy', /네이비|navy/], ['matte', /무광/], ['gloss', /유광/]];
const inbKey = s => { const t = String(s || '').toLowerCase(), f = L => new Set(L.filter(x => x[1].test(t)).map(x => x[0])); return {p:f(INB_P), c:f(INB_C)}; };
const setEq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
async function inbLoad(force){
  if(inb.busy) return inb.busy;
  if(!force && inb.po && Date.now() - inb.at < 5 * 60000) return true;
  inb.busy = (async () => {
    try{
      const base = await loadProxyBase(); if(!base) throw new Error('서버에 연결하지 못했어요');
      const r = await fetch(`${base}/erp/po-match?cb=${Date.now()}`, {headers:{'X-Brightbeed-PIN':ghPin()}, cache:'no-cache'}), j = r.ok ? await r.json() : null;
      if(!j || !Array.isArray(j.items)) throw new Error('콰이디에어 자료를 못 받았어요');
      const gid = j.brands && j.brands.kop && j.brands.kop.gid; if(!gid) throw new Error('ERP 탭을 못 찾았어요');
      const q = await fetch(`${SUPABASE_URL}/rest/v1/erp_rows?select=r,v&gid=eq.${encodeURIComponent(gid)}&deleted_at=is.null&order=r.asc&limit=1000`, {headers:_sbHeaders(), cache:'no-cache'}), rows = q.ok ? await q.json() : null;
      if(!Array.isArray(rows) || rows.length < 10) throw new Error('ERP 를 못 읽었어요');
      inb.po = j.items.filter(x => x.b === 'kop'); inb.kd = j.fetchedAt || 0;
      inb.rows = rows.filter(x => Array.isArray(x.v) && String(x.v[1] || '').trim() && !/B\s*급|^지난|중복/.test(`${x.v[0] || ''} ${x.v[1]}`)).map(x => ({r:x.r, name:String(x.v[1]).trim(), opt:String(x.v[2] || '').trim(), l:x.v[11], n:String(x.v[13] || ''), k:inbKey(`${x.v[1]} ${x.v[2] || ''}`)}));
      inb.at = Date.now(); inb.err = ''; inb.memo = new Map();
      return true;
    }catch(e){ inb.err = String(e && e.message || e); return false; }
    finally{ inb.busy = null; }
  })();
  return inb.busy;
}
const inbShip = m => { const s = String(m || ''), a = [...s.matchAll(/(LCL|FCL|항공우편|항공|해운|우체국|준광(?:사업자)?|특송)?\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(LCL|준광(?:사업자)?|항공|우체국)?/gi)].pop(); return a ? `${a[2]}/${a[3]}${a[1] || a[4] ? ' ' + (a[1] || a[4]).toUpperCase() : ''}` : ''; };
/* 발주 줄 하나 → {t 적을 말, k: in 들어옴 · ship 출고 · wh 창고 · make 제작 · ask 확인} */
function inbOf(o){
  if(!inb.rows) return null;
  const key = `${o.day}|${o.name}`;
  if(inb.memo.has(key)) return inb.memo.get(key);
  const k = inbKey(o.name); let best = null, bs = 0;
  if(k.p.size) inb.rows.forEach(x => {
    if(![...k.p].every(v => x.k.p.has(v))) return;
    const hit = [...k.c].filter(v => x.k.c.has(v)).length, miss = [...k.c].length - hit;
    if(k.c.size && !hit) return;
    const s = 10 - (x.k.p.size - k.p.size) * 3 + hit * 2 - miss * 2 - (x.k.c.size - hit) * .7;
    if(s > bs){ bs = s; best = x; }
  });
  let out;
  if(!best || bs < 8) out = {k:'ask', t:'ERP 에서 못 찾음'};
  else{
    const kd = inb.po.filter(i => i.row === best.r && o.day && dayDiff(i.date, o.day) >= -12 && dayDiff(i.date, o.day) <= 20).sort((a, b) => Math.abs(dayDiff(a.date, o.day)) - Math.abs(dayDiff(b.date, o.day)))[0];
    const recv = kd && kd.recv && kd.recv.done ? kd.recv.at : '';
    const nd = (best.n.match(/(20\d\d)[.\-](\d{1,2})[.\-](\d{1,2})/g) || []).map(x => x.replace(/\./g, '-').split('-').map((v, i) => i ? v.padStart(2, '0') : v).join('-')).find(x => o.day && Math.abs(dayDiff(x, o.day)) <= 20);
    if(recv) out = {k:'in', t:`들어옴 ${md(ymd(new Date(recv)))}`};
    else if(kd && kd.state === 'received') out = {k:'in', t:'들어옴'};
    else if(kd && kd.status === '취소') out = {k:'ask', t:'콰이디 취소'};
    else if(kd && /출고/.test(kd.status)) out = {k:'ship', t:`중국 출고 ${inbShip(kd.memo)}`.trim()};
    else if(kd && kd.status === '전체입고') out = {k:'wh', t:'중국 창고 도착 · 출고 전'};
    else if(kd && kd.status === '부분입고') out = {k:'wh', t:'중국 창고 일부 도착'};
    else if(kd) out = {k:'make', t:'제작 중'};
    else if(nd) out = {k:'make', t:`아직 안 들어옴 (ERP 발주 ${md(nd)})`};
    else out = {k:'ask', t:'ERP 발주일 없음 — 들어왔는지 확인'};
    out.row = best;
  }
  inb.memo.set(key, out);
  return out;
}
/* 자동 체크 루틴 (rule.auto = 'in') — 오늘 할 날이고 아직 체크 기록이 없으면, 자료를 다 읽은 뒤 체크한다. 사람이 푼 날은 다시 안 건드림 */
async function autoRoutines(){
  const todo = routines().filter(it => (it.rule || {}).auto === 'in').map(it => [it, state(it)]).filter(([it, s]) => s.on && s.day && !S.checks.has(ckKey(it.id, s.day)));
  if(!todo.length) return;
  if(!await inbLoad(false)) return;
  for(const [it, s] of todo){ try{ const j = await rpc('dlog_check', {p_item:it.id, p_day:s.day, p_on:true, p_who:'자동 확인'}); if(j && j.check) S.checks.set(ckKey(it.id, s.day), j.check); }catch(e){} }
}
async function inbTick(force){
  const ok = await inbLoad(force);
  if(ok) await autoRoutines();
  if(S.ptr || editing()){ S.boardDefer = true; return; }
  renderBoard(); if(S.view === 'page' && !S.find) renderSide();
}
function inbSum(){
  const p = dailies()[0]; if(!p || !p.blocks || !inb.rows) return '';
  const os = ordersOf(p).orders.filter(o => !o.done); if(!os.length) return '기다리는 발주 없음';
  const c = {}; os.forEach(o => { const x = inbOf(o); if(x) c[x.k] = (c[x.k] || 0) + 1; });
  return [`${os.length}건 확인`, c.in && `들어옴 ${c.in}`, c.ship && `출고 ${c.ship}`, c.wh && `중국 창고 ${c.wh}`, c.make && `아직 ${c.make}`, c.ask && `볼 것 ${c.ask}`].filter(Boolean).join(' · ');
}

/* ============================================================ 전광판 ============================================================ */
/* 오늘 업무 — 전광판 맨 앞 (2026-11-23 사장님 "오늘 업무가 제일 중요해. 그걸 먼저 보여줘") */
const SIDE_SEC = ['goalM', 'goalW', 'daily', 'tomorrow', 'hold'];
function todayItems(p){
  const out = [];
  secOrder(p, sections(p.blocks)).filter(x => !SIDE_SEC.includes(x.type)).forEach(x => {
    const its = x.items.filter(b => !isEmpty(b) && !b.src), base = Math.min(...its.map(b => b.lv || 0), 9);
    its.filter(b => (b.lv || 0) === base).forEach(b => out.push({b, head:x.head ? bText(x.head) : '', type:x.type}));
  });
  return out;
}
const todayPage = () => dailies().find(x => x.day <= S.today && x.blocks) || null;
const todayLeft = () => { const p = todayPage(); return p && p.day === S.today ? todayItems(p).filter(x => !x.b.k).length : 0; };
function todayWork(){
  const p = todayPage(); if(!p) return '';
  const is = p.day === S.today, all = todayItems(p), left = all.filter(x => !x.b.k), done = all.filter(x => x.b.k), shown = S.twAll ? left.concat(done) : left.slice(0, 12), age = ageMap(p);
  let h = '', last = null;
  shown.forEach(x => {
    if(x.head !== last && !x.b.k){ last = x.head; if(x.head) h += `<h5>${E(x.head)}</h5>`; }
    const st = stOf(x.b, x.type), d0 = age.get(x.b.id), dd = d0 && !x.b.k ? dayDiff(p.day, d0) : 0;
    h += `<div class="wl-r wk${x.b.k ? ' done' : ''}"><button type="button" class="wl-ck" data-bact="wdone" data-pid="${p.id}" data-lid="${x.b.id}" aria-pressed="${!!x.b.k}" aria-label="끝냄" title="끝났으면 누르기"></button><button type="button" class="wl-rt" data-go="${x.b.id}" data-pid="${p.id}"><span>${E(bText(x.b))}</span></button><span class="wl-rm">${[dd >= 13 ? `<b class="bad">${dd + 1}일째</b>` : '', st && st !== 'done' ? (st === 'chk' ? `<b>${STS[st]}</b>` : STS[st]) : ''].filter(Boolean).join(' ')}</span></div>`;
  });
  const more = left.length + done.length - shown.length;
  return `<section class="wl-tw"><h4>${is ? '오늘 업무' : `${md(p.day)} 업무일지에서 남은 일`} <small>${is ? `${done.length}/${all.length}` : left.length}</small></h4>${!is && !isOff(S.today) ? '<button type="button" class="wl-go" data-bact="wstart">오늘 업무일지 시작 — 남은 일 이어받기</button>' : ''}${h || '<p class="wl-bz">적힌 일이 없어요</p>'}${more > 0 || S.twAll ? `<button type="button" class="wl-off1" data-bact="wmore">${S.twAll ? '접기' : `외 ${more}개${done.length ? ` (끝낸 일 ${done.length})` : ''} 더 보기`}</button>` : ''}${is ? `<form class="wl-ba" data-add="today"><input type="text" maxlength="300" placeholder="＋ 오늘 할 일 — 적고 Enter" aria-label="오늘 할 일 더하기"></form>` : ''}</section>`;
}
function doneIn(p, id){
  const i = idx(p, id); if(i < 0) return;
  beforeEdit(p); if(S.cur === p.id) mark(p);
  const bs = p.blocks, on = !bs[i].k, z = subEnd(bs, i);
  for(let j = i; j < z; j++){ if(on) bs[j].k = 1; else delete bs[j].k; if(bs[j].st === 'done') delete bs[j].st; }
  touch(p); renderBoard(); if(S.cur === p.id && S.view === 'page' && !S.find) renderPage();
}
function addToday(t){
  const p = todayPage(); if(!p || p.day !== S.today) return;
  beforeEdit(p); if(S.cur === p.id) mark(p);
  const bs = p.blocks, n = nb({r:T(t)}); let h = bs.findIndex(b => isHead(b) && secType(b) === 'today');
  if(h < 0){ bs.unshift(nb({t:'h3', r:T('오늘 할 일')}), n); if(bs[2] && !isHead(bs[2]) && bs[2].t !== 'hr') bs.splice(2, 0, nb({t:'hr'})); }
  else{ let z = h + 1; while(z < bs.length && !isHead(bs[z]) && bs[z].t !== 'hr') z++; while(z > h + 1 && isEmpty(bs[z - 1])) bs.splice(--z, 1); bs.splice(z, 0, n); }
  S.split.delete(p.id); touch(p); renderBoard(); if(S.cur === p.id && S.view === 'page' && !S.find) renderPage();
}
const routines = () => [...S.board.values()].filter(b => b.kind === 'routine').sort((a, b) => (b.hot - a.hot) || a.sort - b.sort);
const pins = () => [...S.board.values()].filter(b => b.kind === 'pin' && !b.done_at).sort((a, b) => (b.hot - a.hot) || (a.due || '9999').localeCompare(b.due || '9999') || a.sort - b.sort);
const nextWork = s => { let d = s; for(let i = 0; i < 14 && isOff(d); i++) d = addD(d, 1); return d; };
const prevWork = s => { let d = s; for(let i = 0; i < 14 && isOff(d); i++) d = addD(d, -1); return d; };
function isDue(it, day){         // 이 날이 이 루틴의 날인가 (쉬는 날이면 옮긴 날)
  const r = it.rule || {}; let ok = false;
  if(r.t === 'day') return r.we ? true : !isOff(day);
  for(let k = 0; k <= 6 && !ok; k++){          // 쉬는 날에 걸린 요일 루틴은 다음 일하는 날로
    const d0 = addD(day, -k);
    if(k && !isOff(d0)) break;
    if(r.t === 'week' && (r.wd || []).includes(dow(d0)) && (k === 0 ? !isOff(day) || r.we : nextWork(d0) === day)) ok = true;
    if(r.t === 'date' && r.d === d0 && (k === 0 || nextWork(d0) === day)) ok = true;
  }
  if(r.t === 'month'){
    const y = +day.slice(0, 4), m = +day.slice(5, 7), last = new Date(y, m, 0).getDate();
    ok = (r.dm || []).some(x => { const n = x === 'L' ? last : Math.min(+x, last); return prevWork(`${day.slice(0, 8)}${String(n).padStart(2, '0')}`) === day; });
  }
  return ok;
}
function lastDue(it, day){ const from = it.start_on || '2000-01-01'; for(let k = 0; k < 45; k++){ const d = addD(day, -k); if(d < from) return null; if(isDue(it, d)) return d; } return null; }
function nextDue(it, day){ for(let k = 1; k < 45; k++){ const d = addD(day, k); if(isDue(it, d)) return d; } return null; }
const checked = (it, d) => { const c = S.checks.get(ckKey(it.id, d)); return !!(c && c.done); };
function state(it){
  const d = lastDue(it, S.today);
  if(d === S.today) return {on:true, day:d, done:checked(it, d)};
  if(d && (it.rule || {}).t !== 'day' && !checked(it, d)) return {on:true, day:d, done:false, late:dayDiff(S.today, d)};
  return {on:false, next:nextDue(it, S.today), last:d};
}
const ruleText = r => { r = r || {}; if(r.t === 'day') return r.we ? '매일' : '평일 매일'; if(r.t === 'week') return (r.wd || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(x => WK[x]).join('·') + '요일'; if(r.t === 'month') return '매월 ' + (r.dm || []).map(x => x === 'L' ? '말일' : x + '일').join(' · '); if(r.t === 'date') return r.d ? `${md(r.d)} 한 번` : '한 번'; return ''; };
const dots = it => { const a = []; let d = addD(S.today, -1); for(let k = 0; k < 60 && a.length < 5; k++){ if(d < (it.start_on || '')) break; if(isDue(it, d)) a.unshift(checked(it, d)); d = addD(d, -1); } return a.length ? `<span class="wl-ds" title="지난 ${a.length}번 — ● 했음 ○ 안 함">${a.map(x => `<i class="${x ? 'on' : ''}"></i>`).join('')}</span>` : ''; };
const dday = s => { const n = dayDiff(s, S.today); return n === 0 ? '<b class="dd now">오늘</b>' : n > 0 ? `<b class="dd${n <= 3 ? ' near' : ''}">D-${n}</b>` : `<b class="dd bad">${-n}일 지남</b>`; };
function leftToday(){ return routines().map(it => [it, state(it)]).filter(([, s]) => s.on && !s.done); }
const autoBy = (it, s) => { const c = S.checks.get(ckKey(it.id, s.day)); return c && c.done && c.who === '자동 확인' ? c.at : ''; };
function renderBoard(){
  const el = document.getElementById('wlBoard'); if(!el) return;
  const ae = document.activeElement;
  if((ae && ae.tagName === 'INPUT' && el.contains(ae) && ae.value) || (S.ptr && el.matches(':hover'))){ S.boardDefer = true; return; }
  if(!S.ready && !S.board.size && !S.pages.size){ el.hidden = true; return; }
  el.hidden = false;
  const rs = routines().map(it => [it, state(it)]), on = rs.filter(([, s]) => s.on), off = rs.filter(([, s]) => !s.on), done = on.filter(([, s]) => s.done).length, left = on.length - done;
  const late17 = new Date().getHours() >= 17;
  const ps = pins(), tw = todayWork(), tp = todayPage(), wl = todayLeft();
  const ctl = id => `<span class="wl-bc"><button type="button" data-bact="edit" data-bid="${id}" title="고치기" aria-label="고치기">✎</button><button type="button" data-bact="del" data-bid="${id}" title="지우기" aria-label="지우기">×</button></span>`;
  const rRow = ([it, s]) => `<div class="wl-r${s.done ? ' done' : ''}${s.late || (!s.done && late17) ? ' late' : ''}${it.hot ? ' hot' : ''}" data-bid="${it.id}" draggable="true"><button type="button" class="wl-ck" data-bact="check" data-bid="${it.id}" data-day="${s.day}" aria-pressed="${s.done}" aria-label="${E(it.title)} 체크"></button><button type="button" class="wl-rt" data-bact="edit" data-bid="${it.id}"><span>${E(it.title)}</span>${(it.rule || {}).auto === 'in' ? `<small>${E(inb.rows ? inbSum() : inb.err ? '콰이디에어 · ERP 를 못 읽었어요 — ' + inb.err : '콰이디에어 · ERP 확인 중…')}</small>` : ''}${it.memo ? `<small>${E(it.memo)}</small>` : ''}</button><span class="wl-rm">${s.done && autoBy(it, s) ? `자동 확인 ${hm(autoBy(it, s))}` : s.late ? `<b class="bad">${md(s.day)}(${WK[dow(s.day)]}) 것 밀림</b>` : E([it.slot, (it.rule || {}).t === 'day' ? '' : ruleText(it.rule)].filter(Boolean).join(' · '))}</span>${dots(it)}${ctl(it.id)}</div>`;
  const pRow = it => `<div class="wl-r pin${it.hot ? ' hot' : ''}" data-bid="${it.id}" draggable="true"><button type="button" class="wl-ck" data-bact="pindone" data-bid="${it.id}" aria-label="${E(it.title)} 끝냄" title="끝났으면 누르기"></button><button type="button" class="wl-rt" data-bact="${it.link && it.link.page ? 'golink' : 'edit'}" data-bid="${it.id}"><span>${E(it.title)}</span>${it.memo ? `<small>${E(it.memo)}</small>` : ''}</button><span class="wl-rm">${it.due ? dday(it.due) + ' ' + md(it.due) : ''}</span>${ctl(it.id)}</div>`;
  const add = (k, ph) => `<form class="wl-ba" data-add="${k}"><input type="text" maxlength="200" placeholder="${ph}" aria-label="${ph}"></form>`;
  el.className = 'wl-board' + (S.boardFold ? ' is-fold' : '');
  el.innerHTML = `<div class="wl-bh"><b>전광판</b><span class="wl-bd">${+S.today.slice(5, 7)}월 ${+S.today.slice(8)}일 ${WK[dow(S.today)]}요일</span><span class="wl-bn${left || wl ? '' : ' ok'}">${wl ? `오늘 업무 <b>${wl}</b>` : tp && tp.day === S.today ? '오늘 업무 끝' : ''}${left ? `${wl ? ' · ' : ' '}루틴 <b>${left}</b>` : ''}${left || wl ? ' 남음' : ''}</span><span class="wl-sp"></span><button type="button" class="wl-bb" data-bact="tolog">업무일지로 ↓</button><button type="button" class="wl-bb" data-bact="tolst">라인시트로 ↓</button><button type="button" class="wl-bb" data-bact="fold">${S.boardFold ? '펼치기' : '접기'}</button></div>
    <div class="wl-bg">${tw}<section><h4>오늘 루틴 <small>${done}/${on.length}</small></h4>${on.map(rRow).join('') || '<p class="wl-bz">오늘 챙길 루틴이 없어요</p>'}${off.length ? `<details class="wl-off"${S.offOpen ? ' open' : ''}><summary>다른 날 루틴 ${off.length}</summary>${off.map(([it, s]) => `<div class="wl-r dim" data-bid="${it.id}"><button type="button" class="wl-rt" data-bact="edit" data-bid="${it.id}"><span>${E(it.title)}</span></button><span class="wl-rm">${E(ruleText(it.rule))}${s.next ? ` · 다음 ${md(s.next)}(${WK[dow(s.next)]})` : ''}</span>${ctl(it.id)}</div>`).join('')}</details>` : ''}${add('routine', '＋ 루틴 — 적고 Enter')}</section>
      <section><h4>꼭 챙길 것 <small>${ps.length || ''}</small></h4>${ps.map(pRow).join('') || '<p class="wl-bz">업무일지 줄 메뉴(⠿)에서 ‘전광판에 올리기’ 를 누르거나 아래에 적어요</p>'}${add('pin', '＋ 고정할 것 — 적고 Enter')}</section></div>`;
  renderStrip(); badge(left);
}
/* 아래로 내리면 맨 위에 붙는 한 줄 */
function renderStrip(){
  let el = document.getElementById('wlStrip');
  const host = document.getElementById('viewDesign');
  if(!host) return;
  if(!el){ el = document.createElement('div'); el.id = 'wlStrip'; el.className = 'wl-strip'; el.hidden = true; host.appendChild(el); el.addEventListener('click', onBoardClick); }
  const lt = leftToday(), ps = pins().filter(p => p.hot || (p.due && dayDiff(p.due, S.today) <= 3)).slice(0, 4);
  const wn = todayLeft(), tp = todayPage(), wt = wn ? `오늘 업무 ${wn}` : tp && tp.day === S.today ? '오늘 업무 끝' : '';
  el.innerHTML = `<div><b>${[wt, lt.length ? `루틴 ${lt.length}` : wt ? '' : '오늘 루틴 다 했어요'].filter(Boolean).join(' · ')}</b><span class="wl-sx">${lt.map(([it, s]) => `<button type="button" class="wl-s1" data-bact="check" data-bid="${it.id}" data-day="${s.day}" title="했으면 누르기"><i></i>${E(it.title)}</button>`).join('')}${ps.map(p => `<span class="wl-s2">📌 ${E(p.title)} ${p.due ? dday(p.due) : ''}</span>`).join('')}</span><button type="button" class="wl-bb" data-bact="tolog">업무일지로</button><button type="button" class="wl-bb" data-bact="totop">전광판</button></div>`;
  stripSync();
}
function stripSync(){
  const el = document.getElementById('wlStrip'), bd = document.getElementById('wlBoard'), v = document.getElementById('viewDesign');
  if(!el || !bd || !v) return;
  const tb = $('.topbar'), top = tb ? tb.offsetHeight : 0;
  const tplOpen = document.documentElement.classList.contains('tpl-ed-open');
  const show = !v.hidden && !bd.hidden && !tplOpen && bd.getBoundingClientRect().bottom < top + 6;
  if(el.hidden === show){ el.hidden = !show; }
  const vr = v.getBoundingClientRect();
  el.style.top = top + 'px'; el.style.left = vr.left + 'px'; el.style.width = vr.width + 'px';
  v.style.setProperty('--wlb', show ? el.offsetHeight + 'px' : '0px');
  v.style.setProperty('--tb', top + 'px');
}
function badge(n){
  try{
    const b = document.getElementById('designBtn');
    // 2026-11-23 사장님 "디자인팀탭에 오늘 루틴 2 안뜨게해줘" — 홈 '디자인팀' 카드 배지는 안 붙인다(남아 있으면 지움)
    if(b){ const x = b.querySelector('.wl-home'); if(x) x.remove(); }
  }catch(e){}
}
async function boardSave(id, patch, quiet){
  const o = S.board.get(id), old = o ? clone(o) : null;
  const opt = Object.assign({id, kind:'pin', title:'', memo:'', rule:{t:'day'}, slot:'', due:null, hot:false, sort:Date.now() / 1000, start_on:S.today, ver:0}, o || {}, patch);
  if('done' in patch){ opt.done_at = patch.done ? new Date().toISOString() : null; }
  if(patch.due === '') opt.due = null;
  S.board.set(id, opt); renderBoard();
  try{ const j = await rpc('dlog_board_save', {p_id:id, p_patch:patch, p_who:me()}); if(j && j.item){ S.board.set(id, j.item); renderBoard(); cacheWrite(); } return true; }
  catch(e){ if(old) S.board.set(id, old); else S.board.delete(id); renderBoard(); say('저장하지 못했어요 — 인터넷을 확인해 주세요', 'err'); return false; }
}
async function boardCheck(id, day, on){
  const k = ckKey(id, day), old = S.checks.get(k);
  S.checks.set(k, {item:id, day, done:on, who:me(), at:new Date().toISOString(), ver:old ? old.ver : 0}); renderBoard();
  try{ const j = await rpc('dlog_check', {p_item:id, p_day:day, p_on:on, p_who:me()}); if(j && j.check) S.checks.set(k, j.check); cacheWrite(); }
  catch(e){ if(old) S.checks.set(k, old); else S.checks.delete(k); renderBoard(); say('체크를 저장하지 못했어요 — 다시 눌러 주세요', 'err'); }
}
async function boardDel(id){
  const it = S.board.get(id); if(!it) return;
  S.board.delete(id); renderBoard();
  try{ await rpc('dlog_del', {p_kind:'board', p_id:id, p_on:true, p_who:me()}); }
  catch(e){ S.board.set(id, it); renderBoard(); say('지우지 못했어요', 'err'); return; }
  snack(`‘${it.title}’ 지웠어요`, async () => { S.board.set(id, it); renderBoard(); try{ await rpc('dlog_del', {p_kind:'board', p_id:id, p_on:false, p_who:me()}); }catch(e){ say('되살리지 못했어요', 'err'); } });
}
function pinLine(b, p){
  const t = bText(b).replace(/\s+/g, ' ').trim(); if(!t) return;
  const dm = t.match(/(?:^|[^\d])(\d{2})(\d{2})\s*(?:입고|도착|발송|출고|회신|미팅)?\s*예정/); let due = '';
  if(dm && mmdd(dm[1] + dm[2])) due = `${p.day.slice(0, 4)}-${dm[1]}-${dm[2]}`;
  const id = uuid();
  boardSave(id, {kind:'pin', title:t.slice(0, 200), due, link:{page:p.id, line:b.o || b.id}, sort:Date.now() / 1000}).then(ok => { if(ok) snack('전광판에 올렸어요', () => boardDel(id)); });
}
/* 루틴 · 고정 고치기 창 */
function boardEdit(id, at){
  const it = S.board.get(id); if(!it) return;
  const r = Object.assign({t:'day'}, it.rule || {}), isR = it.kind === 'routine';
  const body = `<label>${isR ? '할 일' : '꼭 챙길 것'}<textarea data-f="title" rows="2" maxlength="300">${E(it.title)}</textarea></label>
    ${isR ? `<div class="wl-pl">언제 하나요</div><div class="wl-chips" data-f="t">${[['day', '평일 매일'], ['week', '요일'], ['month', '매월'], ['date', '한 번']].map(([k, t]) => `<button type="button" data-v="${k}" class="${r.t === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="wl-chips sm" data-f="wd"${r.t === 'week' ? '' : ' hidden'}>${[1, 2, 3, 4, 5, 6, 0].map(w => `<button type="button" data-v="${w}" class="${(r.wd || []).includes(w) ? 'on' : ''}">${WK[w]}</button>`).join('')}</div>
      <div data-f="dm"${r.t === 'month' ? '' : ' hidden'}><input type="text" data-k="dm" value="${E((r.dm || []).map(x => x === 'L' ? '말일' : x).join(', '))}" placeholder="예: 1, 15, 말일"></div>
      <div data-f="d"${r.t === 'date' ? '' : ' hidden'}><input type="date" data-k="d" value="${E(r.d || '')}"></div>
      <div class="wl-pl">저절로 체크</div><div class="wl-chips sm" data-f="auto"><button type="button" data-v="" class="${r.auto ? '' : 'on'}">안 함</button><button type="button" data-v="in" class="${r.auto === 'in' ? 'on' : ''}">입고 · 발송 확인 (콰이디에어 · ERP)</button></div><div class="wl-pl">시간대 <small>(안 적어도 돼요)</small></div><div class="wl-chips sm" data-f="slot">${['출근 직후', '오전', '점심 후', '오후', '퇴근 전'].map(t => `<button type="button" data-v="${t}" class="${it.slot === t ? 'on' : ''}">${t}</button>`).join('')}</div><input type="text" data-k="slot" maxlength="40" value="${E(it.slot)}" placeholder="직접 적기 (예: 3시)">`
    : `<label>날짜 <small>(있으면 D-day 로 보여요)</small><input type="date" data-k="due" value="${E(it.due || '')}"></label>`}
    <label>메모<textarea data-k="memo" rows="2" maxlength="2000" placeholder="안 적어도 돼요">${E(it.memo)}</textarea></label>
    <label class="wl-hot"><input type="checkbox" data-k="hot"${it.hot ? ' checked' : ''}> 중요 — 맨 위에 굵게</label>
    <div class="wl-pf"><button type="button" class="wl-btn" data-x="del">지우기</button><span class="wl-sp"></span><button type="button" class="wl-btn" data-x="no">닫기</button><button type="button" class="wl-btn pri" data-x="ok">저장</button></div>`;
  pop(at, body, 'form', (e, box, close) => {
    const c = e.target.closest('.wl-chips button');
    if(c){
      const f = c.parentNode.dataset.f;
      if(f === 'wd') c.classList.toggle('on');
      else if(f === 'auto') $$('button', c.parentNode).forEach(b => b.classList.toggle('on', b === c));
      else if(f === 'slot'){ const on = !c.classList.contains('on'); $$('button', c.parentNode).forEach(b => b.classList.remove('on')); c.classList.toggle('on', on); $('[data-k="slot"]', box).value = on ? c.dataset.v : ''; }
      else{ $$('button', c.parentNode).forEach(b => b.classList.toggle('on', b === c)); ['wd', 'dm', 'd'].forEach(k => { const x = $(`[data-f="${k}"]`, box); if(x) x.hidden = {week:'wd', month:'dm', date:'d'}[c.dataset.v] !== k; }); }
      return;
    }
    const x = e.target.closest('[data-x]'); if(!x) return;
    if(x.dataset.x === 'no') return close();
    if(x.dataset.x === 'del'){ close(); return boardDel(id); }
    const title = $('[data-f="title"]', box).value.replace(/\s+/g, ' ').trim();
    if(!title){ say('할 일을 적어 주세요', 'err'); return; }
    const patch = {kind:it.kind, title, memo:$('[data-k="memo"]', box).value.trim(), hot:$('[data-k="hot"]', box).checked};
    if(isR){
      const t = ($('[data-f="t"] .on', box) || {dataset:{v:'day'}}).dataset.v, rule = {t};
      if(t === 'week'){ rule.wd = $$('[data-f="wd"] .on', box).map(b => +b.dataset.v); if(!rule.wd.length){ say('요일을 하나 이상 골라 주세요', 'err'); return; } }
      if(t === 'month'){ rule.dm = $('[data-k="dm"]', box).value.split(/[,\s]+/).map(s => /말/.test(s) ? 'L' : parseInt(s, 10)).filter(v => v === 'L' || (v >= 1 && v <= 31)); if(!rule.dm.length){ say('며칠인지 적어 주세요 (예: 1, 15, 말일)', 'err'); return; } }
      if(t === 'date'){ rule.d = $('[data-k="d"]', box).value; if(!rule.d){ say('날짜를 골라 주세요', 'err'); return; } }
      { const au = ($('[data-f="auto"] .on', box) || {dataset:{v:''}}).dataset.v; if(au) rule.auto = au; }
      patch.rule = rule; patch.slot = $('[data-k="slot"]', box).value.trim();
    }else patch.due = $('[data-k="due"]', box).value || '';
    close(); boardSave(id, patch).then(() => { if(isR && patch.rule.auto) inbTick(true); });
  });
}
function onBoardClick(e){
  const a = e.target.closest('[data-bact]');
  if(a){
    const id = a.dataset.bid, k = a.dataset.bact;
    if(k === 'check'){ const d = a.dataset.day, it = S.board.get(id); return it && boardCheck(id, d, !checked(it, d)); }
    if(k === 'pindone'){ const it = S.board.get(id); boardSave(id, {done:true}).then(ok => ok && snack(`‘${it.title}’ 끝냈어요`, () => boardSave(id, {done:false}))); return; }
    if(k === 'edit') return boardEdit(id, a);
    if(k === 'del') return boardDel(id);
    if(k === 'fold'){ S.boardFold = !S.boardFold; saveUi(); return renderBoard(); }
    if(k === 'tolog'){ showCenter(); return toLog(); }
    if(k === 'tolst'){ showCenter(); return toLog('lst'); }
    if(k === 'totop') return scrollTo({top:0, behavior:'smooth'});
    if(k === 'wdone'){ const p = S.pages.get(a.dataset.pid); if(p) doneIn(p, a.dataset.lid); return; }
    if(k === 'wstart'){ showCenter(); poll().then(() => newPage('daily', S.today)).then(() => toLog()); return; }
    if(k === 'wmore'){ S.twAll = !S.twAll; return renderBoard(); }
    if(k === 'golink'){ const it = S.board.get(id), p = it && it.link && S.pages.get(it.link.page); if(!p) return boardEdit(id, a); const tgt = dailies().find(x => x.blocks && x.blocks.some(b => b.id === it.link.line || b.o === it.link.line)) || p; const b = (tgt.blocks || []).find(x => x.id === it.link.line || x.o === it.link.line); showCenter(); openPage(tgt.id, {line:b && b.id}); return; }
  }
  const go = e.target.closest('[data-go][data-pid]');
  if(go){ showCenter(); openPage(go.dataset.pid, {line:go.dataset.go}); toLog(); }
}
function toLog(id){ setTimeout(() => { const w = document.getElementById(id || 'wl'), v = document.getElementById('viewDesign'); if(!w || !v) return; const off = parseFloat(getComputedStyle(v).getPropertyValue('--wlb')) || 44, tb = $('.topbar'); scrollTo({top:w.getBoundingClientRect().top + scrollY - Math.max(44, off) - (tb ? tb.offsetHeight : 0) - 10, behavior:'smooth'}); }, 40); }
function goOrders(){ showCenter(); flushSoon(); S.view = 'order'; S.find = null; S.cur = null; S.oMonth = S.today.slice(0, 7); renderTop(); renderMain(); }
const showCenter = () => { try{ if(_dsgCurTab !== 'center') dsgSwitchTab('center'); }catch(e){} };
function bindBoard(el){
  el.addEventListener('click', onBoardClick);
  el.addEventListener('toggle', e => { if(e.target.classList && e.target.classList.contains('wl-off')) S.offOpen = e.target.open; }, true);
  el.addEventListener('submit', e => {
    const f = e.target.closest('[data-add]'); if(!f) return;
    e.preventDefault();
    const i = $('input', f), t = i.value.trim(); if(!t) return;
    const kind = f.dataset.add, id = uuid(); i.value = ''; i.blur();
    if(kind === 'today') return addToday(t);
    boardSave(id, Object.assign({kind, title:t, sort:Date.now() / 1000}, kind === 'routine' ? {rule:{t:'day'}} : {})).then(ok => { if(ok){ const row = $(`#wlBoard .wl-r[data-bid="${id}"] .wl-rt`); if(row) boardEdit(id, row); } });
  });
  el.addEventListener('focusout', () => setTimeout(settle, 60));
  let drag = null;
  el.addEventListener('dragstart', e => { const r = e.target.closest('.wl-r[draggable]'); if(!r) return; drag = r.dataset.bid; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); });
  el.addEventListener('dragover', e => {
    if(S.dragLine){ e.preventDefault(); el.classList.add('is-drop'); return; }
    const r = e.target.closest('.wl-r[data-bid]'); if(!drag || !r) return;
    const a = S.board.get(drag), b = S.board.get(r.dataset.bid); if(!a || !b || a.kind !== b.kind) return;
    e.preventDefault(); $$('.wl-r', el).forEach(x => x.classList.toggle('over', x === r));
  });
  el.addEventListener('dragleave', e => { if(!el.contains(e.relatedTarget)) el.classList.remove('is-drop'); });
  el.addEventListener('drop', e => {
    el.classList.remove('is-drop');
    if(S.dragLine){ e.preventDefault(); const p = cur(), b = p && p.blocks.find(x => x.id === S.dragLine); if(b) pinLine(b, p); return; }
    const r = e.target.closest('.wl-r[data-bid]'); if(!drag || !r || r.dataset.bid === drag) return;
    e.preventDefault();
    const a = S.board.get(drag), b = S.board.get(r.dataset.bid); if(!a || !b || a.kind !== b.kind) return;
    const L = (a.kind === 'routine' ? routines() : pins()).filter(x => x.id !== a.id), i = L.findIndex(x => x.id === b.id), box = r.getBoundingClientRect(), after = e.clientY > box.top + box.height / 2, k = after ? i + 1 : i;
    const lo = L[k - 1] ? L[k - 1].sort : (L[k] ? L[k].sort - 100 : 0), hi = L[k] ? L[k].sort : lo + 100;
    boardSave(a.id, {sort:(lo + hi) / 2, hot:b.hot});
  });
  el.addEventListener('dragend', () => { drag = null; $$('.wl-r', el).forEach(x => x.classList.remove('over')); });
}

/* ============================================================ 작은 창 · 알림 ============================================================ */
function pop(at, html, cls, onClick){
  closePop();
  const b = document.createElement('div');
  b.className = 'wl-pop ' + (cls || ''); b.id = 'wlPop'; b.innerHTML = html;
  document.body.appendChild(b);
  const r = at && at.getBoundingClientRect ? at.getBoundingClientRect() : at || {left:innerWidth / 2 - 140, right:innerWidth / 2 + 140, top:120, bottom:120};
  const w = b.offsetWidth, h = b.offsetHeight;
  b.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
  b.style.top = Math.max(8, r.bottom + 6 + h < innerHeight - 8 ? r.bottom + 6 : r.top - h - 6 > 8 ? r.top - h - 6 : innerHeight - h - 8) + 'px';
  b.addEventListener('click', e => onClick && onClick(e, b, closePop));
  setTimeout(() => document.addEventListener('mousedown', popOut, true), 0);
  return b;
}
function popOut(e){ const b = document.getElementById('wlPop'); if(b && !b.contains(e.target)) closePop(); }
function closePop(){ const b = document.getElementById('wlPop'); if(b) b.remove(); document.removeEventListener('mousedown', popOut, true); }
let snackT = 0;
function snack(msg, undoFn){
  let el = document.getElementById('wlSnack');
  if(!el){ el = document.createElement('div'); el.id = 'wlSnack'; el.className = 'wl-snack'; document.body.appendChild(el); }
  el.innerHTML = `<span>${E(msg)}</span>${undoFn ? '<button type="button">되돌리기</button>' : ''}`;
  el.classList.add('on');
  const b = $('button', el); if(b) b.onclick = () => { el.classList.remove('on'); undoFn(); };
  clearTimeout(snackT); snackT = setTimeout(() => el.classList.remove('on'), 7000);
}
function modal(title, html, onClick){
  closeModal();
  const m = document.createElement('div'); m.className = 'wl-modal'; m.id = 'wlModal';
  m.innerHTML = `<div class="wl-mb" role="dialog" aria-label="${E(title)}"><header><b>${E(title)}</b><button type="button" data-x="close" aria-label="닫기">×</button></header><div class="wl-mc2">${html}</div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target === m || e.target.closest('[data-x="close"]')) return closeModal(); if(onClick) onClick(e, m); });
  return m;
}
const closeModal = () => { const m = document.getElementById('wlModal'); if(m) m.remove(); };
function lightbox(src){ const m = document.createElement('div'); m.className = 'wl-lb'; m.innerHTML = `<img src="${E(src)}" alt="">`; m.onclick = () => m.remove(); document.body.appendChild(m); }
async function copyText(t, ok){
  try{ await navigator.clipboard.writeText(t); }
  catch(e){ const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); try{ document.execCommand('copy'); }catch(e2){} x.remove(); }
  say(ok || '복사했어요');
}
function pageText(p, ids){
  const L = [];
  if(!ids) L.push(`${+p.day.slice(5, 7)}월 ${+p.day.slice(8)}일 (${WK[dow(p.day)]}) ${p.title}`);
  (p.blocks || []).forEach(b => {
    if(ids && !ids.has(b.id)) return;
    if(b.t === 'hr') return;
    if(isHead(b)){ L.push('', `[${bText(b)}]`); return; }
    if(b.t === 'img'){ L.push('  '.repeat(b.lv || 0) + '(사진)'); return; }
    if(b.t === 'file'){ L.push('  '.repeat(b.lv || 0) + `(파일) ${b.name || ''}`); return; }
    if(isEmpty(b)) return;
    L.push('  '.repeat(b.lv || 0) + (b.t === 'p' ? '' : b.k ? '✓ ' : '- ') + bText(b));
  });
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ============================================================ 메뉴 ============================================================ */
function lineMenu(id, at){
  const p = cur(), b = p && p.blocks.find(x => x.id === id); if(!b) return;
  const many = S.sel && S.sel.ids.has(id) && S.sel.ids.size > 1 ? [...S.sel.ids] : null, ids = many || [id], h = isHead(b);
  const B = (k, t, s) => `<button type="button" data-m="${k}"><span>${t}</span>${s ? `<kbd>${s}</kbd>` : ''}</button>`;
  const html = `${many ? `<div class="wl-pt">${many.length}줄 고름</div>` : ''}
    ${h ? '' : B('done', b.k ? '다시 할 일로' : '끝냄', 'Ctrl Enter') + (many ? '' : B('pin', '📌 전광판에 올리기') + B('tomorrow', '내일 할 일로 보내기') + B('hist', '이 건 지난 기록 보기'))}
    ${B('del', h ? '구역째 지우기' : '지우기', many ? 'Del' : '')}
    ${h ? '' : `<div class="wl-pt">상태</div><div class="wl-chips sm" data-g="st"><button type="button" data-v="" class="${b.st ? '' : 'on'}">자동</button>${Object.entries(STS).filter(([k]) => k !== 'done').map(([k, t]) => `<button type="button" data-v="${k}" class="${b.st === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="wl-pt">줄 색</div><div class="wl-sw" data-g="bg">${['', 'yellow_background', 'red_background', 'blue_background', 'teal_background', 'gray_background'].map(c => `<button type="button" data-v="${c}" class="bg-${c.replace('_background', '') || 'no'}${(b.bg || '') === c ? ' on' : ''}" aria-label="${c || '색 없음'}"></button>`).join('')}</div>
    <div class="wl-pt">모양</div><div class="wl-chips sm" data-g="t">${[['li', '글머리'], ['todo', '체크칸'], ['p', '본문'], ['h3', '구역 제목'], ['quote', '인용']].map(([k, t]) => `<button type="button" data-v="${k}" class="${b.t === k ? 'on' : ''}">${t}</button>`).join('')}</div>`}
    <div class="wl-pt">옮기기</div>${many ? '' : `<div class="wl-chips sm" data-g="mv"><button type="button" data-v="up">위로</button><button type="button" data-v="down">아래로</button>${h ? '' : '<button type="button" data-v="in">들여쓰기</button><button type="button" data-v="out">내어쓰기</button>'}</div>`}
    ${many ? B('in', '들여쓰기', 'Tab') + B('out', '내어쓰기', 'Shift Tab') : ''}${h ? B('toli', '구역 풀기 (보통 줄로)') : B('dup', '똑같은 줄 하나 더')}${B('photo', '사진 · 파일 넣기')}${B('cp', '글자로 복사')}`;
  pop(at, html, 'menu', (e, box, close) => {
    const g = e.target.closest('[data-g] button');
    if(g){
      const k = g.parentNode.dataset.g, v = g.dataset.v; close();
      if(k === 'mv'){ if(v === 'up' || v === 'down') h ? moveSec(id, v === 'up' ? -1 : 1) : moveLine(id, v === 'up' ? -1 : 1); else indent([id], v === 'in' ? 1 : -1); return; }
      return setProp(ids, x => { if(k === 't'){ x.t = v; if(v === 'h3') x.lv = 0; } else if(v) x[k] = v; else delete x[k]; });
    }
    const m = e.target.closest('[data-m]'); if(!m) return;
    close();
    const k = m.dataset.m;
    if(k === 'done') return many ? setProp(ids, x => { if(b.k) delete x.k; else x.k = 1; }) : toggleDone(id);
    if(k === 'pin') return pinLine(b, p);
    if(k === 'tomorrow') return sendTomorrow(id);
    if(k === 'hist') return showHist(b);
    if(k === 'in' || k === 'out') return indent(ids, k === 'in' ? 1 : -1);
    if(k === 'toli') return setProp([id], x => { x.t = 'li'; });
    if(k === 'dup') return edit(bs => { const i = bs.findIndex(x => x.id === id), z = subEnd(bs, i), c = bs.slice(i, z).map(x => Object.assign(clone(x), {id:bid()})); c.forEach(x => { delete x.o; delete x.d0; }); bs.splice(z, 0, ...c); return {focus:c[0].id, pos:'end'}; });
    if(k === 'photo') return pickFile(id);
    if(k === 'cp'){ const set = new Set(ids); if(!many){ const i = idx(p, id), z = h ? secEnd(p.blocks, i) : subEnd(p.blocks, i); p.blocks.slice(i, z).forEach(x => set.add(x.id)); } return copyText(pageText(p, set)); }
    if(k === 'del') return h ? delSec(id) : (removeLines(ids), S.sel = null);
  });
}
function showHist(b){
  // 상품 이름으로 — 앞의 [업체] · 날짜 · 수량 · ⇒ 뒤를 떼고 앞 낱말 몇 개
  const t = bText(b).replace(/^\s*(\[[^\]]+\]\s*)+/, '').replace(/^\d{4}_/, '').split(AR)[0].replace(/[\d,]+\s*(ea|원|위안|kg).*/i, '').replace(/\(.*?\)/g, ' ').replace(/[^\w가-힣\s]/g, ' ').trim();
  const q = (t || bText(b)).split(/\s+/).slice(0, 2).join(' ').slice(0, 30);
  const i = document.getElementById('wlQ'); if(i) i.value = q;
  findRun(q);
}
const secEnd = (bs, i) => { let j = i + 1; while(j < bs.length && !isHead(bs[j])) j++; return j; };
function delSec(id){
  const p = cur(), i = idx(p, id); if(i < 0) return;
  let n = 0;
  edit(bs => { const z = secEnd(bs, i); n = z - i; bs.splice(i, z - i); });
  snack('구역을 지웠어요', () => undo());
}
function moveSec(id, dir){
  edit(bs => {
    const i = bs.findIndex(b => b.id === id); if(i < 0) return false;
    const z = secEnd(bs, i), chunk = bs.slice(i, z);
    if(dir < 0){ let j = i - 1; while(j >= 0 && !isHead(bs[j])) j--; if(j < 0){ if(i === 0) return false; j = 0; } bs.splice(i, chunk.length); bs.splice(j, 0, ...chunk); }
    else{ if(z >= bs.length) return false; const e = secEnd(bs, z); bs.splice(i, chunk.length); bs.splice(e - chunk.length, 0, ...chunk); }
    S.split.delete(S.cur);
  });
}
function pageMenu(at){
  const p = cur(); if(!p) return;
  const B = (k, t) => `<button type="button" data-m="${k}"><span>${t}</span></button>`;
  pop(at, B('dup', p.kind === 'order' ? '똑같은 일정 하나 더' : '이 글을 복사해 새 글로') + (p.kind === 'order' ? '' : B('sec', '＋ 구역 추가')) + B('photo', '사진 · 파일 넣기') + B('redo', '다시 하기 (Ctrl Shift Z)') + B('ver', '지난 버전 보기') + (p.origin === 'notion' ? B('src', '옮기기 전 원본 보기') : '') + B('del', '이 글 지우기'), 'menu', (e, box, close) => {
    const m = e.target.closest('[data-m]'); if(!m) return; close();
    const k = m.dataset.m;
    if(k === 'dup'){ const n = {id:uuid(), day:p.kind === 'order' ? p.day : S.today, title:p.title, kind:p.kind === 'daily' && dailies().some(x => x.day === S.today) ? 'memo' : p.kind, meta:clone(p.meta || {}), blocks:carryPlain(p), ver:0, _bv:0, n:p.n, nd:0, origin:'office', ca:new Date().toISOString(), ua:new Date().toISOString(), ub:me()}; S.pages.set(n.id, n); S.dirty.set(n.id, {base:0, bb:[], bm:{}, seq:1, isNew:true}); scheduleSave(60); openPage(n.id); return; }
    if(k === 'sec') return addSec();
    if(k === 'photo') return pickFile(null);
    if(k === 'redo') return undo(true);
    if(k === 'ver') return versions(p);
    if(k === 'src') return showSrc(p);
    if(k === 'del') return delPage(p);
  });
}
async function delPage(p){
  if(!confirm(`${md(p.day)} ‘${p.title || '(제목 없음)'}’ 글을 지울까요?\n지운 글은 ⋯ 메뉴 ‘지운 글’ 에서 언제든 되살릴 수 있어요.`)) return;
  if(S.dirty.has(p.id)) await flush();
  try{ await rpc('dlog_del', {p_kind:'page', p_id:p.id, p_on:true, p_who:me()}); }catch(e){ say('지우지 못했어요 — 인터넷을 확인해 주세요', 'err'); return; }
  S.pages.delete(p.id); S.dirty.delete(p.id); S.cur = null; S.caches.clear();
  renderAll();
  snack('글을 지웠어요', () => restorePage(p.id));
}
async function restorePage(id){
  try{ await rpc('dlog_del', {p_kind:'page', p_id:id, p_on:false, p_who:me()}); (await rpc('dlog_get', {p_ids:[id]}) || []).forEach(setPage); S.caches.clear(); openPage(id); say('되살렸어요'); }
  catch(e){ say('되살리지 못했어요', 'err'); }
}
async function trash(){
  const m = modal('지운 글 · 지운 전광판', '<p class="wl-none">불러오는 중…</p>');
  let j; try{ j = await rpc('dlog_trash', {}); }catch(e){ $('.wl-mc2', m).innerHTML = '<p class="wl-none">불러오지 못했어요</p>'; return; }
  $('.wl-mc2', m).innerHTML = (j.pages.map(p => `<div class="wl-tr"><b>${md(p.day)} ${E(p.title || '(제목 없음)')}</b><span>${E(p.head || '')}</span><small>${p.da ? `${md(ymd(new Date(p.da)))} ${hm(p.da)}` : ''} ${E(p.db || '')}</small><button type="button" class="wl-btn sm" data-rp="${p.id}">되살리기</button></div>`).join('')
    + j.board.map(b => `<div class="wl-tr"><b>${b.kind === 'routine' ? '루틴' : '고정'}</b><span>${E(b.title)}</span><small>${b.deleted_at ? `${md(ymd(new Date(b.deleted_at)))} ${hm(b.deleted_at)}` : ''}</small><button type="button" class="wl-btn sm" data-rb="${b.id}">되살리기</button></div>`).join('')) || '<p class="wl-none">지운 것이 없어요</p>';
  m.addEventListener('click', async e => {
    const a = e.target.closest('[data-rp]'), b = e.target.closest('[data-rb]');
    if(a){ closeModal(); restorePage(a.dataset.rp); }
    if(b){ closeModal(); try{ await rpc('dlog_del', {p_kind:'board', p_id:b.dataset.rb, p_on:false, p_who:me()}); await poll2(); say('되살렸어요'); }catch(err){ say('되살리지 못했어요', 'err'); } }
  });
}
async function poll2(){ S.max = Math.max(0, S.max - 200); await poll(); renderBoard(); }
function readHtml(blocks){           // 읽기 전용 미리보기
  return `<div class="wl-read">${(blocks || []).map(b => b.t === 'hr' ? '<hr>' : isHead(b) ? `<h4>${deco(b)}</h4>` : b.t === 'img' ? `<img src="${E(imgUrl(b.src))}" alt="">` : isEmpty(b) ? '' : `<div class="${b.k ? 'is-done' : ''}" style="--lv:${b.lv || 0}">${b.t === 'p' ? '' : b.k ? '✓ ' : '• '}${deco(b)}</div>`).join('')}</div>`;
}
async function versions(p){
  if(S.dirty.has(p.id)) await flush();
  const m = modal(`${md(p.day)} ${p.title} — 지난 버전`, '<p class="wl-none">불러오는 중…</p>');
  let rows; try{ rows = await rpc('dlog_versions', {p_id:p.id}); }catch(e){ rows = null; }
  if(!rows || !rows.length){ $('.wl-mc2', m).innerHTML = '<p class="wl-none">아직 지난 버전이 없어요 — 고칠 때마다 10분에 한 번씩 남아요</p>'; return; }
  $('.wl-mc2', m).innerHTML = `<div class="wl-vs"><div class="wl-vl">${rows.map(r => `<button type="button" data-hid="${r.hid}">${md(ymd(new Date(r.ua || r.at)))} ${hm(r.ua || r.at)}<small>${E(r.who === 'notion' ? '노션' : r.who || '')} · ${r.n || 0}줄</small></button>`).join('')}</div><div class="wl-vb"><p class="wl-none">왼쪽에서 골라 주세요</p></div></div>`;
  let snap = null;
  m.addEventListener('click', async e => {
    const h = e.target.closest('[data-hid]');
    if(h){ $$('[data-hid]', m).forEach(x => x.classList.toggle('on', x === h)); try{ snap = await rpc('dlog_versions', {p_id:p.id, p_hid:+h.dataset.hid}); $('.wl-vb', m).innerHTML = `<button type="button" class="wl-btn pri sm" data-x="back">이 버전으로 되돌리기</button>${readHtml(snap.blocks)}`; }catch(err){ say('불러오지 못했어요', 'err'); } }
    if(e.target.closest('[data-x="back"]') && snap){ closeModal(); openPage(p.id); const c = cur(); beforeEdit(c); mark(c); c.blocks = clone(snap.blocks); touch(c); renderPage(); snack('지난 버전으로 되돌렸어요', () => undo()); }
  });
}
/* 옮기기 전 원본(저장소에 같이 넣어 둔 노션 글 그대로) — 노션에 연결하지 않고 우리 저장소에서만 읽는다 */
function srcHtml(bs, lv){
  return (bs || []).map(b => {
    const t = (b.rich || []).map(x => x.t).join('') || b.text || b.caption || '', kids = srcHtml(b.children, /^(columns|column|h\d)$/.test(b.type) ? lv : lv + 1);
    if(b.type === 'divider') return '<hr>';
    if(/^h\d$/.test(b.type)) return `<h4>${E(t)}</h4>${kids}`;
    if(b.type === 'image') return `<div style="--lv:${lv}">(사진)</div>`;
    return (t ? `<div class="${b.checked ? 'is-done' : ''}" style="--lv:${lv}">${b.type === 'p' ? '' : b.type === 'todo' ? (b.checked ? '✓ ' : '☐ ') : b.type === 'toggle' ? '▸ ' : '• '}${E(t)}</div>` : '') + kids;
  }).join('');
}
async function showSrc(p){
  const m = modal(`${md(p.day)} ${p.title} — 옮기기 전 원본`, '<p class="wl-none">불러오는 중…</p>');
  try{ const s = await rpc('dlog_src', {p_id:p.id}); $('.wl-mc2', m).innerHTML = s && s.blocks ? `<div class="wl-read">${srcHtml(s.blocks, 0)}</div>` : '<p class="wl-none">원본이 없어요</p>'; }
  catch(e){ $('.wl-mc2', m).innerHTML = '<p class="wl-none">불러오지 못했어요</p>'; }
}
function newMenu(at){
  const day = S.today;
  pop(at, `<div class="wl-pt">날짜</div><input type="date" id="wlNewDay" value="${day}"><button type="button" data-m="daily"><span>업무일지 <small>앞글에서 남은 일 이어받기</small></span></button><button type="button" data-m="status"><span>진행상황 <small>지난 진행상황 복사</small></span></button><button type="button" data-m="memo"><span>회의 · 메모 <small>빈 글</small></span></button><button type="button" data-m="blank"><span>업무일지 <small>빈 양식으로</small></span></button>`, 'menu', (e, box, close) => {
    const m = e.target.closest('[data-m]'); if(!m) return;
    const d = $('#wlNewDay', box).value || day; close();
    const k = m.dataset.m; newPage(k === 'blank' ? 'daily' : k, d, {blank:k === 'blank'});
  });
}
function moreMenu(at){
  pop(at, `<button type="button" data-m="trash"><span>지운 글 · 지운 전광판</span></button><button type="button" data-m="reload"><span>새로 불러오기</span></button><button type="button" data-m="help"><span>단축키</span></button>`, 'menu', (e, box, close) => {
    const m = e.target.closest('[data-m]'); if(!m) return; close();
    if(m.dataset.m === 'trash') return trash();
    if(m.dataset.m === 'reload') return boot().then(renderAll);
    modal('단축키', `<div class="wl-keys">${[['Enter', '아래에 새 줄'], ['Shift Enter', '줄 안에서 줄바꿈'], ['Tab · Shift Tab', '들여쓰기 · 내어쓰기'], ['Ctrl Enter', '끝냄 · 다시 할 일로'], ['Alt ↑ ↓', '줄 옮기기'], ['Ctrl Z · Ctrl Shift Z', '되돌리기 · 다시 하기'], ['Ctrl B', '굵게 (글자를 고른 뒤)'], ['여러 줄 끌기', '여러 줄 고르기 → Del 지우기 · Tab 들여쓰기 · Ctrl C 복사'], ['## + 빈칸', '구역 제목'], ['[] + 빈칸', '체크칸']].map(([a, b]) => `<div><kbd>${a}</kbd><span>${b}</span></div>`).join('')}</div>`);
  });
}
function addSec(){ edit(bs => { const h = nb({t:'h3', r:[]}), l = nb(); let z = bs.length; const t = bs.findIndex(b => isHead(b) && secType(b) === 'tomorrow'); if(t >= 0) z = t; bs.splice(z, 0, h, l); S.fresh.add(h.id); return {focus:h.id}; }); }
function addLine(key){
  edit(bs => {
    const p = cur(), s = sections(bs).find(x => x.key === key); if(!s) return false;
    const last = s.items[s.items.length - 1];
    if(last && isEmpty(last) && last.t !== 'p'){ return {focus:last.id}; }
    const n = nb({t:last && last.t === 'todo' ? 'todo' : 'li', lv:s.items.length ? Math.min(...s.items.map(b => b.lv || 0)) : 0}), at = last ? bs.indexOf(last) + 1 : bs.indexOf(s.head) + 1;
    bs.splice(at, 0, n); S.fresh.add(n.id);
    if(s.head && s.head.f) delete s.head.f;
    return {focus:n.id};
  });
}

/* ============================================================ 사진 · 파일 ============================================================ */
const imgUrl = s => !s ? '' : /^https?:/.test(s) ? s : `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${s}`;
async function shrink(file, max){
  const img = await createImageBitmap(file), k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('shrink')), 'image/jpeg', .86));
}
async function upload(file){
  const isImg = /^image\/(jpe?g|png|webp|gif)$/.test(file.type), gif = file.type === 'image/gif';
  if(!isImg && file.size > 30 * 1048576) throw new Error('30MB 가 넘는 파일은 올릴 수 없어요');
  const body = isImg && !gif ? await shrink(file, 1800) : file, ext = isImg && !gif ? 'jpg' : (String(file.name || '').match(/\.([A-Za-z0-9]{1,8})$/) || [, gif ? 'gif' : 'bin'])[1].toLowerCase();
  const type = isImg && !gif ? 'image/jpeg' : ({pdf:'application/pdf', zip:'application/zip', ai:'application/postscript', eps:'application/postscript', psd:'image/vnd.adobe.photoshop', xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ppt:'application/vnd.ms-powerpoint', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation', csv:'text/csv', txt:'text/plain', gif:'image/gif'})[ext] || 'application/octet-stream';
  const path = `${S.today.slice(0, 7).replace('-', '')}/${uuid().replace(/-/g, '')}.${ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {method:'POST', headers:{apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, 'Content-Type':type, 'Cache-Control':'31536000', 'x-upsert':'false'}, body});
  if(!r.ok) throw new Error('올리지 못했어요 (' + r.status + ')');
  return isImg ? {t:'img', src:path} : {t:'file', src:path, name:file.name || '파일', size:file.size};
}
async function addFiles(files, afterId){
  const p = cur(); if(!p) return;
  for(const f of files){
    say('올리는 중…');
    try{
      const o = await upload(f);
      edit(bs => { let i = afterId ? bs.findIndex(b => b.id === afterId) : -1; const lv = i >= 0 && !isHead(bs[i]) ? bs[i].lv || 0 : 0, n = nb(Object.assign({lv}, o)); if(i < 0){ bs.push(n); } else bs.splice(i + 1, 0, n); afterId = n.id; });
      snack(o.t === 'img' ? '사진을 넣었어요' : '파일을 넣었어요');
    }catch(e){ say(String(e.message || e), 'err'); }
  }
}
function pickFile(afterId){
  let i = document.getElementById('wlFile');
  if(!i){ i = document.createElement('input'); i.type = 'file'; i.id = 'wlFile'; i.multiple = true; i.hidden = true; document.body.appendChild(i); i.addEventListener('change', () => { const fs = [...i.files], a = i._after; i.value = ''; if(fs.length) addFiles(fs, a); }); }
  i._after = afterId; i.click();
}

/* ============================================================ 입력 ============================================================ */
function bindLog(w){
  w.addEventListener('click', onClick);
  w.addEventListener('input', onInput);
  w.addEventListener('beforeinput', onBeforeInput);
  w.addEventListener('keydown', onKey);
  w.addEventListener('paste', onPaste);
  w.addEventListener('change', e => {
    const p = cur(); if(!p) return;
    if(e.target.dataset && e.target.dataset.om){ return ordField(e.target); }
    if(e.target.id === 'wlKind'){ beforeEdit(p); p.kind = e.target.value; touch(p); S.caches.clear(); renderNav(); renderPage(); }
  });
  w.addEventListener('focusout', e => {
    const x = e.target.closest && e.target.closest('.wl-x');
    if(x){ const l = x.closest('.wl-b'), p = cur(), b = p && p.blocks && p.blocks.find(q => q.id === l.dataset.id); if(b){ x.innerHTML = deco(b); l.classList.toggle('is-empty', isEmpty(b)); } hideBar(); }
    if(x) sideSoon();
    setTimeout(settle, 60);
  });
  // 여러 줄 끌어서 고르기
  let down = null;
  w.addEventListener('mousedown', e => {
    if(e.button !== 0) return;
    const l = e.target.closest('.wl-b'), x = e.target.closest('.wl-x');
    if(S.sel && !e.target.closest('.wl-grip')) clearSel();
    if(x && e.shiftKey){ const f = focusedId(); if(f && f !== l.dataset.id){ e.preventDefault(); selRange(f, l.dataset.id); return; } }
    down = x ? {id:l.dataset.id} : null;
  });
  w.addEventListener('mousemove', e => {
    if(!down || !(e.buttons & 1)) return;
    const l = e.target.closest('.wl-b'); if(!l) return;
    if(l.dataset.id !== down.id || down.on){ down.on = true; e.preventDefault(); getSelection().removeAllRanges(); if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); selRange(down.id, l.dataset.id); }
  });
  document.addEventListener('mouseup', () => { down = null; });
  // 끌어서 옮기기
  w.addEventListener('dragstart', e => {
    const oe = e.target.closest && e.target.closest('.wl-oe[data-oid]');
    if(oe){ S.dragOrd = oe.dataset.oid; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); return; }
    const g = e.target.closest && e.target.closest('.wl-grip'); if(!g){ return; }
    const l = g.closest('.wl-b'); S.dragLine = l.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); try{ e.dataTransfer.setDragImage(l, 10, 10); }catch(x){} setTimeout(() => l.classList.add('is-drag'), 0);
  });
  w.addEventListener('dragover', e => {
    if(S.dragOrd){ const cd = e.target.closest('[data-oday]'); if(cd){ e.preventDefault(); $$('.wl-cd.over', w).forEach(x => x !== cd && x.classList.remove('over')); cd.classList.add('over'); } return; }
    const fs = e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    if(!S.dragLine && !fs) return;
    const l = e.target.closest('.wl-b'); if(!l && !fs) return;
    e.preventDefault(); e.stopPropagation();
    $$('.wl-b.dr-a,.wl-b.dr-b', w).forEach(x => x.classList.remove('dr-a', 'dr-b'));
    if(l){ const r = l.getBoundingClientRect(); l.classList.add(e.clientY > r.top + r.height / 2 ? 'dr-b' : 'dr-a'); }
  });
  w.addEventListener('drop', e => {
    if(S.dragOrd){ const cd = e.target.closest('[data-oday]'), p = S.pages.get(S.dragOrd); S.dragOrd = null; if(cd && p){ e.preventDefault(); const was = p.day; ordMove(p, cd.dataset.oday); renderOrd(); renderBoard(); if(S.cur === p.id) renderPage(); if(p.day !== was) snack(`${md(was)} → ${md(p.day)} 로 옮겼어요`, () => { ordMove(p, was); renderOrd(); renderBoard(); if(S.cur === p.id) renderPage(); }); } return; }
    const l = e.target.closest('.wl-b'), fs = e.dataTransfer && e.dataTransfer.files;
    $$('.wl-b.dr-a,.wl-b.dr-b', w).forEach(x => x.classList.remove('dr-a', 'dr-b'));
    if(fs && fs.length && (S.view === 'page' || (S.view === 'order' && cur())) && !S.find){ e.preventDefault(); e.stopPropagation(); return addFiles([...fs], l ? l.dataset.id : null); }
    if(!S.dragLine || !l || l.dataset.id === S.dragLine) return;
    e.preventDefault(); e.stopPropagation();
    const r = l.getBoundingClientRect(); dropLine(S.dragLine, l.dataset.id, e.clientY > r.top + r.height / 2);
  });
  document.addEventListener('dragend', () => { S.dragLine = null; S.dragOrd = null; $$('#wl .wl-cd.over').forEach(x => x.classList.remove('over')); $$('#wl .is-drag,#wl .dr-a,#wl .dr-b').forEach(x => x.classList.remove('is-drag', 'dr-a', 'dr-b')); });
  document.addEventListener('selectionchange', barSync);
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ if(document.getElementById('wlPop')){ closePop(); e.stopPropagation(); return; } if(document.getElementById('wlModal')){ closeModal(); return; } const lb = $('.wl-lb'); if(lb){ lb.remove(); return; } if(S.sel) clearSel(); }
    if(S.sel && !editing()) return selKey(e);
    // 체크 · 지우기처럼 글자 칸 밖에서 한 일도 Ctrl+Z 로 (오피스 공용 되돌리기보다 먼저 — 업무일지는 자체 되돌리기)
    if((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.isComposing && !e.altKey && !editing() && visible() && Date.now() - (S.actAt || 0) < 60000){ const a = document.activeElement, u = S.cur && S.undo.get(S.cur); if(u && (e.shiftKey ? u.rd : u.st).length && (!a || a === document.body || a.closest('#wl, #wlBoard'))){ e.preventDefault(); e.stopPropagation(); undo(e.shiftKey); } }
  }, true);
  document.addEventListener('copy', e => { if(S.sel && !editing() && cur()){ e.preventDefault(); e.clipboardData.setData('text/plain', pageText(cur(), S.sel.ids)); } });
}
let sideT = 0; const sideSoon = () => { clearTimeout(sideT); sideT = setTimeout(() => { if(S.ptr) return sideSoon(); if(S.view === 'page' && !S.find) renderSide(); if(S.view === 'order' && !S.find) renderOrd(); renderBoard(); }, 500); };
function refreshLabels(){ if(S.find || editing()) return; if(S.view === 'page') renderPage(); if(S.view === 'order'){ renderOrd(); if(S.cur) renderPage(); } }
function dropLine(id, to, after){
  edit(bs => {
    const i = bs.findIndex(b => b.id === id); if(i < 0) return false;
    const h = isHead(bs[i]), z = h ? secEnd(bs, i) : subEnd(bs, i), chunk = bs.slice(i, z);
    if(chunk.some(b => b.id === to)) return false;
    bs.splice(i, chunk.length);
    let j = bs.findIndex(b => b.id === to); if(j < 0) return false;
    const tb = bs[j];
    if(h){ // 구역째 — 닿은 구역의 앞/뒤로
      let s = j; while(s > 0 && !isHead(bs[s])) s--;
      j = after ? secEnd(bs, isHead(bs[s]) ? s : j) : s;
      S.split.delete(S.cur);
    }else{
      const d = (isHead(tb) ? 0 : tb.lv || 0) - (chunk[0].lv || 0);
      chunk.forEach(b => { b.lv = Math.max(0, (b.lv || 0) + d); });
      j = isHead(tb) ? j + 1 : after ? (tb.f ? subEnd(bs, j) : j + 1) : j;
      if(after && !isHead(tb) && !tb.f && bs[j] && (bs[j].lv || 0) > (tb.lv || 0) && !isHead(bs[j])) chunk.forEach(b => { b.lv = (b.lv || 0) + 1; });
    }
    bs.splice(j, 0, ...chunk);
  });
}
/* ── 여러 줄 고르기 ── */
function visIds(){ return $$('#wlPage .wl-b').map(l => l.dataset.id); }
function selRange(a, b){
  const v = visIds(), i = v.indexOf(a), j = v.indexOf(b); if(i < 0 || j < 0) return;
  const ids = new Set(v.slice(Math.min(i, j), Math.max(i, j) + 1));
  S.sel = {ids, a, b}; $$('#wlPage .wl-b').forEach(l => l.classList.toggle('is-sel', ids.has(l.dataset.id)));
}
function clearSel(){ S.sel = null; $$('#wlPage .wl-b.is-sel').forEach(l => l.classList.remove('is-sel')); }
function selKey(e){
  const ae = document.activeElement;
  if(e.isComposing || !visible() || document.getElementById('wlPop') || document.getElementById('wlModal') || (ae && ae !== document.body && !ae.closest('#wl'))) return;
  const ids = [...S.sel.ids], mod = e.metaKey || e.ctrlKey;
  if(e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); e.stopPropagation(); removeLines(ids); clearSel(); }
  else if(e.key === 'Tab'){ e.preventDefault(); indent(ids, e.shiftKey ? -1 : 1); }
  else if(mod && e.key === 'Enter'){ e.preventDefault(); const p = cur(), all = ids.every(i => (p.blocks.find(b => b.id === i) || {}).k); setProp(ids, b => { if(all) delete b.k; else b.k = 1; }); }
  else if(mod && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); undo(e.shiftKey); }
  else if(e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')){ e.preventDefault(); const v = visIds(), j = v.indexOf(S.sel.b) + (e.key === 'ArrowDown' ? 1 : -1); if(v[j]) selRange(S.sel.a, v[j]); }
}
/* ── 누르기 ── */
function onClick(e){
  const t = e.target;
  const a = t.closest('.wl-x a');
  if(a){ const u = a.dataset.a || a.getAttribute('href') || ''; if(u === 'wl:orders'){ e.preventDefault(); return goOrders(); } if(u.startsWith('wl:')){ e.preventDefault(); openPage(u.slice(3)); } else if(/^https?:/.test(u) && !(t.closest('.wl-x') === document.activeElement && !e.metaKey && !e.ctrlKey && getSelection().toString())){ e.preventDefault(); window.open(u, '_blank', 'noopener,noreferrer'); } return; }
  const o = t.closest('[data-open]'); if(o && o.dataset.open){ return openPage(o.dataset.open, {find:o.dataset.find}); }
  const go = t.closest('[data-go]'); if(go){ if(go.dataset.pid && go.dataset.pid !== S.cur || S.view !== 'page') return openPage(go.dataset.pid || S.cur, {line:go.dataset.go}); return flash(go.dataset.go); }
  const v = t.closest('[data-view]'); if(v){ flushSoon(); S.view = v.dataset.view; S.find = null; const q = document.getElementById('wlQ'); if(q) q.value = ''; if(S.view === 'order'){ const c = cur(); if(!c || c.kind !== 'order') S.cur = null; } else{ const c = cur(); if(!c || c.kind === 'order') S.cur = (S.lastPage && S.pages.has(S.lastPage) ? S.lastPage : (dailies()[0] || list()[0] || {}).id) || null; } renderTop(); return renderMain(); }
  const gr = t.closest('[data-group]'); if(gr){ S.group = gr.dataset.group; saveUi(); return renderMain(); }
  const mo = t.closest('[data-mon]'); if(mo){ const y = +S.month.slice(0, 4), m = +S.month.slice(5, 7) - 1 + +mo.dataset.mon, d = new Date(y, m, 1); S.month = ymd(d).slice(0, 7); return S.view === 'cal' ? renderMain() : renderNav(); }
  const kd = t.closest('[data-kind]'); if(kd){ S.kind = kd.dataset.kind; return renderNav(); }
  const dy = t.closest('[data-day]'); if(dy){ const d = dy.dataset.day, ps = list().filter(p => p.day === d); if(ps.length) return openPage((ps.find(p => p.kind === 'daily') || ps[0]).id); if(confirm(`${md(d)} (${WK[dow(d)]}) 업무일지를 새로 만들까요?`)) newPage('daily', d); return; }
  const cd = t.closest('[data-cday]'); if(cd && !t.closest('button')){ const d = cd.dataset.cday, ps = list().filter(p => p.day === d); if(ps.length) return openPage(ps[0].id); if(confirm(`${md(d)} (${WK[dow(d)]}) 업무일지를 새로 만들까요?`)) newPage('daily', d); return; }
  const fs = t.closest('[data-fst]'); if(fs){ S.fSt = S.fSt === fs.dataset.fst ? '' : fs.dataset.fst; S.fTag = ''; return renderPage(); }
  const ft = t.closest('[data-ftag]'); if(ft){ S.fTag = S.fTag === ft.dataset.ftag ? '' : ft.dataset.ftag; S.fSt = ''; return renderPage(); }
  const od = t.closest('[data-odone]'); if(od) return toggleDone(od.dataset.odone);
  const bk = t.closest('[data-back]'); if(bk){ return bringBack(bk.dataset.back); }
  if(onOrdClick(e)) return;
  const c = t.closest('[data-act]'); if(!c) return;
  const l = c.closest('.wl-b'), id = l && l.dataset.id, k = c.dataset.act;
  if(k === 'done') return toggleDone(id);
  if(k === 'del'){ removeLines([id]); return; }
  if(k === 'delsec') return delSec(id);
  if(k === 'menu'){ if(e.shiftKey && S.sel){ return selRange(S.sel.a, id); } if(!(S.sel && S.sel.ids.has(id))) selRange(id, id); return lineMenu(id, c); }
  if(k === 'fold') return edit(bs => { const b = bs.find(x => x.id === id); if(!b) return false; if(b.f) delete b.f; else b.f = 1; });
  if(k === 'st') return lineMenu(id, c);
  if(k === 'zoom') return lightbox(c.src);
  if(k === 'addline') return addLine(c.dataset.sec);
  if(k === 'addsec') return addSec();
  if(k === 'addfirst') return edit(bs => { const n = nb(); bs.push(n); S.fresh.add(n.id); return {focus:n.id}; });
  if(k === 'today'){ return poll().then(() => newPage('daily', S.today)); }
  if(k === 'new') return newMenu(c);
  if(k === 'more') return moreMenu(c);
  if(k === 'pagemenu') return pageMenu(c);
  if(k === 'copy') return copyText(pageText(cur()), '글자로 복사했어요 — 카톡에 붙여 넣으면 돼요');
  if(k === 'copyweek') return copyText(weekText(), '이번 주 정리를 복사했어요');
  if(k === 'undo') return undo(false);
  if(k === 'hidedone'){ S.hideDone = !S.hideDone; saveUi(); return renderPage(); }
  if(k === 'navall'){ S.navAll = true; return renderNav(); }
  if(k === 'reload'){ return boot().then(renderAll); }
  if(k === 'findoff'){ S.find = null; const q = document.getElementById('wlQ'); if(q) q.value = ''; renderTop(); return renderMain(); }
  if(k === 'pickday'){
    pop(c, `<div class="wl-pt">이 글의 날짜</div><input type="date" id="wlDayIn" value="${cur().day}"><div class="wl-pf"><button type="button" class="wl-btn" data-x="no">닫기</button><button type="button" class="wl-btn pri" data-x="ok">바꾸기</button></div>`, 'form', (ev, box, close) => {
      const x = ev.target.closest('[data-x]'); if(!x) return;
      const d = $('#wlDayIn', box).value; close();
      if(x.dataset.x === 'ok' && d){ const p = cur(); beforeEdit(p); p.day = d; touch(p); S.caches.clear(); renderNav(); renderPage(); }
    });
  }
}
function bringBack(lid){         // 앞글에서 빠진 줄을 이 글로 다시
  const p = cur(), q = prevOf(p); if(!q || !q.blocks) return;
  const i = q.blocks.findIndex(b => b.id === lid); if(i < 0) return;
  const z = subEnd(q.blocks, i), chunk = q.blocks.slice(i, z).map(b => Object.assign(clone(b), {id:bid(), o:b.o || b.id})), lv0 = chunk[0].lv || 0;
  let head = ''; for(let j = i; j >= 0; j--) if(isHead(q.blocks[j])){ head = norm(bText(q.blocks[j])); break; }
  chunk.forEach(b => { b.lv = (b.lv || 0) - lv0; });
  edit(bs => { let h = head ? bs.findIndex(b => isHead(b) && norm(bText(b)) === head) : -1; let at = bs.length; if(h >= 0) at = secEnd(bs, h); while(at > 0 && (isEmpty(bs[at - 1]) || bs[at - 1].t === 'hr') && at - 1 > h) at--; bs.splice(at, 0, ...chunk); });
  flash(chunk[0].id);
}
/* ── 글자 ── */
function blockOf(x){ const l = x.closest('.wl-b'), p = cur(); return l && p && p.blocks ? p.blocks.find(b => b.id === l.dataset.id) : null; }
function onInput(e){
  if(e.target.id === 'wlQ'){ return findRun(e.target.value); }
  if(e.target.id === 'wlTitle'){ const p = cur(); if(!p) return; beforeEdit(p); p.title = e.target.value; touch(p); if(p.kind === 'order') S.lineDirty = true; return; }
  const x = e.target.closest('.wl-x'); if(!x) return;
  const b = blockOf(x), p = cur(); if(!b) return;
  beforeEdit(p); mark(p, 'type:' + b.id);
  b.r = parseX(x);
  S.lineDirty = true;
  x.closest('.wl-b').classList.toggle('is-empty', isEmpty(b));
  touch(p);
  // 적으면서 모양 바꾸기
  if(!e.isComposing){
    const t = bText(b), m = t.match(/^(#{1,3}|\[\]|\[ \]|-|\*)\s/);
    if(m && (b.t === 'li' || b.t === 'p') && selIn(x) && selIn(x)[0] === m[0].length){
      const k = m[1], nt = k[0] === '#' ? 'h3' : k[0] === '[' ? 'todo' : 'li';
      if(nt !== b.t || nt === 'li'){ b.r = segSlice(b.r, m[0].length, 1e9); b.t = nt; if(nt === 'h3') b.lv = 0; renderPage(); focusB(b.id, 'start'); }
    }
  }
}
function putSegs(x, b, r, pos){ b.r = segNorm(r); x.innerHTML = deco(b); putSel(x, pos); x.closest('.wl-b').classList.toggle('is-empty', isEmpty(b)); S.lineDirty = true; touch(cur()); }
function onBeforeInput(e){
  const x = e.target.closest && e.target.closest('.wl-x'); if(!x) return;
  if(e.inputType === 'insertParagraph'){ e.preventDefault(); split(x); }
  else if(e.inputType === 'insertLineBreak'){ e.preventDefault(); const b = blockOf(x), s = selIn(x); if(!b || !s) return; beforeEdit(cur()); mark(cur()); putSegs(x, b, [...segSlice(b.r, 0, s[0]), {t:'\n'}, ...segSlice(b.r, s[1], 1e9)], s[0] + 1); }
  else if(/^format/.test(e.inputType)){ e.preventDefault(); if(e.inputType === 'formatBold') fmt('b'); if(e.inputType === 'formatUnderline') fmt('u'); if(e.inputType === 'formatStrikeThrough') fmt('s'); }
}
function split(x){
  const b = blockOf(x), s = selIn(x) || [1e9, 1e9], p = cur(); if(!b) return;
  b.r = parseX(x);
  if(isEmpty(b) && !isHead(b)){ if((b.lv || 0) > 0 && b.lv > baseLv(b)) return indent([b.id], -1); if(b.t === 'todo' || b.t === 'li') return; }
  edit(bs => {
    const i = bs.indexOf(b) >= 0 ? bs.indexOf(b) : bs.findIndex(q => q.id === b.id), cur0 = bs[i];
    const L = segSlice(cur0.r, 0, s[0]), R = segSlice(cur0.r, s[1], 1e9), kids = !isHead(cur0) && !cur0.f && subEnd(bs, i) > i + 1;
    if(isHead(cur0)){ cur0.r = segNorm(L); const n = nb({r:segNorm(R), lv:bs[i + 1] && !isHead(bs[i + 1]) && bs[i + 1].t !== 'hr' ? bs[i + 1].lv || 0 : 0}); delete cur0.f; bs.splice(i + 1, 0, n); S.fresh.add(n.id); return {focus:n.id, pos:'start'}; }
    if(s[0] === 0 && segLen(cur0.r)){ const n = nb({lv:cur0.lv, t:cur0.t}); bs.splice(i, 0, n); S.fresh.add(n.id); return {focus:cur0.id, pos:'start'}; }   // 줄 맨 앞에서 Enter = 위에 빈 줄
    cur0.r = segNorm(L);
    const n = nb({lv:(cur0.lv || 0) + (kids && !segLen(R) ? 1 : 0), t:cur0.t === 'quote' || cur0.t === 'callout' || cur0.t === 'code' ? 'p' : cur0.t, r:segNorm(R)});
    const at = cur0.f ? subEnd(bs, i) : i + 1;
    bs.splice(at, 0, n); S.fresh.add(n.id);
    return {focus:n.id, pos:'start'};
  });
}
const baseLv = b => { const p = cur(), s = sections(p.blocks).find(q => q.items.includes(b) || q.items.some(z => z.id === b.id)); return s ? Math.min(...s.items.map(q => q.lv || 0)) : 0; };
function onKey(e){
  const x = e.target.closest && e.target.closest('.wl-x');
  if(e.target.id === 'wlQ' && e.key === 'Escape'){ e.target.value = ''; findRun(''); renderTop(); return; }
  if(e.target.id === 'wlTitle'){ if(e.key === 'Enter' && !e.isComposing){ e.preventDefault(); e.target.blur(); } return; }
  if(!x || e.isComposing || e.keyCode === 229) return;
  const b = blockOf(x), p = cur(), mod = e.metaKey || e.ctrlKey; if(!b) return;
  if(mod && e.key === 'Enter'){ e.preventDefault(); if(!isHead(b)){ const pos = caretPos(); toggleDone(b.id); focusB(b.id, pos); } return; }
  if(mod && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); e.stopPropagation(); return undo(e.shiftKey); }
  if(mod && (e.key === 'y' || e.key === 'Y')){ e.preventDefault(); return undo(true); }
  if(mod && (e.key === 'b' || e.key === 'B')){ e.preventDefault(); return fmt('b'); }
  if(mod && e.key === 'a'){ const s = selIn(x); if(s && s[0] === 0 && s[1] === x.textContent.length){ e.preventDefault(); x.blur(); const v = visIds(); selRange(v[0], v[v.length - 1]); } return; }
  if(e.key === 'Tab'){ e.preventDefault(); if(!isHead(b)) indent([b.id], e.shiftKey ? -1 : 1); return; }
  if(e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')){ e.preventDefault(); return isHead(b) ? moveSec(b.id, e.key === 'ArrowUp' ? -1 : 1) : moveLine(b.id, e.key === 'ArrowUp' ? -1 : 1); }
  if(e.key === 'Escape'){ x.blur(); selRange(b.id, b.id); return; }
  const s = selIn(x);
  if(e.key === 'Backspace' && s && s[0] === 0 && s[1] === 0){
    e.preventDefault();
    b.r = parseX(x);
    if(isHead(b)){ if(isEmpty(b)){ edit(bs => { const i = bs.findIndex(q => q.id === b.id), pr = bs[i - 1]; bs.splice(i, 1); return pr && pr.t !== 'hr' ? {focus:pr.id} : undefined; }); } return; }
    if((b.lv || 0) > baseLv(b)) return indent([b.id], -1);
    const v = visIds(), vi = v.indexOf(b.id), pid = v[vi - 1], pb = pid && p.blocks.find(q => q.id === pid);
    if(!pb){ return; }
    if(isHead(pb) || pb.t === 'img' || pb.t === 'file'){ if(isEmpty(b)) edit(bs => { const i = bs.findIndex(q => q.id === b.id); if(subEnd(bs, i) > i + 1) return false; bs.splice(i, 1); return {focus:pb.id}; }); return; }
    return edit(bs => {
      const i = bs.findIndex(q => q.id === b.id), pos = segLen(pb.r);
      pb.r = segNorm([...(pb.r || []), ...(b.r || [])]);
      bs.splice(i, 1);
      return {focus:pb.id, pos};
    });
  }
  if(e.key === 'Delete' && s && s[0] === s[1] && s[0] === x.textContent.length && !isHead(b)){
    const i = idx(p, b.id), n = p.blocks[i + 1];
    if(n && !isHead(n) && n.t !== 'hr' && !n.src){ e.preventDefault(); b.r = parseX(x); const pos = segLen(b.r); edit(bs => { const j = bs.findIndex(q => q.id === b.id); bs[j].r = segNorm([...bs[j].r, ...(n.r || [])]); bs.splice(j + 1, 1); return {focus:b.id, pos}; }); }
    return;
  }
  if((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod && s){
    const up = e.key === 'ArrowUp';
    if(e.shiftKey){ const v = visIds(), j = v.indexOf(b.id) + (up ? -1 : 1); if(atEdge(x, up) && v[j]){ e.preventDefault(); x.blur(); selRange(b.id, v[j]); } return; }
    if(!atEdge(x, up)) return;
    const v = visIds(); let j = v.indexOf(b.id) + (up ? -1 : 1);
    while(v[j] && !xEl(v[j])) j += up ? -1 : 1;
    if(v[j]){ e.preventDefault(); focusB(v[j], Math.min(s[0], 1e6) === 0 ? 'start' : up ? s[0] : s[0]); }
  }
}
function atEdge(x, up){
  const s = getSelection(); if(!s.rangeCount) return true;
  const r = s.getRangeAt(0).cloneRange(); r.collapse(up);
  let q = r.getClientRects()[0];
  if(!q){ return !x.textContent || (up ? selIn(x)[0] === 0 : selIn(x)[1] === x.textContent.length) || x.getClientRects().length && x.offsetHeight < 34; }
  const bx = x.getBoundingClientRect(), lh = parseFloat(getComputedStyle(x).lineHeight) || 22;
  return up ? q.top - bx.top < lh * .8 : bx.bottom - q.bottom < lh * .8;
}
function onPaste(e){
  const x = e.target.closest && e.target.closest('.wl-x');
  const fs = [...((e.clipboardData || {}).files || [])];
  if(fs.length && (S.view === 'page' || S.view === 'order') && cur() && !e.target.closest('input,textarea')){ e.preventDefault(); e.stopPropagation(); return addFiles(fs, focusedId()); }
  if(!x) return;
  e.preventDefault(); e.stopPropagation();
  const txt = String(e.clipboardData.getData('text/plain') || '').replace(/\r/g, ''), b = blockOf(x), s = selIn(x) || [0, 0]; if(!b || !txt) return;
  const lines = txt.split('\n').filter((l, i, a) => l.trim() || (a.length === 1));
  b.r = parseX(x);
  if(lines.length <= 1){
    const t = lines[0] || '';
    if(/^https?:\/\/\S+$/.test(t.trim()) && s[1] > s[0]){ beforeEdit(cur()); mark(cur()); return putSegs(x, b, [...segSlice(b.r, 0, s[0]), ...segSlice(b.r, s[0], s[1]).map(q => Object.assign(q, {a:t.trim()})), ...segSlice(b.r, s[1], 1e9)], s[1]); }
    beforeEdit(cur()); mark(cur());
    return putSegs(x, b, [...segSlice(b.r, 0, s[0]), {t}, ...segSlice(b.r, s[1], 1e9)], s[0] + t.length);
  }
  edit(bs => {
    const i = bs.findIndex(q => q.id === b.id), L = segSlice(b.r, 0, s[0]), R = segSlice(b.r, s[1], 1e9);
    const ind = lines.map(l => (l.match(/^[\t ]*/)[0].replace(/\t/g, '    ').length)), min = Math.min(...ind), steps = [...new Set(ind.map(v => v - min))].sort((a, c) => a - c);
    const made = lines.map((l, k) => {
      let t = l.trim(), typ = isHead(b) ? 'li' : b.t === 'img' ? 'li' : b.t, dn = 0, m;
      if((m = t.match(/^[-*•▪◦‣·]\s+/))){ t = t.slice(m[0].length); typ = 'li'; }
      else if((m = t.match(/^\d{1,2}[.)]\s+/))){ typ = 'li'; }
      if((m = t.match(/^\[( |x|X|v)\]\s*/))){ t = t.slice(m[0].length); typ = 'todo'; dn = m[1] !== ' ' ? 1 : 0; }
      else if((m = t.match(/^✓\s+/))){ t = t.slice(m[0].length); dn = 1; }
      else if((m = t.match(/^#{1,3}\s+/))){ t = t.slice(m[0].length); typ = 'h3'; }
      const n = nb({t:typ, lv:typ === 'h3' ? 0 : (b.lv || 0) + steps.indexOf(ind[k] - min), r:t ? T(t) : []}); if(dn) n.k = 1; return n;
    });
    const last = made[made.length - 1];
    if(isEmpty(b) && !isHead(b)) bs.splice(i, 1, ...made);
    else if(/^\s*\n/.test(txt) && !isHead(b)){ bs[i].r = segNorm(L); bs.splice(subEnd(bs, i), 0, ...made); }
    else{ const f = bs[i]; f.r = segNorm([...L, ...made[0].r]); made.shift(); bs.splice(i + 1, 0, ...made); }
    const end = last === made[made.length - 1] ? last : bs[i], pos = segLen(end.r);
    end.r = segNorm([...end.r, ...R]);
    return {focus:end.id, pos};
  });
}
/* ── 글자 서식 막대 ── */
function fmt(k, v){
  const x = document.activeElement; if(!x || !x.classList.contains('wl-x')) return;
  const b = blockOf(x), s = selIn(x); if(!b || !s || s[0] === s[1]) return;
  b.r = parseX(x);
  const mid = segSlice(b.r, s[0], s[1]);
  beforeEdit(cur()); mark(cur());
  if(k === 'clear') mid.forEach(q => { MK.forEach(m => delete q[m]); delete q.h; delete q.a; });
  else if(k === 'h'){ const on = mid.every(q => q.h === v); mid.forEach(q => { if(on) delete q.h; else q.h = v; }); }
  else if(k === 'a'){ const u = v != null ? v : prompt('링크 주소', (mid.find(q => q.a) || {}).a || 'https://'); if(u == null) return; mid.forEach(q => { if(u && /^https?:\/\//.test(u)) q.a = u; else delete q.a; }); }
  else{ const on = mid.every(q => q[k]); mid.forEach(q => { if(on) delete q[k]; else q[k] = 1; }); }
  b.r = segNorm([...segSlice(b.r, 0, s[0]), ...mid, ...segSlice(b.r, s[1], 1e9)]);
  x.innerHTML = deco(b); putSel(x, s[0], s[1]); S.lineDirty = true; touch(cur());
}
function barSync(){
  const x = document.activeElement;
  if(!x || !x.classList || !x.classList.contains('wl-x')) return hideBar();
  const s = selIn(x); if(!s || s[0] === s[1]) return hideBar();
  let el = document.getElementById('wlBar');
  if(!el){
    el = document.createElement('div'); el.id = 'wlBar'; el.className = 'wl-bar';
    el.innerHTML = '<button type="button" data-k="b" title="굵게 (Ctrl B)"><b>B</b></button><button type="button" data-k="s" title="취소선"><s>S</s></button><button type="button" data-k="h" data-v="yellow_background" title="형광펜"><span class="wl-h-yellow_background">가</span></button><button type="button" data-k="h" data-v="red" title="빨간 글자"><span class="wl-h-red">가</span></button><button type="button" data-k="a" title="링크">🔗</button><button type="button" data-k="clear" title="서식 지우기">⊘</button>';
    el.addEventListener('mousedown', e => { e.preventDefault(); const b = e.target.closest('button'); if(b) fmt(b.dataset.k, b.dataset.v); });
    document.body.appendChild(el);
  }
  const r = getSelection().getRangeAt(0).getBoundingClientRect();
  el.hidden = false;
  el.style.left = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, r.left + r.width / 2 - el.offsetWidth / 2)) + 'px';
  el.style.top = (r.top > 60 ? r.top - el.offsetHeight - 8 : r.bottom + 8) + 'px';
}
function hideBar(){ const el = document.getElementById('wlBar'); if(el) el.hidden = true; }

/* ============================================================ 시작 ============================================================ */
let inited = false;
async function init(){
  try{ if(typeof designHasAccess === 'function' && !designHasAccess()) return; }catch(e){}
  if(!mount()) return;
  if(!inited){
    inited = true;
    if(cacheRead()) renderAll(); else renderMain();
    restoreDirty();
    try{ if(typeof _dslLoadHol === 'function') _dslLoadHol().then(() => renderBoard()).catch(() => {}); }catch(e){}
    addEventListener('scroll', stripSync, {passive:true}); addEventListener('resize', () => { stripSync(); clearTimeout(S.rz); S.rz = setTimeout(() => { if(!editing() && visible() && S.view === 'page') renderPage(); }, 250); });
    document.addEventListener('visibilitychange', () => { if(document.hidden){ if(S.dirty.size){ persistDirty(); flush(); } } else poll(); });
    addEventListener('online', () => { if(S.dirty.size) flush(); else poll(); });
    addEventListener('pagehide', () => { if(S.dirty.size){ persistDirty(); flush(); } });
    addEventListener('beforeunload', e => { if(S.dirty.size){ persistDirty(); flush(); e.preventDefault(); e.returnValue = ''; } });
    let pollAt = 0;
    setInterval(() => { const live = window.OfficeLive && window.OfficeLive.ok(); if(live && Date.now() - pollAt < 60000) return; pollAt = Date.now(); poll(); }, POLL_MS);   // 알림선이 이어져 있으면 1분에 한 번만 확인
    if(window.OfficeLive) window.OfficeLive.on(['dlog_pages', 'dlog_board', 'dlog_checks'], () => poll());
    setInterval(() => { if(!visible() || document.hidden) return; if(Date.now() - inb.at > 5 * 60000) inbTick(true); else if(!editing()) renderBoard(); }, 60000);
  }
  const was = S.ready;
  await boot();
  if(!editing() && !S.ptr) renderAll(); else S.defer = true;
  if(S.dirty.size) scheduleSave(100);
  if(!S.ready && S.err) setTimeout(() => { if(!S.ready && visible()) init(); }, 10000);
  if(S.ready) inbTick(false);
}
/* 오피스 홈 카드의 '오늘 루틴 n' — 디자인팀 명단 PC 에서만 */
let homeAt = 0;
async function homeBadge(){
  try{
    if(typeof designHasAccess === 'function' && !designHasAccess()) return badge(0);
    if(inited || Date.now() - homeAt < 60000) return;
    homeAt = Date.now();
    const j = await rpc('dlog_boot', {p_recent:0});
    S.board = new Map((j.board || []).map(b => [b.id, b])); S.checks = new Map((j.checks || []).map(c => [ckKey(c.item, c.day), c])); S.today = j.today || S.today;
    badge(leftToday().length);
    await autoRoutines(); badge(leftToday().length);
  }catch(e){}
}
window.WL = {ready:true, init, homeBadge, stripSync, _:{S, inb, inbOf, inbTick, upcoming, todayItems, ordersOf2:ordersOf, merge3, carry, sections, isDue, state, parseX, deco, diffOf, ageMap, ordersOf, stOf, segNorm, newPage, openPage, flush, poll, renderAll}};
})();
