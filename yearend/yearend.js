/* 2026 송년회 — 챕터형 팀 대항전 (전승훈 · 전수빈 전용)
   index.html 의 yeLoad() 가 대표 두 분 PC 에서만 불러온다. 오피스 데이터는 window.YE_BRIDGE 로 받는다.
   · 챕터 = 팀 뽑기(c1) + 고른 게임들(setup.plan) + 최종 결전(c7). 게임은 GAMES 에 추가하면 된다.
   · 상태 하나(S)를 Supabase app_kv 'yearend_2026' 에 저장 → 진행자 휴대폰 · TV 가 같은 진행 상황을 본다.
   · TV 화면(L.mode='stage')에는 조작 버튼과 정답 · 제시어가 나오지 않는다 (제시어를 TV 로 보는 게임 제외).
   · 리허설은 별도 문서('_rehearsal')에 저장해 실제 기록과 섞이지 않는다. */
(function(){
'use strict';
if(window.YearEnd) return;
const B=window.YE_BRIDGE;
const KV_KEY='yearend_2026', LS_KEY='brightbeed_yearend_2026', SET_KEY='yearend_2026_setup', SET_LS='brightbeed_yearend_2026_setup', UI_KEY='brightbeed_yearend_ui', VER=1;

/* ---------- 도구 ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const pick=a=>a[Math.floor(Math.random()*a.length)];
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const fmt=n=>{n=Math.round(n||0);return (n<0?'−':'')+Math.abs(n).toLocaleString('ko-KR')+'점';};
const clock=ms=>{const s=Math.ceil((ms||0)/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
const $$=(sel,el)=>Array.from((el||root).querySelectorAll(sel));
const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function chosung(s){ return Array.from(s).map(ch=>{ const c=ch.charCodeAt(0)-0xAC00; return c>=0&&c<11172?CHO[Math.floor(c/588)]:ch; }).join(''); }

/* ---------- 게임 재료 ---------- */
const CHOSUNG=[
  ['음식',['떡볶이','김치찌개','비빔밥','삼겹살','불고기','잡채','짜장면','탕수육','붕어빵','호떡','갈비탕','냉면','칼국수','족발']],
  ['동물',['호랑이','기린','펭귄','다람쥐','코끼리','고슴도치','캥거루','하마','원숭이','거북이','얼룩말']],
  ['나라',['브라질','이탈리아','이집트','프랑스','독일','베트남','스페인','캐나다','인도네시아','아르헨티나']],
  ['영화',['기생충','타이타닉','아바타','극한직업','부산행','겨울왕국','어벤져스','명량','해리포터']],
  ['과일',['바나나','딸기','포도','복숭아','파인애플','망고','체리','수박']],
];
const EMOJI=[
  ['영화','🦁👑','라이온 킹'],['영화','❄️👸⛄','겨울왕국'],['영화','🚢🧊💔','타이타닉'],['영화','🕷️🧑','스파이더맨'],['영화','🦇🧑','배트맨'],['영화','🐠🔍','니모를 찾아서'],['영화','🧙💍🌋','반지의 제왕'],['영화','🦖🏝️','쥬라기 공원'],['영화','🐼🥋','쿵푸팬더'],['영화','🏠🎈👴','업'],['영화','🐀👨‍🍳','라따뚜이'],['영화','🧞🪔','알라딘'],['영화','👽🚲🌕','E.T.'],['영화','🧟🚆','부산행'],['영화','🕵️🍗','극한직업'],
  ['동화','🍎👸🪞','백설공주'],['동화','👠🎃🕛','신데렐라'],['동화','🐢🐇🏁','토끼와 거북이'],['동화','🤥🪵','피노키오'],['동화','🧜‍♀️🫧','인어공주'],['동화','🐖🐖🐖🐺','아기 돼지 삼형제'],['동화','🌱🫘👦','잭과 콩나무'],['동화','🐯☀️🌙','해와 달이 된 오누이'],
  ['속담','🐄🏚️🔨','소 잃고 외양간 고친다'],['속담','🐵🌳⬇️','원숭이도 나무에서 떨어진다'],['속담','🐳🐳🦐','고래 싸움에 새우 등 터진다'],['속담','🌾🙇','벼는 익을수록 고개를 숙인다'],['사자성어','🐦🐦🪨','일석이조'],
  ['음식','🍗🍺','치맥'],['음식','🐟🍞','붕어빵'],['음식','🐖🔥🥬','삼겹살'],
];
const SPOT_PAIRS=[['🍎','🍏'],['😀','😎'],['🌕','🌑'],['❤️','🧡'],['🐭','🐹'],['😀','😃'],['⭐','🌟'],['🕐','🕑']];
const SPOT_SIZES=[[5,8],[5,9],[6,10],[6,10],[6,11],[7,12],[7,12],[7,13]];
const MEMORY_POOL=['🐶','🐱','🐰','🦊','🐻','🐼','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🦉','🐢','🐙','🦀','🐟','🦋','🌵','🌻','🍎','🍌','🍇','🍉','🍓','🍕','🍔','🍩','🍦','☕','⚽','🏀','🎸','🎈','🎁','👑','👓','🌂','🔑','🚗','🚲','✈️','🚀','⏰','📷','💡'];
const FETCH=['빨간색 물건','동전 3개','머리끈','립밤','안경','이어폰','열쇠','볼펜','영수증','휴지 한 장','충전 케이블','파란색 옷을 입은 사람','모자','껌 또는 사탕','오늘 찍은 사진이 있는 휴대폰','팀원 전원의 왼쪽 신발'];
const BALANCE=[['짜장면','짬뽕'],['탕수육 부먹','탕수육 찍먹'],['산','바다'],['여름','겨울'],['강아지','고양이'],['아침형 인간','저녁형 인간'],['평생 치킨 금지','평생 피자 금지'],['투명 인간 되기','하늘 날기'],['과거로 가기','미래로 가기'],['물냉면','비빔냉면'],['민트초코 찬성','민트초코 반대'],['붕어빵 머리부터','붕어빵 꼬리부터'],['콜라','사이다'],['삼겹살','소고기'],['평생 여름만','평생 겨울만'],['밀떡','쌀떡'],['순대는 소금','순대는 막장'],['아이폰','갤럭시'],['1억 받고 1년 무인도','그냥 지금처럼'],['바퀴벌레와 한 방','쥐와 한 방']];
const BOMB_TOPICS=['과일 이름','동물 이름','나라 이름','우리나라 도시 이름','치킨 브랜드','빨간색인 것','겨울에 생각나는 것','학교에서 볼 수 있는 것','바다에 사는 것','영화 제목','세 글자 음식','라면 이름','편의점에서 파는 것','운동 종목','악기 이름','꽃 이름'];
const OX=[
  ['문어의 심장은 3개다',true],['펭귄은 북극에 산다',false],['코알라는 곰의 한 종류다',false],['바나나는 나무가 아니라 풀에서 열린다',true],['번개는 같은 곳에 두 번 치지 않는다',false],['낙타 혹에는 물이 저장되어 있다',false],['금성은 태양계에서 가장 뜨거운 행성이다',true],['태양계에서 가장 큰 행성은 토성이다',false],['상어의 뼈대는 연골로 이루어져 있다',true],['타조의 눈은 뇌보다 크다',true],['오징어의 피는 파란색이다',true],['비행기 블랙박스는 검은색이다',false],['일반 피아노의 건반은 모두 88개다',true],['축구공은 육각형 조각으로만 만들어진다',false],['에펠탑은 여름에 더 높아진다',true],['고양이는 단맛을 느끼지 못한다',true],['소의 위는 네 부분으로 나뉘어 있다',true],['코끼리는 점프를 하지 못한다',true],['사과는 물에 가라앉는다',false],['세계에서 가장 높은 산은 K2다',false],['동지는 1년 중 낮이 가장 짧은 날이다',true],['사람 몸에서 가장 큰 기관은 피부다',true],['세종대왕은 조선의 제4대 왕이다',true],['한글의 기본 자음은 14개다',true],['대한민국의 국화는 장미다',false],['달의 중력은 지구보다 강하다',false],['남극이 북극보다 더 춥다',true],['호주의 수도는 시드니다',false],['캐나다의 수도는 토론토다',false],['돌고래는 포유류다',true],['박쥐는 조류다',false],
];
const FINAL_QS=[
  {q:'세계에서 면적이 가장 작은 나라는?',opts:['모나코','바티칸','산마리노','나우루'],a:1},
  {q:'사람 몸에서 가장 작은 뼈가 있는 곳은?',opts:['손가락','발가락','귀','코'],a:2},
  {q:'빛이 태양에서 지구까지 오는 데 걸리는 시간은 약?',opts:['8초','8분','8시간','8일'],a:1},
  {q:'5만원권 지폐에 그려진 인물은?',opts:['세종대왕','이황','이이','신사임당'],a:3},
  {q:'지구에서 가장 큰 동물은?',opts:['아프리카코끼리','대왕고래','기린','백상아리'],a:1},
  {q:'지구에서 달까지의 거리는 약?',opts:['3만 8천 km','38만 km','380만 km','3,800만 km'],a:1},
  {q:'셰익스피어의 작품이 아닌 것은?',opts:['햄릿','오셀로','맥베스','돈키호테'],a:3},
  {q:'커피의 원산지로 알려진 나라는?',opts:['브라질','콜롬비아','에티오피아','베트남'],a:2},
  {q:'어른 사람의 갈비뼈는 모두 몇 개일까요?',opts:['12개','18개','24개','32개'],a:2},
];
const ACT_WORDS=['복권 긁기','라면 끓이기','셀카 찍기','줄넘기','낚시','볼링 치기','골프 스윙','스쿼트','수영','권투','태권도','테니스','배드민턴','농구 슛','양궁','스키 타기','스케이트','서핑','요가','마라톤','고양이 세수','펭귄 걸음','원숭이','캥거루','닭','코끼리','오리','뱀','거북이','토끼','의사','소방관','요리사','미용사','경찰','선생님','택시 기사','가수','지휘자','마술사','우산 뒤집힘','지하철 손잡이','자판기 동전 넣기','치킨 뜯기','귤 까기','붕어빵 먹기','군고구마 호호 불기','눈사람 만들기','눈싸움','트리 장식','새해 소원 빌기','떡국 먹기','제야의 종 치기','세뱃돈 받기','새해 일출 보기','산타 선물 배달','핫팩 흔들기','캐럴 부르기','로봇청소기','병뚜껑 따기','지각 직전 달리기','월요일 아침 기상','커피 쏟기','양치질','머리 감기','넥타이 매기','모기 잡기','방귀 참기','재채기 참기','졸다가 깨기','롤러코스터 타기','귀신의 집','프러포즈','결혼식 입장','돌잡이','주차하다 긁기'];
const BACK_WORDS=['냉장고','세탁기','돋보기','젓가락','지우개','수박','고구마','김밥','떡볶이','치킨','삼겹살','비행기','지하철','자전거','헬리콥터','바다','사막','화산','무지개','북극곰','기린','코뿔소','문어','피아노','기타','바이올린','드럼','축구','야구','올림픽','월드컵','대통령','아이돌','유튜브','넷플릭스','크리스마스','설날','추석','어린이날','제주도','부산','경복궁','남산타워','에펠탑','피라미드','자유의 여신상','달력','시계','거울','우산','선풍기','에어컨','헤어드라이어','치약','칫솔','수건','비누','고속도로','휴게소','호두과자','찜질방','노래방','편의점','동물원','놀이공원','수족관','도서관','미술관','박물관','병원','약국','학교','유치원'];
const DRAW_WORDS=['우산','안경','기린','나비','달팽이','자전거','비행기','로켓','선풍기','토끼','고양이','강아지','물고기','피자','햄버거','아이스크림','케이크','바나나','수박','포도','눈사람','크리스마스 트리','산타','선물 상자','풍선','하트','별','달','태양','구름','무지개','번개','집','성','다리','등대','기차','배','자동차','신호등','시계','전화기','컵','숟가락','망치','열쇠','왕관','칼','활','문어','고래','상어','거북이','공룡','유령','마녀 모자','외계인','로봇','인어','해파리'];
const WHEEL=[{l:'+500',v:500,c:'#ffc94d'},{l:'+100',v:100,c:'#ffffff'},{l:'−100',v:-100,c:'#9fb6e0'},{l:'+300',v:300,c:'#4fd6b8'},{l:'꽝',v:0,c:'#dfe6f3'},{l:'+200',v:200,c:'#ff8a7a'},{l:'−200',v:-200,c:'#7f95c4'},{l:'+100',v:100,c:'#b9a2ff'}];
const WHEEL_MS=4800, RPS_BEAT=650;

const TEAM_IDS=['a','b','c','d'];
const TEAM_COLORS=['#ff8a7a','#ffc94d','#4fd6b8','#b9a2ff'];
const TEAM_NAMES=['떡볶이','순대','튀김','어묵','치킨','피자','족발','보쌈'];
const PROPS=[
  {id:'tv',ch:'TV',label:'TV와 HDMI 케이블'},
  {id:'laptop',ch:'TV',label:'노트북과 충전기'},
  {id:'phone',ch:'진행',label:'진행자 휴대폰 (오피스에 전승훈 · 전수빈으로 로그인)'},
  {id:'net',ch:'진행',label:'인터넷 (행사장 와이파이 또는 휴대폰 핫스팟)'},
  {id:'gift',ch:'시상',label:'상금 · 선물 · 꼴등 벌칙'},
];
function defaultAwards(){
  return [
    {title:'터줏대감상',desc:'가장 오래 함께해 준 사람',winner:''},
    {title:'올해의 신입상',desc:'가장 빠르게 우리 팀이 된 새 얼굴',winner:''},
    {title:'분위기 메이커상',desc:'주변 온도를 1도 올려 준 사람',winner:''},
    {title:'숨은 해결사상',desc:'조용히 문제를 끝내 놓는 사람',winner:''},
    {title:'칭찬 릴레이상',desc:'동료들이 가장 많이 고마워한 사람',winner:''},
  ];
}

/* ---------- 챕터 · 게임 정의 ---------- */
const CH1={id:'c1',icon:'🃏',title:'운명의 팀 뽑기',sub:'팀 나누기',min:10,
  story:'오늘 함께 싸울 팀부터 정합니다.',
  rules:['주장이 뒤집힌 카드를 차례로 고릅니다.','카드를 뒤집으면 우리 팀원이 공개됩니다.','같은 부서끼리 몰리지 않게 미리 섞어 둡니다.','팀이 완성되면 팀 이름을 정합니다.'],
  props:'없음',score:'점수 없음'};
const FINAL={id:'c7',icon:'🏆',title:'최종 결전',sub:'베팅 · 어워즈 · 시상',min:20,
  story:'지금까지 모은 점수를 걸고 마지막 승부를 겨룹니다.',
  rules:['지금까지 모은 점수의 일부를 겁니다.','마지막 문제를 맞히면 건 점수만큼 얻고, 틀리면 잃습니다.','2026 어워즈 수상자가 있는 팀은 100점을 받습니다.','마지막에 최종 순위를 공개합니다.'],
  props:'상금 · 선물',score:'베팅 점수 ± · 어워즈 1개당 100점'};
const GAMES=[
  {id:'rps',type:'rps',icon:'✌️',title:'TV와 가위바위보',sub:'전원 기립 서바이벌',min:5,
   story:'모두 일어나세요. 오늘의 상대는 TV입니다.',
   rules:['참가자 전원이 일어나 TV와 동시에 가위바위보를 합니다.','TV를 이긴 사람만 서 있고, 비기거나 지면 앉습니다.','마지막까지 남은 사람의 팀이 그 판을 가져갑니다. 모두 3판입니다.'],
   props:'없음',score:'판마다 우승 팀 100점'},
  {id:'chosung',type:'prompt',kind:'chosung',icon:'🔤',title:'초성 퀴즈',sub:'먼저 외치는 팀이 득점',min:10,secs:20,
   story:'글자 첫소리만 보고 맞히세요.',
   rules:['TV에 분류와 초성이 나옵니다.','정답을 가장 먼저 외친 팀이 100점을 가져갑니다.','모두 12문제입니다.'],
   props:'없음',score:'문제당 100점',
   make(){ const out=[]; CHOSUNG.forEach(([cat,list])=>shuffle(list).slice(0,3).forEach(a=>out.push({cat,a,big:chosung(a)}))); return shuffle(out).slice(0,12); }},
  {id:'act',type:'turn',mode:'act',icon:'🙆',title:'몸으로 말해요',sub:'말 없이 몸으로만',min:15,teamSec:160,pts:50,words:ACT_WORDS,
   story:'입은 닫고 온몸으로 전달하세요.',
   rules:['팀원 전원이 돌아가며 출제자가 됩니다.','제시어는 진행자 휴대폰에만 나옵니다. 출제자에게 보여 주세요.','말 없이 몸으로만 설명하고, 맞히면 1개당 50점입니다. 패스는 벌점 없이 다음 단어로 넘어갑니다.'],
   props:'없음',score:'정답 1개당 50점'},
  {id:'emoji',type:'prompt',kind:'emoji',icon:'🧩',title:'이모지 퀴즈',sub:'영화 · 동화 · 속담 맞히기',min:10,secs:20,
   story:'그림 몇 개로 된 암호를 풀어 보세요.',
   rules:['TV에 이모지가 나옵니다.','무엇을 뜻하는지 가장 먼저 외친 팀이 100점을 가져갑니다.','모두 12문제입니다.'],
   props:'없음',score:'문제당 100점',
   make(){ return shuffle(EMOJI).slice(0,12).map(e=>({cat:e[0],big:e[1],a:e[2]})); }},
  {id:'bomb',type:'bomb',icon:'💣',title:'폭탄 돌리기',sub:'터지기 전에 다음 팀으로',min:10,
   story:'언제 터질지는 아무도 모릅니다.',
   rules:['TV에 주제가 나오면 팀 순서대로 그 주제의 단어를 외칩니다.','맞는 단어를 말하면 폭탄이 다음 팀으로 넘어갑니다.','이미 나온 단어는 안 됩니다. 라운드마다 터지지 않은 팀이 50점을 받습니다.'],
   props:'없음',score:'라운드마다 생존 팀 50점'},
  {id:'draw',type:'turn',mode:'draw',icon:'🎨',title:'그림으로 말해요',sub:'휴대폰에 그리면 TV에 그대로',min:15,teamSec:180,pts:100,words:DRAW_WORDS,
   story:'그림 실력은 상관없습니다. 아마도요.',
   rules:['그리는 사람이 진행자 휴대폰에 그리면 TV에 실시간으로 나옵니다.','글자와 숫자는 쓸 수 없습니다. 팀원이 맞히면 1개당 100점입니다.','팀원 전원이 돌아가며 그립니다.'],
   props:'없음',score:'정답 1개당 100점'},
  {id:'spot',type:'prompt',kind:'spot',icon:'🔍',title:'다른 그림 찾기',sub:'좌표를 먼저 외치기',min:5,secs:15,unit:'라운드',
   story:'똑같아 보여도 하나는 다릅니다.',
   rules:['똑같은 그림 사이에 하나만 다른 그림이 숨어 있습니다.','찾은 팀은 좌표를 외치세요. (예: C5)','먼저 맞힌 팀이 100점입니다. 갈수록 어려워집니다.'],
   props:'없음',score:'라운드당 100점',
   make(){ return SPOT_SIZES.map(([rows,cols],i)=>{ const p=SPOT_PAIRS[i%SPOT_PAIRS.length], r=Math.floor(Math.random()*rows), c=Math.floor(Math.random()*cols); return {grid:{rows,cols,base:p[0],odd:p[1],r,c},a:String.fromCharCode(65+c)+(r+1)}; }); }},
  {id:'ox',type:'ox',icon:'⭕',title:'O/X 서바이벌',sub:'전원 기립 상식 대결',min:10,
   story:'틀리면 앉습니다. 끝까지 서 있으세요.',
   rules:['전원 일어나서 머리 위로 O 또는 X를 만듭니다.','틀린 사람은 앉습니다.','끝까지 서 있는 사람 1명당 100점입니다.'],
   props:'없음',score:'생존자 1명당 100점'},
  {id:'wheel',type:'wheel',icon:'🎡',title:'운명의 룰렛',sub:'보너스 찬스',min:5,
   story:'마지막 승부 전에 운을 시험합니다.',
   rules:['점수가 낮은 팀부터 한 번씩 룰렛을 돌립니다.','나온 칸만큼 점수가 오르거나 내립니다.'],
   props:'없음',score:'−200점 ~ +500점'},
  {id:'back',type:'turn',mode:'back',icon:'🙈',title:'등 돌려 스피드 퀴즈',sub:'한 명만 TV를 등지고',min:15,teamSec:160,pts:50,words:BACK_WORDS,
   story:'모두가 아는 답을 한 사람만 모릅니다.',
   rules:['맞히는 사람 한 명만 TV를 등지고 앉습니다.','나머지 팀원은 TV의 제시어를 말로 설명합니다. 제시어를 직접 말하면 패스입니다.','맞히면 1개당 50점입니다. 팀원이 돌아가며 맞힙니다.'],
   props:'없음',score:'정답 1개당 50점'},
  {id:'memory',type:'prompt',kind:'memory',icon:'🧠',title:'사라진 것 찾기',sub:'8초 기억력',min:5,secs:8,unit:'라운드',
   story:'8초 안에 전부 외우세요.',
   rules:['그림 12개가 8초 동안 나옵니다.','순서가 섞여 다시 나올 때 하나가 사라져 있습니다.','사라진 것을 가장 먼저 외친 팀이 100점입니다.'],
   props:'없음',score:'라운드당 100점',
   make(){ return Array.from({length:8},()=>{ const all=shuffle(MEMORY_POOL).slice(0,12), miss=Math.floor(Math.random()*12), left=shuffle(all.filter((_,i)=>i!==miss)); return {mem:{all,left},a:all[miss]}; }); }},
  {id:'fetch',type:'prompt',kind:'fetch',icon:'🏃',title:'가져와! 미션',sub:'먼저 가져오는 팀',min:10,secs:40,unit:'미션',
   story:'주머니와 가방을 뒤질 시간입니다.',
   rules:['TV에 나온 것을 찾아 진행자에게 가져옵니다.','가장 먼저 가져온 팀이 100점입니다.','뛰다가 다치지 않게 조심해 주세요.'],
   props:'없음',score:'미션당 100점',
   make(){ return shuffle(FETCH).slice(0,10).map(big=>({big})); }},
  {id:'balance',type:'multi',icon:'⚖️',title:'이심전심 밸런스',sub:'우리 팀은 한마음',min:10,
   story:'의논은 금지입니다. 눈빛으로 통하세요.',
   rules:['TV에 두 가지 선택지가 나옵니다.','의논 없이 진행자의 신호에 맞춰 팀원 전원이 동시에 한쪽을 가리킵니다.','팀원 전원이 같은 쪽이면 100점입니다.'],
   props:'없음',score:'한마음인 팀마다 100점',
   make(){ return shuffle(BALANCE).slice(0,8); }},
  {id:'ten',type:'ten',icon:'⏱️',title:'10초의 감각',sub:'머릿속 시계 대결',min:10,
   story:'시계 없이 정확히 10초를 맞히세요.',
   rules:['시작하면 TV 시계가 3초 뒤에 사라집니다.','정확히 10초라고 생각할 때 스톱을 누릅니다.','라운드마다 10초에 가장 가까운 팀이 100점입니다.'],
   props:'없음',score:'라운드당 100점'},
];
const DEFAULT_PLAN=['rps','chosung','act','emoji','bomb','draw','spot','ox','wheel'];
const gdef=id=>GAMES.find(g=>g.id===id);
function chapters(){ return [CH1].concat((SETUP.plan||[]).map(gdef).filter(Boolean),[FINAL]).map((c,i)=>Object.assign({},c,{no:i+1})); }
const chap=id=>chapters().find(c=>c.id===id);
const curG=()=>gdef(S.cur.id);

/* ---------- 상태 ---------- */
function freshState(){
  return {
    v:VER,rev:0,cur:{view:'map'},cleared:{},teams:[],adj:{},clearing:null,timer:null,fx:null,openAll:false,
    c1:{step:'intro',out:[],join:[],count:3,mix:true,captains:{},cards:[],plan:{},turn:0},
    g:{},
    c7:{step:'intro',bets:{},right:{},q:null,award:0,awardShown:{},rank:0},
  };
}
/* 진행 준비(게임 구성 · 상품 · 어워즈)는 실제 진행과 리허설이 같이 쓴다 — 리허설 중에 고친 내용이 사라지지 않게 문서를 따로 둔다 */
function freshSetup(){ return {rev:0,date:'',place:'',p1:'',p2:'',p3:'',last:'',closing:'',awards:defaultAwards(),finalQ:{q:'',o1:'',o2:'',o3:'',o4:'',a:0},checks:{},plan:DEFAULT_PLAN.slice()}; }
function readSetup(){ try{ const w=JSON.parse(localStorage.getItem(SET_LS)||'null'); return w&&w.d?Object.assign(freshSetup(),w.d):null; }catch(e){ return null; } }
function normalize(s){
  const out=Object.assign(freshState(),s);
  ['c1','c7'].forEach(k=>{ out[k]=Object.assign(freshState()[k],s[k]||{}); });
  ['c2','c3','c4','c5','c6','setup'].forEach(k=>delete out[k]);   // 예전 형식의 칸
  out.g=s.g||{};
  return out;
}
function readLocal(ls){ try{ const w=JSON.parse(localStorage.getItem(ls)||'null'), j=w&&w.d; return j&&j.v===VER?normalize(j):null; }catch(e){ return null; } }
/* TV/진행자 · 리허설 여부는 탭마다 따로 기억한다 — 노트북 한 대에서 진행자 탭 + TV 쪽 탭으로 쓸 수 있게 */
function loadUi(){ const o={}; try{ const s=JSON.parse(localStorage.getItem(UI_KEY)||'{}')||{}; if(typeof s.sound==='boolean') o.sound=s.sound; }catch(e){} try{ const m=sessionStorage.getItem(UI_KEY+'_mode'); if(m==='stage'||m==='host') o.mode=m; if(sessionStorage.getItem(UI_KEY+'_reh')==='1') o.rehearsal=true; }catch(e){} return o; }
function saveUi(){ try{ localStorage.setItem(UI_KEY,JSON.stringify({sound:L.sound})); }catch(e){} try{ sessionStorage.setItem(UI_KEY+'_mode',L.mode); sessionStorage.setItem(UI_KEY+'_reh',L.rehearsal?'1':'0'); }catch(e){} }

let root=null, S=readLocal(LS_KEY)||freshState(), SETUP=readSetup()||freshSetup();
const L=Object.assign({mode:'host',sound:true,rehearsal:false},loadUi(),{panel:null,real:null,routeShown:null,routeAnim:0,auto:0,synced:false,bound:false,opened:false,peopleJson:'',endedTimer:-1,tickSec:-1,phase:'',nextBeep:0,idleT:0});
const rt={chan:null,starting:false,bc:null,wake:null};
const doc=()=>L.rehearsal?{k:KV_KEY+'_rehearsal',ls:LS_KEY+'_rehearsal'}:{k:KV_KEY,ls:LS_KEY};

const viewHidden=()=>{ const v=document.getElementById('viewYearEnd'); return !v||v.hidden; };
const H=()=>L.mode==='host';

function sendAll(ev,payload){
  const m=Object.assign({r:!!L.rehearsal},payload);
  try{ if(rt.chan) rt.chan.send({type:'broadcast',event:ev,payload:m}); }catch(e){}
  try{ if(rt.bc) rt.bc.postMessage({ev,m}); }catch(e){}
}
function rx(ev,m){ if(!m) return; if(ev==='u'){ onSetup(m.u); return; } if(!!m.r!==!!L.rehearsal) return; if(ev==='s') onRemote(m.s); else if(ev==='d') onDraw(m); }
function persist(){
  /* 문서 전체를 키 하나(d)로 저장한다. kv 는 최상위 키 단위로 3-way 병합을 하므로, 값이 A→B→A 로 빠르게 바뀌는 칸(timer 등)이 서버의 옛 값으로 되살아난다. */
  const d=doc();
  B.kvSet(d.k,d.ls,{d:clone(S)});
  sendAll('s',{s:S});
}
function commit(fn){
  const before=S.fx?S.fx.n:0;
  if(fn) fn(S);
  S.rev=Math.max((S.rev||0)+1,Date.now());
  persist();
  render();
  if(S.fx&&S.fx.n!==before) runFx(S.fx);
}
function onRemote(next){
  if(!next||next.v!==VER) return;
  const first=!L.synced; L.synced=true;
  if((next.rev||0)<(S.rev||0)) return;
  if(JSON.stringify(next)===JSON.stringify(S)) return;
  const before=S.fx?S.fx.n:0;
  S=normalize(next);
  render();
  if(!first&&S.fx&&S.fx.n!==before) runFx(S.fx);
}
const onKv=v=>{ if(v&&v.d) onRemote(v.d); };
function commitSetup(fn){
  fn(SETUP);
  SETUP.rev=Math.max((SETUP.rev||0)+1,Date.now());
  B.kvSet(SET_KEY,SET_LS,{d:clone(SETUP)});
  sendAll('u',{u:SETUP});
  render();
}
function onSetup(next){ if(!next||(next.rev||0)<(SETUP.rev||0)||JSON.stringify(next)===JSON.stringify(SETUP)) return; SETUP=Object.assign(freshSetup(),next); render(); }
const onSetKv=v=>{ if(v&&v.d) onSetup(v.d); };
function setFx(s,t){ s.fx={n:(s.fx?s.fx.n:0)+1,t}; }
async function rtInit(){
  if(!rt.bc&&window.BroadcastChannel){ try{ rt.bc=new BroadcastChannel('yearend-2026'); rt.bc.onmessage=e=>{ if(e.data) rx(e.data.ev,e.data.m); }; }catch(e){} }   // 같은 노트북의 탭끼리는 인터넷 없이도 맞춘다
  if(rt.chan||rt.starting) return;
  rt.starting=true;
  try{
    await B.loadRealtime();
    const sb=window.supabase;
    if(sb&&sb.channel){
      rt.chan=sb.channel('yearend-2026',{config:{broadcast:{self:false}}})
        .on('broadcast',{event:'s'},m=>rx('s',m&&m.payload))
        .on('broadcast',{event:'d'},m=>rx('d',m&&m.payload))
        .on('broadcast',{event:'u'},m=>rx('u',m&&m.payload))
        .subscribe();
    }
  }catch(e){}
  rt.starting=false;
}

/* ---------- 타이머 ---------- */
function timerSet(s,ms,run){ s.timer={id:(s.timer?s.timer.id:0)+1,dur:ms,left:ms,ends:run===false?0:Date.now()+ms,run:run!==false}; }
function leftMs(){ const t=S.timer; if(!t) return null; return t.run?Math.max(0,t.ends-Date.now()):t.left; }
function timeUp(){ const m=leftMs(); return m!=null&&m<=0; }

/* ---------- 소리 ---------- */
const Snd=(function(){
  let ctx=null;
  function ac(){ if(!ctx){ const C=window.AudioContext||window.webkitAudioContext; if(!C) return null; ctx=new C(); } if(ctx.state==='suspended') ctx.resume(); return ctx; }
  function tone(f,t,d,type,v){ const c=ac(); if(!c) return; const at=c.currentTime+t,o=c.createOscillator(),g=c.createGain(); o.type=type||'sine'; o.frequency.value=f; g.gain.setValueAtTime(0.0001,at); g.gain.linearRampToValueAtTime(v||.16,at+.012); g.gain.exponentialRampToValueAtTime(.0008,at+d); o.connect(g); g.connect(c.destination); o.start(at); o.stop(at+d+.05); }
  const P={
    tick(){tone(1200,0,.05,'square',.06);},
    flip(){tone(520,0,.08,'triangle',.14);tone(880,.06,.1,'triangle',.12);},
    shuffle(){for(let i=0;i<8;i++)tone(300+Math.random()*500,i*.06,.05,'square',.05);},
    ding(){tone(880,0,.14,'sine',.22);tone(1320,.1,.24,'sine',.2);},
    pass(){tone(300,0,.12,'triangle',.12);},
    buzz(){tone(140,0,.5,'sawtooth',.18);tone(110,.05,.5,'sawtooth',.14);},
    reveal(){tone(523,0,.12,'triangle',.18);tone(659,.1,.12,'triangle',.18);tone(784,.2,.3,'triangle',.2);},
    stamp(){tone(90,0,.28,'square',.3);tone(180,.02,.16,'sawtooth',.16);},
    drum(){for(let i=0;i<22;i++)tone(150+i*4,i*.055,.05,'square',.05+i*.004);},
    onair(){tone(660,0,.16,'square',.1);tone(660,.3,.16,'square',.1);tone(990,.6,.4,'square',.14);},
    boom(){tone(70,0,.9,'sawtooth',.4);tone(45,.02,1.1,'square',.34);for(let i=0;i<14;i++)tone(60+Math.random()*240,i*.035,.09,'sawtooth',.14);},
    fanfare(){[523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,i*.13,.26,'triangle',.2));},
  };
  return {unlock(){ac();},play(n){ if(L.sound&&P[n]) P[n](); }};
})();

function confetti(ms){
  const cv=document.createElement('canvas');
  cv.className='ye-confetti'; cv.width=innerWidth; cv.height=innerHeight;
  document.body.appendChild(cv);
  const g=cv.getContext('2d'), colors=['#ffffff','#ffc94d','#ff8a7a','#4fd6b8','#b9a2ff','#4f7fcf'];
  const bits=Array.from({length:170},()=>({x:Math.random()*cv.width,y:-20-Math.random()*cv.height*.5,w:6+Math.random()*9,h:8+Math.random()*12,vx:-1.6+Math.random()*3.2,vy:2.4+Math.random()*4.2,r:Math.random()*6.28,vr:-.2+Math.random()*.4,c:pick(colors)}));
  const start=performance.now(), dur=ms||3200;
  (function frame(now){
    const t=now-start;
    g.clearRect(0,0,cv.width,cv.height);
    bits.forEach(b=>{ b.x+=b.vx; b.y+=b.vy; b.r+=b.vr; g.save(); g.translate(b.x,b.y); g.rotate(b.r); g.globalAlpha=t>dur-600?Math.max(0,(dur-t)/600):1; g.fillStyle=b.c; g.fillRect(-b.w/2,-b.h/2,b.w,b.h); g.restore(); });
    if(t<dur) requestAnimationFrame(frame); else cv.remove();
  })(start);
}
function runFx(f){
  if(!f||viewHidden()) return;
  if(f.t==='stamp'){ Snd.play('stamp'); confetti(); return; }
  if(f.t==='fanfare'){ Snd.play('fanfare'); confetti(5200); return; }
  Snd.play(f.t);
}

/* ---------- 사람 · 팀 ---------- */
const people=()=>B.people();
function unit(p){ return String(p.team||p.dept||'기타').replace(/팀$/,''); }
function participants(){ const c=S.c1; return people().filter(p=>p.ceo?c.join.includes(p.name):!c.out.includes(p.name)); }
const teamById=id=>S.teams.find(t=>t.id===id);
const color=t=>TEAM_COLORS[(t.color||0)%TEAM_COLORS.length];
const teamOf=name=>S.teams.find(t=>t.members.includes(name));
function splitSizes(n,k){ const a=[]; for(let i=0;i<k;i++) a.push(Math.floor(n/k)+(i<n%k?1:0)); return a; }
function ensureCaptains(s){
  const c=s.c1, part=participants(), ids=TEAM_IDS.slice(0,c.count), used=new Set(), caps={};
  ids.forEach(id=>{ const n=c.captains[id]; if(n&&part.some(p=>p.name===n)&&!used.has(n)){ caps[id]=n; used.add(n); } });
  const pool=shuffle(part.filter(p=>p.title==='팀장')).concat(shuffle(part.filter(p=>p.title!=='팀장')));
  ids.forEach(id=>{ if(caps[id]) return; const p=pool.find(x=>!used.has(x.name)); if(p){ caps[id]=p.name; used.add(p.name); } });
  c.captains=caps;
}
function makePlan(part,ids,captains,mix){
  const floor=Math.floor(part.length/ids.length), extra=part.length%ids.length;
  const teams=ids.map(id=>({id,units:{},size:1}));
  const capSet=new Set(Object.values(captains));
  teams.forEach(t=>{ const p=part.find(x=>x.name===captains[t.id]); if(p) t.units[unit(p)]=1; });
  const rest=shuffle(part.filter(p=>!capSet.has(p.name)));
  if(mix){ const n={}; rest.forEach(p=>n[unit(p)]=(n[unit(p)]||0)+1); rest.sort((a,b)=>n[unit(b)]-n[unit(a)]||unit(a).localeCompare(unit(b))); }
  const canAdd=t=>t.size<floor||(t.size===floor&&teams.filter(x=>x.size>floor).length<extra);
  const plan={};
  rest.forEach(p=>{
    const u=unit(p);
    const c=shuffle(teams.filter(canAdd)).sort((a,b)=>mix?((a.units[u]||0)-(b.units[u]||0)||a.size-b.size):a.size-b.size);
    const t=c[0]; plan[p.name]=t.id; t.size++; t.units[u]=(t.units[u]||0)+1;
  });
  return plan;
}
function planLeft(id){ const c=S.c1; return Object.keys(c.plan).filter(n=>c.plan[n]===id&&!c.cards.some(x=>x.who===n)); }
function turnTeam(){ const n=S.teams.length; for(let k=0;k<n;k++){ const t=S.teams[(S.c1.turn+k)%n]; if(planLeft(t.id).length) return t; } return null; }

/* ---------- 게임 시작값 · 점수 ---------- */
const START={
  prompt(g,s){ timerSet(s,(g.secs||20)*1000); return {step:'play',items:g.make(),i:0,show:false,win:{}}; },
  multi(g,s){ s.timer=null; return {step:'play',items:g.make(),i:0,right:{}}; },
  turn(g,s){ const order=[]; s.teams.forEach(t=>t.members.forEach(m=>order.push({t:t.id,m}))); s.timer=null; return {step:'ready',words:shuffle(g.words),w:0,order,o:0,got:{}}; },
  rps(g,s){ s.timer=null; return {step:'play',pan:0,n:0,at:0,hand:'',wins:[]}; },
  ox(g,s){ const alive={}; s.teams.forEach(t=>alive[t.id]=t.members.length); timerSet(s,15000); return {step:'play',qs:shuffle(OX).slice(0,10),i:0,show:false,alive}; },
  bomb(g,s){ s.timer=null; return {step:'play',topics:shuffle(BOMB_TOPICS).slice(0,5),r:0,turn:0,lit:false,litAt:0,fuseAt:0,boom:[]}; },
  ten(g,s){ s.timer=null; const R=Math.min(4,Math.max(...s.teams.map(t=>t.members.length))), order=[]; for(let r=0;r<R;r++) s.teams.forEach(t=>order.push({t:t.id,m:t.members[r%t.members.length],r})); return {step:'play',order,cur:0,phase:'ready',at:0,ms:{}}; },
  wheel(g,s){ s.timer=null; const order=s.teams.map(t=>t.id).sort((a,b)=>total(a)-total(b)); return {step:'play',order,cur:0,rot:0,k:-1,at:0,res:{}}; },
};
const SCORE={
  prompt(st){ const o={}; Object.keys(st.win).forEach(i=>{ const t=st.win[i]; if(t) o[t]=(o[t]||0)+100; }); return o; },
  multi(st){ const o={}; Object.keys(st.right).forEach(i=>Object.keys(st.right[i]).forEach(t=>{ if(st.right[i][t]) o[t]=(o[t]||0)+100; })); return o; },
  turn(st,g){ const o={}; Object.keys(st.got).forEach(t=>o[t]=st.got[t]*g.pts); return o; },
  rps(st){ const o={}; st.wins.forEach(t=>{ if(t) o[t]=(o[t]||0)+100; }); return o; },
  ox(st){ const o={}; if(st.step==='result') Object.keys(st.alive).forEach(t=>o[t]=st.alive[t]*100); return o; },
  bomb(st){ const o={}; st.boom.forEach(loser=>{ S.teams.forEach(t=>{ if(t.id!==loser) o[t.id]=(o[t.id]||0)+50; }); }); return o; },
  ten(st){ const o={}, rounds={}; st.order.forEach((p,i)=>{ if(st.ms[i]!=null) (rounds[p.r]=rounds[p.r]||[]).push({t:p.t,d:Math.abs(st.ms[i]-10000)}); }); Object.values(rounds).forEach(a=>{ const best=Math.min(...a.map(x=>x.d)); a.forEach(x=>{ if(x.d===best) o[x.t]=(o[x.t]||0)+100; }); }); return o; },
  wheel(st){ const o={}; Object.keys(st.res).forEach(t=>o[t]=WHEEL[st.res[t]].v); return o; },
};
function finalScore(){ const c=S.c7,o={}; S.teams.forEach(t=>{ const b=+c.bets[t.id]||0; if(c.right[t.id]===true) o[t.id]=(o[t.id]||0)+b; if(c.right[t.id]===false) o[t.id]=(o[t.id]||0)-b; }); awardsReady().forEach((a,i)=>{ if(c.awardShown[i]){ const t=teamOf(a.winner); if(t) o[t.id]=(o[t.id]||0)+100; } }); return o; }
function rawScore(id){
  if(id==='c1') return {};
  if(id==='c7') return finalScore();
  const g=gdef(id), st=S.g[id];
  return g&&st?SCORE[g.type](st,g):{};
}
function chScore(id){ const o=rawScore(id), a=(S.adj||{})[id]||{}; S.teams.forEach(t=>{ o[t.id]=(o[t.id]||0)+(a[t.id]||0); }); return o; }
function total(tid){ return chapters().reduce((s,c)=>s+(chScore(c.id)[tid]||0),0); }
function totalBeforeFinal(tid){ return chapters().filter(c=>c.id!=='c7').reduce((s,c)=>s+(chScore(c.id)[tid]||0),0); }
function awardsReady(){ return (SETUP.awards||[]).filter(a=>a.title&&a.winner); }
function finalQuestion(){
  const f=SETUP.finalQ||{};
  if(f.q&&f.o1&&f.o2&&f.o3&&f.o4) return {q:f.q,opts:[f.o1,f.o2,f.o3,f.o4],a:+f.a||0,tag:'대표 출제'};
  return Object.assign({tag:'상식'},pick(FINAL_QS));
}

/* ---------- 공통 조각 ---------- */
function stageWait(t,s){ return `<div class="ye-wait"><span class="ye-wait-dot"></span><h3>${esc(t)}</h3>${s?`<p>${esc(s)}</p>`:''}</div>`; }
function introCard(c,action){
  const need=c.id!=='c1'&&!S.teams.length;
  return `<div class="ye-intro">
    <div class="ye-intro-poster"><span class="ye-intro-icon">${c.icon}</span><small>CHAPTER ${c.no}</small><h3>${esc(c.title)}</h3><p>${esc(c.story)}</p></div>
    <div class="ye-intro-body">
      <ol class="ye-rules">${c.rules.map(r=>`<li>${esc(r)}</li>`).join('')}</ol>
      <dl class="ye-meta"><div><dt>시간</dt><dd>${c.min}분</dd></div><div><dt>준비물</dt><dd>${esc(c.props)}</dd></div><div><dt>배점</dt><dd>${esc(c.score)}</dd></div></dl>
      ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="${action}" ${need?'disabled':''}>시작하기</button></div>${need?'<p class="ye-note">챕터 1에서 팀을 먼저 만들어 주세요.</p>':''}`:''}
    </div>
  </div>`;
}
function standings(mini){
  if(!S.teams.length) return mini?'':'<div class="ye-board-empty">챕터 1에서 팀이 정해지면 순위표가 열립니다.</div>';
  const rows=S.teams.map(t=>({t,v:total(t.id)})).sort((a,b)=>b.v-a.v);
  return `<div class="ye-board ${mini?'is-mini':''}">${rows.map((r,i)=>`<div class="ye-bd" data-key="${r.t.id}" style="--tc:${color(r.t)}"><span class="ye-bd-rank">${i+1}</span><span class="ye-bd-name">${esc(r.t.name)}</span>${mini?'':`<span class="ye-bd-mem">${esc(r.t.members.join(' · '))}</span>`}<b class="ye-bd-val">${fmt(r.v)}</b></div>`).join('')}</div>`;
}
function resultView(id){
  const c=chap(id), sc=chScore(id), rows=S.teams.map(t=>({t,v:sc[t.id]||0})).sort((a,b)=>b.v-a.v), max=Math.max(1,...rows.map(r=>Math.abs(r.v)));
  return `<div class="ye-result">
    <h3>이번 챕터 점수</h3>
    ${rows.map((r,i)=>`<div class="ye-rr" data-key="${r.t.id}" style="--tc:${color(r.t)}"><span class="ye-rr-rank">${i+1}</span><b class="ye-rr-name">${esc(r.t.name)}</b><span class="ye-rr-bar"><i style="width:${Math.abs(r.v)/max*100}%"></i></span><span class="ye-rr-val">${r.v>0?'+':''}${fmt(r.v)}</span>${H()?`<span class="ye-adj"><button data-a="adj" data-ch="${id}" data-t="${r.t.id}" data-d="-50" aria-label="50점 빼기">−</button><button data-a="adj" data-ch="${id}" data-t="${r.t.id}" data-d="50" aria-label="50점 더하기">+</button></span>`:''}</div>`).join('')}
    ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="clear" data-id="${id}">CHAPTER ${c.no} CLEAR</button></div>`:''}
  </div>`;
}
function timerTools(){ return `<span class="ye-timer-tools"><button class="ye-mini" data-a="tToggle">${S.timer&&S.timer.run?'일시정지':'계속'}</button><button class="ye-mini" data-a="tAdd" data-ms="10000">+10초</button></span>`; }
function teamButtons(action,isOn){ return `<div class="ye-teamtoggles">${S.teams.map(t=>`<button class="${isOn(t)?'is-on':''}" style="--tc:${color(t)}" data-a="${action}" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</div>`; }

/* ---------- 챕터 1 · 팀 뽑기 ---------- */
function c1View(){
  const c=S.c1;
  if(c.step==='intro') return introCard(chap('c1'),'c1Setup');
  if(c.step==='setup') return c1Setup();
  if(c.step==='draft') return c1Draft();
  return c1Naming();
}
function c1Setup(){
  const c=S.c1, all=people(), part=participants();
  if(!H()) return stageWait('팀 편성을 준비하고 있습니다','참가자 '+part.length+'명');
  const emp=all.filter(p=>!p.ceo), ceo=all.filter(p=>p.ceo), groups={};
  emp.forEach(p=>(groups[unit(p)]=groups[unit(p)]||[]).push(p));
  const chip=(p,on)=>`<button class="ye-chip ${on?'is-on':''}" data-a="c1Toggle" data-n="${esc(p.name)}" aria-pressed="${on}"><b>${esc(p.name)}</b>${p.title?`<small>${esc(p.title)}</small>`:''}</button>`;
  const ids=TEAM_IDS.slice(0,c.count), caps=ids.map(id=>c.captains[id]);
  const capOk=new Set(caps).size===ids.length&&caps.every(n=>part.some(p=>p.name===n));
  const ok=part.length>=c.count*2&&capOk;
  return `<div class="ye-block">
    <section class="ye-sec"><h3>1. 누가 참가하나요?</h3><p class="ye-hint">오피스 조직도에서 가져왔습니다. 빠지는 사람은 눌러서 끄세요.</p>
      ${Object.keys(groups).map(u=>`<div class="ye-chipgroup"><span>${esc(u)}</span><div>${groups[u].map(p=>chip(p,!c.out.includes(p.name))).join('')}</div></div>`).join('')}
      <div class="ye-chipgroup"><span>대표 (켜면 팀원으로 참가)</span><div>${ceo.map(p=>chip(p,c.join.includes(p.name))).join('')}</div></div>
    </section>
    <section class="ye-sec"><h3>2. 몇 팀으로 나눌까요?</h3>
      <div class="ye-seg">${[3,4].map(n=>`<button class="${c.count===n?'is-on':''}" data-a="c1Count" data-n="${n}">${n}팀</button>`).join('')}</div>
      <p class="ye-hint">참가자 ${part.length}명 → ${splitSizes(part.length,c.count).join(' · ')}명</p>
    </section>
    <section class="ye-sec"><h3>3. 주장은 누구인가요?</h3>
      <div class="ye-caps">${ids.map((id,i)=>`<label style="--tc:${TEAM_COLORS[i]}"><span>${i+1}팀 주장</span><select data-c="captain" data-t="${id}">${part.map(p=>`<option value="${esc(p.name)}" ${c.captains[id]===p.name?'selected':''}>${esc(p.name)}${p.title?' ('+esc(p.title)+')':''}</option>`).join('')}</select></label>`).join('')}</div>
      <label class="ye-switch"><input type="checkbox" data-c="mix" ${c.mix?'checked':''}><span>같은 부서끼리 몰리지 않게 섞기</span></label>
    </section>
    ${ok?'':`<p class="ye-note">${part.length<c.count*2?'팀마다 2명 이상 필요합니다.':'주장을 팀마다 다른 사람으로 골라 주세요.'}</p>`}
    <div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c1Shuffle" ${ok?'':'disabled'}>카드 섞기</button></div>
  </div>`;
}
function c1Draft(){
  const c=S.c1, t=turnTeam(), left=c.cards.filter(x=>!x.who).length;
  const cards=c.cards.map((x,i)=>{
    const tm=x.who?teamById(x.team):null, p=x.who?people().find(q=>q.name===x.who):null;
    return `<button class="ye-card ${x.who?'is-open':''}" ${H()&&!x.who&&t?`data-a="c1Flip" data-i="${i}"`:'disabled'} ${tm?`style="--tc:${color(tm)}"`:''} aria-label="${x.who?esc(x.who):'카드 '+(i+1)}"><span class="ye-card-in"><span class="ye-card-f"><b>${i+1}</b></span><span class="ye-card-b"><b>${esc(x.who||'')}</b><small>${p?esc(unit(p)):''}</small></span></span></button>`;
  }).join('');
  const teams=S.teams.map(tm=>`<div class="ye-team ${t&&t.id===tm.id?'is-turn':''}" style="--tc:${color(tm)}"><h4>${esc(tm.name)}</h4><ul>${tm.members.map((m,i)=>`<li data-key="${esc(m)}" class="${i===0?'is-cap':''}">${esc(m)}${i===0?'<small>주장</small>':''}</li>`).join('')}</ul></div>`).join('');
  return `<div class="ye-draft">
    <div class="ye-draft-left">
      ${t?`<div class="ye-turn" style="--tc:${color(t)}"><b>${esc(t.name)}</b> 주장 ${esc(t.captain)} 님, 카드를 골라 주세요 <span>남은 카드 ${left}장</span></div>`:'<div class="ye-turn is-done"><b>팀 편성 완료!</b> 이제 팀 이름을 정합니다.</div>'}
      <div class="ye-cards">${cards}</div>
      ${H()?`<div class="ye-actions">${t?`<button class="ye-btn" data-a="c1Auto">${L.auto?'자동 멈춤':'남은 카드 자동 공개'}</button>`:`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c1Name">팀 이름 정하기</button>`}<button class="ye-btn ye-btn-ghost" data-a="c1Redo">처음부터 다시 섞기</button></div>`:''}
    </div>
    <div class="ye-teams">${teams}</div>
  </div>`;
}
function c1Naming(){
  return `<div class="ye-block">
    <h3 class="ye-center ye-h">팀 이름을 정해 주세요</h3>
    <div class="ye-teams ye-teams-row">${S.teams.map(t=>`<div class="ye-team" style="--tc:${color(t)}">${H()?`<div class="ye-nameinput"><input type="text" maxlength="12" value="${esc(t.name)}" data-c="teamName" data-t="${t.id}" aria-label="팀 이름"><button class="ye-mini" data-a="c1Dice" data-t="${t.id}" aria-label="다른 이름 뽑기">🎲</button></div>`:`<h4>${esc(t.name)}</h4>`}<ul>${t.members.map((m,i)=>`<li class="${i===0?'is-cap':''}">${esc(m)}${i===0?'<small>주장</small>':''}</li>`).join('')}</ul></div>`).join('')}</div>
    ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c1Done">팀 확정</button></div>`:''}
  </div>`;
}

/* ---------- 게임 화면 ---------- */
function gameView(g,st){
  if(!st) return introCard(g,'gStart');
  if(st.step==='result') return resultView(g.id);
  return {prompt:gPrompt,multi:gMulti,turn:gTurn,rps:gRps,ox:gOx,bomb:gBomb,ten:gTen,wheel:gWheel}[g.type](g,st);
}
function spotGrid(it,show){
  const g=it.grid, cells=[`<span class="ye-spot-h"></span>`];
  for(let c=0;c<g.cols;c++) cells.push(`<span class="ye-spot-h">${String.fromCharCode(65+c)}</span>`);
  for(let r=0;r<g.rows;r++){ cells.push(`<span class="ye-spot-h">${r+1}</span>`); for(let c=0;c<g.cols;c++){ const hit=r===g.r&&c===g.c; cells.push(`<span class="${hit&&show?'is-hit':''}">${hit?g.odd:g.base}</span>`); } }
  return `<div class="ye-spot" style="--cols:${g.cols}">${cells.join('')}</div>`;
}
function promptBody(g,st,it){
  if(it.grid) return spotGrid(it,st.show);
  if(it.mem){
    const look=!st.show&&S.timer&&leftMs()>0, list=look?it.mem.all:it.mem.left;
    return `<div class="ye-mem-title">${look?'외우세요!':'사라진 것은?'}</div><div class="ye-mem" data-key="${look?'look':'find'}">${list.map(e=>`<span>${e}</span>`).join('')}</div>`;
  }
  return `<div class="ye-bigtext is-${g.kind}">${esc(it.big)}</div>`;
}
function gPrompt(g,st){
  const it=st.items[st.i], last=st.i===st.items.length-1, won=st.win[st.i]?teamById(st.win[st.i]):null;
  return `<div class="ye-pr" data-key="${g.id}${st.i}">
    <div class="ye-quiz-top"><span class="ye-badge">${g.unit||'문제'} ${st.i+1} / ${st.items.length}</span>${it.cat?`<span class="ye-tag">${esc(it.cat)}</span>`:''}</div>
    <div class="ye-pr-stage">${promptBody(g,st,it)}</div>
    <div class="ye-pr-ans">${st.show&&it.a?`<span class="ye-answer" data-key="a">${esc(it.a)}</span>`:''}${won?`<span class="ye-wonby" style="--tc:${color(won)}">${esc(won.name)} +100점</span>`:''}</div>
    ${H()?`<div class="ye-hostbar">${it.a?`<span class="ye-hostlabel">진행자만 보임 · 정답 ${esc(it.a)}</span>`:'<span class="ye-hostlabel">먼저 성공한 팀을 누르세요</span>'}${teamButtons('pWin',t=>st.win[st.i]===t.id)}${st.show?'':`<button class="ye-mini" data-a="pShow">${it.a?'아무도 못 맞힘':'아무도 못 함'}</button>${timerTools()}`}<button class="ye-btn ye-btn-primary" data-a="pNext">${last?'결과 보기':'다음'}</button></div>`:''}
  </div>`;
}
function gMulti(g,st){
  const it=st.items[st.i], r=st.right[st.i]||{}, last=st.i===st.items.length-1;
  return `<div class="ye-pr" data-key="${g.id}${st.i}">
    <div class="ye-quiz-top"><span class="ye-badge">질문 ${st.i+1} / ${st.items.length}</span></div>
    <div class="ye-pr-stage"><div class="ye-versus"><div><small>왼쪽</small><b>${esc(it[0])}</b></div><span>VS</span><div><small>오른쪽</small><b>${esc(it[1])}</b></div></div></div>
    <div class="ye-pr-ans">${S.teams.filter(t=>r[t.id]).map(t=>`<span class="ye-wonby" data-key="${t.id}" style="--tc:${color(t)}">${esc(t.name)} +100점</span>`).join('')}</div>
    ${H()?`<div class="ye-hostbar"><span class="ye-hostlabel">전원 같은 쪽인 팀을 누르세요</span>${teamButtons('mRight',t=>!!r[t.id])}<button class="ye-btn ye-btn-primary" data-a="mNext">${last?'결과 보기':'다음'}</button></div>`:''}
  </div>`;
}
function turnSecs(g,tid){ const t=teamById(tid); return Math.max(15,Math.round(g.teamSec/(t?t.members.length:1))); }
function gTurn(g,st){
  const cur=st.order[st.o], t=teamById(cur.t), secs=turnSecs(g,cur.t);
  const role={act:'출제자',draw:'그리는 사람',back:'맞히는 사람'}[g.mode];
  const counts=`<div class="ye-c3-count">${S.teams.map(x=>`<span class="${x.id===cur.t?'is-on':''}" style="--tc:${color(x)}">${esc(x.name)} <b>${st.got[x.id]||0}</b></span>`).join('')}</div>`;
  if(st.step==='ready'){
    const note={act:'제시어는 이 화면에만 나옵니다. 출제자에게 보여 주세요.',draw:'시작하기 전에 휴대폰을 그리는 사람에게 넘겨 주세요.',back:'맞히는 사람은 TV를 등지고 앉아 주세요.'}[g.mode];
    return `<div class="ye-c3" style="--tc:${color(t)}" data-key="r${st.o}"><small>다음 ${role} · ${st.o+1} / ${st.order.length}</small><h3>${esc(cur.m)}</h3><p>${esc(t.name)} · ${secs}초</p>${g.mode==='back'?'<p class="ye-c3-tip">TV를 등지고 앉아 주세요</p>':''}${counts}${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="tGo">시작</button></div><p class="ye-note">${note}</p>`:''}</div>`;
  }
  const up=!S.timer||timeUp(), word=st.words[st.w%st.words.length];   // 지도로 나갔다 오면 타이머가 없다 → 그 차례는 끝난 것으로
  const next=st.o+1<st.order.length?`다음 ${role}`:'결과 보기';
  const btns=`<div class="ye-c3-btns">${up?'':`<button class="ye-btn ye-c3-hit" data-a="tHit">정답</button><button class="ye-btn ye-c3-pass" data-a="tPass">패스</button>`}</div>
      <div class="ye-actions">${g.mode==='draw'&&!up?'<button class="ye-btn" data-a="dClear">지우기</button>':''}<button class="ye-btn ${up?'ye-btn-primary ye-btn-lg':'ye-btn-ghost'}" data-a="tNext">${next}</button><button class="ye-btn ye-btn-ghost" data-a="tUndo">정답 취소</button></div>`;
  if(g.mode==='draw'){
    const canvas=`<canvas class="ye-canvas" data-draw data-nomorph data-key="d${st.o}-${st.w}"></canvas>`;
    if(H()) return `<div class="ye-c3 is-play ye-c3-draw" style="--tc:${color(t)}"><small>${esc(t.name)} · ${role} ${esc(cur.m)}</small><div class="ye-bigtimer is-sm" data-timer>${clock(leftMs())}</div><div class="ye-word is-sm" data-key="${esc(word)}">${up?'시간 종료':esc(word)}</div>${canvas}${btns}${counts}</div>`;
    return `<div class="ye-drawtv" style="--tc:${color(t)}"><div class="ye-drawtv-canvas">${canvas}</div><div class="ye-drawtv-side"><small>${esc(t.name)} · ${role}</small><h3>${esc(cur.m)}</h3><div class="ye-bigtimer is-mid" data-timer>${clock(leftMs())}</div>${up?'<p class="ye-c3-tip">시간 종료</p>':''}${counts}</div></div>`;
  }
  const onTv=g.mode==='back';
  return `<div class="ye-c3 is-play" style="--tc:${color(t)}">
    <small>${esc(t.name)} · ${role} ${esc(cur.m)}</small>
    <div class="ye-bigtimer ${onTv?'is-mid':''}" data-timer>${clock(leftMs())}</div>
    ${H()||onTv?`<div class="ye-word ${onTv&&!H()?'is-tv':''}" data-key="${esc(word)}">${up?'시간 종료':esc(word)}</div>`:`<div class="ye-word is-hidden">${up?'시간 종료':'? ? ?'}</div>`}
    ${H()?btns:''}
    ${counts}
  </div>`;
}
function rpsPhase(st){ if(!st.at) return -1; const t=Date.now()-st.at; return t<0?-1:Math.min(2,Math.floor(t/RPS_BEAT)); }
function gRps(g,st){
  const ph=rpsPhase(st), done=ph>=2, won=st.wins[st.pan]?teamById(st.wins[st.pan]):null, last=st.pan===2;
  const big=ph<0?'✊ ✌️ 🖐️':done?st.hand:['가위!','바위!'][ph];
  const msg=done?'TV를 이긴 사람만 서 있으세요':ph<0?(st.n?'다음 가위바위보를 준비하세요':'전원 일어나 주세요'):'';
  return `<div class="ye-rps">
    <span class="ye-badge">${st.pan+1}판 / 3판</span>
    <div class="ye-rps-big ${done?'is-hand':ph<0?'is-idle':''}" data-key="${st.n}-${ph}">${big}</div>
    <p class="ye-rps-msg">${msg}</p>
    <div class="ye-pr-ans">${won?`<span class="ye-wonby" style="--tc:${color(won)}">${st.pan+1}판 우승 · ${esc(won.name)} +100점</span>`:''}</div>
    ${H()?`<div class="ye-hostbar"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="rGo" ${ph>=0&&!done?'disabled':''}>가위바위보!</button><span class="ye-hostlabel">이번 판 우승 팀</span>${teamButtons('rWin',t=>st.wins[st.pan]===t.id)}<button class="ye-btn" data-a="rNext" ${won?'':'disabled'}>${last?'결과 보기':'다음 판'}</button></div>`:''}
  </div>`;
}
function gOx(g,st){
  const q=st.qs[st.i], last=st.i===st.qs.length-1;
  return `<div class="ye-ox" data-key="o${st.i}">
    <div class="ye-quiz-top"><span class="ye-badge">문제 ${st.i+1} / ${st.qs.length}</span></div>
    <h3 class="ye-q ye-center">${esc(q[0])}</h3>
    <div class="ye-oxmarks"><span class="${st.show?(q[1]?'is-ans':'is-dim'):''}">O</span><span class="${st.show?(q[1]?'is-dim':'is-ans'):''}">X</span></div>
    <div class="ye-alive">${S.teams.map(t=>`<div style="--tc:${color(t)}"><b>${esc(t.name)}</b><strong>${st.alive[t.id]}명</strong>${H()?`<em><button data-a="oAlive" data-t="${t.id}" data-d="-1" aria-label="${esc(t.name)} 1명 탈락">−</button><button data-a="oAlive" data-t="${t.id}" data-d="1" aria-label="${esc(t.name)} 1명 복귀">+</button></em>`:''}</div>`).join('')}</div>
    ${H()?`<div class="ye-hostbar">${st.show?`<span class="ye-hostlabel">틀린 사람 수만큼 빼 주세요</span><button class="ye-btn ye-btn-primary" data-a="oNext">${last?'결과 보기':'다음 문제'}</button>`:`<span class="ye-hostlabel">진행자만 보임 · 정답 ${q[1]?'O':'X'}</span>${timerTools()}<button class="ye-btn ye-btn-primary" data-a="oShow">정답 공개</button>`}${last?'':'<button class="ye-link" data-a="oEnd">여기서 끝내기</button>'}</div>`:''}
  </div>`;
}
function bombBoomed(st){ return st.lit&&Date.now()>=st.fuseAt; }
function gBomb(g,st){
  const t=S.teams[st.turn%S.teams.length], boomed=bombBoomed(st), last=st.r===st.topics.length-1;
  return `<div class="ye-bomb ${boomed?'is-boom':st.lit?'is-lit':''}" data-key="b${st.r}">
    <div class="ye-quiz-top"><span class="ye-badge">라운드 ${st.r+1} / ${st.topics.length}</span></div>
    <small class="ye-bomb-label">주제</small>
    <h3 class="ye-bomb-topic">${esc(st.topics[st.r])}</h3>
    <div class="ye-bomb-icon" data-key="${boomed?'b':'n'}">${boomed?'💥':'💣'}</div>
    ${boomed?`<p class="ye-bomb-msg" style="--tc:${color(t)}">${esc(t.name)} 폭발!</p>`:`<div class="ye-bomb-turn" style="--tc:${color(t)}">${st.lit?'지금 차례':'첫 순서'} <b>${esc(t.name)}</b></div>`}
    ${H()?`<div class="ye-actions">${boomed?`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="bNext">${last?'결과 보기':'다음 라운드'}</button>`:st.lit?`<button class="ye-btn ye-c3-hit ye-big-tap" data-a="bPass">통과 · 다음 팀</button>`:`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="bLit">불 붙이기</button>`}</div>`:''}
  </div>`;
}
function gTen(g,st){
  const c=st.order[st.cur], t=teamById(c.t), ms=st.ms[st.cur], last=st.cur===st.order.length-1, round=st.order.map((p,i)=>({p,i})).filter(x=>x.p.r===c.r);
  const done=st.phase==='done', big=st.phase==='ready'?'0.00':st.phase==='run'?'<span data-ten>0.00</span>':(ms/1000).toFixed(2);
  return `<div class="ye-ten" style="--tc:${color(t)}">
    <span class="ye-badge">${c.r+1}라운드 · ${st.cur+1} / ${st.order.length}</span>
    <p class="ye-ten-who"><b>${esc(t.name)}</b> ${esc(c.m)}</p>
    <div class="ye-ten-big ${done?'is-done':''}">${big}<small>초</small></div>
    <p class="ye-ten-msg">${done?(ms===10000?'완벽합니다!':'10초와 '+(Math.abs(ms-10000)/1000).toFixed(2)+'초 차이'):st.phase==='run'?'정확히 10초에 멈추세요':'시작하면 3초 뒤 시계가 사라집니다'}</p>
    <div class="ye-ten-row">${round.map(x=>{ const v=st.ms[x.i], tm=teamById(x.p.t); return `<span style="--tc:${color(tm)}" data-key="${x.i}"><b>${esc(tm.name)}</b>${v!=null?(v/1000).toFixed(2)+'초':'-'}</span>`; }).join('')}</div>
    ${H()?`<div class="ye-actions">${st.phase==='ready'?'<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="nStart">시작</button>':st.phase==='run'?'<button class="ye-btn ye-c3-hit ye-big-tap" data-a="nStop">스톱!</button>':`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="nNext">${last?'결과 보기':'다음 사람'}</button>`}</div>`:''}
  </div>`;
}
function wheelSvg(rot){
  const n=WHEEL.length, a=360/n, pt=d=>{ const r=(d-90)*Math.PI/180; return (100+100*Math.cos(r)).toFixed(2)+' '+(100+100*Math.sin(r)).toFixed(2); };
  const seg=WHEEL.map((w,i)=>`<path d="M100 100L${pt(i*a)}A100 100 0 0 1 ${pt((i+1)*a)}Z" fill="${w.c}" stroke="#fff" stroke-width="1"></path><text x="100" y="33" text-anchor="middle" transform="rotate(${(i+.5)*a} 100 100)" class="ye-wheel-t">${esc(w.l)}</text>`).join('');
  return `<svg viewBox="0 0 200 200" class="ye-wheel-disc" style="transform:rotate(${rot}deg)" aria-hidden="true">${seg}<circle cx="100" cy="100" r="12" fill="#2f5396"></circle></svg>`;
}
function gWheel(g,st){
  const tid=st.order[st.cur], t=teamById(tid), done=st.k>=0&&Date.now()>=st.at+WHEEL_MS, spinning=st.k>=0&&!done, last=st.cur===st.order.length-1, w=st.k>=0?WHEEL[st.k]:null;
  return `<div class="ye-wheelwrap">
    <div class="ye-wheel"><i class="ye-wheel-pin"></i>${wheelSvg(st.rot)}</div>
    <div class="ye-wheel-side">
      <span class="ye-badge">${st.cur+1} / ${st.order.length}</span>
      <div class="ye-wheel-team" style="--tc:${color(t)}">${esc(t.name)}</div>
      <div class="ye-wheel-res ${done?'is-done':''}" data-key="${st.cur}-${done?1:0}">${done?esc(w.l)+(w.v?'점':'!'):spinning?'돌아가는 중':'룰렛을 돌려 주세요'}</div>
      ${H()?`<div class="ye-actions ye-actions-left">${done?`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="wNext">${last?'결과 보기':'다음 팀'}</button>`:`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="wSpin" ${spinning?'disabled':''}>돌리기</button>`}</div>`:''}
    </div>
  </div>`;
}

/* ---------- 그림 공유 ---------- */
const DRAW={strokes:[],key:'',cv:null,sentS:0,sentP:0,dirty:false,lastFull:0,lastSend:0};
function redraw(){
  const cv=DRAW.cv; if(!cv) return;
  const c=cv.getContext('2d'), W=cv.width, Hh=cv.height;
  c.clearRect(0,0,W,Hh);
  c.lineCap='round'; c.lineJoin='round'; c.strokeStyle='#17233a'; c.fillStyle='#17233a'; c.lineWidth=Math.max(2,W/130);
  DRAW.strokes.forEach(s=>{
    if(!s||!s.length) return;
    if(s.length===1){ c.beginPath(); c.arc(s[0][0]*W,s[0][1]*Hh,c.lineWidth/2,0,6.3); c.fill(); return; }
    c.beginPath(); s.forEach((p,i)=>{ if(p){ if(i) c.lineTo(p[0]*W,p[1]*Hh); else c.moveTo(p[0]*W,p[1]*Hh); } }); c.stroke();
  });
}
function fitCanvas(){ const cv=DRAW.cv; if(!cv) return; const r=cv.getBoundingClientRect(), d=Math.min(2,window.devicePixelRatio||1); cv.width=Math.max(10,Math.round(r.width*d)); cv.height=Math.max(10,Math.round(r.height*d)); redraw(); }
function bindCanvas(cv){
  let on=false;
  const pos=e=>{ const r=cv.getBoundingClientRect(); return [Math.round((e.clientX-r.left)/r.width*1000)/1000,Math.round((e.clientY-r.top)/r.height*1000)/1000]; };
  cv.addEventListener('pointerdown',e=>{ e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(_){} on=true; DRAW.strokes.push([pos(e)]); DRAW.dirty=true; redraw(); });
  cv.addEventListener('pointermove',e=>{ if(!on) return; const p=pos(e), s=DRAW.strokes[DRAW.strokes.length-1], l=s[s.length-1]; if(Math.abs(p[0]-l[0])+Math.abs(p[1]-l[1])<.004) return; s.push(p); DRAW.dirty=true; redraw(); });
  const end=()=>{ if(on){ on=false; flushDraw(true); } };
  cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
}
function initCanvas(){
  const cv=root&&root.querySelector('[data-draw]');
  if(!cv){ DRAW.cv=null; return; }
  if(DRAW.cv===cv) return;
  const key=cv.getAttribute('data-key');
  DRAW.cv=cv;
  if(DRAW.key!==key){ DRAW.key=key; DRAW.strokes=[]; DRAW.sentS=0; DRAW.sentP=0; DRAW.dirty=false; }
  if(H()) bindCanvas(cv);
  fitCanvas();
}
function flushDraw(full){
  if(!DRAW.dirty&&!full) return;
  const now=Date.now();
  if(!full&&now-DRAW.lastSend<150) return;
  DRAW.lastSend=now;
  const st=DRAW.strokes;
  if(full||now-DRAW.lastFull>2500){ DRAW.lastFull=now; sendAll('d',{k:DRAW.key,all:st}); }
  else {
    const inc=[];
    for(let s=DRAW.sentS;s<st.length;s++){ const from=s===DRAW.sentS?DRAW.sentP:0, pts=st[s].slice(from); if(pts.length) inc.push([s,from,pts]); }
    if(inc.length) sendAll('d',{k:DRAW.key,inc});
  }
  DRAW.sentS=Math.max(0,st.length-1); DRAW.sentP=st.length?st[st.length-1].length:0; DRAW.dirty=false;
}
function onDraw(m){
  if(m.k!==DRAW.key){ DRAW.key=m.k; DRAW.strokes=[]; }
  if(m.all) DRAW.strokes=m.all;
  else if(m.inc) m.inc.forEach(([s,from,pts])=>{ const a=DRAW.strokes[s]=DRAW.strokes[s]||[]; pts.forEach((p,j)=>{ a[from+j]=p; }); });
  redraw();
}

/* ---------- 최종 결전 ---------- */
function c7View(){
  const c=S.c7;
  if(c.step==='intro') return introCard(chap('c7'),'c7Bet');
  if(c.step==='bet') return c7Bet();
  if(c.step==='q'||c.step==='reveal') return c7Q();
  if(c.step==='awards') return c7Awards();
  if(c.step==='rank') return c7Rank();
  return c7Credits();
}
function c7Bet(){
  const c=S.c7;
  return `<div class="ye-block">
    <h3 class="ye-center ye-h">이번 승부에 얼마를 거시겠어요?</h3>
    <p class="ye-center ye-hint">맞히면 건 점수만큼 얻고, 틀리면 잃습니다.</p>
    <div class="ye-bets">${S.teams.map(t=>{ const max=Math.max(0,totalBeforeFinal(t.id)), b=+c.bets[t.id]||0; return `<article class="ye-bet" style="--tc:${color(t)}"><header>${esc(t.name)}</header><p>누적 점수 <b>${fmt(max)}</b></p>${H()?`<input type="number" inputmode="numeric" min="0" max="${max}" step="10" value="${b}" data-c="bet" data-t="${t.id}" aria-label="${esc(t.name)} 베팅 점수"><div class="ye-betbtns">${[0,25,50,100].map(p=>`<button class="ye-mini" data-a="c7Pct" data-t="${t.id}" data-p="${p}">${p===100?'올인':p+'%'}</button>`).join('')}</div>`:`<div class="ye-betval">베팅 중</div>`}</article>`; }).join('')}</div>
    ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7Close">베팅 마감</button></div>`:''}
  </div>`;
}
function c7Q(){
  const c=S.c7, q=c.q, show=c.step==='reveal';
  return `<div class="ye-quiz">
    <div class="ye-quiz-top"><span class="ye-badge">최후의 문제</span><span class="ye-tag">${esc(q.tag||'')}</span></div>
    <h3 class="ye-q">${esc(q.q)}</h3>
    <div class="ye-opts">${q.opts.map((o,i)=>`<div class="ye-opt ${show?(i===q.a?'is-ans':'is-dim'):''}"><span>${i+1}</span><b>${esc(o)}</b></div>`).join('')}</div>
    ${show?`<div class="ye-betres">${S.teams.map(t=>{ const b=+c.bets[t.id]||0, r=c.right[t.id]; return `<div style="--tc:${color(t)}" class="${r===true?'is-win':r===false?'is-lose':''}"><span>${esc(t.name)}</span><small>베팅 ${fmt(b)}</small><b>${r===true?'+'+fmt(b):r===false?'−'+fmt(b):'대기'}</b>${H()?`<em><button class="ye-mini" data-a="c7Right" data-t="${t.id}" data-v="1">적중</button><button class="ye-mini" data-a="c7Right" data-t="${t.id}" data-v="0">실패</button></em>`:''}</div>`; }).join('')}</div>`:''}
    ${H()?`<div class="ye-hostbar">${show?`<button class="ye-btn ye-btn-primary" data-a="c7Awards" ${S.teams.every(t=>c.right[t.id]!==undefined)?'':'disabled'}>2026 어워즈로</button>`:`<span class="ye-hostlabel">진행자만 보임 · 정답 ${q.a+1}번</span>${timerTools()}<button class="ye-btn ye-btn-primary" data-a="c7Show">정답 공개</button>`}</div>`:''}
  </div>`;
}
function c7Awards(){
  const c=S.c7, list=awardsReady(), a=list[c.award];
  if(!a) return `<div class="ye-block">${stageWait('수상자를 입력해 두지 않았습니다')}${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7Rank">최종 순위로</button></div>`:''}</div>`;
  const shown=!!c.awardShown[c.award], t=teamOf(a.winner), last=c.award===list.length-1;
  return `<div class="ye-award" data-key="a${c.award}">
    <small>2026 어워즈 · ${c.award+1} / ${list.length}</small>
    <h3>${esc(a.title)}</h3>
    ${a.desc?`<p>${esc(a.desc)}</p>`:''}
    <div class="ye-award-name ${shown?'is-open':''}" data-key="${shown?'o':'c'}" ${t?`style="--tc:${color(t)}"`:''}>${shown?esc(a.winner):'두구두구두구'}</div>
    ${shown&&t?`<p class="ye-award-team">${esc(t.name)} +100점</p>`:''}
    ${H()?`<div class="ye-actions">${shown?`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="${last?'c7Rank':'c7AwardNext'}">${last?'최종 순위로':'다음 상'}</button>`:`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7AwardShow">수상자 공개</button>`}</div>`:''}
  </div>`;
}
function finalOrder(){ return S.teams.map(t=>({t,v:total(t.id)})).sort((a,b)=>a.v-b.v); }
function prizeOf(place,last){ const s=SETUP; if(last) return s.last; if(place===1) return s.p1; if(place===2) return s.p2; if(place===3) return s.p3; return ''; }
function c7Rank(){
  const c=S.c7, order=finalOrder(), n=order.length;
  return `<div class="ye-rank">
    <h3 class="ye-center ye-h">2026 최종 순위</h3>
    <div class="ye-rank-list">${order.slice().reverse().map((r,i)=>{ const place=i+1, idxFromLast=n-1-i, open=c.rank>idxFromLast, prize=prizeOf(place,place===n&&n>1); return `<div class="ye-rank-row ${open?'is-open':''} ${place===1?'is-top':''}" data-key="${open?r.t.id:'x'+i}" ${open?`style="--tc:${color(r.t)}"`:''}><span class="ye-rank-no">${place}</span>${open?`<b>${esc(r.t.name)}</b><span class="ye-rank-mem">${esc(r.t.members.join(' · '))}</span>${prize?`<em>${esc(prize)}</em>`:''}<strong>${fmt(r.v)}</strong>`:'<b>? ? ?</b>'}</div>`; }).join('')}</div>
    ${H()?`<div class="ye-actions">${c.rank<n?`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7RankNext">${c.rank===n-1?'1등 공개':(n-c.rank)+'등 공개'}</button>`:`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7Credits">엔딩 크레딧</button>`}</div>`:''}
  </div>`;
}
function c7Credits(){
  const order=finalOrder().reverse(), count=S.teams.reduce((a,t)=>a+t.members.length,0), games=chapters().length-2;
  const stats=[['함께한 사람',count+'명'],['함께 깬 게임',games+'개']];
  return `<div class="ye-credits">
    <div class="ye-credits-roll">
      <p class="ye-cr-title">2026 송년회</p>
      <p class="ye-cr-sub">비드유니버스의 2026년을 함께 마무리했습니다</p>
      ${order.map((r,i)=>`<section><h4>${i+1}위 · ${esc(r.t.name)}</h4><p>${esc(r.t.members.join('  ·  '))}</p></section>`).join('')}
      <section><h4>진행</h4><p>전승훈  ·  전수빈</p></section>
      <section><h4>오늘의 기록</h4>${stats.map(s=>`<p>${esc(s[0])} <b>${esc(s[1])}</b></p>`).join('')}</section>
      ${SETUP.closing?`<section><h4>대표님 한마디</h4><p class="ye-cr-msg">${esc(SETUP.closing)}</p></section>`:''}
      <p class="ye-cr-end">2027년에 또 만나요</p>
    </div>
    ${H()?`<div class="ye-credits-ctl"><button class="ye-btn ye-btn-white" data-a="c7End">송년회 마치기</button></div>`:''}
  </div>`;
}

/* ---------- 진행 준비 ---------- */
function prepGames(){
  const plan=SETUP.plan||[], off=GAMES.filter(g=>!plan.includes(g.id));
  const row=(g,i)=>`<li class="ye-gl" data-key="${g.id}"><span>${g.icon}</span><div><b>${esc(g.title)}</b><em>${esc(g.sub)} · ${g.min}분</em></div><span class="ye-gl-btns"><button class="ye-mini" data-a="plMove" data-i="${i}" data-d="-1" ${i?'':'disabled'} aria-label="위로">▲</button><button class="ye-mini" data-a="plMove" data-i="${i}" data-d="1" ${i<plan.length-1?'':'disabled'} aria-label="아래로">▼</button><button class="ye-mini" data-a="plOff" data-id="${g.id}">빼기</button></span></li>`;
  return `<ol class="ye-gls">${plan.map((id,i)=>{ const g=gdef(id); return g?row(g,i):''; }).join('')}</ol>
    ${off.length?`<h4 class="ye-gl-title">추가할 수 있는 게임</h4><ul class="ye-gls is-off">${off.map(g=>`<li class="ye-gl" data-key="${g.id}"><span>${g.icon}</span><div><b>${esc(g.title)}</b><em>${esc(g.sub)} · ${g.min}분</em></div><span class="ye-gl-btns"><button class="ye-mini" data-a="plOn" data-id="${g.id}">넣기</button></span></li>`).join('')}</ul>`:''}`;
}
function viewPrep(){
  const s=SETUP, names=people().map(p=>p.name), f=s.finalQ||{}, chs=chapters(), totalMin=chs.reduce((a,c)=>a+c.min,0);
  const field=(label,path,val,ph)=>`<label class="ye-field"><span>${esc(label)}</span><input type="text" value="${esc(val||'')}" data-bind="${path}" placeholder="${esc(ph||'')}"></label>`;
  return `<div class="ye-prepwrap">
    <section class="ye-sec"><h3>TV 연결 순서</h3>
      <ol class="ye-steps"><li>노트북을 HDMI로 TV에 연결합니다. 화면 복제든 확장이든 괜찮습니다.</li><li>Windows 소리 출력을 TV로 바꿉니다. (작업 표시줄 스피커 아이콘)</li><li>노트북 오피스에서 2026 송년회를 열고 <b>TV 화면</b>을 누릅니다.</li><li>진행자는 휴대폰 오피스에서 같은 화면을 열어 조작합니다. 정답과 제시어는 휴대폰에만 나옵니다.</li><li>행사장 와이파이가 약하면 노트북을 휴대폰 핫스팟에 연결하세요.</li></ol>
    </section>
    <section class="ye-sec"><h3>게임 구성 <span class="ye-sum">팀 뽑기 · 최종 결전 포함 ${chs.length}챕터 · 약 ${Math.floor(totalMin/60)}시간 ${totalMin%60}분</span></h3><p class="ye-hint">순서를 바꾸거나 넣고 뺄 수 있습니다. 지도에 바로 반영됩니다.</p>${prepGames()}</section>
    <section class="ye-sec"><h3>행사 정보</h3><div class="ye-form2">${field('날짜','setup.date',s.date,'예: 12월 19일 금요일')}${field('장소','setup.place',s.place,'예: 가평 펜션')}</div></section>
    <section class="ye-sec"><h3>상품과 벌칙</h3><div class="ye-form2">${field('1등','setup.p1',s.p1,'예: 상금 30만원')}${field('2등','setup.p2',s.p2)}${field('3등','setup.p3',s.p3)}${field('꼴등 벌칙','setup.last',s.last,'예: 2027년 시무식 사회')}</div></section>
    <section class="ye-sec"><h3>2026 어워즈</h3><p class="ye-hint">수상자를 고른 상만 시상식에 나옵니다. 수상자가 속한 팀은 100점을 받습니다.</p>
      <div class="ye-awards">${s.awards.map((a,i)=>`<div class="ye-award-edit" data-key="aw${i}"><input type="text" value="${esc(a.title)}" data-bind="setup.awards.${i}.title" placeholder="상 이름" aria-label="상 이름"><input type="text" value="${esc(a.desc)}" data-bind="setup.awards.${i}.desc" placeholder="설명" aria-label="설명"><select data-bind="setup.awards.${i}.winner" aria-label="수상자"><option value="" ${a.winner?'':'selected'}>수상자 선택</option>${names.map(n=>`<option value="${esc(n)}" ${a.winner===n?'selected':''}>${esc(n)}</option>`).join('')}</select><button class="ye-mini" data-a="awDel" data-i="${i}" aria-label="이 상 삭제">삭제</button></div>`).join('')}</div>
      <button class="ye-mini" data-a="awAdd">상 추가</button>
    </section>
    <section class="ye-sec"><h3>최후의 문제</h3><p class="ye-hint">비워 두면 상식 문제가 무작위로 나옵니다.</p>
      <div class="ye-form">${field('문제','setup.finalQ.q',f.q)}<div class="ye-form2">${[1,2,3,4].map(n=>field(n+'번 보기','setup.finalQ.o'+n,f['o'+n])).join('')}</div>
      <label class="ye-field"><span>정답</span><select data-bind="setup.finalQ.a" data-num="1">${[0,1,2,3].map(n=>`<option value="${n}" ${(+f.a||0)===n?'selected':''}>${n+1}번</option>`).join('')}</select></label></div>
    </section>
    <section class="ye-sec"><h3>대표님 한마디 (엔딩 크레딧)</h3><textarea rows="3" data-bind="setup.closing" aria-label="대표님 한마디">${esc(s.closing)}</textarea></section>
    <section class="ye-sec"><h3>준비물 체크</h3>
      <ul class="ye-checks">${PROPS.map(p=>`<li><label><input type="checkbox" data-c="check" data-id="${p.id}" ${s.checks[p.id]?'checked':''}><span>${esc(p.label)}</span><small>${esc(p.ch)}</small></label></li>`).join('')}</ul>
    </section>
    <section class="ye-sec"><h3>미리 돌려 보기</h3><p class="ye-hint">리허설은 팀과 점수가 실제 기록과 분리된 연습 공간입니다. 모든 챕터가 열리고, 노트북과 휴대폰에서 각각 리허설을 시작하면 TV 연동까지 연습할 수 있습니다. 이 화면에 적은 내용은 리허설과 실제 진행에 함께 적용됩니다.</p>
      <div class="ye-actions ye-actions-left">${L.rehearsal?'<button class="ye-btn" data-a="rehearseEnd">리허설 끝내기</button><button class="ye-btn" data-a="rehearseNew">리허설 처음부터</button>':'<button class="ye-btn ye-btn-primary" data-a="rehearse">리허설 시작</button><button class="ye-btn ye-btn-danger" data-a="reset">진행 기록 전체 초기화</button>'}</div>
    </section>
  </div>`;
}

/* ---------- 지도 ---------- */
function isOpen(i,list){ return S.openAll||i===0||!!S.cleared[list[i-1].id]; }
function currentIdx(list){ for(let i=0;i<list.length;i++) if(!S.cleared[list[i].id]) return i; return list.length-1; }
function node(c,i,list,cols,two){
  const clear=!!S.cleared[c.id], open=isOpen(i,list), cur=!clear&&i===currentIdx(list);
  const cls=clear?'is-clear':cur?'is-current':open?'is-open':'is-locked';
  const pos=two?`style="grid-row:${i<cols?1:2};grid-column:${i<cols?i+1:cols-(i-cols)}"`:'';
  return `<button class="ye-node ${cls}" ${pos} ${H()&&open?`data-a="open" data-id="${c.id}"`:'tabindex="-1"'}><span class="ye-node-dot">${clear?'✓':open?c.icon:'🔒'}</span><span class="ye-node-text"><small>CHAPTER ${c.no}</small><b>${esc(c.title)}</b><em>${clear?'CLEAR':esc(c.sub)}</em></span></button>`;
}
function viewMap(){
  const list=chapters(), n=list.length, done=list.filter(c=>S.cleared[c.id]).length, s=SETUP, info=[s.date,s.place].filter(Boolean).join(' · ');
  const allDone=done===n, two=n>8, cols=two?Math.ceil(n/2):n;
  return `<section class="ye-hero">
    <div class="ye-snow"></div>
    <div class="ye-hero-top">
      <div><p class="ye-kicker">BEAD UNIVERSE${info?' · '+esc(info):''}</p><h2 class="ye-title">2026 송년회</h2><p class="ye-lead">${allDone?'2026년 완주! 올 한 해 정말 고생 많으셨습니다.':`팀을 꾸려 ${n}개의 관문을 하나씩 깨고, 올해의 우승 팀을 가립니다.`}</p></div>
      <div class="ye-progress"><b>${done}</b><span>/ ${n}</span><small>CLEAR</small></div>
    </div>
    <div class="ye-route ${two?'is-two':''}" style="--cols:${cols}"><svg class="ye-route-svg" data-nomorph aria-hidden="true"></svg>${list.map((c,i)=>node(c,i,list,cols,two)).join('')}</div>
  </section>
  ${S.teams.length?'<h3 class="ye-boardtitle">누적 점수</h3>':''}
  ${standings(false)}`;
}
function drawRoute(){
  const wrap=root.querySelector('.ye-route'); if(!wrap) return;
  const box=wrap.getBoundingClientRect(); if(!box.width) return;
  const pts=$$('.ye-node-dot',wrap).map(d=>{ const r=d.getBoundingClientRect(); return {x:r.left+r.width/2-box.left,y:r.top+r.height/2-box.top}; });
  const svg=wrap.querySelector('.ye-route-svg'), ns='http://www.w3.org/2000/svg';
  svg.setAttribute('viewBox','0 0 '+box.width+' '+box.height); svg.setAttribute('width',box.width); svg.setAttribute('height',box.height);
  const oneCol=getComputedStyle(wrap).gridTemplateColumns.split(' ').length===1;
  const seg=(a,b)=>{ const vert=oneCol||Math.abs(b.y-a.y)>Math.abs(b.x-a.x); if(!vert){ const m=(a.x+b.x)/2; return ` C${m} ${a.y},${m} ${b.y},${b.x} ${b.y}`; } const m=(a.y+b.y)/2; return ` C${a.x} ${m},${b.x} ${m},${b.x} ${b.y}`; };
  let d='M'+pts[0].x+' '+pts[0].y; const ds=[d];
  for(let i=1;i<pts.length;i++){ d+=seg(pts[i-1],pts[i]); ds.push(d); }
  svg.innerHTML='';
  const mk=(c,dd)=>{ const p=document.createElementNS(ns,'path'); p.setAttribute('class',c); p.setAttribute('d',dd); svg.appendChild(p); return p; };
  mk('ye-route-base',d);
  const prog=mk('ye-route-prog',d);
  const lens=ds.map(x=>{ const t=mk('ye-route-tmp',x), l=x.indexOf('C')<0?0:t.getTotalLength(); t.remove(); return l; });
  const full=prog.getTotalLength();
  const token=document.createElementNS(ns,'text'); token.setAttribute('class','ye-parcel'); token.setAttribute('text-anchor','middle'); token.textContent='🎅'; svg.appendChild(token);
  const dy=parseFloat(getComputedStyle(wrap).fontSize)*2.6;
  const place=len=>{ prog.setAttribute('stroke-dasharray',full+' '+full); prog.setAttribute('stroke-dashoffset',full-len); const pt=prog.getPointAtLength(len); token.setAttribute('x',pt.x); token.setAttribute('y',pt.y-dy); };
  const target=currentIdx(chapters()), from=L.routeShown==null||L.routeShown>=lens.length?target:L.routeShown;
  cancelAnimationFrame(L.routeAnim);
  L.routeShown=target;
  if(from===target){ place(lens[target]); return; }
  const a=lens[from], z=lens[target], start=performance.now(), dur=1500;
  place(a);
  (function step(now){ const k=Math.min(1,(now-start)/dur), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; place(a+(z-a)*e); if(k<1) L.routeAnim=requestAnimationFrame(step); })(start);
}

/* ---------- CLEAR 오버레이 ---------- */
function viewClear(){
  const list=chapters(), id=S.clearing.id, c=list.find(x=>x.id===id);
  if(!c) return '';
  const next=list[list.indexOf(c)+1];
  let body;
  if(id==='c1'){
    body=`<div class="ye-clear-teams">${S.teams.map(t=>`<div style="--tc:${color(t)}"><b>${esc(t.name)}</b><span>${esc(t.members.join(' · '))}</span></div>`).join('')}</div>`;
  }else{
    const sc=chScore(id), rows=S.teams.map(t=>({t,v:sc[t.id]||0})).sort((a,b)=>b.v-a.v);
    body=`<div class="ye-clear-teams">${rows.map(r=>`<div style="--tc:${color(r.t)}"><b>${esc(r.t.name)}</b><strong>${r.v>0?'+':''}${fmt(r.v)}</strong></div>`).join('')}</div>`;
  }
  return `<div class="ye-clear" role="dialog" aria-label="챕터 완료"><div class="ye-clear-in"><div class="ye-stamp">CLEAR</div><small>CHAPTER ${c.no}</small><h2>${esc(c.title)}</h2>${body}${H()?`<button class="ye-btn ye-btn-white ye-btn-lg" data-a="closeClear">${next?'다음 관문 · '+esc(next.title):'지도로'}</button>`:''}</div></div>`;
}

/* ---------- 화면 조립 ---------- */
function viewChapter(){
  const c=chap(S.cur.id);
  let body, step;
  if(c.id==='c1'){ body=c1View(); step=S.c1.step; }
  else if(c.id==='c7'){ body=c7View(); step=S.c7.step; }
  else { const st=S.g[c.id]; step=st?st.step:'intro'; body=gameView(c,st); }
  const fullBleed=c.id==='c7'&&step==='credits';
  const big=c.type==='turn'&&step==='play';
  const noBoard=fullBleed||c.id==='c1'||c.id==='c7'||step==='intro'||c.type==='wheel';
  const foot=H()?`<div class="ye-foot"><button class="ye-link" data-a="restart" data-id="${c.id}">이 챕터 다시 하기</button>${S.cleared[c.id]||c.id==='c1'?'':`<button class="ye-link" data-a="skip" data-id="${c.id}">건너뛰기</button>`}</div>`:'';
  return `<section class="ye-ch ${fullBleed?'is-full':''}" data-key="${c.id}">
    ${fullBleed?'':`<header class="ye-ch-head">${H()?'<button class="ye-back" data-a="toMap">‹ 지도</button>':''}<div class="ye-ch-title"><small>CHAPTER ${c.no}</small><h2>${esc(c.title)}</h2></div>${S.timer&&!big?`<span class="ye-timer" data-timer>${clock(leftMs())}</span>`:''}</header>`}
    <div class="ye-ch-body">${body}</div>
    ${noBoard?'':standings(true)}
    ${fullBleed?'':foot}
  </section>`;
}
function view(){
  let out='';
  if(H()){
    out+=`<div class="view-head ye-head">
      <button class="btn-back" data-a="home" aria-label="홈으로"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>홈</button>
      <h1 class="view-title">2026 송년회<span class="view-title-sub">/ 챕터형 팀 대항전</span></h1>
      <div class="ye-head-tools">
        <button class="ye-tool ${L.panel==='prep'?'is-on':''}" data-a="prep">진행 준비</button>
        <button class="ye-tool" data-a="sound" aria-pressed="${L.sound}">${L.sound?'소리 켬':'소리 끔'}</button>
        <button class="ye-tool ye-tool-primary" data-a="stage">TV 화면</button>
      </div>
    </div>`;
    if(L.rehearsal) out+=`<div class="ye-rehearsal"><b>리허설 중</b> 실제 기록과 분리되어 있습니다.<button class="ye-mini" data-a="rehearseEnd">끝내기</button></div>`;
  }else{
    out+=`<div class="ye-stagebar">${L.rehearsal?'<span>리허설</span>':''}<button data-a="fs">전체화면</button><button data-a="host">진행자 화면</button></div>`;
  }
  if(H()&&L.panel==='prep') out+=viewPrep();
  else if(S.cur.view==='ch'&&chap(S.cur.id)) out+=viewChapter();
  else out+=viewMap();
  if(S.clearing&&!(H()&&L.panel==='prep')) out+=viewClear();
  return out;
}

/* 변경분만 고치는 렌더 — 입력 포커스 · 애니메이션을 보존한다 */
const keyOf=n=>n.nodeType===1?n.getAttribute('data-key'):null;
function syncAttrs(x,y){
  for(const at of Array.from(x.attributes)){ if(!y.hasAttribute(at.name)&&!(x.nodeName==='DETAILS'&&at.name==='open')) x.removeAttribute(at.name); }
  for(const at of Array.from(y.attributes)){ if(x.getAttribute(at.name)!==at.value) x.setAttribute(at.name,at.value); }
}
function syncForm(x,y){
  if(x===document.activeElement) return;
  if(x.nodeName==='INPUT'){
    if(x.type==='checkbox') x.checked=y.hasAttribute('checked');
    else if(y.hasAttribute('value')&&x.value!==y.getAttribute('value')) x.value=y.getAttribute('value');
  }else if(x.nodeName==='TEXTAREA'){
    if(x.value!==y.textContent) x.value=y.textContent;
  }else if(x.nodeName==='SELECT'){
    const o=y.querySelector('option[selected]'); if(o&&x.value!==o.value) x.value=o.value;
  }
}
function morph(a,b){
  let x=a.firstChild,y=b.firstChild;
  while(y){
    const ny=y.nextSibling;
    if(!x){ a.appendChild(y); y=ny; continue; }
    if(x.nodeType!==y.nodeType||x.nodeName!==y.nodeName||keyOf(x)!==keyOf(y)){ const nx=x.nextSibling; a.replaceChild(y,x); x=nx; y=ny; continue; }
    if(x.nodeType===3){ if(x.nodeValue!==y.nodeValue) x.nodeValue=y.nodeValue; }
    else if(x.nodeType===1&&!x.hasAttribute('data-nomorph')){ syncAttrs(x,y); morph(x,y); syncForm(x,y); }
    x=x.nextSibling; y=ny;
  }
  while(x){ const nx=x.nextSibling; a.removeChild(x); x=nx; }
}
function render(){
  if(!root) return;
  root.className='ye '+(H()?'is-host':'is-stage');
  const t=document.createElement('div');
  try{ t.innerHTML=view(); }
  catch(e){ console.error('[송년회] 화면 오류',e); t.innerHTML='<div class="ye-wait"><h3>화면을 그리지 못했습니다</h3><p>새로고침해 주세요.</p></div>'; }
  morph(root,t);
  if(root.querySelector('.ye-route')) drawRoute();   // 지도를 벗어나도 L.routeShown 은 남겨 두어, 돌아오면 이어서 달린다
  initCanvas();
}

/* ---------- 동작 ---------- */
function stopAuto(){ if(L.auto){ clearInterval(L.auto); L.auto=0; } }
function nextCh(s,id){ s.cleared[id]=true; s.clearing={id}; s.timer=null; setFx(s,'stamp'); }
function flipCard(i){
  commit(s=>{
    const c=s.c1; if(!c.cards[i]||c.cards[i].who) return;
    const t=turnTeam(); if(!t) return;
    const who=pick(planLeft(t.id));
    c.cards[i]={who,team:t.id};
    t.members.push(who);
    c.turn=(s.teams.findIndex(x=>x.id===t.id)+1)%s.teams.length;
    setFx(s,'flip');
  });
}
function newRehearsal(){
  const s=freshState();
  s.openAll=true;
  s.rev=S.rev||0;
  S=s; ensureCaptains(S);
  const part=people().filter(p=>!p.ceo), ids=TEAM_IDS.slice(0,3), caps=S.c1.captains, plan=makePlan(part,ids,caps,true);
  S.teams=ids.map((id,i)=>({id,name:TEAM_NAMES[i],color:i,captain:caps[id],members:[caps[id]].concat(Object.keys(plan).filter(n=>plan[n]===id))}));
}
async function enterRehearsal(){
  if(!L.real) L.real=S;
  L.rehearsal=true; L.panel=null; L.routeShown=null; L.synced=false; saveUi();
  const d=doc();
  newRehearsal(); S.rev=0;
  render();
  try{ await B.kvPull(d.k,d.ls,onKv); }catch(e){}
  const saved=readLocal(d.ls);
  if(saved&&saved.rev){ S=saved; L.routeShown=null; render(); }   // 다른 기기에서 시작한 리허설을 이어받는다
  else commit();
}
const A={
  home(){ B.goHome(); },
  prep(){ L.panel=L.panel==='prep'?null:'prep'; render(); },
  sound(){ L.sound=!L.sound; saveUi(); render(); },
  stage(){ L.mode='stage'; L.panel=null; saveUi(); render(); A.fs(); idleSoon(); },
  host(){ L.mode='host'; saveUi(); render(); try{ if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); }catch(e){} },
  fs(){ try{ const d=document.documentElement; if(!document.fullscreenElement&&d.requestFullscreen) d.requestFullscreen().catch(()=>{}); }catch(e){} },
  open(el){ L.panel=null; commit(s=>{ s.cur={view:'ch',id:el.dataset.id}; }); },
  toMap(){ stopAuto(); commit(s=>{ s.cur={view:'map'}; s.timer=null; }); },
  adj(el){ const {ch,t}=el.dataset, d=+el.dataset.d; commit(s=>{ s.adj[ch]=s.adj[ch]||{}; s.adj[ch][t]=(s.adj[ch][t]||0)+d; }); },
  clear(el){ commit(s=>nextCh(s,el.dataset.id)); },
  closeClear(){ commit(s=>{ s.clearing=null; s.cur={view:'map'}; }); },
  skip(el){ if(!confirm('이 챕터를 점수 없이 건너뛸까요?')) return; commit(s=>{ s.cleared[el.dataset.id]=true; s.cur={view:'map'}; s.timer=null; }); },
  restart(el){
    const id=el.dataset.id;
    if(id==='c1'&&chapters().some(c=>c.id!=='c1'&&S.cleared[c.id])){ B.toast('이미 다음 챕터를 진행해서 팀을 바꿀 수 없어요','err'); return; }
    if(!confirm('이 챕터의 진행 내용과 점수를 지우고 처음부터 할까요?')) return;
    stopAuto();
    commit(s=>{ if(id==='c1'||id==='c7'){ s[id]=freshState()[id]; if(id==='c1') s.teams=[]; } else delete s.g[id]; delete s.cleared[id]; delete s.adj[id]; s.timer=null; });
  },
  tToggle(){ commit(s=>{ const t=s.timer; if(!t) return; if(t.run){ t.left=Math.max(0,t.ends-Date.now()); t.run=false; } else { t.ends=Date.now()+t.left; t.run=true; } }); },
  tAdd(el){ commit(s=>{ const t=s.timer; if(!t) return; const ms=+el.dataset.ms; if(t.run){ t.ends=Math.max(t.ends,Date.now())+ms; } else t.left+=ms; t.dur+=ms; }); },
  gStart(){ const g=curG(); commit(s=>{ s.g[g.id]=START[g.type](g,s); setFx(s,'onair'); }); },
  /* 팀 뽑기 */
  c1Setup(){ commit(s=>{ s.c1.step='setup'; ensureCaptains(s); }); },
  c1Toggle(el){ const n=el.dataset.n, p=people().find(x=>x.name===n); commit(s=>{ const c=s.c1; if(p.ceo){ c.join=c.join.includes(n)?c.join.filter(x=>x!==n):c.join.concat(n); } else { c.out=c.out.includes(n)?c.out.filter(x=>x!==n):c.out.concat(n); } ensureCaptains(s); }); },
  c1Count(el){ commit(s=>{ s.c1.count=+el.dataset.n; ensureCaptains(s); }); },
  c1Shuffle(){
    commit(s=>{
      const c=s.c1, part=participants(), ids=TEAM_IDS.slice(0,c.count), capSet=new Set(ids.map(id=>c.captains[id]));
      c.plan=makePlan(part,ids,c.captains,c.mix);
      s.teams=ids.map((id,i)=>({id,name:(i+1)+'팀',color:i,captain:c.captains[id],members:[c.captains[id]]}));
      c.cards=part.filter(p=>!capSet.has(p.name)).map(()=>({who:null,team:null}));
      c.turn=0; c.step='draft'; setFx(s,'shuffle');
    });
  },
  c1Flip(el){ flipCard(+el.dataset.i); },
  c1Auto(){
    if(L.auto){ stopAuto(); render(); return; }
    L.auto=setInterval(()=>{ const i=S.c1.cards.findIndex(x=>!x.who); if(i<0||S.c1.step!=='draft'||viewHidden()){ stopAuto(); render(); return; } flipCard(i); },1200);
    render();
  },
  c1Redo(){ if(!confirm('공개한 카드를 모두 지우고 처음부터 다시 섞을까요?')) return; stopAuto(); commit(s=>{ s.c1.step='setup'; s.c1.cards=[]; s.c1.plan={}; s.teams=[]; }); },
  c1Name(){ const names=shuffle(TEAM_NAMES); commit(s=>{ s.teams.forEach((t,i)=>{ t.name=names[i]; }); s.c1.step='naming'; }); },
  c1Dice(el){ const used=S.teams.map(t=>t.name), pool=TEAM_NAMES.filter(n=>!used.includes(n)); commit(s=>{ teamById(el.dataset.t).name=pick(pool); }); },
  c1Done(){ commit(s=>{ s.teams.forEach((t,i)=>{ t.name=String(t.name||'').trim()||TEAM_NAMES[i]; }); nextCh(s,'c1'); }); },
  /* 문제형 */
  pWin(el){ const t=el.dataset.t; commit(s=>{ const st=s.g[s.cur.id]; st.win[st.i]=st.win[st.i]===t?null:t; st.show=true; s.timer=null; setFx(s,st.win[st.i]?'ding':'pass'); }); },
  pShow(){ commit(s=>{ const st=s.g[s.cur.id]; st.show=true; s.timer=null; setFx(s,'reveal'); }); },
  pNext(){ const g=curG(); commit(s=>{ const st=s.g[s.cur.id]; if(st.i+1<st.items.length){ st.i++; st.show=false; timerSet(s,(g.secs||20)*1000); } else { st.step='result'; s.timer=null; } }); },
  mRight(el){ const t=el.dataset.t; commit(s=>{ const st=s.g[s.cur.id], r=st.right[st.i]=st.right[st.i]||{}; r[t]=!r[t]; setFx(s,r[t]?'ding':'pass'); }); },
  mNext(){ commit(s=>{ const st=s.g[s.cur.id]; if(st.i+1<st.items.length) st.i++; else st.step='result'; }); },
  /* 돌아가며 맞히기 */
  tGo(){ const g=curG(); commit(s=>{ const st=s.g[s.cur.id]; st.step='play'; timerSet(s,turnSecs(g,st.order[st.o].t)*1000); setFx(s,'onair'); }); },
  tHit(){ commit(s=>{ const st=s.g[s.cur.id], t=st.order[st.o].t; st.got[t]=(st.got[t]||0)+1; st.w++; setFx(s,'ding'); }); },
  tPass(){ commit(s=>{ s.g[s.cur.id].w++; setFx(s,'pass'); }); },
  tUndo(){ commit(s=>{ const st=s.g[s.cur.id], t=st.order[st.o].t; if(st.got[t]>0) st.got[t]--; }); },
  tNext(){ commit(s=>{ const st=s.g[s.cur.id]; s.timer=null; if(st.o+1<st.order.length){ st.o++; st.step='ready'; st.w++; } else st.step='result'; }); },
  dClear(){ DRAW.strokes=[]; DRAW.sentS=0; DRAW.sentP=0; redraw(); flushDraw(true); },
  /* 가위바위보 */
  rGo(){ commit(s=>{ const st=s.g[s.cur.id]; st.n++; st.at=Date.now()+120; st.hand=pick(['✊','✌️','🖐️']); }); },
  rWin(el){ const t=el.dataset.t; commit(s=>{ const st=s.g[s.cur.id]; st.wins[st.pan]=st.wins[st.pan]===t?null:t; setFx(s,st.wins[st.pan]?'ding':'pass'); }); },
  rNext(){ commit(s=>{ const st=s.g[s.cur.id]; if(st.pan<2){ st.pan++; st.n=0; st.at=0; st.hand=''; } else st.step='result'; }); },
  /* O/X */
  oShow(){ commit(s=>{ s.g[s.cur.id].show=true; s.timer=null; setFx(s,'reveal'); }); },
  oAlive(el){ const t=el.dataset.t, d=+el.dataset.d; commit(s=>{ const st=s.g[s.cur.id], max=teamById(t).members.length; st.alive[t]=Math.min(max,Math.max(0,st.alive[t]+d)); }); },
  oNext(){ commit(s=>{ const st=s.g[s.cur.id]; if(st.i+1<st.qs.length){ st.i++; st.show=false; timerSet(s,15000); } else { st.step='result'; s.timer=null; } }); },
  oEnd(){ commit(s=>{ s.g[s.cur.id].step='result'; s.timer=null; }); },
  /* 폭탄 */
  bLit(){ commit(s=>{ const st=s.g[s.cur.id]; st.lit=true; st.litAt=Date.now(); st.fuseAt=Date.now()+18000+Math.random()*22000; st.turn=st.r%s.teams.length; setFx(s,'onair'); }); },
  bPass(){ commit(s=>{ const st=s.g[s.cur.id]; if(!bombBoomed(st)) st.turn=(st.turn+1)%s.teams.length; }); },
  bNext(){ commit(s=>{ const st=s.g[s.cur.id]; st.boom[st.r]=s.teams[st.turn%s.teams.length].id; if(st.r+1<st.topics.length){ st.r++; st.lit=false; st.fuseAt=0; st.turn=st.r%s.teams.length; } else st.step='result'; }); },
  /* 10초 */
  nStart(){ commit(s=>{ const st=s.g[s.cur.id]; st.phase='run'; st.at=Date.now(); }); },
  nStop(){ const now=Date.now(); commit(s=>{ const st=s.g[s.cur.id]; st.ms[st.cur]=now-st.at; st.phase='done'; setFx(s,'reveal'); }); },
  nNext(){ commit(s=>{ const st=s.g[s.cur.id]; if(st.cur+1<st.order.length){ st.cur++; st.phase='ready'; st.at=0; } else st.step='result'; }); },
  /* 룰렛 */
  wSpin(){ commit(s=>{ const st=s.g[s.cur.id], k=Math.floor(Math.random()*WHEEL.length), a=360/WHEEL.length; st.k=k; st.at=Date.now(); st.res[st.order[st.cur]]=k; st.rot=Math.ceil(st.rot/360)*360+1800+(360-(k+.5)*a); setFx(s,'drum'); }); },
  wNext(){ commit(s=>{ const st=s.g[s.cur.id]; if(st.cur+1<st.order.length){ st.cur++; st.k=-1; st.at=0; } else st.step='result'; }); },
  /* 최종 결전 */
  c7Bet(){ commit(s=>{ const c=s.c7; c.step='bet'; c.bets={}; c.right={}; c.award=0; c.awardShown={}; c.rank=0; }); },
  c7Pct(el){ const t=el.dataset.t, p=+el.dataset.p; commit(s=>{ const max=Math.max(0,totalBeforeFinal(t)); s.c7.bets[t]=Math.floor(max*p/100/10)*10; }); },
  c7Close(){ const q=finalQuestion(); commit(s=>{ const c=s.c7; c.q=q; c.step='q'; timerSet(s,30000); setFx(s,'drum'); }); },
  c7Show(){ commit(s=>{ s.c7.step='reveal'; s.timer=null; setFx(s,'reveal'); }); },
  c7Right(el){ const t=el.dataset.t, v=el.dataset.v==='1'; commit(s=>{ s.c7.right[t]=v; setFx(s,v?'ding':'buzz'); }); },
  c7Awards(){ commit(s=>{ const c=s.c7; c.step='awards'; c.award=0; if(!awardsReady().length) c.step='rank'; }); },
  c7AwardShow(){ commit(s=>{ const c=s.c7; c.awardShown[c.award]=true; setFx(s,'fanfare'); }); },
  c7AwardNext(){ commit(s=>{ s.c7.award++; setFx(s,'drum'); }); },
  c7Rank(){ commit(s=>{ s.c7.step='rank'; s.c7.rank=0; setFx(s,'drum'); }); },
  c7RankNext(){ const n=S.teams.length; commit(s=>{ const c=s.c7; c.rank++; setFx(s,c.rank>=n?'fanfare':'reveal'); }); },
  c7Credits(){ commit(s=>{ s.c7.step='credits'; }); },
  c7End(){ commit(s=>{ s.cleared.c7=true; s.cur={view:'map'}; s.timer=null; }); },
  /* 준비 */
  plMove(el){ const i=+el.dataset.i, d=+el.dataset.d; commitSetup(s=>{ const p=s.plan, j=i+d; if(j<0||j>=p.length) return; [p[i],p[j]]=[p[j],p[i]]; }); },
  plOff(el){ if(SETUP.plan.length<=1){ B.toast('게임은 하나 이상 있어야 해요','err'); return; } commitSetup(s=>{ s.plan=s.plan.filter(x=>x!==el.dataset.id); }); },
  plOn(el){ commitSetup(s=>{ s.plan.push(el.dataset.id); }); },
  awAdd(){ commitSetup(s=>{ s.awards.push({title:'',desc:'',winner:''}); }); },
  awDel(el){ commitSetup(s=>{ s.awards.splice(+el.dataset.i,1); }); },
  rehearse(){ enterRehearsal(); },
  rehearseNew(){ if(!confirm('리허설 기록을 지우고 처음부터 할까요?')) return; stopAuto(); newRehearsal(); L.routeShown=null; L.panel=null; commit(); },
  rehearseEnd(){ stopAuto(); L.rehearsal=false; S=L.real||readLocal(LS_KEY)||freshState(); L.real=null; L.panel=null; L.routeShown=null; L.synced=false; saveUi(); render(); const d=doc(); B.kvPull(d.k,d.ls,onKv); },
  reset(){
    if(!confirm('팀 편성 · 점수 · 진행 상황을 모두 지웁니다. 진행 준비에 적은 내용은 남습니다. 계속할까요?')) return;
    stopAuto();
    commit(s=>{ const f=freshState(), rev=s.rev, fx=s.fx; Object.keys(s).forEach(k=>delete s[k]); Object.assign(s,f,{rev,fx}); });
    L.routeShown=null; render();
  },
};
const C={
  captain(el){ commit(s=>{ s.c1.captains[el.dataset.t]=el.value; }); },
  mix(el){ commit(s=>{ s.c1.mix=el.checked; }); },
  teamName(el){ const v=el.value.trim().slice(0,12); commit(s=>{ teamById(el.dataset.t).name=v||teamById(el.dataset.t).name; }); },
  bet(el){ const t=el.dataset.t, max=Math.max(0,totalBeforeFinal(t)), v=Math.min(max,Math.max(0,Math.round(+el.value||0))); el.value=v; commit(s=>{ s.c7.bets[t]=v; }); },
  check(el){ const id=el.dataset.id, on=el.checked; commitSetup(s=>{ s.checks[id]=on; }); },
};
function bindPath(path,val){
  commitSetup(s=>{ const keys=path.split('.').slice(1); let o=s; for(let i=0;i<keys.length-1;i++) o=o[keys[i]]; o[keys[keys.length-1]]=val; });
}

