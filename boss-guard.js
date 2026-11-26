/* 대표 이름 지킴이 — 대표 이름은 대표(관리자) PIN 으로 들어온 기기에서만
   (2026-11-25 사장님 "보기 PIN 으로 핀번호치면 대표들 컴터 설정은 안뜨게 해야해 대표 핀으로만 들어가야 대표만 뜨는거야 …
    지금 보기 PIN 으로 대표 컴터 설정해놓은 컴터 있으면 로그아웃 강제로 시켜줘")
   · 왜: '나는 ○○○' 이름(brightbeed_diary_me)은 로그아웃해도 그 PC 에 남아서, 대표 이름으로 해 둔 PC 에 보기 PIN 으로 들어오면
     전략팀 · 기밀 숫자 · 디자인팀 · 대표 알림이 그대로 열렸다.
   · check() = 보기 PIN 으로 들어와 있는데 이름이 대표 → 이름 · 로그인을 지운다(강제 로그아웃). 화면을 열 때(머리에서) · 5초마다 · 다시 볼 때 · 다른 탭에서 바뀔 때.
   · drop()  = 보기 PIN 을 막 넣었을 때 PIN 화면이 부른다(로그인 값을 쓰기 전에) — 대표 이름만 지우고 들여보낸다.
   · 모두 로그아웃 (같은 날 사장님 "전수빈,전승훈으로 로그인된거 다 로그아웃시켜줘. 바로 즉시") — 대표 이름에는 로그인 표(bb_boss_tok)가 있어야 한다.
     표가 없거나(2026-11-25 전에 고른 이름) 서버 값(app_kv 'boss_logout' 의 value.token)과 다르면 대표 PIN 으로 들어온 기기도 로그아웃.
     다시 다 내보내려면 서버에서 그 token 만 새 글자로 바꾼다 — 켜 둔 화면도 알림선으로 바로, 늦어도 20초(숨은 탭은 1분쯤). 대표 이름 기기만 묻는다.
   · 로그아웃만 한 대표 PC 는 건드리지 않는다 — 대표 PIN 을 넣으면 그 이름 그대로.
   · 대표 이름이 풀리면 열려 있던 다른 탭 · 오피스 화면도 새로 열린다(그려 둔 대표 화면을 지우려고).
   지희선 · 박시호는 대상 아님 (보기 PIN 으로 쓰는 직원). 모든 화면의 <head> 맨 앞, 다른 스크립트보다 먼저 부른다. */
