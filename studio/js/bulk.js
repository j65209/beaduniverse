/* =========================================================================
   대량 제작 — 지금 디자인(템플릿)에서 사진·문구만 바꾼 페이지를 한 번에
   · 한 줄 = 페이지 1개  또는  사진 × 문구 모든 조합
   · 엑셀/구글시트에서 복사한 표를 그대로 붙여넣기
   · 만든 페이지들은 템플릿과 '연결'돼서 일괄 수정 가능
   ========================================================================= */
import { state, bus, curPage, h, toast, clonePage, uid, assets, changed, layerLabel, clamp } from './core.js';
import { syncText, aabb, layoutText } from './render.js';
import { safeRect, findViolations } from './overlay.js';
import * as act from './actions.js';
import { pickFile } from './panels.js';
import { openModal, confirmBox } from './modal.js';

const newRow = () => ({ id: uid('r'), cells: {} });

function templateOf(page) {
  if (page.genFrom) {
    const t = state.project.pages.find((x) => x.id === page.genFrom);
    if (t) return t;
  }
  return page;
}
function columnsOf(tpl) {
  const cols = tpl.layers
    .filter((L) => (L.type === 'text' && String(L.text || '').trim()) || L.type === 'image')
    .map((L) => ({ key: L.key, type: L.type, label: layerLabel(L), y: aabb(L).y, L }));
  return [...cols.filter((c) => c.type === 'image').sort((a, b) => a.y - b.y), ...cols.filter((c) => c.type === 'text').sort((a, b) => a.y - b.y)];
}
function cfgFor(tpl, cols) {
  const p = state.project;
  if (!p.bulk || p.bulk.rows) p.bulk = {};
  let cfg = p.bulk[tpl.id];
  if (!cfg) {
    cfg = { mode: 'rows', replace: true, cols: {}, rows: [newRow(), newRow(), newRow()] };
    p.bulk[tpl.id] = cfg;
  }
  for (const c of cols) if (cfg.cols[c.key] == null) cfg.cols[c.key] = true;
  if (!cfg.rows.length) cfg.rows.push(newRow());
  return cfg;
}

