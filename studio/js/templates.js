/* =========================================================================
   템플릿 · 텍스트 스타일 · 도형 프리셋
   모든 글자는 '릴스+스토리 공통' 안전영역(x 65~1015, y 269~1248) 안에 들어가게 배치.
   ========================================================================= */
import { W, H, newPage, newLayer } from './core.js';
import { syncText } from './render.js';

const PINK = '#ff2e93';

function T(props, ax, ay) {
  const L = newLayer('text', props);
  L.x = ax; L.y = ay; L.w = 0; L.h = 0;
  syncText(L);
  return L;
}
const IMG = (props) => newLayer('image', props);
const SH = (props) => newLayer('shape', props);
const SOFT_SHADOW = { on: true, color: '#000000', alpha: 0.35, blur: 24, x: 0, y: 4 };

export const TEMPLATES = [
  {
    id: 'hook-top', name: '상단 훅 + 풀샷', desc: '사진 위 큰 카피 — 기본형',
    build() {
      const pg = newPage(); pg.bg = '#1a1a1a';
      pg.layers.push(IMG({ name: '배경 이미지', x: 0, y: 0, w: W, h: H, fit: 'cover' }));
      pg.layers.push(SH({ name: '상단 그라데이션', x: 0, y: 0, w: W, h: 1000, fill: { type: 'linear', color: '#000000', alpha: 0.62, color2: '#000000', alpha2: 0, angle: 180 } }));
      pg.layers.push(T({ name: '뱃지', text: '오늘만 특가', weight: 800, size: 34, color: '#ffffff', align: 'left', bg: { mode: 'box', color: PINK, alpha: 1, padX: 26, padY: 12, radius: 999 } }, 100, 330));
      pg.layers.push(T({ name: '헤드라인', text: '이 가격 실화?\n최대 70% 할인', weight: 800, size: 96, color: '#ffffff', align: 'left', lh: 1.16, tracking: -2, shadow: SOFT_SHADOW }, 100, 436));
      pg.layers.push(T({ name: '서브카피', text: '전 제품 무료배송 · 11/30까지', weight: 500, size: 40, color: '#ffffff', align: 'left', opacity: 0.92 }, 100, 700));
      return pg;
    },
  },
  {
    id: 'review', name: '리뷰 카드', desc: '후기 한 줄로 신뢰 주기',
    build() {
      const pg = newPage(); pg.bg = '#222222';
      pg.layers.push(IMG({ name: '배경 이미지', x: 0, y: 0, w: W, h: H, fit: 'cover' }));
      pg.layers.push(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: { type: 'solid', color: '#000000', alpha: 0.28 } }));
      pg.layers.push(T({ name: '상단 훅', text: '후기 4,812개가 증명해요', weight: 800, size: 52, color: '#ffffff', align: 'center', bg: { mode: 'line', color: PINK, alpha: 1, padX: 18, padY: 8, radius: 10 } }, W / 2, 330));
      pg.layers.push(SH({ name: '리뷰 카드', x: 80, y: 690, w: 920, h: 480, radius: 36, fill: { type: 'solid', color: '#ffffff', alpha: 0.95 } }));
      pg.layers.push(T({ name: '별점', text: '★★★★★', weight: 700, size: 46, color: '#fbbf24', align: 'left' }, 140, 750));
      pg.layers.push(T({ name: '리뷰', text: '“발에 착 붙어서\n하루 종일 신어도 편해요”', weight: 700, size: 54, color: '#111111', align: 'left', lh: 1.32 }, 140, 830));
      pg.layers.push(T({ name: '작성자', text: '구매자 김**님 · 재구매 3번째', weight: 500, size: 32, color: '#6b7280', align: 'left' }, 140, 1070));
      return pg;
    },
  },
  {
    id: 'sale', name: '할인 프로모션', desc: '큰 할인율 + 제품 + 가격',
    build() {
      const pg = newPage(); pg.bg = '#111111';
      pg.layers.push(T({ name: '행사명', text: 'BLACK FRIDAY', font: 'Montserrat', weight: 700, size: 40, color: '#ffffff', align: 'center', tracking: 30 }, W / 2, 300));
      pg.layers.push(T({ name: '할인율', text: '70%', font: 'Montserrat', weight: 900, size: 230, color: PINK, align: 'center', lh: 1 }, W / 2, 352));
      pg.layers.push(IMG({ name: '제품 이미지', x: 190, y: 610, w: 700, h: 500, fit: 'contain' }));
      pg.layers.push(T({ name: '가격', text: '29,900원  →  9,900원', weight: 800, size: 46, color: '#111111', align: 'center', bg: { mode: 'box', color: '#ffffff', alpha: 1, padX: 36, padY: 16, radius: 999 } }, W / 2, 1126));
      return pg;
    },
  },
  {
    id: 'launch', name: '신상품 런칭', desc: '제품명 크게 + 한 줄 설명',
    build() {
      const pg = newPage(); pg.bg = '#1a1a1a';
      pg.layers.push(IMG({ name: '배경 이미지', x: 0, y: 0, w: W, h: H, fit: 'cover' }));
      pg.layers.push(SH({ name: '하단 그라데이션', x: 0, y: 600, w: W, h: H - 600, fill: { type: 'linear', color: '#000000', alpha: 0, color2: '#000000', alpha2: 0.78, angle: 180 } }));
      pg.layers.push(T({ name: '영문 라벨', text: 'NEW ARRIVAL', font: 'Montserrat', weight: 600, size: 34, color: '#ffffff', align: 'left', tracking: 35 }, 100, 850));
      pg.layers.push(T({ name: '제품명', text: '클라우드 슬리퍼', weight: 800, size: 100, color: '#ffffff', align: 'left', lh: 1.1, tracking: -2 }, 100, 900));
      pg.layers.push(T({ name: '한 줄 설명', text: '구름 위를 걷는 착화감', weight: 700, size: 44, color: '#111111', align: 'left', bg: { mode: 'line', color: '#ffffff', alpha: 1, padX: 16, padY: 8, radius: 8 } }, 100, 1046));
      pg.layers.push(T({ name: '가격', text: '39,000원', weight: 800, size: 52, color: '#ffffff', align: 'left' }, 100, 1150));
      return pg;
    },
  },
  {
    id: 'compare', name: '비포 · 애프터', desc: '두 장을 나란히 비교',
    build() {
      const pg = newPage(); pg.bg = '#f4f1ea';
      pg.layers.push(T({ name: '제목', text: '써보면 달라요', weight: 800, size: 76, color: '#111111', align: 'center', tracking: -2 }, W / 2, 300));
      pg.layers.push(IMG({ name: 'BEFORE 이미지', x: 80, y: 450, w: 448, h: 680, radius: 28, fit: 'cover' }));
      pg.layers.push(IMG({ name: 'AFTER 이미지', x: 552, y: 450, w: 448, h: 680, radius: 28, fit: 'cover' }));
      pg.layers.push(T({ name: 'BEFORE', text: 'BEFORE', weight: 800, size: 30, color: '#ffffff', align: 'left', tracking: 6, bg: { mode: 'box', color: '#111111', alpha: 1, padX: 22, padY: 10, radius: 999 } }, 108, 478));
      pg.layers.push(T({ name: 'AFTER', text: 'AFTER', weight: 800, size: 30, color: '#ffffff', align: 'left', tracking: 6, bg: { mode: 'box', color: PINK, alpha: 1, padX: 22, padY: 10, radius: 999 } }, 580, 478));
      pg.layers.push(T({ name: '설명', text: '단 7일 만에 느끼는 변화', weight: 600, size: 40, color: '#333333', align: 'center' }, W / 2, 1160));
      return pg;
    },
  },
  {
    id: 'ugc', name: 'UGC 후기 훅', desc: '인스타 스토리 느낌 줄 배경',
    build() {
      const pg = newPage(); pg.bg = '#1a1a1a';
      pg.layers.push(IMG({ name: '배경 이미지', x: 0, y: 0, w: W, h: H, fit: 'cover' }));
      pg.layers.push(T({ name: '후기 훅', text: '솔직히 이거 써보고\n다른 거 못 쓰겠어요', weight: 800, size: 64, color: '#111111', align: 'center', lh: 1.3, bg: { mode: 'line', color: '#ffffff', alpha: 1, padX: 22, padY: 10, radius: 14 } }, W / 2, 560));
      pg.layers.push(T({ name: '출처', text: '@실사용 후기', weight: 600, size: 34, color: '#ffffff', align: 'center', shadow: SOFT_SHADOW }, W / 2, 820));
      return pg;
    },
  },
];

