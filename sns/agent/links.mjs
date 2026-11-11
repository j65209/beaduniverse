// 꿀꿀집 카드뉴스 — 카드에 넣은 딜로 '꿀꿀집 링크 모음' 페이지에 보낼 links.json 만들기 (Node 18+, 의존성 없음)
//
//   node links.mjs --cards cards.json --deals deals.json [--photos photos.json] --out links.json
//
// cards.json 의 deals[].ref("fs:210373109")로 deals.json 의 판매처 주소를 찾는다.
// 받는 곳 규칙(카드뉴스 자동 업로드 에이전트 세션, 2026-11-11): url 은 판매처 원래 주소 — 어미새 · 남의 제휴 링크 · 단축 링크는 안 됨,
// image_url 은 https 이고 사이트가 허용한 사진만(= photos.mjs 가 판매처에서 받은 대표 이미지), 정가 · 판매가는 확인된 숫자만(할인율은 페이지가 계산).
// 주소를 못 쓰는 딜은 링크에서 뺀다 (카드에는 그대로 있음).

import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? '1' : all[i + 1]]] : a), []),
);

// 템플릿과 같은 가격 읽기 — '62,900원' · '10.1만원' → 숫자, '18,000원~' 처럼 애매하면 null
function won(s) {
  s = String(s || '').replace(/정가|판매가|\s/g, '');
  if (!s || /[~～]|부터|최대|%/.test(s)) return null;
  let m = s.match(/^([\d,.]+)만(\d{1,4})?원?$/);
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 10000) + (m[2] ? Number(m[2]) : 0);
  m = s.match(/^([\d,]+)원?$/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

// 제휴 · 단축 링크 (남의 수수료가 붙거나 어디로 가는지 모르는 주소)
const BAD_HOSTS = /(^|\.)(link\.coupang\.com|coupa\.ng|onelink\.me|bit\.ly|naver\.me|me2\.do|han\.gl|url\.kr|vo\.la|t\.ly|tinyurl\.com|a\.co|amzn\.to|s\.click\.aliexpress\.com|click\.linkprice\.com|linkprice\.com|ader\.naver\.com)$/i;
const BAD_PARAMS = /[?&](lptag|subid|sub_id|affiliate|aff_id|aff_sub|pid|trackingcode|utm_medium=affiliate)=/i;
// 제휴 중계 주소(linkprice 등)는 안에 든 판매처 주소(tu · url · target)를 꺼내고 추적용 꼬리(?…)를 뗀다 — 아무의 수수료도 안 붙는 원래 주소
function unwrap(u) {
  try {
    const x = new URL(u);
    if (/(^|\.)linkprice\.com$|(^|\.)ader\.naver\.com$/i.test(x.hostname)) {
      const t = x.searchParams.get('tu') ?? x.searchParams.get('url') ?? x.searchParams.get('target');
      if (t && /^https?:\/\//i.test(t)) { const y = new URL(t); return y.origin + y.pathname; }
    }
  } catch { /* 그대로 */ }
  return u;
}
function directUrl(u) {
  if (/\.\.\.|…/.test(String(u ?? ''))) return null; // 화면에 줄여 보인 주소(…)는 실제 주소가 아님
  u = unwrap(u);
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return null;
    if (x.pathname === '/' || x.pathname === '') return null;          // 'https://www.coupang.com' 처럼 상품 주소가 없음
    if (BAD_HOSTS.test(x.hostname) || /^al\./i.test(x.hostname)) return null; // al.wconcept.co.kr 같은 제휴 단축 주소
    if (/eomisae\.co\.kr$/i.test(x.hostname)) return null;
    if (BAD_PARAMS.test(x.search)) return null;
    return x.href;
  } catch { return null; }
}
const LABEL = (tag) => (/HOT/i.test(tag) ? 'HOT' : /NEW/i.test(tag) ? 'NEW' : /긴급/.test(tag) ? '긴급' : undefined);

function main() {
  if (!args.cards || !args.deals || !args.out) { console.error('쓰는 법: node links.mjs --cards cards.json --deals deals.json [--photos photos.json] --out links.json'); process.exit(1); }
  const cards = JSON.parse(fs.readFileSync(args.cards, 'utf8'));
  const items = JSON.parse(fs.readFileSync(args.deals, 'utf8')).items ?? [];
  const photos = args.photos && fs.existsSync(args.photos) ? JSON.parse(fs.readFileSync(args.photos, 'utf8')) : {};
  const links = [], skipped = [];
  for (const d of cards.deals ?? []) {
    const name = String(d.name ?? '').replace(/==/g, '');
    const title = (d.brand && !name.replace(/\s/g, '').toLowerCase().includes(d.brand.replace(/\s/g, '').toLowerCase()) ? d.brand + ' ' : '') + name;
    const [board, id] = String(d.ref ?? '').split(':');
    const item = items.find((x) => x.board === board && x.id === id);
    if (!item) { skipped.push(`${title}: ref 없음`); continue; }
    const url = directUrl(item.store_url);
    if (!url) { skipped.push(`${title}: 판매처 원래 주소 없음 (${item.store_url ?? '-'})`); continue; }
    const p = photos[d.ref];
    const price = won(d.price), original = won(d.was);
    links.push({
      title,
      url,
      ...(price ? { price } : {}),
      ...(original && price && original > price ? { original_price: original } : {}),
      ...(p?.ok && /^https:\/\//.test(p.src ?? '') ? { image_url: p.src } : {}),
      ...(LABEL(d.tag ?? '') ? { label: LABEL(d.tag) } : {}),
      note: [d.nowLabel, d.store].filter(Boolean).join(' · ') || undefined,
    });
  }
  const t = Date.parse(cards.asOf ?? '');
  const k = Number.isFinite(t) ? new Date(t + 9 * 3_600_000) : null;
  const out = {
    title: String(cards.cover?.title ?? '오늘의 꿀딜').replace(/==/g, '').replace(/\n/g, ' '),
    ...(k ? { subtitle: `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${k.getUTCHours() < 12 ? '오전' : '오후'} ${((k.getUTCHours() + 11) % 12) + 1}시${k.getUTCMinutes() ? ` ${k.getUTCMinutes()}분` : ''} 기준`, as_of: new Date(t).toISOString() } : {}),
    links,
  };
  fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
  console.error(`링크 ${links.length}개${skipped.length ? ` · 뺀 것 ${skipped.length}: ${skipped.join(' / ')}` : ''}`);
}

main();
