/* =========================================================================
   폰트 — 카탈로그 · 지연 로딩 · 내 폰트(업로드)
   - 구글 폰트/CDN CSS 폰트는 처음 쓸 때 <link> 를 붙인다.
   - noonnu · 네이버 폰트는 FontFace 로 등록만 해 두고 쓸 때 받는다.
   - 캔버스는 폰트가 다 받아지기 전에 그려지면 대체 글꼴로 그리므로,
     textFontReady() 가 로딩을 걸고 끝나면 'fonts' 이벤트로 다시 그리게 한다.
   - 클로드 아티팩트 판(window.__BB_LOCAL_FONTS 있음): 외부 글꼴 주소가 막혀 있어서
     구글 폰트 말고는 같이 올린 글꼴 파일(fonts/)을 fetch 해서 FontFace 로 등록한다.
     파일이 없는 글꼴은 목록에서 숨김.
   ========================================================================= */
import { bus, db, uid, toast } from './core.js';

const G = 'https://fonts.googleapis.com/css2?family=';
const NOON = 'https://fastly.jsdelivr.net/gh/projectnoonnu/';
const NAVER = 'https://hangeul.pstatic.net/hangeul_static/webfont/';
const R = (a, b, step = 100) => { const o = []; for (let w = a; w <= b; w += step) o.push(w); return o; };
const LOCAL = (typeof window !== 'undefined' && window.__BB_LOCAL_FONTS) || null; // { 글꼴id: { 굵기: '파일 주소' } }

export const FONT_CATS = [
  { id: 'all', name: '전체' },
  { id: 'gothic', name: '고딕' },
  { id: 'serif', name: '명조' },
  { id: 'display', name: '임팩트' },
  { id: 'hand', name: '손글씨' },
  { id: 'latin', name: '영문' },
  { id: 'custom', name: '내 폰트' },
];

