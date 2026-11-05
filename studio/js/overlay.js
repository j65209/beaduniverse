/* =========================================================================
   지면 시뮬레이션 — 릴스·스토리 UI 가림 영역 + 안전영역
   메타 권장 안전영역 (1080×1920 기준)
     · 릴스: 상단 14%(269px) · 하단 35%(672px) · 좌우 6%(65px) + 우측 하단 아이콘 줄
     · 스토리: 상단 14%(269px) · 하단 약 20%(CTA 버튼)
   오버레이는 편집 화면에만 그려지고, 내보낸 이미지에는 들어가지 않는다.
   ========================================================================= */
import { W, H, rgba, clamp } from './core.js';
import { aabb } from './render.js';

export const PLACEMENTS = [
  { id: 'common', name: '릴스 + 스토리 공통 (가장 안전)', short: '공통', safe: { t: 269, b: 672, l: 65, r: 65 }, rail: true, ui: 'reels-ig' },
  { id: 'ig-reels', name: '인스타그램 릴스', short: 'IG 릴스', safe: { t: 269, b: 672, l: 65, r: 65 }, rail: true, ui: 'reels-ig' },
  { id: 'ig-story', name: '인스타그램 스토리', short: 'IG 스토리', safe: { t: 269, b: 384, l: 65, r: 65 }, rail: false, ui: 'story-ig' },
  { id: 'fb-reels', name: '페이스북 릴스', short: 'FB 릴스', safe: { t: 269, b: 672, l: 65, r: 65 }, rail: true, ui: 'reels-fb' },
  { id: 'fb-story', name: '페이스북 스토리', short: 'FB 스토리', safe: { t: 269, b: 250, l: 0, r: 0 }, rail: false, ui: 'story-fb' },
];

const RAIL = { x: 900, y: 1120 }; // 릴스 우측 아이콘 줄(좋아요·댓글·공유) 시작점

export function placementOf(id) { return PLACEMENTS.find((p) => p.id === id) || PLACEMENTS[0]; }
export function safeRect(id) {
  const s = placementOf(id).safe;
  return { x: s.l, y: s.t, w: W - s.l - s.r, h: H - s.t - s.b, x2: W - s.r, y2: H - s.b };
}
/** 서로 겹치지 않는 가림 영역 사각형들 */
export function unsafeRects(id) {
  const P = placementOf(id);
  const s = P.safe;
  const out = [];
  if (s.t) out.push({ x: 0, y: 0, w: W, h: s.t, kind: 'top' });
  if (s.b) out.push({ x: 0, y: H - s.b, w: W, h: s.b, kind: 'bottom' });
  if (s.l) out.push({ x: 0, y: s.t, w: s.l, h: H - s.t - s.b, kind: 'side' });
  if (s.r) out.push({ x: W - s.r, y: s.t, w: s.r, h: H - s.t - s.b, kind: 'side' });
  if (P.rail && RAIL.y < H - s.b) out.push({ x: RAIL.x, y: RAIL.y, w: W - s.r - RAIL.x, h: H - s.b - RAIL.y, kind: 'rail' });
  return out;
}

const overlap = (a, b) => Math.min(a.x2, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y2, b.y + b.h) - Math.max(a.y, b.y) > 1;

/** 검사 대상: 텍스트 + '안전영역 검사' 켠 이미지·도형 */
export function isChecked(L) {
  if (L.hidden) return false;
  if (L.type === 'text') return L.checkSafe !== false && !!String(L.text || '').trim();
  return !!L.checkSafe;
}
export function findViolations(page, id) {
  if (!page) return [];
  const rects = unsafeRects(id);
  const out = [];
  for (const L of page.layers) {
    if (!isChecked(L)) continue;
    const b = aabb(L);
    if (rects.some((r) => overlap(b, r))) out.push(L.id);
  }
  return out;
}