/** 엑셀·시트에서 복사한 표 (탭 구분, 따옴표 안 줄바꿈 지원) */
export function parseTable(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text || '');
  const tabbed = s.includes('\t');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '' && tabbed) q = true;
    else if (ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
const fixBreaks = (t) => String(t || '').replace(/\s*\/\/\s*/g, '\n').replace(/\\n/g, '\n').trim();

function filled(r, c) {
  const v = r.cells[c.key];
  return c.type === 'text' ? !!(v && String(v.text || '').trim()) : !!(v && v.asset);
}
function combos(cfg, cols) {
  const en = cols.filter((c) => cfg.cols[c.key]);
  const tc = en.filter((c) => c.type === 'text'), ic = en.filter((c) => c.type === 'image');
  if (cfg.mode === 'cross' && tc.length && ic.length) {
    const ir = cfg.rows.filter((r) => ic.some((c) => filled(r, c)));
    const tr = cfg.rows.filter((r) => tc.some((c) => filled(r, c)));
    const out = [];
    for (const a of ir) for (const b of tr) out.push([a, b]);
    return out;
  }
  return cfg.rows.filter((r) => en.some((c) => filled(r, c))).map((r) => [r, r]);
}

function generate(tpl, cfg, cols) {
  const list = combos(cfg, cols);
  if (!list.length) return 0;
  const p = state.project;
  const en = cols.filter((c) => cfg.cols[c.key]);
  const tc = en.filter((c) => c.type === 'text');
  if (cfg.replace) p.pages = p.pages.filter((pg) => pg.genFrom !== tpl.id);
  const at = p.pages.indexOf(tpl);
  const made = list.map(([ir, tr], i) => {
    const pg = clonePage(tpl, { keepKeys: true });
    pg.genFrom = tpl.id;
    for (const L of pg.layers) {
      const col = en.find((c) => c.key === L.key);
      if (!col) continue;
      if (col.type === 'text') {
        const v = tr.cells[L.key] && tr.cells[L.key].text;
        if (v && v.trim()) { L.text = v; syncText(L); }
      } else {
        const a = ir.cells[L.key] && ir.cells[L.key].asset;
        if (a) { L.asset = a; L.px = 0.5; L.py = 0.5; L.zoom = 1; }
      }
    }
    const nm = tc.map((c) => tr.cells[c.key] && tr.cells[c.key].text).find((v) => v && v.trim());
    pg.name = nm ? nm.replace(/\s+/g, ' ').trim().slice(0, 18) : `변형 ${i + 1}`;
    return pg;
  });
  p.pages.splice(at + 1, 0, ...made);
  changed();
  bus.emit('pages');
  act.selectPage(made[0].id);
  const warn = made.filter((pg) => findViolations(pg, p.settings.placement).length).length;
  toast(`페이지 ${made.length}개를 만들었어요${warn ? ` · ⚠ ${warn}개는 글자가 UI에 가려져요` : ''}`, warn ? 'warn' : 'ok', 4200);
  return made.length;
}

/** 긴 문구 대비: 텍스트를 안전영역 폭 고정 + 자동 축소로 */
function makeTextSafe(tpl, cols, cfg) {
  const r = safeRect(state.project.settings.placement);
  let n = 0;
  for (const c of cols) {
    if (c.type !== 'text' || !cfg.cols[c.key]) continue;
    const L = tpl.layers.find((l) => l.key === c.key);
    if (!L) continue;
    const lines = layoutText(L).lines.length;
    if (L.autoW) {
      let w;
      if (L.align === 'center') { const cx = L.x + L.w / 2; w = 2 * Math.min(cx - r.x, r.x2 - cx); }
      else if (L.align === 'right') w = L.x + L.w - r.x;
      else w = r.x2 - L.x;
      w = clamp(Math.round(w), 200, r.w);
      const ax = L.align === 'center' ? L.x + L.w / 2 : L.align === 'right' ? L.x + L.w : L.x;
      L.autoW = false;
      L.w = w;
      L.x = L.align === 'center' ? ax - w / 2 : L.align === 'right' ? ax - w : ax;
    }
    L.fit = { on: true, maxLines: Math.max(L.fit && L.fit.on ? L.fit.maxLines : 0, lines, 2), min: Math.round(L.size * 0.55) };
    syncText(L);
    n++;
  }
  if (n) { changed(); bus.emit('pages-dirty'); toast(`텍스트 ${n}개: 안전영역 폭에서 줄바꿈 + 넘치면 자동 축소`, 'ok', 3200); }
  else toast('바뀌는 텍스트 칸이 없어요', 'info');
}

export function openBulk() {
  const cur = curPage();
  const tpl = templateOf(cur);
  const cols = columnsOf(tpl);
  if (!cols.length) { toast('먼저 텍스트나 이미지가 들어간 디자인을 만들어 주세요', 'warn'); return; }
  const cfg = cfgFor(tpl, cols);
  const tplIdx = state.project.pages.indexOf(tpl) + 1;
  const prev = () => state.project.pages.filter((pg) => pg.genFrom === tpl.id).length;
  const save = () => bus.emit('save-request');

  const table = h('table', { class: 'bk-table' });
  const tableWrap = h('div', { class: 'bk-wrap' }, table);
  const chipsBox = h('div', { class: 'chips bk-cols' });
  const optsBox = h('div', { class: 'bk-opts' });
  const genBtn = h('button', { type: 'button', class: 'btn btn-primary' });
  const summary = h('div', { class: 'bk-sum' });

  const enabled = () => cols.filter((c) => cfg.cols[c.key]);
  const count = () => combos(cfg, cols).length;
  const updateSummary = () => {
    const n = count();
    genBtn.textContent = n ? `페이지 ${n}개 만들기` : '표를 채워주세요';
    genBtn.disabled = !n;
    const p = prev();
    summary.textContent = n
      ? `템플릿: ${tplIdx}페이지 「${tpl.name}」 → 바로 뒤에 ${n}개 생성${cfg.replace && p ? ` (이전 변형 ${p}개는 교체)` : ''}`
      : '빈칸은 템플릿 내용 그대로 들어가요. 한 칸이라도 채운 줄만 페이지가 돼요.';
  };

  const autosize = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight + 2) + 'px'; };

  async function fillImages(files, startRow, c) {
    const ids = await act.importFiles(files);
    ids.forEach((id, k) => {
      const idx = startRow + k;
      while (cfg.rows.length <= idx) cfg.rows.push(newRow());
      cfg.rows[idx].cells[c.key] = { asset: id };
    });
    if (ids.length) { renderTable(); save(); }
  }
  function fillLines(lines, c, start = 0) {
    lines.forEach((t, k) => {
      const idx = start + k;
      while (cfg.rows.length <= idx) cfg.rows.push(newRow());
      cfg.rows[idx].cells[c.key] = { text: fixBreaks(t) };
    });
    renderTable(); save();
  }

  function textCell(r, c) {
    const v = r.cells[c.key] && r.cells[c.key].text;
    const ta = h('textarea', { class: 'bk-ta', rows: 1, placeholder: c.L.text, spellcheck: false });
    ta.value = v || '';
    ta.addEventListener('input', () => {
      if (ta.value) r.cells[c.key] = { text: ta.value }; else delete r.cells[c.key];
      autosize(ta); updateSummary(); save();
    });
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    ta.addEventListener('paste', (e) => {
      const text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
      const rows = parseTable(text);
      if (rows.length <= 1 && (!rows[0] || rows[0].length <= 1)) return;
      e.preventDefault();
      // 여러 칸 붙여넣기: 이 칸부터 오른쪽·아래로
      const tcols = enabled().filter((x) => x.type === 'text');
      const ci = tcols.indexOf(c), ri = cfg.rows.indexOf(r);
      rows.forEach((cells, k) => {
        while (cfg.rows.length <= ri + k) cfg.rows.push(newRow());
        cells.forEach((val, j) => { const col = tcols[ci + j]; if (col && val.trim()) cfg.rows[ri + k].cells[col.key] = { text: fixBreaks(val) }; });
      });
      renderTable(); save();
      toast(`${rows.length}줄 붙여넣었어요`, 'ok', 1600);
    });
    requestAnimationFrame(() => autosize(ta));
    return ta;
  }
  function imgCell(r, c, ri) {
    const id = r.cells[c.key] && r.cells[c.key].asset;
    const a = id ? assets.get(id) : null;
    const box = h('div', { class: 'bk-img' + (id ? ' has' : ''), title: '클릭: 사진 고르기 · 여러 장을 끌어다 놓으면 아래 줄까지 채워요', style: a && a.url ? { backgroundImage: `url(${a.url})` } : null }, id ? null : '＋ 사진');
    if (id) box.append(h('button', { type: 'button', class: 'bk-x', title: '비우기', onclick: (e) => { e.stopPropagation(); delete r.cells[c.key]; renderTable(); save(); } }, '×'));
    box.addEventListener('click', () => pickFile('image/*', true, (files) => fillImages(files, ri, c)));
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('over'); });
    box.addEventListener('dragleave', () => box.classList.remove('over'));
    box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('over'); const fs = [...e.dataTransfer.files]; if (fs.length) fillImages(fs, ri, c); });
    return box;
  }
  function colHead(c) {
    const fill = c.type === 'image'
      ? h('button', { type: 'button', class: 'bk-hbtn', title: '사진 여러 장을 1줄부터 차례로', onclick: () => pickFile('image/*', true, (files) => fillImages(files, 0, c)) }, '여러 장')
      : h('button', { type: 'button', class: 'bk-hbtn', title: '한 줄에 하나씩 붙여넣기', onclick: () => openLines(c) }, '여러 줄');
    return h('th', { class: 'bk-th ' + c.type }, h('div', { class: 'bk-thx' }, h('span', { class: 'bk-ty' }, c.type === 'image' ? '사진' : '글'), h('span', { class: 'bk-lb', title: c.label }, c.label), fill));
  }
  function renderTable() {
    table.innerHTML = '';
    const en = enabled();
    table.append(h('thead', null, h('tr', null, h('th', { class: 'bk-n' }, '#'), en.map(colHead), h('th', { class: 'bk-del' }))));
    const tb = h('tbody');
    cfg.rows.forEach((r, ri) => {
      tb.append(h('tr', { class: en.some((c) => filled(r, c)) ? 'on' : '' },
        h('td', { class: 'bk-n' }, ri + 1),
        en.map((c) => h('td', { class: 'bk-td ' + c.type }, c.type === 'image' ? imgCell(r, c, ri) : textCell(r, c))),
        h('td', { class: 'bk-del' }, h('button', { type: 'button', class: 'bk-x2', title: '이 줄 지우기', onclick: () => { cfg.rows.splice(ri, 1); if (!cfg.rows.length) cfg.rows.push(newRow()); renderTable(); save(); } }, '×'))));
    });
    table.append(tb);
    updateSummary();
  }
  function renderChips() {
    chipsBox.innerHTML = '';
    chipsBox.append(h('span', { class: 'bk-lab' }, '바꿀 요소'));
    for (const c of cols) {
      chipsBox.append(h('button', {
        type: 'button', class: 'chip' + (cfg.cols[c.key] ? ' on' : ''),
        onclick: () => { cfg.cols[c.key] = !cfg.cols[c.key]; renderChips(); renderTable(); renderOpts(); save(); },
      }, c.type === 'image' ? '🖼 ' : 'T ', c.label));
    }
  }
  function renderOpts() {
    optsBox.innerHTML = '';
    const en = enabled();
    const canCross = en.some((c) => c.type === 'text') && en.some((c) => c.type === 'image');
    if (!canCross && cfg.mode === 'cross') cfg.mode = 'rows';
    const radio = (v, label, desc, disabled) => h('label', { class: 'bk-radio' + (cfg.mode === v ? ' on' : '') + (disabled ? ' off' : '') },
      h('input', { type: 'radio', name: 'bkmode', checked: cfg.mode === v, disabled: disabled || null, onchange: () => { cfg.mode = v; renderOpts(); updateSummary(); save(); } }),
      h('b', null, label), h('span', null, desc));
    optsBox.append(h('div', { class: 'bk-modes' },
      radio('rows', '한 줄 = 페이지 1개', '표의 줄마다 그대로 한 장씩'),
      radio('cross', '모든 조합', canCross ? '사진 줄 × 문구 줄 (예: 사진 3 × 문구 4 = 12장)' : '사진·글 칸이 둘 다 있어야 해요', !canCross)));
    const p = prev();
    if (p) {
      optsBox.append(h('label', { class: 'bk-check' },
        h('input', { type: 'checkbox', checked: cfg.replace, onchange: (e) => { cfg.replace = e.target.checked; updateSummary(); save(); } }),
        `이 템플릿으로 전에 만든 변형 ${p}개는 지우고 새로 만들기`));
    }
  }
  function openLines(c) {
    const ta = h('textarea', { class: 'bk-lines', rows: 10, placeholder: '한 줄에 문구 하나씩\n줄바꿈이 필요한 문구는 // 로 표시 (예: 이 가격 실화?//최대 70%)' });
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    const mm = openModal({
      title: `「${c.label}」 여러 줄 넣기`, cls: 'modal-sm',
      body: [h('p', { class: 'modal-msg' }, '1줄부터 차례로 채워요. 엑셀에서 한 열을 복사해 붙여넣어도 돼요.'), ta],
      footer: [
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => mm.close() }, '취소'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { const lines = ta.value.split(/\r?\n/).filter((l) => l.trim()); if (lines.length) fillLines(lines, c); mm.close(); } }, '넣기'),
      ],
    });
    setTimeout(() => ta.focus(), 30);
  }
  function openSheet() {
    const tcols = enabled().filter((c) => c.type === 'text');
    if (!tcols.length) { toast('바꿀 텍스트 칸을 먼저 켜주세요', 'warn'); return; }
    const ta = h('textarea', { class: 'bk-lines', rows: 9, placeholder: '구글 시트·엑셀에서 표를 복사(Ctrl+C)해서 여기 붙여넣기(Ctrl+V)' });
    const head = h('input', { type: 'checkbox' });
    const map = h('div', { class: 'bk-map' });
    const preview = () => {
      const rows = parseTable(ta.value);
      const ncol = Math.max(0, ...rows.map((r) => r.length));
      map.innerHTML = '';
      if (!rows.length) { map.append(h('span', { class: 'hint' }, `열 순서대로 → ${tcols.map((c) => c.label).join(' · ')}`)); return; }
      for (let j = 0; j < ncol; j++) map.append(h('span', { class: 'bk-mapit' + (tcols[j] ? '' : ' skip') }, `${j + 1}열 → ${tcols[j] ? tcols[j].label : '(안 씀)'}`));
      map.append(h('span', { class: 'hint' }, ` · ${rows.length - (head.checked ? 1 : 0)}줄`));
    };
    ta.addEventListener('input', preview);
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    head.addEventListener('change', preview);
    const mm = openModal({
      title: '시트·엑셀에서 붙여넣기', cls: 'modal-md',
      body: [ta, h('label', { class: 'bk-check' }, head, '첫 줄은 제목 줄 (건너뛰기)'), map],
      footer: [
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => mm.close() }, '취소'),
        h('button', {
          type: 'button', class: 'btn btn-primary', onclick: () => {
            let rows = parseTable(ta.value);
            if (head.checked) rows = rows.slice(1);
            if (!rows.length) { mm.close(); return; }
            rows.forEach((cells, k) => {
              while (cfg.rows.length <= k) cfg.rows.push(newRow());
              cells.forEach((v, j) => { const c = tcols[j]; if (c && v.trim()) cfg.rows[k].cells[c.key] = { text: fixBreaks(v) }; });
            });
            renderTable(); save();
            mm.close();
            toast(`${rows.length}줄을 채웠어요`, 'ok');
          },
        }, '표에 채우기'),
      ],
    });
    preview();
    setTimeout(() => ta.focus(), 30);
  }

  const tools = h('div', { class: 'bk-tools' },
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { cfg.rows.push(newRow()); renderTable(); save(); } }, '＋ 줄 추가'),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: openSheet }, '📋 시트·엑셀 붙여넣기'),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', title: '대량 제작 전에 한 번 눌러두면 긴 문구도 안전영역 안에서 줄바꿈·축소돼요', onclick: () => makeTextSafe(tpl, cols, cfg) }, '↔ 긴 문구 대비 (자동 줄바꿈·축소)'),
    h('span', { class: 'spacer' }),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async () => { if (await confirmBox('표 비우기', '입력한 내용을 모두 지울까요?', { ok: '비우기', danger: true })) { cfg.rows = [newRow(), newRow(), newRow()]; renderTable(); save(); } } }, '표 비우기'));

  genBtn.addEventListener('click', async () => {
    const n = count();
    if (!n) return;
    if (n > 150 && !(await confirmBox('페이지가 많아요', `${n}개 페이지를 만들어요. 계속할까요?`, { ok: '만들기' }))) return;
    generate(tpl, cfg, cols);
    m.close();
  });

  const body = h('div', { class: 'bulk' },
    h('div', { class: 'bk-intro' },
      h('b', null, `${tplIdx}페이지 「${tpl.name}」를 템플릿으로`),
      ' 사진·문구만 바꾼 광고를 한 번에 만들어요. 만든 페이지는 템플릿과 연결돼서, 나중에 ',
      h('b', null, '일괄 수정'), '으로 위치·스타일을 한꺼번에 고칠 수 있어요.'),
    chipsBox, tableWrap, tools, optsBox);
  const m = openModal({
    title: '대량 제작', cls: 'modal-xl', body,
    footer: [summary, h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => m.close() }, '닫기'), genBtn],
    onClose: () => { changed({ history: false }); },
  });
  renderChips();
  renderOpts();
  renderTable();
  const ids = [];
  for (const r of cfg.rows) for (const v of Object.values(r.cells)) if (v && v.asset) ids.push(v.asset);
  if (ids.some((id) => !assets.ready(id))) assets.loadMany(ids).then(() => { if (m.el.isConnected) renderTable(); });
}
