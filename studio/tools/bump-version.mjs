#!/usr/bin/env node
/* =========================================================================
   배포 전에 실행: studio/index.html 의 ?v= 숫자를 하나 올리고,
   import map 을 js/ 폴더의 모듈 목록으로 다시 만든다 (새 파일이 생겨도 자동 반영).
   사용: node studio/tools/bump-version.mjs
   ========================================================================= */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(STUDIO, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const cur = Math.max(0, ...[...html.matchAll(/\?v=(\d+)/g)].map((m) => +m[1]));
const v = cur + 1;
const mods = fs.readdirSync(path.join(STUDIO, 'js')).filter((f) => f.endsWith('.js') && f !== 'main.js').sort();
const map = { imports: Object.fromEntries(mods.map((m) => [`./js/${m}`, `./js/${m}?v=${v}`])) };
const block = `<script type="importmap">\n${JSON.stringify(map, null, 1)}\n</script>`;
if (!/<script type="importmap">[\s\S]*?<\/script>/.test(html)) throw new Error('index.html 에 import map 이 없어요');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, block)
  .replace(/studio\.css\?v=\d+/, `studio.css?v=${v}`)
  .replace(/js\/main\.js\?v=\d+/, `js/main.js?v=${v}`);
fs.writeFileSync(file, html);
console.log(`v=${cur} → v=${v} · 모듈 ${mods.length}개`);
