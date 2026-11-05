/* =========================================================================
   화면 구성 — 상단 바 · 왼쪽 탭(추가/레이어/템플릿) · 캔버스 바 · 상태 줄
   · 단축키 · 복사/붙여넣기 · 사진 드롭 · 프로젝트 관리 · 미리보기
   ========================================================================= */
import {
  state, bus, curPage, selLayers, setSel, h, $, $$, toast, history, changed, db, setMeta, savePrefs,
  newProject, newPage, deepClone, uid, assets, collectAssetIds, fmtTime, debounce, modKey, MOD, ALT,
  layerLabel, DEFAULT_SETTINGS, TEXT_DEFAULTS, IMAGE_DEFAULTS, SHAPE_DEFAULTS, isPlainObj,
  AD_PREVIEW,
} from './core.js';
import { drawThumb } from './render.js';
import { PLACEMENTS } from './overlay.js';
import { TEMPLATES, TEMPLATE_CATS, TEXT_PRESETS, SHAPE_PRESETS } from './templates.js';
import * as act from './actions.js';
import { fitView, zoomTo, startTextEdit, finishTextEdit, enterCrop, exitCrop, setSpace, currentViolations } from './editor.js';
import { pickFile } from './panels.js';
import { openBulk } from './bulk.js';
import { exportPages, exportProjectFile, readProjectFile } from './exporter.js';
import { openModal, confirmBox, choiceBox, openMenu, closeMenu, topModal } from './modal.js';
import { addFontFiles } from './fonts.js';

/* ---------- 저장 ---------- */
let saving = false, saveAgain = false;
function setSaveStatus(s) {
  const el = $('#saveStatus');
  if (!el) return;
  el.dataset.s = s;
  el.textContent = s === 'saving' ? '저장 중…' : s === 'error' ? '⚠ 저장 실패' : s === 'dirty' ? '변경됨' : (db.ok ? `저장됨 · ${fmtTime(state.project.updatedAt)}` : '⚠ 이 브라우저는 저장 불가 (시크릿 창?)');
}
function projectThumb() {
  try { const c = document.createElement('canvas'); drawThumb(c, state.project.pages[0], 90); return c.toDataURL('image/jpeg', 0.72); } catch (e) { return null; }
}
export async function saveNow() {
  const p = state.project;
  if (!p) return;
  if (saving) { saveAgain = true; return; }
  saving = true;
  setSaveStatus('saving');
  try {
    p.updatedAt = Date.now();
    p.thumb = projectThumb();
    await db.put('projects', p);
    await setMeta('lastProject', p.id);
    setSaveStatus('saved');
  } catch (e) {
    console.error(e);
    setSaveStatus('error');
    toast('저장 실패: ' + (e.message || e), 'err', 5000);
  }
  saving = false;
  if (saveAgain) { saveAgain = false; saveNow(); }
}
const saveSoon = debounce(saveNow, 800);

