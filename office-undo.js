/* 오피스 되돌리기 — 어느 화면이든, 무엇이든 (2026-11-23 사장님 "오피스앱 뭐든 어디든 되돌리기 기능 가능하게 해줘")

   · 사람이 누르거나 입력한 뒤 저장소(Supabase)에 쓰는 요청마다 x-office-act(동작 번호) 머리를 붙인다.
     저장소 트리거(office_undo_log)가 그 동작이 바꾼 줄의 전 · 후를 office_undo 에 남긴다 (3일 보관).
   · 되돌리기 = office_undo_apply(동작 번호) — 그 동작이 바꾼 줄을 거꾸로 되돌린다. 그사이 다른 사람이 같은 칸을 또 바꿨으면 그 줄은 그대로 둔다.
     되돌리기 요청에도 새 번호를 붙이므로 '다시 하기'는 그 번호를 되돌리면 된다.
   · Ctrl+Z 되돌리기 · Ctrl+Y(또는 Ctrl+Shift+Z) 다시 하기 — 글자 칸 안에선 브라우저 글자 되돌리기 그대로, 화면이 먼저 처리한 키는 건드리지 않는다.
     저장되면 왼쪽 아래 [↶ 되돌리기] 띠 (휴대폰은 가운데), 오피스 홈 맨 위 막대에도 [↶ 되돌리기].
   · 되돌린 뒤엔 화면을 새로 불러온다 (화면이 들고 있던 옛 값으로 다시 덮어쓰지 않게).
   · 식스샵 · 구글시트 · 메일 · 인스타 같은 바깥으로 보낸 일이 섞인 동작은 되돌리지 않는다 (오피스 기록만 되돌리면 어긋남).
   · 화면이 따로 칸 단위 되돌리기를 갖고 있으면 그 요청은 뺀다: <script src="office-undo.js" data-skip="rpc/(erp_cell_edit|erp_fmt_set)">.
   읽기만 하는 GET 과 사람 손이 안 닿은 자동 작업(맥미니 · 서버)은 남기지 않는다. */
