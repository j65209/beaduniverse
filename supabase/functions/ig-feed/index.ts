// 인스타 피드 시뮬레이터 (오피스 feed/, 2026-11-20) — 브랜드 인스타의 '지금 피드'를 읽어 온다.
//
// 연결: 페이스북 사용자 토큰(EAA…, Meta 앱 for_ins · Graph API 탐색기에서 만들고 '연장'한 60일 토큰)을 화면에 붙여넣으면
//   /me/accounts 로 그 사람이 관리하는 페이지 + 페이지에 연결된 인스타 비즈니스 계정을 받아 페이지 토큰을 저장한다
//   (60일 사용자 토큰에서 받은 페이지 토큰은 만료가 없다). 꿀꿀집(sns 함수)의 인스타 로그인 토큰으로는
//   다른 계정을 읽는 business_discovery 가 안 돼서(2026-11-20 확인: "nonexisting field") 따로 둔다.
// 읽기: 브랜드 인스타 아이디가 연결된 페이지의 인스타면 그 페이지 토큰으로 /{ig-id}/media,
//   아니면 연결된 아무 인스타 계정으로 business_discovery(공개 비즈니스 · 크리에이터 계정만).
// 사진: 인스타 CDN 주소는 며칠 뒤 만료라서 공개 버킷 ig-feed/{아이디}/{media_id}.jpg 로 복사해 둔다 (피드에서 빠진 건 지움).
//   6시간 넘은 피드는 화면이 열 때 다시 받고, cron 'ig-feed-refresh-6h' 가 브랜드마다 6시간마다 받는다.
// 쓰기 경로는 /connect(토큰 — 우리 브랜드 페이지가 있는 토큰만 받음) · /brand(브랜드 인스타 아이디 바꾸기) · /refresh(1분에 한 번).
// 표: ig_feed_brands(공개 읽기) · ig_feed_conn · ig_feed_pages(서버 전용, 토큰). 게시(올리기)는 아직 없다.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORIGINS = new Set(['https://j65209.github.io', 'https://beaduniverse.kr', 'https://www.beaduniverse.kr']);
const FB = 'https://graph.facebook.com/v23.0';
const BUCKET = 'ig-feed';
const CRON_HEADER = 'x-ggul-cron'; // pg_cron 만 아는 열쇠 (public.sns_settings 'cron_key')
const MAX_MEDIA = 30;
const STALE_MS = 6 * 3600_000;
const FORCE_COOLDOWN_MS = 60_000;
const FETCH_LOCK_MS = 120_000;
const MAX_IMG_BYTES = 10 * 1024 * 1024;
const IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// 오피스 브랜드 키 (index.html BRAND_SECTIONS 와 같음 · 클리어타입은 잠시 중단이라 뺌). re = 페이지 이름 · 인스타 아이디로 찾기
const BRANDS: Record<string, { name: string; re: RegExp }> = {
  '6a': { name: '식스에이', re: /(^|[^0-9a-z])6a|six\s*a|식스에이/i },
  yar: { name: '야르', re: /y[aä]r\b|y[aä]r[._]|야르/i },
  pp: { name: '프로덕트피알', re: /produkt|product\s*pr|프로덕트|프피/i },
  akoi: { name: '아코이하우스', re: /akoi|아코이/i },
  kop: { name: '코페리', re: /coferry|코페리/i },
  apt: { name: '아페티', re: /apeti|아페티/i },
  koz: { name: '코즈미', re: /cosmi|kozmi|코즈미/i },
};

// 게시물 칸 — 안 되면 더 작은 묶음으로 다시 묻는다 (business_discovery 는 받을 수 있는 칸이 더 적을 수 있음)
const MEDIA_FIELD_SETS = [
  'id,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,caption,like_count,comments_count,is_shared_to_feed,children{media_type,media_url,thumbnail_url}',
  'id,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,caption,like_count,comments_count',
  'id,media_type,media_url,permalink,timestamp,caption',
];
const PROFILE_FIELDS = 'username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url';

class ApiError extends Error {
  code?: number;
  constructor(m: string, code?: number) {
    super(m);
    this.code = code;
  }
}
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const publicUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
const okUser = (u: string) => /^[a-z0-9._]{1,30}$/.test(u);

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

