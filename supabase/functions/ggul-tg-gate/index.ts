// 꿀꿀집 텔레그램 문지기 (Supabase 엣지 함수 "ggul-tg-gate") — 2026-11-12 사장님 "긴급이라고 텔레그램에 보내면 바로 올릴 수 있게"
//
// 텔레그램 웹훅이 sns-tg 대신 여기로 온다 → 글자만 고쳐서 sns-tg/webhook 으로 그대로 넘긴다.
// 승인자 확인 · 긴급 접수 · 답장 · 버튼은 전부 sns-tg 가 한다 (여기서는 글자만 바꾼다):
//   '긴급' · '긴급!' · '긴급 <지시>'  (슬래시 없이)   → '/긴급 <지시>'
//   '/긴급' · '/긴급@봇' · '@봇 긴급' 처럼 지시가 비면  → 지시 '(지시 없음)' 으로 바로 접수 (맥미니가 기본 긴급 실행)
//   '긴급 도움' · '/긴급 도움'                          → 지시 없는 '/긴급' (sns-tg 가 사용법을 보여 줌)
//   '긴급하게 …' 처럼 붙여 쓴 말 · 다른 글은 건드리지 않는다.
//
//   POST /ggul-tg-gate/webhook     텔레그램 (헤더 X-Telegram-Bot-Api-Secret-Token = sns_settings.tg_webhook_secret — 그대로 넘김)
//   POST /ggul-tg-gate/install     텔레그램 웹훅을 여기로 · /uninstall 은 sns-tg 로 되돌림 · ?dry=1 이면 바꾸지 않고 확인만
//                                  (헤더 x-ggul-agent = 카드뉴스 에이전트 열쇠, sns-tg 와 같은 해시로 확인)
//                                  → { webhook, changed, previous, reads_all_group_messages, bot_status, pending, last_error } (비밀값 없음)
//   GET  /ggul-tg-gate/health
// 단톡방의 보통 글('긴급 …', 슬래시 없음)은 봇이 방의 글을 다 받아야 온다 — reads_all_group_messages(BotFather 개인정보 모드 끔)
//   또는 bot_status 'administrator'(방 관리자). sns-tg 의 /setup 을 다시 하면 웹훅이 sns-tg 로 돌아가니 그 뒤엔 /install 을 한 번 다시.
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false (텔레그램이 부르는 주소라서)
// 비밀값(봇 토큰 · 웹훅 비밀 · 열쇠 해시)은 public.sns_settings(서버 전용)에서만 읽는다. 응답 · 로그로 내보내지 않는다.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SNS_TG_WEBHOOK = `${SUPABASE_URL}/functions/v1/sns-tg/webhook`;
const GATE_WEBHOOK = `${SUPABASE_URL}/functions/v1/ggul-tg-gate/webhook`;
const ALLOWED = ['message', 'callback_query', 'my_chat_member']; // sns-tg /setup 과 같게
const NO_INSTRUCTION = '(지시 없음)';

type Settings = Record<string, string | null>;

