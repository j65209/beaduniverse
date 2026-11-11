/* =========================================================================
   렌더링 엔진 — 텍스트 레이아웃 · 레이어 그리기 · 기하 계산
   편집 화면과 내보내기가 같은 함수로 그려서 보이는 그대로 저장된다.
   ========================================================================= */
import { W, H, assets, clamp, rgba, state, bus } from './core.js';
import { cssFont, textFontReady, fontEpoch, waitTextFonts } from './fonts.js';

const mcanvas = document.createElement('canvas');
const mctx = mcanvas.getContext('2d');
export const HAS_LS = 'letterSpacing' in mctx;

/* ---------- 도형 경로 ---------- */
export function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
  if (!r) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** 도형·이미지 모양 경로 — (0,0)~(w,h) 안에 그린다.
 *  kind: rect · ellipse · arch(아치 창) · star(별·스티커) · heart · ticket(쿠폰) · bubble(말풍선)
 *  o: { radius, points, inner, tail } */
export function shapePath(ctx, kind, w, h, o = {}) {
  const r = o.radius || 0;
  switch (kind) {
    case 'ellipse':
      ctx.ellipse(w / 2, h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
      return;
    case 'arch': {
      const rx = w / 2, ry = Math.min(h, w / 2);
      ctx.moveTo(0, h);
      ctx.lineTo(0, ry);
      ctx.ellipse(rx, ry, Math.max(0.5, rx), Math.max(0.5, ry), 0, Math.PI, Math.PI * 2);
      ctx.lineTo(w, h);
      ctx.closePath();
      return;
    }
    case 'star': {
      const n = clamp(Math.round(o.points || 5), 3, 40);
      const inner = clamp(o.inner == null ? 0.5 : o.inner, 0.1, 0.98);
      for (let i = 0; i < n * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        const k = i % 2 ? inner : 1;
        const x = w / 2 + Math.cos(a) * (w / 2) * k, y = h / 2 + Math.sin(a) * (h / 2) * k;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      return;
    }
    case 'heart':
      ctx.moveTo(w * 0.5, h * 0.24);
      ctx.bezierCurveTo(w * 0.5, h * 0.2, w * 0.44, 0, w * 0.25, 0);
      ctx.bezierCurveTo(w * 0.02, 0, 0, h * 0.24, 0, h * 0.33);
      ctx.bezierCurveTo(0, h * 0.58, w * 0.22, h * 0.78, w * 0.5, h);
      ctx.bezierCurveTo(w * 0.78, h * 0.78, w, h * 0.58, w, h * 0.33);
      ctx.bezierCurveTo(w, h * 0.24, w * 0.98, 0, w * 0.75, 0);
      ctx.bezierCurveTo(w * 0.56, 0, w * 0.5, h * 0.2, w * 0.5, h * 0.24);
      ctx.closePath();
      return;
    case 'ticket': {
      const nr = Math.max(1, Math.min(h * 0.16, w * 0.1, 46));
      const cr = Math.max(0, Math.min(r, h / 2 - nr, w / 4));
      const m = h / 2;
      ctx.moveTo(cr, 0);
      ctx.lineTo(w - cr, 0);
      if (cr) ctx.arcTo(w, 0, w, cr, cr);
      ctx.lineTo(w, m - nr);
      ctx.arc(w, m, nr, -Math.PI / 2, Math.PI / 2, true);
      ctx.lineTo(w, h - cr);
      if (cr) ctx.arcTo(w, h, w - cr, h, cr);
      ctx.lineTo(cr, h);
      if (cr) ctx.arcTo(0, h, 0, h - cr, cr);
      ctx.lineTo(0, m + nr);
      ctx.arc(0, m, nr, Math.PI / 2, -Math.PI / 2, true);
      ctx.lineTo(0, cr);
      if (cr) ctx.arcTo(0, 0, cr, 0, cr);
      ctx.closePath();
      return;
    }
    case 'bubble': {
      const th = Math.max(8, Math.min(h * 0.24, 48));
      const bh = h - th;
      roundRectPath(ctx, 0, 0, w, bh, Math.min(r || 40, bh / 2));
      const left = o.tail !== 'right';
      const base = Math.min(w * 0.16, 84);
      const tx = left ? base : w - base;
      const tw = th * 1.1;
      ctx.moveTo(tx - tw / 2, bh - 2);
      ctx.lineTo(tx + tw / 2, bh - 2);
      ctx.lineTo(left ? tx - tw * 0.7 : tx + tw * 0.7, h);
      ctx.closePath();
      return;
    }
    case 'sparkle': { // ✦ 반짝이 — 오목한 4갈래 별
      const k = clamp(o.inner == null ? 0.14 : o.inner, 0.02, 0.45);
      const cx = w / 2, cy = h / 2, ix = w * k, iy = h * k;
      ctx.moveTo(cx, 0);
      ctx.quadraticCurveTo(cx + ix, cy - iy, w, cy);
      ctx.quadraticCurveTo(cx + ix, cy + iy, cx, h);
      ctx.quadraticCurveTo(cx - ix, cy + iy, 0, cy);
      ctx.quadraticCurveTo(cx - ix, cy - iy, cx, 0);
      ctx.closePath();
      return;
    }
    case 'flower': { // 데이지 꽃잎 (가운데는 따로 원을 올려서 색 다르게)
      const n = clamp(Math.round(o.points || 8), 4, 16);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
      const pl = R * 0.52, pw = R * clamp(o.inner == null ? 0.26 : o.inner, 0.1, 0.5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(a) * (R - pl), py = cy + Math.sin(a) * (R - pl);
        ctx.moveTo(px + Math.cos(a) * pl, py + Math.sin(a) * pl);
        ctx.ellipse(px, py, pl, pw, a, 0, Math.PI * 2);
      }
      ctx.moveTo(cx + R * 0.34, cy);
      ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
      return;
    }
    case 'film': { // 필름 스트립 — 긴 변 양쪽에 구멍 (evenodd 로 뚫림)
      roundRectPath(ctx, 0, 0, w, h, r);
      const vert = h >= w, S = vert ? w : h, len = vert ? h : w;
      const across = S * 0.08, along = S * 0.058, pitch = S * 0.136, edge = S * 0.045;
      const n = Math.max(1, Math.floor((len - edge * 2) / pitch));
      const start = (len - (n - 1) * pitch - along) / 2, hr = Math.min(across, along) * 0.28;
      for (let i = 0; i < n; i++) {
        const t = start + i * pitch;
        if (vert) { roundRectPath(ctx, edge, t, across, along, hr); roundRectPath(ctx, w - edge - across, t, across, along, hr); }
        else { roundRectPath(ctx, t, edge, along, across, hr); roundRectPath(ctx, t, h - edge - across, along, across, hr); }
      }
      return;
    }
    case 'checker': { // 체크무늬 — 가로 칸 수 = points
      const cols = clamp(Math.round(o.points || 8), 2, 60), sz = w / cols, rows = Math.ceil(h / sz - 1e-6);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (!((i + j) % 2)) ctx.rect(i * sz, j * sz, sz, Math.min(sz, h - j * sz));
      return;
    }
    case 'barcode': { // 바코드 — 늘 같은 무늬
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const unit = Math.max(0.5, w / 96);
      let x = 0, bar = true;
      while (x < w - 0.01) {
        const bw = Math.min((1 + Math.floor(rnd() * 3.3)) * unit, w - x);
        if (bar) ctx.rect(x, 0, bw, h);
        x += bw; bar = !bar;
      }
      return;
    }
    case 'grain':
    case 'stripes':
      ctx.rect(0, 0, w, h);
      return;
    default:
      roundRectPath(ctx, 0, 0, w, h, r);
  }
}
/** 손그림 선 도형 (채우기 없이 선만) */
const LINE_KINDS = new Set(['arrow', 'scribble', 'squiggle', 'corners']);
export const isLineShape = (L) => LINE_KINDS.has(L.shape);
function linePath(ctx, kind, w, h, t = 0) {
  if (kind === 'corners') { // 뷰파인더 모서리 ⌜ ⌝ ⌞ ⌟ — 선 두께만큼 안쪽으로
    const i = t / 2, l = Math.min(w, h) * 0.16, x0 = i, y0 = i, x1 = w - i, y1 = h - i;
    ctx.moveTo(x0, y0 + l); ctx.lineTo(x0, y0); ctx.lineTo(x0 + l, y0);
    ctx.moveTo(x1 - l, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + l);
    ctx.moveTo(x1, y1 - l); ctx.lineTo(x1, y1); ctx.lineTo(x1 - l, y1);
    ctx.moveTo(x0 + l, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - l);
    return;
  }
  if (kind === 'arrow') { // 손으로 그은 휘어진 화살표 (왼쪽 아래 → 오른쪽 위)
    const sx = w * 0.06, sy = h * 0.88, ex = w * 0.93, ey = h * 0.16;
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(w * 0.22, h * 0.2, w * 0.62, h * 0.08, ex, ey);
    const ang = Math.atan2(ey - h * 0.08, ex - w * 0.62);
    const hl = Math.max(14, Math.min(w, h) * 0.28);
    ctx.moveTo(ex - Math.cos(ang - 0.55) * hl, ey - Math.sin(ang - 0.55) * hl);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex - Math.cos(ang + 0.55) * hl, ey - Math.sin(ang + 0.55) * hl);
    return;
  }
  if (kind === 'scribble') { // 손으로 두른 동그라미 (한 바퀴 조금 넘게)
    const cx = w / 2, cy = h / 2, rx = w / 2 * 0.94, ry = h / 2 * 0.9;
    const turns = 1.12, steps = 90;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * turns * Math.PI * 2 - 2.3;
      const wob = 1 + 0.035 * Math.sin(t * 3.1) - 0.05 * (i / steps);
      const x = cx + Math.cos(t) * rx * wob, y = cy + Math.sin(t) * ry * wob;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    return;
  }
  // squiggle — 물결 밑줄
  const n = Math.max(2, Math.round(w / Math.max(20, h * 1.4)));
  const amp = h * 0.32, cy = h / 2, seg = w / n;
  ctx.moveTo(0, cy);
  for (let i = 0; i < n; i++) {
    const x0 = i * seg;
    ctx.bezierCurveTo(x0 + seg * 0.25, cy - amp * 2, x0 + seg * 0.25, cy - amp * 2, x0 + seg * 0.5, cy);
    ctx.bezierCurveTo(x0 + seg * 0.75, cy + amp * 2, x0 + seg * 0.75, cy + amp * 2, x0 + seg, cy);
  }
}
/* 필름 그레인 무늬 (한 번 만들어 재사용) */
let grainPat = null;
function grainPattern(ctx) {
  if (!grainPat) {
    const c = document.createElement('canvas');
    c.width = c.height = 180;
    const g = c.getContext('2d');
    const im = g.createImageData(180, 180);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 46 + Math.random() * 60;
    }
    g.putImageData(im, 0, 0);
    grainPat = c;
  }
  return ctx.createPattern(grainPat, 'repeat');
}
/** 이미지 모양(가려내기) 경로 */
function maskPath(c, L) {
  const k = L.mask || 'rect';
  if (k === 'rect') roundRectPath(c, 0, 0, L.w, L.h, L.radius || 0);
  else shapePath(c, k, L.w, L.h, L);
}

