/* =========================================================================
   문서 편집 동작 — 추가 · 삭제 · 정렬 · 순서 · 페이지 · 일괄 수정(연결)
   편집 화면·패널·단축키가 모두 이 함수들을 쓴다.
   ========================================================================= */
import {
  W, H, state, bus, curPage, findLayer, selLayers, setSel, changed, newLayer, newPage, clonePage,
  deepClone, mergeDeep, toast, assets, luminance, debounce, uid, clamp, MOD,
} from './core.js';
import {
  syncText, aabb, unionBox, isBackdrop, isPassive, hitLayer, layoutText,
  syncAttached, attachedShape, attachedTexts, placeInShape, shapeTextRect, canHoldText, defaultShapePad,
} from './render.js';
import { safeRect } from './overlay.js';

/* ---------- 공통 ---------- */
export function linkedCount(L) {
  if (!L || !state.project) return 0;
  let n = 0;
  for (const pg of state.project.pages) {
    if (pg.id === state.pageId) continue;
    if (pg.layers.some((t) => t.key === L.key && t.type === L.type)) n++;
  }
  return n;
}

const NO_COPY = { common: ['id', 'key', 'name'], text: ['text'], image: ['asset', 'px', 'py', 'zoom'], shape: [] };
/** 같은 key 를 가진 다른 페이지 레이어에 스타일·위치 복사 (내용은 그대로) */
export function propagate(ids) {
  const page = curPage();
  let n = 0;
  for (const id of ids) {
    const S = findLayer(id, page);
    if (!S) continue;
    for (const pg of state.project.pages) {
      if (pg === page) continue;
      for (const T of pg.layers) {
        if (T.key !== S.key || T.type !== S.type) continue;
        const keep = {};
        for (const k of [...NO_COPY.common, ...(NO_COPY[S.type] || [])]) keep[k] = T[k];
        Object.assign(T, deepClone(S), keep);
        if (!S.inShape) delete T.inShape; // 도형에서 뗀 것도 같이
        if (T.type === 'text') syncText(T);
        n++;
      }
    }
  }
  return n;
}

/** 레이어 편집 확정 — 연결 수정이 켜져 있으면 다른 페이지에도 반영 + 기록 */
export function commitLayers(ids) {
  let n = 0;
  if (state.linkEdit && ids && ids.length) n = propagate(ids);
  changed({ propagated: n });
  if (n) bus.emit('pages-dirty');
}

/** 속성 바꾸기. live=true 면 기록 없이 화면만 갱신 (슬라이더 드래그 중) */
export function setProps(ids, patch, { live = false } = {}) {
  const page = curPage();
  const onlyBg = Object.keys(patch).length === 1 && 'bg' in patch;
  for (const id of ids) {
    const L = findLayer(id, page);
    if (!L) continue;
    if (L.type === 'text' && patch.w != null && L.autoW) L.autoW = false;
    mergeDeep(L, patch);
    if (L.type === 'text') syncText(L, onlyBg ? [0.5, 0.5] : undefined);
  }
  syncAttached(page); // 도형을 바꿨으면 안에 든 글자도 바로 따라가게
  if (live) { bus.emit('doc', { history: false, live: true }); bus.emit('render'); }
  else commitLayers(ids);
}

