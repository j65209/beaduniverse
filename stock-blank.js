/* 재고 미기재 알림 — 재고 ERP 에 남은 재고가 안 적힌 줄이 있으면 오피스 어느 화면에서든 오른쪽 아래에 바로 뜨고, 그 자리에서 숫자를 적어 저장
   (2026-11-24 사장님 "재고가 안들어간게 있으면 김성군,지희선,대표2명한테 바로바로 떠서 재고 기재할 수 있게 해줘").

   · 누구에게: 이 PC 의 '나는 ○○○' 이름(brightbeed_diary_me)이 WHO 명단일 때만. 사람을 더하거나 뺄 땐 WHO 한 줄만 고친다.
   · 무엇을: 재고 탭(erp_tabs kind 'stock')의 상품 줄 중 남은 재고(12번째 칸 v[11]) 빈칸 — 신상 자동 등록 · 품절로 추가한 줄 등.
     묶음 · 중복(안 셈) · ⚠ 임시 · 세트 표시 줄은 재고 줄이 아니라 뺀다 (ERP 화면의 '남은 재고 빈칸' 카드와 같은 규칙 — erp/index.html blankStk).
     탭 머리글의 12번째 칸이 '남은 재고'가 아니면 그 탭은 건너뛴다 (칸이 밀렸는데 엉뚱한 칸에 쓰지 않게).
   · 언제: 1분마다 + 재고 줄이 바뀌면 바로(실시간 알림선 office-live.js). 새 빈칸 줄이 생기면 접어 뒀어도 다시 펼치고,
     크롬 알림을 허용한 PC 는 크롬 알림도 (다른 창을 보고 있어도 뜸 — 줄마다 한 번).
   · 저장: ERP 화면과 같은 칸 수정 함수 erp_cell_edit (누가 = 이름, 이전 값이 빈칸일 때만 — 그사이 누가 적었으면 덮어쓰지 않고 알려 줌).
     수정 로그(erp_history) · ERP 화면 실시간 반영은 그대로 된다.
   · 접기: 빨간 '재고 미기재 N' 단추로 접힘 — 30분 뒤 · 새 빈칸이 생기면 다시 펼친다. 빈칸이 다 채워지면 사라진다.
   · ERP 화면(erp/)에서는 지금 보고 있는 재고 탭의 빈칸은 그 탭 맨 위 빨간 띠가 이미 보여 주므로 여기선 뺀다.
   index.html · erp/index.html 이 부른다 (오피스 안 iframe 에서는 안 띄움 — 바깥 화면이 띄움). */
