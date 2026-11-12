// 꿀꿀집 카드뉴스 — 다 만든 카드를 '꿀꿀집 마케팅 회사' 접수 창구로 보낸다 (Node 18+, 의존성 없음)
//
//   node send.mjs --dir 카드폴더 --caption caption.txt [--x x.txt] [--platforms instagram,x]
//                 [--links links.json] [--auto] [--video reel.mp4] [--key-file 열쇠파일] [--history 기록.json --used fs:123,os:456] [--dry-run]
//   --video: reel.mjs 가 만든 9:16 영상 → 먼저 /sns-tg/agent-video 로 올리고 intake 에 video_path — 받는 쪽이 인스타 릴스로도 올린다
//     (--platforms 를 안 주면 'reels' 가 저절로 붙는다). 영상 올리기가 실패하면 카드뉴스만 보낸다 (이유는 video.error).
//   --platforms reels: 릴스로만 (2026-11-12 승훈 님 "피드 말고 릴스로만, 무조건 릴스") — --video 가 꼭 있어야 하고(--dry-run 도 검사),
//     영상 올리기가 실패하면 접수 전에 멈춘다(종료 코드 1, 아무것도 안 올라감 — 다시 불러도 겹치지 않는다).
//   node send.mjs --publish-only --queue-id 7      (이미 접수된 초안을 지금 발행 — 자동 발행이 실패했을 때)
//
// 받는 곳: Supabase 엣지 함수 sns-tg 의 POST /intake (헤더 x-ggul-agent = 에이전트 열쇠).
//   접수되면 꿀꿀집 화면의 임시저장(🤖 제작 에이전트)으로 들어간다.
//   --auto 없음: 예전처럼 초안만 — 단톡방에 승인 미리보기가 가고 사람이 승인해야 게시.
//   --auto 있음 (2026-11-11 사용자 "컨펌 안 받고 바로바로 업로드, 텔레그램은 업로드 완료만"):
//     접수(미리보기 없이) → 딜 링크 → POST /sns-tg/agent-publish 로 바로 게시. 단톡방에는 받는 쪽이 '업로드 완료'만 보낸다.
//     게시가 실패하면 초안으로 남는다 (지우지 않음).
// 열쇠: 꿀꿀집 화면 '🤖 카드뉴스 제작 에이전트 열쇠 → 열쇠 만들기' 로 만든 값을 이 PC 의
//   %USERPROFILE%\.ggul\agent-key.txt 에 붙여넣어 둔다 (레포 · 채팅에 넣지 않는다).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const INTAKE = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/sns-tg/intake';
const CHECK = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/sns-tg/agent-check'; // 열쇠만 확인 (200 ok · 401)
// 꿀꿀집 링크 모음 페이지(brightbeed.kr/ggulggulzip)에 이번 카드의 딜 링크를 넘기는 곳 — 같은 열쇠, 게시된 뒤에만 페이지에 보임
const LINKS = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/ggul-links/agent-set';
// 자동 발행 (2026-11-11 사용자 "컨펌 안 받고 바로바로 업로드") — 받는 쪽 세션이 만드는 경로. 접수 · 링크 다음에 부른다(사이트가 먼저 뜨게)
const PUBLISH = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/sns-tg/agent-publish';
// 릴스 영상 (2026-11-11 승훈 님 "카드뉴스 여러 장을 릴스 영상으로 … 릴스도 업로드되게") — 본문 = MP4 그대로
const VIDEO = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/sns-tg/agent-video';
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024; // X 는 5MB 넘는 사진을 못 올린다 (인스타는 8MB)
const CAPTION_MAX = 2200;
const HASHTAG_MAX = 5; // 인스타가 2025-12부터 게시물 · 릴스당 5개까지 (2026-11-12, 예전 30)
const X_MAX = 280;

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? '1' : all[i + 1]]] : a), []),
);

// X 글자 수 — sns · sns-tg 함수와 같은 계산 (한글 · 이모지 2, 링크 23)
function xWeightedLength(text) {
  const s = text.normalize('NFC').replace(/https?:\/\/\S+/gi, 'x'.repeat(23));
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    n += c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037) ? 1 : 2;
  }
  return n;
}

function fail(msg) { console.error('보내기 실패: ' + msg); process.exit(1); }

