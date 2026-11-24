/* 발주 매핑하기 (2026-11-24 사장님 "erp 발주일 자동 매칭중에 지금 매핑 안된거 제품명이나 옵션명 검색해서 erp처럼 바로 매핑 할 수 있게 해줘. 유사이름이라도 뜨게")
   물류팀 'ERP 발주일 자동 매칭' · 발주 확인 필요 알림 · 최근 발주 표의 빨간 ERP 딱지에서 [매핑하기] → 재고 ERP 줄을 찾아 고르면 끝.
   · 찾기 = 상품명 · 옵션. 띄어 쓴 낱말이 안 맞아도 비슷한 이름까지: 오타(roset → Rosette · Vintage Rose), 한글로 친 영문 이름(코프스 → Coffs),
     자주 쓰는 한글 낱말(퍼피백 → puppy bag). 안 치면 메모 · 같은 1688 상품으로 추천.
   · 저장 = Supabase po_map (po_map_set) 하나. 여기서 재고 ERP 를 직접 고치지 않는다 — 맥미니 po_match.py(8번)가 읽어 발주일(N) · 발주 수량(O)에 적는다
     (쓰는 곳은 하나: 두 번 안 적힘 · 적기 직전 값 확인 · 입고 휴지통 정리까지 원래 길 그대로). 저장하면 프록시에 바로 한 번 돌려 달라고 해서 1~2분 안에 적힌다.
   · 세트 발주는 줄을 여러 개 고른다 — 줄마다 같은 수량(세트) / 나눠서. 상품이 아니거나 이미 적은 발주는 [안 적기].
   · 아직 안 적힌 것은 [되돌리기] (po_map_off). 적힌 뒤에는 ERP 에서 고친다.
   index.html 이 맨 끝에서 부른다. index.html 쪽 손댄 곳: pomLoad(overlay) · renderPoMatchBox · attachPoMatchChips · _poaErpRow · _pomNeedsCheck */
