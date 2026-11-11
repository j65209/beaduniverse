// 꿀꿀집 마케팅 회사 / 텔레그램 컨펌 (Supabase 엣지 함수 "sns-tg")
// 흐름: 카드뉴스(임시저장) → 단톡방에 미리보기(사진 + 문구 + 버튼) → 승인자(승훈 님)만 버튼 →
//       sns 함수가 인스타·X·스레드에 올림 → sns 가 /notify 로 알려 주면 같은 메시지에 결과(링크·실패 이유)
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false (텔레그램이 부르는 주소라서)
// 비밀값(봇 토큰·웹훅 비밀·에이전트 열쇠 해시)은 public.sns_settings(서버 전용)에만. 응답·로그로 내보내지 않는다.
//
//   GET  /sns-tg/status            봇·단톡방 연결 상태 (비밀값 없음)
//   POST /sns-tg/setup {token}     봇 토큰 저장 + 웹훅 연결 (등록된 브라우저만 · 토큰은 화면에서 승훈 님이 붙여넣음)
//   POST /sns-tg/link-code         단톡방 연결 코드(15분) — 단톡방에서 /link@봇 코드 를 보낸 사람이 승인자가 된다 (등록된 브라우저만)
//   POST /sns-tg/send {id}         임시저장을 단톡방에 미리보기로 보내기 (등록된 브라우저만)
//   POST /sns-tg/agent-key         카드뉴스 제작 에이전트 열쇠 새로 만들기 — 한 번만 보여 줌 (등록된 브라우저만)
//   POST /sns-tg/intake            제작 에이전트가 카드뉴스를 보내는 곳 (헤더 x-ggul-agent) → 임시저장 + 미리보기
//   POST /sns-tg/notify {id}       sns 함수가 올린 뒤 결과 알림 (헤더 x-ggul-cron = sns_settings.cron_key)
//   POST /sns-tg/webhook           텔레그램 (헤더 X-Telegram-Bot-Api-Secret-Token)
// 올리기·예약·다시 시도는 sns 함수(/queue/publish · /queue/retry · /queue)를 cron 열쇠로 불러서 한다 — 검사·게시 코드는 sns 한 곳에만.

