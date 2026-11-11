// 꿀꿀집 마케팅 회사 / 댓글 자동 DM (Supabase 엣지 함수 "sns-dm")
//
// 흐름: 꿀꿀집 인스타 게시물에 누가 댓글을 달면 → 1분 안에 그 댓글에 '비공개 답장'(DM)으로
//       "꿀꿀이 정보는 해당 링크에서 확인해주세요! 모두 모아놨어요" + 꿀꿀집 링크 모음 사이트의 그 게시물 주소
//       (https://brightbeed.kr/ggulggulzip/?s=<sns_queue.id>)를 보낸다. 사이트 · 딜 표(ggul_sets · ggul_links)는 다른 쪽이 만들고,
//       이 함수는 주소를 만들고 ggul_sets.as_of(그 게시물 딜을 모은 시각)를 읽어 '📌 11월 11일 오후 2시 59분 기준'만 넣는다.
//
// 웹훅을 안 쓰는 이유: 인스타 댓글 웹훅은 앱 검수(Advanced Access)가 필요하다. 그래서 pg_cron 이 1분마다 /tick 을 부르고
//   (dm_enabled='on' 일 때만), /me/media 한 번으로 댓글 수(comments_count)가 바뀐 게시물만 댓글을 읽는다 — 작은 계정은 호출 한도가 낮다.
// 비공개 답장 규칙(인스타): 댓글 하나에 한 번만, 댓글이 달리고 7일 안에만. 상대가 꿀꿀집을 팔로우 안 했으면 '메시지 요청'으로 간다.
// 이 함수는 켠 뒤(dm_since)에 달린 댓글에만, 같은 글(캐러셀 · 릴스를 합쳐 sns_queue 한 줄)에서는 한 사람에게 한 번만 보낸다. 꿀꿀집이 단 댓글은 뺀다.
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false (경로마다 자체 확인)
// 인스타 토큰은 sns_accounts(instagram) 에서 매번 새로 읽기만 한다 — 저장 · 연장은 sns 함수가 한다.
// 표(서버 전용): sns_comment_dms(댓글마다 한 줄 · 실패 이유) · sns_dm_media(게시물별 본 댓글 수)
// 설정(sns_settings): dm_enabled('on'|'off') · dm_text · dm_since · dm_link_base · dm_link_post('?s={id}') · dm_state(JSON)
//
//   GET  /sns-dm/status        공개 — {enabled, ready, reason} (제작 에이전트가 '댓글 남기면 링크 자동 전달' 안내를 넣을지 정할 때)
//                              ready = 켜짐 + 댓글 · 메시지 권한 + 15분 안 정상 실행 + 실제 DM 1건 이상 성공 + 최근 3건 연속 실패 아님
//   POST /sns-dm/tick          pg_cron (헤더 x-ggul-cron = sns_settings.cron_key) — 새 댓글 → DM
//   GET  /sns-dm/admin         등록된 브라우저 (헤더 x-ggul-device) — 설정 · 상태 · 보낸 기록
//   POST /sns-dm/settings      등록된 브라우저 — {enabled?: boolean, text?: string}
//   POST /sns-dm/check         등록된 브라우저 — 댓글 · 메시지 권한 다시 확인

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ORIGINS = new Set(['https://j65209.github.io', 'https://beaduniverse.kr', 'https://www.beaduniverse.kr']);
const IG = 'https://graph.instagram.com';
const IG_VER = 'v23.0';
// 꿀꿀집 링크 모음 사이트 (공구 제안관 레포 brightbeed-catalog 의 ggulggulzip/ 폴더 — 업로드 세션 담당).
// 묶음이 없거나 공개 전이면 사이트가 알아서 첫 화면(전체 모음)을 보여 준다.
const DEFAULT_LINK = 'https://brightbeed.kr/ggulggulzip/';
const DEFAULT_POST = '?s={id}'; // 게시물별 주소 — {id} = sns_queue.id (= ggul_sets.queue_id)
const DEFAULT_TEXT = '꿀꿀이 정보는 해당 링크에서 확인해주세요! 모두 모아놨어요 🐷\n📌 {기준} 기준\n👉 {링크}';
const MIN = 60_000;
const DAY_MS = 86_400_000;
const REPLY_WINDOW_MS = 7 * DAY_MS - 10 * MIN; // 인스타 비공개 답장은 댓글 뒤 7일 안
const MEDIA_LIMIT = 25; // 최근 게시물 몇 개의 댓글 수를 볼지
const FAIL_STREAK_MAX = 3; // 최근 DM 이 이만큼 연달아 실패하면 ready 를 내린다 (카드에 안내를 넣지 않게)
const MAX_MEDIA_PER_TICK = 6;
const MAX_DMS_PER_TICK = 20;
const COMMENT_PAGES = 4; // 게시물 하나에서 댓글을 몇 쪽(50개씩)까지 읽을지
const PERM_RECHECK_MS = 6 * 60 * MIN; // 권한 확인은 6시간마다 저절로 (문제가 있으면 10분마다)
const CHECK_COOLDOWN_MS = 30_000;
const BACKOFF_MS = 15 * MIN; // 호출 한도에 걸리면 쉬는 시간
const TEXT_MAX = 600;
const DM_KEYS = ['dm_enabled', 'dm_text', 'dm_since', 'dm_link_base', 'dm_link_post', 'dm_state'];