/* ---------- 도형 + 안에 든 글자 = 한 덩어리 ---------- */
/** 선택에 도형이 있으면 그 안에 든 글자도 같이 (복제·복사·순서 바꾸기용) */
export function withAttached(Ls, page = curPage()) {
  const out = [...Ls];
  const ids = new Set(out.map((l) => l.id));
  for (const L of Ls) {
    if (L.type !== 'shape') continue;
    for (const T of attachedTexts(L, page)) if (!ids.has(T.id)) { ids.add(T.id); out.push(T); }
  }
  return out;
}
/** 도형 안 글자는 그 도형으로 바꿔서 (옮기기·정렬용 — 글자 위치는 도형에서 정해짐) */
export function proxyLayers(Ls, page = curPage()) {
  const out = [], seen = new Set();
  for (const L of Ls) {
    const X = attachedShape(L, page) || L;
    if (!seen.has(X.id)) { seen.add(X.id); out.push(X); }
  }
  return out;
}
/** 글자 가운데 아래에 있는 도형 (글자를 넣을 수 있는 것 중 맨 위) */
export function shapeUnder(T, page = curPage()) {
  if (!T || T.type !== 'text' || !page) return null;
  const cx = T.x + T.w / 2, cy = T.y + T.h / 2;
  for (let i = page.layers.length - 1; i >= 0; i--) {
    const S = page.layers[i];
    if (S === T || S.hidden || !canHoldText(S) || (S.blur || 0) > 0 || isPassive(S) || isBackdrop(S)) continue;
    if (hitLayer(S, cx, cy)) return S;
  }
  return null;
}
/** 글자를 도형 바로 위 순서로 */
function keepAbove(page, T, S) {
  const ti = page.layers.indexOf(T), si = page.layers.indexOf(S);
  if (ti < 0 || si < 0 || ti > si) return;
  page.layers.splice(ti, 1);
  page.layers.splice(page.layers.indexOf(S) + 1, 0, T);
}
/** 있는 글자를 도형 안에 넣기 (가로·세로 가운데) */
export function attachText(textId, shapeId) {
  const page = curPage();
  const T = findLayer(textId, page), S = findLayer(shapeId, page);
  if (!T || !S || T.type !== 'text' || !canHoldText(S)) return;
  if (T.locked) { toast('잠긴 글자예요 — 잠금을 풀고 넣어 주세요', 'warn'); return; }
  T.inShape = { key: S.key, ay: 'middle', pad: defaultShapePad(S) };
  T.align = 'center';
  // 도형보다 크면 도형 안에 맞게 줄어들도록 (자동 축소)
  if (!T.fit || !T.fit.on) T.fit = { on: true, maxLines: 8, min: Math.min(14, T.size) };
  keepAbove(page, T, S);
  placeInShape(T, S);
  setSel([T.id]);
  commitLayers([T.id]);
  toast('도형 안에 넣었어요 — 도형을 옮기거나 크기를 바꾸면 글자도 따라가요', 'ok', 2600);
}
export function detachText(textId) {
  const T = findLayer(textId);
  if (!T || !T.inShape) return;
  delete T.inShape;
  commitLayers([T.id]);
  bus.emit('sel');
  toast('도형에서 뗐어요 — 이제 따로 움직여요', 'info', 1800);
}
/** 도형 안 글자 위치 바꾸기 — align: left|center|right (가로 = 줄 정렬), ay: top|middle|bottom, pad: 여백 */
export function setInShape(id, { align, ay, pad, live = false } = {}) {
  const T = findLayer(id);
  if (!T || !T.inShape) return;
  const patch = {};
  if (align) patch.align = align;
  const ins = {};
  if (ay) ins.ay = ay;
  if (pad != null && Number.isFinite(+pad)) ins.pad = Math.max(0, +pad);
  if (Object.keys(ins).length) patch.inShape = ins;
  if (Object.keys(patch).length) setProps([id], patch, { live });
}
/** 도형 안에 새 글자 넣고 바로 입력 */
export function addTextInShape(shapeId) {
  const page = curPage();
  const S = findLayer(shapeId, page);
  if (!S || !canHoldText(S)) { toast('이 도형에는 글자를 넣을 수 없어요', 'warn'); return null; }
  const f = S.fill || {};
  const dark = (f.alpha ?? 1) > 0.35 && luminance(f.color || '#ffffff') < 0.55;
  const L = newLayer('text', { name: '도형 글자', text: '텍스트 입력', weight: 800, size: 60, color: dark ? '#ffffff' : '#111111', align: 'center', autoW: false, fit: { on: true, maxLines: 4, min: 12 } });
  const pad = defaultShapePad(S);
  const r = shapeTextRect(S);
  const iw = Math.max(20, r.w - 2 * pad), ih = Math.max(20, r.h - 2 * pad);
  // 한 줄이 안쪽 높이의 절반쯤, 너비엔 네댓 글자 — 문구가 길면 자동 축소로 도형 안에 맞춰짐
  L.size = Math.round(clamp(Math.min(ih * 0.36, (iw * 0.9) / 4.5), 16, 120));
  L.inShape = { key: S.key, ay: 'middle', pad };
  const above = attachedTexts(S, page).reduce((m, t) => Math.max(m, page.layers.indexOf(t)), page.layers.indexOf(S));
  page.layers.splice(above + 1, 0, L);
  placeInShape(L, S);
  setSel([L.id]);
  changed();
  bus.emit('edit-text', L.id, true);
  return L;
}