export const TEXT_PRESETS = [
  { id: 'h1', label: '큰 제목', props: { text: '제목을 입력하세요', weight: 800, size: 88, color: '#ffffff', align: 'center', lh: 1.18, tracking: -2, shadow: { on: true, color: '#000000', alpha: 0.3, blur: 20, x: 0, y: 4 } } },
  { id: 'h2', label: '부제목', props: { text: '부제목을 입력하세요', weight: 600, size: 48, color: '#ffffff', align: 'center' } },
  { id: 'body', label: '본문', props: { text: '본문 내용을 입력하세요', weight: 400, size: 36, color: '#ffffff', align: 'center', lh: 1.45 } },
  { id: 'box', label: '강조 박스', props: { text: '지금 구매하면 1+1', weight: 800, size: 46, color: '#111111', align: 'center', bg: { mode: 'box', color: '#ffffff', alpha: 1, padX: 28, padY: 16, radius: 14 } } },
  { id: 'line', label: '줄 하이라이트', props: { text: '오늘만 이 가격\n놓치면 후회해요', weight: 800, size: 52, color: '#ffffff', align: 'center', lh: 1.3, bg: { mode: 'line', color: PINK, alpha: 1, padX: 18, padY: 8, radius: 10 } } },
  { id: 'pill', label: '뱃지', props: { text: 'BEST', weight: 800, size: 32, color: '#ffffff', align: 'center', tracking: 4, bg: { mode: 'box', color: PINK, alpha: 1, padX: 26, padY: 12, radius: 999 } } },
  { id: 'price', label: '가격', props: { text: '9,900원', weight: 900, size: 104, color: '#ffe14d', align: 'center', stroke: { on: true, color: '#111111', width: 8 } } },
  { id: 'percent', label: '할인율', props: { text: '70%', font: 'Montserrat', weight: 900, size: 200, color: PINK, align: 'center', lh: 1 } },
  { id: 'eng', label: '영문 포인트', props: { text: 'NEW ARRIVAL', font: 'Montserrat', weight: 600, size: 34, color: '#ffffff', align: 'center', tracking: 30 } },
  { id: 'hand', label: '손글씨', props: { text: '진짜 좋아요!', font: 'Nanum Pen Script', weight: 400, size: 88, color: '#ffffff', align: 'center' } },
  { id: 'stars', label: '별점', props: { text: '★★★★★ 4.9', weight: 700, size: 46, color: '#fbbf24', align: 'center' } },
  { id: 'outline', label: '외곽선 제목', props: { text: '완판 임박', font: 'Black Han Sans', weight: 400, size: 110, color: '#ffffff', align: 'center', stroke: { on: true, color: '#000000', width: 10 } } },
];

