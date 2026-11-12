// 29CM · W컨셉 기획전 메일 → MD팀 기획전 캘린더 (Supabase 엣지 함수 "md-mail-events")
//
// 흐름: shinebead0@gmail.com — 29CM · W컨셉 담당자에게 보낸 기획전 신청 메일(엑셀 첨부) → 상태 '신청함'
//       + 29CM · W컨셉에서 받은 기획전 제안 메일(제목이 기획전 · 본문에 기간) → 상태 '제안받음' (신청 메일이 오면 '신청함')
//       → 그 지메일의 Apps Script(scripts/md-mail-sync.gs, 30분마다)가 메일 원문 + 첨부 엑셀 글자를 보냄
//       → 여기서 기획전 이름 · 기간 · 브랜드를 뽑아 md_mail_events 에 upsert → 오피스 MD 캘린더가 '자동' 줄로 읽음.
// 뽑는 규칙은 여기에만 있다 — 고치면 {action:'reparse'} 로 저장된 원문을 다시 뽑는다.
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false (키로 확인)
// 키: private_kv 'md_mail_key'
//   POST {action:'mail', key, msg:{id, dir:'sent'|'received', sentAt, subject, from, to, body, attachments:[{name, text}]}} → {events:[...]}
//   POST {action:'reparse', key}

import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

const BRANDS: [string, RegExp][] = [
  ['kop', /코페리|coferry|koperi/i], ['apt', /아페티|apeti/i], ['koz', /코즈미|cosmi/i], ['pp', /프로덕트피알|produktepr|productpr/i],
  ['akoi', /아코이|akoi/i], ['yar', /야르|yär|\byar\b/i], ['6a', /식스에이|\b6a\b/i],
];
const PLATFORM_LABEL: Record<string, string> = { wconcept: 'W컨셉', '29cm': '29CM' };

interface Att { name: string; text?: string }
// dir: 'sent'(내가 보낸 신청 · 예전 원문은 dir 없음) | 'received'(29CM · W컨셉이 보낸 제안)
interface Msg { id: string; sentAt?: string; subject?: string; to?: string; from?: string; dir?: string; body?: string; attachments?: Att[] }
export interface MailEvent { key: string; platform: string; brand: string | null; name: string; start_date: string | null; end_date: string | null; status: string; memo: string; subject: string; source_msg_id: string; sent_at: string | null }

/** 받은 메일 중 기획전 제안으로 볼 제목 (정산 · 계약 · 문의 답장 · 점검 공지 같은 건 뺀다) */
const PROPOSAL_RE = /기획전|프로모션|위크|세일|행사|(?<!업)데이(?!트)|페스타|페스티벌|쿠폰|특가|딜|캠페인|홀리데이|블프|블랙\s*프라이데이|이벤트/i;
const NOT_PROPOSAL_RE = /정산|세금\s*계산서|계약|사업자|양도|주소|로그인|광고\s*계정|오류|반품|교환|CS|입점\s*심사|정책\s*변경|개인정보|점검|시스템|업데이트|배송|물류|약관/i;