/* ---------- 프로젝트 ---------- */
function fillDefaults(L) {
  const D = L.type === 'text' ? TEXT_DEFAULTS : L.type === 'image' ? IMAGE_DEFAULTS : SHAPE_DEFAULTS;
  for (const [k, v] of Object.entries(D)) {
    if (L[k] === undefined) L[k] = deepClone(v);
    else if (isPlainObj(v) && isPlainObj(L[k])) for (const [k2, v2] of Object.entries(v)) if (L[k][k2] === undefined) L[k][k2] = v2;
  }
  if (!L.key) L.key = L.id;
  for (const k of ['x', 'y', 'w', 'h', 'rot']) if (typeof L[k] !== 'number' || Number.isNaN(L[k])) L[k] = 0;
  if (L.opacity == null) L.opacity = 1;
}
function migrate(p) {
  p.settings = Object.assign(deepClone(DEFAULT_SETTINGS), p.settings || {}, AD_PREVIEW); // 광고 계정 정보는 늘 고정값
  if (!Array.isArray(p.pages) || !p.pages.length) p.pages = [newPage('페이지 1')];
  p.library = p.library || [];
  if (p.bulk && p.bulk.rows) p.bulk = {};
  for (const pg of p.pages) {
    pg.layers = pg.layers || [];
    pg.bg = pg.bg || '#ffffff';
    for (const L of pg.layers) fillDefaults(L);
  }
  return p;
}
export async function openProject(proj) {
  finishTextEdit(true);
  exitCrop(true);
  closeMenu();
  migrate(proj);
  state.project = proj;
  state.pageId = proj.pages[0].id;
  state.sel = [];
  state.pageSel = [];
  state.linkEdit = false;
  if (state.preview) togglePreview(false);
  await assets.loadMany([...collectAssetIds({ pages: [proj.pages[0]], settings: proj.settings })]);
  assets.loadMany([...collectAssetIds(proj)]);
  history.reset();
  $('#projName').value = proj.name;
  bus.emit('project');
  bus.emit('page');
  bus.emit('pages');
  bus.emit('sel');
  bus.emit('doc', { history: false, save: false });
  fitView();
  setSaveStatus('saved');
  setMeta('lastProject', proj.id);
  const empty = proj.pages.length === 1 && !proj.pages[0].layers.length;
  switchTab(empty ? 'templates' : (state.prefs.leftTab === 'templates' ? 'add' : state.prefs.leftTab || 'add'));
}
async function newProjectFlow() {
  await saveNow();
  const p = newProject(`광고 ${new Date().getMonth() + 1}/${new Date().getDate()}`);
  await openProject(p);
  await saveNow();
  toast('새 프로젝트를 만들었어요', 'ok', 1600);
}
async function duplicateProject(src = state.project) {
  await saveNow();
  const c = deepClone(src);
  c.id = uid('pr');
  c.name = src.name + ' 사본';
  c.createdAt = Date.now();
  await db.put('projects', c);
  return c;
}
async function openProjectsModal() {
  await saveNow();
  const list = (await db.all('projects')).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const grid = h('div', { class: 'proj-grid' });
  let m;
  const card = (p) => h('div', { class: 'proj' + (p.id === state.project.id ? ' cur' : '') },
    h('div', { class: 'proj-th', onclick: async () => { m.close(); if (p.id !== state.project.id) await openProject(await db.get('projects', p.id)); } },
      p.thumb ? h('img', { src: p.thumb, alt: '' }) : h('span', null, '미리보기 없음')),
    h('div', { class: 'proj-name', title: p.name }, p.name),
    h('div', { class: 'proj-meta' }, `${(p.pages || []).length}페이지 · ${fmtTime(p.updatedAt || p.createdAt)}`),
    h('div', { class: 'proj-acts' },
      h('button', { type: 'button', class: 'btn btn-ghost btn-xs', onclick: async () => { m.close(); if (p.id !== state.project.id) await openProject(await db.get('projects', p.id)); } }, p.id === state.project.id ? '열려 있음' : '열기'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-xs', onclick: async () => { const c = await duplicateProject(p.id === state.project.id ? state.project : await db.get('projects', p.id)); m.close(); await openProject(c); toast('복제해서 열었어요', 'ok'); } }, '복제'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-xs danger', onclick: async () => {
        if (!(await confirmBox('프로젝트 삭제', `「${p.name}」을(를) 지울까요? 되돌릴 수 없어요.`, { ok: '삭제', danger: true }))) return;
        await db.del('projects', p.id);
        m.close();
        if (p.id === state.project.id) {
          const rest = (await db.all('projects')).sort((a, b) => b.updatedAt - a.updatedAt);
          await openProject(rest[0] || newProject('새 광고 프로젝트'));
          await saveNow();
        }
        openProjectsModal();
      } }, '삭제')));
  for (const p of list) grid.append(card(p));
  if (!list.length) grid.append(h('div', { class: 'empty' }, '저장된 프로젝트가 없어요'));
  m = openModal({
    title: '내 프로젝트', cls: 'modal-lg',
    body: [
      h('div', { class: 'proj-top' },
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => { m.close(); newProjectFlow(); } }, '＋ 새 프로젝트'),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { m.close(); importProjectFlow(); } }, '파일 불러오기'),
        h('span', { class: 'hint' }, '프로젝트는 이 브라우저에 자동 저장돼요. 다른 PC로 옮길 땐 「내보내기 → 프로젝트 파일」')),
      grid,
    ],
  });
}
function importProjectFlow() {
  pickFile('.bbstudio,.json,application/json', false, async (files) => {
    try {
      const proj = await readProjectFile(files[0]);
      proj.id = uid('pr');
      proj.name = proj.name || '불러온 프로젝트';
      await db.put('projects', proj);
      await openProject(proj);
      toast(`「${proj.name}」을(를) 불러왔어요`, 'ok');
    } catch (e) { toast('불러오기 실패: ' + (e.message || e), 'err', 4500); }
  });
}

/* ---------- 상단 바 ---------- */
function updateUndo() {
  $('#undoBtn').disabled = !history.canUndo;
  $('#redoBtn').disabled = !history.canRedo;
}
function undo() { finishTextEdit(); exitCrop(true); if (!history.undo()) toast('더 되돌릴 게 없어요', 'info', 1200); }
function redo() { finishTextEdit(); exitCrop(true); if (!history.redo()) toast('다시 할 게 없어요', 'info', 1200); }