export const SHAPE_PRESETS = [
  { id: 'rect', label: '사각형', props: { name: '사각형', w: 600, h: 300, fill: { type: 'solid', color: PINK, alpha: 1 } } },
  { id: 'round', label: '둥근 사각형', props: { name: '둥근 사각형', w: 640, h: 320, radius: 40, fill: { type: 'solid', color: '#ffffff', alpha: 0.95 } } },
  { id: 'pill', label: '알약', props: { name: '알약', w: 420, h: 110, radius: 999, fill: { type: 'solid', color: '#111111', alpha: 1 } } },
  { id: 'circle', label: '원', props: { name: '원', shape: 'ellipse', w: 360, h: 360, fill: { type: 'solid', color: PINK, alpha: 1 } } },
  { id: 'gradB', label: '아래 어둡게', back: true, props: { name: '하단 그라데이션', x: 0, y: Math.round(H * 0.42), w: W, h: Math.round(H * 0.58), fill: { type: 'linear', color: '#000000', alpha: 0, color2: '#000000', alpha2: 0.75, angle: 180 } } },
  { id: 'gradT', label: '위 어둡게', back: true, props: { name: '상단 그라데이션', x: 0, y: 0, w: W, h: Math.round(H * 0.5), fill: { type: 'linear', color: '#000000', alpha: 0.65, color2: '#000000', alpha2: 0, angle: 180 } } },
  { id: 'dim', label: '전체 어둡게', back: true, props: { name: '어둡게', x: 0, y: 0, w: W, h: H, fill: { type: 'solid', color: '#000000', alpha: 0.3 } } },
  { id: 'divider', label: '구분선', props: { name: '구분선', w: 520, h: 6, radius: 3, fill: { type: 'solid', color: '#ffffff', alpha: 0.9 } } },
];

export const SWATCHES = ['#ffffff', '#111111', '#6b7280', '#ff2e93', '#ff6b35', '#ffe14d', '#fbbf24', '#22c55e', '#22d3ee', '#3b82f6', '#a78bfa', '#f472b6', '#14b8a6', '#ef4444'];
