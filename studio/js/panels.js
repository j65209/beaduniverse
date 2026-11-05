/* =========================================================================
   패널 — 레이어 목록(왼쪽) · 속성(오른쪽)
   속성 패널은 선택이 바뀔 때만 다시 만들고, 드래그 중엔 값만 갱신한다.
   ========================================================================= */
import {
  W, H, state, bus, curPage, findLayer, selLayers, setSel, h, $, clamp, normHex, toast, assets,
  changed, savePrefs, MOD, ALT, layerLabel, debounce, modKey,
} from './core.js';
import { FONT_CATS, allFonts, fontEntry, fontName, weightsOf, nearestWeight, WEIGHT_NAMES, previewFont, addFontFiles, removeCustomFont } from './fonts.js';
import { layoutText } from './render.js';
import { PLACEMENTS, CTA_OPTIONS } from './overlay.js';
import { SWATCHES, BRANDS } from './templates.js';
import * as act from './actions.js';
import { enterCrop, exitCrop } from './editor.js';

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
let bindings = [];
let builtSig = '';
const R1 = (v) => Math.round(v * 10) / 10;

function bind(el, sync) { bindings.push({ el, sync }); sync(); }

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
function section(title, kids, { right, cls, open = true, key } = {}) {
  const body = h('div', { class: 'ps-b' }, kids);
  const st = key ? (sectionOpen[key] ?? open) : true;
  const head = h('div', { class: 'ps-h' + (key ? ' fold' : '') }, key ? h('span', { class: 'chev' }, '▾') : null, h('span', { class: 'ps-t' }, title), right || null);
  const sec = h('section', { class: 'ps ' + (cls || '') + (st ? '' : ' closed') }, head, body);
  if (key) head.addEventListener('click', (e) => { if (e.target.closest('.switch,button,input')) return; sectionOpen[key] = sec.classList.toggle('closed') ? false : true; });
  return sec;
}
const sectionOpen = {}; // 사용자가 직접 접거나 편 섹션만 기억

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

function structSig() {
  const Ls = selLayers();
  const parts = [state.pageId, state.cropId || '', state.linkEdit ? 1 : 0, Ls.length];
  for (const L of Ls) {
    parts.push(L.id, L.type, L.locked ? 1 : 0);
    if (L.type === 'text') parts.push(L.autoW ? 1 : 0, L.bg.mode, L.stroke.on ? 1 : 0, L.shadow.on ? 1 : 0, L.fit && L.fit.on ? 1 : 0, L.font);
    if (L.type === 'image') parts.push(L.fit, L.shadow.on ? 1 : 0, L.stroke.on ? 1 : 0, L.asset || '', L.checkSafe ? 1 : 0);
    if (L.type === 'shape') parts.push(L.shape, L.fill.type, L.stroke.on ? 1 : 0, L.checkSafe ? 1 : 0);
  }
  if (!Ls.length) { const s = state.project.settings; parts.push(s.showUI ? 1 : 0, s.avatar || '', state.project.pages.length); }
  return parts.join('|');
}