function isLightPage(page) {
  if (page.layers.some((l) => l.type === 'image' && !l.hidden)) return false;
  return luminance(page.bg || '#ffffff') > 0.6;
}

export function addLayer(L, { select = true, index } = {}) {
  const page = curPage();
  if (index == null || index < 0 || index > page.layers.length) page.layers.push(L);
  else page.layers.splice(index, 0, L);
  if (L.type === 'text') syncText(L);
  if (select) setSel([L.id]);
  changed();
  return L;
}

/** 텍스트 기준점(정렬 방향의 윗변)을 (ax, ay) 에 맞춰 놓기 */
export function placeText(L, ax, ay) {
  L.x = ax; L.y = ay; L.w = 0; L.h = 0;
  syncText(L);
}

/** 새 텍스트 놓을 높이: 안전영역 안에서 다른 글자와 안 겹치는 첫 자리 (없으면 계단식으로) */
function nextTextY(page) {
  const r = safeRect(state.project.settings.placement);
  const boxes = page.layers.filter((l) => l.type === 'text' && !l.hidden).map(aabb);
  const band = 96;
  for (let y = r.y + 90; y <= r.y2 - band; y += 48) {
    if (!boxes.some((b) => b.y < y + band && b.y2 > y)) return y;
  }
  return r.y + 90 + (boxes.length % 8) * 60;
}

export function addText(preset = {}, { at, edit = true } = {}) {
  const page = curPage();
  const props = deepClone(preset.props || {});
  if (isLightPage(page)) {
    if (!props.color || props.color.toLowerCase() === '#ffffff') {
      if (!(props.bg && props.bg.mode && props.bg.mode !== 'none' && luminance(props.bg.color || '#fff') < 0.5)) props.color = '#111111';
    }
  }
  const L = newLayer('text', props);
  const ax = at ? at.x : (L.align === 'left' ? safeRect(state.project.settings.placement).x + 40 : L.align === 'right' ? W - 105 : W / 2);
  const ay = at ? at.y : nextTextY(page);
  page.layers.push(L);
  placeText(L, ax, ay);
  if (at && at.center) L.y -= L.h / 2; // 끌어다 놓은 곳이 글자 가운데가 되게
  setSel([L.id]);
  changed();
  if (edit) bus.emit('edit-text', L.id, true);
  return L;
}

export function addShape(preset = {}, { at } = {}) {
  const page = curPage();
  const L = newLayer('shape', deepClone(preset.props || {}));
  const full = L.w >= W * 0.98 && L.h >= H * 0.35; // 화면 전체 오버레이는 늘 제자리
  if (at && !full) { L.x = Math.round(at.x - L.w / 2); L.y = Math.round(at.y - L.h / 2); }
  else if (!preset.props || preset.props.x == null) { L.x = (W - L.w) / 2; L.y = (H - L.h) / 2; }
  let index;
  if (preset.back) {
    // 그라데이션·어둡게 같은 오버레이는 배경 이미지 바로 위, 글자 아래에
    let i = 0;
    while (i < page.layers.length && page.layers[i].type === 'image' && isBackdrop(page.layers[i])) i++;
    index = i;
  }
  return addLayer(L, { index });
}

/* ---------- 이미지 ---------- */
export async function importFiles(files) {
  const ids = [];
  const list = [...files].filter((f) => f && (/^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif|bmp|heic|heif)$/i.test(f.name || '')));
  if (!list.length) { toast('이미지 파일만 넣을 수 있어요', 'warn'); return ids; }
  if (list.length > 3) toast(`이미지 ${list.length}장 불러오는 중…`, 'info', 1600);
  for (const f of list) {
    try {
      const id = await assets.addFile(f);
      ids.push(id);
      const lib = state.project.library || (state.project.library = []);
      if (!lib.includes(id)) lib.unshift(id);
    } catch (e) { toast(e.message || '이미지를 불러오지 못했어요', 'err', 3600); }
  }
  bus.emit('library');
  return ids;
}

function baseName(name) { return String(name || '이미지').replace(/\.[a-z0-9]+$/i, '').slice(0, 18); }

