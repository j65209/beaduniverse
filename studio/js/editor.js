/* =========================================================================
   캔버스 편집기 — 화면 맞춤/확대 · 선택 · 이동 · 크기 · 회전 · 스냅 가이드
   · 인라인 텍스트 편집 · 이미지 위치(크롭) 조정 · 파일 드롭
   ========================================================================= */
import { W, H, state, bus, curPage, findLayer, selLayers, setSel, clamp, modKey, assets, deepClone, uid, history, debounce, AD_PREVIEW } from './core.js';
import { drawPage, aabb, unionBox, hitLayer, layoutText, resizeKeepAnchor, imgDrawRect, isBackdrop, isPassive, syncPageText, syncAttached, attachedShape } from './render.js';
import { drawMockUI, drawSafeZones, safeRect, findViolations } from './overlay.js';
import { familyOf, nearestWeight, FALLBACK } from './fonts.js';
import * as act from './actions.js';

const SEL = '#18a0fb';
const GUIDE = '#ff2e93';
const WARN = '#ef4444';

let stage, pageCanvas, overlayCanvas, pctx, octx;
let dpr = 1;
const view = { left: 0, top: 0, w: 0, h: 0, fitZoom: 0.3 };
let raf = 0;
let drag = null;
let guides = [];
let marquee = null;
let spaceDown = false;
let violations = [];
let violationKey = '';
let ta = null;
let dropState = null;

export const getView = () => view;
export const currentViolations = () => violations.slice();

export function initEditor() {
  stage = document.getElementById('stage');
  pageCanvas = document.getElementById('pageCanvas');
  overlayCanvas = document.getElementById('overlayCanvas');
  pctx = pageCanvas.getContext('2d');
  octx = overlayCanvas.getContext('2d');
  new ResizeObserver(() => layoutStage()).observe(stage);
  window.addEventListener('resize', () => layoutStage());
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  stage.addEventListener('dblclick', onDbl);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('dragover', onDragOver);
  stage.addEventListener('dragleave', onDragLeave);
  stage.addEventListener('drop', onDrop);
  stage.addEventListener('contextmenu', onContext);
  bus.on('render', requestRender);
  bus.on('asset-ready', requestRender);
  bus.on('fonts', onFontsLoaded);
  bus.on('edit-text', (id, selectAll) => startTextEdit(id, selectAll));
  bus.on('page-will-change', () => { finishTextEdit(); exitCrop(true); });
  bus.on('page', () => { requestRender(); });
  bus.on('restored', () => { finishTextEdit(true); syncAll(); requestRender(); });
  layoutStage();
}

function syncAll() {
  let any = false;
  for (const pg of state.project.pages) { if (syncPageText(pg)) any = true; if (syncAttached(pg)) any = true; }
  return any;
}
const fontRebase = debounce(() => { history.rebase(); bus.emit('save-request'); }, 500);
function onFontsLoaded() {
  if (!state.project) return;
  if (syncAll()) { fontRebase(); bus.emit('doc', { history: false, fonts: true }); }
  if (ta) positionTextarea();
  requestRender();
}

/* ---------- 화면 배치 ---------- */
function computeFit() {
  const pad = 26;
  return clamp(Math.min((view.w - pad * 2) / W, (view.h - pad * 2) / H), 0.05, 4);
}
function centerPage() {
  view.left = Math.round((view.w - W * state.zoom) / 2);
  view.top = Math.round((view.h - H * state.zoom) / 2);
}
function layoutStage() {
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  view.w = r.width; view.h = r.height;
  dpr = Math.min(3, window.devicePixelRatio || 1);
  overlayCanvas.width = Math.round(r.width * dpr);
  overlayCanvas.height = Math.round(r.height * dpr);
  overlayCanvas.style.width = r.width + 'px';
  overlayCanvas.style.height = r.height + 'px';
  view.fitZoom = computeFit();
  if (state.fit) { state.zoom = view.fitZoom; centerPage(); }
  positionPage();
  requestRender();
  bus.emit('zoom');
}
function positionPage() {
  const z = state.zoom;
  const cw = W * z, ch = H * z;
  Object.assign(pageCanvas.style, { left: view.left + 'px', top: view.top + 'px', width: cw + 'px', height: ch + 'px' });
  const bs = Math.min(z * dpr, 2.5);
  const pw = Math.max(1, Math.round(W * bs)), ph = Math.max(1, Math.round(H * bs));
  if (pageCanvas.width !== pw || pageCanvas.height !== ph) { pageCanvas.width = pw; pageCanvas.height = ph; }
  if (ta) positionTextarea();
}
export function fitView() {
  state.fit = true;
  view.fitZoom = computeFit();
  state.zoom = view.fitZoom;
  centerPage();
  positionPage();
  requestRender();
  bus.emit('zoom');
}
export function zoomTo(z, sx = view.w / 2, sy = view.h / 2) {
  z = clamp(z, 0.08, 3);
  const dx = (sx - view.left) / state.zoom, dy = (sy - view.top) / state.zoom;
  state.zoom = z;
  state.fit = false;
  view.left = sx - dx * z;
  view.top = sy - dy * z;
  positionPage();
  requestRender();
  bus.emit('zoom');
}
export function setSpace(on) {
  spaceDown = on;
  if (stage) stage.classList.toggle('space', on || state.tool === 'hand');
}
/** 도구 바꾸기 — select(선택) · hand(손: 끌어서 화면 이동) */
export function setTool(t) {
  state.tool = t === 'hand' ? 'hand' : 'select';
  if (stage) stage.classList.toggle('space', spaceDown || state.tool === 'hand');
  if (state.tool === 'hand' && state.hoverId) { state.hoverId = null; requestRender(); }
  bus.emit('tool');
}
const panning = () => spaceDown || state.tool === 'hand';

