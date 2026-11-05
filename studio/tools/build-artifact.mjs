#!/usr/bin/env node
/* =========================================================================
   컨텐츠 스튜디오 → 클로드 아티팩트 판 만들기
   사용:  node studio/tools/build-artifact.mjs <출력폴더>
   결과:  <출력폴더>/studio-artifact.html  (아티팩트 본문 — JS·CSS 한 파일로 묶음)
          <출력폴더>/fonts/*               (구글 폰트가 아닌 글꼴 파일 — 같이 올림)
          <출력폴더>/fonts.json            (published 경로 → 로컬 파일 목록)

   아티팩트는 외부 주소(jsdelivr·네이버 등)의 CSS·글꼴을 막기 때문에,
   구글 폰트가 아닌 글꼴은 파일을 받아서 아티팩트에 같이 올리고
   window.__BB_LOCAL_FONTS 로 위치를 알려 준다 (fonts.js 가 fetch → FontFace).
   오피스 잠금(PIN)·'← 오피스' 링크는 빼고, 저장은 아티팩트 다운로드 권한을 쓴다(exporter.js).
   필요: Node 18+, esbuild (npm i -D esbuild)
   ========================================================================= */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || 'studio-artifact-build');
const FONT_DIR = path.join(OUT, 'fonts');
fs.mkdirSync(FONT_DIR, { recursive: true });

/* ---------- 1. 글꼴 목록 읽기 (fonts.js 의 FONTS 배열) ---------- */
const fontsSrc = fs.readFileSync(path.join(STUDIO, 'js/fonts.js'), 'utf8');
const pick = (re) => { const m = fontsSrc.match(re); if (!m) throw new Error('fonts.js 에서 못 찾음: ' + re); return m[1]; };
const NOON = pick(/const NOON = '([^']+)'/);
const NAVER = pick(/const NAVER = '([^']+)'/);
const arrSrc = fontsSrc.slice(fontsSrc.indexOf('export const FONTS = ['), fontsSrc.indexOf('];', fontsSrc.indexOf('export const FONTS = [')) + 1)
  .replace('export const FONTS = ', '');
const R = (a, b, step = 100) => { const o = []; for (let w = a; w <= b; w += step) o.push(w); return o; };
// eslint-disable-next-line no-new-func
const FONTS = new Function('NOON', 'NAVER', 'R', `return ${arrSrc};`)(NOON, NAVER, R);

// CSS 로 받는 글꼴 중 '쪼갠(subset)' CSS 를 쓰는 것은 통째 파일 CSS 로 바꿔서 읽는다
const CSS_OVERRIDE = {
  Pretendard: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard.css',
  'Wanted Sans': 'https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/static/complete/WantedSans.css',
};

async function get(url, asText) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return asText ? await r.text() : Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i === 2) throw new Error(`${url} → ${e.message}`);
      await new Promise((res) => setTimeout(res, 800 * (i + 1)));
    }
  }
  return null;
}

/** @font-face 블록에서 { 굵기: url } (woff2 > woff > ttf/otf) */
function facesFromCss(css, base) {
  const out = {};
  for (const block of css.split('@font-face').slice(1)) {
    const body = block.slice(0, block.indexOf('}'));
    if (/unicode-range/i.test(body)) return null; // 쪼갠 CSS 는 못 씀
    if (/font-style:\s*italic/i.test(body)) continue;
    const w = (body.match(/font-weight:\s*(\d+)/) || [])[1];
    const urls = [...body.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]);
    const u = urls.find((x) => /\.woff2(\?|$)/.test(x)) || urls.find((x) => /\.woff(\?|$)/.test(x)) || urls.find((x) => /\.(ttf|otf)(\?|$)/.test(x));
    if (w && u) out[w] = new URL(u, base).href;
  }
  return Object.keys(out).length ? out : null;
}

const safe = (s) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
const localMap = {};
const files = {}; // published 경로 → 로컬 파일
let total = 0;
const skipped = [];
for (const f of FONTS) {
  if (f.google) continue;
  let faces = f.faces || null;
  if (!faces && (f.css || CSS_OVERRIDE[f.id])) {
    const cssUrl = CSS_OVERRIDE[f.id] || f.css;
    try { faces = facesFromCss(await get(cssUrl, true), cssUrl); } catch (e) { faces = null; }
  }
  if (!faces) { skipped.push(f.id); continue; }
  const m = {};
  for (const [w, url] of Object.entries(faces)) {
    const ext = (url.match(/\.(woff2|woff|ttf|otf)(\?|$)/) || [])[1] || 'woff2';
    const name = `${safe(f.id)}-${w}.${ext}`;
    const dest = path.join(FONT_DIR, name);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
      try { fs.writeFileSync(dest, await get(url)); } catch (e) { console.warn('  ✗', f.id, w, e.message); continue; }
    }
    total += fs.statSync(dest).size;
    m[w] = `fonts/${name}`;
    files[`fonts/${name}`] = dest;
  }
  if (Object.keys(m).length) localMap[f.id] = m; else skipped.push(f.id);
}
console.log(`글꼴 ${Object.keys(localMap).length}종 · 파일 ${Object.keys(files).length}개 · ${(total / 1048576).toFixed(1)}MB`);
if (skipped.length) console.log('  (못 받은 글꼴 — 아티팩트에서 숨김):', skipped.join(', '));

/* ---------- 2. JS 묶기 ---------- */
async function loadEsbuild() {
  try { return await import('esbuild'); } catch (e) { /* 다음 */ }
  for (const base of [process.cwd() + '/', STUDIO + '/', '/opt/npm-tools/']) {
    try { return createRequire(base + 'noop.js')('esbuild'); } catch (e) { /* 다음 */ }
  }
  throw new Error('esbuild 가 필요해요: npm i -D esbuild');
}
const esbuild = await loadEsbuild();
const built = await esbuild.build({
  entryPoints: [path.join(STUDIO, 'js/main.js')], bundle: true, format: 'esm', target: 'es2020',
  minify: true, legalComments: 'none', write: false, charset: 'utf8',
});
let js = built.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

/* ---------- 3. HTML 조립 (아티팩트는 doctype·head·body 없이 본문만) ---------- */
const shell = fs.readFileSync(path.join(STUDIO, 'index.html'), 'utf8');
let body = shell.slice(shell.indexOf('>', shell.indexOf('<body')) + 1, shell.lastIndexOf('</body>'));
body = body
  .replace(/<script type="module"[^>]*><\/script>\s*/g, '')
  .replace(/<a class="tb-back"[\s\S]*?<\/a>\s*/, '');
let css = fs.readFileSync(path.join(STUDIO, 'studio.css'), 'utf8')
  .replace('display: grid; height: 100vh;', 'display: grid; height: 100%;');
if (css.includes('height: 100vh;\n  grid-template-columns')) throw new Error('studio.css 높이 치환 실패');

const html = `<title>광고 컨텐츠 스튜디오</title>
<style>
${css}
</style>
<script>
document.body.classList.add('booting');
window.__BB_LOCAL_FONTS = ${JSON.stringify(localMap)};
</script>
${body.trim()}
<script type="module">
${js}
</script>
`;
fs.writeFileSync(path.join(OUT, 'studio-artifact.html'), html);
fs.writeFileSync(path.join(OUT, 'fonts.json'), JSON.stringify(files, null, 1));
console.log(`studio-artifact.html ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB → ${OUT}`);
