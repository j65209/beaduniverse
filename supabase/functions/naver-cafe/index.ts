// 네이버 카페 자동 글쓰기 (2026-11-20)
// - 하루 1번, KST 창(naver_cafe_config.window_start~window_end, 기본 07:00~10:00) 안 아무 시각(초까지)에 올림
// - 공식 카페 글쓰기 API: POST https://openapi.naver.com/v1/cafe/{clubid}/menu/{menuid}/articles (네이버 로그인 토큰)
// - 경로
//   GET  /naver-cafe/connect?k=<login_state>   → 네이버 로그인 동의 화면으로 보냄 (login_state 는 SQL 로 30분짜리 발급)
//   GET  /naver-cafe?code=..&state=..          → 네이버가 돌려보내는 곳(Callback URL). 토큰 저장
//   POST /naver-cafe/run     (x-cafe-cron)     → 시간이 됐으면 글 1개 올림. body {"force":true} 면 시간·켜짐 무시(시험용)
//   POST /naver-cafe/upload  (x-cafe-cron)     → 사진 올리기 {path, base64, contentType} → naver-cafe 버킷
//   POST /naver-cafe/schedule (x-cafe-cron)    → 다음 게시 시각 다시 뽑기 {"today":true|false}
// - 네이버 앱(이름 '모델 구인') Client ID/Secret: Edge Function 비밀값 NAVER_CLIENT_ID/NAVER_CLIENT_SECRET,
//   없으면 naver_cafe_config.client_id/client_secret (2026-11-20 은 표에 넣어 씀)
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CALLBACK_URL = "https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/naver-cafe";
const KST_MS = 9 * 3600 * 1000;
const DAY_MS = 86400 * 1000;
const BUCKET = "naver-cafe";

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// 네이버 앱 Client ID/Secret: Edge Function 비밀값 → 없으면 naver_cafe_config.client_id/client_secret
async function creds(): Promise<{ id: string; secret: string }> {
  const id = Deno.env.get("NAVER_CLIENT_ID");
  const sec = Deno.env.get("NAVER_CLIENT_SECRET");
  if (id && sec) return { id, secret: sec };
  const cfg = await getConfig();
  if (cfg.client_id && cfg.client_secret) return { id: cfg.client_id, secret: cfg.client_secret };
  throw new Error("네이버 앱 Client ID·Secret 이 아직 없어요");
}