function toDesign(e) {
  const r = stage.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  return { x: (sx - view.left) / state.zoom, y: (sy - view.top) / state.zoom, sx, sy };
}
const toScreen = (x, y) => [view.left + x * state.zoom, view.top + y * state.zoom];

/* ---------- 그리기 ---------- */
export function requestRender() {
  if (!raf) raf = requestAnimationFrame(renderNow);
}
function renderNow() {
  raf = 0;
  const pg = curPage();
  if (!pg || !pageCanvas) return;
  const bs = pageCanvas.width / W;
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
  pctx.setTransform(bs, 0, 0, bs, 0, 0);
  syncAttached(pg);
  drawPage(pctx, pg, { px: bs, editingId: state.editingId });
  const st = state.project.settings;
  violations = st.showSafe || st.showUI ? findViolations(pg, st.placement) : [];
  const vk = state.pageId + ':' + violations.join(',');
  if (vk !== violationKey) { violationKey = vk; bus.emit('violations', violations); }
  renderOverlay(pg, st);
}

function pathLayer(ctx, L, pad = 0) {
  ctx.save();
  ctx.translate(L.x + L.w / 2, L.y + L.h / 2);
  if (L.rot) ctx.rotate(L.rot * Math.PI / 180);
  ctx.beginPath();
  ctx.rect(-L.w / 2 - pad, -L.h / 2 - pad, L.w + pad * 2, L.h + pad * 2);
  ctx.restore();
}
function outline(L, color, width, dash) {
  const z = state.zoom;
  octx.save();
  pathLayer(octx, L, 0.5 / z);
  octx.lineWidth = width / z;
  octx.strokeStyle = color;
  if (dash) octx.setLineDash(dash.map((d) => d / z));
  octx.stroke();
  octx.restore();
}
function screenTag(text, wx, wy, { bg = SEL, color = '#fff', align = 'center', dy = 0 } = {}) {
  const z = state.zoom;
  octx.save();
  const fs = 11 / z;
  octx.font = `700 ${fs}px "Pretendard", sans-serif`;
  const w = octx.measureText(text).width + 12 / z, h = 18 / z;
  let x = wx - w / 2;
  if (align === 'left') x = wx;
  if (align === 'right') x = wx - w;
  const y = wy + dy / z;
  octx.fillStyle = bg;
  octx.beginPath();
  if (octx.roundRect) octx.roundRect(x, y, w, h, 4 / z); else octx.rect(x, y, w, h);
  octx.fill();
  octx.fillStyle = color;
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillText(text, x + w / 2, y + h / 2 + 0.5 / z);
  octx.restore();
}
function localToWorld(L, lx, ly) {
  const rad = (L.rot || 0) * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const dx = lx - L.w / 2, dy = ly - L.h / 2;
  return [L.x + L.w / 2 + dx * c - dy * s, L.y + L.h / 2 + dx * s + dy * c];
}
const HANDLE_ORDER = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
function handleLocal(L, hnd) {
  return { nw: [0, 0], n: [L.w / 2, 0], ne: [L.w, 0], e: [L.w, L.h / 2], se: [L.w, L.h], s: [L.w / 2, L.h], sw: [0, L.h], w: [0, L.h / 2] }[hnd];
}
/** 도형 안 글자 — 위치·너비·회전은 도형을 따라가서 글자 크기(모서리)만 조절 */
const inShapeOf = (L) => attachedShape(L, curPage());
function handlesOf(L) {
  if (L.locked) return [];
  if (L.type === 'text') return inShapeOf(L) ? ['nw', 'ne', 'se', 'sw'] : ['nw', 'ne', 'se', 'sw', 'e', 'w'];
  return HANDLE_ORDER;
}
const hasRot = (L) => !L.locked && !inShapeOf(L);
function rotHandle(L) { return localToWorld(L, L.w / 2, -30 / state.zoom); }