function openExportMenu(anchor) {
  const p = state.project;
  const n = p.pages.length;
  const sel = state.pageSel.length;
  const fmt = h('div', { class: 'menu-fmt' }, ['jpg', 'png'].map((f) => h('button', {
    type: 'button', class: 'chip' + (state.prefs.exportFmt === f ? ' on' : ''),
    onclick: (e) => { state.prefs.exportFmt = f; savePrefs(); fmt.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget)); },
  }, f === 'jpg' ? 'JPG · 가벼움' : 'PNG · 가장 선명')));
  openMenu(0, 0, [
    { node: h('div', { class: 'menu-head' }, '1080 × 1920 · 메타 릴스/스토리 권장') },
    { node: fmt },
    '-',
    { label: '지금 페이지 저장', hint: `${MOD}+E`, onClick: () => exportPages([curPage()]) },
    sel > 1 ? { label: `고른 ${sel}페이지 → ZIP`, onClick: () => exportPages(p.pages.filter((x) => state.pageSel.includes(x.id))) } : null,
    n > 1 ? { label: `전체 ${n}페이지 → ZIP`, onClick: () => exportPages(p.pages) } : null,
    '-',
    { label: '프로젝트 파일로 저장', onClick: () => exportProjectFile(collectAssetIds, (s, k) => db.get(s, k)) },
  ], { anchor });
}
function openProjectMenu(anchor) {
  openMenu(0, 0, [
    { label: '내 프로젝트 목록', onClick: openProjectsModal },
    { label: '새 프로젝트', onClick: newProjectFlow },
    { label: '이 프로젝트 복제', onClick: async () => { const c = await duplicateProject(); await openProject(c); toast('복제해서 열었어요', 'ok'); } },
    '-',
    { label: '프로젝트 파일 불러오기', onClick: importProjectFlow },
    { label: '프로젝트 파일로 저장', onClick: () => exportProjectFile(collectAssetIds, (s, k) => db.get(s, k)) },
  ], { anchor });
}

function initTopbar() {
  $('#projName').addEventListener('change', (e) => { state.project.name = e.target.value.trim() || '이름없는 프로젝트'; changed(); });
  $('#projName').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); });
  $('#projMenuBtn').addEventListener('click', (e) => openProjectMenu(e.currentTarget));
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#previewBtn').addEventListener('click', () => togglePreview());
  $('#bulkBtnTop').addEventListener('click', () => openBulk());
  $('#exportBtn').addEventListener('click', (e) => openExportMenu(e.currentTarget));
  $('#helpBtn').addEventListener('click', openHelp);
  bus.on('history', updateUndo);
  bus.on('save-request', () => { setSaveStatus('dirty'); saveSoon(); });
  window.addEventListener('pagehide', () => saveSoon.flush());
  window.addEventListener('beforeunload', () => saveSoon.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveSoon.flush(); });
}