/* ---------- 텍스트 레이아웃 ---------- */
export function textPads(L) {
  return L.bg && L.bg.mode && L.bg.mode !== 'none' ? { px: +L.bg.padX || 0, py: +L.bg.padY || 0 } : { px: 0, py: 0 };
}

function makeMeasure(font, ls) {
  mctx.font = font;
  if (HAS_LS) mctx.letterSpacing = '0px';
  return (s) => {
    if (!s) return 0;
    const n = Array.from(s).length;
    return mctx.measureText(s).width + ls * (n - 1);
  };
}

/** 띄어쓰기 단위 줄바꿈 (한글 keep-all). 한 단어가 너무 길면 글자 단위로 자른다. */
export function wrapLines(text, measure, maxW) {
  const out = [];
  const paras = String(text ?? '').split('\n');
  for (const para of paras) {
    if (maxW === Infinity || !para) { out.push(para); continue; }
    const tokens = para.match(/\S+\s*|\s+/g) || [''];
    let line = '';
    const pushChars = (tok) => {
      for (const ch of Array.from(tok)) {
        const cand = line + ch;
        if (line && measure(cand.trimEnd()) > maxW) { out.push(line.trimEnd()); line = ch.trim() ? ch : ''; }
        else line = cand;
      }
    };
    for (const tok of tokens) {
      const cand = line + tok;
      if (measure(cand.trimEnd()) <= maxW) { line = cand; continue; }
      if (line.trim()) { out.push(line.trimEnd()); line = ''; }
      if (measure(tok.trimEnd()) <= maxW) line = tok.trimStart();
      else pushChars(tok);
    }
    out.push(line.trimEnd());
  }
  return out;
}

