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
  prefs: {
    exportFmt: 'jpg',
    jpgQuality: 0.95,
    alignText: true,       // 정렬할 때 텍스트 줄 정렬도 같이 맞추기
    alignRef: 'auto',      // auto | selection | page | safe
    stackGap: 24,
    snap: true,
    recentColors: [],
    leftTab: 'add',
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
};
export const IMAGE_DEFAULTS = {
  type: 'image', name: '이미지', asset: null,
  fit: 'cover', zoom: 1, px: 0.5, py: 0.5, radius: 0, flipX: false,
  adj: { b: 100, c: 100, s: 100 },
  shadow: { on: false, color: '#000000', alpha: 0.35, blur: 40, x: 0, y: 16 },
  stroke: { on: false, color: '#ffffff', width: 8 },
};
export const SHAPE_DEFAULTS = {
  type: 'shape', name: '사각형', shape: 'rect',
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
      this.ok = true;
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* noop */ }
    } catch (e) {
      console.warn('IndexedDB 사용 불가 — 메모리 저장으로 동작', e);
      this.ok = false;
    }
    return _db;
  },
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
const MAX_IMG = 2560; // 1080×1920 결과물 + 확대 여유. 더 크면 메모리만 먹음

export const assets = {
  map: new Map(),
  get(id) { return id ? this.map.get(id) || null : null; },
  ready(id) { const a = this.map.get(id); return !!(a && a.img); },
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
      Object.assign(a, { name: rec.name, w: rec.w, h: rec.h, type: rec.type });
      a.url = URL.createObjectURL(rec.blob);
      a.img = await loadImg(a.url);
      a.status = 'ready';
      bus.emit('asset-ready', id);
      return a;
    })().catch(() => { a.status = 'error'; return a; }).finally(() => { delete a.promise; });
    return a.promise;
  },
  async loadMany(ids) {
    await Promise.all([...new Set(ids)].filter(Boolean).map((id) => this.load(id)));
  },
  /** 파일 → 에셋 저장 (긴 변 2560px 초과면 축소). id 반환 */
  async addFile(file) {
    const type = file.type || '';
    const name = file.name || '이미지';
    if (!/^image\//.test(type) && !/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(name)) throw new Error('이미지 파일이 아니에요');
    let url = URL.createObjectURL(file);
    let img;
    try {
      img = await loadImg(url);
    } catch (e) {
      URL.revokeObjectURL(url);
      throw new Error(/heic|heif/i.test(type + name) ? 'HEIC 사진은 JPG로 바꿔서 올려주세요' : `이미지를 열 수 없어요 (${name})`);
    }
    let w = img.naturalWidth, h = img.naturalHeight, blob = file, outType = type;
    const keepAlpha = /png|webp|gif|avif/i.test(type) || /\.(png|webp|gif|avif)$/i.test(name);
    if (Math.max(w, h) > MAX_IMG || !/^image\/(png|jpeg|webp|gif)$/.test(type)) {
      const s = Math.min(1, MAX_IMG / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * s));
      c.height = Math.max(1, Math.round(h * s));
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = true;
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, c.width, c.height);
      outType = keepAlpha ? 'image/png' : 'image/jpeg';
      blob = await new Promise((r) => c.toBlob(r, outType, 0.92));
      w = c.width; h = c.height;
      URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      img = await loadImg(url);
    }
    const id = uid('a');
    await db.put('assets', { id, blob, w, h, name, type: blob.type || outType, createdAt: Date.now() });
    this.map.set(id, { id, w, h, name, type: blob.type || outType, img, url, status: 'ready' });
    return id;
  },
  /** dataURL/Blob 으로 에셋 등록 (프로젝트 파일 불러오기용) — 같은 id 유지 */
  async putBlob(id, blob, meta = {}) {
    const url = URL.createObjectURL(blob);
    const img = await loadImg(url);
    const rec = { id, blob, w: img.naturalWidth, h: img.naturalHeight, name: meta.name || '이미지', type: blob.type, createdAt: Date.now() };
    await db.put('assets', rec);
    this.map.set(id, { id, w: rec.w, h: rec.h, name: rec.name, type: rec.type, img, url, status: 'ready' });
    return id;
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
