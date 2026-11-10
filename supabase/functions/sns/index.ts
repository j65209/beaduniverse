// 꿀꿀집 마케팅 회사 / SNS 자동 게시 — 계정 토큰 보관 · 연결 시험 · 토큰 자동 연장 · 게시물·통계 모으기 · 카드뉴스 예약·게시
// (Supabase 엣지 함수 "sns")
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false
//   anon 키는 오피스 소스에 공개돼 있어 막아 주는 게 없으므로 쓰지 않고, 경로마다 스스로 막는다.
//   글을 올리거나 예약을 보는 경로는 '등록된 브라우저'만 된다 (헤더 x-ggul-device = 브라우저가 만든 무작위 키,
//   서버에는 sha256 만 sns_devices 에 저장 · status=approved 만 통과). 비밀번호 입력 없음.
//
// 누구나 (읽기 전용 · 해가 없는 것):
//   GET  /sns/accounts            계정 목록과 상태 — 토큰 값은 절대 내보내지 않는다
//   GET  /sns/overview            계정(프로필·팔로워 기록) + 게시물(최신 통계)
//   GET  /sns/history?account_id=&media_id=   게시물 하나의 통계 기록
//   POST /sns/token     {account_id, token} — 인스타/스레드에 물어서 그 계정 토큰이 맞을 때만 저장
//   POST /sns/test      {account_id, image_paths?} — 고정 시험 사진(또는 올린 카드뉴스 사진)으로 '올리기 직전'(컨테이너)까지만. 계정마다 1분 1회
//   POST /sns/collect   {account_id?, source?} — 게시물·통계·팔로워 모으기 (cron 6시간 · 화면 새로고침은 계정마다 2분 1회)
//   POST /sns/refresh   매일 cron — 7일 지난 토큰을 60일로 연장
//   POST /sns/publish-due         5분마다 cron — 예약 시각이 된(이미 등록된 브라우저가 만든) 게시물만 올린다
//   GET  /sns/device/status       이 브라우저 등록 상태 (헤더 키)
//   POST /sns/device/register     {label} — 등록 요청(pending). 승인은 아래 approve 또는 Claude 가 SQL 로
// 등록된 브라우저만:
//   GET  /sns/device/pending      승인 기다리는 브라우저 목록
//   POST /sns/device/approve      {id}
//   POST /sns/upload              본문 = JPEG 한 장 → storage sns-media/posts/YYYY-MM/<uuid>.jpg, {path, url}
//   GET  /sns/queue               예약·게시 목록
//   POST /sns/queue               {platforms, image_paths, caption, threads_text, scheduled_at?, now?} — now 면 바로 올림
//   POST /sns/queue/cancel        {id} — 예약 취소
//   POST /sns/queue/retry         {id} — 실패한 플랫폼만 다시 올림
//
// 표 (전부 RLS 켜짐 · 정책 없음 · anon/authenticated 권한 회수 — service role 만 접근):
//   sns_accounts · sns_posts · sns_post_stats · sns_account_stats · sns_devices · sns_queue
// 화면: 오피스 sns/index.html "꿀꿀집 마케팅 회사" (전승훈만)

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ORIGINS = new Set(['https://j65209.github.io', 'https://beaduniverse.kr', 'https://www.beaduniverse.kr']);
const IG = 'https://graph.instagram.com';
const IG_VER = 'v23.0';
const TH = 'https://graph.threads.net';
const TH_VER = 'v1.0';
// 시험 사진 — 오피스 레포 sns/sample/ (GitHub Pages 로 공개, 인스타 API 는 JPEG 만 받는다)
const SAMPLE_IMAGES = [
  'https://j65209.github.io/beaduniverse/sns/sample/test-1.jpg',
  'https://j65209.github.io/beaduniverse/sns/sample/test-2.jpg',
];
const TEST_COOLDOWN_MS = 60_000;
const COLLECT_COOLDOWN_MS = 120_000;
const REFRESH_AFTER_DAYS = 7;
const DAY_MS = 86_400_000;
const MAX_POSTS = 40; // 계정마다 최근 게시물 몇 개까지 볼지
const INSIGHT_DAYS = 90; // 이보다 오래된 게시물은 통계(insights)를 다시 묻지 않는다

const DEVICE_HEADER = 'x-ggul-device';
const BUCKET = 'sns-media';
const MAX_IMAGES = 10; // 카드뉴스 한 번에 최대 장수
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 인스타 사진 한 장 한도
const IG_CAPTION_MAX = 2200;
const IG_HASHTAG_MAX = 30;
const TH_TEXT_MAX = 500;
const MAX_SCHEDULE_DAYS = 75; // 토큰 만료(60일, 자동 연장) 너머로 너무 멀리 예약하지 않게
const STALE_PUBLISHING_MS = 15 * 60_000; // '올리는 중'이 이보다 오래 멈춰 있으면 실패로 돌린다(중복 게시 막으려고 자동 재시도는 안 함)