function layoutAt(L, size, maxContentW) {
  const font = cssFont(L.font, L.weight, size, L.italic);
  const ls = size * (+L.tracking || 0) / 100;
  const measure = makeMeasure(font, ls);
  const lines = wrapLines(L.text, measure, maxContentW).map((t) => ({ t, w: measure(t) }));
  const m = mctx.measureText('가Hg');
  let asc = m.fontBoundingBoxAscent;
  let desc = m.fontBoundingBoxDescent;
  if (!(asc > 0) || !(desc >= 0)) { asc = size * 0.9; desc = size * 0.22; }
  return { font, size, ls, lines, asc, desc };
}

const layoutCache = new Map();
function layoutKey(L) {
  return [fontEpoch(), L.text, L.font, L.weight, L.italic ? 1 : 0, L.size, L.lh, L.tracking, L.autoW ? 1 : 0,
    L.autoW ? 0 : Math.round(L.w * 100), L.bg ? L.bg.mode : '', L.bg ? L.bg.padX : 0, L.bg ? L.bg.padY : 0,
    L.fit && L.fit.on ? `${L.fit.maxLines},${L.fit.min},${maxHOf(L)}` : '-'].join('\u0001');
}
/** 도형 안 글자는 도형 안쪽 높이를 넘지 않게 (자동 축소가 켜져 있을 때) */
const maxHOf = (L) => (L.inShape && L.inShape.maxH > 0 ? Math.round(L.inShape.maxH) : 0);

export function layoutText(L) {
  const key = layoutKey(L);
  const cached = layoutCache.get(L.id);
  if (cached && cached.key === key) return cached;
  const { px, py } = textPads(L);
  const maxContentW = L.autoW ? Infinity : Math.max(8, L.w - 2 * px);
  let res = layoutAt(L, L.size, maxContentW);
  let shrunk = false;
  if (!L.autoW && L.fit && L.fit.on) {
    const maxLines = Math.max(1, (L.fit.maxLines | 0) || 1);
    const maxH = maxHOf(L);
    const tooBig = (r) => r.lines.length > maxLines || r.lines.some((li) => li.w > maxContentW + 0.5)
      || (maxH > 0 && Math.max(1, r.lines.length) * r.size * (+L.lh || 1.2) + 2 * py > maxH + 0.5);
    if (tooBig(res)) {
      let lo = Math.max(6, Math.min(+L.fit.min || 12, L.size));
      let hi = L.size;
      let best = layoutAt(L, lo, maxContentW);
      for (let i = 0; i < 14 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2;
        const r = layoutAt(L, mid, maxContentW);
        if (tooBig(r)) hi = mid; else { lo = mid; best = r; }
      }
      res = best;
      shrunk = true;
    }
  }
  const lineH = res.size * (+L.lh || 1.2);
  const contentW = L.autoW ? Math.max(1, ...res.lines.map((l) => l.w)) : maxContentW;
  const lay = Object.assign(res, {
    key, lineH, contentW, px, py, shrunk,
    boxW: contentW + 2 * px,
    boxH: Math.max(1, res.lines.length) * lineH + 2 * py,
  });
  layoutCache.set(L.id, lay);
  return lay;
}

/** 박스 크기가 바뀌어도 기준점(fx,fy 비율 지점)이 화면에서 제자리에 있도록 위치 보정 */
export function resizeKeepAnchor(L, nw, nh, fx, fy) {
  const ow = L.w || 0, oh = L.h || 0;
  const rad = (L.rot || 0) * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const ocx = L.x + ow / 2, ocy = L.y + oh / 2;
  const ax = fx * ow - ow / 2, ay = fy * oh - oh / 2;
  const wx = ocx + ax * c - ay * s, wy = ocy + ax * s + ay * c;
  const bx = fx * nw - nw / 2, by = fy * nh - nh / 2;
  const ncx = wx - (bx * c - by * s), ncy = wy - (bx * s + by * c);
  L.w = nw; L.h = nh;
  L.x = ncx - nw / 2; L.y = ncy - nh / 2;
}
export const alignFrac = (L) => (L.align === 'center' ? 0.5 : L.align === 'right' ? 1 : 0);

