/* 대표 이름 지킴이 — 대표 이름은 대표(관리자) PIN 으로 들어온 기기에서만
   (2026-11-25 사장님 "2580으로 핀번호치면 대표들 컴터 설정은 안뜨게 해야해 대표 핀으로만 들어가야 대표만 뜨는거야 …
    지금 2580으로 대표 컴터 설정해놓은 컴터 있으면 로그아웃 강제로 시켜줘")
   · 왜: '나는 ○○○' 이름(brightbeed_diary_me)은 로그아웃해도 그 PC 에 남아서, 대표 이름으로 해 둔 PC 에 2580 으로 들어오면
     전략팀 · 기밀 숫자 · 디자인팀 · 대표 알림이 그대로 열렸다.
   · check() = 2580 으로 들어와 있는데 이름이 대표 → 이름 · 로그인을 지운다(강제 로그아웃). 화면을 열 때(머리에서) · 5초마다 · 다시 볼 때 · 다른 탭에서 바뀔 때.
   · drop()  = 2580 을 막 넣었을 때 PIN 화면이 부른다(로그인 값을 쓰기 전에) — 대표 이름만 지우고 들여보낸다.
   · 로그아웃만 한 대표 PC 는 건드리지 않는다 — 대표 PIN 을 넣으면 그 이름 그대로.
   · 대표 이름이 풀리면 열려 있던 다른 탭 · 오피스 화면도 새로 열린다(그려 둔 대표 화면을 지우려고).
   지희선 · 박시호는 대상 아님 (2580 으로 쓰는 직원). 모든 화면의 <head> 맨 앞, 다른 스크립트보다 먼저 부른다. */
(function () {
  'use strict';
  if (window.BossGuard) return;
  var BOSS = ['전승훈', '전수빈'];   // index.html STAFF 의 ceo · EXEC_ALLOWED 와 같게
  var ME = 'brightbeed_diary_me', KEY = 'brightbeed_unlocked', ROLE = 'brightbeed_role', FLAG = 'bb_boss_out';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } }
  function isBoss(n) { return BOSS.indexOf(String(n == null ? '' : n).trim()) >= 0; }
  function bad() { return get(KEY) === '1' && get(ROLE) !== 'master' && isBoss(get(ME)); }
  function drop() { if (!isBoss(get(ME))) return false; del(ME); return !isBoss(get(ME)); }
  function check() {
    if (!bad()) return false;
    del(ME); del(KEY); del(ROLE);
    if (bad()) return false;   // 못 지우는 브라우저 — 새로 열기를 되풀이하지 않게
    try { sessionStorage.setItem(FLAG, '1'); } catch (e) { /* noop */ }
    return true;
  }
  /* 잠금화면에 한 번 보일 안내 */
  function note() {
    try { if (sessionStorage.getItem(FLAG) !== '1') return ''; sessionStorage.removeItem(FLAG); } catch (e) { return ''; }
    return '대표 이름은 대표 PIN 으로만 쓸 수 있어요.\n다시 로그인해 주세요.';
  }
  window.BossGuard = { isBoss: isBoss, bad: bad, drop: drop, check: check, note: note };

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
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) tick(); });
  window.addEventListener('storage', function (e) {
    if (e.key && e.key !== ME && e.key !== KEY && e.key !== ROLE) return;
    if (e.key === ME && isBoss(e.oldValue) && !isBoss(e.newValue)) reload(); else tick();
  });
})();
