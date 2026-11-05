/* =========================================================================
   페이지 스트립 (아래) — 썸네일 · 선택 · 순서 바꾸기 · 경고 표시
   ========================================================================= */
import { state, bus, h, debounce, MOD, curPage } from './core.js';
import { drawThumb } from './render.js';
import { findViolations } from './overlay.js';
import * as act from './actions.js';
import { icon } from './panels.js';
import { openMenu } from './modal.js';

const THUMB_W = 56;
const canvases = new Map();
let dragId = null;
let shownProj = null; // 스트립에 지금 그려진 프로젝트 (다르면 썸네일 새로 그림)

function pageItem(pg, i, prev) {
  const p = state.project;
  const cv = h('canvas', { class: 'pg-cv' });
  const v = findViolations(pg, p.settings.placement).length;
  const empty = pg.layers.some((l) => l.type === 'image' && !l.asset && !l.hidden);
  const item = h('div', {
    class: 'pg' + (pg.id === state.pageId ? ' cur' : '') + (state.pageSel.includes(pg.id) ? ' picked' : ''),
    draggable: 'true', dataset: { id: pg.id }, title: `${i + 1}. ${pg.name}\n클릭: 열기 · Shift/${MOD}+클릭: 여러 장 고르기 · 더블클릭: 이름 바꾸기`,
  },
  h('div', { class: 'pg-th' }, cv,
    v ? h('span', { class: 'pg-warn', title: `UI에 가려지는 요소 ${v}개` }, '⚠' + v) : null,
    empty ? h('span', { class: 'pg-empty', title: '빈 이미지 칸이 있어요' }, '빈칸') : null,
    pg.genFrom ? h('span', { class: 'pg-gen', title: '대량 제작으로 만든 페이지' }, '변형') : null,
    h('div', { class: 'pg-acts' },
      h('button', { type: 'button', title: '복제', onclick: (e) => { e.stopPropagation(); act.duplicatePage(pg.id); } }, icon('dup', 13)),
      h('button', { type: 'button', title: '삭제', onclick: (e) => { e.stopPropagation(); act.deletePages([pg.id]); } }, icon('trash', 13)))),
  h('div', { class: 'pg-name' }, h('b', null, i + 1), h('span', null, pg.name)));
  item.addEventListener('click', (e) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const s = new Set(state.pageSel.length ? state.pageSel : [state.pageId]);
      if (e.shiftKey) { // Shift: 마지막으로 고른 페이지(없으면 지금 페이지)부터 여기까지
        const ids = p.pages.map((x) => x.id);
        const a = ids.indexOf(state.pageSel.length ? state.pageSel[state.pageSel.length - 1] : state.pageId), b = ids.indexOf(pg.id);
        for (let k = Math.min(a, b); k <= Math.max(a, b); k++) s.add(ids[k]);
      } else if (s.has(pg.id)) s.delete(pg.id); else s.add(pg.id);
      state.pageSel = [...s];
      markCurrent();
      bus.emit('page-sel');
      return;
    }
    if (state.pageSel.length) { state.pageSel = []; bus.emit('page-sel'); }
    act.selectPage(pg.id);
  });
  item.addEventListener('dblclick', () => {
    const nm = item.querySelector('.pg-name span');
    const inp = h('input', { type: 'text', class: 'pg-in', value: pg.name, maxlength: 40 });
    nm.replaceWith(inp);
    inp.focus(); inp.select();
    const done = (ok) => { if (ok) act.renamePage(pg.id, inp.value); else renderPages(); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    inp.addEventListener('blur', () => done(true));
  });
  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    bus.emit('page-menu', { x: e.clientX, y: e.clientY, id: pg.id });
  });
  item.addEventListener('dragstart', (e) => { dragId = pg.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', pg.id); item.classList.add('dragging'); });
  item.addEventListener('dragend', () => { dragId = null; item.classList.remove('dragging'); clearMarks(); });
  item.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    const r = item.getBoundingClientRect();
    clearMarks();
    item.classList.add(e.clientX < r.left + r.width / 2 ? 'drop-l' : 'drop-r');
  });
  item.addEventListener('drop', (e) => {
    if (!dragId || dragId === pg.id) return;
    e.preventDefault();
    const r = item.getBoundingClientRect();
    const after = e.clientX >= r.left + r.width / 2;
    const from = p.pages.findIndex((x) => x.id === dragId);
    let to = i + (after ? 1 : 0);
    if (from < to) to -= 1;
    act.movePage(dragId, to);
  });
  canvases.set(pg.id, cv);
  if (prev && prev.width) { // 내용이 그대로인 페이지는 이전 썸네일을 복사 (페이지 수백 장이어도 가볍게)
    cv.width = prev.width; cv.height = prev.height;
    cv.getContext('2d').drawImage(prev, 0, 0);
  } else drawThumb(cv, pg, THUMB_W);
  return item;
}
function clearMarks() {
  document.querySelectorAll('.pg.drop-l,.pg.drop-r').forEach((x) => x.classList.remove('drop-l', 'drop-r'));
}

