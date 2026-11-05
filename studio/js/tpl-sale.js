/* =========================================================================
   템플릿 — 세일 레이아웃 모음 (할인·이벤트 분류에 추가)
   블프 상하 분할 · 거대 숫자 · 정가→할인가 · 타임세일 · 품절 게이지 · 금액대별 쿠폰 · 주의 테이프 ·
   할인 영수증 · 마트 전단지 · 무료배송 · 첫 구매 · 라이브 특가 · 럭키드로우 · 시즌오프 · 홀리데이 ·
   11.11 · 연말 결산 · 신문 1면 · 쇼핑앱 화면 · 세트 할인 · 베스트 랭킹 · 번개 특가 · 앵콜 ·
   스티커 덕지덕지 · 미니멀 · 가격 하락 그래프 · SALE 반복 타이포
   글자는 안전영역(x 65~1015, y 269~1248, 오른쪽 아래 아이콘 줄 제외) 안.
   ========================================================================= */
import { W, H } from './core.js';
import { T, TB, IMG, SH, BG, SPARK, TIKTOK, centerAt, solid, grad, shadow, stroke, box, at, tpl, BLOB, HOLLOW } from './tpl-kit.js';

const INK = '#111111';
const HOT = '#ff3d8b';
const LIME = '#d8ff3c';
const RED = '#e3262f';
const CHROME_GOLD = { on: true, color2: '#fff8dc', angle: 180, chrome: true };

/** 도형 + 가운데 글자 (스티커) — 같은 각도로 회전 */
function sticker(add, name, shape, cx, cy, w, h, fill, text, t = {}, s = {}) {
  add(SH(Object.assign({ name, shape, x: cx - w / 2, y: cy - h / 2, w, h, rot: t.rot || 0, fill }, s)));
  add(centerAt(T(Object.assign({ name: name + ' 글자', text, align: 'center' }, t), 0, 0), cx, cy));
}