/* ---------- 왼쪽 탭 ---------- */
function switchTab(t) {
  state.prefs.leftTab = t;
  savePrefs();
  $$('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  $$('.tab-pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + t));
  if (t === 'templates') buildTemplates();
}
function presetSample(pr) {
  const p = Object.assign({}, TEXT_DEFAULTS, pr.props);
  const st = {
    fontFamily: `"${p.font}", Pretendard, sans-serif`, fontWeight: p.weight, color: p.color,
    letterSpacing: (p.tracking || 0) / 100 + 'em',
  };
  if (p.hollow && p.hollow.on) { st.color = 'transparent'; st.webkitTextStroke = `1px ${p.color}`; }
  else if (p.grad && p.grad.on) { st.backgroundImage = `linear-gradient(180deg, ${p.grad.color2}, ${p.color} 50%, ${p.grad.color2})`; st.webkitBackgroundClip = 'text'; st.backgroundClip = 'text'; st.color = 'transparent'; }
  if (p.stroke && p.stroke.on) { const c = p.stroke.color; st.textShadow = `-1px -1px 0 ${c}, 1px -1px 0 ${c}, -1px 1px 0 ${c}, 1px 1px 0 ${c}, 0 2px 0 ${c}`; }
  else if (p.shadow && p.shadow.on) st.textShadow = (p.shadow.color || '#000000').toLowerCase() !== '#000000' ? `0 0 6px ${p.shadow.color}, 0 0 12px ${p.shadow.color}` : '0 2px 8px rgba(0,0,0,.4)';
  if (p.strike) st.textDecoration = 'line-through';
  let inner = h('span', { class: 'tp-t', style: st }, pr.label);
  if (p.bg && p.bg.mode !== 'none') {
    const bgs = { background: p.bg.color, borderRadius: Math.min(p.bg.radius, 30) / 3 + 'px', padding: '1px 7px', boxDecorationBreak: 'clone', webkitBoxDecorationBreak: 'clone' };
    inner = h('span', { class: 'tp-t', style: Object.assign(st, bgs) }, pr.label);
  }
  return inner;
}
function buildAddPane() {
  const pane = $('#pane-add');
  pane.innerHTML = '';
  pane.append(h('div', { class: 'pane-h' }, '텍스트', h('span', { class: 'pane-k' }, 'T')),
    h('div', { class: 'tp-grid' }, TEXT_PRESETS.map((pr) => h('button', { type: 'button', class: 'tp tp-' + pr.id, title: `${pr.label} 추가`, onclick: () => act.addText(pr) }, presetSample(pr)))));
  const lib = h('div', { class: 'lib' });
  const renderLib = () => {
    lib.innerHTML = '';
    const ids = (state.project && state.project.library) || [];
    if (!ids.length) { lib.append(h('div', { class: 'lib-empty' }, '올린 사진이 여기 모여요.\n끌어서 캔버스에 놓을 수 있어요.')); return; }
    for (const id of ids) {
      const a = assets.get(id);
      if (!a) { assets.load(id); continue; }
      if (a.status === 'missing' || a.status === 'error') continue;
      const it = h('div', { class: 'lib-it', draggable: 'true', title: `${a.name || '이미지'}\n클릭: 추가 (이미지를 선택한 상태면 교체) · 끌기: 원하는 곳에`, style: a.url ? { backgroundImage: `url(${a.url})` } : null },
        h('button', { type: 'button', class: 'lib-x', title: '목록에서 빼기', onclick: (e) => { e.stopPropagation(); state.project.library = state.project.library.filter((x) => x !== id); changed({ history: false }); renderLib(); } }, '×'));
      it.addEventListener('click', () => {
        const s = selLayers();
        if (s.length === 1 && s[0].type === 'image') act.replaceImage(s[0].id, id);
        else act.addImageAsset(id);
      });
      it.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-bb-asset', id); e.dataTransfer.effectAllowed = 'copy'; });
      lib.append(it);
    }
  };
  bus.on('library', renderLib);
  bus.on('asset-ready', debounce(renderLib, 150));
  bus.on('project', renderLib);
  pane.append(h('div', { class: 'pane-h' }, '사진', h('span', { class: 'pane-k' }, 'I')),
    h('button', { type: 'button', class: 'btn btn-primary btn-sm full', onclick: () => pickFile('image/*', true, (files) => handleImages(files, {})) }, '＋ 사진 올리기 (여러 장 가능)'),
    h('p', { class: 'hint' }, '캔버스로 바로 끌어다 놓아도 돼요. 여러 장이면 페이지로 나눠 드려요.'),
    lib);
  pane.append(h('div', { class: 'pane-h' }, '도형 · 오버레이'),
    h('div', { class: 'sp-grid' }, SHAPE_PRESETS.map((sp) => h('button', { type: 'button', class: 'sp', title: sp.label, onclick: () => act.addShape(sp) },
      h('span', { class: 'sp-i sp-' + sp.id }), h('span', { class: 'sp-l' }, sp.label)))));
  pane.append(h('div', { class: 'pane-h' }, '브랜드 폰트'),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm full', onclick: () => pickFile('.ttf,.otf,.woff,.woff2', true, (files) => addFontFiles(files)) }, '＋ 내 폰트 올리기 (TTF · OTF · WOFF)'),
    h('p', { class: 'hint' }, '올린 폰트는 이 브라우저에 저장되고, 글꼴 목록 「내 폰트」에 나와요. 파일명이 「이름-Bold」처럼 되어 있으면 굵기도 자동 인식해요.'));
  renderLib();
}
let tplBuilt = false;
/** 템플릿 갤러리 — 분류 칩 + 보이는 카드만 썸네일 그리기 (템플릿이 많아도 가볍게) */
function buildTemplates() {
  const pane = $('#pane-templates');
  if (tplBuilt) { // 글꼴이 늦게 받아지면 이미 그린 썸네일만 다시
    pane.querySelectorAll('canvas[data-tpl][data-drawn]').forEach((c) => { const t = TEMPLATES.find((x) => x.id === c.dataset.tpl); if (t && t._page) drawThumb(c, t._page, 120); });
    return;
  }
  tplBuilt = true;
  pane.innerHTML = '';
  let cat = TEMPLATE_CATS.some((c) => c.id === state.prefs.tplCat) ? state.prefs.tplCat : 'all';
  const chips = h('div', { class: 'chips chips-sm tpl-cats' });
  const grid = h('div', { class: 'tpl-grid' });
  const draw = (cv) => {
    const t = TEMPLATES.find((x) => x.id === cv.dataset.tpl);
    if (!t) return;
    if (!t._page) t._page = t.build();
    drawThumb(cv, t._page, 120);
    cv.dataset.drawn = '1';
  };
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((ents) => { for (const en of ents) if (en.isIntersecting) { io.unobserve(en.target); draw(en.target); } }, { root: pane, rootMargin: '400px 0px' })
    : null;
  const drawChips = () => {
    chips.innerHTML = '';
    for (const c of TEMPLATE_CATS) {
      const n = c.id === 'all' ? TEMPLATES.length : TEMPLATES.filter((t) => t.cat === c.id).length;
      chips.append(h('button', {
        type: 'button', class: 'chip' + (cat === c.id ? ' on' : ''),
        onclick: () => { cat = c.id; state.prefs.tplCat = cat; savePrefs(); drawChips(); drawGrid(); pane.scrollTop = 0; },
      }, c.name, h('span', { class: 'chip-n' }, String(n))));
    }
  };
  const drawGrid = () => {
    grid.innerHTML = '';
    if (cat === 'all') grid.append(h('button', { type: 'button', class: 'tpl', onclick: () => act.addPage() }, h('div', { class: 'tpl-th blank' }, '＋'), h('b', null, '빈 페이지'), h('span', null, '처음부터 직접')));
    for (const t of TEMPLATES) {
      if (cat !== 'all' && t.cat !== cat) continue;
      const cv = h('canvas', { dataset: { tpl: t.id } });
      grid.append(h('button', { type: 'button', class: 'tpl', title: `${t.name} — ${t.desc}`, onclick: () => act.insertTemplatePage(t.build()) },
        h('div', { class: 'tpl-th' }, cv), h('b', null, t.name), h('span', null, t.desc)));
      if (io) io.observe(cv); else draw(cv);
    }
  };
  pane.append(
    h('p', { class: 'hint pad' }, `템플릿 ${TEMPLATES.length}개 · 고르면 새 페이지로 들어가요. 사진 칸에 사진을 끌어다 놓으면 바뀌어요. 글자는 모두 안전영역 안에 있어요.`),
    chips, grid);
  drawChips();
  drawGrid();
  bus.on('fonts', debounce(() => { if (state.prefs.leftTab === 'templates') buildTemplates(); }, 300));
}
function initLeft() {
  $$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  buildAddPane();
}