import { createClient } from 'npm:@supabase/supabase-js@2';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SNS = `${SUPABASE_URL}/functions/v1/sns`;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/sns-tg/webhook`;
const ORIGINS = new Set(['https://j65209.github.io', 'https://beaduniverse.kr', 'https://www.beaduniverse.kr']);
const BUCKET = 'sns-media';
const DAY_MS = 86_400_000;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const LINK_TTL_MS = 15 * 60_000;
const NAMES: Record<string, string> = { instagram: '인스타', threads: '스레드', x: 'X' };
const QFIELDS = 'id, status, platforms, image_paths, caption, threads_text, x_text, results, tg, scheduled_at, note';
const SETTING_KEYS = ['tg_bot_token', 'tg_bot_username', 'tg_webhook_secret', 'tg_chat_id', 'tg_chat_title', 'tg_approver_id', 'tg_approver_name', 'tg_link_code', 'tg_link_expires'];

const sb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Settings = Record<string, string | undefined>;
type Row = {
  id: number; status: string; platforms: string[]; image_paths: string[]; caption: string | null; threads_text: string | null;
  x_text: string | null; results: Record<string, any> | null; tg: { chat_id: string; card_id: number; media_ids?: number[] } | null;
  scheduled_at: string | null; note: string | null;
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const publicUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.has(origin) ? origin : 'https://j65209.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ggul-device',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function reply(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
// 오래 걸리는 일(올리기)은 텔레그램에 먼저 답하고 뒤에서 계속한다
function background(p: Promise<unknown>) {
  const safe = p.catch((e) => console.error('sns-tg bg', errMsg(e)));
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(safe);
}

// ── 설정 · 인증 ───────────────────────────────────────────────────────────

async function getSettings(keys: string[]): Promise<Settings> {
  const { data, error } = await sb.from('sns_settings').select('key, value').in('key', keys);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
}
async function setSettings(kv: Record<string, string | null>) {
  const now = new Date().toISOString();
  const up = Object.entries(kv).filter(([, v]) => v !== null).map(([key, value]) => ({ key, value: value as string, updated_at: now }));
  const del = Object.entries(kv).filter(([, v]) => v === null).map(([k]) => k);
  if (up.length) { const { error } = await sb.from('sns_settings').upsert(up, { onConflict: 'key' }); if (error) throw error; }
  if (del.length) { const { error } = await sb.from('sns_settings').delete().in('key', del); if (error) throw error; }
}
function safeEq(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sha256hex(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function randomToken(n: number, alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-') {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => alphabet[x % alphabet.length]).join('');
}
// 등록된 브라우저 (sns 함수와 같은 방식 — 헤더 키의 sha256 이 sns_devices 에 approved 로 있어야)
async function approvedDevice(req: Request) {
  const key = req.headers.get('x-ggul-device') ?? '';
  if (key.length < 32 || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) return false;
  const { data } = await sb.from('sns_devices').select('id, status').eq('key_hash', await sha256hex(key)).maybeSingle();
  if (!data || data.status !== 'approved') return false;
  await sb.from('sns_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id);
  return true;
}
let cronKey: string | null = null;
async function loadCronKey() {
  if (!cronKey) cronKey = (await getSettings(['cron_key'])).cron_key ?? null;
  return cronKey;
}
async function isInternal(req: Request) {
  const key = await loadCronKey();
  return !!key && safeEq(req.headers.get('x-ggul-cron') ?? '', key);
}
async function agentOk(req: Request) {
  const got = req.headers.get('x-ggul-agent') ?? '';
  if (got.length < 20) return false;
  const { agent_key_hash } = await getSettings(['agent_key_hash']);
  return !!agent_key_hash && safeEq(await sha256hex(got), agent_key_hash);
}
// sns 함수 부르기 — 검사·게시는 그쪽에 (cron 열쇠로 '내부 요청' 표시)
async function callSns(path: string, body: unknown) {
  const res = await fetch(SNS + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ggul-cron': (await loadCronKey()) ?? '' },
    body: JSON.stringify(body),
  });
  return await res.json().catch(() => ({ ok: false, error: `sns 응답 ${res.status}` }));
}

// ── 텔레그램 ─────────────────────────────────────────────────────────────

async function tg(token: string, method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!j?.ok) throw new Error(`텔레그램 ${method} 실패 — ${j?.description || res.status}`); // 토큰(주소)은 메시지에 넣지 않는다
  return j.result;
}
const btn = (text: string, data: string) => ({ text, callback_data: data });
const draftKeyboard = (id: number) => [
  [btn('✅ 지금 올리기', `go:${id}`), btn('⏰ 저녁 7시', `at:${id}:19`), btn('⏰ 아침 9시', `at:${id}:9`)],
  [btn('✏️ 수정 요청', `ed:${id}`), btn('🗑 버리기', `no:${id}`)],
];
async function editCard(token: string, chatId: string | number, messageId: number, text: string, keyboard: unknown[][] | null) {
  await tg(token, 'editMessageText', {
    chat_id: chatId, message_id: messageId, text: text.slice(0, 4000),
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

function xWeightedLength(text: string) { // sns 함수 · 화면과 같은 계산 (한글·이모지 2, 링크 23)
  const s = text.normalize('NFC').replace(/https?:\/\/\S+/gi, 'x'.repeat(23));
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    n += c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037) ? 1 : 2;
  }
  return n;
}
function clip(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s; }
function fmtKst(d: Date) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
// 다음 '한국 시각 hour:00' (5분 안쪽이면 다음 날)
function nextKst(hour: number) {
  const now = Date.now();
  const k = new Date(now + 9 * 3_600_000);
  let t = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), hour, 0) - 9 * 3_600_000;
  if (t < now + 5 * 60_000) t += DAY_MS;
  return new Date(t);
}

function cardText(row: Row) {
  const plats = row.platforms ?? [];
  const n = (row.image_paths ?? []).length;
  const out = [`📝 카드뉴스 #${row.id} · ${plats.map((p) => NAMES[p] ?? p).join('·')} · 사진 ${n}장${plats.includes('x') && n > 4 ? ' (X 는 앞 4장)' : ''}`];
  if (plats.includes('instagram') && row.caption) out.push('', '— 인스타 —', clip(row.caption, 1500));
  if (plats.includes('threads') && row.threads_text && row.threads_text !== (row.caption ?? '').slice(0, 500)) out.push('', '— 스레드 —', clip(row.threads_text, 500));
  if (plats.includes('x') && row.x_text) out.push('', `— X (${xWeightedLength(row.x_text)}/280) —`, row.x_text);
  return out.join('\n');
}
function resultLines(row: Row) {
  const r = row.results ?? {};
  return (row.platforms ?? []).map((p) => (r[p]?.ok ? `✓ ${NAMES[p] ?? p}${r[p].permalink ? ' ' + r[p].permalink : ''}` : `✕ ${NAMES[p] ?? p}: ${r[p]?.error ?? '결과 없음'}`)).join('\n');
}
const stateText = (row: Row) => ({ draft: '아직 임시저장이에요.', scheduled: '이미 예약됐어요.', publishing: '지금 올리는 중이에요.', published: '이미 올라갔어요.', partial: '일부만 올라갔어요.', failed: '올리지 못한 상태예요.', canceled: '버린 카드뉴스예요.' } as Record<string, string>)[row.status] ?? row.status;

