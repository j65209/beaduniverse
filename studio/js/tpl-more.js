/* =========================================================================
   템플릿 — 할인·이벤트 · 후기·UGC · 정보·비교 · 무드·감성
   좌표는 1080×1920 기준. 글자는 안전영역(x 65~1015, y 269~1248) 안.
   ========================================================================= */
import { W, H } from './core.js';
import { T, IMG, SH, BG, solid, grad, shadow, stroke, box, hl, at, tpl, PINK } from './tpl-kit.js';

/* ───────────────────────── 할인 · 이벤트 */
export const SALE = [
  tpl('sl-burst', 'sale', '세일 스티커', '별모양 스티커에 할인율 — 시선 집중', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 800, fill: grad(180, '#000000', 0.5, 0) }));
    add(T({ name: '헤드라인', text: '겨울 준비\n미리 끝내기', weight: 800, size: 96, color: '#ffffff', align: 'left', lh: 1.15, tracking: -2, shadow: shadow(0.3, 20, 4) }, 90, 310));
    add(SH({ name: '세일 스티커', shape: 'star', points: 20, inner: 0.86, x: 600, y: 600, w: 390, h: 390, rot: -10, fill: solid('#ffe14d'), shadow: shadow(0.3, 30, 10) }));
    const s = add(T({ name: '스티커 문구', text: 'UP TO\n50%', font: 'Montserrat', weight: 900, size: 74, color: '#111111', align: 'center', lh: 0.95, rot: -10 }, 795, 712));
    s.y = 795 - s.h / 2; s.x = 795 - s.w / 2; // 스티커 한가운데
    add(T({ name: '기간', text: '11.11 - 11.17  단 7일', weight: 700, size: 38, color: '#ffffff', align: 'left', shadow: shadow(0.35, 16, 3) }, 90, 1100));
  }),

  tpl('sl-coupon', 'sale', '쿠폰 티켓', '첫 구매 쿠폰 — 티켓 모양', '#f6efe6', (add) => {
    add(T({ name: '제목', text: '첫 구매라면\n이 쿠폰 꼭 받아가세요', weight: 800, size: 60, color: '#222222', align: 'center', lh: 1.25, tracking: -1 }, W / 2, 300));
    add(SH({ name: '쿠폰', shape: 'ticket', x: 110, y: 540, w: 860, h: 420, radius: 28, fill: solid(PINK), shadow: shadow(0.22, 40, 14) }));
    add(T({ name: '할인', text: '10%', font: 'Montserrat', weight: 900, size: 190, color: '#ffffff', align: 'center', lh: 1 }, W / 2, 576));
    add(T({ name: '쿠폰 이름', text: 'WELCOME COUPON', font: 'Montserrat', weight: 700, size: 32, color: '#ffffff', align: 'center', tracking: 10 }, W / 2, 790));
    add(SH({ name: '점선', x: 200, y: 852, w: 680, h: 3, fill: solid('#ffffff', 0.55) }));
    add(T({ name: '조건', text: '최대 1만원 · 앱/웹 모두 사용', weight: 500, size: 30, color: '#ffffff', align: 'center' }, W / 2, 880));
    add(T({ name: '안내', text: '프로필 링크에서 바로 받기 ↓', weight: 700, size: 38, color: '#222222', align: 'center' }, W / 2, 1010));
    add(T({ name: '스티커', text: '🎟️', size: 108, align: 'center', rot: 12 }, 920, 466));
  }),

  tpl('sl-dday', 'sale', '타임세일 D-day', '큰 D-2 + 마감 시간 알약', '#111111', (add) => {
    add(BG());
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.5) }));
    add(T({ name: '타이틀', text: 'TIME SALE', font: 'Montserrat', weight: 900, size: 112, color: PINK, align: 'center', tracking: -2 }, W / 2, 300));
    add(T({ name: '디데이', text: 'D-2', font: 'Anton', weight: 400, size: 320, color: '#ffffff', align: 'center', lh: 1 }, W / 2, 450));
    add(T({ name: '마감', text: '11.11 (화) 자정까지', weight: 800, size: 42, color: '#111111', align: 'center', bg: box('#ffe14d', 32, 16) }, W / 2, 830));
    add(T({ name: '설명', text: '시즌오프 전 품목 · 추가 쿠폰 중복 OK', weight: 600, size: 34, color: '#ffffff', align: 'center' }, W / 2, 962));
  }),

  tpl('sl-1plus1', 'sale', '1+1 이벤트', '노랑 배경 + 큰 1+1 + 동그라미 스티커', '#ffe14d', (add) => {
    add(T({ name: '1+1', text: '1+1', font: 'Black Han Sans', weight: 400, size: 250, color: '#111111', align: 'center', lh: 1 }, W / 2, 280));
    add(IMG({ name: '제품 사진', x: 90, y: 580, w: 900, h: 640, radius: 32, fit: 'cover' }));
    add(SH({ name: '스티커', shape: 'ellipse', x: 770, y: 466, w: 220, h: 220, fill: solid(PINK), shadow: shadow(0.25, 20, 6) }));
    const s = add(T({ name: '스티커 문구', text: '단 3일', weight: 800, size: 50, color: '#ffffff', align: 'center', rot: -8 }, 880, 548));
    s.x = 880 - s.w / 2; s.y = 576 - s.h / 2;
    add(T({ name: '설명', text: '하나 사면 하나 더', weight: 800, size: 46, color: '#111111', align: 'center', bg: box('#ffffff', 30, 14) }, W / 2, 1118));
  }),

  tpl('sl-benefits', 'sale', '혜택 체크리스트', '지금 사면 받는 혜택 4가지', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.35) }));
    add(T({ name: '제목', text: '지금 주문하면\n이 혜택 전부 🎁', weight: 800, size: 76, color: '#ffffff', align: 'left', lh: 1.2, tracking: -2, shadow: shadow(0.3, 20, 4) }, 90, 300));
    add(SH({ name: '카드', x: 70, y: 560, w: 940, h: 520, radius: 32, fill: solid('#ffffff', 0.95) }));
    ['무료배송 (전 상품)', '7일 이내 무료 반품', '첫 구매 10% 추가 할인', '리뷰 쓰면 적립금 2,000원'].forEach((t, i) =>
      add(T({ name: `혜택${i + 1}`, text: '✅  ' + t, weight: 700, size: 40, color: '#222222', align: 'left' }, 120, 612 + i * 112)));
  }),

  tpl('sl-stock', 'sale', '한정 수량 게이지', '소진율 막대로 긴박감', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 760, fill: grad(180, '#000000', 0.55, 0) }));
    add(T({ name: '제목', text: '한정 수량 300개', weight: 800, size: 86, color: '#ffffff', align: 'left', tracking: -2, shadow: shadow(0.3, 20, 4) }, 90, 310));
    add(SH({ name: '게이지 바탕', x: 90, y: 470, w: 900, h: 36, radius: 18, fill: solid('#ffffff', 0.35) }));
    add(SH({ name: '게이지', x: 90, y: 470, w: 756, h: 36, radius: 18, fill: grad(90, '#ff2e93', 1, 1, '#ff6b35') }));
    add(T({ name: '소진율', text: '84% 소진 🔥', weight: 800, size: 38, color: '#ffffff', align: 'left', shadow: shadow(0.3, 12, 2) }, 90, 530));
    add(T({ name: '안내', text: '품절되면 재입고 없어요', weight: 800, size: 40, color: '#111111', align: 'left', bg: hl('#ffffff', 16, 8, 8) }, 90, 1110));
  }),
];