function scrollToCurrent(list) {
  const cur = list.querySelector('.pg.cur');
  if (!cur) return;
  const lr = list.getBoundingClientRect(), cr = cur.getBoundingClientRect();
  if (cr.left < lr.left || cr.right > lr.right) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function updateCount() {
  const cnt = document.getElementById('pagesCount');
  if (cnt) cnt.textContent = `${state.project.pages.length}페이지` + (state.pageSel.length ? ` · ${state.pageSel.length}개 고름` : '');
}

/** 페이지 목록 다시 만들기. full=true 면 썸네일도 전부 새로 그림 (되돌리기·프로젝트 열기) */
export function renderPages(opts) {
  const list = document.getElementById('pagesList');
  if (!list || !state.project) return;
  const prev = !(opts && opts.full) && shownProj === state.project.id ? new Map(canvases) : null;
  const sx = list.scrollLeft;
  list.innerHTML = '';
  canvases.clear();
  state.project.pages.forEach((pg, i) => list.append(pageItem(pg, i, prev && prev.get(pg.id))));
  list.append(h('button', { type: 'button', class: 'pg-add', title: '새 페이지', onclick: () => act.addPage() }, '＋'));
  shownProj = state.project.id;
  list.scrollLeft = sx;
  scrollToCurrent(list);
  updateCount();
}

/** 페이지만 바꿨을 때: 목록은 그대로 두고 표시만 갱신 */
function markCurrent() {
  const list = document.getElementById('pagesList');
  if (!list || !state.project) return;
  const ids = state.project.pages.map((p) => p.id);
  const items = [...list.querySelectorAll('.pg')];
  if (shownProj !== state.project.id || items.length !== ids.length || items.some((el, i) => el.dataset.id !== ids[i])) { renderPages(); return; }
  for (const el of items) {
    el.classList.toggle('cur', el.dataset.id === state.pageId);
    el.classList.toggle('picked', state.pageSel.includes(el.dataset.id));
  }
  scrollToCurrent(list);
  updateCount();
}

function refreshOne(id) {
  const cv = canvases.get(id);
  const pg = state.project.pages.find((x) => x.id === id);
  if (!cv || !pg) return;
  drawThumb(cv, pg, THUMB_W);
  const item = cv.closest('.pg');
  if (!item) return;
  const v = findViolations(pg, state.project.settings.placement).length;
  let warn = item.querySelector('.pg-warn');
  if (v && !warn) { warn = h('span', { class: 'pg-warn' }); cv.after(warn); }
  if (warn) { if (v) { warn.textContent = '⚠' + v; warn.title = `UI에 가려지는 요소 ${v}개`; } else warn.remove(); }
  const empty = pg.layers.some((l) => l.type === 'image' && !l.asset && !l.hidden);
  let em = item.querySelector('.pg-empty');
  if (empty && !em) { em = h('span', { class: 'pg-empty', title: '빈 이미지 칸이 있어요' }, '빈칸'); cv.after(em); }
  if (!empty && em) em.remove();
}
const refreshCurrent = debounce(() => refreshOne(state.pageId), 120);
const refreshAll = debounce(() => { for (const id of canvases.keys()) refreshOne(id); }, 200);

export function initPages() {
  bus.on('project', () => { shownProj = null; });
  bus.on('pages', () => renderPages());
  bus.on('page', markCurrent);
  bus.on('page-sel', markCurrent);
  bus.on('restored', () => renderPages({ full: true }));
  bus.on('doc', (o) => { if (o && o.fonts) refreshAll(); else refreshCurrent(); });
  bus.on('pages-dirty', refreshAll);
  bus.on('asset-ready', refreshAll);
  bus.on('fonts', refreshAll);
  bus.on('page-menu', ({ x, y, id }) => {
    const idx = state.project.pages.findIndex((p) => p.id === id);
    openMenu(x, y, [
      { label: '열기', onClick: () => act.selectPage(id) },
      { label: '복제', onClick: () => act.duplicatePage(id) },
      { label: '이 페이지 저장 (PNG/JPG)', onClick: () => bus.emit('export-pages', [id]) },
      { label: '왼쪽으로', disabled: idx <= 0, onClick: () => act.movePage(id, idx - 1) },
      { label: '오른쪽으로', disabled: idx >= state.project.pages.length - 1, onClick: () => act.movePage(id, idx + 1) },
      '-',
      { label: state.pageSel.length > 1 && state.pageSel.includes(id) ? `고른 ${state.pageSel.length}페이지 삭제` : '삭제', danger: true, onClick: () => act.deletePages(state.pageSel.length > 1 && state.pageSel.includes(id) ? state.pageSel : [id]) },
    ]);
  });
  void curPage;
}