export function addImageAsset(id, { at, background } = {}) {
  const page = curPage();
  const a = assets.get(id);
  const iw = (a && a.w) || 1000, ih = (a && a.h) || 1000;
  const L = newLayer('image', { asset: id, name: baseName(a && a.name) });
  if (background || !page.layers.length) {
    Object.assign(L, { x: 0, y: 0, w: W, h: H, fit: 'cover', name: '배경 이미지' });
    return addLayer(L, { index: 0 });
  }
  const s = Math.min((W * 0.72) / iw, (H * 0.46) / ih);
  L.w = Math.round(iw * s); L.h = Math.round(ih * s);
  const r = safeRect(state.project.settings.placement);
  const cx = at ? at.x : W / 2, cy = at ? at.y : r.y + r.h / 2;
  L.x = Math.round(cx - L.w / 2); L.y = Math.round(cy - L.h / 2);
  return addLayer(L);
}

export function replaceImage(layerId, assetId) {
  const L = findLayer(layerId);
  if (!L || L.type !== 'image') return;
  L.asset = assetId; L.px = 0.5; L.py = 0.5; L.zoom = 1;
  const a = assets.get(assetId);
  if (a && (!L.name || L.name === '이미지')) L.name = baseName(a.name);
  setSel([L.id]);
  commitLayers([L.id]);
}

export function imageLayerAt(p) {
  const page = curPage();
  for (let i = page.layers.length - 1; i >= 0; i--) {
    const L = page.layers[i];
    if (L.hidden || L.locked || L.type !== 'image') continue;
    if (hitLayer(L, p.x, p.y)) return L;
  }
  return null;
}
/** 대량 교체 대상 이미지: 드롭 지점 아래 → 없으면 가장 큰 이미지 */
export function mainImageSlot(page = curPage(), p) {
  if (p) { const hit = imageLayerAt(p); if (hit) return hit; }
  const imgs = page.layers.filter((l) => l.type === 'image' && !l.hidden);
  if (!imgs.length) return null;
  return imgs.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
}

/** 이미지 여러 장 → 현재 디자인 그대로 사진만 바꾼 페이지들 */
export function pagesFromImages(ids, slotKey) {
  const p = state.project;
  const page = curPage();
  const idx = p.pages.indexOf(page);
  const slot = page.layers.find((l) => l.key === slotKey);
  if (!slot) return;
  slot.asset = ids[0]; slot.px = 0.5; slot.py = 0.5; slot.zoom = 1;
  const made = [];
  ids.slice(1).forEach((id, i) => {
    const c = clonePage(page, { name: `${page.name.replace(/\s*\d+$/, '')} ${p.pages.length + i + 1}` });
    const t = c.layers.find((l) => l.key === slotKey);
    t.asset = id; t.px = 0.5; t.py = 0.5; t.zoom = 1;
    made.push(c);
  });
  p.pages.splice(idx + 1, 0, ...made);
  changed();
  bus.emit('pages');
  toast(`페이지 ${made.length}개를 더 만들었어요 (총 ${ids.length}장)`, 'ok');
}
/** 이미지 여러 장 → 각각 배경인 새 페이지 */
export function backgroundPages(ids) {
  const p = state.project;
  const page = curPage();
  const idx = p.pages.indexOf(page);
  const made = ids.map((id, i) => {
    const pg = newPage(`페이지 ${p.pages.length + i + 1}`);
    pg.layers.push(newLayer('image', { asset: id, x: 0, y: 0, w: W, h: H, fit: 'cover', name: '배경 이미지' }));
    return pg;
  });
  if (!page.layers.length) { p.pages.splice(idx, 1, ...made); state.pageId = made[0].id; }
  else p.pages.splice(idx + 1, 0, ...made);
  changed();
  bus.emit('pages');
  selectPage(made[0].id);
  bus.emit('page');
  toast(`새 페이지 ${made.length}개 (사진이 배경)`, 'ok');
}

export function fillBackground(id) {
  const page = curPage();
  const L = findLayer(id, page);
  if (!L || L.type !== 'image') return;
  Object.assign(L, { x: 0, y: 0, w: W, h: H, rot: 0, fit: 'cover', zoom: 1, px: 0.5, py: 0.5, radius: 0 });
  page.layers = [L, ...page.layers.filter((l) => l !== L)];
  commitLayers([id]);
}

/* ---------- 선택 레이어 조작 ---------- */
export function selectAll() {
  const page = curPage();
  setSel(page.layers.filter((l) => !l.locked && !l.hidden).map((l) => l.id));
}

