/* =========================================================================
   패널 — 레이어 목록(왼쪽) · 속성(오른쪽)
   속성 패널은 선택이 바뀔 때만 다시 만들고, 드래그 중엔 값만 갱신한다.
   ========================================================================= */
import {
  W, H, state, bus, curPage, findLayer, selLayers, setSel, h, $, clamp, normHex, toast, assets,
  changed, savePrefs, MOD, ALT, layerLabel, debounce, modKey,
} from './core.js';
import { FONT_CATS, allFonts, fontEntry, fontName, weightsOf, nearestWeight, WEIGHT_NAMES, previewFont, addFontFiles, removeCustomFont } from './fonts.js';
import { layoutText, attachedShape, attachedTexts, canHoldText } from './render.js';
import { PLACEMENTS } from './overlay.js';
import { SWATCHES } from './templates.js';
import * as act from './actions.js';
import { enterCrop, exitCrop } from './editor.js';
import { openMenu } from './modal.js';

/* ---------- 아이콘 (inline SVG) ---------- */
const P = {
  alignL: '<path d="M4 3v18"/><rect x="7" y="6" width="11" height="4" rx="1"/><rect x="7" y="14" width="7" height="4" rx="1"/>',
  alignC: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="7.5" y="14" width="9" height="4" rx="1"/>',
  alignR: '<path d="M20 3v18"/><rect x="6" y="6" width="11" height="4" rx="1"/><rect x="10" y="14" width="7" height="4" rx="1"/>',
  alignT: '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="11" rx="1"/><rect x="14" y="7" width="4" height="7" rx="1"/>',
  alignM: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="7.5" width="4" height="9" rx="1"/>',
  alignB: '<path d="M3 20h18"/><rect x="6" y="6" width="4" height="11" rx="1"/><rect x="14" y="10" width="4" height="7" rx="1"/>',
  distH: '<path d="M3 4v16M21 4v16"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  distV: '<path d="M4 3h16M4 21h16"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  tL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  tC: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  tR: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
  shape: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  front: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  back: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  dup: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pages: '<rect x="3" y="6" width="10" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/>',
  page: '<rect x="6" y="2.5" width="12" height="19" rx="2"/>',
  italic: '<path d="M10 4h8M6 20h8M14 4l-4 16"/>',
  strike: '<path d="M4 12h16"/><path d="M16.5 7.2C15.8 5.3 14 4 11.8 4 9.1 4 7.3 5.5 7.3 7.5c0 1.5.9 2.6 2.6 3.2"/><path d="M8 16.6C8.7 18.7 10.5 20 12.6 20c2.7 0 4.6-1.6 4.6-3.7 0-.9-.3-1.6-.8-2.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  inBox: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8.5 9.5h7M12 9.5v5"/>',
  unlink: '<path d="M9 15l6-6"/><path d="M11 6l.5-.5a4 4 0 0 1 5.7 5.7L16.6 12M13 18l-.5.5a4 4 0 0 1-5.7-5.7l.6-.6"/><path d="M4 4l16 16"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  order: '<rect x="4" y="9" width="11" height="11" rx="2"/><path d="M9 9V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>',
  border: '<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3 2.4"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  close: '<path d="M13 6l6 6-6 6M6 6l6 6-6 6"/>',
};
export const icon = (name, size = 16) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = P[name] || '';
  return s;
};

/* ---------- 공통 컨트롤 ---------- */
let bindings = [];      // 오른쪽 세부 설정
let ctxBindings = [];   // 상단 설정 바
let bindTarget = null;  // 지금 만드는 컨트롤이 들어갈 곳 (null = 오른쪽 패널)
let builtSig = '';
const R1 = (v) => Math.round(v * 10) / 10;

function bind(el, sync) { (bindTarget || bindings).push({ el, sync }); sync(); }
/** 상단 설정 바 쪽으로 컨트롤 만들기 (팝오버 안 컨트롤도) */
function inCtx(fn) {
  const prev = bindTarget;
  bindTarget = ctxBindings;
  try { return fn(); } finally { bindTarget = prev; }
}

function numInput({ get, set, min = -99999, max = 99999, step = 1, unit, disabled, title }) {
  const inp = h('input', { type: 'number', class: 'num', step, min, max, title, disabled: disabled || null });
  const apply = (live) => {
    const v = parseFloat(inp.value);
    if (Number.isFinite(v)) set(clamp(v, min, max), live);
  };
  const live = debounce(() => apply(true), 220);
  inp.addEventListener('input', () => live());
  inp.addEventListener('change', () => { live.cancel(); apply(false); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); e.stopPropagation(); });
  bind(inp, () => { const v = get(); inp.value = v == null || Number.isNaN(+v) ? '' : R1(+v); });
  return unit ? h('div', { class: 'num-wrap' }, inp, h('span', { class: 'unit' }, unit)) : inp;
}
function rangeNum({ get, set, min, max, step = 1, unit, mult = 1 }) {
  const r = h('input', { type: 'range', class: 'rng', min, max, step });
  r.addEventListener('input', () => set(+r.value / mult, true));
  r.addEventListener('change', () => set(+r.value / mult, false));
  bind(r, () => { r.value = (get() ?? 0) * mult; });
  const n = numInput({ get: () => (get() ?? 0) * mult, set: (v, live) => set(v / mult, live), min, max: max * 10, step, unit });
  return h('div', { class: 'rng-row' }, r, n);
}
function seg(options, { get, set, small }) {
  const box = h('div', { class: 'seg' + (small ? ' seg-sm' : '') });
  const btns = options.map((o) => {
    const b = h('button', { type: 'button', class: 'seg-b', title: o.title || o.label || '', onclick: () => { set(o.v, false); sync(); } },
      o.icon ? icon(o.icon, 16) : null, o.label ? h('span', null, o.label) : null);
    box.append(b);
    return b;
  });
  const sync = () => { const v = get(); options.forEach((o, i) => btns[i].classList.toggle('on', o.v === v)); };
  bind(box, sync);
  return box;
}
function toggle({ get, set, label }) {
  const cb = h('input', { type: 'checkbox' });
  cb.addEventListener('change', () => set(cb.checked, false));
  bind(cb, () => { cb.checked = !!get(); });
  return h('label', { class: 'switch' }, cb, h('span', { class: 'sw-track' }), label ? h('span', { class: 'sw-label' }, label) : null);
}
function selectCtl(options, { get, set }) {
  const s = h('select', { class: 'sel' }, options.map((o) => h('option', { value: String(o.v) }, o.label)));
  s.addEventListener('change', () => { const o = options.find((x) => String(x.v) === s.value); if (o) set(o.v, false); });
  bind(s, () => { s.value = String(get()); });
  return s;
}
function textInput({ get, set, placeholder, maxlength = 80 }) {
  const i = h('input', { type: 'text', class: 'txt', placeholder, maxlength });
  i.addEventListener('input', () => set(i.value, true));
  i.addEventListener('change', () => set(i.value, false));
  i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') i.blur(); });
  bind(i, () => { i.value = get() ?? ''; });
  return i;
}
function pushRecent(c) {
  const r = state.prefs.recentColors.filter((x) => x !== c);
  r.unshift(c);
  state.prefs.recentColors = r.slice(0, 7);
  savePrefs();
}
function colorCtl({ get, set, swatches = false }) {
  const sw = h('input', { type: 'color', class: 'clr' });
  const hex = h('input', { type: 'text', class: 'hex', maxlength: 7, spellcheck: false });
  sw.addEventListener('input', () => { set(sw.value, true); hex.value = sw.value.toUpperCase(); });
  sw.addEventListener('change', () => { set(sw.value, false); pushRecent(sw.value); });
  hex.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') hex.blur(); });
  hex.addEventListener('change', () => { const v = normHex(hex.value); if (v) { set(v, false); pushRecent(v); } sync(); });
  const sync = () => { const v = normHex(get()) || '#000000'; sw.value = v; if (document.activeElement !== hex) hex.value = v.toUpperCase(); };
  bind(hex, sync);
  const row = h('div', { class: 'clr-row' }, sw, hex);
  if (!swatches) return row;
  const cols = [...new Set([...state.prefs.recentColors, ...SWATCHES])].slice(0, 16);
  const sws = h('div', { class: 'swatches' }, cols.map((c) => h('button', {
    type: 'button', class: 'sw', title: c, style: { background: c },
    onclick: () => { set(c, false); pushRecent(c); sync(); },
  })));
  return h('div', { class: 'clr-wrap' }, row, sws);
}
const field = (label, ...ctl) => h('div', { class: 'f' }, h('div', { class: 'f-l' }, label), h('div', { class: 'f-c' }, ...ctl));
const row2 = (...kids) => h('div', { class: 'row2' }, ...kids);
const mini = (label, ctl) => h('div', { class: 'mini' }, h('span', { class: 'mini-l' }, label), ctl);
/** 접을 수 있는 섹션 — 사용자가 직접 접거나 편 것은 기억한다 (다음에 열어도 그대로) */
function section(title, kids, { right, cls, open = true, key } = {}) {
  const body = h('div', { class: 'ps-b' }, kids);
  const st = key ? (foldState()['p-' + key] ?? open) : true;
  const head = h('div', { class: 'ps-h' + (key ? ' fold' : '') }, key ? h('span', { class: 'chev' }, '▾') : null, h('span', { class: 'ps-t' }, title), right || null);
  const sec = h('section', { class: 'ps ' + (cls || '') + (st ? '' : ' closed') }, head, body);
  if (key) {
    head.addEventListener('click', (e) => {
      if (e.target.closest('.switch,button,input')) return;
      foldState()['p-' + key] = !sec.classList.toggle('closed');
      savePrefs();
    });
  }
  return sec;
}
function foldState() {
  const u = state.prefs.ui || (state.prefs.ui = {});
  return u.fold || (u.fold = {});
}