// Graph API — 토큰은 쿼리로만 (로그에 남기지 않는다)
async function fbGet(path: string, token: string, params: Record<string, string> = {}) {
  const u = new URL(path.startsWith('http') ? path : `${FB}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('access_token', token);
  const res = await fetch(u);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.error) {
    const e = j?.error ?? {};
    throw new ApiError(e.error_user_msg || e.message || `HTTP ${res.status}`, e.code);
  }
  return j;
}

// pg_cron 이 보낸 요청인지 (sns 함수와 같은 열쇠)
let cronKey: string | null = null;
async function isCron(req: Request) {
  const got = req.headers.get(CRON_HEADER) ?? '';
  if (got.length < 32) return false;
  if (!cronKey) {
    const { data } = await sb.from('sns_settings').select('value').eq('key', 'cron_key').maybeSingle();
    cronKey = data?.value ?? null;
  }
  if (!cronKey || got.length !== cronKey.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ cronKey.charCodeAt(i);
  return diff === 0;
}

type Page = { page_id: string; page_name: string | null; page_token: string | null; ig_id: string | null; ig_username: string | null };
type BrandRow = {
  brand: string;
  ig_username: string | null;
  profile: any;
  media: any[];
  source: string | null;
  fetched_at: string | null;
  fetching_at: string | null;
  last_error: string | null;
};
const ROW_FIELDS = 'brand, ig_username, profile, media, source, fetched_at, fetching_at, last_error';

async function conn() {
  const { data, error } = await sb.from('ig_feed_conn').select('user_token, token_expires_at, fb_name, scopes, updated_at, last_error').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data as { user_token: string | null; token_expires_at: string | null; fb_name: string | null; scopes: string[] | null; updated_at: string; last_error: string | null } | null;
}
async function pages(): Promise<Page[]> {
  const { data, error } = await sb.from('ig_feed_pages').select('page_id, page_name, page_token, ig_id, ig_username');
  if (error) throw error;
  return (data ?? []) as Page[];
}
async function brandRow(brand: string): Promise<BrandRow | null> {
  const { data, error } = await sb.from('ig_feed_brands').select(ROW_FIELDS).eq('brand', brand).maybeSingle();
  if (error) throw error;
  return data as BrandRow | null;
}
const connected = (c: Awaited<ReturnType<typeof conn>>, ps: Page[]) => !!c?.user_token && ps.some((p) => p.ig_id && p.page_token);

// ── 피드 받기 ───────────────────────────────────────────────────────────

async function mediaWithFallback(get: (fields: string) => Promise<any[]>) {
  let last: unknown = null;
  for (const f of MEDIA_FIELD_SETS) {
    try {
      return await get(f);
    } catch (e) {
      last = e;
      // 권한 · 토큰 문제는 칸을 줄여도 같다
      if (e instanceof ApiError && (e.code === 190 || e.code === 10 || e.code === 200 || e.code === 4 || e.code === 17 || e.code === 32)) throw e;
    }
  }
  throw last;
}

async function fetchOwn(p: Page) {
  const tok = p.page_token!;
  const profile = await fbGet(p.ig_id!, tok, { fields: PROFILE_FIELDS });
  const media = await mediaWithFallback(async (fields) => (await fbGet(`${p.ig_id}/media`, tok, { fields, limit: String(MAX_MEDIA) })).data ?? []);
  return { profile, media, source: 'own' };
}

async function fetchDiscovery(via: Page, username: string) {
  const tok = via.page_token!;
  let bd: any = {};
  const media = await mediaWithFallback(async (fields) => {
    const j = await fbGet(via.ig_id!, tok, {
      fields: `business_discovery.username(${username}){${PROFILE_FIELDS},media.limit(${MAX_MEDIA}){${fields}}}`,
    });
    bd = j.business_discovery ?? {};
    return bd.media?.data ?? [];
  });
  const profile: Record<string, unknown> = {};
  for (const k of PROFILE_FIELDS.split(',')) if (bd[k] !== undefined) profile[k] = bd[k];
  return { profile, media, source: 'discovery' };
}

async function copyImage(src: string, path: string): Promise<boolean> {
  try {
    const r = await fetch(src);
    if (!r.ok) return false;
    const ct = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!IMG_TYPES.has(ct)) return false;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (!buf.length || buf.length > MAX_IMG_BYTES) return false;
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: true, cacheControl: '604800' });
    return !error;
  } catch {
    return false;
  }
}

async function listFolder(folder: string): Promise<Set<string>> {
  const out = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(BUCKET).list(folder, { limit: 1000, offset });
    if (error || !data?.length) break;
    data.forEach((o) => out.add(o.name));
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

async function refreshBrand(brand: string, force = false): Promise<BrandRow | null> {
  const row = await brandRow(brand);
  if (!row) return null;
  const user = (row.ig_username ?? '').toLowerCase();
  if (!user) {
    await sb.from('ig_feed_brands').update({ last_error: '인스타 아이디가 아직 정해지지 않았어요', updated_at: new Date().toISOString() }).eq('brand', brand);
    return await brandRow(brand);
  }
  if (!force && row.fetched_at && Date.now() - Date.parse(row.fetched_at) < FORCE_COOLDOWN_MS) return row;
  // 한 번에 하나만 받기 (2분 잠금)
  const lockIso = new Date(Date.now() - FETCH_LOCK_MS).toISOString();
  const { data: locked } = await sb
    .from('ig_feed_brands')
    .update({ fetching_at: new Date().toISOString() })
    .eq('brand', brand)
    .or(`fetching_at.is.null,fetching_at.lt.${lockIso}`)
    .select('brand');
  if (!locked?.length) return row; // 다른 요청이 받는 중
  try {
    const c = await conn();
    const ps = await pages();
    if (!connected(c, ps)) throw new ApiError('인스타가 아직 연결되지 않았어요');
    const own = ps.find((p) => p.ig_id && p.page_token && (p.ig_username ?? '').toLowerCase() === user);
    let got;
    if (own) got = await fetchOwn(own);
    else {
      const via = ps.find((p) => p.ig_id && p.page_token)!;
      try {
        got = await fetchDiscovery(via, user);
      } catch (e) {
        const m = errMsg(e);
        if (/not.*found|cannot be found|does not exist|invalid user/i.test(m) || (e as ApiError).code === 110) {
          throw new ApiError(`@${user} 를 찾지 못했어요 — 아이디가 맞는지, 비즈니스 · 크리에이터 계정인지 확인해 주세요`);
        }
        throw e;
      }
    }

    // 프로필 그리드에 안 나오는 릴스(피드에 공유 안 함)는 뺀다
    const media = (got.media as any[])
      .filter((m) => !(m.media_product_type === 'REELS' && m.is_shared_to_feed === false))
      .slice(0, MAX_MEDIA);

    const folder = user;
    const have = await listFolder(folder);
    const keep = new Set<string>();
    const out: any[] = [];
    const jobs: (() => Promise<void>)[] = [];
    for (const m of media) {
      const kids: any[] = m.children?.data ?? [];
      const first = kids[0];
      const src: string | null =
        (m.media_type === 'VIDEO' ? m.thumbnail_url || m.media_url : m.media_url) ||
        (first ? (first.media_type === 'VIDEO' ? first.thumbnail_url : first.media_url) : null) ||
        m.thumbnail_url ||
        null;
      const name = `${String(m.id).replace(/[^0-9A-Za-z_]/g, '')}.jpg`;
      keep.add(name);
      const item = {
        id: String(m.id),
        type: m.media_type ?? null,
        product: m.media_product_type ?? null,
        img: null as string | null,
        permalink: m.permalink ?? null,
        ts: m.timestamp ?? null,
        caption: typeof m.caption === 'string' ? m.caption.slice(0, 400) : null,
        likes: typeof m.like_count === 'number' ? m.like_count : null,
        comments: typeof m.comments_count === 'number' ? m.comments_count : null,
        kids: kids.length || null,
      };
      out.push(item);
      if (have.has(name)) item.img = publicUrl(`${folder}/${name}`);
      else if (src) {
        jobs.push(async () => {
          item.img = (await copyImage(src, `${folder}/${name}`)) ? publicUrl(`${folder}/${name}`) : src;
        });
      }
    }
    // 프로필 사진
    let pic: string | null = null;
    const ppu = (got.profile as any)?.profile_picture_url;
    if (ppu) {
      jobs.push(async () => {
        pic = (await copyImage(ppu, `${folder}/_profile.jpg`)) ? `${publicUrl(`${folder}/_profile.jpg`)}?v=${Date.now()}` : ppu;
      });
    }
    keep.add('_profile.jpg');
    for (let i = 0; i < jobs.length; i += 6) await Promise.all(jobs.slice(i, i + 6).map((f) => f()));
    // 피드에서 빠진 사진 지우기
    const stale = [...have].filter((n) => !keep.has(n) && !n.startsWith('.')).map((n) => `${folder}/${n}`);
    if (stale.length) await sb.storage.from(BUCKET).remove(stale).catch(() => {});

    const p = got.profile as any;
    const profile = {
      username: p.username ?? user,
      name: p.name ?? null,
      biography: p.biography ?? null,
      website: p.website ?? null,
      followers: typeof p.followers_count === 'number' ? p.followers_count : null,
      follows: typeof p.follows_count === 'number' ? p.follows_count : null,
      posts: typeof p.media_count === 'number' ? p.media_count : null,
      pic: pic ?? (row.profile?.pic ?? null),
    };
    const now = new Date().toISOString();
    await sb
      .from('ig_feed_brands')
      .update({ profile, media: out, source: got.source, fetched_at: now, fetching_at: null, last_error: null, updated_at: now })
      .eq('brand', brand);
    if (c?.last_error) await sb.from('ig_feed_conn').update({ last_error: null }).eq('id', 1);
  } catch (e) {
    const m = errMsg(e);
    const expired = e instanceof ApiError && e.code === 190;
    await sb
      .from('ig_feed_brands')
      .update({ fetching_at: null, last_error: expired ? '페이스북 연결이 끊겼어요 — 다시 연결해 주세요' : m, updated_at: new Date().toISOString() })
      .eq('brand', brand);
    if (expired) await sb.from('ig_feed_conn').update({ last_error: '토큰이 만료됐거나 권한이 바뀌었어요 — 다시 연결해 주세요' }).eq('id', 1);
  }
  return await brandRow(brand);
}

function clean(row: BrandRow | null) {
  if (!row) return null;
  return {
    brand: row.brand,
    ig_username: row.ig_username,
    profile: row.profile,
    media: row.media ?? [],
    source: row.source,
    fetched_at: row.fetched_at,
    fetching: !!row.fetching_at && Date.now() - Date.parse(row.fetching_at) < FETCH_LOCK_MS,
    last_error: row.last_error,
  };
}

// ── 경로 ───────────────────────────────────────────────────────────────

async function status(req: Request) {
  const c = await conn();
  const ps = await pages();
  const { data: rows } = await sb.from('ig_feed_brands').select('brand, ig_username, source, fetched_at, last_error, media').order('brand');
  return reply(req, 200, {
    ok: true,
    connected: connected(c, ps),
    fb_name: c?.fb_name ?? null,
    token_expires_at: c?.token_expires_at ?? null,
    connected_at: c?.updated_at ?? null,
    last_error: c?.last_error ?? null,
    accounts: ps.filter((p) => p.ig_username).map((p) => ({ page: p.page_name, username: p.ig_username })),
    pages_without_ig: ps.filter((p) => !p.ig_id).map((p) => p.page_name),
    brands: (rows ?? []).map((r: any) => ({
      brand: r.brand,
      ig_username: r.ig_username,
      source: r.source,
      fetched_at: r.fetched_at,
      last_error: r.last_error,
      count: Array.isArray(r.media) ? r.media.length : 0,
    })),
  });
}

async function feed(req: Request, url: URL, bg: (p: Promise<unknown>) => void) {
  const brand = url.searchParams.get('brand') ?? '';
  if (!BRANDS[brand]) return reply(req, 400, { ok: false, error: '없는 브랜드예요.' });
  let row = await brandRow(brand);
  const c = await conn();
  const ps = await pages();
  const isConn = connected(c, ps);
  let refreshing = false;
  if (isConn && row?.ig_username) {
    const stale = !row.fetched_at || Date.now() - Date.parse(row.fetched_at) > STALE_MS;
    if (stale) {
      if (!row.fetched_at || !(row.media ?? []).length) row = await refreshBrand(brand, true); // 처음엔 기다렸다가 보여 준다
      else {
        refreshing = true;
        bg(refreshBrand(brand, true));
      }
    }
  }
  return reply(req, 200, { ok: true, connected: isConn, refreshing, row: clean(row) });
}

async function refresh(req: Request) {
  const body = await req.json().catch(() => ({}));
  const brand = String(body?.brand ?? '');
  if (!BRANDS[brand]) return reply(req, 400, { ok: false, error: '없는 브랜드예요.' });
  const c = await conn();
  if (!connected(c, await pages())) return reply(req, 400, { ok: false, error: '인스타가 아직 연결되지 않았어요.' });
  const row = await refreshBrand(brand, false);
  return reply(req, 200, { ok: true, connected: true, row: clean(row) });
}

async function setBrand(req: Request, bg: (p: Promise<unknown>) => void) {
  const body = await req.json().catch(() => ({}));
  const brand = String(body?.brand ?? '');
  const user = String(body?.ig_username ?? '').trim().replace(/^@/, '').toLowerCase();
  if (!BRANDS[brand]) return reply(req, 400, { ok: false, error: '없는 브랜드예요.' });
  if (user && !okUser(user)) return reply(req, 400, { ok: false, error: '인스타 아이디는 영문 소문자 · 숫자 · . · _ 만 (30자까지) 돼요.' });
  const row = await brandRow(brand);
  if ((row?.ig_username ?? '') !== user) {
    await sb
      .from('ig_feed_brands')
      .update({ ig_username: user || null, profile: null, media: [], source: null, fetched_at: null, last_error: null, updated_at: new Date().toISOString() })
      .eq('brand', brand);
  }
  const c = await conn();
  const isConn = connected(c, await pages());
  const out = isConn && user ? await refreshBrand(brand, true) : await brandRow(brand);
  return reply(req, 200, { ok: true, connected: isConn, row: clean(out) });
}

async function connect(req: Request, bg: (p: Promise<unknown>) => void) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? '').trim();
  if (/^IG/.test(token)) return reply(req, 400, { ok: false, error: '인스타 로그인 토큰(IG…)이에요. 페이스북 토큰(EAA…)을 붙여넣어 주세요.' });
  if (!/^EA[A-Za-z0-9]{30,1200}$/.test(token)) return reply(req, 400, { ok: false, error: '페이스북 토큰(EAA… 로 시작)을 통째로 붙여넣어 주세요.' });

  let me: any;
  try {
    me = await fbGet('me', token, { fields: 'id,name' });
  } catch (e) {
    return reply(req, 400, { ok: false, error: `토큰을 확인하지 못했어요: ${errMsg(e)}` });
  }
  let expiresAt: string | null = null;
  let scopes: string[] = [];
  try {
    const d = (await fbGet('debug_token', token, { input_token: token })).data ?? {};
    if (typeof d.expires_at === 'number' && d.expires_at > 0) expiresAt = new Date(d.expires_at * 1000).toISOString();
    if (Array.isArray(d.scopes)) scopes = d.scopes.map(String);
  } catch { /* 만료 정보를 못 받아도 연결은 된다 */ }

  // 페이지 + 연결된 인스타
  const got: Page[] = [];
  try {
    let next: string | null = null;
    let j = await fbGet('me/accounts', token, { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: '100' });
    for (let guard = 0; guard < 10; guard++) {
      for (const p of j.data ?? []) {
        got.push({
          page_id: String(p.id),
          page_name: p.name ?? null,
          page_token: p.access_token ?? null,
          ig_id: p.instagram_business_account?.id ? String(p.instagram_business_account.id) : null,
          ig_username: p.instagram_business_account?.username ? String(p.instagram_business_account.username).toLowerCase() : null,
        });
      }
      next = j.paging?.next ?? null;
      if (!next) break;
      const r = await fetch(next);
      j = await r.json();
      if (j?.error) break;
    }
  } catch (e) {
    return reply(req, 400, { ok: false, error: `페이지 목록을 못 받았어요 (pages_show_list 권한 필요): ${errMsg(e)}` });
  }
  const withIg = got.filter((p) => p.ig_id && p.page_token);
  if (!withIg.length) {
    return reply(req, 400, {
      ok: false,
      error: got.length
        ? `페이지 ${got.length}개를 받았지만 인스타가 연결된 페이지가 없어요. 토큰을 만들 때 instagram_basic 권한을 넣고, 페이스북 창에서 인스타 계정도 골라 주세요.`
        : '페이지를 하나도 못 받았어요. 토큰을 만들 때 pages_show_list 권한을 넣고, 페이스북 창에서 브랜드 페이지를 모두 골라 주세요.',
    });
  }
  const ours = withIg.filter((p) => Object.values(BRANDS).some((b) => b.re.test(p.page_name ?? '') || b.re.test(p.ig_username ?? '')));
  if (!ours.length) return reply(req, 400, { ok: false, error: '우리 브랜드 페이지가 하나도 없는 계정이에요. 브랜드 페이지를 관리하는 페이스북으로 만들어 주세요.' });

  const now = new Date().toISOString();
  const { error: e1 } = await sb
    .from('ig_feed_conn')
    .upsert({ id: 1, user_token: token, token_expires_at: expiresAt, fb_name: me?.name ?? null, scopes, updated_at: now, last_error: null });
  if (e1) throw e1;
  await sb.from('ig_feed_pages').delete().neq('page_id', '');
  const { error: e2 } = await sb.from('ig_feed_pages').insert(got.map((p) => ({ ...p, updated_at: now })));
  if (e2) throw e2;

  // 아이디가 비어 있는 브랜드는 페이지 이름 · 인스타 아이디로 찾아 채운다 (.kr · _kr 우선)
  const { data: rows } = await sb.from('ig_feed_brands').select('brand, ig_username');
  const mapped: Record<string, string> = {};
  for (const r of (rows ?? []) as { brand: string; ig_username: string | null }[]) {
    const b = BRANDS[r.brand];
    if (!b || r.ig_username) continue;
    const cand = withIg
      .filter((p) => b.re.test(p.page_name ?? '') || b.re.test(p.ig_username ?? ''))
      .sort((x, y) => Number(/[._]kr$/.test(y.ig_username ?? '')) - Number(/[._]kr$/.test(x.ig_username ?? '')) || (x.ig_username ?? '').length - (y.ig_username ?? '').length);
    if (cand[0]?.ig_username) {
      mapped[r.brand] = cand[0].ig_username;
      await sb.from('ig_feed_brands').update({ ig_username: cand[0].ig_username, updated_at: now }).eq('brand', r.brand);
    }
  }
  // 전 브랜드 피드 새로 받기 (뒤에서)
  bg(refreshAll());

  const shortLived = !!expiresAt && Date.parse(expiresAt) - Date.now() < 2 * 86_400_000;
  return reply(req, 200, {
    ok: true,
    fb_name: me?.name ?? null,
    token_expires_at: expiresAt,
    short_lived: shortLived,
    accounts: withIg.map((p) => ({ page: p.page_name, username: p.ig_username })),
    mapped,
  });
}

async function refreshAll() {
  const { data: rows } = await sb.from('ig_feed_brands').select('brand, ig_username').not('ig_username', 'is', null);
  const out: { brand: string; ok: boolean; error?: string | null }[] = [];
  for (const r of (rows ?? []) as { brand: string }[]) {
    if (!BRANDS[r.brand]) continue;
    const row = await refreshBrand(r.brand, true);
    out.push({ brand: r.brand, ok: !row?.last_error, error: row?.last_error ?? null });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const at = parts.indexOf('ig-feed');
  const route = (at >= 0 ? parts.slice(at + 1) : parts).join('/');
  const M = req.method;
  const bg = (p: Promise<unknown>) => {
    const w = p.catch((e) => console.error('ig-feed bg', errMsg(e)));
    try {
      // @ts-ignore EdgeRuntime 은 Supabase 엣지 런타임 전역
      EdgeRuntime.waitUntil(w);
    } catch { /* 로컬 */ }
  };
  try {
    if (M === 'GET' && (route === '' || route === 'status')) return await status(req);
    if (M === 'GET' && route === 'feed') return await feed(req, url, bg);
    if (M === 'POST' && route === 'refresh') return await refresh(req);
    if (M === 'POST' && route === 'brand') return await setBrand(req, bg);
    if (M === 'POST' && route === 'connect') return await connect(req, bg);
    if (M === 'POST' && route === 'refresh-all') {
      if (!(await isCron(req))) return reply(req, 403, { ok: false, error: 'cron 전용이에요.' });
      return reply(req, 200, { ok: true, results: await refreshAll() });
    }
    return reply(req, 404, { ok: false, error: '없는 경로예요.' });
  } catch (e) {
    console.error('ig-feed', route, errMsg(e));
    return reply(req, 500, { ok: false, error: errMsg(e) });
  }
});