export function deleteSel() {
  const page = curPage();
  const picked = selLayers().filter((l) => !l.locked);
  // 도형을 지우면 안에 든 글자도 같이 (잠근 글자는 떼어서 남김)
  const all = withAttached(picked).filter((l) => !l.locked);
  const ids = new Set(all.map((l) => l.id));
  if (!ids.size) return;
  const withText = all.length - picked.length;
  const keys = new Set(page.layers.filter((l) => ids.has(l.id)).map((l) => l.key));
  page.layers = page.layers.filter((l) => !ids.has(l.id));
  const unlink = (pg) => { for (const l of pg.layers) if (l.inShape && keys.has(l.inShape.key)) delete l.inShape; };
  unlink(page);
  let other = 0;
  if (state.linkEdit) {
    for (const pg of state.project.pages) {
      if (pg === page) continue;
      const before = pg.layers.length;
      pg.layers = pg.layers.filter((l) => !keys.has(l.key));
      unlink(pg);
      other += before - pg.layers.length;
    }
  }
  setSel([]);
  changed();
  if (other) { bus.emit('pages-dirty'); toast(`다른 페이지의 같은 요소 ${other}개도 지웠어요`, 'info'); }
  else if (withText) toast(`도형 안 글자 ${withText}개도 같이 지웠어요 (되돌리기 ${MOD}+Z)`, 'info', 2200);
}

/** 레이어 복사본 — 같이 복사된 도형·글자 사이 연결은 새 key 로 이어 주고, 도형 없이 복사된 글자는 뗀다 */
export function cloneLayers(Ls, { dx = 0, dy = 0, keepKey = false } = {}) {
  const keyMap = new Map();
  const out = Ls.map((L) => {
    const c = deepClone(L);
    c.id = uid('l');
    if (!keepKey) c.key = c.id;
    keyMap.set(L.key, c.key);
    c.x += dx; c.y += dy;
    return c;
  });
  for (const c of out) {
    if (!c.inShape) continue;
    const nk = keyMap.get(c.inShape.key);
    if (nk) c.inShape.key = nk; else if (!keepKey) delete c.inShape;
  }
  return out;
}

export function duplicateSel() {
  const page = curPage();
  const Ls = withAttached(selLayers());
  if (!Ls.length) return;
  const copies = cloneLayers(Ls, { dx: 24, dy: 24 });
  const top = Math.max(...Ls.map((l) => page.layers.indexOf(l)));
  page.layers.splice(top + 1, 0, ...copies);
  const picked = new Set(state.sel);
  setSel(copies.filter((c, i) => picked.has(Ls[i].id)).map((c) => c.id));
  changed();
}

const CLIP_MARK = 'bb-studio-layers:';
export function copySel(e) {
  const Ls = withAttached(selLayers());
  if (!Ls.length) return false;
  state.clipboard = { pageId: state.pageId, layers: deepClone(Ls) };
  try { if (e && e.clipboardData) { e.clipboardData.setData('text/plain', CLIP_MARK + JSON.stringify(state.clipboard)); e.preventDefault(); } } catch (err) { /* noop */ }
  return true;
}
export function cutSel(e) { if (copySel(e)) deleteSel(); }
export function readClipText(text) {
  if (text && text.startsWith(CLIP_MARK)) {
    try { return JSON.parse(text.slice(CLIP_MARK.length)); } catch (e) { return null; }
  }
  return null;
}
export function pasteLayers(clip = state.clipboard) {
  if (!clip || !clip.layers || !clip.layers.length) return false;
  const page = curPage();
  const same = clip.pageId === state.pageId;
  const copies = cloneLayers(clip.layers, { dx: same ? 24 : 0, dy: same ? 24 : 0 });
  page.layers.push(...copies);
  for (const c of copies) if (c.type === 'text') syncText(c);
  setSel(copies.map((c) => c.id));
  changed();
  if (same) state.clipboard = { pageId: clip.pageId, layers: copies.map((c) => deepClone(c)) };
  return true;
}