/* ───────────────────────── 후기 · UGC */
export const REVIEW = [
  tpl('rv-chat', 'review', '대화 캡처 말풍선', '친구 대화처럼 — 질문·답장 말풍선', '#efeae4', (add) => {
    add(IMG({ name: '사진', x: 90, y: 300, w: 900, h: 420, radius: 32, fit: 'cover' }));
    const bubble = (name, text, x, y, w, tail, fill, color) => {
      add(SH({ name: name + ' 말풍선', shape: 'bubble', tail, x, y, w, h: 140, radius: 44, fill: solid(fill) }));
      const left = tail === 'left';
      add(T({ name, text, weight: 600, size: 40, color, align: left ? 'left' : 'right' }, left ? x + 44 : x + w - 44, y + 27));
    };
    bubble('대화1', '이 니트 어디 거야?? 😍', 90, 760, 640, 'left', '#ffffff', '#111111');
    bubble('대화2', '링크 보내줄게 👀', 470, 920, 520, 'right', '#0a84ff', '#ffffff');
    bubble('대화3', '헐 바로 주문함 ㅋㅋ', 90, 1080, 560, 'left', '#ffffff', '#111111');
  }),

  tpl('rv-notes', 'review', '메모장 리스트', '아이폰 메모 느낌 — 체크리스트 + 손글씨', '#fbfaf6', (add) => {
    add(T({ name: '뒤로', text: '‹ 메모', weight: 600, size: 34, color: '#e0a500', align: 'left' }, 80, 290));
    add(T({ name: '완료', text: '완료', weight: 700, size: 34, color: '#e0a500', align: 'right' }, 1000, 290));
    add(T({ name: '제목', text: '겨울 쇼핑 리스트 📝', weight: 800, size: 64, color: '#111111', align: 'left', tracking: -1 }, 90, 380));
    add(T({ name: '날짜', text: '2026년 11월 5일 오후 3:12', weight: 400, size: 28, color: '#9a9a9a', align: 'left' }, 90, 476));
    ['☑️  극세사 이불 (아이보리)', '☑️  수면 양말 3켤레', '☑️  무드등 · 전구색', '⬜  러그 — 아직 고민 중'].forEach((t, i) =>
      add(T({ name: `항목${i + 1}`, text: t, weight: 500, size: 42, color: '#222222', align: 'left' }, 90, 550 + i * 78)));
    add(T({ name: '손글씨', text: '→ 장바구니 담아둠 ✨', font: 'Nanum Pen Script', weight: 400, size: 70, color: '#e0a500', align: 'left', rot: -3 }, 120, 880));
    add(IMG({ name: '사진', x: 90, y: 990, w: 560, h: 240, radius: 20, fit: 'cover' }));
  }),

  tpl('rv-question', 'review', '질문 스티커 Q&A', '인스타 질문 박스 + 답변', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.2) }));
    add(SH({ name: '질문 카드', x: 140, y: 470, w: 800, h: 340, radius: 36, fill: solid('#ffffff'), shadow: shadow(0.25, 40, 12) }));
    add(SH({ name: '질문 띠', x: 140, y: 470, w: 800, h: 150, radius: 36, fill: grad(90, '#ff2e93', 1, 1, '#ff8a3d') }));
    add(SH({ name: '띠 아래', x: 140, y: 590, w: 800, h: 32, fill: solid('#ffffff') }));
    add(T({ name: '질문 제목', text: '무엇이든 물어보세요!', weight: 700, size: 40, color: '#ffffff', align: 'center' }, W / 2, 504));
    add(T({ name: '질문', text: '이거 진짜 따뜻해요?', weight: 800, size: 56, color: '#111111', align: 'center' }, W / 2, 650));
    add(T({ name: '질문자', text: '— 고객님 질문', weight: 500, size: 28, color: '#8a8a8a', align: 'center' }, W / 2, 740));
    add(T({ name: '답변', text: '네! 직접 입어보고\n답해드릴게요 🙋‍♀️', weight: 800, size: 50, color: '#111111', align: 'center', lh: 1.35, bg: hl('#ffffff', 18, 8, 10) }, W / 2, 880));
  }),

  tpl('rv-poll', 'review', '투표 스티커', 'A/B 사진 + 어떤 게 좋아요? 투표', '#f1ece4', (add) => {
    add(IMG({ name: 'A 사진', x: 90, y: 300, w: 440, h: 620, radius: 28, fit: 'cover' }));
    add(IMG({ name: 'B 사진', x: 550, y: 300, w: 440, h: 620, radius: 28, fit: 'cover' }));
    add(T({ name: 'A', text: 'A', font: 'Montserrat', weight: 900, size: 64, color: '#ffffff', align: 'left', shadow: shadow(0.3, 14, 3) }, 122, 326));
    add(T({ name: 'B', text: 'B', font: 'Montserrat', weight: 900, size: 64, color: '#ffffff', align: 'left', shadow: shadow(0.3, 14, 3) }, 582, 326));
    add(SH({ name: '투표 카드', x: 170, y: 820, w: 740, h: 300, radius: 36, fill: solid('#ffffff'), shadow: shadow(0.22, 40, 12) }));
    add(T({ name: '질문', text: '어떤 컬러가 더 좋아요?', weight: 800, size: 44, color: '#111111', align: 'center' }, W / 2, 856));
    add(SH({ name: 'A 버튼', x: 210, y: 940, w: 320, h: 130, radius: 26, fill: solid('#f2f2f2') }));
    add(SH({ name: 'B 버튼', x: 550, y: 940, w: 320, h: 130, radius: 26, fill: solid('#f2f2f2') }));
    add(T({ name: 'A 선택', text: '🤍 아이보리', weight: 700, size: 38, color: '#111111', align: 'center' }, 370, 980));
    add(T({ name: 'B 선택', text: '🖤 차콜', weight: 700, size: 38, color: '#111111', align: 'center' }, 710, 980));
  }),

  tpl('rv-rating', 'review', '별점 + 후기 3개', '평점 크게 + 짧은 후기 카드', '#111111', (add) => {
    const score = add(T({ name: '평점', text: '4.9', font: 'Montserrat', weight: 800, size: 170, color: '#ffffff', align: 'left', lh: 1 }, 84, 286));
    const sx = Math.max(380, score.x + score.w + 24);
    add(T({ name: '별', text: '★★★★★', weight: 700, size: 56, color: '#ffd43b', align: 'left' }, sx, 318));
    add(T({ name: '리뷰 수', text: '리뷰 3,281개 · 재구매율 41%', weight: 500, size: 30, color: '#a8a8a8', align: 'left' }, sx, 396));
    [['“사이즈 딱 맞고 핏이 예뻐요”', '★★★★★ · 키 165 / M'], ['“세탁해도 보풀이 안 나요”', '★★★★★ · 3번째 구매'], ['“색감이 사진이랑 똑같아요”', '★★★★☆ · 아이보리']].forEach(([q, m], i) => {
      const y = 510 + i * 230;
      add(SH({ name: `후기${i + 1} 카드`, x: 90, y, w: 900, h: 200, radius: 24, fill: solid('#1f1f1f') }));
      add(T({ name: `후기${i + 1}`, text: q, weight: 700, size: 42, color: '#ffffff', align: 'left' }, 130, y + 42));
      add(T({ name: `후기${i + 1} 정보`, text: m, weight: 400, size: 28, color: '#9a9a9a', align: 'left' }, 130, y + 118));
    });
  }),

  tpl('rv-note', 'review', '손글씨 메모 후기', '사진 위에 테이프 붙인 손글씨 메모', '#1a1a1a', (add) => {
    add(BG());
    const cx = 540, cy = 790, w = 780, h = 500, deg = -3;
    add(SH({ name: '메모지', x: cx - w / 2, y: cy - h / 2, w, h, rot: deg, radius: 6, fill: solid('#fffdf6'), shadow: shadow(0.25, 30, 12) }));
    const [tx, ty] = at(cx, cy, 0, -h / 2, deg);
    add(SH({ name: '테이프', x: tx - 110, y: ty - 32, w: 220, h: 64, rot: deg - 4, fill: solid('#f1e3a6', 0.88) }));
    const [ax, ay] = at(cx, cy, 0, -h / 2 + 64, deg);
    add(T({ name: '메모', text: '배송 빠르고 포장도\n너무 예뻐서 감동 🥹\n재구매 각입니다!', font: 'Nanum Pen Script', weight: 400, size: 76, color: '#333333', align: 'center', lh: 1.12, rot: deg }, ax, ay));
    const [sx, sy] = at(cx, cy, w / 2 - 50, h / 2 - 92, deg);
    add(T({ name: '서명', text: '- 김**님', font: 'Nanum Pen Script', weight: 400, size: 54, color: '#888888', align: 'right', rot: deg }, sx, sy));
  }),
];

