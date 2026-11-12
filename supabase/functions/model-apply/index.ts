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
//   POST {action:'apply', key, msg:{id, threadId, date, fromName, fromEmail, subject, body}}  → {id, isNew}
//   POST {action:'file',  key, gmailId, name, mime, b64}                                       → {ok, url}
//   POST {action:'reparse', key}   본문에서 이름 · 키 등을 다시 뽑기 (뽑는 규칙을 고친 뒤)

import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const BUCKET = 'model-applicants';

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
    const { data: ex } = await sb.from('model_applicants').select('id').eq('gmail_id', m.id).maybeSingle();
    if (ex) return json({ id: ex.id, isNew: false });
    const body = String(m.body || '').slice(0, 20000);
    const f = parseFields(body, m.fromName || '');
    const row = {
      gmail_id: m.id, thread_id: m.threadId || null,
      received_at: m.date || new Date().toISOString(),
      from_name: m.fromName || null, from_email: m.fromEmail || null,
      subject: String(m.subject || '').slice(0, 300), body, ...f,
    };
    const { data, error } = await sb.from('model_applicants').insert(row).select('id').single();
    if (error) return json({ error: error.message }, 500);
    return json({ id: data.id, isNew: true });
  }

  if (p.action === 'file') {
    const { data: a } = await sb.from('model_applicants').select('id, photos').eq('gmail_id', p.gmailId).maybeSingle();
    if (!a) return json({ error: 'no applicant' }, 404);
    const name = String(p.name || 'file').slice(0, 120);
    const photos: any[] = Array.isArray(a.photos) ? a.photos : [];
    if (photos.some((x) => x.name === name && x.size === p.size)) return json({ ok: true, dup: true });
    const ext = (name.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] || 'bin').toLowerCase();
    const path = `${a.id}/${crypto.randomUUID()}.${ext}`;
    const bytes = b64ToBytes(String(p.b64 || ''));
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: p.mime || 'application/octet-stream' });
    if (error) return json({ error: error.message }, 500);
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const isImage = /^image\//.test(p.mime || '') || /\.(jpe?g|png|gif|webp|heic)$/i.test(name);
    photos.push({ url, name, mime: p.mime || '', size: p.size || bytes.length, image: isImage });
    await sb.from('model_applicants').update({ photos, updated_at: new Date().toISOString() }).eq('id', a.id);
    return json({ ok: true, url });
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