(function () {
'use strict';
if (window.PoMap) return;
const LABEL = {apt: '아페티', kop: '코페리', koz: '코즈미', '6a': '식스에이', yar: '야르', pp: '프피', akoi: '아코이'};
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const n = v => Number(v || 0).toLocaleString('ko-KR');
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const key = r => `${r.b}|${clean(r.n)}|${clean(r.o)}`;

/* ── 찾기 (비슷한 이름까지) ── */
const KO_EN = {'퍼 스트랩': '퍼스트랩', '퍼백 스트랩': '퍼스트랩', '투웨이': '2 way', '퍼피백': 'puppy bag', '퍼퍼백': 'puppy bag', '퍼피': 'puppy', '버니백': 'bunny bag', '버니': 'bunny', '코듀': 'cordu', '도트백': 'dot bag', '도트': 'dot',
  '코발트니백': 'cobaltiny bag', '코발티니백': 'cobaltiny bag', '코발티니': 'cobaltiny', '버클리백': 'bukley bag', '셔링백': 'shirring bag', '빈타백': 'vinta bag', '퍼스트큐백': 'first q bag', '퍼스트큐': 'first q', '히피백': 'hippy bag', '히피': 'hippy',
  '벨트': 'belt', '나일론': 'nylon', '백팩': 'backpack', '키링': 'keyring', '호보백': 'hobo bag', '스터드': 'stud', '하트': 'heart', '타이니': 'tiny', '큐브': 'qube', '실린더': 'cylinder', '덤핑백': 'dumping bag', '머쉬백': 'mush bag',
  '빈티지': 'vintage', '로즈': 'rose', '플라워': 'flower', '크로스': 'cross', '스타': 'star', '체인': 'chain', '레이어': 'layer', '베이비': 'baby', '세트': 'set', '반지': 'ring', '목걸이': 'necklace', '팔찌': 'bracelet', '링': 'ring', '백': 'bag',
  '화이트': 'white', '블랙': 'black', '브라운': 'brown', '그레이': 'gray', '차콜': 'charcoal', '베이지': 'beige', '아이보리': 'ivory', '민트': 'mint', '라임': 'lime', '실버': 'silver', '골드': 'gold', '크림': 'cream', '네이비': 'navy',
  '검은색': 'black', '검정': 'black', '흰색': 'white', '은색': 'silver', '금색': 'gold', '레드': 'red', '핑크': 'pink', '블루': 'blue', '올리브': 'olive', '와인': 'wine', '카키': 'khaki', '银色': 'silver', '金色': 'gold', '白色': 'white', '黑色': 'black', '粉色': 'pink', '蓝色': 'blue', '绿色': 'green', '红色': 'red', '咖啡色': 'brown', '米色': 'beige', '灰色': 'gray'};
const LOW = new Set(['ring', 'rings', 'necklace', 'bracelet', 'open', 'set', 'color', 'colour', 'style', 'size', 'option', 'the', 'and', 's', 'silver', 'bag', '925', 'type', 'sale', 'ver', 'event']);
const strip = s => String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFC');
const norm = s => strip(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
const words = s => norm(s).replace(/([a-z])([0-9])/g, '$1 $2').replace(/([0-9])([a-z])/g, '$1 $2').replace(/[^0-9a-z가-힣ㄱ-ㅎ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
const compact = s => norm(s).replace(/[^0-9a-z가-힣]+/g, '');
const isKo = s => /[가-힣]/.test(s);
function lev(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return a.length || b.length;
  let p2 = null, p = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const c = [i];
    for (let j = 1; j <= b.length; j++) {
      c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) c[j] = Math.min(c[j], p2[j - 2] + 1);   // 옆 글자 바뀜
    }
    p2 = p; p = c;
  }
  return p[b.length];
}
const ratio = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
// 한글로 친 영문 이름 — 소리로 비교: 코프스 · Coffs = kops, 글레이즈 · Glaze = kres, 문글로우 · Moon Glow = monkro
//   자음은 비슷한 소리끼리 한 글자로, 모음은 앞소리 e(ㅏㅐㅓㅔㅣ · a e i y) / 뒷소리 o(ㅗㅜ · o u w) 둘로만, ㅡ 는 뺌. bone = 자음만
const CHO = ['g', 'k', 'n', 'd', 't', 'r', 'm', 'b', 'p', 's', 's', '', 'j', 'j', 'j', 'k', 't', 'p', ''];
const JUNG = ['a', 'e', 'a', 'e', 'a', 'e', 'a', 'e', 'o', 'oe', 'oe', 'oe', 'o', 'o', 'oe', 'oe', 'oe', 'o', '', 'e', 'e'];
const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'r', 'k', 'm', 'r', 'r', 'r', 'p', 'r', 'm', 'p', 'p', 't', 't', 'n', 't', 't', 'k', 't', 'p', ''];
const CLS = {b: 'p', p: 'p', f: 'p', v: 'p', d: 't', t: 't', g: 'k', k: 'k', q: 'k', c: 'k', s: 's', z: 's', j: 's', x: 's', l: 'r', r: 'r', m: 'm', n: 'n', a: 'e', e: 'e', i: 'e', y: 'e', o: 'o', u: 'o', w: 'o'};
const SND = new Map();
function sound(s) {
  if (SND.has(s)) return SND.get(s);
  let t = '';
  for (const ch of norm(s)) { const c = ch.charCodeAt(0) - 0xac00; if (c >= 0 && c < 11172) t += CHO[Math.floor(c / 588)] + JUNG[Math.floor(c / 28) % 21] + JONG[c % 28]; else t += ch; }
  if (/[a-z]{4,}$/.test(t) && !isKo(s)) t = t.replace(/([^aeiouy])e$/, '$1');   // 소리 없는 끝 e
  t = t.replace(/ph/g, 'f').replace(/[cs]h/g, 's').replace(/ck/g, 'k').replace(/ng/g, 'n').replace(/x/g, 'ks').replace(/c(?=[eiy])/g, 's').replace(/g(?=[eiy])/g, 'j');
  let o = '';
  for (const ch of t) { const k = CLS[ch]; if (k && o[o.length - 1] !== k) o += k; }
  if (SND.size > 8000) SND.clear();
  SND.set(s, o);
  return o;
}
const bone = s => sound(s).replace(/[eo]/g, '').replace(/(.)\1+/g, '$1');
function heard(q, t) {   // 한글 q ↔ 영문 t
  const a = bone(q), b = bone(t); if (a.length < 2 || b.length < 2) return 0;
  const rb = ratio(a, b), rs = ratio(sound(q), sound(t));
  return rb >= .66 && rs >= .6 ? .9 * (.35 * rb + .65 * rs) : 0;
}
const koEn = s => { let t = ' ' + norm(s) + ' '; for (const k in KO_EN) if (t.includes(k)) t = t.split(k).join(` ${KO_EN[k]} `); return t; };
function tok(q, t) {
  if (q === t) return 1;
  if (/^\d+$/.test(q)) return 0;          // 숫자는 똑같을 때만
  if (q.length >= 2 && t.startsWith(q)) return .95;
  if (q.length >= 3 && t.includes(q)) return .86;
  if (t.length >= 3 && q.startsWith(t)) return .72 + .2 * t.length / q.length;
  const ko = isKo(q), kt = isKo(t);
  if (ko && !kt) return heard(q, t);
  if (ko !== kt || Math.min(q.length, t.length) < (ko ? 2 : 3)) return 0;
  const r = ratio(q, t);
  return r >= .6 ? r * .9 : 0;
}
const PAREN = {w: 'white', b: 'black', bl: 'black', br: 'brown'};          // 'puppy bag (W)' · '(BL)'
function prep(r) {
  const nm = words(r.n), op = words(String(r.o || '').replace(/^\s*[^:：]{1,16}[:：]/, ' ')), pc = norm(r.n).match(/\(\s*(w|bl|br|b)\s*\)/);
  r.t = [...new Set([...nm, ...op, ...words(r.lab), ...(pc ? [PAREN[pc[1]]] : [])])];
  r.c = compact(r.n + r.o); r.cn = compact(r.n);
  r.sn = nm.filter(w => !LOW.has(w) && /^[a-z]+$/.test(w)).join('');
  return r;
}
const grams = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
function dice(a, b) { if (a.length < 3 || b.length < 3) return 0; const x = grams(a), y = grams(b); let k = 0; x.forEach((v, g) => { k += Math.min(v, y.get(g) || 0); }); return 2 * k / (a.length + b.length - 2); }
/* 찾는 말 하나 → 줄마다 0~1. all = 낱말이 모두 또렷이 맞음 */
function score(q, r) {
  let best = {s: 0, all: false};
  const forms = [words(q)];
  const en = words(koEn(q));
  if (en.join(' ') !== forms[0].join(' ')) forms.push(en);
  for (const qs of forms) {
    if (!qs.length) continue;
    const strong = qs.some(w => !LOW.has(w) && !/^\d+$/.test(w));
    let W = 0, S = 0, all = true, hit = 0;
    for (const w of qs) {
      let m = 0;
      for (const t of r.t) { const v = tok(w, t); if (v > m) { m = v; if (v === 1) break; } }
      const wt = strong && LOW.has(w) ? .35 : /^\d+$/.test(w) ? 1.5 : Math.min(Math.max(isKo(w) ? w.length * 1.6 : w.length, 2), 6);
      W += wt; S += wt * m; if (m < .8) all = false; if (m >= .8) hit++;
    }
    let s = S / W + .03 * Math.min(1, hit / Math.max(r.t.length, 1));
    const cq = qs.join('');
    if (cq.length >= 3 && r.c.includes(cq)) { s = Math.max(s, .98); all = true; }
    else s = Math.max(s, dice(cq, r.cn) * .92);
    if (isKo(cq) && r.sn.length >= 3 && !/\d/.test(cq)) { const h = heard(cq, r.sn); if (h > s) { s = h; if (h >= .85) all = true; } }          // 붙여 친 한글 이름 (문글로우)
    if (s > best.s) best = {s, all};
  }
  return best;
}
function find(rows, q, bonus) {
  const min = words(q).length > 1 ? .5 : .56;
  return rows.map(r => { const x = score(q, r); return {r, s: x.s + (x.s > .4 && bonus ? bonus(r) : 0), all: x.all}; }).filter(x => x.s >= min).sort((a, b) => (b.all - a.all) || b.s - a.s || a.r.n.localeCompare(b.r.n) || a.r.r - b.r.r);
}
/* 메모에서 찾을 말 뽑기 — 브랜드 표시 뒤 이름(서버 hint)이 먼저, 없으면 영문 이름(업체 코드 JZ1234 · 출고 글 LCL 은 뺌) */
function memoQuery(it) {
  const h = String(it.hint || '').split(' · ');
  if (h[1]) return /^신상\s*\d*$/.test(h[1]) ? '' : h[1];          // '신상14' 는 상품 이름이 아님
  const tag = strip(it.memo).match(/[[({]\s*(?:아페티|코페리|야르|코즈미|아코이|프피|식스에이)[^\])}]{0,6}[\])}]\s*(?:반지|목걸이|팔찌|발찌|귀걸이)?\s*(.{1,40}?)\s*(?:이)?\s*라고/);
  if (tag && tag[1].trim()) return tag[1].trim();
  const m = strip(it.memo).replace(/\b[A-Z]{1,3}-?\d{3,6}[A-Z]?/g, ' ').replace(/(?<![A-Za-z])(LCL|FREE|OK|PDF)(?![A-Za-z])/gi, ' ');
  const en = (m.match(/[A-Za-z][A-Za-z']{2,}/g) || []).slice(0, 6), ko = Object.keys(KO_EN).filter(k => isKo(k) && k.length >= 2 && m.includes(k)).slice(0, 4), zh = Object.keys(KO_EN).filter(k => /[一-鿿]/.test(k) && m.includes(k)).map(k => KO_EN[k]);
  return [...en, ...ko, ...(en.length || ko.length ? zh : [])].join(' ');
}
function suggest(rows, it) {
  const out = [], seen = new Set(), by = new Map(rows.map(r => [key(r), r]));
  const add = (r, why) => { if (!r || seen.has(key(r)) || out.length >= 8) return; seen.add(key(r)); out.push({r, why}); };
  if (it.n && it.state === 'check') add(by.get(key(it)), it.how === 'code' ? '같은 업체 코드' : '같은 1688 상품');
  (it.cands || []).forEach(c => add(by.get(key(c)), it.how === 'alias' ? '지난번에 이은 줄' : it.how === 'offer' ? '같은 1688 상품' : it.how === 'code' ? '같은 업체 코드' : '메모에 적힌 이름'));
  const q = memoQuery(it), hb = String(it.hint || '').split(' · ')[0], mine = /SB/.test(it.acct || '') ? ['apt', 'kop', 'koz'] : ['6a', 'yar', 'pp', 'akoi'];
  if (q) find(rows, q, r => r.b === hb ? .1 : mine.includes(r.b) ? .04 : 0).filter(x => x.all || x.s >= .58).slice(0, 8).forEach(x => add(x.r, x.all ? '이름이 맞음' : '비슷한 이름'));
  return out;
}

/* ── 자료 ── */
const D = {rows: null, at: 0, busy: null};
async function get(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {headers: _sbHeaders(), cache: 'no-store'});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json(); if (!Array.isArray(j)) throw new Error('모양이 달라요');
  return j;
}
async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {method: 'POST', headers: _sbHeaders(), body: JSON.stringify(body)});
  if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch (e) {} throw new Error(m || 'HTTP ' + r.status); }
  return r.json();
}
const ERR = {already_written: '이미 ERP 에 적힌 발주예요 — 바꾸려면 ERP 에서 고쳐 주세요', no_row: '고른 줄이 방금 바뀌었어요 — 다시 찾아 골라 주세요', bad_qty: '수량을 1 이상 숫자로 적어 주세요', dup_target: '같은 줄을 두 번 골랐어요', bad_targets: '재고 줄을 하나 이상(8줄까지) 골라 주세요'};
const errMsg = e => { const m = String((e && e.message) || e); for (const k in ERR) if (m.includes(k)) return ERR[k]; return '저장하지 못했어요 — 다시 눌러 주세요'; };
/* 재고 줄 — 서버 판단(po_match.py)과 같은 줄만: ⚠ · 묶음 · 중복 · B급은 뺌 */
async function loadRows(force) {
  if (!force && D.rows && Date.now() - D.at < 60e3) return D.rows;
  if (D.busy) return D.busy;
  D.busy = (async () => {
    const tabs = await get('erp_tabs?select=gid,name,pos&kind=eq.stock&alive=is.true&deleted_at=is.null&order=pos.asc');
    const gb = new Map(); Object.keys(LABEL).forEach(b => { const t = tabs.find(x => String(x.name).includes(LABEL[b] + '송장출력')); if (t) gb.set(String(t.gid), b); });
    if (!gb.size) throw new Error('재고 탭을 못 찾음');
    const out = [], gs = [...gb.keys()].map(encodeURIComponent).join(',');
    for (let off = 0; off < 20000; off += 1000) {
      const p = await get(`erp_rows?select=gid,r,c:v->>0,n:v->>1,o:v->>2,L:v->>11,N:v->>13,O:v->>14&deleted_at=is.null&gid=in.(${gs})&v->>1=neq.&order=gid.asc,r.asc&limit=1000&offset=${off}`);
      p.forEach(x => { const nm = clean(x.n), c = clean(x.c); if (!nm || nm === '상품명' || /^(⚠|묶음|중복)/.test(c) || nm.startsWith('B급')) return; out.push(prep({b: gb.get(String(x.gid)), lab: LABEL[gb.get(String(x.gid))], r: x.r, n: nm, o: clean(x.o), L: String(x.L == null ? '' : x.L).trim(), N: String(x.N == null ? '' : x.N), O: String(x.O == null ? '' : x.O).trim()})); });
      if (p.length < 1000) break;
    }
    if (out.length < 100) throw new Error('재고 줄이 너무 적음');
    D.rows = out; D.at = Date.now();
    return out;
  })();
  try { return await D.busy; } finally { D.busy = null; }
}
/* 방금 이은 것 — 맥미니 결과(5분 · 바로 돌려도 1~2분)가 오기 전까지 '확인 필요'에 다시 뜨지 않게 저장소의 이은 것을 덧입힌다 (다른 PC 도 같이) */
async function overlay(d) {
  const ms = await get('po_map?select=sn,targets,skip,who,created_at&deleted_at=is.null&order=id.desc&limit=300');
  const by = new Map(ms.map(m => [m.sn, m]));
  d.items.forEach(it => {
    const m = by.get(it.sn);
    if (!m && it.map && !['written', 'received', 'entered'].includes(it.state)) { it.mapOff = 1; return; }   // 방금 되돌림 — 다음 결과에서 다시 판단
    if (!m || it.map || !['check', 'ambiguous', 'unmatched', 'skipped', 'material', 'sample'].includes(it.state)) return;
    it.mapLocal = m; it.mapLost = false;
    if (m.skip) { it.state = 'ignored'; it.why = `사람이 '안 적기'로 정함 (${m.who})`; return; }
    const t = (m.targets || [])[0] || {};
    it.state = 'todo'; it.b = t.b; it.n = t.n; it.o = t.o; it.why = '';
    it.planQty = (m.targets || []).reduce((s, x) => s + (Number(x.q) || 0), 0) || it.qty || 1;
    it.mapN = (m.targets || []).length;
  });
}
const canMap = it => !!it && !it.of && (it.mapLost || ['check', 'ambiguous', 'unmatched'].includes(it.state));
const canUndo = it => !!it && !it.of && !it.mapOff && (it.mapLocal || it.map) && ['todo', 'pending', 'ignored', 'entered', 'skipped'].includes(it.state);
const btn = (it, cls) => canMap(it) ? `<button type="button" class="pmap-b ${cls || ''}" data-pmap="${E(it.sn)}">매핑하기</button>` : '';
const undo = it => canUndo(it) ? `<button type="button" class="pmap-u" data-pmap-off="${E(it.sn)}">되돌리기</button>` : '';