const IG_MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
const TH_POST_FIELDS = 'id,media_product_type,media_type,media_url,permalink,text,timestamp,thumbnail_url,is_quote_post';
// 게시물 종류마다 받을 수 있는 통계가 달라서, 안 되면 더 작은 묶음으로 다시 묻는다
const IG_FEED_METRICS = [['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'], ['reach', 'likes', 'comments', 'saved', 'shares'], ['reach']];
const IG_REELS_METRICS = [['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time'], ['views', 'reach', 'likes', 'comments', 'saved', 'shares'], ['reach']];
const IG_STORY_METRICS = [['views', 'reach', 'replies', 'shares', 'total_interactions'], ['reach']];
const TH_POST_METRICS = [['views', 'likes', 'replies', 'reposts', 'quotes', 'shares'], ['views', 'likes', 'replies', 'reposts', 'quotes'], ['views']];

const sb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Platform = 'instagram' | 'threads';
type Account = {
  id: number;
  platform: Platform;
  username: string;
  platform_user_id: string;
  access_token: string | null;
  last_check_at: string | null;
  last_collect_at: string | null;
  token_updated_at: string | null;
};
type Step = { name: string; ok: boolean; detail: string };
type Metrics = Record<string, number>;
type Device = { id: number; status: string; code: string; label: string | null };
type QueueRow = {
  id: number;
  platforms: Platform[];
  image_paths: string[];
  caption: string | null;
  threads_text: string | null;
  scheduled_at: string;
  status: string;
  results: Record<string, any>;
  attempts: number;
};

class ApiError extends Error {}

const label = (p: Platform) => (p === 'threads' ? '스레드' : '인스타');
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isPending = (id: string) => !id || id.startsWith('pending:');
const publicUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
const isQueuePath = (p: string) => /^posts\/\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/.test(p);

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.has(origin) ? origin : 'https://j65209.github.io',
    'Access-Control-Allow-Headers': `authorization, x-client-info, apikey, content-type, ${DEVICE_HEADER}`,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function reply(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Graph API 호출 — 토큰은 GET 은 쿼리, POST 는 본문으로만 보낸다 (로그에 남기지 않는다)
async function graph(method: 'GET' | 'POST', url: string, token: string, params: Record<string, string> = {}) {
  let res: Response;
  if (method === 'GET') {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    u.searchParams.set('access_token', token);
    res = await fetch(u);
  } else {
    res = await fetch(url, { method: 'POST', body: new URLSearchParams({ ...params, access_token: token }) });
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.error) {
    const e = j?.error ?? {};
    throw new ApiError(e.error_user_msg || e.message || `HTTP ${res.status}`);
  }
  return j;
}

async function whoAmI(platform: Platform, token: string) {
  if (platform === 'threads') {
    const j = await graph('GET', `${TH}/${TH_VER}/me`, token, { fields: 'id,username' });
    return { id: String(j.id ?? ''), username: String(j.username ?? ''), type: null as string | null };
  }
  const j = await graph('GET', `${IG}/${IG_VER}/me`, token, { fields: 'user_id,username,account_type' });
  return { id: String(j.user_id ?? j.id ?? ''), username: String(j.username ?? ''), type: (j.account_type ?? null) as string | null };
}

const ACCOUNT_FIELDS = 'id, platform, username, platform_user_id, access_token, last_check_at, last_collect_at, token_updated_at';

async function getAccount(id: number): Promise<Account | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  const { data, error } = await sb.from('sns_accounts').select(ACCOUNT_FIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Account | null;
}

// 플랫폼마다 토큰이 있는 첫 계정 (지금은 꿀꿀집 한 계정씩)
async function accountFor(platform: Platform): Promise<Account | null> {
  const { data, error } = await sb
    .from('sns_accounts')
    .select(ACCOUNT_FIELDS)
    .eq('platform', platform)
    .not('access_token', 'is', null)
    .order('id')
    .limit(1);
  if (error) throw error;
  const acc = (data?.[0] ?? null) as Account | null;
  return acc && !isPending(acc.platform_user_id) ? acc : null;
}

const PUBLIC_ACCOUNT_FIELDS =
  'id, platform, username, access_token, token_expires_at, token_updated_at, last_check_at, last_collect_at, last_error, note, profile, profile_at';

async function publicAccounts() {
  const { data, error } = await sb.from('sns_accounts').select(PUBLIC_ACCOUNT_FIELDS).order('id');
  if (error) throw error;
  return (data ?? []).map(({ access_token, ...a }) => ({ ...a, has_token: !!access_token }));
}

async function listAccounts(req: Request) {
  return reply(req, 200, { ok: true, accounts: await publicAccounts() });
}

async function saveToken(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? '').trim();
  const acc = await getAccount(Number(body?.account_id));
  if (!acc) return reply(req, 404, { ok: false, error: '등록되지 않은 계정이에요.' });
  if (!token) return reply(req, 400, { ok: false, error: '토큰을 붙여넣어 주세요.' });
  if (token.length < 30 || token.length > 2048 || /\s/.test(token)) {
    return reply(req, 400, { ok: false, error: '토큰 모양이 아니에요. 복사한 값 전체를 그대로 붙여넣어 주세요.' });
  }

  let who: Awaited<ReturnType<typeof whoAmI>>;
  try {
    who = await whoAmI(acc.platform, token);
  } catch (e) {
    return reply(req, 400, { ok: false, error: `${label(acc.platform)}가 이 토큰을 받지 않았어요 — ${errMsg(e)}` });
  }
  const sameId = !!who.id && who.id === acc.platform_user_id;
  const sameName = !!who.username && who.username.toLowerCase() === acc.username.toLowerCase();
  if (!sameId && !sameName) {
    return reply(req, 403, {
      ok: false,
      error: `이 토큰은 @${who.username || '다른 계정'} 거예요. @${acc.username} 계정 토큰을 넣어 주세요.`,
    });
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 60 * DAY_MS); // 대시보드에서 받은 장기 토큰 = 60일 (연장할 때 정확한 값으로 바뀜)
  const { error } = await sb
    .from('sns_accounts')
    .update({
      access_token: token,
      token_updated_at: now.toISOString(),
      token_expires_at: expires.toISOString(),
      last_error: null,
      username: who.username || acc.username,
      platform_user_id: who.id || acc.platform_user_id,
    })
    .eq('id', acc.id);
  if (error) throw error;
  return reply(req, 200, {
    ok: true,
    username: who.username || acc.username,
    account_type: who.type,
    token_expires_at: expires.toISOString(),
  });
}