/* ---------- 레이어 접근 ---------- */
function getPath(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function patchOf(path, v) {
  const ks = path.split('.');
  const out = {};
  let cur = out;
  ks.forEach((k, i) => { if (i === ks.length - 1) cur[k] = v; else cur = cur[k] = {}; });
  return out;
}
const lget = (path) => () => { const L = selLayers()[0]; return L ? getPath(L, path) : null; };
const lset = (path, type) => (v, live) => {
  const ids = selLayers().filter((l) => !type || l.type === type).map((l) => l.id);
  if (ids.length) act.setProps(ids, patchOf(path, v), { live });
};

/* ---------- 속성 패널 ---------- */
const propsEl = () => document.getElementById('props');

/** 글자와 도형 사이 상태 (도형 안 / 아래에 도형 있음 / 없음) — 패널 구성이 달라짐 */
function shapeLinkSig(L) {
  if (L.type === 'text') { const S = attachedShape(L, curPage()); return S ? 'in:' + S.id : (act.shapeUnder(L) ? 'under' : '-'); }
  if (L.type === 'shape') return 'n' + attachedTexts(L, curPage()).length;
  return '';
}
function structSig() {
  const Ls = selLayers();
  const parts = [state.pageId, state.cropId || '', state.linkEdit ? 1 : 0, Ls.length];
  for (const L of Ls) {
    parts.push(L.id, L.type, L.locked ? 1 : 0, shapeLinkSig(L));
    if (L.type === 'text') parts.push(L.autoW ? 1 : 0, L.bg.mode, L.stroke.on ? 1 : 0, L.shadow.on ? 1 : 0, L.fit && L.fit.on ? 1 : 0, L.font, L.grad && L.grad.on ? 1 : 0, L.hollow && L.hollow.on ? 1 : 0);
    if (L.type === 'image') parts.push(L.fit, L.mask || 'rect', L.shadow.on ? 1 : 0, L.stroke.on ? 1 : 0, L.asset || '', L.checkSafe ? 1 : 0);
    if (L.type === 'shape') parts.push(L.shape, L.fill.type, L.stroke.on ? 1 : 0, L.shadow && L.shadow.on ? 1 : 0, L.checkSafe ? 1 : 0, L.blur > 0 ? 1 : 0);
  }
  if (!Ls.length) { const s = state.project.settings; parts.push(s.showUI ? 1 : 0, state.project.pages.length); }
  return parts.join('|');
}

/** 오른쪽 세부 설정이 접혀 있으면 만들지 않고, 펼칠 때 만든다 */
const propsOpen = () => !!(state.prefs.ui && state.prefs.ui.right);
let propsDirty = true;
/** 패널 머리의 접기 버튼 */
const closeBtn = () => h('button', { type: 'button', class: 'ph-x', title: '세부 설정 접기 (Tab = 모든 패널 접기/펴기)', onclick: () => bus.emit('toggle-right') }, icon('close', 15));

export function renderProps() {
  const el = propsEl();
  if (!el || !state.project) return;
  if (!propsOpen()) { propsDirty = true; return; }
  propsDirty = false;
  const scroll = el.scrollTop;
  bindings = [];
  builtSig = structSig();
  el.innerHTML = '';
  const Ls = selLayers();
  if (!Ls.length) buildPagePanel(el);
  else buildLayerPanel(el, Ls);
  if (builtSig.split('|').slice(0, 5).join('|') === lastHead) el.scrollTop = scroll;
  lastHead = builtSig.split('|').slice(0, 5).join('|');
}
let lastHead = '';

export function syncProps() {
  if (!state.project) return;
  if (!propsOpen()) { propsDirty = true; return; }
  if (propsDirty || structSig() !== builtSig) { renderProps(); return; }
  const active = document.activeElement;
  for (const b of bindings) {
    if (b.el === active) continue;
    try { b.sync(); } catch (e) { /* noop */ }
  }
}

function setSetting(k, v, live) {
  state.project.settings[k] = v;
  changed({ history: !live });
  if (k === 'placement') bus.emit('pages-dirty'); // 지면이 바뀌면 모든 페이지의 ⚠ 개수가 달라짐
}

function buildPagePanel(el) {
  const pg = curPage();
  const st = state.project.settings;
  el.append(h('div', { class: 'props-head' }, h('div', { class: 'ph-t' }, '페이지'), h('div', { class: 'ph-s' }, '요소를 선택하면 여기서 편집해요'), closeBtn()));
  el.append(section('페이지', [
    field('이름', textInput({ get: () => curPage().name, set: (v, live) => { curPage().name = v; if (!live) { changed(); bus.emit('pages'); } } })),
    field('배경색', colorCtl({ get: () => curPage().bg, set: (v, live) => act.setPageBg(v, { live }), swatches: true })),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => act.applyBgToAll() }, '이 배경색을 모든 페이지에'),
  ], { key: 'page' }));
  void pg;
  el.append(section('지면 시뮬레이션', [
    field('지면', selectCtl(PLACEMENTS.map((p) => ({ v: p.id, label: p.name })), { get: () => st.placement, set: (v) => setSetting('placement', v) })),
    field('UI 가림', toggle({ get: () => st.showUI, set: (v) => setSetting('showUI', v), label: '프로필·CTA 등 표시' })),
    field('불투명도', rangeNum({ get: () => st.uiOpacity, set: (v, live) => setSetting('uiOpacity', clamp(v, 0.1, 1), live), min: 10, max: 100, step: 5, unit: '%', mult: 100 })),
    field('안전영역', toggle({ get: () => st.showSafe, set: (v) => setSetting('showSafe', v), label: '가림 영역 빗금 표시' })),
    h('p', { class: 'hint' }, '시뮬레이션은 편집 화면에만 보이고, 저장하는 이미지에는 들어가지 않아요.'),
  ], { key: 'sim' }));
  // 광고 미리보기 정보(계정·프로필·CTA·캡션)는 beaduniverse 로 고정 — 편집 패널에 안 보임 (core.js AD_PREVIEW)
  el.append(section('빠른 팁', [h('ul', { class: 'tips' },
    h('li', null, '사진을 캔버스에 끌어다 놓으면 바로 들어가요. 여러 장이면 페이지로 나눠 줘요.'),
    h('li', null, `여러 요소 선택: Shift+클릭 또는 빈 곳 드래그 → 오른쪽 정렬 버튼`),
    h('li', null, `텍스트 더블클릭 = 바로 수정 · 이미지 더블클릭 = 위치 조정`),
    h('li', null, `${MOD} 누른 채 드래그 = 스냅 끄기 · ${ALT}+드래그 = 복제`),
  )], { key: 'tips', open: false }));
}

function header(Ls) {
  const L = Ls[0];
  const single = Ls.length === 1;
  const title = single ? layerLabel(L) : `${Ls.length}개 선택`;
  const typeName = single ? { text: '텍스트', image: '이미지', shape: '도형' }[L.type] : [...new Set(Ls.map((l) => ({ text: '텍스트', image: '이미지', shape: '도형' }[l.type])))].join(' · ');
  const n = single ? act.linkedCount(L) : Math.max(0, ...Ls.map((l) => act.linkedCount(l)));
  const head = h('div', { class: 'props-head' },
    h('div', { class: 'ph-row' }, single ? icon(L.type, 18) : icon('pages', 18), h('div', { class: 'ph-t', title }, title)),
    h('div', { class: 'ph-s' }, typeName + (single && L.locked ? ' · 잠김' : '') + (single && attachedShape(L, curPage()) ? ' · 도형 안 글자' : '')),
    closeBtn());
  if (n > 0) {
    const chip = h('button', {
      type: 'button', class: 'link-chip' + (state.linkEdit ? ' on' : ''),
      title: '켜면 위치·크기·스타일을 바꿀 때 다른 페이지의 같은 요소도 똑같이 바뀌어요 (글자·사진 내용은 그대로)',
      onclick: () => { state.linkEdit = !state.linkEdit; bus.emit('link-edit'); renderProps(); },
    }, icon('link', 14), state.linkEdit ? `일괄 수정 켜짐 · ${n}개 페이지` : `다른 페이지 ${n}개와 연결됨 · 일괄 수정 켜기`);
    head.append(chip);
  }
  return head;
}

