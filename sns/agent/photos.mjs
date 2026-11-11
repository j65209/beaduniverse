// 꿀꿀집 카드뉴스 — 고른 딜의 제품 사진 받기 (Node 18+, 의존성 없음)
//
//   node photos.mjs --deals deals.json --ids fs:210369345,os:210384141 --out img [--map photos.json]
//
// 판매처 상품 페이지의 대표 이미지(og:image)만 쓴다. 어미새 글쓴이 사진 · 썸네일은 쓰지 않는다.
// 판매처 robots.txt 가 일반 수집기(*)를 막으면 받지 않는다 — 2026-11 기준 네이버 스마트스토어 · 브랜드스토어,
// 롯데ON, 무신사, 11번가는 'Disallow: /', 쿠팡은 robots.txt 자체가 403 이라 막힌 걸로 친다. 29CM 는 허용.
// robots.txt 가 404 면 허용, 401 · 403 · 5xx · 연결 실패면 막힌 걸로 친다 (봇 차단 중인 곳까지 긁지 않게).
// 사진 저작권은 판매처 · 브랜드에 있다 — 카드에 쓰는 건 사용자 결정(2026-11-11).

import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (compatible; CardNewsCollector/1.0)';
const UA_TOKEN = 'cardnewscollector';
const HOST_GAP_MS = 3000;
const MAX_BYTES = 8 * 1024 * 1024;

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? '1' : all[i + 1]]] : a), []),
);

const lastHit = new Map();
async function politeFetch(url, opts = {}) {
  const host = new URL(url).host;
  const gap = host === 'eomisae.co.kr' ? 5200 : HOST_GAP_MS; // 어미새 robots.txt Crawl-delay: 5
  const wait = (lastHit.get(host) ?? 0) + gap - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
  return fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000), ...opts, headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', ...(opts.headers ?? {}) } });
}

// ── robots.txt ──────────────────────────────────────────────────────────
const robotsCache = new Map();
function parseRobots(txt) {
  const groups = [];
  let cur = null, lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      cur.rules.push({ allow: key === 'allow', path: val });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  return groups;
}
// robots.txt 경로 규칙: 앞에서부터 맞춤, * 는 아무 글자, 끝의 $ 는 '여기서 끝'
function ruleMatches(pattern, target) {
  if (!pattern) return false;
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + body + (anchored ? '$' : '')).test(target);
}
async function robotsAllows(url) {
  const u = new URL(url);
  let groups = robotsCache.get(u.host);
  if (groups === undefined) {
    try {
      const res = await politeFetch(`${u.protocol}//${u.host}/robots.txt`);
      if (res.status === 404 || res.status === 410) groups = [];
      else if (!res.ok) groups = null; // 401 · 403 · 5xx — 막힌 걸로
      else groups = parseRobots(await res.text());
    } catch { groups = null; }
    robotsCache.set(u.host, groups);
  }
  if (groups === null) return { ok: false, why: `${u.host} robots.txt 를 읽을 수 없음(차단)` };
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && UA_TOKEN.includes(a)));
  const pick = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  const target = u.pathname + u.search;
  let best = null;
  for (const g of pick) for (const r of g.rules) {
    if (r.path === '' && !r.allow) continue; // 빈 Disallow = 다 허용
    if (ruleMatches(r.path, target) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  }
  return best && !best.allow ? { ok: false, why: `${u.host} robots.txt 가 막음 (${best.path})` } : { ok: true };
}