(function () {
  'use strict';
  try { if (window.parent !== window) return; } catch (e) { return; }
  if (/[?&](app|embed)=/.test(location.search)) return;
  var WHO = ['김성군', '지희선', '전승훈', '전수빈'];
  var SB = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co';
  // 오피스 화면 소스에도 들어 있는 공개 키 (비밀 아님)
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreWpreGJxc3lqb3FwdXF3b2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjI2NzEsImV4cCI6MjA5Mzk5ODY3MX0.C8WIGqf-zIYkCq0dGWTMjIYuPM-IVInMn1p6FaWbVKA';
  var STOCK_P = 11;                                             // 남은 재고 = v[11] (재고 탭 7개 모두, 2026-11-24 확인)
  var NOT_ROW = /^\s*⚠|안\s*셈|묶음\s*→\s*낱개|^\s*세트\s*·/;   // 재고 줄이 아닌 줄 (카테고리 칸)
  var TICK_MS = 60000, MIN_MS = 30 * 60000, LS = 'stock_blank_ui';
  var IN_ERP = /\/erp\/(index\.html)?$/.test(location.pathname);
  var tabs = null, tabsAt = 0, rows = [], box = null, busy = false, again = false, lastTick = 0, sig = '';
  var st = (function () { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } })();
  st.seen = st.seen || {}; st.pushed = st.pushed || {};

  function me() { try { return String(localStorage.getItem('brightbeed_diary_me') || '').trim(); } catch (e) { return ''; } }
  function allowed() { return WHO.indexOf(me()) >= 0; }
  function keep() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* 개인 창 */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function hdr() { return {apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json'}; }
  function get(p) {
    return fetch(SB + '/rest/v1/' + p, {headers: hdr(), cache: 'no-store'}).then(function (r) { if (!r.ok) throw new Error('http_' + r.status); return r.json(); });
  }
  function brandOf(name) { var m = String(name || '').match(/^(?:\d{1,2}\.\d{1,2})?\s*(.+?)\s*송장출력$/); return m ? m[1] : String(name || ''); }

  // 재고 탭 목록 (30분마다) — 머리글 12번째 칸이 '남은 재고'인 탭만
  function loadTabs() {
    if (tabs && Date.now() - tabsAt < 30 * 60000) return Promise.resolve(tabs);
    return get('erp_tabs?select=gid,name,pos&kind=eq.stock&alive=is.true&deleted_at=is.null&order=pos.asc').then(function (ts) {
      if (!ts.length) return [];
      var gs = ts.map(function (t) { return encodeURIComponent(t.gid); }).join(',');
      return get('erp_rows?select=gid,v&deleted_at=is.null&gid=in.(' + gs + ')&v->>1=eq.' + encodeURIComponent('상품명')).then(function (hs) {
        var ok = {};
        hs.forEach(function (h) { var v = h.v || []; if (String(v[STOCK_P] || '').replace(/\s+/g, '') === '남은재고') ok[h.gid] = 1; });
        tabs = ts.filter(function (t) { return ok[t.gid]; }).map(function (t, i) { return {gid: t.gid, brand: brandOf(t.name), i: i}; });
        tabsAt = Date.now();
        return tabs;
      });
    });
  }
  function loadRows() {
    return loadTabs().then(function (ts) {
      if (!ts.length) return [];
      var by = {};
      ts.forEach(function (t) { by[t.gid] = t; });
      var gs = ts.map(function (t) { return encodeURIComponent(t.gid); }).join(',');
      return get('erp_rows?select=gid,r,c:v->>0,n:v->>1,o:v->>2&deleted_at=is.null&gid=in.(' + gs + ')&v->>1=neq.'
        + '&or=(v->>' + STOCK_P + '.eq.,v->>' + STOCK_P + '.is.null)&limit=3000').then(function (rs) {
        return rs.filter(function (x) {
          var n = String(x.n || '').trim();
          return by[x.gid] && n && n !== '상품명' && !NOT_ROW.test(String(x.c || ''));
        }).map(function (x) {
          var n = String(x.n).trim();
          return {gid: x.gid, r: x.r, brand: by[x.gid].brand, bi: by[x.gid].i, n: n, o: String(x.o || '').trim(), k: x.gid + '|' + x.r + '|' + n};
        }).sort(function (a, b) { return a.bi - b.bi || a.r - b.r; });
      });
    });
  }

  function css() {
    if (document.getElementById('stockBlankCss')) return;
    var s = document.createElement('style');
    s.id = 'stockBlankCss';
    s.textContent = '#stockBlank{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:99980;font:14px/1.5 Pretendard,-apple-system,"Malgun Gothic",sans-serif;color:#111827;text-align:left}'
      + '#stockBlank .sb-card{width:min(400px,calc(100vw - 32px));max-height:min(64vh,560px);display:flex;flex-direction:column;background:#fff;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.22);overflow:hidden}'
      + '#stockBlank .sb-h{display:flex;align-items:center;gap:8px;padding:11px 12px 9px 14px;border-bottom:1px solid #f1f2f4}'
      + '#stockBlank .sb-h b{font-size:15px}#stockBlank .sb-h b em{font-style:normal;color:#dc2626}'
      + '#stockBlank .sb-h small{flex:1;min-width:0;color:#6b7280;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '#stockBlank button{font:inherit;cursor:pointer}'
      + '#stockBlank .sb-min{flex:none;height:30px;padding:0 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:12.5px;color:#374151}'
      + '#stockBlank .sb-list{overflow:auto;padding:2px 0}'
      + '#stockBlank .sb-i{display:flex;align-items:center;gap:7px;padding:8px 12px 8px 14px;border-top:1px solid #f6f7f9}#stockBlank .sb-i:first-child{border-top:0}'
      + '#stockBlank .sb-t{flex:1;min-width:0;font-size:13px;line-height:1.4;word-break:keep-all;overflow-wrap:break-word}'
      + '#stockBlank .sb-t i{font-style:normal;display:inline-block;margin-right:5px;padding:0 6px;border-radius:5px;background:#f3f4f6;color:#4b5563;font-size:11.5px;font-weight:600;white-space:nowrap}'
      + '#stockBlank .sb-t b{font-weight:600}#stockBlank .sb-t span{display:block;color:#6b7280;font-size:12px}'
      + '#stockBlank .sb-in{flex:none;width:74px;height:32px;padding:0 8px;border:1px solid #fca5a5;border-radius:7px;font:inherit;font-size:14px;text-align:right;font-variant-numeric:tabular-nums;background:#fff;color:#111827}'
      + '#stockBlank .sb-in:focus{outline:2px solid rgba(220,38,38,.22);border-color:#dc2626}#stockBlank .sb-in:disabled{background:#f8fafc;color:#9ca3af}'
      + '#stockBlank .sb-save{flex:none;height:32px;padding:0 12px;border:0;border-radius:7px;background:#dc2626;color:#fff;font-size:13px;font-weight:700}#stockBlank .sb-save:disabled{opacity:.5;cursor:wait}'
      + '#stockBlank .sb-msg{flex-basis:100%;color:#dc2626;font-size:12px}'
      + '#stockBlank .sb-f{display:flex;align-items:center;gap:8px;padding:8px 12px 10px 14px;border-top:1px solid #f1f2f4;color:#6b7280;font-size:12px}'
      + '#stockBlank .sb-f span{flex:1;min-width:0}#stockBlank .sb-f a{flex:none;color:#1d4ed8;text-decoration:none;font-weight:600}'
      + '#stockBlank .sb-pill{display:flex;align-items:center;gap:7px;height:38px;padding:0 15px;border:0;border-radius:19px;background:#dc2626;color:#fff;font-size:13.5px;font-weight:700;box-shadow:0 8px 24px rgba(220,38,38,.35)}'
      + '#stockBlank .sb-pill em{font-style:normal;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#fff;color:#dc2626;font-size:12px;line-height:20px;text-align:center}'
      + '@media (max-width:600px){#stockBlank{right:12px;left:12px;display:flex;justify-content:flex-end}#stockBlank .sb-card{width:100%;max-height:56vh}#stockBlank .sb-h small{display:none}'
      + '#stockBlank .sb-i{flex-wrap:wrap;row-gap:6px}#stockBlank .sb-t{flex-basis:100%}#stockBlank .sb-in{flex:1;width:auto;min-width:0}}'
      + '@media print{#stockBlank{display:none}}';
    document.head.appendChild(s);
  }
  function drop() { if (box) { box.remove(); box = null; } sig = ''; }

  // 크롬 알림 — 새 빈칸 줄마다 한 번 (허용한 PC 만, 하루 지난 기록은 지움)
  function notify(fresh) {
    if (!fresh.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    var now = Date.now(), todo = fresh.filter(function (x) { return !st.pushed[x.k]; });
    if (!todo.length) return;
    todo.forEach(function (x) { st.pushed[x.k] = now; });
    Object.keys(st.pushed).forEach(function (k) { if (now - st.pushed[k] > 86400000) delete st.pushed[k]; });
    keep();
    var body = todo.slice(0, 4).map(function (x) { return x.brand + ' · ' + x.n + (x.o ? ' (' + x.o + ')' : ''); }).join('\n') + (todo.length > 4 ? '\n외 ' + (todo.length - 4) + '개' : '');
    try {
      var n = new Notification('📦 재고 미기재 ' + todo.length + '건 — 남은 재고를 적어 주세요', {body: body, tag: 'stock-blank', renotify: true, icon: (IN_ERP ? '../' : '') + 'assets/icon-192.png?v=2'});
      n.onclick = function () { window.focus(); st.min = 0; keep(); draw(); n.close(); };
    } catch (e) { /* 휴대폰 크롬 등 */ }
  }

  function visibleRows() {
    if (!IN_ERP) return rows;
    var strip = document.getElementById('blanks');   // ERP 재고 탭 맨 위 '남은 재고 빈칸' 띠 — 그 탭 것은 띠가 보여 준다
    var g = strip && !strip.hidden ? strip.getAttribute('data-gid') : '';
    return g ? rows.filter(function (x) { return x.gid !== g; }) : rows;
  }
  function draw() {
    if (!allowed()) { drop(); return; }
    var list = visibleRows();
    if (!list.length) { drop(); return; }
    var mini = (st.min || 0) > Date.now();
    var s = (mini ? 'm' : 'o') + '|' + list.map(function (x) { return x.k; }).join(',');
    if (box && s === sig) return;   // 그대로면 안 건드림 — 치던 숫자 · 커서가 안 날아가게
    css();
    var typed = {}, focus = null;
    if (box) {
      box.querySelectorAll('.sb-in').forEach(function (x) { if (x.value) typed[x.getAttribute('data-k')] = x.value; });
      var a = document.activeElement;
      if (a && box.contains(a) && a.classList.contains('sb-in')) focus = a.getAttribute('data-k');
    }
    if (!box) {
      box = document.createElement('div');
      box.id = 'stockBlank';
      box.addEventListener('click', onClick);
      box.addEventListener('keydown', onKey);
      document.body.appendChild(box);
    }
    if (mini) {
      box.innerHTML = '<button type="button" class="sb-pill" data-act="open" title="눌러서 펼치기 — 30분 뒤 · 새 빈칸이 생기면 저절로 펼쳐져요">📦 재고 미기재 <em>' + list.length + '</em></button>';
    } else {
      var erpHref = IN_ERP ? '' : new URL('erp/', location.origin + location.pathname.replace(/[^/]*$/, '')).href;
      box.innerHTML = '<div class="sb-card" role="dialog" aria-label="재고 미기재 ' + list.length + '건">'
        + '<div class="sb-h"><b>📦 재고 미기재 <em>' + list.length + '</em>건</b><small>실제 재고를 세어 적어 주세요</small>'
        + '<button type="button" class="sb-min" data-act="min" title="접기 — 30분 뒤 · 새 빈칸이 생기면 다시 펼쳐요">접기</button></div>'
        + '<div class="sb-list">' + list.map(function (x) {
          return '<div class="sb-i" data-k="' + esc(x.k) + '"><div class="sb-t"><i>' + esc(x.brand) + '</i><b>' + esc(x.n) + '</b>' + (x.o ? '<span>' + esc(x.o) + '</span>' : '') + '</div>'
            + '<input class="sb-in" data-k="' + esc(x.k) + '" type="text" inputmode="numeric" autocomplete="off" placeholder="재고 수" aria-label="' + esc(x.n + (x.o ? ' ' + x.o : '')) + ' 남은 재고" value="' + esc(typed[x.k] || '') + '">'
            + '<button type="button" class="sb-save" data-act="save" data-k="' + esc(x.k) + '">저장</button></div>';
        }).join('') + '</div>'
        + '<div class="sb-f"><span>빈칸이면 송장이 나가도 재고가 안 빠지고 식스샵엔 품절로 보여요</span>'
        + (erpHref ? '<a href="' + esc(erpHref) + '" target="bead-erp" rel="noopener">ERP 열기</a>' : '') + '</div></div>';
      if (focus) { var f = box.querySelector('.sb-in[data-k="' + (window.CSS && CSS.escape ? CSS.escape(focus) : focus) + '"]'); if (f) f.focus({preventScroll: true}); }
    }
    sig = s;
  }

  function onClick(e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'open') { st.min = 0; keep(); sig = ''; draw(); var i = box && box.querySelector('.sb-in'); if (i) i.focus({preventScroll: true}); return; }
    if (act === 'min') { st.min = Date.now() + MIN_MS; keep(); sig = ''; draw(); return; }
    if (act === 'save') saveRow(b.getAttribute('data-k'));
  }
  function onKey(e) {
    var i = e.target.closest && e.target.closest('.sb-in');
    if (!i || e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    saveRow(i.getAttribute('data-k'));
  }
  function msg(row, t) {
    var m = row.querySelector('.sb-msg');
    if (!m) { m = document.createElement('div'); m.className = 'sb-msg'; row.appendChild(m); row.style.flexWrap = 'wrap'; }
    m.textContent = t;
  }
  function saveRow(k) {
    if (!box) return;
    var x = rows.filter(function (y) { return y.k === k; })[0];
    var row = box.querySelector('.sb-i[data-k="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
    if (!x || !row) return;
    var inp = row.querySelector('.sb-in'), btn = row.querySelector('.sb-save');
    if (inp.disabled) return;
    var raw = inp.value.trim().replace(/[,\s]/g, '').replace(/개$/, '');
    if (!/^\d{1,6}$/.test(raw)) { msg(row, '0 이상 숫자로 적어 주세요'); inp.focus(); return; }
    var who = me();
    if (WHO.indexOf(who) < 0) { msg(row, '이 PC 의 이름이 명단에 없어요'); return; }
    inp.disabled = btn.disabled = true;
    fetch(SB + '/rest/v1/rpc/erp_cell_edit', {method: 'POST', headers: hdr(), body: JSON.stringify({
      p_gid: x.gid, p_r: x.r, p_p: STOCK_P, p_new: raw, p_row: null, p_who: (who + ' · 재고 미기재 알림').slice(0, 40), p_old: ''
    })}).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error((d && d.message) || 'http_' + r.status); return d; }); }).then(function (d) {
      if (d && d.conflict) {
        inp.disabled = btn.disabled = false;
        rows = rows.filter(function (y) { return y.k !== k; });
        msg(row, '그사이 다른 분이 ' + (d.current || '') + '(으)로 적었어요');
        setTimeout(function () { sig = ''; draw(); }, 2500);
        return;
      }
      if (!d || !d.ok) throw new Error('db_error');
      rows = rows.filter(function (y) { return y.k !== k; });
      row.innerHTML = '<div class="sb-t"><i>' + esc(x.brand) + '</i><b>' + esc(x.n) + '</b> — 남은 재고 ' + esc(raw) + '개 저장됨</div>';
      setTimeout(function () { sig = ''; draw(); }, 1500);   // 다른 화면 · ERP 는 저장소 실시간 알림(erp_rows)으로 바로 맞춰진다
    }).catch(function (err) {
      inp.disabled = btn.disabled = false;
      msg(row, '저장 못 했어요 — 잠시 뒤 다시 (' + String((err && err.message) || err).slice(0, 40) + ')');
    });
  }

  function tick() {
    if (!allowed()) { drop(); return; }
    if (busy) { again = true; return; }
    busy = true;
    lastTick = Date.now();
    loadRows().then(function (list) {
      var now = Date.now(), cur = {}, fresh = [];
      list.forEach(function (x) { cur[x.k] = 1; if (!st.seen[x.k]) fresh.push(x); });
      if (fresh.length) { st.min = 0; notify(fresh); }   // 새 빈칸 — 접어 뒀어도 다시 펼침
      var seen = {};
      list.forEach(function (x) { seen[x.k] = st.seen[x.k] || now; });
      st.seen = seen;
      keep();
      rows = list;
      draw();
    }).catch(function () { /* 다음 차례에 */ }).then(function () {
      busy = false;
      if (again) { again = false; setTimeout(tick, 1500); }
    });
  }
  // 실시간 — 재고 줄이 바뀌면 (5초에 한 번까지)
  var liveT = 0;
  function onLive() {
    var wait = 5000 - (Date.now() - lastTick);
    if (wait <= 0) { tick(); return; }
    if (!liveT) liveT = setTimeout(function () { liveT = 0; tick(); }, wait);
  }
  function boot() {
    tick();
    setInterval(function () {
      if ((st.min || 0) && st.min <= Date.now() && box && sig.charAt(0) === 'm') { sig = ''; draw(); }   // 30분 지나면 다시 펼침
      tick();
    }, TICK_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - lastTick > 15000) tick(); });
    window.addEventListener('storage', function (e) { if (e.key === 'brightbeed_diary_me') tick(); });   // 다른 탭에서 '나는 ○○○' 를 바꿈
    var tries = 0;
    (function live() {
      if (window.OfficeLive && OfficeLive.on) { OfficeLive.on(['erp_rows', 'erp_tabs'], onLive); return; }
      if (++tries < 20) setTimeout(live, 1000);
    })();
    // ERP 화면: 보는 재고 탭이 바뀌면(맨 위 띠가 다른 탭 것으로) 빼는 줄도 바꾼다
    if (IN_ERP) setInterval(function () { if (rows.length) draw(); }, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
