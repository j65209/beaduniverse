// 우편 · LP 운송장 조회 (Supabase 엣지 함수 "post-track", 2026-11-23)
// 오피스 물류팀 맨 위 '운송장 붙여넣기' 칸이 부른다. 사용자 요청: "우체국 국제등기, 우편 · LP로 시작하는 에어 조회", "최상단에 운송장만 붙여넣기 하게"
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false
//   (공개 조회 화면을 대신 읽어 오기만 함 — 저장 · 쓰기 없음. 브라우저에서 바로는 CORS 로 막혀서 이 함수가 대신 받는다)
//
//   POST /post-track {nos:["LP00…", "RR123456789KR", "6070012345678"]}   (GET ?no=…,… 도 됨)
//   → {ok:true, results:[{no, kind, label, found, delivered, status, at, loc, info:[[이름,값]…], events:[{t,s,loc,d}…최신순], url, error?}]}
//
// 번호 모양으로 나눔
//   LP + 숫자            → 차이니아오(Cainiao) global.cainiao.com detail.json
//   영문2 + 숫자9 + 영문2 → 우체국 국제 (EMS · 국제등기 · 국제소포 · 해외에서 들어오는 우편 포함)
//   숫자 13자리          → 우체국 국내 등기 · 소포
//   그 밖의 영문 · 숫자    → 차이니아오에 한 번 물어봄 (차이니아오가 다른 택배사 번호도 이어 줌)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MAX_NOS = 40;

type Ev = { t: string; s: string; loc?: string; d?: string };
type Res = {
  no: string; kind: string; label: string; found: boolean; delivered: boolean;
  status?: string; at?: string; loc?: string; info: [string, string][]; events: Ev[]; url: string; error?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

function kindOf(no: string): 'cainiao' | 'epost-intl' | 'epost-dom' | null {
  if (/^LP\d{8,20}$/.test(no)) return 'cainiao';
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(no)) return 'epost-intl';
  if (/^\d{13}$/.test(no)) return 'epost-dom';
  if (/^[A-Z0-9]{8,30}$/.test(no)) return 'cainiao';
  return null;
}

const DONE_RE = /배달\s*완료|배달완료|수령|delivered|signed|签收|妥投/i;

