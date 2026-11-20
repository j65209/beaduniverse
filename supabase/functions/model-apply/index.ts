// 모델 지원자 받기 (Supabase 엣지 함수 "model-apply")
//
// 흐름: brightbeed@bead-uni.com 으로 온 모델 지원 메일 → (관리 콘솔 매핑으로) brightbeed@gmail.com 에 도착
//       → 그 지메일 계정의 Apps Script(models/gmail-sync.gs, 5분마다)가 새 메일을 이 함수로 보냄
//       → model_applicants 표에 한 줄 + 첨부(사진 · 파일)는 storage 'model-applicants' 버킷에.
// 오피스 models/ 페이지는 anon 으로 표를 읽고 상태 · 메모만 고친다. 넣기는 이 함수만 (서비스 키).
//
// 배포: Supabase MCP deploy_edge_function, 프로젝트 ckyjkxbqsyjoqpuqwoce, verify_jwt=false (키로 자체 확인)
// 키: private_kv 'model_apply_key' (anon 으로 못 읽음). Apps Script 의 KEY 와 같아야 함.
//
//   POST {action:'apply', key, msg:{id, threadId, date, fromName, fromEmail, subject, body, html?}}  → {id, isNew, big}
//   POST {action:'file',  key, gmailId, name, mime, size, b64}                                       → {ok, url}
//   POST {action:'big',   key, gmailId | id, html?, wait?}   네이버 대용량 첨부 다시 받기 (wait 면 끝까지 기다려 결과)
//   POST {action:'reparse', key}   본문에서 이름 · 키 등을 다시 뽑기 (뽑는 규칙을 고친 뒤)
//
// 네이버 '대용량 첨부' (2026-11-20 사장님 "왜 이미지가 안 불러와지지?"):
//   네이버 메일은 큰 파일을 첨부 대신 bigfile.mail.naver.com 다운로드 링크로 보낸다(30일 · 100회, 로그인 없이 받힘).
//   메일 첨부가 아니라 Apps Script 의 getAttachments() 에 안 잡혀서 사진이 비어 있었다.
//   → 본문(평문) · Apps Script 가 보낸 html 에서 링크를 찾아 이 함수가 직접 받아 버킷에 넣는다 (apply 는 뒤에서, 응답은 바로).
//     사진 · 25MB 이하 파일 = 버킷에 복사 / 더 큰 파일 = 링크만(link:true, until) / zip = 안의 사진만 풀어 넣음(zip 60MB 까지).
//   photos 덧붙이기는 DB 함수 model_applicant_add_file 로 한 줄씩 (메일 첨부와 동시에 들어와도 안 덮어씀, 이름 + 크기 같으면 건너뜀).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { unzipSync } from 'npm:fflate@0.8.2';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const BUCKET = 'model-applicants';
const MIN_IMAGE = 15 * 1024;              // 서명 · 로고 같은 작은 그림은 건너뜀 (Apps Script 와 같음)
const MAX_FILE = 25 * 1024 * 1024;        // 버킷 한도와 같음
const MAX_ZIP = 60 * 1024 * 1024;         // zip 은 풀어서 사진만 넣으니 조금 더 큰 것까지
const MAX_ZIP_IMAGES = 60;
const IMG_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i;
const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf', zip: 'application/zip', hwp: 'application/x-hwp',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime',
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

/* ---------- 본문에서 항목 뽑기 ---------- */
const FIELDS: Record<string, string[]> = {
  name: ['이름', '성함', '성명', 'name'],
  age: ['나이', '연령', '생년월일', '출생년도', '출생', '생년', 'age'],
  height: ['키', '신장', 'height'],
  weight: ['몸무게', '체중', 'weight'],
  size: ['사이즈', '신체\\s*사이즈', '신체\\s*치수', '쓰리\\s*사이즈', '상의', '하의', '신발', 'size'],
  phone: ['연락처', '전화번호', '전화', '휴대폰', '핸드폰', '휴대전화', 'phone', 'tel'],
  instagram: ['인스타그램', '인스타', '인스타\\s*계정', 'sns', 'instagram', 'insta'],
  region: ['거주지', '거주\\s*지역', '지역', '사는\\s*곳', '주소'],
  career: ['경력', '활동\\s*경력', '촬영\\s*경력', '이력', 'career'],
};