async function loadRow(id: number): Promise<Row | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  const { data, error } = await sb.from('sns_queue').select(QFIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Row | null;
}

// 단톡방에 미리보기 — 사진 묶음(버튼을 못 단다) + 문구·버튼 메시지
async function sendPreview(row: Row, s: Settings) {
  const token = s.tg_bot_token!, chatId = s.tg_chat_id!;
  const urls = (row.image_paths ?? []).slice(0, MAX_IMAGES).map(publicUrl);
  const mediaIds: number[] = [];
  if (urls.length >= 2) {
    const res = await tg(token, 'sendMediaGroup', { chat_id: chatId, media: urls.map((u, i) => ({ type: 'photo', media: u, ...(i === 0 ? { caption: `카드뉴스 #${row.id}` } : {}) })) });
    for (const m of res ?? []) mediaIds.push(m.message_id);
  } else if (urls.length === 1) {
    const m = await tg(token, 'sendPhoto', { chat_id: chatId, photo: urls[0], caption: `카드뉴스 #${row.id}` });
    mediaIds.push(m.message_id);
  }
  const who = s.tg_approver_name ? `${s.tg_approver_name} 님` : '승인자';
  const card = await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: (cardText(row) + `\n\n버튼은 ${who}만 누를 수 있어요.`).slice(0, 4000),
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: draftKeyboard(row.id) },
  });
  const { error } = await sb.from('sns_queue').update({ tg: { chat_id: String(chatId), card_id: card.message_id, media_ids: mediaIds, sent_at: new Date().toISOString() } }).eq('id', row.id);
  if (error) throw error;
}

// ── 화면에서 부르는 곳 ─────────────────────────────────────────────────────

async function status(req: Request) {
  const s = await getSettings(['tg_bot_username', 'tg_chat_id', 'tg_chat_title', 'tg_approver_name', 'agent_key_hash']);
  return reply(req, 200, { ok: true, bot: s.tg_bot_username ?? null, linked: !!s.tg_chat_id, chat_title: s.tg_chat_title ?? null, approver: s.tg_approver_name ?? null, agent_key: !!s.agent_key_hash });
}

