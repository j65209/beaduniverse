/* 오늘 나갈 재배송 · 교환 · 불량 (2026-11-26 사장님 "오늘 불량 · 교환 · 재배송 나가야 하는 건은 에이전트가 매일매일 다 건별로 모아줘",
   같은 날 "대화내용 텍스트로 정리 및 이미지도 정리. 마우스오버로").
   · 장부 = 맥미니 sixshop-collector kakao-agent 의 drafts.json reship (2분, 14일) + 카톡 불량 사진 건 /cs/kakao-defects (장부에 없는 그날 건은 '확인 필요').
   · CS팀(#rsBoxCs) · 물류팀(#rsBoxLg) 맨 위. 날짜를 넘겨 지난 날도 봄. 오늘 칸에는 지난 날부터 아직 안 나간 건도 같이(‘N일 전부터’).
   · 줄에 마우스를 올리면(휴대폰은 누르면) 대화 정리 글 + 고객이 보낸 사진이 크게. 사진 · 글은 사무실 인터넷에서만(프록시가 밖이면 비움).
   · 주문번호 · 받는 분 이름 · 연락처 · 주소는 여기 없다 — [대화]로 채팅방을 열거나 주문 찾기에서. 고객 글은 가린 글. */
(function () {
  var S = {drafts: null, defects: null, at: 0, err: '', day: '', loading: false};
  var BOX = ['rsBoxCs', 'rsBoxLg'];
  var ST = {'정보 대기': 'wait', '발송 대기': 'todo', '발송함': 'done', '확인 필요': 'check'};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function kst(ms) { return new Date(ms + 9 * 3600000).toISOString().slice(0, 10); }
  function today() { return kst(Date.now()); }
  function addDay(d, n) { return kst(Date.parse(d + 'T00:00:00+09:00') + n * 86400000 + 3600000); }
  function md(d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); }
  function css() {
    if (document.getElementById('rsCss')) return;
    var st = document.createElement('style'); st.id = 'rsCss';
    st.textContent = '.rs-card{background:#fff;border:1px solid #e6e9ee;border-radius:14px;padding:14px 16px;margin:0 0 14px}'
      + '.rs-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.rs-title{font-weight:800;font-size:15px}.rs-title small{font-weight:600;color:#8a94a0;font-size:12px;margin-left:6px}'
      + '.rs-nav{display:flex;align-items:center;gap:4px;margin-left:auto}.rs-nav button{border:1px solid #dde2e8;background:#fff;border-radius:8px;padding:3px 9px;cursor:pointer;font:inherit;font-size:13px}.rs-nav b{min-width:84px;text-align:center;font-size:13px}'
      + '.rs-cnt{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 4px}.rs-cnt span{font-size:12px;border-radius:999px;padding:2px 9px;background:#f1f3f6;color:#4a5562}'
      + '.rs-list{display:flex;flex-direction:column;gap:4px;margin-top:6px}.rs-row{display:grid;grid-template-columns:64px 52px minmax(0,1fr) auto auto auto;gap:8px;align-items:center;padding:7px 8px;border-radius:9px;border:1px solid #eef0f3;cursor:default;text-align:left}'
      + '.rs-row:hover,.rs-row:focus-within{background:#f6f8fb;border-color:#dfe5ee}.rs-br{font-weight:700;font-size:12.5px}.rs-kd{font-size:11.5px;font-weight:700;border-radius:6px;padding:1px 6px;background:#eef3fb;color:#3c63a8;text-align:center}'
      + '.rs-pd{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rs-pd small{color:#8a94a0;margin-left:6px}.rs-ph{font-size:12px;color:#6b7580}'
      + '.rs-st{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 8px}.rs-st.todo{background:#4f7fcf;color:#fff}.rs-st.wait{background:#fff4d6;color:#8a6100}.rs-st.done{background:#e8f5ec;color:#2f7a45}.rs-st.check{background:#f1f3f6;color:#4a5562}'
      + '.rs-go{border:1px solid #dde2e8;background:#fff;border-radius:8px;padding:2px 8px;font:inherit;font-size:12px;cursor:pointer}.rs-empty{color:#8a94a0;font-size:13px;padding:8px 2px}'
      + '.rs-tip{position:fixed;z-index:9999;width:min(460px,92vw);max-height:80vh;overflow:auto;background:#fff;border:1px solid #d9dee6;border-radius:12px;box-shadow:0 10px 30px rgba(20,30,50,.18);padding:12px 14px;font-size:13px;line-height:1.55}'
      + '.rs-tip pre{white-space:pre-wrap;font:inherit;margin:0 0 8px}.rs-tip .rs-imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}.rs-tip img{width:100%;border-radius:8px;background:#f1f3f6;aspect-ratio:1/1;object-fit:cover}.rs-tip .rs-note{color:#8a94a0;font-size:12px}'
      + '@media (max-width:700px){.rs-row{grid-template-columns:52px 46px minmax(0,1fr) auto}.rs-row .rs-ph,.rs-row .rs-go{display:none}}';
    document.head.appendChild(st);
  }
  /** 그날 줄 — 장부 + 장부에 없는 불량 사진 건 */
  function rowsOf(day) {
    var led = ((S.drafts || {}).reship || []).filter(function (r) { return r && r.key; });
    var isToday = day === today();
    var rows = led.filter(function (r) { return r.day === day || (isToday && r.day < day && r.status !== '발송함'); })
      .map(function (r) { return {src: 'led', r: r}; });
    var seen = {}; led.forEach(function (r) { seen[r.key] = 1; });
    ((S.defects || {}).items || []).forEach(function (d) {
      var k = d.pid + ':' + d.chatId;
      if (d.date !== day || seen[k]) return;
      seen[k] = 1;
      rows.push({src: 'def', r: {key: k, pid: d.pid, chatId: d.chatId, label: d.label, kind: '불량', status: '확인 필요', products: d.product ? [d.product] : [], photos: (d.photos || 0) + (d.videos || 0), day: day,
        summary: '[불량] 확인 필요 (카톡 불량 사진 — 에이전트 장부 밖)\n고객: ' + (d.text || '(사무실 밖이라 가림)') + '\n증상: ' + (d.symptom || '') + '\n상품: ' + (d.product || (d.needsCheck ? '확인 필요' : '')) }});
    });
    var ord = {'발송 대기': 0, '정보 대기': 1, '확인 필요': 2, '발송함': 3};
    rows.sort(function (a, b) { return (ord[a.r.status] - ord[b.r.status]) || ((a.r.firstAt || 0) - (b.r.firstAt || 0)); });
    return rows;
  }
  function draw() {
    css();
    var day = S.day || today();
    var rows = rowsOf(day);
    var cnt = {}; rows.forEach(function (x) { cnt[x.r.status] = (cnt[x.r.status] || 0) + 1; });
    var head = '<div class="rs-head"><span class="rs-title">오늘 나갈 재배송 · 교환 · 불량<small>에이전트 건별 장부 · 줄에 마우스를 올리면 대화 · 사진</small></span>'
      + '<span class="rs-nav"><button type="button" data-rs="prev" aria-label="전날">‹</button><b>' + esc(md(day)) + (day === today() ? ' 오늘' : '') + '</b><button type="button" data-rs="next" aria-label="다음날"' + (day >= today() ? ' disabled' : '') + '>›</button><button type="button" data-rs="re" title="다시 불러오기" aria-label="다시 불러오기">↻</button></span></div>';
    var chips = '<div class="rs-cnt">' + ['발송 대기', '정보 대기', '확인 필요', '발송함'].filter(function (k) { return cnt[k]; }).map(function (k) { return '<span>' + k + ' ' + cnt[k] + '</span>'; }).join('') + '</div>';
    var list = rows.length ? rows.map(function (x, i) {
      var r = x.r, p = (r.products || []);
      var old = r.day && r.day < day ? '<small>' + Math.round((Date.parse(day) - Date.parse(r.day)) / 86400000) + '일 전부터</small>' : '';
      return '<div class="rs-row" tabindex="0" data-i="' + i + '"><span class="rs-br">' + esc(r.label || '') + '</span><span class="rs-kd">' + esc(r.kind) + '</span>'
        + '<span class="rs-pd">' + esc(p.length ? p.join(' / ') : '상품 확인 필요') + old + '</span><span class="rs-ph">' + (r.photos ? '📷 ' + r.photos : '') + '</span>'
        + '<span class="rs-st ' + (ST[r.status] || 'check') + '">' + esc(r.status) + '</span><button type="button" class="rs-go" data-k="' + esc(r.key) + '">대화</button></div>';
    }).join('') : '<div class="rs-empty">' + (S.err && !S.drafts ? '불러오지 못했어요 (' + esc(S.err) + ')' : '이날 나갈 건이 없어요') + '</div>';
    BOX.forEach(function (id) {
      var b = document.getElementById(id); if (!b) return;
      b.innerHTML = head + chips + '<div class="rs-list">' + list + '</div>';
      b._rows = rows;
    });
  }
  async function load(force) {
    if (S.loading) return;
    if (!force && Date.now() - S.at < 110000 && S.drafts) return draw();
    S.loading = true;
    try {
      var base = await loadProxyBase(); if (!base) throw new Error('서버 연결 안 됨');
      var r = await fetch(base + '/cs/kakao-drafts', {headers: {'X-Brightbeed-PIN': ghPin(), Accept: 'application/json'}, cache: 'no-store'});
      var j = await r.json().catch(function () { return null; });
      if (!r.ok || !j) throw new Error('HTTP ' + r.status);
      S.drafts = j; S.err = '';
      try { var d = await bbKakaoDefects(force); if (d && d.data) S.defects = d.data; } catch (e) { /* 사진 건은 없어도 됨 */ }
    } catch (e) { S.err = (e && e.message) || String(e); }
    finally { S.at = Date.now(); S.loading = false; draw(); }
  }
  /* 마우스 올리면 정리 글 + 사진 */
  var tip = null, tipFor = null;
  function hideTip() { if (tip) tip.remove(); tip = null; tipFor = null; }
  function photosOf(r) {
    var it = ((S.defects || {}).items || []).filter(function (d) { return d.pid + ':' + d.chatId === r.key; });
    var out = []; it.forEach(function (d) { (d.images || []).forEach(function (m) { if (out.length < 8) out.push(m); }); });
    return out;
  }
  function showTip(row, r) {
    if (tipFor === row) return;
    hideTip(); tipFor = row;
    tip = document.createElement('div'); tip.className = 'rs-tip'; tip.setAttribute('role', 'tooltip');
    var imgs = photosOf(r);
    tip.innerHTML = '<pre>' + esc(r.summary || '') + '</pre>' + (r.doneAt ? '<div class="rs-note">발송함 ' + esc(new Date(r.doneAt).toLocaleString('ko-KR')) + (r.doneBy ? ' · ' + esc(r.doneBy) : '') + '</div>' : '')
      + (imgs.length ? '<div class="rs-imgs">' + imgs.map(function (m, i) { return '<img alt="고객이 보낸 사진 ' + (i + 1) + '" data-u="' + esc(m.full || m.thumb) + '">'; }).join('') + '</div>'
        : '<div class="rs-note">' + (r.photos ? '사진은 대화창에서 (보관 사진이 없거나 사무실 인터넷이 아님)' : '받은 사진 없음') + '</div>');
    document.body.appendChild(tip);
    var b = row.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.min(window.innerWidth - w - 8, Math.max(8, b.left + 80)), y = b.bottom + 6;
    if (y + h > window.innerHeight - 8) y = Math.max(8, b.top - h - 6);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    tip.querySelectorAll('img[data-u]').forEach(function (im) {
      if (typeof bbCsImg !== 'function') return;
      bbCsImg(im.dataset.u).then(function (src) { im.src = src; }).catch(function () { im.alt = '사진을 못 불러옴'; });
    });
  }
  function rowAt(el) { var row = el && el.closest && el.closest('.rs-row'); var box = row && row.closest('.rs-card'); return row && box && box._rows ? {row: row, r: box._rows[Number(row.dataset.i)].r} : null; }
  document.addEventListener('mouseover', function (e) { var x = rowAt(e.target); if (x) showTip(x.row, x.r); else if (tip && !(e.target.closest && e.target.closest('.rs-tip'))) hideTip(); });
  document.addEventListener('focusin', function (e) { var x = rowAt(e.target); if (x) showTip(x.row, x.r); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-rs],.rs-go');
    if (!b) { var x = rowAt(e.target); if (x) showTip(x.row, x.r); return; }
    if (b.classList.contains('rs-go')) {
      hideTip();
      var key = b.dataset.k;
      try { if (typeof triggerCs === 'function' && document.getElementById('viewCs').hidden) triggerCs(); } catch (x) { /* noop */ }
      setTimeout(function () { try { var k = document.getElementById('kkoBox'); if (k) k.scrollIntoView({behavior: 'smooth', block: 'start'}); if (typeof kkoTab === 'function') kkoTab('chat'); kkoOpenChat(key); } catch (x) { console.warn('재배송 장부 대화 열기', x); } }, 400);
      return;
    }
    var a = b.dataset.rs, day = S.day || today();
    if (a === 'prev') S.day = addDay(day, -1);
    else if (a === 'next') S.day = addDay(day, 1) > today() ? today() : addDay(day, 1);
    else if (a === 're') return load(true);
    draw();
  });
  function visible() { return BOX.some(function (id) { var b = document.getElementById(id); return b && b.offsetParent; }); }
  setInterval(function () { if (!document.hidden && visible()) load(false); }, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && visible()) load(false); });
  window.Reship = {load: load, rows: function (d) { return rowsOf(d || today()); }, state: S};
  function boot() { if (visible()) load(true); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1500); }); else setTimeout(boot, 1500);
})();
