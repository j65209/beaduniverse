/* =========================================================================
   템플릿 — 패션 · 리빙
   좌표는 1080×1920 기준. 글자는 안전영역(x 65~1015, y 269~1248) 안.
   ========================================================================= */
import { W, H } from './core.js';
import { T, IMG, SH, BG, solid, grad, shadow, stroke, box, hl, at, tpl, PINK } from './tpl-kit.js';

export const FASHION = [
  tpl('fa-magazine', 'fashion', '매거진 커버', '잡지 표지처럼 — 큰 영문 제호 + 커버 문구', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 760, fill: grad(180, '#000000', 0.55, 0) }));
    add(SH({ name: '하단 어둡게', x: 0, y: 620, w: W, h: H - 620, fill: grad(180, '#000000', 0, 0.6) }));
    add(T({ name: '제호', text: 'THE EDIT', font: 'Playfair Display', weight: 900, size: 156, color: '#ffffff', align: 'center', tracking: -2, lh: 1 }, W / 2, 290));
    add(T({ name: '호수', text: 'VOL.07  ·  NOVEMBER 2026', font: 'Montserrat', weight: 600, size: 24, color: '#ffffff', align: 'center', tracking: 8 }, W / 2, 476));
    add(T({ name: '커버 라벨', text: 'NEW SEASON', font: 'Montserrat', weight: 700, size: 26, color: '#ffffff', align: 'left', tracking: 6 }, 90, 820));
    add(T({ name: '커버 문구', text: '가을을 입는\n가장 쉬운 방법', font: 'Hahmlet', weight: 700, size: 70, color: '#ffffff', align: 'left', lh: 1.18 }, 90, 866));
    add(SH({ name: '구분선', x: 90, y: 1062, w: 220, h: 3, fill: solid('#ffffff', 0.9) }));
    add(T({ name: '설명', text: '데일리 니트 12종 · 최대 30% OFF', weight: 500, size: 32, color: '#ffffff', align: 'left' }, 90, 1088));
  }),

  tpl('fa-lookbook', 'fashion', '룩북 넘버링', '큰 번호 + 아이템 정보 — 시리즈로 여러 장', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '하단 어둡게', x: 0, y: 600, w: W, h: H - 600, fill: grad(180, '#000000', 0, 0.7) }));
    add(T({ name: '라벨', text: 'LOOKBOOK', font: 'Montserrat', weight: 600, size: 28, color: '#ffffff', align: 'left', tracking: 14, shadow: shadow(0.3, 12, 2) }, 90, 300));
    add(T({ name: '시즌', text: '26 F/W', font: 'Montserrat', weight: 600, size: 28, color: '#ffffff', align: 'right', tracking: 4, shadow: shadow(0.3, 12, 2) }, 990, 300));
    const num = add(T({ name: '번호', text: '01', font: 'Bebas Neue', weight: 400, size: 320, color: '#ffffff', align: 'left', lh: 0.9 }, 76, 850));
    const ix = Math.max(360, num.x + num.w + 24);
    add(T({ name: '아이템', text: 'OVERSIZED\nWOOL COAT', font: 'Montserrat', weight: 800, size: 46, color: '#ffffff', align: 'left', lh: 1.1, tracking: 1 }, ix, 930));
    add(T({ name: '컬러·사이즈', text: 'Charcoal · Free size', weight: 400, size: 30, color: '#ffffff', align: 'left', opacity: 0.85 }, ix, 1052));
  }),

  tpl('fa-ootd', 'fashion', 'OOTD 아이템 태그', '사진 위에 아이템·가격 태그를 콕콕', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 700, fill: grad(180, '#000000', 0.45, 0) }));
    add(T({ name: '타이틀', text: 'OOTD', font: 'Archivo Black', weight: 400, size: 130, color: '#ffffff', align: 'left', lh: 1, shadow: shadow(0.25, 20, 4) }, 84, 290));
    add(T({ name: '날짜', text: '11.05 THU', font: 'Montserrat', weight: 700, size: 26, color: '#111111', align: 'left', tracking: 4, bg: box('#ffffff', 20, 9) }, 94, 456));
    const tag = (name, text, x, y, r) => {
      add(SH({ name: name + ' 점', shape: 'ellipse', x: x - 40, y: y + 20, w: 22, h: 22, fill: solid('#ffffff'), shadow: shadow(0.35, 10, 2) }));
      add(T({ name, text, weight: 700, size: 32, color: '#111111', align: 'left', rot: r, bg: box('#ffffff', 24, 13), shadow: shadow(0.16, 18, 4) }, x, y));
    };
    tag('코트 태그', '🧥 울 블렌드 코트  89,000', 150, 650, -3);
    tag('데님 태그', '👖 와이드 데님  49,000', 460, 830, 3);
    tag('신발 태그', '👟 레더 스니커즈  69,000', 190, 1010, -2);
  }),

  tpl('fa-colors', 'fashion', '컬러 옵션 칩', '제품 사진 + 컬러 동그라미 · 이름', '#f4f1ec', (add) => {
    add(IMG({ name: '제품 사진', x: 90, y: 300, w: 900, h: 640, radius: 36, fit: 'cover' }));
    add(T({ name: '제목', text: '컬러를 골라보세요', weight: 800, size: 54, color: '#151515', align: 'left', tracking: -1 }, 90, 984));
    add(T({ name: '컬러 수', text: '4 COLORS', font: 'Montserrat', weight: 700, size: 26, color: '#151515', align: 'right', tracking: 6 }, 990, 1000));
    [['#ede6da', 'Ivory'], ['#3b3b3b', 'Charcoal'], ['#b98e64', 'Camel'], ['#2f3d5c', 'Navy']].forEach(([c, n], i) => {
      const cx = 140 + i * 136;
      add(SH({ name: n + ' 칩', shape: 'ellipse', x: cx - 44, y: 1074, w: 88, h: 88, fill: solid(c), stroke: stroke('#d9d2c5', 3) }));
      add(T({ name: n, text: n, font: 'Montserrat', weight: 600, size: 22, color: '#555555', align: 'center' }, cx, 1176));
    });
  }),

  tpl('fa-fit', 'fashion', '핏 · 사이즈 가이드', '모델 정보 + 핏·두께 막대', '#1a1a1a', (add) => {
    add(BG());
    add(T({ name: '라벨', text: 'FIT CHECK', font: 'Montserrat', weight: 800, size: 40, color: '#ffffff', align: 'left', tracking: 10, shadow: shadow(0.35, 18, 3) }, 90, 300));
    add(SH({ name: '카드', x: 70, y: 800, w: 940, h: 420, radius: 32, fill: solid('#ffffff', 0.95), shadow: shadow(0.2, 40, 12) }));
    add(T({ name: '카드 제목', text: '사이즈 고민 끝 📏', weight: 800, size: 46, color: '#111111', align: 'left' }, 120, 840));
    add(T({ name: '모델 정보', text: '모델 172cm · 52kg · M 착용', weight: 500, size: 32, color: '#666666', align: 'left' }, 120, 912));
    const bar = (label, y, pos, l, m, r) => {
      add(T({ name: label + ' 이름', text: label, weight: 700, size: 30, color: '#111111', align: 'left' }, 120, y - 18));
      add(SH({ name: label + ' 막대', x: 240, y, w: 600, h: 10, radius: 5, fill: solid('#e7e2d9') }));
      add(SH({ name: label + ' 표시', shape: 'ellipse', x: 240 + pos * 600 - 19, y: y - 14, w: 38, h: 38, fill: solid('#111111') }));
      add(T({ name: label + ' 왼쪽', text: l, weight: 500, size: 24, color: '#999999', align: 'left' }, 240, y + 32));
      if (m) add(T({ name: label + ' 가운데', text: m, weight: 500, size: 24, color: '#999999', align: 'center' }, 540, y + 32));
      add(T({ name: label + ' 오른쪽', text: r, weight: 500, size: 24, color: '#999999', align: 'right' }, 840, y + 32));
    };
    bar('핏', 1010, 0.62, '슬림', '정사이즈', '오버');
    bar('두께', 1124, 0.35, '얇음', '', '두꺼움');
  }),

  tpl('fa-polaroid', 'fashion', '폴라로이드 데일리룩', '사진 두 장을 폴라로이드처럼 + 손글씨', '#ece7df', (add) => {
    const pol = (name, cx, cy, w, h, deg, caption) => {
      const m = 28, bottom = 118;
      add(SH({ name: name + ' 프레임', x: cx - w / 2, y: cy - h / 2, w, h, rot: deg, radius: 4, fill: solid('#ffffff'), shadow: shadow(0.18, 36, 14) }));
      const iw = w - m * 2, ih = h - m - bottom;
      const [ix, iy] = at(cx, cy, 0, -h / 2 + m + ih / 2, deg);
      add(IMG({ name: name + ' 사진', x: ix - iw / 2, y: iy - ih / 2, w: iw, h: ih, rot: deg, fit: 'cover' }));
      const [tx, ty] = at(cx, cy, 0, h / 2 - bottom + 26, deg);
      add(T({ name: name + ' 메모', text: caption, font: 'Nanum Pen Script', weight: 400, size: 58, color: '#333333', align: 'center', rot: deg }, tx, ty));
    };
    pol('왼쪽', 330, 640, 500, 620, -6, 'monday ♡');
    pol('오른쪽', 742, 790, 480, 600, 5, '오늘은 니트 데이');
    add(T({ name: '제목', text: '오늘의 데일리룩', font: 'Nanum Pen Script', weight: 400, size: 96, color: '#222222', align: 'center' }, W / 2, 1110));
  }),

  tpl('fa-newdrop', 'fashion', '신상 드롭 티켓', '큰 NEW DROP + 공개 일시 티켓', '#111111', (add) => {
    add(BG());
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.3) }));
    add(T({ name: '타이틀', text: 'NEW DROP', font: 'Anton', weight: 400, size: 220, color: '#ffffff', align: 'center', lh: 1, tracking: 2 }, W / 2, 300));
    add(SH({ name: '티켓', shape: 'ticket', x: 130, y: 640, w: 820, h: 330, radius: 26, fill: solid('#ffffff'), shadow: shadow(0.3, 40, 14) }));
    add(T({ name: '일시', text: '11.12 THU  8PM', font: 'Montserrat', weight: 800, size: 66, color: '#111111', align: 'center', tracking: -1 }, W / 2, 690));
    add(SH({ name: '점선', x: 210, y: 808, w: 660, h: 3, fill: solid('#e3e3e3') }));
    add(T({ name: '혜택', text: '선착순 100명 10% 쿠폰', weight: 800, size: 40, color: PINK, align: 'center' }, W / 2, 842));
    add(T({ name: '안내', text: '알림 설정하고 가장 먼저 만나보세요 🔔', weight: 600, size: 34, color: '#ffffff', align: 'center', shadow: shadow(0.4, 16, 3) }, W / 2, 1040));
  }),

  tpl('fa-jewelry', 'fashion', '주얼리 클로즈업', '어두운 배경 + 원형 사진 + 골드 라인', '#141414', (add) => {
    add(T({ name: '라벨', text: 'FINE JEWELRY', font: 'Montserrat', weight: 500, size: 24, color: '#c9a96e', align: 'center', tracking: 12 }, W / 2, 282));
    add(SH({ name: '골드 링', shape: 'ellipse', x: 170, y: 336, w: 740, h: 740, fill: solid('#000000', 0), stroke: stroke('#c9a96e', 3) }));
    add(IMG({ name: '주얼리 사진', mask: 'ellipse', x: 200, y: 366, w: 680, h: 680, fit: 'cover' }));
    add(T({ name: '제품명', text: 'Silver 925', font: 'Cormorant Garamond', weight: 600, size: 76, color: '#efe3cc', align: 'center', italic: true }, W / 2, 1090));
    add(T({ name: '설명', text: '매일 해도 변색 걱정 없는 실버', weight: 400, size: 32, color: '#bdb4a5', align: 'center' }, W / 2, 1190));
  }),

  tpl('fa-split', 'fashion', '스타일링 2가지', '위·아래 반반 — 출근룩 vs 주말룩', '#111111', (add) => {
    add(IMG({ name: '위 사진', x: 0, y: 0, w: W, h: 960, fit: 'cover' }));
    add(IMG({ name: '아래 사진', x: 0, y: 960, w: W, h: 960, fit: 'cover' }));
    add(SH({ name: '가운데 선', x: 0, y: 955, w: W, h: 10, fill: solid('#ffffff') }));
    add(T({ name: '스타일1 라벨', text: 'STYLE 01', font: 'Montserrat', weight: 800, size: 28, color: '#111111', align: 'left', tracking: 4, bg: box('#ffffff', 22, 10) }, 92, 300));
    add(T({ name: '스타일1', text: '출근룩', weight: 800, size: 76, color: '#ffffff', align: 'left', shadow: shadow(0.35, 20, 4) }, 90, 364));
    add(T({ name: '스타일2 라벨', text: 'STYLE 02', font: 'Montserrat', weight: 800, size: 28, color: '#111111', align: 'left', tracking: 4, bg: box('#ffffff', 22, 10) }, 92, 1010));
    add(T({ name: '스타일2', text: '주말룩', weight: 800, size: 76, color: '#ffffff', align: 'left', shadow: shadow(0.35, 20, 4) }, 90, 1074));
    add(SH({ name: 'VS 원', shape: 'ellipse', x: 470, y: 890, w: 140, h: 140, fill: solid(PINK), shadow: shadow(0.3, 20, 6) }));
    add(T({ name: 'VS', text: 'VS', font: 'Montserrat', weight: 900, size: 54, color: '#ffffff', align: 'center' }, W / 2, 926));
  }),

  tpl('fa-editorial', 'fashion', '미니멀 에디토리얼', '아치 사진 + 세리프 한 줄 — 고급스럽게', '#f3efe8', (add) => {
    add(T({ name: '라벨', text: 'COLLECTION 2026', font: 'Montserrat', weight: 500, size: 22, color: '#8a8378', align: 'center', tracking: 10 }, W / 2, 282));
    add(IMG({ name: '사진', mask: 'arch', x: 250, y: 340, w: 580, h: 700, fit: 'cover' }));
    add(T({ name: '카피', text: 'Simple, but never plain.', font: 'Instrument Serif', weight: 400, size: 70, color: '#1b1b1b', align: 'center' }, W / 2, 1070));
    add(T({ name: '설명', text: '군더더기 없이, 오래 입는 옷', font: 'MaruBuri', weight: 400, size: 34, color: '#5b554d', align: 'center' }, W / 2, 1172));
  }),

  tpl('fa-tag', 'fashion', '가격 택', '옷 택처럼 생긴 가격표 — 정가·할인가', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 700, fill: grad(180, '#000000', 0.4, 0) }));
    add(T({ name: '제목', text: '이번 주만\n이 가격', weight: 800, size: 90, color: '#ffffff', align: 'left', lh: 1.15, tracking: -2, shadow: shadow(0.3, 20, 4) }, 90, 310));
    const cx = 760, cy = 760, w = 340, h = 470, deg = 8;
    add(SH({ name: '택', x: cx - w / 2, y: cy - h / 2, w, h, rot: deg, radius: 26, fill: solid('#f6f0e4'), shadow: shadow(0.3, 30, 12) }));
    const [hx, hy] = at(cx, cy, 0, -h / 2 + 52, deg);
    add(SH({ name: '택 구멍', shape: 'ellipse', x: hx - 20, y: hy - 20, w: 40, h: 40, fill: solid('#2b2b2b'), stroke: stroke('#d8ccb8', 4) }));
    const tx = (dy) => at(cx, cy, 0, dy, deg);
    let p = tx(-h / 2 + 110); add(T({ name: '택 라벨', text: 'SALE', font: 'Montserrat', weight: 800, size: 34, color: '#b23a2b', align: 'center', tracking: 8, rot: deg }, p[0], p[1]));
    p = tx(-h / 2 + 176); add(T({ name: '정가', text: '정가 59,000', weight: 500, size: 30, color: '#9a8f80', align: 'center', rot: deg }, p[0], p[1]));
    p = tx(-h / 2 + 228); add(T({ name: '할인가', text: '39,000', font: 'Montserrat', weight: 800, size: 74, color: '#1d1d1d', align: 'center', rot: deg }, p[0], p[1]));
    p = tx(-h / 2 + 330); add(T({ name: '원', text: 'KRW · 34% OFF', font: 'Montserrat', weight: 600, size: 22, color: '#6f6457', align: 'center', tracking: 4, rot: deg }, p[0], p[1]));
  }),
  tpl('fa-formula', 'fashion', '코디 공식', '아이템 3개 + = 완성 룩 — 레이어드 공식', '#f3efe9', (add) => {
    add(T({ name: '제목', text: '오늘의 코디 공식', weight: 800, size: 64, color: '#1d1d1d', align: 'center', tracking: -1 }, W / 2, 292));
    [['니트 베스트', 210], ['셔츠', 540], ['와이드 슬랙스', 870]].forEach(([n, cx], i) => {
      add(IMG({ name: n + ' 사진', mask: 'ellipse', x: cx - 115, y: 420, w: 230, h: 230, fit: 'cover', stroke: stroke('#ffffff', 8) }));
      add(T({ name: n, text: n, weight: 600, size: 30, color: '#333333', align: 'center' }, cx, 664));
      if (i < 2) add(T({ name: `더하기${i + 1}`, text: '+', font: 'Montserrat', weight: 300, size: 76, color: '#1d1d1d', align: 'center' }, cx + 165, 482));
    });
    add(T({ name: '같다', text: '=', font: 'Montserrat', weight: 300, size: 86, color: '#1d1d1d', align: 'center' }, W / 2, 714));
    add(IMG({ name: '완성 룩 사진', x: 250, y: 830, w: 580, h: 400, radius: 28, fit: 'cover' }));
    add(T({ name: '완성', text: '꾸안꾸 출근룩 완성 ✨', weight: 800, size: 34, color: '#111111', align: 'center', bg: box('#ffffff', 26, 12) }, W / 2, 1156));
  }),

  tpl('fa-receipt', 'fashion', '쇼핑 영수증', '영수증처럼 산 것·가격·합계 — 하울 느낌', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.25) }));
    const cx = 540, cy = 770, w = 640, h = 900, deg = 2;
    add(SH({ name: '영수증', x: cx - w / 2, y: cy - h / 2, w, h, rot: deg, radius: 6, fill: solid('#fbfaf7'), shadow: shadow(0.3, 36, 14) }));
    const P = (dx, dy) => at(cx, cy, dx, dy, deg);
    const line = (name, text, dy, o = {}) => { const [x, y] = P(0, dy); add(T(Object.assign({ name, text, weight: 500, size: 28, color: '#222222', align: 'center', rot: deg }, o), x, y)); };
    const row = (name, l, r, dy, color = '#222222', weight = 500) => {
      let [x, y] = P(-w / 2 + 48, dy); add(T({ name, text: l, weight, size: 30, color, align: 'left', rot: deg }, x, y));
      [x, y] = P(w / 2 - 48, dy); add(T({ name: name + ' 금액', text: r, font: 'Space Grotesk', weight: weight >= 700 ? 700 : 500, size: 30, color, align: 'right', rot: deg }, x, y));
    };
    line('제목', 'SHOPPING RECEIPT', -h / 2 + 52, { font: 'Space Grotesk', weight: 700, size: 36, tracking: 4 });
    line('날짜', '2026.11.05  15:12  ·  No.0247', -h / 2 + 108, { font: 'Space Grotesk', size: 22, color: '#8a8a8a' });
    line('점선1', '- - - - - - - - - - - - - - - - - - - - -', -h / 2 + 150, { size: 22, color: '#bdbdbd' });
    row('품목1', '울 블렌드 코트', '89,000', -h / 2 + 200);
    row('품목2', '캐시미어 니트', '49,000', -h / 2 + 258);
    row('품목3', '와이드 데님', '45,000', -h / 2 + 316);
    row('품목4', '레더 로퍼', '69,000', -h / 2 + 374);
    line('점선2', '- - - - - - - - - - - - - - - - - - - - -', -h / 2 + 432, { size: 22, color: '#bdbdbd' });
    row('합계', 'TOTAL', '252,000', -h / 2 + 476, '#222222', 700);
    row('할인', '시즌 세일 -30%', '-75,600', -h / 2 + 534, PINK, 700);
    line('결제', '176,400원', -h / 2 + 600, { weight: 800, size: 64 });
    for (let i = 0; i < 28; i++) { // 바코드
      const bw = [3, 6, 2, 4][i % 4];
      const [x, y] = P(-200 + i * 14.5, h / 2 - 140);
      add(SH({ name: '바코드', x: x - bw / 2, y: y - 40, w: bw, h: 80, rot: deg, fill: solid('#222222') }));
    }
    line('감사', 'THANK YOU ♡', h / 2 - 84, { font: 'Space Grotesk', weight: 600, size: 24, color: '#8a8a8a', tracking: 6 });
  }),
];

