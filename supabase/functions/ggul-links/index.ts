// 꿀꿀집 링크 모음 (Supabase 엣지 함수 "ggul-links") — 공개 페이지 https://brightbeed.kr/ggulggulzip/
// 묶음(ggul_sets: 카드뉴스 1건 = 1묶음) + 링크(ggul_links: 짧은 주소 · 클릭 수). 표는 RLS 만 켜 두고 이 함수(서비스 롤)로만 읽고 쓴다.
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false (공개 페이지 · 짧은 링크가 부르는 주소)
//
//   GET  /ggul-links                 공개 목록 — 켜진 묶음 중 '게시물이 올라간 것'(또는 화면에서 직접 만든 것) + 따로 링크
//   GET  /ggul-links/go/<slug>       짧은 링크 → 판매처로 302 (클릭 1 — 미리보기 봇은 안 셈)
//   GET  /ggul-links/admin           전체(숨긴 것 · 클릭 수 포함) — 등록된 브라우저(x-ggul-device)
//   POST /ggul-links/save-set        묶음 추가 · 수정 {id?, title, subtitle?, as_of?, active?, sort?} — 등록된 브라우저
//   POST /ggul-links/save-link       링크 추가 · 수정 {id?, set_id?, slug?, title, url, image_url?, price?, original_price?, label?, note?, sort?, active?}
//   POST /ggul-links/delete          {type:'set'|'link', id} — 등록된 브라우저
//   POST /ggul-links/agent-set       제작 에이전트(x-ggul-agent): {queue_id, title?, subtitle?, as_of?, links:[{title, url, price?, original_price?, image_url?, label?, note?}]}
//                                    → queue_id 묶음을 새로 쓰고(예전 링크는 지움) 짧은 주소를 돌려준다. 게시물이 올라가야 공개된다.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const PAGE_URL = 'https://brightbeed.kr/ggulggulzip/';
const ORIGINS = new Set([
  'https://brightbeed.kr', 'https://www.brightbeed.kr',
  'https://j65209.github.io', 'https://beaduniverse.kr', 'https://www.beaduniverse.kr',
]);
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;
const SLUG_ABC = 'abcdefghjkmnpqrstuvwxyz23456789'; // 헷갈리는 i · l · o · 0 · 1 뺌
const MAX_LINKS_PER_SET = 30;
const BOT_RE = /bot|crawl|spider|facebookexternalhit|kakaotalk-scrap|daumoa|yeti|slurp|preview|embedly|whatsapp|telegram|discord|slack|skype|line\/|headless/i;
const LINK_ADMIN = 'id, set_id, slug, title, url, image_url, price, original_price, label, note, sort, active, clicks, last_click_at, created_at, updated_at';
const SET_ADMIN = 'id, queue_id, title, subtitle, as_of, active, sort, source, created_at, updated_at';

const sb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

function cors(req: Request, open: boolean): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': open ? '*' : (ORIGINS.has(origin) ? origin : 'https://j65209.github.io'),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ggul-device, x-ggul-agent',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function reply(req: Request, status: number, body: unknown, opts: { open?: boolean; cache?: string } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req, !!opts.open), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': opts.cache ?? 'no-store' },
  });
}

