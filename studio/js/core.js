/* =========================================================================
   컨텐츠 스튜디오 — 코어 (상태 · 모델 · 히스토리 · 저장소 · 에셋)
   다른 모듈을 import 하지 않는다 (순환 참조 방지).
   ========================================================================= */

export const W = 1080;
export const H = 1920;
export const APP_VERSION = '1.0.0';

/* ---------- 유틸 ---------- */
export const uid = (p = '') => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const deepClone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '') || /Mac OS X/.test(navigator.userAgent);
export const modKey = (e) => (isMac ? e.metaKey : e.ctrlKey);
export const MOD = isMac ? '⌘' : 'Ctrl';
export const ALT = isMac ? '⌥' : 'Alt';
export const isPlainObj = (o) => o && typeof o === 'object' && !Array.isArray(o);

export function mergeDeep(target, src) {
  if (!isPlainObj(src)) return target;
  for (const [k, v] of Object.entries(src)) {
    if (isPlainObj(v) && isPlainObj(target[k])) mergeDeep(target[k], v);
    else target[k] = isPlainObj(v) || Array.isArray(v) ? deepClone(v) : v;
  }
  return target;
}

/** 작은 DOM 빌더 */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function hexToRgb(hex) {
  let s = String(hex || '#000').replace('#', '').trim();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (s.length === 8) s = s.slice(0, 6);
  const n = parseInt(s, 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgba(hex, a = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
export function normHex(v) {
  let s = String(v || '').trim();
  if (!s) return null;
  if (s[0] !== '#') s = '#' + s;
  if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('');
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null;
}
export function debounce(fn, ms) {
  let t = 0;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}
export function sanitizeName(s, max = 40) {
  return String(s || '').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || '이름없음';
}
export function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return `오늘 ${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/* ---------- 이벤트 버스 ---------- */
const listeners = {};
export const bus = {
  on(ev, fn) { (listeners[ev] ||= []).push(fn); return () => bus.off(ev, fn); },
  off(ev, fn) { const a = listeners[ev]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
  emit(ev, ...args) {
    for (const fn of (listeners[ev] || []).slice()) {
      try { fn(...args); } catch (e) { console.error('[studio:' + ev + ']', e); }
    }
  },
};

/* ---------- 앱 상태 ---------- */
/** 릴스·스토리 UI 시뮬레이션에 보이는 광고 계정 정보 — beaduniverse 로 고정 (편집 화면에서 못 바꿈) */
export const AD_PREVIEW = Object.freeze({
  account: 'beaduniverse',
  avatar: null,             // 프로필 사진 없음 → 첫 글자 동그라미
  avatarColor: '#ff2e93',
  cta: '더 알아보기',
  caption: '지금 바로 확인해 보세요 ✨',
});
export const DEFAULT_SETTINGS = Object.assign({
  placement: 'common',      // 지면 (overlay.js PLACEMENTS)
  showUI: true,             // 릴스·스토리 UI 시뮬레이션
  uiOpacity: 0.6,
  showSafe: true,           // 안전영역 표시
}, AD_PREVIEW);

export const state = {
  project: null,
  pageId: null,
  sel: [],
  zoom: 0.35,
  fit: true,
  editingId: null,
  cropId: null,
  preview: false,
  linkEdit: false,
  hoverId: null,
  pageSel: [],
  tool: 'select',          // select(선택) | hand(손 — 화면 이동)
  prefs: {
    exportFmt: 'jpg',
    exportSize: 'orig',    // orig(사진 원본 화질) | 2x | 1x(1080×1920)
    jpgQuality: 0.95,
    alignText: true,       // 정렬할 때 텍스트 줄 정렬도 같이 맞추기
    alignRef: 'auto',      // auto | selection | page | safe
    stackGap: 24,
    snap: true,
    recentColors: [],
    // 패널 접기 — fly: 왼쪽에 열린 패널(text·image·shape·templates·layers, null=접힘) · right: 세부 설정 · pages: 페이지 목록
    ui: { fly: null, lastFly: 'text', right: false, pages: false, fold: {} },
  },
};

export const curPage = () => {
  const p = state.project;
  if (!p) return null;
  return p.pages.find((pg) => pg.id === state.pageId) || p.pages[0] || null;
};
export function findLayer(id, page = curPage()) {
  return (page && page.layers.find((l) => l.id === id)) || null;
}
export function selLayers(page = curPage()) {
  if (!page) return [];
  const set = new Set(state.sel);
  return page.layers.filter((l) => set.has(l.id));
}
export function setSel(ids) {
  const page = curPage();
  const valid = new Set(page ? page.layers.map((l) => l.id) : []);
  const next = [...new Set(ids || [])].filter((id) => valid.has(id));
  const same = next.length === state.sel.length && next.every((id, i) => id === state.sel[i]);
  state.sel = next;
  if (!same) bus.emit('sel');
  bus.emit('render');
}

/** 문서가 바뀌었을 때 알림. history:false 면 (드래그·슬라이더 중) 기록 안 함 */
export function changed(opts = {}) {
  const o = Object.assign({ history: true, save: true }, opts);
  bus.emit('pre-commit'); // 기록 전에 파생 위치 맞추기 (도형 안 글자 등 — render.js)
  if (o.history) history.commit();
  bus.emit('doc', o);
  bus.emit('render');
  if (o.save) bus.emit('save-request');
}

/* ---------- 토스트 ---------- */
export function toast(msg, type = 'info', ms = 2600) {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const el = h('div', { class: `toast toast-${type}` }, msg);
  root.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 320);
  }, ms);
}

/* ---------- 모델 ---------- */
export const TEXT_DEFAULTS = {
  type: 'text', name: '', text: '텍스트를 입력하세요',
  font: 'Pretendard', weight: 700, italic: false, size: 64, color: '#ffffff',
  align: 'left', lh: 1.25, tracking: 0, autoW: true,
  fit: { on: false, maxLines: 2, min: 28 },
  stroke: { on: false, color: '#000000', width: 6 },
  shadow: { on: false, color: '#000000', alpha: 0.45, blur: 18, x: 0, y: 4 },
  bg: { mode: 'none', color: '#ffffff', alpha: 1, padX: 24, padY: 12, radius: 12 },
  grad: { on: false, color2: '#ffffff', angle: 180, chrome: false },   // 글자 그라데이션 · 크롬 광택
  hollow: { on: false, width: 3 },   // 속 비우기 (글자색으로 외곽선만)
  strike: false,                     // 취소선 (정가 표시)
};
export const IMAGE_DEFAULTS = {
  type: 'image', name: '이미지', asset: null,
  fit: 'cover', zoom: 1, px: 0.5, py: 0.5, radius: 0, flipX: false,
  mask: 'rect',             // 모양: rect · ellipse · arch · heart · star
  adj: { b: 100, c: 100, s: 100 },
  shadow: { on: false, color: '#000000', alpha: 0.35, blur: 40, x: 0, y: 16 },
  stroke: { on: false, color: '#ffffff', width: 8 },
};
export const SHAPE_DEFAULTS = {
  type: 'shape', name: '사각형', shape: 'rect',   // rect · ellipse · arch · star · heart · ticket · bubble · sparkle · flower · film · checker · stripes · barcode · grain · (선) arrow · scribble · squiggle · corners
  points: 5, inner: 0.5, tail: 'left',            // 별 꼭짓점 수·안쪽 깊이, 말풍선 꼬리
  thick: 8, flipX: false,                         // 손그림 선 두께, 좌우 반전
  blur: 0,                                        // 흐림(px) — 오라·빛번짐·글로우
  shadow: { on: false, color: '#000000', alpha: 0.3, blur: 30, x: 0, y: 10 },
  fill: { type: 'solid', color: '#ff2e93', alpha: 1, color2: '#000000', alpha2: 0, angle: 180 },
  radius: 0,
  stroke: { on: false, color: '#ffffff', width: 4 },
};
const BASE = { x: 0, y: 0, w: 100, h: 100, rot: 0, opacity: 1, locked: false, hidden: false };

export function newLayer(type, props = {}) {
  const def = type === 'text' ? TEXT_DEFAULTS : type === 'image' ? IMAGE_DEFAULTS : SHAPE_DEFAULTS;
  const id = uid('l');
  const L = mergeDeep(Object.assign(deepClone(BASE), deepClone(def)), props || {});
  L.id = id;
  L.key = props.key || id;
  if (type === 'text' && props.w == null) { L.w = 0; L.h = 0; }
  return L;
}
export function newPage(name = '페이지') {
  return { id: uid('p'), name, bg: '#ffffff', layers: [] };
}
export function newProject(name = '새 프로젝트') {
  const pg = newPage('페이지 1');
  return {
    id: uid('pr'), v: 1, name,
    createdAt: Date.now(), updatedAt: Date.now(),
    settings: deepClone(DEFAULT_SETTINGS),
    pages: [pg], library: [], bulk: null, thumb: null,
  };
}
/** 페이지 복제. keepKeys=true 면 레이어 key 유지 (대량 제작 · 일괄 수정 연결) */
export function clonePage(pg, { keepKeys = true, name } = {}) {
  const c = deepClone(pg);
  c.id = uid('p');
  c.name = name || pg.name;
  delete c.genFrom;
  for (const L of c.layers) {
    const old = L.key || L.id;
    L.id = uid('l');
    L.key = keepKeys ? old : L.id;
  }
  return c;
}
export function layerLabel(L) {
  if (L.name) return L.name;
  if (L.type === 'text') return (L.text || '').replace(/\s+/g, ' ').trim().slice(0, 24) || '빈 텍스트';
  if (L.type === 'image') return '이미지';
  return L.shape === 'ellipse' ? '원' : '사각형';
}

/* ---------- 히스토리 (되돌리기) ---------- */
export const history = {
  stack: [], idx: -1,
  snap() {
    const p = state.project;
    return JSON.stringify({ pages: p.pages, settings: p.settings, bulk: p.bulk || null, name: p.name, library: p.library || [] });
  },
  reset() { this.stack = [this.snap()]; this.idx = 0; bus.emit('history'); },
  commit() {
    if (!state.project) return;
    const s = this.snap();
    if (s === this.stack[this.idx]) return;
    this.stack.length = this.idx + 1;
    this.stack.push(s);
    if (this.stack.length > 80) this.stack.shift();
    this.idx = this.stack.length - 1;
    bus.emit('history');
  },
  /** 파생값(폰트 로딩 후 박스 크기 등)만 바뀐 경우 현재 기록을 갱신 */
  rebase() { if (state.project && this.idx >= 0) this.stack[this.idx] = this.snap(); },
  undo() { if (this.idx <= 0) return false; this.idx--; this.restore(this.stack[this.idx]); return true; },
  redo() { if (this.idx >= this.stack.length - 1) return false; this.idx++; this.restore(this.stack[this.idx]); return true; },
  restore(s) {
    const d = JSON.parse(s);
    const p = state.project;
    p.pages = d.pages; p.settings = d.settings; p.bulk = d.bulk; p.library = d.library || [];
    if (d.name) p.name = d.name;
    if (!p.pages.some((pg) => pg.id === state.pageId)) state.pageId = p.pages[0] && p.pages[0].id;
    const pg = curPage();
    const ids = new Set(pg ? pg.layers.map((l) => l.id) : []);
    state.sel = state.sel.filter((id) => ids.has(id));
    state.editingId = null;
    state.cropId = null;
    bus.emit('restored');
    bus.emit('history');
  },
  get canUndo() { return this.idx > 0; },
  get canRedo() { return this.idx < this.stack.length - 1; },
};

/* ---------- IndexedDB ---------- */
const DB_NAME = 'bb-content-studio';
const STORES = { projects: 'id', assets: 'id', fonts: 'id', meta: 'k' };
let _db = null;
const mem = { projects: new Map(), assets: new Map(), fonts: new Map(), meta: new Map() };
const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx2p = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

/* 이 PC 의 IndexedDB (바로 쓰는 사본) — 아래 db 가 감싸서 온라인 보관과 맞춘다 */
const idb = {
  ok: false,
  async get(store, key) {
    if (!this.ok) return mem[store].get(key);
    return req2p(_db.transaction(store).objectStore(store).get(key));
  },
  async put(store, val) {
    if (!this.ok) { mem[store].set(val[STORES[store]], val); return; }
    const t = _db.transaction(store, 'readwrite');
    t.objectStore(store).put(val);
    await tx2p(t);
  },
  async del(store, key) {
    if (!this.ok) { mem[store].delete(key); return; }
    const t = _db.transaction(store, 'readwrite');
    t.objectStore(store).delete(key);
    await tx2p(t);
  },
  async all(store) {
    if (!this.ok) return [...mem[store].values()];
    return req2p(_db.transaction(store).objectStore(store).getAll());
  },
  async keys(store) {
    if (!this.ok) return [...mem[store].keys()];
    return req2p(_db.transaction(store).objectStore(store).getAllKeys());
  },
};

/* ---------- 온라인 보관 (2026-11-23 사장님 "내 컴퓨터에 있는것도 다 옮겨줘 · 온라인으로") ----------
   예전엔 프로젝트 · 사진 · 글꼴이 이 브라우저 IndexedDB 에만 있어서 다른 PC 에선 안 보이고, 브라우저 자료를 지우면 사라졌다.
   이제 오피스 Supabase 에 같이 둔다 — 프로젝트 = 표 studio_projects(jsonb), 사진 · 글꼴 파일 = 파일함 'studio' + 표 studio_files.
   · IndexedDB 는 그대로 바로 쓰는 사본(빠르고 인터넷이 끊겨도 작업됨). 고친 것은 대기열(meta 'cloudq')에 남겨 두었다가 올린다.
   · 열 때(db.open) 서버 목록과 비교 — 더 새 프로젝트 · 서버에만 있는 글꼴은 받고, 서버에 없는 이 PC 것은 올린다(옛 브라우저 자료 옮기기).
   · 사진은 처음 쓸 때 받는다(db.get 에 없으면). 더 새 편집이 옛 편집에 덮이지 않게 서버 함수가 updatedAt 을 비교한다.
   · 사진 정리(gcAssets)는 이 PC 사본만 지운다 — 서버 파일은 남김. */
const SB_URL = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreWpreGJxc3lqb3FwdXF3b2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjI2NzEsImV4cCI6MjA5Mzk5ODY3MX0.C8WIGqf-zIYkCq0dGWTMjIYuPM-IVInMn1p6FaWbVKA';
const sbHead = (extra) => Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, extra || {});
const studioWho = () => { try { return (localStorage.getItem('brightbeed_diary_me') || '').trim().slice(0, 40) || null; } catch (e) { return null; } };
async function sbRpc(fn, body) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: sbHead({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(fn + ' ' + r.status);
  return r.json();
}
async function upProject(id) {
  const p = await idb.get('projects', id);
  if (!p) return;
  await sbRpc('studio_project_put', { p_id: id, p_data: p, p_ms: p.updatedAt || Date.now(), p_who: studioWho() });
}
async function upFile(store, id) {
  const rec = await idb.get(store, id);
  if (!rec || !rec.blob) return;
  const type = rec.blob.type || rec.type || (store === 'fonts' ? 'font/ttf' : 'application/octet-stream');
  const r = await fetch(`${SB_URL}/storage/v1/object/studio/${store}/${encodeURIComponent(id)}`, {
    method: 'POST', headers: sbHead({ 'Content-Type': type, 'x-upsert': 'false', 'cache-control': '31536000' }), body: rec.blob,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (!/exists|Duplicate|409/i.test(t)) { const e = new Error('파일 올리기 ' + r.status); if (r.status === 413 || /too large|exceeded/i.test(t)) e.fatal = true; throw e; }
  }
  await sbRpc('studio_file_put', { p: { id, store, name: rec.name || null, type, size: rec.blob.size || null, w: rec.w || null, h: rec.h || null,
    family: rec.family || null, weight: rec.weight || null, created_ms: rec.createdAt || Date.now() } });
}
async function downFile(store, id) {
  const r = await fetch(`${SB_URL}/rest/v1/studio_files?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=*`, { headers: sbHead(), cache: 'no-store' });
  if (!r.ok) return null;
  const row = (await r.json())[0];
  if (!row || row.store !== store) return null;
  const f = await fetch(`${SB_URL}/storage/v1/object/public/studio/${row.path.split('/').map(encodeURIComponent).join('/')}`);
  if (!f.ok) return null;
  let blob = await f.blob();
  if (row.type && blob.type !== row.type) blob = new Blob([blob], { type: row.type });
  const rec = store === 'fonts'
    ? { id, family: row.family, weight: row.weight, name: row.name, blob, createdAt: row.created_ms || Date.now() }
    : { id, blob, w: row.w, h: row.h, name: row.name, type: row.type, preview: null, createdAt: row.created_ms || Date.now() };
  await idb.put(store, rec).catch(() => {});
  return rec;
}
const cloud = {
  q: {}, timer: 0, busy: false,
  async init() { try { const r = await idb.get('meta', 'cloudq'); this.q = (r && r.v) || {}; } catch (e) { this.q = {}; } },
  save() { return idb.put('meta', { k: 'cloudq', v: this.q }).catch(() => {}); },
  mark(store, id, op, quiet) {
    this.q[store + ':' + id] = { op, t: Date.now() + Math.random() };
    this.save();
    if (!quiet) { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 2500); }
  },
  async push() {
    if (this.busy) { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 3000); return; }
    const keys = Object.keys(this.q);
    if (!keys.length) return;
    this.busy = true;
    let fail = false;
    for (const k of keys) {
      const job = this.q[k];
      if (!job) continue;
      const i = k.indexOf(':'), store = k.slice(0, i), id = k.slice(i + 1);
      try {
        if (store === 'projects') {
          if (job.op === 'del') await sbRpc('studio_project_del', { p_id: id, p_ms: Math.floor(job.t), p_who: studioWho() });
          else await upProject(id);
        } else if (job.op === 'del') await sbRpc('studio_file_del', { p_id: id });
        else await upFile(store, id);
        if (this.q[k] && this.q[k].t === job.t) delete this.q[k];   // 올리는 동안 또 고친 건 남긴다
      } catch (e) {
        fail = true;
        console.warn('온라인 저장 실패', k, e);
        if (e && e.fatal) { delete this.q[k]; toast(`파일이 너무 커서 온라인에 못 올렸어요 — 이 PC 에만 있어요`, 'warn', 6000); }
      }
    }
    await this.save();
    this.busy = false;
    if (Object.keys(this.q).length) { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), fail ? 30000 : 2000); }
    bus.emit('cloud', { pending: Object.keys(this.q).length, fail });
  },
  // 열 때 한 번 — 서버와 이 PC 를 맞춘다
  async pull() {
    const r = await fetch(`${SB_URL}/rest/v1/studio_projects?select=id,updated_ms,deleted_at`, { headers: sbHead(), cache: 'no-store' });
    if (!r.ok) return;
    const remote = await r.json();
    const local = await idb.all('projects');
    const L = new Map(local.map((p) => [p.id, p])), R = new Map(remote.map((x) => [x.id, x]));
    const need = [];
    for (const x of remote) {
      if (this.q['projects:' + x.id]) continue;   // 이 PC 에서 고친 게 아직 안 올라감
      const p = L.get(x.id), lm = p ? (p.updatedAt || 0) : -1;
      if (x.deleted_at) { if (p && lm <= x.updated_ms) await idb.del('projects', x.id); continue; }
      if (!p || x.updated_ms > lm) need.push(x.id);
    }
    for (let i = 0; i < need.length; i += 20) {
      const ids = need.slice(i, i + 20).map(encodeURIComponent).join(',');
      const rr = await fetch(`${SB_URL}/rest/v1/studio_projects?select=data&id=in.(${ids})`, { headers: sbHead(), cache: 'no-store' });
      if (!rr.ok) break;
      for (const row of await rr.json()) if (row.data && row.data.id) await idb.put('projects', row.data);
    }
    for (const p of local) {
      const x = R.get(p.id);
      if (!x || (!x.deleted_at && (p.updatedAt || 0) > x.updated_ms)) this.mark('projects', p.id, 'put', true);
    }
    const fr = await fetch(`${SB_URL}/rest/v1/studio_files?select=id,store,deleted_at`, { headers: sbHead(), cache: 'no-store' });
    if (!fr.ok) return;
    const files = await fr.json();
    const known = new Set(files.map((f) => f.store + ':' + f.id));
    for (const store of ['assets', 'fonts']) for (const id of await idb.keys(store)) if (!known.has(store + ':' + id)) this.mark(store, id, 'put', true);
    const localFonts = new Set(await idb.keys('fonts'));
    for (const f of files) {
      if (f.store !== 'fonts') continue;
      if (f.deleted_at) { if (localFonts.has(f.id) && !this.q['fonts:' + f.id]) await idb.del('fonts', f.id); continue; }
      if (!localFonts.has(f.id)) await downFile('fonts', f.id).catch(() => null);
    }
  },
};

export const db = {
  ok: false,
  async open() {
    if (_db) return _db;
    try {
      _db = await new Promise((res, rej) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          for (const [s, keyPath] of Object.entries(STORES)) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error('blocked'));
      });
      this.ok = idb.ok = true;
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* noop */ }
    } catch (e) {
      console.warn('IndexedDB 사용 불가 — 메모리 저장으로 동작', e);
      this.ok = idb.ok = false;
    }
    // 온라인 맞추기 — 인터넷이 느려도 6초 넘게 기다리지 않는다 (넘으면 뒤에서 마저 하고 다음에 열 때 반영)
    await cloud.init();
    await Promise.race([cloud.pull().catch((err) => console.warn('온라인 맞추기 실패', err)), new Promise((res) => setTimeout(res, 6000))]);
    cloud.push();
    window.addEventListener('online', () => cloud.push());
    document.addEventListener('visibilitychange', () => { if (document.hidden) cloud.push(); });
    return _db;
  },
  async get(store, key) {
    const v = await idb.get(store, key);
    if (v || (store !== 'assets' && store !== 'fonts') || !key) return v;
    return downFile(store, key).catch(() => null);   // 다른 PC 에서 올린 사진 · 글꼴 — 처음 쓸 때 받아 둔다
  },
  async put(store, val) {
    await idb.put(store, val);
    if (store === 'projects' || store === 'assets' || store === 'fonts') cloud.mark(store, val[STORES[store]], 'put');
  },
  async del(store, key) {
    await idb.del(store, key);
    if (store === 'projects' || store === 'fonts') cloud.mark(store, key, 'del');   // 사진은 이 PC 사본만 정리 (서버 파일은 남김)
  },
  all(store) { return idb.all(store); },
  keys(store) { return idb.keys(store); },
};

export async function getMeta(k, dflt = null) {
  try { const r = await db.get('meta', k); return r ? r.v : dflt; } catch (e) { return dflt; }
}
export async function setMeta(k, v) {
  try { await db.put('meta', { k, v }); } catch (e) { /* noop */ }
}
export const savePrefs = debounce(() => setMeta('prefs', state.prefs), 400);

/* ---------- 이미지 에셋 ---------- */
export function loadImg(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('image load failed'));
    im.src = url;
  });
}
/* 사진은 올린 파일을 줄이거나 다시 압축하지 않고 그대로 보관한다 → 내보낼 때 원본 화질.
   긴 변이 PREVIEW_MAX 보다 큰 사진만 편집 화면용 작은 사본(preview)을 따로 만들어 가볍게 그린다.
   (2026-11-11 전에 올린 사진은 이미 긴 변 2560px 로 줄어 있다 — 원본 화질이 필요하면 다시 올릴 것) */
const PREVIEW_MAX = 2560;
const KEEP_TYPES = /^image\/(png|jpeg|webp|gif|avif)$/;
const EXT_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
const hasAlpha = (t) => /png|webp|gif|avif/i.test(t || '');
function drawToCanvas(img, w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
const canvasBlob = (c, type, q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('이미지 변환 실패'))), type, q));
function makePreview(img, w, h, type) {
  const s = PREVIEW_MAX / Math.max(w, h);
  const c = drawToCanvas(img, w * s, h * s);
  return hasAlpha(type) ? canvasBlob(c, 'image/webp', 0.9) : canvasBlob(c, 'image/jpeg', 0.9);
}

export const assets = {
  map: new Map(),
  get(id) { return id ? this.map.get(id) || null : null; },
  ready(id) { const a = this.map.get(id); return !!(a && a.img); },
  /** 편집 화면용 이미지 불러오기 (큰 사진은 작은 사본) — a.w·a.h 는 늘 원본 크기 */
  load(id) {
    if (!id) return Promise.resolve(null);
    let a = this.map.get(id);
    if (a && a.img) return Promise.resolve(a);
    if (a && a.promise) return a.promise;
    if (a && a.status === 'missing') return Promise.resolve(a);
    a = a || { id, status: 'loading' };
    this.map.set(id, a);
    a.promise = (async () => {
      const rec = await db.get('assets', id);
      if (!rec) { a.status = 'missing'; return a; }
      Object.assign(a, { name: rec.name, w: rec.w, h: rec.h, type: rec.type, hasPreview: !!rec.preview });
      a.url = URL.createObjectURL(rec.preview || rec.blob);
      a.img = await loadImg(a.url);
      if (!a.w || !a.h) { a.w = a.img.naturalWidth; a.h = a.img.naturalHeight; }
      a.status = 'ready';
      bus.emit('asset-ready', id);
      return a;
    })().catch(() => { a.status = 'error'; return a; }).finally(() => { delete a.promise; });
    return a.promise;
  },
  async loadMany(ids) {
    await Promise.all([...new Set(ids)].filter(Boolean).map((id) => this.load(id)));
  },
  /** 내보내기용 원본 화질 이미지 — 작은 사본을 쓰는 사진만 원본 파일을 따로 연다 (끝나면 releaseFull) */
  async full(id) {
    const a = await this.load(id);
    if (!a || !a.img) return null;
    if (!a.hasPreview) return a.img;
    if (a.fullImg) return a.fullImg;
    const rec = await db.get('assets', id);
    if (!rec || !rec.blob) return a.img;
    const u = URL.createObjectURL(rec.blob);
    try { a.fullImg = await loadImg(u); a.fullUrl = u; } catch (e) { URL.revokeObjectURL(u); return a.img; }
    return a.fullImg;
  },
  releaseFull() {
    for (const a of this.map.values()) {
      if (!a.fullImg) continue;
      URL.revokeObjectURL(a.fullUrl);
      a.fullImg = null; a.fullUrl = null;
    }
  },
  /** blob(원본 그대로) 저장 + 큰 사진이면 편집용 사본 만들기. src = blob 을 이미 연 이미지(있으면 다시 안 엶) */
  async _save(id, blob, name, src) {
    let tmp = null;
    if (!src) {
      tmp = URL.createObjectURL(blob);
      try { src = await loadImg(tmp); } catch (e) { URL.revokeObjectURL(tmp); throw e; }
    }
    const w = src.naturalWidth, h = src.naturalHeight;
    const type = blob.type || 'image/png';
    const preview = Math.max(w, h) > PREVIEW_MAX ? await makePreview(src, w, h, type).catch(() => null) : null;
    if (tmp) URL.revokeObjectURL(tmp);
    await db.put('assets', { id, blob, w, h, name, type, preview, createdAt: Date.now() });
    const url = URL.createObjectURL(preview || blob);
    const img = await loadImg(url);
    this.map.set(id, { id, w, h, name, type, img, url, status: 'ready', hasPreview: !!preview });
    return id;
  },
  /** 파일 → 에셋 저장 (원본 크기·화질 그대로). id 반환 */
  async addFile(file) {
    let type = file.type || '';
    const name = file.name || '이미지';
    if (!/^image\//.test(type) && !/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(name)) throw new Error('이미지 파일이 아니에요');
    const furl = URL.createObjectURL(file);
    let img;
    try {
      img = await loadImg(furl);
    } catch (e) {
      URL.revokeObjectURL(furl);
      throw new Error(/heic|heif/i.test(type + name) ? 'HEIC 사진은 JPG로 바꿔서 올려주세요' : `이미지를 열 수 없어요 (${name})`);
    }
    try {
      let blob = file;
      if (!type) { // 형식 정보가 빠진 파일 — 확장자로 알아냄
        const t = EXT_TYPES[(name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase()];
        if (t) { type = t; blob = new Blob([file], { type }); }
      }
      // png·jpg·webp·gif·avif 는 파일 그대로. 그 밖(bmp·heic 등)은 같은 크기 PNG(무손실)로만 바꿈
      if (!KEEP_TYPES.test(type)) blob = await canvasBlob(drawToCanvas(img, img.naturalWidth, img.naturalHeight), 'image/png');
      return await this._save(uid('a'), blob, name, img);
    } finally {
      URL.revokeObjectURL(furl);
    }
  },
  /** Blob 으로 에셋 등록 (프로젝트 파일 불러오기용) — 같은 id 유지 */
  async putBlob(id, blob, meta = {}) {
    return this._save(id, blob, meta.name || '이미지');
  },
};

export function collectAssetIds(p, set = new Set()) {
  for (const pg of p.pages || []) for (const l of pg.layers || []) if (l.asset) set.add(l.asset);
  if (p.settings && p.settings.avatar) set.add(p.settings.avatar);
  for (const id of p.library || []) set.add(id);
  const cfgs = p.bulk ? (p.bulk.rows ? [p.bulk] : Object.values(p.bulk)) : [];
  for (const cfg of cfgs) for (const r of (cfg && cfg.rows) || []) for (const v of Object.values(r.cells || {})) if (v && v.asset) set.add(v.asset);
  return set;
}

/** 어떤 프로젝트에서도 안 쓰는 하루 이상 된 에셋 정리 */
export async function gcAssets() {
  if (!db.ok) return;
  try {
    const projects = await db.all('projects');
    const used = new Set();
    for (const p of projects) collectAssetIds(p, used);
    const recs = await db.all('assets');
    const dayAgo = Date.now() - 86400000;
    for (const r of recs) if (!used.has(r.id) && (r.createdAt || 0) < dayAgo) await db.del('assets', r.id);
  } catch (e) { console.warn('gc 실패', e); }
}