function page(title: string, body: string, status = 200): Response {
  const doc = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;max-width:480px;margin:56px auto;padding:0 16px;line-height:1.7;color:#222;background:#fff}
h1{font-size:20px;margin:0 0 12px}p{margin:8px 0}.muted{color:#777;font-size:14px}</style></head>
<body><h1>${title}</h1>${body}</body></html>`;
  return new Response(doc, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function getConfig(): Promise<Row> {
  const { data, error } = await db.from("naver_cafe_config").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

async function setConfig(patch: Row): Promise<void> {
  const { error } = await db.from("naver_cafe_config").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw error;
}

async function writeLog(ok: boolean, detail: string, postId: number | null = null): Promise<void> {
  await db.from("naver_cafe_log").insert({ ok, detail: detail.slice(0, 2000), post_id: postId });
}

// 알림: 꿀꿀집 텔레그램(봇·방은 sns_settings 의 tg_bot_token·tg_chat_id 를 같이 씀). 실패해도 글쓰기엔 영향 없음.
async function notify(text: string): Promise<boolean> {
  try {
    const { data } = await db.from("sns_settings").select("key,value").in("key", ["tg_bot_token", "tg_chat_id"]);
    const kv = Object.fromEntries((data ?? []).map((r: Row) => [r.key, r.value]));
    if (!kv.tg_bot_token || !kv.tg_chat_id) return false;
    const r = await fetch(`https://api.telegram.org/bot${kv.tg_bot_token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: kv.tg_chat_id, text }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function minutesOf(t: string): number {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
}

function rand01(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

// 다음 게시 시각: KST 창 안 아무 시각. today=true 면 오늘 창이 남아 있을 때 오늘, 아니면 내일.
function nextRun(cfg: Row, today: boolean): Date {
  const now = Date.now();
  const k = new Date(now + KST_MS);
  const midnightUtc = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - KST_MS;
  const startM = minutesOf(cfg.window_start);
  const endM = minutesOf(cfg.window_end);
  const nowM = (now - midnightUtc) / 60000;
  let base = midnightUtc;
  let lo = startM;
  if (today && nowM < endM - 3) {
    lo = Math.max(startM, Math.ceil(nowM) + 2);
  } else {
    base += DAY_MS;
  }
  const spanSec = Math.max(60, (endM - lo) * 60);
  return new Date(base + lo * 60000 + Math.floor(rand01() * spanSec) * 1000);
}

function kstLabel(d: Date): string {
  const k = new Date(d.getTime() + KST_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}

async function naverToken(params: Record<string, string>): Promise<Row> {
  const c = await creds();
  const u = new URL("https://nid.naver.com/oauth2.0/token");
  u.search = new URLSearchParams({
    client_id: c.id,
    client_secret: c.secret,
    ...params,
  }).toString();
  const r = await fetch(u, { method: "POST" });
  return await r.json().catch(() => ({ error: `http_${r.status}` }));
}

async function accessToken(cfg: Row): Promise<string> {
  if (cfg.access_token && cfg.access_expires_at && new Date(cfg.access_expires_at).getTime() > Date.now() + 120000) {
    return cfg.access_token;
  }
  if (!cfg.refresh_token) throw new Error("네이버 로그인 연결이 아직 안 됐어요");
  const j = await naverToken({ grant_type: "refresh_token", refresh_token: cfg.refresh_token });
  if (!j.access_token) throw new Error(`토큰 갱신 실패: ${j.error ?? ""} ${j.error_description ?? ""}`.trim());
  const patch: Row = {
    access_token: j.access_token,
    access_expires_at: new Date(Date.now() + (Number(j.expires_in) || 3600) * 1000).toISOString(),
  };
  if (j.refresh_token) patch.refresh_token = j.refresh_token;
  await setConfig(patch);
  return j.access_token;
}

async function loadImage(ref: string, i: number): Promise<File> {
  let bytes: Uint8Array;
  let type = "image/jpeg";
  let name = ref.split("/").pop()?.split("?")[0] || `photo${i + 1}.jpg`;
  if (/^https?:\/\//i.test(ref)) {
    const r = await fetch(ref);
    if (!r.ok) throw new Error(`사진을 못 받았어요(${r.status}): ${ref}`);
    type = r.headers.get("content-type")?.split(";")[0] || type;
    bytes = new Uint8Array(await r.arrayBuffer());
  } else {
    const { data, error } = await db.storage.from(BUCKET).download(ref);
    if (error || !data) throw new Error(`사진을 못 찾았어요: ${ref}`);
    type = data.type || type;
    bytes = new Uint8Array(await data.arrayBuffer());
  }
  if (!/\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) {
    name += type.includes("png") ? ".png" : type.includes("gif") ? ".gif" : ".jpg";
  }
  return new File([bytes], name, { type });
}

type WriteResult = { ok: true; url: string } | { ok: false; status: number; code: string; msg: string };

async function writeArticle(cfg: Row, token: string, post: Row): Promise<WriteResult> {
  const form = new FormData();
  // 문서: 제목·본문은 URL 인코딩해서 보냄(멀티파트 예제 기준)
  form.append("subject", encodeURIComponent(post.subject));
  // 본문 HTML 속성값에 큰따옴표가 있으면 403/999 로 거절됨(네이버 답변, 2026-11-20 실제로 겪음) → 작은따옴표로
  let html = String(post.content_html).replace(/=\s*"([^"]*)"/g, "='$1'");
  const opts = post.options || {};
  const images: string[] = post.images || [];
  // 사진 위치: options.image_markers='end' 면 본문 끝에 <img src='#0' /> … 표시를 붙여 글 아래로 (공식 문서엔 없음, 네이버 답변 #110·#111)
  if (opts.image_markers === "end" && images.length && !/<img\s+src='#\d+'/.test(html)) {
    html += "<br>" + images.map((_, i) => `<img src='#${i}' />`).join("<br>");
  }
  form.append("content", encodeURIComponent(html));
  // headid = 말머리 번호(공식 문서엔 없음)
  for (const k of ["openyn", "searchopen", "replyyn", "scrapyn", "metoo", "autosourcing", "rclick", "ccl", "headid"]) {
    if (k in opts && opts[k] !== null && opts[k] !== "") form.append(k, String(opts[k]));
  }
  for (let i = 0; i < images.length; i++) form.append("image", await loadImage(images[i], i));

  const r = await fetch(`https://openapi.naver.com/v1/cafe/${cfg.club_id}/menu/${cfg.menu_id}/articles`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await r.text();
  let j: Row = {};
  try { j = JSON.parse(text); } catch { /* 글자 응답 */ }
  const m = j?.message ?? {};
  if (r.ok && m?.result?.articleUrl) return { ok: true, url: String(m.result.articleUrl) };
  const e = m?.error ?? j?.error ?? {};
  return {
    ok: false,
    status: r.status,
    code: String(e.code ?? j?.errorCode ?? r.status),
    msg: String(e.msg ?? e.message ?? j?.errorMessage ?? text.slice(0, 300)),
  };
}

// 이 코드는 다시 해도 소용없음 → 끄고 알림 (활동 정지·스팸 차단·권한 없음·카페 권한 동의 빠짐(024))
const STOP_CODES = new Set(["AP002", "AP003", "AP004", "AP005", "AP006", "AP007", "AP008", "CA002", "0005", "024"]);

async function run(force: boolean): Promise<Row> {
  const nowIso = new Date().toISOString();
  const staleIso = new Date(Date.now() - 10 * 60000).toISOString();
  let q = db.from("naver_cafe_config").update({ running_since: nowIso }).eq("id", 1)
    .or(`running_since.is.null,running_since.lt.${staleIso}`);
  if (!force) q = q.eq("enabled", true).lte("next_run_at", nowIso);
  const { data: locked, error } = await q.select("*");
  if (error) throw error;
  if (!locked?.length) return { skipped: "not_due" };
  const cfg = locked[0];

  let post: Row | undefined;
  try {
    if (!cfg.club_id || !cfg.menu_id) throw new Error("카페·게시판이 아직 안 정해졌어요");
    const { data: posts, error: pe } = await db.from("naver_cafe_posts").select("*")
      .eq("status", "ready").order("sort_order").order("id").limit(1);
    if (pe) throw pe;
    post = posts?.[0];
    if (!post) {
      const next = nextRun(cfg, false);
      await writeLog(false, "올릴 글이 없어 건너뜀");
      await setConfig({ running_since: null, next_run_at: next.toISOString(), last_result: "올릴 글 없음" });
      await notify(`ℹ️ 네이버 카페 · 올릴 글이 없어 오늘은 건너뛰었어요.\n다음 확인: ${kstLabel(next)}`);
      return { skipped: "no_post", next: next.toISOString() };
    }

    const token = await accessToken(cfg);
    const res = await writeArticle(cfg, token, post);

    if (res.ok) {
      const patch: Row = { posted_at: nowIso, article_url: res.url, attempts: 0, last_error: null };
      if (post.repeat) {
        const { data: mx } = await db.from("naver_cafe_posts").select("sort_order")
          .order("sort_order", { ascending: false }).limit(1);
        patch.sort_order = (mx?.[0]?.sort_order ?? 0) + 1; // 돌려 쓰기: 맨 뒤로
      } else {
        patch.status = "posted";
      }
      await db.from("naver_cafe_posts").update(patch).eq("id", post.id);
      const next = nextRun(cfg, false);
      await writeLog(true, `올림 ${res.url}`, post.id);
      await setConfig({ running_since: null, next_run_at: next.toISOString(), last_result: `${kstLabel(new Date())} 올림 ${res.url}` });
      await notify(`📝 네이버 카페 글 올림 · ${cfg.menu_name ?? `게시판 ${cfg.menu_id}`}\n${post.subject}\n${res.url}\n다음 예정: ${kstLabel(next)}`);
      return { ok: true, url: res.url, next: next.toISOString() };
    }

    const attempts = (post.attempts ?? 0) + 1;
    const detail = `실패 ${res.status} ${res.code} ${res.msg}`;
    await db.from("naver_cafe_posts").update({ attempts, last_error: detail }).eq("id", post.id);
    await writeLog(false, detail, post.id);

    if (STOP_CODES.has(res.code)) {
      if (res.code === "AP005") await db.from("naver_cafe_posts").update({ status: "failed" }).eq("id", post.id);
      await setConfig({ running_since: null, enabled: false, last_result: `멈춤 — ${detail}` });
      await notify(`⛔ 네이버 카페 자동 글 멈춤\n${detail}\n고친 뒤 다시 켜야 올라가요.`);
      return { ok: false, stopped: true, detail };
    }
    // 일시 오류(서버 오류 등)는 20~40분 뒤 최대 3번, 그 뒤엔 내일
    const retry = res.status >= 500 && attempts < 3;
    const next = retry ? new Date(Date.now() + (20 + Math.floor(rand01() * 20)) * 60000) : nextRun(cfg, false);
    if (!retry) await db.from("naver_cafe_posts").update({ attempts: 0 }).eq("id", post.id);
    await setConfig({ running_since: null, next_run_at: next.toISOString(), last_result: detail });
    await notify(`⚠️ 네이버 카페 글 실패\n${detail}\n다음 시도: ${kstLabel(next)}`);
    return { ok: false, detail, next: next.toISOString() };
  } catch (e) {
    const detail = `오류 ${(e as Error).message}`;
    await writeLog(false, detail, post?.id ?? null);
    const next = nextRun(cfg, false);
    await setConfig({ running_since: null, next_run_at: next.toISOString(), last_result: detail });
    await notify(`⚠️ 네이버 카페 글 오류\n${detail}\n다음 시도: ${kstLabel(next)}`);
    return { ok: false, detail, next: next.toISOString() };
  }
}

async function handleConnect(url: URL): Promise<Response> {
  const k = url.searchParams.get("k") ?? "";
  const cfg = await getConfig();
  if (!k || k !== cfg.login_state || !cfg.login_state_expires || new Date(cfg.login_state_expires) < new Date()) {
    return page("연결 주소가 만료됐어요", `<p>Claude 에게 새 연결 주소를 달라고 해 주세요.</p>`, 403);
  }
  const auth = new URL("https://nid.naver.com/oauth2.0/authorize");
  auth.search = new URLSearchParams({
    response_type: "code",
    client_id: (await creds()).id,
    redirect_uri: CALLBACK_URL,
    state: k,
    auth_type: "reprompt", // 동의 화면을 매번 다시 띄움(카페 권한을 빠뜨렸을 때 다시 체크할 수 있게)
  }).toString();
  return Response.redirect(auth.toString(), 302);
}

async function handleCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const err = url.searchParams.get("error");
  if (err) {
    return page("연결이 취소됐어요", `<p>${esc(url.searchParams.get("error_description") ?? err)}</p><p class="muted">다시 하려면 Claude 에게 새 연결 주소를 달라고 해 주세요.</p>`, 400);
  }
  const cfg = await getConfig();
  if (!code || !state || state !== cfg.login_state || !cfg.login_state_expires || new Date(cfg.login_state_expires) < new Date()) {
    return page("연결 주소가 만료됐어요", `<p>Claude 에게 새 연결 주소를 달라고 해 주세요.</p>`, 403);
  }
  const j = await naverToken({ grant_type: "authorization_code", code, state });
  if (!j.access_token || !j.refresh_token) {
    return page("연결에 실패했어요", `<p>${esc(`${j.error ?? ""} ${j.error_description ?? ""}`.trim())}</p>`, 400);
  }
  let label: string | null = null;
  try {
    const me = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: `Bearer ${j.access_token}` } });
    const mj = await me.json();
    label = mj?.response?.nickname ?? mj?.response?.name ?? null;
  } catch { /* 별명 못 받아도 괜찮음 */ }
  await setConfig({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    access_expires_at: new Date(Date.now() + (Number(j.expires_in) || 3600) * 1000).toISOString(),
    connected_at: new Date().toISOString(),
    account_label: label,
    login_state: null,
    login_state_expires: null,
  });
  await writeLog(true, `네이버 로그인 연결${label ? ` (${label})` : ""}`);
  return page("연결됐어요 ✅", `<p>네이버 계정${label ? ` <b>${esc(label)}</b>` : ""} 연결이 끝났어요.</p><p class="muted">이 창은 닫아도 됩니다.</p>`);
}