async function waitReady(platform: Platform, containerId: string, token: string, tries = 12) {
  const url = platform === 'threads' ? `${TH}/${TH_VER}/${containerId}` : `${IG}/${IG_VER}/${containerId}`;
  const fields = platform === 'threads' ? 'status,error_message' : 'status_code,status';
  let last = { code: 'IN_PROGRESS', detail: '처리 중' };
  for (let i = 0; i < tries; i++) {
    const j = await graph('GET', url, token, { fields });
    const code = String((platform === 'threads' ? j.status : j.status_code) ?? 'IN_PROGRESS');
    last = { code, detail: String((platform === 'threads' ? j.error_message : j.status) ?? code) };
    if (code === 'FINISHED' || code === 'ERROR' || code === 'EXPIRED') return last;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { code: last.code, detail: `아직 처리 중이에요 (${last.detail})` };
}

// 연결 시험 — 컨테이너(올릴 준비)까지만 만든다. 만든 컨테이너는 게시하지 않으면 24시간 뒤 저절로 사라진다.
async function dryRun(req: Request) {
  const body = await req.json().catch(() => ({}));
  const acc = await getAccount(Number(body?.account_id));
  if (!acc) return reply(req, 404, { ok: false, error: '등록되지 않은 계정이에요.' });
  if (!acc.access_token) return reply(req, 400, { ok: false, error: '먼저 토큰을 저장해 주세요.' });
  if (acc.last_check_at && Date.now() - Date.parse(acc.last_check_at) < TEST_COOLDOWN_MS) {
    return reply(req, 429, { ok: false, error: '시험은 1분에 한 번만 할 수 있어요. 잠시 뒤 다시 눌러 주세요.' });
  }
  await sb.from('sns_accounts').update({ last_check_at: new Date().toISOString() }).eq('id', acc.id);

  const token = acc.access_token;
  const steps: Step[] = [];
  const step = (name: string, ok: boolean, detail = '') => steps.push({ name, ok, detail });
  try {
    const who = await whoAmI(acc.platform, token);
    step('토큰 확인', true, `@${who.username}${who.type ? ` · ${who.type}` : ''}`);

    const uid = who.id || acc.platform_user_id;
    const endpoint = acc.platform === 'threads' ? `${TH}/${TH_VER}/${uid}/threads` : `${IG}/${IG_VER}/${uid}/media`;
    // image_paths 를 주면(화면에서 올린 카드뉴스 사진) 그 사진으로, 없으면 고정 시험 사진으로 — 여러 장 묶기는 2장 이상이라 1장이면 두 번 쓴다
    const given = (Array.isArray(body?.image_paths) ? body.image_paths : []).map(String).filter(isQueuePath).slice(0, MAX_IMAGES);
    const images = given.length ? (given.length === 1 ? [given[0], given[0]] : given).map(publicUrl) : SAMPLE_IMAGES;
    const children: string[] = [];
    for (const [i, url] of images.entries()) {
      const params: Record<string, string> = acc.platform === 'threads'
        ? { media_type: 'IMAGE', image_url: url, is_carousel_item: 'true' }
        : { image_url: url, is_carousel_item: 'true' };
      const j = await graph('POST', endpoint, token, params);
      children.push(String(j.id));
      step(`${given.length ? '' : '시험 '}사진 ${i + 1} 준비`, true);
    }

    const caption = '[연결 시험] 오피스 SNS 자동 게시 — 실제로 올리지 않음';
    const carousel = await graph('POST', endpoint, token, acc.platform === 'threads'
      ? { media_type: 'CAROUSEL', children: children.join(','), text: caption }
      : { media_type: 'CAROUSEL', children: children.join(','), caption });
    step('여러 장 묶기 (카드뉴스 형식)', true);

    const status = await waitReady(acc.platform, String(carousel.id), token);
    const ok = status.code === 'FINISHED';
    step(`${label(acc.platform)} 처리 상태`, ok, ok ? '올리기 직전까지 성공 — 실제 게시는 하지 않았어요' : status.detail);
    await sb.from('sns_accounts').update({ last_error: ok ? null : `시험 실패: ${status.detail}` }).eq('id', acc.id);
    return reply(req, 200, { ok, steps });
  } catch (e) {
    const msg = errMsg(e);
    step('오류', false, msg);
    await sb.from('sns_accounts').update({ last_error: `시험 실패: ${msg}` }).eq('id', acc.id);
    return reply(req, 200, { ok: false, steps });
  }
}

// ── 게시물 · 통계 모으기 ────────────────────────────────────────────────

function readInsights(j: any): Metrics {
  const out: Metrics = {};
  for (const m of j?.data ?? []) {
    const v = m?.total_value?.value ?? m?.values?.[0]?.value;
    if (typeof v === 'number' && m?.name) out[String(m.name)] = v;
  }
  return out;
}

async function insightsWithFallback(url: string, token: string, sets: string[][]) {
  let note = '';
  for (const set of sets) {
    try {
      return { metrics: readInsights(await graph('GET', url, token, { metric: set.join(',') })), note: null as string | null };
    } catch (e) {
      note = errMsg(e);
    }
  }
  return { metrics: {} as Metrics, note };
}

const recentEnough = (iso?: string | null) => !!iso && Date.now() - Date.parse(iso) < INSIGHT_DAYS * DAY_MS;

type PostRow = {
  account_id: number;
  media_id: string;
  platform: Platform;
  media_type: string | null;
  product_type: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  metrics: Metrics;
  metrics_at: string;
  metrics_note: string | null;
};

async function collectInstagram(acc: Account) {
  const token = acc.access_token!;
  const uid = acc.platform_user_id;
  const prof = await graph('GET', `${IG}/${IG_VER}/${uid}`, token, {
    fields: 'username,name,followers_count,follows_count,media_count,profile_picture_url',
  });
  const list = await graph('GET', `${IG}/${IG_VER}/${uid}/media`, token, { fields: IG_MEDIA_FIELDS, limit: String(MAX_POSTS) });
  const now = new Date().toISOString();
  const rows: PostRow[] = [];
  for (const p of (list?.data ?? []) as any[]) {
    let metrics: Metrics = {};
    if (typeof p.like_count === 'number') metrics.likes = p.like_count;
    if (typeof p.comments_count === 'number') metrics.comments = p.comments_count;
    let note: string | null = null;
    if (recentEnough(p.timestamp)) {
      const sets = p.media_product_type === 'REELS' ? IG_REELS_METRICS : p.media_product_type === 'STORY' ? IG_STORY_METRICS : IG_FEED_METRICS;
      const r = await insightsWithFallback(`${IG}/${IG_VER}/${p.id}/insights`, token, sets);
      metrics = { ...metrics, ...r.metrics };
      note = r.note;
    }
    rows.push({
      account_id: acc.id,
      media_id: String(p.id),
      platform: 'instagram',
      media_type: p.media_type ?? null,
      product_type: p.media_product_type ?? null,
      caption: p.caption ?? null,
      permalink: p.permalink ?? null,
      thumbnail_url: p.thumbnail_url ?? p.media_url ?? null,
      posted_at: p.timestamp ?? null,
      metrics,
      metrics_at: now,
      metrics_note: note,
    });
  }
  const profile = {
    name: prof.name ?? null,
    followers_count: prof.followers_count ?? null,
    follows_count: prof.follows_count ?? null,
    media_count: prof.media_count ?? null,
    picture: prof.profile_picture_url ?? null,
  };
  return { rows, profile, followers: prof.followers_count ?? null, mediaCount: prof.media_count ?? null };
}

async function collectThreads(acc: Account) {
  const token = acc.access_token!;
  const uid = acc.platform_user_id;
  const prof = await graph('GET', `${TH}/${TH_VER}/${uid}`, token, { fields: 'id,username,name,threads_profile_picture_url' });
  let followers: number | null = null;
  try {
    const fi = await graph('GET', `${TH}/${TH_VER}/${uid}/threads_insights`, token, { metric: 'followers_count' });
    followers = readInsights(fi).followers_count ?? null;
  } catch { /* 통계 권한이 없는 토큰이면 비워 둔다 */ }
  const list = await graph('GET', `${TH}/${TH_VER}/${uid}/threads`, token, { fields: TH_POST_FIELDS, limit: String(MAX_POSTS) });
  const now = new Date().toISOString();
  const rows: PostRow[] = [];
  for (const p of (list?.data ?? []) as any[]) {
    if (p.media_type === 'REPOST_FACADE') continue; // 남의 글을 다시 올린 것은 우리 게시물이 아님
    let metrics: Metrics = {};
    let note: string | null = null;
    if (recentEnough(p.timestamp)) {
      const r = await insightsWithFallback(`${TH}/${TH_VER}/${p.id}/insights`, token, TH_POST_METRICS);
      metrics = r.metrics;
      note = r.note;
    }
    rows.push({
      account_id: acc.id,
      media_id: String(p.id),
      platform: 'threads',
      media_type: p.media_type ?? null,
      product_type: p.media_product_type ?? null,
      caption: p.text ?? null,
      permalink: p.permalink ?? null,
      thumbnail_url: p.thumbnail_url ?? p.media_url ?? null,
      posted_at: p.timestamp ?? null,
      metrics,
      metrics_at: now,
      metrics_note: note,
    });
  }
  const profile = { name: prof.name ?? null, followers_count: followers, picture: prof.threads_profile_picture_url ?? null };
  return { rows, profile, followers, mediaCount: null as number | null };
}

async function collectOne(acc: Account) {
  const got = acc.platform === 'threads' ? await collectThreads(acc) : await collectInstagram(acc);
  if (got.rows.length) {
    const { error: e1 } = await sb.from('sns_posts').upsert(got.rows, { onConflict: 'account_id,media_id' });
    if (e1) throw e1;
    const stats = got.rows
      .filter((r) => Object.keys(r.metrics).length)
      .map((r) => ({ account_id: r.account_id, media_id: r.media_id, metrics: r.metrics }));
    if (stats.length) {
      const { error: e2 } = await sb.from('sns_post_stats').insert(stats);
      if (e2) throw e2;
    }
  }
  await sb.from('sns_account_stats').insert({ account_id: acc.id, followers: got.followers, media_count: got.mediaCount });
  const notes = got.rows.map((r) => r.metrics_note).filter(Boolean);
  await sb
    .from('sns_accounts')
    .update({
      profile: got.profile,
      profile_at: new Date().toISOString(),
      last_collect_at: new Date().toISOString(),
      last_error: notes.length === got.rows.length && notes.length ? `통계 일부를 못 받았어요: ${notes[0]}` : null,
    })
    .eq('id', acc.id);
  return got.rows.length;
}

async function collect(req: Request) {
  const body = await req.json().catch(() => ({}));
  const fromCron = body?.source === 'cron';
  const onlyId = Number(body?.account_id) || null;
  let q = sb.from('sns_accounts').select(ACCOUNT_FIELDS).not('access_token', 'is', null).order('id');
  if (onlyId) q = q.eq('id', onlyId);
  const { data, error } = await q;
  if (error) throw error;

  const results: { username: string; platform: Platform; ok: boolean; posts?: number; error?: string }[] = [];
  for (const acc of (data ?? []) as Account[]) {
    if (isPending(acc.platform_user_id)) continue;
    if (!fromCron && acc.last_collect_at && Date.now() - Date.parse(acc.last_collect_at) < COLLECT_COOLDOWN_MS) {
      results.push({ username: acc.username, platform: acc.platform, ok: false, error: '방금 모았어요. 2분 뒤에 다시 눌러 주세요.' });
      continue;
    }
    await sb.from('sns_accounts').update({ last_collect_at: new Date().toISOString() }).eq('id', acc.id);
    try {
      const n = await collectOne(acc);
      results.push({ username: acc.username, platform: acc.platform, ok: true, posts: n });
    } catch (e) {
      const msg = errMsg(e);
      await sb.from('sns_accounts').update({ last_error: `게시물 모으기 실패: ${msg}` }).eq('id', acc.id);
      results.push({ username: acc.username, platform: acc.platform, ok: false, error: msg });
    }
  }
  return reply(req, 200, { ok: true, results });
}

async function overview(req: Request) {
  const accounts = await publicAccounts();
  const { data: posts, error: e1 } = await sb
    .from('sns_posts')
    .select('account_id, media_id, platform, media_type, product_type, caption, permalink, thumbnail_url, posted_at, metrics, metrics_at, metrics_note')
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(200);
  if (e1) throw e1;
  const since = new Date(Date.now() - 90 * DAY_MS).toISOString();
  const { data: follow, error: e2 } = await sb
    .from('sns_account_stats')
    .select('account_id, captured_at, followers, media_count')
    .gte('captured_at', since)
    .order('captured_at');
  if (e2) throw e2;
  return reply(req, 200, { ok: true, accounts, posts: posts ?? [], followers: follow ?? [] });
}

async function history(req: Request) {
  const u = new URL(req.url);
  const accountId = Number(u.searchParams.get('account_id'));
  const mediaId = String(u.searchParams.get('media_id') ?? '').slice(0, 80);
  if (!accountId || !mediaId) return reply(req, 400, { ok: false, error: '게시물을 골라 주세요.' });
  const { data, error } = await sb
    .from('sns_post_stats')
    .select('captured_at, metrics')
    .eq('account_id', accountId)
    .eq('media_id', mediaId)
    .order('captured_at')
    .limit(500);
  if (error) throw error;
  return reply(req, 200, { ok: true, history: data ?? [] });
}

// 토큰 자동 연장 — 받은 지 24시간이 지나야 연장되고, 연장하면 다시 60일. 7일마다 한 번씩 연장해 둔다.
async function refreshDue(req: Request) {
  const cutoff = new Date(Date.now() - REFRESH_AFTER_DAYS * DAY_MS).toISOString();
  const { data, error } = await sb
    .from('sns_accounts')
    .select('id, platform, username, access_token, token_updated_at')
    .not('access_token', 'is', null)
    .lt('token_updated_at', cutoff);
  if (error) throw error;

  const results: { username: string; ok: boolean }[] = [];
  for (const acc of (data ?? []) as Account[]) {
    const url = acc.platform === 'threads' ? `${TH}/refresh_access_token` : `${IG}/refresh_access_token`;
    const grant = acc.platform === 'threads' ? 'th_refresh_token' : 'ig_refresh_token';
    try {
      const j = await graph('GET', url, acc.access_token!, { grant_type: grant });
      const now = new Date();
      const seconds = Number(j.expires_in) > 0 ? Number(j.expires_in) : 60 * 86_400;
      const { error: e2 } = await sb
        .from('sns_accounts')
        .update({
          access_token: String(j.access_token || acc.access_token),
          token_updated_at: now.toISOString(),
          token_expires_at: new Date(now.getTime() + seconds * 1000).toISOString(),
          last_error: null,
        })
        .eq('id', acc.id);
      if (e2) throw e2;
      results.push({ username: acc.username, ok: true });
    } catch (e) {
      await sb.from('sns_accounts').update({ last_error: `자동 연장 실패: ${errMsg(e)}` }).eq('id', acc.id);
      results.push({ username: acc.username, ok: false });
    }
  }
  return reply(req, 200, { ok: true, checked: results.length, results });
}

// ── 등록된 브라우저 (올리기 권한) ─────────────────────────────────────────

async function sha256hex(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function readDevice(req: Request): Promise<{ hash: string; row: Device | null } | null> {
  const key = req.headers.get(DEVICE_HEADER) ?? '';
  if (key.length < 32 || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) return null;
  const hash = await sha256hex(key);
  const { data, error } = await sb.from('sns_devices').select('id, status, code, label').eq('key_hash', hash).maybeSingle();
  if (error) throw error;
  return { hash, row: (data as Device | null) ?? null };
}

async function approvedDevice(req: Request): Promise<Device | null> {
  const d = await readDevice(req);
  if (!d?.row || d.row.status !== 'approved') return null;
  await sb.from('sns_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', d.row.id);
  return d.row;
}

const NOT_APPROVED = { ok: false, error: '이 브라우저는 아직 올리기 권한이 없어요. 화면 위쪽에서 등록을 요청해 주세요.' };

async function deviceStatus(req: Request) {
  const d = await readDevice(req);
  if (!d) return reply(req, 400, { ok: false, error: '브라우저 키가 없어요. 화면을 새로고침해 주세요.' });
  return reply(req, 200, { ok: true, status: d.row?.status ?? 'none', code: d.row?.code ?? d.hash.slice(0, 6).toUpperCase() });
}

async function deviceRegister(req: Request) {
  const d = await readDevice(req);
  if (!d) return reply(req, 400, { ok: false, error: '브라우저 키가 없어요. 화면을 새로고침해 주세요.' });
  if (d.row) return reply(req, 200, { ok: true, status: d.row.status, code: d.row.code });
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count } = await sb.from('sns_devices').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('created_at', since);
  if ((count ?? 0) >= 20) return reply(req, 429, { ok: false, error: '등록 요청이 너무 많아요. 내일 다시 해 주세요.' });
  const body = await req.json().catch(() => ({}));
  const code = d.hash.slice(0, 6).toUpperCase();
  const { error } = await sb.from('sns_devices').insert({ key_hash: d.hash, code, label: String(body?.label ?? '').slice(0, 120) || null });
  if (error) throw error;
  return reply(req, 200, { ok: true, status: 'pending', code });
}

async function devicePending(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, NOT_APPROVED);
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const { data, error } = await sb
    .from('sns_devices')
    .select('id, code, label, created_at')
    .eq('status', 'pending')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return reply(req, 200, { ok: true, pending: data ?? [] });
}

