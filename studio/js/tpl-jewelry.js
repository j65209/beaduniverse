/* =========================================================================
   템플릿 — 주얼리 (10~20대 밈 · 후킹 포맷)
   POV 자막 · 댓글 답글 · 알림 폭탄 · 카톡 · 인생네컷 · 가격 맞히기 · VS · 변색 실험 ·
   레이어드 공식 · 티어표 · MBTI · 탄생석 · 반응 · ~특 · B급 세일 · 나만 몰랐어 · 뮤직 플레이어 ·
   트윗 · 속보 · 핀터레스트 · 크롬 Y2K · 코케트 · 언박싱 · 다꾸 · 윈도우 경고창 · DM · 가격대별 선물 ·
   GRWM · 장바구니 · 행운 아이템 · 손가락별 의미 · 기념일 달력
   글자는 안전영역(x 65~1015, y 269~1248, 오른쪽 아래 아이콘 줄 제외) 안.
   ========================================================================= */
import { W, H } from './core.js';
import { T, TB, IMG, SH, BG, SPARK, TIKTOK, CHROME, centerAt, solid, grad, shadow, stroke, box, hl, at, tpl } from './tpl-kit.js';

const INK = '#111111';
const HOT = '#ff3d8b';
const LIME = '#d8ff3c';

