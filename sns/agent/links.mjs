// 꿀꿀집 카드뉴스 — 카드에 넣은 딜로 '꿀꿀집 링크 모음' 페이지에 보낼 links.json 만들기 (Node 18+, 의존성 없음)
//
//   node links.mjs --cards cards.json --deals deals.json [--photos photos.json] [--ph 사진폴더] --out links.json
//
// **카드(피드)에 넣은 딜은 전부 링크 모음에도 올린다** — 빼지 않는다 (2026-11-11 승훈 님 "피드 업로드된 거랑 사이트에 다 업로드 안 된 거 같은데?").
// 주소 고르기 (받는 곳 규칙, 카드뉴스 자동 업로드 에이전트 세션: 판매처 원래 주소 — 어미새 · 남의 제휴 링크 · 단축 링크는 안 됨):
//   1) 글에 적힌 판매처 상품 주소 — 제휴 · 추적 꼬리표(utm · lptag · airbridge · n_* …)는 뗀다 (아무의 수수료도 안 붙는 원래 주소)
//   2) 제휴 · 단축 주소(al.wconcept · link.coupang · naver.me · onelink …)는 그 주소의 robots.txt 가 허용할 때만 한 번 열어
//      넘겨주는 곳(Location)만 읽고 꼬리표를 뗀다 — 판매처 페이지 자체는 열지 않는다
//   3) 그래도 상품 주소가 없으면(예: 'https://www.coupang.com' 만 적힘) 그 판매처의 검색 결과, 모르는 판매처면 네이버쇼핑 검색 — note 에 '검색 결과로 연결'
// 가격: 정가 · 판매가는 카드에 쓴 숫자 그대로 (할인율은 페이지가 계산).
// 사진: 카드에 넣은 그 제품 사진을 image(base64)로 같이 보낸다 — 받는 쪽이 우리 저장소에 올려 씀 (ggul-links v3, 승훈 님 "카드에 넣은 제품 이미지를 그때 넣어 줘").
//   자르지 않은 판매처 사진은 원본 파일(JPG · PNG · WebP), 자른 캡처는 render.mjs --ph 가 카드에서 찍은 <board>-<id>.jpg.
//   image_url 은 판매처가 허용한 대표 이미지(https)만 — 사진 올리기가 실패할 때 대신 쓰임.

import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (compatible; CardNewsCollector/1.0)';
const UA_TOKEN = 'cardnewscollector';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? '1' : all[i + 1]]] : a), []),
);