function platformOf(m: Msg): string | null {
  const s = `${m.to ?? ''} ${m.from ?? ''} ${m.subject ?? ''}`.toLowerCase();
  if (/wconcept/.test(s) || /w컨셉/i.test(m.subject ?? '')) return 'wconcept';
  if (/29cm/.test(s)) return '29cm';
  return null;
}
function brandOf(...texts: string[]): string | null {
  for (const t of texts) for (const [k, re] of BRANDS) if (re.test(t)) return k;
  return null;
}
/** 내 답장 부분만 (인용된 원문 앞까지) */
function ownPart(body: string): string {
  const lines = body.replace(/\r/g, '').split('\n');
  const cut = lines.findIndex((l) => /^\s*>|\d{4}년 .{0,40}(작성|wrote)|^On .+wrote:|^-{2,}\s*(Original|원본|Forwarded)|^\s*보낸\s*사람\s*:|^\s*From:/.test(l));
  return (cut >= 0 ? lines.slice(0, cut) : lines).join('\n');
}
function cleanName(raw: string, platform: string): string {
  let s = raw.replace(/\.(xlsx?|csv)$/i, '').replace(/_+/g, ' ')
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '')
    .replace(/\[(중요\/)?\s*(w컨셉|29cm|코페리|아페티|코즈미)[^\]]*\]/gi, ' ')
    .replace(/\((회신|답변)[^)]*\)/g, ' ')
    .replace(/\((코페리|아페티|코즈미|프로덕트피알|아코이하우스|아코이|야르|식스에이|브랜드명)\)/g, ' ')
    .replace(/w컨셉|29cm/gi, ' ')
    .replace(/\b(BAG|ACC)\b|(^|\s)(잡화|공통)(?=\s|$)/gi, ' ')
    .replace(/코페리|아페티|코즈미|프로덕트피알|아코이하우스|야르|식스에이/g, ' ')
    .replace(/\d+\s*(차|주차)(?=\s|$)/g, ' ')
    .replace(/(세일\s*리스트|참여\s*상품|파일|시트).*$/g, ' ')
    .replace(/\s*(프로모션\s*)?(제안|안내|참여|일정|전달|요청).*$/g, ' ')
    .replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (platform === 'wconcept') s = s.replace(/\s*프로모션$/, '');
  return s;
}
const pad = (n: number) => String(n).padStart(2, '0');
/** 'M/D ~ M/D', 'M. D ~ M. D' 꼴 기간들 → [시작, 끝] (YYYY-MM-DD). 연도는 보낸 날 기준으로 가까운 쪽 */
export function parseRange(text: string, sentAt?: string): [string, string] | null {
  const base = sentAt ? new Date(new Date(sentAt).getTime() + 9 * 3600e3) : new Date();
  const by = base.getUTCFullYear(), bm = base.getUTCMonth() + 1;
  const yearOf = (m: number) => (m < bm - 6 ? by + 1 : m > bm + 6 ? by - 1 : by);
  const re = /(\d{1,2})\s*[\/.]\s*(\d{1,2})\s*(?:\([^)]{1,3}\))?\s*(?:\d{1,2}:\d{2})?\s*[~∼–-]\s*(\d{1,2})\s*[\/.]\s*(\d{1,2})/g;
  let lo = '', hi = '';
  for (const m of text.matchAll(re)) {
    const [m1, d1, m2, d2] = [+m[1], +m[2], +m[3], +m[4]];
    if (m1 < 1 || m1 > 12 || m2 < 1 || m2 > 12 || d1 < 1 || d1 > 31 || d2 < 1 || d2 > 31) continue;
    const y1 = yearOf(m1), y2 = m2 < m1 ? y1 + 1 : y1;
    const s = `${y1}-${pad(m1)}-${pad(d1)}`, e = `${y2}-${pad(m2)}-${pad(d2)}`;
    if (e < s) continue;
    if (!lo || s < lo) lo = s;
    if (!hi || e > hi) hi = e;
  }
  return lo ? [lo, hi] : null;
}

/** 기간이 적힌 줄만 골라서(신청 · 회신 · 접수 · 예시 줄 제외), 기획전 이름이 같이 적힌 줄이 있으면 그 줄만 */
export function pickRange(text: string, name: string, sentAt?: string): [string, string] | null {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => /\d\s*[\/.]\s*\d/.test(l) && !/신청|회신|접수|마감|예시|PIN/i.test(l) && parseRange(l, sentAt));
  if (!lines.length) return null;
  const core = name.replace(/^\d+월\s*/, '').replace(/\s+/g, '');
  const named = core ? lines.filter((l) => l.replace(/[\s*]+/g, '').includes(core)) : [];
  return parseRange((named.length ? named : lines).join('\n'), sentAt);
}