const sb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Settings = Record<string, string | undefined>;
type Perm = 'ok' | 'error' | 'unknown';
type PermState = { comments: Perm; messages: Perm; at: string; detail?: string | null };
type State = {
  last_run_at?: string | null;
  last_ok_at?: string | null;
  last_error?: string | null;
  fatal?: boolean; // 토큰 · 권한처럼 사람이 고쳐야 하는 오류
  backoff_until?: string | null;
  perm?: PermState | null;
  check_at?: string | null;
};
type IgAccount = { id: number; username: string; uid: string; token: string };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const nowIso = () => new Date().toISOString();

function igErrorText(e: any, status: number) {
  const code = Number(e?.code ?? 0);
  const base = e?.error_user_msg || e?.message || `HTTP ${status}`;
  const tail = code ? ` (code ${code}${e?.error_subcode ? `/${e.error_subcode}` : ''})` : '';
  if (code === 190) return `인스타 토큰이 만료됐거나 바뀌었어요 — 꿀꿀집 화면에서 토큰을 다시 붙여넣어 주세요: ${base}${tail}`;
  if ((code === 10 && !e?.error_subcode) || (code >= 200 && code < 300)) return `권한이 없어요 — Meta 앱의 댓글 · 메시지 권한과 토큰을 확인해 주세요: ${base}${tail}`;
  if ([4, 17, 32, 613].includes(code)) return `인스타 호출 한도에 걸렸어요 — 잠시 쉬었다가 다시 해요: ${base}${tail}`;
  return `${base}${tail}`;
}

