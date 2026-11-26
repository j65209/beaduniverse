// 직원 할인 스토어 (Supabase 엣지 함수 "staff-store", 2026-11-26) — 오피스 store/ 화면이 부른다.
// 사장님 "직원 할인 스토어 · 전 브랜드 구매 가능(판매중인 제품들) · 재고는 자동으로 erp 차감 · 할인 가격 자동 적용 · 배송비 2,000원 ·
//         받는사람/연락처/주소 입력되면 자동으로 대한통운 건별접수 · 대한통운 메모에 제품명+직원구매 · 주문하면 송금 안내"
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=true (오피스 공개 키로 부름)
// 표: staff_orders (받는 분 이름 · 전화 · 주소가 있어 RLS 정책 없음 = 공개 키로 못 읽음) · 설정 app_kv 'staff_store' (할인율 · 배송비 · 입금 계좌)
// 대한통운: 같은 프로젝트 엣지 함수 cj 의 book · cancel 을 부른다 (cj 함수는 고치지 않음).
//   cj_config.env 가 'prod'(운영 승인 뒤)일 때만 접수한다. 'dev'(시험 서버)인 동안은 주문을 '접수 대기'로 두고,
//   pg_cron staff-store-book(10분)이 운영으로 바뀌는 대로 대기 주문을 저절로 접수한다. 개발 서버에는 직원 주소를 보내지 않는다.
// 재고 ERP 차감은 화면이 맥미니 프록시 /erp/moves (dest 'staff', 접수ID = 주문번호로 정해짐 → 한 번만) 로 하고 결과만 여기 적는다.
//
//   POST {action:'config'}                                   → {cfg, cj_env}
//   POST {action:'config_save', cfg, by}                      할인율 · 배송비 · 계좌 (화면에서 관리자만 보임)
//   POST {action:'order', key, buyer, items[], rcvr{nm,tel,zip,addr,detail}, memo}  주문 → 가려진 주문 + 입금 안내
//   POST {action:'list', buyer?, all?, limit?}                주문 목록 (전화 · 주소 가림)
//   POST {action:'erp', id, status:'done'|'fail'|'undone', detail?}
//   POST {action:'pay', id, paid, by}                         입금 확인 / 취소
//   POST {action:'cancel', id, by}                            주문 취소 (대한통운 접수 취소 시도 — 재고는 화면이 되돌림)
//   POST {action:'rebook', id, by}                            접수 실패 건 다시
//   POST {action:'book_pending'}                              pg_cron — 운영일 때 대기 주문 접수
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const sb = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
class Oops extends Error {}

const LABEL: Record<string, string> = { '6A': '식스에이', YAR: '야르', PP: '프피', AKOI: '아코이', APT: '아페티', KOP: '코페리', KOZ: '코즈미' };
const DEF = { rates: { '6A': 50, YAR: 50, APT: 40, KOZ: 40, PP: 30, KOP: 30, AKOI: 30 } as Record<string, number>, ship: 2000, bank: '카카오뱅크', account: '79422161042', holder: '전수빈', on: true, notice: '' };
type Cfg = typeof DEF;
const str = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, n);
const int = (v: unknown) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? x : NaN; };
/** 직원가 = 공홈 판매가 × (1 − 할인율), 10원 단위 버림 */
export const staffPrice = (p: number, rate: number) => Math.floor((p * (100 - Math.max(0, Math.min(90, rate)))) / 100 / 10) * 10;