export function renderProps() {
  const el = propsEl();
  if (!el || !state.project) return;
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
  if (structSig() !== builtSig) { renderProps(); return; }
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
  el.append(h('div', { class: 'props-head' }, h('div', { class: 'ph-t' }, '페이지'), h('div', { class: 'ph-s' }, '요소를 선택하면 여기서 편집해요')));
  el.append(section('페이지', [
    field('이름', textInput({ get: () => curPage().name, set: (v, live) => { curPage().name = v; if (!live) { changed(); bus.emit('pages'); } } })),
    field('배경색', colorCtl({ get: () => curPage().bg, set: (v, live) => act.setPageBg(v, { live }), swatches: true })),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => act.applyBgToAll() }, '이 배경색을 모든 페이지에'),
  ]));
  void pg;
  el.append(section('지면 시뮬레이션', [
    field('지면', selectCtl(PLACEMENTS.map((p) => ({ v: p.id, label: p.name })), { get: () => st.placement, set: (v) => setSetting('placement', v) })),
    field('UI 가림', toggle({ get: () => st.showUI, set: (v) => setSetting('showUI', v), label: '프로필·CTA 등 표시' })),
    field('불투명도', rangeNum({ get: () => st.uiOpacity, set: (v, live) => setSetting('uiOpacity', clamp(v, 0.1, 1), live), min: 10, max: 100, step: 5, unit: '%', mult: 100 })),
    field('안전영역', toggle({ get: () => st.showSafe, set: (v) => setSetting('showSafe', v), label: '가림 영역 빗금 표시' })),
    h('p', { class: 'hint' }, '시뮬레이션은 편집 화면에만 보이고, 저장하는 이미지에는 들어가지 않아요.'),
  ]));
  const brandChips = h('div', { class: 'chips' }, BRANDS.map((b) => h('button', {
    type: 'button', class: 'chip', style: { '--c': b.color },
    onclick: () => { st.account = b.account; st.avatarColor = b.color; changed(); renderProps(); },
  }, h('i', { class: 'dot', style: { background: b.color } }), b.name)));
  const avatarCtl = h('div', { class: 'avatar-ctl' },
    h('div', { class: 'avatar-prev', style: st.avatar && assets.get(st.avatar) ? { backgroundImage: `url(${assets.get(st.avatar).url})` } : { background: st.avatarColor } }),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => pickFile('image/*', false, async (files) => {
      const ids = await act.importFiles(files);
      if (ids[0]) { st.avatar = ids[0]; changed(); renderProps(); }
    }) }, '프로필 사진'),
    st.avatar ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { st.avatar = null; changed(); renderProps(); } }, '지우기') : null);
  el.append(section('광고 미리보기 정보', [
    h('div', { class: 'f-l' }, '브랜드 빠른 선택'), brandChips,
    field('계정 이름', textInput({ get: () => st.account, set: (v, live) => setSetting('account', v, live), placeholder: 'brightbeed' })),
    field('프로필', avatarCtl),
    field('CTA 버튼', selectCtl(CTA_OPTIONS.map((c) => ({ v: c, label: c })), { get: () => st.cta, set: (v) => setSetting('cta', v) })),
    field('캡션', textInput({ get: () => st.caption, set: (v, live) => setSetting('caption', v, live), placeholder: '광고 문구 미리보기', maxlength: 120 })),
  ]));
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
    h('div', { class: 'ph-s' }, typeName + (single && L.locked ? ' · 잠김' : '')));
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

function alignSection(Ls) {
  const btn = (ic, mode, title) => h('button', { type: 'button', class: 'ib', title, onclick: () => act.align(mode) }, icon(ic, 18));
  const multi = Ls.length > 1;
  const refOpts = [{ v: 'auto', label: multi ? '자동 (선택 영역)' : '자동 (캔버스)' }, { v: 'selection', label: '선택 영역' }, { v: 'page', label: '캔버스' }, { v: 'safe', label: '안전영역' }];
  const kids = [
    h('div', { class: 'ib-row' },
      btn('alignL', 'left', `왼쪽 맞춤 (${ALT}+A)`), btn('alignC', 'hcenter', `가로 가운데 (${ALT}+H)`), btn('alignR', 'right', `오른쪽 맞춤 (${ALT}+D)`),
      h('span', { class: 'ib-sep' }),
      btn('alignT', 'top', `위 맞춤 (${ALT}+W)`), btn('alignM', 'vmiddle', `세로 가운데 (${ALT}+V)`), btn('alignB', 'bottom', `아래 맞춤 (${ALT}+S)`)),
    row2(
      mini('기준', selectCtl(refOpts, { get: () => state.prefs.alignRef, set: (v) => { state.prefs.alignRef = v; savePrefs(); } })),
      mini('', toggle({ get: () => state.prefs.alignText, set: (v) => { state.prefs.alignText = v; savePrefs(); }, label: '글자 줄 정렬도 같이' }))),
  ];
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
  return section('정렬', kids, { cls: 'ps-align' });
}