/** 받은 제안 메일 — 제목이 기획전 이름, 기간은 본문(제안서)에서. 기간이 없으면 안 넣는다 */
function parseProposal(m: Msg, platform: string): MailEvent[] {
  const subject = m.subject ?? '';
  if (!PROPOSAL_RE.test(subject) || NOT_PROPOSAL_RE.test(subject)) return [];
  const name = cleanName(subject, platform).replace(/\s*(기획전|행사|이벤트)$/, '');
  if (!name || name.length < 2) return [];
  const body = String(m.body ?? '');
  const r = pickRange(ownPart(body), name, m.sentAt) ?? pickRange(body.slice(0, 12000), name, m.sentAt);
  if (!r) return [];
  const brand = brandOf(subject);
  const label = PLATFORM_LABEL[platform];
  return [{
    key: `${platform}|${brand ?? ''}|${name}`, platform, brand, name,
    start_date: r[0], end_date: r[1], status: '제안받음',
    memo: `${label}에서 받은 기획전 제안 — 신청 메일을 보내면 '신청함'으로 바뀜 (받은 메일: ${subject})`,
    subject, source_msg_id: m.id, sent_at: m.sentAt ?? null,
  }];
}

export function parseMail(m: Msg): MailEvent[] {
  const platform = platformOf(m);
  if (!platform) return [];
  if (m.dir === 'received') return parseProposal(m, platform);
  const body = String(m.body ?? '');
  const own = ownPart(body);
  const atts = (m.attachments ?? []).filter((a) => /\.xlsx?$/i.test(a.name));
  const groups = new Map<string, { name: string; ranges: string[]; texts: string[] }>();
  const add = (name: string, text: string) => {
    if (!name) return;
    const g = groups.get(name) ?? { name, ranges: [], texts: [] };
    g.texts.push(text);
    groups.set(name, g);
  };
  if (atts.length) for (const a of atts) add(cleanName(a.name, platform), a.text ?? '');
  else add(cleanName(m.subject ?? '', platform), '');
  const out: MailEvent[] = [];
  for (const g of groups.values()) {
    // 기간: 내 본문 → (29CM) 첨부 엑셀 '종료기간' → 인용된 원문.
    // W컨셉 엑셀은 양식에 예시 날짜(1/5~1/8)가 있어 안 쓴다. 'PIN 신청기간' · 회신 기한 줄도 뺀다.
    let r = pickRange(own, g.name, m.sentAt);
    if (!r && platform === '29cm') for (const t of g.texts) { const x = pickRange(t, g.name, m.sentAt); if (x) r = r ? [x[0] < r[0] ? x[0] : r[0], x[1] > r[1] ? x[1] : r[1]] : x; }
    if (!r) r = pickRange(body.slice(0, 8000), g.name, m.sentAt);
    const brand = brandOf(...(m.attachments ?? []).map((a) => a.name), m.subject ?? '', own);
    const label = PLATFORM_LABEL[platform];
    out.push({
      key: `${platform}|${brand ?? ''}|${g.name}`,
      platform, brand, name: g.name,
      start_date: r?.[0] ?? null, end_date: r?.[1] ?? null, status: '신청함',
      memo: `${label}에 메일로 신청한 기획전 (보낸 메일: ${m.subject || '제목 없음'})`,
      subject: m.subject ?? '', source_msg_id: m.id, sent_at: m.sentAt ?? null,
    });
  }
  return out;
}

let cachedKey = '';
async function checkKey(k: string) {
  if (!cachedKey) cachedKey = (await sb.from('private_kv').select('value').eq('key', 'md_mail_key').single()).data?.value ?? '';
  return !!cachedKey && k === cachedKey;
}

const normName = (s: string) => String(s || '').replace(/^\d+\s*월\s*/, '').replace(/[\s_\-·&]+/g, '').replace(/(기획전|프로모션|행사|이벤트)$/, '').toLowerCase();