/* ---------- 안전영역 그리기 ---------- */
let hatch = null;
function hatchPattern(ctx) {
  if (!hatch) {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 24;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(239,68,68,0.55)';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(-6, 30); x.lineTo(30, -6);
    x.moveTo(-6, 6); x.lineTo(6, -6);
    x.moveTo(18, 30); x.lineTo(30, 18);
    x.stroke();
    hatch = c;
  }
  return ctx.createPattern(hatch, 'repeat');
}

const ZONE_LABEL = {
  top: '상단 14% · 프로필·상단 바',
  bottom: '하단 · 브랜드명·캡션·CTA 버튼',
};

export function drawSafeZones(ctx, id, z) {
  const r = safeRect(id);
  const P = placementOf(id);
  ctx.save();
  const pat = hatchPattern(ctx);
  for (const u of unsafeRects(id)) {
    ctx.fillStyle = 'rgba(239,68,68,0.10)';
    ctx.fillRect(u.x, u.y, u.w, u.h);
    ctx.fillStyle = pat;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(u.x, u.y, u.w, u.h);
    ctx.globalAlpha = 1;
  }
  ctx.setLineDash([6 / z, 4 / z]);
  ctx.lineWidth = 1.5 / z;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
  ctx.lineWidth = 1 / z;
  ctx.strokeStyle = 'rgba(239,68,68,0.9)';
  ctx.strokeRect(r.x - 1 / z, r.y - 1 / z, r.w + 2 / z, r.h + 2 / z);
  // 라벨
  const fs = 11 / z;
  ctx.font = `700 ${fs}px "Pretendard", sans-serif`;
  ctx.textBaseline = 'middle';
  const tag = (text, x, y, align = 'left') => {
    ctx.textAlign = align;
    const w = ctx.measureText(text).width + 10 / z;
    const bx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    ctx.fillStyle = 'rgba(185,28,28,0.92)';
    ctx.beginPath();
    ctx.rect(bx, y - fs * 0.85, w, fs * 1.7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, align === 'left' ? x + 5 / z : align === 'right' ? x - 5 / z : x, y);
  };
  const s = P.safe;
  if (s.t) tag(`${ZONE_LABEL.top} (${s.t}px)`, W / 2, s.t - 14 / z, 'center');
  const bottomLabel = P.ui.startsWith('story') ? '하단 · CTA 버튼' : ZONE_LABEL.bottom;
  if (s.b) tag(`${bottomLabel} (${s.b}px · ${Math.round(s.b / H * 100)}%)`, r.x + 6 / z, H - s.b + 14 / z);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'right';
  ctx.font = `600 ${fs}px "Pretendard", sans-serif`;
  ctx.fillText(`안전영역 ${Math.round(r.w)}×${Math.round(r.h)}`, r.x2 - 6 / z, r.y + 12 / z);
  ctx.restore();
}

/* ---------- 목업 UI ---------- */
const WHITE = '#ffffff';

