// CJ대한통운 택배 표준 API (Supabase 엣지 함수 "cj", 2026-11-23)
// 사장님 "cs팀에 기능을 넣어줘. 건별접수. 파일접수 파일 추가하기 (레이아웃 기존꺼 가져오기) 운송장조회 연결"
// 가이드: CJLAPI-택배 표준 API Developer Guide V3.9.5 (개발 dxapi-dev.cjlogistics.com:5054 · 운영 dxapi.cjlogistics.com:5052)
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=true (오피스 공개 키로 부름)
// 설정 · 열쇠: 표 cj_config (고객ID · 청구 사업자번호 · env dev/prod · 보내는 분 기본값 · 1Day 토큰) — RLS 정책 없음 = 공개 키로 못 읽음.
//   운영 승인이 나면: update cj_config set env='prod', token=null;  (화면 · 이 함수는 손댈 것 없음)
// 기록: 표 cj_bookings (접수 한 건 = 한 줄, 취소용으로 보낸 내용 req 그대로, 고객 정보가 있어 역시 공개 키로 못 읽음)
//
//   POST {action:'status'}                         → {env, configured, sender}
//   POST {action:'sender', sender:{nm,tel,zip,addr,detail}}  보내는 분 기본값 저장
//   POST {action:'book', item:{…}, kind?, batch_id?, by?}     예약 접수 (건별 · 파일 한 줄씩)
//   POST {action:'cancel', id, by?}                예약 취소 (접수 1분쯤 뒤부터 됨 · 자체 출력 · 집화 · CJ 출력 뒤엔 안 됨)
//   POST {action:'track', invc_no, prod_only?}     운송장 추적 (단계 · 시각 · 지점만, 이름 · 전화는 버림) — 맥미니 cs-track.ts 가 prod_only 로 부름
//   POST {action:'list', limit?, q?}               최근 접수 기록 (전화는 가림)
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

const BASES: Record<string, string> = { dev: 'https://dxapi-dev.cjlogistics.com:5054', prod: 'https://dxapi.cjlogistics.com:5052' };
type Cfg = { cust_id: string; biz_reg_num: string; env: 'dev' | 'prod'; sender: Record<string, string>; token: string | null; token_exp: string | null; token_env: string | null };
class Oops extends Error {}

// ---------- 글자 다듬기 ----------
const enc = new TextEncoder();
/** CJ 칸 크기는 바이트(VARCHAR2) — 한글 3바이트로 보고 넘치면 자른다 */
function cut(s: unknown, bytes: number): string {
  let t = String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  while (enc.encode(t).length > bytes) t = t.slice(0, -1);
  return t;
}
/** 전화번호 → CJ 3칸 (가이드 1.4.11: 12자리 4-4-4 · 11자리 3-4-4 · 10자리 02 는 2-4-4 그 밖은 3-3-4 · 9자리 2-3-4 · 8자리 대표번호 4-4) */
export function splitTel(s: unknown): [string, string, string] | null {
  const d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 12) return [d.slice(0, 4), d.slice(4, 8), d.slice(8)];
  if (d.length === 11) return [d.slice(0, 3), d.slice(3, 7), d.slice(7)];
  if (d.length === 10) return d.startsWith('02') ? [d.slice(0, 2), d.slice(2, 6), d.slice(6)] : [d.slice(0, 3), d.slice(3, 6), d.slice(6)];
  if (d.length === 9) return [d.slice(0, 2), d.slice(2, 5), d.slice(5)];
  if (d.length === 8) return [d.slice(0, 4), d.slice(4), ''];
  return null;
}
/** 주소 → [기본주소, 상세주소]. 상세가 따로 오면 그대로. 아니면 도로명/지번 뒤 건물번호까지를 기본으로 (가이드 1.4.10 예: '서울특별시 용산구 테스트로 123' + '그레이스 아파트 106동 123호') */
export function splitAddr(addr: unknown, detail: unknown): [string, string] {
  const a = String(addr ?? '').replace(/\s+/g, ' ').trim();
  const d = String(detail ?? '').replace(/\s+/g, ' ').trim();
  if (d) return [a, d];
  const tk = a.split(' ');
  let i = -1;
  for (let k = 2; k < tk.length; k++) {
    if (/^(지하)?\d+(-\d+)?(번지)?,?$/.test(tk[k]) && /(로|길|동|리|가)\d*$/.test(tk[k - 1] || '')) { i = k; break; }
  }
  if (i < 0) i = Math.min(3, tk.length - 1); // 못 찾으면 가이드 권장대로 앞 네 덩어리
  const base = tk.slice(0, i + 1).join(' ');
  const rest = tk.slice(i + 1).join(' ');
  return [base.replace(/,$/, ''), rest || '.'];
}
const zip = (s: unknown) => String(s ?? '').replace(/\D/g, '').slice(0, 6);
const kstNow = () => new Date(Date.now() + 9 * 3600e3);
const ymdOf = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const maskTel = (s: unknown) => String(s ?? '').replace(/(\d{2,4})-?(\d{3,4})-?(\d{4})/, (_, a, _b, c) => `${a}-****-${c}`);
const BOX = new Set(['01', '02', '03', '04', '05', '06', '07']);