function clean(v: string) {
  return v.replace(/\s+/g, ' ').replace(/^[\s:：\-–=)\].>]+/, '').trim().slice(0, 120);
}

export function parseFields(body: string, fromName = '') {
  const text = (body || '').replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.replace(/^[\s\-*•·▶►✔✅☑️◆◇■□●○\d.)]+/, '').trim()).filter(Boolean);
  const out: Record<string, string> = {};
  for (const [k, labels] of Object.entries(FIELDS)) {
    const re = new RegExp(`^(${labels.join('|')})\\s*(?:\\(.*?\\))?\\s*[:：\\-–=)]?\\s*(.+)$`, 'i');
    for (const l of lines) {
      const m = l.match(re);
      if (m && clean(m[2])) {
        const v = clean(m[2]);
        if (k === 'size') {
          // 상의 · 하의 · 신발은 이름표를 붙여 모음
          const part = /^(상의|하의|신발)$/.test(m[1]) ? `${m[1]} ${v}` : v;
          out.size = out.size ? out.size + ' · ' + part : part;
          continue;
        }
        out[k] = v;
        break;
      }
    }
  }
  const inline = (re: RegExp) => { const m = text.match(re); return m ? m[1].trim() : ''; };
  // 키 · 몸무게는 숫자만 ("키 / 몸무게 : 168cm / 48kg" 같은 줄도)
  const hNum = (s?: string) => s?.match(/1[4-9]\d(?:\.\d)?/)?.[0] || '';
  const h = hNum(out.height) || hNum(inline(/(?:키|신장)([^\n]{0,30})/)) || inline(/(1[4-9]\d(?:\.\d)?)\s*cm/i);
  out.height = h ? h + 'cm' : '';
  const wNum = (s?: string) => s?.match(/([3-9]\d(?:\.\d)?)\s*kg/i)?.[1] || '';
  const w = wNum(out.weight) || (out.weight?.match(/^[3-9]\d(?:\.\d)?$/)?.[0] || '') ||
    wNum(inline(/(?:몸무게|체중)([^\n]{0,40})/)) || inline(/(?:몸무게|체중)\s*[:：]?\s*([3-9]\d(?:\.\d)?)/) || wNum(text);
  out.weight = w ? w + 'kg' : '';
  if (!out.age) out.age = inline(/((?:19|20)\d{2}\s*년생|\d{2}\s*년생|만?\s*\d{2}\s*살|만?\s*\d{2}\s*세)/);
  if (!out.phone) out.phone = inline(/(01[016789][\s.-]?\d{3,4}[\s.-]?\d{4})/);
  if (!out.instagram) out.instagram = inline(/(?:instagram\.com\/)([A-Za-z0-9._]{2,30})/i);
  if (!out.instagram) out.instagram = inline(/(?:^|\s)(@[A-Za-z0-9._]{2,30})/);
  if (!out.name && fromName && !/@/.test(fromName)) out.name = fromName.trim().slice(0, 40);
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

/* ---------- 네이버 대용량 첨부 ---------- */
type Big = { name: string; size: number | null; url: string; until: string | null };

const fidOf = (u: string) => (u.split('fid=')[1] || u).replace(/[>)\].,]+$/, '');