function drawSelection(L) {
  const z = state.zoom;
  outline(L, SEL, 1.5);
  if (L.locked) { const b = aabb(L); screenTag('🔒 잠김', (b.x + b.x2) / 2, b.y2, { dy: 8, bg: '#4b5563' }); return; }
  if (state.cropId === L.id) return;
  const holder = inShapeOf(L);
  if (holder) outline(holder, SEL, 1, [4, 3]); // 글자가 든 도형도 점선으로
  octx.save();
  // 회전 손잡이
  if (hasRot(L)) {
    const top = localToWorld(L, L.w / 2, 0);
    const rh = rotHandle(L);
    octx.strokeStyle = SEL;
    octx.lineWidth = 1 / z;
    octx.beginPath(); octx.moveTo(top[0], top[1]); octx.lineTo(rh[0], rh[1]); octx.stroke();
    octx.fillStyle = '#fff';
    octx.lineWidth = 1.5 / z;
    octx.beginPath(); octx.arc(rh[0], rh[1], 5.5 / z, 0, Math.PI * 2); octx.fill(); octx.stroke();
  }
  // 크기 손잡이
  const hs = 8 / z;
  for (const hnd of handlesOf(L)) {
    const [wx, wy] = localToWorld(L, ...handleLocal(L, hnd));
    octx.save();
    octx.translate(wx, wy);
    if (L.rot) octx.rotate(L.rot * Math.PI / 180);
    octx.fillStyle = '#fff';
    octx.strokeStyle = SEL;
    octx.lineWidth = 1.5 / z;
    if (L.type === 'text' && hnd.length === 1) {
      octx.beginPath();
      if (octx.roundRect) octx.roundRect(-hs * 0.32, -hs * 0.8, hs * 0.64, hs * 1.6, hs * 0.3); else octx.rect(-hs * 0.32, -hs * 0.8, hs * 0.64, hs * 1.6);
      octx.fill(); octx.stroke();
    } else {
      octx.fillRect(-hs / 2, -hs / 2, hs, hs);
      octx.strokeRect(-hs / 2, -hs / 2, hs, hs);
    }
    octx.restore();
  }
  octx.restore();
  const b = aabb(L);
  let label = `${Math.round(L.w)} × ${Math.round(L.h)}`;
  if (L.type === 'text') {
    const lay = layoutText(L);
    label = `${holder ? '도형 안 · ' : ''}${Math.round(lay.size * 10) / 10}px${lay.shrunk ? ' (자동축소)' : ''} · ${lay.lines.length}줄`;
  }
  if (L.rot) label += ` · ${Math.round(L.rot)}°`;
  screenTag(label, (b.x + b.x2) / 2, b.y2, { dy: 10 });
}

function drawCropUI(L) {
  const a = assets.get(L.asset);
  if (!a || !a.img) return;
  const z = state.zoom;
  const r = imgDrawRect(L, a.w, a.h);
  octx.save();
  octx.translate(L.x + L.w / 2, L.y + L.h / 2);
  if (L.rot) octx.rotate(L.rot * Math.PI / 180);
  octx.translate(-L.w / 2, -L.h / 2);
  octx.save();
  octx.beginPath();
  octx.rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  octx.rect(0, 0, L.w, L.h);
  octx.clip('evenodd');
  octx.globalAlpha = 0.4;
  if (L.flipX) { octx.translate(L.w, 0); octx.scale(-1, 1); octx.drawImage(a.img, L.w - r.x - r.w, r.y, r.w, r.h); }
  else octx.drawImage(a.img, r.x, r.y, r.w, r.h);
  octx.restore();
  octx.setLineDash([4 / z, 3 / z]);
  octx.lineWidth = 1 / z;
  octx.strokeStyle = '#fff';
  octx.strokeRect(r.x, r.y, r.w, r.h);
  octx.setLineDash([]);
  octx.lineWidth = 2 / z;
  octx.strokeStyle = SEL;
  octx.strokeRect(0, 0, L.w, L.h);
  octx.restore();
  const b = aabb(L);
  screenTag('드래그 = 위치 · 휠 = 확대 · Esc = 완료', (b.x + b.x2) / 2, b.y2, { dy: 10, bg: '#111' });
}

function drawEmptyHint() {
  const z = state.zoom;
  octx.save();
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  const pg = curPage();
  const light = (pg.bg || '#fff').toLowerCase() !== '#000000';
  octx.fillStyle = light ? 'rgba(17,17,17,0.42)' : 'rgba(255,255,255,0.6)';
  octx.font = `700 ${16 / z}px "Pretendard", sans-serif`;
  octx.fillText('사진을 여기로 끌어다 놓으세요', W / 2, H / 2 - 16 / z);
  octx.font = `500 ${12.5 / z}px "Pretendard", sans-serif`;
  octx.fillText('또는 왼쪽에서 템플릿 · 텍스트를 추가', W / 2, H / 2 + 10 / z);
  octx.restore();
}