async function getSettings(keys: string[]): Promise<Settings> {
  const url = `${SUPABASE_URL}/rest/v1/sns_settings?select=key,value&key=in.(${keys.join(',')})`;
  const res = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  if (!res.ok) throw new Error(`설정을 읽지 못했어요 (${res.status})`);
  const rows = (await res.json()) as { key: string; value: string | null }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
async function agentOk(req: Request) { // sns-tg 와 같은 방식 — agent_key_hash(이 PC) · agent_key_hash_2(맥서버)
  const got = req.headers.get('x-ggul-agent') ?? '';
  if (got.length < 20) return false;
  const s = await getSettings(['agent_key_hash', 'agent_key_hash_2']);
  const h = await sha256hex(got);
  return [s.agent_key_hash, s.agent_key_hash_2].some((x) => !!x && safeEq(h, x));
}
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
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

// 글자 고치기 — 바꿀 게 없으면 null (sns-tg 가 원래 글 그대로 받는다)
function rewrite(text: string, bot: string): string | null {
  const t = text.trim();
  const help = (s: string) => /^(도움|도움말|사용법|help)$/i.test(s.trim());
  // 1) /긴급 · /긴급@봇 · /urgent — 지시가 비었을 때만 손댄다
  let m = /^\/(긴급|urgent)(@\w+)?(?:\s+([\s\S]*))?$/i.exec(t);
  if (m) {
    if (m[2] && bot && m[2].slice(1).toLowerCase() !== bot.toLowerCase()) return null; // 다른 봇에게 한 말
    const rest = (m[3] ?? '').trim();
    if (!rest) return `/${m[1]}${m[2] ?? ''} ${NO_INSTRUCTION}`;
    if (help(rest)) return `/${m[1]}${m[2] ?? ''}`;
    return null;
  }
  // 2) @봇 긴급 …
  m = /^@(\w+)\s+긴급(?:[\s!:,.~]+([\s\S]*))?$/i.exec(t);
  if (m) {
    if (!bot || m[1].toLowerCase() !== bot.toLowerCase()) return null;
    const rest = (m[2] ?? '').trim();
    if (!rest) return `@${m[1]} 긴급 ${NO_INSTRUCTION}`;
    if (help(rest)) return '/긴급';
    return `@${m[1]} 긴급 ${rest}`;
  }
  // 3) 슬래시 없이: 긴급 · 긴급! · 긴급 <지시> ('긴급하게' 처럼 붙여 쓴 말은 아님)
  m = /^긴급(?:[\s!:,.~]+([\s\S]*))?$/.exec(t);
  if (m) {
    const rest = (m[1] ?? '').trim();
    if (!rest) return `/긴급 ${NO_INSTRUCTION}`;
    if (help(rest)) return '/긴급';
    return `/긴급 ${rest}`;
  }
  return null;
}

async function webhook(req: Request) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  const s = await getSettings(['tg_webhook_secret', 'tg_bot_username']);
  if (!s.tg_webhook_secret || !safeEq(secret, s.tg_webhook_secret)) return new Response('forbidden', { status: 403 });
  const raw = await req.text();
  let body = raw;
  try {
    const up = JSON.parse(raw);
    const msg = up?.message;
    if (msg && typeof msg.text === 'string') {
      const fixed = rewrite(msg.text, String(s.tg_bot_username ?? ''));
      if (fixed !== null && fixed !== msg.text) { msg.text = fixed; delete msg.entities; body = JSON.stringify(up); }
    }
  } catch { /* 못 읽으면 그대로 넘긴다 */ }
  try {
    const res = await fetch(SNS_TG_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
      body,
      signal: AbortSignal.timeout(55_000),
    });
    return new Response(await res.text(), { status: res.status });
  } catch (e) {
    console.error('ggul-tg-gate 넘기기 실패', String((e as Error)?.message ?? e));
    return new Response('retry', { status: 502 }); // 텔레그램이 잠시 뒤 다시 보낸다
  }
}

async function install(req: Request, back: boolean, dry: boolean) {
  if (!(await agentOk(req))) return json(401, { ok: false, error: '에이전트 열쇠가 맞지 않아요.' });
  const s = await getSettings(['tg_bot_token', 'tg_webhook_secret', 'tg_chat_id']);
  if (!s.tg_bot_token || !s.tg_webhook_secret) return json(400, { ok: false, error: '텔레그램 봇이 아직 연결되지 않았어요 (꿀꿀집 화면에서 먼저 연결).' });
  const token = s.tg_bot_token;
  const want = back ? SNS_TG_WEBHOOK : GATE_WEBHOOK;
  const where = (u: string) => (u === GATE_WEBHOOK ? 'gate' : u === SNS_TG_WEBHOOK ? 'sns-tg' : u ? 'other' : 'none');
  const info = await tg(token, 'getWebhookInfo', {});
  const before = String(info?.url ?? '');
  let changed = false;
  if (!dry && before !== want) {
    await tg(token, 'setWebhook', { url: want, secret_token: s.tg_webhook_secret, allowed_updates: ALLOWED });
    changed = true;
  }
  const me = await tg(token, 'getMe', {});
  let bot_status: string | null = null;
  if (s.tg_chat_id) {
    try { bot_status = (await tg(token, 'getChatMember', { chat_id: s.tg_chat_id, user_id: me.id }))?.status ?? null; } catch { bot_status = null; }
  }
  return json(200, {
    ok: true, webhook: where(changed ? want : before), changed, previous: where(before), dry,
    reads_all_group_messages: !!me?.can_read_all_group_messages, bot_status, linked: !!s.tg_chat_id,
    pending: info?.pending_update_count ?? 0, last_error: info?.last_error_message ?? null,
  });
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const parts = u.pathname.split('/').filter(Boolean);
  const at = parts.indexOf('ggul-tg-gate');
  const route = (at >= 0 ? parts.slice(at + 1) : parts).join('/');
  const dry = u.searchParams.get('dry') === '1';
  try {
    if (req.method === 'POST' && route === 'webhook') return await webhook(req);
    if (req.method === 'POST' && route === 'install') return await install(req, false, dry);
    if (req.method === 'POST' && route === 'uninstall') return await install(req, true, dry);
    if (req.method === 'GET' && route === 'health') return json(200, { ok: true });
    return json(404, { ok: false, error: '없는 경로예요.' });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 200);
    console.error('ggul-tg-gate', route, msg);
    return json(500, { ok: false, error: msg });
  }
});