/* ---------- 스타일 복사 · 붙여넣기 (서식 맞추기) ---------- */
const STYLE_KEYS = {
  text: ['font', 'weight', 'italic', 'size', 'color', 'grad', 'hollow', 'strike', 'align', 'lh', 'tracking', 'stroke', 'shadow', 'bg', 'opacity'],
  shape: ['fill', 'radius', 'stroke', 'shadow', 'thick', 'blur', 'opacity'],
  image: ['radius', 'mask', 'adj', 'shadow', 'stroke', 'opacity'],
};
export function copyStyle() {
  const L = selLayers()[0];
  if (!L) return;
  const props = {};
  for (const k of STYLE_KEYS[L.type]) props[k] = deepClone(L[k]);
  state.styleClip = { type: L.type, props };
  toast(`${{ text: '글자', shape: '도형', image: '이미지' }[L.type]} 스타일을 복사했어요 — 다른 요소 선택 후 붙여넣기`, 'ok', 2200);
}
export function pasteStyle() {
  const clip = state.styleClip;
  if (!clip) { toast('먼저 스타일을 복사하세요', 'warn'); return; }
  const ids = selLayers().filter((l) => l.type === clip.type && !l.locked).map((l) => l.id);
  if (!ids.length) { toast(`같은 종류(${{ text: '텍스트', shape: '도형', image: '이미지' }[clip.type]})를 선택하세요`, 'warn'); return; }
  setProps(ids, deepClone(clip.props));
  toast(`${ids.length}개에 스타일을 붙였어요`, 'ok', 1400);
}

let nudged = [];
const nudgeCommit = debounce(() => commitLayers(nudged), 400);
export function nudge(dx, dy) {
  const Ls = proxyLayers(selLayers()).filter((l) => !l.locked);
  if (!Ls.length) return;
  for (const L of Ls) { L.x += dx; L.y += dy; }
  nudged = Ls.map((l) => l.id);
  syncAttached(curPage());
  bus.emit('doc', { history: false, live: true });
  bus.emit('render');
  nudgeCommit();
}

export function reorder(where) {
  const page = curPage();
  const ids = new Set(withAttached(selLayers()).map((l) => l.id)); // 도형을 옮기면 안의 글자도 같이
  if (!ids.size) return;
  const L = page.layers;
  if (where === 'front') page.layers = [...L.filter((l) => !ids.has(l.id)), ...L.filter((l) => ids.has(l.id))];
  else if (where === 'back') page.layers = [...L.filter((l) => ids.has(l.id)), ...L.filter((l) => !ids.has(l.id))];
  else if (where === 'forward') { for (let i = L.length - 2; i >= 0; i--) if (ids.has(L[i].id) && !ids.has(L[i + 1].id)) [L[i], L[i + 1]] = [L[i + 1], L[i]]; }
  else if (where === 'backward') { for (let i = 1; i < L.length; i++) if (ids.has(L[i].id) && !ids.has(L[i - 1].id)) [L[i], L[i - 1]] = [L[i - 1], L[i]]; }
  changed();
}
export function moveLayerTo(id, toIndex) {
  const page = curPage();
  const i = page.layers.findIndex((l) => l.id === id);
  if (i < 0) return;
  const [L] = page.layers.splice(i, 1);
  page.layers.splice(Math.max(0, Math.min(toIndex, page.layers.length)), 0, L);
  changed();
}
export function toggleHidden(id) {
  const L = findLayer(id); if (!L) return;
  L.hidden = !L.hidden;
  const inner = L.type === 'shape' ? attachedTexts(L, curPage()) : []; // 도형 안 글자도 같이 숨기기·보이기
  for (const T of inner) T.hidden = L.hidden;
  const gone = new Set([id, ...inner.map((t) => t.id)]);
  if (L.hidden) setSel(state.sel.filter((x) => !gone.has(x)));
  commitLayers([id, ...inner.map((t) => t.id)]);
}
export function toggleLocked(id) {
  const L = findLayer(id); if (!L) return;
  L.locked = !L.locked;
  changed();
}
export function renameLayer(id, name) {
  const L = findLayer(id); if (!L) return;
  L.name = String(name || '').trim().slice(0, 40);
  changed();
}

/* ---------- 정렬 ---------- */
export function alignRefBox(Ls) {
  const kind = state.prefs.alignRef === 'auto' ? (Ls.length > 1 ? 'selection' : 'page') : state.prefs.alignRef;
  if (kind === 'selection' && Ls.length > 1) return unionBox(Ls.map(aabb));
  if (kind === 'safe') return safeRect(state.project.settings.placement);
  return { x: 0, y: 0, x2: W, y2: H, w: W, h: H };
}

