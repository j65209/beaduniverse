/* =========================================================================
   템플릿 — 릴스·틱톡 감성 (10~20대가 실제로 올리는 화면 느낌)
   카메라: 캠코더 REC · 디카 날짜 · 필름 스트립 · 포토덤프 · 카메라롤 그리드
   인스타: 스토리 스티커 · 함께 해요 · 카운트다운 · 친한 친구 · 게시물 캡처
   앱 화면: 가사 · 스레드 · 홈화면 위젯 · 전화 수신 · 스크린 타임 · AI 채팅 · 보딩패스
   레이아웃: 캡컷 자막 · 반복 아웃라인 · 아무도:나: · 추구미 vs 현실 · 3분할 · 9칸 ·
             스타터팩 · this or that · 월~금 · 오라 · 네온 · 체크무늬
   글자는 안전영역(x 65~1015, y 269~1248, 오른쪽 아래 아이콘 줄 제외) 안.
   ========================================================================= */
import { W, H } from './core.js';
import { T, TB, IMG, SH, BG, SPARK, TIKTOK, centerAt, solid, grad, shadow, stroke, box, tpl, BLOB, GRAIN, HOLLOW, GLOW } from './tpl-kit.js';

const INK = '#111111';
const HOT = '#ff3d8b';
const SERIF = { font: 'Instrument Serif', italic: true, weight: 400 };
const OSD = { font: 'Galmuri11', weight: 700, color: '#ffffff', shadow: { on: true, color: '#000000', alpha: 0.5, blur: 6, x: 0, y: 2 } };
const osd = (name, text, x, y, align = 'left', size = 38) => T(Object.assign({ name, text, size, align }, OSD), x, y);
const igGrad = (c2) => ({ on: true, color2: c2, angle: 90, chrome: false });