/** 텍스트 내용/스타일이 바뀐 뒤 박스 크기 다시 계산. 기본 기준점 = 정렬 방향의 윗변 */
export function syncText(L, anchor) {
  if (!L || L.type !== 'text') return false;
  const lay = layoutText(L);
  const nw = L.autoW ? lay.boxW : L.w;
  const nh = lay.boxH;
  if (Math.abs(nw - (L.w || 0)) < 0.01 && Math.abs(nh - (L.h || 0)) < 0.01) return false;
  const fx = anchor ? anchor[0] : alignFrac(L);
  const fy = anchor ? anchor[1] : 0;
  resizeKeepAnchor(L, nw, nh, fx, fy);
  return true;
}
export function syncPageText(page) {
  let any = false;
  for (const L of page.layers) if (L.type === 'text' && syncText(L)) any = true;
  return any;
}

/* ---------- 도형 안 글자 ----------
   글자 레이어에 inShape = { key: 도형 key, ay: top|middle|bottom, pad } 가 있으면
   그 도형의 글자 영역 안에 놓인다 — 너비 = 도형 안쪽 너비(줄바꿈), 가로 = 글자 줄 정렬, 세로 = ay, 회전 = 도형 회전.
   위치는 도형에서 계산되는 값이라 도형을 옮기거나 크기를 바꾸면 따라간다. */
export const LINE_SHAPES = new Set(['arrow', 'scribble', 'squiggle', 'corners']);
export function canHoldText(S) {
  return !!S && S.type === 'shape' && !LINE_SHAPES.has(S.shape) && S.shape !== 'grain';
}
/** 도형 안에서 글자가 들어갈 영역 (도형 기준 좌표) — 원·별·말풍선 등은 모양 안쪽으로 */
export function shapeTextRect(S) {
  const w = S.w, h = S.h;
  const mid = (fw, fh) => ({ x: (w - w * fw) / 2, y: (h - h * fh) / 2, w: w * fw, h: h * fh });
  switch (S.shape || 'rect') {
    case 'ellipse': return mid(Math.SQRT1_2, Math.SQRT1_2);
    case 'star': { const f = clamp((S.inner == null ? 0.5 : S.inner) * 0.78, 0.2, 0.86); return mid(f, f); }
    case 'sparkle': return mid(0.36, 0.3);
    case 'flower': return mid(0.48, 0.48);
    case 'heart': return { x: w * 0.18, y: h * 0.14, w: w * 0.64, h: h * 0.52 };
    case 'bubble': { const th = Math.max(8, Math.min(h * 0.24, 48)); return { x: 0, y: 0, w, h: h - th }; }
    case 'ticket': { const nr = Math.max(1, Math.min(h * 0.16, w * 0.1, 46)); return { x: nr, y: 0, w: w - 2 * nr, h }; }
    case 'arch': { const top = Math.min(h, w / 2) * 0.32; return { x: 0, y: top, w, h: h - top }; }
    default: return { x: 0, y: 0, w, h };
  }
}
export function defaultShapePad(S) {
  return Math.round(clamp(Math.min(S.w, S.h) * 0.08, 6, 40));
}
export function attachedShape(T, page) {
  if (!T || T.type !== 'text' || !T.inShape || !page) return null;
  const S = page.layers.find((l) => l.key === T.inShape.key && l.type === 'shape');
  return S && S !== T ? S : null;
}
export function attachedTexts(S, page) {
  if (!S || !page) return [];
  return page.layers.filter((l) => l.type === 'text' && l.inShape && l.inShape.key === S.key);
}
/** 글자를 도형 안 자리에 놓기. 바뀌었으면 true */
export function placeInShape(T, S) {
  const o = T.inShape;
  const r = shapeTextRect(S);
  const pad = clamp(+o.pad || 0, 0, Math.max(0, Math.min(r.w, r.h) / 2 - 4));
  const tw = Math.max(8, r.w - 2 * pad);
  T.autoW = false;
  T.w = tw;
  o.maxH = Math.max(8, r.h - 2 * pad);
  const lay = layoutText(T);
  const th = lay.boxH;
  const ay = o.ay || 'middle';
  const ly = ay === 'top' ? r.y + pad : ay === 'bottom' ? r.y + r.h - pad - th : r.y + (r.h - th) / 2;
  const dx = r.x + pad + tw / 2 - S.w / 2, dy = ly + th / 2 - S.h / 2;
  const rot = S.rot || 0, rad = rot * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const nx = S.x + S.w / 2 + dx * c - dy * s - tw / 2;
  const ny = S.y + S.h / 2 + dx * s + dy * c - th / 2;
  const moved = Math.abs(nx - T.x) > 0.01 || Math.abs(ny - T.y) > 0.01 || Math.abs(th - (T.h || 0)) > 0.01 || (T.rot || 0) !== rot;
  T.x = nx; T.y = ny; T.h = th; T.rot = rot;
  return moved;
}
/** 페이지의 도형 안 글자를 모두 제자리로 */
export function syncAttached(page) {
  if (!page) return false;
  let any = false;
  for (const T of page.layers) {
    if (T.type !== 'text' || !T.inShape) continue;
    const S = attachedShape(T, page);
    if (S && placeInShape(T, S)) any = true;
  }
  return any;
}
// 기록·저장 직전에 모든 페이지를 맞춰 둔다 (일괄 수정으로 다른 페이지 도형이 바뀐 경우 포함)
bus.on('pre-commit', () => { const p = state.project; if (p) for (const pg of p.pages) syncAttached(pg); });

