// 콰이디에어 발주 → 자체 발주 기록 + MD팀 브랜드별 발주리스트 자동 추가 (Supabase 엣지 함수 "po-mdlist") — 2026-11-23 사장님
//   "발주서를 우리가 진행하면 콰이디에어에서 전산을 등록할껀데 그걸 매칭해서 최근 발주 내용, 그리고 단가 같은 정보들을 내부적으로
//    자체적으로 추가해주고. 엠디팀시트에 보면 브랜드별로 발주 리스트가 있는데 거기에 자동으로 추가해줘"
//   "브랜드별로 제품명 리스트는 너가 학습해서 자동 분류 해주는거야"
//
// 10분마다 (pg_cron po-mdlist-10m → POST /po-mdlist, x-po-cron = po_md_config.cron_key):
//   1. 콰이디에어 두 계정 신청서(맥미니 프록시 /kd/orders — 보기 PIN)를 판매번호(6A… · Sb…)로 묶는다 (신청서 여러 장에 나뉘어도 한 발주).
//   2. 브랜드 정하기 — 사람이 고친 값(po_lines.brand_fix) > 메모 표시([아페티] · (코페리 상품) · {야르} · [6a] · [코즈미] …)
//      > MD 시트 '판매번호' 칸(메인 미발매 · 제작 메인&샘플) > 브랜드 발주리스트의 같은 줄(메모 · 사진 · 1688 상품) > 맥미니 ERP 매칭(/erp/po-match)
//      > 학습 — 브랜드별 상품 이름(Product List · 6a · yar · 코페리 …) · 발주리스트 줄 · 예전에 정해진 발주의 1688 상품 · 사진 · 업체 번호 · 이름 낱말 · 계정.
//      점수가 낮거나 두 브랜드가 비슷하면 '확인 필요'(시트에 안 넣음).
//   3. 자체 기록 po_lines (단가 · 수량 · 상태 · 사진 · 링크 · 메모 · 브랜드 · 어느 줄에 넣었나) — 콰이디에어에서 빠져도 남는다. anon 못 읽음.
//   4. MD 시트 — 브랜드 발주리스트에서 같은 상품 줄을 찾으면 끝의 자동 칸(최근 발주일 · 최근 발주 수량 · 콰이디 단가(¥) · 판매번호(콰이디))만 고치고
//      위안 칸이 비었으면 단가를 채움. 못 찾고 go_live 뒤 발주면 맨 아래 새 줄로 추가(상품명 · 링크 · 사진 · 위안 · 1688옵션 · 메모 · 수량 · 특이사항).
//      샘플 · 부자재 · 취소는 안 넣음. 사람이 지운 줄은 되살리거나 다시 넣지 않는다. 쓰기 = DB 함수 po_md_write (칸마다 합침 · 구글 수식 칸은 ="값").
// 수동: POST {key, dry:true} → 쓰지 않고 무엇을 할지 요약만.
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false (열쇠로 확인)

import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const WHO = '콰이디 자동';
const KD_ACCTS: [string, string][] = [['brightbeed', 'BB'], ['shinebeed', 'SB']];
const KD_STALE_SEC = 3 * 3600;
const LABEL: Record<string, string> = { apt: '아페티', kop: '코페리', koz: '코즈미', '6a': '식스에이', yar: '야르', pp: '프로덕트피알', akoi: '아코이하우스' };

// ---------------------------------------------------------------- 브랜드 발주리스트 (칸 번호 0부터 — 머리글로 다시 확인, 다르면 그 탭은 안 씀)
type Cols = { cat: number; name: number; link: number; img: number; cny: number; opt: number; memo: number; qty: number; note: number };
const JW: Cols = { cat: 0, name: 1, link: 2, img: 3, cny: 4, opt: 6, memo: 7, qty: 8, note: 9 };
const TABS: Record<string, { tk: string; cols: Cols; hdr: Record<number, string> }> = {
  apt: { tk: 'apeti:2014145701', cols: JW, hdr: { 1: '상품명', 2: '상품링크', 7: '메모', 8: '수량' } },
  '6a': { tk: 'apeti:2134023391', cols: JW, hdr: { 1: '상품명', 2: '상품링크', 7: '메모', 8: '수량' } },
  yar: { tk: 'apeti:1658007003', cols: JW, hdr: { 1: '상품명', 2: '상품링크', 7: '메모', 8: '수량' } },
  kop: { tk: 'coferry:720059315', cols: { cat: 0, name: 1, link: 2, img: 3, cny: -1, opt: 5, memo: 6, qty: 7, note: 8 }, hdr: { 1: '상품명', 2: '상품링크', 6: '메모', 7: '수량' } },
  koz: { tk: 'kozmi:0', cols: { cat: 0, name: 1, cny: 2, link: 5, img: 6, opt: 9, memo: 10, qty: 11, note: -1 }, hdr: { 1: '상품명', 2: '위안', 5: '상품 링크', 10: '메모' } },
};
const TRAIL = ['최근 발주일', '최근 발주 수량', '콰이디 단가(¥)', '판매번호(콰이디)'];
// 학습용 탭 — [tk, 브랜드(null = 줄 메모 표시로만), 상품명 칸, 링크 칸, 사진 칸, 메모 칸, 판매번호 칸, 무게]
type LearnTab = [string, string | null, number, number, number, number, number, number];
const LEARN: LearnTab[] = [
  ['apeti:1838386820', 'apt', 2, -1, -1, -1, -1, 1], ['apeti:141680769', 'apt', 2, -1, -1, -1, -1, 0.5], ['apeti:0', 'apt', 0, -1, -1, -1, -1, 0.5],
  ['apeti:2052379523', '6a', 2, -1, -1, -1, -1, 1], ['apeti:1164857094', '6a', 2, -1, -1, -1, -1, 0.5], ['apeti:214820756', 'yar', 2, -1, -1, -1, -1, 1],
  ['coferry:705952769', 'kop', 2, -1, -1, -1, -1, 1], ['coferry:1514957306', 'kop', 0, -1, -1, -1, -1, 0.5], ['coferry:1347012085', 'kop', 1, -1, -1, 5, 6, 2],
  ['kozmi:1819637012', 'koz', 2, -1, -1, -1, -1, 1], ['kozmi:432793293', 'koz', 1, 3, 4, 8, 10, 2],
  ['apeti:1928883703', null, 1, 2, 3, 8, 9, 2],   // 주얼리 MD 메인 미발매 — 아페티 · 식스에이 · 야르가 섞여 있어 줄 메모 표시로만
];
// 부자재 탭의 판매번호 = 상품 아님
const MATERIAL_TABS: [string, number[]][] = [['apeti:742728011', [9, 18]], ['coferry:1913597387', [10]], ['kozmi:111459992', [4]]];

