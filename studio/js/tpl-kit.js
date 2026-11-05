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
