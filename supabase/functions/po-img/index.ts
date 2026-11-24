// 발주 상품 사진 보관 (Supabase 엣지 함수 "po-img") — 2026-11-24 사장님 "최근 발주내역을 이미지 잘 넣어서 보관해줘"
//   po_lines(콰이디에어 발주 기록)의 1688 사진을 작은 사진(600px webp, 20~30KB)으로 저장소 po-img 에 한 번만 받아 둔다 — 1688 에서 지워져도 남게.
//   파일 이름 = 사진 주소의 sha1 앞 20자 + .webp (SQL po_img_key · 맥미니 scripts/po_catalog.py 와 같은 규칙). 못 받은 것은 2시간 뒤 다시(5번까지).
//   10분마다 pg_cron po-img-10m → POST, x-po-cron = po_md_config.cron_key. 새 사진이 있을 때만 부른다.
// 배포: Supabase MCP deploy_edge_function, verify_jwt=false (열쇠로 확인)
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36', Accept: 'image/webp,image/*;q=0.8' };

async function grab(url: string): Promise<{ body: Uint8Array; type: string }> {
  let last = '';
  for (const u of [`${url}_600x600q80.jpg_.webp`, `${url}_600x600.jpg`, `${url}_400x400.jpg`, url]) {
    try {
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) });
      const type = (r.headers.get('content-type') || '').split(';')[0].trim();
      if (!r.ok) { last = 'HTTP ' + r.status; continue; }
      if (!/^image\/(webp|jpeg|png)$/.test(type)) { last = 'type ' + type; continue; }
      const body = new Uint8Array(await r.arrayBuffer());
      if (body.length < 300 || body.length > 2_000_000) { last = 'size ' + body.length; continue; }
      return { body, type };
    } catch (e) { last = String((e as Error)?.message || e).slice(0, 80); }
  }
  throw new Error(last || 'fail');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const { data: cfg } = await sb.from('po_md_config').select('cron_key').eq('id', 1).single();
  const key = req.headers.get('x-po-cron') || '';
  if (!cfg || !key || key !== cfg.cron_key) return json({ error: 'denied' }, 403);
  const t0 = Date.now();
  const { data: todo, error } = await sb.rpc('po_img_todo', { p_limit: 120 });
  if (error) return json({ error: error.message }, 500);
  let ok = 0, bad = 0;
  const q = [...(todo || [])] as { key: string; url: string }[];
  const work = async () => {
    for (let x = q.shift(); x && Date.now() - t0 < 100_000; x = q.shift()) {
      const now = new Date().toISOString();
      try {
        const g = await grab(x.url);
        const up = await sb.storage.from('po-img').upload(`${x.key}.webp`, g.body, { contentType: g.type, upsert: true, cacheControl: '31536000' });
        if (up.error) throw new Error(up.error.message);
        await sb.from('po_img').upsert({ key: x.key, url: x.url, bytes: g.body.length, err: null, saved_at: now, updated_at: now }, { onConflict: 'key' });
        ok++;
      } catch (e) {
        const { data: old } = await sb.from('po_img').select('tries').eq('key', x.key).maybeSingle();
        await sb.from('po_img').upsert({ key: x.key, url: x.url, tries: ((old && old.tries) || 0) + 1, err: String((e as Error)?.message || e).slice(0, 200), updated_at: now }, { onConflict: 'key' });
        bad++;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  return json({ ok, bad, left: q.length, ms: Date.now() - t0 });
});
