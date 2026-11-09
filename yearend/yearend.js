/* 2026 송년회 — 챕터형 팀 대항전 (전승훈 · 전수빈 전용)
   index.html 의 yeLoad() 가 대표 두 분 PC 에서만 불러온다. 오피스 데이터는 window.YE_BRIDGE 로 받는다.
   · 상태 하나(S)를 Supabase app_kv 'yearend_2026' 에 저장 → 대표 두 분 기기 · 대형화면이 같은 진행 상황을 본다.
   · 대형화면(L.mode='stage')에는 조작 버튼과 정답·제시어가 나오지 않는다.
   · 리허설은 저장하지 않는다 (L.rehearsal). */
(function(){
'use strict';
if(window.YearEnd) return;
const B=window.YE_BRIDGE;
const KV_KEY='yearend_2026', LS_KEY='brightbeed_yearend_2026', UI_KEY='brightbeed_yearend_ui', VER=1;

/* ---------- 콘텐츠 ---------- */
const CHAPTERS=[
  {id:'c1',no:1,icon:'🪪',title:'특별 인사발령',sub:'팀 나누기',min:15,
   story:'2026년의 마지막 주문을 맡을 특별 TF를 꾸립니다.',
   rules:['팀장들이 주장을 맡아 뒤집힌 카드를 차례로 고릅니다.','카드를 뒤집으면 우리 팀원이 공개됩니다.','오피스 조직도로 미리 섞어 두어 같은 부서끼리 몰리지 않습니다.','팀이 완성되면 팀 이름을 정합니다.'],
   props:'없음',score:'점수 없음'},
  {id:'c2',no:2,icon:'📝',title:'오피스 능력고사',sub:'사내 퀴즈',min:15,
   story:'우리 회사를 얼마나 아는지 사내 시험부터 치릅니다.',
   rules:['문제는 오피스 앱의 조직도 · 브랜드 · 상품 정보로 출제됩니다.','제한시간이 끝나면 주장이 동시에 손가락으로 1~4번을 듭니다.','맞힌 팀마다 매출 100만, 마지막 문제는 200만입니다.'],
   props:'없음',score:'문제당 100만 · 마지막 200만'},
  {id:'c3',no:3,icon:'🙆',title:'몸으로 말해요',sub:'사내 단어 스피드 게임',min:20,
   story:'말이 안 통하면 몸으로 전달합니다.',
   rules:['팀원 전원이 돌아가며 출제자가 됩니다.','출제자는 말 없이 몸으로만 설명하고, 팀원이 맞힙니다.','맞히면 1개당 매출 50만. 패스는 벌점 없이 다음 단어로 넘어갑니다.'],
   props:'없음',score:'정답 1개당 50만'},
  {id:'c4',no:4,icon:'🏷️',title:'이 상품 얼마게요?',sub:'판매가 맞히기',min:15,
   story:'MD의 눈으로 우리 상품의 판매가를 맞히세요.',
   rules:['브랜드마다 실제 상품이 하나씩 공개됩니다.','팀별로 의논해 판매가를 종이에 적어 듭니다.','가장 가까운 팀 매출 200만, 정확히 맞히면 100만을 더 받습니다.'],
   props:'팀별 종이 · 매직펜',score:'가장 가까운 팀 200만 · 정확히 +100만'},
  {id:'c5',no:5,icon:'📦',title:'출고 대작전',sub:'포장 릴레이',min:20,
   story:'피킹부터 송장까지, 올해 마지막 출고를 끝내세요.',
   rules:['팀마다 다른 출고 지시서가 화면에 뜹니다.','피킹 → 검수 → 포장 → 송장 순서로 릴레이합니다.','오피킹 · 누락은 1건당 15초가 더해집니다.','빠른 순서대로 매출 400 · 250 · 100만입니다.'],
   props:'팀별 택배 상자 · 테이프 · 매직펜, 작은 물건 20종',score:'1위 400만 · 2위 250만 · 3위 100만'},
  {id:'c6',no:6,icon:'📺',title:'라이브커머스 배틀',sub:'60초 방송',min:25,
   story:'세상에 없던 상품을 60초 안에 팔아 보세요.',
   rules:['팀마다 황당한 상품과 방송 미션을 뽑습니다.','3분간 준비하고, 팀별로 60초 라이브 방송을 합니다.','심사위원 두 명의 점수 합계 × 25만이 방송 매출이 됩니다.'],
   props:'소품은 주변 물건 아무거나',score:'심사 20점 만점 × 25만 (최대 500만)'},
  {id:'c7',no:7,icon:'🏆',title:'최종 정산',sub:'베팅 · 어워즈 · 시상',min:20,
   story:'누적 매출을 걸고 마지막 승부를 겨룹니다.',
   rules:['지금까지 번 매출의 일부를 광고비로 겁니다.','마지막 문제를 맞히면 건 금액만큼 더 벌고, 틀리면 잃습니다.','오피스 어워즈 수상자가 있는 팀은 매출 100만을 받습니다.','마지막에 최종 순위를 공개합니다.'],
   props:'상금 · 선물',score:'베팅 금액 ± · 어워즈 1개당 100만'},
];
const chap=id=>CHAPTERS.find(c=>c.id===id);

const TEAM_IDS=['a','b','c','d'];
const TEAM_COLORS=['#ff8a7a','#ffc94d','#4fd6b8','#b9a2ff'];
const TEAM_NAMES=['완판신화','품절대란','재입고요청','당일출고','리뷰5점','무료배송','묶음배송','장바구니'];
const FAKE_BRANDS=['모노하우스','데일리무드','아뜰리에룸','코지라운지','루미에르','오르빗'];

/* 2026-11-09 식스샵 판매가 기준. 뒤에만 추가할 것 (진행 상태가 번호로 저장된다). */
const IMG_OLD=(store,file)=>'https://migrate.cdn.sixshop.io/?imageUrl=https%3A%2F%2Fcontents.sixshop.com%2FuploadedFiles%2F'+store+'%2Fproduct%2F'+file;
const IMG_NEW=(store,file)=>'https://cdn.sixshop.io/commerce/public/stores/'+store+'/products/'+file;
const PRODUCTS=[
  {b:'식스에이',n:'[SILVER925] Tan Open Ring',p:13800,img:IMG_NEW('6ashop','KakaoTalk_20261106_155850073_1793949084570.jpg')},
  {b:'식스에이',n:'[SILVER925] Guyeong Open Ring v3.0',p:5880,img:IMG_OLD('184096','image_1719534523975.gif')},
  {b:'식스에이',n:'[SILVER925] Mustafakemalpaşa Ring',p:13800,img:IMG_OLD('184096','image_1709777127004.jpg')},
  {b:'야르',n:'CandyPOP Necklace',p:13000,img:IMG_OLD('274464','image_1777018324012.jpg')},
  {b:'야르',n:'LINZ Necklace',p:8500,img:IMG_OLD('277817','image_1782974722748.png')},
  {b:'야르',n:'4s 925 Open Ring',p:9500,img:IMG_NEW('yarshop','thumb-L7CRF52PV7H5_1793703207667.jpg')},
  {b:'프로덕트피알',n:'180° Fast Charging Cable',p:7500,img:IMG_OLD('211642','image_1782797831328.png')},
  {b:'프로덕트피알',n:'Jacquard Fast Charging Cable',p:1500,img:IMG_OLD('211642','image_1780306389771.png')},
  {b:'프로덕트피알',n:'Curve Toilet Mini Brush',p:2500,img:IMG_OLD('211642','image_1780306429241.png')},
  {b:'프로덕트피알',n:'Flower Keychain',p:2500,img:IMG_OLD('211642','image_1779787139927.jpg')},
  {b:'아코이하우스',n:'Akoi Haus Eco Bag',p:5000,img:IMG_OLD('278491','image_1782987392411.jpg')},
  {b:'아코이하우스',n:'[1+1] Mallow EVA Room Shoes',p:40000,img:IMG_OLD('278491','image_1782806378337.jpg')},
  {b:'아코이하우스',n:'[1+1] Butter Cloud Terry Room Shoes',p:35000,img:IMG_OLD('278491','image_1782804147007.jpg')},
  {b:'코페리',n:'Bunny Bag (Charcoal)',p:39000,img:IMG_NEW('coferry','xcvxcvcv_1793700637894.jpg')},
  {b:'코페리',n:'First-q bag (BL)',p:24000,img:IMG_NEW('coferry','240716_6a_%EA%B0%80%EB%B0%A97_1791964415954.jpg')},
  {b:'코페리',n:'cobaltiny bag (Black)',p:41000,img:IMG_NEW('coferry','%EC%BD%94%EB%B0%9C-%EB%B8%94%EB%9E%99_1792976657779.jpg')},
  {b:'아페티',n:'Moon Glow Ring',p:13000,img:IMG_NEW('apeti','%EC%8A%AC%EB%9D%BC%EC%9D%B4%EB%93%9C5_1793791477978.JPG')},
  {b:'아페티',n:'Dolly ring',p:9000,img:IMG_NEW('apeti','dolly_1792118645521_1792642677788.gif')},
  {b:'아페티',n:'[SET] Midnight Wave Ring',p:14000,img:IMG_NEW('apeti','%EC%8A%AC%EB%9D%BC%EC%9D%B4%EB%93%9C4_1793791459434.JPG')},
  {b:'코즈미',n:'Twine Ring',p:24000,img:IMG_NEW('cos-mi','Frame-114_1793963744694.png')},
  {b:'코즈미',n:'Bold Luv Ring',p:13500,img:IMG_NEW('cos-mi','Frame-4_1793872688808.png')},
  {b:'코즈미',n:'Ailet Ring',p:25000,img:IMG_NEW('cos-mi','Frame-7_1793963253207.png')},
];

const WORDS=[
  '반지 끼워 주기','귀걸이 한쪽 잃어버리기','목걸이 줄 엉킴 풀기','룸슈즈 신고 미끄러지기','에코백 메고 출근','토끼 가방 메기','180도 꺾이는 케이블','변기 솔 청소','키링 흔들기',
  '발주서 쓰기','송장 출력','바코드 찍기','박스 테이프 뜯기','뽁뽁이 터뜨리기','택배 기사님 도착','재입고 알림','품절 표시 붙이기','반품 상자 열기','CS 전화 받기','고객님 화나셨어요','쿠폰 코드 입력','기획전 세팅','상세페이지 스크롤','모델 포즈 잡기','상품 사진 촬영','릴스 찍기','라이브 방송 켜기','엑셀 수식 오류','대표님 결재 기다리기','업무일지 쓰기','연차 신청','퇴근 5분 전 업무 요청','점심 메뉴 고르기','커피 타러 가기','회의 중 졸기','월요일 아침 출근','지각 직전 달리기','회식 건배','창고 정리','샘플 검수','번역기 돌리기','장바구니 담기','리뷰 5점 쓰기','택배 상자 쌓기','재고 세기','오배송 사과하기','컴퓨터 재부팅','와이파이 안 될 때','슬리퍼 끌고 화장실','영수증 붙이기',
  '산타 선물 배달','눈사람 만들기','새해 소원 빌기','떡국 먹기','제야의 종 치기','붕어빵 먹기','귤 까기','트리 장식','스키 타기','핫팩 흔들기','새해 일출 보기','세뱃돈 받기','군고구마 호호 불기','눈싸움','캐럴 부르기',
  '병뚜껑 따기','고양이 세수','스쿼트','복권 긁기','로봇청소기','우산 뒤집힘','지하철 손잡이','셀카 찍기','자판기 동전 넣기','치킨 뜯기','라면 끓이기','줄넘기','낚시','볼링 치기','골프 스윙',
];

const LIVE_PRODUCTS=['왼쪽만 있는 양말','건전지 없는 리모컨','월요일 아침 알람시계','퇴근 5분 전 업무 차단기','대표님 결재 자동 도장','절대 품절되지 않는 재고','한 번 붙이면 안 떨어지는 송장','리뷰 5점만 써지는 볼펜','반품이 안 되는 반품 상자','소리 나는 포스트잇','눈에 안 보이는 귀걸이','1초 만에 식는 커피','점심 메뉴 대신 골라 주는 모자','연차가 늘어나는 달력','엑셀 오류 지우개','회의 시간 줄여 주는 의자','뜯으면 다시 붙는 박스 테이프','주말에만 작동하는 노트북'];
const LIVE_MISSIONS=['"품절 임박"을 세 번 외치기','고객 역할 팀원이 반드시 등장하기','심사위원에게 공개 할인 요청하기','가격을 마지막 5초에 공개하기','경쟁 팀 상품을 한 번 칭찬하기','노래로 15초 이상 판매하기','사용 후기를 즉석 연기하기','터무니없는 배송 약속하기','팀원 전원이 한마디씩 하기','상품 없이 손짓으로만 소개하기'];
const LIVE_PRICES=[990,4900,9900,19900,29900];
const LIVE_COMMENTS=['가격 얼마예요?','재입고 언제 돼요?','배송 오늘 출발하나요?','사장님이 미쳤어요','이 가격 실화?','쿠폰 안 먹혀요','엄마 나 여기 나왔어','방금 결제했어요','품절되기 전에 삽니다','색상 더 없나요?','사이즈 교환 되나요?','후기 보고 왔어요','대표님 보고 계시죠?','선물 포장 되나요?','이거 왜 좋아요?','무료배송 맞죠?','한 개만 더 넣어 주세요','친구 데려왔어요','1번 주세요','장바구니 터졌어요','결제창이 안 떠요','오늘만 이 가격인가요?','댓글 읽어 주세요'];

const DEFAULT_ITEMS=['볼펜','포스트잇','종이컵','건전지','사탕','귤','머리끈','양말','휴지','클립','고무줄','과자','물티슈','케이블','키링','반지 샘플','귀걸이 샘플','에코백','핫팩','초콜릿'];
const ADDRESSES=['물류창고 3번 선반','대표님 책상 위','회식 장소 맨 끝자리','2027년 1월 1일 일출 명소','연차 쓰는 날 제주도','퇴근길 1번 출구','택배 트럭 조수석','탕비실 커피머신 옆'];
const PROPS=[
  {id:'tv',ch:'공통',label:'TV 또는 빔프로젝터 + 노트북 (대형화면용)'},
  {id:'phone',ch:'공통',label:'진행자 휴대폰 (오피스에 전승훈 · 전수빈으로 로그인)'},
  {id:'speaker',ch:'공통',label:'스피커 (효과음용)'},
  {id:'paper',ch:'챕터 4',label:'팀별 종이 · 매직펜'},
  {id:'box',ch:'챕터 5',label:'팀별 택배 상자 · 박스테이프 · 매직펜'},
  {id:'items',ch:'챕터 5',label:'출고용 작은 물건 20종 이상'},
  {id:'stuff',ch:'챕터 6',label:'라이브 방송 소품 (주변 물건)'},
  {id:'gift',ch:'챕터 7',label:'상금 · 선물 · 꼴등 미션'},
];
function defaultAwards(){
  return [
    {title:'터줏대감상',desc:'가장 오래 우리 회사를 지켜 준 사람',winner:''},
    {title:'올해의 신입상',desc:'가장 빠르게 우리 팀이 된 새 얼굴',winner:''},
    {title:'분위기 메이커상',desc:'사무실 온도를 1도 올려 준 사람',winner:''},
    {title:'숨은 해결사상',desc:'조용히 문제를 끝내 놓는 사람',winner:''},
    {title:'칭찬 릴레이상',desc:'동료들이 가장 많이 고마워한 사람',winner:''},
  ];
}

/* ---------- 도구 ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const pick=a=>a[Math.floor(Math.random()*a.length)];
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const fmt=n=>{n=Math.round(n||0);return (n<0?'−':'')+Math.abs(n).toLocaleString('ko-KR')+'만';};
const won=n=>Math.round(n||0).toLocaleString('ko-KR')+'원';
const clock=ms=>{const s=Math.ceil((ms||0)/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
const stopw=ms=>{ms=Math.max(0,ms||0);const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'.'+Math.floor(ms%1000/100);};
const $$=(sel,el)=>Array.from((el||root).querySelectorAll(sel));

/* ---------- 상태 ---------- */
function freshState(){
  return {
    v:VER,rev:0,cur:{view:'map'},cleared:{},teams:[],adj:{},clearing:null,timer:null,fx:null,openAll:false,
    setup:{date:'',place:'',p1:'',p2:'',p3:'',last:'',closing:'',judges:['전승훈','전수빈'],awards:defaultAwards(),finalQ:{q:'',o1:'',o2:'',o3:'',o4:'',a:0},checks:{}},
    c1:{step:'intro',out:[],join:[],count:3,mix:true,captains:{},cards:[],plan:{},turn:0},
    c2:{step:'intro',qs:[],i:0,show:false,right:{}},
    c3:{step:'intro',words:[],w:0,teamSec:160,order:[],o:0,got:{}},
    c4:{step:'intro',list:[],i:0,guess:{},show:{}},
    c5:{step:'intro',items:DEFAULT_ITEMS.slice(),n:5,orders:{},start:0,done:{},pen:{}},
    c6:{step:'intro',assign:{},i:0,on:false,marks:{}},
    c7:{step:'intro',bets:{},right:{},q:null,award:0,awardShown:{},rank:0,diary:null},
  };
}
function normalize(s){
  const d=freshState(), out=Object.assign(d,s);
  ['setup','c1','c2','c3','c4','c5','c6','c7'].forEach(k=>{ out[k]=Object.assign(freshState()[k],s[k]||{}); });
  return out;
}
function loadLocal(){ try{ const w=JSON.parse(localStorage.getItem(LS_KEY)||'null'), j=w&&w.d; return j&&j.v===VER?normalize(j):null; }catch(e){ return null; } }
/* 진행자/대형화면은 탭마다 따로 기억한다 — 노트북 한 대에서 진행자 탭 + TV 쪽 대형화면 탭으로 쓸 수 있게 */
function loadUi(){ const o={}; try{ const s=JSON.parse(localStorage.getItem(UI_KEY)||'{}')||{}; if(typeof s.sound==='boolean') o.sound=s.sound; }catch(e){} try{ const m=sessionStorage.getItem(UI_KEY+'_mode'); if(m==='stage'||m==='host') o.mode=m; }catch(e){} return o; }
function saveUi(){ try{ localStorage.setItem(UI_KEY,JSON.stringify({sound:L.sound})); }catch(e){} try{ sessionStorage.setItem(UI_KEY+'_mode',L.mode); }catch(e){} }

let root=null, S=loadLocal()||freshState();
const L=Object.assign({mode:'host',sound:true},loadUi(),{panel:null,rehearsal:false,real:null,routeShown:null,routeAnim:0,auto:0,synced:false,bound:false,peopleJson:'',feedAt:0,endedTimer:-1,tickSec:-1,views:120});
const rt={chan:null,starting:false};

const viewHidden=()=>{ const v=document.getElementById('viewYearEnd'); return !v||v.hidden; };
const H=()=>L.mode==='host';

function persist(){
  if(L.rehearsal) return;
  /* 문서 전체를 키 하나(d)로 저장한다. kv 는 최상위 키 단위로 3-way 병합을 하므로, 값이 A→B→A 로 빠르게 바뀌는 칸(timer 등)이 서버의 옛 값으로 되살아난다. */
  B.kvSet(KV_KEY,LS_KEY,{d:clone(S)});
  try{ if(rt.chan) rt.chan.send({type:'broadcast',event:'s',payload:{s:S}}); }catch(e){}
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
  if(L.rehearsal||!next||next.v!==VER) return;
  const first=!L.synced; L.synced=true;
  if((next.rev||0)<(S.rev||0)) return;
  if(JSON.stringify(next)===JSON.stringify(S)) return;
  const before=S.fx?S.fx.n:0;
  S=normalize(next);
  render();
  if(!first&&S.fx&&S.fx.n!==before) runFx(S.fx);
}
const onKv=v=>{ if(v&&v.d) onRemote(v.d); };
function setFx(s,t){ s.fx={n:(s.fx?s.fx.n:0)+1,t}; }
async function rtInit(){
  if(rt.chan||rt.starting) return;
  rt.starting=true;
  try{
    await B.loadRealtime();
    const sb=window.supabase;
    if(sb&&sb.channel){
      rt.chan=sb.channel('yearend-2026',{config:{broadcast:{self:false}}})
        .on('broadcast',{event:'s'},m=>{ if(m&&m.payload) onRemote(m.payload.s); })
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
    tick(){tone(1200,0,.05,'square',.05);},
    flip(){tone(520,0,.08,'triangle',.14);tone(880,.06,.1,'triangle',.12);},
    shuffle(){for(let i=0;i<8;i++)tone(300+Math.random()*500,i*.06,.05,'square',.05);},
    ding(){tone(880,0,.14,'sine',.2);tone(1320,.1,.24,'sine',.18);},
    pass(){tone(300,0,.12,'triangle',.12);},
    buzz(){tone(140,0,.5,'sawtooth',.16);tone(110,.05,.5,'sawtooth',.12);},
    reveal(){tone(523,0,.12,'triangle',.18);tone(659,.1,.12,'triangle',.18);tone(784,.2,.3,'triangle',.2);},
    stamp(){tone(90,0,.28,'square',.3);tone(180,.02,.16,'sawtooth',.16);},
    drum(){for(let i=0;i<22;i++)tone(150+i*4,i*.055,.05,'square',.05+i*.004);},
    onair(){tone(660,0,.16,'square',.1);tone(660,.3,.16,'square',.1);tone(990,.6,.4,'square',.14);},
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

/* ---------- 점수 ---------- */
const SCORE={
  c1:()=>({}),
  c2:()=>{ const c=S.c2,o={}; c.qs.forEach((q,i)=>{ const r=c.right[i]||{}; Object.keys(r).forEach(t=>{ if(r[t]) o[t]=(o[t]||0)+(i===c.qs.length-1?200:100); }); }); return o; },
  c3:()=>{ const c=S.c3,o={}; Object.keys(c.got).forEach(t=>o[t]=c.got[t]*50); return o; },
  c4:()=>{ const c=S.c4,o={}; c.list.forEach((pi,i)=>{ if(!c.show[i]) return; const g=c.guess[i]||{},price=PRODUCTS[pi].p; let best=Infinity; S.teams.forEach(t=>{ const v=+g[t.id]; if(v>0) best=Math.min(best,Math.abs(v-price)); }); if(best===Infinity) return; S.teams.forEach(t=>{ const v=+g[t.id]; if(v>0&&Math.abs(v-price)===best) o[t.id]=(o[t.id]||0)+200+(best===0?100:0); }); }); return o; },
  c5:()=>{ const pts=[400,250,100,50],o={}; c5Ranks().forEach((r,i)=>{ o[r.t.id]=pts[i]||0; }); return o; },
  c6:()=>{ const c=S.c6,o={}; Object.keys(c.marks).forEach(t=>{ const m=c.marks[t]||[]; o[t]=((+m[0]||0)+(+m[1]||0))*25; }); return o; },
  c7:()=>{ const c=S.c7,o={}; S.teams.forEach(t=>{ const b=+c.bets[t.id]||0; if(c.right[t.id]===true) o[t.id]=(o[t.id]||0)+b; if(c.right[t.id]===false) o[t.id]=(o[t.id]||0)-b; }); awardsReady().forEach((a,i)=>{ if(c.awardShown[i]){ const t=teamOf(a.winner); if(t) o[t.id]=(o[t.id]||0)+100; } }); return o; },
};
function chScore(id){ const o=SCORE[id](), a=(S.adj||{})[id]||{}; S.teams.forEach(t=>{ o[t.id]=(o[t.id]||0)+(a[t.id]||0); }); return o; }
function total(tid){ return CHAPTERS.reduce((s,c)=>s+(chScore(c.id)[tid]||0),0); }
function totalBeforeFinal(tid){ return CHAPTERS.filter(c=>c.id!=='c7').reduce((s,c)=>s+(chScore(c.id)[tid]||0),0); }
function c5Ranks(){ const c=S.c5; return S.teams.filter(t=>c.done[t.id]).map(t=>({t,ms:c.done[t.id]+(c.pen[t.id]||0)*15000})).sort((a,b)=>a.ms-b.ms); }
function awardsReady(){ return (S.setup.awards||[]).filter(a=>a.title&&a.winner); }

/* ---------- 오피스 능력고사 문제 ---------- */
function hired(){ return people().filter(p=>!p.ceo&&/^\d{4}-\d{2}-\d{2}/.test(p.hire||'')); }
function pick4(arr,key){ const seen=new Set(),out=[]; for(const x of shuffle(arr)){ const k=key(x); if(seen.has(k)) continue; seen.add(k); out.push(x); if(out.length===4) return out; } return null; }
function mk(q,opts,answer,tag){ const o=shuffle(opts.map((_,i)=>i)); return {q,opts:o.map(i=>opts[i]),a:o.indexOf(answer),tag}; }
function mkNum(q,n,tag,suffix){
  const set=shuffle([[-1,0,1,2],[-2,-1,0,1],[0,1,2,3],[-3,-2,-1,0]]).find(d=>n+d[0]>=0)||[0,1,2,3];
  return {q,opts:set.map(d=>(n+d)+(suffix||'')),a:set.indexOf(0),tag};
}
const QGEN={
  headcount(){ return mkNum('대표님 두 분을 포함한 우리 회사 현재 인원은?',people().length,'조직도','명'); },
  brandCount(){ return mkNum('지금 오피스 앱에서 운영 중인 브랜드는 몇 개일까요?',B.brands().length,'브랜드','개'); },
  leaders(){ const n=people().filter(p=>p.title==='팀장').length; return n?mkNum("우리 회사 '팀장' 직책은 모두 몇 명일까요?",n,'조직도','명'):null; },
  joined2026(){ return mkNum('2026년에 입사한 직원은 모두 몇 명일까요?',hired().filter(p=>p.hire.startsWith('2026')).length,'조직도','명'); },
  firstHire(){ const a=pick4(hired(),p=>p.hire); if(!a) return null; const s=a.slice().sort((x,y)=>x.hire.localeCompare(y.hire)); return mk('다음 중 가장 먼저 입사한 사람은?',a.map(p=>p.name),a.indexOf(s[0]),'조직도'); },
  lastHire(){ const a=pick4(hired(),p=>p.hire); if(!a) return null; const s=a.slice().sort((x,y)=>y.hire.localeCompare(x.hire)); return mk('다음 중 가장 최근에 입사한 사람은?',a.map(p=>p.name),a.indexOf(s[0]),'조직도'); },
  hireMonth(){ const p=pick(hired()); if(!p) return null; const y=+p.hire.slice(0,4),m=+p.hire.slice(5,7); const lab=k=>{ const d=new Date(y,m-1+k,1); return d.getFullYear()+'년 '+(d.getMonth()+1)+'월'; }; const set=shuffle([[0,1,2,-1],[0,-1,-2,1],[0,2,-2,1]])[0]; const opts=set.map(lab); return mk(p.name+' 님이 입사한 달은?',opts,0,'조직도'); },
  unitOf(){ const ps=people().filter(p=>!p.ceo); const p=pick(ps); if(!p) return null; const units=[...new Set(ps.map(unit))]; if(units.length<4) return null; const others=shuffle(units.filter(u=>u!==unit(p))).slice(0,3); const opts=[unit(p)].concat(others); return mk(p.name+' 님의 소속 팀은?',opts,0,'조직도'); },
  biggest(){ const n={}; people().filter(p=>!p.ceo).forEach(p=>n[unit(p)]=(n[unit(p)]||0)+1); const u=Object.keys(n).sort((a,b)=>n[b]-n[a]); if(u.length<4||n[u[0]]===n[u[1]]) return null; const opts=u.slice(0,4); return mk('우리 회사에서 인원이 가장 많은 팀은?',opts,0,'조직도'); },
  fakeBrand(){ const b=shuffle(B.brands().map(x=>x.name)).slice(0,3); if(b.length<3) return null; const opts=b.concat(pick(FAKE_BRANDS)); return mk('다음 중 우리 브랜드가 아닌 것은?',opts,3,'브랜드'); },
  firstBrand(){ const b=B.brands().map(x=>x.name); if(b.length<4) return null; const opts=[b[0]].concat(shuffle(b.slice(1)).slice(0,3)); return mk('오피스 앱 매출 카드에서 맨 앞에 나오는 브랜드는?',opts,0,'브랜드'); },
  priciest(){ const a=pick4(PRODUCTS,p=>p.p); if(!a) return null; const s=a.slice().sort((x,y)=>y.p-x.p); return mk('다음 중 판매가가 가장 비싼 상품은?',a.map(p=>p.b+' · '+p.n),a.indexOf(s[0]),'상품'); },
  cheapest(){ const a=pick4(PRODUCTS,p=>p.p); if(!a) return null; const s=a.slice().sort((x,y)=>x.p-y.p); return mk('다음 중 판매가가 가장 저렴한 상품은?',a.map(p=>p.b+' · '+p.n),a.indexOf(s[0]),'상품'); },
  brandOf(){ const p=pick(PRODUCTS); const others=shuffle([...new Set(PRODUCTS.map(x=>x.b))].filter(b=>b!==p.b)).slice(0,3); return mk("'"+p.n+"'은(는) 어느 브랜드 상품일까요?",[p.b].concat(others),0,'상품'); },
  color(){ return mk('비드유니버스의 시그니처 컬러는?',['#4F7FCF','#FF2E93','#22C55E','#F97316'],0,'회사'); },
  codeLines(){ return {q:'이 오피스 앱의 코드는 몇 줄일까요?',opts:['약 4천 줄','약 1만 줄','약 4만 줄','약 10만 줄'],a:2,tag:'오피스 앱'}; },
  noTeam(){ return mk('오피스 앱 홈 화면에 없는 팀 카드는?',['재무팀','인사팀','CS팀','벤더팀'],0,'오피스 앱'); },
};
function genOne(key){ try{ const q=QGEN[key](); if(q){ q.k=key; return q; } }catch(e){} return null; }
function genQuestions(){ const out=[]; for(const k of shuffle(Object.keys(QGEN))){ if(out.length>=10) break; const q=genOne(k); if(q) out.push(q); } return out; }
async function finalQuestion(){
  const f=S.setup.finalQ||{};
  if(f.q&&f.o1&&f.o2&&f.o3&&f.o4) return {q:f.q,opts:[f.o1,f.o2,f.o3,f.o4],a:+f.a||0,tag:'대표 출제'};
  let n=null;
  try{ n=await B.diaryTotal(); }catch(e){}
  if(n>0){
    const base=Math.round(n/100)*100, set=pick([[.6,1,1.6,2.4],[.35,.6,1,1.6],[1,1.5,2.2,3]]);
    return {q:'지금까지 오피스 앱 업무일지에 쌓인 기록은 모두 몇 건일까요?',opts:set.map(m=>'약 '+(Math.round(base*m/100)*100).toLocaleString('ko-KR')+'건'),a:set.indexOf(1),tag:'오피스 앱',diary:n};
  }
  return Object.assign(QGEN.codeLines(),{k:'codeLines'});
}

/* ---------- 공통 조각 ---------- */
function stageWait(t,s){ return `<div class="ye-wait"><span class="ye-wait-dot"></span><h3>${esc(t)}</h3>${s?`<p>${esc(s)}</p>`:''}</div>`; }
function introCard(c,action){
  return `<div class="ye-intro">
    <div class="ye-intro-poster"><span class="ye-intro-icon">${c.icon}</span><small>CHAPTER ${c.no}</small><h3>${esc(c.title)}</h3><p>${esc(c.story)}</p></div>
    <div class="ye-intro-body">
      <ol class="ye-rules">${c.rules.map(r=>`<li>${esc(r)}</li>`).join('')}</ol>
      <dl class="ye-meta"><div><dt>시간</dt><dd>${c.min}분</dd></div><div><dt>준비물</dt><dd>${esc(c.props)}</dd></div><div><dt>배점</dt><dd>${esc(c.score)}</dd></div></dl>
      ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="${action}" ${c.id!=='c1'&&!S.teams.length?'disabled':''}>시작하기</button></div>${c.id!=='c1'&&!S.teams.length?'<p class="ye-note">챕터 1에서 팀을 먼저 만들어 주세요.</p>':''}`:''}
    </div>
  </div>`;
}
function standings(mini){
  if(!S.teams.length) return mini?'':'<div class="ye-board-empty">챕터 1에서 팀이 정해지면 매출 순위표가 열립니다.</div>';
  const rows=S.teams.map(t=>({t,v:total(t.id)})).sort((a,b)=>b.v-a.v);
  return `<div class="ye-board ${mini?'is-mini':''}">${rows.map((r,i)=>`<div class="ye-bd" data-key="${r.t.id}" style="--tc:${color(r.t)}"><span class="ye-bd-rank">${i+1}</span><span class="ye-bd-name">${esc(r.t.name)}</span>${mini?'':`<span class="ye-bd-mem">${esc(r.t.members.join(' · '))}</span>`}<b class="ye-bd-val">${fmt(r.v)}</b></div>`).join('')}</div>`;
}
function resultView(id){
  const c=chap(id), sc=chScore(id), rows=S.teams.map(t=>({t,v:sc[t.id]||0})).sort((a,b)=>b.v-a.v), max=Math.max(1,...rows.map(r=>Math.abs(r.v)));
  return `<div class="ye-result">
    <h3>이번 챕터 매출</h3>
    ${rows.map((r,i)=>`<div class="ye-rr" data-key="${r.t.id}" style="--tc:${color(r.t)}"><span class="ye-rr-rank">${i+1}</span><b class="ye-rr-name">${esc(r.t.name)}</b><span class="ye-rr-bar"><i style="width:${Math.abs(r.v)/max*100}%"></i></span><span class="ye-rr-val">${r.v>0?'+':''}${fmt(r.v)}</span>${H()?`<span class="ye-adj"><button data-a="adj" data-ch="${id}" data-t="${r.t.id}" data-d="-50" aria-label="50만 빼기">−</button><button data-a="adj" data-ch="${id}" data-t="${r.t.id}" data-d="50" aria-label="50만 더하기">+</button></span>`:''}</div>`).join('')}
    ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="clear" data-id="${id}">CHAPTER ${c.no} CLEAR</button></div>`:''}
  </div>`;
}
function timerTools(){ return `<span class="ye-timer-tools"><button class="ye-mini" data-a="tToggle">${S.timer&&S.timer.run?'일시정지':'계속'}</button><button class="ye-mini" data-a="tAdd" data-ms="10000">+10초</button></span>`; }

/* ---------- 챕터 1 · 특별 인사발령 ---------- */
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
      <div class="ye-seg">${[2,3,4].map(n=>`<button class="${c.count===n?'is-on':''}" data-a="c1Count" data-n="${n}">${n}팀</button>`).join('')}</div>
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
    <h3 class="ye-center">팀 이름을 정해 주세요</h3>
    <div class="ye-teams ye-teams-row">${S.teams.map(t=>`<div class="ye-team" style="--tc:${color(t)}">${H()?`<div class="ye-nameinput"><input type="text" maxlength="12" value="${esc(t.name)}" data-c="teamName" data-t="${t.id}" aria-label="팀 이름"><button class="ye-mini" data-a="c1Dice" data-t="${t.id}" aria-label="다른 이름 뽑기">🎲</button></div>`:`<h4>${esc(t.name)}</h4>`}<ul>${t.members.map((m,i)=>`<li class="${i===0?'is-cap':''}">${esc(m)}${i===0?'<small>주장</small>':''}</li>`).join('')}</ul></div>`).join('')}</div>
    ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c1Done">발령 확정</button></div>`:''}
  </div>`;
}

/* ---------- 챕터 2 · 오피스 능력고사 ---------- */
function c2View(){
  const c=S.c2;
  if(c.step==='intro') return introCard(chap('c2'),'c2Build');
  if(c.step==='build') return c2Build();
  if(c.step==='play') return c2Play();
  return resultView('c2');
}
function c2Build(){
  const c=S.c2;
  if(!H()) return stageWait('시험 문제를 고르고 있습니다');
  return `<div class="ye-block">
    <div class="ye-sec-head"><h3>출제 목록 ${c.qs.length}문제</h3><button class="ye-mini" data-a="c2Regen">전부 다시 뽑기</button></div>
    <ol class="ye-qlist">${c.qs.map((q,i)=>`<li data-key="${esc(q.q)}"><div><b>${esc(q.q)}</b><span>정답: ${esc(q.opts[q.a])}</span></div><div class="ye-qbtns"><button class="ye-mini" data-a="c2Swap" data-i="${i}">바꾸기</button><button class="ye-mini" data-a="c2Del" data-i="${i}">빼기</button></div></li>`).join('')}</ol>
    <details class="ye-add"><summary>직접 문제 추가</summary>
      <div class="ye-form" id="yeAddQ">
        <input type="text" name="q" placeholder="문제" aria-label="문제">
        <div class="ye-form2">${[1,2,3,4].map(n=>`<input type="text" name="o${n}" placeholder="${n}번 보기" aria-label="${n}번 보기">`).join('')}</div>
        <label>정답 <select name="a">${[1,2,3,4].map(n=>`<option value="${n-1}">${n}번</option>`).join('')}</select></label>
        <button class="ye-btn" data-a="c2Add">추가</button>
      </div>
    </details>
    <div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c2Start" ${c.qs.length?'':'disabled'}>시험 시작</button></div>
  </div>`;
}
function optMark(o){ return /^#[0-9a-f]{6}$/i.test(o)?`<i class="ye-swatch" style="background:${o}"></i>`:''; }
function c2Play(){
  const c=S.c2, q=c.qs[c.i], last=c.i===c.qs.length-1;
  if(!q) return resultView('c2');
  const r=c.right[c.i]||{};
  return `<div class="ye-quiz" data-key="q${c.i}">
    <div class="ye-quiz-top"><span class="ye-badge">문제 ${c.i+1} / ${c.qs.length}${last?' · 매출 2배':''}</span><span class="ye-tag">${esc(q.tag)}</span></div>
    <h3 class="ye-q">${esc(q.q)}</h3>
    <div class="ye-opts">${q.opts.map((o,i)=>`<div class="ye-opt ${c.show?(i===q.a?'is-ans':'is-dim'):''}"><span>${i+1}</span><b>${optMark(o)}${esc(o)}</b></div>`).join('')}</div>
    ${H()?`<div class="ye-hostbar">${c.show?`<span class="ye-hostlabel">맞힌 팀을 누르세요</span><div class="ye-teamtoggles">${S.teams.map(t=>`<button class="${r[t.id]?'is-on':''}" style="--tc:${color(t)}" data-a="c2Right" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</div><button class="ye-btn ye-btn-primary" data-a="c2Next">${last?'결과 보기':'다음 문제'}</button>`:`<span class="ye-hostlabel">진행자만 보임 · 정답 ${q.a+1}번</span>${timerTools()}<button class="ye-btn ye-btn-primary" data-a="c2Show">정답 공개</button>`}</div>`:''}
  </div>`;
}

/* ---------- 챕터 3 · 몸으로 말해요 ---------- */
function c3View(){
  const c=S.c3;
  if(c.step==='intro') return introCard(chap('c3'),'c3Start');
  if(c.step==='result') return resultView('c3');
  const cur=c.order[c.o], t=teamById(cur.t), secs=c3Secs(cur.t);
  const counts=`<div class="ye-c3-count">${S.teams.map(x=>`<span class="${x.id===cur.t?'is-on':''}" style="--tc:${color(x)}">${esc(x.name)} <b>${c.got[x.id]||0}</b></span>`).join('')}</div>`;
  if(c.step==='ready'){
    return `<div class="ye-c3" style="--tc:${color(t)}" data-key="r${c.o}"><small>다음 출제자 · ${c.o+1} / ${c.order.length}</small><h3>${esc(cur.m)}</h3><p>${esc(t.name)} · ${secs}초</p>${counts}${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c3Go">시작</button></div><p class="ye-note">제시어는 이 화면에만 나옵니다. 출제자에게 보여 주세요.</p>`:''}</div>`;
  }
  const up=timeUp(), word=c.words[c.w%c.words.length];
  return `<div class="ye-c3 is-play" style="--tc:${color(t)}">
    <small>${esc(t.name)} · 출제자 ${esc(cur.m)}</small>
    <div class="ye-bigtimer" data-timer>${clock(leftMs())}</div>
    ${H()?`<div class="ye-word" data-key="${esc(word)}">${up?'시간 종료':esc(word)}</div>
      <div class="ye-c3-btns">${up?'':`<button class="ye-btn ye-c3-hit" data-a="c3Hit">정답</button><button class="ye-btn ye-c3-pass" data-a="c3Pass">패스</button>`}</div>
      <div class="ye-actions"><button class="ye-btn ${up?'ye-btn-primary ye-btn-lg':'ye-btn-ghost'}" data-a="c3Next">${c.o+1<c.order.length?'다음 출제자':'결과 보기'}</button><button class="ye-btn ye-btn-ghost" data-a="c3Undo">정답 취소</button></div>`:`<div class="ye-word is-hidden">${up?'시간 종료':'? ? ?'}</div>`}
    ${counts}
  </div>`;
}
function c3Secs(tid){ const t=teamById(tid); return Math.max(15,Math.round(S.c3.teamSec/(t?t.members.length:1))); }

/* ---------- 챕터 4 · 이 상품 얼마게요? ---------- */
function c4View(){
  const c=S.c4;
  if(c.step==='intro') return introCard(chap('c4'),'c4Start');
  if(c.step==='result') return resultView('c4');
  const p=PRODUCTS[c.list[c.i]], shown=!!c.show[c.i], g=c.guess[c.i]||{}, last=c.i===c.list.length-1;
  let best=Infinity; S.teams.forEach(t=>{ const v=+g[t.id]; if(v>0) best=Math.min(best,Math.abs(v-p.p)); });
  return `<div class="ye-price" data-key="p${c.i}-${c.list[c.i]}">
    <div class="ye-price-img"><img src="${esc(p.img)}" alt="${esc(p.n)}" referrerpolicy="no-referrer"></div>
    <div class="ye-price-info">
      <span class="ye-badge">상품 ${c.i+1} / ${c.list.length}</span>
      <small>${esc(p.b)}</small>
      <h3>${esc(p.n)}</h3>
      <div class="ye-price-tag ${shown?'is-open':''}" data-key="${shown?'o':'c'}">${shown?won(p.p):'? ? ? 원'}</div>
      <ul class="ye-guesses">${S.teams.map(t=>{ const v=+g[t.id]||0, win=shown&&v>0&&Math.abs(v-p.p)===best; return `<li class="${win?'is-win':''}" style="--tc:${color(t)}"><span>${esc(t.name)}</span>${H()&&!shown?`<input type="number" inputmode="numeric" min="0" step="100" placeholder="적어 든 금액" value="${v||''}" data-c="guess" data-t="${t.id}" aria-label="${esc(t.name)} 금액">`:`<b>${shown&&v?won(v):(shown?'-':'비공개')}</b>`}${shown&&v?`<em>${v===p.p?'정확!':'차이 '+won(Math.abs(v-p.p))}</em>`:''}</li>`; }).join('')}</ul>
      ${shown?`<p class="ye-source">2026년 11월 9일 판매가 기준</p>`:''}
      ${H()?`<div class="ye-hostbar">${shown?`<button class="ye-btn ye-btn-primary" data-a="c4Next">${last?'결과 보기':'다음 상품'}</button>`:`${timerTools()}<button class="ye-mini" data-a="c4Swap">다른 상품으로</button><button class="ye-btn ye-btn-primary" data-a="c4Show">가격 공개</button>`}</div>`:''}
    </div>
  </div>`;
}

/* ---------- 챕터 5 · 출고 대작전 ---------- */
function c5View(){
  const c=S.c5;
  if(c.step==='intro') return introCard(chap('c5'),'c5Setup');
  if(c.step==='result') return resultView('c5');
  if(c.step==='setup'&&H()){
    return `<div class="ye-block">
      <section class="ye-sec"><h3>창고에 놓을 물건</h3><p class="ye-hint">쉼표로 구분합니다. 실제로 가져갈 물건으로 고쳐 주세요.</p><textarea rows="3" data-c="c5Items" aria-label="물건 목록">${esc(c.items.join(', '))}</textarea></section>
      <section class="ye-sec"><h3>지시서 한 장의 품목 수</h3><div class="ye-seg">${[4,5,6,7].map(n=>`<button class="${c.n===n?'is-on':''}" data-a="c5N" data-n="${n}">${n}종</button>`).join('')}</div></section>
      ${c5Sheets()}
      <div class="ye-actions"><button class="ye-btn" data-a="c5Reissue">지시서 다시 뽑기</button><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c5Ready">이대로 출발 준비</button></div>
    </div>`;
  }
  const all=S.teams.every(t=>c.done[t.id]);
  return `<div class="ye-block">
    ${c5Sheets()}
    ${H()?`<div class="ye-actions">${c.start?(all?`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c5Result">결과 보기</button>`:`<button class="ye-btn ye-btn-ghost" data-a="c5Stop">출발 취소</button>`):`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c5Go">출발!</button>`}</div>`:''}
  </div>`;
}
function c5Sheets(){
  const c=S.c5;
  return `<div class="ye-orders">${S.teams.map(t=>{
    const o=c.orders[t.id]; if(!o) return '';
    const d=c.done[t.id], pen=c.pen[t.id]||0;
    return `<article class="ye-order ${d?'is-done':''}" style="--tc:${color(t)}">
      <header><b>${esc(t.name)}</b><span class="ye-stopw" data-stopwatch="${t.id}">${stopw(d?d+pen*15000:0)}</span></header>
      <div class="ye-sheet"><small>출고 지시서 No.${esc(o.no)}</small><ul>${o.list.map(x=>`<li><span>${esc(x.item)}</span><b>× ${x.q}</b></li>`).join('')}</ul><p>받는 분 <b>${esc(o.to)}</b></p><p>주소 <b>${esc(o.addr)}</b></p></div>
      ${H()&&c.step==='run'&&c.start?`<div class="ye-order-ctl">${d?`<span class="ye-pen"><button data-a="c5Pen" data-t="${t.id}" data-d="-1" aria-label="오피킹 빼기">−</button><span>오피킹 ${pen}건</span><button data-a="c5Pen" data-t="${t.id}" data-d="1" aria-label="오피킹 더하기">+</button></span><button class="ye-mini" data-a="c5Undo" data-t="${t.id}">완료 취소</button>`:`<button class="ye-btn ye-btn-primary" data-a="c5Done" data-t="${t.id}">출고 완료</button>`}</div>`:(pen?`<p class="ye-penlabel">오피킹 ${pen}건 · +${pen*15}초</p>`:'')}
    </article>`;
  }).join('')}</div>`;
}
function makeOrders(s){
  const c=s.c5, items=c.items.filter(Boolean), n=Math.min(c.n,items.length), pool=shuffle(items);
  const disjoint=items.length>=n*s.teams.length, qty=shuffle([1,1,2,2,3,1,2].slice(0,n));
  const names=shuffle(people().map(p=>p.name)), addr=shuffle(ADDRESSES), out={};
  s.teams.forEach((t,i)=>{
    const list=(disjoint?pool.slice(i*n,i*n+n):shuffle(items).slice(0,n)).map((item,j)=>({item,q:qty[j]}));
    out[t.id]={no:'2026-1231-'+String(i+1).padStart(3,'0'),to:names[i%names.length],addr:addr[i%addr.length],list};
  });
  c.orders=out;
}

/* ---------- 챕터 6 · 라이브커머스 배틀 ---------- */
function c6View(){
  const c=S.c6;
  if(c.step==='intro') return introCard(chap('c6'),'c6Draw');
  if(c.step==='result') return resultView('c6');
  if(c.step==='draw'||c.step==='prep'){
    return `<div class="ye-block">
      ${c.step==='prep'?`<div class="ye-prep-timer"><small>방송 준비</small><div class="ye-bigtimer" data-timer>${clock(leftMs())}</div></div>`:'<h3 class="ye-center">이 상품을 팔아야 합니다</h3>'}
      <div class="ye-livecards">${S.teams.map(t=>{ const a=c.assign[t.id]; return `<article class="ye-livecard" data-key="${esc(t.id+a.p+a.m)}" style="--tc:${color(t)}"><header>${esc(t.name)}</header><h4>${esc(a.p)}</h4><p>미션 · ${esc(a.m)}</p>${H()&&c.step==='draw'?`<button class="ye-mini" data-a="c6Re" data-t="${t.id}">다시 뽑기</button>`:''}</article>`; }).join('')}</div>
      ${H()?`<div class="ye-actions">${c.step==='draw'?'<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c6Prep">3분 준비 시작</button>':`${timerTools()}<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c6Live">방송 순서로</button>`}</div>`:''}
    </div>`;
  }
  const t=S.teams[c.i], a=c.assign[t.id];
  if(c.step==='live'&&!c.on){
    return `<div class="ye-c3" style="--tc:${color(t)}" data-key="s${c.i}"><small>곧 방송 시작 · ${c.i+1} / ${S.teams.length}</small><h3>${esc(t.name)}</h3><p>${esc(a.p)}</p>${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c6On">ON AIR</button></div>`:''}</div>`;
  }
  if(c.step==='live'){
    return `<div class="ye-live" style="--tc:${color(t)}">
      <div class="ye-live-top"><span class="ye-live-badge">LIVE</span><span class="ye-live-views">시청 <b data-views>${L.views.toLocaleString('ko-KR')}</b>명</span><span class="ye-live-team">${esc(t.name)}</span><div class="ye-bigtimer" data-timer>${clock(leftMs())}</div></div>
      <div class="ye-live-main">
        <div class="ye-live-product"><small>오늘의 단독 상품</small><h3>${esc(a.p)}</h3><p class="ye-live-mission">미션 · ${esc(a.m)}</p><div class="ye-live-price"><s>${won(a.price*3)}</s><b>${won(a.price)}</b></div><div class="ye-live-stock"><span>남은 수량</span><b data-stock>100</b><span>개</span></div></div>
        <div class="ye-live-feed" data-nomorph data-feed></div>
        <div class="ye-live-hearts" data-nomorph data-hearts></div>
      </div>
      ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-white" data-a="c6End">방송 종료</button></div>`:''}
    </div>`;
  }
  const m=c.marks[t.id]||[0,0], sum=(+m[0]||0)+(+m[1]||0), judges=S.setup.judges||[];
  return `<div class="ye-block ye-judge" style="--tc:${color(t)}" data-key="j${c.i}">
    <h3 class="ye-center">${esc(t.name)} 방송 심사</h3>
    ${[0,1].map(j=>`<div class="ye-jrow"><span>${esc(judges[j]||'심사 '+(j+1))}</span>${H()?`<div class="ye-jbtns">${[1,2,3,4,5,6,7,8,9,10].map(v=>`<button class="${+m[j]===v?'is-on':''}" data-a="c6Mark" data-t="${t.id}" data-j="${j}" data-v="${v}">${v}</button>`).join('')}</div>`:`<b class="ye-jscore">${m[j]||'-'}</b>`}</div>`).join('')}
    <div class="ye-jsum">${sum}점 → 방송 매출 <b>${fmt(sum*25)}</b></div>
    ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c6Next" ${m[0]&&m[1]?'':'disabled'}>${c.i+1<S.teams.length?'다음 팀 방송':'결과 보기'}</button></div>`:''}
  </div>`;
}
function liveAssign(usedP,usedM){ const prods=LIVE_PRODUCTS.filter(p=>!usedP.includes(p)), miss=LIVE_MISSIONS.filter(m=>!usedM.includes(m)); return {p:pick(prods.length?prods:LIVE_PRODUCTS),m:pick(miss.length?miss:LIVE_MISSIONS),price:pick(LIVE_PRICES)}; }
function liveTick(){
  const feed=root.querySelector('[data-feed]'); if(!feed||!S.timer) return;
  const now=Date.now(), running=S.timer.run&&leftMs()>0;
  const left=leftMs(), stock=root.querySelector('[data-stock]');
  if(stock) stock.textContent=Math.ceil(left/S.timer.dur*100);
  if(!running||now<L.feedAt) return;
  L.feedAt=now+500+Math.random()*900;
  L.views+=Math.floor(Math.random()*60)+6;
  const v=root.querySelector('[data-views]'); if(v) v.textContent=L.views.toLocaleString('ko-KR');
  const names=S.teams.reduce((a,t)=>a.concat(t.members),[]), n=pick(names);
  const row=document.createElement('p');
  if(Math.random()<.35){ row.className='is-event'; row.textContent=n+' 님이 '+pick(['구매했어요','장바구니에 담았어요','입장했어요','하트를 보냈어요']); }
  else { row.innerHTML='<b>'+esc(n)+'</b> '+esc(pick(LIVE_COMMENTS)); }
  feed.appendChild(row);
  while(feed.children.length>9) feed.removeChild(feed.firstChild);
  const hearts=root.querySelector('[data-hearts]');
  if(hearts){ const h=document.createElement('i'); h.textContent='♥'; h.style.left=(10+Math.random()*70)+'%'; h.style.color=pick(['#fff','#ffc94d','#ff8a7a','#b9a2ff']); hearts.appendChild(h); setTimeout(()=>h.remove(),2600); }
}

/* ---------- 챕터 7 · 최종 정산 ---------- */
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
    <h3 class="ye-center">광고비를 얼마나 태우시겠어요?</h3>
    <p class="ye-center ye-hint">맞히면 건 금액만큼 더 벌고, 틀리면 잃습니다.</p>
    <div class="ye-bets">${S.teams.map(t=>{ const max=Math.max(0,totalBeforeFinal(t.id)), b=+c.bets[t.id]||0; return `<article class="ye-bet" style="--tc:${color(t)}"><header>${esc(t.name)}</header><p>누적 매출 <b>${fmt(max)}</b></p>${H()?`<input type="number" inputmode="numeric" min="0" max="${max}" step="10" value="${b}" data-c="bet" data-t="${t.id}" aria-label="${esc(t.name)} 베팅 금액"><div class="ye-betbtns">${[0,25,50,100].map(p=>`<button class="ye-mini" data-a="c7Pct" data-t="${t.id}" data-p="${p}">${p===100?'올인':p+'%'}</button>`).join('')}</div>`:`<div class="ye-betval">베팅 중</div>`}</article>`; }).join('')}</div>
    ${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7Close">베팅 마감</button></div>`:''}
  </div>`;
}
function c7Q(){
  const c=S.c7, q=c.q, show=c.step==='reveal';
  return `<div class="ye-quiz">
    <div class="ye-quiz-top"><span class="ye-badge">최후의 문제</span><span class="ye-tag">${esc(q.tag||'')}</span></div>
    <h3 class="ye-q">${esc(q.q)}</h3>
    <div class="ye-opts">${q.opts.map((o,i)=>`<div class="ye-opt ${show?(i===q.a?'is-ans':'is-dim'):''}"><span>${i+1}</span><b>${esc(o)}</b></div>`).join('')}</div>
    ${show?`<div class="ye-betres">${S.teams.map(t=>{ const b=+c.bets[t.id]||0, r=c.right[t.id]; return `<div style="--tc:${color(t)}" class="${r===true?'is-win':r===false?'is-lose':''}"><span>${esc(t.name)}</span><small>베팅 ${fmt(b)}</small><b>${r===true?'+'+fmt(b):r===false?'−'+fmt(b).replace('−',''):'대기'}</b>${H()?`<em><button class="ye-mini" data-a="c7Right" data-t="${t.id}" data-v="1">적중</button><button class="ye-mini" data-a="c7Right" data-t="${t.id}" data-v="0">실패</button></em>`:''}</div>`; }).join('')}</div>`:''}
    ${H()?`<div class="ye-hostbar">${show?`<button class="ye-btn ye-btn-primary" data-a="c7Awards" ${S.teams.every(t=>c.right[t.id]!==undefined)?'':'disabled'}>오피스 어워즈로</button>`:`<span class="ye-hostlabel">진행자만 보임 · 정답 ${q.a+1}번</span>${timerTools()}<button class="ye-btn ye-btn-primary" data-a="c7Show">정답 공개</button>`}</div>`:''}
  </div>`;
}
function c7Awards(){
  const c=S.c7, list=awardsReady(), a=list[c.award];
  if(!a) return `<div class="ye-block">${stageWait('수상자를 입력해 두지 않았습니다')}${H()?`<div class="ye-actions"><button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7Rank">최종 순위로</button></div>`:''}</div>`;
  const shown=!!c.awardShown[c.award], t=teamOf(a.winner), last=c.award===list.length-1;
  return `<div class="ye-award" data-key="a${c.award}">
    <small>2026 오피스 어워즈 · ${c.award+1} / ${list.length}</small>
    <h3>${esc(a.title)}</h3>
    ${a.desc?`<p>${esc(a.desc)}</p>`:''}
    <div class="ye-award-name ${shown?'is-open':''}" data-key="${shown?'o':'c'}" ${t?`style="--tc:${color(t)}"`:''}>${shown?esc(a.winner):'두구두구두구'}</div>
    ${shown&&t?`<p class="ye-award-team">${esc(t.name)} 매출 +100만</p>`:''}
    ${H()?`<div class="ye-actions">${shown?`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="${last?'c7Rank':'c7AwardNext'}">${last?'최종 순위로':'다음 상'}</button>`:`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7AwardShow">수상자 공개</button>`}</div>`:''}
  </div>`;
}
function finalOrder(){ return S.teams.map(t=>({t,v:total(t.id)})).sort((a,b)=>a.v-b.v); }
function prizeOf(place,last){ const s=S.setup; if(place===1) return s.p1; if(place===2) return s.p2; if(place===3&&!last) return s.p3; if(last) return s.last; return ''; }
function c7Rank(){
  const c=S.c7, order=finalOrder(), n=order.length;
  return `<div class="ye-rank">
    <h3 class="ye-center">2026 최종 매출 순위</h3>
    <div class="ye-rank-list">${order.slice().reverse().map((r,i)=>{ const place=i+1, idxFromLast=n-1-i, open=c.rank>idxFromLast, prize=prizeOf(place,place===n&&n>1); return `<div class="ye-rank-row ${open?'is-open':''} ${place===1?'is-top':''}" data-key="${open?r.t.id:'x'+i}" ${open?`style="--tc:${color(r.t)}"`:''}><span class="ye-rank-no">${place}</span>${open?`<b>${esc(r.t.name)}</b><span class="ye-rank-mem">${esc(r.t.members.join(' · '))}</span>${prize?`<em>${esc(prize)}</em>`:''}<strong>${fmt(r.v)}</strong>`:'<b>? ? ?</b>'}</div>`; }).join('')}</div>
    ${H()?`<div class="ye-actions">${c.rank<n?`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7RankNext">${c.rank===n-1?'1등 공개':(n-c.rank)+'등 공개'}</button>`:`<button class="ye-btn ye-btn-primary ye-btn-lg" data-a="c7Credits">엔딩 크레딧</button>`}</div>`:''}
  </div>`;
}
function c7Credits(){
  const c=S.c7, order=finalOrder().reverse(), brands=B.brands().length, count=people().length;
  const stats=[['함께한 사람',count+'명'],['운영한 브랜드',brands+'개'],['함께 깬 챕터',CHAPTERS.length+'개']];
  if(c.diary) stats.push(['오피스에 남긴 업무 기록',c.diary.toLocaleString('ko-KR')+'건']);
  return `<div class="ye-credits">
    <div class="ye-credits-roll">
      <p class="ye-cr-title">2026 송년회</p>
      <p class="ye-cr-sub">비드유니버스의 2026년을 출고했습니다</p>
      ${order.map((r,i)=>`<section><h4>${i+1}위 · ${esc(r.t.name)}</h4><p>${esc(r.t.members.join('  ·  '))}</p></section>`).join('')}
      <section><h4>진행</h4><p>전승훈  ·  전수빈</p></section>
      <section><h4>우리가 함께 만든 2026</h4>${stats.map(s=>`<p>${esc(s[0])} <b>${esc(s[1])}</b></p>`).join('')}</section>
      ${S.setup.closing?`<section><h4>대표님 한마디</h4><p class="ye-cr-msg">${esc(S.setup.closing)}</p></section>`:''}
      <p class="ye-cr-end">2027년에 또 만나요</p>
    </div>
    ${H()?`<div class="ye-credits-ctl"><button class="ye-btn ye-btn-white" data-a="c7End">송년회 마치기</button></div>`:''}
  </div>`;
}

/* ---------- 진행 준비 ---------- */
function viewPrep(){
  const s=S.setup, names=people().map(p=>p.name), f=s.finalQ||{};
  const field=(label,path,val,ph)=>`<label class="ye-field"><span>${esc(label)}</span><input type="text" value="${esc(val||'')}" data-bind="${path}" placeholder="${esc(ph||'')}"></label>`;
  const totalMin=CHAPTERS.reduce((a,c)=>a+c.min,0);
  return `<div class="ye-prepwrap">
    <section class="ye-sec"><h3>챕터 구성 <span class="ye-sum">총 ${Math.floor(totalMin/60)}시간 ${totalMin%60}분</span></h3>
      <ol class="ye-prog">${CHAPTERS.map(c=>`<li><span>${c.icon}</span><b>${esc(c.title)}</b><em>${esc(c.sub)}</em><small>${c.min}분</small></li>`).join('')}</ol>
    </section>
    <section class="ye-sec"><h3>행사 정보</h3><div class="ye-form2">${field('날짜','setup.date',s.date,'예: 12월 19일 금요일')}${field('장소','setup.place',s.place,'예: 가평 펜션')}</div></section>
    <section class="ye-sec"><h3>상품과 벌칙</h3><div class="ye-form2">${field('1등','setup.p1',s.p1,'예: 상금 30만원')}${field('2등','setup.p2',s.p2)}${field('3등','setup.p3',s.p3)}${field('꼴등 미션','setup.last',s.last,'예: 2027년 시무식 사회')}</div></section>
    <section class="ye-sec"><h3>라이브커머스 심사위원</h3><div class="ye-form2">${field('심사 1','setup.judges.0',s.judges[0])}${field('심사 2','setup.judges.1',s.judges[1])}</div></section>
    <section class="ye-sec"><h3>오피스 어워즈</h3><p class="ye-hint">수상자를 고른 상만 시상식에 나옵니다. 수상자가 속한 팀은 매출 100만을 받습니다.</p>
      <div class="ye-awards">${s.awards.map((a,i)=>`<div class="ye-award-edit" data-key="aw${i}"><input type="text" value="${esc(a.title)}" data-bind="setup.awards.${i}.title" placeholder="상 이름" aria-label="상 이름"><input type="text" value="${esc(a.desc)}" data-bind="setup.awards.${i}.desc" placeholder="설명" aria-label="설명"><select data-bind="setup.awards.${i}.winner" aria-label="수상자"><option value="" ${a.winner?'':'selected'}>수상자 선택</option>${names.map(n=>`<option value="${esc(n)}" ${a.winner===n?'selected':''}>${esc(n)}</option>`).join('')}</select><button class="ye-mini" data-a="awDel" data-i="${i}" aria-label="이 상 삭제">삭제</button></div>`).join('')}</div>
      <button class="ye-mini" data-a="awAdd">상 추가</button>
    </section>
    <section class="ye-sec"><h3>최후의 문제</h3><p class="ye-hint">비워 두면 오피스 업무 기록 건수 문제가 자동으로 나옵니다.</p>
      <div class="ye-form">${field('문제','setup.finalQ.q',f.q)}<div class="ye-form2">${[1,2,3,4].map(n=>field(n+'번 보기','setup.finalQ.o'+n,f['o'+n])).join('')}</div>
      <label class="ye-field"><span>정답</span><select data-bind="setup.finalQ.a" data-num="1">${[0,1,2,3].map(n=>`<option value="${n}" ${(+f.a||0)===n?'selected':''}>${n+1}번</option>`).join('')}</select></label></div>
    </section>
    <section class="ye-sec"><h3>대표님 한마디 (엔딩 크레딧)</h3><textarea rows="3" data-bind="setup.closing" aria-label="대표님 한마디">${esc(s.closing)}</textarea></section>
    <section class="ye-sec"><h3>준비물 체크</h3>
      <ul class="ye-checks">${PROPS.map(p=>`<li><label><input type="checkbox" data-c="check" data-id="${p.id}" ${s.checks[p.id]?'checked':''}><span>${esc(p.label)}</span><small>${esc(p.ch)}</small></label></li>`).join('')}</ul>
    </section>
    <section class="ye-sec"><h3>미리 돌려 보기</h3><p class="ye-hint">리허설은 모든 챕터가 열리고, 무엇을 눌러도 저장되지 않습니다.</p>
      <div class="ye-actions ye-actions-left">${L.rehearsal?'<button class="ye-btn" data-a="rehearseEnd">리허설 끝내기</button>':'<button class="ye-btn ye-btn-primary" data-a="rehearse">리허설 시작</button>'}${L.rehearsal?'':'<button class="ye-btn ye-btn-danger" data-a="reset">진행 기록 전체 초기화</button>'}</div>
    </section>
  </div>`;
}

/* ---------- 지도 ---------- */
function isOpen(i){ return S.openAll||i===0||!!S.cleared[CHAPTERS[i-1].id]; }
function currentIdx(){ for(let i=0;i<CHAPTERS.length;i++) if(!S.cleared[CHAPTERS[i].id]) return i; return CHAPTERS.length-1; }
function node(c,i){
  const clear=!!S.cleared[c.id], open=isOpen(i), cur=!clear&&i===currentIdx();
  const cls=clear?'is-clear':cur?'is-current':open?'is-open':'is-locked';
  return `<button class="ye-node ${cls}" ${H()&&open?`data-a="open" data-id="${c.id}"`:'tabindex="-1"'}><span class="ye-node-dot">${clear?'✓':open?c.icon:'🔒'}</span><span class="ye-node-text"><small>CHAPTER ${c.no}</small><b>${esc(c.title)}</b><em>${clear?'CLEAR':esc(c.sub)}</em></span></button>`;
}
function viewMap(){
  const done=CHAPTERS.filter(c=>S.cleared[c.id]).length, s=S.setup, info=[s.date,s.place].filter(Boolean).join(' · ');
  const allDone=done===CHAPTERS.length;
  return `<section class="ye-hero">
    <div class="ye-snow"></div>
    <div class="ye-hero-top">
      <div><p class="ye-kicker">BEAD UNIVERSE${info?' · '+esc(info):''}</p><h2 class="ye-title">2026 송년회</h2><p class="ye-lead">${allDone?'2026년 출고 완료. 올 한 해 정말 고생 많으셨습니다.':'2026년의 마지막 주문이 들어왔습니다. 일곱 개 관문을 통과해 올해를 출고하세요.'}</p></div>
      <div class="ye-progress"><b>${done}</b><span>/ ${CHAPTERS.length}</span><small>CLEAR</small></div>
    </div>
    <div class="ye-route"><svg class="ye-route-svg" data-nomorph aria-hidden="true"></svg>${CHAPTERS.map(node).join('')}</div>
  </section>
  ${S.teams.length?'<h3 class="ye-boardtitle">누적 매출</h3>':''}
  ${standings(false)}`;
}
function drawRoute(){
  const wrap=root.querySelector('.ye-route'); if(!wrap) return;
  const box=wrap.getBoundingClientRect(); if(!box.width) return;
  const pts=$$('.ye-node-dot',wrap).map(d=>{ const r=d.getBoundingClientRect(); return {x:r.left+r.width/2-box.left,y:r.top+r.height/2-box.top}; });
  const svg=wrap.querySelector('.ye-route-svg'), ns='http://www.w3.org/2000/svg';
  svg.setAttribute('viewBox','0 0 '+box.width+' '+box.height); svg.setAttribute('width',box.width); svg.setAttribute('height',box.height);
  const horiz=pts[pts.length-1].x-pts[0].x>box.width*.5;
  const seg=(a,b)=>{ if(horiz){ const m=(a.x+b.x)/2; return ` C${m} ${a.y},${m} ${b.y},${b.x} ${b.y}`; } const m=(a.y+b.y)/2; return ` C${a.x} ${m},${b.x} ${m},${b.x} ${b.y}`; };
  let d='M'+pts[0].x+' '+pts[0].y; const ds=[d];
  for(let i=1;i<pts.length;i++){ d+=seg(pts[i-1],pts[i]); ds.push(d); }
  svg.innerHTML='';
  const mk=(c,dd)=>{ const p=document.createElementNS(ns,'path'); p.setAttribute('class',c); p.setAttribute('d',dd); svg.appendChild(p); return p; };
  const base=mk('ye-route-base',d), prog=mk('ye-route-prog',d);
  const lens=ds.map(x=>{ const t=mk('ye-route-tmp',x), l=x.indexOf('C')<0?0:t.getTotalLength(); t.remove(); return l; });
  const full=prog.getTotalLength();
  const parcel=document.createElementNS(ns,'text'); parcel.setAttribute('class','ye-parcel'); parcel.setAttribute('text-anchor','middle'); parcel.textContent='📦'; svg.appendChild(parcel);
  const dy=parseFloat(getComputedStyle(wrap).fontSize)*2.75;
  const place=len=>{ prog.setAttribute('stroke-dasharray',full+' '+full); prog.setAttribute('stroke-dashoffset',full-len); const pt=prog.getPointAtLength(len); parcel.setAttribute('x',pt.x); parcel.setAttribute('y',pt.y-dy); };
  void base;
  const target=currentIdx(), from=L.routeShown==null?target:L.routeShown;
  cancelAnimationFrame(L.routeAnim);
  L.routeShown=target;
  if(from===target){ place(lens[target]); return; }
  const a=lens[from], z=lens[target], start=performance.now(), dur=1500;
  place(a);
  (function step(now){ const k=Math.min(1,(now-start)/dur), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; place(a+(z-a)*e); if(k<1) L.routeAnim=requestAnimationFrame(step); })(start);
}

/* ---------- CLEAR 오버레이 ---------- */
function viewClear(){
  const id=S.clearing.id, c=chap(id), next=CHAPTERS[CHAPTERS.indexOf(c)+1];
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
  const c=chap(S.cur.id), body={c1:c1View,c2:c2View,c3:c3View,c4:c4View,c5:c5View,c6:c6View,c7:c7View}[c.id]();
  const step=S[c.id].step;
  const fullBleed=(c.id==='c7'&&step==='credits')||(c.id==='c6'&&step==='live'&&S.c6.on);
  const big=(c.id==='c3'&&step==='play')||(c.id==='c6'&&['prep','live'].includes(step));
  const noBoard=fullBleed||c.id==='c1'||c.id==='c7'||step==='intro';
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
        <button class="ye-tool ye-tool-primary" data-a="stage">대형화면</button>
      </div>
    </div>`;
    if(L.rehearsal) out+=`<div class="ye-rehearsal"><b>리허설 중</b> 여기서 누른 것은 저장되지 않습니다.<button class="ye-mini" data-a="rehearseEnd">끝내기</button></div>`;
  }else{
    out+=`<button class="ye-exit" data-a="host" aria-label="진행자 화면으로">진행자 화면</button>`;
  }
  if(H()&&L.panel==='prep') out+=viewPrep();
  else if(S.cur.view==='ch'&&chap(S.cur.id)) out+=viewChapter();
  else out+=viewMap();
  if(S.clearing&&!(H()&&L.panel==='prep')) out+=viewClear();
  return out;
}

/* 변경분만 고치는 렌더 — 입력 포커스·애니메이션을 보존한다 */
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
const A={
  home(){ B.goHome(); },
  prep(){ L.panel=L.panel==='prep'?null:'prep'; render(); },
  sound(){ L.sound=!L.sound; saveUi(); render(); },
  stage(){ L.mode='stage'; L.panel=null; saveUi(); render(); try{ const d=document.documentElement; if(d.requestFullscreen) d.requestFullscreen().catch(()=>{}); }catch(e){} },
  host(){ L.mode='host'; saveUi(); render(); try{ if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); }catch(e){} },
  open(el){ L.panel=null; commit(s=>{ s.cur={view:'ch',id:el.dataset.id}; }); },
  toMap(){ stopAuto(); commit(s=>{ s.cur={view:'map'}; s.timer=null; }); },
  adj(el){ const {ch,t}=el.dataset, d=+el.dataset.d; commit(s=>{ s.adj[ch]=s.adj[ch]||{}; s.adj[ch][t]=(s.adj[ch][t]||0)+d; }); },
  clear(el){ commit(s=>nextCh(s,el.dataset.id)); },
  closeClear(){ commit(s=>{ s.clearing=null; s.cur={view:'map'}; }); },
  skip(el){ if(!confirm('이 챕터를 점수 없이 건너뛸까요?')) return; commit(s=>{ s.cleared[el.dataset.id]=true; s.cur={view:'map'}; s.timer=null; }); },
  restart(el){
    const id=el.dataset.id;
    if(id==='c1'&&CHAPTERS.some(c=>c.id!=='c1'&&S.cleared[c.id])){ B.toast('이미 다음 챕터를 진행해서 팀을 바꿀 수 없어요','err'); return; }
    if(!confirm('이 챕터의 진행 내용과 점수를 지우고 처음부터 할까요?')) return;
    stopAuto();
    commit(s=>{ s[id]=freshState()[id]; if(id==='c1') s.teams=[]; delete s.cleared[id]; delete s.adj[id]; s.timer=null; });
  },
  tToggle(){ commit(s=>{ const t=s.timer; if(!t) return; if(t.run){ t.left=Math.max(0,t.ends-Date.now()); t.run=false; } else { t.ends=Date.now()+t.left; t.run=true; } }); },
  tAdd(el){ commit(s=>{ const t=s.timer; if(!t) return; const ms=+el.dataset.ms; if(t.run){ t.ends=Math.max(t.ends,Date.now())+ms; } else t.left+=ms; t.dur+=ms; }); },
  /* c1 */
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
  c1Dice(el){ const used=S.teams.map(t=>t.name); const pool=TEAM_NAMES.filter(n=>!used.includes(n)); commit(s=>{ teamById(el.dataset.t).name=pick(pool); }); },
  c1Done(){ commit(s=>{ s.teams.forEach((t,i)=>{ t.name=String(t.name||'').trim()||TEAM_NAMES[i]; }); nextCh(s,'c1'); }); },
  /* c2 */
  c2Build(){ commit(s=>{ s.c2.step='build'; if(!s.c2.qs.length) s.c2.qs=genQuestions(); }); },
  c2Regen(){ commit(s=>{ s.c2.qs=genQuestions(); }); },
  c2Swap(el){ const i=+el.dataset.i; commit(s=>{ const used=new Set(s.c2.qs.map(q=>q.k)); const free=shuffle(Object.keys(QGEN).filter(k=>!used.has(k))).concat(shuffle(Object.keys(QGEN))); for(const k of free){ const q=genOne(k); if(q&&q.q!==s.c2.qs[i].q){ s.c2.qs[i]=q; return; } } }); },
  c2Del(el){ commit(s=>{ s.c2.qs.splice(+el.dataset.i,1); }); },
  c2Add(){
    const f=document.getElementById('yeAddQ'), v=n=>(f.querySelector('[name="'+n+'"]').value||'').trim();
    if(!v('q')||!v('o1')||!v('o2')||!v('o3')||!v('o4')){ B.toast('문제와 보기 4개를 모두 적어 주세요','err'); return; }
    const q={q:v('q'),opts:[v('o1'),v('o2'),v('o3'),v('o4')],a:+v('a'),tag:'대표 출제',k:'custom'};
    f.querySelectorAll('input').forEach(x=>{ x.value=''; });
    commit(s=>{ s.c2.qs.push(q); });
  },
  c2Start(){ commit(s=>{ const c=s.c2; c.step='play'; c.i=0; c.show=false; c.right={}; timerSet(s,15000); }); },
  c2Show(){ commit(s=>{ s.c2.show=true; s.timer=null; setFx(s,'reveal'); }); },
  c2Right(el){ const t=el.dataset.t; commit(s=>{ const c=s.c2; const r=c.right[c.i]=c.right[c.i]||{}; r[t]=!r[t]; setFx(s,r[t]?'ding':'pass'); }); },
  c2Next(){ commit(s=>{ const c=s.c2; if(c.i+1<c.qs.length){ c.i++; c.show=false; timerSet(s,15000); } else { c.step='result'; s.timer=null; } }); },
  /* c3 */
  c3Start(){ commit(s=>{ const c=s.c3, order=[]; s.teams.forEach(t=>t.members.forEach(m=>order.push({t:t.id,m}))); c.order=order; c.words=shuffle(WORDS); c.w=0; c.o=0; c.got={}; c.step='ready'; s.timer=null; }); },
  c3Go(){ commit(s=>{ const c=s.c3; c.step='play'; timerSet(s,c3Secs(c.order[c.o].t)*1000); setFx(s,'onair'); }); },
  c3Hit(){ commit(s=>{ const c=s.c3, t=c.order[c.o].t; c.got[t]=(c.got[t]||0)+1; c.w++; setFx(s,'ding'); }); },
  c3Pass(){ commit(s=>{ s.c3.w++; setFx(s,'pass'); }); },
  c3Undo(){ commit(s=>{ const c=s.c3, t=c.order[c.o].t; if(c.got[t]>0) c.got[t]--; }); },
  c3Next(){ commit(s=>{ const c=s.c3; s.timer=null; if(c.o+1<c.order.length){ c.o++; c.step='ready'; c.w++; } else c.step='result'; }); },
  /* c4 */
  c4Start(){ commit(s=>{ const c=s.c4, by={}; PRODUCTS.forEach((p,i)=>(by[p.b]=by[p.b]||[]).push(i)); c.list=shuffle(Object.values(by).map(a=>pick(a))); c.i=0; c.guess={}; c.show={}; c.step='play'; timerSet(s,30000); }); },
  c4Swap(){ commit(s=>{ const c=s.c4, cur=PRODUCTS[c.list[c.i]], pool=PRODUCTS.map((p,i)=>i).filter(i=>PRODUCTS[i].b===cur.b&&!c.list.includes(i)); if(pool.length){ c.list[c.i]=pick(pool); c.guess[c.i]={}; timerSet(s,30000); } else B.toast('같은 브랜드에 남은 상품이 없어요','err'); }); },
  c4Show(){ commit(s=>{ s.c4.show[s.c4.i]=true; s.timer=null; setFx(s,'reveal'); }); },
  c4Next(){ commit(s=>{ const c=s.c4; if(c.i+1<c.list.length){ c.i++; timerSet(s,30000); } else { c.step='result'; s.timer=null; } }); },
  /* c5 */
  c5Setup(){ commit(s=>{ s.c5.step='setup'; makeOrders(s); }); },
  c5N(el){ commit(s=>{ s.c5.n=+el.dataset.n; makeOrders(s); }); },
  c5Reissue(){ commit(s=>{ makeOrders(s); setFx(s,'shuffle'); }); },
  c5Ready(){ commit(s=>{ const c=s.c5; c.step='run'; c.start=0; c.done={}; c.pen={}; }); },
  c5Go(){ commit(s=>{ s.c5.start=Date.now(); setFx(s,'onair'); }); },
  c5Stop(){ if(!confirm('기록을 지우고 출발 전으로 돌아갈까요?')) return; commit(s=>{ s.c5.start=0; s.c5.done={}; s.c5.pen={}; }); },
  c5Done(el){ const t=el.dataset.t; commit(s=>{ const c=s.c5; c.done[t]=Date.now()-c.start; setFx(s,'ding'); }); },
  c5Undo(el){ commit(s=>{ delete s.c5.done[el.dataset.t]; }); },
  c5Pen(el){ const t=el.dataset.t, d=+el.dataset.d; commit(s=>{ const c=s.c5; c.pen[t]=Math.max(0,(c.pen[t]||0)+d); }); },
  c5Result(){ commit(s=>{ s.c5.step='result'; }); },
  /* c6 */
  c6Draw(){ commit(s=>{ const c=s.c6, up=[], um=[]; c.assign={}; s.teams.forEach(t=>{ const a=liveAssign(up,um); up.push(a.p); um.push(a.m); c.assign[t.id]=a; }); c.marks={}; c.i=0; c.on=false; c.step='draw'; setFx(s,'shuffle'); }); },
  c6Re(el){ const id=el.dataset.t; commit(s=>{ const c=s.c6, all=Object.values(c.assign); c.assign[id]=liveAssign(all.map(a=>a.p),all.map(a=>a.m)); setFx(s,'flip'); }); },
  c6Prep(){ commit(s=>{ s.c6.step='prep'; timerSet(s,180000); }); },
  c6Live(){ commit(s=>{ const c=s.c6; c.step='live'; c.i=0; c.on=false; s.timer=null; }); },
  c6On(){ L.views=120+Math.floor(Math.random()*200); commit(s=>{ s.c6.on=true; timerSet(s,60000); setFx(s,'onair'); }); },
  c6End(){ commit(s=>{ const c=s.c6; c.on=false; c.step='judge'; s.timer=null; setFx(s,'buzz'); }); },
  c6Mark(el){ const {t}=el.dataset, j=+el.dataset.j, v=+el.dataset.v; commit(s=>{ const m=s.c6.marks[t]=s.c6.marks[t]||[0,0]; m[j]=v; }); },
  c6Next(){ commit(s=>{ const c=s.c6; if(c.i+1<s.teams.length){ c.i++; c.step='live'; c.on=false; } else c.step='result'; }); },
  /* c7 */
  c7Bet(){ commit(s=>{ const c=s.c7; c.step='bet'; c.bets={}; c.right={}; c.award=0; c.awardShown={}; c.rank=0; }); },
  c7Pct(el){ const t=el.dataset.t, p=+el.dataset.p; commit(s=>{ const max=Math.max(0,totalBeforeFinal(t)); s.c7.bets[t]=Math.floor(max*p/100/10)*10; }); },
  async c7Close(){
    const q=await finalQuestion();
    commit(s=>{ const c=s.c7; c.q=q; if(q.diary) c.diary=q.diary; c.step='q'; timerSet(s,30000); setFx(s,'drum'); });
    if(!S.c7.diary){ B.diaryTotal().then(n=>{ if(n>0) commit(s=>{ s.c7.diary=n; }); }).catch(()=>{}); }
  },
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
  awAdd(){ commit(s=>{ s.setup.awards.push({title:'',desc:'',winner:''}); }); },
  awDel(el){ commit(s=>{ s.setup.awards.splice(+el.dataset.i,1); }); },
  rehearse(){
    L.real=S;
    const s=freshState(), part=people().filter(p=>!p.ceo), ids=TEAM_IDS.slice(0,3);
    s.setup=clone(S.setup); s.openAll=true;
    S=s; ensureCaptains(S);
    const caps=S.c1.captains, plan=makePlan(part,ids,caps,true);
    S.teams=ids.map((id,i)=>({id,name:TEAM_NAMES[i],color:i,captain:caps[id],members:[caps[id]].concat(Object.keys(plan).filter(n=>plan[n]===id))}));
    L.rehearsal=true; L.panel=null; L.routeShown=null;
    render();
    B.toast('리허설을 시작합니다. 저장되지 않아요','ok');
  },
  rehearseEnd(){ stopAuto(); S=L.real||S; L.real=null; L.rehearsal=false; L.panel=null; L.routeShown=null; render(); },
  reset(){
    if(!confirm('팀 편성 · 점수 · 진행 상황을 모두 지웁니다. 진행 준비에 적은 내용은 남습니다. 계속할까요?')) return;
    stopAuto();
    commit(s=>{ const keep=clone(s.setup), f=freshState(), rev=s.rev, fx=s.fx; Object.keys(s).forEach(k=>delete s[k]); Object.assign(s,f,{setup:keep,rev,fx}); });
    L.routeShown=null; render();
  },
};
const C={
  captain(el){ commit(s=>{ s.c1.captains[el.dataset.t]=el.value; }); },
  mix(el){ commit(s=>{ s.c1.mix=el.checked; }); },
  teamName(el){ const v=el.value.trim().slice(0,12); commit(s=>{ teamById(el.dataset.t).name=v||teamById(el.dataset.t).name; }); },
  guess(el){ const v=Math.max(0,Math.round(+el.value||0)); commit(s=>{ const c=s.c4; c.guess[c.i]=c.guess[c.i]||{}; c.guess[c.i][el.dataset.t]=v; }); },
  c5Items(el){ const list=el.value.split(/[,\n]/).map(x=>x.trim()).filter(Boolean); commit(s=>{ s.c5.items=list; makeOrders(s); }); },
  bet(el){ const t=el.dataset.t, max=Math.max(0,totalBeforeFinal(t)), v=Math.min(max,Math.max(0,Math.round(+el.value||0))); el.value=v; commit(s=>{ s.c7.bets[t]=v; }); },
  check(el){ const id=el.dataset.id, on=el.checked; commit(s=>{ s.setup.checks[id]=on; }); },
};
function bindPath(path,val){
  commit(s=>{ const keys=path.split('.'); let o=s; for(let i=0;i<keys.length-1;i++) o=o[keys[i]]; o[keys[keys.length-1]]=val; });
}

/* ---------- 시계 · 동기화 ---------- */
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
  const c=S.c5;
  if(S.cur.view==='ch'&&S.cur.id==='c5'&&c.step==='run'){
    S.teams.forEach(t=>{ const el=root.querySelector('[data-stopwatch="'+t.id+'"]'); if(!el) return; const d=c.done[t.id]; const v=d?d+(c.pen[t.id]||0)*15000:(c.start?Date.now()-c.start:0); const s=stopw(v); if(el.textContent!==s) el.textContent=s; });
  }
  if(S.cur.view==='ch'&&S.cur.id==='c6'&&S.c6.step==='live'&&S.c6.on) liveTick();
}
function poll(){
  if(viewHidden()) return;
  const pj=JSON.stringify(people());
  if(pj!==L.peopleJson){ const had=L.peopleJson; L.peopleJson=pj; if(had) render(); }
  if(document.hidden||L.rehearsal) return;
  B.kvPull(KV_KEY,LS_KEY,onKv);
}
function bind(){
  if(L.bound) return; L.bound=true;
  root.addEventListener('click',e=>{ const el=e.target.closest('[data-a]'); if(!el||!root.contains(el)||el.disabled) return; Snd.unlock(); const f=A[el.dataset.a]; if(f) f(el,e); });
  root.addEventListener('change',e=>{ const el=e.target; if(el.dataset.bind){ bindPath(el.dataset.bind,el.dataset.num?+el.value:el.value); } else if(el.dataset.c&&C[el.dataset.c]){ C[el.dataset.c](el); } });
  document.addEventListener('pointerdown',()=>Snd.unlock(),{passive:true});
  window.addEventListener('resize',()=>{ if(!viewHidden()&&root.querySelector('.ye-route')) drawRoute(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!viewHidden()&&L.mode==='stage'&&!document.fullscreenElement) A.host(); });
  setInterval(tick,200);
  setInterval(poll,2000);
}
function preload(){ PRODUCTS.forEach(p=>{ const i=new Image(); i.referrerPolicy='no-referrer'; i.src=p.img; }); }

window.YearEnd={
  open(){
    root=document.getElementById('yeRoot');
    if(!root) return;
    bind();
    L.routeShown=null;
    render();
    B.kvPull(KV_KEY,LS_KEY,onKv);
    rtInit();
    Promise.resolve().then(B.refreshOrg).catch(()=>{});
    setTimeout(()=>{ if(!viewHidden()) render(); },1500);
    if(!window.__yePreloaded){ window.__yePreloaded=1; preload(); }
  },
};
})();
