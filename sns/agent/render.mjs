// 꿀꿀집 카드뉴스 — 카드 데이터(JSON) → 1080×1350 JPG 여러 장 (Node 22+, 의존성 없음)
//
//   node render.mjs --data cards.json --out 폴더 [--ph 사진폴더] [--quality 90]
//   node render.mjs --data demo --out 폴더          (template.html 의 예시 데이터)
//
// --ph: 딜 카드에 보이는 제품 사진 부분만(자른 그대로) 따로 찍어 사진폴더/<board>-<id>.jpg 로 저장 —
//   links.mjs --ph 가 링크 모음 페이지 사진(image)으로 보낸다 (2026-11-11 승훈 님 "카드에 넣은 제품 이미지를 그때 넣어 줘").
//   카드 폴더와 따로 둔다 (send.mjs 는 카드 폴더의 JPG 를 전부 올린다).
//
// 같은 폴더의 template.html 을 헤드리스 Edge(없으면 Chrome)로 열고 DevTools 프로토콜로 한 장씩 찍는다.
// 띄운 브라우저는 따로 만든 임시 프로필을 쓰고, 끝나면 그 프로세스만 닫는다 (사용자 브라우저는 건드리지 않음).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? '1' : all[i + 1]]] : a), []),
);
if (!args.data || !args.out) {
  console.error('쓰는 법: node render.mjs --data cards.json --out 폴더 [--quality 90]');
  process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const template = path.resolve(args.template ?? path.join(here, 'template.html'));
const data = args.data === 'demo' ? null : JSON.parse(fs.readFileSync(args.data, 'utf8'));
// 제품 사진(deals[].image)이 파일 경로면 cards.json 이 있는 폴더 기준 file:// 주소로 바꾼다
if (data) {
  const base = path.dirname(path.resolve(args.data));
  for (const d of data.deals ?? []) {
    if (d.image && !/^(https?|file|data):/i.test(d.image)) d.image = pathToFileURL(path.resolve(base, d.image)).href;
  }
}
// 수집 시각(asOf = deals.json 의 collected_at) → '오후 5시 2분 기준' (한국 시각) — 카드 날짜 줄 · 아래 줄에 쓴다
if (data?.asOf && !data.asOfLabel) {
  const t = Date.parse(data.asOf);
  if (Number.isFinite(t)) {
    const k = new Date(t + 9 * 3_600_000), h = k.getUTCHours(), m = k.getUTCMinutes();
    data.asOfLabel = `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}시${m ? ` ${m}분` : ''} 기준`;
  }
}
// 날짜 칸을 비워 두면 오늘(한국 시각)로 — 요일을 손으로 쓰다 틀리지 않게
if (data && !data.dateLabel) {
  const k = new Date(Date.now() + 9 * 3_600_000);
  data.dateLabel = `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${'일월화수목금토'[k.getUTCDay()]}요일`;
}
const outDir = path.resolve(args.out);
const phDir = args.ph ? path.resolve(args.ph) : null;
if (phDir && phDir === outDir) { console.error('--ph 는 카드 폴더(--out)와 다른 폴더로 주세요.'); process.exit(1); }
const quality = Math.min(100, Math.max(60, Number(args.quality ?? 90)));
const W = 1080, H = 1350;
const MAX_BYTES = 5 * 1024 * 1024; // X 는 5MB 넘는 사진을 못 올린다

function findBrowser() {
  const c = [
    process.env.EDGE_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const hit = c.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Edge/Chrome 을 찾지 못했어요 (EDGE_PATH 로 알려 주세요).');
  return hit;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ggul-render-'));
  const proc = spawn(findBrowser(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1', `--window-size=${W},${H}`,
    // 맥미니 무인 실행: 크롬이 키체인 암호 창을 띄우면 아무도 못 눌러 멈춘다 → 가짜 키체인
    ...(process.platform === 'darwin' ? ['--use-mock-keychain', '--password-store=basic'] : []),
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  const cleanup = () => {
    try {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else proc.kill('SIGKILL');
    } catch { /* 이미 닫힘 */ }
    for (let i = 0; i < 5; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},400)']); }
    }
  };

  try {
    // 브라우저가 고른 포트는 프로필 폴더의 DevToolsActivePort 에 적힌다
    const portFile = path.join(profile, 'DevToolsActivePort');
    let port = 0;
    for (let i = 0; i < 100 && !port; i++) {
      if (fs.existsSync(portFile)) port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || 0;
      if (!port) await sleep(200);
    }
    if (!port) throw new Error('헤드리스 브라우저가 열리지 않았어요.');

    const base = `http://127.0.0.1:${port}`;
    let page = (await (await fetch(`${base}/json/list`)).json()).find((t) => t.type === 'page');
    if (!page) page = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools 연결 실패')); });
    let seq = 0;
    const pending = new Map();
    const waiters = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
      } else if (m.method) {
        for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); }
      }
    };
    const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
    const once = (method, ms = 30000) => new Promise((res, rej) => { waiters.push({ method, res }); setTimeout(() => rej(new Error(method + ' 기다리다 시간 초과')), ms); });
    const js = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: pathToFileURL(template).href });
    await loaded;

    const payload = data ? JSON.stringify(data) : 'window.DEMO';
    const n = await js(`(async () => {
      await document.fonts.ready;
      const n = window.render(${payload});
      const t = window.allText();
      await Promise.all(['400','600','700','800','900'].map((w) => document.fonts.load(w + ' 40px Pretendard', t).catch(() => null)));
      await document.fonts.ready;
      return n;
    })()`);
    const fontOk = await js(`document.fonts.check('900 40px Pretendard', '꿀딜')`);
    if (!fontOk) console.error('⚠ Pretendard 글꼴을 못 불러왔어요 — 기본 글꼴로 찍혀요 (인터넷 연결 확인).');

    const files = [], photos = [];
    for (let i = 0; i < n; i++) {
      const broken = await js(`(async () => {
        window.only(${i});
        await document.fonts.ready;
        const imgs = [...document.querySelectorAll('.slide')[${i}].querySelectorAll('img')];
        await Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.addEventListener('load', r); im.addEventListener('error', r); setTimeout(r, 15000); })));
        if (window.applyCrops) window.applyCrops(); // 숨겨져 있을 때 뜬 사진은 자르기가 안 돼서 보일 때 다시
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return imgs.filter((im) => !im.naturalWidth).length;
      })()`);
      if (broken) console.error(`⚠ ${i + 1}번 카드 제품 사진을 못 불러왔어요 — 빈 칸으로 찍혀요.`);
      if (args.debug) { // 글자 크기 · 아래 줄 위치 확인용
        console.error(`#${i + 1}`, JSON.stringify(await js(`(() => {
          const s = document.querySelectorAll('.slide')[${i}];
          const fs = (q) => { const e = s.querySelector(q); return e ? getComputedStyle(e).fontSize : null; };
          const f = s.querySelector('.foot');
          return { name: fs('.dname'), price: fs('.price'), tip: fs('.tip p'), info: s.querySelectorAll('.info div').length,
            footBottom: f && Math.round(f.getBoundingClientRect().bottom), slideBottom: Math.round(s.getBoundingClientRect().bottom) };
        })()`)));
      }
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality, clip: { x: 0, y: 0, width: W, height: H, scale: 1 }, captureBeyondViewport: false, fromSurface: true });
      const buf = Buffer.from(shot.data, 'base64');
      if (buf.length > MAX_BYTES) throw new Error(`${i + 1}번 카드가 5MB 를 넘어요 — --quality 를 낮춰 주세요.`);
      const file = path.join(outDir, String(i + 1).padStart(2, '0') + '.jpg');
      fs.writeFileSync(file, buf);
      files.push(file);

      // 제품 사진만 따로 — 카드에 보이는 범위(자른 부분) 그대로, 위에 겹친 글자 · 스티커는 잠깐 숨기고 찍는다
      if (phDir) {
        const ph = await js(`(() => {
          const s = document.querySelectorAll('.slide')[${i}];
          const ref = s && s.getAttribute('data-ref');
          const box = s && s.querySelector('.photo .ph'), img = box && box.querySelector('img');
          if (!ref || !img || !img.naturalWidth) return null;
          const b = box.getBoundingClientRect(), r = img.getBoundingClientRect();
          let x = r.left, y = r.top, w = r.width, h = r.height;
          const c = (img.getAttribute('data-crop') || '').split(',').map(Number);
          if (img.classList.contains('cropped') && c.length === 4 && !c.some(isNaN)) { x = r.left + c[0] * r.width; y = r.top + c[1] * r.height; w = (c[2] - c[0]) * r.width; h = (c[3] - c[1]) * r.height; }
          const x0 = Math.max(x, b.left), y0 = Math.max(y, b.top), x1 = Math.min(x + w, b.right), y1 = Math.min(y + h, b.bottom);
          if (x1 - x0 < 40 || y1 - y0 < 40) return null;
          s.style.visibility = 'hidden'; box.style.visibility = 'visible'; box.style.borderRadius = '0'; // 둥근 모서리 없이
          return { ref, x: Math.ceil(x0), y: Math.ceil(y0), w: Math.floor(x1 - Math.ceil(x0)), h: Math.floor(y1 - Math.ceil(y0)) };
        })()`);
        if (ph) {
          await js(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
          const pshot = await send('Page.captureScreenshot', { format: 'jpeg', quality, clip: { x: ph.x, y: ph.y, width: ph.w, height: ph.h, scale: 1 }, captureBeyondViewport: false, fromSurface: true });
          await js(`(() => { const s = document.querySelectorAll('.slide')[${i}], b = s.querySelector('.photo .ph'); s.style.visibility = ''; b.style.visibility = ''; b.style.borderRadius = ''; })()`);
          fs.mkdirSync(phDir, { recursive: true });
          const pfile = path.join(phDir, ph.ref.replace(/[^\w-]+/g, '-') + '.jpg');
          fs.writeFileSync(pfile, Buffer.from(pshot.data, 'base64'));
          photos.push({ ref: ph.ref, file: pfile, size: `${ph.w}x${ph.h}` });
        }
      }
    }
    ws.close();
    console.log(JSON.stringify({ ok: true, count: files.length, files, ...(phDir ? { photos } : {}) }, null, 2));
  } finally {
    cleanup();
  }
}

main().catch((e) => { console.error('카드 만들기 실패:', e.message); process.exit(1); });
