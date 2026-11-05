/* =========================================================================
   템플릿 만들기 도구 — 글자·사진·도형 레이어를 짧게 만드는 함수들
   ========================================================================= */
import { W, H, newPage, newLayer } from './core.js';
import { syncText } from './render.js';

export const PINK = '#ff2e93';

/** 글자 — (ax, ay) = 정렬 방향의 윗변 기준점 (왼쪽 정렬: 왼쪽 위, 가운데: 위 가운데, 오른쪽: 오른쪽 위) */
export function T(props, ax, ay) {
  const L = newLayer('text', props);
  L.x = ax; L.y = ay; L.w = 0; L.h = 0;
  syncText(L);
  return L;
}
/** 고정 너비 글상자 — (x, y) = 왼쪽 위, w 폭 안에서 줄바꿈 */
export function TB(props, x, y, w) {
  const L = newLayer('text', Object.assign({}, props, { autoW: false }));
  L.x = x; L.y = y; L.w = w; L.h = 0;
  syncText(L);
  return L;
}
/** 반짝이 ✦ — (cx, cy) 가운데, s 크기 */
export const SPARK = (cx, cy, s, color = '#ffffff', rot = 0, name = '반짝이') => newLayer('shape', { name, shape: 'sparkle', inner: 0.14, x: cx - s * 0.4, y: cy - s / 2, w: s * 0.8, h: s, rot, fill: { type: 'solid', color, alpha: 1 } });
/** 틱톡 자막 스타일 — 흰 줄 배경 + 검은 글자 (가운데 정렬, (cx, y) = 위 가운데) */
export const TIKTOK = (name, text, cx, y, size = 50, o = {}) => T(Object.assign({ name, text, weight: 700, size, color: '#111111', align: 'center', lh: 1.42, bg: { mode: 'line', color: '#ffffff', alpha: 1, padX: 18, padY: 7, radius: 12 } }, o), cx, y);
/** 크롬(실버) 글자 그라데이션 */
export const CHROME = { on: true, color2: '#ffffff', angle: 180, chrome: true };
/** 만든 뒤 가운데를 (cx, cy) 로 옮기기 (회전된 글자·도형 정렬용) */
export function centerAt(L, cx, cy) { L.x = cx - L.w / 2; L.y = cy - L.h / 2; return L; }
/** 흐린 원 (오라·빛번짐) — 가운데 (cx, cy), 지름 d */
export const BLOB = (cx, cy, d, color, blur = 150, alpha = 0.9, name = '오라') => newLayer('shape', { name, shape: 'ellipse', x: cx - d / 2, y: cy - d / 2, w: d, h: d, blur, fill: { type: 'solid', color, alpha } });
/** 필름 그레인 (전체 화면) */
export const GRAIN = (opacity = 0.35) => newLayer('shape', { name: '필름 그레인', shape: 'grain', x: 0, y: 0, w: W, h: H, opacity, fill: { type: 'solid', color: '#000000', alpha: 1 } });
/** 속 비운 글자 (외곽선만) */
export const HOLLOW = (width = 3) => ({ on: true, width });
/** 네온 글로우 (그림자를 같은 색으로 번지게) */
export const GLOW = (color, blur = 28) => ({ on: true, color, alpha: 1, blur, x: 0, y: 0 });
/** 딱딱한 그림자 (레트로 스티커) */
export const HARD = (d = 10, color = '#111111') => ({ on: true, color, alpha: 1, blur: 0, x: d, y: d });
export const IMG = (props) => newLayer('image', props);
export const SH = (props) => newLayer('shape', props);
export const SOFT_SHADOW = { on: true, color: '#000000', alpha: 0.35, blur: 24, x: 0, y: 4 };
export const BG = (name = '배경 사진') => IMG({ name, x: 0, y: 0, w: W, h: H, fit: 'cover' });
export const solid = (color, alpha = 1) => ({ type: 'solid', color, alpha });
export const grad = (angle, color, a1, a2, color2 = color) => ({ type: 'linear', color, alpha: a1, color2, alpha2: a2, angle });
export const shadow = (alpha = 0.3, blur = 24, y = 6, color = '#000000') => ({ on: true, color, alpha, blur, x: 0, y });
export const stroke = (color, width) => ({ on: true, color, width });
export const box = (color, padX = 24, padY = 12, radius = 999, alpha = 1) => ({ mode: 'box', color, alpha, padX, padY, radius });
export const hl = (color, padX = 16, padY = 8, radius = 8, alpha = 1) => ({ mode: 'line', color, alpha, padX, padY, radius });
/** 회전된 상자 안의 한 점 (중심 기준 dx, dy) → 캔버스 좌표 */
export function at(cx, cy, dx, dy, deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}
/** 템플릿 정의 — draw(add) 안에서 레이어를 아래부터 차례로 add */
export function tpl(id, cat, name, desc, bg, draw) {
  return {
    id, cat, name, desc,
    build() {
      const pg = newPage(); pg.bg = bg;
      draw((...ls) => { pg.layers.push(...ls); return ls[ls.length - 1]; });
      return pg;
    },
  };
}
