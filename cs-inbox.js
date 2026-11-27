/* CS 에이전트 알림 대화창 — 희선님 전용 플로팅 창 (2026-11-27 사장님 "오피스앱 cs에이전트 알림 대화창? 희선님 전용으로 하나 만들어줘. 나도 볼 수 있게
   · 희선님이 완료, 삭제 이런식으로 버튼 · 네이버페이 환불진행이나 반품 자동수거 이런건 희선님한테 가야해서 컴퓨터에 계속 떠있는 카카오톡 플로팅 같은걸로 접기 펴기")
   · 보이는 PC = VIEW ('나는' 이름 brightbeed_diary_me). 희선님 + 대표 2명. 사람을 바꾸려면 VIEW 한 줄만.
   · 내용 = 카톡 상담 에이전트가 직원에게 넘긴 것 (프록시 GET /cs/kakao-drafts openCalls — 처리할 일 todo · 직원 호출 call)
     + 카톡 자동 수거 대기 (GET /cs/kakao-pickup items state wait · stop — 네이버페이 반품 접수 같이 확인 등). 같은 채팅방이면 한 말풍선에 합침.
   · [완료] = 처리할 일이면 에이전트 할 일도 닫음 (POST /cs/kakao-done, id 'none' = 고객 안내 없이 닫기 — 사무실 인터넷에서만 됨. 안 되면 오피스 표시만 완료)
     [삭제] = 이 창에서만 숨김 (에이전트 쪽은 그대로). 둘 다 app_kv 'cs_inbox_marks' 에 누가 · 언제 → 대표 PC 에도 같이 보임, '완료함' 탭에서 되돌리기.
     같은 건이라도 할 일 내용(sig)이 바뀌면 다시 뜬다.
   · 컴퓨터 알림(크롬)은 kko-urgent.js 가 그대로 보낸다 (희선님만) — 여기서 완료 · 삭제한 건은 알림도 멈춤 (CsInbox.hidden).
   · 접기 · 펴기는 PC 마다 기억 (localStorage). 화면 오른쪽 아래, 재고 미기재 카드(#stockBlank)가 있으면 그 위. */