async function deviceApprove(req: Request) {
  const me = await approvedDevice(req);
  if (!me) return reply(req, 403, NOT_APPROVED);
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  const { data, error } = await sb
    .from('sns_devices')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: `device:${me.code}` })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, code')
    .maybeSingle();
  if (error) throw error;
  if (!data) return reply(req, 404, { ok: false, error: '승인할 요청을 찾지 못했어요.' });
  return reply(req, 200, { ok: true, code: data.code });
}

// ── 카드뉴스 사진 올리기 · 예약 · 게시 ───────────────────────────────────

async function upload(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, NOT_APPROVED);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length < 1024) return reply(req, 400, { ok: false, error: '사진이 비어 있어요.' });
  if (bytes.length > MAX_IMAGE_BYTES) return reply(req, 413, { ok: false, error: '사진 한 장이 8MB 를 넘어요.' });
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    return reply(req, 415, { ok: false, error: 'JPG 사진만 올릴 수 있어요. (화면이 자동으로 바꿔 주는데, 안 되면 JPG 로 저장해서 골라 주세요)' });
  }
  const month = new Date().toISOString().slice(0, 7);
  const path = `posts/${month}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return reply(req, 200, { ok: true, path, url: publicUrl(path) });
}

function cleanText(s: unknown, max: number) {
  return String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

async function queueList(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, NOT_APPROVED);
  const { data, error } = await sb
    .from('sns_queue')
    .select('id, created_at, platforms, image_paths, caption, threads_text, scheduled_at, status, results, attempts, last_attempt_at, note')
    .order('scheduled_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const items = (data ?? []).map((q: any) => ({ ...q, image_urls: (q.image_paths ?? []).map(publicUrl) }));
  return reply(req, 200, { ok: true, items });
}

async function queueCreate(req: Request) {
  const dev = await approvedDevice(req);
  if (!dev) return reply(req, 403, NOT_APPROVED);
  const body = await req.json().catch(() => ({}));
  const platforms = [...new Set(((body?.platforms ?? []) as string[]).filter((p) => p === 'instagram' || p === 'threads'))] as Platform[];
  if (!platforms.length) return reply(req, 400, { ok: false, error: '올릴 곳(인스타·스레드)을 골라 주세요.' });
  const paths = ((body?.image_paths ?? []) as string[]).map(String);
  if (paths.length > MAX_IMAGES) return reply(req, 400, { ok: false, error: `사진은 ${MAX_IMAGES}장까지예요.` });
  if (paths.some((p) => !isQueuePath(p))) return reply(req, 400, { ok: false, error: '사진 경로가 이상해요. 사진을 다시 올려 주세요.' });
  const caption = cleanText(body?.caption, IG_CAPTION_MAX);
  const threadsText = cleanText(body?.threads_text ?? caption, TH_TEXT_MAX);
  if (platforms.includes('instagram') && !paths.length) return reply(req, 400, { ok: false, error: '인스타는 사진이 1장 이상 있어야 올릴 수 있어요.' });
  if ((caption.match(/#[^\s#]+/g) ?? []).length > IG_HASHTAG_MAX) return reply(req, 400, { ok: false, error: `인스타 해시태그는 ${IG_HASHTAG_MAX}개까지예요.` });
  if (platforms.includes('threads') && !paths.length && !threadsText) return reply(req, 400, { ok: false, error: '스레드에 올릴 글이나 사진이 없어요.' });
  for (const p of platforms) {
    if (!(await accountFor(p))) return reply(req, 400, { ok: false, error: `${label(p)} 계정이 아직 연결되지 않았어요.` });
  }
  const now = Date.now();
  const when = body?.now ? now : Date.parse(String(body?.scheduled_at ?? ''));
  if (!Number.isFinite(when)) return reply(req, 400, { ok: false, error: '예약 시각을 골라 주세요.' });
  if (when < now - 60_000) return reply(req, 400, { ok: false, error: '이미 지난 시각이에요. 지금 올리기를 쓰거나 시각을 다시 골라 주세요.' });
  if (when > now + MAX_SCHEDULE_DAYS * DAY_MS) return reply(req, 400, { ok: false, error: `예약은 ${MAX_SCHEDULE_DAYS}일 안으로만 할 수 있어요.` });

  const { data, error } = await sb
    .from('sns_queue')
    .insert({
      device_id: dev.id,
      platforms,
      image_paths: paths,
      caption: platforms.includes('instagram') ? caption : null,
      threads_text: platforms.includes('threads') ? threadsText : null,
      scheduled_at: new Date(when).toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  if (!body?.now) return reply(req, 200, { ok: true, id: data.id, status: 'scheduled' });
  const result = await publishOne(Number(data.id));
  return reply(req, 200, { ok: true, id: data.id, ...result });
}

async function queueCancel(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, NOT_APPROVED);
  const body = await req.json().catch(() => ({}));
  const { data, error } = await sb
    .from('sns_queue')
    .update({ status: 'canceled', note: '화면에서 취소' })
    .eq('id', Number(body?.id))
    .eq('status', 'scheduled')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) return reply(req, 409, { ok: false, error: '예약 상태인 것만 취소할 수 있어요(이미 올라갔거나 올리는 중).' });
  return reply(req, 200, { ok: true });
}

async function queueRetry(req: Request) {
  if (!(await approvedDevice(req))) return reply(req, 403, NOT_APPROVED);
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  const { data, error } = await sb
    .from('sns_queue')
    .update({ status: 'scheduled', scheduled_at: new Date().toISOString(), note: '화면에서 다시 시도' })
    .eq('id', id)
    .in('status', ['failed', 'partial'])
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) return reply(req, 409, { ok: false, error: '실패하거나 일부만 올라간 것만 다시 올릴 수 있어요.' });
  return reply(req, 200, { ok: true, id, ...(await publishOne(id)) });
}

async function publishInstagram(acc: Account, urls: string[], caption: string) {
  const token = acc.access_token!;
  const uid = acc.platform_user_id;
  const ep = `${IG}/${IG_VER}/${uid}/media`;
  let creationId: string;
  if (urls.length === 1) {
    creationId = String((await graph('POST', ep, token, { image_url: urls[0], caption })).id);
  } else {
    const kids: string[] = [];
    for (const u of urls) kids.push(String((await graph('POST', ep, token, { image_url: u, is_carousel_item: 'true' })).id));
    creationId = String((await graph('POST', ep, token, { media_type: 'CAROUSEL', children: kids.join(','), caption })).id);
  }
  const st = await waitReady('instagram', creationId, token, 15);
  if (st.code !== 'FINISHED') throw new ApiError(`인스타가 사진을 처리하지 못했어요 (${st.detail})`);
  const pub = await graph('POST', `${IG}/${IG_VER}/${uid}/media_publish`, token, { creation_id: creationId });
  let permalink: string | null = null;
  try { permalink = (await graph('GET', `${IG}/${IG_VER}/${pub.id}`, token, { fields: 'permalink' })).permalink ?? null; } catch { /* 링크는 다음 수집 때 */ }
  return { media_id: String(pub.id), permalink };
}

async function publishThreads(acc: Account, urls: string[], text: string) {
  const token = acc.access_token!;
  const uid = acc.platform_user_id;
  const ep = `${TH}/${TH_VER}/${uid}/threads`;
  let creationId: string;
  if (!urls.length) {
    creationId = String((await graph('POST', ep, token, { media_type: 'TEXT', text })).id);
  } else if (urls.length === 1) {
    creationId = String((await graph('POST', ep, token, { media_type: 'IMAGE', image_url: urls[0], text })).id);
  } else {
    const kids: string[] = [];
    for (const u of urls) kids.push(String((await graph('POST', ep, token, { media_type: 'IMAGE', image_url: u, is_carousel_item: 'true' })).id));
    creationId = String((await graph('POST', ep, token, { media_type: 'CAROUSEL', children: kids.join(','), text })).id);
  }
  const st = await waitReady('threads', creationId, token, 25); // 스레드는 처리에 30초쯤 걸릴 수 있다
  if (st.code !== 'FINISHED') throw new ApiError(`스레드가 처리하지 못했어요 (${st.detail})`);
  const pub = await graph('POST', `${TH}/${TH_VER}/${uid}/threads_publish`, token, { creation_id: creationId });
  let permalink: string | null = null;
  try { permalink = (await graph('GET', `${TH}/${TH_VER}/${pub.id}`, token, { fields: 'permalink' })).permalink ?? null; } catch { /* 링크는 다음 수집 때 */ }
  return { media_id: String(pub.id), permalink };
}

// 한 건 올리기 — 'scheduled' 인 것을 'publishing' 으로 바꾼 쪽만 진행(동시에 두 번 올라가지 않게).
// 이미 성공한 플랫폼은 건너뛴다(다시 시도 때).
async function publishOne(id: number) {
  const { data: claimed, error } = await sb
    .from('sns_queue')
    .update({ status: 'publishing', last_attempt_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'scheduled')
    .select('id, platforms, image_paths, caption, threads_text, scheduled_at, status, results, attempts')
    .maybeSingle();
  if (error) throw error;
  if (!claimed) return { status: 'skipped', results: {} };
  const row = claimed as QueueRow;
  const results: Record<string, any> = { ...(row.results ?? {}) };
  const urls = (row.image_paths ?? []).map(publicUrl);
  for (const p of row.platforms) {
    if (results[p]?.ok) continue;
    try {
      const acc = await accountFor(p);
      if (!acc) throw new ApiError(`${label(p)} 계정이 연결되어 있지 않아요.`);
      const r = p === 'threads'
        ? await publishThreads(acc, urls, row.threads_text ?? row.caption ?? '')
        : await publishInstagram(acc, urls, row.caption ?? '');
      results[p] = { ok: true, ...r, at: new Date().toISOString() };
      try { await collectOne(acc); } catch { /* 통계는 다음 수집 때 */ }
    } catch (e) {
      results[p] = { ok: false, error: errMsg(e), at: new Date().toISOString() };
    }
  }
  const oks = row.platforms.filter((p) => results[p]?.ok).length;
  const status = oks === row.platforms.length ? 'published' : oks ? 'partial' : 'failed';
  await sb.from('sns_queue').update({ status, results, attempts: (row.attempts ?? 0) + 1 }).eq('id', id);
  return { status, results };
}

async function publishDue(req: Request) {
  // '올리는 중'에서 멈춘 것(함수가 중간에 끊김)은 실패로 표시만 한다 — 실제로 올라갔을 수 있어 자동 재시도는 하지 않음
  const stale = new Date(Date.now() - STALE_PUBLISHING_MS).toISOString();
  await sb
    .from('sns_queue')
    .update({ status: 'failed', note: '올리는 중에 멈췄어요 — 인스타·스레드에 올라갔는지 확인하고 필요하면 다시 시도하세요' })
    .eq('status', 'publishing')
    .lt('last_attempt_at', stale);
  const { data, error } = await sb
    .from('sns_queue')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(5);
  if (error) throw error;
  const done: { id: number; status: string }[] = [];
  for (const q of data ?? []) {
    try {
      const r = await publishOne(Number(q.id));
      done.push({ id: Number(q.id), status: r.status });
    } catch (e) {
      console.error('publish-due', q.id, errMsg(e));
      done.push({ id: Number(q.id), status: 'error' });
    }
  }
  return reply(req, 200, { ok: true, done });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const at = parts.indexOf('sns');
  const route = (at >= 0 ? parts.slice(at + 1) : parts).join('/');
  const M = req.method;
  try {
    if (M === 'GET' && (route === '' || route === 'accounts')) return await listAccounts(req);
    if (M === 'GET' && route === 'overview') return await overview(req);
    if (M === 'GET' && route === 'history') return await history(req);
    if (M === 'POST' && route === 'token') return await saveToken(req);
    if (M === 'POST' && route === 'test') return await dryRun(req);
    if (M === 'POST' && route === 'collect') return await collect(req);
    if (M === 'POST' && route === 'refresh') return await refreshDue(req);
    if (M === 'POST' && route === 'publish-due') return await publishDue(req);
    if (M === 'GET' && route === 'device/status') return await deviceStatus(req);
    if (M === 'POST' && route === 'device/register') return await deviceRegister(req);
    if (M === 'GET' && route === 'device/pending') return await devicePending(req);
    if (M === 'POST' && route === 'device/approve') return await deviceApprove(req);
    if (M === 'POST' && route === 'upload') return await upload(req);
    if (M === 'GET' && route === 'queue') return await queueList(req);
    if (M === 'POST' && route === 'queue') return await queueCreate(req);
    if (M === 'POST' && route === 'queue/cancel') return await queueCancel(req);
    if (M === 'POST' && route === 'queue/retry') return await queueRetry(req);
    return reply(req, 404, { ok: false, error: '없는 경로예요.' });
  } catch (e) {
    console.error('sns', route, errMsg(e));
    return reply(req, 500, { ok: false, error: '서버 오류가 났어요. 잠시 뒤 다시 해 주세요.' });
  }
});