function renderOverlay(pg, st) {
  const z = state.zoom;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  octx.setTransform(z * dpr, 0, 0, z * dpr, view.left * dpr, view.top * dpr);
  octx.save();
  octx.beginPath();
  octx.rect(0, 0, W, H);
  octx.clip();
  if (state.preview || st.showUI) {
    drawMockUI(octx, st.placement, { settings: Object.assign({}, st, AD_PREVIEW), avatarImg: null, alpha: state.preview ? 1 : st.uiOpacity, px: z * dpr });
  }
  if (!state.preview && st.showSafe) drawSafeZones(octx, st.placement, z);
  octx.restore();
  if (state.preview) return;
  if (!pg.layers.length && !dropState) drawEmptyHint();
  // 안전영역 침범
  for (const id of violations) {
    const L = findLayer(id, pg);
    if (!L) continue;
    outline(L, WARN, 2, [5, 3]);
    const b = aabb(L);
    screenTag('⚠ UI에 가려짐', b.x2, b.y, { bg: WARN, align: 'right', dy: -22 });
  }
  // 호버
  if (state.hoverId && !state.sel.includes(state.hoverId) && !drag) {
    const L = findLayer(state.hoverId, pg);
    if (L) outline(L, SEL, 1.5);
  }
  if (state.cropId) { const L = findLayer(state.cropId, pg); if (L) drawCropUI(L); }
  const Ls = selLayers(pg);
  if (Ls.length === 1) {
    if (state.editingId === Ls[0].id) outline(Ls[0], SEL, 1, [4, 3]);
    else drawSelection(Ls[0]);
  } else if (Ls.length > 1) {
    for (const L of Ls) outline(L, SEL, 1);
    const u = unionBox(Ls.map(aabb));
    octx.save();
    octx.setLineDash([5 / z, 3 / z]);
    octx.lineWidth = 1 / z;
    octx.strokeStyle = SEL;
    octx.strokeRect(u.x - 3 / z, u.y - 3 / z, u.w + 6 / z, u.h + 6 / z);
    octx.restore();
    screenTag(`${Ls.length}개 선택`, (u.x + u.x2) / 2, u.y2, { dy: 10 });
  }
  // 이동 중 좌표
  if (drag && drag.mode === 'move' && drag.moved && drag.movers.length) {
    const u = unionBox(drag.movers.map(aabb));
    screenTag(`X ${Math.round(u.x)} · Y ${Math.round(u.y)}`, u.x, u.y, { align: 'left', dy: -24, bg: '#111' });
  }
  // 스냅 가이드
  if (guides.length) {
    octx.save();
    octx.strokeStyle = GUIDE;
    octx.lineWidth = 1 / z;
    for (const g of guides) {
      octx.beginPath();
      if (g.axis === 'x') { octx.moveTo(g.v, -40 / z); octx.lineTo(g.v, H + 40 / z); }
      else { octx.moveTo(-40 / z, g.v); octx.lineTo(W + 40 / z, g.v); }
      octx.stroke();
    }
    octx.restore();
  }
  if (marquee) {
    octx.save();
    octx.fillStyle = 'rgba(24,160,251,0.08)';
    octx.strokeStyle = SEL;
    octx.lineWidth = 1 / z;
    octx.fillRect(marquee.x, marquee.y, marquee.x2 - marquee.x, marquee.y2 - marquee.y);
    octx.strokeRect(marquee.x, marquee.y, marquee.x2 - marquee.x, marquee.y2 - marquee.y);
    octx.restore();
  }
  if (dropState && dropState.preset) {
    octx.save();
    octx.strokeStyle = '#22c55e';
    octx.lineWidth = 2 / z;
    const r = 14 / z;
    octx.beginPath();
    octx.moveTo(dropState.x - r, dropState.y); octx.lineTo(dropState.x + r, dropState.y);
    octx.moveTo(dropState.x, dropState.y - r); octx.lineTo(dropState.x, dropState.y + r);
    octx.stroke();
    screenTag('놓으면 여기에 추가', dropState.x, dropState.y, { bg: '#16a34a', dy: 14 });
    octx.restore();
  } else if (dropState) {
    octx.save();
    if (dropState.target) {
      outline(dropState.target, '#22c55e', 3);
      const b = aabb(dropState.target);
      screenTag('놓으면 이 이미지 교체', (b.x + b.x2) / 2, (b.y + b.y2) / 2, { bg: '#16a34a' });
    } else {
      octx.strokeStyle = '#22c55e';
      octx.lineWidth = 3 / z;
      octx.setLineDash([8 / z, 5 / z]);
      octx.strokeRect(0, 0, W, H);
      screenTag(pg.layers.length ? '놓으면 이미지 추가' : '놓으면 배경으로 꽉 채움', W / 2, H / 2, { bg: '#16a34a' });
    }
    octx.restore();
  }
}

/* ---------- 손잡이 / 히트 ---------- */
function handleAt(sx, sy) {
  const Ls = selLayers();
  if (Ls.length !== 1 || state.editingId) return null;
  const L = Ls[0];
  if (L.locked || state.cropId === L.id) return null;
  if (hasRot(L)) {
    const rh = rotHandle(L);
    const [rx, ry] = toScreen(rh[0], rh[1]);
    if (Math.hypot(sx - rx, sy - ry) <= 9) return 'rot';
  }
  for (const hnd of handlesOf(L)) {
    const [wx, wy] = localToWorld(L, ...handleLocal(L, hnd));
    const [hx, hy] = toScreen(wx, wy);
    if (Math.abs(sx - hx) <= 7 && Math.abs(sy - hy) <= 7) return hnd;
  }
  return null;
}
const BASE_ANG = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
function cursorFor(hnd, rot) {
  if (hnd === 'rot') return 'grab';
  const a = (((BASE_ANG[hnd] + (rot || 0)) % 180) + 180) % 180;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][Math.round(a / 45) % 4];
}
function topHit(p, { withLocked = false } = {}) {
  const pg = curPage();
  const pad = 2 / state.zoom;
  for (let i = pg.layers.length - 1; i >= 0; i--) {
    const L = pg.layers[i];
    if (L.hidden) continue;
    if (L.locked && !withLocked) continue;
    if (L.type === 'shape' && L.shape === 'grain') continue; // 필름 그레인은 클릭이 통과 (레이어 목록에서 선택)
    if (hitLayer(L, p.x, p.y, pad)) return L;
  }
  return null;
}