// ---------- CJ 부르기 ----------
async function cjPost(env: string, path: string, data: Record<string, unknown>, tok?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (tok) headers['CJ-Gateway-APIKey'] = tok;
  let r: Response;
  try {
    r = await fetch(`${BASES[env]}/${path}`, { method: 'POST', headers, body: JSON.stringify({ DATA: data }), signal: AbortSignal.timeout(25_000) });
  } catch (e) {
    // 시간 초과 · 연결 끊김 — 접수는 됐을 수도 있다 (RESULT_CD 'T' = 결과 모름)
    return { RESULT_CD: 'T', RESULT_DETAIL: /timed? ?out|abort/i.test(String((e as Error)?.message)) ? 'CJ 서버 응답이 늦어요 (25초)' : `CJ 서버 연결 실패: ${(e as Error)?.message || e}` };
  }
  const text = await r.text();
  let j: Record<string, any> = {};
  try { j = JSON.parse(text); } catch { j = { RESULT_CD: 'E', RESULT_DETAIL: `CJ 응답을 못 읽었어요 (HTTP ${r.status})` }; }
  if (!r.ok && !j.RESULT_CD) j.RESULT_CD = 'E';
  return j;
}
async function loadCfg(): Promise<Cfg> {
  const { data, error } = await sb.from('cj_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Oops('설정을 못 읽었어요: ' + error.message);
  if (!data) throw new Oops('CJ 설정(고객ID)이 아직 없어요');
  return data as Cfg;
}
/** 1Day 토큰 — 표에 두고 다시 씀 (CJ: 초당 2번 넘게 받으면 차단, 만료 30분 전부터는 새 토큰) */
async function token(cfg: Cfg): Promise<string> {
  const left = cfg.token_exp ? new Date(cfg.token_exp).getTime() - Date.now() : 0;
  if (cfg.token && cfg.token_env === cfg.env && left > 35 * 60e3) return cfg.token;
  const j = await cjPost(cfg.env, 'ReqOneDayToken', { CUST_ID: cfg.cust_id, BIZ_REG_NUM: cfg.biz_reg_num });
  const tok = j?.DATA?.TOKEN_NUM;
  if (j.RESULT_CD !== 'S' || !tok) throw new Oops('CJ 토큰을 못 받았어요: ' + (j.RESULT_DETAIL || '알 수 없음'));
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(j.DATA.TOKEN_EXPRTN_DTM || ''));
  const exp = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00`).toISOString() : new Date(Date.now() + 23 * 3600e3).toISOString();
  await sb.from('cj_config').update({ token: tok, token_exp: exp, token_env: cfg.env, updated_at: new Date().toISOString() }).eq('id', 1);
  cfg.token = tok; cfg.token_exp = exp; cfg.token_env = cfg.env;
  return tok;
}
/** 인증 실패면 저장한 토큰을 버린다 (CJ: 버리고 나중에 다시 받기) */
async function dropTokenIf(j: Record<string, any>) {
  if (/E401|Authentication/i.test(String(j?.RESULT_CD) + String(j?.RESULT_DETAIL))) await sb.from('cj_config').update({ token: null, token_exp: null }).eq('id', 1);
}

// ---------- 예약 접수 ----------
type Party = { nm?: string; tel?: string; tel2?: string; zip?: string; addr?: string; detail?: string };
type Goods = { nm?: string; opt?: string; qty?: number | string; amt?: number | string; cd?: string };
type Item = {
  rcpt_dv?: string; prt_st?: string; brand?: string; cust_use_no?: string; order_no?: string;
  sender?: Party; rcvr?: Party; goods?: Goods[]; box_type?: string; box_qty?: number | string;
  article_amt?: number | string; memo?: string; ori_invc_no?: string; frt_dv?: string;
};
function party(p: Party | undefined, who: string) {
  const nm = cut(p?.nm, 100);
  const tel = splitTel(p?.tel), tel2 = splitTel(p?.tel2);
  if (!nm) throw new Oops(`${who} 이름이 비었어요`);
  if (!tel) throw new Oops(`${who} 전화번호를 확인해 주세요 (숫자 8~12자리)`);
  if (!String(p?.addr ?? '').trim()) throw new Oops(`${who} 주소가 비었어요`);
  if (zip(p?.zip).length < 5) throw new Oops(`${who} 우편번호(5자리)가 비었어요 — CJ 는 우편번호 없이는 안 받아요`);
  const [addr, detail] = splitAddr(p?.addr, p?.detail);
  const cell = tel2 || (/^01/.test(tel[0]) ? tel : null);
  return { nm, tel, cell, zip: zip(p?.zip), addr: cut(addr, 150), detail: cut(detail, 300) };
}
async function uniqueUseNo(base: string): Promise<string> {
  const { data } = await sb.from('cj_bookings').select('cust_use_no').like('cust_use_no', `${base}%`).limit(200);
  const used = new Set((data || []).map((x: { cust_use_no: string }) => x.cust_use_no));
  if (!used.has(base)) return base;
  for (let k = 2; k < 200; k++) if (!used.has(`${base}-${k}`)) return `${base}-${k}`;
  return `${base}-${Date.now() % 100000}`;
}
async function book(cfg: Cfg, item: Item, meta: { kind?: string; batch_id?: string; by?: string }) {
  const rcptDv = item.rcpt_dv === '02' ? '02' : '01';
  const prtSt = rcptDv === '02' ? '01' : item.prt_st === '02' ? '02' : '01'; // 반품은 가이드상 PRT_ST=01
  const s = party(item.sender, rcptDv === '02' ? '회수할 곳(보내는 분)' : '보내는 분');
  const r = party(item.rcvr, rcptDv === '02' ? '회수지(받는 분)' : '받는 분');
  const goods = (item.goods || []).map((g) => ({ ...g, nm: cut([g.nm, g.opt].filter((x) => String(x ?? '').trim()).join(' / '), 500) })).filter((g) => g.nm);
  if (!goods.length) throw new Oops('상품명이 비었어요');
  const boxType = BOX.has(String(item.box_type)) ? String(item.box_type) : '01';
  const boxQty = Math.max(1, Math.min(99, parseInt(String(item.box_qty ?? 1), 10) || 1));
  const now = kstNow(), ymd = ymdOf(now);
  const rawNo = String(item.cust_use_no || item.order_no || '').replace(/[^\w\-]/g, '').slice(0, 40)
    || `CS${ymd}${now.toISOString().slice(11, 19).replace(/:/g, '')}${Math.floor(Math.random() * 900 + 100)}`;
  const useNo = await uniqueUseNo(rawNo);
  const tok = await token(cfg);

  let invc = '';
  if (prtSt === '02') {
    const n = await cjPost(cfg.env, 'ReqInvcNo', { TOKEN_NUM: tok, CLNTNUM: cfg.cust_id }, tok);
    if (n.RESULT_CD !== 'S' || !n?.DATA?.INVC_NO) { await dropTokenIf(n); throw new Oops('운송장 번호를 못 받았어요: ' + (n.RESULT_DETAIL || '')); }
    invc = String(n.DATA.INVC_NO);
  }
  const amt = (v: unknown) => String(Math.max(0, Math.round(Number(String(v ?? '').replace(/[^\d.]/g, '')) || 0)) || '');
  const req: Record<string, unknown> = {
    CUST_ID: cfg.cust_id, RCPT_YMD: ymd, CUST_USE_NO: useNo,
    RCPT_DV: rcptDv, WORK_DV_CD: '01', REQ_DV_CD: '01',
    MPCK_KEY: `${ymd}_${cfg.cust_id}_${useNo}`,
    CAL_DV_CD: '01', FRT_DV_CD: ['01', '02', '03'].includes(String(item.frt_dv)) ? String(item.frt_dv) : '03',
    CNTR_ITEM_CD: '01', BOX_TYPE_CD: boxType, BOX_QTY: String(boxQty), FRT: '',
    CUST_MGMT_DLCM_CD: cfg.cust_id,
    SENDR_NM: s.nm, SENDR_TEL_NO1: s.tel[0], SENDR_TEL_NO2: s.tel[1], SENDR_TEL_NO3: s.tel[2],
    SENDR_CELL_NO1: s.cell?.[0] ?? '', SENDR_CELL_NO2: s.cell?.[1] ?? '', SENDR_CELL_NO3: s.cell?.[2] ?? '',
    SENDR_SAFE_NO1: '', SENDR_SAFE_NO2: '', SENDR_SAFE_NO3: '',
    SENDR_ZIP_NO: s.zip, SENDR_ADDR: s.addr, SENDR_DETAIL_ADDR: s.detail,
    RCVR_NM: r.nm, RCVR_TEL_NO1: r.tel[0], RCVR_TEL_NO2: r.tel[1], RCVR_TEL_NO3: r.tel[2],
    RCVR_CELL_NO1: r.cell?.[0] ?? '', RCVR_CELL_NO2: r.cell?.[1] ?? '', RCVR_CELL_NO3: r.cell?.[2] ?? '',
    RCVR_SAFE_NO1: '', RCVR_SAFE_NO2: '', RCVR_SAFE_NO3: '',
    RCVR_ZIP_NO: r.zip, RCVR_ADDR: r.addr, RCVR_DETAIL_ADDR: r.detail,
    ORDRR_NM: '', ORDRR_TEL_NO1: '', ORDRR_TEL_NO2: '', ORDRR_TEL_NO3: '', ORDRR_CELL_NO1: '', ORDRR_CELL_NO2: '', ORDRR_CELL_NO3: '',
    ORDRR_SAFE_NO1: '', ORDRR_SAFE_NO2: '', ORDRR_SAFE_NO3: '', ORDRR_ZIP_NO: '', ORDRR_ADDR: '', ORDRR_DETAIL_ADDR: '',
    INVC_NO: invc, ORI_INVC_NO: rcptDv === '02' ? String(item.ori_invc_no ?? '').replace(/\D/g, '').slice(0, 20) : '', ORI_ORD_NO: '',
    COLCT_EXPCT_YMD: '', COLCT_EXPCT_HOUR: '', SHIP_EXPCT_YMD: '', SHIP_EXPCT_HOUR: '',
    PRT_ST: prtSt, ARTICLE_AMT: amt(item.article_amt),
    REMARK_1: cut(item.memo, 1000), REMARK_2: '', REMARK_3: '',
    COD_YN: 'N', ETC_1: '', ETC_2: '', ETC_3: '', ETC_4: '', ETC_5: '', DLV_DV: '01', RCPT_SERIAL: '',
    ARRAY: goods.slice(0, 50).map((g, i) => ({
      MPCK_SEQ: String(i + 1), GDS_CD: cut(g.cd, 20), GDS_NM: g.nm,
      GDS_QTY: String(Math.max(1, parseInt(String(g.qty ?? 1), 10) || 1)), UNIT_CD: '', UNIT_NM: '', GDS_AMT: amt(g.amt),
    })),
  };
  const j = await cjPost(cfg.env, 'RegBook', { TOKEN_NUM: tok, ...req }, tok);
  const ok = j.RESULT_CD === 'S', unknown = j.RESULT_CD === 'T';
  if (!ok) await dropTokenIf(j);
  const why = /ORA-01400/.test(String(j.RESULT_DETAIL)) ? ' (CJ 필수 칸이 비었어요 — 우편번호 · 전화 · 주소를 확인해 주세요)' : '';
  const row = {
    env: cfg.env, kind: meta.kind === 'file' ? 'file' : 'single', batch_id: meta.batch_id ? String(meta.batch_id).slice(0, 60) : null,
    brand: item.brand ? String(item.brand).slice(0, 20) : null, rcpt_dv: rcptDv, prt_st: prtSt, cust_use_no: useNo,
    invc_no: invc || null, status: ok ? 'booked' : unknown ? 'unknown' : 'failed', result_detail: String(j.RESULT_DETAIL ?? '').slice(0, 500),
    rcvr_nm: rcptDv === '02' ? s.nm : r.nm, rcvr_tel: (rcptDv === '02' ? s.tel : r.tel).filter(Boolean).join('-'),
    rcvr_addr: rcptDv === '02' ? `${s.addr} ${s.detail}` : `${r.addr} ${r.detail}`,
    gds_nm: goods.map((g) => g.nm).join(', ').slice(0, 300), box_qty: boxQty,
    created_by: meta.by ? String(meta.by).slice(0, 40) : null, req,
  };
  const { data: ins } = await sb.from('cj_bookings').insert(row).select('id').single();
  return {
    ok, unknown, id: ins?.id ?? null, env: cfg.env, cust_use_no: useNo, invc_no: invc || null, prt_st: prtSt,
    detail: ok ? '접수됐어요' : unknown ? `${j.RESULT_DETAIL} — 접수가 됐는지 몰라요. 같은 건을 다시 넣기 전에 1분 뒤 '취소'를 눌러 보세요 (취소되면 접수됐던 것)` : `CJ 접수 실패: ${j.RESULT_DETAIL || '알 수 없음'}${why}`,
  };
}

async function cancel(cfg: Cfg, id: number, by?: string) {
  const { data: row, error } = await sb.from('cj_bookings').select('*').eq('id', id).maybeSingle();
  if (error || !row) throw new Oops('접수 기록을 못 찾았어요');
  if (row.status !== 'booked' && row.status !== 'unknown') throw new Oops('접수된 건만 취소할 수 있어요');
  if (row.env !== cfg.env) throw new Oops(`${row.env === 'dev' ? '개발' : '운영'} 서버 접수 건이라 지금 서버에서는 취소할 수 없어요`);
  const tok = await token(cfg);
  const j = await cjPost(cfg.env, 'CnclBook', { TOKEN_NUM: tok, ...(row.req || {}), REQ_DV_CD: '02' }, tok);
  if (j.RESULT_CD === 'S') {
    await sb.from('cj_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), result_detail: `취소${by ? ' · ' + String(by).slice(0, 40) : ''}` }).eq('id', id);
    return { ok: true, detail: '취소됐어요' };
  }
  await dropTokenIf(j);
  const msg = String(j.RESULT_DETAIL || '');
  const hint = /존재\s*하지\s*않/.test(msg) ? ' — 접수가 CJ 에 반영되기 전이에요 (보통 1분, 길면 10분쯤). 조금 뒤 다시 눌러 주세요. 자체 출력 · 집화 · CJ 출력이 끝난 건은 취소가 안 돼요.' : '';
  return { ok: false, detail: `CJ 취소 실패: ${msg || '알 수 없음'}${hint}` };
}

async function track(cfg: Cfg, invcIn: string) {
  const invc = String(invcIn ?? '').replace(/\D/g, '');
  if (!/^\d{10,14}$/.test(invc)) throw new Oops('운송장 번호는 숫자 10~14자리예요');
  const tok = await token(cfg);
  const j = await cjPost(cfg.env, 'ReqOneGdsTrc', { TOKEN_NUM: tok, CLNTNUM: cfg.cust_id, INVC_NO: invc }, tok);
  if (j.RESULT_CD !== 'S') {
    await dropTokenIf(j);
    if (/no\s*data|없습니다/i.test(String(j.RESULT_DETAIL))) return { ok: true, env: cfg.env, invc_no: invc, steps: [] };
    throw new Oops('CJ 조회 실패: ' + (j.RESULT_DETAIL || '알 수 없음'));
  }
  const list = Array.isArray(j.DATA) ? j.DATA : j.DATA ? [j.DATA] : [];
  const steps = list.map((x: Record<string, unknown>) => {
    const d = String(x.SCAN_YMD ?? ''), h = String(x.SCAN_HOUR ?? '').padStart(6, '0');
    const at = /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${h.slice(0, 2)}:${h.slice(2, 4)}` : '';
    return { at, step: String(x.CRG_ST_NM ?? '').trim(), code: String(x.CRG_ST ?? '').trim(), place: String(x.DEALT_BRAN_NM ?? '').trim() };
  }).filter((x: { step: string }) => x.step).sort((a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at));
  return { ok: true, env: cfg.env, invc_no: invc, steps };
}