/* ---------- 기하 ---------- */
export function corners(L) {
  const rad = (L.rot || 0) * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const cx = L.x + L.w / 2, cy = L.y + L.h / 2;
  return [[-L.w / 2, -L.h / 2], [L.w / 2, -L.h / 2], [L.w / 2, L.h / 2], [-L.w / 2, L.h / 2]]
    .map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
export function aabb(L) {
  if (!L.rot) return { x: L.x, y: L.y, w: L.w, h: L.h, x2: L.x + L.w, y2: L.y + L.h };
  const cs = corners(L);
  const xs = cs.map((p) => p[0]), ys = cs.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys), x2 = Math.max(...xs), y2 = Math.max(...ys);
  return { x, y, w: x2 - x, h: y2 - y, x2, y2 };
}
export function unionBox(boxes) {
  if (!boxes.length) return null;
  let x = Infinity, y = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of boxes) { x = Math.min(x, b.x); y = Math.min(y, b.y); x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2); }
  return { x, y, x2, y2, w: x2 - x, h: y2 - y };
}
export function toLocal(L, px, py) {
  const rad = -(L.rot || 0) * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const cx = L.x + L.w / 2, cy = L.y + L.h / 2;
  const dx = px - cx, dy = py - cy;
  return { x: dx * c - dy * s + L.w / 2, y: dx * s + dy * c + L.h / 2 };
}
export function hitLayer(L, px, py, pad = 0) {
  const p = toLocal(L, px, py);
  return p.x >= -pad && p.y >= -pad && p.x <= L.w + pad && p.y <= L.h + pad;
}
export function isBackdrop(L) {
  const b = aabb(L);
  return b.x <= W * 0.01 && b.y <= H * 0.01 && b.x2 >= W * 0.99 && b.y2 >= H * 0.99;
}
/** 화면 대부분을 덮는 사진·오버레이 — 첫 클릭으로는 끌려가지 않게 (빈 곳처럼 드래그 선택) */
export function isPassive(L) {
  if (L.type === 'text') return false;
  const b = aabb(L);
  return b.w >= W * 0.98 && b.h >= H * 0.35;
}

/* ---------- 이미지 ---------- */
export function imgDrawRect(L, iw, ih) {
  const fit = L.fit || 'cover';
  const z = Math.max(0.05, +L.zoom || 1);
  const base = fit === 'contain' ? Math.min(L.w / iw, L.h / ih) : Math.max(L.w / iw, L.h / ih);
  const s = base * z, dw = iw * s, dh = ih * s;
  return { x: (L.w - dw) * (L.px ?? 0.5), y: (L.h - dh) * (L.py ?? 0.5), w: dw, h: dh };
}

let scratch = null;
function getScratch(w, h) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width < w) scratch.width = Math.ceil(w);
  if (scratch.height < h) scratch.height = Math.ceil(h);
  return scratch;
}

function applyShadow(ctx, sh, px) {
  if (sh && sh.on) {
    ctx.shadowColor = rgba(sh.color, sh.alpha ?? 0.4);
    ctx.shadowBlur = (+sh.blur || 0) * px;
    ctx.shadowOffsetX = (+sh.x || 0) * px;
    ctx.shadowOffsetY = (+sh.y || 0) * px;
  } else clearShadow(ctx);
}
function clearShadow(ctx) {
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
}