async function cfg(): Promise<Cfg> {
  const { data } = await sb.from('app_kv').select('value').eq('key', 'staff_store').maybeSingle();
  const v = (data?.value ?? {}) as Partial<Cfg>;
  return { ...DEF, ...v, rates: { ...DEF.rates, ...(v.rates ?? {}) } };
}
async function cjConf() {
  const { data } = await sb.from('cj_config').select('env, sender').limit(1).maybeSingle();
  return { env: (data?.env as string) || 'dev', sender: (data?.sender ?? {}) as Record<string, string> };
}
async function cj(body: Record<string, unknown>) {
  const r = await fetch(`${URL_}/functions/v1/cj`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}`, apikey: ANON }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });
  const j = await r.json().catch(() => ({}));
  return { http: r.status, ...j } as Record<string, unknown>;
}

// ---------- 가리기 ----------
const maskTel = (t: string) => { const d = t.replace(/\D/g, ''); return d.length >= 8 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : '****'; };
const maskAddr = (a: string) => { const tk = a.split(/\s+/).filter(Boolean); return tk.slice(0, Math.min(3, tk.length)).join(' ') + (tk.length > 3 ? ' …' : ''); };
type Row = Record<string, any>;
function pub(o: Row) {
  return {
    id: o.id, no: orderNo(o), created_at: o.created_at, buyer: o.buyer, items: o.items, goods_total: o.goods_total, list_total: o.list_total, ship_fee: o.ship_fee, total: o.total,
    rcvr_nm: o.rcvr_nm, rcvr_tel: maskTel(o.rcvr_tel), rcvr_addr: maskAddr(o.rcvr_addr), memo: o.memo,
    status: o.status, paid_at: o.paid_at, paid_by: o.paid_by, cancelled_at: o.cancelled_at, cancelled_by: o.cancelled_by,
    erp_status: o.erp_status, erp_at: o.erp_at, erp_detail: o.erp_detail,
    cj_status: o.cj_status, cj_invc: o.cj_invc, cj_detail: o.cj_detail, cj_env: o.cj_env, cj_at: o.cj_at,
  };
}
const orderNo = (o: Row) => `S${String(o.created_at).slice(2, 10).replace(/-/g, '')}-${String(o.id).padStart(4, '0')}`;

// ---------- 대한통운 접수 ----------
/** 한 건 접수 — 먼저 'booking' 으로 잡아서 두 번 안 나가게. 운영(prod)이 아니면 손대지 않고 대기. */
async function book(id: number, opt: { by?: string; retry?: boolean } = {}) {
  const c = await cjConf();
  if (c.env !== 'prod') return { skipped: true, env: c.env };
  const from = opt.retry ? ['wait', 'failed'] : ['wait'];
  const { data: o } = await sb.from('staff_orders').update({ cj_status: 'booking', cj_at: new Date().toISOString() })
    .eq('id', id).in('cj_status', from).neq('status', 'cancelled').is('deleted_at', null).select('*').maybeSingle();
  if (!o) return { skipped: true, env: c.env, why: '이미 접수 중이거나 접수 대상이 아님' };
  const items = (o.items || []) as Row[];
  const names = items.map((i) => `${i.name}${i.o ? `(${i.o})` : ''}${i.qty > 1 ? ` ${i.qty}개` : ''}`).join(', ');
  let r: Record<string, unknown>;
  try {
    r = await cj({
      action: 'book', kind: 'single', by: `직원 스토어 · ${o.buyer}`,
      item: {
        brand: '직원구매', cust_use_no: `SS${o.id}`, sender: c.sender,
        rcvr: { nm: o.rcvr_nm, tel: o.rcvr_tel, zip: o.rcvr_zip, addr: o.rcvr_addr, detail: o.rcvr_detail },
        goods: items.map((i) => ({ nm: `${LABEL[i.b] || ''} ${i.name}`.trim(), opt: i.o || '', qty: i.qty, amt: i.unit })),
        memo: `${names} 직원구매`.slice(0, 300), box_qty: 1,
      },
    });
  } catch (e) {
    r = { ok: false, unknown: true, detail: `대한통운 함수 응답 없음: ${String((e as Error)?.message || e).slice(0, 120)}` };
  }
  const st = r.ok ? 'booked' : r.unknown ? 'unknown' : 'failed';
  const upd = { cj_status: st, cj_id: (r.id as number) ?? null, cj_invc: (r.invc_no as string) ?? null, cj_env: c.env,
    cj_detail: str(r.detail ?? r.error ?? '', 300), cj_tries: (o.cj_tries || 0) + 1, cj_at: new Date().toISOString() };
  await sb.from('staff_orders').update(upd).eq('id', id);
  return { ...upd, env: c.env };
}

async function order(b: Row) {
  const c = await cfg();
  if (c.on === false) throw new Oops('지금은 직원 스토어 주문을 받지 않아요');
  const buyer = str(b.buyer, 40);
  if (!buyer) throw new Oops('주문하는 사람 이름을 골라 주세요 (오피스 이름 선택)');
  const key = str(b.key, 60);
  if (!/^[\w-]{8,60}$/.test(key)) throw new Oops('주문 키 이상');
  const { data: same } = await sb.from('staff_orders').select('*').eq('client_key', key).maybeSingle();
  if (same) return { order: pub(same), again: true, pay: payInfo(c, same.total) };   // 응답이 끊겨 다시 보낸 것 — 한 번만

  const raw = Array.isArray(b.items) ? b.items : [];
  if (!raw.length) throw new Oops('담은 상품이 없어요');
  if (raw.length > 30) throw new Oops('한 번에 30가지까지 주문돼요');
  const items = raw.map((x: Row) => {
    const brand = String(x.b || '');
    if (!LABEL[brand]) throw new Oops('브랜드 이상');
    const p = int(x.p), qty = int(x.qty);
    if (!(p >= 100 && p <= 5_000_000)) throw new Oops(`가격 이상: ${str(x.name, 40)}`);
    if (!(qty >= 1 && qty <= 50)) throw new Oops(`수량 이상: ${str(x.name, 40)}`);
    const rows = (Array.isArray(x.rows) ? x.rows : []).map((r: Row) => ({ b: str(r.b, 8), n: str(r.n, 300), o: str(r.o, 300), c: str(r.c, 100), q: Math.max(1, int(r.q) || 1) }));
    if (!rows.length || rows.some((r: Row) => !r.b || !r.n)) throw new Oops(`재고 ERP 줄이 없는 상품: ${str(x.name, 40)}`);
    const rate = Number(c.rates[brand] ?? 0);
    const unit = staffPrice(p, rate);
    return { b: brand, pid: str(x.id, 40), vid: str(x.vid, 40), name: str(x.name, 200), o: str(x.o, 200), img: str(x.img, 600), p, rate, unit, qty, rows };
  });
  const r = b.rcvr || {};
  const rcvr = { nm: str(r.nm, 40), tel: str(r.tel, 20).replace(/[^\d-]/g, ''), zip: str(r.zip, 10).replace(/\D/g, ''), addr: str(r.addr, 200), detail: str(r.detail, 200) };
  if (!rcvr.nm) throw new Oops('받는 분 이름을 적어 주세요');
  if (rcvr.tel.replace(/\D/g, '').length < 9) throw new Oops('받는 분 연락처를 확인해 주세요');
  if (rcvr.zip.length !== 5 || !rcvr.addr) throw new Oops('주소 찾기로 우편번호 · 주소를 넣어 주세요');
  if (!rcvr.detail) throw new Oops('상세 주소(동 · 호수)를 적어 주세요');
  const goods = items.reduce((s, i) => s + i.unit * i.qty, 0), list = items.reduce((s, i) => s + i.p * i.qty, 0);
  const ship = Math.max(0, int(c.ship) || 0);
  const row = { client_key: key, buyer, items, goods_total: goods, list_total: list, ship_fee: ship, total: goods + ship,
    rcvr_nm: rcvr.nm, rcvr_tel: rcvr.tel, rcvr_zip: rcvr.zip, rcvr_addr: rcvr.addr, rcvr_detail: rcvr.detail, memo: str(b.memo, 300) };
  const { data: ins, error } = await sb.from('staff_orders').insert(row).select('*').single();
  if (error) {
    if (/duplicate key/.test(error.message)) { const { data: d } = await sb.from('staff_orders').select('*').eq('client_key', key).single(); return { order: pub(d!), again: true, pay: payInfo(c, d!.total) }; }
    throw new Oops('주문을 저장하지 못했어요: ' + error.message.slice(0, 100));
  }
  let cjr: Row = {};
  try { cjr = await book(ins.id, { by: buyer }); } catch (e) { cjr = { error: String((e as Error).message).slice(0, 120) }; }
  const { data: now } = await sb.from('staff_orders').select('*').eq('id', ins.id).single();
  return { order: pub(now ?? ins), cj: cjr, pay: payInfo(c, ins.total) };
}
const payInfo = (c: Cfg, total: number) => ({ bank: c.bank, account: c.account, holder: c.holder, total });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  let b: Row;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'JSON 이상' }, 400); }
  try {
    switch (b.action) {
      case 'config': {
        const [c, j] = await Promise.all([cfg(), cjConf()]);
        return json({ ok: true, cfg: c, cj_env: j.env });
      }
      case 'config_save': {
        const v = b.cfg || {}, old = await cfg();
        const rates: Record<string, number> = { ...old.rates };
        for (const k of Object.keys(LABEL)) if (v.rates && v.rates[k] !== undefined) { const x = int(v.rates[k]); if (x >= 0 && x <= 90) rates[k] = x; }
        const nv = { ...old, rates, ship: Math.max(0, Math.min(20000, int(v.ship ?? old.ship) || 0)),
          bank: str(v.bank ?? old.bank, 30), account: str(v.account ?? old.account, 40), holder: str(v.holder ?? old.holder, 20),
          on: v.on === undefined ? old.on : !!v.on, notice: str(v.notice ?? old.notice, 200) };
        await sb.from('app_kv').upsert({ key: 'staff_store', value: nv, updated_by: str(b.by, 40) || 'store', updated_at: new Date().toISOString() });
        return json({ ok: true, cfg: nv });
      }
      case 'order':
        return json({ ok: true, ...(await order(b)) });
      case 'list': {
        let q = sb.from('staff_orders').select('*').is('deleted_at', null).order('id', { ascending: false }).limit(Math.max(1, Math.min(300, int(b.limit) || 100)));
        if (!b.all) { const who = str(b.buyer, 40); if (!who) return json({ ok: true, orders: [] }); q = q.eq('buyer', who); }
        const { data, error } = await q;
        if (error) throw new Oops(error.message);
        return json({ ok: true, orders: (data || []).map(pub) });
      }
      case 'erp': {
        const st = String(b.status);
        if (!['done', 'fail', 'undone', 'wait'].includes(st)) throw new Oops('상태 이상');
        const { data } = await sb.from('staff_orders').update({ erp_status: st, erp_at: new Date().toISOString(), erp_detail: str(b.detail, 300) || null }).eq('id', int(b.id)).select('*').maybeSingle();
        if (!data) throw new Oops('주문을 못 찾았어요');
        return json({ ok: true, order: pub(data) });
      }
      case 'pay': {
        const paid = !!b.paid;
        const { data } = await sb.from('staff_orders').update(paid ? { status: 'paid', paid_at: new Date().toISOString(), paid_by: str(b.by, 40) } : { status: 'ordered', paid_at: null, paid_by: null })
          .eq('id', int(b.id)).neq('status', 'cancelled').select('*').maybeSingle();
        if (!data) throw new Oops('주문을 못 찾았어요 (취소된 주문일 수 있어요)');
        return json({ ok: true, order: pub(data) });
      }
      case 'cancel': {
        const id = int(b.id);
        const { data: o } = await sb.from('staff_orders').select('*').eq('id', id).maybeSingle();
        if (!o) throw new Oops('주문을 못 찾았어요');
        if (o.status === 'cancelled') return json({ ok: true, order: pub(o) });
        let cjMsg = '';
        const patch: Row = { status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: str(b.by, 40) };
        if (o.cj_status === 'booked' || o.cj_status === 'unknown') {
          if (!o.cj_id) cjMsg = '대한통운 접수 기록이 없어 취소를 못 했어요 — CS팀 택배 접수 화면에서 확인해 주세요';
          else {
            const r = await cj({ action: 'cancel', id: o.cj_id, by: `직원 스토어 · ${str(b.by, 30)}` }).catch((e) => ({ ok: false, error: String(e) }));
            if (r.ok) patch.cj_status = 'cancelled';
            else cjMsg = `대한통운 접수 취소 못 함: ${str(r.error ?? r.detail ?? '', 160)} — 이미 집화됐을 수 있어요`;
          }
        } else if (o.cj_status === 'wait' || o.cj_status === 'failed') patch.cj_status = 'cancelled';
        if (cjMsg) patch.cj_detail = cjMsg;
        const { data } = await sb.from('staff_orders').update(patch).eq('id', id).select('*').single();
        return json({ ok: true, order: pub(data!), cj_msg: cjMsg });
      }
      case 'rebook': {
        const r = await book(int(b.id), { by: str(b.by, 40), retry: true });
        const { data } = await sb.from('staff_orders').select('*').eq('id', int(b.id)).maybeSingle();
        return json({ ok: true, result: r, order: data ? pub(data) : null });
      }
      case 'book_pending': {
        const c = await cjConf();
        // 'booking' 으로 10분 넘게 멈춘 것 = 응답 전에 끊김 → 접수됐는지 모름 (다시 보내지 않음)
        await sb.from('staff_orders').update({ cj_status: 'unknown', cj_detail: '접수 중 끊김 — 접수됐는지 CS팀 택배 접수 내역에서 확인 필요' })
          .eq('cj_status', 'booking').lt('cj_at', new Date(Date.now() - 10 * 60_000).toISOString());
        if (c.env !== 'prod') return json({ ok: true, env: c.env, booked: 0 });
        const { data } = await sb.from('staff_orders').select('id').eq('cj_status', 'wait').neq('status', 'cancelled').is('deleted_at', null).order('id').limit(20);
        const out = [];
        for (const o of data || []) out.push({ id: o.id, ...(await book(o.id)) });
        return json({ ok: true, env: c.env, booked: out.length, out });
      }
      default:
        return json({ ok: false, error: 'action?' }, 400);
    }
  } catch (e) {
    if (e instanceof Oops) return json({ ok: false, error: e.message }, 200);
    console.error(e);
    return json({ ok: false, error: '서버 오류: ' + String((e as Error)?.message || e).slice(0, 160) }, 500);
  }
});