// 템플릿과 같은 가격 읽기 — '62,900원' · '10.1만원' → 숫자, '18,000원~' 처럼 애매하면 null
function won(s) {
  s = String(s || '').replace(/정가|판매가|\s/g, '');
  if (!s || /[~～]|부터|최대|%/.test(s)) return null;
  let m = s.match(/^([\d,.]+)만(\d{1,4})?원?$/);
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 10000) + (m[2] ? Number(m[2]) : 0);
  m = s.match(/^([\d,]+)원?$/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

// 제휴 · 단축 주소 (어디로 가는지 모르거나 남의 수수료가 붙는 주소) — 풀어서 원래 주소로
const SHORT_HOSTS = /(^|\.)(link\.coupang\.com|coupa\.ng|onelink\.me|bit\.ly|naver\.me|me2\.do|han\.gl|url\.kr|vo\.la|t\.ly|tinyurl\.com|a\.co|amzn\.to|s\.click\.aliexpress\.com|a\.aliexpress\.com|app\.link)$/i;
const isShort = (x) => SHORT_HOSTS.test(x.hostname) || /^al\./i.test(x.hostname); // al.wconcept.co.kr 같은 공유 단축 주소
// 떼어 낼 꼬리표 (제휴 · 광고 추적 · 공유 추적) — 상품을 가리키는 값(goodsNo · itemId · goodscode …)은 남긴다
const TRACK = /^(utm_[a-z_]+|airbridge[a-z_]*|lptag|subid|sub_id|affiliate[a-z_]*|aff_[a-z_]+|trackingcode|tracking_code|clickid|click_id|gclid|fbclid|igshid|napm|n_[a-z_]+|traceid|requestid|token|pagekey|addtag|ctag|wpcid|wref|wtime|sourcetype|clickeventid|short_id|client_id|event_uuid|referrer_timestamp|tracking_template_id|ref|referrer|src|channel)$/i;

// 제휴 중계 주소(linkprice 등)는 안에 든 판매처 주소(tu · url · target)를 꺼낸다
function unwrap(u) {
  try {
    const x = new URL(u);
    if (/(^|\.)linkprice\.com$|(^|\.)ader\.naver\.com$/i.test(x.hostname)) {
      const t = x.searchParams.get('tu') ?? x.searchParams.get('url') ?? x.searchParams.get('target');
      if (t && /^https?:\/\//i.test(t)) return t;
    }
  } catch { /* 그대로 */ }
  return u;
}
function clean(u) {
  const x = new URL(u);
  x.hash = '';
  for (const k of [...x.searchParams.keys()]) if (TRACK.test(k)) x.searchParams.delete(k);
  if (/(^|\.)coupang\.com$/i.test(x.hostname)) { // 쿠팡 상품 주소는 상품 번호(경로) + 옵션(itemId · vendorItemId)만
    for (const k of [...x.searchParams.keys()]) if (!/^(itemId|vendorItemId)$/.test(k)) x.searchParams.delete(k);
  }
  return x.href.replace(/\?$/, '');
}

// robots.txt — User-agent: * 또는 우리 이름 묶음의 Allow/Disallow (가장 긴 규칙이 이김). 404 면 허용, 오류 · 401/403 · 5xx 면 막힌 걸로 친다
const robotsCache = new Map();
async function robotsAllows(u) {
  const x = new URL(u);
  if (!robotsCache.has(x.origin)) {
    let rules = null;
    try {
      const res = await fetch(`${x.origin}/robots.txt`, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(10_000) });
      if (res.status === 404 || res.status === 410) rules = [];
      else if (res.ok) {
        rules = [];
        let applies = false, lastUA = false;
        for (const raw of (await res.text()).split(/\r?\n/)) {
          const m = raw.replace(/#.*/, '').trim().match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
          if (!m) continue;
          const k = m[1].toLowerCase(), v = m[2].trim();
          if (k === 'user-agent') { if (!lastUA) applies = false; if (v === '*' || v.toLowerCase().includes(UA_TOKEN)) applies = true; lastUA = true; continue; }
          lastUA = false;
          if (applies && (k === 'allow' || k === 'disallow') && v) rules.push({ allow: k === 'allow', path: v });
        }
      }
    } catch { rules = null; }
    robotsCache.set(x.origin, rules);
  }
  const rules = robotsCache.get(x.origin);
  if (!rules) return false;
  const p = x.pathname + x.search;
  let best = null;
  for (const r of rules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(p) && (!best || r.path.length > best.path.length)) best = r;
  }
  return !best || best.allow;
}

// 단축 주소 → 넘겨주는 곳(Location)만 읽는다 (최대 3번). 3xx 가 아니면(자바스크립트로 넘기는 곳) 못 푼 걸로
async function resolveShort(u) {
  let cur = u;
  for (let i = 0; i < 3; i++) {
    let x;
    try { x = new URL(cur); } catch { return null; }
    if (!isShort(x)) return cur;
    if (!(await robotsAllows(cur))) return null;
    let res;
    try { res = await fetch(cur, { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(15_000) }); } catch { return null; }
    const loc = res.headers.get('location');
    try { await res.body?.cancel(); } catch { /* 무시 */ }
    if (!(res.status >= 300 && res.status < 400) || !loc) return null;
    cur = unwrap(new URL(loc, cur).href);
  }
  try { return isShort(new URL(cur)) ? null : cur; } catch { return null; }
}

// 상품 주소가 없을 때 — 판매처 검색 결과 (주소 형식이 확실한 곳만), 그 밖은 네이버쇼핑 검색
const SEARCH = [
  [/(^|\.)coupang\.com$/i, '쿠팡', (q) => `https://www.coupang.com/np/search?q=${q}`],
  [/(^|\.)11st\.co\.kr$/i, '11번가', (q) => `https://search.11st.co.kr/Search.tmall?kwd=${q}`],
  [/(^|\.)gmarket\.co\.kr$/i, 'G마켓', (q) => `https://browse.gmarket.co.kr/search?keyword=${q}`],
  [/(^|\.)auction\.co\.kr$/i, '옥션', (q) => `https://browse.auction.co.kr/search?keyword=${q}`],
  [/(^|\.)ssg\.com$/i, 'SSG', (q) => `https://www.ssg.com/search.ssg?query=${q}`],
];
function searchLink(storeUrl, storeName, query) {
  const q = encodeURIComponent(query.replace(/\s+/g, ' ').trim().slice(0, 60));
  let host = '';
  try { host = new URL(storeUrl).hostname; } catch { /* 없음 */ }
  for (const [re, label, f] of SEARCH) if (re.test(host) || storeName === label) return f(q);
  return `https://search.shopping.naver.com/search/all?query=${q}`;
}

// 딜 하나의 주소 → { url, search?: true, why? }
async function pickUrl(item, d, query) {
  const raw = String(item?.store_url ?? '').trim();
  let why = item ? '판매처 주소 없음' : '수집 글을 못 찾음';
  if (raw && !/\.\.\.|…/.test(raw)) { // 화면에 줄여 보인 주소(…)는 실제 주소가 아님
    try {
      let u = unwrap(raw);
      let x = new URL(u);
      if (!/^https?:$/.test(x.protocol) || /eomisae\.co\.kr$/i.test(x.hostname)) why = '판매처 주소 아님';
      else {
        if (isShort(x)) {
          const r = await resolveShort(u);
          if (r) { u = r; x = new URL(u); } else why = `단축 주소를 못 풀었음 (${x.hostname})`;
        }
        if (!isShort(x)) {
          if (x.pathname === '/' || x.pathname === '') why = `상품 주소 없이 ${x.hostname} 만 있음`;
          else return { url: clean(u) };
        }
      }
    } catch { why = '주소 형식 이상'; }
  }
  return { url: searchLink(raw, d.store ?? '', query), search: true, why };
}

const LABEL = (tag) => (/HOT/i.test(tag) ? 'HOT' : /NEW/i.test(tag) ? 'NEW' : /긴급/.test(tag) ? '긴급' : undefined);

async function main() {
  if (!args.cards || !args.deals || !args.out) { console.error('쓰는 법: node links.mjs --cards cards.json --deals deals.json [--photos photos.json] [--ph 사진폴더] --out links.json'); process.exit(1); }
  const cards = JSON.parse(fs.readFileSync(args.cards, 'utf8'));
  const items = JSON.parse(fs.readFileSync(args.deals, 'utf8')).items ?? [];
  const photos = args.photos && fs.existsSync(args.photos) ? JSON.parse(fs.readFileSync(args.photos, 'utf8')) : {};
  // 카드에 넣은 그 제품 사진 → data URL (JPG · PNG · WebP, 512B~3MB 만)
  const base = path.dirname(path.resolve(args.cards));
  const asDataUrl = (f) => {
    if (!f || !fs.existsSync(f)) return null;
    const b = fs.readFileSync(f);
    if (b.length < 512 || b.length > 3 * 1024 * 1024) return null;
    const type = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'jpeg'
      : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? 'png'
      : b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' ? 'webp' : null;
    return type ? `data:image/${type};base64,` + b.toString('base64') : null;
  };
  const cardPhoto = (d) => {
    if (!d.image) return null; // 글자 카드면 사진 없음
    const local = !/^(https?|data|file):/i.test(d.image) ? path.resolve(base, d.image) : null;
    const cropped = Array.isArray(d.imageCrop) && d.imageCrop.length === 4;
    // 자르지 않은 원본(JPG · PNG · WebP)이 더 선명 — 받는 쪽 저장소가 2026-11-11 저녁부터 WebP · PNG 도 받음 (#10 땐 WebP 거절)
    if (local && !cropped) { const u = asDataUrl(local); if (u) return u; }
    if (!args.ph || !d.ref) return null;
    return asDataUrl(path.join(path.resolve(args.ph), String(d.ref).replace(/[^\w-]+/g, '-') + '.jpg'));
  };
  const links = [], searched = [];
  for (const d of cards.deals ?? []) {
    const name = String(d.name ?? '').replace(/==/g, '').replace(/\s+/g, ' ').trim();
    const title = (d.brand && !name.replace(/\s/g, '').toLowerCase().includes(d.brand.replace(/\s/g, '').toLowerCase()) ? d.brand + ' ' : '') + name;
    const [board, id] = String(d.ref ?? '').split(':');
    const item = items.find((x) => x.board === board && x.id === id);
    const picked = await pickUrl(item, d, title);
    if (picked.search) searched.push(`${title} (${picked.why})`);
    const p = photos[d.ref];
    const price = won(d.price), original = won(d.was);
    const image = cardPhoto(d); // 카드에 사진을 넣은 딜만
    links.push({
      title,
      url: picked.url,
      ...(price ? { price } : {}),
      ...(original && price && original > price ? { original_price: original } : {}),
      ...(p?.ok && /^https:\/\//.test(p.src ?? '') ? { image_url: p.src } : {}),
      ...(image ? { image } : {}),
      ...(LABEL(d.tag ?? '') ? { label: LABEL(d.tag) } : {}),
      note: [d.nowLabel, d.store, picked.search ? '검색 결과로 연결' : null].filter(Boolean).join(' · ') || undefined,
    });
  }
  const t = Date.parse(cards.asOf ?? '');
  const k = Number.isFinite(t) ? new Date(t + 9 * 3_600_000) : null;
  const out = {
    title: String(cards.cover?.title ?? '오늘의 꿀딜').replace(/==/g, '').replace(/\n/g, ' '),
    ...(k ? { subtitle: `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${k.getUTCHours() < 12 ? '오전' : '오후'} ${((k.getUTCHours() + 11) % 12) + 1}시${k.getUTCMinutes() ? ` ${k.getUTCMinutes()}분` : ''} 기준`, as_of: new Date(t).toISOString() } : {}),
    links,
  };
  fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
  const withPhoto = links.filter((l) => l.image).length;
  console.error(`링크 ${links.length}개 = 카드 딜 ${(cards.deals ?? []).length}개 (카드 사진 ${withPhoto}개)${searched.length ? ` · 검색 결과로 연결 ${searched.length}: ${searched.join(' / ')}` : ''}`);
}

main().catch((e) => { console.error('링크 만들기 실패: ' + e.message); process.exit(1); });
