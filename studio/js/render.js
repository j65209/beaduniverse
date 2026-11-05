/* =========================================================================
   렌더링 엔진 — 텍스트 레이아웃 · 레이어 그리기 · 기하 계산
   편집 화면과 내보내기가 같은 함수로 그려서 보이는 그대로 저장된다.
   ========================================================================= */
import { W, H, assets, clamp, rgba } from './core.js';
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
    L.fit && L.fit.on ? `${L.fit.maxLines},${L.fit.min}` : '-'].join('\u0001');
}

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
    const tooBig = (r) => r.lines.length > maxLines || r.lines.some((li) => li.w > maxContentW + 0.5);
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

function drawPlaceholder(ctx, L, a) {
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, 0, 0, L.w, L.h, L.radius || 0);
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

function paintImage(c, L, a, r) {
  c.save();
  c.beginPath();
  roundRectPath(c, 0, 0, L.w, L.h, L.radius || 0);
  c.clip();
  const adj = L.adj;
  if (adj && (adj.b !== 100 || adj.c !== 100 || adj.s !== 100) && 'filter' in c) {
    c.filter = `brightness(${adj.b}%) contrast(${adj.c}%) saturate(${adj.s}%)`;
  }
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (L.flipX) { c.translate(L.w, 0); c.scale(-1, 1); c.drawImage(a.img, L.w - r.x - r.w, r.y, r.w, r.h); }
  else c.drawImage(a.img, r.x, r.y, r.w, r.h);
  c.restore();
}

function drawImageLayer(ctx, L, o) {
  const a = assets.get(L.asset);
  if (!a || !a.img) {
    if (L.asset && (!a || (a.status !== 'missing' && a.status !== 'error'))) assets.load(L.asset);
    if (!o.export) drawPlaceholder(ctx, L, a); // 내보낼 땐 빈 칸 안내 그림을 넣지 않음
    return;
  }
  const iw = a.w || a.img.naturalWidth, ih = a.h || a.img.naturalHeight;
  const r = imgDrawRect(L, iw, ih);
  const px = o.px || 1;
  if (L.shadow && L.shadow.on) {
    const ow = Math.max(1, Math.ceil(L.w * px)), oh = Math.max(1, Math.ceil(L.h * px));
    if (ow * oh > 40e6) { paintImage(ctx, L, a, r); }
    else {
      const off = getScratch(ow, oh);
      const oc = off.getContext('2d');
      oc.setTransform(1, 0, 0, 1, 0, 0);
      oc.clearRect(0, 0, ow + 2, oh + 2);
      oc.setTransform(px, 0, 0, px, 0, 0);
      paintImage(oc, L, a, r);
      ctx.save();
      applyShadow(ctx, L.shadow, px);
      ctx.drawImage(off, 0, 0, ow, oh, 0, 0, ow / px, oh / px);
      ctx.restore();
    }
  } else paintImage(ctx, L, a, r);
  if (L.stroke && L.stroke.on && L.stroke.width > 0) {
    ctx.save();
    ctx.beginPath();
    const sw = +L.stroke.width;
    roundRectPath(ctx, sw / 2, sw / 2, L.w - sw, L.h - sw, Math.max(0, (L.radius || 0) - sw / 2));
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
function drawShapeLayer(ctx, L) {
  ctx.beginPath();
  if (L.shape === 'ellipse') ctx.ellipse(L.w / 2, L.h / 2, Math.max(0.5, L.w / 2), Math.max(0.5, L.h / 2), 0, 0, Math.PI * 2);
  else roundRectPath(ctx, 0, 0, L.w, L.h, L.radius || 0);
  ctx.fillStyle = fillStyleOf(ctx, L);
  ctx.fill();
  if (L.stroke && L.stroke.on && L.stroke.width > 0) {
    ctx.lineWidth = +L.stroke.width;
    ctx.strokeStyle = L.stroke.color;
    ctx.stroke();
  }
}

/* ---------- 텍스트 그리기 ---------- */
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
  if (st && st.on && st.width > 0) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = st.width * 2;
    ctx.strokeStyle = st.color;
    applyShadow(ctx, L.shadow, pxs);
    each(true);
    clearShadow(ctx);
    ctx.fillStyle = L.color;
    each(false);
  } else {
    applyShadow(ctx, L.shadow, pxs);
    ctx.fillStyle = L.color;
    each(false);
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
  else drawShapeLayer(ctx, L);
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

/** 내보내기·썸네일 전에 이미지·글꼴을 모두 준비 */
export async function preparePage(page) {
  await assets.loadMany(page.layers.filter((l) => l.type === 'image' && !l.hidden).map((l) => l.asset));
  await waitTextFonts(page.layers);
  syncPageText(page);
}

export async function renderPageCanvas(page, scale = 1) {
  await preparePage(page);
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const ctx = c.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawPage(ctx, page, { px: scale, export: true });
  return c;
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
  drawPage(ctx, page, { px: s });
}