// ── 인증 ────────────────────────────────────────────────────────────────────────
async function sha256hex(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function safeEq(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function approvedDevice(req: Request) { // sns · sns-tg 와 같은 방식
  const key = req.headers.get('x-ggul-device') ?? '';
  if (key.length < 32 || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) return false;
  const { data } = await sb.from('sns_devices').select('id, status').eq('key_hash', await sha256hex(key)).maybeSingle();
  if (!data || data.status !== 'approved') return false;
  await sb.from('sns_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id);
  return true;
}
async function agentOk(req: Request) { // sns-tg 의 제작 에이전트 열쇠와 같은 것
  const got = req.headers.get('x-ggul-agent') ?? '';
  if (got.length < 20) return false;
  const { data } = await sb.from('sns_settings').select('value').eq('key', 'agent_key_hash').maybeSingle();
  return !!data?.value && safeEq(await sha256hex(got), data.value);
}

// ── 값 다듬기 ───────────────────────────────────────────────────────────────────
function text(v: unknown, max: number): string | null {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}
function won(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? Math.round(n) : null;
}
function httpUrl(v: unknown, httpsOnly = false): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && (httpsOnly || u.protocol !== 'http:')) return null;
    return u.toString().slice(0, 2000);
  } catch { return null; }
}
function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function randomSlug(n = 5) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => SLUG_ABC[x % SLUG_ABC.length]).join('');
}
async function freeSlug() {
  for (let i = 0; i < 8; i++) {
    const s = randomSlug(i < 4 ? 5 : 6);
    const { data } = await sb.from('ggul_links').select('id').eq('slug', s).maybeSingle();
    if (!data) return s;
  }
  throw new Error('짧은 주소를 만들지 못했어요. 다시 해 주세요.');
}
function linkRow(body: any, forAgent = false) {
  const title = text(body?.title, 120);
  const url = httpUrl(body?.url);
  if (!title) throw new Error('링크 제목을 적어 주세요.');
  if (!url) throw new Error(`판매처 주소가 이상해요${title ? ` (${title})` : ''} — http(s):// 로 시작하는 주소만 받아요.`);
  const row: Record<string, unknown> = {
    title, url,
    image_url: httpUrl(body?.image_url, true),
    price: won(body?.price),
    original_price: won(body?.original_price),
    label: text(body?.label, 12),
    note: text(body?.note, 200),
  };
  if (!forAgent) {
    if (body?.sort !== undefined) row.sort = Number(body.sort) || 0;
    if (body?.active !== undefined) row.active = !!body.active;
  }
  return row;
}

// ── 공개 ───────────────────────────────────────────────────────────────────────
async function publicList(req: Request) {
  const { data: sets, error } = await sb.from('ggul_sets').select('id, queue_id, title, subtitle, as_of, sort, source')
    .eq('active', true).order('sort', { ascending: true }).order('as_of', { ascending: false }).limit(60);
  if (error) throw error;
  const qids = (sets ?? []).filter((s: any) => s.queue_id).map((s: any) => s.queue_id);
  const live = new Set<number>();
  if (qids.length) {
    const { data: qs, error: qe } = await sb.from('sns_queue').select('id, status').in('id', qids);
    if (qe) throw qe;
    for (const q of qs ?? []) if (q.status === 'published' || q.status === 'partial') live.add(q.id);
  }
  // 게시물에 묶인 건 올라간 뒤에만, 화면에서 직접 만든 건 바로. 게시물이 지워져 queue_id 가 빈 에이전트 묶음은 숨김.
  const visible = (sets ?? []).filter((s: any) => (s.queue_id ? live.has(s.queue_id) : s.source === 'screen'));
  const ids = visible.map((s: any) => s.id);
  let q = sb.from('ggul_links').select('set_id, slug, title, url, image_url, price, original_price, label, note, sort')
    .eq('active', true).order('sort', { ascending: true }).order('id', { ascending: true }).limit(400);
  q = ids.length ? q.or(`set_id.in.(${ids.join(',')}),set_id.is.null`) : q.is('set_id', null);
  const { data: links, error: le } = await q;
  if (le) throw le;
  const pub = (l: any) => ({
    slug: l.slug, title: l.title, host: hostOf(l.url), image_url: l.image_url, price: l.price,
    original_price: l.original_price, label: l.label, note: l.note,
  });
  const bySet = new Map<number, any[]>();
  const loose: any[] = [];
  for (const l of links ?? []) {
    if (l.set_id) { if (!bySet.has(l.set_id)) bySet.set(l.set_id, []); bySet.get(l.set_id)!.push(pub(l)); }
    else loose.push(pub(l));
  }
  const out = visible
    .map((s: any) => ({ id: s.id, queue_id: s.queue_id, title: s.title, subtitle: s.subtitle, as_of: s.as_of, links: bySet.get(s.id) ?? [] }))
    .filter((s: any) => s.links.length);
  return reply(req, 200, { ok: true, sets: out, loose, go: `${SUPABASE_URL}/functions/v1/ggul-links/go/` }, { open: true, cache: 'public, max-age=60' });
}