/* ---------- 시계 · 동기화 ---------- */
function phaseKey(){
  if(S.cur.view!=='ch') return '';
  const g=curG(), st=g&&S.g[g.id];
  if(!st||st.step==='result') return '';
  if(g.type==='rps'&&st.at) return 'r'+st.n+'-'+rpsPhase(st);
  if(g.type==='bomb'&&st.lit) return 'b'+st.r+'-'+(bombBoomed(st)?'boom':'lit');
  if(g.type==='wheel'&&st.at) return 'w'+st.cur+'-'+(Date.now()>=st.at+WHEEL_MS?'done':'spin');
  return '';
}
function onPhase(pk){
  if(/^r\d+-[01]$/.test(pk)) Snd.play('tick');
  else if(/^r\d+-2$/.test(pk)) Snd.play('ding');
  else if(/-boom$/.test(pk)) Snd.play('boom');
  else if(/^w\d+-done$/.test(pk)) Snd.play('fanfare');
}
function tick(){
  const hidden=viewHidden();
  document.body.classList.toggle('ye-stage-on',!hidden&&L.mode==='stage');
  if(hidden) return;
  const ms=leftMs();
  if(ms!=null){
    const txt=clock(ms);
    $$('[data-timer]').forEach(el=>{ if(el.textContent!==txt) el.textContent=txt; el.classList.toggle('is-low',ms<=5000&&ms>0); el.classList.toggle('is-end',ms<=0); });
    const sec=Math.ceil(ms/1000);
    if(S.timer.run&&ms>0&&sec<=5&&sec!==L.tickSec){ L.tickSec=sec; Snd.play('tick'); }
    if(ms<=0&&S.timer.id!==L.endedTimer){ L.endedTimer=S.timer.id; if(L.synced||H()) Snd.play('buzz'); render(); }
  }
  const pk=phaseKey();
  if(pk!==L.phase){ L.phase=pk; render(); if(pk) onPhase(pk); }
  if(S.cur.view==='ch'){
    const g=curG(), st=g&&S.g[g.id], now=Date.now();
    if(st&&g.type==='bomb'&&st.lit&&!bombBoomed(st)&&now>=L.nextBeep){ const el=now-st.litAt; L.nextBeep=now+(el<12000?700:el<22000?450:260); Snd.play('tick'); const b=root.querySelector('.ye-bomb'); if(b) b.classList.toggle('is-hot',el>=12000); }
    if(st&&g.type==='ten'&&st.phase==='run'){ const span=root.querySelector('[data-ten]'); if(span){ const e=now-st.at, t=e<3000?(e/1000).toFixed(2):'? ? ?'; if(span.textContent!==t) span.textContent=t; } }
    if(g&&g.mode==='draw'&&H()) flushDraw(false);
  }
}
function idleSoon(){ document.body.classList.remove('ye-idle'); clearTimeout(L.idleT); L.idleT=setTimeout(()=>document.body.classList.add('ye-idle'),3000); }
async function keepAwake(){
  try{
    const want=L.mode==='stage'&&!viewHidden()&&!document.hidden;
    if(want&&!rt.wake&&navigator.wakeLock){ rt.wake=await navigator.wakeLock.request('screen'); rt.wake.addEventListener('release',()=>{ rt.wake=null; }); }
    else if(!want&&rt.wake){ const w=rt.wake; rt.wake=null; await w.release(); }
  }catch(e){}
}
function poll(){
  keepAwake();
  if(viewHidden()) return;
  const pj=JSON.stringify(people());
  if(pj!==L.peopleJson){ const had=L.peopleJson; L.peopleJson=pj; if(had) render(); }
  if(document.hidden) return;
  const d=doc();
  B.kvPull(d.k,d.ls,onKv);
  L.pollN=(L.pollN||0)+1;
  if(L.pollN%3===0) B.kvPull(SET_KEY,SET_LS,onSetKv);
}
function bind(){
  if(L.bound) return; L.bound=true;
  root.addEventListener('click',e=>{ const el=e.target.closest('[data-a]'); if(!el||!root.contains(el)||el.disabled) return; Snd.unlock(); const f=A[el.dataset.a]; if(f) f(el,e); });
  root.addEventListener('change',e=>{ const el=e.target; if(el.dataset.bind){ bindPath(el.dataset.bind,el.dataset.num?+el.value:el.value); } else if(el.dataset.c&&C[el.dataset.c]){ C[el.dataset.c](el); } });
  document.addEventListener('pointerdown',()=>Snd.unlock(),{passive:true});
  document.addEventListener('pointermove',()=>{ if(L.mode==='stage') idleSoon(); },{passive:true});
  window.addEventListener('resize',()=>{ if(viewHidden()) return; if(root.querySelector('.ye-route')) drawRoute(); fitCanvas(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!viewHidden()&&L.mode==='stage'&&!document.fullscreenElement) A.host(); });
  setInterval(tick,100);
  setInterval(poll,2000);
}

window.YearEnd={
  open(){
    root=document.getElementById('yeRoot');
    if(!root) return;
    bind();
    L.routeShown=null;
    rtInit();
    B.kvPull(SET_KEY,SET_LS,onSetKv);
    if(L.rehearsal&&!L.opened){ L.opened=true; enterRehearsal(); }
    else { L.opened=true; render(); const d=doc(); B.kvPull(d.k,d.ls,onKv); }
    Promise.resolve().then(B.refreshOrg).catch(()=>{});
    setTimeout(()=>{ if(!viewHidden()) render(); },1500);
    if(L.mode==='stage') idleSoon();
  },
};
})();
