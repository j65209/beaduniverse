/* 데이터분석관 — 어느 화면에서든 오른쪽 아래 떠 있는 단추를 눌러 말로 물어보는 분석 대화 (2026-11-23).
   사장님 "오피스앱에서 공홈 판매량 몇일부터 몇일까지 분석해줘. 클릭률 분석해줘. 이런 대화" → "데이터분석관을 그럼 플로팅배너에 넣어줄 수 있어?"

   · 숫자는 전부 이 화면이 기록에서 계산한다 (AI 가 짐작하지 않는다). 새 수집기 없음, 읽기만.
       매출 · 주문 · 광고비 = 비공개 brightbeed-reports {채널}/{브랜드}/sales-index.json (직원용 사본 — 원가 · 순이익 없음. index.json 으로 바꾸지 말 것)
       공홈 상품 · 옵션 수량 = home/{브랜드}/products.json (판매 순위 패널과 같은 모델)
       노출 · 클릭 = 광고 시트 office/ad-sheets/{브랜드}.json (메타 07 · 13시, 어제까지)
   · 질문 뜻은 먼저 아래 규칙(parse)이 풀고, 못 알아들은 말만 맥미니 /analyst/plan (구글 AI) 이 '무엇을 · 언제 · 어느 브랜드' 로 풀어 준다.
     거기로 가는 것은 질문 글뿐 — 매출 · 광고 숫자는 보내지 않는다 (무료 등급은 학습에 쓰일 수 있음).
   · 자료 통로는 index.html 의 window.AnalystData. 대화는 저장하지 않고 새로고침하면 비워진다. */
