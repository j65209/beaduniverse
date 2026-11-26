// 발주 자동 매핑 (Supabase 엣지 함수 "po-automap") — 2026-11-26 사장님 "자동으로 좀 너가 할 수 있잖아" ·
//   "완벽하게 똑같을 필요 없잖아 90%정도만 비슷해도 매핑해야지" · "매핑 못하는 것만 나한테 물어봐"
//
// 10분마다 (pg_cron po-automap-10m → POST /po-automap, x-po-cron = po_md_config.cron_key):
//   1. 맥미니 발주 매칭 결과(/erp/po-match)에서 사람이 [매핑하기]를 눌러야 하는 발주(확인 필요 · 애매 · 못 찾음, 최근 14일)를 고른다.
//   2. 오피스 [매핑하기] 창과 똑같은 판단 코드(po-map.js — 이 커밋 그대로 받아 씀)로 줄을 고른다. 아래일 때만 자동:
//        · 메모의 옵션(색 · 단자 'USB-C' · 'C-C' …)이 딱 한 줄에 맞음 (같은 1688 상품의 다른 발주가 이어진 상품이면 그 상품 안에서 한 줄)
//        · 맥미니가 같은 1688 상품 · 같은 업체 코드로 찾은 줄이 하나
//        · 메모 이름이 90% 넘게 비슷한 줄이 하나 (두 번째 줄과 5점 넘게 차이 — 세트 · 사이즈처럼 비슷한 줄이 여럿이면 사람에게)
//      품절 옵션(식스샵 꺼진 옵션 · ERP 줄 없음)이면 줄을 새로 만든다 (남은 재고 0). 식스샵 옵션은 안 건드림 — 품절 그대로.
//      저장은 사람이 누르는 것과 같은 po_map_set (누가 = '자동 매핑'). 적는 건 맥미니가 원래 길 그대로(1~2분).
//   3. 같은 날 같은 옵션을 다른 발주서로 두 번 한 경우 — 맥미니는 두 번째를 '이미 적힘'으로 보고 수량을 안 더한다.
//      그 두 번째 발주(우리가 이은 것)의 'YYYY-MM-DD N개' 줄 · 발주 수량을 ERP 칸에 더해 적는다 (erp_cell_edit, 이전 값이 같을 때만 · 한 번만).
//   4. 못 고른 것은 그대로 '확인 필요'(물류팀 상자 · 알림)에 남는다 = 사람에게 묻기. 결과는 app_kv 'po_automap_last'.
// 수동: POST {key, dry:true} → 쓰지 않고 무엇을 할지만.
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false (열쇠로 확인).
//   po-map.js 판단을 바꾸면 PO_MAP_REF 를 그 커밋으로 바꿔 다시 배포한다.

import { createClient } from 'npm:@supabase/supabase-js@2';

const PO_MAP_REF = 'main';
const WHO = '자동 매핑';
const DAYS = 14;
const SB_URL = Deno.env.get('SUPABASE_URL')!, SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