/* ---------- 스냅 ---------- */
function snapCandidates(exclude) {
  const st = state.project.settings;
  const xs = [0, W / 2, W], ys = [0, H / 2, H];
  if (st.showSafe || st.showUI) {
    const r = safeRect(st.placement);
    xs.push(r.x, r.x2); ys.push(r.y, r.y2);
  }
  for (const L of curPage().layers) {
    if (exclude.has(L.id) || L.hidden || isBackdrop(L)) continue;
    const a = aabb(L);
    xs.push(a.x, (a.x + a.x2) / 2, a.x2);
    ys.push(a.y, (a.y + a.y2) / 2, a.y2);
  }
  return { xs, ys };
}
function pick(edges, cands, thr) {
  let best = null;
  for (const e of edges) for (const v of cands) {
    const d = v - e;
    if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d) - 0.001)) best = { d, v };
  }
  return best;
}
function snapBox(b, exclude, axes = { x: true, y: true }) {
  const thr = 6 / state.zoom;
  const { xs, ys } = snapCandidates(exclude);
  const bx = axes.x ? pick([b.x, (b.x + b.x2) / 2, b.x2], xs, thr) : null;
  const by = axes.y ? pick([b.y, (b.y + b.y2) / 2, b.y2], ys, thr) : null;
  const gs = [];
  if (bx) gs.push({ axis: 'x', v: bx.v });
  if (by) gs.push({ axis: 'y', v: by.v });
  return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, guides: gs };
}

/* ---------- 포인터 ---------- */
function onDown(e) {
  if (ta && e.target === ta) return;
  if (e.button === 1 || (e.button === 0 && panning())) {
    e.preventDefault();
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, l0: view.left, t0: view.top };
    stage.classList.add('panning');
    return;
  }
  if (e.button !== 0 || state.preview) return;
  if (ta) finishTextEdit();
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  const p = toDesign(e);
  if (state.cropId) {
    const L = findLayer(state.cropId);
    if (L && hitLayer(L, p.x, p.y)) { drag = { mode: 'crop', L, start: p, px0: L.px ?? 0.5, py0: L.py ?? 0.5, moved: false }; return; }
    exitCrop();
  }
  const hnd = handleAt(p.sx, p.sy);
  if (hnd) {
    const L = selLayers()[0];
    drag = { mode: hnd === 'rot' ? 'rotate' : 'resize', handle: hnd, L, orig: deepClone(L), start: p, moved: false };
    return;
  }
  const L = topHit(p);
  if (L) {
    const wasSel = state.sel.includes(L.id);
    if (isPassive(L) && !wasSel && !e.shiftKey) {
      drag = { mode: 'marquee', start: p, add: false, base: [], clickId: L.id, moved: false };
      return;
    }
    if (e.shiftKey) {
      if (wasSel) { setSel(state.sel.filter((id) => id !== L.id)); return; }
      setSel([...state.sel, L.id]);
    } else if (!wasSel) setSel([L.id]);
    // 도형 안 글자를 끌면 도형째 움직인다 (글자는 도형을 따라감)
    const movers = act.proxyLayers(selLayers()).filter((l) => !l.locked);
    drag = {
      mode: 'move', start: p, movers, orig: movers.map((l) => ({ x: l.x, y: l.y })), moved: false,
      alt: e.altKey, box0: movers.length ? unionBox(movers.map(aabb)) : null, clickId: L.id, wasSel, shift: e.shiftKey,
      exclude: moverSet(movers),
    };
    return;
  }
  drag = { mode: 'marquee', start: p, add: e.shiftKey, base: e.shiftKey ? [...state.sel] : [], moved: false };
  if (!e.shiftKey) setSel([]);
}

/** 스냅 계산에서 뺄 것: 움직이는 요소 + 그 도형 안 글자 (같이 움직이니까) */
function moverSet(movers) {
  return new Set(act.withAttached(movers).map((l) => l.id));
}

function hover(e) {
  if (!stage || state.preview || !state.project) return;
  if (!stage.contains(e.target) || e.target === ta || state.tool === 'hand') {
    if (state.hoverId) { state.hoverId = null; requestRender(); }
    return;
  }
  const p = toDesign(e);
  let cursor = spaceDown ? 'grab' : 'default';
  const hnd = handleAt(p.sx, p.sy);
  let L = null;
  if (hnd) cursor = cursorFor(hnd, (selLayers()[0] || {}).rot);
  else {
    L = topHit(p);
    if (state.cropId && L && L.id === state.cropId) cursor = 'grab';
    else if (L && !isPassive(L)) cursor = 'move';
  }
  if (!spaceDown) stage.style.cursor = cursor;
  const hid = L && !isPassive(L) ? L.id : null;
  if (hid !== state.hoverId) { state.hoverId = hid; requestRender(); }
}

function onMove(e) {
  if (!drag) { hover(e); return; }
  if (drag.mode === 'pan') {
    view.left = drag.l0 + (e.clientX - drag.sx);
    view.top = drag.t0 + (e.clientY - drag.sy);
    state.fit = false;
    positionPage();
    requestRender();
    return;
  }
  const p = toDesign(e);
  if (!drag.moved) {
    const d = Math.hypot((p.x - drag.start.x) * state.zoom, (p.y - drag.start.y) * state.zoom);
    if (d < 3) return;
    drag.moved = true;
    if (drag.mode === 'move' && drag.alt) altDuplicate();
  }
  if (drag.mode === 'marquee') { doMarquee(p); requestRender(); return; }
  if (drag.mode === 'move') doMove(p, e);
  else if (drag.mode === 'resize') doResize(p, e);
  else if (drag.mode === 'rotate') doRotate(p, e);
  else if (drag.mode === 'crop') doCrop(p);
  syncAttached(curPage()); // 도형 안 글자가 바로 따라오게
  requestRender();
  bus.emit('doc', { history: false, live: true });
}