(function () {
  'use strict';
  try { if (window.parent !== window) return; } catch (e) { return; }
  if (/[?&](app|embed)=/.test(location.search)) return;
  if (window.CsInbox) return;

  var OWNER = '지희선';
  var VIEW = ['지희선', '전승훈', '전수빈'];
  var POLL = 60000, MK = 'cs_inbox_marks', LSO = 'bb_csinbox_open_v1';
  var RAGE = /화남|욕설|욕|불쾌|신고|바통|발악/;
  var BR = {kop: '코페리', apt: '아페티', koz: '코즈미', '6a': '식스에이', yar: '야르', akoi: '아코이하우스', pp: '프로덕트피알', ct: '클리어타입'};
  var S = {items: [], marks: {}, tab: 'todo', err: '', note: '', busy: {}, at: 0, more: {}};
  var root = null, timer = null, lastN = -1;

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function me() { return ls('brightbeed_unlocked') === '1' ? String(ls('brightbeed_diary_me') || '').trim() : ''; }
  function mine() { return VIEW.indexOf(me()) >= 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function hm(t) { var d = new Date(Number(t) + 9 * 3600000); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2); }
  function ago(t) { var m = Math.max(0, Math.round((Date.now() - Number(t || Date.now())) / 60000)); return m < 60 ? m + '분 전' : m < 1440 ? Math.round(m / 60) + '시간 전' : Math.round(m / 1440) + '일 전'; }
  function isOpen() { return ls(LSO) === '1'; }

  /* ---- 자료 ---- */
  function build(drafts, pick) {
    var out = [], byChat = {};
    var calls = drafts && !drafts.off && Array.isArray(drafts.openCalls) ? drafts.openCalls : [];
    calls.forEach(function (c) {
      if (!c || !c.key) return;
      var td = c.kind === 'todo', hot = !td && RAGE.test(String(c.why || '') + ' ' + String(c.topic || ''));
      var it = {key: 'c:' + c.key, chat: c, kind: td ? 'todo' : hot ? 'hot' : 'call', label: c.label || BR[c.brand] || c.brand || '카톡',
        title: td ? (c.todo || '처리할 일') : hot ? '화난 고객 — 바로 봐 주세요' : '에이전트가 직원을 불렀어요',
        text: c.brief || [c.topic, c.why].filter(Boolean).join('\n'), at: Number(c.since || c.firstAt || Date.now()),
        sig: (c.kind || 'call') + '|' + (c.todo || c.topic || ''), picks: []};
      out.push(it); byChat[c.key] = it;
    });
    ((pick && pick.items) || []).forEach(function (p) {
      if (!p || (p.state !== 'wait' && p.state !== 'stop')) return;
      var ck = p.pid && p.chatId ? p.pid + ':' + p.chatId : '';
      if (ck && byChat[ck]) { byChat[ck].picks.push(p); byChat[ck].sig += '|pk:' + p.id + ':' + p.state; return; }
      out.push({key: 'p:' + p.id, chat: ck ? {key: ck, pid: p.pid, chatId: p.chatId, link: p.link} : null, kind: 'pick', label: p.label || BR[p.brand] || '',
        title: (p.title || '회수') + ' — 수거 ' + (p.state === 'stop' ? '확인 필요' : '접수 대기'), text: '', at: Number(p.at || Date.now()), sig: 'pk|' + p.state, picks: [p]});
    });
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }
  function hiddenKey(k, sig) { var m = S.marks[k]; return !!(m && (m.st === 'done' || m.st === 'del') && m.sig === sig); }
  function live() { return S.items.filter(function (it) { return !hiddenKey(it.key, it.sig); }); }

  async function marksLoad() {
    if (typeof SUPABASE_URL === 'undefined' || typeof _sbHeaders !== 'function') return;
    var r = await fetch(SUPABASE_URL + '/rest/v1/app_kv?key=eq.' + MK + '&select=value', {headers: _sbHeaders(), cache: 'no-cache'});
    if (!r.ok) throw new Error('표시 불러오기 ' + r.status);
    var j = await r.json(); S.marks = (j && j[0] && j[0].value) || {};
  }
  async function markSave(k, val) {
    await marksLoad();
    var all = Object.assign({}, S.marks);
    if (val) all[k] = val; else delete all[k];
    Object.keys(all).forEach(function (x) { if (Date.now() - (all[x].at || 0) > 14 * 86400000) delete all[x]; });
    var r = await fetch(SUPABASE_URL + '/rest/v1/app_kv?on_conflict=key', {method: 'POST', headers: _sbHeaders({'Prefer': 'resolution=merge-duplicates,return=minimal'}), body: JSON.stringify({key: MK, value: all, updated_by: me().slice(0, 20)})});
    if (!r.ok) throw new Error('저장 HTTP ' + r.status);
    S.marks = all;
  }

  async function load() {
    if (typeof loadProxyBase !== 'function' || typeof ghPin !== 'function') return;
    var base = await loadProxyBase(); if (!base) throw new Error('서버 연결 안 됨');
    var h = {headers: {'X-Brightbeed-PIN': ghPin(), Accept: 'application/json'}, cache: 'no-store'};
    var res = await Promise.all([
      fetch(base + '/cs/kakao-drafts', h).then(function (r) { if (!r.ok) throw new Error('에이전트 ' + r.status); return r.json(); }),
      fetch(base + '/cs/kakao-pickup', h).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      marksLoad().catch(function () { /* 표시는 다음에 */ })
    ]);
    S.items = build(res[0], res[1]); S.off = !!(res[0] && res[0].off); S.at = Date.now(); S.err = '';
  }

  /* ---- 완료 · 삭제 ---- */
  function find(k) { return S.items.filter(function (x) { return x.key === k; })[0]; }
  function snap(it, st) { return {st: st, sig: it.sig, by: me().slice(0, 20), at: Date.now(), label: it.label, title: it.title, text: String(it.text || pickLine(it.picks[0]) || '').slice(0, 240)}; }
  async function done(k) {
    var it = find(k); if (!it || S.busy[k]) return;
    S.busy[k] = 1; S.note = ''; draw();
    try {
      if (it.kind === 'todo' && it.chat) {
        try {
          var base = await loadProxyBase();
          var r = await fetch(base + '/cs/kakao-done', {method: 'POST', headers: {'X-Brightbeed-PIN': ghPin(), 'Content-Type': 'application/json', Accept: 'application/json'},
            body: JSON.stringify({pid: it.chat.pid, chatId: it.chat.chatId, todo: it.chat.todo || it.title, id: 'none', by: me().slice(0, 20)})});
          var j = await r.json().catch(function () { return {}; });
          if ((!r.ok || !j.ok) && r.status !== 409) S.note = '에이전트 할 일은 못 닫았어요(' + (j.error || r.status) + ') — 이 창에서만 완료로 적었어요';
        } catch (e) { S.note = '에이전트 할 일은 못 닫았어요 — 이 창에서만 완료로 적었어요'; }
      }
      await markSave(k, snap(it, 'done'));
    } catch (e) { S.note = '저장하지 못했어요 — ' + ((e && e.message) || e); }
    delete S.busy[k]; draw(); kick();
  }
  async function del(k) {
    var it = find(k); if (!it || S.busy[k]) return;
    S.busy[k] = 1; S.note = ''; draw();
    try { await markSave(k, snap(it, 'del')); } catch (e) { S.note = '저장하지 못했어요 — ' + ((e && e.message) || e); }
    delete S.busy[k]; draw(); kick();
  }
  async function undo(k) {
    if (S.busy[k]) return; S.busy[k] = 1; draw();
    try { await markSave(k, null); } catch (e) { S.note = '되돌리지 못했어요 — ' + ((e && e.message) || e); }
    delete S.busy[k]; draw(); kick();
  }
  function kick() { try { if (window.KkoUrgent && window.KkoUrgent.tick) window.KkoUrgent.tick(); } catch (e) { /* noop */ } }

  function openChat(it) {
    var c = it && it.chat; if (!c) return;
    try {
      if (typeof triggerCs === 'function' && typeof kkoOpenChat === 'function') {
        triggerCs();
        setTimeout(function () { try { var b = document.getElementById('kkoBox'); if (b) b.scrollIntoView({block: 'start'}); } catch (e) { /* noop */ } }, 500);
        setTimeout(function () { try { kkoOpenChat(c.key); } catch (e) { /* noop */ } }, 900);
        return;
      }
    } catch (e) { /* noop */ }
    if (c.link && /^https:\/\//.test(c.link)) try { window.open(c.link, '_blank', 'noopener'); } catch (e) { /* noop */ }
  }

  /* ---- 화면 ---- */
  function css() {
    if (document.getElementById('csInboxCss')) return;
    var s = document.createElement('style'); s.id = 'csInboxCss';
    s.textContent = ''
      + '#csInbox{position:fixed;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);z-index:99990;font-size:14px;color:#111827;font-family:inherit}'
      + '#csInbox .ci-fab{position:relative;width:58px;height:58px;border-radius:50%;border:0;background:#4f7fcf;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 8px 22px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center}'
      + '#csInbox .ci-fab:focus-visible,#csInbox button:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}'
      + '#csInbox .ci-badge{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;line-height:22px;text-align:center;border:2px solid #fff}'
      + '#csInbox .ci-win{width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 110px));display:flex;flex-direction:column;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,.28);border:1px solid #d6dde8}'
      + '#csInbox .ci-hd{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 14px;background:#4f7fcf;color:#fff}'
      + '#csInbox .ci-hd b{flex:1;font-size:15px}#csInbox .ci-hd small{opacity:.85;font-size:12px;font-weight:400;margin-left:4px}'
      + '#csInbox .ci-hd button{border:0;background:rgba(255,255,255,.18);color:#fff;width:36px;height:36px;border-radius:8px;font-size:18px;cursor:pointer}'
      + '#csInbox .ci-tabs{display:flex;background:#eef2f8;border-bottom:1px solid #d6dde8}'
      + '#csInbox .ci-tabs button{flex:1;border:0;background:none;padding:9px 0;min-height:40px;font:inherit;font-size:13px;color:#475569;cursor:pointer;border-bottom:2px solid transparent}'
      + '#csInbox .ci-tabs button.on{color:#1e3a8a;font-weight:700;border-bottom-color:#4f7fcf}'
      + '#csInbox .ci-bd{flex:1;overflow:auto;background:#b9cbe0;padding:10px 10px 4px}'
      + '#csInbox .ci-empty{margin:40px 12px;text-align:center;color:#334155;font-size:13px}'
      + '#csInbox .ci-msg{display:flex;gap:8px;margin-bottom:12px;align-items:flex-start}'
      + '#csInbox .ci-av{flex:0 0 34px;height:34px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px}'
      + '#csInbox .ci-col{flex:1;min-width:0}#csInbox .ci-nm{font-size:12px;color:#334155;margin:0 0 3px 2px}'
      + '#csInbox .ci-bb{background:#fff;border-radius:4px 14px 14px 14px;padding:9px 11px;border-left:4px solid #4f7fcf;word-break:break-word}'
      + '#csInbox .ci-bb.hot{border-left-color:#dc2626}#csInbox .ci-bb.call{border-left-color:#f59e0b}#csInbox .ci-bb.pick{border-left-color:#0d9488}'
      + '#csInbox .ci-bb.gone{opacity:.75;border-left-color:#94a3b8}'
      + '#csInbox .ci-t{font-weight:700;margin-bottom:4px}#csInbox .ci-tx{white-space:pre-wrap;font-size:13px;line-height:1.45;color:#1f2937}'
      + '#csInbox .ci-tx.cut{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}'
      + '#csInbox .ci-mo{border:0;background:none;color:#2563eb;font:inherit;font-size:12px;padding:2px 0;cursor:pointer}'
      + '#csInbox .ci-pk{margin-top:6px;padding:6px 8px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;font-size:12.5px;line-height:1.4;white-space:pre-wrap}'
      + '#csInbox .ci-bt{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}'
      + '#csInbox .ci-bt button{font:inherit;font-size:13px;min-height:34px;padding:0 12px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#111827;cursor:pointer}'
      + '#csInbox .ci-bt .ci-ok{background:#4f7fcf;border-color:#4f7fcf;color:#fff;font-weight:700}#csInbox .ci-bt .ci-del{color:#b91c1c}'
      + '#csInbox .ci-bt button:disabled{opacity:.5;cursor:default}'
      + '#csInbox .ci-tm{font-size:11px;color:#475569;margin:3px 0 0 2px}'
      + '#csInbox .ci-ft{padding:6px 12px;font-size:12px;color:#475569;background:#fff;border-top:1px solid #e2e8f0;min-height:28px}'
      + '#csInbox .ci-ft.warn{color:#b91c1c}'
      + '@media print{#csInbox{display:none}}';
    document.head.appendChild(s);
  }
  function pickLine(p) {
    if (!p) return '';
    return '🚚 ' + (p.title || '회수') + ' · 자동 수거 ' + (p.state === 'stop' ? '멈춤 — 확인 필요' : '접수 대기')
      + (p.why ? '\n확인할 것: ' + p.why : '') + (p.goods ? '\n상품: ' + String(p.goods).slice(0, 120) : '') + (p.orderId ? '\n주문 ' + p.orderId : '');
  }
  function icon(k) { return k === 'hot' ? '🔴' : k === 'call' ? '🟠' : k === 'pick' ? '🚚' : '🔵'; }
  function bubble(it) {
    var k = it.key, busy = !!S.busy[k], long = String(it.text || '').split('\n').length > 4 || String(it.text || '').length > 180;
    return '<div class="ci-msg"><div class="ci-av" aria-hidden="true">🤖</div><div class="ci-col">'
      + '<div class="ci-nm">CS 에이전트 · ' + esc(it.label) + '</div>'
      + '<div class="ci-bb ' + it.kind + '"><div class="ci-t">' + icon(it.kind) + ' ' + esc(it.title) + '</div>'
      + (it.text ? '<div class="ci-tx' + (long && !S.more[k] ? ' cut' : '') + '">' + esc(it.text) + '</div>' + (long ? '<button type="button" class="ci-mo" data-a="more" data-k="' + esc(k) + '">' + (S.more[k] ? '접기' : '더 보기') + '</button>' : '') : '')
      + it.picks.map(function (p) { return '<div class="ci-pk">' + esc(pickLine(p)) + '</div>'; }).join('')
      + '<div class="ci-bt">' + (it.chat ? '<button type="button" data-a="chat" data-k="' + esc(k) + '">대화 열기</button>' : '')
      + '<button type="button" class="ci-ok" data-a="done" data-k="' + esc(k) + '"' + (busy ? ' disabled' : '') + '>' + (busy ? '저장 중…' : '완료') + '</button>'
      + '<button type="button" class="ci-del" data-a="del" data-k="' + esc(k) + '"' + (busy ? ' disabled' : '') + '>삭제</button></div></div>'
      + '<div class="ci-tm">' + esc(hm(it.at)) + ' · ' + esc(ago(it.at)) + '</div></div></div>';
  }
  function histBubble(k, m) {
    var busy = !!S.busy[k];
    return '<div class="ci-msg"><div class="ci-av" aria-hidden="true">' + (m.st === 'done' ? '✅' : '🗑') + '</div><div class="ci-col">'
      + '<div class="ci-nm">' + esc(m.label || '') + ' · ' + (m.st === 'done' ? '완료' : '삭제') + ' — ' + esc(m.by || '?') + '</div>'
      + '<div class="ci-bb gone"><div class="ci-t">' + esc(m.title || '') + '</div>' + (m.text ? '<div class="ci-tx cut">' + esc(m.text) + '</div>' : '')
      + '<div class="ci-bt"><button type="button" data-a="undo" data-k="' + esc(k) + '"' + (busy ? ' disabled' : '') + '>되돌리기</button></div></div>'
      + '<div class="ci-tm">' + esc(hm(m.at)) + '</div></div></div>';
  }
  function place() {
    if (!root) return;
    var sb = document.getElementById('stockBlank'), off = 16;
    if (sb && sb.offsetHeight) off = 16 + sb.offsetHeight + 10;
    root.style.bottom = 'calc(env(safe-area-inset-bottom,0px) + ' + off + 'px)';
  }
  function draw() {
    if (!mine()) { if (root) { root.remove(); root = null; } return; }
    css();
    if (!root) {
      root = document.createElement('div'); root.id = 'csInbox';
      root.addEventListener('click', onClick);
      document.body.appendChild(root);
    }
    var L = live(), n = L.length, html;
    if (!isOpen()) {
      html = '<button type="button" class="ci-fab" data-a="open" aria-label="CS 알림 대화창 열기' + (n ? ' — ' + n + '건' : '') + '" title="CS 에이전트 알림' + (n ? ' ' + n + '건' : '') + '">💬' + (n ? '<span class="ci-badge">' + (n > 99 ? '99+' : n) + '</span>' : '') + '</button>';
    } else {
      var hist = Object.keys(S.marks).map(function (k) { return [k, S.marks[k]]; }).filter(function (x) { return x[1] && (x[1].st === 'done' || x[1].st === 'del'); })
        .sort(function (a, b) { return (b[1].at || 0) - (a[1].at || 0); }).slice(0, 60);
      var body = S.tab === 'todo'
        ? (n ? L.map(bubble).join('') : '<div class="ci-empty">' + (S.at ? (S.off ? '카톡 에이전트가 꺼져 있어요' : '지금 넘겨받은 일이 없어요 👍') : '불러오는 중…') + '</div>')
        : (hist.length ? hist.map(function (x) { return histBubble(x[0], x[1]); }).join('') : '<div class="ci-empty">완료 · 삭제한 건이 없어요 (14일 보관)</div>');
      var ft = S.note || S.err ? '<div class="ci-ft warn">' + esc(S.note || ('불러오지 못했어요 — ' + S.err)) + '</div>'
        : '<div class="ci-ft">' + (me() === OWNER ? '희선님 담당' : '희선님 담당 · 보기') + (S.at ? ' · ' + esc(hm(S.at).split(' ')[1]) + ' 갱신' : '') + (me() === OWNER && 'Notification' in window && Notification.permission === 'default' ? ' · <button type="button" class="ci-mo" data-a="perm">컴퓨터 알림 켜기</button>' : '') + '</div>';
      html = '<div class="ci-win" role="dialog" aria-label="CS 에이전트 알림 대화창">'
        + '<div class="ci-hd"><b>💬 CS 알림<small>희선님 전용</small></b><button type="button" data-a="ref" aria-label="새로 고침" title="새로 고침">↻</button><button type="button" data-a="close" aria-label="접기" title="접기">–</button></div>'
        + '<div class="ci-tabs" role="tablist"><button type="button" role="tab" data-a="tab" data-t="todo" class="' + (S.tab === 'todo' ? 'on' : '') + '">할 일 ' + n + '</button>'
        + '<button type="button" role="tab" data-a="tab" data-t="hist" class="' + (S.tab === 'hist' ? 'on' : '') + '">완료함 ' + hist.length + '</button></div>'
        + '<div class="ci-bd">' + body + '</div>' + ft + '</div>';
    }
    if (root.__html !== html) {
      var bd = root.querySelector('.ci-bd'), atEnd = !bd || bd.scrollHeight - bd.scrollTop - bd.clientHeight < 40, top = bd ? bd.scrollTop : 0;
      root.__html = html; root.innerHTML = html;
      var nb = root.querySelector('.ci-bd');
      if (nb) nb.scrollTop = S.tab === 'todo' && (atEnd || n > lastN) ? nb.scrollHeight : top;   // 새 건이 오면 맨 아래(카톡처럼)
    }
    lastN = n; place();
  }
  function onClick(e) {
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var a = b.dataset.a, k = b.dataset.k;
    if (a === 'open') { ls(LSO, '1'); draw(); return; }
    if (a === 'close') { ls(LSO, '0'); draw(); return; }
    if (a === 'tab') { S.tab = b.dataset.t; draw(); return; }
    if (a === 'perm') { try { Notification.requestPermission().then(function () { kick(); draw(); }); } catch (x) { /* noop */ } return; }
    if (a === 'ref') { S.note = ''; tick(); return; }
    if (a === 'more') { S.more[k] = !S.more[k]; draw(); return; }
    if (a === 'chat') { openChat(find(k)); return; }
    if (a === 'done') { done(k); return; }
    if (a === 'del') { del(k); return; }
    if (a === 'undo') { undo(k); return; }
  }

  function tick() {
    clearTimeout(timer); timer = setTimeout(tick, POLL);
    if (!mine()) { draw(); return; }
    load().catch(function (e) { S.err = (e && e.message) || String(e); }).then(draw);
  }

  window.CsInbox = {
    tick: tick, view: VIEW,
    /* kko-urgent.js 가 묻는다 — 여기서 완료 · 삭제한 openCall 은 컴퓨터 알림도 멈춤 */
    hidden: function (c) { if (!c || !c.key) return false; var it = find('c:' + c.key); return it ? hiddenKey(it.key, it.sig) : false; },
    open: function () { ls(LSO, '1'); draw(); }
  };
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  window.addEventListener('resize', place);
  if (document.body) setTimeout(tick, 2500); else document.addEventListener('DOMContentLoaded', function () { setTimeout(tick, 2500); });
})();