async function list(limit: number, q: string) {
  let qb = sb.from('cj_bookings')
    .select('id,created_at,env,kind,batch_id,brand,rcpt_dv,prt_st,cust_use_no,invc_no,status,result_detail,rcvr_nm,rcvr_tel,rcvr_addr,gds_nm,box_qty,created_by,cancelled_at')
    .order('id', { ascending: false }).limit(Math.max(1, Math.min(300, limit || 100)));
  const s = String(q || '').replace(/[%,()]/g, ' ').trim().slice(0, 40);
  if (s) qb = qb.or(`rcvr_nm.ilike.%${s}%,cust_use_no.ilike.%${s}%,invc_no.ilike.%${s}%,gds_nm.ilike.%${s}%`);
  const { data, error } = await qb;
  if (error) throw new Oops('기록을 못 읽었어요: ' + error.message);
  return (data || []).map((x: Record<string, unknown>) => ({ ...x, rcvr_tel: maskTel(x.rcvr_tel) }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 로 불러 주세요' }, 405);
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: '요청을 못 읽었어요' }, 400); }
  try {
    const cfg = await loadCfg();
    switch (body.action) {
      case 'status':
        return json({ ok: true, env: cfg.env, configured: !!(cfg.cust_id && cfg.biz_reg_num), cust: cfg.cust_id.replace(/^(\d{4})\d+/, '$1****'), sender: cfg.sender || {} });
      case 'sender': {
        const s = body.sender || {};
        const sender = { nm: cut(s.nm, 100), tel: cut(s.tel, 20), zip: zip(s.zip), addr: cut(s.addr, 150), detail: cut(s.detail, 300) };
        await sb.from('cj_config').update({ sender, updated_at: new Date().toISOString() }).eq('id', 1);
        return json({ ok: true, sender });
      }
      case 'book':
        return json(await book(cfg, body.item || {}, { kind: body.kind, batch_id: body.batch_id, by: body.by }));
      case 'cancel':
        return json(await cancel(cfg, Number(body.id), body.by));
      case 'track':
        // prod_only: 맥미니 운송장 조회(cs-track.ts)가 부를 때 — 개발 서버엔 실제 운송장이 없으니 CJ 를 부르지 않고 바로 알려 준다 (그쪽은 공개 조회로 넘어감)
        if (body.prod_only && cfg.env !== 'prod') return json({ ok: false, env: cfg.env, error: '대한통운 API 가 아직 개발 서버예요 (운영 승인 전)' });
        return json(await track(cfg, body.invc_no));
      case 'list':
        return json({ ok: true, env: cfg.env, rows: await list(Number(body.limit), String(body.q || '')) });
      default:
        return json({ ok: false, error: '모르는 요청이에요' }, 400);
    }
  } catch (e) {
    const msg = e instanceof Oops ? e.message : `서버 오류: ${(e as Error)?.message || e}`;
    return json({ ok: false, error: msg }, e instanceof Oops ? 200 : 500);
  }
});