export function align(mode) {
  const page = curPage();
  const picked = selLayers();
  // 도형 안 글자만 (또는 그 도형과 같이) 고르고 맞추면 → 글자를 도형 안에서 맞춤 (도형은 그대로).
  // 기준을 「캔버스 · 안전영역」으로 골랐을 때만 도형째 움직인다.
  if (state.prefs.alignRef === 'auto' || state.prefs.alignRef === 'selection') {
    const texts = picked.filter((l) => l.type === 'text' && !l.locked && attachedShape(l, page));
    const holders = new Set(texts.map((t) => attachedShape(t, page)));
    if (texts.length && picked.every((l) => texts.includes(l) || holders.has(l))) {
      const [ha, va] = { left: ['left'], hcenter: ['center'], right: ['right'], top: [null, 'top'], vmiddle: [null, 'middle'], bottom: [null, 'bottom'] }[mode] || [];
      for (const t of texts) { if (ha) t.align = ha; if (va) t.inShape.ay = va; }
      syncAttached(page);
      commitLayers(texts.map((t) => t.id));
      return;
    }
  }
  const Ls = proxyLayers(picked).filter((l) => !l.locked);
  if (!Ls.length) return;
  if (state.prefs.alignText && (mode === 'left' || mode === 'hcenter' || mode === 'right')) {
    const a = mode === 'hcenter' ? 'center' : mode;
    for (const L of picked) if (L.type === 'text' && !L.locked && !attachedShape(L, page) && L.align !== a) L.align = a;
  }
  const ref = alignRefBox(Ls);
  for (const L of Ls) {
    const b = aabb(L);
    let dx = 0, dy = 0;
    if (mode === 'left') dx = ref.x - b.x;
    else if (mode === 'right') dx = ref.x2 - b.x2;
    else if (mode === 'hcenter') dx = (ref.x + ref.x2) / 2 - (b.x + b.x2) / 2;
    else if (mode === 'top') dy = ref.y - b.y;
    else if (mode === 'bottom') dy = ref.y2 - b.y2;
    else if (mode === 'vmiddle') dy = (ref.y + ref.y2) / 2 - (b.y + b.y2) / 2;
    L.x += dx; L.y += dy;
  }
  commitLayers(Ls.map((l) => l.id));
}

export function distribute(axis) {
  const Ls = proxyLayers(selLayers()).filter((l) => !l.locked);
  if (Ls.length < 3) { toast('3개 이상 선택하면 간격을 똑같이 맞출 수 있어요', 'warn'); return; }
  const horiz = axis === 'h';
  const items = Ls.map((L) => ({ L, b: aabb(L) })).sort((a, b) => (horiz ? a.b.x - b.b.x : a.b.y - b.b.y));
  const first = items[0].b, last = items[items.length - 1].b;
  const span = horiz ? last.x2 - first.x : last.y2 - first.y;
  const total = items.reduce((s, it) => s + (horiz ? it.b.w : it.b.h), 0);
  const gap = (span - total) / (items.length - 1);
  let cur = horiz ? first.x : first.y;
  for (const it of items) {
    const d = cur - (horiz ? it.b.x : it.b.y);
    if (horiz) it.L.x += d; else it.L.y += d;
    cur += (horiz ? it.b.w : it.b.h) + gap;
  }
  commitLayers(Ls.map((l) => l.id));
}

/** 위에서부터 차례로 쌓기 (간격 px 고정) */
export function stack(axis, gap) {
  const Ls = proxyLayers(selLayers()).filter((l) => !l.locked);
  if (Ls.length < 2) { toast('2개 이상 선택하세요', 'warn'); return; }
  const horiz = axis === 'h';
  const items = Ls.map((L) => ({ L, b: aabb(L) })).sort((a, b) => (horiz ? a.b.x - b.b.x : a.b.y - b.b.y));
  let cur = horiz ? items[0].b.x2 + gap : items[0].b.y2 + gap;
  for (const it of items.slice(1)) {
    const d = cur - (horiz ? it.b.x : it.b.y);
    if (horiz) it.L.x += d; else it.L.y += d;
    cur += (horiz ? it.b.w : it.b.h) + gap;
  }
  commitLayers(Ls.map((l) => l.id));
}

