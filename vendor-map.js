/* 코페리 업체 매핑 알림 — MD 코페리 'Product List' 맨 끝 '업체' 칸(투엘 · 콰디)이 빈 상품이 있으면
   박시호 님 PC 의 오피스 어느 화면에서든 오른쪽 아래에 상품별로 뜨고, [투엘] [콰디] 를 누르면 바로 저장
   (2026-11-27 사장님 "코페리 전 제품 매핑 해야하는데 시호님한테 알림 띄워줘. 매핑 하게끔. 제품별로").

   · 누구에게: 이 PC 의 '나는 ○○○' 이름(brightbeed_diary_me)이 WHO 명단일 때만. 사람을 더하거나 뺄 땐 WHO 한 줄만 고친다.
   · 무엇을: Product List(coferry:705952769) 상품명(C열) 이 있고 업체(AX열 = v[49]) 가 빈 줄. 구글에서 숨겼던 줄(신상 · 더스트백 …)은 뺀다.
   · 라인시트 학습 ("라인시트에 업체명 있으면 물어볼 필요없이 학습"): 디자인팀 라인시트(design_tpl_docs linesheet) 진행업체가 투엘 / 콰디(콰이디)인
     상품과 이름(영문 앞부분, 괄호 · (가제) · renewal · size N 뺀 글자)이 같으면 묻지 않고 바로 채운다 — 시즌끼리 업체가 다르면 묻는다.
     라벨 원가(AY열)는 기밀 칸이라 여기선 안 다룬다 (2026-11-27 SQL 로 한 번 채움).
   · 저장: MD팀 시트와 같은 칸 수정 함수 mdx_cell_edit (열쇠 = MD팀 시트가 기억한 mdx_key_v1, 없으면 PIN 프록시 ghFetch 로 받음).
     이전 값이 빈칸일 때만 — 그사이 누가 적었으면 덮어쓰지 않는다. MD팀 시트 화면은 바뀐 줄을 8초 안에 받는다.
   · 접기: '업체 매핑 N' 단추 — 30분 뒤 · 새 빈칸이 생기면 다시 펼친다. 다 채우면 사라진다. 10분마다 다시 본다.
   index.html 이 부른다 (오피스 안 iframe 에서는 안 띄움). */