// ── og:image ────────────────────────────────────────────────────────────
function metaContent(html, names) {
  for (const n of names) {
    const a = html.match(new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${n}["'][^>]*content\\s*=\\s*["']([^"']+)["']`, 'i'))
      ?? html.match(new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:property|name)\\s*=\\s*["']${n}["']`, 'i'));
    if (a) return a[1].replace(/&amp;/g, '&');
  }
  return null;
}
const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

async function photoFor(item, outDir) {
  if (!item.store_url) return { ok: false, why: '판매처 링크 없음' };
  const r1 = await robotsAllows(item.store_url);
  if (!r1.ok) return { ok: false, why: r1.why };
  const page = await politeFetch(item.store_url);
  if (!page.ok) return { ok: false, why: `상품 페이지 HTTP ${page.status}` };
  const finalUrl = page.url || item.store_url;
  if (new URL(finalUrl).host !== new URL(item.store_url).host) {
    const r2 = await robotsAllows(finalUrl);
    if (!r2.ok) return { ok: false, why: r2.why };
  }
  const html = await page.text();
  // 판매처가 페이지에 적어 둔 정가 · 판매가 (29CM 은 consumerPrice · sellPrice) — 정가 대비 할인율 근거로만 쓴다
  const num = (re) => { const m = html.match(re); return m ? Number(m[1]) : null; };
  const prices = {
    list: num(/\\?"(?:consumerPrice|originalPrice|listPrice|normalPrice|retailPrice)\\?"\s*:\s*(\d{3,9})/),
    sale: num(/\\?"(?:sellPrice|salePrice|discountedPrice)\\?"\s*:\s*(\d{3,9})/) ?? num(/"price"\s*:\s*"?(\d{3,9})"?\s*,\s*"priceCurrency"\s*:\s*"KRW"/),
  };
  let src = metaContent(html, ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image']);
  if (!src) return { ok: false, why: '대표 이미지(og:image) 없음', prices };
  src = new URL(src, finalUrl).href;
  const r3 = await robotsAllows(src);
  if (!r3.ok) return { ok: false, why: r3.why, prices };
  const img = await politeFetch(src, { headers: { Referer: finalUrl } });
  if (!img.ok) return { ok: false, why: `사진 HTTP ${img.status}`, prices };
  const type = (img.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const buf = Buffer.from(await img.arrayBuffer());
  if (!EXT[type] || buf.length < 2000 || buf.length > MAX_BYTES) return { ok: false, why: `사진 형식 · 크기 이상 (${type || '?'}, ${buf.length}B)`, prices };
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${item.board}-${item.id}.${EXT[type]}`);
  fs.writeFileSync(file, buf);
  return { ok: true, file: path.relative(process.cwd(), file).replace(/\\/g, '/'), src, store_host: new URL(finalUrl).host, prices };
}

// 사진 크기 (JPEG · PNG · WebP) — 자를 곳을 고를 때 참고
function imageSize(buf) {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const mk = buf[i + 1], len = buf.readUInt16BE(i + 2);
        if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
        i += 2 + len;
      }
    }
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const f = buf.toString('ascii', 12, 16);
      if (f === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
      if (f === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
      if (f === 'VP8L') { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
    }
  } catch { /* 모르면 크기 없이 */ }
  return null;
}

// 판매처가 막혀 있을 때 — 어미새 글 본문에 첨부된 사진(img.eomisae.co.kr/files/attach, robots 제한 없음)을 받아 둔다.
// 대개 판매처 상품 화면 캡처라서, 카드 만드는 쪽이 사진을 보고 상품 사진 부분만 imageCrop 으로 잘라 쓴다.
// 글쓴이가 직접 찍은 사진(손에 든 사진 · 택배 상자 등)으로 보이면 쓰지 않는다.
async function eomisaeImages(item, outDir, max = 3) {
  const page = await politeFetch(item.url);
  if (!page.ok) return [];
  const html = await page.text();
  const ci = html.search(/<div\s+class="document_\d+_\d+[^"]*xe_content[^"]*"[^>]*>/);
  if (ci < 0) return [];
  const ce = html.indexOf('<!--AfterDocument', ci);
  const body = html.slice(ci, ce > ci ? ce : ci + 20000);
  const srcs = [...new Set([...body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1].replace(/&amp;/g, '&'), 'https://eomisae.co.kr/').href))]
    .filter((u) => /^https:\/\/img\.eomisae\.co\.kr\/files\/attach\//.test(u)).slice(0, max);
  const files = [];
  for (const [n, src] of srcs.entries()) {
    const r = await robotsAllows(src);
    if (!r.ok) continue;
    const img = await politeFetch(src, { headers: { Referer: item.url } });
    const type = (img.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!img.ok || !EXT[type]) continue;
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length < 2000 || buf.length > MAX_BYTES) continue;
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${item.board}-${item.id}-e${n + 1}.${EXT[type]}`);
    fs.writeFileSync(file, buf);
    files.push({ file: path.relative(process.cwd(), file).replace(/\\/g, '/'), ...(imageSize(buf) ?? {}) });
  }
  return files;
}

async function main() {
  if (!args.deals || !args.ids || !args.out) { console.error('쓰는 법: node photos.mjs --deals deals.json --ids fs:1,os:2 --out img [--map photos.json]'); process.exit(1); }
  const deals = JSON.parse(fs.readFileSync(args.deals, 'utf8')).items ?? [];
  const out = {};
  for (const key of String(args.ids).split(',').map((s) => s.trim()).filter(Boolean)) {
    const [board, id] = key.split(':');
    const item = deals.find((d) => d.board === board && d.id === id);
    if (!item) { out[key] = { ok: false, why: 'deals.json 에 없는 글' }; continue; }
    try { out[key] = await photoFor(item, path.resolve(args.out)); } catch (e) { out[key] = { ok: false, why: e.message }; }
    if (!out[key].ok) { // 판매처 사진이 없으면 어미새 첨부 캡처를 후보로
      try { out[key].eomisae = await eomisaeImages(item, path.resolve(args.out)); } catch (e) { out[key].eomisae = []; out[key].eomisae_error = e.message; }
    }
    console.error(`${key}: ${out[key].ok ? '판매처 사진 받음' : `판매처 사진 없음 (${out[key].why}) → 어미새 첨부 ${out[key].eomisae?.length ?? 0}장`}`);
  }
  const json = JSON.stringify(out, null, 2);
  if (args.map) fs.writeFileSync(args.map, json); else process.stdout.write(json + '\n');
}

export { parseRobots, robotsAllows, ruleMatches };
if (process.argv[1] && import.meta.url === new URL('file:///' + process.argv[1].replace(/\\/g, '/').replace(/^\/+/, '')).href) {
  main().catch((e) => { console.error('사진 받기 실패:', e.message); process.exit(1); });
}