async function go(req: Request, slug: string) {
  const s = slug.toLowerCase();
  let url: string | null = null;
  if (SLUG_RE.test(s)) {
    if (req.method === 'GET' && !BOT_RE.test(req.headers.get('user-agent') ?? '')) {
      const { data } = await sb.rpc('ggul_link_hit', { p_slug: s });
      url = (data as string | null) ?? null;
    } else { // 미리보기 봇 · HEAD 는 세지 않는다
      const { data } = await sb.from('ggul_links').select('url').eq('slug', s).eq('active', true).maybeSingle();
      url = data?.url ?? null;
    }
  }
  return new Response(null, { status: 302, headers: { Location: url ?? PAGE_URL, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer-when-downgrade' } });
}

// ── 관리 (등록된 브라우저) ──────────────────────────────────────────────────────
async function admin(req: Request) {
  const [{ data: sets, error: se }, { data: links, error: le }] = await Promise.all([
    sb.from('ggul_sets').select(SET_ADMIN).order('as_of', { ascending: false }).limit(200),
    sb.from('ggul_links').select(LINK_ADMIN).order('sort', { ascending: true }).order('id', { ascending: true }).limit(2000),
  ]);
  if (se) throw se;
  if (le) throw le;
  const qids = (sets ?? []).filter((s: any) => s.queue_id).map((s: any) => s.queue_id);
  const qstat: Record<number, string> = {};
  if (qids.length) {
    const { data: qs } = await sb.from('sns_queue').select('id, status').in('id', qids);
    for (const q of qs ?? []) qstat[q.id] = q.status;
  }
  return reply(req, 200, {
    ok: true, page: PAGE_URL,
    sets: (sets ?? []).map((s: any) => ({ ...s, queue_status: s.queue_id ? (qstat[s.queue_id] ?? 'deleted') : null })),
    links: links ?? [],
  });
}

async function saveSet(req: Request, body: any) {
  const row: Record<string, unknown> = { title: text(body?.title, 60) ?? '오늘의 꿀딜', subtitle: text(body?.subtitle, 120), updated_at: new Date().toISOString() };
  if (body?.as_of) { const t = Date.parse(body.as_of); if (Number.isFinite(t)) row.as_of = new Date(t).toISOString(); }
  if (body?.active !== undefined) row.active = !!body.active;
  if (body?.sort !== undefined) row.sort = Number(body.sort) || 0;
  const id = Number(body?.id);
  const res = id > 0
    ? await sb.from('ggul_sets').update(row).eq('id', id).select(SET_ADMIN).maybeSingle()
    : await sb.from('ggul_sets').insert({ ...row, source: 'screen' }).select(SET_ADMIN).single();
  if (res.error) throw res.error;
  if (!res.data) return reply(req, 404, { ok: false, error: '없는 묶음이에요.' });
  return reply(req, 200, { ok: true, set: res.data });
}

async function saveLink(req: Request, body: any) {
  let row: Record<string, unknown>;
  try { row = linkRow(body); } catch (e) { return reply(req, 400, { ok: false, error: errMsg(e) }); }
  const setId = body?.set_id === null || body?.set_id === '' || body?.set_id === undefined ? null : Number(body.set_id);
  row.set_id = setId && setId > 0 ? setId : null;
  const wanted = text(body?.slug, 31)?.toLowerCase() ?? null;
  if (wanted && !SLUG_RE.test(wanted)) return reply(req, 400, { ok: false, error: '짧은 주소는 영어 소문자 · 숫자 · - 로 2~31자예요.' });
  row.updated_at = new Date().toISOString();
  const id = Number(body?.id);
  if (id > 0) {
    if (wanted) row.slug = wanted;
    const { data, error } = await sb.from('ggul_links').update(row).eq('id', id).select(LINK_ADMIN).maybeSingle();
    if (error) return reply(req, error.code === '23505' ? 409 : 400, { ok: false, error: error.code === '23505' ? '이미 쓰는 짧은 주소예요.' : errMsg(error) });
    if (!data) return reply(req, 404, { ok: false, error: '없는 링크예요.' });
    return reply(req, 200, { ok: true, link: data });
  }
  row.slug = wanted ?? await freeSlug();
  const { data, error } = await sb.from('ggul_links').insert(row).select(LINK_ADMIN).single();
  if (error) return reply(req, error.code === '23505' ? 409 : 400, { ok: false, error: error.code === '23505' ? '이미 쓰는 짧은 주소예요.' : errMsg(error) });
  return reply(req, 200, { ok: true, link: data });
}

async function remove(req: Request, body: any) {
  const id = Number(body?.id);
  if (!(id > 0)) return reply(req, 400, { ok: false, error: '무엇을 지울지 몰라요.' });
  const table = body?.type === 'set' ? 'ggul_sets' : body?.type === 'link' ? 'ggul_links' : null;
  if (!table) return reply(req, 400, { ok: false, error: "type 은 'set' 또는 'link' 예요." });
  const { error } = await sb.from(table).delete().eq('id', id); // 묶음을 지우면 그 안 링크도 같이 지워진다
  if (error) throw error;
  return reply(req, 200, { ok: true });
}

// ── 제작 에이전트 ───────────────────────────────────────────────────────────────
async function agentSet(req: Request, body: any) {
  const queueId = Number(body?.queue_id);
  if (!(queueId > 0)) return reply(req, 400, { ok: false, error: 'queue_id(임시저장 번호)가 필요해요.' });
  const { data: q } = await sb.from('sns_queue').select('id').eq('id', queueId).maybeSingle();
  if (!q) return reply(req, 404, { ok: false, error: '없는 임시저장 번호예요.' });
  const items = Array.isArray(body?.links) ? body.links : [];
  if (!items.length) return reply(req, 400, { ok: false, error: '링크가 하나도 없어요.' });
  if (items.length > MAX_LINKS_PER_SET) return reply(req, 400, { ok: false, error: `링크는 ${MAX_LINKS_PER_SET}개까지예요.` });
  let rows: Record<string, unknown>[];
  try { rows = items.map((l: any) => linkRow(l, true)); } catch (e) { return reply(req, 400, { ok: false, error: errMsg(e) }); }

  const now = new Date().toISOString();
  const asOf = body?.as_of && Number.isFinite(Date.parse(body.as_of)) ? new Date(Date.parse(body.as_of)).toISOString() : now;
  const { data: set, error: se } = await sb.from('ggul_sets').upsert({
    queue_id: queueId, title: text(body?.title, 60) ?? '오늘의 꿀딜', subtitle: text(body?.subtitle, 120),
    as_of: asOf, source: 'agent', active: true, updated_at: now,
  }, { onConflict: 'queue_id' }).select('id').single();
  if (se) throw se;
  const { error: de } = await sb.from('ggul_links').delete().eq('set_id', set.id);
  if (de) throw de;
  const withSlugs = [];
  for (let i = 0; i < rows.length; i++) withSlugs.push({ ...rows[i], set_id: set.id, sort: i, slug: await freeSlug() });
  const { data: saved, error: ie } = await sb.from('ggul_links').insert(withSlugs).select('slug, title');
  if (ie) throw ie;
  return reply(req, 200, {
    ok: true, set_id: set.id, page_url: `${PAGE_URL}?s=${queueId}`,
    links: (saved ?? []).map((l: any) => ({ title: l.title, slug: l.slug, short_url: PAGE_URL + l.slug })),
    note: '게시물이 올라가면(published · partial) 링크 모음 페이지에 보여요.',
  });
}

Deno.serve(async (req) => {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const at = parts.indexOf('ggul-links');
  const rest = at >= 0 ? parts.slice(at + 1) : parts;
  const route = rest[0] ?? '';
  const M = req.method;
  if (M === 'OPTIONS') return new Response('ok', { headers: cors(req, route === '' || route === 'go') });
  try {
    if ((M === 'GET' || M === 'HEAD') && route === 'go') return await go(req, rest[1] ?? '');
    if (M === 'GET' && route === '') return await publicList(req);
    if (route === 'agent-set' && M === 'POST') {
      if (!(await agentOk(req))) { await req.arrayBuffer().catch(() => {}); return reply(req, 401, { ok: false, error: '에이전트 열쇠가 맞지 않아요.' }); }
      return await agentSet(req, await req.json().catch(() => ({})));
    }
    if (['admin', 'save-set', 'save-link', 'delete'].includes(route)) {
      if (!(await approvedDevice(req))) return reply(req, 403, { ok: false, error: '등록된 브라우저에서만 할 수 있어요.' });
      if (M === 'GET' && route === 'admin') return await admin(req);
      if (M === 'POST') {
        const body = await req.json().catch(() => ({}));
        if (route === 'save-set') return await saveSet(req, body);
        if (route === 'save-link') return await saveLink(req, body);
        if (route === 'delete') return await remove(req, body);
      }
    }
    return reply(req, 404, { ok: false, error: '없는 경로예요.' });
  } catch (e) {
    console.error('ggul-links', route, errMsg(e));
    return reply(req, 500, { ok: false, error: '서버 오류가 났어요. 잠시 뒤 다시 해 주세요.' });
  }
});
