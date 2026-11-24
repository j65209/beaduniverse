// 회의록 링크 미리보기 (meeting/, 2026-11-24 사장님 "뭐든 마우스오버 기능") — 인스타가 아닌 주소에 마우스를 올리면 보여 줄 제목 · 설명 · 대표 이미지.
// GET ?u=주소 → {ok, title, desc, image, site, url}. 읽기만, 저장 없음(브라우저가 하루 기억). 화면의 공개 열쇠가 있어야 부를 수 있다(verify_jwt).
// 바깥 공개 주소만: http(s) · 기본 포트 · 점 있는 이름 · 숫자 주소와 안쪽 이름(.local · .internal 등)은 거절, 옮겨 가는 주소도 매번 다시 검사.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MAX_HTML = 700 * 1024;

function json(b: unknown, status = 200, age = 0) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': age ? `private, max-age=${age}` : 'no-store' },
  });
}
function safe(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!h.includes('.') || h.includes(':') || /^[\d.]+$/.test(h) || /^0x/.test(h)) return null;
  if (/(^|\.)(local|localhost|internal|intranet|lan|home|corp|test|invalid|example|arpa|onion)$/.test(h)) return null;
  if (/(^|\.)(nip\.io|sslip\.io|xip\.io|localtest\.me|lvh\.me)$/.test(h)) return null;
  return u;
}
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const unent = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return m; } }
    return ENT[e.toLowerCase()] ?? m;
  });
const clean = (s: string | null | undefined, n: number) => (s ? unent(s).replace(/\s+/g, ' ').trim().slice(0, n) : '');
function metas(html: string) {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const t = m[0];
    const k = /\b(?:property|name|itemprop)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(t);
    const v = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(t);
    if (!k || !v) continue;
    const key = (k[1] ?? k[2] ?? k[3] ?? '').toLowerCase(), val = v[1] ?? v[2] ?? v[3] ?? '';
    if (key && val && !(key in out)) out[key] = val;
  }
  return out;
}
async function readSome(r: Response): Promise<Uint8Array> {
  const rd = r.body?.getReader();
  if (!rd) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let n = 0;
  while (n < MAX_HTML) {
    const { done, value } = await rd.read();
    if (done) break;
    parts.push(value); n += value.length;
  }
  rd.cancel().catch(() => {});
  const b = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { b.set(p, o); o += p.length; }
  return b;
}
function decode(b: Uint8Array, ct: string) {
  let cs = /charset=["']?([\w-]+)/i.exec(ct)?.[1] || '';
  if (!cs) cs = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(b.subarray(0, 4096)))?.[1] || '';
  if (/^(euc-kr|ks_c_5601|ksc5601|cp949|ms949|x-windows-949)/i.test(cs)) cs = 'euc-kr';
  try { return new TextDecoder(cs || 'utf-8').decode(b); } catch { return new TextDecoder().decode(b); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return json({ ok: false, error: 'GET 만 돼요' }, 405);
  const raw = new URL(req.url).searchParams.get('u') || '';
  let u = raw.length <= 2000 ? safe(raw) : null;
  if (!u) return json({ ok: false, error: '볼 수 없는 주소예요' }, 400);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    let r: Response | null = null;
    for (let i = 0; i < 5; i++) {
      r = await fetch(u.href, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.5', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.6' } });
      const loc = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null;
      if (!loc) break;
      r.body?.cancel().catch(() => {});
      const n = safe(new URL(loc, u).href);
      if (!n) return json({ ok: false, error: '볼 수 없는 주소로 넘어가요' }, 200);
      u = n; r = null;
    }
    if (!r) return json({ ok: false, error: '여러 번 넘어가는 주소예요' }, 200);
    const ct = r.headers.get('content-type') || '';
    const site = u.hostname.replace(/^www\./, '');
    if (/^image\//i.test(ct)) { r.body?.cancel().catch(() => {}); return json({ ok: true, title: '', desc: '', image: u.href, site, url: u.href }, 200, 86400); }
    if (!r.ok) { r.body?.cancel().catch(() => {}); return json({ ok: false, error: '그 사이트가 막았어요 (' + r.status + ')', site }, 200); }
    if (!/html|xml/i.test(ct)) { r.body?.cancel().catch(() => {}); return json({ ok: true, title: decodeURIComponent(u.pathname.split('/').pop() || site), desc: ct.split(';')[0], image: '', site, url: u.href }, 200, 3600); }
    const html = decode(await readSome(r), ct), m = metas(html);
    const title = clean(m['og:title'] || m['twitter:title'] || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1], 160);
    const desc = clean(m['og:description'] || m['twitter:description'] || m['description'], 260);
    let image = unent(m['og:image:secure_url'] || m['og:image'] || m['og:image:url'] || m['twitter:image'] || m['twitter:image:src'] || m['image'] || '').trim();
    if (image) { try { image = new URL(image, u).href; if (!/^https?:/.test(image)) image = ''; } catch { image = ''; } }
    image = image.replace(/^http:/, 'https:');
    return json({ ok: !!(title || image), title, desc, image, site: clean(m['og:site_name'], 60) || site, url: u.href }, 200, 86400);
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.name === 'AbortError' ? '그 사이트가 늦어요' : '그 사이트를 못 읽었어요' }, 200);
  } finally {
    clearTimeout(timer);
  }
});