export const FONTS = [
  // ── 고딕
  { id: 'Pretendard', name: '프리텐다드', cat: 'gothic', weights: R(100, 900), css: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard-dynamic-subset.css' },
  { id: 'SUIT', name: '수트', cat: 'gothic', weights: R(100, 900), css: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT.css' },
  { id: 'GmarketSans', name: 'G마켓 산스', cat: 'gothic', faces: { 300: NOON + 'noonfonts_2001@1.1/GmarketSansLight.woff', 500: NOON + 'noonfonts_2001@1.1/GmarketSansMedium.woff', 700: NOON + 'noonfonts_2001@1.1/GmarketSansBold.woff' } },
  { id: 'Wanted Sans', name: '원티드 산스', cat: 'gothic', weights: [400, 500, 600, 700, 800, 900, 1000], css: 'https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/static/split/WantedSans.min.css' },
  { id: 'Paperlogy', name: '페이퍼로지', cat: 'gothic', faces: Object.fromEntries(['1Thin', '2ExtraLight', '3Light', '4Regular', '5Medium', '6SemiBold', '7Bold', '8ExtraBold', '9Black'].map((n, i) => [(i + 1) * 100, NOON + '2408-3@1.0/Paperlogy-' + n + '.woff2'])) },
  { id: 'S-Core Dream', name: '에스코어 드림', cat: 'gothic', faces: Object.fromEntries([[100, '1Thin'], [300, '3Light'], [400, '4Regular'], [500, '5Medium'], [600, '6Bold'], [700, '7ExtraBold'], [800, '8Heavy'], [900, '9Black']].map(([w, n]) => [w, NOON + 'noonfonts_six@1.2/S-CoreDream-' + n + '.woff'])) },
  { id: 'NanumSquareNeo', name: '나눔스퀘어 네오', cat: 'gothic', faces: { 300: NAVER + 'NanumSquareNeo/NanumSquareNeoTTF-aLt.woff', 400: NAVER + 'NanumSquareNeo/NanumSquareNeoTTF-bRg.woff', 700: NAVER + 'NanumSquareNeo/NanumSquareNeoTTF-cBd.woff', 800: NAVER + 'NanumSquareNeo/NanumSquareNeoTTF-dEb.woff', 900: NAVER + 'NanumSquareNeo/NanumSquareNeoTTF-eHv.woff' } },
  { id: 'NanumSquare', name: '나눔스퀘어', cat: 'gothic', faces: { 300: NAVER + 'NanumSquare/NanumSquareL.woff', 400: NAVER + 'NanumSquare/NanumSquareR.woff', 700: NAVER + 'NanumSquare/NanumSquareB.woff', 800: NAVER + 'NanumSquare/NanumSquareEB.woff' } },
  { id: 'NanumSquareRound', name: '나눔스퀘어 라운드', cat: 'gothic', faces: { 300: NAVER + 'NanumSquareRound/NanumSquareRoundL.woff', 400: NAVER + 'NanumSquareRound/NanumSquareRoundR.woff', 700: NAVER + 'NanumSquareRound/NanumSquareRoundB.woff', 800: NAVER + 'NanumSquareRound/NanumSquareRoundEB.woff' } },
  { id: 'Noto Sans KR', name: '본고딕 (Noto Sans KR)', cat: 'gothic', weights: R(100, 900), google: 'Noto+Sans+KR:wght@100..900' },
  { id: 'Spoqa Han Sans Neo', name: '스포카 한 산스', cat: 'gothic', weights: [100, 300, 400, 500, 700], css: 'https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/css/SpoqaHanSansNeo.css' },
  { id: 'Gothic A1', name: '고딕 A1', cat: 'gothic', weights: R(100, 900), google: 'Gothic+A1:wght@100;200;300;400;500;600;700;800;900' },
  { id: 'IBM Plex Sans KR', name: 'IBM 플렉스 산스', cat: 'gothic', weights: R(100, 700), google: 'IBM+Plex+Sans+KR:wght@100;200;300;400;500;600;700' },
  { id: 'Nanum Gothic', name: '나눔고딕', cat: 'gothic', weights: [400, 700, 800], google: 'Nanum+Gothic:wght@400;700;800' },
  { id: 'Gowun Dodum', name: '고운돋움', cat: 'gothic', weights: [400], google: 'Gowun+Dodum' },
  { id: 'Sunflower', name: '해바라기', cat: 'gothic', weights: [300, 500, 700], google: 'Sunflower:wght@300;500;700' },
  // ── 명조
  { id: 'Noto Serif KR', name: '본명조 (Noto Serif KR)', cat: 'serif', weights: R(200, 900), google: 'Noto+Serif+KR:wght@200..900' },
  { id: 'MaruBuri', name: '마루 부리', cat: 'serif', faces: { 200: NAVER + 'MaruBuri/MaruBuri-ExtraLight.woff', 300: NAVER + 'MaruBuri/MaruBuri-Light.woff', 400: NAVER + 'MaruBuri/MaruBuri-Regular.woff', 600: NAVER + 'MaruBuri/MaruBuri-SemiBold.woff', 700: NAVER + 'MaruBuri/MaruBuri-Bold.woff' } },
  { id: 'Nanum Myeongjo', name: '나눔명조', cat: 'serif', weights: [400, 700, 800], google: 'Nanum+Myeongjo:wght@400;700;800' },
  { id: 'Gowun Batang', name: '고운바탕', cat: 'serif', weights: [400, 700], google: 'Gowun+Batang:wght@400;700' },
  { id: 'Hahmlet', name: '함렛', cat: 'serif', weights: R(100, 900), google: 'Hahmlet:wght@100..900' },
  { id: 'Song Myung', name: '송명', cat: 'serif', weights: [400], google: 'Song+Myung' },
  // ── 임팩트 (광고용 굵은 제목)
  { id: 'Black Han Sans', name: '검은고딕', cat: 'display', weights: [400], google: 'Black+Han+Sans' },
  { id: 'Jalnan', name: '여기어때 잘난체', cat: 'display', faces: { 400: NOON + 'noonfonts_four@1.2/JalnanOTF00.woff' } },
  { id: 'TmonMonsori', name: '티몬 몬소리', cat: 'display', faces: { 400: NOON + 'noonfonts_two@1.0/TmonMonsori.woff' } },
  { id: 'ONE-Mobile-POP', name: '원스토어 모바일 POP', cat: 'display', faces: { 400: NOON + 'noonfonts_2105_2@1.0/ONE-Mobile-POP.woff' } },
  { id: 'Cafe24Ssurround', name: '카페24 써라운드', cat: 'display', faces: { 400: NOON + 'noonfonts_2105_2@1.0/Cafe24Ssurround.woff' } },
  { id: 'KCC-Ganpan', name: 'KCC 간판체', cat: 'display', faces: { 400: NOON + 'noonfonts_2302@1.0/KCC-Ganpan.woff2' } },
  { id: 'NeoDunggeunmo', name: '네오둥근모 (픽셀)', cat: 'display', faces: { 400: NOON + 'noonfonts_2001@1.3/NeoDunggeunmo.woff' } },
  { id: 'Galmuri11', name: '갈무리11 (픽셀)', cat: 'display', faces: { 400: 'https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/Galmuri11.woff2', 700: 'https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/Galmuri11-Bold.woff2' } },
  { id: 'Do Hyeon', name: '도현', cat: 'display', weights: [400], google: 'Do+Hyeon' },
  { id: 'Jua', name: '주아', cat: 'display', weights: [400], google: 'Jua' },
  { id: 'Bagel Fat One', name: '베이글 팻', cat: 'display', weights: [400], google: 'Bagel+Fat+One' },
  { id: 'Gasoek One', name: '가석', cat: 'display', weights: [400], google: 'Gasoek+One' },
  { id: 'Black And White Picture', name: '흑백사진', cat: 'display', weights: [400], google: 'Black+And+White+Picture' },
  { id: 'Orbit', name: '오르빗', cat: 'display', weights: [400], google: 'Orbit' },
  { id: 'Gugi', name: '구기', cat: 'display', weights: [400], google: 'Gugi' },
  // ── 손글씨
  { id: 'Nanum Pen Script', name: '나눔손글씨 펜', cat: 'hand', weights: [400], google: 'Nanum+Pen+Script' },
  { id: 'Nanum Brush Script', name: '나눔손글씨 붓', cat: 'hand', weights: [400], google: 'Nanum+Brush+Script' },
  { id: 'Binggrae', name: '빙그레체', cat: 'hand', faces: { 400: NOON + 'noonfonts_one@1.0/Binggrae.woff', 700: NOON + 'noonfonts_one@1.0/Binggrae-Bold.woff' } },
  { id: 'Gaegu', name: '개구', cat: 'hand', weights: [300, 400, 700], google: 'Gaegu:wght@300;400;700' },
  { id: 'Hi Melody', name: '하이멜로디', cat: 'hand', weights: [400], google: 'Hi+Melody' },
  { id: 'Dongle', name: '동글', cat: 'hand', weights: [300, 400, 700], google: 'Dongle:wght@300;400;700' },
  { id: 'Yeon Sung', name: '연성', cat: 'hand', weights: [400], google: 'Yeon+Sung' },
  { id: 'Single Day', name: '싱글데이', cat: 'hand', weights: [400], google: 'Single+Day' },
  // ── 영문
  { id: 'Inter', name: 'Inter', cat: 'latin', weights: R(100, 900), google: 'Inter:wght@100..900' },
  { id: 'Montserrat', name: 'Montserrat', cat: 'latin', weights: R(100, 900), google: 'Montserrat:wght@100..900' },
  { id: 'Poppins', name: 'Poppins', cat: 'latin', weights: R(100, 900), google: 'Poppins:wght@100;200;300;400;500;600;700;800;900' },
  { id: 'Bebas Neue', name: 'Bebas Neue', cat: 'latin', weights: [400], google: 'Bebas+Neue' },
  { id: 'Anton', name: 'Anton', cat: 'latin', weights: [400], google: 'Anton' },
  { id: 'Oswald', name: 'Oswald', cat: 'latin', weights: R(200, 700), google: 'Oswald:wght@200..700' },
  { id: 'Archivo Black', name: 'Archivo Black', cat: 'latin', weights: [400], google: 'Archivo+Black' },
  { id: 'Playfair Display', name: 'Playfair Display', cat: 'latin', weights: R(400, 900), google: 'Playfair+Display:wght@400..900' },
  { id: 'DM Serif Display', name: 'DM Serif Display', cat: 'latin', weights: [400], google: 'DM+Serif+Display' },
  { id: 'Instrument Serif', name: 'Instrument Serif', cat: 'latin', weights: [400], google: 'Instrument+Serif:ital@0;1' },
  { id: 'Cormorant Garamond', name: 'Cormorant Garamond', cat: 'latin', weights: R(300, 700), google: 'Cormorant+Garamond:wght@300..700' },
  { id: 'Space Grotesk', name: 'Space Grotesk', cat: 'latin', weights: R(300, 700), google: 'Space+Grotesk:wght@300..700' },
  { id: 'Syne', name: 'Syne', cat: 'latin', weights: R(400, 800), google: 'Syne:wght@400..800' },
  { id: 'Unbounded', name: 'Unbounded', cat: 'latin', weights: R(200, 900), google: 'Unbounded:wght@200..900' },
  { id: 'Abril Fatface', name: 'Abril Fatface', cat: 'latin', weights: [400], google: 'Abril+Fatface' },
  { id: 'Caveat', name: 'Caveat', cat: 'latin', weights: R(400, 700), google: 'Caveat:wght@400..700' },
  { id: 'Pacifico', name: 'Pacifico', cat: 'latin', weights: [400], google: 'Pacifico' },
];

export const WEIGHT_NAMES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black', 1000: 'ExtraBlack' };
export const FALLBACK = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

const byId = new Map();
for (const f of FONTS) {
  f.family = f.family || f.id;
  if (LOCAL) {
    if (LOCAL[f.id]) {
      f.local = LOCAL[f.id];
      f.weights = Object.keys(f.local).map(Number).sort((a, b) => a - b);
      delete f.faces; delete f.css;
    } else if (!f.google) f.unavailable = true;
  }
  if (f.faces) {
    f.weights = Object.keys(f.faces).map(Number).sort((a, b) => a - b);
    for (const [w, url] of Object.entries(f.faces)) {
      const fmt = /\.woff2(\?|$)/.test(url) ? 'woff2' : 'woff';
      try { document.fonts.add(new FontFace(f.family, `url("${url}") format("${fmt}")`, { weight: String(w), style: 'normal', display: 'swap' })); } catch (e) { /* noop */ }
    }
  }
  byId.set(f.id, f);
}

/* ---------- 내 폰트 ---------- */
const custom = new Map(); // id -> entry
export function customFonts() { return [...custom.values()]; }
export function allFonts() { return [...FONTS.filter((f) => !f.unavailable), ...custom.values()]; }

export function fontEntry(id) {
  return byId.get(id) || custom.get(id) || byId.get('Pretendard');
}
export function fontName(id) {
  const f = byId.get(id) || custom.get(id);
  return f ? f.name : (id || '프리텐다드');
}
export function weightsOf(id) { return fontEntry(id).weights || [400]; }
export function nearestWeight(id, w) {
  const ws = weightsOf(id);
  let best = ws[0];
  for (const x of ws) if (Math.abs(x - w) < Math.abs(best - w) || (Math.abs(x - w) === Math.abs(best - w) && x > best)) best = x;
  return best;
}
export function familyOf(id) { return fontEntry(id).family; }
export function cssFont(id, weight, size, italic) {
  const f = fontEntry(id);
  return `${italic ? 'italic ' : ''}${nearestWeight(id, weight)} ${size}px "${f.family}", ${FALLBACK}`;
}

/* ---------- 로딩 ---------- */
const cssPromises = new Map();
const cssDone = new Set();
const localFaces = new Map(); // 'id:굵기' -> Promise
const localLoaded = new Set();
/** 같이 올린 글꼴 파일 한 굵기 받기 (실패해도 resolve — 대체 글꼴로 그림) */
function loadLocalFace(f, w) {
  const k = f.id + ':' + w;
  if (localFaces.has(k)) return localFaces.get(k);
  const p = fetch(f.local[w])
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then((buf) => new FontFace(f.family, buf, { weight: String(w), style: 'normal' }).load())
    .then((face) => { document.fonts.add(face); localLoaded.add(k); })
    .catch((e) => { console.warn('글꼴 파일을 못 읽었어요', f.id, w, e && e.message); });
  localFaces.set(k, p);
  return p;
}
export function ensureFontCss(f, weight) {
  if (!f || f.custom) return Promise.resolve();
  if (f.local) return loadLocalFace(f, nearestWeight(f.id, weight == null ? 400 : weight));
  if (f.faces || f.unavailable) return Promise.resolve();
  if (cssPromises.has(f.id)) return cssPromises.get(f.id);
  const href = f.css || (G + f.google + '&display=swap');
  const p = new Promise((res) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => { cssDone.add(f.id); res(); };
    link.onerror = () => { cssDone.add(f.id); res(); };
    document.head.append(link);
  });
  cssPromises.set(f.id, p);
  return p;
}
const cssReady = (f) => !!(f.faces || f.custom || f.unavailable || cssDone.has(f.id));

let _epoch = 0;
export const fontEpoch = () => _epoch;
let bumpQueued = false;
function bump() {
  _epoch++;
  if (bumpQueued) return;
  bumpQueued = true;
  setTimeout(() => { bumpQueued = false; bus.emit('fonts'); }, 30);
}
const okKeys = new Set();
const pending = new Set();
const failed = new Set();

/** 이 텍스트 레이어에 필요한 글꼴이 준비됐는지. 아니면 로딩을 걸고 false. */
export function textFontReady(L) {
  const f = fontEntry(L.font);
  if (f.local) {
    const k = f.id + ':' + nearestWeight(f.id, L.weight);
    if (localLoaded.has(k)) return true;
    if (!localFaces.has(k)) ensureFontCss(f, L.weight).then(() => { if (localLoaded.has(k)) bump(); });
    return false;
  }
  const spec = cssFont(L.font, L.weight, 40, L.italic);
  const text = L.text || '가';
  const key = spec + '\u0001' + text;
  if (okKeys.has(key)) return true;
  if (failed.has(key) || pending.has(key)) return false;
  if (cssReady(f)) {
    let ok = false;
    try { ok = document.fonts.check(spec, text); } catch (e) { ok = true; }
    if (ok) { okKeys.add(key); return true; }
  }
  pending.add(key);
  ensureFontCss(f)
    .then(() => document.fonts.load(spec, text))
    .then(() => { pending.delete(key); okKeys.add(key); bump(); })
    .catch(() => { pending.delete(key); failed.add(key); });
  return false;
}

/** 내보내기 직전: 레이어들의 글꼴을 모두 받아질 때까지 기다림 */
export async function waitTextFonts(layers) {
  const list = (layers || []).filter((l) => l.type === 'text' && !l.hidden);
  await Promise.all(list.map(async (L) => {
    const f = fontEntry(L.font);
    await ensureFontCss(f, L.weight);
    try { await document.fonts.load(cssFont(L.font, L.weight, 40, L.italic), L.text || '가'); } catch (e) { /* noop */ }
  }));
  if (list.length) _epoch++;
}

/** 폰트 목록 미리보기용 — 이름 글자만 */
export function previewFont(f) {
  return ensureFontCss(f, 500).then(() => document.fonts.load(`${nearestWeight(f.id, 500)} 20px "${f.family}"`, f.name).catch(() => {}));
}

/* ---------- 내 폰트 업로드 ---------- */
const WEIGHT_WORDS = [
  [/(extra|ultra)\s*black|heavy\s*black/i, 950], [/black/i, 900], [/(extra|ultra)\s*bold|heavy/i, 800], [/(semi|demi)\s*bold/i, 600],
  [/bold/i, 700], [/medium/i, 500], [/(extra|ultra)\s*light/i, 200], [/thin|hairline/i, 100], [/light/i, 300], [/regular|normal|book|roman/i, 400],
];
function weightWord(s) {
  if (!/^[A-Za-z ]+$/.test(s)) return null;
  for (const [re, w] of WEIGHT_WORDS) if (re.test(s) && s.replace(re, '').trim() === '') return Math.min(900, w);
  return null;
}
function parseFontFileName(fileName) {
  const base = fileName.replace(/\.(ttf|otf|woff2?|ttc)$/i, '').trim();
  const toks = base.split(/[\s_-]+/).filter(Boolean);
  // 끝의 두 단어("Extra Bold") → 한 단어("Bold") 순으로 굵기 이름인지 본다
  for (const n of [2, 1]) {
    if (toks.length > n) {
      const w = weightWord(toks.slice(-n).join(' '));
      if (w) return { family: toks.slice(0, -n).join(' '), weight: w };
    }
  }
  return { family: base, weight: 400 };
}

async function registerCustomRecord(r) {
  const famCss = 'bbu-' + r.family.replace(/[^\w가-힣 -]/g, '');
  const buf = await r.blob.arrayBuffer();
  const ff = new FontFace(famCss, buf, { weight: String(r.weight || 400), style: 'normal' });
  await ff.load();
  document.fonts.add(ff);
  const id = 'custom:' + r.family;
  let e = custom.get(id);
  if (!e) { e = { id, name: r.family, family: famCss, cat: 'custom', weights: [], custom: true, records: [] }; custom.set(id, e); }
  if (!e.weights.includes(r.weight)) e.weights.push(r.weight);
  e.weights.sort((a, b) => a - b);
  e.records.push(r.id);
}

export async function loadCustomFonts() {
  try {
    const recs = await db.all('fonts');
    for (const r of recs) { try { await registerCustomRecord(r); } catch (e) { console.warn('내 폰트 로드 실패', r.name, e); } }
    if (recs.length) { _epoch++; bus.emit('fonts-list'); }
  } catch (e) { /* noop */ }
}

export async function addFontFiles(files) {
  let added = 0;
  const families = [];
  for (const file of files) {
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) { toast(`${file.name}: TTF·OTF·WOFF 파일만 넣을 수 있어요`, 'warn'); continue; }
    const { family, weight } = parseFontFileName(file.name);
    const rec = { id: uid('f'), family, weight, name: file.name, blob: file, createdAt: Date.now() };
    try {
      await registerCustomRecord(rec);
      await db.put('fonts', rec);
      added++;
      families.push(family);
    } catch (e) {
      toast(`${file.name}: 폰트를 읽을 수 없어요`, 'err');
    }
  }
  if (added) {
    _epoch++;
    bus.emit('fonts-list');
    bus.emit('fonts');
    toast(`내 폰트 ${added}개 추가: ${[...new Set(families)].join(', ')}`, 'ok');
  }
  return families;
}

export async function removeCustomFont(id) {
  const e = custom.get(id);
  if (!e) return;
  for (const rid of e.records) { try { await db.del('fonts', rid); } catch (err) { /* noop */ } }
  custom.delete(id);
  bus.emit('fonts-list');
}

// UI 기본 글꼴은 바로 받아 둔다
ensureFontCss(byId.get('Pretendard'));
if (LOCAL && byId.get('Pretendard').local) ensureFontCss(byId.get('Pretendard'), 700);