export const JEWELRY = [
  tpl('jw-pov', 'jewelry', 'POV 자막', '틱톡 자막처럼 — POV: 친구가 어디 거냐고 물어봄', '#1a1a1a', (add) => {
    add(BG('착용 사진'));
    add(SH({ name: '살짝 어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.12) }));
    add(TIKTOK('POV 자막', 'POV: 친구가 반지 어디 거냐고\n5번째 물어봄', W / 2, 500));
    add(TIKTOK('작은 자막', '(알려주기 싫은데..)', W / 2, 690, 34));
    add(SPARK(170, 470, 90));
    add(SPARK(905, 660, 64, '#ffffff', 12));
  }),

  tpl('jw-reply', 'jewelry', '댓글 답글', '틱톡 댓글에 답하는 형식 — 질문이 곧 후킹', '#1a1a1a', (add) => {
    add(BG('착용 사진'));
    const card = add(SH({ name: '답글 카드', x: 90, y: 330, w: 800, h: 200, radius: 30, fill: solid('#ffffff'), shadow: shadow(0.18, 30, 8) }));
    add(SH({ name: '프로필', shape: 'ellipse', x: 124, y: 364, w: 56, h: 56, fill: grad(135, '#ffb3c7', 1, 1, '#c3a6ff') }));
    add(T({ name: '답글 대상', text: '@yoon_ 님에게 답글', weight: 600, size: 28, color: '#8a8a8a', align: 'left' }, 198, 376));
    const q = add(TB({ name: '댓글', text: '이거 진짜 925 은이에요? 샤워할 때도 껴도 돼요? 🥺', weight: 700, size: 40, color: INK, align: 'left', lh: 1.32 }, 124, 444, 730));
    card.h = q.y + q.h + 36 - card.y;
    add(TIKTOK('답변', '네 ㅎㅎ 샤워·물놀이 OK\n변색 걱정 없는 실버 925 ✨', W / 2, 860));
  }),

  tpl('jw-noti', 'jewelry', '알림 폭탄', '잠금화면에 쏟아지는 알림 — 다들 어디 거냐고', '#1a1a1a', (add) => {
    add(BG('잠금화면 사진'));
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: grad(180, '#000000', 0.38, 0.12) }));
    add(T({ name: '날짜', text: '11월 5일 수요일', weight: 600, size: 34, color: '#ffffff', align: 'center', opacity: 0.92 }, W / 2, 290));
    add(T({ name: '시계', text: '9:41', font: 'Inter', weight: 600, size: 190, color: '#ffffff', align: 'center', lh: 1, tracking: -4 }, W / 2, 336));
    const noti = (i, icon, iconFill, when, title, msg, y) => {
      add(SH({ name: `알림${i}`, x: 70, y, w: 940, h: 156, radius: 38, fill: solid('#f5f5f7', 0.88), shadow: shadow(0.12, 24, 6) }));
      add(SH({ name: `알림${i} 아이콘`, x: 102, y: y + 34, w: 88, h: 88, radius: 22, fill: iconFill }));
      add(centerAt(T({ name: `알림${i} 아이콘 그림`, text: icon, size: 46, align: 'center' }, 146, y + 50), 146, y + 78));
      add(T({ name: `알림${i} 보낸 사람`, text: title, weight: 700, size: 32, color: INK, align: 'left' }, 214, y + 30));
      add(T({ name: `알림${i} 시간`, text: when, weight: 500, size: 26, color: '#8a8a8e', align: 'right' }, 978, y + 34));
      add(T({ name: `알림${i} 내용`, text: msg, weight: 500, size: 32, color: '#1c1c1e', align: 'left' }, 214, y + 82));
    };
    noti(1, '💬', solid('#34c759'), '지금', '지민', '야 그 반지 어디 거야?? 링크 좀 🙏', 600);
    noti(2, '💛', solid('#fee500'), '2분 전', '엄마', '딸 그 반지 엄마도 하나 사줘 ㅋㅋ', 776);
    noti(3, '📷', grad(135, '#feda75', 1, 1, '#d62976'), '5분 전', 'Instagram', 'seo.yeon님 외 38명이 좋아합니다 ❤️', 952);
  }),

  tpl('jw-kakao', 'jewelry', '카톡 대화', '단톡방 캡처 — 반지 정체 묻고 바로 구매', '#b2c7d9', (add) => {
    add(T({ name: '방 이름', text: '‹   우리 셋 💍  3', weight: 700, size: 36, color: INK, align: 'left' }, 76, 290));
    add(T({ name: '아이콘', text: '🔍  ☰', size: 34, color: INK, align: 'right' }, 1004, 292));
    add(SH({ name: '친구 프로필', x: 80, y: 384, w: 84, h: 84, radius: 30, fill: solid('#ffd6e0') }));
    add(centerAt(T({ name: '친구 얼굴', text: '🐰', size: 48, align: 'center' }, 122, 396), 122, 426));
    add(T({ name: '친구 이름', text: '지수', weight: 500, size: 26, color: '#4a5560', align: 'left' }, 184, 382));
    const bubble = (name, text, y, mine, time) => {
      const t = T({ name, text, weight: 500, size: 36, color: INK, align: mine ? 'right' : 'left' }, 0, 0);
      const bw = t.w + 56, bx = mine ? 1000 - bw : 184;
      add(SH({ name: name + ' 말풍선', x: bx, y, w: bw, h: 90, radius: 28, fill: solid(mine ? '#fee500' : '#ffffff') }));
      t.x = mine ? 1000 - 28 - t.w : bx + 28; t.y = y + 45 - t.h / 2;
      add(t);
      add(T({ name: name + ' 시간', text: time, weight: 400, size: 22, color: '#55606b', align: mine ? 'right' : 'left' }, mine ? bx - 12 : bx + bw + 12, y + 56));
    };
    bubble('대화1', '너 반지 뭐야 ㅠㅠ 개예뻐', 420, false, '오후 3:12');
    bubble('대화2', '2만원대임 ㅋㅋ 925 은', 530, true, '오후 3:13');
    bubble('대화3', '미쳤다 링크 내놔 🙏', 640, false, '오후 3:13');
    add(IMG({ name: '사진 보냄', x: 520, y: 760, w: 380, h: 350, radius: 28, fit: 'cover' }));
    add(T({ name: '읽음', text: '1', weight: 700, size: 22, color: '#f5c400', align: 'right' }, 506, 1076));
  }),

  tpl('jw-photobooth', 'jewelry', '인생네컷', '포토부스 네컷 프레임 + 손글씨 · 리본 스티커', '#f3e9ec', (add) => {
    add(SH({ name: '네컷 프레임', x: 320, y: 284, w: 440, h: 950, radius: 10, fill: solid(INK), shadow: shadow(0.22, 30, 12) }));
    for (let i = 0; i < 4; i++) add(IMG({ name: `${i + 1}컷`, x: 340, y: 304 + i * 214, w: 400, h: 196, fit: 'cover' }));
    add(T({ name: '프레임 문구', text: '6A ♡ 2026.11.05', font: 'Galmuri11', weight: 700, size: 24, color: '#ffffff', align: 'center' }, W / 2, 1174));
    add(T({ name: '손글씨', text: '우정링\n맞춘 날', font: 'Nanum Pen Script', weight: 400, size: 70, color: '#2b2b2b', align: 'center', lh: 1.05, rot: -8 }, 190, 420));
    add(centerAt(T({ name: '카메라', text: '📸', size: 84, align: 'center', rot: -10 }, 0, 0), 196, 650));
    add(T({ name: '리본', text: '🎀', size: 96, align: 'center', rot: 14 }, 890, 330));
    add(SPARK(892, 610, 96, HOT, 8));
    add(SPARK(940, 760, 54, '#ffffff', -6));
    add(SH({ name: '하트', shape: 'heart', x: 120, y: 820, w: 110, h: 100, rot: -12, fill: solid(HOT) }));
    add(T({ name: '해시태그', text: '#우정링 #인생네컷', weight: 600, size: 26, color: '#8a7f83', align: 'left' }, 80, 1150));
  }),

  tpl('jw-guess', 'jewelry', '가격 맞히기', '이거 얼마게? — 보기 3개 + 가린 가격', '#f2efe9', (add) => {
    add(T({ name: '훅', text: '이거 얼마게? 🤔', font: 'Gasoek One', weight: 400, size: 100, color: INK, align: 'center' }, W / 2, 286));
    add(IMG({ name: '제품 사진', x: 190, y: 440, w: 700, h: 520, radius: 36, fit: 'cover' }));
    add(SH({ name: '가격 가림', x: 610, y: 900, w: 300, h: 92, radius: 46, rot: -6, fill: solid(INK) }));
    add(centerAt(T({ name: '가린 가격', text: '₩??,???', font: 'Space Grotesk', weight: 700, size: 44, color: '#ffffff', align: 'center', rot: -6 }, 760, 910), 760, 946));
    [['A', '9,900'], ['B', '19,900'], ['C', '59,000']].forEach(([k, v], i) => {
      const x = 90 + i * 300;
      add(SH({ name: `보기${k}`, x, y: 1024, w: 270, h: 84, radius: 42, fill: solid('#ffffff'), stroke: stroke(INK, 3) }));
      add(centerAt(T({ name: `보기${k} 글자`, text: `${k}  ${v}`, weight: 700, size: 34, color: INK, align: 'center' }, x + 135, 1040), x + 135, 1066));
    });
    add(T({ name: '힌트', text: '정답은 댓글에 👀', font: 'Nanum Pen Script', weight: 400, size: 64, color: HOT, align: 'center', rot: -3 }, W / 2, 1128));
  }),

  tpl('jw-vs', 'jewelry', '구별 가능? VS', '백화점 st vs 우리 거 — 차이 보이면 천재', '#0f0f10', (add) => {
    add(T({ name: '훅', text: '차이 보이면 천재 🤓', weight: 800, size: 64, color: '#ffffff', align: 'center', tracking: -1 }, W / 2, 290));
    add(IMG({ name: '왼쪽 사진', x: 70, y: 410, w: 460, h: 640, radius: 26, fit: 'cover' }));
    add(IMG({ name: '오른쪽 사진', x: 550, y: 410, w: 460, h: 640, radius: 26, fit: 'cover' }));
    add(SH({ name: '왼쪽 아래 어둡게', x: 70, y: 850, w: 460, h: 200, radius: 26, fill: grad(180, '#000000', 0, 0.6) }));
    add(SH({ name: '오른쪽 아래 어둡게', x: 550, y: 850, w: 460, h: 200, radius: 26, fill: grad(180, '#000000', 0, 0.6) }));
    add(T({ name: '왼쪽 라벨', text: '백화점 st', weight: 600, size: 30, color: '#ffffff', align: 'left', opacity: 0.85 }, 100, 940));
    add(T({ name: '왼쪽 가격', text: '₩350,000', font: 'Space Grotesk', weight: 700, size: 44, color: '#ffffff', align: 'left' }, 100, 982));
    add(T({ name: '오른쪽 라벨', text: '우리 거', weight: 600, size: 30, color: '#ffffff', align: 'left', opacity: 0.85 }, 580, 940));
    add(T({ name: '오른쪽 가격', text: '₩29,000', font: 'Space Grotesk', weight: 700, size: 44, color: LIME, align: 'left' }, 580, 982));
    add(SH({ name: 'VS 원', shape: 'ellipse', x: 470, y: 660, w: 140, h: 140, fill: solid(LIME) }));
    add(centerAt(T({ name: 'VS', text: 'VS', font: 'Archivo Black', weight: 400, size: 52, color: INK, align: 'center' }, W / 2, 700), W / 2, 730));
    add(T({ name: '정답', text: '정답: 둘 다 실버 925', font: 'Galmuri11', weight: 700, size: 34, color: INK, align: 'center', bg: box(LIME, 20, 12, 8) }, W / 2, 1100));
  }),

  tpl('jw-test30', 'jewelry', '30일 변색 실험', 'DAY 1 vs DAY 30 + 변색 0% 도장', '#f4f2ee', (add) => {
    add(T({ name: '훅', text: '30일 동안 샤워할 때도\n안 뺐더니..', weight: 800, size: 62, color: INK, align: 'left', lh: 1.25, tracking: -1 }, 90, 290));
    add(IMG({ name: 'DAY1 사진', x: 90, y: 490, w: 440, h: 560, radius: 20, fit: 'cover' }));
    add(IMG({ name: 'DAY30 사진', x: 550, y: 490, w: 440, h: 560, radius: 20, fit: 'cover' }));
    add(T({ name: 'DAY1', text: 'DAY 1', font: 'Galmuri11', weight: 700, size: 32, color: '#ffffff', align: 'left', bg: box(INK, 14, 8, 6) }, 112, 512));
    add(T({ name: 'DAY30', text: 'DAY 30', font: 'Galmuri11', weight: 700, size: 32, color: '#ffffff', align: 'left', bg: box(INK, 14, 8, 6) }, 572, 512));
    add(SH({ name: '도장 테두리', x: 610, y: 900, w: 360, h: 150, radius: 22, rot: -10, fill: solid('#ffffff', 0.15), stroke: stroke('#d1202f', 8) }));
    add(centerAt(T({ name: '도장', text: '변색 0%', font: 'Black Han Sans', weight: 400, size: 70, color: '#d1202f', align: 'center', rot: -10 }, 790, 940), 790, 975));
    add(T({ name: '설명', text: '실버 925 · 니켈 프리 · 알러지 걱정 없이', weight: 500, size: 30, color: '#666666', align: 'left' }, 90, 1094));
  }),

  tpl('jw-layering', 'jewelry', '레이어드 공식', '손 사진 + 손그림 화살표로 반지 짚어주기', '#1a1a1a', (add) => {
    add(BG('손 사진'));
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 760, fill: grad(180, '#000000', 0.5, 0) }));
    add(T({ name: '제목', text: '반지 레이어드 공식 💍', weight: 800, size: 64, color: '#ffffff', align: 'left', tracking: -1, shadow: shadow(0.3, 16, 3) }, 90, 300));
    add(T({ name: '부제', text: '손가락마다 두께를 다르게', weight: 500, size: 34, color: '#ffffff', align: 'left', opacity: 0.9, shadow: shadow(0.3, 12, 2) }, 90, 392));
    const note = (name, text, x, y, align = 'left') => add(T({ name, text, font: 'Nanum Pen Script', weight: 400, size: 68, color: '#ffffff', align, shadow: shadow(0.55, 14, 2) }, x, y));
    note('메모1', '① 얇은 체인 링', 100, 520);
    add(SH({ name: '화살표1', shape: 'arrow', thick: 7, x: 300, y: 600, w: 170, h: 130, rot: 90, fill: solid('#ffffff'), shadow: shadow(0.4, 10, 2) }));
    note('메모2', '② 볼드 하트 링', 980, 700, 'right');
    add(SH({ name: '화살표2', shape: 'arrow', thick: 7, flipX: true, x: 640, y: 800, w: 170, h: 130, rot: -90, fill: solid('#ffffff'), shadow: shadow(0.4, 10, 2) }));
    note('메모3', '③ 포인트 볼 링', 100, 1040);
    add(SH({ name: '화살표3', shape: 'arrow', thick: 7, x: 360, y: 920, w: 170, h: 130, fill: solid('#ffffff'), shadow: shadow(0.4, 10, 2) }));
    add(SPARK(930, 470, 70));
  }),

  tpl('jw-tier', 'jewelry', '반지 티어표', 'S·A·B·C 티어 줄 세우기 — 주관 100%', '#111111', (add) => {
    add(T({ name: '제목', text: '반지 티어표', weight: 800, size: 68, color: '#ffffff', align: 'left', tracking: -1 }, 90, 290));
    add(T({ name: '부제', text: '(주관 100% · 반박 시 님 말 맞음)', weight: 500, size: 30, color: '#9a9a9a', align: 'left' }, 90, 384));
    [['S', '#ff6161'], ['A', '#ffb35c'], ['B', '#ffe45c'], ['C', '#7ee081']].forEach(([k, c], i) => {
      const y = 450 + i * 178;
      add(SH({ name: `${k} 칸`, x: 90, y, w: 150, h: 160, radius: 12, fill: solid(c) }));
      add(centerAt(T({ name: `${k} 티어`, text: k, font: 'Archivo Black', weight: 400, size: 84, color: INK, align: 'center' }, 165, y + 20), 165, y + 80));
      add(SH({ name: `${k} 줄`, x: 252, y, w: 738, h: 160, radius: 12, fill: solid('#1f1f1f') }));
      for (let n = 0; n < 4; n++) add(IMG({ name: `${k}티어 반지${n + 1}`, mask: 'ellipse', x: 270 + n * 176, y: y + 10, w: 140, h: 140, fit: 'cover' }));
    });
  }),

  tpl('jw-mbti', 'jewelry', 'MBTI별 추천', '유형별 반지 2×2 — 나는 뭐야?', '#e9e3ff', (add) => {
    add(T({ name: '제목', text: 'MBTI별 반지 추천 🔮', weight: 800, size: 60, color: '#1b1440', align: 'center', tracking: -1 }, W / 2, 288));
    add(T({ name: '부제', text: '저장해두고 친구 태그하기', weight: 500, size: 32, color: '#5b4f8a', align: 'center' }, W / 2, 380));
    [['ENFP', '하트 링 💖'], ['ISTJ', '미니멀 밴드 링'], ['INFP', '별 모티브 링 ⭐'], ['ESTP', '볼드 체인 링']].forEach(([m, d], i) => {
      const x = 90 + (i % 2) * 460, y = 450 + Math.floor(i / 2) * 350;
      add(SH({ name: `${m} 카드`, x, y, w: 440, h: 330, radius: 28, fill: solid('#ffffff') }));
      add(IMG({ name: `${m} 반지`, mask: 'ellipse', x: x + 140, y: y + 26, w: 160, h: 160, fit: 'cover' }));
      add(T({ name: m, text: m, font: 'Unbounded', weight: 800, size: 40, color: '#1b1440', align: 'center' }, x + 220, y + 202));
      add(T({ name: `${m} 설명`, text: d, weight: 600, size: 30, color: '#55507a', align: 'center' }, x + 220, y + 262));
    });
  }),

  tpl('jw-birthstone', 'jewelry', '탄생석', '이달의 탄생석 + 크롬 골드 타이틀 + 반짝이', '#0d1230', (add) => {
    [[150, 360, 46, '#e7c873'], [915, 420, 66, '#ffffff'], [840, 1000, 40, '#e7c873'], [190, 1060, 54, '#ffffff'], [262, 560, 30, '#ffffff']].forEach(([x, y, s, c], i) => add(SPARK(x, y, s, c, 0, `반짝이${i + 1}`)));
    add(T({ name: '라벨', text: '11월 탄생석', font: 'Hahmlet', weight: 500, size: 40, color: '#e7c873', align: 'center' }, W / 2, 312));
    add(T({ name: '보석 이름', text: 'TOPAZ', font: 'Unbounded', weight: 800, size: 150, color: '#a8842c', align: 'center', lh: 1, grad: { on: true, color2: '#fff3c4', angle: 180, chrome: true } }, W / 2, 382));
    add(SH({ name: '골드 링', shape: 'ellipse', x: 330, y: 600, w: 420, h: 420, fill: solid('#000000', 0), stroke: stroke('#e7c873', 3) }));
    add(IMG({ name: '반지 사진', mask: 'ellipse', x: 350, y: 620, w: 380, h: 380, fit: 'cover' }));
    add(T({ name: '의미', text: '행운과 우정을 뜻하는 노란 보석', weight: 500, size: 34, color: '#e9e4d2', align: 'center' }, W / 2, 1052));
    add(T({ name: '추천', text: '11월생 선물로 딱 🎁', weight: 700, size: 32, color: '#0d1230', align: 'center', bg: box('#e7c873', 26, 12) }, W / 2, 1124));
  }),

  tpl('jw-reaction', 'jewelry', '선물 반응', '100일 선물로 줬더니 — 이모지 반응 훅', '#1a1a1a', (add) => {
    add(BG('선물 사진'));
    add(SH({ name: '살짝 어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.1) }));
    add(TIKTOK('자막', '100일 선물로 줬더니\n반응 레전드', W / 2, 470, 54));
    add(T({ name: '이모지', text: '😭😭😭', size: 120, align: 'center' }, W / 2, 680));
    add(T({ name: '손글씨', text: '(진짜 울었음)', font: 'Nanum Pen Script', weight: 400, size: 70, color: '#ffffff', align: 'center', rot: -4, shadow: shadow(0.55, 14, 2) }, W / 2, 860));
    add(SPARK(200, 760, 70));
    add(SPARK(880, 900, 56, '#ffffff', 10));
  }),

  tpl('jw-teuk', 'jewelry', '~특 공감 밈', '금속 알러지 있는 사람 특 → 해결책', '#fff1a8', (add) => {
    add(T({ name: '제목', text: '금속 알러지 있는 사람 특 🙋‍♀️', weight: 800, size: 54, color: INK, align: 'left', tracking: -1 }, 90, 290));
    ['귀걸이 하면 다음 날 귀 빨개짐', '예쁜 건 다 도금이라 포기함', '결국 맨날 같은 것만 함'].forEach((t, i) =>
      add(T({ name: `공감${i + 1}`, text: '☑️  ' + t, weight: 600, size: 38, color: '#222222', align: 'left' }, 90, 400 + i * 80)));
    add(SH({ name: '손 화살표', shape: 'arrow', thick: 8, x: 96, y: 650, w: 150, h: 110, rot: 30, fill: solid(INK) }));
    add(T({ name: '해결', text: '써지컬·925 실버면 끝!', weight: 800, size: 52, color: INK, align: 'left', bg: hl('#ff9cbd', 16, 6, 8) }, 270, 690));
    add(IMG({ name: '제품 사진', x: 470, y: 820, w: 420, h: 360, radius: 28, rot: 3, fit: 'cover', stroke: stroke('#ffffff', 10), shadow: shadow(0.18, 24, 8) }));
    add(T({ name: '스티커', text: '🙆‍♀️', size: 110, align: 'center', rot: -8 }, 260, 960));
  }),

  tpl('jw-bgrade', 'jewelry', 'B급 사장님이 미쳤어요', 'B급 감성 세일 — 노랑 큰 글자 + 폭탄 스티커', '#e3262f', (add) => {
    add(T({ name: '훅', text: '사장님이\n미쳤어요', font: 'TmonMonsori', weight: 400, size: 150, color: '#fff04d', align: 'center', lh: 1.05, stroke: stroke(INK, 10) }, W / 2, 286));
    add(T({ name: '이모지', text: '🤯', size: 120, align: 'center', rot: 12 }, 920, 300));
    add(T({ name: '혜택', text: '925 실버 반지 전 품목 1+1', weight: 800, size: 50, color: INK, align: 'center', bg: box('#ffffff', 30, 16, 12) }, W / 2, 640));
    add(IMG({ name: '제품 사진', x: 140, y: 780, w: 760, h: 420, radius: 24, fit: 'cover', stroke: stroke(INK, 8) }));
    add(SH({ name: '폭탄 스티커', shape: 'star', points: 16, inner: 0.82, x: 690, y: 770, w: 270, h: 270, rot: 12, fill: solid('#fff04d'), stroke: stroke(INK, 6) }));
    add(centerAt(T({ name: '스티커 문구', text: '오늘만!!', font: 'Black Han Sans', weight: 400, size: 56, color: '#e3262f', align: 'center', rot: 12 }, 0, 0), 825, 905));
  }),

  tpl('jw-onlyme', 'jewelry', '이거 나만 몰랐어?', '손그림 동그라미 + 화살표로 콕 집기', '#1a1a1a', (add) => {
    add(BG('착용 사진'));
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 700, fill: grad(180, '#000000', 0.5, 0) }));
    add(T({ name: '훅', text: '이거 나만 몰랐어? 😳', weight: 800, size: 72, color: '#ffffff', align: 'center', tracking: -1, shadow: shadow(0.3, 16, 3) }, W / 2, 300));
    add(SH({ name: '손그림 동그라미', shape: 'scribble', thick: 9, x: 290, y: 640, w: 480, h: 360, rot: -4, fill: solid(HOT) }));
    add(T({ name: '손글씨', text: '후기 2천 개\n실화냐고 ㅋㅋ', font: 'Nanum Pen Script', weight: 400, size: 76, color: HOT, align: 'center', lh: 1.08, rot: -5, bg: hl('#ffffff', 14, 2, 8) }, 780, 420));
    add(SH({ name: '손그림 화살표', shape: 'arrow', thick: 9, flipX: true, x: 600, y: 590, w: 170, h: 140, rot: -90, fill: solid(HOT) }));
    add(T({ name: '설명', text: '알러지 없는 925 실버 · 2만원대', weight: 700, size: 36, color: INK, align: 'center', bg: hl('#ffffff', 16, 7, 10) }, W / 2, 1100));
  }),

  tpl('jw-player', 'jewelry', '뮤직 플레이어', '앨범 아트처럼 — 지금 재생 중인 반지', '#0e0e10', (add) => {
    add(SH({ name: '배경', x: 0, y: 0, w: W, h: H, fill: grad(180, '#3b3a41', 1, 1, '#0e0e10') }));
    add(T({ name: '상단', text: '지금 재생 중', weight: 600, size: 28, color: '#c9c9cf', align: 'center' }, W / 2, 284));
    add(IMG({ name: '앨범 아트', x: 230, y: 340, w: 620, h: 620, radius: 28, fit: 'cover', shadow: shadow(0.45, 50, 20) }));
    add(T({ name: '곡 제목', text: 'Silver Mood', weight: 800, size: 54, color: '#ffffff', align: 'left', tracking: -1 }, 230, 990));
    add(T({ name: '좋아요', text: '♡', weight: 400, size: 52, color: '#ffffff', align: 'right' }, 850, 994));
    add(T({ name: '가수', text: '6A · 오늘의 반지', weight: 500, size: 32, color: '#a1a1aa', align: 'left' }, 230, 1062));
    add(SH({ name: '재생 바', x: 230, y: 1124, w: 620, h: 8, radius: 4, fill: solid('#55555c') }));
    add(SH({ name: '재생 진행', x: 230, y: 1124, w: 250, h: 8, radius: 4, fill: solid('#ffffff') }));
    add(SH({ name: '재생 점', shape: 'ellipse', x: 468, y: 1116, w: 24, h: 24, fill: solid('#ffffff') }));
    add(T({ name: '버튼', text: '⏮      ⏸      ⏭', weight: 400, size: 50, color: '#ffffff', align: 'center' }, W / 2, 1160));
  }),

  tpl('jw-tweet', 'jewelry', '트윗 캡처', '트위터에서 난리 난 그 반지 — 트윗 카드', '#1a1a1a', (add) => {
    add(BG('착용 사진'));
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.35) }));
    add(T({ name: '훅', text: '트위터에서 난리 난 그 반지', weight: 800, size: 60, color: '#ffffff', align: 'left', tracking: -1, shadow: shadow(0.3, 16, 3) }, 90, 300));
    const card = add(SH({ name: '트윗 카드', x: 90, y: 430, w: 900, h: 420, radius: 32, fill: solid('#ffffff'), shadow: shadow(0.25, 40, 12) }));
    add(SH({ name: '프로필', shape: 'ellipse', x: 130, y: 470, w: 90, h: 90, fill: grad(135, '#c3a6ff', 1, 1, '#ffb3c7') }));
    add(centerAt(T({ name: '프로필 그림', text: '💍', size: 46, align: 'center' }, 175, 487), 175, 515));
    add(T({ name: '이름', text: '실버 덕후', weight: 800, size: 36, color: '#0f1419', align: 'left' }, 240, 474));
    add(T({ name: '아이디', text: '@silver_lover · 2시간', weight: 500, size: 28, color: '#536471', align: 'left' }, 240, 522));
    const tw = add(TB({ name: '트윗', text: '아니 반지 2만원인데 925 은이라고?? 진짜 이거 뭐야 ㅋㅋㅋ 바로 3개 삼', weight: 500, size: 44, color: '#0f1419', align: 'left', lh: 1.42 }, 130, 594, 820));
    const st = add(T({ name: '반응 수', text: '💬 128     🔁 1.2천     ♡ 8,431', weight: 500, size: 30, color: '#536471', align: 'left' }, 130, tw.y + tw.h + 34));
    card.h = st.y + st.h + 40 - card.y;
  }),

  tpl('jw-news', 'jewelry', '속보 뉴스', '뉴스 자막처럼 — 재입고·품절 소식', '#1a1a1a', (add) => {
    add(BG('제품 사진'));
    add(T({ name: 'LIVE', text: 'LIVE', font: 'Montserrat', weight: 800, size: 26, color: '#ffffff', align: 'left', tracking: 2, bg: box('#d1202f', 14, 7, 6) }, 90, 300));
    add(T({ name: '채널', text: 'SILVER NEWS', font: 'Montserrat', weight: 800, size: 26, color: '#ffffff', align: 'right', tracking: 4, shadow: shadow(0.4, 10, 2) }, 990, 304));
    add(SH({ name: '속보 칸', x: 70, y: 970, w: 170, h: 96, fill: solid('#d1202f') }));
    add(centerAt(T({ name: '속보', text: '속보', weight: 900, size: 50, color: '#ffffff', align: 'center' }, 155, 980), 155, 1018));
    add(SH({ name: '헤드라인 칸', x: 240, y: 970, w: 770, h: 96, fill: solid('#ffffff') }));
    add(T({ name: '헤드라인', text: '실버 링 3차 재입고, 또 품절', weight: 800, size: 44, color: INK, align: 'left', tracking: -1 }, 264, 992));
    add(SH({ name: '하단 띠', x: 70, y: 1066, w: 940, h: 58, fill: solid(INK, 0.88) }));
    add(T({ name: '흐르는 자막', text: '▶ 4차 재입고 알림 신청 중 · 선착순 300개 · 프로필 링크', weight: 600, size: 27, color: '#ffffff', align: 'left' }, 92, 1080));
  }),

  tpl('jw-pin', 'jewelry', '핀터레스트 핀', '핀 저장 화면처럼 — 감성 레퍼런스 무드', '#ffffff', (add) => {
    add(IMG({ name: '핀 사진', x: 130, y: 290, w: 820, h: 820, radius: 36, fit: 'cover' }));
    add(SH({ name: '저장 버튼', x: 790, y: 318, w: 132, h: 72, radius: 36, fill: solid('#e60023') }));
    add(centerAt(T({ name: '저장', text: '저장', weight: 800, size: 32, color: '#ffffff', align: 'center' }, 856, 330), 856, 354));
    add(T({ name: '제목', text: 'silver ring aesthetic ✨', font: 'Instrument Serif', weight: 400, size: 56, color: INK, align: 'left' }, 130, 1128));
    add(T({ name: '정보', text: '저장 1.2만 · 6A', weight: 500, size: 28, color: '#767676', align: 'left' }, 132, 1200));
  }),

  tpl('jw-chrome', 'jewelry', '크롬 Y2K', '실버 크롬 타이틀 + 별 모양 사진 + 반짝이', '#0b0b0d', (add) => {
    [[118, 650, 56], [962, 610, 72], [905, 1010, 44], [172, 1000, 60]].forEach(([x, y, s], i) => add(SPARK(x, y, s, '#ffffff', 0, `반짝이${i + 1}`)));
    add(T({ name: '타이틀', text: 'SILVER\nSZN', font: 'Unbounded', weight: 900, size: 166, color: '#6f7680', align: 'center', lh: 0.95, tracking: -4, grad: CHROME }, W / 2, 290));
    add(IMG({ name: '반지 사진', mask: 'star', points: 8, inner: 0.74, x: 290, y: 640, w: 500, h: 500, fit: 'cover' }));
    add(T({ name: '설명', text: '925 실버 시즌 · 전 품목 20%', weight: 600, size: 32, color: '#d7d9de', align: 'center' }, W / 2, 1170));
  }),

  tpl('jw-coquette', 'jewelry', '코케트 리본', '핑크 · 리본 · 세리프 이탤릭 — 러블리 무드', '#f7d7de', (add) => {
    add(T({ name: '카피', text: 'lovely, everyday', font: 'Instrument Serif', weight: 400, size: 96, color: '#b0344f', align: 'center', italic: true }, W / 2, 290));
    add(IMG({ name: '사진', mask: 'arch', x: 230, y: 440, w: 620, h: 640, fit: 'cover' }));
    add(T({ name: '리본1', text: '🎀', size: 104, align: 'center', rot: -15 }, 290, 420));
    add(T({ name: '리본2', text: '🎀', size: 72, align: 'center', rot: 12 }, 830, 1010));
    add(SPARK(880, 540, 64));
    add(SPARK(190, 900, 50));
    add(T({ name: '설명', text: '매일 하고 싶은 리본 링', font: 'MaruBuri', weight: 600, size: 36, color: '#7a2a3d', align: 'center' }, W / 2, 1110));
    add(T({ name: '영문', text: 'RIBBON RING · SILVER 925', font: 'Montserrat', weight: 500, size: 22, color: '#b0344f', align: 'center', tracking: 6 }, W / 2, 1172));
  }),

  tpl('jw-unboxing', 'jewelry', '택배 언박싱', '택배 왔다 📦 — 크라프트 배경 + 폴라로이드', '#d8c3a5', (add) => {
    add(T({ name: '훅', text: '택배 왔다 📦', font: 'Galmuri11', weight: 700, size: 56, color: INK, align: 'left', rot: -3, bg: box('#ffffff', 22, 12, 8) }, 92, 292));
    const cx = 540, cy = 800, w = 780, h = 760, deg = 2;
    add(SH({ name: '사진 프레임', x: cx - w / 2, y: cy - h / 2, w, h, rot: deg, radius: 4, fill: solid('#ffffff'), shadow: shadow(0.22, 36, 14) }));
    const [ix, iy] = at(cx, cy, 0, -h / 2 + 30 + 300, deg);
    add(IMG({ name: '언박싱 사진', x: ix - 360, y: iy - 300, w: 720, h: 600, rot: deg, fit: 'cover' }));
    const [tx, ty] = at(cx, cy, 0, h / 2 - 100, deg);
    add(T({ name: '손글씨', text: '포장까지 예쁨 주의 🎁', font: 'Nanum Pen Script', weight: 400, size: 66, color: '#333333', align: 'center', rot: deg }, tx, ty));
    add(SH({ name: '테이프1', x: 140, y: 420, w: 200, h: 56, rot: -32, fill: solid('#ffc9d8', 0.85) }));
    add(SH({ name: '테이프2', x: 760, y: 410, w: 200, h: 56, rot: 28, fill: solid('#c8e6ff', 0.85) }));
  }),

  tpl('jw-diary', 'jewelry', '다꾸 감성', '사진 스티커 + 손글씨 + 낙서 — 다이어리 꾸미기', '#faf7f2', (add) => {
    for (let y = 300; y <= 1240; y += 62) add(SH({ name: '노트 줄', x: 0, y, w: W, h: 2, fill: solid('#000000', 0.06) }));
    add(T({ name: '손글씨 제목', text: '이 반지 미쳤음 ㅠㅠ', font: 'Nanum Pen Script', weight: 400, size: 100, color: '#222222', align: 'left', rot: -2 }, 90, 296));
    add(IMG({ name: '사진 스티커', x: 160, y: 440, w: 560, h: 640, rot: -4, fit: 'cover', stroke: stroke('#ffffff', 16), shadow: shadow(0.18, 26, 10) }));
    add(SH({ name: '마스킹 테이프', x: 340, y: 412, w: 200, h: 56, rot: -8, fill: solid('#ffe08a', 0.85) }));
    add(SH({ name: '손그림 동그라미', shape: 'scribble', thick: 7, x: 480, y: 700, w: 300, h: 220, rot: 6, fill: solid(HOT) }));
    add(SH({ name: '손그림 화살표', shape: 'arrow', thick: 7, flipX: true, x: 770, y: 560, w: 170, h: 130, rot: -90, fill: solid(HOT) }));
    add(T({ name: '메모', text: '매일 끼는 중 ♡', font: 'Nanum Pen Script', weight: 400, size: 66, color: HOT, align: 'left', rot: -3 }, 700, 470));
    add(SH({ name: '하트', shape: 'heart', x: 800, y: 980, w: 90, h: 82, rot: 10, fill: solid(HOT) }));
    add(SPARK(860, 860, 60, '#f2b705'));
  }),

  tpl('jw-popup', 'jewelry', 'Y2K 경고창', '윈도우 경고창 밈 — 지갑 방어 실패', '#cfe3ff', (add) => {
    add(SH({ name: '배경', x: 0, y: 0, w: W, h: H, fill: grad(180, '#cfe3ff', 1, 1, '#ffd6ec') }));
    [[140, 360, 50], [952, 1060, 58], [960, 380, 34]].forEach(([x, y, s], i) => add(SPARK(x, y, s, '#ffffff', 0, `반짝이${i + 1}`)));
    add(T({ name: '훅', text: 'ERROR: 지갑 방어 실패 💸', font: 'Galmuri11', weight: 700, size: 46, color: LIME, align: 'center', bg: box(INK, 26, 14, 10) }, W / 2, 292));
    const hard = (d) => ({ on: true, color: INK, alpha: 1, blur: 0, x: d, y: d });
    add(SH({ name: '창', x: 110, y: 430, w: 860, h: 590, radius: 8, fill: solid('#f2f2f2'), stroke: stroke(INK, 4), shadow: hard(14) }));
    add(SH({ name: '창 제목줄', x: 110, y: 430, w: 860, h: 72, radius: 8, fill: grad(90, '#3a5bd9', 1, 1, '#ff5fb0'), stroke: stroke(INK, 4) }));
    add(T({ name: '창 제목', text: '⚠ warning.exe', font: 'Galmuri11', weight: 700, size: 30, color: '#ffffff', align: 'left' }, 140, 450));
    add(T({ name: '창 버튼', text: '_  □  ×', font: 'Galmuri11', weight: 700, size: 30, color: '#ffffff', align: 'right' }, 940, 448));
    add(IMG({ name: '제품 사진', x: 150, y: 542, w: 330, h: 330, fit: 'cover', stroke: stroke(INK, 3) }));
    add(TB({ name: '경고 문구', text: '이 반지는 너무 예뻐서 곧 품절될 수 있습니다.\n\n그래도 장바구니에 담으시겠습니까?', font: 'Galmuri11', weight: 400, size: 32, color: INK, align: 'left', lh: 1.45 }, 516, 560, 420));
    add(SH({ name: '버튼1', x: 300, y: 910, w: 300, h: 84, radius: 6, fill: solid('#ffffff'), stroke: stroke(INK, 3), shadow: hard(6) }));
    add(centerAt(T({ name: '버튼1 글자', text: '취소', font: 'Galmuri11', weight: 700, size: 34, color: INK, align: 'center' }, 0, 0), 450, 952));
    add(SH({ name: '버튼2', x: 630, y: 910, w: 300, h: 84, radius: 6, fill: solid(LIME), stroke: stroke(INK, 3), shadow: hard(6) }));
    add(centerAt(T({ name: '버튼2 글자', text: '담을래요 ♥', font: 'Galmuri11', weight: 700, size: 34, color: INK, align: 'center' }, 0, 0), 780, 952));
    add(centerAt(T({ name: '커서', text: '👆', size: 76, align: 'center', rot: -14 }, 0, 0), 850, 1040));
  }),

  tpl('jw-dm', 'jewelry', 'DM 문의', '인스타 DM 화면 — 스토리 답장으로 들어온 질문', '#000000', (add) => {
    add(T({ name: '훅', text: '요즘 DM으로 제일 많이 받는 질문 💌', weight: 800, size: 50, color: '#ffffff', align: 'left', tracking: -1 }, 90, 290));
    add(SH({ name: '구분선', x: 70, y: 384, w: 940, h: 2, fill: solid('#ffffff', 0.14) }));
    add(SH({ name: '상대 프로필', shape: 'ellipse', x: 90, y: 410, w: 72, h: 72, fill: grad(135, '#feda75', 1, 1, '#d62976') }));
    add(T({ name: '상대 이름', text: 'seo.yeon', weight: 700, size: 32, color: '#ffffff', align: 'left' }, 182, 412));
    add(T({ name: '활동 상태', text: '방금 전 활동', weight: 500, size: 26, color: '#a8a8a8', align: 'left' }, 182, 452));
    add(T({ name: '스토리 안내', text: '회원님의 스토리에 답장했습니다', weight: 500, size: 26, color: '#a8a8a8', align: 'left' }, 90, 516));
    add(SH({ name: '스토리 선', x: 90, y: 560, w: 6, h: 340, radius: 3, fill: solid('#3a3a3a') }));
    add(IMG({ name: '스토리 사진', x: 114, y: 560, w: 204, h: 340, radius: 22, fit: 'cover' }));
    const bub = (name, text, y, mine) => {
      const t = T({ name, text, weight: 500, size: 34, color: '#ffffff', align: mine ? 'right' : 'left' }, 0, 0);
      const bw = t.w + 64, bx = mine ? 990 - bw : 90;
      add(SH({ name: name + ' 말풍선', x: bx, y, w: bw, h: t.h + 44, radius: 44, fill: mine ? grad(180, '#8a3ffc', 1, 1, '#3d7bff') : solid('#262626') }));
      t.x = bx + 32; t.y = y + 22;
      add(t);
    };
    bub('질문', '언니 이 반지 어디 거예요?? 😭', 922, false);
    bub('답장', '925 실버라 변색 없어요 🤍 프로필 링크!', 1028, true);
  }),

  tpl('jw-gift', 'jewelry', '가격대별 선물', '여친 선물 고민 끝 — 2만·3만·5만원대 추천', '#f4efe8', (add) => {
    add(T({ name: '제목', text: '여친 선물 고민 끝 🎁', weight: 800, size: 64, color: INK, align: 'left', tracking: -1.5 }, 90, 288));
    add(T({ name: '부제', text: '가격대별로 골라 봄 (저장 필수)', weight: 500, size: 32, color: '#7a7268', align: 'left' }, 90, 380));
    [['2만원대', '데일리 체인 링', '매일 껴도 안 질리는 얇은 두께'], ['3만원대', '하트 오픈 링', '사이즈 걱정 없는 프리 사이즈'], ['5만원대', '레이어드 3종 세트', '받으면 무조건 감동받는 조합']].forEach(([p, n, d], i) => {
      const y = 450 + i * 250;
      add(IMG({ name: `${p} 사진`, x: 90, y, w: 220, h: 220, radius: 26, fit: 'cover' }));
      add(T({ name: `${p} 가격대`, text: p, weight: 700, size: 28, color: '#ffffff', align: 'left', bg: box(INK, 18, 8) }, 358, y + 22));
      add(T({ name: `${p} 이름`, text: n, weight: 800, size: 44, color: INK, align: 'left', tracking: -1 }, 340, y + 88));
      add(T({ name: `${p} 설명`, text: d, weight: 500, size: 30, color: '#6b645b', align: 'left' }, 340, y + 152));
    });
    add(SH({ name: 'BEST 스티커', shape: 'star', points: 12, inner: 0.78, x: 64, y: 658, w: 120, h: 120, rot: -10, fill: solid(HOT) }));
    add(centerAt(T({ name: 'BEST', text: 'BEST', font: 'Archivo Black', weight: 400, size: 28, color: '#ffffff', align: 'center', rot: -10 }, 0, 0), 124, 718));
  }),

  tpl('jw-grwm', 'jewelry', 'GRWM', 'Get Ready With Me — 자막 스티커 쌓기', '#1a1a1a', (add) => {
    add(BG('착용 사진'));
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 900, fill: grad(180, '#000000', 0.4, 0) }));
    add(T({ name: 'GRWM', text: 'GRWM', font: 'Unbounded', weight: 800, size: 104, color: '#ffffff', align: 'left', tracking: -3 }, 86, 282));
    add(T({ name: '부제', text: '데이트 가기 전 반지 고르기 💋', weight: 700, size: 40, color: INK, align: 'left', bg: hl('#ffffff', 18, 8, 10) }, 100, 428));
    ['1. 얇은 링 두 개 겹치고', '2. 검지엔 포인트 하트 링', '3. 엄지 링으로 마무리 ✨'].forEach((t, i) =>
      add(T({ name: `단계${i + 1}`, text: t, weight: 600, size: 38, color: '#ffffff', align: 'left', shadow: shadow(0.6, 12, 2) }, 100, 536 + i * 66)));
    add(centerAt(T({ name: '스티커', text: '⏱ 3분 컷', font: 'Galmuri11', weight: 700, size: 38, color: INK, align: 'center', rot: 6, bg: box(LIME, 24, 12) }, 0, 0), 790, 1010));
  }),

  tpl('jw-cart', 'jewelry', '월급날 장바구니', '장바구니 화면 밈 — 담아둔 거 전부 결제', '#ffffff', (add) => {
    add(T({ name: '훅', text: '월급날 내 장바구니 💸', weight: 800, size: 62, color: INK, align: 'left', tracking: -1.5 }, 90, 288));
    const check = (name, cx, cy) => {
      add(SH({ name, x: cx - 20, y: cy - 20, w: 40, h: 40, radius: 10, fill: solid(INK) }));
      add(centerAt(T({ name: name + ' 표시', text: '✓', weight: 800, size: 28, color: '#ffffff', align: 'center' }, 0, 0), cx, cy));
    };
    check('전체선택 체크', 110, 410);
    add(T({ name: '전체선택', text: '전체 선택 (3/3)', weight: 600, size: 30, color: '#6f6f6f', align: 'left' }, 148, 392));
    add(SH({ name: '구분선', x: 70, y: 456, w: 940, h: 2, fill: solid('#000000', 0.08) }));
    [['실버 하트 링', '옵션: 프리 사이즈', '19,900원'], ['볼드 체인 링', '옵션: 13호', '24,900원'], ['스타 포인트 링', '옵션: 프리 사이즈', '14,900원']].forEach(([n, o, p], i) => {
      const y = 486 + i * 178;
      check(`상품${i + 1} 체크`, 110, y + 75);
      add(IMG({ name: `상품${i + 1} 사진`, x: 156, y, w: 150, h: 150, radius: 18, fit: 'cover' }));
      add(T({ name: `상품${i + 1} 이름`, text: n, weight: 700, size: 36, color: INK, align: 'left' }, 336, y + 6));
      add(T({ name: `상품${i + 1} 옵션`, text: o, weight: 500, size: 28, color: '#8a8a8a', align: 'left' }, 336, y + 56));
      add(T({ name: `상품${i + 1} 가격`, text: p, font: 'Space Grotesk', weight: 700, size: 38, color: INK, align: 'left' }, 336, y + 98));
    });
    add(SH({ name: '결제 바', x: 70, y: 1020, w: 940, h: 96, radius: 48, fill: solid(INK) }));
    add(T({ name: '합계', text: '총 59,700원', weight: 800, size: 38, color: '#ffffff', align: 'left' }, 120, 1045));
    add(SH({ name: '결제 버튼', x: 694, y: 1032, w: 300, h: 72, radius: 36, fill: solid(HOT) }));
    add(centerAt(T({ name: '결제 버튼 글자', text: '결제하기 ♥', weight: 800, size: 34, color: '#ffffff', align: 'center' }, 0, 0), 844, 1068));
  }),

  tpl('jw-fortune', 'jewelry', '오늘의 행운 아이템', '타로 카드 무드 — 오늘의 럭키 아이템', '#1b1233', (add) => {
    add(SH({ name: '배경', x: 0, y: 0, w: W, h: H, fill: grad(180, '#1b1233', 1, 1, '#3b2470') }));
    [[150, 440, 40], [930, 520, 56], [180, 980, 50], [905, 1050, 34], [880, 340, 26]].forEach(([x, y, s], i) => add(SPARK(x, y, s, '#e9cf8f', 0, `반짝이${i + 1}`)));
    add(T({ name: '제목', text: '오늘의 행운 아이템 🔮', font: 'Hahmlet', weight: 700, size: 54, color: '#f5ead2', align: 'center' }, W / 2, 290));
    add(SH({ name: '카드', x: 280, y: 400, w: 520, h: 740, radius: 28, fill: solid('#f7f0e1'), stroke: stroke('#d9b66c', 6), shadow: shadow(0.5, 50, 18) }));
    add(SH({ name: '카드 안쪽 테두리', x: 306, y: 426, w: 468, h: 688, radius: 18, fill: solid('#000000', 0), stroke: stroke('#d9b66c', 2) }));
    add(T({ name: '카드 번호', text: 'XXI', font: 'Instrument Serif', weight: 400, size: 40, color: '#8a6a2c', align: 'center' }, W / 2, 446));
    add(IMG({ name: '반지 사진', mask: 'arch', x: 350, y: 506, w: 380, h: 400, fit: 'cover' }));
    add(T({ name: '카드 이름', text: 'THE RING', font: 'Instrument Serif', weight: 400, size: 64, color: '#4a3412', align: 'center', tracking: 4 }, W / 2, 926));
    add(T({ name: '별점', text: '★★★★★', weight: 400, size: 34, color: '#c9a04a', align: 'center', tracking: 6 }, W / 2, 1008));
    add(T({ name: '풀이', text: '금전운 상승 · 연애운 맑음', weight: 600, size: 30, color: '#6b5530', align: 'center' }, W / 2, 1062));
  }),

  tpl('jw-finger', 'jewelry', '손가락별 의미', '반지 끼는 위치별 의미 — 저장·댓글 유도', '#1a1a1a', (add) => {
    add(BG('손 사진'));
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: grad(180, '#000000', 0.6, 0.15) }));
    add(T({ name: '제목', text: '반지 끼는 손가락별 의미 💍', weight: 800, size: 58, color: '#ffffff', align: 'left', tracking: -1 }, 90, 290));
    add(T({ name: '부제', text: '나는 어디에 끼고 있지?', weight: 500, size: 34, color: '#ffffff', align: 'left', opacity: 0.85 }, 90, 378));
    [['엄지', '의지 · 자기주장'], ['검지', '자신감 · 리더십'], ['중지', '균형 · 책임감'], ['약지', '사랑 · 약속'], ['새끼', '기회 · 소원']].forEach(([f, m], i) => {
      const y = 474 + i * 110;
      add(T({ name: f, text: f, weight: 700, size: 34, color: INK, align: 'left', bg: box('#ffffff', 22, 10) }, 112, y));
      add(T({ name: `${f} 의미`, text: m, weight: 600, size: 40, color: '#ffffff', align: 'left', shadow: shadow(0.5, 12, 2) }, 262, y - 3));
    });
    add(T({ name: '댓글 유도', text: '너는 어디에 껴? 댓글 ㄱㄱ', font: 'Nanum Pen Script', weight: 400, size: 72, color: '#ffffff', align: 'left', rot: -3, shadow: shadow(0.6, 14, 2) }, 100, 1040));
  }),

  tpl('jw-dday', 'jewelry', '기념일 D-7', '달력 + 손그림 동그라미 — 기념일 선물 준비', '#fff6ef', (add) => {
    add(T({ name: '제목', text: '우리 100일 D-7 💍', weight: 800, size: 64, color: INK, align: 'center', tracking: -1.5 }, W / 2, 288));
    add(T({ name: '부제', text: '선물은 미리미리 (나만 알기)', weight: 500, size: 32, color: '#8a7a6e', align: 'center' }, W / 2, 380));
    add(SH({ name: '달력', x: 110, y: 450, w: 860, h: 620, radius: 36, fill: solid('#ffffff'), shadow: shadow(0.12, 40, 12) }));
    add(T({ name: '월', text: '11월', weight: 800, size: 46, color: INK, align: 'left' }, 160, 486));
    add(T({ name: '월 영문', text: 'NOVEMBER', font: 'Montserrat', weight: 600, size: 24, color: '#a39a92', align: 'right', tracking: 4 }, 920, 502));
    ['일', '월', '화', '수', '목', '금', '토'].forEach((d, i) => {
      const cx = 197 + i * 114.3, red = i === 0;
      add(T({ name: `${d}요일`, text: d, weight: 600, size: 26, color: red ? '#e5484d' : '#a39a92', align: 'center' }, cx, 578));
      const nums = [];
      for (let r = 0; r < 5; r++) { const n = 1 + i + r * 7; if (n <= 30) nums.push(n); }
      add(T({ name: `${d}요일 날짜`, text: nums.join('\n'), font: 'Space Grotesk', weight: 500, size: 34, color: red ? '#e5484d' : INK, align: 'center', lh: 2.1 }, cx, 632));
    });
    add(SH({ name: '손그림 동그라미', shape: 'scribble', thick: 6, x: 592, y: 832, w: 124, h: 100, rot: -6, fill: solid(HOT) }));
    add(centerAt(T({ name: '메모', text: '100일 ♡', font: 'Nanum Pen Script', weight: 400, size: 62, color: HOT, align: 'center', rot: -6 }, 0, 0), 668, 972));
    add(T({ name: '하단', text: '실버 커플링 미리 준비 완료 🎁', weight: 700, size: 34, color: INK, align: 'center', bg: hl('#ffe1ec', 16, 8, 10) }, W / 2, 1128));
  }),
];