function geomSection(Ls) {
  const L = Ls[0];
  if (Ls.length > 1) {
    return section('투명도', [field('불투명도', rangeNum({ get: () => selLayers()[0].opacity, set: lset('opacity'), min: 0, max: 100, step: 1, unit: '%', mult: 100 }))]);
  }
  const isText = L.type === 'text';
  return section('위치 · 크기', [
    row2(mini('X', numInput({ get: lget('x'), set: lset('x') })), mini('Y', numInput({ get: lget('y'), set: lset('y') }))),
    row2(mini('W', numInput({ get: lget('w'), set: lset('w'), min: 1, title: isText ? '숫자를 넣으면 고정 너비가 돼요' : '' })),
      mini('H', numInput({ get: lget('h'), set: lset('h'), min: 1, disabled: isText, title: isText ? '텍스트 높이는 글자에 맞춰 자동' : '' }))),
    row2(mini('회전', numInput({ get: lget('rot'), set: (v, live) => lset('rot')(((v + 180) % 360 + 360) % 360 - 180, live), min: -360, max: 360, unit: '°' })),
      mini('투명도', numInput({ get: () => (selLayers()[0].opacity ?? 1) * 100, set: (v, live) => lset('opacity')(clamp(v, 0, 100) / 100, live), min: 0, max: 100, unit: '%' }))),
  ]);
}

/* ---------- 폰트 고르기 ---------- */
let openPop = null;
function closePop() {
  if (!openPop) return false;
  openPop.remove();
  openPop = null;
  document.removeEventListener('pointerdown', popOutside, true);
  return true;
}
function popOutside(e) { if (openPop && !openPop.contains(e.target) && !e.target.closest('.font-btn')) closePop(); }
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
  kids.push(field('줄 정렬', seg([{ v: 'left', icon: 'tL', title: '왼쪽' }, { v: 'center', icon: 'tC', title: '가운데' }, { v: 'right', icon: 'tR', title: '오른쪽' }], { get: lget('align'), set: lset('align', 'text') })));
  kids.push(field('줄 간격', rangeNum({ get: lget('lh'), set: lset('lh', 'text'), min: 70, max: 250, step: 1, unit: '%', mult: 100 })));
  kids.push(field('자간', rangeNum({ get: lget('tracking'), set: lset('tracking', 'text'), min: -15, max: 60, step: 0.5, unit: '%' })));
  el.append(section('텍스트', kids));

  // 박스 너비
  const autoW = L.autoW;
  const boxKids = [
    field('너비', seg([{ v: true, label: '글자에 맞춤' }, { v: false, label: '고정 너비' }], { get: lget('autoW'), set: lset('autoW', 'text'), small: true })),
  ];
  if (!autoW) {
    boxKids.push(field('고정 너비', numInput({ get: lget('w'), set: lset('w', 'text'), min: 20, max: 4000, unit: 'px' })));
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
    boxKids.push(h('p', { class: 'hint' }, '대량 제작할 때 문구 길이가 달라도 같은 폭 안에서 줄바꿈돼요.'));
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
    row2(
      mini('모서리', numInput({ get: lget('radius'), set: lset('radius', 'image'), min: 0, max: 1000, unit: 'px' })),
      mini('좌우 반전', toggle({ get: lget('flipX'), set: lset('flipX', 'image') }))),
  ];
  el.append(section('이미지', kids));
  el.append(section('색 보정', [
    field('밝기', rangeNum({ get: lget('adj.b'), set: lset('adj.b', 'image'), min: 30, max: 200, unit: '%' })),
    field('대비', rangeNum({ get: lget('adj.c'), set: lset('adj.c', 'image'), min: 30, max: 200, unit: '%' })),
    field('채도', rangeNum({ get: lget('adj.s'), set: lset('adj.s', 'image'), min: 0, max: 200, unit: '%' })),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => act.setProps([L.id], { adj: { b: 100, c: 100, s: 100 } }) }, '원래대로'),
  ], { key: 'adj', open: false }));
  const stKids = L.stroke.on ? [field('색', colorCtl({ get: lget('stroke.color'), set: lset('stroke.color', 'image') })), field('두께', rangeNum({ get: lget('stroke.width'), set: lset('stroke.width', 'image'), min: 1, max: 60, unit: 'px' }))] : [];
  el.append(section('테두리', stKids, { key: 'stroke', right: toggle({ get: lget('stroke.on'), set: lset('stroke.on', 'image') }), open: L.stroke.on }));
  el.append(section('그림자', shadowKids(L, 'image'), { key: 'shadow', right: toggle({ get: lget('shadow.on'), set: lset('shadow.on', 'image') }), open: L.shadow.on }));
  el.append(section('검사', [field('안전영역', toggle({ get: () => !!lget('checkSafe')(), set: lset('checkSafe'), label: '로고·제품도 가림 검사' }))]));
}
function rangeOnly({ get, set }) {
  const r = h('input', { type: 'range', class: 'rng', min: 0, max: 100, step: 1 });
  r.addEventListener('input', () => set(+r.value / 100, true));
  r.addEventListener('change', () => set(+r.value / 100, false));
  bind(r, () => { r.value = (get() ?? 0.5) * 100; });
  return r;
}