class ApiError extends Error {
  code: number | null;
  sub: number | null;
  constructor(msg: string, code: number | null = null, sub: number | null = null) {
    super(msg);
    this.code = code;
    this.sub = sub;
  }
}
const apiError = (j: any, status: number) => new ApiError(igErrorText(j?.error, status), j?.error?.code ?? null, j?.error?.error_subcode ?? null);
const isRateLimit = (e: unknown) => e instanceof ApiError && [4, 17, 32, 613].includes(e.code ?? 0);
// 사람이 고쳐야 하는 오류(토큰 · 권한) — code 10 이라도 하위 코드가 있으면(예: 2534022 답장 기간 지남) 그 댓글만의 문제
const isFatal = (e: unknown) =>
  e instanceof ApiError && (e.code === 190 || (e.code === 10 && !e.sub) || (e.code !== null && e.code >= 200 && e.code < 300));

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// ── 설정 · 권한 확인 (sns · sns-tg 와 같은 방식) ──────────────────────────

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
async function getSettings(keys: string[]): Promise<Settings> {
  const { data, error } = await sb.from('sns_settings').select('key, value').in('key', keys);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
}
async function setSettings(kv: Record<string, string>) {
  const at = nowIso();
  const rows = Object.entries(kv).map(([key, value]) => ({ key, value, updated_at: at }));
  const { error } = await sb.from('sns_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
}
async function isCron(req: Request) {
  const got = req.headers.get('x-ggul-cron') ?? '';
  if (got.length < 32) return false;
  const { cron_key } = await getSettings(['cron_key']);
  return safeEq(got, cron_key ?? '');
}
async function approvedDevice(req: Request) {
  const key = req.headers.get('x-ggul-device') ?? '';
  if (key.length < 32 || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) return false;
  const { data } = await sb.from('sns_devices').select('id, status').eq('key_hash', await sha256hex(key)).maybeSingle();
  if (!data || data.status !== 'approved') return false;
  await sb.from('sns_devices').update({ last_seen_at: nowIso() }).eq('id', data.id);
  return true;
}
const NOT_APPROVED = { ok: false, error: '이 브라우저는 아직 꿀꿀집 올리기 권한이 없어요. 꿀꿀집 화면에서 등록 · 승인부터 해 주세요.' };

function parseState(s?: string): State {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
async function saveState(st: State) {
  await setSettings({ dm_state: JSON.stringify(st) });
}

// ── 인스타 ────────────────────────────────────────────────────────────

// 토큰은 매번 표에서 새로 읽는다 (sns 함수가 만료 전에 바꿔 넣는다)
async function igAccount(): Promise<IgAccount | null> {
  const { data, error } = await sb
    .from('sns_accounts')
    .select('id, username, platform_user_id, access_token')
    .eq('platform', 'instagram')
    .not('access_token', 'is', null)
    .order('id')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const uid = String(data?.platform_user_id ?? '');
  if (!data?.access_token || !uid || uid.startsWith('pending:')) return null;
  return { id: data.id, username: String(data.username ?? ''), uid, token: data.access_token };
}

async function igGet(path: string, token: string, params: Record<string, string> = {}) {
  const u = new URL(path.startsWith('http') ? path : `${IG}/${IG_VER}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  // 다음 쪽 주소(paging.next)에는 토큰이 이미 들어 있다 — 없을 때만 붙인다. 주소는 로그에 남기지 않는다.
  if (!u.searchParams.has('access_token')) u.searchParams.set('access_token', token);
  const res = await fetch(u);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.error) throw apiError(j, res.status);
  return j;
}

async function privateReply(acc: IgAccount, commentId: string, text: string) {
  const res = await fetch(`${IG}/${IG_VER}/${acc.uid}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${acc.token}` },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.error) throw apiError(j, res.status);
  return j as { recipient_id?: string; message_id?: string };
}

// 댓글 목록 — 'from'(작성자 ID)을 못 받는 경우를 대비해 작은 필드 묶음으로 다시 묻는다
async function commentsOf(mediaId: string, token: string) {
  const sets = ['id,timestamp,from,username', 'id,timestamp,username'];
  let lastErr: unknown = null;
  for (const fields of sets) {
    try {
      const out: any[] = [];
      let j = await igGet(`/${mediaId}/comments`, token, { fields, limit: '50' });
      for (let page = 0; page < COMMENT_PAGES; page++) {
        out.push(...(j?.data ?? []));
        const next = j?.paging?.next;
        if (!next || page === COMMENT_PAGES - 1) break;
        j = await igGet(next, token);
      }
      return out;
    } catch (e) {
      lastErr = e;
      if (!(e instanceof ApiError) || e.code !== 100) throw e; // 필드 문제(100)일 때만 다음 묶음으로
    }
  }
  throw lastErr;
}

// ── 문구 · 링크 ────────────────────────────────────────────────────────

// '11월 11일 오후 2시 59분' (한국 시각)
function kstLabel(iso: string | null | undefined) {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + 9 * 3_600_000);
  const h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${h < 12 ? '오전' : '오후'} ${h12}시${mi ? ` ${mi}분` : ''}`;
}

function buildText(template: string, link: string, asOf: string | null) {
  let t = (template || DEFAULT_TEXT).replace(/\r\n?/g, '\n');
  const when = kstLabel(asOf); // 그 게시물 딜을 모은 시각 — 모르면 {기준} 이 든 줄을 뺀다
  t = when ? t.split('{기준}').join(when) : t.split('\n').filter((line) => !line.includes('{기준}')).join('\n');
  if (t.includes('{링크}')) t = t.split('{링크}').join(link);
  else t = `${t.trimEnd()}\n${link}`;
  return t.slice(0, 1000);
}

function linkFor(s: Settings, queueId: number | null) {
  const base = /^https:\/\//.test(s.dm_link_base ?? '') ? s.dm_link_base! : DEFAULT_LINK;
  if (!queueId) return base;
  const post = (s.dm_link_post ?? DEFAULT_POST).split('{id}').join(String(queueId));
  return base + post;
}

// 링크 모음 사이트 쪽 표에서 그 게시물 딜의 기준 시각 — 공개 중(active)인 묶음만 (꺼진 묶음이면 페이지가 전체 모음을 보여 줘서
// DM 에 그 묶음 시각을 쓰면 어긋난다). 표가 없거나 칸이 다르면 조용히 비운다
async function asOfFor(queueIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!queueIds.length) return out;
  try {
    const { data, error } = await sb.from('ggul_sets').select('queue_id, as_of').in('queue_id', queueIds).eq('active', true);
    if (error) return out;
    for (const r of data ?? []) if ((r as any).as_of) out.set(Number((r as any).queue_id), String((r as any).as_of));
  } catch { /* 없음 */ }
  return out;
}

async function queueByMedia(): Promise<Map<string, number>> {
  const { data, error } = await sb
    .from('sns_queue')
    .select('id, results')
    // 릴스는 인스타 처리가 늦으면 몇 분간 'publishing' 으로 남는다 (캐러셀은 이미 올라간 상태)
    .in('status', ['published', 'partial', 'publishing'])
    .order('id', { ascending: false })
    .limit(80);
  if (error) throw error;
  const m = new Map<string, number>();
  for (const r of data ?? []) {
    const res = (r as any)?.results ?? {};
    // 캐러셀(instagram)과 릴스(reels)는 같은 글 — 둘 다 같은 글 번호로
    for (const key of ['instagram', 'reels']) {
      const mid = res?.[key]?.media_id;
      if (mid) m.set(String(mid), Number((r as any).id));
    }
  }
  return m;
}

// ── 권한 확인 (댓글 읽기 · 메시지함 읽기 — 둘 다 보내지 않고 읽기만) ─────────────

async function checkPerm(acc: IgAccount): Promise<PermState> {
  const out: PermState = { comments: 'unknown', messages: 'unknown', at: nowIso(), detail: null };
  const notes: string[] = [];
  try {
    const list = await igGet(`/${acc.uid}/media`, acc.token, { fields: 'id', limit: '1' });
    const mid = list?.data?.[0]?.id;
    if (mid) {
      await igGet(`/${mid}/comments`, acc.token, { fields: 'id', limit: '1' });
      out.comments = 'ok';
    } else notes.push('게시물이 없어 댓글 권한은 아직 못 봤어요');
  } catch (e) {
    out.comments = 'error';
    notes.push(`댓글: ${errMsg(e)}`);
  }
  try {
    await igGet(`/${acc.uid}/conversations`, acc.token, { platform: 'instagram', limit: '1' });
    out.messages = 'ok';
  } catch (e) {
    out.messages = 'error';
    notes.push(`메시지: ${errMsg(e)}`);
  }
  out.detail = notes.join(' · ').slice(0, 600) || null;
  return out;
}
const permGood = (p: PermState | null | undefined) => !!p && p.messages === 'ok' && p.comments !== 'error';

type Health = { sentEver: boolean; failing: boolean };

// 실제로 DM 이 나가는지 — 권한이 있어도 개발 모드 · 계정 제한으로 막힐 수 있어서,
// 한 번도 안 나갔거나 최근 3건이 모두 실패면 카드에 안내를 넣지 않는다 (읽기 오류도 '안 됨' 쪽으로)
async function dmHealth(): Promise<Health> {
  const { data: last } = await sb.from('sns_comment_dms').select('status').in('status', ['sent', 'failed'])
    .order('id', { ascending: false }).limit(FAIL_STREAK_MAX);
  const recent = (last ?? []).map((x: any) => String(x.status));
  let sentEver = recent.includes('sent');
  if (!sentEver) {
    const { count } = await sb.from('sns_comment_dms').select('id', { count: 'exact', head: true }).eq('status', 'sent');
    sentEver = (count ?? 0) > 0;
  }
  return { sentEver, failing: recent.length >= FAIL_STREAK_MAX && recent.every((x) => x === 'failed') };
}

function readyOf(s: Settings, st: State, h: Health) {
  if (s.dm_enabled !== 'on') return { ready: false, reason: 'off' };
  if (!st.perm || st.perm.comments !== 'ok' || st.perm.messages !== 'ok') return { ready: false, reason: 'permission' };
  if (st.fatal) return { ready: false, reason: 'error' };
  const okAt = Date.parse(st.last_ok_at ?? '');
  if (!Number.isFinite(okAt) || Date.now() - okAt > 15 * MIN) return { ready: false, reason: 'stale' };
  if (h.failing) return { ready: false, reason: 'failing' };
  if (!h.sentEver) return { ready: false, reason: 'unverified' };
  return { ready: true, reason: 'ok' };
}

// ── 1분마다: 새 댓글 → 비공개 답장 ───────────────────────────────────────

async function pollOnce(acc: IgAccount, s: Settings) {
  const since = Date.parse(s.dm_since ?? '');
  const sinceMs = Number.isFinite(since) ? since : Date.now();
  const list = await igGet(`/${acc.uid}/media`, acc.token, { fields: 'id,comments_count', limit: String(MEDIA_LIMIT) });
  const media: { id: string; count: number }[] = (list?.data ?? []).map((m: any) => ({ id: String(m.id), count: Number(m.comments_count ?? 0) }));
  const stat = { media: media.length, read: 0, sent: 0, failed: 0, skipped: 0 };
  if (!media.length) return stat;

  const { data: known, error } = await sb.from('sns_dm_media').select('media_id, comments_seen').in('media_id', media.map((m) => m.id));
  if (error) throw error;
  const seen = new Map<string, number>((known ?? []).map((k: any) => [String(k.media_id), Number(k.comments_seen ?? 0)]));

  // 댓글이 줄어든 곳(지워짐)은 숫자만 맞춘다
  const shrunk = media.filter((m) => seen.has(m.id) && m.count < (seen.get(m.id) ?? 0));
  if (shrunk.length) {
    await sb.from('sns_dm_media').upsert(shrunk.map((m) => ({ media_id: m.id, comments_seen: m.count, checked_at: nowIso() })), { onConflict: 'media_id' });
  }
  const changed = media.filter((m) => m.count > (seen.get(m.id) ?? 0)).slice(0, MAX_MEDIA_PER_TICK);
  if (!changed.length) return stat;

  const byMedia = await queueByMedia();
  const asOf = await asOfFor([...new Set(changed.map((m) => byMedia.get(m.id)).filter((x): x is number => !!x))]);
  const me = acc.username.toLowerCase();
  let budget = MAX_DMS_PER_TICK;

  for (const m of changed) {
    const qid = byMedia.get(m.id) ?? null;
    const text = buildText(s.dm_text || DEFAULT_TEXT, linkFor(s, qid), qid ? asOf.get(qid) ?? null : null);
    const all = await commentsOf(m.id, acc.token);
    stat.read++;
    const fresh = all
      .map((c: any) => ({
        id: String(c.id ?? ''),
        at: Date.parse(c.timestamp ?? ''),
        fromId: String(c.from?.id ?? ''),
        username: String(c.from?.username ?? c.username ?? ''),
      }))
      .filter((c) => c.id && Number.isFinite(c.at) && c.at >= sinceMs && Date.now() - c.at < REPLY_WINDOW_MS)
      .filter((c) => c.fromId !== acc.uid && c.username.toLowerCase() !== me) // 꿀꿀집이 단 댓글은 빼고
      .sort((a, b) => a.at - b.at);

    let done = new Set<string>();
    if (fresh.length) {
      const { data: rows } = await sb.from('sns_comment_dms').select('comment_id').in('comment_id', fresh.map((c) => c.id));
      done = new Set((rows ?? []).map((r: any) => String(r.comment_id)));
    }
    let complete = true;
    for (const c of fresh) {
      if (done.has(c.id)) continue;
      if (budget <= 0) { complete = false; break; }
      budget--;
      const who = c.fromId || (c.username ? `u:${c.username.toLowerCase()}` : '');
      // 먼저 '보내는 중'으로 한 줄 넣는다 — 같은 댓글에 두 번 보내지 않게 (comment_id unique)
      const { data: ins, error: insErr } = await sb
        .from('sns_comment_dms')
        .upsert({
          comment_id: c.id, media_id: m.id, queue_id: qid, from_id: who || null, from_username: c.username || null,
          comment_at: new Date(c.at).toISOString(), status: 'sending',
        }, { onConflict: 'comment_id', ignoreDuplicates: true })
        .select('id');
      if (insErr) throw insErr;
      const rowId = ins?.[0]?.id;
      if (!rowId) continue; // 다른 실행이 먼저 잡았다
      if (who) {
        // 같은 글(캐러셀 · 릴스 합쳐 글 번호 하나)에서는 한 사람에게 한 번만 — 글 번호를 모르면 게시물 기준
        let dup = sb.from('sns_comment_dms').select('id', { count: 'exact', head: true }).eq('from_id', who).eq('status', 'sent');
        dup = qid ? dup.eq('queue_id', qid) : dup.eq('media_id', m.id);
        const { count } = await dup;
        if ((count ?? 0) > 0) {
          await sb.from('sns_comment_dms').update({ status: 'skipped', reason: '같은 글에서 이미 DM 을 받은 사람' }).eq('id', rowId);
          stat.skipped++;
          continue;
        }
      }
      try {
        const r = await privateReply(acc, c.id, text);
        await sb.from('sns_comment_dms').update({ status: 'sent', message_id: r.message_id ?? null, sent_at: nowIso(), reason: null }).eq('id', rowId);
        stat.sent++;
      } catch (e) {
        if (isRateLimit(e) || isFatal(e)) {
          // 한도 · 토큰 · 권한 문제면 안 보내진 것 — 줄을 지워서 고친 뒤 다시 보내게 하고, 이번 실행은 멈춘다
          await sb.from('sns_comment_dms').delete().eq('id', rowId);
          throw e;
        }
        // 그 밖(답장 기간 지남 · 받을 수 없는 계정 · 응답 없음 등)은 다시 보내지 않는다 — 같은 댓글에 두 번 가지 않게
        await sb.from('sns_comment_dms').update({ status: 'failed', reason: errMsg(e).slice(0, 400) }).eq('id', rowId);
        stat.failed++;
      }
    }
    if (complete) {
      await sb.from('sns_dm_media').upsert({ media_id: m.id, queue_id: qid, comments_seen: m.count, checked_at: nowIso() }, { onConflict: 'media_id' });
    }
    if (budget <= 0) break;
  }
  return stat;
}

async function tick(req: Request) {
  if (!(await isCron(req))) return reply(req, 403, { ok: false, error: '내부 요청만 돼요.' });
  const s = await getSettings(DM_KEYS);
  if (s.dm_enabled !== 'on') return reply(req, 200, { ok: true, skipped: 'off' });
  const st = parseState(s.dm_state);
  if (st.backoff_until && Date.parse(st.backoff_until) > Date.now()) return reply(req, 200, { ok: true, skipped: 'backoff' });
  const acc = await igAccount();
  st.last_run_at = nowIso();
  if (!acc) {
    Object.assign(st, { last_error: '인스타 토큰이 없어요 — 꿀꿀집 화면에서 인스타 토큰을 붙여넣어 주세요.', fatal: true });
    await saveState(st);
    return reply(req, 200, { ok: false, error: st.last_error });
  }
  try {
    // 권한은 6시간마다 다시 본다 — 문제가 있는 동안엔 10분마다 보고, 그 사이 실행은 쉰다
    const permAt = Date.parse(st.perm?.at ?? '');
    const every = permGood(st.perm) && !st.fatal ? PERM_RECHECK_MS : 10 * MIN;
    if (!st.perm || !Number.isFinite(permAt) || Date.now() - permAt > every) st.perm = await checkPerm(acc);
    else if (st.fatal) return reply(req, 200, { ok: true, skipped: 'waiting-fix' });
    if (!permGood(st.perm)) {
      // 권한 없이 보내면 그 댓글들이 실패로 남는다 — 고칠 때까지 기다린다 (댓글 뒤 7일 안이면 고친 뒤 보낸다)
      Object.assign(st, { last_error: `권한 확인 필요 — ${st.perm?.detail ?? '댓글 · 메시지 권한'}`.slice(0, 400), fatal: true });
      await saveState(st);
      return reply(req, 200, { ok: false, skipped: 'permission' });
    }
    const r = await pollOnce(acc, s);
    Object.assign(st, { last_ok_at: nowIso(), last_error: null, fatal: false, backoff_until: null });
    await saveState(st);
    return reply(req, 200, { ok: true, ...r });
  } catch (e) {
    const msg = errMsg(e);
    console.error('sns-dm tick', msg);
    Object.assign(st, { last_error: msg.slice(0, 400), fatal: isFatal(e) });
    if (isRateLimit(e)) st.backoff_until = new Date(Date.now() + BACKOFF_MS).toISOString();
    if (isFatal(e) && st.perm) st.perm = { ...st.perm, at: nowIso(), detail: msg.slice(0, 300) }; // 10분 뒤 권한부터 다시 본다
    await saveState(st);
    return reply(req, 200, { ok: false, error: msg });
  }
}

// ── 공개 상태 ──────────────────────────────────────────────────────────

async function status(req: Request) {
  const s = await getSettings(DM_KEYS);
  const r = readyOf(s, parseState(s.dm_state), await dmHealth());
  return reply(req, 200, { ok: true, enabled: s.dm_enabled === 'on', ready: r.ready, reason: r.reason });
}

// ── 관리 (등록된 브라우저) ───────────────────────────────────────────────

async function admin(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, NOT_APPROVED);
  const s = await getSettings(DM_KEYS);
  const st = parseState(s.dm_state);
  const { data: log, error } = await sb
    .from('sns_comment_dms')
    .select('id, media_id, queue_id, from_username, comment_at, status, reason, created_at, sent_at')
    .order('id', { ascending: false })
    .limit(60);
  if (error) throw error;
  const week = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const { count: sentWeek } = await sb.from('sns_comment_dms').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', week);
  const { data: posts } = await sb.from('sns_posts').select('media_id, permalink').eq('platform', 'instagram');
  const links = new Map((posts ?? []).map((p: any) => [String(p.media_id), p.permalink]));
  const latest = Math.max(0, ...(await queueByMedia()).values()); // 가장 최근에 올라간 글 번호 (링크 예시용)
  const r = readyOf(s, st, await dmHealth());
  return reply(req, 200, {
    ok: true,
    enabled: s.dm_enabled === 'on',
    ready: r.ready,
    reason: r.reason,
    text: s.dm_text || DEFAULT_TEXT,
    default_text: DEFAULT_TEXT,
    since: s.dm_since ?? null,
    link_example: latest ? { id: latest, url: linkFor(s, latest) } : null,
    link_base: linkFor(s, null),
    state: { last_run_at: st.last_run_at ?? null, last_ok_at: st.last_ok_at ?? null, last_error: st.last_error ?? null, backoff_until: st.backoff_until ?? null, perm: st.perm ?? null },
    sent_week: sentWeek ?? 0,
    log: (log ?? []).map((x: any) => ({ ...x, permalink: links.get(String(x.media_id)) ?? null })),
  });
}

async function settings(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, NOT_APPROVED);
  const body = await req.json().catch(() => ({}));
  const s = await getSettings(DM_KEYS);
  const kv: Record<string, string> = {};
  if (typeof body?.text === 'string') {
    const t = body.text.replace(/\r\n?/g, '\n').trim();
    if (!t) return reply(req, 400, { ok: false, error: 'DM 문구가 비었어요.' });
    if (t.length > TEXT_MAX) return reply(req, 400, { ok: false, error: `DM 문구는 ${TEXT_MAX}자 안으로 써 주세요.` });
    kv.dm_text = t;
  }
  let perm: PermState | null = null;
  if (typeof body?.enabled === 'boolean') {
    kv.dm_enabled = body.enabled ? 'on' : 'off';
    // 켤 때마다 '지금부터 달린 댓글만' — 꺼 둔 동안 달린 댓글에는 보내지 않는다
    if (body.enabled && s.dm_enabled !== 'on') kv.dm_since = nowIso();
    if (body.enabled) {
      const acc = await igAccount();
      if (!acc) return reply(req, 400, { ok: false, error: '인스타 토큰이 없어요 — 꿀꿀집 화면에서 먼저 연결해 주세요.' });
      perm = await checkPerm(acc);
    }
  }
  if (!Object.keys(kv).length) return reply(req, 400, { ok: false, error: '바꿀 게 없어요.' });
  await setSettings(kv);
  if (perm) {
    const st = parseState(s.dm_state);
    Object.assign(st, { perm, check_at: nowIso() });
    if (permGood(perm)) Object.assign(st, { fatal: false, last_error: null });
    await saveState(st);
  }
  return reply(req, 200, { ok: true, perm });
}