function txt(ctx, t, x, y, { size = 34, weight = 600, align = 'left', color = WHITE, maxW = 0 } = {}) {
  ctx.font = `${weight} ${size}px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  let s = String(t);
  if (maxW && ctx.measureText(s).width > maxW) {
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    s += '…';
  }
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}
function strokeStyle(ctx, w = 5.5, color = WHITE) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}

function iconHeart(ctx, x, y, s) {
  strokeStyle(ctx);
  const k = s / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + k * 0.82);
  ctx.bezierCurveTo(x - k * 1.25, y - k * 0.05, x - k * 0.95, y - k * 1.05, x - k * 0.48, y - k * 0.98);
  ctx.bezierCurveTo(x - k * 0.2, y - k * 0.95, x - k * 0.05, y - k * 0.7, x, y - k * 0.5);
  ctx.bezierCurveTo(x + k * 0.05, y - k * 0.7, x + k * 0.2, y - k * 0.95, x + k * 0.48, y - k * 0.98);
  ctx.bezierCurveTo(x + k * 0.95, y - k * 1.05, x + k * 1.25, y - k * 0.05, x, y + k * 0.82);
  ctx.closePath();
  ctx.stroke();
}
function iconComment(ctx, x, y, s) {
  strokeStyle(ctx);
  const r = s * 0.44;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 0.72, Math.PI * 2.62);
  ctx.lineTo(x + r * 0.95, y + r * 1.02);
  ctx.closePath();
  ctx.stroke();
}
function iconSend(ctx, x, y, s) {
  strokeStyle(ctx);
  const k = s * 0.48;
  ctx.beginPath();
  ctx.moveTo(x - k, y - k * 0.82);
  ctx.lineTo(x + k, y - k * 0.82);
  ctx.lineTo(x - k * 0.05, y + k);
  ctx.lineTo(x - k * 0.22, y - k * 0.1);
  ctx.closePath();
  ctx.moveTo(x - k * 0.22, y - k * 0.1);
  ctx.lineTo(x + k, y - k * 0.82);
  ctx.stroke();
}
function iconShare(ctx, x, y, s) {
  strokeStyle(ctx);
  const k = s * 0.46;
  ctx.beginPath();
  ctx.moveTo(x + k, y - k * 0.1);
  ctx.lineTo(x + k * 0.1, y - k * 0.85);
  ctx.lineTo(x + k * 0.1, y - k * 0.4);
  ctx.quadraticCurveTo(x - k, y - k * 0.3, x - k, y + k * 0.8);
  ctx.quadraticCurveTo(x - k * 0.5, y + k * 0.1, x + k * 0.1, y + k * 0.15);
  ctx.lineTo(x + k * 0.1, y + k * 0.62);
  ctx.closePath();
  ctx.stroke();
}
function iconThumb(ctx, x, y, s) {
  strokeStyle(ctx);
  const k = s * 0.46;
  ctx.beginPath();
  ctx.rect(x - k, y - k * 0.1, k * 0.38, k * 0.95);
  ctx.moveTo(x - k * 0.55, y - k * 0.1);
  ctx.lineTo(x - k * 0.12, y - k * 0.95);
  ctx.quadraticCurveTo(x + k * 0.2, y - k * 0.95, x + k * 0.12, y - k * 0.45);
  ctx.lineTo(x + k * 0.05, y - k * 0.2);
  ctx.lineTo(x + k * 0.82, y - k * 0.2);
  ctx.quadraticCurveTo(x + k * 1.05, y - k * 0.12, x + k * 0.95, y + k * 0.15);
  ctx.lineTo(x + k * 0.72, y + k * 0.8);
  ctx.lineTo(x - k * 0.55, y + k * 0.85);
  ctx.stroke();
}
function iconDots(ctx, x, y, s, vertical = false) {
  ctx.fillStyle = WHITE;
  const g = s * 0.3;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(vertical ? x : x + i * g, vertical ? y + i * g : y, s * 0.075, 0, Math.PI * 2);
    ctx.fill();
  }
}
function iconCamera(ctx, x, y, s) {
  strokeStyle(ctx, 5);
  const w = s, h = s * 0.74;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 10, y - h / 2);
  ctx.lineTo(x - w * 0.18, y - h / 2);
  ctx.lineTo(x - w * 0.1, y - h / 2 - s * 0.1);
  ctx.lineTo(x + w * 0.1, y - h / 2 - s * 0.1);
  ctx.lineTo(x + w * 0.18, y - h / 2);
  ctx.lineTo(x + w / 2 - 10, y - h / 2);
  ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + 10, 10);
  ctx.lineTo(x + w / 2, y + h / 2 - 10);
  ctx.arcTo(x + w / 2, y + h / 2, x + w / 2 - 10, y + h / 2, 10);
  ctx.lineTo(x - w / 2 + 10, y + h / 2);
  ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - 10, 10);
  ctx.lineTo(x - w / 2, y - h / 2 + 10);
  ctx.arcTo(x - w / 2, y - h / 2, x - w / 2 + 10, y - h / 2, 10);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y + s * 0.02, s * 0.2, 0, Math.PI * 2); ctx.stroke();
}
function iconClose(ctx, x, y, s) {
  strokeStyle(ctx, 5.5);
  const k = s * 0.36;
  ctx.beginPath();
  ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k);
  ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k);
  ctx.stroke();
}
function chevron(ctx, x, y, s, dir = 'right', w = 5.5) {
  strokeStyle(ctx, w);
  const k = s * 0.32;
  ctx.beginPath();
  if (dir === 'right') { ctx.moveTo(x - k * 0.5, y - k); ctx.lineTo(x + k * 0.5, y); ctx.lineTo(x - k * 0.5, y + k); }
  else if (dir === 'left') { ctx.moveTo(x + k * 0.5, y - k); ctx.lineTo(x - k * 0.5, y); ctx.lineTo(x + k * 0.5, y + k); }
  else { ctx.moveTo(x - k, y + k * 0.5); ctx.lineTo(x, y - k * 0.5); ctx.lineTo(x + k, y + k * 0.5); }
  ctx.stroke();
}
function avatar(ctx, x, y, r, env) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  if (env.avatarImg) {
    ctx.save();
    ctx.clip();
    const im = env.avatarImg;
    const s = Math.max((2 * r) / im.naturalWidth, (2 * r) / im.naturalHeight);
    ctx.drawImage(im, x - im.naturalWidth * s / 2, y - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
    ctx.restore();
  } else {
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, env.settings.avatarColor || '#ff2e93');
    g.addColorStop(1, '#ff6b35');
    ctx.fillStyle = g;
    ctx.fill();
    const name = String(env.settings.account || 'B');
    txt(ctx, Array.from(name)[0].toUpperCase(), x, y + r * 0.36, { size: r * 1.05, weight: 800, align: 'center' });
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  ctx.restore();
}
function statusBar(ctx) {
  txt(ctx, '9:41', 92, 84, { size: 42, weight: 700 });
  ctx.fillStyle = WHITE;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.rect(842 + i * 14, 80 - (10 + i * 7), 9, 10 + i * 7); ctx.fill(); }
  strokeStyle(ctx, 4.5);
  ctx.beginPath(); ctx.arc(924, 84, 26, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke();
  ctx.beginPath(); ctx.arc(924, 84, 15, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke();
  ctx.beginPath(); ctx.arc(924, 82, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.rect(962, 60, 54, 26); ctx.stroke();
  ctx.beginPath(); ctx.rect(967, 65, 38, 16); ctx.fill();
  ctx.beginPath(); ctx.rect(1018, 68, 5, 10); ctx.fill();
}
function bottomScrim(ctx, y0) {
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, H - y0);
}
function igNav(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.93)';
  ctx.fillRect(0, 1776, W, H - 1776);
  const y = 1842, xs = [108, 324, 540, 756, 972];
  strokeStyle(ctx, 5);
  // 홈
  ctx.beginPath(); ctx.moveTo(xs[0] - 26, y - 4); ctx.lineTo(xs[0], y - 28); ctx.lineTo(xs[0] + 26, y - 4); ctx.lineTo(xs[0] + 26, y + 26); ctx.lineTo(xs[0] - 26, y + 26); ctx.closePath(); ctx.stroke();
  // 검색
  ctx.beginPath(); ctx.arc(xs[1] - 4, y - 4, 22, 0, Math.PI * 2); ctx.moveTo(xs[1] + 12, y + 12); ctx.lineTo(xs[1] + 28, y + 28); ctx.stroke();
  // 만들기
  ctx.beginPath(); ctx.rect(xs[2] - 27, y - 27, 54, 54); ctx.moveTo(xs[2], y - 13); ctx.lineTo(xs[2], y + 13); ctx.moveTo(xs[2] - 13, y); ctx.lineTo(xs[2] + 13, y); ctx.stroke();
  // 릴스 (선택됨)
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.rect(xs[3] - 27, y - 27, 54, 54); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.moveTo(xs[3] - 7, y - 4); ctx.lineTo(xs[3] + 11, y + 8); ctx.lineTo(xs[3] - 7, y + 19); ctx.closePath(); ctx.fill();
  // 프로필
  ctx.beginPath(); ctx.arc(xs[4], y, 26, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
}
function rail(ctx, items) {
  const x = 1006;
  for (const it of items) {
    it.icon(ctx, x, it.y, 64);
    if (it.label) txt(ctx, it.label, x, it.y + 66, { size: 28, weight: 600, align: 'center' });
  }
}
function ctaBar(ctx, y, h, label, { radius = 18, fill = 'rgba(255,255,255,0.2)' } = {}) {
  ctx.beginPath();
  const x = 32, w = W - 64;
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  txt(ctx, label, x + 34, y + h / 2 + 13, { size: 36, weight: 700 });
  chevron(ctx, x + w - 40, y + h / 2, 40);
}
function pillCta(ctx, cy, label) {
  ctx.font = '700 34px "Pretendard", sans-serif';
  const w = Math.max(320, ctx.measureText(label).width + 140);
  const h = 92, x = W / 2 - w / 2, y = cy - h / 2;
  chevron(ctx, W / 2, y - 34, 40, 'up', 5);
  ctx.beginPath();
  ctx.moveTo(x + h / 2, y);
  ctx.arcTo(x + w, y, x + w, y + h, h / 2);
  ctx.arcTo(x + w, y + h, x, y + h, h / 2);
  ctx.arcTo(x, y + h, x, y, h / 2);
  ctx.arcTo(x, y, x + w, y, h / 2);
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();
  // 링크 아이콘
  ctx.save();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  const lx = x + 52, ly = cy;
  ctx.beginPath(); ctx.arc(lx - 8, ly + 8, 10, Math.PI * 0.25, Math.PI * 1.25); ctx.stroke();
  ctx.beginPath(); ctx.arc(lx + 8, ly - 8, 10, Math.PI * 1.25, Math.PI * 0.25); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(lx - 6, ly + 6); ctx.lineTo(lx + 6, ly - 6); ctx.stroke();
  ctx.restore();
  txt(ctx, label, x + 84, cy + 12, { size: 34, weight: 700, color: '#111' });
}
function storyTop(ctx, env) {
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fillRect(20, 30, W - 40, 7);
  ctx.fillStyle = WHITE;
  ctx.fillRect(20, 30, 380, 7);
  avatar(ctx, 80, 114, 38, env);
  const nw = txt(ctx, env.settings.account || 'beaduniverse', 134, 106, { size: 34, weight: 700, maxW: 640 });
  txt(ctx, '광고', 134, 146, { size: 28, weight: 500, color: 'rgba(255,255,255,0.92)' });
  void nw;
  iconDots(ctx, 942, 110, 56);
  iconClose(ctx, 1020, 110, 56);
}
function reelsBottom(ctx, env, fb) {
  const st = env.settings;
  avatar(ctx, 86, 1486, 40, env);
  const name = st.account || 'beaduniverse';
  const nw = txt(ctx, name, 142, 1476, { size: 36, weight: 700, maxW: 480 });
  if (fb) {
    txt(ctx, '· 팔로우', 142 + nw + 12, 1476, { size: 34, weight: 600 });
    txt(ctx, '광고 · 🌐', 142, 1518, { size: 28, weight: 500, color: 'rgba(255,255,255,0.92)' });
  } else {
    const bx = 142 + nw + 20;
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    const bw = 118, bh = 50, by = 1446, r = 12;
    ctx.moveTo(bx + r, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, r); ctx.arcTo(bx + bw, by + bh, bx, by + bh, r); ctx.arcTo(bx, by + bh, bx, by, r); ctx.arcTo(bx, by, bx + bw, by, r); ctx.closePath(); ctx.stroke();
    txt(ctx, '팔로우', bx + bw / 2, by + 35, { size: 28, weight: 700, align: 'center' });
    txt(ctx, '광고', 142, 1518, { size: 28, weight: 500, color: 'rgba(255,255,255,0.92)' });
  }
  const cap = `${name}  ${st.caption || ''}`;
  const cw = txt(ctx, cap, 48, 1580, { size: 32, weight: 500, maxW: 760 });
  txt(ctx, ' 더 보기', 48 + cw, 1580, { size: 32, weight: 600, color: 'rgba(255,255,255,0.75)' });
}

/** env: { settings, avatarImg, alpha, px } */
export function drawMockUI(ctx, id, env) {
  const P = placementOf(id);
  const st = env.settings;
  ctx.save();
  ctx.globalAlpha = clamp(env.alpha ?? 0.6, 0, 1);
  const px = env.px || 1;
  // 밝은 사진 위에서도 UI 가 보이도록 어두운 테두리 그림자
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = Math.max(3, 10 * px);
  ctx.shadowOffsetY = 0;
  if (P.ui === 'reels-ig' || P.ui === 'reels-fb') {
    const fb = P.ui === 'reels-fb';
    ctx.save(); ctx.shadowColor = 'transparent'; bottomScrim(ctx, 1280); ctx.restore();
    statusBar(ctx);
    if (fb) {
      chevron(ctx, 66, 196, 52, 'left', 6);
      txt(ctx, '릴스', 104, 214, { size: 50, weight: 800 });
      strokeStyle(ctx, 5);
      ctx.beginPath(); ctx.arc(924, 194, 22, 0, Math.PI * 2); ctx.moveTo(940, 210); ctx.lineTo(956, 226); ctx.stroke();
      iconCamera(ctx, 1012, 196, 56);
    } else {
      txt(ctx, '릴스', 48, 214, { size: 54, weight: 800 });
      iconCamera(ctx, 1010, 196, 58);
    }
    rail(ctx, fb ? [
      { icon: iconThumb, y: 1180, label: '1.2천' },
      { icon: iconComment, y: 1306, label: '86' },
      { icon: iconShare, y: 1432, label: '공유' },
      { icon: (c, x, y, s) => iconDots(c, x, y, s), y: 1548 },
    ] : [
      { icon: iconHeart, y: 1170, label: '2.1만' },
      { icon: iconComment, y: 1296, label: '384' },
      { icon: iconSend, y: 1422, label: '512' },
      { icon: (c, x, y, s) => iconDots(c, x, y, s), y: 1530 },
    ]);
    if (!fb) {
      // 오디오 썸네일 (아이콘 줄 맨 아래)
      ctx.save();
      ctx.fillStyle = st.avatarColor || '#ff2e93';
      ctx.fillRect(979, 1572, 54, 54);
      ctx.lineWidth = 4; ctx.strokeStyle = WHITE; ctx.strokeRect(979, 1572, 54, 54);
      ctx.restore();
    }
    reelsBottom(ctx, env, fb);
    if (!fb) {
      txt(ctx, `♫ ${st.account || 'beaduniverse'} · 원본 오디오`, 48, 1628, { size: 28, weight: 500, maxW: 700 });
      ctaBar(ctx, 1660, 88, st.cta || '더 알아보기');
      ctx.save(); ctx.shadowColor = 'transparent'; igNav(ctx); ctx.restore();
    } else {
      ctaBar(ctx, 1622, 92, st.cta || '더 알아보기', { radius: 14, fill: 'rgba(255,255,255,0.24)' });
      ctx.beginPath();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      const y = 1760, hgt = 96, r = 48, x = 32, w = W - 64;
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hgt, r); ctx.arcTo(x + w, y + hgt, x, y + hgt, r); ctx.arcTo(x, y + hgt, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.stroke();
      txt(ctx, '댓글 달기…', 84, 1820, { size: 32, weight: 500, color: 'rgba(255,255,255,0.75)' });
    }
  } else {
    // 스토리
    const fb = P.ui === 'story-fb';
    ctx.save(); ctx.shadowColor = 'transparent';
    const g = ctx.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 260);
    bottomScrim(ctx, 1500);
    ctx.restore();
    storyTop(ctx, env);
    pillCta(ctx, fb ? 1792 : 1770, st.cta || '더 알아보기');
  }
  ctx.restore();
}