/* ---------- 페이지 ---------- */
export function selectPage(id) {
  if (!state.project.pages.some((p) => p.id === id)) return;
  bus.emit('page-will-change');
  state.pageId = id;
  state.sel = [];
  state.cropId = null;
  bus.emit('page');
  bus.emit('sel');
  bus.emit('render');
}
export function addPage() {
  const p = state.project;
  const pg = newPage(`페이지 ${p.pages.length + 1}`);
  const cur = curPage();
  if (cur) pg.bg = cur.bg;
  p.pages.splice(p.pages.indexOf(cur) + 1, 0, pg);
  changed();
  bus.emit('pages');
  selectPage(pg.id);
}
export function duplicatePage(id = state.pageId) {
  const p = state.project;
  const src = p.pages.find((x) => x.id === id);
  if (!src) return;
  const base = src.name.replace(/\s*사본(\s*\d+)?$/, '');
  let name = base + ' 사본';
  for (let k = 2; p.pages.some((x) => x.name === name); k++) name = `${base} 사본 ${k}`;
  const c = clonePage(src, { name });
  p.pages.splice(p.pages.indexOf(src) + 1, 0, c);
  changed();
  bus.emit('pages');
  selectPage(c.id);
}
export function deletePages(ids) {
  const p = state.project;
  const set = new Set(ids);
  if (set.size >= p.pages.length) {
    // 전부 지우면 빈 페이지 하나 남김
    p.pages = [newPage('페이지 1')];
  } else {
    const curIdx = p.pages.findIndex((x) => x.id === state.pageId);
    p.pages = p.pages.filter((x) => !set.has(x.id));
    if (set.has(state.pageId)) state.pageId = p.pages[Math.min(curIdx, p.pages.length - 1)].id;
  }
  if (!p.pages.some((x) => x.id === state.pageId)) state.pageId = p.pages[0].id;
  state.pageSel = state.pageSel.filter((x) => !set.has(x));
  state.sel = [];
  changed();
  bus.emit('pages');
  bus.emit('page');
  bus.emit('sel');
}
export function movePage(id, toIndex) {
  const p = state.project;
  const i = p.pages.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [pg] = p.pages.splice(i, 1);
  p.pages.splice(Math.max(0, Math.min(toIndex, p.pages.length)), 0, pg);
  changed();
  bus.emit('pages');
}
export function renamePage(id, name) {
  const pg = state.project.pages.find((x) => x.id === id);
  if (!pg) return;
  pg.name = String(name || '').trim().slice(0, 40) || pg.name;
  changed();
  bus.emit('pages');
}
export function setPageBg(color, { live = false } = {}) {
  const page = curPage();
  page.bg = color;
  if (live) { bus.emit('render'); bus.emit('doc', { history: false, live: true }); }
  else changed();
}
export function applyBgToAll() {
  const bg = curPage().bg;
  for (const pg of state.project.pages) pg.bg = bg;
  changed();
  bus.emit('pages-dirty');
}

/** 선택한 요소를 다른 모든 페이지에도 넣기 (같은 key → 일괄 수정 연결) */
export function copyToAllPages() {
  const page = curPage();
  const Ls = withAttached(selLayers());
  if (!Ls.length) return;
  let n = 0;
  for (const pg of state.project.pages) {
    if (pg === page) continue;
    for (const L of Ls) {
      if (pg.layers.some((t) => t.key === L.key)) continue;
      const c = deepClone(L);
      c.id = uid('l');
      pg.layers.push(c);
      n++;
    }
  }
  changed();
  bus.emit('pages-dirty');
  toast(n ? `다른 페이지 ${state.project.pages.length - 1}개에 넣었어요 (일괄 수정으로 연결됨)` : '이미 모든 페이지에 있어요', n ? 'ok' : 'info');
}

/** 템플릿 → 새 페이지 (지금 페이지가 비어 있으면 그 자리에) */
export function insertTemplatePage(pg) {
  const p = state.project;
  const cur = curPage();
  for (const L of pg.layers) if (L.type === 'text') syncText(L);
  if (cur && !cur.layers.length) {
    pg.name = cur.name;
    p.pages.splice(p.pages.indexOf(cur), 1, pg);
  } else {
    pg.name = `페이지 ${p.pages.length + 1}`;
    p.pages.splice(p.pages.indexOf(cur) + 1, 0, pg);
  }
  changed();
  bus.emit('pages');
  selectPage(pg.id);
}
