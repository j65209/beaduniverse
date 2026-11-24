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
//   POST {action:'sync'}                           CJ 출력 건 운송장번호 · 최근 단계 채우기 (상품추적 대량) — pg_cron 30분
//   POST {action:'print_save', print:{…}}          출력 설정 저장 (라벨 크기 · 여백 · 글자 · 바코드 · 가림 · 표시 항목)
//   POST {action:'labels', ids:[…], mark?}         운송장 출력 자료 (운송장번호 있는 건만, 주소정제로 분류코드 — 실패하면 빈 칸) · 출력 횟수 기록
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
  article_amt?: number | string; memo?: string; ori_invc_no?: string; frt_dv?: string; reason?: string;
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
  // 반품은 가이드상 PRT_ST=01. 발송은 자체 출력이 기본 (2026-11-24 사장님 "건별접수,파일접수 오피스앱에서 출력하는거 자체출력이야") — '01' 을 꼭 집어 보낼 때만 CJ 출력
  const prtSt = rcptDv === '02' ? '01' : item.prt_st === '01' ? '01' : '02';
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
    reason: item.reason ? cut(item.reason, 200) : null,
    ori_invc_no: rcptDv === '02' ? (String(item.ori_invc_no ?? '').replace(/\D/g, '').slice(0, 20) || null) : null,
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