(function (root) {
  'use strict';

  /* ───────── 날짜 (한국 시간 'YYYY-MM-DD' 글자) ───────── */
  var DAY = 86400e3;
  function todayK() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  function add(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
  function span(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY) + 1; }
  function wdN(d) { return new Date(d + 'T00:00:00Z').getUTCDay(); }
  function wd(d) { return '일월화수목금토'[wdN(d)]; }
  function pad(n) { return ('0' + n).slice(-2); }
  function mk(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function monthEnd(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return add(mk(y, m, 1), -1); }
  function valid(y, m, d) { if (m < 1 || m > 12 || d < 1 || d > 31) return false; return mk(y, m, d) <= monthEnd(mk(y, m, 1)); }
  function md(d) { return (+d.slice(5, 7)) + '/' + (+d.slice(8)); }
  function mdw(d) { return md(d) + '(' + wd(d) + ')'; }
  function dates(a, b) { var o = []; for (var d = a; d <= b && o.length < 800; d = add(d, 1)) o.push(d); return o; }
  function rangeTxt(a, b) { return a === b ? mdw(a) : mdw(a) + '~' + mdw(b); }

  // 비교 기간 — 1일에 시작해 같은 달 안이면 전월 같은 날짜, 아니면 바로 앞 같은 길이 (브랜드 리포트와 같은 규칙)
  function prevRange(a, b) {
    var n = span(a, b);
    if (a.slice(8) === '01' && a.slice(0, 7) === b.slice(0, 7) && n >= 5) {
      var pe = add(a, -1), ps = pe.slice(0, 8) + '01';
      if (b === monthEnd(a)) return { from: ps, to: pe, label: (+ps.slice(5, 7)) + '월' };
      var e = add(ps, n - 1); if (e > pe) e = pe;
      return { from: ps, to: e, label: '전월 같은 날짜' };
    }
    return { from: add(a, -n), to: add(a, -1), label: n === 1 ? '전날' : n === 7 && wdN(a) === 1 ? '그 전주' : '앞 ' + n + '일' };
  }

  /* ───────── 질문 풀기 (규칙) ───────── */
  var BR = [
    ['6a', /식스\s*에이|식스\s*a(?![a-z])|(?:^|[^0-9a-z])6\s*a(?![a-z])|sixa/ig],
    ['yar', /야르|(?:^|[^a-z])yar(?![a-z])/ig],
    ['kop', /코페리|코패리|coferry|(?:^|[^a-z])kop(?![a-z])/ig],
    ['apt', /아페티|어페티|apeti|(?:^|[^a-z])apt(?![a-z])/ig],
    ['koz', /코즈미|cosme|(?:^|[^a-z])koz(?![a-z])/ig],
    ['akoi', /아코이\s*하우스|아코이|akoi(?:haus)?/ig],
    ['pp', /프로덕트\s*피알|프로덕트|프피|produkt\s*pr|(?:^|[^a-z])pp(?![a-z])/ig]
  ];
  var ALL_RE = /전체\s*브랜드|모든\s*브랜드|전\s*브랜드|브랜드\s*(?:별(?:로)?|마다|전부|모두|다)|회사\s*전체|전부\s*다|전체/g;
  var CH = [
    ['ably', /에이블리|ably/ig], ['zigzag', /지그재그|zigzag/ig], ['smartstore', /스마트\s*스토어|스스토어|네이버\s*스토어/g],
    ['29cm', /29\s*cm|이십구/ig], ['wconcept', /w\s*컨셉|더블유\s*컨셉|w\s*concept/ig], ['ohou', /오늘의\s*집/g], ['eql', /eql/ig]
  ];
  var HOME_RE = /공홈|자사몰|공식\s*홈(?:페이지)?|식스샵(?:\s*프로)?/g;
  var WHAT = [
    ['why', /왜|이유|원인|때문|무엇\s*때문|뭐\s*때문|어째서|분해/g],
    ['weekday', /요일(?:별(?:로)?)?/g],
    ['options', /옵션(?:별(?:로)?)?|색상(?:별(?:로)?)?|컬러(?:별(?:로)?)?|사이즈(?:별(?:로)?)?|색깔|무슨\s*색/g],
    ['daily', /일별(?:로)?|날짜\s*별(?:로)?|하루\s*하루|매일|추이|추세|흐름|그래프(?:로)?|차트(?:로)?|일자별(?:로)?/g],
    ['channels', /채널(?:별(?:로)?)?|판매처(?:별(?:로)?)?|플랫폼(?:별(?:로)?)?|몰별(?:로)?/g],
    ['products', /상품(?:별(?:로)?)?|제품(?:별(?:로)?)?|품목(?:별(?:로)?)?|아이템|베스트(?:셀러)?|탑\s*\d+|top\s*\d+|순위|잘\s*(?:팔|나가|나간)[가-힣]*|많이\s*(?:팔|나가|나간)[가-힣]*|인기(?:\s*상품)?|안\s*팔[가-힣]*|덜\s*팔[가-힣]*|뜨는|뜬|급상승|식는|식은/ig],
    ['ads', /클릭\s*률|클릭\s*율|ctr|노출(?:수)?|클릭(?:수)?|cpc|cpm|광고비|광고(?:\s*(?:성과|효율))?|roas|로아스|전환율?/ig],
    ['sales', /판매\s*량|판매\s*수량|판매(?:액)?|매출(?:액)?|주문(?:\s*(?:수|건수))?|객단가|몇\s*개|팔렸[가-힣]*|팔린|팔았[가-힣]*|얼마(?:나)?|수량/g],
    ['overview', /종합|전반|요약|분석|리포트|보고|성과|실적|현황|상황|어때[가-힣]*|어땠[가-힣]*|어떠[가-힣]*|어떻[가-힣]*/g]
  ];
  var ORDER = [
    ['worst', /안\s*팔[가-힣]*|덜\s*팔[가-힣]*|못\s*팔[가-힣]*|하위|꼴찌/],
    ['down', /식는|식은|줄어든|줄은|떨어진\s*(?:상품|제품)|빠진\s*(?:상품|제품)|감소한?\s*(?:상품|제품)?/],
    ['up', /뜨는|뜬|급상승|늘어난|오른\s*(?:상품|제품)|증가한?\s*(?:상품|제품)?/],
    ['best', /잘\s*(?:팔|나가|나간)|많이\s*(?:팔|나가|나간)|베스트|인기|상위|탑|top|순위/i]
  ];
  // 뜻이 없는 말 — 남은 글에서 지운다. 여기서도 남으면 AI 에게 물어본다
  var FILL = /(?:그럼|그러면|그리고|그러니까|그거|이거|저거|그건|이건|그것|혹시|일단|우선|한번|한 번|다시|좀|조금|잠깐|제발|그냥|쫌|음|아니|네|응|어|자|오케이|ok|ㅋ+|ㅎ+|몇\s*일|며칠|기간(?:을|에|동안)?|동안|데이터(?:를)?|자료(?:를)?|숫자(?:를)?|결과(?:를)?|수치(?:를)?|비율(?:을)?|나눠서?|따로|같이|함께|각각|모두|다|것|거|게|걸|건|수|중에서?|중|때|쯤|정도|대비|비교(?:해서|해|하면|하여|한)?|차이(?:를)?|변화(?:를)?|보다|하고|또는|및|랑|이랑|와|과|알려\s*(?:줘|주세요|줄래|주라|달라)?|보여\s*(?:줘|주세요|줄래|주라|달라)?|말해\s*(?:줘|주세요)?|뽑아\s*(?:줘|주세요)?|찾아\s*(?:줘|주세요)?|정리(?:해|해서)?|확인(?:해|해서)?|계산(?:해)?|궁금(?:해|해요|합니다)?|해\s*(?:줘(?:요|봐)?|주세요|줄래|줄\s*수\s*있어|봐(?:요|줘)?|보자|달라)|줘(?:요)?|주세요|해|봐|볼래|볼까|보고\s*싶어|싶어|있어(?:요)?|없어(?:요)?|되나(?:요)?|돼(?:요)?|됐어|했어(?:요)?|했나(?:요)?|했지|하나(?:요)?|인가(?:요)?|이야|야|요|지|니|나|까|까지|부터|에서|에는|에|의|은|는|이|가|을|를|도|만|로|으로|씩|든|든지|별로|별|올랐[가-힣]*|오른|올라[가-힣]*|떨어졌[가-힣]*|떨어진|떨어져[가-힣]*|내려[가-힣]*|내린|늘었[가-힣]*|늘어[가-힣]*|줄었[가-힣]*|줄어[가-힣]*|빠졌[가-힣]*|빠진|많이|적게|제일|가장|잘|높은|낮은|좋은|나쁜|곳|브랜드(?:는|가|를|의)?|뭐(?:가|야|지|예요)?|무엇|무슨|어떤|어느|어디|누가|언제|얼마|몇|개|건|원|만원|순|순서|순으로|위|것들|들|요즘|최근|지금|현재|오늘도|이번엔|이번에는?|에도)/g;

  function atom(y, m, d, today) {
    var yy = y || +today.slice(0, 4);
    if (!valid(yy, m, d)) return null;
    var s = mk(yy, m, d);
    if (!y && s > today && valid(yy - 1, m, d)) s = mk(yy - 1, m, d);   // 연도를 안 말했고 아직 안 온 날이면 작년
    return s;
  }
  var WORD_DAY = { '오늘': 0, '어제': -1, '어저께': -1, '그제': -2, '그저께': -2, '엊그제': -2, '지금': 0 };
  var A_FULL = '(?:(\\d{4})\\s*[-./년]\\s*)?(\\d{1,2})\\s*[-./월]\\s*(\\d{1,2})\\s*일?';
  var A_WORD = '(오늘|어제|어저께|그제|그저께|엊그제|지금)';
  var SEP = '\\s*(?:부터|에서|~|∼|～|–|—|-|→)\\s*';

  /* 글 속 기간을 나온 순서대로 — [{from,to,label,i,len}] */
  function findRanges(text, today) {
    var found = [], t = text, used = [];
    function take(re, fn) {
      var m; re.lastIndex = 0;
      while ((m = re.exec(t))) {
        var i = m.index, n = m[0].length;
        if (!n) { re.lastIndex++; continue; }
        if (used.some(function (u) { return i < u[1] && i + n > u[0]; })) continue;
        var r = fn(m);
        if (r) { used.push([i, i + n]); found.push({ from: r[0], to: r[1], label: r[2] || '', i: i, len: n }); }
      }
    }
    var y0 = +today.slice(0, 4), m0 = +today.slice(5, 7);
    function ord(a, b, lab) { if (!a || !b) return null; return a <= b ? [a, b, lab] : [b, a, lab]; }
    function mon(y, m) { var yy = y || (m > m0 ? y0 - 1 : y0); if (m < 1 || m > 12) return null; return mk(yy, m, 1); }

    // 11월 1일 ~ 11월 15일 · 11/1-11/15 · 11월 1일부터 15일까지 · 11/20 ~ 어제
    take(new RegExp(A_FULL + SEP + A_FULL + '(?:\\s*까지)?', 'g'), function (m) {
      var b = atom(+m[4] || +m[1] || 0, +m[5], +m[6], today), a = atom(+m[1] || +m[4] || 0, +m[2], +m[3], today);
      if (a && b && a > b && !m[1]) a = atom(+a.slice(0, 4) - 1, +m[2], +m[3], today);
      return ord(a, b);
    });
    take(new RegExp(A_FULL + SEP + '(\\d{1,2})\\s*일(?:\\s*까지)?', 'g'), function (m) {
      var a = atom(+m[1] || 0, +m[2], +m[3], today); return a && ord(a, atom(+a.slice(0, 4), +a.slice(5, 7), +m[4], today));
    });
    take(new RegExp(A_FULL + SEP + A_WORD + '(?:\\s*까지)?', 'g'), function (m) {
      return ord(atom(+m[1] || 0, +m[2], +m[3], today), add(today, WORD_DAY[m[4]]));
    });
    take(new RegExp('(\\d{1,2})\\s*월\\s*(\\d{1,2})' + SEP + '(\\d{1,2})(?!\\s*[\\d월/.])', 'g'), function (m) {
      var a = atom(0, +m[1], +m[2], today); return a && ord(a, atom(+a.slice(0, 4), +m[1], +m[3], today));
    });
    // 9월부터 11월까지 · 9~10월
    take(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월?\s*(?:부터|~|∼|～|–|-)\s*(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월(?!\s*\d)(?:\s*까지)?/g, function (m) {
      var b = mon(+m[3] || 0, +m[4]), a = mon(+m[1] || 0, +m[2]); if (!a || !b) return null;
      if (a > b && !m[1]) a = mon(+b.slice(0, 4) - 1, +m[2]);
      return ord(a, monthEnd(b));
    });
    take(/(\d{1,2})\s*월\s*부터\s*(오늘|어제|지금)(?:\s*까지)?/g, function (m) { var a = mon(0, +m[1]); return a && ord(a, add(today, WORD_DAY[m[2]])); });
    // 1일부터 15일까지 (이번 달 · '지난달 1일부터 10일까지')
    take(/(?:(지난|저번|이번)\s*달\s*)?(\d{1,2})\s*일?\s*(?:부터|~|∼|～|–)\s*(\d{1,2})\s*일(?:\s*까지)?/g, function (m) {
      var base = m[1] && m[1] !== '이번' ? add(today.slice(0, 8) + '01', -1).slice(0, 8) : today.slice(0, 8);
      var y = +base.slice(0, 4), mo = +base.slice(5, 7);
      if (!valid(y, mo, +m[2]) || !valid(y, mo, +m[3])) return null;
      if (!m[1] && mk(y, mo, +m[2]) > today) { base = add(today.slice(0, 8) + '01', -1).slice(0, 8); y = +base.slice(0, 4); mo = +base.slice(5, 7); if (!valid(y, mo, +m[2]) || !valid(y, mo, +m[3])) return null; }
      return ord(mk(y, mo, +m[2]), mk(y, mo, +m[3]));
    });
    // 11월 첫째 주 (1~7 · 8~14 …)
    take(/(?:(\d{1,2})\s*월|(이번|지난|저번)\s*달)\s*(첫|둘|셋|넷|다섯|마지막|\d)\s*(?:째|번째|번)?\s*주(?:차)?/g, function (m) {
      var ms = m[1] ? mon(0, +m[1]) : (m[2] === '이번' ? today.slice(0, 8) + '01' : add(today.slice(0, 8) + '01', -1).slice(0, 8) + '01');
      if (!ms) return null;
      var me = monthEnd(ms), k = { '첫': 1, '둘': 2, '셋': 3, '넷': 4, '다섯': 5 }[m[3]] || +m[3];
      if (m[3] === '마지막') return [add(me, -6), me];
      var a = add(ms, (k - 1) * 7), b = add(a, 6); if (a > me) return null; if (b > me) b = me;
      return [a, b];
    });
    take(/(\d{1,2})\s*월\s*(초순?|중순|말)/g, function (m) {
      var ms = mon(0, +m[1]); if (!ms) return null;
      return m[2] === '중순' ? [add(ms, 10), add(ms, 19)] : m[2] === '말' ? [add(ms, 20), monthEnd(ms)] : [ms, add(ms, 9)];
    });
    take(/(첫|둘|셋|넷|다섯|마지막)\s*(?:째|번째)?\s*주(?:차)?(?!말)/g, function (m) {
      var prev = found.filter(function (f) { return f.i < m.index; }).pop(), ms = prev ? prev.from.slice(0, 8) + '01' : today.slice(0, 8) + '01', me = monthEnd(ms);
      if (m[1] === '마지막') return [add(me, -6), me];
      var a = add(ms, ({ '첫': 1, '둘': 2, '셋': 3, '넷': 4, '다섯': 5 }[m[1]] - 1) * 7), b = add(a, 6); if (a > me) return null; return [a, b > me ? me : b];
    });
    var mond = add(today, -((wdN(today) + 6) % 7));
    take(/지지난\s*주말|저저번\s*주말/g, function () { return [add(mond, -9), add(mond, -8), '지지난 주말']; });
    take(/(?:지난|저번)\s*주말/g, function () { return [add(mond, -2), add(mond, -1), '지난 주말']; });
    take(/(?:이번\s*)?주말/g, function () { var s = add(mond, 5); return s > today ? [add(mond, -2), add(mond, -1), '지난 주말'] : [s, add(mond, 6), '이번 주말']; });
    take(/지지난\s*주|저저번\s*주|전전\s*주|2\s*주\s*전/g, function () { return [add(mond, -14), add(mond, -8), '지지난주']; });
    take(/지난\s*주|저번\s*주|전\s*주(?!\s*대비)/g, function () { return [add(mond, -7), add(mond, -1), '지난주']; });
    take(/이번\s*주|금주/g, function () { return [mond, today, '이번 주']; });
    take(/지지난\s*달|저저번\s*달|전전\s*달/g, function () { var e = add(add(today.slice(0, 8) + '01', -1).slice(0, 8) + '01', -1); return [e.slice(0, 8) + '01', e, '지지난달']; });
    take(/지난\s*달|저번\s*달|전월|전\s*달/g, function () { var e = add(today.slice(0, 8) + '01', -1); return [e.slice(0, 8) + '01', e, '지난달']; });
    take(/이번\s*달|이\s*달|당월|금월/g, function () { return [today.slice(0, 8) + '01', today, '이번 달']; });
    take(/(?:(?:최근|지난|직전|요)\s*)?(?:(\d{1,3})\s*(일|주일?|개월|달)\s*(?:간|동안|치)?|(한|두|세)\s*(달|주|개월)|(일주일|보름|열흘|사흘|이틀))(?:\s*(?:간|동안|치))?/g, function (m) {
      var lead = /^(?:최근|지난|직전|요)/.test(m[0]), tail = /(?:간|동안|치)\s*$/.test(m[0]);
      var n;
      if (m[5]) n = { '일주일': 7, '보름': 15, '열흘': 10, '사흘': 3, '이틀': 2 }[m[5]];
      else if (m[3]) n = { '한': 1, '두': 2, '세': 3 }[m[3]] * (m[4] === '주' ? 7 : 30);
      else { if (m[2] === '일' && !lead && !tail) return null; n = +m[1] * (m[2] === '일' ? 1 : /^주/.test(m[2]) ? 7 : 30); }
      if (!n || n > 400) return null;
      return [add(today, -n), add(today, -1), '최근 ' + n + '일'];
    });
    take(new RegExp(A_FULL, 'g'), function (m) {
      if (!/월|일|\//.test(m[0]) && !m[1]) return null;     // 2.1 같은 숫자는 날짜로 안 봄
      var a = atom(+m[1] || 0, +m[2], +m[3], today); return a && [a, a];
    });
    take(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월(?:\s*(?:달|한\s*달))?/g, function (m) {
      var a = mon(+m[1] || 0, +m[2]); if (!a) return null; return [a, monthEnd(a), (+m[2]) + '월'];
    });
    take(/올해|금년/g, function () { return [y0 + '-01-01', today, '올해']; });
    take(/작년|지난\s*해/g, function () { return [(y0 - 1) + '-01-01', (y0 - 1) + '-12-31', '작년']; });
    take(new RegExp(A_WORD + SEP + A_WORD + '(?:\\s*까지)?', 'g'), function (m) { return ord(add(today, WORD_DAY[m[1]]), add(today, WORD_DAY[m[2]])); });
    take(/오늘|어제|어저께|그저께|그제|엊그제/g, function (m) { var d = add(today, WORD_DAY[m[0]]); return [d, d, m[0] === '오늘' ? '오늘' : m[0] === '어제' || m[0] === '어저께' ? '어제' : '그저께']; });
    take(/(\d{1,2})\s*일(?!\s*(?:간|동안|치|전))/g, function (m) {
      var y = y0, mo = m0; if (!valid(y, mo, +m[1])) return null;
      var s = mk(y, mo, +m[1]); if (s > today) { var p = add(today.slice(0, 8) + '01', -1); y = +p.slice(0, 4); mo = +p.slice(5, 7); if (!valid(y, mo, +m[1])) return null; s = mk(y, mo, +m[1]); }
      return [s, s];
    });
    found.sort(function (a, b) { return a.i - b.i; });
    found.forEach(function (r) { if (r.to > today) r.to = today; if (r.from > today) r.from = today; });
    return found;
  }

  function cut(text, ranges) {
    var out = text;
    ranges.slice().sort(function (a, b) { return b.i - a.i; }).forEach(function (r) { out = out.slice(0, r.i) + ' ' + out.slice(r.i + r.len); });
    return out;
  }

  /* 글 → 풀이. ctx = 직전 풀이 (이어 묻기). unknown = 규칙이 못 알아들은 남은 말 */
  function parse(raw, ctx, today) {
    today = today || todayK();
    var text = String(raw || '').replace(/[?!.,…。"'“”‘’()]+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    var plan = {}, hit = {}, rest;
    var ranges = findRanges(text, today);
    rest = cut(text, ranges);
    var brands = [];
    BR.forEach(function (b) { b[1].lastIndex = 0; if (b[1].test(rest)) { brands.push(b[0]); b[1].lastIndex = 0; rest = rest.replace(b[1], ' '); } });
    ALL_RE.lastIndex = 0;
    var all = ALL_RE.test(rest); rest = rest.replace(ALL_RE, ' ');
    var chan = '';
    CH.forEach(function (c) { c[1].lastIndex = 0; if (c[1].test(rest)) { chan = chan ? 'all' : c[0]; c[1].lastIndex = 0; rest = rest.replace(c[1], ' '); } });
    HOME_RE.lastIndex = 0;
    if (HOME_RE.test(rest)) { chan = chan ? 'all' : 'home'; HOME_RE.lastIndex = 0; rest = rest.replace(HOME_RE, ' '); }
    var order = '';
    ORDER.some(function (o) { if (o[1].test(rest)) { order = o[0]; return true; } return false; });
    var whats = [], src = rest;
    WHAT.forEach(function (w) { w[1].lastIndex = 0; if (w[1].test(src)) { whats.push(w[0]); w[1].lastIndex = 0; rest = rest.replace(w[1], ' '); } });
    var cmpWord = /비교|대비|보다|차이|\bvs\b/i.test(text) || (/(?:이?랑|와|과|하고)\s/.test(text + ' ') && ranges.length > 1);

    // 무엇을
    if (whats.length) {
      var has = function (k) { return whats.indexOf(k) >= 0; };
      plan.what = has('why') ? 'why' : has('weekday') ? 'weekday' : has('options') ? 'options' : has('products') ? 'products' :
        has('daily') ? 'daily' : has('channels') ? 'channels' : (has('ads') && has('sales')) ? 'overview' : has('ads') ? 'ads' : has('sales') ? 'sales' : 'overview';
      if (plan.what === 'daily' || plan.what === 'weekday') plan.by = has('ads') ? 'ads' : 'sales';
      if (plan.what === 'overview' && !has('ads') && !has('sales') && ctx && ctx.what && !brands.length && !ranges.length && !/종합|전반|요약|분석|리포트|보고/.test(text)) plan.what = ctx.what;
      // '왜 클릭률이' 는 광고 쪽 이유
      if (plan.what === 'why' && has('ads') && !has('sales')) plan.by = 'ads';
      if (has('sales')) plan.bySales = true;
      hit.what = true;
      hit.strong = whats.some(function (k) { return k !== 'overview' && !(k === 'products' && !/상품|제품|품목|아이템|베스트|순위|팔|나가/.test(src)); });
    } else if (order) { plan.what = 'products'; hit.what = true; }
    if (order && (plan.what === 'products')) plan.order = order;
    var topM = /(?:탑|top|상위)\s*(\d{1,2})|(\d{1,2})\s*(?:개만|위까지)/i.exec(text);
    if (topM) plan.top = Math.max(1, Math.min(30, +(topM[1] || topM[2])));

    // 어느 브랜드
    if (brands.length) { plan.brands = brands; hit.brands = true; }
    else if (all) { plan.brands = []; hit.brands = true; }
    // 어느 판매처
    if (chan) {
      plan.channel = chan; hit.channel = true;
      if (chan !== 'home' && (!plan.what || plan.what === 'sales' || plan.what === 'overview')) plan.what = chan === 'all' ? 'channels' : 'sales';
    }
    // 언제
    if (ranges.length >= 2 && cmpWord) {
      var late = ranges[0].from >= ranges[1].from ? ranges[0] : ranges[1], early = late === ranges[0] ? ranges[1] : ranges[0];
      plan.from = late.from; plan.to = late.to; plan.label = late.label;
      plan.cmpFrom = early.from; plan.cmpTo = early.to; plan.cmpLabel = early.label; hit.range = true;
    } else if (ranges.length === 1 && cmpWord && ctx && ctx.from && /(?:이?랑|와|과|하고|보다|대비)/.test(text.slice(ranges[0].i + ranges[0].len, ranges[0].i + ranges[0].len + 4))) {
      plan.cmpFrom = ranges[0].from; plan.cmpTo = ranges[0].to; plan.cmpLabel = ranges[0].label; hit.range = true;
    } else if (ranges.length) {
      plan.from = ranges[0].from; plan.to = ranges[ranges.length - 1].to; plan.label = ranges.length === 1 ? ranges[0].label : '';
      if (plan.from > plan.to) { var sw = plan.from; plan.from = plan.to; plan.to = sw; }
      hit.range = true;
    }

    // 남은 말
    rest = rest.replace(/\s+/g, ' ').trim();
    var left = rest.split(' ').map(function (w) {
      var p = w, k = 0;
      // 낱말 끝에서부터 뜻 없는 말을 벗긴다
      while (p && k++ < 4) { FILL.lastIndex = 0; var q = p.replace(FILL, ''); if (q === p) break; p = q; }
      return p.replace(/[^0-9a-z가-힣]/ig, '') ? w : '';
    }).filter(Boolean).join(' ').trim();
    plan.unknown = left;
    plan.hit = hit;
    plan.placeholder = /몇\s*일\s*부터|며칠\s*부터|몇\s*일\s*까지/.test(text) && !ranges.length;
    return plan;
  }

  /* 직전 풀이에 이어 붙이기 */
  function merge(plan, ctx, today) {
    ctx = ctx || {};
    var p = {}, yest = add(today, -1);
    p.what = plan.what || (ctx.what && ctx.what !== 'chat' ? ctx.what : 'overview');
    p.brands = plan.brands || ctx.brands || [];
    p.channel = plan.channel || (ctx.channel || 'home');
    if (plan.what && plan.what !== 'channels' && !plan.channel) p.channel = !plan.brands && (plan.what === ctx.what || plan.what === 'daily' || plan.what === 'why' || plan.what === 'sales') ? (ctx.channel || 'home') : 'home';
    if (plan.from) { p.from = plan.from; p.to = plan.to; p.label = plan.label || ''; }
    else if (ctx.from) { p.from = ctx.from; p.to = ctx.to; p.label = ctx.label || ''; }
    else { p.from = add(yest, -6); p.to = yest; p.label = '최근 7일'; p.assumed = true; }
    if (plan.cmpFrom) { p.cmpFrom = plan.cmpFrom; p.cmpTo = plan.cmpTo; p.cmpLabel = plan.cmpLabel || ''; }
    else if (!plan.from && ctx.cmpFrom) { p.cmpFrom = ctx.cmpFrom; p.cmpTo = ctx.cmpTo; p.cmpLabel = ctx.cmpLabel; }
    if (plan.product) p.product = plan.product;
    else if (ctx.product && !plan.brands && !plan.channel && (plan.what === 'options' || plan.what === 'daily' || !plan.what)) p.product = ctx.product;
    p.order = plan.order || ((!plan.what || plan.what === ctx.what) ? ctx.order : '') || '';
    p.by = plan.by || ((!plan.what) ? ctx.by : (ctx.what === 'ads' || ctx.by === 'ads') && (plan.what === 'daily' || plan.what === 'weekday') ? 'ads' : '') || '';
    if (p.what === 'why' && plan.what === 'why' && !plan.by && (ctx.what === 'ads' || (ctx.what === 'daily' && ctx.by === 'ads')) && !plan.bySales) p.by = 'ads';
    if (plan.cmpFrom && !plan.what && (ctx.what === 'daily' || ctx.what === 'weekday' || ctx.what === 'options')) p.what = ctx.by === 'ads' ? 'ads' : 'sales';
    if (plan.cmpFrom && plan.from && !plan.what && ['why', 'daily', 'weekday', 'products', 'options', 'channels'].indexOf(p.what) >= 0) p.what = ctx.by === 'ads' ? 'ads' : 'overview';
    if (plan.top) p.top = plan.top;
    if (p.to > today) p.to = today;
    if (p.from > p.to) p.from = p.to;
    return p;
  }

  /* ───────── 글자 ───────── */
  function n0(x) { return Math.round(Number(x) || 0).toLocaleString('ko-KR'); }
  function won(x) {
    x = Math.round(Number(x) || 0); var neg = x < 0 ? '−' : ''; x = Math.abs(x);
    if (x >= 100000000) { var e = Math.floor(x / 100000000), r = Math.round((x % 100000000) / 10000); if (r === 10000) { e++; r = 0; } return neg + e.toLocaleString('ko-KR') + '억' + (r ? ' ' + r.toLocaleString('ko-KR') + '만' : '') + '원'; }
    if (x >= 100000) return neg + Math.round(x / 10000).toLocaleString('ko-KR') + '만원';
    return neg + x.toLocaleString('ko-KR') + '원';
  }
  function swon(x) { return x > 0 ? '+' + won(x) : x < 0 ? '−' + won(-x) : '0원'; }
  function growth(a, b) { return b > 0 ? (a / b - 1) * 100 : null; }
  function gTxt(g) { if (g == null || !isFinite(g)) return '–'; var r = Math.abs(g) >= 10 ? Math.round(g) : Math.round(g * 10) / 10; if (r === 0) return '0%'; return (r > 0 ? '+' : '−') + Math.abs(r).toLocaleString('ko-KR') + '%'; }
  function pct2(x) { return x == null || !isFinite(x) ? '–' : (x * 100).toFixed(2) + '%'; }
  function big(x) { x = Number(x) || 0; return x >= 100000 ? (x / 10000).toLocaleString('ko-KR', { maximumFractionDigits: x >= 1000000 ? 0 : 1 }) + '만' : n0(x); }
  function bat(w) { var c = String(w || '').slice(-1).charCodeAt(0); if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28; return /[013678lmnr]$/i.test(w) ? 1 : 0; }
  function eun(w) { return w + (bat(w) ? '은' : '는'); }
  function iga(w) { return w + (bat(w) ? '이' : '가'); }

  /* ───────── 계산 ───────── */
  function Core(D) {
    var sheetC = {}, plats = null, names = {}, TTL = 5 * 60 * 1000;
    D.brands().forEach(function (b) { names[b.key] = b.name; });
    var order = D.brands().map(function (b) { return b.key; });
    function nm(b) { return names[b] || b; }

    async function sheet(id) {
      var c = sheetC[id];
      if (c && Date.now() - c.at < TTL) return c;
      var r;
      try { var j = await D.adSheet(id); r = { at: Date.now(), days: (j && j.days) || null }; }
      catch (e) { r = c && c.days ? c : { at: Date.now() - TTL + 30000, err: String(e && e.message || e) }; }
      return (sheetC[id] = r);
    }
    function num(v) { if (v == null || v === '') return null; var x = Number(String(v).replace(/,/g, '')); return isFinite(x) ? x : null; }
    async function adAgg(b, ch, from, to) {
      var id = ch === 'home' ? b : ch + '-' + b, s = await sheet(id);
      var out = { imp: 0, clk: 0, krw: 0, n: 0, err: s.err, none: !s.err && !s.days, per: {}, first: '', last: '' };
      if (!s.days) return out;
      var ks = Object.keys(s.days).filter(function (k) { return num(s.days[k].imp) > 0; }).sort();
      out.first = ks[0] || ''; out.last = ks[ks.length - 1] || '';
      dates(from, to).forEach(function (d) {
        var v = s.days[d]; if (!v) return;
        var imp = num(v.imp), clk = num(v.clk), krw = num(v.krw), usd = num(v.usd), fx = num(v.fx);
        if (krw == null && usd != null && fx) krw = usd * fx;
        if (imp == null && clk == null && krw == null) return;
        out.n++; out.imp += imp || 0; out.clk += clk || 0; out.krw += krw || 0;
        out.per[d] = { imp: imp || 0, clk: clk || 0, krw: krw || 0 };
      });
      out.ctr = out.imp ? out.clk / out.imp : null;
      out.cpc = out.clk ? out.krw / out.clk : null;
      return out;
    }
    function chans(b, want) {
      return D.channels(b).filter(function (c) { return want === 'all' ? true : c.kind === (want || 'home'); });
    }
    async function saleAgg(b, ch, from, to) {
      var list = chans(b, ch), out = { paid: 0, orders: 0, ad: 0, days: 0, per: {}, first: '', last: '', err: '', none: !list.length, asOf: '' };
      for (var i = 0; i < list.length; i++) {
        var x = await D.sales(list[i].path);
        if (x.err) { out.err = x.err; continue; }
        if (x.none || !x.dates || !x.dates.length) { if (list.length === 1) out.none = true; continue; }
        if (!out.first || x.first > out.first) out.first = x.first;      // 여러 판매처면 가장 늦게 시작한 날
        if (x.last > out.last) out.last = x.last;
        dates(from, to).forEach(function (d) {
          var r = x.rows.get(d); if (!r) return;
          out.paid += Number(r.paid) || 0; out.orders += Number(r.orders) || 0; out.ad += Number(r.ad_spend) || 0;
          var p = out.per[d] || (out.per[d] = { paid: 0, orders: 0 }); p.paid += Number(r.paid) || 0; p.orders += Number(r.orders) || 0;
          if (r.as_of && d === to) out.asOf = String(r.as_of);
        });
      }
      out.days = Object.keys(out.per).length;
      return out;
    }
    async function model(b) {
      var r = await D.products(b);
      if (r && r.status === 'ok') return { m: r.m };
      return { err: r && r.status === 'err' ? (r.err || '읽지 못함') : '', none: true };
    }
    function idx(m, from, to) {
      var a = -1, b = -1;
      for (var i = 0; i < m.dates.length; i++) { if (m.dates[i] >= from && m.dates[i] <= to) { if (a < 0) a = i; b = i; } }
      return a < 0 ? null : [a, b];
    }
    function sumArr(arr, ab) { var s = 0; if (ab && arr) for (var t = ab[0]; t <= ab[1]; t++) s += arr[t]; return s; }
    async function qtyAgg(b, from, to) {
      var r = await model(b), out = { qty: 0, xqty: 0, per: {}, err: r.err || '', none: !r.m, first: '' };
      if (!r.m) return out;
      out.first = r.m.dates[0] || '';
      var ab = idx(r.m, from, to); if (!ab) return out;
      r.m.products.forEach(function (p) {
        for (var t = ab[0]; t <= ab[1]; t++) { if (p.qty[t] || p.xqty[t]) { out.qty += p.qty[t]; out.xqty += p.xqty[t]; out.per[r.m.dates[t]] = (out.per[r.m.dates[t]] || 0) + p.qty[t]; } }
      });
      return out;
    }
    async function prodRows(brands, from, to, cf, ct) {
      var rows = [], errs = [];
      for (var i = 0; i < brands.length; i++) {
        var r = await model(brands[i]);
        if (!r.m) { if (r.err) errs.push(brands[i]); continue; }
        var ab = idx(r.m, from, to), pb = cf ? idx(r.m, cf, ct) : null, cmpOk = cf && r.m.dates[0] <= cf;
        r.m.products.forEach(function (p) {
          var q = sumArr(p.qty, ab), paid = sumArr(p.paid, ab), pq = cmpOk ? sumArr(p.qty, pb) : null, pp = cmpOk ? sumArr(p.paid, pb) : null;
          if (q > 0 || pq > 0) rows.push({ b: brands[i], p: p, name: p.name, qty: q, paid: paid, pq: pq, ppaid: pp, dq: pq == null ? null : q - pq });
        });
      }
      return { rows: rows, errs: errs };
    }

    /* 비교 기간 — 오늘이 들어 있으면 증감은 어제까지 같은 날수로 */
    function compare(p, today) {
      var r = { from: p.from, to: p.to, partial: p.to === today };
      r.cf = p.from; r.ct = r.partial && p.from < p.to ? add(today, -1) : p.to;
      if (p.cmpFrom) { r.pf = p.cmpFrom; r.pt = p.cmpTo; r.plabel = p.cmpLabel || ''; r.manual = true; }
      else { var q = prevRange(r.cf, r.ct); r.pf = q.from; r.pt = q.to; r.plabel = q.label; }
      r.todayOnly = r.partial && p.from === p.to;
      r.sameLen = span(r.cf, r.ct) === span(r.pf, r.pt);
      return r;
    }
    function covered(first, from) { return !!first && first <= from; }

    /* 브랜드 하나의 한 기간 묶음 — 이번(표시) · 이번(비교용) · 앞 */
    async function pack(b, ch, r, need) {
      var o = { b: b, name: nm(b) };
      var jobs = [];
      jobs.push(saleAgg(b, ch, r.from, r.to).then(function (x) { o.s = x; }));
      jobs.push(saleAgg(b, ch, r.cf, r.ct).then(function (x) { o.sc = x; }));
      jobs.push(saleAgg(b, ch, r.pf, r.pt).then(function (x) { o.sp = x; }));
      if (ch === 'home' && need.qty !== false) {
        jobs.push(qtyAgg(b, r.from, r.to).then(function (x) { o.q = x; }));
        jobs.push(qtyAgg(b, r.cf, r.ct).then(function (x) { o.qc = x; }));
        jobs.push(qtyAgg(b, r.pf, r.pt).then(function (x) { o.qp = x; }));
      }
      if (need.ads !== false && ch !== 'all') {
        jobs.push(adAgg(b, ch, r.from, r.to).then(function (x) { o.a = x; }));
        jobs.push(adAgg(b, ch, r.cf, r.ct).then(function (x) { o.ac = x; }));
        jobs.push(adAgg(b, ch, r.pf, r.pt).then(function (x) { o.ap = x; }));
      }
      await Promise.all(jobs);
      o.cmp = !r.todayOnly && !o.sc.err && covered(o.sp.first, r.pf) && covered(o.sc.first, r.cf) && (o.sp.days > 0 || o.sp.paid > 0);
      o.acmp = !!(o.ac && o.ap && !r.todayOnly && o.ac.n > 0 && o.ap.n > 0 && o.ap.imp > 0 && o.ac.imp > 0);
      // 증감은 날수가 다르면 하루 평균으로
      o.k = r.sameLen ? 1 : span(r.cf, r.ct) / span(r.pf, r.pt);
      return o;
    }

    /* 매출 변화를 노출 · 클릭률 · 클릭당 주문 · 객단가로 나누기 (로그 비율 — 네 몫을 더하면 변화액과 딱 맞음) */
    function decomp(o) {
      if (!o.cmp || !o.acmp) return null;
      var k = o.k, c = { imp: o.ac.imp, clk: o.ac.clk, ord: o.sc.orders, paid: o.sc.paid }, p = { imp: o.ap.imp * k, clk: o.ap.clk * k, ord: o.sp.orders * k, paid: o.sp.paid * k };
      if (o.ac.n !== span1(o.ac) || [c.imp, c.clk, c.ord, c.paid, p.imp, p.clk, p.ord, p.paid].some(function (x) { return !(x > 0); })) return null;
      var f = [
        { key: '광고 노출', a: p.imp, b: c.imp, fmt: big },
        { key: '클릭률', a: p.clk / p.imp, b: c.clk / c.imp, fmt: pct2 },
        { key: '클릭당 주문', a: p.ord / p.clk, b: c.ord / c.clk, fmt: pct2 },
        { key: '객단가', a: p.paid / p.ord, b: c.paid / c.ord, fmt: won }
      ];
      var L = Math.abs(c.paid - p.paid) < 1 ? c.paid : (c.paid - p.paid) / Math.log(c.paid / p.paid);
      f.forEach(function (x) { x.g = (x.b / x.a - 1) * 100; x.won = L * Math.log(x.b / x.a); });
      return { f: f, d: c.paid - p.paid };
    }
    function span1(a) { return a.n; }

    return { nm: nm, order: order, pack: pack, compare: compare, decomp: decomp, adAgg: adAgg, saleAgg: saleAgg, qtyAgg: qtyAgg, prodRows: prodRows, model: model, idx: idx, sumArr: sumArr, chans: chans, covered: covered };
  }

  /* ───────── 답 만들기 — [{t:'p'|'h'|'table'|'bars'|'line'|'note', …}], chips ───────── */
  function Answer(D) {
    var C = Core(D);
    function P(x) { return { t: 'p', s: x }; }
    function N(x) { return { t: 'note', s: x }; }
    function brandsOf(p) { return p.brands && p.brands.length ? p.brands.filter(function (b) { return C.order.indexOf(b) >= 0; }) : C.order.slice(); }
    var CHN = { home: '공홈', all: '전체 판매처', ably: '에이블리', zigzag: '지그재그', smartstore: '스마트스토어', '29cm': '29CM', wconcept: 'W컨셉', ohou: '오늘의집', eql: 'EQL' };
    function who(p, bs) { return (bs.length === C.order.length ? '전체 브랜드' : bs.map(C.nm).join(' · ')); }
    function head(p, r, bs, tail) {
      var s = who(p, bs) + ' ' + (CHN[p.channel] || '공홈') + ' · ' + (p.label ? p.label + ' ' : '') + rangeTxt(p.from, p.to) + (p.from !== p.to ? ' · ' + span(p.from, p.to) + '일' : '');
      return { t: 'h', s: s + (tail ? ' · ' + tail : '') };
    }
    function cmpName(r) { var sh = rangeTxt(r.pf, r.pt).replace(/\([일월화수목금토]\)/g, ''); return r.plabel ? r.plabel + '(' + sh + ')' : sh; }
    function perDay(r) { return r.sameLen ? '' : ' (날수가 달라 하루 평균으로 비교)'; }
    function notes(p, r, packs, out) {
      var t = todayK();
      if (p.assumed) out.push(N('기간을 말씀하지 않으셔서 최근 7일(어제까지)로 봤어요.'));
      if (r.todayOnly && packs.length > 1) out.push(N('오늘은 아직 진행 중이에요.'));
      if (r.partial && !r.todayOnly) out.push(N('오늘은 아직 진행 중이라 증감은 어제까지 같은 날수로 비교했어요.'));
      var miss = packs.filter(function (o) { return o.s && o.s.first && o.s.first > p.from; });
      if (miss.length) { var f = miss.map(function (o) { return o.s.first; }).sort().pop(); out.push(N((miss.length === 1 ? miss[0].name + ' ' : '') + '판매 기록은 ' + md(f) + '부터 있어서 그 전 날짜는 빠졌어요.')); }
      var err = packs.filter(function (o) { return o.s && o.s.err; });
      if (err.length) out.push(N(err.map(function (o) { return o.name; }).join(' · ') + ' 자료를 지금 못 읽었어요. 잠시 뒤 다시 물어봐 주세요.'));
      if (packs.length && add(p.to, 7) > t) out.push(N('취소 · 반품을 뺀 값이라 최근 며칠은 조금 더 줄 수 있어요.'));
    }
    function adNote(p, packs, out) {
      var none = packs.filter(function (o) { return o.a && !o.a.err && (o.a.none || !o.a.n); }), part = packs.filter(function (o) { return o.a && o.a.n && o.a.n < span(p.from, p.to); });
      var err = packs.filter(function (o) { return o.a && o.a.err; });
      if (err.length) out.push(N(err.map(function (o) { return o.name; }).join(' · ') + ' 광고 기록을 지금 못 읽었어요.'));
      if (none.length) out.push(N(none.map(function (o, i) { return i === none.length - 1 ? eun(o.name) : o.name; }).join(' · ') + ' 이 기간 광고 기록이 없어요.'));
      if (part.length) { var t = todayK(); out.push(N(p.to === t ? '오늘 광고 기록은 아직이라 클릭률은 어제까지예요.' : '광고 기록이 빠진 날이 있어요 (' + part.map(function (o) { return o.name + ' ' + o.a.n + '/' + span(p.from, p.to) + '일'; }).join(', ') + ').')); }
    }
    function tg(g, base) { return { v: gTxt(g), low: g != null && g <= -10 && (base == null || base >= 100000) }; }   // 앞 기간이 아주 작으면 빨강 안 씀
    function chipBase(p) {
      var c = [], one = p.brands && p.brands.length === 1;
      var opt = [['왜 그런지', '왜 그래?'], ['광고 클릭률', '클릭률은?'], ['상품별', '상품별로'], ['일별', '일별로 보여줘'], ['판매처별', '판매처별로']];
      opt.forEach(function (o) {
        var k = { '왜 그런지': 'why', '광고 클릭률': 'ads', '상품별': 'products', '일별': 'daily', '판매처별': 'channels' }[o[0]];
        if (k !== p.what) c.push(o);
      });
      if (one) c = c.slice(0, 4).concat([['전체 브랜드', '전체 브랜드는?']]);
      if (!one) c = c.filter(function (o) { return o[0] !== '일별'; }).concat([['뜨는 상품', '뜨는 상품은?']]);
      return c.slice(0, 5);
    }

    // 물어본 기간 전체가 기록 시작 전
    function before(p, packs) {
      var l = packs.filter(function (o) { return o.s && o.s.first; });
      if (!l.length || !l.every(function (o) { return o.s.first > p.to; })) return '';
      return '그때 판매 기록은 없어요. ' + (l.length === 1 ? l[0].name + ' ' : '') + '기록은 ' + md(l.map(function (o) { return o.s.first; }).sort()[0]) + '부터 있어요.';
    }
    async function overview(p, r) {
      var bs = brandsOf(p), out = [], ch = p.channel;
      var packs = await Promise.all(bs.map(function (b) { return C.pack(b, ch, r, {}); }));
      out.push(head(p, r, bs));
      if (packs.every(function (o) { return o.s.none; })) { out.push(P((CHN[ch] || '') + ' 자료가 없어요.')); return out; }
      var pre = before(p, packs); if (pre) { out.push(P(pre)); return out; }
      if (bs.length === 1) {
        var o = packs[0];
        out = out.concat(oneBrand(p, r, o));
        if (ch === 'home') out = out.concat(await movers([o.b], r, 3));
        notes(p, r, packs, out); if (ch === 'home') adNote(p, packs, out);
        return out;
      }
      out = out.concat(manyBrands(p, r, packs, true));
      notes(p, r, packs, out); adNote(p, packs, out);
      return out;
    }

    function oneBrand(p, r, o, opt) {
      opt = opt || {};
      var out = [], s = o.s, parts = [];
      if (o.q && !o.q.none && !o.q.err) parts.push('**' + n0(o.q.qty) + '개**');
      parts.push('**' + won(s.paid) + '**');
      var line = parts.join(', ') + ' 팔렸어요. 주문 ' + n0(s.orders) + '건' + (s.orders ? ', 한 건에 평균 ' + won(s.paid / s.orders) + '이에요.' : '이에요.');
      out.push(P(line));
      if (r.todayOnly) { out.push(P((s.asOf ? s.asOf + ' 기준' : '지금까지') + '이고 아직 진행 중이에요.')); }
      else if (o.cmp) {
        var gq = o.qc && o.qp && !o.qp.none && C.covered(o.qp.first, r.pf) ? growth(o.qc.qty, o.qp.qty * o.k) : null, gs = growth(o.sc.paid, o.sp.paid * o.k), go = growth(o.sc.orders, o.sp.orders * o.k);
        out.push(P(cmpName(r) + '보다 ' + (gq == null ? '' : '수량 ' + gTxt(gq) + ', ') + '매출 ' + gTxt(gs) + ', 주문 ' + gTxt(go) + '예요.' + perDay(r)));
      } else if (!s.err) out.push(P('비교할 앞 기간 기록이 다 있지 않아서 증감은 뺐어요.'));
      if (opt.ads !== false && o.a && o.a.n && o.a.imp) {
        var l = '광고는 ' + big(o.a.imp) + '번 보여서 ' + n0(o.a.clk) + '번 눌렸어요. 클릭률 **' + pct2(o.a.ctr) + '**';
        if (o.acmp) { var d = o.ac.ctr / o.ap.ctr - 1; l += Math.abs(d) < 0.02 ? ', 앞 기간(' + pct2(o.ap.ctr) + ')과 비슷해요.' : ', 앞 기간(' + pct2(o.ap.ctr) + ')보다 ' + (d > 0 ? '올랐어요.' : '내려갔어요.'); } else l += '예요.';
        out.push(P(l));
        var dc = C.decomp(o);
        if (dc) { var w = whyLine(dc); if (w) out.push(P(w)); }
      }
      return out;
    }
    function whyLine(dc) {
      var up = dc.d >= 0, total = Math.abs(dc.d), s = dc.f.slice().sort(function (a, b) { return b.won - a.won; });
      if (total < 1) return '';
      var main = (up ? s : s.slice().reverse()).filter(function (x) { return up ? x.won > 0 : x.won < 0; })[0];
      var back = (up ? s.slice().reverse() : s).filter(function (x) { return up ? x.won < 0 : x.won > 0; })[0];
      if (!main) return '';
      var t = '매출이 ' + (up ? '늘어난' : '줄어든') + ' 데는 ' + main.key + '(' + gTxt(main.g) + ')' + (bat(main.key) ? '이' : '가') + ' 가장 크게 작용했어요.';
      if (back && Math.abs(back.won) > total * 0.15) t += ' 반대로 ' + eun(back.key) + ' ' + gTxt(back.g) + '로 ' + (up ? '매출을 깎는 쪽이었어요.' : '덜 줄게 받쳐 줬어요.');
      return t;
    }
    async function movers(bs, r, n) {
      if (r.todayOnly) return [];
      var x = await C.prodRows(bs, r.cf, r.ct, r.pf, r.pt), k = r.sameLen ? 1 : span(r.cf, r.ct) / span(r.pf, r.pt);
      var rows = x.rows.filter(function (y) { return y.pq != null; }); if (!rows.length) return [];
      rows.forEach(function (y) { y.dk = y.qty - y.pq * k; });
      var up = rows.filter(function (y) { return y.dk >= 2; }).sort(function (a, b) { return b.dk - a.dk; }).slice(0, n), dn = rows.filter(function (y) { return y.dk <= -2; }).sort(function (a, b) { return a.dk - b.dk; }).slice(0, n);
      var out = [], f = function (y) { return y.name + ' ' + (y.dk > 0 ? '+' : '−') + n0(Math.abs(y.dk)); };
      if (up.length) out.push(P('많이 늘어난 상품: ' + up.map(f).join(', ')));
      if (dn.length) out.push(P('많이 줄어든 상품: ' + dn.map(f).join(', ')));
      return out;
    }

    function manyBrands(p, r, packs, withAds) {
      var out = [], home = p.channel === 'home', rows = [], T = { qty: 0, paid: 0, ord: 0, qc: 0, qp: 0, sc: 0, sp: 0, imp: 0, clk: 0, ci: 0, cc: 0, pi: 0, pc: 0 }, cmpN = 0;
      var live = packs.filter(function (o) { return !o.s.none && !o.s.err && (o.s.paid || o.s.orders || (o.sp && o.sp.paid)); });
      live.forEach(function (o) {
        T.qty += o.q ? o.q.qty : 0; T.paid += o.s.paid; T.ord += o.s.orders;
        if (o.cmp) { T.sc += o.sc.paid; T.sp += o.sp.paid * o.k; cmpN++; }
        if (o.a && o.a.n) { T.imp += o.a.imp; T.clk += o.a.clk; }
        if (o.acmp) { T.ci += o.ac.imp; T.cc += o.ac.clk; T.pi += o.ap.imp; T.pc += o.ap.clk; }
      });
      if (!live.length) { out.push(P('이 기간에 판매 기록이 없어요.')); return out; }
      out.push(P('모두 ' + (home ? '**' + n0(T.qty) + '개**, ' : '') + '**' + won(T.paid) + '** 팔렸어요. 주문 ' + n0(T.ord) + '건이에요.' + (cmpN ? ' ' + cmpName(r) + '보다 매출 ' + gTxt(growth(T.sc, T.sp)) + '예요.' + perDay(r) : '')));
      var mv = live.filter(function (o) { return o.cmp; }).map(function (o) { return { o: o, d: o.sc.paid - o.sp.paid * o.k, g: growth(o.sc.paid, o.sp.paid * o.k) }; }).sort(function (a, b) { return b.d - a.d; });
      if (mv.length > 1) {
        var u = mv[0], d = mv[mv.length - 1], t = '';
        if (u.d > 0) t += iga(u.o.name) + ' ' + swon(u.d) + ' (' + gTxt(u.g) + ')으로 가장 많이 늘었고';
        if (d.d < 0) t += (t ? ', ' : '') + iga(d.o.name) + ' ' + swon(d.d) + ' (' + gTxt(d.g) + ')으로 가장 많이 줄었어요.'; else t += t ? ' 줄어든 곳은 없어요.' : '';
        if (t) out.push(P(t.replace(/늘었고$/, '늘었어요.')));
      }
      live.sort(function (a, b) { return b.s.paid - a.s.paid; });
      var cols = ['브랜드'].concat(home ? ['수량'] : [], ['매출', '증감'], withAds && home ? ['클릭률', '앞 기간'] : []);
      live.forEach(function (o) {
        var row = [{ v: o.name, bold: 1 }];
        if (home) row.push({ v: o.q && !o.q.none ? n0(o.q.qty) : '–' });
        row.push({ v: won(o.s.paid), title: n0(o.s.paid) + '원' }, o.cmp ? tg(growth(o.sc.paid, o.sp.paid * o.k), o.sp.paid) : { v: '–' });
        if (withAds && home) row.push({ v: o.a && o.a.imp ? pct2(o.a.ctr) : '–' }, { v: o.acmp ? pct2(o.ap.ctr) : '–' });
        rows.push(row);
      });
      var tr = [{ v: '합계', bold: 1 }]; if (home) tr.push({ v: n0(T.qty), bold: 1 });
      tr.push({ v: won(T.paid), bold: 1 }, cmpN ? tg(growth(T.sc, T.sp)) : { v: '–' });
      if (withAds && home) tr.push({ v: T.imp ? pct2(T.clk / T.imp) : '–', bold: 1 }, { v: T.pi ? pct2(T.pc / T.pi) : '–' });
      rows.push(tr);
      out.push({ t: 'table', cols: cols, rows: rows });
      return out;
    }

    async function sales(p, r) {
      var bs = brandsOf(p), out = [head(p, r, bs, '판매')];
      var packs = await Promise.all(bs.map(function (b) { return C.pack(b, p.channel, r, { ads: false }); }));
      if (packs.every(function (o) { return o.s.none; })) { out.push(P(eun(who(p, bs)) + ' ' + (CHN[p.channel] || '') + ' 판매 기록이 없어요.')); return out; }
      var pre = before(p, packs); if (pre) { out.push(P(pre)); return out; }
      if (bs.length === 1) { out = out.concat(oneBrand(p, r, packs[0], { ads: false })); if (p.channel === 'home') out = out.concat(await movers(bs, r, 3)); if (span(p.from, p.to) > 1) out.push(await dayChart(p, bs, 'sales')); }
      else out = out.concat(manyBrands(p, r, packs, false));
      notes(p, r, packs, out);
      return out;
    }

    async function ads(p, r) {
      var bs = brandsOf(p), ch = p.channel === 'all' ? 'home' : p.channel, out = [head(p, r, bs, (ch === 'home' ? '메타' : CHN[ch]) + ' 광고')];
      var packs = await Promise.all(bs.map(function (b) { return C.pack(b, ch, r, { qty: false }); }));
      var live = packs.filter(function (o) { return o.a && o.a.imp > 0; }).sort(function (a, b) { return b.a.imp - a.a.imp; });
      if (!live.length) { var e0 = packs.filter(function (o) { return o.a && o.a.err; }), l0 = packs.map(function (o) { return o.a && o.a.last || ''; }).sort().pop(); out.push(P(e0.length ? '광고 기록을 지금 못 읽었어요. 잠시 뒤 다시 물어봐 주세요.' : '이 기간에 광고 노출 기록이 없어요.' + (l0 ? ' 마지막 광고 기록은 ' + mdw(l0) + '이에요.' : ''))); return out; }
      var T = live.reduce(function (s, o) { s.i += o.a.imp; s.c += o.a.clk; s.k += o.a.krw; if (o.acmp) { s.ci += o.ac.imp; s.cc += o.ac.clk; s.pi += o.ap.imp; s.pc += o.ap.clk; } return s; }, { i: 0, c: 0, k: 0, ci: 0, cc: 0, pi: 0, pc: 0 });
      if (live.length === 1) {
        var o = live[0], a = o.a;
        out.push(P('클릭률 **' + pct2(a.ctr) + '**예요. ' + big(a.imp) + '번 보여서 ' + n0(a.clk) + '번 눌렸어요. 클릭 한 번에 ' + n0(a.cpc) + '원, 광고비는 ' + won(a.krw) + '이에요.'));
        if (o.acmp) {
          var d = o.ac.ctr / o.ap.ctr - 1, k = o.k, gi = growth(o.ac.imp, o.ap.imp * k);
          out.push(P(cmpName(r) + ' ' + pct2(o.ap.ctr) + '에서 ' + (Math.abs(d) < 0.02 ? '거의 그대로예요' : (d > 0 ? '올랐어요' : '내려갔어요') + ' (' + gTxt(d * 100) + ')') + '. 노출은 ' + gTxt(gi) + ', 클릭은 ' + gTxt(growth(o.ac.clk, o.ap.clk * k)) + '예요.' + perDay(r)));
          if (d < -0.05 && gi > 5) out.push(P('노출을 늘리면서 덜 관심 있는 사람에게도 보여 클릭률이 내려갔을 수 있어요. 노출은 늘었는데 클릭이 그만큼 안 따라왔는지 일별로 보시면 좋아요.'));
          else if (d < -0.05) out.push(P('노출이 늘지 않았는데 클릭률이 내려가서, 소재가 식었는지부터 볼 만해요.'));
        }
        if (ch === 'home' && o.s.paid && a.krw) out.push(P('공홈 매출 ÷ 광고비는 ' + Math.round(o.s.paid / a.krw * 100).toLocaleString('ko-KR') + '%예요.'));
        if (span(p.from, p.to) > 1) out.push(await dayChart(p, [o.b], 'ads'));
      } else {
        out.push(P('모두 합쳐 클릭률 **' + pct2(T.c / T.i) + '**예요' + (T.pi ? ' (' + cmpName(r) + ' ' + pct2(T.pc / T.pi) + ')' : '') + '. ' + big(T.i) + '번 보여서 ' + n0(T.c) + '번 눌렸어요.'));
        var ds = live.filter(function (o) { return o.acmp; }).map(function (o) { return { o: o, d: (o.ac.ctr / o.ap.ctr - 1) * 100 }; }).sort(function (a, b) { return a.d - b.d; });
        if (ds.length && ds[0].d < -2) out.push(P('가장 많이 떨어진 곳은 ' + ds[0].o.name + ' (' + pct2(ds[0].o.ap.ctr) + ' → ' + pct2(ds[0].o.ac.ctr) + ')예요.'));
        else if (ds.length) out.push(P('눈에 띄게 떨어진 곳은 없어요.'));
        out.push({ t: 'table', cols: ['브랜드', '노출', '클릭', '클릭률', '앞 기간', '클릭당'], rows: live.map(function (o) {
          var dd = o.acmp ? o.ac.ctr / o.ap.ctr - 1 : null;
          return [{ v: o.name, bold: 1 }, { v: big(o.a.imp) }, { v: n0(o.a.clk) }, { v: pct2(o.a.ctr), low: dd != null && dd <= -0.1 }, { v: o.acmp ? pct2(o.ap.ctr) : '–' }, { v: o.a.cpc ? n0(o.a.cpc) + '원' : '–' }];
        }) });
      }
      adNote(p, packs.filter(function (o) { return bs.length <= 2 || (o.a && o.a.n); }), out);
      if (p.assumed) out.push(N('기간을 말씀하지 않으셔서 최근 7일(어제까지)로 봤어요.'));
      out.push(N('여기 클릭률은 광고 클릭률이에요. 공홈 안에서 상품을 누른 비율은 모으는 자료가 없어요.'));
      return out;
    }

    /* 클릭률이 왜 바뀌었나 — 언제부터 · 노출과 같이 움직였나 · 어느 캠페인 (캠페인은 메타 리포트의 최근 7일 ↔ 30일) */
    async function adsWhy(p, r) {
      var bs = brandsOf(p);
      if (bs.length > 1 || r.todayOnly || (p.channel !== 'home' && p.channel !== 'all')) return ads(p, r);
      var o = await C.pack(bs[0], 'home', r, { qty: false }), out = [head(Object.assign({}, p, { channel: 'home' }), r, bs, '클릭률이 왜 바뀌었나')];
      if (!o.acmp) { out.push(P('비교할 앞 기간 광고 기록이 없어서 이유를 나눠 볼 수 없어요.')); adNote(p, [o], out); return out; }
      var d = o.ac.ctr / o.ap.ctr - 1, gi = growth(o.ac.imp, o.ap.imp * o.k), gc = growth(o.ac.clk, o.ap.clk * o.k), w = Math.abs(d) < 0.02 ? '거의 그대로' : d > 0 ? '올랐' : '내려갔';
      out.push(P('클릭률은 ' + pct2(o.ap.ctr) + ' → **' + pct2(o.ac.ctr) + '** (' + gTxt(d * 100) + ')로 ' + (w === '거의 그대로' ? '거의 그대로예요.' : w + '어요.') + ' 같은 동안 노출은 ' + gTxt(gi) + ', 클릭은 ' + gTxt(gc) + '예요.' + perDay(r)));
      if (d < -0.02 && gi > 5 && gc > -5) out.push(P('더 많은 사람에게 보여 주면서 누르는 비율이 낮아진 모양이에요. 클릭 자체는 줄지 않았어요.'));
      else if (d < -0.02 && gi > 5) out.push(P('노출을 늘렸는데 클릭은 오히려 줄었어요. 늘린 쪽 타깃이나 소재를 먼저 볼 만해요.'));
      else if (d < -0.02) out.push(P('노출이 늘지 않았는데 비율이 내려갔어요. 소재가 식었는지부터 볼 만해요.'));
      else if (d > 0.02) out.push(P(gi < -5 ? '노출을 줄이면서 잘 누르는 쪽만 남은 모양이에요.' : '노출이 줄지 않았는데 비율이 올라서, 소재나 타깃이 더 잘 맞은 것으로 보여요.'));
      var ds = dates(r.cf, r.ct).filter(function (x) { return o.ac.per[x] && o.ac.per[x].imp; });
      if (ds.length >= 3) { var lo = ds.map(function (x) { return { d: x, v: o.ac.per[x].clk / o.ac.per[x].imp }; }).sort(function (a, b) { return a.v - b.v; }); out.push(P((d < 0 ? '가장 낮은 날은 ' + mdw(lo[0].d) + ' ' + pct2(lo[0].v) : '가장 높은 날은 ' + mdw(lo[lo.length - 1].d) + ' ' + pct2(lo[lo.length - 1].v)) + '예요.')); }
      var rep = null; try { rep = D.adReport ? await D.adReport(bs[0]) : null; } catch (e) { rep = null; }
      var c7 = rep && rep.campaigns_by_period && rep.campaigns_by_period.last_7d, c30 = rep && rep.campaigns_by_period && rep.campaigns_by_period.last_30d;
      if (Array.isArray(c7) && Array.isArray(c30)) {
        var m30 = {}, tot = 0; c30.forEach(function (c) { m30[c.campaign_id] = c; });
        c7.forEach(function (c) { tot += Number(c.impressions) || 0; });
        var rows = c7.filter(function (c) { return Number(c.impressions) > 0; }).sort(function (a, b) { return b.impressions - a.impressions; }).slice(0, 6).map(function (c) {
          var a = Number(c.clicks) / Number(c.impressions), q = m30[c.campaign_id], b = q && Number(q.impressions) > 0 ? Number(q.clicks) / Number(q.impressions) : null;
          return [{ v: c.name, name: 1, title: c.name }, { v: tot ? Math.round(c.impressions / tot * 100) + '%' : '–' }, { v: pct2(a), low: b != null && a / b - 1 <= -0.1, bold: 1 }, { v: b == null ? '–' : pct2(b) }];
        });
        if (rows.length) { out.push({ t: 'table', cols: ['캠페인', '노출 비중', '최근 7일', '최근 30일'], rows: rows }); out.push(N('캠페인은 날짜를 골라 볼 수 없어서 최근 7일과 30일로 견줬어요.')); }
      }
      var gs = o.cmp ? growth(o.sc.paid, o.sp.paid * o.k) : null;
      if (Math.abs(d) < 0.02 && gs != null && Math.abs(gs) >= 10) out.push(P('클릭률은 그대로인데 공홈 매출은 ' + gTxt(gs) + '예요. 매출 쪽 이유는 아래에서 이어 보실 수 있어요.'));
      adNote(p, [o], out);
      out.chips = [['매출은 왜', o.name + ' 매출 왜 바뀌었어?']].concat(chipBase(p).filter(function (c) { return c[0] !== '왜 그런지'; }).slice(0, 4));
      return out;
    }

    async function products(p, r) {
      var bs = brandsOf(p), out = [], top = p.top || 10;
      if (p.product) return product(p, r);
      out.push(head(Object.assign({}, p, { channel: 'home' }), r, bs, '상품'));
      var x = await C.prodRows(bs, r.partial && !r.todayOnly && (p.order === 'up' || p.order === 'down') ? r.cf : p.from, r.partial && !r.todayOnly && (p.order === 'up' || p.order === 'down') ? r.ct : p.to, r.todayOnly ? '' : r.pf, r.todayOnly ? '' : r.pt), k = r.sameLen ? 1 : span(r.cf, r.ct) / span(r.pf, r.pt);
      var rows = x.rows; rows.forEach(function (y) { y.dk = y.pq == null ? null : y.qty - y.pq * k; });
      if (!rows.length) { out.push(P('이 기간에 팔린 상품이 없어요.')); if (x.errs.length) out.push(N('상품 기록을 못 읽은 브랜드: ' + x.errs.map(C.nm).join(' · '))); return out; }
      var ord = p.order || 'best', list, word;
      if (ord === 'up') { list = rows.filter(function (y) { return y.dk > 0; }).sort(function (a, b) { return b.dk - a.dk; }); word = '많이 늘어난 상품'; }
      else if (ord === 'down') { list = rows.filter(function (y) { return y.dk < 0; }).sort(function (a, b) { return a.dk - b.dk; }); word = '많이 줄어든 상품'; }
      else if (ord === 'worst') { list = rows.slice().sort(function (a, b) { return a.qty - b.qty || (b.pq || 0) - (a.pq || 0); }); word = '적게 팔린 상품 (이번이나 앞 기간에 한 번이라도 팔린 것 중)'; }
      else { list = rows.filter(function (y) { return y.qty > 0; }).sort(function (a, b) { return b.qty - a.qty || b.paid - a.paid; }); word = '많이 팔린 상품'; }
      if (!list.length) { out.push(P(ord === 'up' ? '앞 기간보다 늘어난 상품이 없어요.' : ord === 'down' ? '앞 기간보다 줄어든 상품이 없어요.' : '해당하는 상품이 없어요.')); return out; }
      var one = bs.length === 1, f = list[0], tot = rows.reduce(function (s, y) { return s + y.qty; }, 0), sumTop = list.slice(0, top).reduce(function (s, y) { return s + y.qty; }, 0);
      if (ord === 'best') out.push(P('1위는 **' + f.name + '**' + (one ? '' : ' (' + C.nm(f.b) + ')') + ', ' + n0(f.qty) + '개예요.' + (list.length > 3 && tot ? ' 위 ' + Math.min(top, list.length) + '개가 전체 ' + n0(tot) + '개의 ' + Math.round(sumTop / tot * 100) + '%예요.' : '')));
      else if (ord === 'up' || ord === 'down') out.push(P(word + '은 **' + f.name + '**' + (one ? '' : ' (' + C.nm(f.b) + ')') + ', ' + n0(f.pq) + '개 → ' + n0(f.qty) + '개예요.' + (r.sameLen ? '' : ' (순서는 하루 평균으로)')));
      else out.push(P(word + '이에요.'));
      out.push({ t: 'table', cols: ['상품'].concat(one ? [] : ['브랜드'], ['수량', '앞 기간', '매출']), rows: list.slice(0, top).map(function (y, i) {
        return [{ v: (i + 1) + '. ' + y.name, name: 1, ask: y.name + ' 자세히', set: { product: y.name, brands: [y.b], sure: true }, title: y.name }].concat(one ? [] : [{ v: C.nm(y.b) }], [{ v: n0(y.qty), bold: 1 }, { v: y.pq == null ? '–' : n0(y.pq), low: y.dk != null && y.pq >= 5 && y.dk <= -y.pq * 0.3 }, { v: won(y.paid), title: n0(y.paid) + '원' }]);
      }) });
      if (p.assumed) out.push(N('기간을 말씀하지 않으셔서 최근 7일(어제까지)로 봤어요.'));
      if (!r.todayOnly) out.push(N('앞 기간은 ' + cmpName(r) + '예요. 공홈 판매만 셌어요.'));
      if (x.errs.length) out.push(N('상품 기록을 못 읽은 브랜드: ' + x.errs.map(C.nm).join(' · ')));
      return out;
    }

    function key(s) { return String(s || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, ''); }
    // 이름으로 상품 찾기 — 낱말이 다 들어 있는 상품
    async function findProducts(q, bs) {
      var ws = String(q || '').toLowerCase().split(/[^0-9a-z가-힣À-ɏ]+/).filter(function (w) { return w.length > 1; }), res = [];
      if (!ws.length) return res;
      for (var i = 0; i < bs.length; i++) {
        var r = await C.model(bs[i]); if (!r.m) continue;
        r.m.products.forEach(function (p) {
          var all = [p.name].concat(p.names && p.names.keys ? Array.from(p.names.keys()) : []), best = 0;
          all.forEach(function (nmx) {
            var low = nmx.toLowerCase(), toks = low.split(/[^0-9a-z가-힣À-ɏ]+/), sc = 0, ok = ws.every(function (w) { if (toks.indexOf(w) >= 0) { sc += 3; return true; } if (low.indexOf(w) >= 0) { sc += 1; return true; } return false; });
            if (ok) { if (key(low) === key(q)) sc += 20; sc += 1 / (1 + toks.length); if (sc > best) best = sc; }
          });
          if (best) res.push({ b: bs[i], p: p, name: p.name, sc: best });
        });
      }
      res.sort(function (a, b) { return b.sc - a.sc; });
      return res;
    }
    async function product(p, r) {
      var bs = brandsOf(p), hits = await findProducts(p.product, bs), out = [];
      if (!hits.length && bs.length < C.order.length) hits = await findProducts(p.product, C.order);
      if (!hits.length) { out.push(P('“' + p.product + '” 이름이 들어간 상품을 공홈 판매 기록에서 못 찾았어요. 이름 한 조각만 다시 말씀해 주세요.')); return out; }
      var exact = hits.filter(function (h) { return key(h.name) === key(p.product); });
      if (exact.length && hits.length > exact.length && !p.sure) { var em = (await C.model(exact[0].b)).m; if (!C.sumArr(exact[0].p.qty, C.idx(em, p.from, p.to))) exact = []; }
      var pick = exact.length ? exact : hits;
      if (pick.length > 1 && !exact.length) {
        // 여럿이면 판매 합을 보여 주고 고르게
        var data = [];
        for (var i = 0; i < pick.length; i++) { var mm = (await C.model(pick[i].b)).m; data.push({ h: pick[i], q: C.sumArr(pick[i].p.qty, C.idx(mm, p.from, p.to)) }); }
        data.sort(function (a, b) { return b.q - a.q || b.h.sc - a.h.sc; }); data = data.slice(0, 12);
        out.push(head(Object.assign({}, p, { channel: 'home' }), r, bs, '“' + p.product + '”'));
        out.push(P('“' + p.product + '” 이름이 들어간 상품이 ' + hits.length + '개예요' + (hits.length > 12 ? ' (12개만)' : '') + '. 자세히 볼 상품을 눌러 주세요.'));
        out.push({ t: 'table', cols: ['상품', '브랜드', '수량'], rows: data.map(function (x) { return [{ v: x.h.name, name: 1, ask: x.h.name + ' 자세히', set: { product: x.h.name, brands: [x.h.b], sure: true }, title: x.h.name }, { v: C.nm(x.h.b) }, { v: n0(x.q), bold: 1 }]; }) });
        return out;
      }
      var h = pick[0], m = (await C.model(h.b)).m, ab = C.idx(m, p.from, p.to), q0 = C.sumArr(h.p.qty, ab), paid = C.sumArr(h.p.paid, ab), x0 = C.sumArr(h.p.xqty, ab);
      out.push(head(Object.assign({}, p, { channel: 'home', brands: [h.b] }), r, [h.b], h.name));
      out.ctxProduct = h.name; out.ctxBrand = h.b;
      out.push(P('**' + n0(q0) + '개**, ' + won(paid) + ' 팔렸어요.' + (x0 ? ' 취소 · 반품으로 빠진 건 ' + n0(x0) + '개예요.' : '')));
      if (!r.todayOnly && m.dates[0] <= r.pf) { var cq = C.sumArr(h.p.qty, C.idx(m, r.cf, r.ct)), pq = C.sumArr(h.p.qty, C.idx(m, r.pf, r.pt)), k = r.sameLen ? 1 : span(r.cf, r.ct) / span(r.pf, r.pt); out.push(P(cmpName(r) + '에는 ' + n0(pq) + '개였어요' + (pq ? ' (' + gTxt(growth(cq, pq * k)) + ')' : '') + '.' + perDay(r))); }
      if (span(p.from, p.to) > 1) out.push({ t: 'bars', unit: '개', title: '날짜별 수량', data: dates(p.from, p.to).map(function (d) { var t = m.di.get(d); return { d: d, v: t == null ? 0 : h.p.qty[t] }; }) });
      var os = optRows(h.p, ab); if (os.length > 1) out.push({ t: 'table', cols: ['옵션', '수량', '비중'], rows: os.slice(0, 12).map(function (o) { return [{ v: o.n, name: 1, title: o.n }, { v: n0(o.q), bold: 1 }, { v: q0 ? Math.round(o.q / q0 * 100) + '%' : '–' }]; }) });
      return out;
    }
    function optRows(prod, ab) { var o = []; prod.opts.forEach(function (arr, n) { var q = C.sumArr(arr, ab); if (q > 0) o.push({ n: n, q: q }); }); return o.sort(function (a, b) { return b.q - a.q; }); }
    async function options(p, r) {
      if (p.product) return product(p, r);
      var bs = brandsOf(p), x = await C.prodRows(bs, p.from, p.to, '', ''), list = x.rows.filter(function (y) { return y.qty > 0; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 4);
      var out = [head(Object.assign({}, p, { channel: 'home' }), r, bs, '옵션')];
      if (!list.length) { out.push(P('이 기간에 팔린 상품이 없어요.')); return out; }
      out.push(P('어느 상품의 옵션을 볼까요? 이름을 말씀하시거나 아래에서 골라 주세요.'));
      out.chips = list.map(function (y) { return [y.name, y.name + ' 옵션별로', { what: 'options', product: y.name, brands: [y.b], sure: true }]; });
      return out;
    }

    async function dayChart(p, bs, by) {
      if (by === 'ads') {
        var ser = await Promise.all(bs.map(async function (b) { var a = await C.adAgg(b, p.channel === 'all' ? 'home' : p.channel, p.from, p.to); return { name: C.nm(b), data: dates(p.from, p.to).map(function (d) { var v = a.per[d]; return { d: d, v: v && v.imp ? v.clk / v.imp * 100 : null, tip: v ? '노출 ' + big(v.imp) + ' · 클릭 ' + n0(v.clk) : '기록 없음' }; }) }; }));
        ser = ser.filter(function (s) { return s.data.some(function (x) { return x.v != null; }); });
        return { t: 'line', title: '날짜별 클릭률', unit: '%', series: ser };
      }
      if (p.channel === 'home') {
        var sum = {}; var fst = ''; for (var i = 0; i < bs.length; i++) { var q = await C.qtyAgg(bs[i], p.from, p.to); if (q.first && (!fst || q.first < fst)) fst = q.first; Object.keys(q.per).forEach(function (d) { sum[d] = (sum[d] || 0) + q.per[d]; }); }
        return { t: 'bars', title: '날짜별 판매 수량', unit: '개', data: dates(fst > p.from && fst <= p.to ? fst : p.from, p.to).map(function (d) { return { d: d, v: sum[d] || 0 }; }) };
      }
      var ps = {}; for (var j = 0; j < bs.length; j++) { var s = await C.saleAgg(bs[j], p.channel, p.from, p.to); Object.keys(s.per).forEach(function (d) { ps[d] = (ps[d] || 0) + s.per[d].paid; }); }
      return { t: 'bars', title: '날짜별 매출', unit: '원', data: dates(p.from, p.to).map(function (d) { return { d: d, v: ps[d] || 0 }; }) };
    }
    async function daily(p, r) {
      if (p.product && p.by !== 'ads') return product(p, r);
      var bs = brandsOf(p), by = p.by === 'ads' ? 'ads' : 'sales', q = Object.assign({}, p);
      if (span(q.from, q.to) < 2) { q.from = add(q.to, -13); q.label = ''; }
      var out = [head(q, r, bs, by === 'ads' ? '일별 클릭률' : '일별 판매')], c = await dayChart(q, bs, by);
      if (by === 'ads') {
        if (!c.series.length) { out.push(P('이 기간에 광고 기록이 없어요.')); return out; }
        c.series.forEach(function (s) {
          var v = s.data.filter(function (x) { return x.v != null; }), mx = v.reduce(function (a, b) { return b.v > a.v ? b : a; }), mn = v.reduce(function (a, b) { return b.v < a.v ? b : a; });
          out.push(P((c.series.length > 1 ? s.name + ': ' : '') + '가장 높은 날 ' + mdw(mx.d) + ' ' + mx.v.toFixed(2) + '%, 가장 낮은 날 ' + mdw(mn.d) + ' ' + mn.v.toFixed(2) + '%예요.'));
        });
      } else {
        var today = todayK(), dd = c.data.filter(function (x) { return x.d < today; });
        if (!dd.some(function (x) { return x.v > 0; })) { out.push(P('이 기간에 판매 기록이 없어요.')); return out; }
        var hi = dd.reduce(function (a, b) { return b.v > a.v ? b : a; }), lo = dd.reduce(function (a, b) { return b.v < a.v ? b : a; }), f = c.unit === '개' ? function (v) { return n0(v) + '개'; } : won;
        out.push(P('하루 평균 ' + f(dd.reduce(function (s, x) { return s + x.v; }, 0) / dd.length) + '예요. 가장 많은 날은 ' + mdw(hi.d) + ' ' + f(hi.v) + ', 가장 적은 날은 ' + mdw(lo.d) + ' ' + f(lo.v) + '예요.'));
      }
      out.push(c);
      if (p.assumed) out.push(N('기간을 말씀하지 않으셔서 최근 7일(어제까지)로 봤어요.'));
      return out;
    }
    async function weekday(p, r) {
      var bs = brandsOf(p), by = p.by === 'ads' ? 'ads' : 'sales', today = todayK(), q = Object.assign({}, p);
      if (q.to === today && q.from < q.to) q.to = add(today, -1);
      if (span(q.from, q.to) < 14) { q.from = add(q.to, -27); q.label = '최근 4주'; }
      var out = [head(q, r, bs, '요일별 평균')], A = [0, 0, 0, 0, 0, 0, 0].map(function () { return { v: 0, n: 0, i: 0, c: 0 }; });
      if (by === 'ads') {
        for (var i = 0; i < bs.length; i++) { var a = await C.adAgg(bs[i], 'home', q.from, q.to); Object.keys(a.per).forEach(function (d) { var w = A[wdN(d)]; w.i += a.per[d].imp; w.c += a.per[d].clk; w.n++; }); }
        A.forEach(function (w) { w.v = w.i ? w.c / w.i * 100 : 0; });
      } else {
        var c = await dayChart(q, bs, 'sales'); c.data.forEach(function (x) { var w = A[wdN(x.d)]; w.v += x.v; w.n++; }); A.forEach(function (w) { if (w.n) w.v /= w.n; });
      }
      var seq = [1, 2, 3, 4, 5, 6, 0], lab = '일월화수목금토', data = seq.map(function (k) { return { d: lab[k], v: A[k].v, plain: 1 }; }), hi = data.reduce(function (a, b) { return b.v > a.v ? b : a; }), lo = data.reduce(function (a, b) { return b.v < a.v ? b : a; });
      if (!hi.v) { out.push(P('이 기간에 기록이 없어요.')); return out; }
      var f = by === 'ads' ? function (v) { return v.toFixed(2) + '%'; } : p.channel === 'home' ? function (v) { return n0(v) + '개'; } : won;
      out.push(P(hi.d + '요일이 ' + f(hi.v) + '로 가장 높고, ' + lo.d + '요일이 ' + f(lo.v) + '로 가장 낮아요.'));
      out.push({ t: 'bars', title: '요일별 평균 ' + (by === 'ads' ? '클릭률' : p.channel === 'home' ? '판매 수량' : '매출'), unit: by === 'ads' ? '%' : p.channel === 'home' ? '개' : '원', data: data });
      if (q.label === '최근 4주') out.push(N('요일은 2주 넘게 봐야 믿을 만해서 4주로 봤어요.'));
      return out;
    }

    async function why(p, r) {
      var bs = brandsOf(p), out = [head(p, r, bs, '왜 바뀌었나')];
      if (r.todayOnly) { out.push(P('오늘은 아직 진행 중이라 이유를 따지기 이르네요. 어제나 지난주로 물어봐 주세요.')); return out; }
      var packs = await Promise.all(bs.map(function (b) { return C.pack(b, p.channel, r, {}); })), live = packs.filter(function (o) { return o.cmp; });
      if (!live.length) { out.push(P('비교할 앞 기간 기록이 다 있지 않아서 이유를 나눠 볼 수 없어요.')); notes(p, r, packs, out); return out; }
      if (bs.length > 1) {
        var t = live.map(function (o) { return { o: o, d: o.sc.paid - o.sp.paid * o.k, g: growth(o.sc.paid, o.sp.paid * o.k) }; }).sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); }), tot = t.reduce(function (s, x) { return s + x.d; }, 0);
        out.push(P(cmpName(r) + '보다 매출이 모두 **' + won(Math.abs(tot)) + '** ' + (tot >= 0 ? '늘었어요.' : '줄었어요.') + perDay(r)));
        out.push({ t: 'table', cols: ['브랜드', '변화', '증감', '가장 큰 이유'], rows: t.filter(function (x) { return Math.abs(x.d) >= 1; }).map(function (x) {
          var dc = C.decomp(x.o), m = dc ? dc.f.slice().sort(function (a, b) { return x.d >= 0 ? b.won - a.won : a.won - b.won; })[0] : null;
          return [{ v: x.o.name, bold: 1, ask: x.o.name + ' 왜 그래?' }, { v: swon(x.d) }, tg(x.g), { v: m ? m.key + ' ' + gTxt(m.g) : '광고 기록 없음' }];
        }) });
        var top = t[0], dc0 = C.decomp(top.o); if (dc0) out.push(P(top.o.name + ' — ' + whyLine(dc0)));
      } else {
        var o = live[0], gs = growth(o.sc.paid, o.sp.paid * o.k), dc = C.decomp(o);
        var dw = o.sc.paid - o.sp.paid * o.k; out.push(P(cmpName(r) + '보다 매출이 ' + (Math.abs(dw) < 1 ? '그대로예요.' : '**' + won(Math.abs(dw)) + '** (' + gTxt(gs) + ') ' + (dw > 0 ? '늘었어요.' : '줄었어요.')) + perDay(r)));
        if (dc) {
          out.push(P(whyLine(dc)));
          out.push({ t: 'table', cols: ['나눠 보면', '앞 기간', '이번', '변화', '매출 영향'], rows: dc.f.map(function (x) { return [{ v: x.key, bold: 1 }, { v: x.fmt(x.a) }, { v: x.fmt(x.b) }, tg(x.g), { v: swon(x.won), bold: 1 }]; }) });
        } else out.push(P('광고 기록이 다 없어서 주문과 객단가로만 보면, 주문 ' + gTxt(growth(o.sc.orders, o.sp.orders * o.k)) + ', 객단가 ' + gTxt(o.sc.orders && o.sp.orders ? growth(o.sc.paid / o.sc.orders, o.sp.paid / o.sp.orders) : null) + '예요.'));
        if (p.channel === 'home') out = out.concat(await movers([o.b], r, 4));
      }
      notes(p, r, packs, out);
      out.push(N('광고 말고 들어온 주문도 섞여 있어서, 무엇이 같이 움직였는지로 봐 주세요.'));
      return out;
    }

    async function channels(p, r) {
      var bs = brandsOf(p), out = [head(Object.assign({}, p, { channel: 'all' }), r, bs)], by = {}, errs = [];
      await Promise.all(bs.map(async function (b) {
        await Promise.all(C.chans(b, 'all').map(async function (c) {
          var x = await Promise.all([C.saleAgg(b, c.kind, p.from, p.to), C.saleAgg(b, c.kind, r.cf, r.ct), C.saleAgg(b, c.kind, r.pf, r.pt)]);
          if (x[0].err) { errs.push(C.nm(b) + ' ' + c.label); return; }
          if (x[0].none) return;
          var g = by[c.kind] || (by[c.kind] = { label: c.label, paid: 0, orders: 0, sc: 0, sp: 0, cmp: 0 });
          g.paid += x[0].paid; g.orders += x[0].orders;
          if (!r.todayOnly && C.covered(x[2].first, r.pf)) { g.sc += x[1].paid; g.sp += x[2].paid * (r.sameLen ? 1 : span(r.cf, r.ct) / span(r.pf, r.pt)); g.cmp++; }
        }));
      }));
      var list = Object.keys(by).map(function (k) { return by[k]; }).filter(function (g) { return g.paid || g.sp; }).sort(function (a, b) { return b.paid - a.paid; }), tot = list.reduce(function (s, g) { return s + g.paid; }, 0);
      if (!list.length) { out.push(P('이 기간에 판매 기록이 없어요.')); }
      else {
        out.push(P('모두 **' + won(tot) + '**이고, ' + iga(list[0].label) + ' ' + Math.round(list[0].paid / tot * 100) + '%로 가장 커요.'));
        out.push({ t: 'table', cols: ['판매처', '매출', '비중', '주문', '증감'], rows: list.map(function (g) { return [{ v: g.label, bold: 1 }, { v: won(g.paid), title: n0(g.paid) + '원' }, { v: tot ? Math.round(g.paid / tot * 100) + '%' : '–' }, { v: n0(g.orders) }, g.cmp ? tg(growth(g.sc, g.sp), g.sp) : { v: '–' }]; }) });
      }
      if (errs.length) out.push(N('지금 못 읽은 곳: ' + errs.join(', ')));
      if (p.assumed) out.push(N('기간을 말씀하지 않으셔서 최근 7일(어제까지)로 봤어요.'));
      out.push(N('증감은 ' + cmpName(r) + ' 기준이고, 그때 기록이 있는 판매처끼리만 비교했어요.'));
      return out;
    }

    var FN = { overview: overview, sales: sales, ads: ads, products: products, options: options, daily: daily, weekday: weekday, why: why, channels: channels };
    async function run(p) {
      var r = C.compare(p, todayK()), out;
      if (p.to < '2026-06-01') { out = [P('그때 기록은 없어요. 공홈 판매는 9월 6일부터, 광고 클릭률은 6월 1일부터 남아 있어요.')]; out.chips = [['지난주', '지난주 어땠어?'], ['이번 달', '이번 달 어땠어?']]; return out; }
      if (p.what === 'why' && p.by === 'ads') { out = await adsWhy(p, r); }
      else out = await (FN[p.what] || overview)(p, r);
      if (!out.chips) out.chips = chipBase(p);
      return out;
    }
    return { run: run, core: C, findProducts: findProducts };
  }

  /* ───────── 화면 ───────── */
  function boot() {
    var host = document.getElementById('app');
    if (!host || document.getElementById('anPill')) return;
    try { if (window.parent !== window) return; } catch (e) { return; }
    if (/[?&](app|embed)=/.test(location.search)) return;

    var css = document.createElement('style'); css.id = 'anCss';
    css.textContent = [
      '#anPill{position:fixed;right:calc(20px + env(safe-area-inset-right,0px));bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:70;display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:0 18px 0 15px;border:0;border-radius:999px;background:#1f2329;color:#fff;font:600 14px/1 var(--sans,sans-serif);cursor:pointer;box-shadow:0 8px 24px -8px rgba(0,0,0,.45);-webkit-tap-highlight-color:transparent}',
      '#anPill svg{width:18px;height:18px;flex:none}#anPill:hover{background:#000}#anPill:focus-visible{outline:2px solid #1f2329;outline-offset:3px}',
      '#anPill[hidden]{display:none}#app:has(.view-tool:not([hidden])) #anPill{display:none}html.solo-app #anPill{display:none}',
      '#anBox{position:fixed;right:calc(20px + env(safe-area-inset-right,0px));bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:8900;width:min(460px,calc(100vw - 40px));height:min(700px,calc(100vh - 40px));display:flex;flex-direction:column;background:var(--bg-1,#fff);color:var(--text-1,#0a0b0d);border:1px solid var(--line,#e8e2d2);border-radius:16px;box-shadow:0 24px 60px -20px rgba(0,0,0,.4);overflow:hidden;font-family:var(--sans,sans-serif)}',
      '#anBox[hidden]{display:none}#anBox *{box-sizing:border-box}',
      '#anBox .an-top{flex:none;display:flex;align-items:center;gap:10px;padding:13px 10px 13px 18px;border-bottom:1px solid var(--line,#e8e2d2);background:var(--bg-1,#fff)}',
      '#anBox .an-top b{font-size:15.5px;font-weight:700}#anBox .an-top span{display:block;margin-top:3px;font-size:12px;color:#6b7280;font-weight:500}',
      '#anBox .an-ic{margin-left:auto;display:flex;gap:2px}#anBox .an-ic button{min-width:40px;height:40px;padding:0 9px;border:0;border-radius:10px;background:none;color:#4b5563;font:500 13px/1 var(--sans,sans-serif);cursor:pointer}#anBox .an-ic button:hover{background:#f3f4f6}',
      '#anLog{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px 16px 8px;display:flex;flex-direction:column;gap:12px;-webkit-overflow-scrolling:touch}',
      '#anLog .me{align-self:flex-end;max-width:84%;padding:9px 13px;border-radius:14px 14px 4px 14px;background:#1f2329;color:#fff;font-size:14px;line-height:1.5;overflow-wrap:anywhere}',
      '#anLog .an{align-self:stretch;font-size:14px;line-height:1.6;min-width:0}#anLog .an p{margin:0 0 7px;overflow-wrap:anywhere}#anLog .an p b{font-weight:700}',
      '#anLog .an .h{margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;line-height:1.45}#anLog .an .nt{margin:0 0 3px;font-size:12px;line-height:1.5;color:#6b7280}',
      '#anLog .tw{margin:4px 0 10px;overflow-x:auto;-webkit-overflow-scrolling:touch}#anLog table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}',
      '#anLog th{padding:6px 6px;text-align:right;font-weight:500;font-size:12px;color:#6b7280;border-bottom:1px solid var(--line-2,#d3cbb6);white-space:nowrap}#anLog td{padding:7px 6px;text-align:right;border-bottom:1px solid #f0efea;white-space:nowrap}',
      '#anLog th:first-child,#anLog td:first-child{text-align:left;padding-left:0}#anLog th:last-child,#anLog td:last-child{padding-right:0}#anLog td.nm{white-space:normal;min-width:132px;max-width:210px;overflow-wrap:anywhere;line-height:1.4}#anLog td.b{font-weight:700}#anLog td.low{color:#dc2626}',
      '#anLog td button{padding:0;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;text-decoration:underline;text-decoration-color:#d1d5db;text-underline-offset:3px}',
      '#anLog .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#anLog .chips button,#anBox .an-top button.x{font:500 13px/1.3 var(--sans,sans-serif)}#anLog .chips button{min-height:34px;max-width:100%;padding:6px 12px;border:1px solid var(--line-2,#d3cbb6);border-radius:999px;background:#fff;color:#1f2329;cursor:pointer;text-align:left;overflow-wrap:anywhere}#anLog .chips button:hover{border-color:#1f2329}',
      '#anLog .cw{position:relative;margin:4px 0 12px}#anLog .ct{font-size:12px;color:#6b7280;margin-bottom:4px;font-weight:500}#anLog svg{display:block;width:100%;height:auto;overflow:visible}#anLog svg text{font:500 10.5px var(--sans,sans-serif);fill:#6b7280}#anLog svg .v{fill:#1f2329;font-weight:700}',
      '#anLog .tip{position:absolute;top:0;z-index:2;padding:5px 9px;border-radius:8px;background:#1f2329;color:#fff;font-size:12px;line-height:1.4;white-space:nowrap;pointer-events:none;transform:translateX(-50%)}#anLog .tip b{font-weight:700}#anLog .tip[hidden]{display:none}',
      '#anLog .bar{fill:#8b93a1}#anLog .bar.on{fill:#1f2329}#anLog .bar.now{fill:#d5d9df}#anLog .hit{fill:transparent}#anLog details{margin:2px 0 8px;font-size:12.5px;color:#6b7280}#anLog details summary{cursor:pointer;min-height:26px;padding:3px 0}',
      '#anLog .wait{color:#6b7280;font-size:13.5px}#anLog .wait i{display:inline-block;width:5px;height:5px;margin-right:4px;border-radius:50%;background:#9ca3af;animation:anDot 1s infinite}#anLog .wait i:nth-child(2){animation-delay:.15s}#anLog .wait i:nth-child(3){animation-delay:.3s;margin-right:8px}@keyframes anDot{0%,100%{opacity:.25}50%{opacity:1}}',
      '#anForm{flex:none;display:flex;gap:8px;align-items:flex-end;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line,#e8e2d2);background:var(--bg-1,#fff)}',
      '#anQ{flex:1;min-width:0;min-height:44px;max-height:110px;padding:11px 14px;border:1px solid var(--line-2,#d3cbb6);border-radius:12px;background:#fff;color:#0a0b0d;font:500 16px/1.35 var(--sans,sans-serif);resize:none;outline:none}#anQ:focus{border-color:#1f2329}',
      '#anSend{flex:none;min-width:58px;height:44px;border:0;border-radius:12px;background:#1f2329;color:#fff;font:600 14px/1 var(--sans,sans-serif);cursor:pointer}#anSend:disabled{opacity:.4;cursor:default}',
      '@media (max-width:640px){#anPill{right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));min-height:44px;padding:0 15px 0 13px;font-size:13px}#anBox{left:0;right:0;top:0;bottom:auto;width:100%;height:100dvh;border:0;border-radius:0;box-shadow:none}#anBox .an-top{padding-top:calc(13px + env(safe-area-inset-top,0px))}#anLog{padding:14px 14px 6px}}',
      '@media (prefers-reduced-motion:reduce){#anLog .wait i{animation:none}}@media print{#anPill,#anBox{display:none!important}}'
    ].join('\n');
    document.head.appendChild(css);

    var pill = el('button', { id: 'anPill', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'anBox' });
    pill.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3.5 16.5h13"/><path d="M5.8 13V9.5M10 13V4.5M14.2 13V7.2"/></svg><span>데이터분석관</span>';
    var box = el('section', { id: 'anBox', role: 'dialog', 'aria-label': '데이터분석관', hidden: '' });
    box.innerHTML = '<header class="an-top"><div><b>데이터분석관</b><span>공홈 판매 · 광고 클릭률 · 상품을 말로 물어보세요</span></div><div class="an-ic"><button type="button" id="anNew">새 대화</button><button type="button" id="anX" aria-label="닫기">✕</button></div></header><div id="anLog" role="log" aria-live="polite"></div><form id="anForm"><textarea id="anQ" rows="1" placeholder="예: 지난주 코페리 분석해줘" aria-label="질문" autocomplete="off" enterkeyhint="send" maxlength="300"></textarea><button id="anSend" type="submit">보내기</button></form>';
    host.appendChild(pill); host.appendChild(box);
    var log = box.querySelector('#anLog'), q = box.querySelector('#anQ'), send = box.querySelector('#anSend'), A = null, ctx = null, said = [], busy = false, seq = 0;

    function el(t, at) { var e = document.createElement(t); Object.keys(at || {}).forEach(function (k) { e.setAttribute(k, at[k]); }); return e; }
    function txt(e, s) {   // **굵게** 만 알아듣는다. 나머지는 글자 그대로
      String(s).split(/\*\*/).forEach(function (x, i) { if (!x) return; if (i % 2) { var b = document.createElement('b'); b.textContent = x; e.appendChild(b); } else e.appendChild(document.createTextNode(x)); });
      return e;
    }
    function down() { log.scrollTop = log.scrollHeight; }
    function bubble(cls) { var d = document.createElement('div'); d.className = cls; log.appendChild(d); return d; }

    function chips(box2, list) {
      if (!list || !list.length) return;
      var d = el('div', { class: 'chips' });
      list.forEach(function (c) { var b = el('button', { type: 'button' }); b.textContent = c[0]; b.onclick = function () { ask(c[1], c[2]); }; d.appendChild(b); });
      box2.appendChild(d);
    }
    function table(b) {
      var w = el('div', { class: 'tw' }), t = el('table'), h = el('thead'), tr = el('tr');
      b.cols.forEach(function (c) { var x = el('th', { scope: 'col' }); x.textContent = c; tr.appendChild(x); });
      h.appendChild(tr); t.appendChild(h); var bd = el('tbody');
      b.rows.forEach(function (r) {
        var rr = el('tr');
        r.forEach(function (c) {
          var td = el('td'); if (c.name) td.classList.add('nm'); if (c.bold) td.classList.add('b'); if (c.low) td.classList.add('low'); if (c.title) td.title = c.title;
          if (c.ask) { var bt = el('button', { type: 'button' }); bt.textContent = c.v; bt.onclick = function () { ask(c.ask, c.set); }; td.appendChild(bt); } else td.textContent = c.v;
          rr.appendChild(td);
        });
        bd.appendChild(rr);
      });
      t.appendChild(bd); w.appendChild(t); return w;
    }
    var SVG = 'http://www.w3.org/2000/svg';
    function sv(t, at, s) { var e = document.createElementNS(SVG, t); Object.keys(at).forEach(function (k) { e.setAttribute(k, at[k]); }); if (s != null) e.textContent = s; return e; }
    function fmtV(v, u) { return u === '%' ? v.toFixed(2) + '%' : u === '원' ? won(v) : n0(v) + u; }
    function tipOf(w) { var t = el('div', { class: 'tip', hidden: '' }); w.appendChild(t); return t; }
    function tipShow(t, w, frac, strong, rest) { t.textContent = ''; var b = document.createElement('b'); b.textContent = strong; t.appendChild(b); t.appendChild(document.createTextNode(' ' + rest)); t.hidden = false; var W = w.clientWidth, hw = t.offsetWidth / 2; t.style.left = Math.max(hw, Math.min(W - hw, frac * W)) + 'px'; }
    function day(x) { return x.plain ? x.d + '요일' : mdw(x.d); }
    function bars(b) {
      var w = el('div', { class: 'cw' }), c = el('div', { class: 'ct' }); c.textContent = b.title; w.appendChild(c);
      var W = 420, H = 128, top = 18, base = 106, D = b.data, n = D.length, mx = Math.max.apply(null, D.map(function (x) { return x.v; })) || 1, step = W / n, bw = Math.max(1, Math.min(24, step - Math.max(1, Math.min(6, step * .28)))), today = todayK();
      var s = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': b.title }), t = tipOf(w), hiI = D.reduce(function (a, x, i) { return x.v > D[a].v ? i : a; }, 0);
      s.appendChild(sv('line', { x1: 0, x2: W, y1: base + .5, y2: base + .5, stroke: '#d8d5cc', 'stroke-width': 1 }));
      D.forEach(function (x, i) {
        var h = Math.max(x.v > 0 ? 1.5 : 0, (base - top) * x.v / mx), X = i * step + (step - bw) / 2, r = Math.min(4, bw / 2, h), g = sv('g', { tabindex: 0, 'aria-label': day(x) + ' ' + fmtV(x.v, b.unit) });
        var p = sv('path', { class: 'bar' + (x.d === today ? ' now' : ''), d: h ? 'M' + X + ' ' + base + 'V' + (base - h + r) + 'Q' + X + ' ' + (base - h) + ' ' + (X + r) + ' ' + (base - h) + 'H' + (X + bw - r) + 'Q' + (X + bw) + ' ' + (base - h) + ' ' + (X + bw) + ' ' + (base - h + r) + 'V' + base + 'Z' : 'M0 0' });
        g.appendChild(p); g.appendChild(sv('rect', { class: 'hit', x: i * step, y: 0, width: step, height: H }));
        var on = function () { p.classList.add('on'); tipShow(t, w, (i + .5) / n, fmtV(x.v, b.unit), day(x) + (x.d === today ? ' 진행 중' : '')); }, off = function () { p.classList.remove('on'); t.hidden = true; };
        g.addEventListener('pointerenter', on); g.addEventListener('pointerleave', off); g.addEventListener('focus', on); g.addEventListener('blur', off); s.appendChild(g);
        if (n <= 8 || i === 0 || i === n - 1) s.appendChild(sv('text', { x: n <= 8 ? (i + .5) * step : i === 0 ? 0 : W, y: base + 16, 'text-anchor': n <= 8 ? 'middle' : i === 0 ? 'start' : 'end' }, x.plain ? x.d : md(x.d)));
      });
      if (D[hiI].v) s.appendChild(sv('text', { class: 'v', x: Math.max(22, Math.min(W - 22, (hiI + .5) * step)), y: top - 5, 'text-anchor': 'middle' }, fmtV(D[hiI].v, b.unit)));
      w.appendChild(s);
      if (!D[0].plain) w.appendChild(more(['날짜', b.title.replace(/^날짜별 /, '')], D.map(function (x) { return [{ v: mdw(x.d) + (x.d === today ? ' 진행 중' : '') }, { v: fmtV(x.v, b.unit) }]; })));
      return w;
    }
    function more(cols, rows) { var d = el('details'), s = el('summary'); s.textContent = '숫자로 보기'; d.appendChild(s); d.appendChild(table({ cols: cols, rows: rows })); return d; }
    function line(b) {   // 브랜드마다 한 줄씩 (작은 그래프) — 축은 같은 눈금
      var w = el('div'), all = []; b.series.forEach(function (s) { s.data.forEach(function (x) { if (x.v != null) all.push(x.v); }); });
      var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), padv = (hi - lo) * .18 || .1; lo = Math.max(0, lo - padv); hi += padv;
      b.series.forEach(function (se) {
        var c = el('div', { class: 'cw' }), cap = el('div', { class: 'ct' }); cap.textContent = (b.series.length > 1 ? se.name + ' ' : '') + b.title; c.appendChild(cap);
        var W = 420, H = b.series.length > 2 ? 74 : 112, top = 14, base = H - 20, n = se.data.length, X = function (i) { return n === 1 ? W / 2 : 5 + i * (W - 10) / (n - 1); }, Y = function (v) { return base - (v - lo) / (hi - lo) * (base - top); };
        var s = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': cap.textContent }), t = tipOf(c), d = '', pen = false;
        s.appendChild(sv('line', { x1: 0, x2: W, y1: base + .5, y2: base + .5, stroke: '#e5e2d9', 'stroke-width': 1 }));
        se.data.forEach(function (x, i) { if (x.v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x.v).toFixed(1); pen = true; });
        s.appendChild(sv('path', { d: d, fill: 'none', stroke: '#1f2329', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
        var cross = sv('line', { x1: 0, x2: 0, y1: top - 6, y2: base, stroke: '#c9c5b8', 'stroke-width': 1, visibility: 'hidden' }), dot = sv('circle', { r: 4.5, fill: '#1f2329', stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' });
        s.appendChild(cross); s.appendChild(dot);
        var li = -1; se.data.forEach(function (x, i) { if (x.v != null) li = i; });
        if (li >= 0) { s.appendChild(sv('circle', { cx: X(li), cy: Y(se.data[li].v), r: 4, fill: '#1f2329', stroke: '#fff', 'stroke-width': 2 })); s.appendChild(sv('text', { class: 'v', x: Math.min(W, X(li) + 5), y: Math.max(10, Y(se.data[li].v) - 8), 'text-anchor': 'end' }, se.data[li].v.toFixed(2) + '%')); }
        s.appendChild(sv('text', { x: 0, y: base + 15, 'text-anchor': 'start' }, md(se.data[0].d))); s.appendChild(sv('text', { x: W, y: base + 15, 'text-anchor': 'end' }, md(se.data[n - 1].d)));
        var hit = sv('rect', { class: 'hit', x: 0, y: 0, width: W, height: H }); s.appendChild(hit);
        s.addEventListener('pointermove', function (e) {
          var r = s.getBoundingClientRect(), i = Math.round(((e.clientX - r.left) / r.width * W - 5) / ((W - 10) / Math.max(1, n - 1))); i = Math.max(0, Math.min(n - 1, i)); var x = se.data[i];
          cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
          if (x.v != null) { dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(x.v)); dot.setAttribute('visibility', 'visible'); } else dot.setAttribute('visibility', 'hidden');
          tipShow(t, c, X(i) / W, x.v == null ? '기록 없음' : x.v.toFixed(2) + '%', mdw(x.d) + (x.v == null ? '' : ' · ' + x.tip));
        });
        s.addEventListener('pointerleave', function () { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); t.hidden = true; });
        c.appendChild(s); w.appendChild(c);
      });
      if (b.series.length) w.appendChild(more(['날짜'].concat(b.series.map(function (s) { return s.name; })), b.series[0].data.map(function (x, i) { return [{ v: mdw(x.d) }].concat(b.series.map(function (s) { return { v: s.data[i].v == null ? '–' : s.data[i].v.toFixed(2) + '%' }; })); })));
      return w;
    }
    function paint(node, out) {
      node.textContent = '';
      out.forEach(function (b) {
        if (b.t === 'table') node.appendChild(table(b));
        else if (b.t === 'bars') node.appendChild(bars(b));
        else if (b.t === 'line') node.appendChild(line(b));
        else { var e = el(b.t === 'p' ? 'p' : 'div', { class: b.t === 'h' ? 'h' : b.t === 'note' ? 'nt' : '' }); node.appendChild(txt(e, b.s)); }
      });
      chips(node, out.chips);
    }

    function hello() {
      var n = bubble('an');
      paint(n, Object.assign([{ t: 'p', s: '안녕하세요, 데이터분석관이에요. 기간이나 브랜드를 편하게 말씀해 주세요. 이어서 “왜?”, “그럼 야르는?”처럼 물으셔도 돼요.' },
        { t: 'note', s: '숫자는 오피스 기록에서 계산해요. 공홈 판매는 9월 6일부터, 광고 클릭률은 6월 1일부터 있어요.' },
        { t: 'note', s: '어려운 말은 구글 AI가 질문 글만 읽고 풀어요. 매출 · 광고 숫자는 보내지 않아요.' }],
        { chips: [['지난주 어땠어?', '지난주 전체 브랜드 어땠어?'], ['클릭률 떨어진 곳', '지난주 전체 브랜드 클릭률'], ['많이 팔린 상품', '최근 7일 전체 많이 팔린 상품'], ['이번 달 코페리', '이번 달 코페리 분석해줘']] }));
    }

    var OUT = [
      [/원가|마진|순이익|영업\s*이익|남는\s*돈|공급가|단가/, '원가 · 마진 · 순이익은 여기서 다루지 않아요. 판매 수량 · 매출 · 주문 · 광고 클릭률은 물어보세요.'],
      [/재고|입고|발주|품절|리오더/, '재고 · 발주는 재고 ERP와 홈 리오더 경보에서 봐 주세요. 저는 판매와 광고를 봐 드려요.'],
      [/상세\s*페이지|방문자?|유입|조회\s*수|페이지\s*뷰|체류|이탈|장바구니/, '공홈 방문 · 상세페이지 클릭은 모으는 자료가 없어요. 광고를 보고 누른 비율(광고 클릭률)은 볼 수 있어요.']
    ];
    var HI = /^(?:안녕(?:하세요)?|하이|hi|hello|헬로|ㅎㅇ|반가워요?)[\s!~.]*$/i, TY = /^(?:고마워요?|감사(?:합니다|해요)?|땡큐|thanks?|ㄳ|수고(?:했어|하셨어요|하세요)?)[\s!~.]*$/i;
    var HELP = /(?:뭐|무엇|어떤\s*거?|뭘)\s*(?:할\s*수\s*있|물어|해\s*줄\s*수)|도움말|사용법|어떻게\s*(?:써|사용|물어)|help/i;

    function askBack(node, msg, list) { paint(node, Object.assign([{ t: 'p', s: msg }], { chips: list })); }

    async function ask(text, set) {
      text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (!text || busy) return;
      busy = true; send.disabled = true; var my = ++seq;
      var m = bubble('me'); m.textContent = text;
      var node = bubble('an'); node.innerHTML = '<span class="wait"><i></i><i></i><i></i>기록을 읽고 있어요</span>'; down();
      var alive = function () { return my === seq; };
      try {
        if (!A) { if (!root.AnalystData) throw new Error('자료 통로가 아직 안 열렸어요. 새로고침해 주세요'); A = Answer(root.AnalystData); }
        if (set && !set.what) set = Object.assign({ what: 'products' }, set);
        if (set) {   // 표 · 단추에서 고른 것 — 글을 다시 풀지 않는다
          var sp = merge(set, ctx, todayK()); sp.channel = 'home'; sp.sure = true; var so = await A.run(sp); if (!alive()) return;
          paint(node, so); ctx = sp; said.push(text); delete ctx.sure; delete ctx.assumed; return;
        }
        var today = todayK(), p = parse(text, ctx, today), bad = OUT.filter(function (o) { return o[0].test(text); })[0];
        if (HI.test(text)) return askBack(node, '안녕하세요. 어느 기간을 봐 드릴까요?', [['어제', '어제 전체 브랜드 어땠어?'], ['지난주', '지난주 전체 브랜드 어땠어?'], ['이번 달', '이번 달 전체 브랜드 어땠어?']]);
        if (TY.test(text)) return askBack(node, '네, 또 궁금한 게 있으면 말씀해 주세요.', ctx ? [['일별', '일별로 보여줘'], ['상품별', '상품별로']] : []);
        if (HELP.test(text)) return askBack(node, '이런 걸 볼 수 있어요. 판매 수량 · 매출 · 주문, 광고 클릭률, 많이 팔린 상품 · 뜨는 상품 · 옵션, 일별 · 요일별, 판매처별, 그리고 왜 올랐고 떨어졌는지요.', [['코페리 지난주', '지난주 코페리 분석해줘'], ['클릭률', '지난주 전체 브랜드 클릭률'], ['뜨는 상품', '최근 7일 전체 뜨는 상품'], ['왜 바뀌었나', '지난주 전체 브랜드 매출 왜 바뀌었어?']]);
        if (p.placeholder) return askBack(node, '어느 날부터 어느 날까지 볼까요? “11월 1일부터 15일까지”처럼 말씀해 주세요.', [['지난주', '지난주 ' + text.replace(/몇\s*일\s*부터|며칠\s*부터|몇\s*일\s*까지|며칠\s*까지/g, '')], ['최근 30일', '최근 30일 ' + text.replace(/몇\s*일\s*부터|며칠\s*부터|몇\s*일\s*까지|며칠\s*까지/g, '')], ['이번 달', '이번 달 ' + text.replace(/몇\s*일\s*부터|며칠\s*부터|몇\s*일\s*까지|며칠\s*까지/g, '')]]);
        if (bad) return askBack(node, bad[1], [['지난주 판매', '지난주 전체 브랜드 판매량'], ['광고 클릭률', '지난주 전체 브랜드 클릭률']]);

        var known = p.hit.what || p.hit.brands || p.hit.range || p.hit.channel;
        if (p.unknown) {
          // 1) 상품 이름인가  2) AI 에게 뜻만 물어본다  3) 알아들은 만큼만
          var nmq = p.unknown.replace(/\s*(?:자세히|상세)\s*$/, '').trim(), bs = (p.brands && p.brands.length ? p.brands : A.core.order), hits = /[a-zA-ZÀ-ɏ]|자세히|상세|\d/.test(p.unknown) || p.hit.what ? await A.findProducts(nmq, bs) : [];
          if (hits.length) { p.product = nmq; if (!p.what || p.what === 'sales' || p.what === 'overview') p.what = 'products'; }
          else {
            var ai = null; try { ai = await root.AnalystData.plan({ text: text, prev: ctx ? pub(ctx) : null, said: said.slice(-3) }); } catch (e) { ai = null; }
            if (!alive()) return;
            if (ai && ai.ok && ai.plan) {
              var a = ai.plan;
              if (a.what === 'chat') { said.push(text); return askBack(node, a.reply || '그건 제가 가진 자료로 답하기 어려워요. 판매 · 광고 쪽으로 물어봐 주세요.', [['지난주 어땠어?', '지난주 전체 브랜드 어땠어?'], ['광고 클릭률', '지난주 전체 브랜드 클릭률']]); }
              // 규칙이 읽은 날짜 · 브랜드가 있으면 그쪽을 믿는다 (날짜 계산은 규칙이 더 정확)
              p.what = p.hit.strong ? p.what : a.what; if (!p.hit.strong) p.order = '';
              if (!p.hit.brands) p.brands = a.brands;
              if (!p.hit.range && a.from && a.to) { p.from = a.from; p.to = a.to; p.label = ctx && ctx.from === a.from && ctx.to === a.to ? ctx.label : ''; if (a.cmpFrom) { p.cmpFrom = a.cmpFrom; p.cmpTo = a.cmpTo; } }
              if (a.order) p.order = a.order; if (a.channel && !p.channel) p.channel = a.channel;
              if (a.product && (a.what === 'products' || a.what === 'options' || a.what === 'daily')) { var h2 = await A.findProducts(a.product, p.brands && p.brands.length ? p.brands : A.core.order); if (h2.length) p.product = a.product; }
              known = true;
            }
          }
        }
        if (!known && !p.product && !p.what) return askBack(node, '제가 잘 못 알아들었어요. 기간 · 브랜드 · 보고 싶은 것을 말씀해 주세요. 예를 들면 “지난주 야르 클릭률”이요.', [['지난주 어땠어?', '지난주 전체 브랜드 어땠어?'], ['야르 클릭률', '지난주 야르 클릭률'], ['많이 팔린 상품', '최근 7일 전체 많이 팔린 상품']]);

        var plan = merge(p, ctx, today);
        // AI 가 준 기간이 오늘 뒤면 자른다
        if (plan.cmpFrom && plan.cmpTo > today) plan.cmpTo = today;
        var out = await A.run(plan);
        if (!alive()) return;
        paint(node, out); ctx = plan; said.push(text); if (said.length > 6) said.shift();
        if (out.ctxProduct) { ctx.product = out.ctxProduct; ctx.brands = [out.ctxBrand]; }
        delete ctx.assumed;
      } catch (e) {
        if (alive()) askBack(node, '자료를 읽다가 멈췄어요. 잠시 뒤 다시 물어봐 주세요. (' + String(e && e.message || e).slice(0, 80) + ')', [['다시 물어보기', text]]);
      } finally { if (alive()) { busy = false; send.disabled = false; } setTimeout(function () { down(); var a = m.getBoundingClientRect().top - log.getBoundingClientRect().top - 10; if (a < 0) log.scrollTop += a; }, 0); }
    }
    function pub(c) { var o = {}; ['what', 'brands', 'from', 'to', 'cmpFrom', 'cmpTo', 'product', 'order', 'channel'].forEach(function (k) { if (c[k] != null && c[k] !== '') o[k] = c[k]; }); return o; }

    var small = window.matchMedia('(max-width:640px)'), scrollY0 = 0;
    function fit() { var v = window.visualViewport; if (box.hidden || !small.matches || !v) { box.style.height = ''; box.style.top = ''; return; } box.style.height = v.height + 'px'; box.style.top = v.offsetTop + 'px'; }
    function open(text) {
      box.hidden = false; pill.hidden = true; pill.setAttribute('aria-expanded', 'true');
      if (small.matches) { scrollY0 = window.scrollY; document.documentElement.style.overflow = 'hidden'; }
      if (!log.childElementCount) hello();
      fit(); if (!small.matches) q.focus();
      if (text) ask(text);
    }
    function close() { box.hidden = true; pill.hidden = false; pill.setAttribute('aria-expanded', 'false'); document.documentElement.style.overflow = ''; if (small.matches) window.scrollTo(0, scrollY0); else pill.focus({ preventScroll: true }); fit(); }
    pill.onclick = function () { open(); };
    box.querySelector('#anX').onclick = close;
    box.querySelector('#anNew').onclick = function () { seq++; busy = false; send.disabled = false; ctx = null; said = []; log.textContent = ''; hello(); if (!small.matches) q.focus(); };
    box.querySelector('#anForm').addEventListener('submit', function (e) { e.preventDefault(); var t = q.value; if (!t.trim() || busy) return; q.value = ''; grow(); ask(t); });
    function grow() { q.style.height = 'auto'; q.style.height = Math.min(110, q.scrollHeight + 2) + 'px'; }
    q.addEventListener('input', grow);
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); box.querySelector('#anForm').requestSubmit(); } });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !e.isComposing) { e.stopPropagation(); close(); } });
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit); }
    // 다른 화면으로 옮겨 가면 휴대폰에서는 닫는다 (뒤로 가기)
    window.addEventListener('popstate', function () { if (!box.hidden && small.matches) close(); });
    root.Analyst = { open: open, close: close, ask: ask };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { parse: parse, merge: merge, findRanges: findRanges, Answer: Answer, todayK: todayK };
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