/** 도형 안 글자만 골랐는지 (정렬 버튼이 도형 안에서 맞춤으로 동작) */
function inShapeOnly(Ls) {
  const page = curPage();
  const texts = Ls.filter((l) => l.type === 'text' && attachedShape(l, page));
  const holders = new Set(texts.map((t) => attachedShape(t, page)));
  return texts.length > 0 && Ls.every((l) => texts.includes(l) || holders.has(l));
}
function alignSection(Ls) {
  return section('정렬', alignKids(Ls), { cls: 'ps-align', key: 'align', open: Ls.length > 1 });
}
function alignKids(Ls) {
  const btn = (ic, mode, title) => h('button', { type: 'button', class: 'ib', title, onclick: () => act.align(mode) }, icon(ic, 18));
  const multi = Ls.length > 1;
  const inBox = inShapeOnly(Ls);
  const refOpts = [{ v: 'auto', label: inBox ? '자동 (도형 안)' : multi ? '자동 (선택 영역)' : '자동 (캔버스)' }, { v: 'selection', label: '선택 영역' }, { v: 'page', label: '캔버스' }, { v: 'safe', label: '안전영역' }];
  const kids = [
    h('div', { class: 'ib-row' },
      btn('alignL', 'left', `왼쪽 맞춤 (${ALT}+A)`), btn('alignC', 'hcenter', `가로 가운데 (${ALT}+H)`), btn('alignR', 'right', `오른쪽 맞춤 (${ALT}+D)`),
      h('span', { class: 'ib-sep' }),
      btn('alignT', 'top', `위 맞춤 (${ALT}+W)`), btn('alignM', 'vmiddle', `세로 가운데 (${ALT}+V)`), btn('alignB', 'bottom', `아래 맞춤 (${ALT}+S)`)),
    row2(
      mini('기준', selectCtl(refOpts, { get: () => state.prefs.alignRef, set: (v) => { state.prefs.alignRef = v; savePrefs(); } })),
      mini('', toggle({ get: () => state.prefs.alignText, set: (v) => { state.prefs.alignText = v; savePrefs(); }, label: '글자 줄 정렬도 같이' }))),
  ];
  if (inBox) kids.push(h('p', { class: 'hint' }, '도형 안 글자예요 — 버튼을 누르면 도형 안에서 맞춰요 (도형은 그대로). 도형째 옮기려면 기준을 「캔버스」로.'));
  if (multi) {
    kids.push(h('div', { class: 'ib-row' },
      h('button', { type: 'button', class: 'ib wide', title: '가로 간격 똑같이 (3개 이상)', onclick: () => act.distribute('h') }, icon('distH', 18), h('span', null, '가로 간격')),
      h('button', { type: 'button', class: 'ib wide', title: '세로 간격 똑같이 (3개 이상)', onclick: () => act.distribute('v') }, icon('distV', 18), h('span', null, '세로 간격'))));
    const gap = numInput({ get: () => state.prefs.stackGap, set: (v) => { state.prefs.stackGap = v; savePrefs(); }, min: -500, max: 2000, unit: 'px' });
    kids.push(h('div', { class: 'stack-row' },
      h('span', { class: 'mini-l' }, '간격'), gap,
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: '위에서부터 정해진 간격으로 쌓기', onclick: () => act.stack('v', state.prefs.stackGap) }, '세로로 쌓기'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: '왼쪽부터 정해진 간격으로 놓기', onclick: () => act.stack('h', state.prefs.stackGap) }, '가로로')));
  }
  return kids;
}

function geomSection(Ls) {
  const L = Ls[0];
  if (Ls.length > 1) {
    return section('투명도', [field('불투명도', rangeNum({ get: () => selLayers()[0].opacity, set: lset('opacity'), min: 0, max: 100, step: 1, unit: '%', mult: 100 }))], { key: 'geom' });
  }
  const isText = L.type === 'text';
  if (isText && attachedShape(L, curPage())) {
    return section('위치 · 크기', [
      h('p', { class: 'hint' }, '도형 안 글자 — 위치·너비·회전은 도형을 따라가요. 글자 크기는 아래 「텍스트」에서, 도형 안 자리는 「도형 안 배치」에서 골라요.'),
      field('투명도', rangeNum({ get: () => selLayers()[0].opacity, set: lset('opacity'), min: 0, max: 100, step: 1, unit: '%', mult: 100 })),
    ], { key: 'geom' });
  }
  return section('위치 · 크기', [
    row2(mini('X', numInput({ get: lget('x'), set: lset('x') })), mini('Y', numInput({ get: lget('y'), set: lset('y') }))),
    row2(mini('W', numInput({ get: lget('w'), set: lset('w'), min: 1, title: isText ? '숫자를 넣으면 고정 너비가 돼요' : '' })),
      mini('H', numInput({ get: lget('h'), set: lset('h'), min: 1, disabled: isText, title: isText ? '텍스트 높이는 글자에 맞춰 자동' : '' }))),
    row2(mini('회전', numInput({ get: lget('rot'), set: (v, live) => lset('rot')(((v + 180) % 360 + 360) % 360 - 180, live), min: -360, max: 360, unit: '°' })),
      mini('투명도', numInput({ get: () => (selLayers()[0].opacity ?? 1) * 100, set: (v, live) => lset('opacity')(clamp(v, 0, 100) / 100, live), min: 0, max: 100, unit: '%' }))),
  ], { key: 'geom' });
}

/* ---------- 도형 안 글자 ---------- */
const H3 = [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']];
const V3 = [['top', '위'], ['middle', '가운데'], ['bottom', '아래']];
/** 3×3 자리 고르기 (가로 = 글자 줄 정렬, 세로 = 도형 안 위·가운데·아래) */
function anchorGrid(id) {
  const grid = h('div', { class: 'anc', role: 'group', 'aria-label': '도형 안 글자 자리' });
  const cells = [];
  for (const [v, vl] of V3) {
    for (const [hz, hl] of H3) {
      const name = v === 'middle' && hz === 'center' ? '정가운데' : `${vl}${v === 'middle' ? '' : '쪽'} ${hl}`;
      const b = h('button', { type: 'button', class: 'anc-b', title: name, onclick: () => act.setInShape(id, { align: hz, ay: v }) }, h('i'));
      cells.push([b, hz, v]);
      grid.append(b);
    }
  }
  bind(grid, () => {
    const T = findLayer(id);
    if (!T || !T.inShape) return;
    for (const [b, hz, v] of cells) b.classList.toggle('on', T.align === hz && (T.inShape.ay || 'middle') === v);
  });
  return grid;
}
function inShapeKids(T, S) {
  return [
    h('div', { class: 'anc-row' },
      anchorGrid(T.id),
      h('div', { class: 'anc-side' },
        mini('여백', numInput({ get: () => { const x = findLayer(T.id); return x && x.inShape ? x.inShape.pad : 0; }, set: (v, live) => act.setInShape(T.id, { pad: v, live }), min: 0, max: 400, unit: 'px' })),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: '글자가 든 도형을 선택 (색·모양 바꾸기)', onclick: () => setSel([S.id]) }, icon('shape', 14), ' 도형 선택'),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: '도형에서 떼어 따로 움직이게', onclick: () => act.detachText(T.id) }, icon('unlink', 14), ' 떼어내기'))),
  ];
}
function inShapeSection(el, L) {
  const S = attachedShape(L, curPage());
  if (S) {
    el.append(section('도형 안 배치', [
      ...inShapeKids(L, S),
      h('p', { class: 'hint' }, '도형을 옮기거나 크기를 바꾸면 글자가 따라가요. 글자를 끌면 도형째 움직여요.'),
    ], { key: 'inshape' }));
    return;
  }
  const U = act.shapeUnder(L);
  if (U) {
    el.append(section('도형 안 배치', [
      h('button', { type: 'button', class: 'btn btn-accent btn-sm full', onclick: () => act.attachText(L.id, U.id) }, icon('inBox', 15), ` 「${layerLabel(U)}」 안에 넣기 · 가운데 맞춤`),
      h('p', { class: 'hint' }, '넣으면 도형 너비에 맞춰 줄바꿈되고, 도형을 옮기면 같이 움직여요.'),
    ], { key: 'inshape' }));
  }
}