/* ---------- 캔버스 바 · 상태 줄 ---------- */
function toggleSetting(k) {
  state.project.settings[k] = !state.project.settings[k];
  changed();
  toast(k === 'showUI' ? `UI 시뮬레이션 ${state.project.settings[k] ? '켬' : '끔'}` : `안전영역 ${state.project.settings[k] ? '켬' : '끔'}`, 'info', 1000);
}
function syncCanvasBar() {
  if (!state.project) return;
  const st = state.project.settings;
  $('#placementSel').value = st.placement;
  $('#uiToggle').classList.toggle('on', !!st.showUI);
  $('#safeToggle').classList.toggle('on', !!st.showSafe);
  const op = $('#uiOpacity');
  if (document.activeElement !== op) op.value = Math.round(st.uiOpacity * 100);
  op.disabled = !st.showUI;
  $('#zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
}
function initCanvasBar() {
  const sel = $('#placementSel');
  for (const p of PLACEMENTS) sel.append(h('option', { value: p.id }, p.name));
  sel.addEventListener('change', () => { state.project.settings.placement = sel.value; changed(); bus.emit('pages-dirty'); });
  $('#uiToggle').addEventListener('click', () => toggleSetting('showUI'));
  $('#safeToggle').addEventListener('click', () => toggleSetting('showSafe'));
  const op = $('#uiOpacity');
  op.addEventListener('input', () => { state.project.settings.uiOpacity = op.value / 100; changed({ history: false }); });
  op.addEventListener('change', () => changed());
  $('#zoomIn').addEventListener('click', () => zoomTo(state.zoom * 1.25));
  $('#zoomOut').addEventListener('click', () => zoomTo(state.zoom / 1.25));
  $('#zoomLabel').addEventListener('click', () => fitView());
  $('#zoomFit').addEventListener('click', () => fitView());
  bus.on('zoom', syncCanvasBar);
  bus.on('doc', syncCanvasBar);
  bus.on('project', syncCanvasBar);
  bus.on('violations', renderStatus);
  bus.on('sel', renderStatus);
  bus.on('link-edit', renderStatus);
}
function renderStatus() {
  const el = $('#statusBar');
  if (!el || !state.project) return;
  const v = currentViolations();
  const st = state.project.settings;
  el.innerHTML = '';
  if (!st.showSafe && !st.showUI) el.append(h('span', { class: 'st-muted' }, '안전영역 검사 꺼짐 (G 키로 켜기)'));
  else if (v.length) {
    el.append(h('button', { type: 'button', class: 'st-warn', title: '눌러서 선택', onclick: () => setSel(v) }, `⚠ ${v.length}개 요소가 UI에 가려져요 — 눌러서 선택`));
  } else el.append(h('span', { class: 'st-ok' }, '✓ 글자가 모두 안전영역 안에 있어요'));
  if (state.linkEdit) {
    el.append(h('button', {
      type: 'button', class: 'st-link', title: '켜져 있으면 위치·크기·스타일 수정이 다른 페이지의 같은 요소에도 똑같이 들어가요',
      onclick: () => { state.linkEdit = false; bus.emit('link-edit'); bus.emit('sel'); },
    }, '🔗 일괄 수정 켜짐 · 끄기'));
  }
  el.append(h('span', { class: 'spacer' }));
  el.append(h('span', { class: 'st-hint' }, `더블클릭 수정 · Shift 다중선택 · ${MOD} 스냅 끄기 · ? 단축키`));
}

/* ---------- 미리보기 ---------- */
function togglePreview(on = !state.preview) {
  if (on) { finishTextEdit(); exitCrop(true); }
  state.preview = on;
  document.body.classList.toggle('previewing', on);
  closeMenu();
  updatePreviewNav();
  requestAnimationFrame(() => requestAnimationFrame(() => fitView()));
}
function updatePreviewNav() {
  const nav = $('#previewNav');
  if (!nav || !state.project) return;
  const i = state.project.pages.findIndex((p) => p.id === state.pageId);
  $('#pvCount').textContent = `${i + 1} / ${state.project.pages.length}`;
}
function goPage(d) {
  const ps = state.project.pages;
  const i = ps.findIndex((p) => p.id === state.pageId);
  const n = ps[Math.max(0, Math.min(ps.length - 1, i + d))];
  if (n && n.id !== state.pageId) act.selectPage(n.id);
  updatePreviewNav();
}
function initPreview() {
  $('#pvPrev').addEventListener('click', () => goPage(-1));
  $('#pvNext').addEventListener('click', () => goPage(1));
  $('#pvClose').addEventListener('click', () => togglePreview(false));
  bus.on('page', updatePreviewNav);
}

/* ---------- 도움말 ---------- */
function openHelp() {
  const rows = [
    ['텍스트 추가', 'T'], ['사진 올리기', 'I'], ['텍스트 바로 수정', '더블클릭 / Enter'], ['이미지 위치·확대 조정', '더블클릭 (휠 = 확대)'],
    ['여러 개 선택', 'Shift+클릭 / 빈 곳 드래그'], ['전체 선택', `${MOD}+A`], ['복제', `${MOD}+D · ${ALT}+드래그`], ['복사 / 붙여넣기', `${MOD}+C / ${MOD}+V`],
    ['스타일 복사 / 붙여넣기 (글꼴·색·크기 맞추기)', `${ALT}+Shift+C / ${ALT}+Shift+V`],
    ['삭제', 'Delete'], ['1px / 10px 이동', '방향키 / Shift+방향키'], ['직선으로만 이동', '드래그 중 Shift'], ['스냅 잠시 끄기', `드래그 중 ${MOD}`],
    ['왼쪽 · 가로가운데 · 오른쪽 맞춤', `${ALT}+A · ${ALT}+H · ${ALT}+D`], ['위 · 세로가운데 · 아래 맞춤', `${ALT}+W · ${ALT}+V · ${ALT}+S`],
    ['앞으로 / 뒤로', `${MOD}+] / ${MOD}+[`], ['맨 앞 / 맨 뒤', `${MOD}+Shift+] / [`], ['되돌리기 / 다시', `${MOD}+Z / ${MOD}+Shift+Z`],
    ['UI 시뮬레이션 켜고 끄기', 'U'], ['안전영역 켜고 끄기', 'G'], ['미리보기 (실제처럼)', 'P'], ['페이지 넘기기', 'PageUp / PageDown'],
    ['확대 / 축소 / 화면 맞춤', `${MOD}+ + / ${MOD}+ - / ${MOD}+0`], ['화면 이동', 'Space+드래그 · 휠'], ['지금 페이지 저장', `${MOD}+E`],
  ];
  openModal({
    title: '단축키', cls: 'modal-md',
    body: h('div', { class: 'help' }, rows.map(([a, b]) => h('div', { class: 'help-r' }, h('span', null, a), h('kbd', null, b)))),
  });
}

/* ---------- 사진 넣기 ---------- */
async function handleImages(files, { at, assetId, alt } = {}) {
  const ids = assetId ? [assetId] : await act.importFiles(files || []);
  if (!ids.length) return;
  const page = curPage();
  if (ids.length === 1) {
    const target = at ? act.imageLayerAt(at) : null;
    if (target && !alt) { act.replaceImage(target.id, ids[0]); toast('이미지를 바꿨어요 (Alt 누르고 놓으면 새로 추가)', 'ok', 2200); return; }
    const s = selLayers();
    if (!at && s.length === 1 && s[0].type === 'image' && !s[0].asset) { act.replaceImage(s[0].id, ids[0]); return; }
    act.addImageAsset(ids[0], { at });
    return;
  }
  const slot = act.mainImageSlot(page, at);
  const opts = [];
  if (slot) opts.push({ v: 'pages', label: `페이지 ${ids.length}개 만들기`, desc: `지금 디자인 그대로, 「${layerLabel(slot)}」 사진만 바꿔서`, primary: true });
  opts.push({ v: 'bg', label: `새 페이지 ${ids.length}개 (사진을 배경으로)`, desc: '사진마다 페이지를 하나씩' + (page.layers.length ? '' : ' — 지금 빈 페이지부터 채워요'), primary: !slot });
  opts.push({ v: 'add', label: '이 페이지에 모두 넣기', desc: '겹쳐서 추가돼요' });
  const v = await choiceBox(`사진 ${ids.length}장`, '어떻게 넣을까요?', opts);
  if (v === 'pages') act.pagesFromImages(ids, slot.key);
  else if (v === 'bg') act.backgroundPages(ids);
  else if (v === 'add') ids.forEach((id, i) => act.addImageAsset(id, { at: at ? { x: at.x + i * 40, y: at.y + i * 40 } : null }));
}

/* ---------- 우클릭 메뉴 ---------- */
function layerMenu({ x, y }) {
  const Ls = selLayers();
  if (!Ls.length) {
    openMenu(x, y, [
      { label: '텍스트 추가', hint: 'T', onClick: () => act.addText(TEXT_PRESETS[0]) },
      { label: '사진 올리기', hint: 'I', onClick: () => pickFile('image/*', true, (files) => handleImages(files, {})) },
      { label: '붙여넣기', hint: `${MOD}+V`, disabled: !state.clipboard, onClick: () => act.pasteLayers() },
      { label: '전체 선택', hint: `${MOD}+A`, onClick: () => act.selectAll() },
    ]);
    return;
  }
  const L = Ls[0];
  const one = Ls.length === 1;
  openMenu(x, y, [
    one && L.type === 'text' ? { label: '텍스트 수정', hint: 'Enter', onClick: () => startTextEdit(L.id, true) } : null,
    one && L.type === 'image' ? { label: L.asset ? '이미지 바꾸기' : '이미지 넣기', onClick: () => bus.emit('pick-image', L.id) } : null,
    one && L.type === 'image' && L.asset ? { label: '위치·확대 조정', hint: '더블클릭', onClick: () => enterCrop(L.id) } : null,
    one && L.type === 'image' ? { label: '배경으로 꽉 채우기', onClick: () => act.fillBackground(L.id) } : null,
    { label: '복제', hint: `${MOD}+D`, onClick: () => act.duplicateSel() },
    { label: '복사', hint: `${MOD}+C`, onClick: () => act.copySel() },
    state.clipboard ? { label: '붙여넣기', hint: `${MOD}+V`, onClick: () => act.pasteLayers() } : null,
    { label: '스타일 복사', hint: `${ALT}+⇧+C`, onClick: () => act.copyStyle() },
    state.styleClip && state.styleClip.type === L.type ? { label: '스타일 붙여넣기', hint: `${ALT}+⇧+V`, onClick: () => act.pasteStyle() } : null,
    '-',
    { label: '맨 앞으로', hint: `${MOD}+⇧+]`, onClick: () => act.reorder('front') },
    { label: '맨 뒤로', hint: `${MOD}+⇧+[`, onClick: () => act.reorder('back') },
    state.project.pages.length > 1 ? { label: '모든 페이지에 복사', onClick: () => act.copyToAllPages() } : null,
    { label: L.locked ? '잠금 풀기' : '잠그기', onClick: () => Ls.forEach((l) => act.toggleLocked(l.id)) },
    { label: '숨기기', onClick: () => Ls.forEach((l) => act.toggleHidden(l.id)) },
    '-',
    { label: '삭제', hint: 'Del', danger: true, onClick: () => act.deleteSel() },
  ]);
}

/* ---------- 단축키 · 클립보드 ---------- */
const isTyping = (el) => !!(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) && !(el.tagName === 'INPUT' && /^(range|checkbox|radio|button|color)$/.test(el.type)));