// ---------- HTML 표 읽기 (우체국) ----------
function txt(h: string): string {
  return h
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((s) => s.replace(/[ \t\r]+/g, ' ').trim()).filter(Boolean).join(' / ');
}
type Table = { heads: string[]; rows: string[][] };
// 국내 등기 화면은 상세 표가 기본 표 안(<tr> 속)에 들어 있어서, 표 하나 = '<table' 부터 다음 '<table' 또는 '</table>' 까지로 자른다
function tables(html: string): Table[] {
  const out: Table[] = [];
  const h0 = html.replace(/<!--[\s\S]*?-->/g, '');
  const low = h0.toLowerCase();
  const starts: number[] = [];
  for (let i = low.indexOf('<table'); i >= 0; i = low.indexOf('<table', i + 6)) starts.push(i);
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k];
    const close = low.indexOf('</table>', s);
    const next = k + 1 < starts.length ? starts[k + 1] : -1;
    const end = [close, next].filter((x) => x > s).reduce((a, b) => Math.min(a, b), h0.length);
    const t = h0.slice(s, end);
    const heads = [...t.matchAll(/<th[^>]*scope=["']?col["']?[^>]*>([\s\S]*?)<\/th>/gi)].map((x) => txt(x[1]));
    const body = (t.match(/<tbody[\s\S]*?<\/tbody>/i) || [t])[0];
    const rows: string[][] = [];
    for (const r of body.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      if (/scope=["']?col/i.test(r[0])) continue;
      const cells = [...r[0].matchAll(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi)].map((c) => txt(c[3]));
      if (cells.length) rows.push(cells);
    }
    out.push({ heads, rows });
  }
  return out;
}
const col = (heads: string[], re: RegExp) => heads.findIndex((h) => re.test(h));

const epostUrl = (no: string, dom: boolean) => dom
  ? `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${no}&displayHeader=N`
  : `https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE=${no}&displayHeader=N`;

async function epost(no: string, dom: boolean): Promise<Res> {
  const url = epostUrl(no, dom);
  const res: Res = { no, kind: dom ? 'epost-dom' : 'epost-intl', label: dom ? '우체국 국내' : '우체국 국제', found: false, delivered: false, info: [], events: [], url };
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`우체국 응답 ${r.status}`);
  const html = await r.text();
  const tbs = tables(html);
  const base = tbs.find((t) => t.heads.some((h) => /배달결과/.test(h)));
  const det = tbs.find((t) => t.heads.some((h) => /처리현황/.test(h)));
  if (base) {
    const row = base.rows.find((r) => r.length >= 3);
    if (row) {
      base.heads.forEach((h, i) => {
        if (i === 0 || !row[i]) return;
        res.info.push([h, row[i]]);
      });
      const di = col(base.heads, /배달결과/);
      if (di >= 0 && row[di]) res.status = row[di];
    }
  }
  if (det) {
    const h = det.heads;
    const iT = col(h, /처리일시/), iD = col(h, /^날짜/), iH = col(h, /^시간/);
    const iS = col(h, /처리현황/), iL = col(h, /우체국|발생국|현재위치/), iX = col(h, /상세/);
    for (const r of det.rows) {
      if (r.length < 2) continue;
      const t = iT >= 0 ? r[iT] : [iD >= 0 ? r[iD] : '', iH >= 0 ? r[iH] : ''].filter(Boolean).join(' ');
      const ev: Ev = { t: (t || '').replace(/\s*\/\s*/g, ' '), s: iS >= 0 ? r[iS] || '' : '' };
      if (iL >= 0 && r[iL]) ev.loc = r[iL];
      if (iX >= 0 && r[iX]) ev.d = r[iX];
      if (ev.t || ev.s) res.events.push(ev);
    }
    res.events.reverse(); // 우체국은 오래된 것부터 → 최신순으로
  }
  res.found = res.events.length > 0 || res.info.some(([, v]) => v && v !== '/');
  if (!res.found && /찾지 못했습니다/.test(html)) res.error = '아직 조회 기록 없음';
  const last = res.events[0];
  if (last) {
    res.at = last.t; res.loc = last.loc;
    if (!res.status) res.status = last.s;
  }
  res.delivered = DONE_RE.test(res.status || '') || (!!last && DONE_RE.test(last.s));
  return res;
}

// ---------- 차이니아오 ----------
async function cainiao(nos: string[]): Promise<Res[]> {
  const url = `https://global.cainiao.com/global/detail.json?mailNos=${nos.join(',')}&lang=ko-KR`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://global.cainiao.com/' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`차이니아오 응답 ${r.status}`);
  const j = await r.json();
  const mods: any[] = Array.isArray(j?.module) ? j.module : [];
  return nos.map((no) => {
    const m = mods.find((x) => String(x?.mailNo || '').toUpperCase() === no) || {};
    const res: Res = {
      no, kind: 'cainiao', label: '차이니아오', found: false, delivered: false, info: [], events: [],
      url: `https://global.cainiao.com/newDetail.htm?mailNoList=${no}&lang=ko`,
    };
    const list: any[] = Array.isArray(m.detailList) ? m.detailList : [];
    for (const d of list) {
      const ms = Number(d?.time);
      const t = d?.timeStr || (ms ? new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : '');
      const ev: Ev = { t, s: d?.standerdDesc || d?.descTitle || d?.desc || '' };
      if (d?.desc && d.desc !== ev.s) ev.d = d.desc;
      res.events.push(Object.assign(ev, { _ms: ms || 0 }) as Ev);
    }
    if (res.events.some((e: any) => e._ms)) res.events.sort((a: any, b: any) => (b._ms || 0) - (a._ms || 0));
    res.events.forEach((e: any) => delete e._ms);
    const put = (k: string, v: unknown) => { if (v != null && String(v).trim()) res.info.push([k, String(v).trim()]); };
    put('출발', m.originCountry);
    put('도착', m.destCountry);
    put('상태', m.statusDesc);
    const cp = m.destCpInfo || {};
    put('도착국 택배사', cp.cpName);
    put('도착국 번호', m.destMailNo || cp.mailNo);
    res.found = res.events.length > 0;
    if (!res.found) res.error = '아직 조회 기록 없음';
    const last = res.events[0];
    res.status = m.statusDesc || last?.s;
    res.at = last?.t;
    res.delivered = String(m.status || '').toUpperCase() === 'SIGN' || DONE_RE.test(res.status || '') || (!!last && DONE_RE.test(last.s + ' ' + (last.d || '')));
    return res;
  });
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let raw: unknown[] = [];
  try {
    if (req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      raw = Array.isArray(b?.nos) ? b.nos : [];
    } else {
      raw = (new URL(req.url).searchParams.get('no') || '').split(/[\s,]+/);
    }
  } catch { /* 빈 요청 */ }
  const nos = [...new Set(raw.map((x) => String(x || '').toUpperCase().replace(/[\s-]/g, '')).filter(Boolean))].slice(0, MAX_NOS);
  if (!nos.length) return json({ ok: false, error: '번호가 없어요' }, 400);

  const out = new Map<string, Res>();
  const cn: string[] = [];
  const ep: string[] = [];
  for (const no of nos) {
    const k = kindOf(no);
    if (k === 'cainiao') cn.push(no);
    else if (k) ep.push(no);
    else out.set(no, { no, kind: 'unknown', label: '모르는 번호', found: false, delivered: false, info: [], events: [], url: '', error: '번호 모양을 모르겠어요' });
  }
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < cn.length; i += 10) {
    const part = cn.slice(i, i + 10);
    jobs.push(cainiao(part).then((rs) => rs.forEach((r) => out.set(r.no, r))).catch((e) => {
      part.forEach((no) => out.set(no, { no, kind: 'cainiao', label: '차이니아오', found: false, delivered: false, info: [], events: [], url: `https://global.cainiao.com/newDetail.htm?mailNoList=${no}&lang=ko`, error: String(e?.message || e) }));
    }));
  }
  jobs.push(pool(ep, 4, async (no) => {
    const dom = kindOf(no) === 'epost-dom';
    try { out.set(no, await epost(no, dom)); }
    catch (e) {
      out.set(no, { no, kind: dom ? 'epost-dom' : 'epost-intl', label: dom ? '우체국 국내' : '우체국 국제', found: false, delivered: false, info: [], events: [], url: epostUrl(no, dom), error: String((e as Error)?.message || e) });
    }
  }));
  await Promise.all(jobs);
  return json({ ok: true, results: nos.map((n) => out.get(n)) });
});