/* ───────────────────────── 정보 · 비교 */
export const INFO = [
  tpl('in-checklist', 'info', '필수템 체크리스트', '체크박스 목록 + 세로 사진', '#e9e4da', (add) => {
    add(T({ name: '제목', text: '가을 필수템\n체크리스트', weight: 800, size: 72, color: '#1d1d1d', align: 'left', lh: 1.16, tracking: -2 }, 90, 296));
    ['트렌치 코트', '니트 베스트', '와이드 슬랙스', '로퍼', '체크 머플러'].forEach((t, i) => {
      const y = 520 + i * 92;
      add(SH({ name: `${t} 칸`, x: 90, y, w: 50, h: 50, radius: 10, fill: solid('#ffffff'), stroke: stroke('#1d1d1d', 4) }));
      if (i < 4) add(T({ name: `${t} 체크`, text: '✓', weight: 800, size: 46, color: PINK, align: 'center' }, 115, y - 4));
      add(T({ name: t, text: t, weight: 700, size: 42, color: '#1d1d1d', align: 'left' }, 166, y - 2));
    });
    add(IMG({ name: '사진', x: 620, y: 520, w: 380, h: 560, radius: 24, fit: 'cover' }));
    add(T({ name: '안내', text: '하나라도 없다면 지금 담아두세요', weight: 600, size: 34, color: '#555555', align: 'left' }, 90, 1118));
  }),

  tpl('in-top3', 'info', '베스트 TOP 3', '순위 + 사진 + 이름·가격', '#fafafa', (add) => {
    add(T({ name: '제목', text: '이번 주 베스트 TOP 3 🏆', weight: 800, size: 56, color: '#111111', align: 'left', tracking: -1 }, 90, 296));
    [['울 블렌드 하프코트', '89,000원', 'SOLD 1,204'], ['캐시미어 터치 니트', '49,000원', 'SOLD 986'], ['와이드 코듀로이 팬츠', '45,000원', 'SOLD 871']].forEach(([n, p, s], i) => {
      const y = 400 + i * 270;
      add(IMG({ name: `${i + 1}위 사진`, x: 90, y, w: 270, h: 240, radius: 20, fit: 'cover' }));
      add(T({ name: `${i + 1}위`, text: String(i + 1), font: 'Montserrat', weight: 900, size: 120, color: i === 0 ? PINK : '#111111', align: 'left', lh: 1 }, 396, y + 46));
      add(T({ name: `${i + 1}위 이름`, text: n, weight: 700, size: 40, color: '#111111', align: 'left' }, 500, y + 40));
      add(T({ name: `${i + 1}위 가격`, text: p, weight: 800, size: 38, color: '#111111', align: 'left' }, 500, y + 100));
      add(T({ name: `${i + 1}위 판매`, text: s, font: 'Montserrat', weight: 600, size: 24, color: '#9a9a9a', align: 'left', tracking: 3 }, 500, y + 162));
    });
  }),

  tpl('in-vs', 'info', '비교표 (우리 vs 일반)', '항목별 ✅ ❌ 비교 + 사진', '#111111', (add) => {
    add(T({ name: '제목', text: '같은 가격, 다른 퀄리티', weight: 800, size: 62, color: '#ffffff', align: 'center', tracking: -1 }, W / 2, 296));
    add(T({ name: '우리', text: '우리 제품', weight: 800, size: 34, color: '#ffffff', align: 'center', bg: box(PINK, 26, 12) }, 300, 420));
    add(T({ name: '일반', text: '일반 제품', weight: 800, size: 34, color: '#cfcfcf', align: 'center', bg: box('#333333', 26, 12) }, 780, 420));
    [['두께', '✅ 1cm 도톰', '❌ 0.5cm'], ['세탁', '✅ 세탁기 OK', '❌ 손세탁만'], ['보풀', '✅ 거의 없음', '❌ 금방 생김'], ['배송', '✅ 오늘 출발', '❌ 3~5일']].forEach(([k, a, b], i) => {
      const y = 520 + i * 96;
      add(T({ name: k + ' 우리', text: a, weight: 700, size: 36, color: '#ffffff', align: 'center' }, 300, y));
      add(T({ name: k, text: k, weight: 500, size: 26, color: '#8a8a8a', align: 'center' }, 540, y + 8));
      add(T({ name: k + ' 일반', text: b, weight: 500, size: 36, color: '#9a9a9a', align: 'center' }, 780, y));
      add(SH({ name: k + ' 선', x: 90, y: y + 74, w: 900, h: 2, fill: solid('#2c2c2c') }));
    });
    add(IMG({ name: '사진', x: 90, y: 920, w: 900, h: 300, radius: 24, fit: 'cover' }));
  }),

  tpl('in-tips', 'info', '스타일링 팁 3', '번호 카드 3개로 팁 정리', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.32) }));
    add(T({ name: '제목', text: '키 작아 보이지 않는\n코트 스타일링 3', weight: 800, size: 68, color: '#ffffff', align: 'left', lh: 1.2, tracking: -2, shadow: shadow(0.3, 20, 4) }, 90, 300));
    ['무릎 위 기장 고르기', '이너는 같은 톤으로', '앞트임으로 세로선 만들기'].forEach((t, i) => {
      const y = 520 + i * 180;
      add(SH({ name: `팁${i + 1} 카드`, x: 90, y, w: 900, h: 150, radius: 30, fill: solid('#ffffff', 0.94) }));
      add(SH({ name: `팁${i + 1} 원`, shape: 'ellipse', x: 120, y: y + 30, w: 90, h: 90, fill: solid('#111111') }));
      add(T({ name: `팁${i + 1} 번호`, text: String(i + 1).padStart(2, '0'), font: 'Montserrat', weight: 800, size: 38, color: '#ffffff', align: 'center' }, 165, y + 51));
      add(T({ name: `팁${i + 1}`, text: t, weight: 700, size: 44, color: '#111111', align: 'left' }, 240, y + 47));
    });
  }),

  tpl('in-light', 'info', '좌우 비교', '세로 반반 + 라벨 — 전구색 vs 주광색처럼', '#000000', (add) => {
    add(IMG({ name: '왼쪽 사진', x: 0, y: 0, w: 540, h: H, fit: 'cover' }));
    add(IMG({ name: '오른쪽 사진', x: 540, y: 0, w: 540, h: H, fit: 'cover' }));
    add(SH({ name: '가운데 선', x: 535, y: 0, w: 10, h: H, fill: solid('#ffffff') }));
    add(T({ name: '왼쪽 라벨', text: '전구색 2700K', weight: 800, size: 38, color: '#3a2a12', align: 'center', bg: box('#ffd18a', 22, 10) }, 270, 320));
    add(T({ name: '오른쪽 라벨', text: '주광색 6500K', weight: 800, size: 38, color: '#12233a', align: 'center', bg: box('#cfe4ff', 22, 10) }, 810, 320));
    add(T({ name: '질문', text: '어떤 무드가 더 좋아요?', weight: 800, size: 50, color: '#ffffff', align: 'center', bg: box('#111111', 32, 16, 999, 0.75) }, W / 2, 1060));
  }),

  tpl('in-series', 'info', '시리즈 카드 (1/5)', '여러 장 이어보기 — 페이지 번호 + 큰 제목', '#f4f1ec', (add) => {
    add(T({ name: '페이지 번호', text: '1 / 5', font: 'Montserrat', weight: 700, size: 28, color: '#ffffff', align: 'right', tracking: 2, bg: box('#111111', 20, 10) }, 990, 296));
    add(T({ name: '시리즈 이름', text: 'HOME STYLING GUIDE', font: 'Montserrat', weight: 700, size: 26, color: '#111111', align: 'left', tracking: 6 }, 90, 304));
    add(T({ name: '제목', text: '좁은 거실이\n넓어 보이는 법', weight: 800, size: 80, color: '#111111', align: 'left', lh: 1.15, tracking: -2 }, 90, 380));
    add(IMG({ name: '사진', x: 90, y: 600, w: 900, h: 560, radius: 28, fit: 'cover' }));
    add(T({ name: '다음', text: '옆으로 넘겨보세요 →', weight: 700, size: 32, color: '#111111', align: 'left', bg: box('#ffffff', 22, 11, 999, 0.94) }, 116, 1086));
  }),
];