function onKey(e) {
  if (!state.project) return;
  const m = modKey(e);
  if (isTyping(e.target)) {
    if (m && e.code === 'KeyS') { e.preventDefault(); saveSoon.flush(); }
    return;
  }
  const top = topModal();
  if (top) { if (e.key === 'Escape' && top.dismissable !== false) { e.preventDefault(); top.close(); } return; }
  if (e.key === 'Escape' && closeMenu()) return;
  const k = e.key, code = e.code;
  if (k === ' ') { e.preventDefault(); setSpace(true); return; }
  if (state.preview) {
    if (k === 'Escape' || code === 'KeyP') togglePreview(false);
    else if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(k)) goPage(1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(k)) goPage(-1);
    e.preventDefault();
    return;
  }
  if (!m && e.altKey && e.shiftKey && (code === 'KeyC' || code === 'KeyV')) { e.preventDefault(); if (code === 'KeyC') act.copyStyle(); else act.pasteStyle(); return; }
  if (m && code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (m && code === 'KeyY') { e.preventDefault(); redo(); return; }
  if (m && code === 'KeyS') { e.preventDefault(); saveSoon.flush(); toast('저장했어요', 'ok', 1000); return; }
  if (m && code === 'KeyE') { e.preventDefault(); exportPages([curPage()]); return; }
  if (m && code === 'KeyD') { e.preventDefault(); act.duplicateSel(); return; }
  if (m && code === 'KeyA') { e.preventDefault(); act.selectAll(); return; }
  if (m && (code === 'BracketRight' || code === 'BracketLeft')) {
    e.preventDefault();
    act.reorder(code === 'BracketRight' ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward'));
    return;
  }
  if (m && (k === '=' || k === '+')) { e.preventDefault(); zoomTo(state.zoom * 1.25); return; }
  if (m && k === '-') { e.preventDefault(); zoomTo(state.zoom / 1.25); return; }
  if (m && k === '0') { e.preventDefault(); fitView(); return; }
  if (m && k === '1') { e.preventDefault(); zoomTo(1); return; }
  if (e.altKey && !m) {
    const map = { KeyA: 'left', KeyH: 'hcenter', KeyD: 'right', KeyW: 'top', KeyV: 'vmiddle', KeyS: 'bottom' };
    if (map[code]) { e.preventDefault(); if (state.sel.length) act.align(map[code]); return; }
  }
  if (k === 'Delete' || k === 'Backspace') { if (state.sel.length) { e.preventDefault(); act.deleteSel(); } return; }
  if (k === 'Escape') {
    if (state.cropId) exitCrop();
    else if (state.sel.length) setSel([]);
    else if (state.pageSel.length) { state.pageSel = []; bus.emit('page-sel'); }
    return;
  }
  if (k === 'Enter') {
    const s = selLayers();
    if (s.length === 1 && s[0].type === 'text') { e.preventDefault(); startTextEdit(s[0].id, true); }
    else if (s.length === 1 && s[0].type === 'image' && s[0].asset) { e.preventDefault(); if (state.cropId) exitCrop(); else enterCrop(s[0].id); }
    return;
  }
  if (k.startsWith('Arrow')) {
    e.preventDefault();
    if (state.sel.length) {
      const d = e.shiftKey ? 10 : 1;
      act.nudge(k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0);
    }
    return;
  }
  if (k === 'PageDown') { e.preventDefault(); goPage(1); return; }
  if (k === 'PageUp') { e.preventDefault(); goPage(-1); return; }
  if (m || e.altKey) return;
  if (code === 'KeyT') { e.preventDefault(); act.addText(TEXT_PRESETS[0]); }
  else if (code === 'KeyI') { e.preventDefault(); pickFile('image/*', true, (files) => handleImages(files, {})); }
  else if (code === 'KeyU') toggleSetting('showUI');
  else if (code === 'KeyG') toggleSetting('showSafe');
  else if (code === 'KeyP') togglePreview(true);
  else if (k === '?' || (code === 'Slash' && e.shiftKey)) openHelp();
}

function initKeys() {
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', (e) => { if (e.key === ' ') setSpace(false); });
  window.addEventListener('blur', () => setSpace(false));
  document.addEventListener('copy', (e) => {
    if (isTyping(e.target) || topModal()) return;
    const s = window.getSelection && window.getSelection().toString();
    if (s) return;
    act.copySel(e);
  });
  document.addEventListener('cut', (e) => { if (isTyping(e.target) || topModal()) return; act.cutSel(e); });
  document.addEventListener('paste', (e) => {
    if (isTyping(e.target) || topModal() || !state.project) return;
    const dt = e.clipboardData;
    if (!dt) return;
    const files = [...dt.files].filter((f) => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); handleImages(files, {}); return; }
    const text = dt.getData('text/plain');
    const clip = act.readClipText(text);
    if (clip) { e.preventDefault(); act.pasteLayers(clip); return; }
    if (!text && state.clipboard) { e.preventDefault(); act.pasteLayers(); return; }
    if (text && text.trim()) {
      e.preventDefault();
      const pr = TEXT_PRESETS[1];
      act.addText({ props: Object.assign({}, pr.props, { text: text.trim().slice(0, 600) }) }, { edit: false });
      toast('붙여넣은 글자로 텍스트를 만들었어요', 'ok', 1400);
    }
  });
}