(function () {
  'use strict';
  if (window.OfficeUndo) return;
  var SB = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreWpreGJxc3lqb3FwdXF3b2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjI2NzEsImV4cCI6MjA5Mzk5ODY3MX0.C8WIGqf-zIYkCq0dGWTMjIYuPM-IVInMn1p6FaWbVKA';
  var me = document.currentScript;
  var SKIP = null;
  try { var sk = me && me.getAttribute('data-skip'); if (sk) SKIP = new RegExp(sk); } catch (e) { SKIP = null; }
  var SS = 'office_undo_v1:' + location.pathname, NOTE = 'office_undo_note:' + location.pathname;
  var MAX = 30, KEEP = 3 * 86400000, WIN = 20000;
  var of = window.fetch ? window.fetch.bind(window) : null;
  if (!of) return;

  /* ── 쌓아 둔 동작 (이 탭 · 이 화면) ── */
  var stack = [], redo = [];
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* noop */ } }
  try {
    var saved = JSON.parse(ssGet(SS) || 'null');
    if (saved) { var now0 = Date.now(), fresh = function (x) { return x && x.id && now0 - (+x.at || 0) < KEEP; }; stack = (saved.u || []).filter(fresh); redo = (saved.r || []).filter(fresh); }
  } catch (e) { stack = []; redo = []; }
  function save() {
    while (stack.length > MAX) stack.shift();
    while (redo.length > MAX) redo.shift();
    var slim = function (x) { return {id: x.id, label: x.label, area: x.area, n: x.n, at: x.at, ext: !!x.ext}; };
    ssSet(SS, JSON.stringify({u: stack.map(slim), r: redo.map(slim)}));
    paintTop();
  }

  /* ── 동작 = 사람이 한 번 누르거나 입력한 것 (그 뒤 20초 안 저장 · 이어지는 저장) ── */
  var act = null;
  function newId() {
    try { if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, ''); } catch (e) { /* noop */ }
    return (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32);
  }
  function txt(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function cut(s) { s = txt(s); return s.length > 18 ? s.slice(0, 17) + '…' : s; }
  function fieldOf(el) { return el && el.closest ? el.closest('input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]),textarea,select,[contenteditable=""],[contenteditable="true"]') : null; }
  function editable(el) {
    if (!el || !el.closest) return false;
    if (el.isContentEditable) return true;
    var f = fieldOf(el);
    return !!f && f.tagName !== 'SELECT' && !f.readOnly && !f.disabled;
  }
  function labelOf(t, f) {
    try {
      if (f) return cut(f.getAttribute('aria-label') || f.getAttribute('placeholder') || f.getAttribute('title') || (f.labels && f.labels[0] && f.labels[0].innerText) || f.name || '');
      var b = t.closest && t.closest('button,a,[role=button],[role=menuitem],[role=option],label,summary,[onclick],[data-act],td,th,li');
      if (!b) return '';
      return cut(b.getAttribute('aria-label') || b.innerText || b.getAttribute('title') || '');
    } catch (e) { return ''; }
  }
  function ours(t) { return !!(t && t.closest && t.closest('#ouBar,#ouTop')); }
  function begin(e) {
    if (!e.isTrusted || ours(e.target)) return;
    if (e.type === 'keydown') {
      if (/^(Shift|Control|Alt|Meta|CapsLock|Tab|Escape|F\d+|Arrow\w+|Home|End|PageUp|PageDown)$/.test(e.key || '')) return;
      if ((e.ctrlKey || e.metaKey) && /^[zZyYcCaAfF]$/.test(e.key || '')) return;
    }
    var f = fieldOf(e.target), now = Date.now();
    if (f && act && act.anchor === f && now - act.last < 120000) { act.last = now; return; }   // 같은 칸에 이어서 입력 = 같은 동작
    act = {id: newId(), label: labelOf(e.target, f), at: now, last: now, lastW: 0, anchor: f || null, ext: false, pend: 0, n: 0, tm: 0, w: 0};
  }
  window.addEventListener('pointerdown', begin, true);
  window.addEventListener('keydown', begin, true);
  function live() {
    if (!act) return null;
    var now = Date.now();
    return now - act.last < WIN || act.pend > 0 || now - act.lastW < 5000 ? act : null;
  }

  /* ── 바깥으로 보낸 일인가 (읽기만 하는 POST 는 빼고) ── */
  var READ_ACT = /^(read|ping|pair|list|tabs|meta|get|status|scan|preview|search|find|check|peek)/i;
  var READ_URL = /\/(doc\/analyze|report|pro-stock|health|erp\/po-match|erp\/audit|kd\/orders)(\b|\?|$)/;
  function isExternalWrite(url, m, body) {
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
    if (/^(blob|data):/.test(url)) return false;
    try { var u = new URL(url, location.href); if (u.origin === location.origin) return false; if (READ_URL.test(u.pathname)) return false; } catch (e) { return false; }
    if (typeof body === 'string' && body.length < 20000) { try { var j = JSON.parse(body); if (j && typeof j.action === 'string' && READ_ACT.test(j.action)) return false; } catch (e) { /* 글 아님 */ } }
    return true;
  }

  /* ── 저장 요청에 동작 번호 붙이기 ── */
  window.fetch = function (input, init) {
    var a;
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      var m = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return of(input, init);
      a = live();
      if (!a) return of(input, init);
      if (url.indexOf(SB) === 0) {
        if (url.indexOf('/rest/v1/') < 0) { if (url.indexOf('/storage/v1/') < 0) a.ext = true; return of(input, init); }   // 엣지 함수 = 바깥 일(인스타 · 메일 등)
        if (/\/rpc\/office_undo_/.test(url) || (SKIP && SKIP.test(url))) return of(input, init);
        var h = new Headers((init && init.headers) || (input && typeof input !== 'string' && input.headers) || undefined);
        h.set('x-office-act', a.id);
        init = Object.assign({}, init || {}, {headers: h});
        a.pend++; a.w++; a.lastW = Date.now();
        var p = of(input, init);
        p.then(function () { settle(a); }, function () { settle(a); });
        return p;
      }
      if (isExternalWrite(url, m, init && init.body)) a.ext = true;
    } catch (e) { /* 붙이지 못하면 그냥 보냄 */ }
    return of(input, init);
  };
  function settle(a) {
    a.pend = Math.max(0, a.pend - 1);
    a.lastW = Date.now();
    clearTimeout(a.tm);
    a.tm = setTimeout(function () { check(a); }, 700);
  }
  function rpc(fn, args, hdr) {
    var h = {'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY};
    if (hdr) h['x-office-act'] = hdr;
    return of(SB + '/rest/v1/rpc/' + fn, {method: 'POST', headers: h, body: JSON.stringify(args), cache: 'no-store'})
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }
  var AREA = [
    [/^diary_/, '업무일지'], [/^withdrawal_/, '출금 요청'], [/^(leave_|staff_)/, '인사'], [/^cs_/, 'CS'], [/^design_/, '디자인'],
    [/^wht_/, '원천세'], [/^erp_/, '재고 ERP'], [/^mdx_|^md_/, 'MD팀'], [/^seeding_/, '시딩'], [/^model_/, '모델 지원자'], [/^exec_/, '금고'],
    [/^fixed_costs/, '고정비'], [/^ceo_/, '대표 캘린더'], [/^lg_/, '물류'], [/^dlog_/, '업무 기록'], [/^cof_/, '코페리 문서'], [/^sns_|^ggul_/, 'SNS'],
    [/^feed_|^ig_feed/, '피드'], [/^app_kv|^private_kv/, '설정'], [/^naver_/, '네이버 카페']
  ];
  function areaOf(tbls) {
    var names = [];
    (tbls || []).forEach(function (t) { var hit = AREA.filter(function (x) { return x[0].test(t); })[0], n = hit ? hit[1] : '오피스'; if (names.indexOf(n) < 0) names.push(n); });
    return names.slice(0, 2).join(' · ') || '오피스';
  }
  function check(a) {
    if (a.pend > 0) return;
    rpc('office_undo_peek', {p_act: a.id}).then(function (d) {
      var n = +(d && d.n) || 0;
      if (!n) return;
      a.n = n; a.area = areaOf(d.tbls);
      var i = stack.map(function (x) { return x.id; }).indexOf(a.id);
      if (i < 0) { stack.push(a); redo = []; } else stack[i] = a;
      save();
      if (a.ext) return;   // 바깥 일이 섞임 — 되돌리기 단추를 안 띄움
      if (a.anchor && document.activeElement === a.anchor) { a.wait = true; return; }   // 입력하는 동안엔 안 띄움 (칸을 떠나면)
      showDone(a);
    }, function () { /* 못 물어보면 조용히 */ });
  }
  document.addEventListener('focusout', function (e) {
    var a = stack[stack.length - 1];
    if (a && a.wait && a.anchor === e.target) { a.wait = false; setTimeout(function () { if (stack[stack.length - 1] === a) showDone(a); }, 900); }
  }, true);

  /* ── 되돌리기 · 다시 하기 ── */
  var busy = false;
  function who() { try { return localStorage.getItem('brightbeed_diary_me') || ''; } catch (e) { return ''; } }
  function undo() {
    var a = stack[stack.length - 1];
    if (!a) { bar('되돌릴 게 없어요 — 이 화면에서 저장한 일만 되돌려요', null, 3500); return; }
    if (a.ext) {
      stack.pop(); save();
      bar((a.label ? '‘' + a.label + '’ 은(는) ' : '이 일은 ') + '식스샵 · 구글시트 · 메일처럼 바깥에도 보내진 일이라 되돌릴 수 없어요', null, 6000);
      return;
    }
    run(a, false);
  }
  function redoFn() {
    var a = redo[redo.length - 1];
    if (!a) { bar('다시 할 게 없어요', null, 3000); return; }
    run(a, true);
  }
  function run(a, isRedo) {
    if (busy) return;
    busy = true;
    var rid = newId();
    bar(isRedo ? '다시 하는 중…' : '되돌리는 중…', null, 0);
    rpc('office_undo_apply', {p_act: a.id, p_who: who() || null}, rid).then(function (d) {
      busy = false;
      var n = +(d && d.n) || 0, sk = +(d && d.skip) || 0, fl = +(d && d.fail) || 0;
      (isRedo ? redo : stack).pop();
      var back = {id: rid, label: a.label, area: a.area, n: n, at: Date.now()};
      if (n) (isRedo ? stack : redo).push(back);
      save();
      var msg = !n ? (sk ? '그사이 다른 사람이 같은 곳을 바꿔서 그대로 뒀어요' : (isRedo ? '다시 할 게 없었어요' : '되돌릴 게 없었어요'))
        : (isRedo ? '다시 했어요 · ' : '되돌렸어요 · ') + a.area + ' ' + n + '건' + (sk ? ' · ' + sk + '건은 그사이 바뀌어 그대로' : '') + (fl ? ' · ' + fl + '건 못 함' : '');
      if (!n) { bar(msg, null, 5000); return; }
      ssSet(NOTE, JSON.stringify({msg: msg, at: Date.now(), redo: !isRedo}));
      bar(msg + ' — 화면을 새로 불러와요', null, 0);
      setTimeout(function () { location.reload(); }, 650);   // 화면이 들고 있던 옛 값으로 다시 덮지 않게
    }, function () {
      busy = false;
      bar((isRedo ? '다시 하지' : '되돌리지') + ' 못했어요 — 인터넷 연결을 보고 다시 해 주세요', null, 5000);
    });
  }

  /* ── 키보드 ── */
  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.isComposing || e.altKey || !(e.ctrlKey || e.metaKey)) return;
    var k = String(e.key || '').toLowerCase(), isU = k === 'z' && !e.shiftKey, isR = k === 'y' || (k === 'z' && e.shiftKey);
    if (!isU && !isR) return;
    if (editable(e.target)) return;   // 글자 칸 안 = 글자 되돌리기
    if (isU ? !stack.length : !redo.length) return;
    e.preventDefault();
    if (isU) undo(); else redoFn();
  });

  /* ── 띠 · 맨 위 단추 ── */
  var el = null, hideT = 0;
  function css() {
    if (document.getElementById('ouCss')) return;
    var s = document.createElement('style');
    s.id = 'ouCss';
    s.textContent = '#ouBar{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147482000;display:flex;align-items:center;gap:8px;max-width:min(560px,calc(100vw - 32px));padding:7px 7px 7px 14px;border-radius:12px;background:#0f172a;color:#f8fafc;font:600 13px/1.35 Pretendard,"Pretendard Variable",-apple-system,"Malgun Gothic",sans-serif;box-shadow:0 12px 32px rgba(15,23,42,.28);opacity:0;transform:translateY(10px);transition:opacity .16s,transform .16s;pointer-events:none}'
      + '#ouBar.on{opacity:1;transform:none;pointer-events:auto}#ouBar .t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '#ouBar button{flex:none;height:32px;padding:0 12px;border:0;border-radius:8px;background:#fff;color:#0f172a;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap}'
      + '#ouBar button:hover{background:#e2e8f0}#ouBar .x{background:transparent;color:#94a3b8;padding:0 9px;font-size:15px}#ouBar .x:hover{background:rgba(255,255,255,.08);color:#fff}'
      + '#ouTop{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 11px;border-radius:9px;border:1px solid rgba(15,23,42,.12);background:#fff;color:#334155;font:600 12.5px/1 inherit;cursor:pointer;white-space:nowrap}'
      + '#ouTop:hover{border-color:#94a3b8;color:#0f172a}#ouTop[hidden]{display:none}'
      + '@media (max-width:720px){#ouBar{left:50%;transform:translate(-50%,10px);bottom:calc(74px + env(safe-area-inset-bottom,0px));max-width:calc(100vw - 24px)}#ouBar.on{transform:translate(-50%,0)}#ouTop .l{display:none}}'
      + '@media print{#ouBar,#ouTop{display:none}}';
    (document.head || document.documentElement).appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function bar(msg, btn, ms) {
    if (!document.body) return;
    css();
    if (!el) {
      el = document.createElement('div');
      el.id = 'ouBar';
      el.setAttribute('role', 'status');
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.k === 'u') undo(); else if (b.dataset.k === 'r') redoFn(); else hide();
      });
      el.addEventListener('mouseenter', function () { clearTimeout(hideT); });
      el.addEventListener('mouseleave', function () { if (el.dataset.ms > 0) hideT = setTimeout(hide, 2500); });
      document.body.appendChild(el);
    }
    el.innerHTML = '<span class="t">' + esc(msg) + '</span>'
      + (btn === 'u' ? '<button type="button" data-k="u" title="되돌리기 (Ctrl+Z)">↶ 되돌리기</button>' : btn === 'r' ? '<button type="button" data-k="r" title="다시 하기 (Ctrl+Y)">↷ 다시 하기</button>' : '')
      + '<button type="button" class="x" aria-label="닫기">✕</button>';
    el.dataset.ms = ms || 0;
    el.title = msg;
    requestAnimationFrame(function () { el.classList.add('on'); });
    clearTimeout(hideT);
    if (ms > 0) hideT = setTimeout(hide, ms);
  }
  function hide() { if (el) el.classList.remove('on'); }
  function showDone(a) { bar((a.label ? '‘' + a.label + '’ · ' : '') + a.area + ' ' + a.n + '건 저장됨', 'u', 8000); }
  var top = null;
  function paintTop() {
    if (!top) return;
    var a = stack[stack.length - 1];
    top.hidden = !a || !!a.ext;
    if (a) top.title = '되돌리기 (Ctrl+Z) — ' + (a.label ? '‘' + a.label + '’ · ' : '') + a.area + ' ' + a.n + '건';
  }
  function boot() {
    var tr = document.querySelector('.topbar-right');   // 오피스 홈 맨 위 막대
    if (tr && window.parent === window) {
      css();
      top = document.createElement('button');
      top.type = 'button';
      top.id = 'ouTop';
      top.innerHTML = '<span aria-hidden="true">↶</span><span class="l">되돌리기</span>';
      top.addEventListener('click', undo);
      tr.insertBefore(top, tr.firstChild);
      paintTop();
    }
    var n = null;
    try { n = JSON.parse(ssGet(NOTE) || 'null'); } catch (e) { n = null; }
    ssSet(NOTE, null);
    if (n && Date.now() - n.at < 15000) bar(n.msg, n.redo ? 'r' : 'u', 9000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.OfficeUndo = {
    undo: undo,
    redo: redoFn,
    can: function () { return stack.length > 0; },
    canRedo: function () { return redo.length > 0; }
  };
})();