// 공개 글에 비밀 값(토큰 · 열쇠 · 'KEY=값' 줄)이 섞이면 보내지 않는다 — 맥미니 무인 실행에서 남의 글에 속아
// 비밀을 옮겨 적는 일을 막는 마지막 그물 (2026-11-11). 상품명 · 해시태그 · 가격에는 걸리지 않는다.
const SECRET = [
  /\b(?:ghp|gho|ghs|ghu|github_pat|sk-ant|sk-proj|xox[abprs]|AKIA|AIza)[A-Za-z0-9_-]{10,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
  /\b[0-9a-f]{32,}\b/i,                          // 긴 16진수 (열쇠 · 해시)
  /[A-Za-z0-9+_-]{40,}/,                         // 띄어쓰기 없는 긴 덩어리 (base64 같은 것)
  /^\s*[A-Z][A-Z0-9_]{2,}\s*=\s*\S/m,           // .env 줄
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
function secretHit(s) {
  for (const re of SECRET) { const m = String(s ?? '').match(re); if (m) return m[0].slice(0, 4) + '…'; }
  return null;
}

function readKey() {
  const keyFile = path.resolve(args['key-file'] ?? path.join(os.homedir(), '.ggul', 'agent-key.txt'));
  if (!fs.existsSync(keyFile)) fail(`열쇠 파일이 없어요: ${keyFile} — 꿀꿀집 화면에서 '열쇠 만들기'로 만든 값을 붙여넣어 주세요.`);
  const key = fs.readFileSync(keyFile, 'utf8').trim();
  if (key.length < 20 || /\s/.test(key)) fail(`열쇠 파일 내용이 이상해요: ${keyFile} — 열쇠 한 줄만 들어 있어야 해요.`);
  return { key, keyFile };
}

// 열쇠가 맞는지만 서버에 물어본다 (아무것도 만들지 않음)
async function checkKey(key, keyFile) {
  let res;
  try { res = await fetch(CHECK, { headers: { 'x-ggul-agent': key }, signal: AbortSignal.timeout(30_000) }); } catch (e) { fail(`접수 창구에 연결하지 못했어요 — ${e.message}`); }
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) fail(`열쇠가 맞지 않아요 (${keyFile}) — 꿀꿀집 화면에서 열쇠를 새로 만들어 붙여넣어 주세요.`);
  if (res.status !== 200 || !j.ok) fail(`열쇠 확인 실패 — HTTP ${res.status} ${j.error ?? ''}`);
}

// links.json(links.mjs 가 만든 것) → POST /ggul-links/agent-set. 실패해도 카드 전송은 그대로 둔다 (이유만 알림)
async function sendLinks(key, queueId) {
  if (!args.links) return null;
  let spec;
  try { spec = JSON.parse(fs.readFileSync(path.resolve(args.links), 'utf8')); } catch (e) { return { ok: false, error: `links 파일을 읽지 못했어요 — ${e.message}` }; }
  const links = (spec.links ?? []).filter((l) => l && l.title && /^https?:\/\//.test(String(l.url ?? ''))).filter((l) => {
    const hit = secretHit(`${l.title}\n${l.note ?? ''}`);
    if (hit) console.error(`⚠ 링크 뺌 (비밀 값 같은 글자 ${hit}): ${String(l.title).slice(0, 30)}`);
    return !hit;
  }).slice(0, 30);
  if (!links.length) return { ok: false, error: '보낼 딜 링크가 없어요 (판매처 원래 주소가 있는 딜이 없음)' };
  const body = { queue_id: queueId, ...(spec.title ? { title: spec.title } : {}), ...(spec.subtitle ? { subtitle: spec.subtitle } : {}), ...(spec.as_of ? { as_of: spec.as_of } : {}), links };
  try { // 카드 제품 사진(image, base64)을 같이 올리면 받는 쪽이 저장소에 하나씩 올리느라 오래 걸릴 수 있다
    const res = await fetch(LINKS, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ggul-agent': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ok) {
      const saved = j.links ?? [];
      return { ok: true, page_url: j.page_url, count: saved.length, photos: saved.filter((l) => l.image).length, ...(j.warnings?.length ? { warnings: j.warnings } : {}) };
    }
    return { ok: false, error: `HTTP ${res.status} ${j.error ?? ''}`.trim() };
  } catch (e) { return { ok: false, error: e.message }; }
}