// 템플릿 갤러리·페이지 썸네일의 빈 사진 칸 — 실제 사진 느낌의 차분한 톤 (편집 화면은 어두운 안내 칸)
const SAMPLE_TONES = [['#dcd7d0', '#aaa39a'], ['#d3cfca', '#9b968f'], ['#e4ded5', '#bdb3a6'], ['#cbc8c4', '#8f8b87'], ['#ddd6ce', '#a69c91'], ['#d6d1cd', '#a19b95']];
function hashStr(s) { let x = 0; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) | 0; return Math.abs(x); }
function drawSampleSlot(ctx, L) {
  ctx.save();
  ctx.beginPath();
  maskPath(ctx, L);
  ctx.clip();
  const [c1, c2] = SAMPLE_TONES[hashStr(L.key || L.id) % SAMPLE_TONES.length];
  const g = ctx.createLinearGradient(0, 0, L.w * 0.4, L.h);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, L.h);
  // 빛 번짐 한 점 — 사진 같은 깊이
  const rg = ctx.createRadialGradient(L.w * 0.32, L.h * 0.28, 0, L.w * 0.32, L.h * 0.28, Math.max(L.w, L.h) * 0.7);
  rg.addColorStop(0, 'rgba(255,255,255,0.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, L.w, L.h);
  const vg = ctx.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.35, L.w / 2, L.h / 2, Math.max(L.w, L.h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, L.w, L.h);
  if (L.w >= W * 0.95 && L.h >= H * 0.45) { ctx.restore(); return; } // 배경 사진 칸은 아이콘 없이 톤만
  const s = Math.min(L.w, L.h), ic = clamp(s * 0.14, 22, 110);
  const cx = L.w / 2, cy = L.h / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(3, ic * 0.07);
  ctx.lineJoin = 'round';
  ctx.beginPath(); roundRectPath(ctx, cx - ic / 2, cy - ic * 0.38, ic, ic * 0.76, ic * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - ic * 0.38, cy + ic * 0.26); ctx.lineTo(cx - ic * 0.1, cy - ic * 0.04); ctx.lineTo(cx + ic * 0.08, cy + ic * 0.14); ctx.lineTo(cx + ic * 0.2, cy + ic * 0.04); ctx.lineTo(cx + ic * 0.38, cy + ic * 0.26); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + ic * 0.2, cy - ic * 0.16, ic * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawPlaceholder(ctx, L, a, thumb) {
  if (thumb && !L.asset) { drawSampleSlot(ctx, L); return; }
  ctx.save();
  ctx.beginPath();
  maskPath(ctx, L);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, L.w, L.h);
  g.addColorStop(0, '#3d414c'); g.addColorStop(1, '#25272e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, L.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 16;
  for (let x = -L.h; x < L.w; x += 56) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + L.h, L.h); ctx.stroke(); }
  const s = Math.min(L.w, L.h);
  const ic = clamp(s * 0.16, 28, 120);
  const cx = L.w / 2, cy = L.h / 2 - ic * 0.35;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = Math.max(3, ic * 0.06);
  ctx.lineJoin = 'round';
  ctx.beginPath(); roundRectPath(ctx, cx - ic / 2, cy - ic * 0.38, ic, ic * 0.76, ic * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - ic * 0.38, cy + ic * 0.26); ctx.lineTo(cx - ic * 0.1, cy - ic * 0.04); ctx.lineTo(cx + ic * 0.08, cy + ic * 0.14); ctx.lineTo(cx + ic * 0.2, cy + ic * 0.04); ctx.lineTo(cx + ic * 0.38, cy + ic * 0.26); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + ic * 0.2, cy - ic * 0.16, ic * 0.08, 0, Math.PI * 2); ctx.fill();
  const fs = clamp(s * 0.055, 16, 44);
  ctx.font = `600 ${fs}px "Pretendard", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const msg = !L.asset ? '이미지를 끌어다 놓으세요' : a && (a.status === 'missing' || a.status === 'error') ? '이미지를 찾을 수 없어요' : '불러오는 중…';
  ctx.fillText(msg, cx, cy + ic * 0.62);
  ctx.restore();
}

function paintImage(c, L, img, r) {
  c.save();
  c.beginPath();
  maskPath(c, L);
  c.clip();
  const adj = L.adj;
  if (adj && (adj.b !== 100 || adj.c !== 100 || adj.s !== 100) && 'filter' in c) {
    c.filter = `brightness(${adj.b}%) contrast(${adj.c}%) saturate(${adj.s}%)`;
  }
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (L.flipX) { c.translate(L.w, 0); c.scale(-1, 1); c.drawImage(img, L.w - r.x - r.w, r.y, r.w, r.h); }
  else c.drawImage(img, r.x, r.y, r.w, r.h);
  c.restore();
}

function drawImageLayer(ctx, L, o) {
  const a = assets.get(L.asset);
  if (!a || !a.img) {
    if (L.asset && (!a || (a.status !== 'missing' && a.status !== 'error'))) assets.load(L.asset);
    if (!o.export) drawPlaceholder(ctx, L, a, o.thumb); // 내보낼 땐 빈 칸 안내 그림을 넣지 않음
    return;
  }
  const iw = a.w || a.img.naturalWidth, ih = a.h || a.img.naturalHeight;
  const img = (o.export && a.fullImg) || a.img; // 내보낼 땐 원본 화질, 편집 화면은 가벼운 사본
  const r = imgDrawRect(L, iw, ih);
  const px = o.px || 1;
  if (L.shadow && L.shadow.on) {
    const ow = Math.max(1, Math.ceil(L.w * px)), oh = Math.max(1, Math.ceil(L.h * px));
    if (ow * oh > 40e6) { paintImage(ctx, L, img, r); }
    else {
      const off = getScratch(ow, oh);
      const oc = off.getContext('2d');
      oc.setTransform(1, 0, 0, 1, 0, 0);
      oc.clearRect(0, 0, ow + 2, oh + 2);
      oc.setTransform(px, 0, 0, px, 0, 0);
      paintImage(oc, L, img, r);
      ctx.save();
      applyShadow(ctx, L.shadow, px);
      ctx.drawImage(off, 0, 0, ow, oh, 0, 0, ow / px, oh / px);
      ctx.restore();
    }
  } else paintImage(ctx, L, img, r);
  if (L.stroke && L.stroke.on && L.stroke.width > 0) {
    ctx.save();
    ctx.beginPath();
    const sw = +L.stroke.width;
    if (!L.mask || L.mask === 'rect') {
      roundRectPath(ctx, sw / 2, sw / 2, L.w - sw, L.h - sw, Math.max(0, (L.radius || 0) - sw / 2));
    } else { // 모양을 따라 안쪽으로 테두리
      maskPath(ctx, L);
      ctx.clip();
      ctx.beginPath();
      maskPath(ctx, L);
      ctx.lineWidth = sw * 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = L.stroke.color;
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.lineWidth = sw;
    ctx.strokeStyle = L.stroke.color;
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------- 도형 ---------- */
function fillStyleOf(ctx, L) {
  const f = L.fill || {};
  if (f.type === 'linear') {
    const ang = (f.angle ?? 180) * Math.PI / 180;
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    const len = Math.abs(L.w * dx) + Math.abs(L.h * dy);
    const cx = L.w / 2, cy = L.h / 2;
    const g = ctx.createLinearGradient(cx - dx * len / 2, cy - dy * len / 2, cx + dx * len / 2, cy + dy * len / 2);
    g.addColorStop(0, rgba(f.color, f.alpha ?? 1));
    g.addColorStop(1, rgba(f.color2 || f.color, f.alpha2 ?? 0));
    return g;
  }
  return rgba(f.color || '#000000', f.alpha ?? 1);
}
function stripesPath(ctx, L) {
  const w = L.w, h = L.h;
  const sw = Math.max(2, Math.min(w, h) * clamp(L.inner == null ? 0.5 : L.inner, 0.02, 1));
  for (let x = -h; x < w + sw; x += sw * 2) {
    ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.lineTo(x + h + sw, 0); ctx.lineTo(x + sw, h); ctx.closePath();
  }
}
/* 흐림(블러) 도형 — 오라·빛번짐·글로우용.
   단색은 그림자만 그리는 방식(도형은 멀리, 흐린 그림자만 제자리) → 어느 브라우저나 같은 결과.
   그라데이션은 canvas filter 를 지원하면 그걸로. */
const CAN_FILTER = (() => {
  try { const c = document.createElement('canvas').getContext('2d'); if (!c || typeof c.filter !== 'string') return false; c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch (e) { return false; }
})();
function drawBlurredShape(ctx, L, blur, pxs) {
  const f = L.fill || {};
  const kind = L.shape === 'stripes' ? 'rect' : (L.shape || 'rect');
  const rule = kind === 'film' ? 'evenodd' : 'nonzero';
  ctx.save();
  if (f.type === 'linear' && CAN_FILTER) {
    ctx.filter = `blur(${blur * pxs}px)`;
    ctx.beginPath(); shapePath(ctx, kind, L.w, L.h, L);
    ctx.fillStyle = fillStyleOf(ctx, L);
    ctx.fill(rule);
  } else {
    const m = ctx.getTransform();
    const D = 4 * (W + H);
    ctx.translate(D, 0);
    ctx.beginPath(); shapePath(ctx, kind, L.w, L.h, L);
    const a = f.type === 'linear' ? Math.max(f.alpha ?? 1, f.alpha2 ?? 0) : (f.alpha ?? 1);
    ctx.shadowColor = rgba(f.color || '#000000', a);
    ctx.shadowBlur = blur * 2 * pxs;
    ctx.shadowOffsetX = -m.a * D;
    ctx.shadowOffsetY = -m.b * D;
    ctx.fillStyle = '#000000';
    ctx.fill(rule);
  }
  ctx.restore();
}
function drawShapeLayer(ctx, L, o = {}) {
  if (L.flipX) { ctx.translate(L.w, 0); ctx.scale(-1, 1); }
  if (isLineShape(L)) { // 손그림 선: 채우기 색으로 선만 긋기
    ctx.beginPath();
    const lw = Math.max(1, +L.thick || 8);
    linePath(ctx, L.shape, L.w, L.h, lw);
    ctx.lineWidth = lw;
    const sq = L.shape === 'corners';
    ctx.lineCap = sq ? 'butt' : 'round';
    ctx.lineJoin = sq ? 'miter' : 'round';
    const f = L.fill || {};
    ctx.strokeStyle = rgba(f.color || '#111111', f.alpha ?? 1);
    if (L.shadow && L.shadow.on) applyShadow(ctx, L.shadow, o.px || 1);
    ctx.stroke();
    return;
  }
  if (L.shape === 'grain') {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, L.w, L.h); ctx.clip();
    const s = 1 / Math.max(0.3, Math.min(3, o.px || 1)); // 화면 배율과 상관없이 비슷한 입자 크기
    ctx.scale(1 / s, 1 / s);
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, L.w * s, L.h * s);
    ctx.restore();
    return;
  }
  const blur = Math.max(0, +L.blur || 0);
  if (blur > 0) { drawBlurredShape(ctx, L, blur, o.px || 1); return; }
  if (L.shape === 'stripes') { // 사선 줄무늬 — 상자 안으로 자르기
    ctx.save();
    ctx.beginPath(); roundRectPath(ctx, 0, 0, L.w, L.h, L.radius || 0); ctx.clip();
    ctx.beginPath(); stripesPath(ctx, L);
    ctx.fillStyle = fillStyleOf(ctx, L);
    if (L.shadow && L.shadow.on) applyShadow(ctx, L.shadow, o.px || 1);
    ctx.fill();
    ctx.restore();
    return;
  }
  const rule = L.shape === 'film' ? 'evenodd' : 'nonzero';
  ctx.beginPath();
  shapePath(ctx, L.shape || 'rect', L.w, L.h, L);
  ctx.fillStyle = fillStyleOf(ctx, L);
  if (L.shadow && L.shadow.on) { ctx.save(); applyShadow(ctx, L.shadow, o.px || 1); ctx.fill(rule); ctx.restore(); }
  else ctx.fill(rule);
  if (L.stroke && L.stroke.on && L.stroke.width > 0) {
    ctx.lineWidth = +L.stroke.width;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = L.stroke.color;
    ctx.stroke();
  }
}

/* ---------- 텍스트 그리기 ---------- */
function mixHex(a, b, t) {
  const p = (h) => { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); };
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
/** 글자 채우기 — 단색 또는 그라데이션(크롬 광택 포함) */
function textFill(ctx, L) {
  const g = L.grad;
  if (!g || !g.on) return L.color;
  const ang = (g.angle ?? 180) * Math.PI / 180;
  const dx = Math.sin(ang), dy = -Math.cos(ang);
  const len = Math.abs(L.w * dx) + Math.abs(L.h * dy);
  const cx = L.w / 2, cy = L.h / 2;
  const gr = ctx.createLinearGradient(cx - dx * len / 2, cy - dy * len / 2, cx + dx * len / 2, cy + dy * len / 2);
  const c1 = L.color, c2 = g.color2 || '#ffffff';
  if (g.chrome) {
    gr.addColorStop(0, c2);
    gr.addColorStop(0.42, mixHex(c2, c1, 0.35));
    gr.addColorStop(0.5, c1);
    gr.addColorStop(0.58, mixHex(c1, c2, 0.75));
    gr.addColorStop(0.8, c2);
    gr.addColorStop(1, mixHex(c2, c1, 0.5));
  } else {
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
  }
  return gr;
}
function runText(ctx, t, x, y, ls, stroke) {
  if (!ls) { if (stroke) ctx.strokeText(t, x, y); else ctx.fillText(t, x, y); return; }
  if (HAS_LS) {
    ctx.letterSpacing = ls + 'px';
    if (stroke) ctx.strokeText(t, x, y); else ctx.fillText(t, x, y);
    ctx.letterSpacing = '0px';
    return;
  }
  let cx = x;
  for (const ch of Array.from(t)) {
    if (stroke) ctx.strokeText(ch, cx, y); else ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + ls;
  }
}

function drawTextLayer(ctx, L, o) {
  textFontReady(L);
  const lay = layoutText(L);
  const { px, py, lineH, contentW, lines, asc, desc } = lay;
  const offX = (w) => (L.align === 'center' ? (contentW - w) / 2 : L.align === 'right' ? contentW - w : 0);
  const bg = L.bg;
  if (bg && bg.mode && bg.mode !== 'none' && (bg.alpha ?? 1) > 0) {
    ctx.save();
    ctx.fillStyle = rgba(bg.color, bg.alpha ?? 1);
    ctx.beginPath();
    if (bg.mode === 'box') roundRectPath(ctx, 0, 0, L.w, L.h, bg.radius || 0);
    else {
      lines.forEach((li, i) => {
        if (!li.t.trim()) return;
        roundRectPath(ctx, offX(li.w), i * lineH, li.w + 2 * px, lineH + 2 * py, bg.radius || 0);
      });
    }
    ctx.fill('nonzero');
    ctx.restore();
  }
  if (o.editingId === L.id) return;
  ctx.save();
  ctx.font = lay.font;
  if (HAS_LS) ctx.letterSpacing = '0px';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const base = (lineH - (asc + desc)) / 2 + asc;
  const pxs = o.px || 1;
  const each = (stroke) => lines.forEach((li, i) => {
    if (li.t) runText(ctx, li.t, px + offX(li.w), py + i * lineH + base, lay.ls, stroke);
  });
  const st = L.stroke;
  const hol = L.hollow && L.hollow.on;
  if (hol) { // 속 비우기 — 글자색으로 외곽선만
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(0.5, +L.hollow.width || 3);
    ctx.strokeStyle = textFill(ctx, L);
    applyShadow(ctx, L.shadow, pxs);
    each(true);
    clearShadow(ctx);
  } else if (st && st.on && st.width > 0) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = st.width * 2;
    ctx.strokeStyle = st.color;
    applyShadow(ctx, L.shadow, pxs);
    each(true);
    clearShadow(ctx);
    ctx.fillStyle = textFill(ctx, L);
    each(false);
  } else {
    applyShadow(ctx, L.shadow, pxs);
    ctx.fillStyle = textFill(ctx, L);
    each(false);
  }
  if (L.strike) { // 취소선 (정가 표시)
    clearShadow(ctx);
    ctx.fillStyle = textFill(ctx, L);
    const th = Math.max(1.5, lay.size * 0.075);
    lines.forEach((li, i) => {
      if (!li.t || !li.t.trim()) return;
      const y = py + i * lineH + base - lay.size * 0.31;
      ctx.fillRect(px + offX(li.w) - th * 0.6, y - th / 2, li.w + th * 1.2, th);
    });
  }
  ctx.restore();
}

/* ---------- 페이지/레이어 그리기 ---------- */
export function drawLayer(ctx, L, o = {}) {
  if (L.type === 'text' && (!(L.w > 0) || !(L.h > 0))) syncText(L);
  if (!(L.w > 0) || !(L.h > 0)) return;
  ctx.save();
  ctx.globalAlpha *= (L.opacity ?? 1);
  ctx.translate(L.x + L.w / 2, L.y + L.h / 2);
  if (L.rot) ctx.rotate(L.rot * Math.PI / 180);
  ctx.translate(-L.w / 2, -L.h / 2);
  if (L.type === 'text') drawTextLayer(ctx, L, o);
  else if (L.type === 'image') drawImageLayer(ctx, L, o);
  else drawShapeLayer(ctx, L, o);
  ctx.restore();
}

/** ctx 는 (디자인 1px → 기기 o.px 픽셀) 변환이 걸린 상태여야 한다 */
export function drawPage(ctx, page, o = {}) {
  ctx.save();
  ctx.fillStyle = page.bg || '#ffffff';
  ctx.fillRect(0, 0, W, H);
  for (const L of page.layers) {
    if (L.hidden) continue;
    if (o.skip && o.skip.has(L.id)) continue;
    drawLayer(ctx, L, o);
  }
  ctx.restore();
}

/** 내보내기·썸네일 전에 이미지·글꼴을 모두 준비. full = 원본 화질 사진까지 */
export async function preparePage(page, { full = false } = {}) {
  const ids = page.layers.filter((l) => l.type === 'image' && !l.hidden).map((l) => l.asset).filter(Boolean);
  await assets.loadMany(ids);
  if (full) await Promise.all([...new Set(ids)].map((id) => assets.full(id)));
  await waitTextFonts(page.layers);
  syncPageText(page);
  syncAttached(page);
}

export async function renderPageCanvas(page, scale = 1, { full = false } = {}) {
  await preparePage(page, { full });
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const ctx = c.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawPage(ctx, page, { px: scale, export: true });
  return c;
}

/** 원본 화질 배율 — 화면을 가장 많이 차지하는 사진의 픽셀 하나가 결과물 픽셀 하나가 되는 배율 (1 이상).
 *  예: 3024×4032 사진을 배경으로 꽉 채우면 약 2.1배 → 2268×4032 */
export function nativeScale(page) {
  let best = null, bestArea = 0;
  for (const L of page.layers) {
    if (L.type !== 'image' || L.hidden || !L.asset || (L.opacity ?? 1) <= 0) continue;
    const a = assets.get(L.asset);
    if (!a || !a.w || !a.h) continue;
    const b = aabb(L);
    const vis = Math.max(0, Math.min(b.x2, W) - Math.max(b.x, 0)) * Math.max(0, Math.min(b.y2, H) - Math.max(b.y, 0));
    if (vis > bestArea) { bestArea = vis; best = { L, a }; }
  }
  if (!best || bestArea < W * H * 0.04) return 1; // 작은 사진만 있으면 기본 크기
  const r = imgDrawRect(best.L, best.a.w, best.a.h);
  return Math.max(1, best.a.w / Math.max(1, r.w));
}

/** 바로 그리는 썸네일 (글꼴 로딩 기다리지 않음) */
export function drawThumb(canvas, page, cssW) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(cssW * dpr), h = Math.round(cssW * H / W * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  const s = w / W;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(s, 0, 0, s, 0, 0);
  drawPage(ctx, page, { px: s, thumb: true });
}