async function setup(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, { ok: false, error: '등록된 브라우저에서만 할 수 있어요.' });
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? '').trim();
  if (!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(token)) {
    return reply(req, 400, { ok: false, error: "봇 토큰 모양이 아니에요. BotFather 가 준 '숫자:긴 글자' 값을 그대로 붙여넣어 주세요." });
  }
  let me: any;
  try { me = await tg(token, 'getMe', {}); } catch (e) { return reply(req, 400, { ok: false, error: `텔레그램이 이 토큰을 받지 않았어요 — ${errMsg(e)}` }); }
  const before = await getSettings(['tg_bot_username']);
  const secret = randomToken(48);
  try {
    await tg(token, 'setWebhook', { url: WEBHOOK_URL, secret_token: secret, allowed_updates: ['message', 'callback_query', 'my_chat_member'], drop_pending_updates: true });
  } catch (e) { return reply(req, 400, { ok: false, error: `웹훅을 연결하지 못했어요 — ${errMsg(e)}` }); }
  const kv: Record<string, string | null> = { tg_bot_token: token, tg_bot_username: String(me.username ?? ''), tg_webhook_secret: secret };
  if (before.tg_bot_username && before.tg_bot_username !== me.username) { // 다른 봇이면 단톡방 연결은 새로
    Object.assign(kv, { tg_chat_id: null, tg_chat_title: null, tg_approver_id: null, tg_approver_name: null });
  }
  await setSettings(kv);
  return reply(req, 200, { ok: true, bot: me.username });
}

async function linkCode(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, { ok: false, error: '등록된 브라우저에서만 할 수 있어요.' });
  const s = await getSettings(['tg_bot_username']);
  if (!s.tg_bot_username) return reply(req, 400, { ok: false, error: '먼저 봇 토큰을 저장해 주세요.' });
  const code = randomToken(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  await setSettings({ tg_link_code: code, tg_link_expires: new Date(Date.now() + LINK_TTL_MS).toISOString() });
  return reply(req, 200, { ok: true, code, bot: s.tg_bot_username, command: `/link@${s.tg_bot_username} ${code}` });
}

async function send(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, { ok: false, error: '등록된 브라우저에서만 할 수 있어요.' });
  const body = await req.json().catch(() => ({}));
  const s = await getSettings(SETTING_KEYS);
  if (!s.tg_bot_token || !s.tg_chat_id) return reply(req, 400, { ok: false, error: '텔레그램 봇과 단톡방부터 연결해 주세요.' });
  const row = await loadRow(Number(body?.id));
  if (!row) return reply(req, 404, { ok: false, error: '없는 카드뉴스예요.' });
  if (row.status !== 'draft') return reply(req, 409, { ok: false, error: '임시저장 상태인 것만 보낼 수 있어요.' });
  if (row.tg?.card_id) { // 예전에 보낸 미리보기의 버튼은 끈다
    await editCard(s.tg_bot_token, row.tg.chat_id, row.tg.card_id, cardText(row) + '\n\n↪ 고친 내용으로 새 미리보기를 보냈어요 (이 메시지 버튼은 꺼짐).', null).catch(() => {});
  }
  try { await sendPreview(row, s); } catch (e) { return reply(req, 502, { ok: false, error: errMsg(e) }); }
  return reply(req, 200, { ok: true });
}

async function agentKey(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, { ok: false, error: '등록된 브라우저에서만 할 수 있어요.' });
  const key = 'ggul_' + randomToken(40);
  await setSettings({ agent_key_hash: await sha256hex(key) });
  return reply(req, 200, { ok: true, key, intake_url: `${SUPABASE_URL}/functions/v1/sns-tg/intake` });
}

// ── 제작 에이전트가 보내는 곳 ───────────────────────────────────────────────
// 본문: { images: ['https://… .jpg' 또는 base64 JPEG], caption, threads_text?, x_text?, platforms? }
// → 사진을 sns-media 에 올리고 sns 의 /queue(draft) 로 임시저장(검사·X 길이 맞추기는 sns 가) → 단톡방 미리보기

async function loadImage(src: unknown): Promise<Uint8Array> {
  const s = String(src ?? '');
  let bytes: Uint8Array;
  if (/^https:\/\//i.test(s)) {
    const res = await fetch(s);
    if (!res.ok) throw new Error(`사진을 받지 못했어요 (${res.status})`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    const b64 = s.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  }
  if (bytes.length < 1024 || bytes.length > MAX_IMAGE_BYTES) throw new Error('사진 크기가 이상해요 (1KB~8MB).');
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) throw new Error('JPG 사진만 받아요.');
  return bytes;
}