async function upsert(evs: MailEvent[]) {
  for (const e of evs) {
    const COLS = 'id, start_date, end_date, sent_at, status';
    let { data: ex } = await sb.from('md_mail_events').select(COLS).eq('key', e.key).maybeSingle();
    // 브랜드를 못 찾은 메일(전달 · 받은 제안 등)은 같은 플랫폼 · 같은 이름의 기존 줄에 합친다
    if (!ex && !e.brand) ex = (await sb.from('md_mail_events').select(COLS).eq('platform', e.platform).eq('name', e.name).limit(1)).data?.[0] ?? null;
    // 브랜드가 있는 메일이 먼저 '브랜드 없음' 줄(받은 제안 등)을 만났으면 그 줄을 이 브랜드로
    if (!ex && e.brand) { const nb = (await sb.from('md_mail_events').select('id').eq('key', `${e.platform}||${e.name}`).maybeSingle()).data; if (nb) { await sb.from('md_mail_events').update({ key: e.key, brand: e.brand }).eq('id', nb.id); ex = (await sb.from('md_mail_events').select(COLS).eq('id', nb.id).single()).data; } }
    // 이름이 조금 달라도('11월 이구위크' ↔ '이구위크', '추석 세일' ↔ '추석세일') 같은 플랫폼 · 같은 브랜드(또는 브랜드 없음)면 합친다
    if (!ex) {
      const rows = (await sb.from('md_mail_events').select(COLS + ', name, brand').eq('platform', e.platform)).data ?? [];
      const hit = rows.find((x: any) => normName(x.name) === normName(e.name) && (!x.brand || !e.brand || x.brand === e.brand));
      if (hit) {
        if (e.brand && !hit.brand) await sb.from('md_mail_events').update({ key: e.key, brand: e.brand }).eq('id', hit.id);
        if (e.status === '신청함' && hit.status !== '신청함') await sb.from('md_mail_events').update({ key: e.key, name: e.name }).eq('id', hit.id);
        ex = hit;
      }
    }
    if (!ex) { await sb.from('md_mail_events').insert(e); continue; }
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // 이미 신청한 줄에 받은 제안 메일(리마인드 등)이 오면 비어 있는 기간만 채운다
    if (ex.status === '신청함' && e.status !== '신청함') {
      if (!ex.start_date && e.start_date) Object.assign(upd, { start_date: e.start_date, end_date: e.end_date });
      await sb.from('md_mail_events').update(upd).eq('id', ex.id);
      continue;
    }
    // 제안받은 줄에 신청 메일이 오면 '신청함' + 신청 메일 값으로
    const upgrade = ex.status !== '신청함' && e.status === '신청함';
    // 같은 기획전을 여러 번 보냈으면(가격 수정 등) 기간이 있는 최신 메일 값으로
    const newer = upgrade || !ex.sent_at || (e.sent_at && e.sent_at >= ex.sent_at);
    if (e.start_date && (newer || !ex.start_date)) Object.assign(upd, { start_date: e.start_date, end_date: e.end_date });
    if (newer) Object.assign(upd, { status: e.status, memo: e.memo, subject: e.subject, source_msg_id: e.source_msg_id, sent_at: e.sent_at });
    await sb.from('md_mail_events').update(upd).eq('id', ex.id);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true, name: 'md-mail-events' });
  let p: any;
  try { p = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!(await checkKey(String(p.key || '')))) return json({ error: 'key' }, 401);
  if (p.action === 'mail') {
    const evs = parseMail(p.msg || {});
    await upsert(evs);
    // 다시 뽑기용 원문 (엑셀 글자는 앞부분만). 받은 메일은 기획전 같은 제목만 남긴다
    const m = p.msg || {};
    if (m.dir !== 'received' || PROPOSAL_RE.test(String(m.subject || ''))) {
      await sb.from('private_kv').upsert({ key: `md_mail_raw:${m.id}`, value: JSON.stringify({ ...m, body: String(m.body || '').slice(0, 20000), attachments: (m.attachments || []).map((a: Att) => ({ name: a.name, text: String(a.text || '').slice(0, 3000) })) }) });
    }
    return json({ events: evs });
  }
  if (p.action === 'reparse') {
    const rows: { value: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await sb.from('private_kv').select('value').like('key', 'md_mail_raw:%').order('key').range(from, from + 999);
      if (!data?.length) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    await sb.from('md_mail_events').delete().neq('id', 0);
    const all: MailEvent[] = [];
    const msgs = rows.map((r) => JSON.parse(r.value) as Msg).sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt)));
    for (const m of msgs) { const evs = parseMail(m); await upsert(evs); all.push(...evs); }
    return json({ ok: true, mails: msgs.length, events: all.length });
  }
  return json({ error: 'action' }, 400);
});