/* ---------- 팝오버 (폰트 목록 · 상단 바의 색·정렬 등) ---------- */
let openPop = null;
let popAnchor = null;
function closePop() {
  if (!openPop) return false;
  openPop.remove();
  openPop = null;
  popAnchor = null;
  document.removeEventListener('pointerdown', popOutside, true);
  return true;
}
function popOutside(e) {
  if (!openPop || openPop.contains(e.target)) return;
  if (popAnchor && popAnchor.contains(e.target)) return; // 같은 버튼을 다시 누르면 버튼이 닫음
  if (e.target.closest('.font-btn')) return;
  closePop();
}
/** anchor 아래에 팝오버 열기 (이미 그 버튼 것이 열려 있으면 닫기) */
function togglePop(anchor, build, cls = '') {
  if (openPop && popAnchor === anchor) { closePop(); return null; }
  closePop();
  const pop = h('div', { class: 'pop cx-pop ' + cls }, inCtx(build));
  openPop = pop;
  popAnchor = anchor;
  placePop(pop, anchor);
  setTimeout(() => document.addEventListener('pointerdown', popOutside, true), 0);
  return pop;
}
function placePop(pop, anchor) {
  const r = anchor.getBoundingClientRect();
  document.body.append(pop);
  const ph = pop.offsetHeight, pw = pop.offsetWidth;
  let left = Math.min(r.left, window.innerWidth - pw - 10);
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 10) top = Math.max(10, r.top - ph - 6);
  left = Math.max(10, left);
  Object.assign(pop.style, { left: left + 'px', top: top + 'px' });
}
function openFontMenu(anchor, current, onPick) {
  closePop();
  let cat = fontEntry(current).cat || 'all';
  if (cat === 'custom' && !allFonts().some((f) => f.cat === 'custom')) cat = 'all';
  const pop = h('div', { class: 'pop font-pop' });
  const search = h('input', { type: 'text', class: 'pop-search', placeholder: '폰트 이름 검색 (예: 고딕, 손글씨, Inter)' });
  const chips = h('div', { class: 'chips chips-sm' });
  const list = h('div', { class: 'font-list' });
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) { const f = fontEntry(en.target.dataset.id); previewFont(f); io.unobserve(en.target); }
  }, { root: list });
  const drawChips = () => {
    chips.innerHTML = '';
    for (const c of FONT_CATS) {
      if (c.id === 'custom' && !allFonts().some((f) => f.cat === 'custom')) continue;
      chips.append(h('button', { type: 'button', class: 'chip' + (cat === c.id ? ' on' : ''), onclick: () => { cat = c.id; drawChips(); drawList(); } }, c.name));
    }
  };
  const drawList = () => {
    list.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    // 검색어가 있으면 분류와 상관없이 전체에서 찾음
    const items = allFonts().filter((f) => (q ? (f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || (FONT_CATS.find((c) => c.id === f.cat) || {}).name === q) : (cat === 'all' || f.cat === cat)));
    for (const f of items) {
      const it = h('button', { type: 'button', class: 'font-it' + (f.id === current ? ' on' : ''), dataset: { id: f.id }, onclick: () => { onPick(f.id); closePop(); } },
        h('span', { class: 'fi-name', style: { fontFamily: `"${f.family}", Pretendard, sans-serif`, fontWeight: nearestWeight(f.id, 500) } }, f.name),
        h('span', { class: 'fi-meta' }, f.custom ? '내 폰트' : `${(f.weights || [400]).length}가지 굵기`));
      if (f.custom) {
        it.append(h('span', { class: 'fi-del', title: '내 폰트에서 지우기', onclick: async (e) => { e.stopPropagation(); await removeCustomFont(f.id); drawChips(); drawList(); } }, '×'));
      }
      list.append(it);
      io.observe(it);
    }
    if (!items.length) list.append(h('div', { class: 'empty' }, '검색 결과가 없어요'));
  };
  search.addEventListener('input', drawList);
  search.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') closePop(); });
  const up = h('button', { type: 'button', class: 'btn btn-ghost btn-sm full', onclick: () => pickFile('.ttf,.otf,.woff,.woff2', true, async (files) => {
    const fams = await addFontFiles(files);
    if (fams.length) { cat = 'custom'; drawChips(); drawList(); }
  }) }, '＋ 내 폰트 추가 (브랜드 폰트 TTF · OTF · WOFF)');
  pop.append(search, chips, list, up);
  drawChips();
  drawList();
  openPop = pop;
  popAnchor = anchor;
  placePop(pop, anchor);
  setTimeout(() => document.addEventListener('pointerdown', popOutside, true), 0);
  search.focus();
  const on = list.querySelector('.on');
  if (on) on.scrollIntoView({ block: 'center' });
}
function fontPicker() {
  const btn = h('button', { type: 'button', class: 'font-btn' });
  const sync = () => {
    const id = lget('font')();
    const f = fontEntry(id);
    btn.textContent = fontName(id);
    btn.style.fontFamily = `"${f.family}", Pretendard, sans-serif`;
    previewFont(f);
  };
  btn.addEventListener('click', () => openFontMenu(btn, lget('font')(), (id) => {
    const ids = selLayers().filter((l) => l.type === 'text');
    for (const L of ids) act.setProps([L.id], { font: id, weight: nearestWeight(id, L.weight) }, { live: true });
    act.commitLayers(ids.map((l) => l.id));
    renderProps();
  }));
  bind(btn, sync);
  return btn;
}

/* ---------- 텍스트 ---------- */
let textCommit = null;
function textSections(el, Ls) {
  const single = Ls.length === 1;
  const L = Ls[0];
  const kids = [];
  if (single) {
    const tx = h('textarea', { class: 'txa', rows: 3, spellcheck: false, placeholder: '문구 입력 (엔터 = 줄바꿈)' });
    const commit = debounce(() => act.commitLayers([L.id]), 700);
    textCommit = commit;
    tx.addEventListener('input', () => { act.setProps([L.id], { text: tx.value }, { live: true }); commit(); });
    tx.addEventListener('change', () => commit.flush());
    tx.addEventListener('keydown', (e) => e.stopPropagation());
    bind(tx, () => { const cur = findLayer(L.id); if (cur) tx.value = cur.text; });
    kids.push(tx);
  }
  kids.push(field('글꼴', fontPicker()));
  const wOpts = () => weightsOf(lget('font')()).map((w) => ({ v: w, label: `${w} · ${WEIGHT_NAMES[w] || ''}` }));
  kids.push(field('굵기',
    selectCtl(wOpts(), { get: () => nearestWeight(lget('font')(), lget('weight')()), set: lset('weight', 'text') }),
    h('span', { class: 'ital', title: '기울임' }, toggle({ get: lget('italic'), set: lset('italic', 'text'), label: '기울임' }))));
  kids.push(field('크기', rangeNum({ get: lget('size'), set: lset('size', 'text'), min: 8, max: 300, step: 1, unit: 'px' })));
  kids.push(field('글자색', colorCtl({ get: lget('color'), set: lset('color', 'text'), swatches: true })));
  kids.push(field('취소선', toggle({ get: () => !!lget('strike')(), set: lset('strike', 'text'), label: '정가처럼 가운데 줄 긋기' })));
  kids.push(field('줄 정렬', seg([{ v: 'left', icon: 'tL', title: '왼쪽' }, { v: 'center', icon: 'tC', title: '가운데' }, { v: 'right', icon: 'tR', title: '오른쪽' }], { get: lget('align'), set: lset('align', 'text') })));
  kids.push(field('줄 간격', rangeNum({ get: lget('lh'), set: lset('lh', 'text'), min: 70, max: 250, step: 1, unit: '%', mult: 100 })));
  kids.push(field('자간', rangeNum({ get: lget('tracking'), set: lset('tracking', 'text'), min: -15, max: 60, step: 0.5, unit: '%' })));
  el.append(section('텍스트', kids, { key: 'text' }));
  if (single) inShapeSection(el, L);
  const inBox = single && !!attachedShape(L, curPage());
  if (!L.grad) L.grad = { on: false, color2: '#ffffff', angle: 180, chrome: false };
  const gKids = L.grad.on ? [
    field('두 번째 색', colorCtl({ get: lget('grad.color2'), set: lset('grad.color2', 'text'), swatches: true })),
    field('방향', seg([{ v: 180, label: '↓' }, { v: 90, label: '→' }, { v: 135, label: '↘' }, { v: 45, label: '↗' }], { get: lget('grad.angle'), set: lset('grad.angle', 'text'), small: true })),
    field('크롬 광택', toggle({ get: lget('grad.chrome'), set: lset('grad.chrome', 'text'), label: '메탈·실버 느낌' })),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => act.setProps(selLayers().filter((x) => x.type === 'text').map((x) => x.id), { color: '#6f7680', grad: { on: true, color2: '#ffffff', angle: 180, chrome: true } }) }, '실버 크롬 바로 적용'),
  ] : [];
  el.append(section('글자 그라데이션', gKids, { key: 'grad', right: toggle({ get: lget('grad.on'), set: lset('grad.on', 'text') }), open: L.grad.on }));

  // 박스 너비
  const autoW = L.autoW;
  const boxKids = inBox ? [] : [
    field('너비', seg([{ v: true, label: '글자에 맞춤' }, { v: false, label: '고정 너비' }], { get: lget('autoW'), set: lset('autoW', 'text'), small: true })),
  ];
  if (!autoW) {
    if (!inBox) boxKids.push(field('고정 너비', numInput({ get: lget('w'), set: lset('w', 'text'), min: 20, max: 4000, unit: 'px' })));
    boxKids.push(field('자동 축소', toggle({ get: lget('fit.on'), set: lset('fit.on', 'text'), label: '넘치면 글자 크기 줄이기' })));
    if (L.fit && L.fit.on) {
      boxKids.push(row2(
        mini('최대 줄', numInput({ get: lget('fit.maxLines'), set: lset('fit.maxLines', 'text'), min: 1, max: 20 })),
        mini('최소 크기', numInput({ get: lget('fit.min'), set: lset('fit.min', 'text'), min: 6, max: 300, unit: 'px' }))));
      if (single) {
        const lay = layoutText(L);
        if (lay.shrunk) boxKids.push(h('p', { class: 'hint' }, `지금 ${R1(lay.size)}px로 줄여서 ${lay.lines.length}줄에 맞췄어요`));
      }
    }
    boxKids.push(h('p', { class: 'hint' }, inBox ? '도형 안 글자는 도형 너비에 맞춰 줄바꿈돼요. 자동 축소를 켜면 긴 문구도 도형 안에 들어가요.' : '대량 제작할 때 문구 길이가 달라도 같은 폭 안에서 줄바꿈돼요.'));
  } else boxKids.push(h('p', { class: 'hint' }, '박스 양옆 손잡이를 끌면 고정 너비(줄바꿈)로 바뀌어요.'));
  el.append(section('글상자', boxKids, { key: 'box' }));

  // 배경
  const bgMode = L.bg.mode;
  const bgKids = [field('모양', seg([{ v: 'none', label: '없음' }, { v: 'box', label: '박스' }, { v: 'line', label: '줄마다' }], { get: lget('bg.mode'), set: lset('bg.mode', 'text'), small: true }))];
  if (bgMode !== 'none') {
    bgKids.push(field('색', colorCtl({ get: lget('bg.color'), set: lset('bg.color', 'text'), swatches: true })));
    bgKids.push(field('불투명도', rangeNum({ get: lget('bg.alpha'), set: lset('bg.alpha', 'text'), min: 0, max: 100, unit: '%', mult: 100 })));
    bgKids.push(row2(mini('좌우 여백', numInput({ get: lget('bg.padX'), set: lset('bg.padX', 'text'), min: 0, max: 400 })), mini('위아래', numInput({ get: lget('bg.padY'), set: lset('bg.padY', 'text'), min: 0, max: 400 }))));
    bgKids.push(field('모서리', rangeNum({ get: () => Math.min(200, lget('bg.radius')() || 0), set: lset('bg.radius', 'text'), min: 0, max: 200, unit: 'px' })));
  }
  el.append(section('글자 배경 (하이라이트)', bgKids, { key: 'bg' }));

  // 외곽선
  const stKids = [];
  if (L.stroke.on) {
    stKids.push(field('색', colorCtl({ get: lget('stroke.color'), set: lset('stroke.color', 'text') })));
    stKids.push(field('두께', rangeNum({ get: lget('stroke.width'), set: lset('stroke.width', 'text'), min: 1, max: 40, step: 0.5, unit: 'px' })));
  }
  el.append(section('외곽선', stKids, { key: 'stroke', right: toggle({ get: lget('stroke.on'), set: lset('stroke.on', 'text') }), open: L.stroke.on }));

  // 속 비우기 (외곽선만)
  for (const x of Ls) if (!x.hollow) x.hollow = { on: false, width: 3 };
  const hoKids = L.hollow.on ? [
    field('선 두께', rangeNum({ get: lget('hollow.width'), set: lset('hollow.width', 'text'), min: 0.5, max: 20, step: 0.5, unit: 'px' })),
    h('p', { class: 'hint' }, '글자색으로 테두리만 그려요. 같은 문구를 여러 줄 겹쳐 쓰고 한 줄만 채우면 릴스 커버 느낌이 나요.'),
  ] : [];
  el.append(section('속 비우기 (외곽선만)', hoKids, { key: 'hollow', right: toggle({ get: lget('hollow.on'), set: lset('hollow.on', 'text') }), open: L.hollow.on }));
  // 그림자
  el.append(section('그림자', shadowKids(L, 'text'), { key: 'shadow', right: toggle({ get: lget('shadow.on'), set: lset('shadow.on', 'text') }), open: L.shadow.on }));
}
function shadowKids(L, type) {
  if (!L.shadow.on) return [];
  return [
    field('색', colorCtl({ get: lget('shadow.color'), set: lset('shadow.color', type) })),
    field('진하기', rangeNum({ get: lget('shadow.alpha'), set: lset('shadow.alpha', type), min: 0, max: 100, unit: '%', mult: 100 })),
    field('흐림', rangeNum({ get: lget('shadow.blur'), set: lset('shadow.blur', type), min: 0, max: 120, unit: 'px' })),
    row2(mini('X', numInput({ get: lget('shadow.x'), set: lset('shadow.x', type), min: -200, max: 200 })), mini('Y', numInput({ get: lget('shadow.y'), set: lset('shadow.y', type), min: -200, max: 200 }))),
  ];
}