/* ───────────────────────── 무드 · 감성 */
export const MOOD = [
  tpl('md-cinema', 'mood', '영화 자막', '레터박스 + 영화 자막 한 줄', '#000000', (add) => {
    add(BG());
    add(SH({ name: '위 레터박스', x: 0, y: 0, w: W, h: 250, fill: solid('#000000') }));
    add(SH({ name: '아래 레터박스', x: 0, y: 1670, w: W, h: 250, fill: solid('#000000') }));
    add(T({ name: 'REC', text: '● REC', font: 'Montserrat', weight: 700, size: 28, color: '#ff3b30', align: 'left', tracking: 4 }, 90, 300));
    add(T({ name: '타임코드', text: '00:24:13', font: 'Montserrat', weight: 600, size: 28, color: '#ffffff', align: 'right', tracking: 4, opacity: 0.85 }, 990, 300));
    add(T({ name: '자막', text: '“이 계절엔 이 온도가 딱 좋아”', weight: 600, size: 48, color: '#ffffff', align: 'center', shadow: shadow(0.85, 10, 2) }, W / 2, 1060));
    add(T({ name: '장면', text: 'SCENE #24  ·  오후 5시의 니트', font: 'Montserrat', weight: 500, size: 24, color: '#ffffff', align: 'center', tracking: 6, opacity: 0.75 }, W / 2, 1162));
  }),

  tpl('md-bigtype', 'mood', '빅 타이포 포스터', '꽉 찬 영문 한 단어 + 사진', '#d7f25a', (add) => {
    add(IMG({ name: '사진', x: 90, y: 560, w: 900, h: 680, fit: 'cover' }));
    add(T({ name: '빅 타이포', text: 'COZY', font: 'Anton', weight: 400, size: 380, color: '#111111', align: 'center', lh: 0.9 }, W / 2, 276));
    add(T({ name: '영문', text: 'WINTER KNIT COLLECTION', font: 'Montserrat', weight: 700, size: 24, color: '#ffffff', align: 'left', tracking: 6, shadow: shadow(0.4, 14, 2) }, 120, 1108));
    add(T({ name: '한글', text: '포근한 니트 컬렉션', weight: 800, size: 40, color: '#ffffff', align: 'left', shadow: shadow(0.4, 14, 2) }, 120, 1150));
  }),

  tpl('md-y2k', 'mood', 'Y2K 팝', '파스텔 그라데이션 + 하트 사진 + 스티커', '#ffd1ec', (add) => {
    add(SH({ name: '그라데이션', x: 0, y: 0, w: W, h: H, fill: grad(135, '#b8a6ff', 1, 1, '#ffd1ec') }));
    add(T({ name: '타이틀', text: 'NEW IN ✨', font: 'Bagel Fat One', weight: 400, size: 140, color: '#111111', align: 'center', lh: 1 }, W / 2, 286));
    add(IMG({ name: '사진', mask: 'heart', x: 170, y: 470, w: 740, h: 660, fit: 'cover', shadow: shadow(0.2, 30, 10) }));
    add(SH({ name: '별 스티커', shape: 'star', points: 5, inner: 0.45, x: 800, y: 930, w: 190, h: 180, rot: 14, fill: solid('#ffe14d'), shadow: shadow(0.2, 16, 6) }));
    add(T({ name: '말풍선', text: '귀여움 주의 ⚠️', weight: 800, size: 38, color: '#111111', align: 'left', rot: -6, bg: box('#ffffff', 24, 12) }, 100, 1040));
  }),

  tpl('md-quote', 'mood', '감성 문장', '여백 많은 명조 문장 + 작은 원형 사진', '#efe8de', (add) => {
    add(T({ name: '문장', text: '“좋은 물건은\n매일을 조금 더\n다정하게 만든다”', font: 'Gowun Batang', weight: 700, size: 72, color: '#3a3029', align: 'center', lh: 1.45 }, W / 2, 380));
    add(IMG({ name: '사진', mask: 'ellipse', x: 420, y: 790, w: 240, h: 240, fit: 'cover' }));
    add(T({ name: '서명', text: 'Living Note', font: 'Instrument Serif', weight: 400, size: 48, color: '#6b5d52', align: 'center', italic: true }, W / 2, 1070));
  }),

  tpl('md-collage', 'mood', '4분할 콜라주', '꽉 찬 2×2 사진 + 가운데 원형 배지', '#ffffff', (add) => {
    const g = 12, cw = (W - g) / 2, ch = (H - g) / 2;
    [[0, 0], [cw + g, 0], [0, ch + g], [cw + g, ch + g]].forEach(([x, y], i) => add(IMG({ name: `사진${i + 1}`, x, y, w: cw, h: ch, fit: 'cover' })));
    add(T({ name: '라벨', text: '4 LOOKS', font: 'Montserrat', weight: 800, size: 28, color: '#ffffff', align: 'left', tracking: 6, shadow: shadow(0.35, 14, 2) }, 90, 300));
    add(SH({ name: '배지', shape: 'ellipse', x: 390, y: 810, w: 300, h: 300, fill: solid('#ffffff'), shadow: shadow(0.2, 30, 8) }));
    const b = add(T({ name: '배지 문구', text: 'NEW\nCOLLECTION', font: 'Montserrat', weight: 800, size: 40, color: '#111111', align: 'center', lh: 1.05 }, W / 2, 908));
    b.y = 960 - b.h / 2;
  }),

  tpl('md-moodboard', 'mood', '무드보드', '겹친 사진 3장 + 테이프 + 이모지', '#f2ede6', (add) => {
    add(T({ name: '제목', text: 'mood of the week', font: 'Caveat', weight: 700, size: 92, color: '#2b2b2b', align: 'left', rot: -3 }, 90, 310));
    const photo = (name, cx, cy, w, h, deg) => {
      add(IMG({ name, x: cx - w / 2, y: cy - h / 2, w, h, rot: deg, fit: 'cover', stroke: stroke('#ffffff', 14), shadow: shadow(0.18, 30, 10) }));
      const [tx, ty] = at(cx, cy, 0, -h / 2, deg);
      add(SH({ name: name + ' 테이프', x: tx - 80, y: ty - 24, w: 160, h: 48, rot: deg + 6, fill: solid('#f3e3a2', 0.85) }));
    };
    photo('사진1', 330, 720, 460, 540, -5);
    photo('사진2', 752, 780, 410, 500, 6);
    photo('사진3', 520, 1044, 390, 340, -2);
    add(T({ name: '하트', text: '🤎', size: 92, align: 'center' }, 930, 300));
    add(T({ name: '구름', text: '☁️', size: 84, align: 'center' }, 150, 1080));
  }),

  tpl('md-search', 'mood', '검색창 키워드', '검색창 + 해시태그 칩 — 요즘 화법', '#1a1a1a', (add) => {
    add(BG());
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.28) }));
    add(T({ name: '제목', text: '요즘 다들 검색하는\n그 패딩', weight: 800, size: 70, color: '#ffffff', align: 'left', lh: 1.2, tracking: -2, shadow: shadow(0.3, 20, 4) }, 90, 300));
    add(SH({ name: '검색창', x: 90, y: 520, w: 900, h: 124, radius: 62, fill: solid('#ffffff'), shadow: shadow(0.25, 30, 10) }));
    add(T({ name: '돋보기', text: '🔍', size: 44, align: 'left' }, 132, 552));
    add(T({ name: '검색어', text: '가볍고 따뜻한 겨울 패딩', weight: 600, size: 42, color: '#111111', align: 'left' }, 200, 556));
    let x = 92;
    for (const t of ['#초경량', '#생활방수', '#7컬러']) {
      const L = add(T({ name: t, text: t, weight: 700, size: 32, color: '#ffffff', align: 'left', bg: box('#ffffff', 20, 10, 999, 0.22) }, x, 690));
      x += L.w + 14;
    }
  }),
];