async function authed(req: Request): Promise<boolean> {
  const key = req.headers.get("x-cafe-cron") ?? "";
  if (!key) return false;
  const cfg = await getConfig();
  return key === cfg.cron_key;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("naver-cafe");
  const action = i >= 0 ? (parts[i + 1] ?? "") : (parts[parts.length - 1] ?? "");

  try {
    if (req.method === "GET") {
      if (action === "connect") return await handleConnect(url);
      if (url.searchParams.has("code") || url.searchParams.has("error")) return await handleCallback(url);
      return page("네이버 카페 글쓰기", `<p class="muted">연결 주소로 들어와 주세요.</p>`, 404);
    }

    if (req.method === "POST") {
      if (!(await authed(req))) return json({ error: "unauthorized" }, 401);
      const body: Row = await req.json().catch(() => ({}));

      if (action === "run") return json(await run(body.force === true));

      if (action === "notify") {
        const text = String(body.text ?? "").trim();
        if (!text) return json({ error: "text 필요" }, 400);
        return json({ ok: await notify(text) });
      }

      if (action === "schedule") {
        const cfg = await getConfig();
        const next = nextRun(cfg, body.today === true);
        await setConfig({ next_run_at: next.toISOString() });
        return json({ next: next.toISOString(), kst: kstLabel(next) });
      }

      if (action === "upload") {
        const path = String(body.path ?? "").replace(/^\/+/, "");
        if (!path || !body.base64) return json({ error: "path, base64 필요" }, 400);
        const bin = Uint8Array.from(atob(String(body.base64)), (c) => c.charCodeAt(0));
        const { error } = await db.storage.from(BUCKET).upload(path, bin, {
          contentType: String(body.contentType ?? "image/jpeg"),
          upsert: true,
        });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, path, bytes: bin.length });
      }
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