export const SNS = [
  /* ---------------- 카메라 감성 ---------------- */
  tpl('sn-camcorder', 'sns', '캠코더 REC', '캠코더 화면 — REC·배터리·타임코드·날짜', '#111111', (add) => {
    add(BG('영상 캡처 사진'));
    add(SH({ name: '살짝 어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.12) }));
    add(GRAIN(0.3));
    add(SH({ name: '뷰파인더', shape: 'corners', thick: 6, x: 90, y: 300, w: 900, h: 810, fill: solid('#ffffff', 0.95) }));
    add(SH({ name: 'REC 점', shape: 'ellipse', x: 138, y: 349, w: 28, h: 28, fill: solid('#ff3b30') }));
    add(osd('REC', 'REC', 180, 340));
    add(osd('화질', 'HD  4:3', 140, 396, 'left', 28));
    add(SH({ name: '배터리', x: 858, y: 346, w: 74, h: 36, radius: 6, fill: solid('#000000', 0), stroke: stroke('#ffffff', 4) }));
    add(SH({ name: '배터리 머리', x: 934, y: 357, w: 8, h: 14, radius: 2, fill: solid('#ffffff') }));
    add(SH({ name: '배터리 잔량', x: 866, y: 354, w: 44, h: 20, radius: 2, fill: solid('#ffffff') }));
    add(T(Object.assign({ name: '자막', text: '친구랑 반지 맞춘 날 ♡', size: 44, align: 'center' }, OSD), W / 2, 900));
    add(osd('타임코드', '▶ 00:02:14', 140, 1040));
    add(osd('날짜', 'NOV 05 2026', 940, 1040, 'right'));
  }),

  tpl('sn-digicam', 'sns', '디카 감성', '디카 플래시 + 빛번짐 + 주황 날짜 스탬프', '#111111', (add) => {
    add(BG('디카 사진'));
    add(BLOB(110, 430, 780, '#ff7a2e', 170, 0.8, '빛번짐'));
    add(BLOB(1010, 1120, 560, '#ffcf70', 150, 0.6, '빛번짐2'));
    add(GRAIN(0.4));
    add(T(Object.assign({ name: '제목', text: 'digicam diary', size: 100, color: '#ffffff', align: 'center', shadow: shadow(0.35, 16, 2) }, SERIF), W / 2, 290));
    add(T({ name: '부제', text: '필터 없이 찍어도 이 감성 📸', weight: 600, size: 34, color: '#ffffff', align: 'center', shadow: shadow(0.45, 12, 2) }, W / 2, 414));
    add(T({ name: '날짜 스탬프', text: "'26 11 05", font: 'Galmuri11', weight: 700, size: 56, color: '#ffa53a', align: 'right', tracking: 4, shadow: GLOW('#ff5a00', 10) }, 980, 1036));
  }),

  tpl('sn-film', 'sns', '필름 스트립', '35mm 필름 2컷 + 에디토리얼 글자', '#efe9df', (add) => {
    add(T(Object.assign({ name: '제목', text: 'film\ndiary', size: 132, color: INK, align: 'left', lh: 0.9 }, SERIF), 84, 284));
    add(T({ name: '부제', text: '필름으로 담은\n오늘의 반지', weight: 600, size: 34, color: '#4a4339', align: 'left', lh: 1.4 }, 92, 560));
    add(T({ name: '필름 정보', text: '36 EXP\nISO 400\n2026.11.05', font: 'Space Grotesk', weight: 500, size: 26, color: '#8a8073', align: 'left', lh: 1.55, tracking: 6 }, 92, 720));
    add(T({ name: '손글씨', text: '필름 사진처럼\n찍히는 반지 ♡', font: 'Nanum Pen Script', weight: 400, size: 62, color: '#b0344f', align: 'left', lh: 1.05, rot: -4 }, 92, 960));
    add(SH({ name: '필름', shape: 'film', x: 480, y: 290, w: 480, h: 950, fill: solid('#161412') }));
    add(IMG({ name: '1컷', x: 556, y: 322, w: 328, h: 428, fit: 'cover' }));
    add(IMG({ name: '2컷', x: 556, y: 780, w: 328, h: 428, fit: 'cover' }));
    add(centerAt(T({ name: '필름 표기', text: 'FILM 400   ▸ 12   ▸ 12A', font: 'Space Grotesk', weight: 700, size: 20, color: '#e0812a', align: 'center', tracking: 4, rot: 90 }, 0, 0), 984, 765));
  }),

  tpl('sn-dump', 'sns', '포토덤프', '사진 여러 장을 흩뿌린 덤프 — 카메라롤 털기', '#f3efe8', (add) => {
    add(T(Object.assign({ name: '제목', text: 'november dump', size: 100, color: INK, align: 'left' }, SERIF), 84, 276));
    add(T({ name: '부제', text: '카메라롤 털기 📷  (1/5)', weight: 500, size: 32, color: '#6b6258', align: 'left' }, 92, 410));
    add(T({ name: '메모', text: 'ㅋㅋ 다 반지', font: 'Nanum Pen Script', weight: 400, size: 64, color: HOT, align: 'right', rot: 6 }, 986, 300));
    const ph = (name, x, y, w, h, rot) => add(IMG({ name, x, y, w, h, rot, fit: 'cover', stroke: stroke('#ffffff', 14), shadow: shadow(0.18, 24, 8) }));
    ph('사진1', 92, 470, 430, 540, -5);
    ph('사진2', 560, 452, 420, 320, 4);
    ph('사진3', 590, 800, 380, 380, -3);
    ph('사진4', 130, 1030, 380, 270, 3);
    ph('사진5', 410, 900, 250, 250, 9);
    add(SH({ name: '테이프1', x: 236, y: 448, w: 160, h: 46, rot: -14, fill: solid('#ffe08a', 0.85) }));
    add(SH({ name: '테이프2', x: 700, y: 430, w: 150, h: 44, rot: 10, fill: solid('#c8e6ff', 0.85) }));
    add(SPARK(540, 860, 70, '#f2b705', 0, '반짝이'));
    add(SH({ name: '하트', shape: 'heart', x: 880, y: 1150, w: 90, h: 82, rot: 12, fill: solid(HOT) }));
  }),

  tpl('sn-roll', 'sns', '카메라롤 그리드', '아이폰 사진 앱 — 3열 그리드 + 선택 체크', '#ffffff', (add) => {
    add(T({ name: '훅', text: '내 카메라롤 근황 📱', weight: 800, size: 56, color: INK, align: 'left', tracking: -1.5 }, 72, 282));
    add(T({ name: '부제', text: '반지 사진만 2,048장 ㅋㅋ', weight: 500, size: 32, color: '#8a8a8e', align: 'left' }, 74, 368));
    add(T({ name: '선택 버튼', text: '선택', weight: 600, size: 30, color: INK, align: 'right', bg: box('#ececf0', 26, 10) }, 1000, 366));
    const g = 4, c = (W - 2 * g) / 3;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) add(IMG({ name: `사진${r * 3 + k + 1}`, x: k * (c + g), y: 440 + r * (c + g), w: c, h: c, fit: 'cover' }));
    add(T({ name: '영상 길이', text: '0:12', weight: 700, size: 26, color: '#ffffff', align: 'right', shadow: shadow(0.6, 6, 1) }, c * 2 + g - 16, 440 + c - 44));
    add(T({ name: '즐겨찾기', text: '♥', weight: 700, size: 32, color: '#ffffff', align: 'left', shadow: shadow(0.6, 6, 1) }, 70, 440 + c * 2 + g - 50));
    const sx = c * 2 + g - 66, sy = 440 + c * 2 + g - 66;
    add(SH({ name: '선택 체크', shape: 'ellipse', x: sx, y: sy, w: 50, h: 50, fill: solid('#0a84ff'), stroke: stroke('#ffffff', 4) }));
    add(centerAt(T({ name: '선택 체크 표시', text: '✓', weight: 800, size: 30, color: '#ffffff', align: 'center' }, 0, 0), sx + 25, sy + 25));
  }),

  /* ---------------- 인스타 스토리 ---------------- */
  tpl('sn-stickers', 'sns', '스토리 스티커', '위치·시간·멘션·해시태그·이모지 슬라이더 스티커', '#1a1a1a', (add) => {
    add(BG('스토리 사진'));
    add(T({ name: '위치 스티커', text: '📍 합정', weight: 800, size: 44, color: '#8a3ffc', align: 'left', rot: -5, grad: igGrad(HOT), bg: box('#ffffff', 22, 12, 16) }, 100, 312));
    add(T({ name: '시간 스티커', text: '오후 4:19', font: 'Inter', weight: 700, size: 46, color: INK, align: 'right', rot: 5, bg: box('#ffffff', 22, 12, 16) }, 970, 338));
    add(T({ name: '멘션 스티커', text: '@daily.ring', weight: 800, size: 48, color: '#ff8a00', align: 'center', rot: -3, grad: igGrad(HOT), bg: box('#ffffff', 24, 12, 16) }, W / 2, 700));
    add(T({ name: '해시태그 스티커', text: '#오늘의반지', weight: 800, size: 44, color: HOT, align: 'left', rot: 3, grad: igGrad('#8a3ffc'), bg: box('#ffffff', 22, 12, 16) }, 150, 860));
    add(SH({ name: '슬라이더 카드', x: 270, y: 990, w: 540, h: 170, radius: 30, fill: solid('#ffffff'), shadow: shadow(0.22, 24, 6) }));
    add(T({ name: '슬라이더 질문', text: '이 조합 몇 점? 😍', weight: 800, size: 36, color: INK, align: 'center' }, W / 2, 1018));
    add(SH({ name: '슬라이더 막대', x: 330, y: 1102, w: 420, h: 12, radius: 6, fill: grad(90, '#ffb03a', 1, 1, HOT) }));
    add(centerAt(T({ name: '슬라이더 이모지', text: '😍', size: 70, align: 'center' }, 0, 0), 668, 1108));
  }),

  tpl('sn-addyours', 'sns', '함께 해요 스티커', '인스타 「함께 해요」 스티커 — 참여 유도', '#1a1a1a', (add) => {
    add(BG('스토리 사진'));
    add(SH({ name: '살짝 어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.15) }));
    add(TIKTOK('훅', '요즘 스토리에 이거 뜨면\n다들 반지 자랑함 ㅋㅋ', W / 2, 330, 48));
    add(SH({ name: '스티커 카드', x: 190, y: 600, w: 700, h: 380, radius: 40, fill: solid('#ffffff'), shadow: shadow(0.25, 30, 8) }));
    ['#ffb3c7', '#c3a6ff', '#9ad7ff'].forEach((c, i) => add(SH({ name: `참여자${i + 1}`, shape: 'ellipse', x: 452 + i * 50, y: 630, w: 76, h: 76, fill: solid(c), stroke: stroke('#ffffff', 5) })));
    add(T({ name: '스티커 이름', text: '함께 해요', weight: 700, size: 28, color: '#8e8e93', align: 'center' }, W / 2, 722));
    add(TB({ name: '질문', text: '너의 최애 반지 보여줘 💍', weight: 800, size: 46, color: INK, align: 'center', lh: 1.3 }, 230, 770, 620));
    add(SH({ name: '참여 버튼', x: 300, y: 872, w: 480, h: 76, radius: 38, fill: solid('#efeff4') }));
    add(centerAt(T({ name: '참여 버튼 글자', text: '⊕ 함께 해요 · 1,284명 참여', weight: 700, size: 30, color: INK, align: 'center' }, 0, 0), W / 2, 910));
  }),

  tpl('sn-countdown', 'sns', '카운트다운 스티커', '재입고·오픈 카운트다운 — 알림 받기', '#1a1a1a', (add) => {
    add(BG('제품 사진'));
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.25) }));
    add(T({ name: '훅', text: '오늘 밤 9시 재입고 🔔', weight: 800, size: 64, color: '#ffffff', align: 'center', tracking: -1, shadow: shadow(0.35, 16, 3) }, W / 2, 300));
    add(SH({ name: '스티커 카드', x: 130, y: 470, w: 820, h: 480, radius: 40, fill: solid('#ffffff'), shadow: shadow(0.25, 30, 8) }));
    add(T({ name: '스티커 제목', text: '재입고까지', weight: 800, size: 44, color: '#8a3ffc', align: 'center', grad: igGrad(HOT) }, W / 2, 508));
    [['02', '시간'], ['14', '분'], ['33', '초']].forEach(([n, u], i) => {
      const x = 180 + i * 250;
      add(SH({ name: `${u} 칸`, x, y: 596, w: 220, h: 176, radius: 24, fill: solid('#f2f2f7') }));
      add(centerAt(T({ name: `${u} 숫자`, text: n, font: 'Space Grotesk', weight: 700, size: 108, color: INK, align: 'center' }, 0, 0), x + 110, 680));
      add(T({ name: `${u} 단위`, text: u, weight: 600, size: 26, color: '#8e8e93', align: 'center' }, x + 110, 786));
    });
    add(SH({ name: '알림 버튼', x: 330, y: 852, w: 420, h: 72, radius: 36, fill: grad(90, '#8a3ffc', 1, 1, HOT) }));
    add(centerAt(T({ name: '알림 버튼 글자', text: '🔔 알림 받기', weight: 800, size: 32, color: '#ffffff', align: 'center' }, 0, 0), W / 2, 888));
  }),

  tpl('sn-cf', 'sns', '친한 친구 스토리', '초록 「친한 친구」 배지 — 나만 알려주는 느낌', '#1a1a1a', (add) => {
    add(BG('스토리 사진'));
    add(SH({ name: '상단 어둡게', x: 0, y: 0, w: W, h: 780, fill: grad(180, '#000000', 0.5, 0) }));
    add(T({ name: '친한 친구 배지', text: '★ 친한 친구', weight: 700, size: 30, color: '#ffffff', align: 'left', bg: box('#2fbd5a', 22, 10) }, 92, 300));
    add(T({ name: '훅', text: '친친한테만 알려주는\n반지 맛집 🤫', weight: 800, size: 68, color: '#ffffff', align: 'left', lh: 1.22, tracking: -1.5, shadow: shadow(0.35, 16, 3) }, 90, 384));
    add(T({ name: '작은 글', text: '(캡처 금지 ㅎㅎ)', weight: 600, size: 34, color: '#ffffff', align: 'left', opacity: 0.85, shadow: shadow(0.35, 12, 2) }, 94, 570));
    add(T({ name: '링크 스티커', text: '🔗 프로필 링크에서 보기', weight: 700, size: 32, color: '#0a6cff', align: 'center', bg: box('#ffffff', 26, 14, 14), shadow: shadow(0.2, 16, 4) }, W / 2, 1060));
  }),

  tpl('sn-igpost', 'sns', '인스타 게시물', '인스타 피드 캡처 — 좋아요·캡션까지', '#ffffff', (add) => {
    add(SH({ name: '프로필 링', shape: 'ellipse', x: 170, y: 288, w: 70, h: 70, fill: grad(45, '#feda75', 1, 1, '#d62976') }));
    add(SH({ name: '프로필 흰 테', shape: 'ellipse', x: 175, y: 293, w: 60, h: 60, fill: solid('#ffffff') }));
    add(IMG({ name: '프로필 사진', mask: 'ellipse', x: 179, y: 297, w: 52, h: 52, fit: 'cover' }));
    add(T({ name: '아이디', text: 'daily.ring', weight: 700, size: 30, color: INK, align: 'left' }, 256, 290));
    add(T({ name: '위치', text: '서울, 합정', weight: 500, size: 24, color: '#6b6b6b', align: 'left' }, 256, 328));
    add(T({ name: '더보기', text: '···', weight: 800, size: 36, color: INK, align: 'right' }, 910, 292));
    add(IMG({ name: '게시물 사진', x: 170, y: 372, w: 740, h: 640, fit: 'cover' }));
    add(T({ name: '아이콘', text: '♡   💬   ➤', weight: 500, size: 38, color: INK, align: 'left' }, 172, 1026));
    add(T({ name: '저장', text: '🔖', size: 34, align: 'right' }, 910, 1028));
    add(T({ name: '좋아요', text: '좋아요 12,403개', weight: 700, size: 28, color: INK, align: 'left' }, 172, 1080));
    add(T({ name: '캡션', text: 'daily.ring  오늘의 조합 💍 ...더 보기', weight: 500, size: 28, color: INK, align: 'left' }, 172, 1124));
  }),

  /* ---------------- 앱 화면 ---------------- */
  tpl('sn-lyrics', 'sns', '가사 화면', '음악 앱 가사 화면 — 지금 부르는 줄만 밝게', '#1d1430', (add) => {
    add(BLOB(200, 520, 920, '#7c3aed', 180, 0.85));
    add(BLOB(920, 920, 820, '#db2777', 180, 0.7, '오라2'));
    add(BLOB(420, 1420, 920, '#f59e0b', 200, 0.45, '오라3'));
    add(GRAIN(0.16));
    add(IMG({ name: '앨범 아트', x: 90, y: 296, w: 116, h: 116, radius: 14, fit: 'cover', shadow: shadow(0.35, 20, 6) }));
    add(T({ name: '곡 제목', text: 'silver moon', weight: 800, size: 38, color: '#ffffff', align: 'left' }, 232, 306));
    add(T({ name: '가수', text: '6A · 오늘의 반지', weight: 500, size: 28, color: '#ffffff', align: 'left', opacity: 0.6 }, 232, 360));
    [['반짝이는 건 전부', 0.32], ['네 손끝 때문이야', 1], ['오늘도 작은 별 하나', 0.32], ['끼우고 나가는 길', 0.32]].forEach(([t, op], i) =>
      add(T({ name: `가사${i + 1}`, text: t, weight: 800, size: 74, color: '#ffffff', align: 'left', tracking: -1.5, opacity: op }, 90, 496 + i * 132)));
    add(SH({ name: '재생 바', x: 90, y: 1058, w: 900, h: 8, radius: 4, fill: solid('#ffffff', 0.25) }));
    add(SH({ name: '재생 진행', x: 90, y: 1058, w: 360, h: 8, radius: 4, fill: solid('#ffffff', 0.9) }));
    add(T({ name: '현재 시간', text: '1:12', weight: 600, size: 24, color: '#ffffff', align: 'left', opacity: 0.6 }, 90, 1080));
    add(T({ name: '남은 시간', text: '-2:03', weight: 600, size: 24, color: '#ffffff', align: 'right', opacity: 0.6 }, 990, 1080));
  }),

  tpl('sn-threads', 'sns', '스레드 글', '스레드 글 캡처 — 이어지는 글 + 첨부 사진', '#ffffff', (add) => {
    const av = (name, x, y, d) => add(SH({ name, shape: 'ellipse', x, y, w: d, h: d, fill: grad(135, '#c3a6ff', 1, 1, '#ffb3c7') }));
    av('프로필1', 90, 298, 76);
    add(T({ name: '아이디1', text: 'silver.zip', weight: 700, size: 34, color: INK, align: 'left' }, 190, 298));
    add(T({ name: '시간1', text: '2시간', weight: 500, size: 30, color: '#9a9a9a', align: 'right' }, 990, 302));
    const t1 = add(TB({ name: '글1', text: '요즘 2만원대 반지 중에 변색 안 되는 거 드디어 찾음 ㅠㅠ 한 달째 매일 끼는 중 (광고 아님 진짜)', weight: 500, size: 38, color: INK, align: 'left', lh: 1.45 }, 190, 350, 800));
    const py = t1.y + t1.h + 22;
    add(IMG({ name: '첨부 사진', x: 190, y: py, w: 500, h: 380, radius: 20, fit: 'cover' }));
    const sy = py + 380 + 22;
    add(T({ name: '반응1', text: '♡ 2.4천     💬 312     🔁 88', weight: 500, size: 30, color: '#6b6b6b', align: 'left' }, 190, sy));
    add(SH({ name: '스레드 선', x: 125, y: 390, w: 5, h: sy + 64 - 390, radius: 3, fill: solid('#dcdcdc') }));
    const y2 = sy + 84;
    av('프로필2', 98, y2, 60);
    add(T({ name: '아이디2', text: 'silver.zip', weight: 700, size: 34, color: INK, align: 'left' }, 190, y2 - 4));
    add(T({ name: '글2', text: '+ 링크는 프로필에 🔗', weight: 500, size: 38, color: INK, align: 'left' }, 190, y2 + 44));
  }),

  tpl('sn-widgets', 'sns', '홈화면 위젯', '아이폰 홈화면 꾸미기 — 사진·시계·메모 위젯', '#f3e6ef', (add) => {
    add(SH({ name: '배경', x: 0, y: 0, w: W, h: H, fill: grad(180, '#f7dce8', 1, 1, '#dfe6f7') }));
    add(T({ name: '훅', text: '폰 배경도 반지로 꾸밈 🎀', weight: 800, size: 54, color: '#2b2340', align: 'left', tracking: -1.5 }, 90, 284));
    add(IMG({ name: '사진 위젯', x: 90, y: 380, w: 900, h: 400, radius: 48, fit: 'cover', shadow: shadow(0.12, 30, 10) }));
    add(SH({ name: '사진 위젯 그늘', x: 90, y: 380, w: 900, h: 400, radius: 48, fill: grad(180, '#000000', 0, 0.38) }));
    add(T({ name: '사진 위젯 글자', text: '오늘의 반지 ✦', weight: 700, size: 34, color: '#ffffff', align: 'left', shadow: shadow(0.45, 12, 2) }, 130, 712));
    add(SH({ name: '시계 위젯', x: 90, y: 810, w: 435, h: 400, radius: 48, fill: solid('#ffffff', 0.85), shadow: shadow(0.1, 30, 10) }));
    add(T({ name: '시계', text: '4:19', font: 'Inter', weight: 600, size: 124, color: '#2b2340', align: 'center', lh: 1, tracking: -3 }, 307, 896));
    add(T({ name: '날짜', text: '11월 5일 목요일', weight: 600, size: 30, color: '#8a86a0', align: 'center' }, 307, 1040));
    add(SH({ name: '메모 위젯', x: 555, y: 810, w: 435, h: 400, radius: 48, fill: solid('#fff7c2'), shadow: shadow(0.1, 30, 10) }));
    add(T({ name: '메모 제목', text: '오늘 할 일', weight: 800, size: 34, color: '#5c4a00', align: 'left' }, 600, 850));
    add(T({ name: '메모 내용', text: '✓ 반지 레이어드\n✓ 물 2L 마시기\n☐ 장바구니 비우기', weight: 600, size: 32, color: '#5c4a00', align: 'left', lh: 1.6 }, 600, 912));
  }),

  tpl('sn-call', 'sns', '전화 수신 화면', '아이폰 전화 오는 화면 밈 — 택배 기사님', '#111111', (add) => {
    add(BG('배경 사진'));
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: grad(180, '#000000', 0.55, 0.78) }));
    add(T({ name: '전화 종류', text: '휴대전화', weight: 500, size: 32, color: '#ffffff', align: 'center', opacity: 0.75 }, W / 2, 316));
    add(T({ name: '발신자', text: '택배 기사님 🚚', weight: 700, size: 80, color: '#ffffff', align: 'center', tracking: -1 }, W / 2, 364));
    add(TIKTOK('자막', '반지 도착했다는 전화 받을 때\n내 심박수 📈', W / 2, 600, 46));
    add(T({ name: '옵션', text: '⏰ 나중에 알림          💬 메시지', weight: 500, size: 30, color: '#ffffff', align: 'center', opacity: 0.85 }, W / 2, 846));
    const btn = (name, cx, color, icon, label) => {
      add(SH({ name: name + ' 버튼', shape: 'ellipse', x: cx - 80, y: 920, w: 160, h: 160, fill: solid(color) }));
      add(centerAt(T({ name: name + ' 아이콘', text: icon, weight: 700, size: 64, color: '#ffffff', align: 'center' }, 0, 0), cx, 1000));
      add(T({ name, text: label, weight: 500, size: 30, color: '#ffffff', align: 'center' }, cx, 1094));
    };
    btn('거절', 280, '#ff3b30', '✕', '거절');
    btn('응답', 800, '#34c759', '✓', '응답');
  }),

  tpl('sn-screentime', 'sns', '스크린 타임', '스크린 타임 리포트 밈 — 쇼핑몰만 4시간', '#f2f2f7', (add) => {
    add(T({ name: '제목', text: '이번 주 스크린 타임 🫠', weight: 800, size: 56, color: INK, align: 'left', tracking: -1.5 }, 90, 286));
    add(SH({ name: '카드', x: 70, y: 380, w: 940, h: 560, radius: 32, fill: solid('#ffffff') }));
    add(T({ name: '평균 라벨', text: '일일 평균', weight: 600, size: 28, color: '#8e8e93', align: 'left' }, 110, 412));
    add(T({ name: '평균', text: '6시간 32분', weight: 800, size: 68, color: INK, align: 'left', tracking: -1.5 }, 110, 450));
    add(T({ name: '증감', text: '▲ 지난주보다 48% 증가', weight: 600, size: 28, color: '#8e8e93', align: 'left' }, 110, 540));
    const hs = [150, 210, 130, 260, 220, 290, 190];
    '일월화수목금토'.split('').forEach((d, i) => {
      const x = 130 + i * 120;
      add(SH({ name: `${d}요일 막대`, x, y: 880 - hs[i], w: 70, h: hs[i], radius: 10, fill: solid(i === 5 ? '#0a84ff' : '#a9d0ff') }));
      add(T({ name: `${d}요일`, text: d, weight: 600, size: 26, color: '#8e8e93', align: 'center' }, x + 35, 892));
    });
    const app = (y, emoji, c1, c2, name, time) => {
      add(SH({ name: `${name} 아이콘`, x: 90, y, w: 70, h: 70, radius: 18, fill: grad(135, c1, 1, 1, c2) }));
      add(centerAt(T({ name: `${name} 이모지`, text: emoji, size: 38, align: 'center' }, 0, 0), 125, y + 35));
      add(T({ name: `${name} 이름`, text: name, weight: 700, size: 36, color: INK, align: 'left' }, 186, y + 12));
      add(T({ name: `${name} 시간`, text: time, weight: 600, size: 32, color: '#8e8e93', align: 'right' }, 990, y + 16));
    };
    app(966, '💍', '#ffb3c7', '#c084fc', '6A 쇼핑', '4시간 12분');
    app(1044, '🎵', '#ff9f68', '#ff3d8b', '음악', '1시간 3분');
  }),

  tpl('sn-aichat', 'sns', 'AI 추천 채팅', 'AI 채팅 화면 밈 — 반지 추천해 달라고 했더니', '#212121', (add) => {
    add(T({ name: '훅', text: 'AI한테 반지 추천해 달라고 했더니..', weight: 800, size: 46, color: '#ffffff', align: 'left', tracking: -1 }, 90, 290));
    const q = T({ name: '질문', text: '20대 데일리 반지 추천해 줘\n금속 알러지 있어 😢', weight: 500, size: 34, color: '#ffffff', align: 'left', lh: 1.4 }, 0, 0);
    const qw = q.w + 64, qx = 990 - qw;
    add(SH({ name: '질문 말풍선', x: qx, y: 384, w: qw, h: q.h + 44, radius: 36, fill: solid('#303030') }));
    q.x = qx + 32; q.y = 406;
    add(q);
    const ay = 384 + q.h + 44 + 40;
    add(SPARK(116, ay + 24, 54, '#ffffff', 0, 'AI 아이콘'));
    const a = add(TB({ name: '답변', text: '알러지가 걱정된다면 니켈 프리 925 실버를 추천해요. 매일 끼기엔 2~3mm 두께의 심플한 링이 부담 없어요 ✨', weight: 500, size: 34, color: '#ececec', align: 'left', lh: 1.55 }, 160, ay, 820));
    const py = a.y + a.h + 30;
    add(IMG({ name: '추천 상품 사진', x: 160, y: py, w: 340, h: 340, radius: 22, fit: 'cover' }));
    add(T({ name: '추천 상품', text: '실버 하트 링\n19,900원', weight: 700, size: 34, color: '#ffffff', align: 'left', lh: 1.45 }, 530, py + 12));
  }),

  tpl('sn-boarding', 'sns', '보딩패스', '항공권 티켓 — 휴가 필수템', '#e7edf5', (add) => {
    add(T({ name: '훅', text: '휴가 가기 전\n필수템 챙김 ✈️', weight: 800, size: 60, color: INK, align: 'left', lh: 1.2, tracking: -1.5 }, 90, 292));
    add(IMG({ name: '사진', x: 690, y: 300, w: 270, h: 320, rot: 7, fit: 'cover', stroke: stroke('#ffffff', 12), shadow: shadow(0.18, 24, 8) }));
    add(SH({ name: '티켓', shape: 'ticket', x: 90, y: 660, w: 900, h: 500, radius: 30, fill: solid('#ffffff'), shadow: shadow(0.12, 30, 10) }));
    add(T({ name: '티켓 라벨', text: 'BOARDING PASS', font: 'Montserrat', weight: 700, size: 24, color: '#8a94a6', align: 'left', tracking: 6 }, 150, 700));
    add(T({ name: '출발', text: 'ICN', font: 'Anton', weight: 400, size: 116, color: INK, align: 'left', lh: 1.05 }, 150, 740));
    add(T({ name: '도착', text: 'RING', font: 'Anton', weight: 400, size: 116, color: INK, align: 'right', lh: 1.05 }, 930, 740));
    add(centerAt(T({ name: '비행기', text: '✈', size: 60, color: HOT, align: 'center' }, 0, 0), W / 2, 806));
    [['날짜', '11.05'], ['게이트', '6A'], ['좌석', '925']].forEach(([k, v], i) => {
      const x = 150 + i * 280;
      add(T({ name: `${k} 라벨`, text: k, weight: 600, size: 24, color: '#8a94a6', align: 'left' }, x, 894));
      add(T({ name: k, text: v, font: 'Space Grotesk', weight: 700, size: 44, color: INK, align: 'left' }, x, 926));
    });
    add(SH({ name: '바코드', shape: 'barcode', x: 150, y: 1020, w: 780, h: 96, fill: solid(INK) }));
  }),

  /* ---------------- 자막 · 타이포 ---------------- */
  tpl('sn-capcut', 'sns', '캡컷 자막', '자동 자막 스타일 — 굵은 외곽선 + 강조 단어', '#1a1a1a', (add) => {
    add(BG('영상 캡처 사진'));
    add(SH({ name: '살짝 어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.12) }));
    add(T({ name: '작은 자막', text: '(30일 동안 샤워할 때도 안 뺌)', weight: 700, size: 36, color: '#ffffff', align: 'center', shadow: shadow(0.6, 10, 2) }, W / 2, 560));
    const cap = (name, text, y, color, size = 100) => add(T({ name, text, font: 'Jalnan', weight: 400, size, color, align: 'center', stroke: stroke(INK, 11), shadow: shadow(0.35, 0, 8) }, W / 2, y));
    cap('자막1', '이거 진짜', 636, '#ffffff');
    cap('자막2', '변색 안 됨', 768, '#ffe14d', 120);
    cap('자막3', 'ㄹㅇ임 😳', 924, '#ffffff');
  }),

  tpl('sn-echo', 'sns', '반복 아웃라인 타이포', '같은 단어를 외곽선으로 반복 — 릴스 커버', '#111111', (add) => {
    add(BG('사진'));
    add(SH({ name: '어둡게', x: 0, y: 0, w: W, h: H, fill: solid('#000000', 0.4) }));
    for (let i = 0; i < 5; i++) add(T({ name: `반복${i + 1}`, text: 'SILVER', font: 'Anton', weight: 400, size: 170, color: '#ffffff', align: 'center', lh: 1, hollow: i === 2 ? { on: false, width: 3 } : HOLLOW(3) }, W / 2, 290 + i * 172));
    add(T({ name: '설명', text: '925 실버 컬렉션 · 11.11 오픈', weight: 600, size: 32, color: '#ffffff', align: 'center', opacity: 0.9 }, W / 2, 1170));
  }),

  tpl('sn-nobody', 'sns', '아무도: 나:', '「아무도: / 나:」 밈 — 묻지도 않았는데 자랑', '#ffffff', (add) => {
    add(T({ name: '아무도', text: '아무도:', weight: 800, size: 58, color: INK, align: 'left' }, 90, 296));
    add(T({ name: '조용', text: '(조용)', weight: 500, size: 44, color: '#9a9a9a', align: 'left' }, 90, 380));
    add(T({ name: '나', text: '나: 이거 925 은이라\n     변색도 안 된다? ㅎㅎ', weight: 800, size: 54, color: INK, align: 'left', lh: 1.32 }, 90, 468));
    add(IMG({ name: '사진', x: 90, y: 650, w: 900, h: 560, radius: 28, fit: 'cover' }));
  }),

  /* ---------------- 레이아웃 ---------------- */
  tpl('sn-split', 'sns', '추구미 vs 현실', '위아래 2분할 — 추구미 / 현실 밈', '#ffffff', (add) => {
    add(IMG({ name: '위 사진', x: 0, y: 0, w: W, h: 956, fit: 'cover' }));
    add(IMG({ name: '아래 사진', x: 0, y: 964, w: W, h: 956, fit: 'cover' }));
    add(T({ name: '위 라벨', text: '추구미 ✨', weight: 800, size: 44, color: INK, align: 'left', bg: box('#ffffff', 24, 12) }, 90, 300));
    add(TIKTOK('자막', '근데 이 반지 끼면 현실도 추구미 됨', W / 2, 900, 40));
    add(T({ name: '아래 라벨', text: '현실 😇', weight: 800, size: 44, color: INK, align: 'left', bg: box('#ffffff', 24, 12) }, 90, 1030));
  }),

  tpl('sn-triptych', 'sns', '3분할 무드', '세로 3분할 — 청순st · 힙st · 꾸안꾸st', '#ffffff', (add) => {
    const cw = (W - 12) / 3;
    ['청순st', '힙st', '꾸안꾸st'].forEach((lb, i) => add(IMG({ name: `${lb} 사진`, x: i * (cw + 6), y: 0, w: cw, h: H, fit: 'cover' })));
    ['청순st', '힙st', '꾸안꾸st'].forEach((lb, i) => add(T({ name: lb, text: lb, weight: 800, size: 36, color: INK, align: 'center', bg: box('#ffffff', 20, 10) }, i * (cw + 6) + cw / 2, 1030)));
    add(TIKTOK('훅', '오늘은 무슨 st? 🤔\n댓글로 골라줘', W / 2, 300, 48));
  }),

  tpl('sn-grid9', 'sns', '9칸 그리드', '3×3 그리드 + 가운데 타이틀 칸', '#111111', (add) => {
    add(T({ name: '훅', text: '11월 반지 기록 ✦', weight: 700, size: 40, color: '#ffffff', align: 'center' }, W / 2, 274));
    const c = 296, g = 6, x0 = 90, y0 = 340;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      const x = x0 + k * (c + g), y = y0 + r * (c + g);
      if (r === 1 && k === 1) {
        add(SH({ name: '타이틀 칸', x, y, w: c, h: c, fill: solid(HOT) }));
        add(centerAt(T({ name: '타이틀', text: 'NOV.\nRINGS', font: 'Anton', weight: 400, size: 86, color: '#ffffff', align: 'center', lh: 0.95 }, 0, 0), x + c / 2, y + c / 2));
      } else add(IMG({ name: `사진${r * 3 + k + 1}`, x, y, w: c, h: c, fit: 'cover' }));
    }
  }),

  tpl('sn-starter', 'sns', '스타터팩', '스타터팩 밈 — 아이템 사진 + 한 줄 설명', '#ffffff', (add) => {
    add(T({ name: '제목', text: '실버 덕후 스타터팩', weight: 900, size: 72, color: INK, align: 'center', tracking: -2 }, W / 2, 284));
    const item = (label, x, y, w, h, lx, ly) => { add(IMG({ name: label + ' 사진', x, y, w, h, fit: 'cover' })); add(T({ name: label, text: label, weight: 600, size: 30, color: INK, align: 'center' }, lx, ly)); };
    item('925 반지 7개', 90, 420, 300, 300, 240, 730);
    item('은 세척 천', 430, 400, 250, 250, 555, 664);
    item('레이어드용 얇은 링', 720, 430, 270, 300, 855, 742);
    item('핀터레스트 저장 2,000개', 140, 800, 340, 280, 310, 1092);
    item('알러지 없는 귀걸이', 560, 830, 380, 240, 750, 1084);
  }),

  tpl('sn-thisorthat', 'sns', 'this or that', '둘 중 하나 고르기 3연속 — 댓글 참여', '#fdf2f8', (add) => {
    add(T(Object.assign({ name: '제목', text: 'this or that?', size: 104, color: INK, align: 'center' }, SERIF), W / 2, 270));
    add(T({ name: '부제', text: '골라서 댓글로 남기기 👇  (ex. 1-왼 2-오 3-왼)', weight: 500, size: 30, color: '#7a6b72', align: 'center' }, W / 2, 410));
    for (let i = 0; i < 3; i++) {
      const y = 460 + i * 250;
      add(IMG({ name: `${i + 1}번 왼쪽`, x: 100, y, w: 370, h: 226, radius: 26, fit: 'cover' }));
      add(IMG({ name: `${i + 1}번 오른쪽`, x: 610, y, w: 370, h: 226, radius: 26, fit: 'cover' }));
      add(centerAt(T(Object.assign({ name: `${i + 1}번 or`, text: 'or', size: 66, color: HOT, align: 'center' }, SERIF), 0, 0), W / 2, y + 113));
      add(T({ name: `${i + 1}번`, text: String(i + 1), weight: 800, size: 28, color: '#ffffff', align: 'center', bg: box(INK, 16, 6) }, 146, y + 16));
    }
  }),

  tpl('sn-week', 'sns', '월~금 반지 일기', '요일별 5컷 — 이번 주 반지 기록', '#f4f1ec', (add) => {
    add(T(Object.assign({ name: '제목', text: 'this week in rings', size: 88, color: INK, align: 'left' }, SERIF), 84, 278));
    add(T({ name: '부제', text: '월–금 데일리 반지 기록 ✍️', weight: 500, size: 32, color: '#6b6258', align: 'left' }, 92, 392));
    ['MON', 'TUE', 'WED', 'THU', 'FRI'].forEach((d, i) => {
      const x = 90 + i * 182;
      add(IMG({ name: `${d} 사진`, x, y: 460, w: 172, h: 470, radius: 14, fit: 'cover' }));
      add(T({ name: d, text: d, font: 'Montserrat', weight: 600, size: 26, color: '#4a4339', align: 'center', tracking: 4 }, x + 86, 952));
    });
    add(SH({ name: '손그림 동그라미', shape: 'scribble', thick: 6, x: 836, y: 926, w: 136, h: 82, rot: -4, fill: solid(HOT) }));
    add(T({ name: '메모', text: '금요일 조합이 최애 ♡', font: 'Nanum Pen Script', weight: 400, size: 62, color: HOT, align: 'right', rot: -3 }, 990, 1012));
  }),

  /* ---------------- 무드 ---------------- */
  tpl('sn-aura', 'sns', '오라 그라데이션', '흐린 색 덩어리 배경 — 오늘의 오라 컬러', '#f6f1ff', (add) => {
    add(BLOB(180, 560, 820, '#b794f6', 170, 0.9));
    add(BLOB(900, 860, 760, '#f9a8d4', 170, 0.85, '오라2'));
    add(BLOB(420, 1380, 900, '#fdba74', 190, 0.55, '오라3'));
    add(GRAIN(0.12));
    add(T(Object.assign({ name: '제목', text: 'your aura today', size: 94, color: '#2e1f4d', align: 'center' }, SERIF), W / 2, 282));
    add(T({ name: '부제', text: '오늘의 오라 컬러: 실버 라벤더 🔮', weight: 600, size: 34, color: '#4b3b6b', align: 'center' }, W / 2, 404));
    add(IMG({ name: '사진', mask: 'ellipse', x: 270, y: 500, w: 540, h: 540, fit: 'cover', stroke: stroke('#ffffff', 8), shadow: shadow(0.18, 40, 12) }));
    add(T({ name: '키워드', text: 'SILVER · LAVENDER · SOFT', font: 'Montserrat', weight: 600, size: 26, color: '#4b3b6b', align: 'center', tracking: 8 }, W / 2, 1100));
  }),

  tpl('sn-neon', 'sns', '네온 사인', '어두운 배경 + 네온 글로우 글자·프레임', '#0b0a12', (add) => {
    add(BLOB(540, 780, 940, '#7c1fff', 220, 0.35, '보라 빛'));
    add(T({ name: '네온 제목', text: 'open late', font: 'Pacifico', weight: 400, size: 104, color: '#fff0fb', align: 'center', shadow: GLOW('#ff4fd8', 34) }, W / 2, 284));
    add(SH({ name: '네온 빛', x: 140, y: 480, w: 800, h: 620, radius: 36, blur: 22, fill: solid('#ff4fd8', 0.95) }));
    add(SH({ name: '네온 안쪽', x: 154, y: 494, w: 772, h: 592, radius: 26, fill: solid('#0b0a12') }));
    add(SH({ name: '네온 관', x: 140, y: 480, w: 800, h: 620, radius: 36, fill: solid('#000000', 0), stroke: stroke('#ffd6f6', 5) }));
    add(IMG({ name: '사진', x: 180, y: 520, w: 720, h: 540, radius: 18, fit: 'cover' }));
    add(T({ name: '설명', text: '오늘 밤 9시 오픈 · 선착순 100명', weight: 700, size: 34, color: '#ffffff', align: 'center', shadow: GLOW('#9b5cff', 18) }, W / 2, 1150));
  }),

  tpl('sn-checker', 'sns', '체크무늬 Y2K', '핑크 체크무늬 + 하트 사진 + 스티커', '#fff3f8', (add) => {
    add(SH({ name: '체크무늬', shape: 'checker', points: 9, x: 0, y: 0, w: W, h: H, fill: solid('#ff8cc6', 0.28) }));
    add(T({ name: '제목', text: '귀여움 과다 주의', font: 'Bagel Fat One', weight: 400, size: 96, color: HOT, align: 'center', stroke: stroke('#ffffff', 10), shadow: { on: true, color: '#7a1f4d', alpha: 1, blur: 0, x: 0, y: 8 } }, W / 2, 292));
    add(IMG({ name: '하트 사진', mask: 'heart', x: 230, y: 480, w: 620, h: 560, fit: 'cover', stroke: stroke('#ffffff', 12) }));
    add(SPARK(180, 540, 110, '#ffffff'));
    add(SPARK(910, 900, 90, '#ffe14d', 0, '반짝이2'));
    add(T({ name: '리본', text: '🎀', size: 110, align: 'center', rot: -12 }, 860, 430));
    add(T({ name: '하단', text: '하트 반지 · 3 colors', weight: 800, size: 38, color: '#ffffff', align: 'center', bg: box(HOT, 30, 14) }, W / 2, 1090));
  }),
];