/* ---------- 이미지 ---------- */
function imageSections(el, L) {
  const a = assets.get(L.asset);
  const thumb = h('div', { class: 'img-thumb', style: a && a.url ? { backgroundImage: `url(${a.url})` } : null }, a ? null : '비어 있음');
  const kids = [
    h('div', { class: 'img-head' }, thumb, h('div', { class: 'img-btns' },
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => bus.emit('pick-image', L.id) }, L.asset ? '이미지 바꾸기' : '이미지 넣기'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => act.fillBackground(L.id) }, '배경으로 꽉 채우기'),
      L.asset ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm' + (state.cropId === L.id ? ' on' : ''), onclick: () => (state.cropId === L.id ? exitCrop() : enterCrop(L.id)) }, icon('crop', 14), state.cropId === L.id ? ' 위치 조정 끝내기' : ' 위치 조정 (더블클릭)') : null)),
    field('맞춤', seg([{ v: 'cover', label: '채우기 (자르기)' }, { v: 'contain', label: '전체 보이기' }], { get: lget('fit'), set: (v, live) => act.setProps([L.id], { fit: v, zoom: 1, px: 0.5, py: 0.5 }, { live }), small: true })),
    field('확대', rangeNum({ get: lget('zoom'), set: lset('zoom', 'image'), min: L.fit === 'contain' ? 20 : 100, max: 500, step: 1, unit: '%', mult: 100 })),
    row2(
      mini('가로 위치', rangeOnly({ get: lget('px'), set: lset('px', 'image') })),
      mini('세로 위치', rangeOnly({ get: lget('py'), set: lset('py', 'image') }))),
    field('모양', selectCtl(IMAGE_MASKS, { get: () => lget('mask')() || 'rect', set: lset('mask', 'image') })),
    row2(
      (!L.mask || L.mask === 'rect') ? mini('모서리', numInput({ get: lget('radius'), set: lset('radius', 'image'), min: 0, max: 1000, unit: 'px' })) : h('div'),
      mini('좌우 반전', toggle({ get: lget('flipX'), set: lset('flipX', 'image') }))),
  ];
  if (a && a.w) kids.push(h('p', { class: 'hint' }, `원본 ${a.w} × ${a.h}px — 내보내기 「원본 화질」이면 이 해상도 그대로 저장돼요`));
  el.append(section('이미지', kids, { key: 'image' }));
  el.append(section('색 보정', [
    field('밝기', rangeNum({ get: lget('adj.b'), set: lset('adj.b', 'image'), min: 30, max: 200, unit: '%' })),
    field('대비', rangeNum({ get: lget('adj.c'), set: lset('adj.c', 'image'), min: 30, max: 200, unit: '%' })),
    field('채도', rangeNum({ get: lget('adj.s'), set: lset('adj.s', 'image'), min: 0, max: 200, unit: '%' })),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => act.setProps([L.id], { adj: { b: 100, c: 100, s: 100 } }) }, '원래대로'),
  ], { key: 'adj', open: false }));
  const stKids = L.stroke.on ? [field('색', colorCtl({ get: lget('stroke.color'), set: lset('stroke.color', 'image') })), field('두께', rangeNum({ get: lget('stroke.width'), set: lset('stroke.width', 'image'), min: 1, max: 60, unit: 'px' }))] : [];
  el.append(section('테두리', stKids, { key: 'stroke', right: toggle({ get: lget('stroke.on'), set: lset('stroke.on', 'image') }), open: L.stroke.on }));
  el.append(section('그림자', shadowKids(L, 'image'), { key: 'shadow', right: toggle({ get: lget('shadow.on'), set: lset('shadow.on', 'image') }), open: L.shadow.on }));
  el.append(section('검사', [field('안전영역', toggle({ get: () => !!lget('checkSafe')(), set: lset('checkSafe'), label: '로고·제품도 가림 검사' }))], { key: 'check', open: false }));
}
function rangeOnly({ get, set }) {
  const r = h('input', { type: 'range', class: 'rng', min: 0, max: 100, step: 1 });
  r.addEventListener('input', () => set(+r.value / 100, true));
  r.addEventListener('change', () => set(+r.value / 100, false));
  bind(r, () => { r.value = (get() ?? 0.5) * 100; });
  return r;
}