/* ── 창 ── */
const M = {it: null, rows: null, q: '', picks: [], per: 'each', remember: true, busy: false, msg: '', bad: '', skipAsk: false, el: null, tm: 0};
const qtyOf = it => Number(it.planQty || it.qty || 0);
const dates = (txt, ref) => { const out = [], ry = +ref.slice(0, 4); String(txt || '').split('\n').forEach(line => { const m = line.match(/(?:(20\d{2})\s*[-./년]\s*)?(\d{1,2})\s*[-./월]\s*(\d{1,2})/); if (!m) return; const t = Date.parse(`${m[1] || ry}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}T00:00:00+09:00`); if (isFinite(t)) out.push([t, line.trim()]); }); return out; };
function near(r, it) { const t0 = Date.parse(it.date + 'T00:00:00+09:00'); const h = dates(r.N, it.date).find(([t]) => { const d = (t - t0) / 864e5; return d >= -4 && d <= 2; }); return h ? h[1] : ''; }
const oNum = s => { const t = String(s || '').replace(/,/g, '').trim(); if (!t) return 0; const p = t.split(/[\n+]/).map(x => x.trim()).filter(Boolean); return p.every(x => /^\d+(\.\d+)?$/.test(x)) ? p.reduce((a, x) => a + Number(x), 0) : null; };
function css() {
  if (document.getElementById('pmapCss')) return;
  const s = document.createElement('style'); s.id = 'pmapCss';
  s.textContent = `
.pmap-b{flex:none;height:26px;padding:0 10px;border:0;border-radius:6px;background:var(--danger,#dc2626);color:#fff;font:inherit;font-size:12px;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap}
.pmap-b.line{background:var(--bg-1,#fff);color:var(--text-2,#444);border:1px solid var(--line,#ddd);font-weight:600}
.pmap-u{flex:none;border:0;background:transparent;color:var(--text-3,#777);font:inherit;font-size:11.5px;text-decoration:underline;cursor:pointer;padding:2px 4px}
.pmap-act{grid-column:1/-1;display:flex;gap:8px;align-items:center;margin-top:4px}
.pom-more{margin-top:10px;font-size:11.5px;color:var(--text-3,#777)}.pom-more summary{cursor:pointer;font-weight:700;padding:3px 0}
.kd-erp[data-pmap]{cursor:pointer}.kd-erp[data-pmap]:hover{text-decoration:underline}
#pmapScrim{position:fixed;inset:0;z-index:99980;background:rgba(15,23,42,.45)}
#pmapDlg{position:fixed;z-index:99981;left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,calc(100vw - 24px));max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;background:var(--bg-1,#fff);color:var(--text-1,#1f2329);border-radius:14px;box-shadow:0 24px 60px rgba(15,23,42,.28);font-size:13px;line-height:1.5;text-align:left}
#pmapDlg button{font:inherit;cursor:pointer}#pmapDlg input{font:inherit}
#pmapDlg .h{flex:none;display:flex;gap:10px;align-items:flex-start;padding:15px 18px 11px;border-bottom:1px solid var(--line,#e5e7eb)}
#pmapDlg .h h2{margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em}#pmapDlg .h p{margin:2px 0 0;font-size:12px;color:var(--text-3,#777)}
#pmapDlg .x{margin-left:auto;flex:none;width:34px;height:34px;border:0;border-radius:8px;background:transparent;color:var(--text-3,#777);font-size:17px}
#pmapDlg .b{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:13px 18px 8px}
#pmapDlg .src{display:flex;gap:12px;padding:10px 12px;border:1px solid var(--line,#e5e7eb);border-radius:10px;background:var(--bg-2,#f8fafc)}
#pmapDlg .src img,#pmapDlg .src .no{flex:none;width:64px;height:64px;border-radius:8px;object-fit:cover;border:1px solid var(--line,#e5e7eb);background:#fff;cursor:zoom-in}
#pmapDlg .src .no{display:grid;place-items:center;color:var(--text-3,#999);font-size:11px;cursor:default}
#pmapDlg .src .t{min-width:0;flex:1}#pmapDlg .src .m{font-family:var(--mono,monospace);font-size:11.5px;color:var(--text-3,#777)}#pmapDlg .src .m b{font-family:inherit;color:var(--text-1,#1f2329);font-size:13px}
#pmapDlg .src .memo{margin-top:2px;font-size:13px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#pmapDlg .src .why{margin-top:3px;font-size:11.5px;color:var(--danger,#dc2626)}
#pmapDlg .f{margin-top:12px;width:100%;height:42px;padding:0 12px;border:1px solid var(--line,#d5d9e0);border-radius:10px;font-size:16px;background:var(--bg-1,#fff);color:inherit;outline:0;box-sizing:border-box}
#pmapDlg .f:focus,#pmapDlg .f:focus-visible{border-color:var(--text-1,#1f2329);outline:0}
#pmapDlg .s{margin-top:12px;font-size:11.5px;font-weight:700;color:var(--text-3,#777)}
#pmapDlg .l{margin-top:5px;border:1px solid var(--line,#e5e7eb);border-radius:10px;overflow:hidden}
#pmapDlg .r{width:100%;display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:46px;padding:6px 11px;border:0;border-bottom:1px solid var(--line,#eef0f3);background:var(--bg-1,#fff);color:inherit;text-align:left}
#pmapDlg .r:last-child{border-bottom:0}#pmapDlg .r:hover{background:var(--bg-2,#f8fafc)}#pmapDlg .r.on{background:var(--bg-2,#f1f4f8)}
#pmapDlg .bx{width:18px;height:18px;border-radius:5px;border:1.5px solid #c3c9d2;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:800}#pmapDlg .r.on .bx{background:var(--text-1,#1f2329);border-color:var(--text-1,#1f2329)}
#pmapDlg .tx{min-width:0}#pmapDlg .tx b{display:block;font-size:13.5px;font-weight:700;overflow-wrap:anywhere}#pmapDlg .tx b i{font-style:normal;font-weight:600;color:var(--text-3,#777);margin-right:5px}
#pmapDlg .tx small{display:block;font-size:12px;color:var(--text-3,#777);overflow-wrap:anywhere}#pmapDlg .tx .w{display:inline-block;margin-left:6px;padding:0 6px;border-radius:5px;background:var(--bg-3,#eceff3);color:var(--text-2,#555);font-size:11px;font-weight:600}
#pmapDlg .q{font-size:12px;color:var(--text-3,#777);white-space:nowrap;font-variant-numeric:tabular-nums;text-align:right}
#pmapDlg .none{padding:13px 12px;color:var(--text-3,#777);font-size:12.5px}
#pmapDlg .p{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:7px 11px;border-bottom:1px solid var(--line,#eef0f3)}#pmapDlg .p:last-child{border-bottom:0}
#pmapDlg .p input{width:92px;height:36px;padding:0 9px;border:1px solid var(--line,#d5d9e0);border-radius:8px;text-align:right;font-size:16px;font-variant-numeric:tabular-nums;background:var(--bg-1,#fff);color:inherit}
#pmapDlg .del{width:34px;height:34px;border:0;border-radius:8px;background:transparent;color:var(--text-3,#999)}
#pmapDlg .seg{display:inline-flex;gap:2px;margin-top:8px;padding:3px;border-radius:9px;background:var(--bg-3,#eef1f5)}#pmapDlg .seg button{height:30px;padding:0 12px;border:0;border-radius:7px;background:transparent;color:var(--text-3,#777);font-size:12.5px}#pmapDlg .seg .on{background:var(--bg-1,#fff);color:var(--text-1,#1f2329);font-weight:700}
#pmapDlg .c{display:flex;gap:8px;align-items:flex-start;margin-top:11px;font-size:12.5px;color:var(--text-2,#444);cursor:pointer}#pmapDlg .c input{width:17px;height:17px;margin:2px 0 0;accent-color:#1f2329}
#pmapDlg .v{margin-top:11px;padding:9px 12px;border:1px solid var(--line,#e5e7eb);border-radius:10px;background:var(--bg-2,#f8fafc);font-size:12.5px;line-height:1.65;color:var(--text-2,#444)}#pmapDlg .v b{color:var(--text-1,#1f2329)}#pmapDlg .v .bad{color:var(--danger,#dc2626)}
#pmapDlg .e{margin-top:9px;font-size:12.5px;font-weight:600;color:var(--danger,#dc2626)}
#pmapDlg .ft{flex:none;display:flex;gap:8px;align-items:center;padding:11px 18px calc(13px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line,#e5e7eb)}
#pmapDlg .ft button{height:40px;padding:0 15px;border:1px solid var(--line,#d5d9e0);border-radius:9px;background:var(--bg-1,#fff);color:var(--text-2,#444);font-weight:600;white-space:nowrap}#pmapDlg .ft .sk{margin-right:auto}#pmapDlg .ft .sk.ask{border-color:var(--danger,#dc2626);color:var(--danger,#dc2626)}
#pmapDlg .ft .go{border-color:#1f2329;background:#1f2329;color:#fff;font-weight:700}#pmapDlg .ft .go:disabled{opacity:.35;cursor:default}
#pmapDlg:focus{outline:0}#pmapDlg :focus-visible:not(.f){outline:2px solid #93c5fd;outline-offset:1px}
@media (max-width:600px){#pmapDlg{left:0;right:0;top:auto;bottom:0;transform:none;width:100%;max-height:94vh;max-height:94dvh;border-radius:16px 16px 0 0}#pmapDlg .b{padding:12px 14px 8px}#pmapDlg .h{padding:13px 14px 10px}#pmapDlg .ft{padding:10px 14px calc(12px + env(safe-area-inset-bottom,0px))}.pmap-b{height:34px;padding:0 14px;font-size:13px}.pmap-u{padding:8px 6px;font-size:12.5px}}
@media print{#pmapDlg,#pmapScrim{display:none}}`;
  document.head.appendChild(s);
}
const say = (m, k) => { try { toast(m, k || 'ok'); } catch (e) {} };
const lines = N => String(N || '').split('\n').map(x => x.trim()).filter(x => x && !/^발주\s*필요$/.test(x));
function rowHTML(x, why) {
  const r = x.r || x, on = M.picks.some(p => key(p.r) === key(r)), ls = lines(r.N);
  return `<button type="button" class="r${on ? ' on' : ''}" data-k="${E(key(r))}" aria-pressed="${on}"><span class="bx">${on ? '✓' : ''}</span><span class="tx"><b><i>${E(r.lab)}</i>${E(r.n)}${why ? `<span class="w">${E(why)}</span>` : ''}</b><small>${E(r.o || '옵션 없음')}</small></span><span class="q">남은 ${r.L === '' ? '빈칸' : E(r.L)}${ls.length ? `<br>${E(ls[ls.length - 1])}${ls.length > 1 ? ` 외 ${ls.length - 1}` : ''}` : ''}</span></button>`;
}
function listHTML() {
  if (!M.rows) return `<div class="none">${M.bad ? E(M.bad) : '재고 줄을 불러오는 중…'}</div>`;
  const q = M.q.trim();
  if (!q) { const s = suggest(M.rows, M.it); return `<div class="s">추천</div><div class="l">${s.length ? s.map(x => rowHTML(x, x.why)).join('') : '<div class="none">메모로는 비슷한 상품을 못 찾았어요 — 위에서 상품명이나 옵션을 찾아 주세요</div>'}</div>`; }
  const f = find(M.rows, q), a = f.filter(x => x.all).slice(0, 40), b = f.filter(x => !x.all).slice(0, a.length >= 12 ? 6 : 16);
  if (!f.length) return '<div class="s">찾은 것</div><div class="l"><div class="none">비슷한 이름도 없어요 — 다른 낱말로 찾아 보세요</div></div>';
  return (a.length ? `<div class="s">찾은 것 ${a.length}</div><div class="l">${a.map(x => rowHTML(x)).join('')}</div>` : '') + (b.length ? `<div class="s">비슷한 이름</div><div class="l">${b.map(x => rowHTML(x)).join('')}</div>` : '');
}
function share() {   // 고른 줄이 바뀔 때 수량 다시 — 손으로 고친 줄은 그대로
  const it = M.it, q = qtyOf(it), k = M.picks.length;
  M.picks.forEach((p, i) => { if (p.hand) return; p.q = k < 2 || M.per === 'each' ? q : Math.floor(q / k) + (i < q % k ? 1 : 0); });
}
function previewHTML() {
  const it = M.it, out = [];
  if (!M.picks.length) return '<div>재고 줄을 하나 이상 골라 주세요 — 세트 발주면 여러 줄</div>';
  M.picks.forEach(p => {
    const nm = `<b>${E(p.r.lab)} ${E(p.r.n)}${p.r.o ? ' · ' + E(p.r.o) : ''}</b>`, had = near(p.r, it), o = oNum(p.r.O);
    if (had) out.push(`${nm} — 이미 '${E(had)}' 줄이 있어 새로 적지 않아요 (이 발주와 이어 두기만)`);
    else if (o === null) out.push(`${nm} — <span class="bad">발주 수량 칸(${E(p.r.O.slice(0, 20))})이 숫자가 아니라 못 적어요. ERP 에서 고치면 적혀요</span>`);
    else out.push(`${nm} — 발주일에 '${E(it.date)} ${n(p.q).replace(/,/g, '')}개' · 발주 수량 ${p.r.O === '' ? '빈칸' : n(o)} → ${n(o + (Number(p.q) || 0))}`);
  });
  const sum = M.picks.reduce((s, p) => s + (Number(p.q) || 0), 0), q = qtyOf(it);
  if (M.picks.length > 1 && sum !== q) out.push(`합계 ${n(sum)}개 — 발주는 ${n(q)}개예요${sum === q * M.picks.length ? ' (세트라 줄마다 같은 수)' : ''}`);
  if (it.shipped) out.push('<span class="bad">이미 출고된 발주예요 — 물건이 벌써 들어왔으면 적지 말고 [안 적기]</span>');
  out.push('남은 재고는 안 바뀌어요');
  return out.map(x => `<div>· ${x}</div>`).join('');
}
const pickRow = p => `<div class="p"><span class="tx"><b><i>${E(p.r.lab)}</i>${E(p.r.n)}</b><small>${E(p.r.o || '옵션 없음')}</small></span><input type="number" inputmode="numeric" min="1" step="1" value="${E(p.q)}" data-q="${E(key(p.r))}" aria-label="수량"><button type="button" class="del" data-del="${E(key(p.r))}" aria-label="빼기">✕</button></div>`;
function picksHTML() {
  if (!M.picks.length) return '';
  return `<div class="s">고른 줄 · 적을 수량</div><div class="l">${M.picks.map(pickRow).join('')}</div>${M.picks.length > 1 ? `<div class="seg"><button type="button" data-per="each" class="${M.per === 'each' ? 'on' : ''}">줄마다 ${n(qtyOf(M.it))}개 (세트)</button><button type="button" data-per="split" class="${M.per === 'split' ? 'on' : ''}">${n(qtyOf(M.it))}개를 나눠서</button></div>` : ''}`;
}
function draw(what) {
  const el = M.el; if (!el) return;
  const b = el.querySelector('.b');
  if (!what || what === 'list') el.querySelector('#pmapList').innerHTML = listHTML();
  if (!what || what === 'pick') el.querySelector('#pmapPick').innerHTML = picksHTML();
  if (!what || what !== 'list') {
    el.querySelector('#pmapPrev').innerHTML = previewHTML();
    el.querySelector('#pmapErr').textContent = M.msg || '';
    const ok = M.picks.length && M.picks.every(p => /^\d+$/.test(String(p.q)) && +p.q >= 1 && +p.q <= 100000), go = el.querySelector('.go'), sk = el.querySelector('.sk');
    go.disabled = !ok || M.busy; go.textContent = M.busy ? '저장 중…' : `매핑하기${M.picks.length > 1 ? ` (${M.picks.length}줄)` : ''}`;
    sk.disabled = M.busy; sk.classList.toggle('ask', M.skipAsk); sk.textContent = M.skipAsk ? '정말 안 적기' : '안 적기';
    el.querySelector('.c input').checked = M.remember;
  }
  return b;
}
async function open(sn) {
  let it = null; try { it = _pom.bySn[sn]; } catch (e) {}
  if (!it) { try { await pomLoad(true); it = _pom.bySn[sn]; } catch (e) {} }
  if (!it) { say('이 발주를 못 찾았어요 — 잠시 뒤 다시 눌러 주세요', 'err'); return; }
  if (!canMap(it)) { say('이 발주는 이제 매핑할 게 없어요'); return; }
  close(true); css();
  try { _lgbHideZoom(); } catch (e) {}
  Object.assign(M, {it, rows: null, q: '', picks: [], per: 'each', remember: true, busy: false, msg: '', bad: '', skipAsk: false, back: document.activeElement});
  const sc = document.createElement('div'); sc.id = 'pmapScrim'; sc.addEventListener('click', () => close());
  const el = document.createElement('div'); el.id = 'pmapDlg'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '발주 매핑하기'); el.tabIndex = -1;
  const why = (() => { try { return _pomWhy(it); } catch (e) { return it.why || ''; } })();
  el.innerHTML = `<div class="h"><div><h2>매핑하기</h2><p>이 발주를 재고 ERP 어느 줄의 발주일에 적을지 정해요</p></div><button type="button" class="x" aria-label="닫기">✕</button></div>
<div class="b"><div class="src">${it.img ? `<img src="${E(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="no">사진 없음</div>'}<div class="t"><div class="m">${E(it.date)} · ${E(it.sn)} · <b>${n(qtyOf(it))}개</b>${it.status ? ' · ' + E(it.status) : ''}</div><div class="memo">${it.memo ? E(it.memo) : '메모 없음'}</div>${why ? `<div class="why">${E(why)}</div>` : ''}</div></div>
<input class="f" type="search" placeholder="상품명 · 옵션 찾기 (비슷한 이름도 나와요)" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="상품명 옵션 찾기">
<div id="pmapPick"></div><div id="pmapList"></div>
<label class="c"><input type="checkbox" checked><span><b>다음 발주부터도 이 줄로</b> — 메모에 같은 이름이 오거나 같은 1688 상품의 같은 종류가 오면 자동으로 적어요</span></label>
<div class="v" id="pmapPrev"></div><div class="e" id="pmapErr" role="alert"></div></div>
<div class="ft"><button type="button" class="sk" title="상품이 아니거나 이미 적은 발주 — 확인 필요에서 빠져요">안 적기</button><button type="button" class="no">취소</button><button type="button" class="go" disabled>매핑하기</button></div>`;
  document.body.appendChild(sc); document.body.appendChild(el); M.el = el;
  const im = el.querySelector('.src img');
  if (im) { im.onerror = () => { im.outerHTML = '<div class="no">사진 없음</div>'; }; im.onmouseenter = im.onclick = () => { try { _lgbShowZoom(im); } catch (e) {} }; im.onmouseleave = () => { try { _lgbHideZoom(); } catch (e) {} }; }
  el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('keydown', onKey);
  el.querySelector('.c input').addEventListener('change', e => { M.remember = e.target.checked; });
  draw();
  if (matchMedia('(hover:hover) and (min-width:601px)').matches) el.querySelector('.f').focus(); else el.focus({preventScroll: true});          // 휴대폰은 글자판이 바로 안 올라오게
  try { M.rows = await loadRows(true); } catch (e) { M.bad = '재고 줄을 못 불러왔어요 — 창을 닫고 다시 열어 주세요'; }
  if (M.it !== it || M.el !== el) return;
  if (M.rows && it.state === 'check' && it.n) { const r = M.rows.find(x => key(x) === key(it)); if (r) M.picks = [{r, q: qtyOf(it)}]; }          // 같은 1688 상품 하나 — 미리 골라 둠 (맞으면 바로 누르기)
  draw();
}
function close(quiet) {
  if (M.busy && !quiet) return;
  ['pmapScrim', 'pmapDlg'].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); });
  M.el = null; M.it = null;
  try { _lgbHideZoom(); } catch (e) {}
  if (!quiet && M.back && M.back.isConnected) try { M.back.focus({preventScroll: true}); } catch (e) {}
}
function toggle(k) {
  const i = M.picks.findIndex(p => key(p.r) === k);
  if (i >= 0) M.picks.splice(i, 1);
  else { const r = M.rows && M.rows.find(x => key(x) === k); if (!r) return; if (M.picks.length >= 8) { M.msg = '한 번에 8줄까지 고를 수 있어요'; draw('pick'); return; } M.picks.push({r, q: 0}); }
  M.msg = ''; M.skipAsk = false; share(); draw('pick');
  if (M.el) M.el.querySelectorAll('.r').forEach(x => { const on = M.picks.some(p => key(p.r) === x.dataset.k); x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); x.querySelector('.bx').textContent = on ? '✓' : ''; });
}
function onClick(e) {
  const b = e.target.closest('button'); if (!b || M.busy) return;
  if (b.classList.contains('x') || b.classList.contains('no')) return close();
  if (b.dataset.k) return toggle(b.dataset.k);
  if (b.dataset.del) return toggle(b.dataset.del);
  if (b.dataset.per) { M.per = b.dataset.per; M.picks.forEach(p => { p.hand = false; }); share(); draw('pick'); return; }
  if (b.classList.contains('sk')) { if (!M.skipAsk) { M.skipAsk = true; draw('pick'); return; } return save(true); }
  if (b.classList.contains('go')) return save(false);
}
function onInput(e) {
  const t = e.target;
  if (t.classList.contains('f')) { M.q = t.value; clearTimeout(M.tm); M.tm = setTimeout(() => draw('list'), 90); return; }
  if (t.dataset.q) { const p = M.picks.find(x => key(x.r) === t.dataset.q); if (p) { p.q = t.value.trim(); p.hand = true; draw('prev'); } }          // 입력 칸은 다시 안 그림
}
function onKey(e) {
  if (e.key === 'Enter' && e.target.classList.contains('f') && !e.isComposing) { e.preventDefault(); clearTimeout(M.tm); draw('list'); const f = M.rows && M.q.trim() ? find(M.rows, M.q.trim())[0] : null; if (f && !M.picks.some(p => key(p.r) === key(f.r))) toggle(key(f.r)); }
  if (e.key === 'Tab') { const f = [...M.el.querySelectorAll('button:not([disabled]),input')].filter(x => x.offsetParent); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
}
const who = () => { try { return _lgbMe() || '이름 안 고름'; } catch (e) { return '이름 안 고름'; } };
async function save(skip) {
  const it = M.it; if (!it || M.busy) return;
  const one = M.picks.length === 1, tg = skip ? [] : M.picks.map(p => ({b: p.r.b, n: p.r.n, o: p.r.o, q: one && Number(p.q) === qtyOf(it) ? null : Number(p.q)}));
  M.busy = true; M.msg = ''; draw('pick');
  try {
    await rpc('po_map_set', {p_sn: it.sn, p_targets: tg, p_skip: skip, p_remember: M.remember, p_who: who()});
    const nm = skip ? '' : M.picks.map(p => `${p.r.lab} ${p.r.n}${p.r.o ? ' · ' + p.r.o : ''}`).join(' + ');
    M.busy = false; close(true);
    say(skip ? `${it.sn} — 안 적기로 했어요` : `${it.sn} → ${nm} · 1~2분 안에 ERP 발주일에 적어요`);
    after(it.sn, skip);
  } catch (e) { M.busy = false; M.msg = errMsg(e); draw('pick'); }
}
async function off(sn) {
  try {
    await rpc('po_map_off', {p_sn: sn, p_who: who()});
    say(`${sn} — 매핑을 되돌렸어요`);
    kick(); await pomLoad(true).catch(() => {}); repaint(); setTimeout(() => pomLoad(true).catch(() => {}), 45e3);
  } catch (e) { say(errMsg(e), 'err'); pomLoad(true).catch(() => {}); }
}
/* 저장 뒤 — 맥미니에 바로 한 번 돌려 달라고 하고(1분 안에 돌았으면 조금 뒤 다시), 적힐 때까지 몇 번 더 본다 */
async function kick() {
  try { const base = await loadProxyBase(); if (!base) return; await fetch(`${base}/erp/po-match?fresh=1&cb=${Date.now()}`, {headers: {'X-Brightbeed-PIN': ghPin()}, cache: 'no-store'}); } catch (e) { /* 안 되면 5분 정기 실행이 적음 */ }
}
const repaint = () => { try { renderPoMatchBox(); attachPoMatchChips(); _poaSoon(); } catch (e) {} };
async function after(sn, skip) {
  await pomLoad(true).catch(() => {}); repaint();
  if (skip) { kick(); return; }
  for (let i = 0; i < 12; i++) {
    await kick();
    await new Promise(r => setTimeout(r, i < 4 ? 20e3 : 35e3));
    await pomLoad(true).catch(() => {});
    let it = null; try { it = _pom.bySn[sn]; } catch (e) {}
    if (!it || it.mapLocal) continue;
    if (it.state === 'written') { say(`${sn} — ERP 발주일에 적었어요`); return; }
    if (it.state === 'entered') { say(`${sn} — 이미 적힌 발주라 이어 두기만 했어요`); return; }
    if (it.state === 'skipped' || (it.state === 'todo' && it.why && !it.planQty)) { say(`${sn} — 못 적었어요: ${it.why || ''}`, 'err'); return; }
    if (['received', 'sample', 'cancelled', 'ignored'].includes(it.state)) return;
  }
}
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('[data-pmap]');
  if (a) { e.preventDefault(); e.stopPropagation(); open(a.dataset.pmap); return; }
  const u = e.target.closest && e.target.closest('[data-pmap-off]');
  if (u) { e.preventDefault(); e.stopPropagation(); u.disabled = true; off(u.dataset.pmapOff); }
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && M.el) { e.stopPropagation(); e.preventDefault(); close(); } }, true);
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('span[data-pmap]')) { e.preventDefault(); open(e.target.dataset.pmap); } });
const live = () => { try { if (window.OfficeLive) window.OfficeLive.on(['po_map'], () => { try { if (_pom.data) pomLoad(true).catch(() => {}); } catch (e) {} }); } catch (e) {} };
if (document.readyState === 'complete') live(); else addEventListener('load', live, {once: true});
try { css(); } catch (e) {}
window.PoMap = {open, off, overlay, btn, undo, canMap, canUndo, _t: {score, find, suggest, memoQuery, prep, sound, bone, lev}};
})();