async function proxyBase(): Promise<string> {
  try {
    const r = await fetch('https://raw.githubusercontent.com/j65209/beaduniverse/main/tunnel.json', { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j && /^https:\/\//.test(j.url)) return String(j.url).replace(/\/$/, '');
  } catch { /* 기본 주소 */ }
  return 'https://api.beaduniverse.kr';
}

/* po-map.js 를 오피스 화면처럼 띄운다 (window · document 흉내, 저장소는 서비스 열쇠) */
async function loadPoMap(base: string, pin: string, pom: any) {
  const r = await fetch(`https://raw.githubusercontent.com/j65209/beaduniverse/${PO_MAP_REF}/po-map.js`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('po-map.js ' + r.status);
  const code = await r.text();
  const g: any = globalThis;
  const win: any = {};
  const noop = () => {};
  const doc = { getElementById: () => null, createElement: () => ({ setAttribute: noop, addEventListener: noop }), head: { appendChild: noop }, body: { appendChild: noop }, addEventListener: noop, readyState: 'loading', activeElement: null };
  Object.assign(g, {
    SUPABASE_URL: SB_URL,
    _sbHeaders: () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }),
    sxFetch: (p: string, o: any = {}) => fetch(base + '/sx' + p, { ...o, headers: { 'X-Brightbeed-PIN': pin, Accept: 'application/json' }, signal: AbortSignal.timeout(60000) }),
    loadProxyBase: async () => base, ghPin: () => pin, _lgbMe: () => WHO, _pom: { data: pom, bySn: {} },
  });
  new Function('window', 'document', 'addEventListener', 'matchMedia', 'toast', code)(win, doc, noop, () => ({ matches: false }), noop);
  if (!win.PoMap) throw new Error('po-map.js 안 뜸');
  return win.PoMap;
}

type Pick = { r: any; why: string };
function decide(P: any, rows: any[], it: any): Pick | null {
  const T = P._t;
  const s = T.suggest(rows, it);
  const opt = s.filter((x: any) => x.why === '메모 옵션이 맞음'), sib = opt.filter((x: any) => x.sib);
  if (opt.length === 1) return { r: opt[0].r, why: '메모 옵션' };
  if (sib.length === 1) return { r: sib[0].r, why: '메모 옵션 · 같은 1688 상품' };
  if (opt.length > 1) return null;
  if (it.state === 'check' && it.n) {
    const r = rows.find((x: any) => T.key(x) === T.key(it));
    if (r) return { r, why: it.how === 'code' ? '같은 업체 코드' : '같은 1688 상품' };
  }
  const q = T.memoQuery(it);
  if (!q) return null;
  const f = T.find(rows, q), top = f[0];
  if (!top || top.s < 0.9) return null;
  const nx = f.find((x: any) => T.key(x.r) !== T.key(top.r));
  if (nx && nx.s > top.s - 0.05) return null;
  return { r: top.r, why: `이름 ${Math.min(100, Math.round(top.s * 100))}%` };
}

/* 3. 같은 날 두 번째 발주 — 맥미니가 '이미 적힘'으로 넘긴 것 중, 그 날짜 줄이 다른 판매번호(우리 기록 erp_moves)가 적은 줄일 때만 더해 적는다 */
async function addSecond(items: any[], dry: boolean, out: any[]) {
  const { data: kv } = await sb.from('app_kv').select('value').eq('key', 'po_automap_dup').maybeSingle();
  const done: Record<string, string> = (kv?.value as any)?.done || {};
  const cands = items.filter(it => it.state === 'entered' && it.b && it.n && !done[it.sn] && it.qty > 0);
  if (!cands.length) return;
  const { data: maps } = await sb.from('po_map').select('sn').is('deleted_at', null).in('sn', cands.map(it => it.sn));
  const mapped = new Set((maps || []).map((m: any) => m.sn));
  const { data: tabs } = await sb.from('erp_tabs').select('gid,name').eq('kind', 'stock').eq('alive', true).is('deleted_at', null);
  const LAB: Record<string, string> = { apt: '아페티', kop: '코페리', koz: '코즈미', '6a': '식스에이', yar: '야르', pp: '프피', akoi: '아코이' };
  let changed = false;
  for (const it of cands) {
    if (!mapped.has(it.sn)) continue;                              // 사람이 손으로 적은 '이미 적힘'은 건드리지 않음
    const line = `${it.date} ${it.qty}개`;
    const tab = (tabs || []).find((t: any) => String(t.name).includes(LAB[it.b] + '송장출력'));
    if (!tab) continue;
    const { data: moves } = await sb.from('erp_moves').select('ref,targets,undone_at').eq('kind', 'po').eq('name', it.n).eq('opt', it.o || '').is('undone_at', null).like('ref', 'po:%');
    const other = (moves || []).filter((m: any) => m.ref !== 'po:' + it.sn && JSON.stringify(m.targets || []).includes(`"${it.date} `));
    if (!other.length) continue;                                   // 그 날짜 줄이 우리 자동 기록이 아님 → 사람 몫
    const rr = (other[0].targets || []).find((t: any) => t && t.r && String(t.gid) === String(tab.gid));
    if (!rr) continue;
    const { data: row } = await sb.from('erp_rows').select('v').eq('gid', tab.gid).eq('r', rr.r).is('deleted_at', null).maybeSingle();
    const v = (row?.v as string[]) || [];
    if (clean(v[1]) !== clean(it.n) || clean(v[2]) !== clean(it.o)) continue;
    const N = String(v[13] ?? ''), O = String(v[14] ?? '').trim();
    const lines = N.split('\n').map(x => x.trim()).filter(Boolean);
    const sameDay = lines.filter(x => x.startsWith(it.date + ' '));
    if (sameDay.length !== other.length || !/^\d+$/.test(O)) continue;   // 줄 수가 다르면(사람이 이미 더함 등) 손 안 댐
    const nNew = N.replace(/\s+$/, '') + '\n' + line, oNew = String(Number(O) + Number(it.qty));
    out.push({ sn: it.sn, row: rr.r, add: line, o: `${O}→${oNew}` });
    if (dry) continue;
    const who = `${WHO} · 같은 날 두 번째 발주 ${it.sn}`;
    const a = await sb.rpc('erp_cell_edit', { p_gid: tab.gid, p_r: rr.r, p_p: 13, p_new: nNew, p_row: null, p_who: who, p_old: N });
    if (a.error || !(a.data as any)?.ok) continue;
    const b = await sb.rpc('erp_cell_edit', { p_gid: tab.gid, p_r: rr.r, p_p: 14, p_new: oNew, p_row: null, p_who: who, p_old: O });
    if (b.error || !(b.data as any)?.ok) continue;
    done[it.sn] = new Date().toISOString(); changed = true;
  }
  if (changed) await sb.from('app_kv').upsert({ key: 'po_automap_dup', value: { done }, updated_at: new Date().toISOString(), updated_by: WHO });
}

async function run(dry: boolean, pin: string) {
  const base = await proxyBase();
  const r = await fetch(`${base}/erp/po-match?cb=${Date.now()}`, { headers: { 'X-Brightbeed-PIN': pin }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('po-match ' + r.status);
  const pom = await r.json();
  if (!pom || !Array.isArray(pom.items)) throw new Error('po-match 모양');
  const P = await loadPoMap(base, pin, pom);
  await P.overlay(pom);                                            // 방금 사람이 이은 것은 빼고
  const since = new Date(Date.now() + 9 * 3600e3 - DAYS * 864e5).toISOString().slice(0, 10);
  const todo = pom.items.filter((it: any) => P.canMap(it) && !it.mapLocal && it.date >= since);
  const mapped: any[] = [], ask: any[] = [], dup: any[] = [];
  if (todo.length) {
    let rows = await P.rows(true);
    let sold: any[] = [];
    try { sold = await P._t.loadSold(rows); } catch { /* 품절 목록 못 읽으면 있는 줄로만 */ }
    const all = rows.concat(sold);
    for (const it of todo) {
      const d = decide(P, all, it);
      if (!d) { ask.push({ sn: it.sn, memo: String(it.memo || '').slice(0, 60) }); continue; }
      const rec = { sn: it.sn, memo: String(it.memo || '').slice(0, 60), to: `${d.r.lab} ${d.r.n}${d.r.o ? ' · ' + d.r.o : ''}`, why: d.why, sold: !!d.r.virt };
      if (dry) { mapped.push(rec); continue; }
      try {
        const p: any = { r: d.r, q: it.qty };
        if (d.r.virt) await P._t.makeRow(p);
        const res = await sb.rpc('po_map_set', { p_sn: it.sn, p_targets: [{ b: p.r.b, n: p.r.n, o: p.r.o, q: null }], p_skip: false, p_remember: true, p_who: WHO });
        if (res.error) throw new Error(res.error.message);
        mapped.push(rec);
      } catch (e) { ask.push({ ...rec, err: String((e as Error)?.message || e).slice(0, 80) }); }
    }
    if (mapped.length && !dry) { try { await fetch(`${base}/erp/po-match?fresh=1&cb=${Date.now()}`, { headers: { 'X-Brightbeed-PIN': pin }, signal: AbortSignal.timeout(30000) }); } catch { /* 5분 정기 실행이 적음 */ } }
  }
  await addSecond(pom.items, dry, dup);
  const last = { at: new Date().toISOString(), dry, mapped, ask, dup };
  if (!dry) await sb.from('app_kv').upsert({ key: 'po_automap_last', value: last, updated_at: last.at, updated_by: WHO });
  return last;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b: any = {};
  try { b = await req.json(); } catch { b = {}; }
  const key = req.headers.get('x-po-cron') || String(b?.key || '');
  const { data: cfg } = await sb.from('po_md_config').select('cron_key,proxy_pin').eq('id', 1).single();
  if (!cfg || !key || key !== cfg.cron_key) return json({ error: 'denied' }, 403);
  try {
    return json(await run(b?.dry === true, String(cfg.proxy_pin || '')));
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