/* ---------- 도형 ---------- */
const SHAPE_KINDS = [
  { v: 'rect', label: '사각형' }, { v: 'ellipse', label: '원' }, { v: 'arch', label: '아치' }, { v: 'star', label: '별 · 스티커' },
  { v: 'sparkle', label: '반짝이 ✦' }, { v: 'heart', label: '하트' }, { v: 'flower', label: '꽃 (데이지)' }, { v: 'ticket', label: '티켓 · 쿠폰' },
  { v: 'bubble', label: '말풍선' }, { v: 'arrow', label: '손그림 화살표' }, { v: 'scribble', label: '손그림 동그라미' }, { v: 'squiggle', label: '물결 밑줄' },
  { v: 'corners', label: '뷰파인더 모서리' }, { v: 'film', label: '필름 스트립' }, { v: 'checker', label: '체크무늬' }, { v: 'stripes', label: '사선 줄무늬' },
  { v: 'barcode', label: '바코드' }, { v: 'grain', label: '필름 그레인' },
];
const LINE_KINDS = new Set(['arrow', 'scribble', 'squiggle', 'corners']);
const IMAGE_MASKS = [{ v: 'rect', label: '사각형' }, { v: 'ellipse', label: '원' }, { v: 'arch', label: '아치' }, { v: 'heart', label: '하트' }, { v: 'star', label: '별' }];
function shapeSections(el, L) {
  const kind = L.shape || 'rect';
  const line = LINE_KINDS.has(kind), grain = kind === 'grain';
  const kids = [field('모양', selectCtl(SHAPE_KINDS, { get: () => lget('shape')() || 'rect', set: lset('shape', 'shape') }))];
  if (line) {
    kids.push(field('색', colorCtl({ get: lget('fill.color'), set: lset('fill.color', 'shape'), swatches: true })));
    kids.push(field('선 두께', rangeNum({ get: () => lget('thick')() || 8, set: lset('thick', 'shape'), min: 2, max: 60, unit: 'px' })));
  } else if (grain) {
    kids.push(h('p', { class: 'hint' }, '사진 위에 얹으면 필름 사진처럼 거친 입자가 생겨요. 진하기는 아래 「투명도」로 조절하세요.'));
  } else {
    kids.push(field('채우기', seg([{ v: 'solid', label: '단색' }, { v: 'linear', label: '그라데이션' }], { get: lget('fill.type'), set: lset('fill.type', 'shape'), small: true })));
    kids.push(field(L.fill.type === 'linear' ? '시작 색' : '색', colorCtl({ get: lget('fill.color'), set: lset('fill.color', 'shape'), swatches: true })));
    kids.push(field(L.fill.type === 'linear' ? '시작 진하기' : '불투명도', rangeNum({ get: lget('fill.alpha'), set: lset('fill.alpha', 'shape'), min: 0, max: 100, unit: '%', mult: 100 })));
    if (L.fill.type === 'linear') {
      kids.push(field('끝 색', colorCtl({ get: lget('fill.color2'), set: lset('fill.color2', 'shape') })));
      kids.push(field('끝 진하기', rangeNum({ get: lget('fill.alpha2'), set: lset('fill.alpha2', 'shape'), min: 0, max: 100, unit: '%', mult: 100 })));
      kids.push(field('방향', seg([{ v: 180, label: '↓' }, { v: 0, label: '↑' }, { v: 90, label: '→' }, { v: 270, label: '←' }, { v: 135, label: '↘' }], { get: lget('fill.angle'), set: lset('fill.angle', 'shape'), small: true })));
    }
  }
  if (kind === 'star') {
    kids.push(field('꼭짓점', rangeNum({ get: lget('points'), set: lset('points', 'shape'), min: 3, max: 32, step: 1 })));
    kids.push(field('안쪽 깊이', rangeNum({ get: lget('inner'), set: lset('inner', 'shape'), min: 10, max: 95, unit: '%', mult: 100 })));
  }
  if (kind === 'flower') {
    kids.push(field('꽃잎 수', rangeNum({ get: lget('points'), set: lset('points', 'shape'), min: 4, max: 16, step: 1 })));
    kids.push(field('꽃잎 굵기', rangeNum({ get: lget('inner'), set: lset('inner', 'shape'), min: 10, max: 50, unit: '%', mult: 100 })));
  }
  if (kind === 'sparkle') kids.push(field('통통함', rangeNum({ get: lget('inner'), set: lset('inner', 'shape'), min: 2, max: 45, unit: '%', mult: 100 })));
  if (kind === 'checker') kids.push(field('가로 칸 수', rangeNum({ get: lget('points'), set: lset('points', 'shape'), min: 2, max: 40, step: 1 })));
  if (kind === 'stripes') kids.push(field('줄 굵기', rangeNum({ get: lget('inner'), set: lset('inner', 'shape'), min: 2, max: 100, unit: '%', mult: 100 })));
  if (!line && !grain) {
    kids.push(field('흐림', rangeNum({ get: () => lget('blur')() || 0, set: lset('blur', 'shape'), min: 0, max: 300, unit: 'px' })));
    if (L.blur > 0) kids.push(h('p', { class: 'hint' }, '흐리게 한 원을 여러 개 겹치면 오라·빛번짐 배경이 돼요.'));
  }
  if (kind === 'bubble') kids.push(field('꼬리', seg([{ v: 'left', label: '왼쪽' }, { v: 'right', label: '오른쪽' }], { get: () => lget('tail')() || 'left', set: lset('tail', 'shape'), small: true })));
  if (kind === 'rect' || kind === 'ticket' || kind === 'bubble' || kind === 'film' || kind === 'stripes') kids.push(field('모서리', rangeNum({ get: () => Math.min(500, lget('radius')() || 0), set: lset('radius', 'shape'), min: 0, max: 500, unit: 'px' })));
  if (!grain) kids.push(field('좌우 반전', toggle({ get: () => !!lget('flipX')(), set: lset('flipX', 'shape') })));
  el.append(section('도형', kids, { key: 'shape' }));
  if (canHoldText(L)) {
    const ts = attachedTexts(L, curPage());
    el.append(section('도형 안 글자', [
      h('button', { type: 'button', class: 'btn btn-accent btn-sm full', onclick: () => act.addTextInShape(L.id) }, icon('plus', 15), ts.length ? ' 글자 하나 더 넣기' : ' 도형 안에 글자 넣기 (가운데 정렬)'),
      ts.length ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm full', onclick: () => setSel(ts.map((t) => t.id)) }, `안에 든 글자 ${ts.length}개 선택 — 위치·크기 바꾸기`) : null,
      h('p', { class: 'hint' }, '도형 안 글자는 도형을 옮기거나 크기를 바꾸면 따라가요. 있는 글자를 넣으려면 글자를 도형 위에 올리고 「도형 안에 넣기」.'),
    ], { key: 'shapetext' }));
  }
  const stKids = L.stroke.on ? [field('색', colorCtl({ get: lget('stroke.color'), set: lset('stroke.color', 'shape') })), field('두께', rangeNum({ get: lget('stroke.width'), set: lset('stroke.width', 'shape'), min: 1, max: 60, unit: 'px' }))] : [];
  el.append(section('테두리', stKids, { key: 'stroke', right: toggle({ get: lget('stroke.on'), set: lset('stroke.on', 'shape') }), open: L.stroke.on }));
  if (!L.shadow) L.shadow = { on: false, color: '#000000', alpha: 0.3, blur: 30, x: 0, y: 10 };
  el.append(section('그림자', shadowKids(L, 'shape'), { key: 'shadow', right: toggle({ get: lget('shadow.on'), set: lset('shadow.on', 'shape') }), open: L.shadow.on }));
  el.append(section('검사', [field('안전영역', toggle({ get: () => !!lget('checkSafe')(), set: lset('checkSafe'), label: '이 도형도 가림 검사' }))], { key: 'check', open: false }));
}

function layerOpsSection(Ls) {
  const b = (ic, label, fn, cls = '') => h('button', { type: 'button', class: 'ib ' + cls, title: label, onclick: fn }, icon(ic, 17));
  const L = Ls[0];
  return section('레이어', [
    h('div', { class: 'ib-row' },
      b('front', `맨 앞으로 (${MOD}+Shift+])`, () => act.reorder('front')),
      b('up', `앞으로 (${MOD}+])`, () => act.reorder('forward')),
      b('down', `뒤로 (${MOD}+[)`, () => act.reorder('backward')),
      b('back', `맨 뒤로 (${MOD}+Shift+[)`, () => act.reorder('back')),
      h('span', { class: 'ib-sep' }),
      b('dup', `복제 (${MOD}+D)`, () => act.duplicateSel()),
      b(L.locked ? 'unlock' : 'lock', L.locked ? '잠금 풀기' : '잠그기', () => { for (const x of Ls) act.toggleLocked(x.id); renderProps(); }),
      b('trash', '삭제 (Delete)', () => act.deleteSel(), 'danger')),
    state.project.pages.length > 1 ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm full', title: '선택한 요소를 다른 페이지 전부에 넣어요 (같은 위치, 일괄 수정으로 연결)', onclick: () => act.copyToAllPages() }, icon('pages', 14), ' 모든 페이지에 복사 (로고·뱃지 등)') : null,
  ], { key: 'layer' });
}

function buildLayerPanel(el, Ls) {
  el.append(header(Ls));
  el.append(layerOpsSection(Ls)); // 순서·복제·잠금·삭제는 맨 위에
  el.append(alignSection(Ls));
  el.append(geomSection(Ls));
  const types = new Set(Ls.map((l) => l.type));
  if (types.size === 1) {
    const t = Ls[0].type;
    if (t === 'text') textSections(el, Ls);
    else if (Ls.length === 1 && t === 'image') imageSections(el, Ls[0]);
    else if (Ls.length === 1 && t === 'shape') shapeSections(el, Ls[0]);
  }
}

/* =========================================================================
   상단 설정 바 — 선택한 요소의 자주 쓰는 설정을 오른쪽 패널 없이 바로 (일러스트레이터 컨트롤 막대처럼)
   ========================================================================= */