// ---------------------------------------------------------------- 글자
const strip = (s: unknown) => String(s ?? '').normalize('NFKD').replace(/\p{Mn}/gu, '').normalize('NFC');
const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const compact = (s: unknown) => strip(s).toLowerCase().replace(/[^0-9a-z가-힣一-鿿]+/g, '');
const OFFER_RE = /\/offer\/(\d{6,})/;
const offerOf = (u: string) => (String(u || '').match(OFFER_RE) || [])[1] || null;
const imgOf = (u: string) => (String(u || '').match(/\/(O1CN[0-9A-Za-z]{10,})/) || [])[1] || null;
const sellerOf = (u: string) => (String(u || '').match(/!!(\d{6,})-/) || [])[1] || null;
const num = (v: unknown) => { const f = Number(String(v ?? '').replace(/,/g, '').trim()); return isFinite(f) && String(v ?? '').trim() !== '' ? f : null; };
const SALES_RE = /^(?:브라이트비드)?\s*(6A|SB|Sb|sb)(\d{2})(\d{2})(\d{2})(\d{3})$/;
function salesNo(raw: unknown): { sn: string; date: string } | null {
  const m = clean(raw).replace(/ /g, '').match(SALES_RE);
  if (!m) return null;
  const date = `20${m[2]}-${m[3]}-${m[4]}`;
  if (isNaN(Date.parse(date + 'T00:00:00Z'))) return null;
  return { sn: (m[1].toUpperCase() === '6A' ? '6A' : 'Sb') + m[2] + m[3] + m[4] + m[5], date };
}
const TAGS: [string, RegExp][] = [
  ['apt', /\[\s*아페티\s*\]|아페티(?!\s*파우치)/g],
  ['kop', /\(\s*코페리\s*상품\s*\)|\[\s*코페리\s*\]|코페리(?!\s*부자재)/g],
  ['yar', /\{\s*야르\s*\}|\[\s*야르\s*\]|야르/g],
  ['koz', /\[\s*코즈미\s*\]|코즈미/g],
  ['akoi', /\[\s*아코이\s*\]|아코이/g],
  ['pp', /\[\s*프피\s*\]|프로덕트\s*피알|프피/g],
  ['6a', /\{\s*식스에이\s*\}|\[\s*식스에이\s*\]|식스에이|[\[{(]\s*6\s*a\s*[\]})]/gi],
];
const LABEL_RE = /(?:이)?라고\s*(?:표기|적어|기재|써)/;
const CAT_HEAD = /^\s*(?:반지|목걸이|팔찌|발찌|귀걸이)\s*/;
function parseMemo(memo: string): { brand: string | null; phrase: string | null } {
  const m = strip(memo);
  const lab = m.match(LABEL_RE);
  const pre = lab ? m.slice(0, lab.index) : '';
  let brand: string | null = null, phrase: string | null = null;
  if (pre) for (const [b, rx] of TAGS) {
    const hits = [...pre.matchAll(new RegExp(rx.source, rx.flags))];
    if (hits.length) { const h = hits[hits.length - 1]; brand = b; phrase = pre.slice((h.index || 0) + h[0].length); break; }
  }
  if (!brand) for (const [b, rx] of TAGS) {
    const h = m.match(new RegExp(rx.source, rx.flags.replace('g', '')));
    if (h) {
      brand = b;
      const tail = m.slice((h.index || 0) + h[0].length, (h.index || 0) + h[0].length + 60);
      const cut = tail.search(/[一-鿿]|=|》|\(|\d+\s*(?:월|일|개|위안|cm|CM|mm)|\//);
      phrase = cut >= 0 ? tail.slice(0, cut) : tail;
      break;
    }
  }
  if (phrase != null) phrase = clean(phrase.replace(/^[\s"'“”·,.-]+|[\s"'“”·,.-]+$/g, '')).replace(CAT_HEAD, '').trim();
  return { brand, phrase: phrase || null };
}
const MATERIAL = /부자재|파우치|포장|박스|쇼핑백|원단|面料|스와치|色卡|라벨|와끼|지퍼|안감|겉감|단추|버클(?!리)|낚싯바늘|内径|내경|\d+\s*[*x×]\s*\d+\s*(?:cm|CM|mm|MM)|\d\s*미터/;
const LEARN_ADD_MIN = 3.5;   // 학습으로만 정한 브랜드는 이 점수 넘을 때만 새 줄로 넣는다 (아니면 기록만)
const SAMPLE = /샘플/;
const STOPW = new Set(['ring', 'rings', 'necklace', 'bracelet', 'bangle', 'earring', 'earrings', 'anklet', 'bag', 'bags', 'set', 'color', 'colour', 'size',
  'style', 'option', 'open', 'the', 'and', 'ver', 'version', 'new', 'silver', 'gold', 'white', 'black', 'type', 'sample', 'main', 'event', 'sale',
  '반지', '목걸이', '팔찌', '귀걸이', '발찌', '가방', '표기', '표기해주세요', '해주세요', '적어주세요', '부탁드립니다', '수량', '수량표기', '포함', '라고',
  '상품', '이라고', '사이즈', '확인', '요청', '추가', '출고완료', '우체국항공', '우체국', '일반우체국', '전자상사업자', '아페티', '코페리', '코즈미', '야르',
  '식스에이', '아코이', '프피', '화이트', '블랙', '실버', '골드', '컬러', '색상', '부탁', '드립니다', '주세요']);
function toks(s: string): string[] {
  let x = strip(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  x = x.replace(/(?:이)?라고\s*(?:표기|적어|기재|써)[^]*$/, ' ').replace(/[^a-z가-힣]+/g, ' ');
  return [...new Set(x.split(' ').filter((w) => (/^[a-z]{3,}$/.test(w) || /^[가-힣]{2,}$/.test(w)) && !STOPW.has(w)))].slice(0, 12);
}
function catOf(en: string, cn: string, name: string): string {
  const s = `${en} ${cn} ${name}`.toLowerCase();
  if (/necklace|项链|목걸이/.test(s)) return '목걸이';
  if (/bracelet|手链|手镯|bangle|팔찌|뱅글/.test(s)) return '팔찌';
  if (/anklet|脚链|발찌/.test(s)) return '발찌';
  if (/earring|耳|귀걸이/.test(s)) return '귀걸이';
  if (/\bring\b|戒指|반지|링\b/.test(s)) return '반지';
  if (/\bbag\b|包|가방|백\b/.test(s)) return '가방';
  return '';
}

// ---------------------------------------------------------------- 학습 (특징 → 브랜드 무게)
class Learn {
  m = new Map<string, Map<string, number>>();
  teach(feat: string | null, b: string | null, w = 1) {
    if (!feat || !b || !LABEL[b]) return;
    let x = this.m.get(feat);
    if (!x) this.m.set(feat, (x = new Map()));
    x.set(b, (x.get(b) || 0) + w);
  }
  teachItem(f: Feat, b: string | null, w = 1) {
    if (!b) return;
    if (f.offer) this.teach('o:' + f.offer, b, w);
    if (f.img) this.teach('i:' + f.img, b, w);
    if (f.seller) this.teach('s:' + f.seller, b, w);
    for (const t of f.toks) this.teach('t:' + t, b, w);
  }
  score(f: Feat, acct: string | null) {
    const s: Record<string, number> = {};
    const add = (feat: string, w: number) => {
      const x = this.m.get(feat);
      if (!x) return;
      let tot = 0;
      for (const v of x.values()) tot += v;
      const spec = x.size === 1 ? 1 : x.size === 2 ? 0.5 : 0.2;
      for (const [b, v] of x) s[b] = (s[b] || 0) + (w * spec * v) / tot;
    };
    if (f.offer) add('o:' + f.offer, 4);
    if (f.img) add('i:' + f.img, 5);
    if (f.seller) add('s:' + f.seller, 1.5);
    for (const t of f.toks.slice(0, 8)) add('t:' + t, 1.2);
    if (acct) add('a:' + acct, 0.6);
    return Object.entries(s).sort((a, b) => b[1] - a[1]);
  }
}
type Feat = { offer: string | null; img: string | null; seller: string | null; toks: string[] };
const featOf = (link: string, img: string, names: string[]): Feat => ({ offer: offerOf(link), img: imgOf(img), seller: sellerOf(img), toks: toks(names.filter(Boolean).join(' ')) });

// ---------------------------------------------------------------- 자료 읽기
async function proxyBase(): Promise<string> {
  try {
    const r = await fetch('https://raw.githubusercontent.com/j65209/beaduniverse/main/tunnel.json', { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j && /^https:\/\//.test(j.url)) return String(j.url).replace(/\/$/, '');
  } catch { /* 기본 주소 */ }
  return 'https://api.beaduniverse.kr';
}
async function getJSON(url: string, pin: string, ms = 60000) {
  const r = await fetch(url, { headers: { 'X-Brightbeed-PIN': pin }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(url.replace(/\?.*$/, '').split('/').slice(-2).join('/') + ' ' + r.status);
  return await r.json();
}
type MdRow = { tk: string; r: number; v: string[]; edited_by: string | null };
async function readRows(tks: string[]): Promise<Map<string, MdRow[]>> {
  const out = new Map<string, MdRow[]>();
  for (const tk of tks) out.set(tk, []);
  for (const tk of tks) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('mdx_rows').select('tk,r,v,edited_by').eq('tk', tk).is('deleted_at', null).order('r').range(from, from + 999);
      if (error) throw new Error('mdx_rows ' + error.message);
      for (const x of data || []) out.get(tk)!.push({ tk: x.tk, r: x.r, v: (Array.isArray(x.v) ? x.v : []).map((c: unknown) => (c == null ? '' : String(c))), edited_by: x.edited_by });
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- 콰이디에어 → 판매번호 묶음
type App = { ord: string; st: string; qty: number | null; price: number | null; priceTxt: string; buy: string; memo: string; cs: string; link: string; img: string; cn: string; en: string };
type Line = {
  sn: string; date: string; acct: string; apps: App[]; act: App[]; status: string; qty: number | null; price: number | null; priceTxt: string;
  link: string; img: string; memo: string; memos: string[]; memosC: string[]; cs: string; cn: string; en: string; ords: string[];
  kind: string; tag: string | null; phrase: string | null; feat: Feat;
  brand: string | null; how: string | null; conf: number; alt: [string, number][] | null; name: string;
  row: { tab: string; r: number; s: number } | null; erp: { b: string; n: string; o: string; how: string } | null;
};
function currentQty(act: App[]): number | null {
  const seen = new Set<string>();
  let total = 0, any = false;
  for (const a of act) {
    if (a.qty == null) continue;
    if (a.st !== '출고완료') { const k = `${a.qty}|${a.buy}|${a.price}`; if (seen.has(k)) continue; seen.add(k); }
    total += a.qty; any = true;
  }
  return any ? total : null;
}
function buildLines(kd: Record<string, any>): Map<string, Line> {
  const g = new Map<string, Line>();
  for (const [, acct] of KD_ACCTS) {
    const d = kd[acct];
    for (const o of d.orders || []) {
      for (const it of o.items || []) {
        const s = salesNo(it.sales_no);
        if (!s) continue;
        let L = g.get(s.sn);
        if (!L) {
          L = { sn: s.sn, date: s.date, acct, apps: [], act: [], status: '', qty: null, price: null, priceTxt: '', link: '', img: '', memo: '', memos: [], memosC: [],
            cs: '', cn: '', en: '', ords: [], kind: 'item', tag: null, phrase: null, feat: { offer: null, img: null, seller: null, toks: [] },
            brand: null, how: null, conf: 0, alt: null, name: '', row: null, erp: null };
          g.set(s.sn, L);
        }
        const price = num(it.price_cny);
        L.apps.push({ ord: String(o.ord_no || ''), st: clean(o.status), qty: num(it.qty) == null ? null : Math.round(num(it.qty)!), price, priceTxt: clean(it.price_cny),
          buy: clean(it.buy_ord_no), memo: clean(it.memo), cs: clean(it.color_size), link: clean(it.product_url), img: clean(it.image_url), cn: clean(it.name_cn), en: clean(it.name_en) });
      }
    }
  }
  for (const L of g.values()) {
    L.apps.sort((a, b) => a.ord.localeCompare(b.ord));
    L.act = L.apps.filter((a) => a.st !== '취소');
    const pool = L.act.length ? L.act : L.apps;
    const last = pool[pool.length - 1];
    L.status = last ? last.st : '';
    L.ords = [...new Set(L.apps.map((a) => a.ord))];
    L.qty = currentQty(L.act) ?? (L.act.length ? null : currentQty(L.apps.map((a) => ({ ...a, st: '출고완료' }))));
    const pa = pool.find((a) => a.price != null && a.price > 0);
    L.price = pa ? pa.price : null;
    L.priceTxt = pa ? pa.priceTxt : '';
    const pick = (k: keyof App) => String((pool.find((a) => a[k]) || L.apps.find((a) => a[k]) || ({} as any))[k] || '');
    L.link = pick('link'); L.img = pick('img'); L.cs = pick('cs'); L.cn = pick('cn'); L.en = pick('en');
    for (const a of L.apps) if (a.memo && !L.memos.includes(a.memo)) L.memos.push(a.memo);
    L.memo = L.memos[0] || '';
    L.memosC = L.memos.map(compact);
    for (const mm of L.memos) { const p = parseMemo(mm); if (p.brand) { L.tag = p.brand; L.phrase = p.phrase; break; } }
    const all = L.memos.join(' ');
    if (!L.act.length) L.kind = 'cancelled';
    else if ((SAMPLE.test(all) && (L.qty ?? 0) <= 10) || (L.qty != null && L.qty <= 5)) L.kind = 'sample';
    else if (MATERIAL.test(all) && !(L.tag && L.phrase && !MATERIAL.test(L.phrase))) L.kind = 'material';
    L.feat = featOf(L.link, L.img, [L.phrase || '', L.phrase ? '' : all, L.en]);
  }
  return g;
}

// ---------------------------------------------------------------- 발주리스트 줄
type TabRow = { r: number; v: string[]; offer: string | null; img: string | null; memoC: string; nameC: string; optC: string };
function tabRows(rows: MdRow[], c: Cols): TabRow[] {
  return rows.filter((x) => x.r > 1).map((x) => {
    const g = (i: number) => (i >= 0 ? x.v[i] || '' : '');
    const memo = g(c.memo);
    return { r: x.r, v: x.v, offer: offerOf(g(c.link)), img: imgOf(g(c.img)) || imgOf(g(c.link)), memoC: compact(memo), nameC: compact(g(c.name)), optC: compact(g(c.opt)) };
  });
}
function rowScore(L: Line, row: TabRow): number {
  let s = 0, strong = false;
  if (row.memoC.length >= 8 && L.memosC.some((mc) => mc.includes(row.memoC))) { s += 3; strong = true; }
  if (L.feat.img && row.img && L.feat.img === row.img) { s += 3; strong = true; }
  if (L.feat.offer && row.offer) s += L.feat.offer === row.offer ? 2 : -3;
  const pc = L.phrase ? compact(L.phrase) : '';
  if (pc.length >= 3 && (pc === row.nameC || (row.memoC && row.memoC.includes(pc)))) s += 2;
  const cc = compact(L.cs);
  if (cc && row.optC && cc === row.optC) s += 1;
  return strong && s >= 4 ? s : 0;
}
const sameKey = (L: Line) => `${compact(L.name)}|${L.feat.img || L.feat.offer || compact(L.memo)}`;
function bestRow(L: Line, rows: TabRow[]): { r: number; s: number } | null {
  let best: { r: number; s: number } | null = null;
  for (const row of rows) {
    const s = rowScore(L, row);
    if (s && (!best || s > best.s || (s === best.s && row.r > best.r))) best = { r: row.r, s };
  }
  return best;
}

// ---------------------------------------------------------------- 실행
async function run(dry: boolean, opt: { goLive?: string } = {}) {
  const t0 = Date.now();
  const { data: cfg, error: ce } = await sb.from('po_md_config').select('*').eq('id', 1).single();
  if (ce || !cfg) throw new Error('config');
  const base = await proxyBase();
  const kd: Record<string, any> = {};
  for (const [brand, acct] of KD_ACCTS) {
    const d = await getJSON(`${base}/kd/orders?brand=${brand}&cb=${Date.now()}`, cfg.proxy_pin);
    if (!d || !Array.isArray(d.orders)) throw new Error('kd_unreadable_' + acct);
    if (Date.now() / 1000 - (d.fetched_at || 0) > KD_STALE_SEC) throw new Error('kd_stale_' + acct);
    kd[acct] = d;
  }
  let pom: any = null;
  try { pom = await getJSON(`${base}/erp/po-match?cb=${Date.now()}`, cfg.proxy_pin, 30000); } catch { pom = null; }
  const lines = buildLines(kd);

  // 저장된 기록 (사람이 고친 브랜드 · 넣은 줄)
  const prev = new Map<string, any>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('po_lines').select('sn,brand_fix,md_tk,md_r,md_how,md_at,brand,brand_how').range(from, from + 999);
    if (error) throw new Error('po_lines ' + error.message);
    for (const x of data || []) prev.set(x.sn, x);
    if (!data || data.length < 1000) break;
  }

  // MD 시트 읽기
  const tks = [...new Set([...Object.values(TABS).map((t) => t.tk), ...LEARN.map((l) => l[0]), ...MATERIAL_TABS.map((m) => m[0])])];
  const md = await readRows(tks);
  const learn = new Learn();
  const sheetSn = new Map<string, { b: string | null; name: string; tk: string }>();
  const materialSn = new Set<string>();
  for (const [tk, cols] of MATERIAL_TABS) for (const x of md.get(tk) || []) for (const c of cols) { const s = salesNo(x.v[c]); if (s) materialSn.add(s.sn); }
  // 우리가 넣은 줄은 학습에 안 씀 (잘못 넣은 것이 스스로 굳지 않게) — 사람이 고친 브랜드는 아래에서 따로
  const ours = new Set<string>();
  for (const p of prev.values()) if (p.md_how === 'added' && p.md_tk && p.md_r) ours.add(`${p.md_tk}#${p.md_r}`);
  for (const [tk, b0, cn, cl, ci, cm, cs, w] of LEARN) {
    for (const x of md.get(tk) || []) {
      if (x.r <= 1) continue;
      const g = (i: number) => (i >= 0 ? x.v[i] || '' : '');
      const name = g(cn);
      if (!name && !g(cl) && !g(ci)) continue;
      const p = cm >= 0 ? parseMemo(g(cm)) : { brand: null, phrase: null };
      const b = b0 || p.brand;
      if (!b) continue;
      learn.teachItem(featOf(g(cl), g(ci), [name, p.phrase || '']), b, w);
      if (cs >= 0) { const s = salesNo(g(cs)); if (s) sheetSn.set(s.sn, { b, name: clean(name), tk }); }
    }
  }
  const tabInfo: Record<string, { rows: TabRow[]; ok: boolean; why: string; hdr: string[]; trail: number; maxLen: number }> = {};
  for (const [b, t] of Object.entries(TABS)) {
    const rows = md.get(t.tk) || [];
    const hdrRow = rows.find((x) => x.r === 1);
    const hdr = hdrRow ? hdrRow.v : [];
    const bad = Object.entries(t.hdr).filter(([i, n]) => clean(hdr[+i]) !== n).map(([i, n]) => `${+i + 1}열 '${n}'`);
    const trows = tabRows(rows, t.cols);
    let maxLen = hdr.length;
    for (const x of rows) maxLen = Math.max(maxLen, x.v.length);
    const ti = hdr.findIndex((h) => clean(h) === TRAIL[0]);
    tabInfo[b] = { rows: trows, ok: !bad.length, why: bad.length ? '머리글 바뀜: ' + bad.join(', ') : '', hdr, trail: ti >= 0 ? ti : maxLen, maxLen };
    for (const row of trows) {
      if (ours.has(`${t.tk}#${row.r}`)) continue;
      const v = row.v, c = t.cols, g = (i: number) => (i >= 0 ? v[i] || '' : '');
      const p = parseMemo(g(c.memo));
      learn.teachItem(featOf(g(c.link), g(c.img), [g(c.name), p.phrase || '']), b, 2);
    }
  }
  // 맥미니 ERP 매칭 (재고 ERP 상품명) — 브랜드 · 이름
  const STRONG_HOW = new Set(['sheet', 'tag', 'name']);
  for (const it of (pom && Array.isArray(pom.items) ? pom.items : [])) {
    const L = lines.get(it.sn);
    if (L && it.b && LABEL[it.b] && it.n) L.erp = { b: it.b, n: clean(it.n), o: clean(it.o), how: String(it.how || '') };
  }
  // 이미 정해진 발주(사람 · 메모 표시 · 시트 판매번호 · ERP 강한 매칭)로 1688 상품 · 사진 · 업체 · 계정을 배운다
  for (const L of lines.values()) {
    const p = prev.get(L.sn);
    const b = (p && p.brand_fix) || L.tag || (sheetSn.get(L.sn) || {}).b || (L.erp && STRONG_HOW.has(L.erp.how) ? L.erp.b : null);
    if (!b) continue;
    const w = p && p.brand_fix ? 4 : 2;
    learn.teachItem({ ...L.feat, toks: L.feat.toks.concat(L.erp && L.erp.b === b ? toks(L.erp.n) : []) }, b, w);
    learn.teach('a:' + L.acct, b, 1);
  }
  // 상품 이름(브랜드별 상품 목록) → 이름 낱말
  // (위 LEARN 에서 이미 배움)

  // 브랜드 정하기 + 줄 찾기
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] || 0) + 1);
  for (const L of lines.values()) {
    const p = prev.get(L.sn);
    if (materialSn.has(L.sn)) L.kind = 'material';
    const ss = sheetSn.get(L.sn);
    // 모든 브랜드 발주리스트에서 같은 줄 찾기
    let rowHit: { tab: string; r: number; s: number } | null = null;
    const ownTab = p && p.md_how === 'added' && p.md_tk ? Object.keys(TABS).find((b) => TABS[b].tk === p.md_tk) : null;
    if (ownTab) rowHit = { tab: ownTab, r: p.md_r, s: 99 };
    else for (const b of Object.keys(TABS)) {
      const h = bestRow(L, tabInfo[b].rows);
      if (h && (!rowHit || h.s > rowHit.s)) rowHit = { tab: b, ...h };
    }
    if (p && p.brand_fix) { L.brand = p.brand_fix; L.how = 'fix'; L.conf = 1; }
    else if (L.tag) { L.brand = L.tag; L.how = 'tag'; L.conf = 1; }
    else if (ss && ss.b) { L.brand = ss.b; L.how = 'sheet'; L.conf = 1; }
    else if (rowHit && rowHit.s >= 5) { L.brand = rowHit.tab; L.how = 'row'; L.conf = 0.9; }
    else if (L.erp) { L.brand = L.erp.b; L.how = 'erp'; L.conf = STRONG_HOW.has(L.erp.how) ? 0.9 : 0.75; }
    else {
      const sc = learn.score(L.feat, L.acct);
      L.alt = sc.slice(0, 3).map(([b, v]) => [b, Math.round(v * 100) / 100]);
      const [b1, v1] = sc[0] || [null, 0];
      const v2 = sc[1] ? sc[1][1] : 0;
      if (b1 && v1 >= 2.4 && v1 >= v2 * 2) { L.brand = b1; L.how = 'learn'; L.conf = Math.min(0.85, v1 / (v1 + v2 + 1)); }
      else { L.brand = null; L.how = 'check'; L.conf = 0; }
    }
    // 브랜드가 정해졌으면 그 브랜드 탭 안에서만 줄을 다시 찾는다
    if (L.brand && TABS[L.brand]) {
      if (rowHit && rowHit.tab === L.brand) L.row = rowHit;
      else { const h = bestRow(L, tabInfo[L.brand].rows); L.row = h ? { tab: L.brand, ...h } : null; }
    }
    const nm = (ss && ss.name) || (L.erp && L.erp.b === L.brand ? clean(`${L.erp.n} ${L.erp.o}`) : '') || L.phrase ||
      (L.row ? clean((tabInfo[L.row.tab].rows.find((x) => x.r === L.row!.r) || { v: [] as string[] }).v[TABS[L.row.tab].cols.name] || '') : '') ||
      clean(L.memo.replace(/[一-鿿]+/g, ' ')).slice(0, 40) || L.en;
    L.name = nm;
    bump(`kind:${L.kind}`); bump(`how:${L.how}`); if (L.brand) bump(`brand:${L.brand}`);
  }

  // 시트에 쓸 것
  const goLive = dry && /^\d{4}-\d{2}-\d{2}$/.test(String(opt.goLive || '')) ? String(opt.goLive) : String(cfg.go_live);   // 미리보기만 날짜 바꿔 보기
  const plan: Record<string, { cells: any[]; news: { key: string; v: string[]; line: Line }[]; matched: number; skipped: string }> = {};
  const mdOf = new Map<string, { tk: string; r: number | null; how: string }>();
  for (const [b, t] of Object.entries(TABS)) {
    const ti = tabInfo[b];
    const P = (plan[b] = { cells: [] as any[], news: [] as { key: string; v: string[]; line: Line }[], matched: 0, skipped: ti.ok ? '' : ti.why });
    if (!ti.ok) continue;
    const live = new Set(ti.rows.map((x) => x.r));
    const byRow = new Map<number, Line[]>();
    const fresh: Line[] = [];
    for (const L of lines.values()) {
      if (L.brand !== b) continue;
      const p = prev.get(L.sn);
      if (p && p.md_how === 'added' && p.md_tk === t.tk && p.md_r && !live.has(p.md_r)) { mdOf.set(L.sn, { tk: t.tk, r: p.md_r, how: 'gone' }); continue; }   // 사람이 지움
      if (p && p.md_how === 'gone') { mdOf.set(L.sn, { tk: t.tk, r: p.md_r ?? null, how: 'gone' }); continue; }
      if (L.row && live.has(L.row.r)) { (byRow.get(L.row.r) || byRow.set(L.row.r, []).get(L.row.r)!).push(L); continue; }
      if (L.kind !== 'item') continue;
      if (L.how === 'check') continue;
      if (L.how === 'learn' && !(L.alt && L.alt[0] && L.alt[0][1] >= LEARN_ADD_MIN)) { mdOf.set(L.sn, { tk: t.tk, r: null, how: 'weak' }); continue; }
      if (L.date < goLive) { mdOf.set(L.sn, { tk: t.tk, r: null, how: 'old' }); continue; }
      fresh.push(L);
    }
    const tc = ti.trail;
    const trailCells = (r: number, L: Line, cancelled: boolean) => [
      { r, p: tc, v: L.date },
      { r, p: tc + 1, v: cancelled ? '취소' : L.qty != null ? String(L.qty) : '' },
      { r, p: tc + 2, v: L.priceTxt || (L.price != null ? String(L.price) : '') },
      { r, p: tc + 3, v: L.sn },
    ];
    // 머리글 (비었을 때만)
    TRAIL.forEach((h, i) => P.cells.push({ r: 1, p: tc + i, v: h, blank: true, hdr: true }));
    for (const [r, ls] of byRow) {
      const act = ls.filter((x) => x.kind !== 'cancelled');
      const use = (act.length ? act : ls).sort((a, b2) => (a.date + a.sn).localeCompare(b2.date + b2.sn)).pop()!;
      P.cells.push(...trailCells(r, use, !act.length));
      if (t.cols.cny >= 0 && use.price != null && use.price > 0 && act.length) P.cells.push({ r, p: t.cols.cny, v: use.priceTxt || String(use.price), blank: true });
      for (const L of ls) mdOf.set(L.sn, { tk: t.tk, r, how: prev.get(L.sn)?.md_how === 'added' && prev.get(L.sn)?.md_r === r ? 'added' : 'matched' });
      P.matched++;
    }
    // 새 줄 — 같은 상품(이름 + 사진/1688 상품)은 한 줄로, 오래된 것부터 (색이 다르면 이름이 달라 따로)
    fresh.sort((a, b2) => (a.date + a.sn).localeCompare(b2.date + b2.sn));
    const seen = new Map<string, { key: string; v: string[]; line: Line }>();
    for (const L of fresh) {
      const k = sameKey(L);
      const n = Math.max(tc + TRAIL.length, ti.maxLen);
      const v = new Array(n).fill('');
      const c = t.cols, set = (i: number, x: string) => { if (i >= 0) v[i] = x; };
      set(c.cat, catOf(L.en, L.cn, L.name));
      set(c.name, L.name);
      set(c.link, L.link);
      set(c.img, L.img);
      set(c.cny, L.priceTxt);
      set(c.opt, L.cs);
      set(c.memo, L.memo);
      set(c.qty, L.qty != null ? String(L.qty) : '');
      set(c.note, `콰이디 자동 추가 · 신청서 ${L.ords[L.ords.length - 1] || ''}`);
      v[tc] = L.date; v[tc + 1] = L.qty != null ? String(L.qty) : ''; v[tc + 2] = L.priceTxt; v[tc + 3] = L.sn;
      seen.delete(k);   // 같은 상품 — 나중 발주로 바꿔 한 줄만 (먼저 발주들은 쓰기 뒤 같은 줄로 기록)
      seen.set(k, { key: L.sn, v, line: L });
    }
    P.news = [...seen.values()];
  }

  const summary: any = {
    dry, kdAt: Object.fromEntries(KD_ACCTS.map(([, a]) => [a, kd[a].fetched_at_iso || kd[a].fetched_at])), pom: !!pom, lines: lines.size, counts, goLive,
    tabs: Object.fromEntries(Object.entries(plan).map(([b, P]) => [b, { matched: P.matched, add: P.news.length, cells: P.cells.length, skipped: P.skipped || undefined }])),
  };
  if (dry) {
    summary.add = Object.entries(plan).flatMap(([b, P]) => P.news.map((x) => ({ b, sn: x.line.sn, date: x.line.date, name: x.line.name, qty: x.line.qty, cny: x.line.priceTxt, how: x.line.how }))).slice(0, 80);
    summary.check = [...lines.values()].filter((L) => L.how === 'check' && L.kind === 'item').sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40).map((L) => ({ sn: L.sn, date: L.date, acct: L.acct, memo: L.memo.slice(0, 70), alt: L.alt, st: L.status }));
    summary.learned = [...lines.values()].filter((L) => L.how === 'learn').slice(0, 40).map((L) => ({ sn: L.sn, b: L.brand, alt: L.alt, memo: L.memo.slice(0, 60) }));
    summary.byDate = {};
    for (const L of lines.values()) if (L.kind === 'item' && L.brand && TABS[L.brand] && !L.row) summary.byDate[L.date] = (summary.byDate[L.date] || 0) + 1;
    summary.matches = [...lines.values()].filter((L) => L.row).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60).map((L) => {
      const t = TABS[L.row!.tab], row = tabInfo[L.row!.tab].rows.find((x) => x.r === L.row!.r);
      return { sn: L.sn, how: L.how, b: L.brand, r: L.row!.r, s: L.row!.s, kd: L.memo.slice(0, 50), rowName: row ? row.v[t.cols.name] : '', rowMemo: row ? (row.v[t.cols.memo] || '').slice(0, 50) : '' };
    });
    summary.learnFeats = learn.m.size;
    summary.ms = Date.now() - t0;
    return summary;
  }

  // 쓰기 — 탭마다 한 번
  const writes: Record<string, any> = {};
  for (const [b, P] of Object.entries(plan)) {
    if (P.skipped || (!P.cells.length && !P.news.length)) continue;
    const { data, error } = await sb.rpc('po_md_write', { p_tk: TABS[b].tk, p_cells: P.cells, p_new: P.news.map((x) => ({ key: x.key, v: x.v })), p_who: WHO });
    if (error) { writes[b] = { error: error.message }; continue; }
    writes[b] = { set: data.set, new: data.new, fx: data.fx };
    const bySn = new Map<string, Line>(P.news.map((x) => [x.key, x.line]));
    for (const a of data.added || []) {
      const L = bySn.get(a.key);
      if (!L) continue;
      mdOf.set(L.sn, { tk: TABS[b].tk, r: a.r, how: 'added' });
      // 같은 상품이라 한 줄로 합친 앞 발주들도 그 줄로
      for (const L2 of lines.values()) if (L2 !== L && L2.brand === b && !mdOf.has(L2.sn) && L2.kind === 'item' && L2.date >= goLive && sameKey(L2) === sameKey(L)) mdOf.set(L2.sn, { tk: TABS[b].tk, r: a.r, how: 'matched' });
    }
  }
  summary.writes = writes;

  // 자체 기록
  const now = new Date().toISOString();
  const recs = [...lines.values()].map((L) => {
    const p = prev.get(L.sn), m = mdOf.get(L.sn);
    const keepMd = p && p.md_how === 'added' && (!m || m.how !== 'gone');
    return {
      sn: L.sn, acct: L.acct, sn_date: L.date, ord_nos: L.ords, status: L.status, qty: L.qty, price_cny: L.price,
      product_url: L.link || null, offer_id: L.feat.offer, image_url: L.img || null, img_id: L.feat.img, seller_id: L.feat.seller,
      memo: L.memos.join(' ⏐ ') || null, color_size: L.cs || null, name_cn: L.cn || null, name_en: L.en || null, kind: L.kind,
      brand: L.brand, brand_how: L.how, brand_conf: L.conf, brand_alt: L.alt, name: L.name || null,
      md_tk: m ? m.tk : keepMd ? p.md_tk : null, md_r: m ? m.r : keepMd ? p.md_r : null,
      md_how: m ? m.how : keepMd ? 'added' : L.kind !== 'item' ? 'skip' : L.how === 'check' ? 'check' : L.brand && !TABS[L.brand] ? 'no_tab' : 'none',
      md_at: m && (m.how === 'added' || m.how === 'matched') ? now : (p && p.md_at) || null, updated_at: now,
    };
  });
  for (let i = 0; i < recs.length; i += 500) {
    const { error } = await sb.from('po_lines').upsert(recs.slice(i, i + 500), { onConflict: 'sn' });
    if (error) throw new Error('po_lines upsert ' + error.message);
  }
  summary.ms = Date.now() - t0;
  await sb.from('po_md_config').update({ last_run_at: now, last: summary }).eq('id', 1);
  return summary;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b: any = {};
  try { b = await req.json(); } catch { b = {}; }
  const key = req.headers.get('x-po-cron') || String(b?.key || '');
  const { data: cfg } = await sb.from('po_md_config').select('cron_key,enabled').eq('id', 1).single();
  if (!cfg || !key || key !== cfg.cron_key) return json({ error: 'denied' }, 403);
  const dry = b?.dry === true;
  if (!dry && !cfg.enabled && b?.force !== true) return json({ skipped: 'disabled' });
  if (!dry) {
    const { data: got } = await sb.rpc('po_md_lock', { p_on: true });
    if (!got) return json({ skipped: 'running' });
  }
  try {
    return json(await run(dry, { goLive: b?.go_live }));
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (!dry) await sb.from('po_md_config').update({ last_run_at: new Date().toISOString(), last: { error: msg } }).eq('id', 1);
    return json({ error: msg }, 500);
  } finally {
    if (!dry) await sb.rpc('po_md_lock', { p_on: false });
  }
});