(function () {
  'use strict';
  if (window.BossGuard) return;
  var BOSS = ['전승훈', '전수빈'];   // index.html STAFF 의 ceo · EXEC_ALLOWED 와 같게
  var ME = 'brightbeed_diary_me', KEY = 'brightbeed_unlocked', ROLE = 'brightbeed_role', FLAG = 'bb_boss_out', TOK = 'bb_boss_tok';
  /* 보기 PIN 을 바꿀 때 VIEWER_PIN_VER 를 올리면 보기 PIN 기기만 모두 로그아웃 (관리자 PIN 기기는 그대로).
     2026-11-26 사장님 "뷰어들 핀번호 0017로 변경. 뷰어들 전부 로그아웃. 대표 제외" → '2' */
  var VVER = 'brightbeed_viewer_ver', VIEWER_PIN_VER = '2';
  var why = '1', srv = '';   // srv = 서버가 지금 내놓은 로그인 표
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } }
  function isBoss(n) { return BOSS.indexOf(String(n == null ? '' : n).trim()) >= 0; }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } }
  function oldViewer() { return get(KEY) === '1' && get(ROLE) !== 'master' && get(VVER) !== VIEWER_PIN_VER; }
  /* 보기 PIN 으로 들어올 때 PIN 화면이 부른다 (권한 · 잠금 해제 값보다 먼저) */
  function viewerIn() { put(VVER, VIEWER_PIN_VER); }
  function bad() {
    if (oldViewer()) { why = '3'; return true; }
    if (!isBoss(get(ME))) return false;
    var t = get(TOK);
    if (!t || (srv && t !== 'new' && t !== srv)) { why = '2'; return true; }   // 모두 로그아웃
    why = '1';
    return get(KEY) === '1' && get(ROLE) !== 'master';
  }
  /* 대표 이름을 고를 때 — 이름을 쓰기 전에 부른다 ('new' 는 서버 값을 처음 받으면 그 값이 된다) */
  function mark(n) { if (isBoss(n)) put(TOK, srv || 'new'); }
  function drop() { if (!isBoss(get(ME))) return false; del(ME); return !isBoss(get(ME)); }
  function check() {
    if (!bad()) return false;
    var w = why;
    if (w === '3') { del(KEY); del(ROLE); }   // 이름은 그대로 — 새 PIN 만 다시 넣으면 된다
    else { del(ME); del(KEY); del(ROLE); del(TOK); }
    if (bad()) return false;   // 못 지우는 브라우저 — 새로 열기를 되풀이하지 않게
    try { sessionStorage.setItem(FLAG, w); } catch (e) { /* noop */ }
    return true;
  }
  /* 잠금화면에 한 번 보일 안내 */
  function note() {
    var w = '';
    try { w = sessionStorage.getItem(FLAG) || ''; if (!w) return ''; sessionStorage.removeItem(FLAG); } catch (e) { return ''; }
    if (w === '3') return '접속 PIN 이 바뀌었어요.\n새 PIN 으로 다시 들어와 주세요.';
    if (w === '2') return '대표 계정을 모두 로그아웃했어요.\n대표 PIN 으로 다시 들어와 주세요.';
    return '대표 이름은 대표 PIN 으로만 쓸 수 있어요.\n다시 로그인해 주세요.';
  }
  window.BossGuard = { isBoss: isBoss, bad: bad, drop: drop, check: check, note: note, mark: mark, viewerIn: viewerIn, VIEWER_PIN_VER: VIEWER_PIN_VER };

  /* PIN 을 바꾼 뒤에도 새로고침 안 한 탭이 옛 PIN 을 몇 시간씩 보내 화면이 멈춰 있던 것 (2026-11-26 0017 변경 뒤 사무실 PC 탭) —
     프록시가 PIN 을 거절(401)하면 두 번 본 뒤(15초 넘게 떨어져) 화면을 한 번 새로 연다. 새 코드가 새 PIN 을 들고 오고,
     보기 PIN 판이 바뀌었으면 위 check() 가 잠금 화면으로 보낸다. 새로 열어도 또 거절이면 30분 동안 다시 안 연다(되풀이 막기) */
  (function () {
    var of = window.fetch; if (!of || of.__bbPin) return;
    var first = 0, RK = 'bb_pin401_reload';
    function hasPin(o) { try { var h = o && o.headers; if (!h) return false; return !!(typeof h.get === 'function' ? h.get('X-Brightbeed-PIN') : (h['X-Brightbeed-PIN'] || h['x-brightbeed-pin'])); } catch (e) { return false; } }
    function on401() {
      var now = Date.now();
      if (!first) { first = now; return; }
      if (now - first < 15000) return;
      var last = +(get(RK) || 0); if (now - last < 30 * 60e3) return;
      put(RK, String(now)); reload();
    }
    var f = function (i, o) {
      var p = of.apply(this, arguments);
      if (hasPin(o)) p.then(function (r) { if (r && r.status === 401) on401(); else if (r && r.ok) first = 0; }, function () { /* noop */ });
      return p;
    };
    f.__bbPin = true; window.fetch = f;
  })();

  var again = false;
  function reload() {
    if (again) return; again = true;
    try { if (window.top !== window) { window.top.location.reload(); return; } } catch (e) { /* 다른 출처 안 — 이 화면만 */ }
    location.reload();
  }
  /* 한 번 보고 바로 내보내지 않는다 — 다른 탭에서 대표 PIN 을 넣는 중간일 수 있다 */
  var t = 0;
  function tick() { if (t || !bad()) return; t = setTimeout(function () { t = 0; if (check()) reload(); }, 500); }

  if (check() && window.parent !== window) reload();   // 혼자 열린 화면은 아직 아무것도 안 그렸으니 그대로 잠금 화면으로 간다
  setInterval(tick, 5000);

  /* 서버의 로그인 표 — 대표 이름 기기의 바깥 화면만 묻는다. 못 읽으면 아무것도 안 한다 */
  var URL_ = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/rest/v1/app_kv?key=eq.boss_logout&select=value';
  var AK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreWpreGJxc3lqb3FwdXF3b2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjI2NzEsImV4cCI6MjA5Mzk5ODY3MX0.C8WIGqf-zIYkCq0dGWTMjIYuPM-IVInMn1p6FaWbVKA';
  var asking = false, hooked = false;
  function ask() {
    if (asking || !isBoss(get(ME))) return;
    asking = true;
    fetch(URL_, { headers: { apikey: AK, Authorization: 'Bearer ' + AK }, cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var v = j && j[0] && j[0].value && j[0].value.token;
      if (typeof v !== 'string' || !v || v === 'new') return;
      srv = v;
      if (get(TOK) === 'new') put(TOK, v);
      tick();
    }).catch(function () { /* 다음 차례에 다시 */ }).then(function () { asking = false; });
  }
  function hook() { if (hooked || !window.OfficeLive) return; hooked = true; try { window.OfficeLive.on(['app_kv'], ask); } catch (e) { /* noop */ } }
  if (window.parent === window) {
    setTimeout(ask, 500); setInterval(function () { hook(); ask(); }, 20000);
    window.addEventListener('load', function () { hook(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ask(); });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) tick(); });
  window.addEventListener('storage', function (e) {
    if (e.key && e.key !== ME && e.key !== KEY && e.key !== ROLE) return;
    if (e.key === ME && isBoss(e.oldValue) && !isBoss(e.newValue)) reload(); else tick();
  });
})();