export function bigLinks(text: string): Big[] {
  const t = String(text || '').replace(/&amp;/g, '&');
  const out: Big[] = [];
  const seen = new Set<string>();
  // 1) 'MYBOX 저장' 링크의 resource JSON — 이름 · 크기 · 받는 주소가 다 들어 있다
  for (const m of t.matchAll(/https?:\/\/mybox\.naver\.com\/saveFile\?[^\s<>"']+/g)) {
    try {
      const res = new URL(m[0]).searchParams.get('resource');
      if (!res) continue;
      const r = JSON.parse(res);
      let u = String(r.downloadUrl || '');
      if (!/^https?:\/\//.test(u)) u = 'https://' + u;
      if (!/^https:\/\/bigfile\.mail\.naver\.com\/download\?fid=/.test(u)) continue;
      const fid = fidOf(u);
      if (seen.has(fid)) continue;
      seen.add(fid);
      out.push({ name: String(r.name || '').trim().slice(0, 120), size: Number(r.size) || null, url: u, until: null });
    } catch { /* 깨진 링크는 건너뜀 */ }
  }
  // 2) MYBOX 링크가 없는 메일 — 다운로드 링크만 (이름은 받을 때 알게 됨)
  for (const m of t.matchAll(/https?:\/\/bigfile\.mail\.naver\.com\/download\?fid=[^\s<>"'&]+/g)) {
    const u = m[0].replace(/^http:/, 'https:').replace(/[>)\].,]+$/, '');
    const fid = fidOf(u);
    if (seen.has(fid)) continue;
    seen.add(fid);
    out.push({ name: '', size: null, url: u, until: null });
  }
  // 보관 기한 "~ 2026/12/16" — 링크 바로 뒤, 없으면 메일 안 첫 기한 (같이 보낸 파일은 기한이 같다)
  const plain = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const anyUntil = plain(t).match(/~\s*(20\d\d[./-]\d{1,2}[./-]\d{1,2})/)?.[1] || null;
  for (const b of out) {
    const fid = fidOf(b.url);
    const i = t.indexOf(fid);
    const near = i >= 0 ? plain(t.slice(i + fid.length, i + fid.length + 400)).match(/^[^]{0,120}?(20\d\d[./-]\d{1,2}[./-]\d{1,2})/)?.[1] : null;
    b.until = (near || anyUntil || '').replace(/[.-]/g, '/') || null;
  }
  return out.slice(0, 40);
}

function sniff(u: Uint8Array): { mime: string; ext: string } | null {
  const s = (a: number, b: number) => String.fromCharCode(...u.subarray(a, b));
  if (u.length > 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (u.length > 8 && u[0] === 0x89 && s(1, 4) === 'PNG') return { mime: 'image/png', ext: 'png' };
  if (u.length > 6 && s(0, 3) === 'GIF') return { mime: 'image/gif', ext: 'gif' };
  if (u.length > 12 && s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (u.length > 12 && s(4, 8) === 'ftyp') {
    const brand = s(8, 12);
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return { mime: 'image/heic', ext: 'heic' };
    if (/^(avif|avis)$/.test(brand)) return { mime: 'image/avif', ext: 'avif' };
  }
  return null;
}
const isZipBytes = (u: Uint8Array) => u.length > 4 && u[0] === 0x50 && u[1] === 0x4b && u[2] === 0x03 && u[3] === 0x04;

function cdName(cd: string) {
  const star = cd.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/);
  if (star) { try { return decodeURIComponent(star[1].trim()); } catch { /* 아래로 */ } }
  return cd.match(/filename\s*=\s*"?([^";]+)"?/)?.[1]?.trim() || '';
}

type Got = { bytes?: Uint8Array; name?: string; error?: string; size?: number };
async function download(url: string, limit: number): Promise<Got> {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow', signal: AbortSignal.timeout(120_000) });
  const len = Number(r.headers.get('content-length') || 0);
  // 네이버는 파일이면 content-type 을 'doesn/matter' 로 준다 — text/html 이면 기한 지남 · 오류 페이지
  if (!r.ok || /^text\/html/i.test(r.headers.get('content-type') || '')) { await r.body?.cancel(); return { error: r.ok ? 'expired' : 'http ' + r.status, size: len }; }
  if (len > limit) { await r.body?.cancel(); return { error: 'too big', size: len }; }
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length > limit) return { error: 'too big', size: bytes.length };
  return { bytes, name: cdName(r.headers.get('content-disposition') || '') };
}

async function put(id: number, bytes: Uint8Array, ext: string, mime: string) {
  const path = `${id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: mime });
  if (error) throw new Error(error.message);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function addFile(a: { id: number; photos: any[] }, f: Record<string, unknown>) {
  const { data, error } = await sb.rpc('model_applicant_add_file', { p_id: a.id, p_file: f });
  if (error) throw new Error(error.message);
  if (data === true) a.photos.push(f);
  return data === true;
}

async function importBig(a: { id: number; photos: any[] }, links: Big[]) {
  a.photos = Array.isArray(a.photos) ? a.photos : [];
  const sum = { found: links.length, added: 0, linked: 0, skipped: 0, errors: [] as string[] };
  const have = (name: string, size: number | null) => !!name && a.photos.some((x) => x.name === name && (size == null || Number(x.size) === size));
  const linkOnly = async (b: Big, name: string, size: number | null, mime = '') => {
    if (await addFile(a, { url: b.url, name: name || '대용량 첨부', size, mime, image: false, link: true, until: b.until, from: 'naver' })) sum.linked++;
    else sum.skipped++;
  };
  for (const b of links) {
    try {
      if (have(b.name, b.size)) { sum.skipped++; continue; }
      const zipByName = /\.zip$/i.test(b.name);
      const limit = zipByName ? MAX_ZIP : MAX_FILE;
      if (b.size && b.size > limit) { await linkOnly(b, b.name, b.size); continue; }
      const d = await download(b.url, zipByName || !b.name ? MAX_ZIP : limit);
      if (!d.bytes) {
        if (d.error === 'too big') await linkOnly(b, b.name, d.size || b.size);
        else sum.errors.push(`${b.name || 'file'}: ${d.error}`);
        continue;
      }
      const bytes = d.bytes;
      const name = (b.name || d.name || 'file').slice(0, 120);
      const size = b.size || bytes.length;
      if (!b.name && have(name, size)) { sum.skipped++; continue; }
      // zip = 이름이 .zip, 또는 이름에 확장자가 없는데 내용이 zip (pptx · docx · hwpx 도 속은 zip 이라 이름으로 가름)
      if (zipByName || /\.zip$/i.test(name) || (!/\.[A-Za-z0-9]{1,5}$/.test(name) && isZipBytes(bytes))) {
        // zip — 안의 사진만 풀어 넣고, zip 자체는 링크로 (통째로 받고 싶을 때)
        const stem = name.replace(/\.zip$/i, '');
        const files = unzipSync(bytes, {
          filter: (f) => !/(^|\/)(__MACOSX|\.)/.test(f.name) && IMG_EXT.test(f.name) && f.originalSize >= MIN_IMAGE && f.originalSize <= MAX_FILE,
        });
        let i = 0;
        for (const [path, data] of Object.entries(files)) {
          if (i >= MAX_ZIP_IMAGES) break;
          const sn = sniff(data);
          if (!sn) continue;
          i++;
          const base = path.split('/').pop() || '';
          // 윈도우에서 만든 zip 은 한글 이름이 깨져 나옴 → 영문 이름만 그대로, 아니면 'zip이름 n'
          const nm = (/^[\x20-\x7E]+$/.test(base) ? base : `${stem} ${i}.${sn.ext}`).slice(0, 120);
          if (have(nm, data.length)) { sum.skipped++; continue; }
          const url = await put(a.id, data, sn.ext, sn.mime);
          if (await addFile(a, { url, name: nm, mime: sn.mime, size: data.length, image: true, from: 'naver-zip', zip: name })) sum.added++;
          else sum.skipped++;
        }
        await linkOnly(b, name, size, 'application/zip');
        continue;
      }
      const sn = sniff(bytes);
      if (sn && bytes.length < MIN_IMAGE) { sum.skipped++; continue; }
      if (bytes.length > MAX_FILE) { await linkOnly(b, name, size); continue; }
      const ext = sn?.ext || (name.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] || 'bin').toLowerCase();
      const mime = sn?.mime || EXT_MIME[ext] || 'application/octet-stream';
      const url = await put(a.id, bytes, ext, mime);
      if (await addFile(a, { url, name, mime, size, image: !!sn, from: 'naver', until: null })) sum.added++;
      else sum.skipped++;
    } catch (e) {
      sum.errors.push(`${b.name || 'file'}: ${(e as Error)?.message || e}`);
    }
  }
  return sum;
}

function inBackground(id: number, job: Promise<unknown>) {
  const done = job
    .then((s) => console.log('model-apply big', id, JSON.stringify(s)))
    .catch((e) => console.error('model-apply big fail', id, (e as Error)?.message || e));
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(done);
}

/* ---------- 요청 ---------- */
let cachedKey = '';
async function checkKey(k: string) {
  if (!cachedKey) {
    const { data } = await sb.from('private_kv').select('value').eq('key', 'model_apply_key').single();
    cachedKey = data?.value || '';
  }
  return !!cachedKey && k === cachedKey;
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true, name: 'model-apply' });
  let p: any;
  try { p = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!(await checkKey(String(p.key || '')))) return json({ error: 'key' }, 401);

  if (p.action === 'apply') {
    const m = p.msg || {};
    if (!m.id) return json({ error: 'no id' }, 400);
    const body = String(m.body || '').slice(0, 20000);
    const links = bigLinks(body + '\n' + String(m.html || ''));
    const { data: ex } = await sb.from('model_applicants').select('id, photos').eq('gmail_id', m.id).maybeSingle();
    if (ex) {
      if (links.length) inBackground(ex.id, importBig(ex, links));
      return json({ id: ex.id, isNew: false, big: links.length });
    }
    const f = parseFields(body, m.fromName || '');
    const row = {
      gmail_id: m.id, thread_id: m.threadId || null,
      received_at: m.date || new Date().toISOString(),
      from_name: m.fromName || null, from_email: m.fromEmail || null,
      subject: String(m.subject || '').slice(0, 300), body, ...f,
    };
    const { data, error } = await sb.from('model_applicants').insert(row).select('id').single();
    if (error) return json({ error: error.message }, 500);
    if (links.length) inBackground(data.id, importBig({ id: data.id, photos: [] }, links));
    return json({ id: data.id, isNew: true, big: links.length });
  }

  if (p.action === 'file') {
    const { data: a } = await sb.from('model_applicants').select('id, photos').eq('gmail_id', p.gmailId).maybeSingle();
    if (!a) return json({ error: 'no applicant' }, 404);
    const name = String(p.name || 'file').slice(0, 120);
    const photos: any[] = Array.isArray(a.photos) ? a.photos : [];
    if (photos.some((x) => x.name === name && x.size === p.size)) return json({ ok: true, dup: true });
    const ext = (name.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] || 'bin').toLowerCase();
    const bytes = b64ToBytes(String(p.b64 || ''));
    const isImage = /^image\//.test(p.mime || '') || /\.(jpe?g|png|gif|webp|heic)$/i.test(name);
    try {
      const url = await put(a.id, bytes, ext, p.mime || 'application/octet-stream');
      await addFile({ id: a.id, photos }, { url, name, mime: p.mime || '', size: p.size || bytes.length, image: isImage });
      return json({ ok: true, url });
    } catch (e) {
      return json({ error: (e as Error)?.message || String(e) }, 500);
    }
  }

  if (p.action === 'big') {
    let q = sb.from('model_applicants').select('id, body, photos');
    q = p.id ? q.eq('id', p.id) : q.eq('gmail_id', String(p.gmailId || ''));
    const { data: a } = await q.maybeSingle();
    if (!a) return json({ error: 'no applicant' }, 404);
    const links = bigLinks(String(a.body || '') + '\n' + String(p.html || ''));
    if (!links.length) return json({ ok: true, found: 0 });
    if (p.wait) return json({ ok: true, ...(await importBig(a, links)) });
    inBackground(a.id, importBig(a, links));
    return json({ ok: true, found: links.length, queued: true });
  }

  if (p.action === 'reparse') {
    const { data } = await sb.from('model_applicants').select('id, body, from_name').is('deleted_at', null);
    let n = 0;
    for (const r of data || []) {
      const f = parseFields(r.body || '', r.from_name || '');
      const upd: Record<string, string | null> = {};
      for (const k of Object.keys(FIELDS)) upd[k] = f[k] || null;
      await sb.from('model_applicants').update(upd).eq('id', r.id);
      n++;
    }
    return json({ ok: true, n });
  }

  return json({ error: 'action' }, 400);
});
