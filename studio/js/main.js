/* =========================================================================
   컨텐츠 스튜디오 — 시작
   ========================================================================= */
import { state, db, getMeta, newProject, gcAssets, toast } from './core.js';
import { loadCustomFonts } from './fonts.js';
import { initEditor } from './editor.js';
import { initPanels } from './panels.js';
import { initPages } from './pages.js';
import { initUI, openProject, saveNow } from './ui.js';

async function boot() {
  await db.open();
  const prefs = await getMeta('prefs');
  const uiDefault = state.prefs.ui;
  if (prefs) Object.assign(state.prefs, prefs);
  // 패널 접기 상태 — 예전 설정에 없던 값은 기본값(전부 접힘)으로
  state.prefs.ui = Object.assign({}, uiDefault, (prefs && prefs.ui) || {});
  if (!state.prefs.ui.fold || typeof state.prefs.ui.fold !== 'object') state.prefs.ui.fold = {};
  initEditor();
  initPanels();
  initPages();
  initUI();
  loadCustomFonts();
  const lastId = await getMeta('lastProject');
  let proj = lastId ? await db.get('projects', lastId) : null;
  if (!proj) {
    const all = await db.all('projects');
    proj = all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
  }
  const fresh = !proj;
  if (!proj) proj = newProject('첫 광고 프로젝트');
  await openProject(proj);
  if (fresh) await saveNow();
  document.body.classList.remove('booting');
  if (!db.ok) toast('이 브라우저(시크릿 창 등)에서는 작업이 저장되지 않아요. 일반 창에서 열어주세요.', 'warn', 7000);
  setTimeout(gcAssets, 5000);
  window.__studio = { state };
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('bootError');
  if (el) { el.hidden = false; el.textContent = '스튜디오를 여는 중 문제가 생겼어요: ' + (e && e.message ? e.message : e); }
});