(function () {
  'use strict';
  try { if (window.parent !== window) return; } catch (e) { return; }
  if (/[?&](app|embed)=/.test(location.search)) return;
  var WHO = ['박시호'];
  var TK = 'coferry:705952769', NAME_P = 2, CAT_P = 1, VEND_P = 49;
  var VENDORS = ['투엘', '콰디'];
  var SB = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co';
  // 오피스 화면 소스에도 들어 있는 공개 키 (비밀 아님)
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreWpreGJxc3lqb3FwdXF3b2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjI2NzEsImV4cCI6MjA5Mzk5ODY3MX0.C8WIGqf-zIYkCq0dGWTMjIYuPM-IVInMn1p6FaWbVKA';
  var KEY_PATH = 'https://api.github.com/repos/j65209/brightbeed-reports/contents/office/mdx-key.json?ref=main';
  var TICK_MS = 10 * 60000, MIN_MS = 30 * 60000, LS = 'vendor_map_ui';
  var rows = [], box = null, busy = false, sig = '', mkey = '', lastTick = 0;
  var st = (function () { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } })();
  st.seen = st.seen || {};

  function me() { try { return String(localStorage.getItem('brightbeed_diary_me') || '').trim(); } catch (e) { return ''; } }
  function allowed() { return WHO.indexOf(me()) >= 0; }
  function keep() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* 개인 창 */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function hdr() { return {apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json'}; }
  function rpc(fn, body) {
    return fetch(SB + '/rest/v1/rpc/' + fn, {method: 'POST', headers: hdr(), body: JSON.stringify(body)}).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error((d && d.message) || 'http_' + r.status); return d; });
    });
  }
  function vkey(t) { var s = String(t || '').replace(/\s+/g, ''); return s === '투엘' ? '투엘' : (s === '콰디' || s === '콰이디') ? '콰디' : ''; }
  // 이름 맞추기 — 영문 앞부분만, 괄호 · (가제) · renewal · size N · 영문 숫자 밖 글자 뺌 (SQL 로 처음 채운 규칙과 같음)
  function base(t) {
    return String(t || '').split(' / ')[0].replace(/\(가제\)/g, '').replace(/\([^)]*\)/g, ' ').replace(/renewal|size\s*\d+/gi, ' ').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // MD팀 시트 열쇠 — 이 브라우저에 기억된 것, 없으면 PIN 프록시로 받는다
  function getKey(fresh) {
    if (!fresh) { try { var k = localStorage.getItem('mdx_key_v1'); if (k && k.length >= 32) return Promise.resolve(k); } catch (e) { /* */ } }
    if (typeof window.ghFetch !== 'function') return Promise.reject(new Error('no_key'));
    return window.ghFetch(KEY_PATH, {headers: {Accept: 'application/vnd.github.raw+json'}, cache: 'no-store'}).then(function (r) {
      if (!r.ok) throw new Error('no_key');
      return r.json();
    }).then(function (j) {
      if (j && typeof j.content === 'string' && j.encoding === 'base64') j = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, '')), function (c) { return c.charCodeAt(0); })));
      if (!j || typeof j.key !== 'string' || j.key.length < 32) throw new Error('no_key');
      try { localStorage.setItem('mdx_key_v1', j.key); } catch (e) { /* */ }
      return j.key;
    });
  }
  function mdx(fn, body) {
    var go = function (k) { mkey = k; return rpc(fn, Object.assign({p_key: k}, body)); };
    return getKey(false).then(go).catch(function (e) {
      if (!/denied|no_key/.test((e && e.message) || '')) throw e;
      return getKey(true).then(go);
    });
  }

  // 라인시트 진행업체 — 이름 → 업체 (시즌끼리 다르면 빼서 묻는다)
  function lineVendors() {
    return fetch(SB + '/rest/v1/design_tpl_docs?select=data&kind=eq.linesheet&deleted_at=is.null', {headers: hdr(), cache: 'no-store'})
      .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (ds) {
        var m = {}, bad = {};
        (ds || []).forEach(function (d) {
          ((d.data && d.data.items) || []).forEach(function (it) {
            var b = base(it.name), v = vkey(it.vendor);
            if (!b || !v) return;
            if (m[b] && m[b] !== v) bad[b] = 1; else m[b] = v;
          });
        });
        Object.keys(bad).forEach(function (b) { delete m[b]; });
        return m;
      });
  }

  function load() {
    return mdx('mdx_rows_get', {p_tk: TK, p_limit: 4000}).then(function (d) {
      var hid = {};
      (d.hidden || []).forEach(function (r) { hid[r] = 1; });
      return (d.rows || []).filter(function (x) {
        var v = x.v || [];
        return x.r > 1 && !x.d && !hid[x.r] && String(v[NAME_P] || '').trim() && !vkey(v[VEND_P]) && !String(v[VEND_P] || '').trim();
      }).map(function (x) { return {r: x.r, n: String(x.v[NAME_P]).trim(), c: String(x.v[CAT_P] || '').trim(), k: TK + '|' + x.r + '|' + String(x.v[NAME_P]).trim()}; });
    });
  }
  function save(x, v, who) {
    return rpc('mdx_cell_edit', {p_key: mkey, p_tk: TK, p_r: x.r, p_p: VEND_P, p_new: v, p_row: null, p_who: who.slice(0, 40), p_old: ''});
  }

  function css() {
    if (document.getElementById('vendorMapCss')) return;
    var s = document.createElement('style');
    s.id = 'vendorMapCss';
    s.textContent = '#vendorMap{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:99979;font:14px/1.5 Pretendard,-apple-system,"Malgun Gothic",sans-serif;color:#111827;text-align:left}'
      + '#vendorMap .vm-card{width:min(400px,calc(100vw - 32px));max-height:min(64vh,560px);display:flex;flex-direction:column;background:#fff;border:1px solid #c7d7f5;border-left:4px solid #4f7fcf;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.22);overflow:hidden}'
      + '#vendorMap .vm-h{display:flex;align-items:center;gap:8px;padding:11px 12px 9px 14px;border-bottom:1px solid #f1f2f4}'
      + '#vendorMap .vm-h b{font-size:15px}#vendorMap .vm-h b em{font-style:normal;color:#4f7fcf}'
      + '#vendorMap .vm-h small{flex:1;min-width:0;color:#6b7280;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '#vendorMap button{font:inherit;cursor:pointer}'
      + '#vendorMap .vm-min{flex:none;height:30px;padding:0 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:12.5px;color:#374151}'
      + '#vendorMap .vm-list{overflow:auto;padding:2px 0}'
      + '#vendorMap .vm-i{display:flex;align-items:center;gap:6px;padding:8px 12px 8px 14px;border-top:1px solid #f6f7f9}#vendorMap .vm-i:first-child{border-top:0}'
      + '#vendorMap .vm-t{flex:1;min-width:0;font-size:13px;line-height:1.4;word-break:keep-all;overflow-wrap:break-word}'
      + '#vendorMap .vm-t i{font-style:normal;display:inline-block;margin-right:5px;padding:0 6px;border-radius:5px;background:#f3f4f6;color:#4b5563;font-size:11.5px;font-weight:600;white-space:nowrap}'
      + '#vendorMap .vm-t b{font-weight:600}'
      + '#vendorMap .vm-v{flex:none;height:30px;padding:0 11px;border:0;border-radius:7px;font-size:12.5px;font-weight:800}#vendorMap .vm-v:disabled{opacity:.5;cursor:wait}'
      + '#vendorMap .vm-v.tw{background:#e0ecff;color:#1d4ed8}#vendorMap .vm-v.kd{background:#ffedd5;color:#c2410c}'
      + '#vendorMap .vm-v.tw:hover{background:#cfe0ff}#vendorMap .vm-v.kd:hover{background:#fed7aa}'
      + '#vendorMap .vm-msg{flex-basis:100%;color:#dc2626;font-size:12px}'
      + '#vendorMap .vm-f{padding:8px 12px 10px 14px;border-top:1px solid #f1f2f4;color:#6b7280;font-size:12px}'
      + '#vendorMap .vm-pill{display:flex;align-items:center;gap:7px;height:38px;padding:0 15px;border:0;border-radius:19px;background:#4f7fcf;color:#fff;font-size:13.5px;font-weight:700;box-shadow:0 8px 24px rgba(79,127,207,.35)}'
      + '#vendorMap .vm-pill em{font-style:normal;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#fff;color:#4f7fcf;font-size:12px;line-height:20px;text-align:center}'
      + '@media (max-width:600px){#vendorMap{left:12px;right:12px}#vendorMap .vm-card{width:100%;max-height:56vh}#vendorMap .vm-h small{display:none}#vendorMap .vm-i{flex-wrap:wrap;row-gap:6px}#vendorMap .vm-t{flex-basis:100%}#vendorMap .vm-v{flex:1}}'
      + '@media print{#vendorMap{display:none}}';
    document.head.appendChild(s);
  }
  function drop() { if (box) { box.remove(); box = null; } sig = ''; }
  function draw() {
    if (!allowed() || !rows.length) { drop(); return; }
    var mini = (st.min || 0) > Date.now();
    var s = (mini ? 'm' : 'o') + '|' + rows.map(function (x) { return x.k; }).join(',');
    if (box && s === sig) return;
    css();
    if (!box) {
      box = document.createElement('div');
      box.id = 'vendorMap';
      box.addEventListener('click', onClick);
      document.body.appendChild(box);
    }
    if (mini) {
      box.innerHTML = '<button type="button" class="vm-pill" data-act="open" title="눌러서 펼치기 — 30분 뒤 · 새 상품이 생기면 저절로 펼쳐져요">🏷 코페리 업체 매핑 <em>' + rows.length + '</em></button>';
    } else {
      box.innerHTML = '<div class="vm-card" role="dialog" aria-label="코페리 업체 매핑 ' + rows.length + '개">'
        + '<div class="vm-h"><b>🏷 코페리 업체 매핑 <em>' + rows.length + '</em>개</b><small>상품마다 진행 업체를 골라 주세요</small>'
        + '<button type="button" class="vm-min" data-act="min" title="접기 — 30분 뒤 · 새 상품이 생기면 다시 펼쳐요">접기</button></div>'
        + '<div class="vm-list">' + rows.map(function (x) {
          return '<div class="vm-i" data-k="' + esc(x.k) + '"><div class="vm-t">' + (x.c ? '<i>' + esc(x.c) + '</i>' : '') + '<b>' + esc(x.n) + '</b></div>'
            + VENDORS.map(function (v) { return '<button type="button" class="vm-v ' + (v === '투엘' ? 'tw' : 'kd') + '" data-act="pick" data-v="' + v + '" data-k="' + esc(x.k) + '">' + v + '</button>'; }).join('') + '</div>';
        }).join('') + '</div>'
        + '<div class="vm-f">MD팀 시트 › MD 코페리 › Product List 맨 끝 \'업체\' 칸에 저장돼요. 라인시트 진행업체에 적힌 상품은 저절로 채워져요.</div></div>';
    }
    sig = s;
  }
  function onClick(e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'open') { st.min = 0; keep(); sig = ''; draw(); return; }
    if (act === 'min') { st.min = Date.now() + MIN_MS; keep(); sig = ''; draw(); return; }
    if (act === 'pick') pick(b.getAttribute('data-k'), b.getAttribute('data-v'));
  }
  function pick(k, v) {
    var x = rows.filter(function (y) { return y.k === k; })[0];
    var row = box && box.querySelector('.vm-i[data-k="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
    if (!x || !row) return;
    var bs = row.querySelectorAll('.vm-v');
    bs.forEach(function (b) { b.disabled = true; });
    save(x, v, me() + ' · 업체 매핑 알림').then(function (d) {
      rows = rows.filter(function (y) { return y.k !== k; });
      if (d && d.conflict) row.innerHTML = '<div class="vm-t"><b>' + esc(x.n) + '</b> — 그사이 ' + esc(d.current || '') + '(으)로 적혀 있었어요</div>';
      else if (d && d.ok) row.innerHTML = '<div class="vm-t"><b>' + esc(x.n) + '</b> — ' + esc(v) + ' 저장됨</div>';
      else throw new Error('db_error');
      setTimeout(function () { sig = ''; draw(); }, 1300);
    }).catch(function (err) {
      bs.forEach(function (b) { b.disabled = false; });
      var m = row.querySelector('.vm-msg') || row.appendChild(Object.assign(document.createElement('div'), {className: 'vm-msg'}));
      row.style.flexWrap = 'wrap';
      m.textContent = '저장 못 했어요 — 잠시 뒤 다시 (' + String((err && err.message) || err).slice(0, 40) + ')';
    });
  }

  function tick() {
    if (!allowed()) { drop(); return; }
    if (busy) return;
    busy = true;
    lastTick = Date.now();
    Promise.all([load(), lineVendors()]).then(function (res) {
      var list = res[0], lv = res[1], auto = [];
      list = list.filter(function (x) { var v = lv[base(x.n)]; if (v) { auto.push([x, v]); return false; } return true; });
      // 라인시트에 업체가 있는 상품 = 묻지 않고 채움
      return Promise.all(auto.map(function (a) { return save(a[0], a[1], '라인시트 자동 학습').catch(function () { /* 다음 차례에 */ }); })).then(function () { return list; });
    }).then(function (list) {
      var now = Date.now(), seen = {}, fresh = false;
      list.forEach(function (x) { if (!st.seen[x.k]) fresh = true; seen[x.k] = st.seen[x.k] || now; });
      if (fresh) st.min = 0;   // 새 빈칸 — 접어 뒀어도 다시 펼침
      st.seen = seen;
      keep();
      rows = list;
      draw();
    }).catch(function () { /* 열쇠 · 네트워크 — 다음 차례에 */ }).then(function () { busy = false; });
  }
  function boot() {
    setTimeout(tick, 4000);   // 오피스 부팅(ghFetch · 로그인) 뒤
    setInterval(function () {
      if ((st.min || 0) && st.min <= Date.now() && box && sig.charAt(0) === 'm') { sig = ''; draw(); }
      tick();
    }, TICK_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - lastTick > 60000) tick(); });
    window.addEventListener('storage', function (e) { if (e.key === 'brightbeed_diary_me') tick(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
