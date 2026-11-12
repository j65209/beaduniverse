// 꿀꿀집 카드뉴스 → 릴스 영상 (Node 22+, 의존성 없음)
//
//   node reel.mjs --dir cards --out reel.mp4 [--intro intro.mp4] [--music music.mp3] [--data cards.json]
//                 [--sec 3] [--cover-sec 2.5] [--last-sec 2] [--intro-sec 5] [--volume 0.8] [--fps 30] [--mbps 6]
//
// render.mjs 가 만든 카드 JPG(1080×1350, 이름순)를 1080×1920(9:16) 영상으로 — 카드를 옆으로 넘기듯 바뀌고,
// 위쪽 줄(스토리처럼)이 몇 번째 카드인지 보여 준다. 소리가 없으면 무음 트랙(인스타가 소리 트랙 없는 영상을 거절할 때가 있어서).
// 2026-11-11 승훈 님 "매그내픽으로 … 자연스럽게 릴스" → 매그내픽 AI 로 만든
//   --intro  인트로 영상(꿀꿀이 캐릭터 5초, 9:16) — 맨 앞에 붙이고, 그 위 빈 곳에 표지 제목(--data cards.json 의 cover.kicker · title)을 얹는다.
//            첫 장면이 릴스 썸네일이 되므로 제목은 처음부터 보인다. 끝 0.5초는 표지 카드로 겹쳐 바뀐다.
//            제목 아래에 '꿀딜 N개' 빨간 배지(N = cards.json 딜 수, 없으면 카드 수 - 2) — 2026-11-12 승훈 님 "꿀딜 4개 5개 이런식으로 썸네일".
//   --music  배경음악(mp3 · wav · m4a) — 영상 길이에 맞춰 자르고 처음 0.25초 · 끝 1.5초를 줄여 넣는다(모자라면 반복).
//
// 헤드리스 Edge(없으면 Chrome)의 WebCodecs 로 H.264 · AAC 를 만들고, MP4 는 이 스크립트가 직접 묶는다
//   (moov 를 앞에 · 편집 목록 없음 — 인스타 릴스 규격). 다 만든 뒤 같은 브라우저로 재생해 보고 길이 · 크기를 확인한다.
// 띄운 브라우저는 따로 만든 임시 프로필을 쓰고, 끝나면 그 프로세스만 닫는다 (사용자 브라우저는 건드리지 않음).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? '1' : all[i + 1]]] : a), []),
);
if (!args.dir || !args.out) {
  console.error('쓰는 법: node reel.mjs --dir 카드폴더 --out reel.mp4 [--sec 3] [--cover-sec 2.5] [--last-sec 2]');
  process.exit(1);
}
const num = (v, d, lo, hi) => { const n = Number(v ?? d); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const W = 1080, H = 1920;
const OPT = {
  fps: Math.round(num(args.fps, 30, 24, 60)),
  sec: num(args.sec, 3, 1.5, 8), // 딜 카드 한 장 머무는 시간
  coverSec: num(args['cover-sec'], 2.5, 1, 8), // 표지
  lastSec: num(args['last-sec'], 2, 1, 8), // 마지막 장
  trans: 0.4, // 넘기는 시간
  zoom: num(args.zoom, 0, 0, 0.05), // 머무는 동안 조금씩 커지기 (기본 0 — 움직이면 용량이 커지고 글자가 덜 또렷해서)
  dither: args.dither === "1", // 배경 그러데이션 줄무늬가 보이면 --dither (아주 옅은 점무늬, 용량 약 +20%)
  scale: 0.88, // 카드 크기 (1080 → 950) — 아래 문구 · 오른쪽 버튼에 덜 가리게
  top: 300, // 카드 위쪽 (위 220px 쯤은 릴스 화면 제목이 덮는다)
  bitrate: Math.round(num(args.mbps, 6, 2, 20) * 1_000_000),
  introSec: num(args['intro-sec'], 2, 1, 10), // 인트로 길이 (2026-11-11 승훈 님 "인트로가 너무 길다, 바로바로 제품 소개로") — 영상 앞부분만 쓴다
  xfade: 0.4, // 인트로 → 첫 카드로 넘기는 시간
  volume: num(args.volume, 0.8, 0.05, 1), // 배경음악 크기
  hook: null, // 인트로 위 제목 {kicker, title}
  count: null, // 인트로 위 '꿀딜 N개' 배지 — 첫 장면이 릴스 썸네일 (2026-11-12 승훈 님 "꿀딜 4개 5개 이런식으로 썸네일")
  maxOff: null, // 배지 옆 '최대 N%↓' 스티커 — 카드와 같은 계산(정가 · 판매가), 10% 미만이면 안 붙임 (2026-11-12 "더 어그로 끌 수 있게")
};
// 카드(template.html won · discount)와 같은 할인율 계산 — 썸네일 숫자가 카드 숫자와 어긋나지 않게
const won = (s) => {
  s = String(s || '').replace(/정가|판매가|\s/g, '');
  if (!s || /[~～]|부터|최대|%/.test(s)) return null;
  let m = s.match(/^([\d,.]+)만(\d{1,4})?원?$/);
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 10000) + (m[2] ? Number(m[2]) : 0);
  m = s.match(/^([\d,]+)원?$/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};
const pctOf = (x) => {
  const was = won(x?.was), now = won(x?.price);
  if (was && now && now < was) return Math.floor(((was - now) / was) * 100);
  const off = /^(?:최대\s*)?(\d{1,2})\s*%/.exec(String(x?.off ?? '').trim()); // 정가 없이 '30%' 만 있는 딜 (카드 배지와 같은 값)
  return off ? Number(off[1]) : null;
};
// 표지 제목 — cards.json 의 cover (== 강조 == 는 꿀색 밑줄) · 딜 수 (표지 목록처럼 6개까지)
if (args.data && args.data !== '1') {
  try {
    const d = JSON.parse(fs.readFileSync(path.resolve(args.data), 'utf8'));
    if (d?.cover?.title) OPT.hook = { kicker: String(d.cover.kicker ?? '').slice(0, 40), title: String(d.cover.title).slice(0, 80) };
    if (Array.isArray(d?.deals) && d.deals.length) {
      OPT.count = Math.min(10, d.deals.length); // 카드와 같이 10개까지 (template.html render)
      const best = Math.max(0, ...d.deals.slice(0, 10).map((x) => pctOf(x) ?? 0));
      if (best >= 10 && best < 100) OPT.maxOff = best;
    }
  } catch (e) { console.error(`⚠ ${args.data} 를 읽지 못했어요 — 인트로 제목 없이 만들어요 (${e.message})`); }
}
const readMedia = (p, what) => {
  if (!p || p === '1') return null;
  const f = path.resolve(p);
  if (!fs.existsSync(f)) { console.error(`⚠ ${what} 파일이 없어요: ${f} — 빼고 만들어요.`); return null; }
  const b = fs.readFileSync(f);
  if (b.length > 60 * 1024 * 1024) { console.error(`⚠ ${what} 파일이 너무 커요 — 빼고 만들어요.`); return null; }
  return b;
};
let INTRO = readMedia(args.intro, '인트로 영상');
let MUSIC = readMedia(args.music, '배경음악');
let MUSIC_NAME = args.music ?? '';
const MEDIA = { intro: args.intro ? path.basename(args.intro) : null, music: args.music ? path.basename(args.music) : null };
const mime = (p) => (/\.wav$/i.test(p) ? 'audio/wav' : /\.(m4a|mp4|aac)$/i.test(p) ? 'audio/mp4' : 'audio/mpeg');

// --media auto : 매그내픽으로 미리 만든 인트로 · 배경음악 목록(레포 sns/agent/assets/assets.json)에서 시각마다 돌려 가며 고른다
//   (맥미니 · 예약 작업에서 매그내픽을 직접 부르지 않아도 되게). 못 받으면 인트로 · 음악 없이 만든다.
// --media <폴더> : 그 폴더의 assets.json 으로 (시험용)
const ASSET_BASE = 'https://raw.githubusercontent.com/j65209/beaduniverse/main/sns/agent/assets/';
async function loadMedia(spec) {
  const local = spec !== 'auto' && spec !== '1';
  const get = async (name) => {
    if (local) return fs.readFileSync(path.join(path.resolve(spec), name));
    const res = await fetch(ASSET_BASE + encodeURIComponent(name), { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`${name} HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
  try {
    const list = JSON.parse((await get('assets.json')).toString('utf8'));
    const hour = Math.floor(Date.now() / 3_600_000); // 실행 시각마다 다른 조합
    const intros = (list.intros ?? []).filter(Boolean), musics = (list.music ?? []).filter(Boolean);
    if (!INTRO && intros.length) { const n = intros[hour % intros.length]; INTRO = await get(n); MEDIA.intro = n; }
    if (!MUSIC && musics.length) { const n = musics[(hour * 7 + 3) % musics.length]; MUSIC = await get(n); MUSIC_NAME = n; MEDIA.music = n; }
  } catch (e) { console.error(`⚠ 인트로 · 배경음악을 받지 못했어요 (${e.message}) — 없이 만들어요.`); }
}
const MAX_BYTES = 50 * 1024 * 1024; // 받는 쪽(sns-media 버킷 · agent-video) 한도

const dir = path.resolve(args.dir);
const outFile = path.resolve(args.out);
const files = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort();
if (files.length < 2) { console.error(`${dir} 에 카드 JPG 가 2장 이상 있어야 해요 (지금 ${files.length}장).`); process.exit(1); }
if (files.length > 20) { console.error(`카드가 너무 많아요 (${files.length}장, 20장까지).`); process.exit(1); }

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

// ── 브라우저 쪽: 그림 그리기 · 인코딩 (WebCodecs 는 보안 출처에서만 돼서 file:// 페이지로 연다) ─────────────
const PAGE = String.raw`<!doctype html><meta charset="utf-8"><title>reel</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard-dynamic-subset.css">
<body style="margin:0;background:#f8f1e7">
<video id="v" muted playsinline style="display:none"></video>
<video id="iv" muted playsinline preload="auto" style="display:none"></video>
<script>
window.cards = [];
window.addCard = async (src) => { const bmp = await createImageBitmap(await (await fetch(src)).blob()); cards.push(bmp); return [bmp.width, bmp.height]; };
// 인트로 영상 — blob 주소로 열어야 캔버스가 '오염'되지 않는다 (file:// 영상은 VideoFrame 이 막힘)
window.setIntro = (src) => new Promise(async (res, rej) => {
  const v = document.getElementById('iv');
  v.onloadeddata = () => res({ duration: v.duration, w: v.videoWidth, h: v.videoHeight });
  v.onerror = () => rej(new Error('인트로 영상을 열지 못했어요 (' + (v.error && v.error.code) + ')'));
  v.src = URL.createObjectURL(await (await fetch(src)).blob());
});
window.setMusic = async (src) => { window.musicBuf = await (await fetch(src)).arrayBuffer(); return musicBuf.byteLength; };

window.build = async (o) => {
  const W = ${W}, H = ${H}, FPS = o.fps, n = cards.length, T = o.trans;
  const holds = cards.map((_, i) => (i === 0 ? o.coverSec : i === n - 1 ? o.lastSec : o.sec));
  const starts = []; let t = 0;
  for (let i = 0; i < n; i++) { starts.push(t); t += holds[i] + (i < n - 1 ? T : 0); }
  const iv = document.getElementById('iv');
  const introDur = iv.src ? Math.min(o.introSec, Math.floor(iv.duration * FPS) / FPS - 1 / FPS) : 0; // 마지막 프레임은 빼고
  const slideTotal = t, total = introDur + slideTotal, frames = Math.round(total * FPS);

  // 배경 — 카드와 같은 크림 · 분홍 · 꿀 (한 번만 그려 둔다)
  const bg = new OffscreenCanvas(W, H), b = bg.getContext('2d');
  b.fillStyle = '#f8f1e7'; b.fillRect(0, 0, W, H);
  const glow = (x, y, r, c) => { const g = b.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(248,241,231,0)'); b.fillStyle = g; b.fillRect(x - r, y - r, r * 2, r * 2); };
  glow(960, 120, 460, 'rgba(243,163,156,0.55)'); glow(80, 1840, 520, 'rgba(255,201,74,0.42)');
  glow(70, 250, 220, 'rgba(255,201,74,0.28)'); glow(1060, 1690, 260, 'rgba(243,163,156,0.32)');
  if (o.dither) { // 8비트 그러데이션은 압축하면 동심원 줄무늬가 보여서 ±1 단계 점무늬를 섞는다
    const im = b.getImageData(0, 0, W, H), px = im.data;
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < px.length; i += 4) { const d = rnd() < 0.5 ? -1 : 1; px[i] += d; px[i + 1] += d; px[i + 2] += d; }
    b.putImageData(im, 0, 0);
  }

  const cv = new OffscreenCanvas(W, H), ctx = cv.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const cw = Math.round(1080 * o.scale), ch = Math.round(1350 * o.scale), cx = (W - cw) / 2, cy = o.top, R = 34;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const card = (i, dx, z) => {
    const w = cw * z, h = ch * z, x = cx + (cw - w) / 2 + dx, y = cy + (ch - h) / 2;
    if (x > W || x + w < 0) return;
    ctx.save();
    ctx.shadowColor = 'rgba(110,72,40,0.20)'; ctx.shadowBlur = 46; ctx.shadowOffsetY = 18;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, R * z); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.clip();
    ctx.drawImage(cards[i], x, y, w, h);
    ctx.restore();
  };
  const segGap = 10, segH = 8, segY = cy - 40, segW = (cw - segGap * (n - 1)) / n;
  const bars = (i, fill) => {
    for (let k = 0; k < n; k++) {
      const x = cx + k * (segW + segGap);
      ctx.fillStyle = '#ead9c6'; ctx.beginPath(); ctx.roundRect(x, segY, segW, segH, segH / 2); ctx.fill();
      const f = k < i ? 1 : k === i ? fill : 0;
      if (f > 0) { ctx.fillStyle = '#ef5d50'; ctx.beginPath(); ctx.roundRect(x, segY, Math.max(segH, segW * f), segH, segH / 2); ctx.fill(); }
    }
  };
  const draw = (time) => {
    let i = n - 1;
    for (let k = 0; k < n; k++) if (time < starts[k] + holds[k] + (k < n - 1 ? T : 0)) { i = k; break; }
    const local = time - starts[i];
    ctx.drawImage(bg, 0, 0);
    if (local <= holds[i] || i === n - 1) { // 머무는 중
      card(i, 0, 1 + o.zoom * Math.min(1, local / holds[i]));
      bars(i, Math.min(1, local / holds[i]));
    } else { // i → i+1 넘기는 중 (나가는 카드는 조금 작아지며 왼쪽으로, 들어오는 카드는 오른쪽에서)
      const p = ease(Math.min(1, (local - holds[i]) / T)), z0 = 1 + o.zoom;
      card(i, -p * W, z0 - (z0 - 0.94) * p);
      card(i + 1, (1 - p) * W, 0.94 + 0.06 * p);
      bars(i + 1, 0);
    }
  };

  // ── 인트로: AI 영상(꽉 채움) + 위쪽 빈 곳에 표지 제목, 끝에서 표지 카드로 겹쳐 바뀜 ──
  const first = new OffscreenCanvas(W, H); // 카드 영상 첫 장면 (겹쳐 바뀔 때 씀)
  draw(0); first.getContext('2d').drawImage(cv, 0, 0);
  if (introDur && (o.hook || o.count)) await document.fonts.load('900 100px Pretendard', (o.hook?.kicker || '') + (o.hook?.title || '') + '꿀딜 0123456789개 최대%↓').catch(() => null);
  const hookFont = (px) => px + 'px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const drawHook = () => {
    if (!o.hook && !o.count) return;
    const left = 84, maxW = W - left * 2;
    let y = 290;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    if (o.hook?.kicker) { // 꿀색 알약
      ctx.font = '900 ' + hookFont(44);
      const kw = Math.min(maxW, ctx.measureText(o.hook.kicker).width + 60);
      ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.roundRect(left, y - 54, kw, 76, 18); ctx.fill();
      ctx.fillStyle = '#3a2c25'; ctx.fillText(o.hook.kicker, left + 30, y, maxW - 60);
      y += 70;
    }
    // 제목 — 줄마다 글자 크기를 맞추고 == 사이는 꿀색 밑줄
    if (o.hook) {
      const lines = o.hook.title.split('\n').slice(0, 3);
      let size = 108;
      const plain = (s) => s.replace(/==/g, '');
      ctx.font = '900 ' + hookFont(size);
      while (size > 64 && lines.some((l) => ctx.measureText(plain(l)).width > maxW)) { size -= 4; ctx.font = '900 ' + hookFont(size); }
      for (const line of lines) {
        y += size * 1.14;
        let x = left;
        line.split(/(==[^=]+==)/).filter(Boolean).forEach((part) => {
          const hi = /^==.*==$/.test(part), text = hi ? part.slice(2, -2) : part, w = ctx.measureText(text).width;
          if (hi) { ctx.fillStyle = '#ffc94a'; ctx.fillRect(x - 4, y - size * 0.32, w + 8, size * 0.36); }
          ctx.fillStyle = '#3a2c25'; ctx.fillText(text, x, y);
          x += w;
        });
      }
    }
    // '꿀딜 N개' 배지 — 첫 장면이 릴스 썸네일이 되니 제목 아래 크게 (빨간 바탕 · 숫자는 꿀색, 프로필 3:4 · 1:1 잘림 안쪽)
    if (o.count) {
      const size = 132, padX = 54, bh = 190, top = y + 66;
      const a = '꿀딜 ', num = String(o.count), b = '개';
      ctx.font = '900 ' + hookFont(size);
      const wa = ctx.measureText(a).width, wn = ctx.measureText(num).width, wb = ctx.measureText(b).width, bw = wa + wn + wb + padX * 2;
      ctx.fillStyle = 'rgba(58,44,37,0.2)'; ctx.beginPath(); ctx.roundRect(left + 8, top + 12, bw, bh, 48); ctx.fill();
      ctx.fillStyle = '#ef5d50'; ctx.beginPath(); ctx.roundRect(left, top, bw, bh, 48); ctx.fill();
      const base = top + bh / 2 + size * 0.36;
      let x = left + padX;
      ctx.fillStyle = '#ffffff'; ctx.fillText(a, x, base); x += wa;
      ctx.fillStyle = '#ffc94a'; ctx.fillText(num, x, base); x += wn;
      ctx.fillStyle = '#ffffff'; ctx.fillText(b, x, base);
      // '최대 N%↓' 꿀색 동그라미 스티커 — 배지 오른쪽 끝에 살짝 걸치게 (세로로 더 내려가지 않아 꿀꿀이를 안 가림)
      if (o.maxOff) {
        const dm = 236, cx = Math.min(W - dm / 2 - 24, left + bw + dm * 0.3), cy = top + bh / 2;
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(-0.12);
        ctx.fillStyle = 'rgba(58,44,37,0.22)'; ctx.beginPath(); ctx.arc(6, 10, dm / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.arc(0, 0, dm / 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.stroke();
        ctx.fillStyle = '#3a2c25'; ctx.textAlign = 'center';
        ctx.font = '900 ' + hookFont(52); ctx.fillText('최대', 0, -26);
        ctx.font = '900 ' + hookFont(80); ctx.fillText(o.maxOff + '%↓', 0, 56, dm - 36);
        ctx.restore();
      }
    }
    ctx.restore();
  };
  const seekTo = (s) => new Promise((res) => {
    if (Math.abs(iv.currentTime - s) < 1e-6 && iv.readyState >= 2) return res();
    const done = () => { iv.removeEventListener('seeked', done); res(); };
    iv.addEventListener('seeked', done); iv.currentTime = s;
  });
  // 끝 0.5초는 카드 넘기듯 — 인트로가 왼쪽으로 나가고 표지 카드 화면이 오른쪽에서 들어온다 (글자가 겹쳐 보이지 않게)
  const drawIntro = async (time) => {
    await seekTo(time);
    const p = time > introDur - o.xfade ? ease(Math.min(1, (time - (introDur - o.xfade)) / o.xfade)) : 0;
    const vw = iv.videoWidth, vh = iv.videoHeight, k = Math.max(W / vw, H / vh); // 꽉 채움 (넘치는 쪽은 잘림)
    ctx.save();
    ctx.translate(-p * W, 0);
    ctx.drawImage(iv, (W - vw * k) / 2, (H - vh * k) / 2, vw * k, vh * k);
    drawHook();
    ctx.restore();
    if (p > 0) ctx.drawImage(first, (1 - p) * W, 0);
  };

  // 영상 (H.264 High, 가변 비트레이트, 2초마다 키프레임)
  let err = null, avcC = null, asc = null;
  const vch = [], ach = [];
  const copyDesc = (d) => new Uint8Array(ArrayBuffer.isView(d) ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d.slice(0));
  const venc = new VideoEncoder({
    output: (c, m) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); vch.push({ k: c.type === 'key', t: c.timestamp, d }); if (!avcC && m?.decoderConfig?.description) avcC = copyDesc(m.decoderConfig.description); },
    error: (e) => { err = err || e; },
  });
  const vcfg = { codec: 'avc1.640028', width: W, height: H, bitrate: o.bitrate, framerate: FPS, bitrateMode: 'variable', latencyMode: 'quality', avc: { format: 'avc' } };
  if (!(await VideoEncoder.isConfigSupported(vcfg)).supported) throw new Error('이 브라우저는 H.264 인코딩을 못 해요');
  venc.configure(vcfg);
  for (let f = 0; f < frames; f++) {
    if (err) throw err;
    const time = f / FPS;
    if (time < introDur) await drawIntro(time); else draw(time - introDur);
    const fr = new VideoFrame(cv, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    venc.encode(fr, { keyFrame: f % (FPS * 2) === 0 });
    fr.close();
    while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
  }
  await venc.flush(); venc.close();
  if (err) throw err;
  if (!avcC) throw new Error('H.264 설정값(avcC)을 못 받았어요');
  for (let i = 1; i < vch.length; i++) if (vch[i].t <= vch[i - 1].t) throw new Error('프레임 순서가 뒤섞였어요 (B 프레임) — 지원하지 않는 인코더');

  // 소리 (AAC-LC 48kHz 스테레오) — 배경음악이 있으면 길이에 맞춰 섞고, 없으면 무음
  let audio = null, music = null;
  try {
    const SR = 48000, total_s = Math.round(total * SR);
    let pcm = null; // [왼쪽, 오른쪽] Float32Array
    if (window.musicBuf) {
      try {
        const off = new OfflineAudioContext(2, total_s, SR);
        const buf = await off.decodeAudioData(musicBuf.slice(0)); // 48kHz 로 바꿔 준다
        const src = off.createBufferSource(); src.buffer = buf; src.loop = buf.duration < total;
        const g = off.createGain(), end = total, vol = o.volume;
        g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(vol, 0.25);
        g.gain.setValueAtTime(vol, Math.max(0.3, end - 1.5)); g.gain.linearRampToValueAtTime(0, end);
        src.connect(g).connect(off.destination); src.start(0);
        const r = await off.startRendering();
        pcm = [r.getChannelData(0), r.getChannelData(1)];
        music = { seconds: +buf.duration.toFixed(2), looped: src.loop };
      } catch (e) { music = { error: String(e && e.message || e) }; }
    }
    const aenc = new AudioEncoder({
      output: (c, m) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); ach.push(d); if (!asc && m?.decoderConfig?.description) asc = copyDesc(m.decoderConfig.description); },
      error: (e) => { err = err || e; },
    });
    const acfg = { codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 128000 };
    if (!(await AudioEncoder.isConfigSupported(acfg)).supported) throw new Error('AAC 인코딩을 못 해요');
    aenc.configure(acfg);
    for (let s = 0; s < total_s; s += 1024) {
      const nf = Math.min(1024, total_s - s), data = new Float32Array(nf * 2);
      if (pcm) { data.set(pcm[0].subarray(s, s + nf), 0); data.set(pcm[1].subarray(s, s + nf), nf); } // planar: 왼쪽 다음 오른쪽
      aenc.encode(new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: nf, numberOfChannels: 2, timestamp: Math.round((s * 1e6) / SR), data }));
    }
    await aenc.flush(); aenc.close();
    if (err) throw err;
    audio = { sizes: ach.map((d) => d.length), asc: asc ? [...asc] : [0x11, 0x90] }; // 0x1190 = AAC-LC · 48kHz · 2ch
  } catch (e) { audio = { error: String(e && e.message || e) }; err = null; }

  // 한 덩어리로 (영상 다음 소리) — Node 가 잘라 받아 MP4 로 묶는다
  const parts = [...vch.map((c) => c.d), ...(audio.sizes ? ach : [])];
  const size = parts.reduce((s, p) => s + p.length, 0);
  const buf = new Uint8Array(size); let off = 0;
  for (const p of parts) { buf.set(p, off); off += p.length; }
  window.outBuf = buf;
  return {
    fps: FPS, frames, total, cards: n, bytes: size, intro: introDur ? +introDur.toFixed(2) : 0, music,
    avcC: [...avcC], vSizes: vch.map((c) => c.d.length), vKeys: vch.map((c, i) => (c.k ? i : -1)).filter((i) => i >= 0),
    audio,
  };
};
window.slice = (start, len) => new Promise((res) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] || '');
  r.readAsDataURL(new Blob([outBuf.subarray(start, start + len)]));
});
// 만든 MP4 를 실제로 재생해 보기 — 길이 · 크기 · 프레임이 나오는지
window.check = (src) => new Promise((res) => {
  const v = document.getElementById('v');
  const done = (x) => { v.pause(); res(x); };
  const to = setTimeout(() => done({ ok: false, error: '재생 확인 시간 초과' }), 20000);
  v.onerror = () => { clearTimeout(to); done({ ok: false, error: 'MP4 를 열지 못했어요 (' + (v.error && v.error.code) + ')' }); };
  v.onloadedmetadata = async () => {
    const meta = { duration: v.duration, w: v.videoWidth, h: v.videoHeight };
    try { await v.play(); } catch (e) { clearTimeout(to); return done({ ok: false, error: '재생 실패 ' + e.message, ...meta }); }
    setTimeout(() => { clearTimeout(to); const q = v.getVideoPlaybackQuality(); done({ ok: v.currentTime > 0.3 && q.totalVideoFrames > 5, played: v.currentTime, decoded: q.totalVideoFrames, ...meta }); }, 1500);
  };
  v.src = src;
});
</script>`;

// ── MP4 묶기 (ftyp · moov · mdat, 1초마다 영상/소리 번갈아) ────────────────────────────────────────
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n & 0xffff); return b; };
const zeros = (n) => Buffer.alloc(n);
function box(type, ...payload) { const body = Buffer.concat(payload); return Buffer.concat([u32(8 + body.length), Buffer.from(type, 'latin1'), body]); }
function full(type, version, flags, ...payload) { return box(type, u32(((version & 0xff) << 24) | (flags & 0xffffff)), ...payload); }
const MATRIX = Buffer.concat([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32));
function desc(tag, body) { if (body.length > 127) throw new Error('esds 가 너무 길어요'); return Buffer.concat([Buffer.from([tag, body.length]), body]); }

function mux(meta, data) {
  const v = { ts: meta.fps * 1000, delta: 1000, sizes: meta.vSizes, keys: meta.vKeys };
  const a = meta.audio?.sizes ? { ts: 48000, delta: 1024, sizes: meta.audio.sizes, asc: Buffer.from(meta.audio.asc) } : null;
  const vBytes = v.sizes.reduce((s, x) => s + x, 0);
  // 샘플 위치 (data 안): 영상 먼저 다음 소리
  const vOff = []; let o = 0; for (const s of v.sizes) { vOff.push(o); o += s; }
  const aOff = []; if (a) for (const s of a.sizes) { aOff.push(o); o += s; }
  if (o !== data.length) throw new Error(`받은 데이터 크기가 안 맞아요 (${data.length} ≠ ${o})`);

  // 덩어리(chunk): 트랙마다 1초씩, 시작 시각 순서로
  const chunks = [];
  const per = (count, perChunk, track) => { for (let i = 0; i < count; i += perChunk) chunks.push({ track, first: i, n: Math.min(perChunk, count - i) }); };
  per(v.sizes.length, meta.fps, 'v');
  if (a) per(a.sizes.length, Math.ceil(48000 / 1024), 'a');
  const startSec = (c) => (c.track === 'v' ? c.first / meta.fps : (c.first * 1024) / 48000);
  chunks.sort((x, y) => startSec(x) - startSec(y) || (x.track === 'v' ? -1 : 1));

  const vDur = v.sizes.length * v.delta, aDur = a ? a.sizes.length * a.delta : 0;
  const movieMs = Math.ceil(Math.max(vDur / v.ts, a ? aDur / a.ts : 0) * 1000);

  const stsc = (list) => { // 같은 개수 덩어리는 한 줄로
    const rows = []; list.forEach((c, i) => { if (!rows.length || rows[rows.length - 1][1] !== c.n) rows.push([i + 1, c.n, 1]); });
    return full('stsc', 0, 0, u32(rows.length), ...rows.flat().map(u32));
  };
  const build = (base) => {
    // base = mdat 안 데이터가 파일에서 시작하는 위치 → 덩어리 위치 계산
    let pos = base; const off = new Map();
    for (const c of chunks) {
      off.set(c, pos);
      const sz = c.track === 'v' ? v.sizes : a.sizes;
      for (let i = c.first; i < c.first + c.n; i++) pos += sz[i];
    }
    const vc = chunks.filter((c) => c.track === 'v'), ac = chunks.filter((c) => c.track === 'a');
    const hdlr = (type, name) => full('hdlr', 0, 0, u32(0), Buffer.from(type, 'latin1'), zeros(12), Buffer.from(name + '\0', 'latin1'));
    const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    const mdhd = (ts, dur) => full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u16(0x55c4), u16(0));
    const tkhd = (id, durMs, audio) => full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(durMs), zeros(8), u16(0), u16(audio ? 1 : 0), u16(audio ? 0x0100 : 0), u16(0), MATRIX, u32(audio ? 0 : W << 16), u32(audio ? 0 : H << 16));
    const name = Buffer.alloc(32); name[0] = 'ggul reel'.length; name.write('ggul reel', 1, 'latin1');
    const avc1 = box('avc1', zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(W), u16(H), u32(0x00480000), u32(0x00480000), u32(0), u16(1), name, u16(0x0018), u16(0xffff),
      box('avcC', Buffer.from(meta.avcC)), box('pasp', u32(1), u32(1)));
    const vtrak = box('trak',
      tkhd(1, Math.round((vDur / v.ts) * 1000), false),
      box('mdia', mdhd(v.ts, vDur), hdlr('vide', 'VideoHandler'),
        box('minf', full('vmhd', 0, 1, zeros(8)), dinf,
          box('stbl',
            full('stsd', 0, 0, u32(1), avc1),
            full('stts', 0, 0, u32(1), u32(v.sizes.length), u32(v.delta)),
            full('stss', 0, 0, u32(v.keys.length), ...v.keys.map((k) => u32(k + 1))),
            stsc(vc),
            full('stsz', 0, 0, u32(0), u32(v.sizes.length), ...v.sizes.map(u32)),
            full('stco', 0, 0, u32(vc.length), ...vc.map((c) => u32(off.get(c))))))));
    let atrak = Buffer.alloc(0);
    if (a) {
      const esds = full('esds', 0, 0, desc(0x03, Buffer.concat([u16(2), Buffer.from([0]),
        desc(0x04, Buffer.concat([Buffer.from([0x40, 0x15, 0, 0, 0]), u32(128000), u32(128000), desc(0x05, a.asc)])),
        desc(0x06, Buffer.from([0x02]))])));
      const mp4a = box('mp4a', zeros(6), u16(1), zeros(8), u16(2), u16(16), u16(0), u16(0), u32(48000 * 65536), esds);
      atrak = box('trak',
        tkhd(2, Math.round((aDur / a.ts) * 1000), true),
        box('mdia', mdhd(a.ts, aDur), hdlr('soun', 'SoundHandler'),
          box('minf', full('smhd', 0, 0, u16(0), u16(0)), dinf,
            box('stbl',
              full('stsd', 0, 0, u32(1), mp4a),
              full('stts', 0, 0, u32(1), u32(a.sizes.length), u32(a.delta)),
              stsc(ac),
              full('stsz', 0, 0, u32(0), u32(a.sizes.length), ...a.sizes.map(u32)),
              full('stco', 0, 0, u32(ac.length), ...ac.map((c) => u32(off.get(c))))))));
    }
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieMs), u32(0x00010000), u16(0x0100), u16(0), zeros(8), MATRIX, zeros(24), u32(a ? 3 : 2));
    return box('moov', mvhd, vtrak, atrak);
  };
  const ftyp = box('ftyp', Buffer.from('isom', 'latin1'), u32(512), Buffer.from('isomiso2avc1mp41', 'latin1'));
  const probe = build(0); // 크기만 알려고 (위치 값은 크기에 영향 없음)
  const base = ftyp.length + probe.length + 8;
  const moov = build(base);
  if (moov.length !== probe.length) throw new Error('moov 크기 계산이 어긋났어요');
  // mdat 안 순서 = 덩어리 순서
  const body = [];
  for (const c of chunks) {
    const offs = c.track === 'v' ? vOff : aOff, sz = c.track === 'v' ? v.sizes : a.sizes;
    body.push(data.subarray(offs[c.first], offs[c.first + c.n - 1] + sz[c.first + c.n - 1]));
  }
  const mdatLen = 8 + data.length;
  return { mp4: Buffer.concat([ftyp, moov, u32(mdatLen), Buffer.from('mdat', 'latin1'), ...body]), movieMs, vBytes };
}

async function main() {
  if (args.media) await loadMedia(args.media); // 인트로 · 배경음악 고르기 (--intro · --music 을 직접 주면 그게 먼저)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ggul-reel-'));
  const profile = path.join(tmp, 'profile');
  const pageFile = path.join(tmp, 'reel.html');
  const checkFile = path.join(tmp, 'check.mp4');
  fs.writeFileSync(pageFile, PAGE);
  const proc = spawn(findBrowser(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    // 맥미니 무인 실행: 크롬이 키체인 암호 창을 띄우면 아무도 못 눌러 멈춘다 → 가짜 키체인 (render.mjs 와 같게)
    ...(process.platform === 'darwin' ? ['--use-mock-keychain', '--password-store=basic'] : []),
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  const cleanup = () => {
    try {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else proc.kill('SIGKILL');
    } catch { /* 이미 닫힘 */ }
    for (let i = 0; i < 5; i++) {
      try { fs.rmSync(tmp, { recursive: true, force: true }); break; } catch { spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},400)']); }
    }
  };

  try {
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
    const pending = new Map(), waiters = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result); }
      else if (m.method) for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); }
    };
    const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
    const once = (method, ms = 30000) => new Promise((res, rej) => { waiters.push({ method, res }); setTimeout(() => rej(new Error(method + ' 기다리다 시간 초과')), ms); });
    const js = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };

    await send('Page.enable');
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: pathToFileURL(pageFile).href });
    await loaded;
    if (!(await js('isSecureContext && typeof VideoEncoder === "function"'))) throw new Error('이 브라우저는 WebCodecs(VideoEncoder)를 못 써요.');

    let introOk = false;
    if (INTRO) { // 매그내픽 인트로 — 못 열면 인트로 없이
      try {
        const iv = await js(`setIntro(${JSON.stringify('data:video/mp4;base64,' + INTRO.toString('base64'))})`);
        if (!(iv.duration >= 1)) throw new Error(`길이 ${iv.duration}초`);
        introOk = true;
      } catch (e) { console.error(`⚠ 인트로 영상을 못 써요 (${e.message}) — 인트로 없이 만들어요.`); await js(`document.getElementById('iv').removeAttribute('src'), true`); }
    }
    // 인트로가 있으면 표지 카드(01)는 빼고 바로 제품 카드부터 — 표지 제목은 인트로 위에 얹었으니 (--keep-cover 면 남김)
    const use = introOk && !args['keep-cover'] && files.length > 2 ? files.slice(1) : files;
    for (const f of use) {
      const b64 = fs.readFileSync(path.join(dir, f)).toString('base64');
      const [w, h] = await js(`addCard(${JSON.stringify('data:image/jpeg;base64,' + b64)})`);
      if (w !== 1080 || h !== 1350) console.error(`⚠ ${f} 크기가 ${w}×${h} 예요 (1080×1350 기준으로 늘이거나 줄여 넣음).`);
    }
    if (use.length !== files.length) OPT.coverSec = OPT.sec; // 첫 장도 제품 카드라 같은 시간
    if (!OPT.count && files.length >= 3) OPT.count = Math.min(10, files.length - 2); // cards.json 이 없으면 표지 · 마무리 빼고 센다
    if (MUSIC) await js(`setMusic(${JSON.stringify(`data:${mime(MUSIC_NAME)};base64,` + MUSIC.toString('base64'))})`);
    const t0 = Date.now();
    const meta = await js(`build(${JSON.stringify(OPT)})`);
    if (meta.audio?.error) console.error(`⚠ 소리 트랙을 못 만들었어요 (${meta.audio.error}) — 영상만 넣어요. 인스타가 거절하면 이게 원인일 수 있어요.`);
    if (meta.music?.error) console.error(`⚠ 배경음악을 못 넣었어요 (${meta.music.error}) — 무음으로 만들어요.`);
    // 데이터 받기 (4MB 씩)
    const parts = [];
    for (let at = 0; at < meta.bytes; at += 4 * 1024 * 1024) parts.push(Buffer.from(await js(`slice(${at}, ${4 * 1024 * 1024})`), 'base64'));
    const data = Buffer.concat(parts);
    const { mp4, movieMs } = mux(meta, data);
    if (mp4.length > MAX_BYTES) throw new Error(`영상이 너무 커요 (${(mp4.length / 1048576).toFixed(1)}MB) — --mbps 를 낮춰 주세요.`);

    // 재생해 보기
    fs.writeFileSync(checkFile, mp4);
    const chk = await js(`check(${JSON.stringify(pathToFileURL(checkFile).href)})`);
    if (!chk.ok) throw new Error(`만든 영상이 재생되지 않아요 — ${chk.error ?? JSON.stringify(chk)}`);
    if (chk.w !== W || chk.h !== H) throw new Error(`영상 크기가 이상해요 (${chk.w}×${chk.h})`);
    if (Math.abs(chk.duration - meta.total) > 0.5) throw new Error(`영상 길이가 이상해요 (${chk.duration}초, ${meta.total}초여야 함)`);

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, mp4);
    ws.close();
    console.log(JSON.stringify({
      ok: true, file: outFile, bytes: mp4.length, mb: +(mp4.length / 1048576).toFixed(2), seconds: +(movieMs / 1000).toFixed(2),
      size: `${W}x${H}`, fps: meta.fps, frames: meta.frames, cards: meta.cards, audio: !!meta.audio?.sizes, keyframes: meta.vKeys.length,
      intro_s: meta.intro, music: meta.music && !meta.music.error ? meta.music : false, hook: !!(meta.intro && OPT.hook),
      thumb_count: meta.intro && OPT.count ? OPT.count : null, // 썸네일(첫 장면)의 '꿀딜 N개'
      thumb_max_off: meta.intro && OPT.count && OPT.maxOff ? OPT.maxOff : null, // 그 옆 '최대 N%↓'
      media: { intro: meta.intro ? MEDIA.intro : null, music: meta.music && !meta.music.error ? MEDIA.music : null },
      took_s: Math.round((Date.now() - t0) / 1000),
    }, null, 2));
  } finally {
    cleanup();
  }
}

main().catch((e) => { console.error('릴스 영상 만들기 실패:', e.message); process.exit(1); });