async function check(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, NOT_APPROVED);
  const s = await getSettings(DM_KEYS);
  const st = parseState(s.dm_state);
  const last = Date.parse(st.check_at ?? '');
  if (Number.isFinite(last) && Date.now() - last < CHECK_COOLDOWN_MS) return reply(req, 429, { ok: false, error: '방금 확인했어요. 30초 뒤에 다시 눌러 주세요.' });
  const acc = await igAccount();
  if (!acc) return reply(req, 400, { ok: false, error: '인스타 토큰이 없어요.' });
  const perm = await checkPerm(acc);
  Object.assign(st, { perm, check_at: nowIso() });
  if (permGood(perm)) Object.assign(st, { fatal: false, last_error: null });
  await saveState(st);
  return reply(req, 200, { ok: true, perm });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const at = parts.indexOf('sns-dm');
  const route = (at >= 0 ? parts.slice(at + 1) : parts).join('/');
  const M = req.method;
  try {
    if (M === 'GET' && (route === '' || route === 'status')) return await status(req);
    if (M === 'POST' && route === 'tick') return await tick(req);
    if (M === 'GET' && route === 'admin') return await admin(req);
    if (M === 'POST' && route === 'settings') return await settings(req);
    if (M === 'POST' && route === 'check') return await check(req);
    return reply(req, 404, { ok: false, error: '없는 경로예요.' });
  } catch (e) {
    console.error('sns-dm', route, errMsg(e));
    return reply(req, 500, { ok: false, error: errMsg(e) });
  }
});
