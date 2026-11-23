// 꿀꿀집 릴스 영상 정리 (Supabase 엣지 함수 "office-clean") — 2026-11-23 사장님 "지우고 매일 정리" (무료 파일 공간 1GB)
//
// 지우는 것: sns-media/posts/*.mp4 중 ① 인스타에 올라갔고(sns_queue published) ② 올린 지 3일 지났고 ③ 맥미니가 같은 파일(md5)을 갖고 있다고 보낸 것만.
//   후보는 DB 함수 clean_reels_list 가 정한다(3일보다 짧게 못 함). 카드 사진(jpg) · 제품 사진(links/) · 다른 버킷은 건드리지 않는다.
// 부르는 곳: 맥미니 sixshop-collector backup/office-clean.mjs (매일 04:40). 열쇠 = 맥미니에만 있는 ERP_DB_SYNC_KEY (erp_key_ok).
//   POST {key, md5s:[...], dry:true} → 지울 것 목록만 · dry:false → 지우고 목록을 돌려줌 (한 번에 60개까지)
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false (열쇠로 확인)

import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const MAX = 60;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b: any;
  try { b = await req.json(); } catch { return json({ error: 'json' }, 400); }
  const md5s = new Set((Array.isArray(b?.md5s) ? b.md5s : []).map(String).filter((x: string) => /^[0-9a-f]{32}$/.test(x)));
  const { data, error } = await sb.rpc('clean_reels_list', { p_key: String(b?.key ?? ''), p_days: 3 });
  if (error) return json({ error: error.code === '42501' ? 'denied' : 'list' }, error.code === '42501' ? 403 : 500);
  const list = (data ?? []) as { name: string; md5: string; size: number; queue: number; at: string }[];
  const match = list.filter((x) => md5s.has(x.md5) && /^posts\/[0-9]{4}-[0-9]{2}\/[0-9a-f-]{36}\.mp4$/.test(x.name)).slice(0, MAX);
  const keep = list.filter((x) => !md5s.has(x.md5)).map((x) => ({ queue: x.queue, size: x.size }));
  if (b?.dry !== false) return json({ dry: true, candidates: list.length, match, keep });
  if (!match.length) return json({ removed: [], keep });
  const { data: gone, error: e2 } = await sb.storage.from('sns-media').remove(match.map((x) => x.name));
  if (e2) return json({ error: 'remove', detail: e2.message }, 500);
  const names = new Set((gone ?? []).map((g: any) => g.name));
  return json({ removed: match.filter((x) => names.has(x.name)), failed: match.filter((x) => !names.has(x.name)).map((x) => x.name), keep });
});