export const SALE2 = [
  tpl('sa-bf-split', 'sale', '블프 상하 분할', '위는 큰 타이포, 아래는 사진 — 가운데 핑크 띠', '#0d0d0d', (add) => {
    add(IMG({ name: '사진', x: 0, y: 830, w: W, h: H - 830, fit: 'cover' }));
    add(T({ name: '타이틀', text: 'BLACK\nFRIDAY', font: 'Anton', weight: 400, size: 230, color: '#ffffff', align: 'left', lh: 0.88, tracking: -2 }, 80, 272));
    add(SH({ name: '핑크 띠', x: 0, y: 724, w: W, h: 110, fill: solid(HOT) }));
    add(T({ name: '띠 문구', text: 'UP TO 70% OFF  ·  11.27 – 11.30', font: 'Montserrat', weight: 800, size: 40, color: '#ffffff', align: 'center', tracking: 2 }, W / 2, 752));
    sticker(add, '스티커', 'star', 830, 1000, 260, 260, solid(LIME), '최대\n70%', { font: 'Black Han Sans', weight: 400, size: 60, color: INK, lh: 1, rot: 10 }, { points: 20, inner: 0.86 });
    add(T({ name: '하단 문구', text: '전 품목 블프 특가 · 무료배송', weight: 800, size: 36, color: INK, align: 'left', bg: box('#ffffff', 24, 12) }, 90, 1100));
  }),

  tpl('sa-giant', 'sale', '거대 숫자', '사진 위에 거대한 % — 외곽선 + 채움 겹치기', '#111111', (add) => {
    add(BG('사진'));
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: grad(180, '#000000', 0.6, 0.2) }));
    add(T({ name: '라벨', text: 'SEASON OFF SALE', font: 'Montserrat', weight: 700, size: 34, color: '#ffffff', align: 'left', tracking: 10 }, 90, 296));
    add(T({ name: '숫자 외곽선', text: '70', font: 'Anton', weight: 400, size: 560, color: '#ffffff', align: 'left', lh: 0.9, hollow: HOLLOW(4) }, 104, 374));
    add(T({ name: '숫자', text: '70', font: 'Anton', weight: 400, size: 560, color: '#ffffff', align: 'left', lh: 0.9 }, 80, 350));
    add(T({ name: '퍼센트', text: '%', font: 'Anton', weight: 400, size: 240, color: HOT, align: 'left', lh: 0.95 }, 640, 380));
    add(T({ name: 'OFF', text: 'OFF', font: 'Anton', weight: 400, size: 140, color: '#ffffff', align: 'left', lh: 0.95 }, 646, 620));
    add(T({ name: '설명', text: '전 품목 최대 70% · 오늘 자정까지', weight: 700, size: 38, color: '#ffffff', align: 'left' }, 90, 910));
    add(T({ name: '버튼', text: '지금 쇼핑하기 →', weight: 800, size: 36, color: INK, align: 'left', bg: box('#ffffff', 30, 16) }, 90, 990));
  }),

  tpl('sa-strike', 'sale', '정가 → 할인가', '취소선 정가 + 큰 할인가 + % 원형 뱃지', '#f5f1ea', (add) => {
    add(IMG({ name: '제품 사진', x: 90, y: 290, w: 900, h: 620, radius: 32, fit: 'cover' }));
    sticker(add, '% 뱃지', 'ellipse', 885, 395, 190, 190, solid(HOT), '49%', { font: 'Archivo Black', weight: 400, size: 62, color: '#ffffff' });
    add(T({ name: '상품명', text: '실버 하트 레이어드 링', weight: 700, size: 44, color: INK, align: 'left' }, 90, 944));
    add(T({ name: '무료배송', text: '무료배송', weight: 700, size: 28, color: '#ffffff', align: 'right', bg: box(INK, 18, 8) }, 990, 950));
    add(T({ name: '정가', text: '39,000원', weight: 500, size: 40, color: '#a39a8e', align: 'left', strike: true }, 90, 1016));
    add(T({ name: '할인가', text: '19,900원', weight: 900, size: 96, color: HOT, align: 'left', tracking: -2 }, 86, 1066));
  }),

  tpl('sa-timesale', 'sale', '타임세일 카운트다운', '시계 숫자 카운트다운 + 마감 시간', '#ff3b30', (add) => {
    add(T({ name: '라벨', text: '⏰ TIME SALE', font: 'Montserrat', weight: 900, size: 66, color: '#ffffff', align: 'center', tracking: 2 }, W / 2, 284));
    add(T({ name: '부제', text: '오늘 밤 12시에 끝나요', weight: 700, size: 36, color: '#ffffff', align: 'center', opacity: 0.92 }, W / 2, 382));
    [['02', 'HOURS'], ['14', 'MIN'], ['33', 'SEC']].forEach(([n, u], i) => {
      const x = 110 + i * 315;
      add(SH({ name: `${u} 칸`, x, y: 456, w: 230, h: 200, radius: 24, fill: solid(INK) }));
      add(centerAt(T({ name: `${u} 숫자`, text: n, font: 'Space Grotesk', weight: 700, size: 136, color: '#ffffff', align: 'center' }, 0, 0), x + 115, 556));
      add(T({ name: `${u} 단위`, text: u, font: 'Montserrat', weight: 700, size: 22, color: '#ffffff', align: 'center', tracking: 6, opacity: 0.85 }, x + 115, 668));
      if (i < 2) add(centerAt(T({ name: `콜론${i + 1}`, text: ':', font: 'Space Grotesk', weight: 700, size: 100, color: '#ffffff', align: 'center' }, 0, 0), x + 272, 550));
    });
    add(IMG({ name: '제품 사진', x: 90, y: 730, w: 900, h: 400, radius: 28, fit: 'cover' }));
    add(T({ name: '가격', text: '29,900원  →  9,900원', weight: 800, size: 44, color: INK, align: 'center', bg: box('#ffffff', 36, 16) }, W / 2, 1090));
  }),

  tpl('sa-gauge', 'sale', '품절 임박 게이지', '판매율 게이지 바 + 남은 수량', '#111111', (add) => {
    add(BG('제품 사진'));
    add(SH({ name: '아래 어둡게', x: 0, y: 640, w: W, h: H - 640, fill: grad(180, '#000000', 0, 0.86) }));
    add(T({ name: '상단 라벨', text: '🔥 품절 임박', weight: 800, size: 40, color: '#ffffff', align: 'left', bg: box('#ff3b30', 22, 10) }, 90, 300));
    add(T({ name: '훅', text: '벌써 87% 팔렸어요', weight: 900, size: 78, color: '#ffffff', align: 'left', tracking: -2 }, 90, 812));
    add(SH({ name: '게이지 바탕', x: 90, y: 938, w: 900, h: 40, radius: 20, fill: solid('#ffffff', 0.25) }));
    add(SH({ name: '게이지', x: 90, y: 938, w: 783, h: 40, radius: 20, fill: grad(90, '#ff9f0a', 1, 1, '#ff3b30') }));
    add(T({ name: '남은 수량', text: '남은 수량 13개', weight: 700, size: 34, color: '#ffffff', align: 'left' }, 90, 1000));
    add(T({ name: '판매율', text: '87%', font: 'Space Grotesk', weight: 700, size: 34, color: '#ff9f0a', align: 'right' }, 990, 1000));
    add(T({ name: '가격', text: '지금 9,900원', weight: 900, size: 58, color: '#ffffff', align: 'left' }, 90, 1058));
  }),

  tpl('sa-tiers', 'sale', '금액대별 쿠폰', '많이 살수록 더 큰 쿠폰 — 티켓 3장', '#f2ede6', (add) => {
    add(T({ name: '제목', text: '많이 살수록\n더 할인 💸', weight: 900, size: 78, color: INK, align: 'left', lh: 1.15, tracking: -2 }, 90, 286));
    add(IMG({ name: '제품 사진', mask: 'ellipse', x: 690, y: 290, w: 300, h: 300, fit: 'cover', stroke: stroke('#ffffff', 8) }));
    [['5만원 이상', '5,000원', '#ffffff', INK], ['10만원 이상', '12,000원', '#ffffff', INK], ['15만원 이상', '20,000원', HOT, '#ffffff']].forEach(([k, v, bg, fg], i) => {
      const y = 620 + i * 180;
      add(SH({ name: `쿠폰${i + 1}`, shape: 'ticket', x: 90, y, w: 900, h: 160, radius: 24, fill: solid(bg), shadow: shadow(0.08, 20, 6) }));
      add(T({ name: `쿠폰${i + 1} 조건`, text: k, weight: 600, size: 28, color: fg, align: 'left', opacity: 0.75 }, 150, y + 26));
      add(T({ name: `쿠폰${i + 1} 금액`, text: v, weight: 900, size: 62, color: fg, align: 'left', tracking: -1.5 }, 150, y + 62));
      add(T({ name: `쿠폰${i + 1} 받기`, text: '쿠폰 받기 ↓', weight: 700, size: 28, color: fg, align: 'right' }, 930, y + 64));
    });
  }),

  tpl('sa-caution', 'sale', '주의 테이프', '노랑·검정 경고 테이프가 가로지르는 세일', '#111111', (add) => {
    add(BG('제품 사진'));
    add(SH({ name: '살짝 어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.15) }));
    const tape = (name, cy, deg, text) => {
      const w = 1500, h = 124, cx = W / 2;
      add(SH({ name, x: cx - w / 2, y: cy - h / 2, w, h, rot: deg, fill: solid('#ffd60a'), shadow: shadow(0.35, 20, 8) }));
      for (const dy of [-h / 2 + 13, h / 2 - 13]) {
        const [bx, by] = at(cx, cy, 0, dy, deg);
        add(SH({ name: name + ' 줄무늬', shape: 'stripes', inner: 1, x: bx - w / 2, y: by - 13, w, h: 26, rot: deg, fill: solid(INK) }));
      }
      add(centerAt(T({ name: name + ' 글자', text, font: 'Archivo Black', weight: 400, size: 48, color: INK, align: 'center', tracking: 2, rot: deg }, 0, 0), cx, cy));
    };
    tape('테이프1', 520, -9, '⚠ 품절 주의 ⚠');
    tape('테이프2', 860, 7, 'SALE UP TO 70%');
    add(T({ name: '가격', text: '29,900원  →  9,900원', weight: 800, size: 44, color: INK, align: 'center', bg: box('#ffffff', 36, 16) }, W / 2, 1060));
  }),

  tpl('sa-receipt', 'sale', '할인 영수증', '영수증처럼 — 할인 내역과 총 할인 금액', '#d9d4cc', (add) => {
    add(SH({ name: '영수증', x: 110, y: 290, w: 640, h: 940, fill: solid('#fffdf8'), shadow: shadow(0.2, 30, 10) }));
    add(IMG({ name: '사진', x: 690, y: 320, w: 280, h: 340, rot: 8, fit: 'cover', stroke: stroke('#ffffff', 12), shadow: shadow(0.2, 24, 8) }));
    add(SH({ name: '집게', x: 760, y: 300, w: 120, h: 34, radius: 6, rot: 8, fill: solid('#9ca3af') }));
    const R = (props) => Object.assign({ font: 'Space Grotesk', color: INK }, props);
    add(T(R({ name: '영수증 제목', text: 'SALE RECEIPT', weight: 700, size: 46, align: 'center' }), 430, 330));
    add(T(R({ name: '날짜', text: '2026.11.27 · BLACK FRIDAY', weight: 500, size: 24, align: 'center', color: '#7a7a7a' }), 430, 396));
    const dash = (name, y) => add(T(R({ name, text: '- - - - - - - - - - - - - - - - - - - - -', weight: 500, size: 24, align: 'center', color: '#9a9a9a' }), 430, y));
    dash('점선1', 440);
    [['실버 하트 링', '39,000', INK], ['블프 할인 (-49%)', '-19,100', HOT], ['쿠폰 할인', '-3,000', HOT], ['배송비', '0', INK]].forEach(([k, v, c], i) => {
      add(T(R({ name: `항목${i + 1}`, text: k, weight: 500, size: 30, align: 'left', color: c }), 160, 486 + i * 56));
      add(T(R({ name: `항목${i + 1} 금액`, text: v, weight: 600, size: 30, align: 'right', color: c }), 700, 486 + i * 56));
    });
    dash('점선2', 714);
    add(T(R({ name: '합계', text: 'TOTAL', weight: 700, size: 44, align: 'left' }), 160, 758));
    add(T(R({ name: '합계 금액', text: '16,900원', weight: 700, size: 44, align: 'right' }), 700, 758));
    add(T({ name: '절약', text: '총 22,100원 아꼈어요 🎉', weight: 800, size: 34, color: HOT, align: 'center' }, 430, 850));
    add(SH({ name: '바코드', shape: 'barcode', x: 200, y: 930, w: 460, h: 110, fill: solid(INK) }));
    add(T(R({ name: '안내', text: '* 오늘 밤 12시까지', weight: 500, size: 24, align: 'center', color: '#7a7a7a' }), 430, 1066));
  }),

  tpl('sa-flyer', 'sale', '마트 전단지', '빨강·노랑 전단지 — 상품 4칸 + 가격 별 스티커', '#ffe14d', (add) => {
    add(SH({ name: '머리 띠', x: 0, y: 270, w: W, h: 150, fill: solid(RED) }));
    add(T({ name: '제목', text: '파격 특가 대방출!!', font: 'TmonMonsori', weight: 400, size: 86, color: '#fff04d', align: 'center', stroke: stroke(INK, 8) }, W / 2, 286));
    add(T({ name: '기간', text: '11.27(금) ~ 11.30(월) 단 4일!', weight: 800, size: 36, color: INK, align: 'center' }, W / 2, 440));
    [['실버 하트 링', '9,900원', '-50%'], ['볼드 체인 링', '12,900원', '-40%'], ['스타 포인트 링', '7,900원', '-60%'], ['레이어드 3종', '19,900원', '1+1']].forEach(([n, p, b], i) => {
      const x = 90 + (i % 2) * 460, y = 510 + Math.floor(i / 2) * 360;
      add(SH({ name: `상품${i + 1} 칸`, x, y, w: 440, h: 340, radius: 20, fill: solid('#ffffff'), stroke: stroke(INK, 4) }));
      add(IMG({ name: `상품${i + 1} 사진`, x: x + 16, y: y + 16, w: 408, h: 190, radius: 12, fit: 'cover' }));
      add(T({ name: `상품${i + 1} 이름`, text: n, weight: 700, size: 30, color: INK, align: 'left' }, x + 24, y + 218));
      add(T({ name: `상품${i + 1} 가격`, text: p, font: 'Black Han Sans', weight: 400, size: 58, color: RED, align: 'left' }, x + 22, y + 258));
      sticker(add, `상품${i + 1} 스티커`, 'star', x + 392, y + 28, 130, 130, solid(LIME), b, { font: 'Archivo Black', weight: 400, size: 32, color: INK, rot: 12 }, { points: 14, inner: 0.8, stroke: stroke(INK, 3) });
    });
  }),

  tpl('sa-freeship', 'sale', '무료배송 데이', '트럭 이모지 + 사선 줄무늬 — 전 상품 무료배송', '#2b59ff', (add) => {
    add(SH({ name: '줄무늬', shape: 'stripes', inner: 0.035, x: 0, y: 0, w: W, h: H, fill: solid('#ffffff', 0.08) }));
    add(T({ name: '라벨', text: 'FREE SHIPPING DAY', font: 'Montserrat', weight: 800, size: 36, color: '#ffffff', align: 'center', tracking: 8 }, W / 2, 300));
    add(T({ name: '타이틀', text: '전 상품\n무료배송', font: 'Black Han Sans', weight: 400, size: 172, color: '#ffffff', align: 'center', lh: 1.02 }, W / 2, 372));
    add(T({ name: '트럭', text: '🚚💨', size: 150, align: 'center' }, W / 2, 742));
    add(T({ name: '혜택', text: '오늘 하루만 · 1개만 사도 무료', weight: 800, size: 42, color: '#2b59ff', align: 'center', bg: box('#ffffff', 34, 16) }, W / 2, 960));
    add(T({ name: '기간', text: '11.27  00:00 – 23:59', font: 'Space Grotesk', weight: 600, size: 32, color: '#ffffff', align: 'center', opacity: 0.85 }, W / 2, 1064));
  }),

  tpl('sa-first', 'sale', '첫 구매 혜택', 'WELCOME — 첫 구매 쿠폰 티켓 + 아치 사진', '#fbeee6', (add) => {
    add(T({ name: '라벨', text: 'Welcome', font: 'Instrument Serif', italic: true, weight: 400, size: 124, color: '#b0344f', align: 'center' }, W / 2, 268));
    add(T({ name: '부제', text: '처음 오셨다면 이것부터 받아 가세요', weight: 600, size: 34, color: '#7a2a3d', align: 'center' }, W / 2, 424));
    add(IMG({ name: '사진', mask: 'arch', x: 290, y: 490, w: 500, h: 440, fit: 'cover' }));
    add(SH({ name: '쿠폰', shape: 'ticket', x: 150, y: 880, w: 780, h: 230, radius: 26, fill: solid('#b0344f'), shadow: shadow(0.25, 30, 10) }));
    add(T({ name: '쿠폰 라벨', text: '첫 구매 쿠폰', weight: 700, size: 32, color: '#ffe4ec', align: 'left' }, 220, 914));
    add(T({ name: '쿠폰 금액', text: '70% OFF', font: 'Archivo Black', weight: 400, size: 92, color: '#ffffff', align: 'left' }, 216, 956));
    add(T({ name: '쿠폰 받기', text: '받기 ↓', weight: 800, size: 34, color: '#ffe4ec', align: 'right' }, 870, 990));
  }),

  tpl('sa-live', 'sale', '라이브 특가', '라이브 방송 화면 — LIVE·시청자·채팅·고정 상품', '#111111', (add) => {
    add(BG('방송 화면 사진'));
    add(SH({ name: '아래 어둡게', x: 0, y: 760, w: W, h: H - 760, fill: grad(180, '#000000', 0, 0.75) }));
    add(T({ name: 'LIVE', text: 'LIVE', font: 'Montserrat', weight: 800, size: 30, color: '#ffffff', align: 'left', tracking: 2, bg: box('#ff2d55', 16, 8, 8) }, 90, 300));
    add(T({ name: '시청자', text: '👁 1.2만', weight: 700, size: 30, color: '#ffffff', align: 'left', bg: box('#000000', 16, 8, 8, 0.45) }, 214, 300));
    ['yoon_   이거 925 맞죠??', 'min.j   링크 주세요 ㅠㅠ', 'seo.yeon   방금 2개 삼 🛒'].forEach((t, i) =>
      add(T({ name: `채팅${i + 1}`, text: t, weight: 600, size: 32, color: '#ffffff', align: 'left', shadow: shadow(0.6, 8, 1) }, 90, 760 + i * 58)));
    add(SH({ name: '고정 상품', x: 90, y: 950, w: 760, h: 150, radius: 24, fill: solid('#ffffff', 0.96) }));
    add(IMG({ name: '고정 상품 사진', x: 106, y: 966, w: 118, h: 118, radius: 14, fit: 'cover' }));
    add(T({ name: '라이브 특가', text: '라이브 특가', weight: 800, size: 26, color: '#ff2d55', align: 'left' }, 248, 976));
    add(T({ name: '상품', text: '실버 하트 링  9,900원', weight: 800, size: 36, color: INK, align: 'left' }, 248, 1014));
    add(T({ name: '구매', text: '구매', weight: 800, size: 28, color: '#ffffff', align: 'right', bg: box('#ff2d55', 20, 10) }, 830, 1004));
  }),

  tpl('sa-lucky', 'sale', '럭키드로우', '구매하면 추첨 — 골드 크롬 제목 + 경품 리스트', '#4c1d95', (add) => {
    add(BLOB(200, 500, 820, '#a855f7', 180, 0.8));
    add(BLOB(920, 1000, 820, '#ec4899', 180, 0.6, '오라2'));
    [[110, 540, 46], [975, 560, 60], [130, 720, 34], [955, 730, 42]].forEach(([x, y, s], i) => add(SPARK(x, y, s, '#ffe9a8', 0, `반짝이${i + 1}`)));
    add(T({ name: '타이틀', text: 'LUCKY DRAW', font: 'Unbounded', weight: 900, size: 100, color: '#c99a2e', align: 'center', tracking: -2, grad: CHROME_GOLD }, W / 2, 284));
    add(T({ name: '부제', text: '구매만 해도 자동 응모 🎁', weight: 700, size: 38, color: '#ffffff', align: 'center' }, W / 2, 428));
    add(T({ name: '선물', text: '🎁', size: 200, align: 'center' }, W / 2, 500));
    add(SH({ name: '경품 카드', x: 140, y: 770, w: 800, h: 330, radius: 32, fill: solid('#ffffff', 0.96) }));
    [['1등', '14K 골드 링 (1명)'], ['2등', '실버 레이어드 세트 (5명)'], ['3등', '5천원 쿠폰 (100명)']].forEach(([r, p], i) => {
      add(T({ name: `${r}`, text: r, weight: 800, size: 30, color: '#ffffff', align: 'left', bg: box(i ? '#8b5cf6' : HOT, 16, 6) }, 196, 818 + i * 92));
      add(T({ name: `${r} 경품`, text: p, weight: 700, size: 34, color: INK, align: 'left' }, 300, 814 + i * 92));
    });
  }),

  tpl('sa-seasonoff', 'sale', '시즌오프 에디토리얼', '세리프 큰 제목 + 아치 사진 — 고급스러운 세일', '#efe9e1', (add) => {
    add(T({ name: '제목', text: 'Season\nOff', font: 'Instrument Serif', italic: true, weight: 400, size: 176, color: '#2b2420', align: 'left', lh: 0.88 }, 76, 276));
    add(T({ name: '할인', text: 'up to\n50%', font: 'Instrument Serif', weight: 400, size: 70, color: '#2b2420', align: 'right', lh: 1 }, 990, 300));
    add(IMG({ name: '사진', mask: 'arch', x: 230, y: 620, w: 620, h: 530, fit: 'cover' }));
    add(T({ name: '기간', text: '11.27 — 12.03  ·  ALL ITEMS', font: 'Montserrat', weight: 500, size: 24, color: '#2b2420', align: 'center', tracking: 8 }, W / 2, 1180));
  }),

  tpl('sa-holiday', 'sale', '홀리데이 세일', '크리스마스 무드 — 딥그린·골드 + 눈 반짝이', '#0f3d2e', (add) => {
    [[110, 470, 30], [960, 470, 42], [110, 700, 24], [970, 720, 30], [170, 1000, 36], [920, 1010, 26]].forEach(([x, y, s], i) => add(SPARK(x, y, s, '#fff7e8', 0, `눈${i + 1}`)));
    add(T({ name: '제목', text: 'Holiday Sale', font: 'Pacifico', weight: 400, size: 112, color: '#fff7e8', align: 'center' }, W / 2, 300));
    add(T({ name: '부제', text: '선물 포장 무료 · 최대 40%', weight: 700, size: 36, color: '#e9c46a', align: 'center' }, W / 2, 470));
    add(IMG({ name: '사진', x: 240, y: 560, w: 600, h: 480, radius: 30, fit: 'cover', stroke: stroke('#e9c46a', 8) }));
    add(T({ name: '리본', text: '🎀', size: 120, align: 'center', rot: -14 }, 260, 500));
    add(T({ name: '안내', text: '크리스마스 전 도착 보장 🎄', weight: 700, size: 32, color: '#0f3d2e', align: 'center', bg: box('#fff7e8', 28, 14) }, W / 2, 1090));
  }),

  tpl('sa-1111', 'sale', '11.11 데이', '11.11 숫자 그래픽 — 11% + 11,000원 쿠폰', '#fff6d6', (add) => {
    add(T({ name: '숫자', text: '11.11', font: 'Anton', weight: 400, size: 300, color: RED, align: 'center', lh: 0.95 }, W / 2, 272));
    add(T({ name: '부제', text: '과자 말고 반지 주는 날 💍', weight: 800, size: 46, color: INK, align: 'center' }, W / 2, 576));
    add(IMG({ name: '사진', x: 140, y: 680, w: 800, h: 420, radius: 30, fit: 'cover' }));
    add(T({ name: '혜택1', text: '전 품목 11%', weight: 800, size: 38, color: '#ffffff', align: 'center', bg: box(RED, 26, 14) }, 330, 1036));
    add(T({ name: '혜택2', text: '+ 11,000원 쿠폰', weight: 800, size: 38, color: INK, align: 'center', bg: box('#ffffff', 26, 14) }, 740, 1036));
  }),

  tpl('sa-yearend', 'sale', '연말 결산 세일', '2026 마지막 세일 — 외곽선 연도 + 형광 타이틀', '#111111', (add) => {
    add(T({ name: '연도', text: '2026', font: 'Anton', weight: 400, size: 330, color: '#ffffff', align: 'center', lh: 0.9, hollow: HOLLOW(3) }, W / 2, 272));
    add(T({ name: '타이틀', text: 'LAST SALE', font: 'Anton', weight: 400, size: 156, color: LIME, align: 'center', lh: 1 }, W / 2, 470));
    add(IMG({ name: '사진', x: 90, y: 680, w: 900, h: 400, radius: 24, fit: 'cover' }));
    add(T({ name: '설명', text: '올해 마지막 최대 60% · 12.31까지', weight: 700, size: 36, color: '#ffffff', align: 'center' }, W / 2, 1120));
  }),

  tpl('sa-news', 'sale', '신문 1면', '신문 헤드라인처럼 — 전 품목 할인 단행', '#f3eee3', (add) => {
    add(T({ name: '제호', text: 'The Sale Times', font: 'Playfair Display', weight: 900, size: 92, color: INK, align: 'center' }, W / 2, 272));
    add(SH({ name: '제호 아래 선', x: 70, y: 396, w: 940, h: 4, fill: solid(INK) }));
    add(T({ name: '날짜줄', text: 'VOL. 11  ·  2026년 11월 27일 금요일  ·  특별판', weight: 600, size: 22, color: INK, align: 'center', tracking: 2 }, W / 2, 410));
    add(SH({ name: '날짜줄 아래 선', x: 70, y: 448, w: 940, h: 2, fill: solid(INK) }));
    add(T({ name: '헤드라인', text: '전 품목 70% 할인 단행…\n“이런 가격 다시 없다”', font: 'Noto Serif KR', weight: 900, size: 62, color: INK, align: 'left', lh: 1.22 }, 80, 474));
    add(IMG({ name: '사진', x: 80, y: 660, w: 600, h: 430, fit: 'cover', adj: { b: 100, c: 108, s: 0 } }));
    add(T({ name: '사진 설명', text: '▲ 블프 첫날 주문이 몰린 실버 링 (자료사진)', weight: 500, size: 22, color: '#555555', align: 'left' }, 80, 1102));
    add(TB({ name: '기사', text: '[단독] 6A가 블랙프라이데이를 맞아 전 품목 최대 70% 할인에 나섰다. 925 실버 반지와 레이어드 세트가 대상이며, 행사는 30일까지 이어진다.', font: 'Noto Serif KR', weight: 400, size: 26, color: '#222222', align: 'left', lh: 1.62 }, 712, 662, 296));
  }),

  tpl('sa-app', 'sale', '쇼핑앱 상품 화면', '쇼핑앱 상세 화면처럼 — 할인율·가격·쿠폰 버튼', '#ffffff', (add) => {
    add(IMG({ name: '상품 사진', x: 0, y: 0, w: W, h: 860, fit: 'cover' }));
    add(T({ name: '브랜드', text: '6A  ›', weight: 700, size: 32, color: INK, align: 'left' }, 70, 888));
    add(T({ name: '상품명', text: '실버 하트 레이어드 링 (925)', weight: 500, size: 38, color: INK, align: 'left' }, 70, 936));
    add(T({ name: '정가', text: '39,000원', weight: 500, size: 30, color: '#a3a3a3', align: 'left', strike: true }, 70, 998));
    add(T({ name: '할인율', text: '49%', weight: 900, size: 56, color: '#ff2d55', align: 'left' }, 70, 1038));
    add(T({ name: '판매가', text: '19,900원', weight: 900, size: 56, color: INK, align: 'left' }, 214, 1038));
    add(T({ name: '별점', text: '★ 4.9 (1,203)  ·  무료배송', weight: 600, size: 28, color: '#6b6b6b', align: 'left' }, 70, 1124));
    add(SH({ name: '쿠폰 버튼', x: 640, y: 1000, w: 350, h: 96, radius: 16, fill: solid(INK) }));
    add(centerAt(T({ name: '쿠폰 버튼 글자', text: '쿠폰 받기 ↓', weight: 800, size: 34, color: '#ffffff', align: 'center' }, 0, 0), 815, 1048));
  }),

  tpl('sa-bundle', 'sale', '세트 할인 공식', '상품 3개 + = 세트가 — 따로 사면 vs 세트', '#f6f3ee', (add) => {
    add(T({ name: '제목', text: '같이 사면 더 싸요', weight: 900, size: 72, color: INK, align: 'center', tracking: -2 }, W / 2, 286));
    [['하트 링', 90], ['체인 링', 415], ['볼 링', 740]].forEach(([n, x], i) => {
      add(IMG({ name: `${n} 사진`, mask: 'ellipse', x, y: 420, w: 250, h: 250, fit: 'cover', stroke: stroke('#ffffff', 8) }));
      add(T({ name: n, text: n, weight: 600, size: 30, color: '#333333', align: 'center' }, x + 125, 690));
      if (i < 2) add(centerAt(T({ name: `더하기${i + 1}`, text: '+', font: 'Montserrat', weight: 300, size: 80, color: INK, align: 'center' }, 0, 0), x + 287, 545));
    });
    add(centerAt(T({ name: '같다', text: '=', font: 'Montserrat', weight: 300, size: 90, color: INK, align: 'center' }, 0, 0), W / 2, 790));
    add(SH({ name: '세트 카드', x: 140, y: 860, w: 800, h: 260, radius: 32, fill: solid(INK) }));
    add(T({ name: '따로 라벨', text: '따로 사면', weight: 600, size: 28, color: '#9ca3af', align: 'left' }, 200, 902));
    add(T({ name: '따로 가격', text: '58,500원', weight: 600, size: 40, color: '#9ca3af', align: 'left', strike: true }, 200, 944));
    add(T({ name: '세트 라벨', text: '세트가', weight: 700, size: 28, color: LIME, align: 'left' }, 520, 902));
    add(T({ name: '세트 가격', text: '39,900원', weight: 900, size: 66, color: '#ffffff', align: 'left', tracking: -1.5 }, 516, 940));
    add(T({ name: '할인율', text: '-32%', font: 'Archivo Black', weight: 400, size: 30, color: '#ffffff', align: 'left', bg: box(HOT, 16, 8) }, 200, 1030));
  }),

  tpl('sa-rank', 'sale', '베스트 랭킹 할인', '판매 1·2·3위를 할인가와 함께', '#111111', (add) => {
    add(T({ name: '제목', text: 'BEST 3 할인 중 🏆', weight: 900, size: 64, color: '#ffffff', align: 'left', tracking: -1.5 }, 90, 286));
    [['1', '#ffd60a', '실버 하트 링', '39,000원', '19,900원'], ['2', '#e5e5e5', '볼드 체인 링', '45,000원', '27,000원'], ['3', '#d4915a', '스타 포인트 링', '29,000원', '14,900원']].forEach(([n, c, name, was, now], i) => {
      const y = 400 + i * 240;
      add(T({ name: `${n}위`, text: n, font: 'Anton', weight: 400, size: 150, color: c, align: 'center', lh: 1 }, 150, y + 30));
      add(IMG({ name: `${n}위 사진`, x: 230, y, w: 220, h: 220, radius: 20, fit: 'cover' }));
      add(T({ name: `${n}위 이름`, text: name, weight: 700, size: 36, color: '#ffffff', align: 'left' }, 484, y + 26));
      add(T({ name: `${n}위 정가`, text: was, weight: 500, size: 30, color: '#8a8a8a', align: 'left', strike: true }, 484, y + 84));
      add(T({ name: `${n}위 할인가`, text: now, weight: 900, size: 56, color: i ? '#ffffff' : HOT, align: 'left' }, 484, y + 124));
    });
  }),

  tpl('sa-flash', 'sale', '번개 특가', '흑백 사진 + 형광 굵은 글자 — 딱 3시간', '#111111', (add) => {
    add(IMG({ name: '사진', x: 0, y: 0, w: W, h: H, fit: 'cover', adj: { b: 100, c: 115, s: 0 } }));
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.32) }));
    add(T({ name: '타이틀', text: '번개\n특가', font: 'Black Han Sans', weight: 400, size: 236, color: LIME, align: 'left', lh: 0.95, rot: -4 }, 90, 440));
    add(T({ name: '번개', text: '⚡', size: 220, align: 'center', rot: 12 }, 800, 470));
    add(T({ name: '시간', text: '딱 3시간 · 오후 6시–9시', weight: 800, size: 40, color: INK, align: 'left', bg: box(LIME, 24, 12) }, 96, 948));
    add(T({ name: '가격', text: '전 품목 9,900원', weight: 900, size: 66, color: '#ffffff', align: 'left' }, 90, 1040));
  }),

  tpl('sa-encore', 'sale', '앵콜 세일', '요청 폭주 — ENCORE 도장 + 3일 더', '#f0ebe3', (add) => {
    add(IMG({ name: '사진', x: 90, y: 300, w: 900, h: 620, radius: 28, fit: 'cover' }));
    add(SH({ name: '도장 테두리', shape: 'ellipse', x: 640, y: 560, w: 330, h: 330, rot: -14, fill: solid('#ffffff', 0.18), stroke: stroke('#d1202f', 8) }));
    add(centerAt(T({ name: '도장', text: 'ENCORE\n앵콜', font: 'Archivo Black', weight: 400, size: 62, color: '#d1202f', align: 'center', lh: 1.05, rot: -14 }, 0, 0), 805, 725));
    add(T({ name: '훅', text: '요청 폭주로 3일 더!', weight: 900, size: 74, color: INK, align: 'left', tracking: -2 }, 90, 958));
    add(T({ name: '설명', text: '지난 블프 가격 그대로 · 12.01 – 12.03', weight: 600, size: 34, color: '#6b6258', align: 'left' }, 90, 1062));
  }),

  tpl('sa-stickers', 'sale', '할인 스티커 덕지덕지', '사진 위에 % 스티커를 마구 — B급 감성', '#111111', (add) => {
    add(BG('제품 사진'));
    sticker(add, '50% 스티커', 'star', 250, 470, 300, 300, solid(LIME), '50%', { font: 'Archivo Black', weight: 400, size: 88, color: INK, rot: -12 }, { points: 18, inner: 0.84 });
    sticker(add, 'SALE 스티커', 'ellipse', 800, 420, 240, 240, solid(HOT), 'SALE', { font: 'Archivo Black', weight: 400, size: 62, color: '#ffffff', rot: 10 });
    sticker(add, '무배 스티커', 'heart', 300, 860, 260, 236, solid('#ff8cc6'), '무배', { font: 'Black Han Sans', weight: 400, size: 72, color: '#ffffff', rot: -6 });
    sticker(add, '1+1 스티커', 'ticket', 760, 840, 330, 160, solid('#ffe14d'), '1+1', { font: 'Archivo Black', weight: 400, size: 84, color: INK, rot: 8 }, { radius: 16 });
    sticker(add, 'D-1 스티커', 'rect', 540, 1060, 300, 110, solid(INK), 'D-1', { font: 'Archivo Black', weight: 400, size: 64, color: LIME }, { radius: 55 });
    add(TIKTOK('자막', '할인 너무 많아서 정리 못 함 ㅋㅋ', W / 2, 1150, 38));
  }),

  tpl('sa-minimal', 'sale', '미니멀 세일', '여백 많은 흰 화면 — 작은 글자, 큰 사진', '#ffffff', (add) => {
    add(T({ name: '브랜드', text: '6A', font: 'Montserrat', weight: 600, size: 28, color: INK, align: 'left', tracking: 8 }, 90, 292));
    add(T({ name: '할인', text: '−30%', font: 'Inter', weight: 300, size: 30, color: INK, align: 'right', tracking: 2 }, 990, 292));
    add(IMG({ name: '사진', x: 190, y: 400, w: 700, h: 640, fit: 'cover' }));
    add(T({ name: '카피', text: 'quiet season sale', font: 'Instrument Serif', italic: true, weight: 400, size: 66, color: INK, align: 'center' }, W / 2, 1076));
    add(T({ name: '기간', text: '11.27 – 12.03  ·  ALL ITEMS', font: 'Montserrat', weight: 500, size: 22, color: '#6b6b6b', align: 'center', tracking: 6 }, W / 2, 1180));
  }),

  tpl('sa-drop', 'sale', '가격 하락 그래프', '가격이 계단처럼 떨어지는 차트 + 손그림 화살표', '#ffffff', (add) => {
    add(T({ name: '제목', text: '가격 계속 내려가는 중 📉', weight: 900, size: 58, color: INK, align: 'left', tracking: -1.5 }, 90, 286));
    [['정가', '39,000', 360], ['1차', '29,900', 276], ['2차', '19,900', 184], ['블프', '9,900', 92]].forEach(([k, p, hh], i) => {
      const x = 120 + i * 220;
      add(SH({ name: `${k} 막대`, x, y: 900 - hh, w: 180, h: hh, radius: 14, fill: solid(i === 3 ? HOT : '#e5e1da') }));
      add(T({ name: `${k} 가격`, text: p, font: 'Space Grotesk', weight: 700, size: 36, color: i === 3 ? HOT : '#555555', align: 'center' }, x + 90, 900 - hh - 54));
      add(T({ name: k, text: k, weight: 700, size: 30, color: '#555555', align: 'center' }, x + 90, 916));
    });
    add(SH({ name: '손그림 화살표', shape: 'arrow', thick: 8, x: 380, y: 260, w: 260, h: 520, rot: 90, fill: solid(HOT) }));
    add(IMG({ name: '제품 사진', x: 90, y: 990, w: 220, h: 220, radius: 20, fit: 'cover' }));
    add(T({ name: '지금 가격', text: '지금 9,900원', weight: 900, size: 60, color: HOT, align: 'left' }, 340, 1010));
    add(T({ name: '기간', text: '블프 기간 한정 · 11.30까지', weight: 600, size: 30, color: '#6b6b6b', align: 'left' }, 342, 1096));
  }),

  tpl('sa-echo', 'sale', 'SALE 반복 타이포', 'SALE을 외곽선으로 반복 — 가운데 사진', '#ff3d8b', (add) => {
    for (let i = 0; i < 6; i++) add(T({ name: `반복${i + 1}`, text: 'SALE SALE SALE', font: 'Anton', weight: 400, size: 132, color: '#ffffff', align: 'center', lh: 1, hollow: HOLLOW(2.5) }, W / 2, 278 + i * 134));
    add(IMG({ name: '사진', x: 270, y: 420, w: 540, h: 540, fit: 'cover', shadow: shadow(0.3, 40, 14) }));
    add(T({ name: '할인', text: 'UP TO 70%', font: 'Anton', weight: 400, size: 124, color: '#ffffff', align: 'center', lh: 1 }, W / 2, 1100));
  }),
];
