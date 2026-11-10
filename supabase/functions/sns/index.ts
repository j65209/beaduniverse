// 꿀꿀집 마케팅 회사 / SNS 자동 게시 — 계정 토큰 보관 · 연결 시험 · 토큰 자동 연장 · 게시물·통계 모으기
// (Supabase 엣지 함수 "sns")
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false
//   anon 키는 오피스 소스에 공개돼 있어 막아 주는 게 없으므로 쓰지 않고, 경로마다 스스로 막는다.
//
//   GET  /sns/accounts  계정 목록과 상태 — 토큰 값은 절대 내보내지 않는다
//   GET  /sns/overview  계정(프로필·팔로워 기록) + 게시물(최신 통계) — 화면이 여는 순간 한 번
//   GET  /sns/history?account_id=&media_id=  게시물 하나의 통계 기록(시간에 따른 변화)
//   POST /sns/token     {account_id, token} — 인스타/스레드에 물어서 그 계정 토큰이 맞을 때만 저장
//                       (남의 토큰·가짜 값은 저장 안 됨 → 누가 불러도 우리 토큰을 바꿔치기할 수 없다)
//   POST /sns/test      {account_id} — 고정된 시험 사진 2장으로 '올리기 직전'(컨테이너)까지만 해 본다.
//                       게시(publish)는 이 함수에 아예 없다. 계정마다 1분에 한 번.
//   POST /sns/collect   {account_id?, source?} — 게시물 목록·게시물별 통계·팔로워를 모아 표에 쌓는다.
//                       pg_cron(sns-collect-6h)이 6시간마다, 화면 '새로고침'이 부른다(계정마다 2분에 한 번).
//   POST /sns/refresh   매일 pg_cron(sns-token-refresh-daily)이 부른다 — 7일 지난 토큰을 60일로 연장
//
// 표 (전부 RLS 켜짐 · 정책 없음 · anon/authenticated 권한 회수 — service role 만 접근):
//   sns_accounts(계정·토큰·프로필) · sns_posts(게시물·최신 통계) · sns_post_stats(통계 기록) · sns_account_stats(팔로워 기록)
// 화면: 오피스 sns/index.html "꿀꿀집 마케팅 회사" (전승훈만)

import { createClient } from 'npm:@supabase/supabase-js@2';

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

const IG_MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
const TH_POST_FIELDS = 'id,media_product_type,media_type,media_url,permalink,text,timestamp,thumbnail_url,is_quote_post';
// 게시물 종류마다 받을 수 있는 통계가 달라서, 안 되면 더 작은 묶음으로 다시 묻는다
const IG_FEED_METRICS = [['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'], ['reach', 'likes', 'comments', 'saved', 'shares'], ['reach']];
const IG_REELS_METRICS = [['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time'], ['views', 'reach', 'likes', 'comments', 'saved', 'shares'], ['reach']];
const IG_STORY_METRICS = [['views', 'reach', 'replies', 'shares', 'total_interactions'], ['reach']];
const TH_POST_METRICS = [['views', 'likes', 'replies', 'reposts', 'quotes', 'shares'], ['views', 'likes', 'replies', 'reposts', 'quotes'], ['views']];

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
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

class ApiError extends Error {}

const label = (p: Platform) => (p === 'threads' ? '스레드' : '인스타');
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isPending = (id: string) => !id || id.startsWith('pending:');

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.has(origin) ? origin : 'https://j65209.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function getAccount(id: number): Promise<Account | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  const { data, error } = await sb
    .from('sns_accounts')
    .select('id, platform, username, platform_user_id, access_token, last_check_at, last_collect_at, token_updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Account | null;
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

async function waitReady(platform: Platform, containerId: string, token: string) {
  const url = platform === 'threads' ? `${TH}/${TH_VER}/${containerId}` : `${IG}/${IG_VER}/${containerId}`;
  const fields = platform === 'threads' ? 'status,error_message' : 'status_code,status';
  let last = { code: 'IN_PROGRESS', detail: '처리 중' };
  for (let i = 0; i < 12; i++) {
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
    const children: string[] = [];
    for (const [i, url] of SAMPLE_IMAGES.entries()) {
      const params: Record<string, string> = acc.platform === 'threads'
        ? { media_type: 'IMAGE', image_url: url, is_carousel_item: 'true' }
        : { image_url: url, is_carousel_item: 'true' };
      const j = await graph('POST', endpoint, token, params);
      children.push(String(j.id));
      step(`시험 사진 ${i + 1} 준비`, true);
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
      last_error: notes.length === got.rows.length && notes.length ? `통계 일부를 못 받았어요: ${notes[0]}` : null,
    })
    .eq('id', acc.id);
  return got.rows.length;
}

async function collect(req: Request) {
  const body = await req.json().catch(() => ({}));
  const fromCron = body?.source === 'cron';
  const onlyId = Number(body?.account_id) || null;
  let q = sb
    .from('sns_accounts')
    .select('id, platform, username, platform_user_id, access_token, last_check_at, last_collect_at, token_updated_at')
    .not('access_token', 'is', null)
    .order('id');
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] ?? '';
  const route = last === 'sns' ? '' : last;
  try {
    if (req.method === 'GET' && (route === '' || route === 'accounts')) return await listAccounts(req);
    if (req.method === 'GET' && route === 'overview') return await overview(req);
    if (req.method === 'GET' && route === 'history') return await history(req);
    if (req.method === 'POST' && route === 'token') return await saveToken(req);
    if (req.method === 'POST' && route === 'test') return await dryRun(req);
    if (req.method === 'POST' && route === 'collect') return await collect(req);
    if (req.method === 'POST' && route === 'refresh') return await refreshDue(req);
    return reply(req, 404, { ok: false, error: '없는 경로예요.' });
  } catch (e) {
    console.error('sns', route, errMsg(e));
    return reply(req, 500, { ok: false, error: '서버 오류가 났어요. 잠시 뒤 다시 해 주세요.' });
  }
});