let ctxSig = '';
const ctxEl = () => document.getElementById('ctxbar');
const cxSep = () => h('i', { class: 'cx-sep' });
const cxLab = (t) => h('span', { class: 'cx-l' }, t);
const cxF = (label, ...kids) => h('div', { class: 'cx-f' }, label ? cxLab(label) : null, ...kids);
function cxChip(ic, label, title) {
  return h('div', { class: 'cx-chip', title: title || label }, icon(ic, 15), h('span', null, label));
}
function cxBtn(ic, label, onClick, { title, cls = '' } = {}) {
  return h('button', { type: 'button', class: 'cx-btn ' + cls, title: title || label || '', onclick: onClick }, ic ? icon(ic, 15) : null, label ? h('span', null, label) : null);
}
function cxIb(ic, title, onClick, cls = '') {
  return h('button', { type: 'button', class: 'cx-ib ' + cls, title, onclick: onClick }, icon(ic, 16));
}
function cxTog(ic, title, get, set) {
  const b = h('button', { type: 'button', class: 'cx-ib', title, 'aria-pressed': 'false' }, icon(ic, 16));
  const sync = () => { const on = !!get(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  b.addEventListener('click', () => { set(!get(), false); sync(); });
  bind(b, sync);
  return b;
}
/** 색 버튼 — 누르면 색 고르기·HEX·견본 팝오버 */
function cxColor({ get, set, title = '색' }) {
  const sw = h('i');
  const b = h('button', { type: 'button', class: 'cx-clr', title });
  b.append(sw);
  const sync = () => { sw.style.background = normHex(get()) || '#000000'; };
  bind(b, sync);
  b.addEventListener('click', () => togglePop(b, () => [
    h('div', { class: 'cx-pop-t' }, title),
    colorCtl({ get, set: (v, live) => { set(v, live); sync(); }, swatches: true }),
  ]));
  return b;
}
const cxNum = (o) => h('div', { class: 'cx-num' }, numInput(o));
const pct = (path) => ({
  get: () => { const v = lget(path)(); return (v ?? 1) * 100; },
  set: (v, live) => lset(path)(clamp(v, 0, 100) / 100, live),
  min: 0, max: 100, unit: '%',
});

function ctxSignature() {
  if (!state.project) return '';
  const Ls = selLayers();
  const parts = [state.pageId, state.cropId || '', Ls.length, state.prefs.ui && state.prefs.ui.right ? 1 : 0, state.editingId ? 1 : 0];
  for (const L of Ls) {
    parts.push(L.id, L.type, L.locked ? 1 : 0, shapeLinkSig(L));
    if (L.type === 'text') parts.push(L.font);
    if (L.type === 'shape') parts.push(L.shape, L.fill.type, L.stroke.on ? 1 : 0);
    if (L.type === 'image') parts.push(L.fit, L.mask || 'rect', L.asset ? 1 : 0);
  }
  return parts.join('|');
}

export function renderCtx() {
  const el = ctxEl();
  if (!el || !state.project) return;
  ctxBindings = [];
  ctxSig = ctxSignature();
  const sx = el.scrollLeft;
  el.innerHTML = '';
  inCtx(() => {
    const Ls = selLayers();
    if (state.cropId && findLayer(state.cropId)) ctxCrop(el);
    else if (!Ls.length) ctxPage(el);
    else ctxLayers(el, Ls);
  });
  el.scrollLeft = sx;
}
export function syncCtx() {
  if (!state.project) return;
  if (ctxSignature() !== ctxSig) { renderCtx(); return; }
  const active = document.activeElement;
  for (const b of ctxBindings) {
    if (b.el === active) continue;
    try { b.sync(); } catch (e) { /* noop */ }
  }
}

function detailBtn() {
  const on = !!(state.prefs.ui && state.prefs.ui.right);
  return cxBtn('sliders', on ? '세부 설정 닫기' : '세부 설정', () => bus.emit('toggle-right'), { cls: 'cx-detail' + (on ? ' on' : ''), title: '오른쪽 세부 설정 패널 (그림자·그라데이션·외곽선 등 전부)' });
}

function ctxPage(el) {
  const pg = curPage();
  el.append(
    cxChip('page', pg ? pg.name : '페이지', '지금 페이지 — 이름은 아래 페이지 목록에서 더블클릭'),
    cxF('배경', cxColor({ get: () => curPage().bg, set: (v, live) => act.setPageBg(v, { live }), title: '페이지 배경색' })),
    cxBtn(null, '모든 페이지에', () => act.applyBgToAll(), { title: '이 배경색을 모든 페이지에' }),
    cxSep(),
    h('span', { class: 'cx-hint' }, '요소를 클릭하면 여기서 바로 고쳐요 · 왼쪽 도구에서 텍스트 · 사진 · 도형 추가 · Tab = 패널 모두 접기'),
    h('span', { class: 'spacer' }),
    detailBtn(),
  );
}

function ctxCrop(el) {
  const L = findLayer(state.cropId);
  el.append(
    cxChip('crop', '사진 위치 조정', '드래그 = 위치 · 휠 = 확대 · Esc = 끝내기'),
    cxLab('끌면 위치 · 휠 = 확대'),
    cxSep(),
    cxF('확대', h('div', { class: 'cx-rng' }, rangeNum({ get: lget('zoom'), set: lset('zoom', 'image'), min: L.fit === 'contain' ? 20 : 100, max: 500, step: 1, unit: '%', mult: 100 }))),
    cxBtn(null, '원래대로', () => act.setProps([L.id], { zoom: 1, px: 0.5, py: 0.5 })),
    h('span', { class: 'spacer' }),
    cxBtn(null, '완료 (Esc)', () => exitCrop(), { cls: 'cx-primary' }),
  );
}

function ctxLayers(el, Ls) {
  const single = Ls.length === 1;
  const L = Ls[0];
  const types = new Set(Ls.map((l) => l.type));
  const page = curPage();
  el.append(single
    ? cxChip(L.type, layerLabel(L), `${{ text: '텍스트', image: '이미지', shape: '도형' }[L.type]} · ${layerLabel(L)}`)
    : cxChip('pages', `${Ls.length}개 선택`));
  if (types.size === 1 && L.type === 'text') ctxText(el, Ls);
  else if (single && L.type === 'shape') ctxShape(el, L);
  else if (single && L.type === 'image') ctxImage(el, L);
  // 도형 1개 + 글자 1개 → 도형 안에 넣기
  if (Ls.length === 2) {
    const S = Ls.find((l) => canHoldText(l)), T = Ls.find((l) => l.type === 'text');
    if (S && T && attachedShape(T, page) !== S) el.append(cxSep(), cxBtn('inBox', '글자를 도형 안에', () => act.attachText(T.id, S.id), { cls: 'cx-accent', title: '글자를 이 도형 안 가운데에 넣고, 도형을 따라 움직이게' }));
  }
  el.append(cxSep());
  if (!single) {
    const ab = (ic, mode, title) => cxIb(ic, title, () => act.align(mode));
    el.append(
      ab('alignL', 'left', `왼쪽 맞춤 (${ALT}+A)`), ab('alignC', 'hcenter', `가로 가운데 (${ALT}+H)`), ab('alignR', 'right', `오른쪽 맞춤 (${ALT}+D)`),
      ab('alignT', 'top', `위 맞춤 (${ALT}+W)`), ab('alignM', 'vmiddle', `세로 가운데 (${ALT}+V)`), ab('alignB', 'bottom', `아래 맞춤 (${ALT}+S)`),
    );
    if (Ls.length > 2) el.append(cxIb('distH', '가로 간격 똑같이', () => act.distribute('h')), cxIb('distV', '세로 간격 똑같이', () => act.distribute('v')));
    el.append(cxSep());
  }
  el.append(cxF('투명도', cxNum(pct('opacity'))));
  if (single) {
    const ab = cxBtn('alignC', '정렬', null, { title: '왼쪽·가운데·오른쪽 / 위·가운데·아래 맞춤' });
    ab.addEventListener('click', () => togglePop(ab, () => [h('div', { class: 'cx-pop-t' }, '정렬'), ...alignKids(selLayers())], 'cx-pop-wide'));
    el.append(ab);
  }
  const ob = cxBtn('order', '순서', null, { title: '앞으로 · 뒤로' });
  ob.addEventListener('click', () => openMenu(0, 0, [
    { label: '맨 앞으로', hint: `${MOD}+⇧+]`, onClick: () => act.reorder('front') },
    { label: '앞으로', hint: `${MOD}+]`, onClick: () => act.reorder('forward') },
    { label: '뒤로', hint: `${MOD}+[`, onClick: () => act.reorder('backward') },
    { label: '맨 뒤로', hint: `${MOD}+⇧+[`, onClick: () => act.reorder('back') },
  ], { anchor: ob }));
  el.append(ob,
    cxTog(L.locked ? 'lock' : 'unlock', '잠그기 / 잠금 풀기', () => !!selLayers()[0]?.locked, (v) => { for (const x of selLayers()) if (!!x.locked !== v) act.toggleLocked(x.id); }),
    cxIb('dup', `복제 (${MOD}+D)`, () => act.duplicateSel()),
    cxIb('trash', '삭제 (Delete)', () => act.deleteSel(), 'danger'),
    h('span', { class: 'spacer' }),
    detailBtn());
}

function ctxText(el, Ls) {
  const single = Ls.length === 1;
  const L = Ls[0];
  const wOpts = weightsOf(L.font).map((w) => ({ v: w, label: `${w} ${WEIGHT_NAMES[w] || ''}` }));
  el.append(
    cxSep(),
    h('div', { class: 'cx-font' }, fontPicker()),
    h('div', { class: 'cx-wt' }, selectCtl(wOpts, { get: () => nearestWeight(lget('font')(), lget('weight')()), set: lset('weight', 'text') })),
    cxF(null, cxNum({ get: lget('size'), set: lset('size', 'text'), min: 8, max: 300, unit: 'px', title: '글자 크기' })),
    cxColor({ get: lget('color'), set: lset('color', 'text'), title: '글자색' }),
    h('div', { class: 'cx-seg' }, seg([{ v: 'left', icon: 'tL', title: '왼쪽 줄 정렬' }, { v: 'center', icon: 'tC', title: '가운데 줄 정렬' }, { v: 'right', icon: 'tR', title: '오른쪽 줄 정렬' }], { get: lget('align'), set: lset('align', 'text') })),
    cxTog('italic', '기울임', () => !!lget('italic')(), lset('italic', 'text')),
    cxTog('strike', '취소선 (정가 표시)', () => !!lget('strike')(), lset('strike', 'text')),
  );
  if (!single) return;
  const S = attachedShape(L, curPage());
  if (S) {
    const b = cxBtn('inBox', '도형 안 자리', null, { cls: 'cx-accent', title: '도형 안에서 글자 자리 (위·가운데·아래 × 왼쪽·가운데·오른쪽) · 여백 · 떼어내기' });
    b.addEventListener('click', () => togglePop(b, () => [h('div', { class: 'cx-pop-t' }, '도형 안 글자 자리'), ...inShapeKids(L, S)], 'cx-pop-wide'));
    el.append(cxSep(), b);
  } else {
    const U = act.shapeUnder(L);
    if (U) el.append(cxSep(), cxBtn('inBox', '도형 안에 넣기', () => act.attachText(L.id, U.id), { cls: 'cx-accent', title: `「${layerLabel(U)}」 안 가운데에 넣고 도형을 따라 움직이게` }));
  }
}

function ctxShape(el, L) {
  const kind = L.shape || 'rect';
  const line = LINE_KINDS.has(kind), grain = kind === 'grain';
  el.append(cxSep(), h('div', { class: 'cx-wt' }, selectCtl(SHAPE_KINDS, { get: () => lget('shape')() || 'rect', set: lset('shape', 'shape') })));
  if (!grain) el.append(cxF('색', cxColor({ get: lget('fill.color'), set: lset('fill.color', 'shape'), title: L.fill.type === 'linear' ? '시작 색' : '채우기 색' })));
  if (!line && !grain && L.fill.type === 'linear') el.append(cxColor({ get: lget('fill.color2'), set: lset('fill.color2', 'shape'), title: '끝 색' }));
  if (line) el.append(cxF('두께', cxNum({ get: () => lget('thick')() || 8, set: lset('thick', 'shape'), min: 2, max: 60, unit: 'px' })));
  if (!line && !grain) {
    el.append(cxF('진하기', cxNum(pct('fill.alpha'))));
    el.append(cxTog('border', '테두리', () => !!lget('stroke.on')(), lset('stroke.on', 'shape')));
    if (L.stroke.on) el.append(cxColor({ get: lget('stroke.color'), set: lset('stroke.color', 'shape'), title: '테두리 색' }), cxNum({ get: lget('stroke.width'), set: lset('stroke.width', 'shape'), min: 1, max: 60, unit: 'px', title: '테두리 두께' }));
    if (['rect', 'ticket', 'bubble', 'film', 'stripes'].includes(kind)) el.append(cxF('모서리', cxNum({ get: () => Math.min(500, lget('radius')() || 0), set: lset('radius', 'shape'), min: 0, max: 500, unit: 'px' })));
  }
  if (canHoldText(L)) {
    const ts = attachedTexts(L, curPage());
    el.append(cxSep(), cxBtn('plus', ts.length ? '글자 더 넣기' : '글자 넣기', () => act.addTextInShape(L.id), { cls: 'cx-accent', title: '도형 안 가운데에 글자 넣기 (도형을 따라 움직임)' }));
    if (ts.length) el.append(cxBtn(null, `안 글자 ${ts.length}개`, () => setSel(ts.map((t) => t.id)), { title: '도형 안 글자 선택' }));
  }
}

function ctxImage(el, L) {
  el.append(
    cxSep(),
    cxBtn('image', L.asset ? '바꾸기' : '사진 넣기', () => bus.emit('pick-image', L.id)),
    L.asset ? cxBtn('crop', '위치 조정', () => enterCrop(L.id), { title: '사진 위치·확대 (더블클릭)' }) : null,
    h('div', { class: 'cx-seg' }, seg([{ v: 'cover', label: '채우기' }, { v: 'contain', label: '전체' }], { get: lget('fit'), set: (v, live) => act.setProps([L.id], { fit: v, zoom: 1, px: 0.5, py: 0.5 }, { live }), small: true })),
    h('div', { class: 'cx-wt' }, selectCtl(IMAGE_MASKS, { get: () => lget('mask')() || 'rect', set: lset('mask', 'image') })),
    (!L.mask || L.mask === 'rect') ? cxF('모서리', cxNum({ get: lget('radius'), set: lset('radius', 'image'), min: 0, max: 1000, unit: 'px' })) : null,
    cxBtn(null, '배경으로', () => act.fillBackground(L.id), { title: '배경으로 꽉 채우기' }),
  );
}

/* ---------- 레이어 목록 ---------- */
let dragLayerId = null;
export function renderLayers() {
  const box = document.getElementById('layersList');
  if (!box || !state.project) return;
  const pg = curPage();
  box.innerHTML = '';
  const list = [...pg.layers].reverse();
  const count = document.getElementById('layersCount');
  if (count) count.textContent = pg.layers.length;
  if (!list.length) {
    box.append(h('div', { class: 'empty' }, '아직 요소가 없어요.', h('br'), '추가 탭에서 텍스트·이미지를 넣어보세요.'));
    return;
  }
  const sel = new Set(state.sel);
  list.forEach((L, di) => {
    const a = L.type === 'image' ? assets.get(L.asset) : null;
    const thumb = L.type === 'image'
      ? h('span', { class: 'lr-th', style: a && a.url ? { backgroundImage: `url(${a.url})` } : null })
      : L.type === 'shape'
        ? h('span', { class: 'lr-th sh', style: { background: L.fill.type === 'linear' ? `linear-gradient(180deg, ${L.fill.color}, ${L.fill.color2})` : L.fill.color, borderRadius: L.shape === 'ellipse' ? '50%' : '3px' } })
        : h('span', { class: 'lr-th tx' }, 'T');
    const linked = act.linkedCount(L);
    const holder = attachedShape(L, pg);
    const row = h('div', {
      class: 'lr' + (sel.has(L.id) ? ' on' : '') + (L.hidden ? ' hid' : '') + (L.locked ? ' locked' : '') + (holder ? ' child' : ''),
      draggable: 'true', dataset: { id: L.id },
    },
    thumb,
    h('span', { class: 'lr-name', title: holder ? `${layerLabel(L)} — 「${layerLabel(holder)}」 안 글자` : layerLabel(L) }, layerLabel(L)),
    holder ? h('span', { class: 'lr-box', title: `「${layerLabel(holder)}」 안 글자` }, icon('inBox', 12)) : null,
    linked ? h('span', { class: 'lr-link', title: `다른 페이지 ${linked}개와 연결` }, icon('link', 12)) : null,
    h('button', { type: 'button', class: 'lr-btn' + (L.locked ? ' act' : ''), title: L.locked ? '잠금 풀기' : '잠그기', onclick: (e) => { e.stopPropagation(); act.toggleLocked(L.id); } }, icon(L.locked ? 'lock' : 'unlock', 14)),
    h('button', { type: 'button', class: 'lr-btn' + (L.hidden ? ' act' : ''), title: L.hidden ? '보이기' : '숨기기', onclick: (e) => { e.stopPropagation(); act.toggleHidden(L.id); } }, icon(L.hidden ? 'eyeOff' : 'eye', 14)));
    row.addEventListener('click', (e) => {
      if (e.shiftKey || modKey(e)) {
        setSel(sel.has(L.id) ? state.sel.filter((x) => x !== L.id) : [...state.sel, L.id]);
      } else setSel([L.id]);
    });
    row.addEventListener('dblclick', () => {
      const nm = row.querySelector('.lr-name');
      const inp = h('input', { type: 'text', class: 'lr-in', value: L.name || layerLabel(L) });
      nm.replaceWith(inp);
      inp.focus(); inp.select();
      const done = (ok) => { if (ok) act.renameLayer(L.id, inp.value); renderLayers(); };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    });
    row.addEventListener('dragstart', (e) => { dragLayerId = L.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', L.id); row.classList.add('dragging'); });
    row.addEventListener('dragend', () => { dragLayerId = null; row.classList.remove('dragging'); box.querySelectorAll('.drop-a,.drop-b').forEach((x) => x.classList.remove('drop-a', 'drop-b')); });
    row.addEventListener('dragover', (e) => {
      if (!dragLayerId) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      box.querySelectorAll('.drop-a,.drop-b').forEach((x) => x.classList.remove('drop-a', 'drop-b'));
      row.classList.add(before ? 'drop-a' : 'drop-b');
    });
    row.addEventListener('drop', (e) => {
      if (!dragLayerId || dragLayerId === L.id) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      // 화면 목록은 위가 앞(배열 끝). 표시 위치 di → 배열 위치
      const n = pg.layers.length;
      const fromIdx = pg.layers.findIndex((x) => x.id === dragLayerId);
      let target = n - 1 - di + (before ? 1 : 0);
      if (fromIdx < target) target -= 1;
      act.moveLayerTo(dragLayerId, target);
    });
    box.append(row);
  });
}

/* ---------- 파일 고르기 ---------- */
export function pickFile(accept, multiple, cb) {
  const inp = h('input', { type: 'file', accept, multiple: multiple || null, style: { display: 'none' } });
  inp.addEventListener('change', () => { const files = [...inp.files]; inp.remove(); if (files.length) cb(files); });
  document.body.append(inp);
  inp.click();
}

export function initPanels() {
  bus.on('sel', () => { renderProps(); renderLayers(); renderCtx(); });
  bus.on('page', () => { renderProps(); renderLayers(); renderCtx(); });
  bus.on('restored', () => { renderProps(); renderLayers(); renderCtx(); });
  bus.on('project', () => renderCtx());
  bus.on('link-edit', () => renderLayers());
  bus.on('fonts-list', () => { renderProps(); renderCtx(); });
  bus.on('crop', () => { renderProps(); renderCtx(); });
  bus.on('asset-ready', () => renderLayers());
  bus.on('library', () => renderLayers());
  bus.on('panels', () => { if (propsOpen() && propsDirty) renderProps(); renderCtx(); });
  bus.on('doc', (o) => {
    syncProps();
    syncCtx();
    if (!o || !o.live) renderLayers();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && closePop()) { e.preventDefault(); e.stopPropagation(); } }, true);
  void toast; void W; void H;
}