/* ---------- 시작 ---------- */
export function initUI() {
  initTopbar();
  initLeft();
  initCanvasBar();
  initPreview();
  initKeys();
  $('#addPageBtn').addEventListener('click', () => act.addPage());
  $('#dupPageBtn').addEventListener('click', () => act.duplicatePage());
  $('#bulkBtn').addEventListener('click', () => openBulk());
  $('#exportAllBtn').addEventListener('click', () => exportPages(state.pageSel.length > 1 ? state.project.pages.filter((p) => state.pageSel.includes(p.id)) : state.project.pages));
  const syncExportAll = () => { $('#exportAllBtn').textContent = state.pageSel.length > 1 ? `고른 ${state.pageSel.length}장 저장` : '전체 저장'; };
  bus.on('page-sel', syncExportAll);
  bus.on('pages', syncExportAll);
  bus.on('project', syncExportAll);
  bus.on('drop-images', ({ files, assetId, at, alt }) => handleImages(files, { at, assetId, alt }));
  bus.on('pick-image', (layerId) => pickFile('image/*', false, async (files) => {
    const ids = await act.importFiles(files);
    if (ids[0]) act.replaceImage(layerId, ids[0]);
  }));
  bus.on('context-menu', layerMenu);
  bus.on('export-pages', (ids) => exportPages(state.project.pages.filter((p) => ids.includes(p.id))));
  bus.on('restored', () => { bus.emit('doc', { history: false }); bus.emit('pages'); bus.emit('save-request'); updateUndo(); });
}