export const LIVING = [
  tpl('lv-arch', 'living', '아치 창 무드', '아치 프레임 사진 + 세리프 카피', '#ebe3d6', (add) => {
    add(IMG({ name: '사진', mask: 'arch', x: 140, y: 300, w: 800, h: 720, fit: 'cover' }));
    add(T({ name: '카피', text: 'Slow Morning', font: 'DM Serif Display', weight: 400, size: 88, color: '#3b2f28', align: 'center', italic: true }, W / 2, 1048));
    add(T({ name: '설명', text: '햇살이 머무는 자리에 두세요', font: 'Gowun Batang', weight: 400, size: 36, color: '#6b5a4e', align: 'center' }, W / 2, 1168));
  }),

  tpl('lv-room', 'living', '공간 무드 카피', '풀샷 위 감성 문장 — 리빙 기본형', '#2a2622', (add) => {
    add(BG());
    add(SH({ name: '하단 어둡게', x: 0, y: 640, w: W, h: H - 640, fill: grad(180, '#000000', 0, 0.65) }));
    add(T({ name: '라벨', text: 'LIVING NOTE  no.12', font: 'Montserrat', weight: 600, size: 24, color: '#ffffff', align: 'left', tracking: 8, shadow: shadow(0.3, 12, 2) }, 90, 300));
    add(T({ name: '카피', text: '주말 아침,\n커피 향이 머무는 거실', font: 'Noto Serif KR', weight: 600, size: 64, color: '#ffffff', align: 'left', lh: 1.32 }, 90, 960));
    add(T({ name: '설명', text: '포근한 텍스처 러그 · 3 colors', weight: 400, size: 30, color: '#ffffff', align: 'left', opacity: 0.9 }, 90, 1168));
  }),

  tpl('lv-spec', 'living', '제품 특징 콜아웃', '원형 제품 사진 둘레에 특징 뱃지', '#f6f2ea', (add) => {
    add(T({ name: '제목', text: '작은 디테일이 큰 차이를 만들어요', weight: 800, size: 50, color: '#2b2622', align: 'center', tracking: -1 }, W / 2, 292));
    add(SH({ name: '배경 원', shape: 'ellipse', x: 230, y: 410, w: 620, h: 620, fill: solid('#e9e0d1') }));
    add(IMG({ name: '제품 사진', mask: 'ellipse', x: 260, y: 440, w: 560, h: 560, fit: 'cover' }));
    const pill = (name, text, x, y, align) => add(T({ name, text, weight: 700, size: 32, color: '#2b2622', align, bg: box('#ffffff', 24, 13), shadow: shadow(0.12, 20, 6) }, x, y));
    pill('특징1', '☁️ 극세사 100%', 80, 470, 'left');
    pill('특징2', '🧺 세탁기 OK', 1000, 700, 'right');
    pill('특징3', '🛡️ 미끄럼 방지', 80, 930, 'left');
    add(T({ name: '가격', text: '₩29,000 · 무료배송', weight: 800, size: 46, color: '#2b2622', align: 'center' }, W / 2, 1090));
  }),

  tpl('lv-steps', 'living', '사용법 3단계', '번호 + 사진 + 짧은 설명 3줄', '#f2eee6', (add) => {
    add(T({ name: '제목', text: '이렇게 쓰면\n더 오래 써요', weight: 800, size: 66, color: '#222222', align: 'left', lh: 1.2, tracking: -1 }, 90, 290));
    ['먼저 가볍게\n털어주세요', '찬물에 단독\n세탁해주세요', '그늘에서\n펼쳐 말려요'].forEach((txt, i) => {
      const y = 500 + i * 245;
      add(IMG({ name: `${i + 1}단계 사진`, x: 110, y, w: 300, h: 215, radius: 24, fit: 'cover' }));
      add(SH({ name: `${i + 1} 원`, shape: 'ellipse', x: 80, y: y - 22, w: 66, h: 66, fill: solid('#222222') }));
      add(T({ name: `${i + 1} 번호`, text: String(i + 1), font: 'Montserrat', weight: 800, size: 34, color: '#ffffff', align: 'center' }, 113, y - 10));
      add(T({ name: `${i + 1}단계`, text: txt, weight: 700, size: 40, color: '#222222', align: 'left', lh: 1.3 }, 450, y + 50));
    });
  }),

  tpl('lv-palette', 'living', '컬러 팔레트', '공간 사진 + 페인트 칩 4색', '#faf8f4', (add) => {
    add(IMG({ name: '공간 사진', x: 90, y: 300, w: 900, h: 560, radius: 28, fit: 'cover' }));
    add(T({ name: '제목', text: 'Color Palette', font: 'DM Serif Display', weight: 400, size: 58, color: '#222222', align: 'left' }, 90, 886));
    add(T({ name: '부제', text: '이번 시즌 우리 집 컬러', weight: 500, size: 30, color: '#777777', align: 'right' }, 990, 908));
    [['#e8dfd0', 'Oat', '#2b2b2b'], ['#c9b79c', 'Sand', '#2b2b2b'], ['#9aa58a', 'Sage', '#ffffff'], ['#6d5a4b', 'Cocoa', '#ffffff']].forEach(([c, n, tc], i) => {
      const x = 90 + i * 228;
      add(SH({ name: n + ' 칩', x, y: 982, w: 204, h: 200, radius: 16, fill: solid(c) }));
      add(T({ name: n, text: n, font: 'Montserrat', weight: 600, size: 26, color: tc, align: 'left' }, x + 18, 1124));
    });
  }),

  tpl('lv-gift', 'living', '선물 가이드 2×2', '집들이 선물 4개 + 가격 태그', '#f4efe9', (add) => {
    add(T({ name: '제목', text: '집들이 선물\n고민 끝 🎁', weight: 800, size: 68, color: '#222222', align: 'left', lh: 1.18, tracking: -1 }, 90, 290));
    add(T({ name: '가격대', text: '2~3만원대', weight: 700, size: 30, color: '#ffffff', align: 'right', bg: box('#c07a55', 20, 10) }, 990, 300));
    ['₩19,000', '₩24,000', '₩29,000', '₩32,000'].forEach((p, i) => {
      const x = 90 + (i % 2) * 460, y = 480 + Math.floor(i / 2) * 350;
      add(IMG({ name: `선물${i + 1} 사진`, x, y, w: 440, h: 330, radius: 22, fit: 'cover' }));
      add(T({ name: `선물${i + 1} 가격`, text: p, weight: 800, size: 28, color: '#222222', align: 'left', bg: box('#ffffff', 16, 8) }, x + 18, y + 330 - 64));
    });
  }),

  tpl('lv-zoom', 'living', '소재 클로즈업', '돋보기처럼 원형 확대 사진', '#2a2622', (add) => {
    add(BG());
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 760, fill: grad(180, '#000000', 0.5, 0) }));
    add(T({ name: '카피', text: '만져보면\n알아요', weight: 800, size: 96, color: '#ffffff', align: 'left', lh: 1.12, tracking: -2, shadow: shadow(0.3, 20, 4) }, 90, 300));
    add(IMG({ name: '확대 사진', mask: 'ellipse', x: 520, y: 540, w: 440, h: 440, fit: 'cover', stroke: stroke('#ffffff', 10), shadow: shadow(0.35, 40, 12) }));
    add(T({ name: '설명', text: '뽀송한 극세사 · 1cm 두께', weight: 700, size: 36, color: '#111111', align: 'left', bg: hl('#ffffff', 16, 8, 8) }, 90, 1080));
  }),

  tpl('lv-routine', 'living', '하루 루틴 타임라인', '시간 + 이모지 + 한 줄 — 생활 밀착', '#efe9df', (add) => {
    add(T({ name: '제목', text: '하루를 바꾸는\n작은 루틴', font: 'Hahmlet', weight: 700, size: 66, color: '#2c2620', align: 'left', lh: 1.2 }, 90, 296));
    add(SH({ name: '세로선', x: 128, y: 560, w: 4, h: 520, fill: solid('#cbbda9') }));
    [['07:00', '☕️ 따뜻한 머그에 모닝커피'], ['13:00', '🌿 창가에서 잠깐 쉼표'], ['23:00', '🌙 포근한 이불 속으로']].forEach(([t, d], i) => {
      const y = 560 + i * 230;
      add(SH({ name: t + ' 점', shape: 'ellipse', x: 112, y: y - 4, w: 36, h: 36, fill: solid('#2c2620') }));
      add(T({ name: t, text: t, font: 'Montserrat', weight: 700, size: 32, color: '#2c2620', align: 'left' }, 180, y - 8));
      add(T({ name: t + ' 설명', text: d, weight: 500, size: 34, color: '#3b342d', align: 'left' }, 180, y + 46));
    });
    add(IMG({ name: '사진', x: 712, y: 560, w: 288, h: 540, radius: 144, fit: 'cover' }));
  }),

  tpl('lv-season', 'living', '시즌 무드 (윈터)', '큰 세리프 시즌 타이틀 + 혜택 알약', '#2a2622', (add) => {
    add(BG());
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.18) }));
    add(T({ name: '타이틀', text: 'WINTER\nEDITION', font: 'Playfair Display', weight: 800, size: 132, color: '#ffffff', align: 'center', lh: 0.98, shadow: shadow(0.25, 30, 4) }, W / 2, 296));
    add(T({ name: '부제', text: '❄️  포근함을 들이는 계절  ❄️', weight: 600, size: 36, color: '#ffffff', align: 'center', shadow: shadow(0.35, 16, 3) }, W / 2, 592));
    add(T({ name: '혜택', text: '극세사 침구 세트 최대 40%', weight: 800, size: 42, color: '#222222', align: 'center', bg: box('#ffffff', 32, 16) }, W / 2, 1110));
  }),

  tpl('lv-flatlay', 'living', '큰 사진 + 작은 사진 2', '비대칭 콜라주 — 공간·디테일 함께', '#f5f1ea', (add) => {
    add(T({ name: '제목', text: '머물고 싶은 방의\n작은 비밀', font: 'Noto Serif KR', weight: 700, size: 62, color: '#2b2622', align: 'left', lh: 1.28 }, 90, 290));
    add(IMG({ name: '큰 사진', x: 90, y: 490, w: 560, h: 700, radius: 20, fit: 'cover' }));
    add(IMG({ name: '작은 사진1', x: 670, y: 490, w: 320, h: 340, radius: 20, fit: 'cover' }));
    add(IMG({ name: '작은 사진2', x: 670, y: 850, w: 320, h: 250, radius: 20, fit: 'cover' }));
    add(T({ name: '설명', text: '무드등 · 린넨 커튼 · 우드 트레이', weight: 600, size: 26, color: '#2b2622', align: 'left', bg: box('#ffffff', 16, 9, 999, 0.92) }, 114, 1124));
  }),
  tpl('lv-dimension', 'living', '사이즈 치수', '제품 사진 + 가로·세로 치수선', '#f7f5f1', (add) => {
    add(T({ name: '제목', text: '사이즈 꼭 확인하세요 📐', weight: 800, size: 56, color: '#222222', align: 'left', tracking: -1 }, 90, 296));
    add(IMG({ name: '제품 사진', x: 150, y: 420, w: 740, h: 560, radius: 12, fit: 'cover' }));
    add(SH({ name: '가로 치수선', x: 150, y: 1012, w: 740, h: 3, fill: solid('#222222') }));
    add(SH({ name: '가로 끝1', x: 150, y: 998, w: 3, h: 30, fill: solid('#222222') }));
    add(SH({ name: '가로 끝2', x: 887, y: 998, w: 3, h: 30, fill: solid('#222222') }));
    add(T({ name: '가로', text: '가로 120cm', weight: 700, size: 32, color: '#222222', align: 'center' }, 520, 1036));
    add(SH({ name: '세로 치수선', x: 932, y: 420, w: 3, h: 560, fill: solid('#222222') }));
    add(SH({ name: '세로 끝1', x: 918, y: 420, w: 30, h: 3, fill: solid('#222222') }));
    add(SH({ name: '세로 끝2', x: 918, y: 977, w: 30, h: 3, fill: solid('#222222') }));
    const v = add(T({ name: '세로', text: '세로 180cm', weight: 700, size: 30, color: '#222222', align: 'center', rot: -90 }, 975, 640));
    v.x = 978 - v.w / 2; v.y = 700 - v.h / 2;
    add(T({ name: '설명', text: '두께 1.2cm · 미끄럼 방지 처리 · 세탁기 OK', weight: 500, size: 30, color: '#666666', align: 'left' }, 90, 1116));
  }),
];