function onUp(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  guides = [];
  marquee = null;
  try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
  if (d.mode === 'pan') { stage.classList.remove('panning'); return; }
  if (d.mode === 'marquee') {
    if (!d.moved && d.clickId) setSel([d.clickId]);
    requestRender();
    return;
  }
  if (!d.moved) {
    if (d.mode === 'move' && d.wasSel && !d.shift && state.sel.length > 1) setSel([d.clickId]);
    requestRender();
    return;
  }
  if (d.mode === 'move') act.commitLayers(d.movers.map((l) => l.id));
  else act.commitLayers([d.L.id]);
  requestRender();
}

function altDuplicate() {
  const pg = curPage();
  const src = act.withAttached(drag.movers); // 도형을 복제하면 안의 글자도 같이
  const copies = act.cloneLayers(src);
  const top = Math.max(...src.map((l) => pg.layers.indexOf(l)));
  pg.layers.splice(top + 1, 0, ...copies);
  const of = new Map(src.map((l, i) => [l.id, copies[i]]));
  drag.movers = drag.movers.map((l) => of.get(l.id));
  drag.exclude = moverSet(drag.movers);
  const sel = state.sel.map((id) => of.get(id)).filter(Boolean).map((c) => c.id);
  state.sel = sel.length ? sel : drag.movers.map((c) => c.id);
  bus.emit('sel');
}

function doMove(p, e) {
  if (!drag.movers.length) return;
  let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  let axes = { x: true, y: true };
  if (e.shiftKey) {
    if (Math.abs(dx) > Math.abs(dy)) { dy = 0; axes = { x: true, y: false }; }
    else { dx = 0; axes = { x: false, y: true }; }
  }
  guides = [];
  if (state.prefs.snap && !modKey(e)) {
    const b = drag.box0;
    const moved = { x: b.x + dx, y: b.y + dy, x2: b.x2 + dx, y2: b.y2 + dy };
    const s = snapBox(moved, drag.exclude || new Set(drag.movers.map((l) => l.id)), axes);
    dx += s.dx; dy += s.dy;
    guides = s.guides;
  }
  drag.movers.forEach((L, i) => { L.x = drag.orig[i].x + dx; L.y = drag.orig[i].y + dy; });
}

function scaleTextStyle(L, o, sc) {
  L.size = Math.max(4, Math.round(o.size * sc * 10) / 10);
  L.bg = Object.assign({}, o.bg, { padX: o.bg.padX * sc, padY: o.bg.padY * sc, radius: o.bg.radius >= 999 ? o.bg.radius : o.bg.radius * sc });
  L.stroke = Object.assign({}, o.stroke, { width: o.stroke.width * sc });
  L.shadow = Object.assign({}, o.shadow, { blur: o.shadow.blur * sc, x: o.shadow.x * sc, y: o.shadow.y * sc });
  if (o.fit) L.fit = Object.assign({}, o.fit, { min: Math.max(4, o.fit.min * sc) });
}

function doResize(p, e) {
  const L = drag.L, o = drag.orig, hnd = drag.handle;
  const rad = (o.rot || 0) * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const ocx = o.x + o.w / 2, ocy = o.y + o.h / 2;
  const dxw = p.x - ocx, dyw = p.y - ocy;
  const lx = dxw * c + dyw * s + o.w / 2, ly = -dxw * s + dyw * c + o.h / 2;
  const minS = 6;
  let x0 = 0, y0 = 0, x1 = o.w, y1 = o.h;
  if (hnd.includes('w')) x0 = Math.min(lx, x1 - minS);
  if (hnd.includes('e')) x1 = Math.max(lx, x0 + minS);
  if (hnd.includes('n')) y0 = Math.min(ly, y1 - minS);
  if (hnd.includes('s')) y1 = Math.max(ly, y0 + minS);
  guides = [];
  if (!o.rot && hnd.length === 1 && state.prefs.snap && !modKey(e)) {
    const { xs, ys } = snapCandidates(new Set([L.id]));
    const thr = 6 / state.zoom;
    if (hnd === 'e' || hnd === 'w') {
      const edge = o.x + (hnd === 'e' ? x1 : x0);
      const b = pick([edge], xs, thr);
      if (b) { if (hnd === 'e') x1 = b.v - o.x; else x0 = b.v - o.x; guides.push({ axis: 'x', v: b.v }); }
    } else {
      const edge = o.y + (hnd === 's' ? y1 : y0);
      const b = pick([edge], ys, thr);
      if (b) { if (hnd === 's') y1 = b.v - o.y; else y0 = b.v - o.y; guides.push({ axis: 'y', v: b.v }); }
    }
  }
  let nw = x1 - x0, nh = y1 - y0;
  const corner = hnd.length === 2;
  const keep = corner && (L.type === 'text' || (L.type === 'image' && !e.shiftKey) || (L.type === 'shape' && e.shiftKey));
  if (keep) {
    // 고정된 반대쪽 모서리 → 끄는 모서리 대각선에 마우스 위치를 투영해서 배율 계산
    const fxL = hnd.includes('w') ? o.w : 0, fyL = hnd.includes('n') ? o.h : 0;
    const dxL = (hnd.includes('w') ? 0 : o.w) - fxL, dyL = (hnd.includes('n') ? 0 : o.h) - fyL;
    const sc = Math.max(0.02, ((lx - fxL) * dxL + (ly - fyL) * dyL) / (dxL * dxL + dyL * dyL || 1));
    nw = o.w * sc; nh = o.h * sc;
    if (hnd.includes('w')) { x1 = o.w; x0 = x1 - nw; } else { x0 = 0; x1 = nw; }
    if (hnd.includes('n')) { y1 = o.h; y0 = y1 - nh; } else { y0 = 0; y1 = nh; }
  }
  if (L.type === 'text') {
    if (corner) {
      const sc = clamp(nw / o.w, 0.03, 60);
      scaleTextStyle(L, o, sc);
      L.w = o.autoW ? o.w : o.w * sc;
      const lay = layoutText(L);
      const newW = o.autoW ? lay.boxW : o.w * sc;
      Object.assign(L, { x: o.x, y: o.y, w: o.w, h: o.h });
      resizeKeepAnchor(L, newW, lay.boxH, hnd.includes('w') ? 1 : 0, hnd.includes('n') ? 1 : 0);
    } else if (hnd === 'e' || hnd === 'w') {
      L.autoW = false;
      L.w = nw;
      const lay = layoutText(L);
      Object.assign(L, { x: o.x, y: o.y, w: o.w, h: o.h });
      resizeKeepAnchor(L, nw, lay.boxH, hnd === 'w' ? 1 : 0, 0);
    }
    return;
  }
  const lcx = (x0 + x1) / 2 - o.w / 2, lcy = (y0 + y1) / 2 - o.h / 2;
  const ncx = ocx + lcx * c - lcy * s, ncy = ocy + lcx * s + lcy * c;
  L.w = nw; L.h = nh;
  L.x = ncx - nw / 2; L.y = ncy - nh / 2;
}