async function intake(req: Request) {
  if (!(await agentOk(req))) return reply(req, 401, { ok: false, error: '에이전트 열쇠가 맞지 않아요.' });
  const body = await req.json().catch(() => ({}));
  const images = Array.isArray(body?.images) ? body.images : [];
  if (images.length > MAX_IMAGES) return reply(req, 400, { ok: false, error: `사진은 ${MAX_IMAGES}장까지예요.` });
  const paths: string[] = [];
  try {
    for (const img of images) {
      const bytes = await loadImage(img);
      const path = `posts/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      paths.push(path);
    }
  } catch (e) { return reply(req, 400, { ok: false, error: errMsg(e) }); }
  let platforms: string[] = Array.isArray(body?.platforms) ? body.platforms.map(String) : [];
  if (!platforms.length) { // 안 정하면 연결된 곳 전부
    const { data } = await sb.from('sns_accounts').select('platform, platform_user_id').not('access_token', 'is', null);
    platforms = [...new Set((data ?? []).filter((a: any) => !String(a.platform_user_id ?? '').startsWith('pending:')).map((a: any) => String(a.platform)))];
  }
  const j = await callSns('/queue', {
    draft: true, source: 'agent', platforms, image_paths: paths,
    caption: body?.caption ?? '', ...(body?.threads_text ? { threads_text: body.threads_text } : {}), ...(body?.x_text ? { x_text: body.x_text } : {}),
  });
  if (!j?.ok) return reply(req, 400, { ok: false, error: j?.error || '임시저장하지 못했어요.' });
  const s = await getSettings(SETTING_KEYS);
  let telegram = false;
  if (s.tg_bot_token && s.tg_chat_id) {
    const row = await loadRow(Number(j.id));
    if (row) { try { await sendPreview(row, s); telegram = true; } catch (e) { console.error('intake preview', errMsg(e)); } }
  }
  return reply(req, 200, { ok: true, id: j.id, telegram });
}

// ── sns 함수가 올린 뒤 알려 주는 곳 ─────────────────────────────────────────

async function notify(req: Request) {
  if (!(await isInternal(req))) return reply(req, 403, { ok: false });
  const body = await req.json().catch(() => ({}));
  const row = await loadRow(Number(body?.id));
  const s = await getSettings(['tg_bot_token']);
  if (!row?.tg?.card_id || !s.tg_bot_token) return reply(req, 200, { ok: true, skipped: true });
  const head = row.status === 'published' ? '✅ 올라갔어요' : row.status === 'partial' ? '⚠ 일부만 올라갔어요' : '✕ 못 올렸어요';
  const kb = row.status === 'published' ? null : [[btn('🔁 못 올라간 곳 다시 올리기', `rt:${row.id}`)]];
  await editCard(s.tg_bot_token, row.tg.chat_id, row.tg.card_id, `${cardText(row)}\n\n${head}\n${resultLines(row)}`, kb);
  return reply(req, 200, { ok: true });
}

// ── 텔레그램 웹훅 ─────────────────────────────────────────────────────────

async function onMessage(s: Settings, msg: any) {
  const token = s.tg_bot_token!;
  if (msg?.migrate_to_chat_id && String(msg.chat?.id) === s.tg_chat_id) { // 일반 그룹 → 슈퍼그룹이 되면 방 번호가 바뀐다
    await setSettings({ tg_chat_id: String(msg.migrate_to_chat_id) });
    return;
  }
  const text = String(msg?.text ?? '').trim();
  const m = /^\/link(?:@(\w+))?\s+([A-Za-z0-9]{6})\b/.exec(text);
  if (m) {
    if (m[1] && m[1].toLowerCase() !== String(s.tg_bot_username ?? '').toLowerCase()) return; // 다른 봇에게 한 말
    const ok = !!s.tg_link_code && m[2].toUpperCase() === s.tg_link_code && Date.now() < Date.parse(s.tg_link_expires ?? '');
    if (!ok) {
      await tg(token, 'sendMessage', { chat_id: msg.chat.id, text: '연결 코드가 맞지 않거나 15분이 지났어요. 꿀꿀집 화면에서 새 코드를 만들어 주세요.' });
      return;
    }
    const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || String(msg.from?.id);
    await setSettings({
      tg_chat_id: String(msg.chat.id), tg_chat_title: String(msg.chat.title || name), tg_approver_id: String(msg.from.id), tg_approver_name: String(name),
      tg_link_code: null, tg_link_expires: null,
    });
    await tg(token, 'sendMessage', { chat_id: msg.chat.id, text: `✅ 꿀꿀집 마케팅 봇이 이 방에 연결됐어요.\n카드뉴스 미리보기가 여기로 와요. 올리기 버튼은 ${name} 님만 누를 수 있어요.` });
    return;
  }
  if (/^\/start\b/.test(text) && msg?.chat?.type === 'private') {
    await tg(token, 'sendMessage', { chat_id: msg.chat.id, text: '꿀꿀집 마케팅 봇이에요. 오피스 꿀꿀집 화면에서 연결 코드를 만들고, 미리보기를 받을 방에서 /link 명령을 보내 주세요.' });
  }
}

async function onMember(s: Settings, upd: any) { // 봇이 방에서 나가면 연결을 푼다
  const st = upd?.new_chat_member?.status;
  if ((st === 'left' || st === 'kicked') && String(upd?.chat?.id) === s.tg_chat_id) {
    await setSettings({ tg_chat_id: null, tg_chat_title: null });
  }
}

async function onCallback(s: Settings, cq: any) {
  const token = s.tg_bot_token!;
  const answer = (text: string, alert = false) => tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text, show_alert: alert }).catch(() => {});
  if (!s.tg_approver_id || String(cq.from?.id) !== s.tg_approver_id) {
    return answer(`올리기 버튼은 ${s.tg_approver_name ?? '승인자'} 님만 누를 수 있어요.`, true);
  }
  const [act, idStr, arg] = String(cq.data ?? '').split(':');
  const row = await loadRow(Number(idStr));
  if (!row) return answer('없는 카드뉴스예요.', true);
  const chatId = cq.message?.chat?.id, messageId = cq.message?.message_id;
  if (!row.tg || String(row.tg.chat_id) !== String(chatId) || row.tg.card_id !== messageId) {
    return answer('지난 미리보기예요. 가장 최근 미리보기에서 눌러 주세요.', true);
  }
  const card = cardText(row);
  const now = new Date().toISOString();
  switch (act) {
    case 'go': // 지금 올리기 → 한 번 더
      if (row.status !== 'draft') return answer(stateText(row), true);
      await tg(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [[btn('✅ 정말 지금 올리기', `goy:${row.id}`), btn('↩ 취소', `back:${row.id}`)]] } });
      return answer('한 번 더 누르면 바로 공개돼요.');
    case 'goy': {
      if (row.status !== 'draft') return answer(stateText(row), true);
      await answer('올리는 중… 30초쯤 걸려요.');
      await editCard(token, chatId, messageId, `${card}\n\n⏳ 올리는 중…`, null);
      // 결과는 sns 가 올린 뒤 /notify 로 이 메시지를 고친다. 시작부터 막히면(검사 실패 등) 여기서 알린다.
      background(callSns('/queue/publish', { id: row.id, now: true }).then(async (j) => {
        if (!j?.ok) await editCard(token, chatId, messageId, `${card}\n\n✕ 올리지 못했어요 — ${j?.error ?? '알 수 없는 오류'}`, draftKeyboard(row.id));
      }));
      return;
    }
    case 'at': { // 예약 — 다음 한국 시각 hour:00
      if (row.status !== 'draft') return answer(stateText(row), true);
      const when = nextKst(Number(arg));
      const j = await callSns('/queue/publish', { id: row.id, scheduled_at: when.toISOString() });
      if (!j?.ok) return answer(j?.error ?? '예약하지 못했어요.', true);
      await editCard(token, chatId, messageId, `${card}\n\n⏰ ${fmtKst(when)} 에 올라가요.`, [[btn('↩ 예약 취소', `un:${row.id}`)]]);
      return answer('예약했어요.');
    }
    case 'un': { // 예약 취소 → 다시 임시저장
      const { data } = await sb.from('sns_queue').update({ status: 'draft', updated_at: now }).eq('id', row.id).eq('status', 'scheduled').select('id').maybeSingle();
      if (!data) return answer(stateText(row), true);
      await editCard(token, chatId, messageId, card, draftKeyboard(row.id));
      return answer('예약을 취소했어요. 다시 고를 수 있어요.');
    }
    case 'no': // 버리기 → 한 번 더
      if (row.status !== 'draft') return answer(stateText(row), true);
      await tg(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [[btn('🗑 정말 버리기', `noy:${row.id}`), btn('↩ 취소', `back:${row.id}`)]] } });
      return answer('한 번 더 누르면 버려요.');
    case 'noy': {
      const { data } = await sb.from('sns_queue').update({ status: 'canceled', note: '텔레그램에서 버림', updated_at: now }).eq('id', row.id).eq('status', 'draft').select('id').maybeSingle();
      if (!data) return answer(stateText(row), true);
      await editCard(token, chatId, messageId, `${card}\n\n🗑 버렸어요.`, null);
      return answer('버렸어요.');
    }
    case 'ed':
      if (row.status !== 'draft') return answer(stateText(row), true);
      await sb.from('sns_queue').update({ note: '텔레그램에서 수정 요청', updated_at: now }).eq('id', row.id).eq('status', 'draft');
      await editCard(token, chatId, messageId, `${card}\n\n✏️ 수정 요청 — 꿀꿀집 화면에서 불러와 고친 뒤 '텔레그램으로 보내기'를 다시 눌러 주세요.`, draftKeyboard(row.id));
      return answer('수정 요청으로 표시했어요.');
    case 'back':
      await tg(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: row.status === 'draft' ? draftKeyboard(row.id) : [] } });
      return answer('취소했어요.');
    case 'rt': { // 실패·일부만 → 못 올라간 곳만 다시
      if (row.status !== 'failed' && row.status !== 'partial') return answer(stateText(row), true);
      await answer('다시 올리는 중…');
      await editCard(token, chatId, messageId, `${card}\n\n⏳ 못 올라간 곳 다시 올리는 중…`, null);
      background(callSns('/queue/retry', { id: row.id }).then(async (j) => {
        if (!j?.ok) await editCard(token, chatId, messageId, `${card}\n\n✕ 다시 올리지 못했어요 — ${j?.error ?? '알 수 없는 오류'}`, [[btn('🔁 못 올라간 곳 다시 올리기', `rt:${row.id}`)]]);
      }));
      return;
    }
    default:
      return answer('');
  }
}

async function webhook(req: Request) {
  const s = await getSettings(SETTING_KEYS);
  if (!s.tg_webhook_secret || !safeEq(req.headers.get('x-telegram-bot-api-secret-token') ?? '', s.tg_webhook_secret)) {
    return new Response('forbidden', { status: 403 });
  }
  const up = await req.json().catch(() => ({}));
  try {
    if (up?.callback_query) await onCallback(s, up.callback_query);
    else if (up?.message) await onMessage(s, up.message);
    else if (up?.my_chat_member) await onMember(s, up.my_chat_member);
  } catch (e) {
    console.error('sns-tg webhook', errMsg(e));
  }
  return new Response('ok'); // 텔레그램에는 늘 바로 200 (같은 업데이트를 다시 보내지 않게)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const at = parts.indexOf('sns-tg');
  const route = (at >= 0 ? parts.slice(at + 1) : parts).join('/');
  const M = req.method;
  try {
    if (M === 'POST' && route === 'webhook') return await webhook(req);
    if (M === 'GET' && route === 'status') return await status(req);
    if (M === 'POST' && route === 'setup') return await setup(req);
    if (M === 'POST' && route === 'link-code') return await linkCode(req);
    if (M === 'POST' && route === 'send') return await send(req);
    if (M === 'POST' && route === 'agent-key') return await agentKey(req);
    if (M === 'POST' && route === 'intake') return await intake(req);
    if (M === 'POST' && route === 'notify') return await notify(req);
    return reply(req, 404, { ok: false, error: '없는 경로예요.' });
  } catch (e) {
    console.error('sns-tg', route, errMsg(e));
    return reply(req, 500, { ok: false, error: '서버 오류가 났어요. 잠시 뒤 다시 해 주세요.' });
  }
});