// 접수된 초안을 바로 게시 — POST /sns-tg/agent-publish {id} (받는 쪽 sns-tg v3, 2026-11-11).
// 다 올라간 뒤 답한다(보통 1분, 받는 쪽 요청 "150초 넘게 기다려 달라") → 200초.
//   ok:true          → status 'published'(전부) · 'partial'(일부, 예: X 크레딧 없음). 단톡방 '업로드 완료' 한 줄은 받는 쪽이 보냄
//   pending:true     → 응답만 늦은 것 (받는 쪽이 올리는 중) — 다시 부르지 않는다
//   mode 'confirm'   → 받는 쪽 자동 게시(tg_auto_publish)가 꺼져 있어 단톡방 승인 미리보기로 감
//   409              → 이미 올리기를 시작한 카드 — 같은 id 는 한 번만 올라간다
//   그 밖의 ok:false → 초안(draft)으로 남음 — --publish-only 로 다시 불러도 된다
//   응답 없음(시간 초과 · 끊김) → 받는 쪽은 올리는 중일 수 있으니 다시 부르지 않는다
async function publish(key, id) {
  try {
    const res = await fetch(PUBLISH, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ggul-agent': key }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(200_000) });
    const pj = await res.json().catch(() => ({}));
    const keep = {
      ...(pj.status ? { status: pj.status } : {}), ...(pj.results ? { results: pj.results } : {}),
      ...(pj.site !== undefined ? { site: pj.site } : {}), ...(pj.telegram !== undefined ? { telegram: pj.telegram } : {}),
      ...(pj.reel_pending ? { reel_pending: true } : {}), // 다른 곳은 끝났고 릴스만 인스타가 처리 중 — 받는 쪽이 몇 분 안에 마무리하고 단톡방에 한 줄
    };
    if (res.ok && pj.ok) return { ok: true, ...keep };
    if (pj.pending) return { ok: false, pending: true, ...keep, error: '받는 쪽이 아직 올리는 중이에요 (응답만 늦음) — 다시 부르지 않음' };
    if (pj.mode === 'confirm') return { ok: false, mode: 'confirm', ...keep, error: '받는 쪽 자동 게시가 꺼져 있어 단톡방 승인 미리보기로 갔어요' };
    if (res.status === 409) return { ok: false, already: true, ...keep, error: pj.error || '이미 올리기를 시작한 카드뉴스예요' };
    if (res.status === 404 && /없는 경로/.test(pj.error ?? '')) return { ok: false, ...keep, error: '자동 게시 경로가 없어요 — 초안으로 남김' };
    return { ok: false, ...keep, error: `HTTP ${res.status} ${pj.error ?? ''}`.trim() };
  } catch (e) {
    return { ok: false, unknown: true, error: `게시 응답을 못 받았어요 (${e.message}) — 받는 쪽이 올리는 중일 수 있어 다시 부르지 않음, 꿀꿀집 화면 게시 목록에서 확인` };
  }
}

async function main() {
  if (args['publish-only']) { // 이미 접수된 초안(임시저장 번호)을 지금 게시
    const qid = Number(args['queue-id']);
    if (!Number.isInteger(qid) || qid <= 0) fail('--publish-only 는 --queue-id 번호 가 필요해요.');
    const { key, keyFile } = readKey();
    await checkKey(key, keyFile);
    const r = await publish(key, qid);
    console.log(JSON.stringify({ queue_id: qid, published: r }, null, 2));
    if (!r.ok) process.exitCode = 1;
    return;
  }
  if (args['links-only']) { // 이미 보낸 카드(임시저장 번호)의 딜 링크만 보내기 · 다시 보내면 그 묶음을 통째로 바꿈
    const qid = Number(args['queue-id']);
    if (!Number.isInteger(qid) || qid <= 0 || !args.links) fail('--links-only 는 --queue-id 번호 와 --links 파일 이 필요해요.');
    const { key, keyFile } = readKey();
    await checkKey(key, keyFile);
    const r = await sendLinks(key, qid);
    console.log(JSON.stringify({ queue_id: qid, links: r }, null, 2));
    if (!r?.ok) process.exitCode = 1;
    return;
  }
  if (args['check-key']) { // 예약 작업이 수집 전에 먼저 부른다
    const { key, keyFile } = readKey();
    await checkKey(key, keyFile);
    console.log(JSON.stringify({ ok: true, key: 'valid' }));
    return;
  }
  if (!args.dir || !args.caption) fail('--dir 카드폴더 와 --caption 문구파일 이 필요해요.');
  const dir = path.resolve(args.dir);
  const files = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort();
  if (!files.length) fail(`${dir} 에 JPG 가 없어요.`);
  if (files.length > MAX_IMAGES) fail(`사진은 ${MAX_IMAGES}장까지예요 (지금 ${files.length}장).`);
  const images = files.map((f) => {
    const buf = fs.readFileSync(path.join(dir, f));
    if (buf.length < 1024 || buf.length > MAX_BYTES) fail(`${f} 크기가 이상해요 (1KB~5MB).`);
    if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) fail(`${f} 는 JPG 가 아니에요.`);
    return 'data:image/jpeg;base64,' + buf.toString('base64');
  });

  const caption = fs.readFileSync(path.resolve(args.caption), 'utf8').replace(/\r\n/g, '\n').trim();
  if (!caption) fail('문구가 비어 있어요.');
  if (caption.length > CAPTION_MAX) fail(`인스타 문구가 ${caption.length}자예요 (${CAPTION_MAX}자까지).`);
  const tags = (caption.match(/#[^\s#]+/g) ?? []).length;
  if (tags > HASHTAG_MAX) fail(`해시태그가 ${tags}개예요 (${HASHTAG_MAX}개까지).`);
  const xText = args.x ? fs.readFileSync(path.resolve(args.x), 'utf8').replace(/\r\n/g, '\n').trim() : '';
  if (xText && xWeightedLength(xText) > X_MAX) fail(`X 문구가 ${xWeightedLength(xText)}/${X_MAX} 이에요 (한글 2 · 링크 23으로 세요).`);
  if (/https?:\/\//i.test(xText)) console.error('⚠ X 문구에 링크가 있어요 — 링크 있는 글은 1개에 $0.20 이에요.');
  const leak = secretHit(caption) ?? secretHit(xText);
  if (leak) fail(`문구에 비밀 값 같은 글자가 있어요 (${leak}) — 보내지 않아요. 문구를 확인해 주세요.`);
  const platforms = args.platforms ? String(args.platforms).split(',').map((s) => s.trim()).filter(Boolean) : null;
  const reelsOnly = !!platforms?.length && platforms.every((p) => p === 'reels'); // 릴스로만 — 영상 없이는 보내지 않는다
  if (platforms?.includes('reels') && !args.video) fail('--platforms 에 reels 가 있으면 --video 영상(reel.mjs 로 만든 reel.mp4)이 꼭 있어야 해요.');
  let video = null; // 릴스 영상 (reel.mjs) — 모양만 먼저 검사
  if (args.video) {
    const vf = path.resolve(args.video);
    if (!fs.existsSync(vf)) fail(`영상 파일이 없어요: ${vf}`);
    const vb = fs.readFileSync(vf);
    if (vb.length < 10 * 1024 || vb.length > MAX_VIDEO_BYTES) fail(`영상 크기가 이상해요 (10KB~50MB, 지금 ${(vb.length / 1048576).toFixed(1)}MB).`);
    if (vb.toString('latin1', 4, 8) !== 'ftyp') fail(`${path.basename(vf)} 는 MP4 가 아니에요.`);
    video = { file: vf, bytes: vb };
    if (platforms && !platforms.includes('reels')) console.error("⚠ --platforms 에 reels 가 없어서 영상은 올라가지 않아요.");
  }

  const summary = { images: files.length, bytes: images.reduce((n, s) => n + s.length, 0), caption_chars: caption.length, hashtags: tags, x_weighted: xText ? xWeightedLength(xText) : null, platforms: platforms ?? (video ? '연결된 곳 전부 + 릴스' : '연결된 곳 전부'), ...(video ? { video_mb: +(video.bytes.length / 1048576).toFixed(2) } : {}) };
  if (args['dry-run']) { console.log(JSON.stringify({ ok: true, dry_run: true, ...summary }, null, 2)); return; }

  const { key, keyFile } = readKey();

  const post = async (payload, ms) => {
    const res = await fetch(INTAKE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ggul-agent': key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ms),
    });
    return { status: res.status, j: await res.json().catch(() => ({})) };
  };
  // 1) 열쇠부터 확인 (GET /sns-tg/agent-check — 아무것도 만들지 않음)
  await checkKey(key, keyFile);

  // 2) 릴스 영상 먼저 올리기 (실패하면 카드뉴스만 — 이유는 결과의 video.error)
  let videoRes = null;
  if (video) {
    try {
      const res = await fetch(VIDEO, { method: 'POST', headers: { 'Content-Type': 'video/mp4', 'x-ggul-agent': key }, body: video.bytes, signal: AbortSignal.timeout(120_000) });
      const vj = await res.json().catch(() => ({}));
      videoRes = res.ok && vj.ok && vj.path ? { ok: true, path: vj.path, mb: +(video.bytes.length / 1048576).toFixed(2) }
        : { ok: false, error: res.status === 404 ? '받는 쪽에 영상 받는 경로가 아직 없어요 (배포 전)' : `HTTP ${res.status} ${vj.error ?? ''}`.trim() };
    } catch (e) { videoRes = { ok: false, error: `영상을 올리지 못했어요 — ${e.message}` }; }
    if (!videoRes.ok && reelsOnly) fail(`릴스 영상을 올리지 못해 보내지 않았어요 — ${videoRes.error}`);
    if (!videoRes.ok) console.error(`⚠ 릴스 영상 올리기 실패 — 카드뉴스만 보내요: ${videoRes.error}`);
  }

  // 3) 진짜 보내기
  // --auto: 단톡방 승인 미리보기 없이 접수 → 링크 → 바로 발행
  const body = {
    images, caption, ...(xText ? { x_text: xText } : {}), ...(platforms ? { platforms } : {}), ...(args.auto ? { auto: true } : {}),
    ...(videoRes?.ok ? { video_path: videoRes.path } : {}),
  };
  let r;
  try { r = await post(body, 180_000); } catch (e) { fail(`보내는 중 끊겼어요 — ${e.message} (임시저장 목록에 들어갔는지 화면에서 확인해 주세요)`); }
  const j = r.j;
  if (r.status !== 200 || !j.ok) fail(`HTTP ${r.status} — ${j.error ?? '응답을 읽지 못했어요'}`);

  // 같은 글을 다음에 또 쓰지 않게 기록 (어미새 글 번호)
  if (args.history && args.used) {
    const hp = path.resolve(args.history);
    let h = { used: [] };
    try { if (fs.existsSync(hp)) h = JSON.parse(fs.readFileSync(hp, 'utf8')); } catch { h = { used: [] }; }
    const at = new Date().toISOString();
    for (const u of String(args.used).split(',').map((s) => s.trim()).filter(Boolean)) {
      const [board, id] = u.split(':');
      if (board && id) (h.used ??= []).push({ board, id, at, queue_id: j.id });
    }
    h.used = h.used.slice(-500);
    fs.mkdirSync(path.dirname(hp), { recursive: true });
    fs.writeFileSync(hp, JSON.stringify(h, null, 1));
  }
  const links = await sendLinks(key, j.id);
  if (links && !links.ok) console.error(`⚠ 딜 링크 보내기 실패 (카드는 보냄): ${links.error}`);
  for (const w of links?.warnings ?? []) console.error(`⚠ 링크 사진: ${w}`);
  // 자동 발행 — 링크를 보낸 뒤에 (실패하면 초안으로 남는다)
  let published = null;
  if (args.auto) {
    published = await publish(key, j.id);
    // 종료 코드: 0 = 게시됨(일부 포함) · 승인 미리보기로 감 / 2 = 초안으로 남음 / 3 = 결과 모름(올리는 중) — 2 · 3 모두 다시 보내지 않는다
    const miss = Object.entries(published.results ?? {}).filter(([, v]) => v && !v.ok && !v.pending).map(([k, v]) => `${k}: ${v.error ?? '실패'}`);
    if (published.ok && published.reel_pending) {
      console.error(`🎬 #${j.id}: 릴스는 인스타가 영상 처리 중 — 몇 분 안에 올라가고 단톡방에 한 줄 알려요${miss.length ? ` (못 올린 곳: ${miss.join(' / ')})` : ''}`);
    } else if (published.ok && published.status === 'partial') {
      console.error(`⚠ 일부만 게시됨 (#${j.id}) — ${miss.join(' / ') || '못 올린 곳 있음'}`);
    } else if (published.mode === 'confirm') console.error(`⚠ #${j.id}: ${published.error}`);
    else if (published.pending || published.unknown || published.already) { console.error(`⚠ #${j.id}: ${published.error}`); process.exitCode = 3; }
    else if (!published.ok) { console.error(`⚠ 자동 발행 실패 (초안 #${j.id} 로 남음): ${published.error}`); process.exitCode = 2; }
  }
  console.log(JSON.stringify({ ok: true, id: j.id, telegram: !!j.telegram, ...summary, ...(videoRes ? { video: videoRes } : {}), ...(links ? { links } : {}), ...(published ? { published } : {}) }, null, 2));
}

main().catch((e) => fail(e.message));