function doRotate(p, e) {
  const L = drag.L, o = drag.orig;
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  let ang = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
  ang = ((ang + 180) % 360 + 360) % 360 - 180;
  if (e.shiftKey) ang = Math.round(ang / 15) * 15;
  else for (const t of [-180, -90, 0, 90, 180]) if (Math.abs(ang - t) < 4) ang = t;
  if (ang === -180) ang = 180;
  L.rot = Math.round(ang * 10) / 10;
}

function doMarquee(p) {
  const s = drag.start;
  marquee = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), x2: Math.max(s.x, p.x), y2: Math.max(s.y, p.y) };
  const hits = [];
  for (const L of curPage().layers) {
    if (L.hidden || L.locked) continue;
    const b = aabb(L);
    if (isPassive(L)) {
      if (b.x >= marquee.x && b.y >= marquee.y && b.x2 <= marquee.x2 && b.y2 <= marquee.y2) hits.push(L.id);
      continue;
    }
    if (b.x2 >= marquee.x && b.x <= marquee.x2 && b.y2 >= marquee.y && b.y <= marquee.y2) hits.push(L.id);
  }
  setSel(drag.add ? [...new Set([...drag.base, ...hits])] : hits);
}

function doCrop(p) {
  const L = drag.L;
  const a = assets.get(L.asset);
  if (!a || !a.img) return;
  const r = imgDrawRect(L, a.w, a.h);
  const rad = (L.rot || 0) * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const dxw = p.x - drag.start.x, dyw = p.y - drag.start.y;
  let dx = dxw * c + dyw * s;
  const dy = -dxw * s + dyw * c;
  if (L.flipX) dx = -dx;
  const ox = L.w - r.w, oy = L.h - r.h;
  L.px = Math.abs(ox) > 0.5 ? clamp(drag.px0 + dx / ox, 0, 1) : 0.5;
  L.py = Math.abs(oy) > 0.5 ? clamp(drag.py0 + dy / oy, 0, 1) : 0.5;
}

/* ---------- 휠 · 더블클릭 · 드롭 · 우클릭 ---------- */
let cropCommitId = null;
const cropCommit = debounce(() => { if (cropCommitId) act.commitLayers([cropCommitId]); }, 450);
function onWheel(e) {
  e.preventDefault();
  if (state.preview) return;
  const r = stage.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (state.cropId && !(e.ctrlKey || e.metaKey)) {
    const L = findLayer(state.cropId);
    if (L) {
      const min = L.fit === 'contain' ? 0.2 : 1;
      L.zoom = clamp((L.zoom || 1) * Math.exp(-e.deltaY * 0.0015), min, 8);
      requestRender();
      bus.emit('doc', { history: false, live: true });
      cropCommitId = L.id;
      cropCommit();
    }
    return;
  }
  if (e.ctrlKey || e.metaKey) { zoomTo(state.zoom * Math.exp(-e.deltaY * 0.01), sx, sy); return; }
  if (state.fit) return;
  view.left -= e.deltaX;
  view.top -= e.deltaY;
  positionPage();
  requestRender();
}

function onDbl(e) {
  if (state.preview || state.tool === 'hand') return;
  const p = toDesign(e);
  const L = topHit(p);
  if (!L) return;
  if (L.type === 'text') startTextEdit(L.id, false);
  else if (L.type === 'image') { if (L.asset) enterCrop(L.id); else bus.emit('pick-image', L.id); }
}