/* ---------- 도형 ---------- */
function shapeSections(el, L) {
  const kids = [
    field('모양', seg([{ v: 'rect', label: '사각형' }, { v: 'ellipse', label: '원' }], { get: lget('shape'), set: lset('shape', 'shape'), small: true })),
    field('채우기', seg([{ v: 'solid', label: '단색' }, { v: 'linear', label: '그라데이션' }], { get: lget('fill.type'), set: lset('fill.type', 'shape'), small: true })),
    field(L.fill.type === 'linear' ? '시작 색' : '색', colorCtl({ get: lget('fill.color'), set: lset('fill.color', 'shape'), swatches: true })),
    field(L.fill.type === 'linear' ? '시작 진하기' : '불투명도', rangeNum({ get: lget('fill.alpha'), set: lset('fill.alpha', 'shape'), min: 0, max: 100, unit: '%', mult: 100 })),
  ];
  if (L.fill.type === 'linear') {
    kids.push(field('끝 색', colorCtl({ get: lget('fill.color2'), set: lset('fill.color2', 'shape') })));
    kids.push(field('끝 진하기', rangeNum({ get: lget('fill.alpha2'), set: lset('fill.alpha2', 'shape'), min: 0, max: 100, unit: '%', mult: 100 })));
    kids.push(field('방향', seg([{ v: 180, label: '↓' }, { v: 0, label: '↑' }, { v: 90, label: '→' }, { v: 270, label: '←' }, { v: 135, label: '↘' }], { get: lget('fill.angle'), set: lset('fill.angle', 'shape'), small: true })));
  }
  if (L.shape !== 'ellipse') kids.push(field('모서리', rangeNum({ get: () => Math.min(500, lget('radius')() || 0), set: lset('radius', 'shape'), min: 0, max: 500, unit: 'px' })));
  el.append(section('도형', kids));
  const stKids = L.stroke.on ? [field('색', colorCtl({ get: lget('stroke.color'), set: lset('stroke.color', 'shape') })), field('두께', rangeNum({ get: lget('stroke.width'), set: lset('stroke.width', 'shape'), min: 1, max: 60, unit: 'px' }))] : [];
  el.append(section('테두리', stKids, { key: 'stroke', right: toggle({ get: lget('stroke.on'), set: lset('stroke.on', 'shape') }), open: L.stroke.on }));
  el.append(section('검사', [field('안전영역', toggle({ get: () => !!lget('checkSafe')(), set: lset('checkSafe'), label: '이 도형도 가림 검사' }))]));
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
  ]);
}

function buildLayerPanel(el, Ls) {
  el.append(header(Ls));
  el.append(alignSection(Ls));
  el.append(geomSection(Ls));
  const types = new Set(Ls.map((l) => l.type));
  if (types.size === 1) {
    const t = Ls[0].type;
    if (t === 'text') textSections(el, Ls);
    else if (Ls.length === 1 && t === 'image') imageSections(el, Ls[0]);
    else if (Ls.length === 1 && t === 'shape') shapeSections(el, Ls[0]);
  }
  el.append(layerOpsSection(Ls));
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
    const row = h('div', {
      class: 'lr' + (sel.has(L.id) ? ' on' : '') + (L.hidden ? ' hid' : '') + (L.locked ? ' locked' : ''),
      draggable: 'true', dataset: { id: L.id },
    },
    thumb,
    h('span', { class: 'lr-name', title: layerLabel(L) }, layerLabel(L)),
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
  bus.on('sel', () => { renderProps(); renderLayers(); });
  bus.on('page', () => { renderProps(); renderLayers(); });
  bus.on('restored', () => { renderProps(); renderLayers(); });
  bus.on('link-edit', () => renderLayers());
  bus.on('fonts-list', () => renderProps());
  bus.on('crop', () => renderProps());
  bus.on('asset-ready', () => renderLayers());
  bus.on('library', () => renderLayers());
  bus.on('doc', (o) => {
    syncProps();
    if (!o || !o.live) renderLayers();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && closePop()) { e.preventDefault(); e.stopPropagation(); } }, true);
  void toast; void W; void H;
}