/** 상품추적 단계 코드(CRG_ST) 순서 — 11 집화처리 · 41 간선상차 · 42 간선하차 · 82 배송출발 · 91 배송완료. 숫자가 아니면 0 */
const stepRank = (c: unknown) => { const n = Number(String(c ?? '').trim()); return Number.isFinite(n) ? n : 0; };

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
    // 단건 조회는 '2026-11-24' · '16:21:08' 처럼 구분자를 붙여 준다 (대량 조회는 숫자만) → 숫자만 남겨 읽는다
    const d = String(x.SCAN_YMD ?? '').replace(/\D/g, ''), h = String(x.SCAN_HOUR ?? '').replace(/\D/g, '').padStart(6, '0');
    const at = /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${h.slice(0, 2)}:${h.slice(2, 4)}` : '';
    return { at, step: String(x.CRG_ST_NM ?? '').trim(), code: String(x.CRG_ST ?? '').trim(), place: String(x.DEALT_BRAN_NM ?? '').trim() };
  // 같은 시각에 여러 단계가 찍히면(2026-11-24 CJ 개발 서버 수기 자료: 집화 · 배송출발 · 배송완료가 같은 초) 단계 코드 순(11 집화 < 82 배송출발 < 91 배송완료)
  }).filter((x: { step: string }) => x.step).sort((a: { at: string; code: string }, b: { at: string; code: string }) => a.at.localeCompare(b.at) || stepRank(a.code) - stepRank(b.code));
  return { ok: true, env: cfg.env, invc_no: invc, steps };
}

// ---------- 운송장 출력 (2026-11-24 사장님 "오피스에서 바로 출력 가능하다면 기능 넣어주고. 우리가 설정 할 수 있게 해줘") ----------
// 출력 설정 = cj_config.print (모든 PC 공통). 값은 여기서 범위를 묶는다.
const clampN = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
function cleanPrint(p: Record<string, unknown> = {}) {
  const b = (k: string, d: boolean) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d);
  return {
    w: clampN(p.w, 40, 220, 123), h: clampN(p.h, 40, 220, 100), orient: p.orient === 'l' ? 'l' : 'p',
    mt: clampN(p.mt, -20, 20, 0), ml: clampN(p.ml, -20, 20, 0), pad: clampN(p.pad, 0, 15, 0), preprint: b('preprint', false),
    scale: clampN(p.scale, 60, 150, 100), bc: p.bc === 'ITF' ? 'ITF' : 'CODE128', bch: clampN(p.bch, 6, 30, 14),
    mask_nm: b('mask_nm', true), mask_tel: b('mask_tel', true), show_goods: b('show_goods', true), show_memo: b('show_memo', true),
    show_order: b('show_order', true), show_saddr: b('show_saddr', true), use_brand: b('use_brand', false), auto: b('auto', false),
    copies: clampN(p.copies, 1, 3, 1), note: cut(p.note, 120),
    prt_def: p.prt_def === '01' ? '01' : '02', box_def: BOX.has(String(p.box_def)) ? String(p.box_def) : '01',
  };
}
/** CJ 주소정제 — 운송장에 찍는 도착지 분류코드 · 배송집배점 · SM. 실패하면 이유만 (출력은 분류코드 칸만 빈 채로 된다) */
async function refine(cfg: Cfg, address: string): Promise<Record<string, string> | { err: string }> {
  const tok = await token(cfg);
  const j = await cjPost(cfg.env, 'ReqAddrRfnSm', { TOKEN_NUM: tok, CLNTNUM: cfg.cust_id, CLNTMGMCUSTCD: cfg.cust_id, ADDRESS: cut(address, 100) }, tok);
  if (j.RESULT_CD !== 'S' || !j.DATA) return { err: String(j.RESULT_DETAIL || '주소정제 실패').slice(0, 200) };
  const d = j.DATA as Record<string, unknown>, pk = (k: string) => String(d[k] ?? '').trim();
  return { CLSFCD: pk('CLSFCD'), SUBCLSFCD: pk('SUBCLSFCD'), CLSFADDR: pk('CLSFADDR'), CLLDLVBRANNM: pk('CLLDLVBRANNM'), CLLDLVEMPNM: pk('CLLDLVEMPNM'), CLLDLVEMPNICKNM: pk('CLLDLVEMPNICKNM'), RSPSDIV: pk('RSPSDIV'), P2PCD: pk('P2PCD') };
}
const telOf = (q: Record<string, unknown>, p: string) => [q[`${p}_NO1`], q[`${p}_NO2`], q[`${p}_NO3`]].map((x) => String(x ?? '').trim()).filter(Boolean).join('-');
/** 출력할 접수 → 운송장에 찍을 자료 (받는 분 전체 정보 — 출력용이라 가리지 않음, 가림은 화면 설정이 한다). 45일 안 접수만 */
async function labels(cfg: Cfg, idsIn: unknown, mark: boolean) {
  const ids = [...new Set((Array.isArray(idsIn) ? idsIn : []).map(Number).filter((n) => n > 0))].slice(0, 30);
  if (!ids.length) throw new Oops('출력할 접수를 골라 주세요');
  const since = new Date(Date.now() - 45 * 86400e3).toISOString();
  const { data, error } = await sb.from('cj_bookings').select('id,env,brand,status,prt_st,rcpt_dv,cust_use_no,invc_no,created_at,clsf,print_count,req').in('id', ids).gte('created_at', since);
  if (error) throw new Oops('접수 기록을 못 읽었어요: ' + error.message);
  const rows = (data || []).sort((a: { id: number }, b: { id: number }) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (!row.invc_no) { out.push({ id: row.id, skip: '운송장번호가 없어요 (CJ 프로그램에서 출력하는 건)' }); continue; }
    if (row.status === 'cancelled' || row.status === 'failed') { out.push({ id: row.id, skip: '접수되지 않은 건이에요' }); continue; }
    const q = (row.req || {}) as Record<string, any>;
    let clsf = row.clsf as Record<string, string> | null, clsf_err = '';
    if (!clsf || !clsf.CLSFCD) {
      const r = await refine(cfg, `${q.RCVR_ADDR ?? ''} ${q.RCVR_DETAIL_ADDR ?? ''}`.trim());
      if ('err' in r) clsf_err = r.err;
      else { clsf = r; await sb.from('cj_bookings').update({ clsf }).eq('id', row.id); }
    }
    out.push({
      id: row.id, env: row.env, brand: row.brand, invc_no: row.invc_no, cust_use_no: row.cust_use_no, rcpt_ymd: q.RCPT_YMD, rcpt_dv: row.rcpt_dv,
      box_type: q.BOX_TYPE_CD, box_qty: q.BOX_QTY, frt_dv: q.FRT_DV_CD, amt: q.ARTICLE_AMT, memo: q.REMARK_1,
      rcvr: { nm: q.RCVR_NM, tel: telOf(q, 'RCVR_TEL'), cell: telOf(q, 'RCVR_CELL'), zip: q.RCVR_ZIP_NO, addr: q.RCVR_ADDR, detail: q.RCVR_DETAIL_ADDR },
      sendr: { nm: q.SENDR_NM, tel: telOf(q, 'SENDR_TEL'), zip: q.SENDR_ZIP_NO, addr: q.SENDR_ADDR, detail: q.SENDR_DETAIL_ADDR },
      goods: (Array.isArray(q.ARRAY) ? q.ARRAY : []).map((g: Record<string, unknown>) => ({ nm: String(g.GDS_NM ?? ''), qty: Number(g.GDS_QTY) || 1 })),
      clsf: clsf && clsf.CLSFCD ? clsf : null, clsf_err, print_count: row.print_count || 0,
    });
  }
  if (mark) {
    const now = new Date().toISOString();
    for (const x of out) if (!x.skip) await sb.from('cj_bookings').update({ printed_at: now, print_count: Number(x.print_count || 0) + 1 }).eq('id', x.id as number);
  }
  return out;
}

// ---------- CJ 프로그램(Lois) 출력 건 운송장번호 · 최근 단계 채우기 (2026-11-24 사장님 "건별예약접수랑 파일접수랑? 좋아") ----------
// Lois 출력 건은 운송장번호가 CJ 에서 찍을 때 생긴다 → 상품추적 대량(ReqMssGdsTrc, 스캔 생성일자 기준, 1번에 최대 500건)으로
// 주문번호(CUST_USE_NO) ↔ 운송장번호를 받아 cj_bookings 에 채운다. SND_YN='Y' = 받은 자료는 CJ 가 '보냄' 처리 (다음엔 새 것만).
// 30분마다 pg_cron 'cj-sync-30m' 이 부른다. 오늘 · 어제 · 그제 스캔분.
async function sync(cfg: Cfg) {
  const tok = await token(cfg);
  const now = kstNow();
  const days = [0, 1, 2].map((d) => ymdOf(new Date(now.getTime() - d * 86400e3)));
  let got = 0, filled = 0, updated = 0;
  const errs: string[] = [];
  for (const d of days) {
    for (let k = 0; k < 10; k++) {
      const j = await cjPost(cfg.env, 'ReqMssGdsTrc', { TOKEN_NUM: tok, CUST_ID: cfg.cust_id, REQ_DT: d, SND_YN: 'Y' }, tok);
      if (j.RESULT_CD !== 'S') { if (!/no\s*data/i.test(String(j.RESULT_DETAIL))) { errs.push(`${d}: ${String(j.RESULT_DETAIL).slice(0, 120)}`); await dropTokenIf(j); } break; }
      const arr: Record<string, unknown>[] = Array.isArray(j.DATA) ? j.DATA : Array.isArray(j.DATA?.ARRAY) ? j.DATA.ARRAY : Array.isArray(j.ARRAY) ? j.ARRAY : j.DATA ? [j.DATA] : [];
      got += arr.length;
      // 주문번호마다 가장 늦은 스캔 하나
      const last = new Map<string, { inv: string; at: string; code: string; name: string }>();
      for (const x of arr) {
        const use = String(x.CUST_USE_NO ?? '').trim(), inv = String(x.INVC_NO ?? '').replace(/\D/g, '');
        if (!use || !inv) continue;
        const at = `${String(x.SCAN_YMD ?? '').replace(/\D/g, '')}${String(x.SCAN_HOUR ?? '').replace(/\D/g, '').padStart(6, '0')}`;
        const p = last.get(use), code = String(x.CRG_ST ?? '').trim();
        // 같은 시각이면 단계 코드가 뒤인 것 (전엔 먼저 온 줄이 남아 배송완료 건이 '집화처리'로 적혔음)
        if (!p || at > p.at || (at === p.at && stepRank(code) > stepRank(p.code))) last.set(use, { inv, at, code, name: String(x.CRG_ST_NM ?? '').trim() });
      }
      for (const [use, v] of last) {
        const { data: rows } = await sb.from('cj_bookings').select('id,invc_no,trk_at,trk_code').eq('env', cfg.env).eq('cust_use_no', use).in('status', ['booked', 'unknown']).limit(3);
        for (const r of rows || []) {
          const patch: Record<string, unknown> = {};
          if (!r.invc_no) { patch.invc_no = v.inv; filled++; }
          const iso = /^\d{14}$/.test(v.at) ? `${v.at.slice(0, 4)}-${v.at.slice(4, 6)}-${v.at.slice(6, 8)}T${v.at.slice(8, 10)}:${v.at.slice(10, 12)}:${v.at.slice(12, 14)}+09:00` : null;
          const newer = iso && (!r.trk_at || new Date(iso) > new Date(r.trk_at) || (new Date(iso).getTime() === new Date(r.trk_at).getTime() && stepRank(v.code) > stepRank(r.trk_code)));
          if (newer) { patch.trk_at = iso; patch.trk_code = v.code; patch.trk_name = v.name; }
          if (Object.keys(patch).length) { await sb.from('cj_bookings').update(patch).eq('id', r.id); updated++; }
        }
      }
      if (arr.length < 500) break;
    }
  }
  await sb.from('cj_config').update({ synced_at: new Date().toISOString() }).eq('id', 1);
  return { ok: true, env: cfg.env, got, filled, updated, errs };
}

// ---------- 반품 회수 — 원 운송장번호로 불러오기 (2026-11-24 사장님 "반품회수는 쉽게 운송장 조회만해서 접수 가능하게 해줘") ----------
// 오피스에서 접수한 송장이면 그 접수의 받는 분(= 회수할 곳) · 상품 · 브랜드를 돌려준다 (화면이 반품 칸을 채움).
// 식스샵에서 나간 송장은 주소를 가진 곳이 없어 못 찾는다 (맥미니 주문 색인은 개인정보 때문에 주소를 안 담음).
async function fromInvc(invcIn: unknown) {
  const invc = String(invcIn ?? '').replace(/\D/g, '');
  if (!/^\d{10,14}$/.test(invc)) throw new Oops('운송장 번호는 숫자 10~14자리예요');
  const { data, error } = await sb.from('cj_bookings').select('id,env,brand,rcpt_dv,cust_use_no,invc_no,status,req,created_at').eq('invc_no', invc).order('id', { ascending: false }).limit(1);
  if (error) throw new Oops('기록을 못 읽었어요: ' + error.message);
  const row = (data || [])[0];
  const { data: rets } = await sb.from('cj_bookings').select('id,created_at,status,cust_use_no').eq('ori_invc_no', invc).neq('status', 'failed').order('id', { ascending: false }).limit(5);
  if (!row) return { ok: true, found: false, invc_no: invc, returns: rets || [] };
  const q = (row.req || {}) as Record<string, any>;
  const sendBack = row.rcpt_dv === '02';   // 반품 건의 송장이면 받는 분이 우리 → 회수할 곳은 그 반품의 보내는 분
  const p = sendBack
    ? { nm: q.SENDR_NM, tel: telOf(q, 'SENDR_TEL'), zip: q.SENDR_ZIP_NO, addr: q.SENDR_ADDR, detail: q.SENDR_DETAIL_ADDR }
    : { nm: q.RCVR_NM, tel: telOf(q, 'RCVR_CELL') || telOf(q, 'RCVR_TEL'), zip: q.RCVR_ZIP_NO, addr: q.RCVR_ADDR, detail: q.RCVR_DETAIL_ADDR };
  if (p.detail === '.') p.detail = '';
  return {
    ok: true, found: true, invc_no: invc, id: row.id, env: row.env, brand: row.brand, cust_use_no: row.cust_use_no, booked_at: row.created_at,
    customer: p, goods: (Array.isArray(q.ARRAY) ? q.ARRAY : []).map((g: Record<string, unknown>) => ({ nm: String(g.GDS_NM ?? ''), qty: Number(g.GDS_QTY) || 1 })),
    returns: rets || [],
  };
}

async function list(limit: number, q: string, dv = '') {
  let qb = sb.from('cj_bookings')
    .select('id,created_at,env,kind,batch_id,brand,rcpt_dv,prt_st,cust_use_no,invc_no,status,result_detail,rcvr_nm,rcvr_tel,rcvr_addr,gds_nm,box_qty,created_by,cancelled_at,printed_at,print_count,trk_code,trk_name,trk_at,reason,ori_invc_no')
    .order('id', { ascending: false }).limit(Math.max(1, Math.min(300, limit || 100)));
  if (dv === '01' || dv === '02') qb = qb.eq('rcpt_dv', dv);
  const s = String(q || '').replace(/[%,()]/g, ' ').trim().slice(0, 40);
  if (s) qb = qb.or(`rcvr_nm.ilike.%${s}%,cust_use_no.ilike.%${s}%,invc_no.ilike.%${s}%,gds_nm.ilike.%${s}%,ori_invc_no.ilike.%${s}%,reason.ilike.%${s}%`);
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
        return json({ ok: true, env: cfg.env, configured: !!(cfg.cust_id && cfg.biz_reg_num), cust: cfg.cust_id.replace(/^(\d{4})\d+/, '$1****'), sender: cfg.sender || {}, print: cleanPrint(cfg.print || {}), synced_at: (cfg as Record<string, unknown>).synced_at ?? null });
      case 'sync':
        return json(await sync(cfg));
      case 'print_save': {
        const print = cleanPrint(body.print || {});
        await sb.from('cj_config').update({ print, updated_at: new Date().toISOString() }).eq('id', 1);
        return json({ ok: true, print });
      }
      case 'labels':
        return json({ ok: true, env: cfg.env, labels: await labels(cfg, body.ids, body.mark !== false) });
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
        return json({ ok: true, env: cfg.env, rows: await list(Number(body.limit), String(body.q || ''), String(body.dv || '')) });
      case 'from_invc':
        return json(await fromInvc(body.invc_no));
      default:
        return json({ ok: false, error: '모르는 요청이에요' }, 400);
    }
  } catch (e) {
    const msg = e instanceof Oops ? e.message : `서버 오류: ${(e as Error)?.message || e}`;
    return json({ ok: false, error: msg }, e instanceof Oops ? 200 : 500);
  }
});