/** 끌어 온 것: preset(왼쪽 패널의 글자·도형) · image(사진 파일·올린 사진) · null */
function dragKind(e) {
  const t = [...((e.dataTransfer && e.dataTransfer.types) || [])];
  if (t.includes('application/x-bb-preset')) return 'preset';
  if (t.includes('Files') || t.includes('application/x-bb-asset')) return 'image';
  return null;
}
function onDragOver(e) {
  const kind = dragKind(e);
  if (!kind) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  const p = toDesign(e);
  if (kind === 'preset') { dropState = { preset: true, x: p.x, y: p.y }; requestRender(); return; }
  const target = act.imageLayerAt(p);
  if (!dropState || dropState.preset || dropState.target !== target) { dropState = { target }; requestRender(); }
}
function onDragLeave(e) {
  if (e.relatedTarget && stage.contains(e.relatedTarget)) return;
  dropState = null;
  requestRender();
}
function onDrop(e) {
  const kind = dragKind(e);
  if (!kind) return;
  e.preventDefault();
  dropState = null;
  const p = toDesign(e);
  if (kind === 'preset') {
    let d = null;
    try { d = JSON.parse(e.dataTransfer.getData('application/x-bb-preset') || 'null'); } catch (err) { d = null; }
    if (d) bus.emit('drop-preset', Object.assign(d, { at: { x: p.x, y: p.y, center: true } }));
    requestRender();
    return;
  }
  const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
  const assetId = e.dataTransfer.getData('application/x-bb-asset');
  bus.emit('drop-images', { files, assetId, at: p, alt: e.altKey });
  requestRender();
}
function onContext(e) {
  e.preventDefault();
  if (state.preview) return;
  const p = toDesign(e);
  const L = topHit(p);
  if (L && !state.sel.includes(L.id)) setSel([L.id]);
  bus.emit('context-menu', { x: e.clientX, y: e.clientY, layer: L });
}

/* ---------- 인라인 텍스트 편집 ---------- */
export function startTextEdit(id, selectAll = false) {
  const L = findLayer(id);
  if (!L || L.type !== 'text' || L.locked || state.preview) return;
  finishTextEdit();
  exitCrop(true);
  state.editingId = id;
  setSel([id]);
  ta = document.createElement('textarea');
  ta.className = 'inline-text';
  ta.spellcheck = false;
  ta.value = L.text;
  ta.setAttribute('aria-label', '텍스트 편집');
  stage.append(ta);
  positionTextarea();
  ta.addEventListener('input', () => {
    const cur = findLayer(state.editingId);
    if (!cur) return;
    cur.text = ta.value;
    act.setProps([cur.id], {}, { live: true });
    positionTextarea();
  });
  ta.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape' || (e.key === 'Enter' && modKey(e))) { e.preventDefault(); finishTextEdit(); }
  });
  ta.addEventListener('blur', () => finishTextEdit());
  ta.addEventListener('pointerdown', (e) => e.stopPropagation());
  requestAnimationFrame(() => {
    if (!ta) return;
    ta.focus();
    if (selectAll) ta.select(); else ta.setSelectionRange(ta.value.length, ta.value.length);
  });
  requestRender();
  bus.emit('sel');
}

function positionTextarea() {
  const L = findLayer(state.editingId);
  if (!L || !ta) return;
  const lay = layoutText(L);
  const z = state.zoom;
  Object.assign(ta.style, {
    left: (view.left + L.x * z) + 'px',
    top: (view.top + L.y * z) + 'px',
    width: (L.w * z + 6) + 'px',
    height: (L.h * z + 2) + 'px',
    font: `${L.italic ? 'italic ' : ''}${nearestWeight(L.font, L.weight)} ${lay.size * z}px "${familyOf(L.font)}", ${FALLBACK}`,
    lineHeight: (lay.lineH * z) + 'px',
    letterSpacing: (lay.ls * z) + 'px',
    padding: `${lay.py * z}px ${lay.px * z}px`,
    color: L.color,
    textAlign: L.align,
    transform: L.rot ? `rotate(${L.rot}deg)` : '',
    whiteSpace: L.autoW ? 'pre' : 'pre-wrap',
    opacity: String(L.opacity ?? 1),
  });
}

export function finishTextEdit(silent = false) {
  if (!state.editingId) return;
  const id = state.editingId;
  state.editingId = null;
  const el = ta;
  ta = null;
  if (el) el.remove();
  if (silent) { requestRender(); return; }
  const pg = curPage();
  const L = findLayer(id, pg);
  if (L && !String(L.text).trim()) {
    pg.layers = pg.layers.filter((l) => l.id !== id);
    setSel([]);
  }
  act.commitLayers(L && pg.layers.includes(L) ? [id] : []);
  requestRender();
  bus.emit('sel');
}

/* ---------- 이미지 위치 조정 ---------- */
export function enterCrop(id) {
  const L = findLayer(id);
  if (!L || L.type !== 'image' || !L.asset || L.locked) return;
  finishTextEdit();
  state.cropId = id;
  setSel([id]);
  requestRender();
  bus.emit('crop', id);
}
export function exitCrop(silent = false) {
  if (!state.cropId) return;
  const id = state.cropId;
  state.cropId = null;
  if (!silent) act.commitLayers([id]);
  requestRender();
  bus.emit('crop', null);
}
