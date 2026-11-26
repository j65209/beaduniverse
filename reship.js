/* 오늘 나갈 재배송 · 교환 · 불량 (2026-11-26 사장님 "오늘 불량 · 교환 · 재배송 나가야 하는 건은 에이전트가 매일매일 다 건별로 모아줘",
   같은 날 "대화내용 텍스트로 정리 및 이미지도 정리. 마우스오버로").
   · 장부 = 맥미니 sixshop-collector kakao-agent 의 drafts.json reship (2분, 14일) + 카톡 불량 사진 건 /cs/kakao-defects (장부에 없는 그날 건은 '확인 필요').
   · CS팀(#rsBoxCs) · 물류팀(#rsBoxLg) 맨 위. 표 하나(11-26 [오늘] · [재배송 목록] 탭 합침) — 아직 안 나간 건만, 날짜 넘기기 없음.
   · 줄에 마우스를 올리면(휴대폰은 누르면) 대화 정리 글 + 고객이 보낸 사진이 크게. 사진 · 글은 사무실 인터넷에서만(프록시가 밖이면 비움).
   · 주문번호 · 받는 분 이름 · 연락처 · 주소는 여기 없다 — [대화]로 채팅방을 열거나 주문 찾기에서. 고객 글은 가린 글. */
(function () {
  var S = {drafts: null, defects: null, full: null, marks: {}, mkErr: '', at: 0, err: '', loading: false};
  var BOX = ['rsBoxCs', 'rsBoxLg'];
  var ST = {'정보 대기': 'wait', '발송 대기': 'todo', '발송함': 'done', '확인 필요': 'check'};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function kst(ms) { return new Date(ms + 9 * 3600000).toISOString().slice(0, 10); }
  function today() { return kst(Date.now()); }
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
      + '.rs-tabs{display:flex;gap:4px;margin:-2px 0 10px;border-bottom:1px solid #eef0f3}.rs-tabs button{border:0;background:none;font:inherit;font-size:13.5px;font-weight:700;color:#8a94a0;padding:6px 10px;border-bottom:2px solid transparent;cursor:pointer}.rs-tabs button[aria-selected="true"]{color:#1f2a37;border-bottom-color:#4f7fcf}'
      + '.rs-warn{font-size:12.5px;color:#8a6100;background:#fff8e6;border-radius:8px;padding:6px 10px;margin:8px 0}.rs-chk{font-size:12.5px;display:flex;align-items:center;gap:4px;margin-right:6px}'
      + '.rs-tblw{overflow:auto;max-height:70vh;margin-top:8px;border:1px solid #eef0f3;border-radius:10px}.rs-tbl{border-collapse:collapse;width:100%;font-size:12.5px;text-align:left}.rs-tbl th{position:sticky;top:0;background:#f6f8fb;font-weight:700;padding:7px 8px;white-space:nowrap;text-align:left}.rs-tbl td{padding:6px 8px;border-top:1px solid #f0f2f5;vertical-align:top;text-align:left}.rs-tbl tr.rs-row{display:table-row;border:0}.rs-tbl .c-day,.rs-tbl .c-brand,.rs-tbl .c-kind,.rs-tbl .c-zip,.rs-tbl .c-tel,.rs-tbl .c-nm,.rs-tbl .c-order,.rs-tbl .rs-st{white-space:nowrap}.rs-tbl .c-addr{min-width:220px}.rs-tbl .c-goods{min-width:180px}.rs-tbl .c-why{min-width:160px;color:#4a5562}.rs-act{white-space:nowrap;display:flex;gap:4px}'
      + '.rs-in{width:118px;border:1px solid #dde2e8;border-radius:6px;padding:3px 6px;font:inherit;font-size:12.5px}.rs-in[data-f="memo"]{width:160px}.rs-sent{background:#4f7fcf;color:#fff;border-color:#4f7fcf}'
      + '.rs-sub{margin:14px 0 2px;font-size:13px;font-weight:700;color:#4a5562}.rs-sub small{font-weight:600;color:#8a94a0;font-size:12px;margin-left:6px}'
      + '@media (max-width:700px){.rs-row{grid-template-columns:52px 46px minmax(0,1fr) auto}.rs-row .rs-ph,.rs-row .rs-go{display:none}}';
    document.head.appendChild(st);
  }
  /** 그날 줄 — 장부 + 장부에 없는 불량 사진 건 */
  function rowsOf(day) {
    var led = ((S.drafts || {}).reship || []).filter(function (r) { return r && r.key; });
    var isToday = day === today();
    var rows = led.filter(function (r) { return r.day === day || (isToday && r.day < day && r.status !== '발송함'); })
      .map(function (r) { var m = (S.marks || {})[r.id]; return {src: 'led', r: m && m.sent && r.status !== '발송함' ? Object.assign({}, r, {status: '발송함'}) : r}; });
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
  /* 한 화면 (2026-11-26 사장님 "오늘이나 재배송 목록 저걸 합쳐줘 · 출고된건 내역에서 없애줘") —
     [오늘] · [📦 재배송 목록] 탭을 걷고 표 하나. 나간 건(발송함)은 안 보임. 재배송을 아직 안 정한 문의(확인 필요)는 표 밑 작은 칸 — 복사 · 엑셀에는 안 들어감 */
  function checkRows() {
    var t = today();
    return rowsOf(t).filter(function (x) { return x.r.status === '확인 필요'; }).map(function (x) { var m = (S.marks || {})[x.r.id]; return m && m.sent ? null : x; }).filter(Boolean);
  }
  function draw() {
    css();
    // 송장번호 · 메모를 쓰는 중이면 다시 그리지 않음 (글자가 날아가지 않게)
    var ae = document.activeElement; if (ae && ae.classList && ae.classList.contains('rs-in')) return;
    var t = listView(), chk = checkRows(), n0 = t.rows.length;
    var chkHtml = chk.length ? '<div class="rs-sub">재배송 아직 안 정한 문의 · 확인 필요 ' + chk.length + '<small>정해지면 위 표로 올라가요</small></div><div class="rs-list">' + chk.map(function (x, i) {
      var r = x.r, p = (r.products || []);
      return '<div class="rs-row" tabindex="0" data-i="' + (n0 + i) + '"><span class="rs-br">' + esc(r.label || '') + '</span><span class="rs-kd">' + esc(r.kind) + '</span>'
        + '<span class="rs-pd">' + esc(p.length ? p.join(' / ') : '상품 확인 필요') + '</span><span class="rs-ph">' + (r.photos ? '📷 ' + r.photos : '') + '</span>'
        + '<span class="rs-st check">확인 필요</span><button type="button" class="rs-go" data-k="' + esc(r.key) + '">대화</button></div>';
    }).join('') + '</div>' : '';
    BOX.forEach(function (id) {
      var b = document.getElementById(id); if (!b) return;
      b.innerHTML = t.html + chkHtml;
      b._rows = t.rows.concat(chk);
    });
  }

  /* ===== 📦 재배송 목록 (2026-11-26 사장님 "지금 대한통운 연결이 안되어서 우선 재배송 목록들은 정리해줘. 탭 만들어서") =====
     한 줄 = 한 건. 받는 분 · 연락처 · 주소 · 주문번호 · 옵션 · 수량은 프록시 /cs/kakao-reship(맥미니 reship.json, 사무실 인터넷에서만)이 있을 때만 — 없으면 빈칸 + 안내.
     직원 손 작업: 송장번호 · 메모(app_kv 'reship_marks'), [발송함] = 오피스 [처리함](/cs/kakao-done, 사무실에서만)과 같음 → 에이전트 장부도 발송함. 복사 · 엑셀(CSV) 내려받기 */
  var MK_KEY = 'reship_marks';
  function fullRows() {
    var full = {}; ((S.full || {}).rows || []).forEach(function (r) { full[r.id] = r; });
    return ((S.drafts || {}).reship || []).map(function (r) { var f = full[r.id] || {}; var m = (S.marks || {})[r.id] || {}; return Object.assign({}, r, {ship: f.ship || null, orderIds: f.orderIds || null, mark: m, status: m.sent ? '발송함' : r.status}); });
  }
  function cols(r) {
    var s = r.ship || {}, it = (s.items && s.items.length) ? s.items : (r.products || []).map(function (n) { return {name: n, option: '', qty: ''}; });
    var why = String(r.problem || '').split(' / ').slice(-1)[0];
    return {
      day: r.day, brand: r.label || r.brand, kind: r.kind, nm: s.nm || '', tel: s.tel || '', zip: s.zip || '', addr: [s.addr, s.detail].filter(Boolean).join(' '),
      goods: it.map(function (i) { return i.name; }).join(' / '), opt: it.some(function (i) { return i.option; }) ? it.map(function (i) { return i.option || '-'; }).join(' / ') : '', qty: it.some(function (i) { return i.qty; }) ? it.map(function (i) { return i.qty || '-'; }).join(' / ') : '',
      order: (s.orderId || (r.orderIds || [])[0] || ''), why: why.slice(0, 60), status: r.status, inv: (r.mark || {}).inv || '', memo: (r.mark || {}).memo || ''
    };
  }
  var HEAD = [['day', '날짜'], ['brand', '브랜드'], ['kind', '구분'], ['nm', '받는 분'], ['tel', '연락처'], ['zip', '우편번호'], ['addr', '주소'], ['goods', '보낼 상품'], ['opt', '옵션'], ['qty', '수량'], ['order', '주문번호'], ['why', '사유'], ['status', '상태'], ['inv', '송장번호'], ['memo', '메모']];
  /** 나갈 것만 — 확인 필요 · 발송함(직원 대화 · [발송함] · 대화 분석) 빼고 */
  function openRows() { return fullRows().filter(function (r) { return r.status !== '확인 필요' && r.status !== '발송함'; }); }
  function listView() {
    var rows = openRows().sort(function (a, b) { return (a.status === '정보 대기') - (b.status === '정보 대기') || (a.firstAt || 0) - (b.firstAt || 0); });
    var shipMiss = !S.full;
    var cnt = {}; rows.forEach(function (r) { cnt[r.status] = (cnt[r.status] || 0) + 1; });
    var top = '<div class="rs-head"><span class="rs-title">나갈 재배송 · 교환 · 불량<small>보낸 건은 안 보여요 · 줄에 마우스를 올리면 대화 · 사진</small></span>'
      + '<span class="rs-nav"><button type="button" data-rs="copy">표 복사</button><button type="button" data-rs="csv">엑셀 내려받기</button><button type="button" data-rs="re" aria-label="다시 불러오기">↻</button></span></div>'
      + '<div class="rs-cnt">' + ['발송 대기', '정보 대기'].filter(function (k) { return cnt[k]; }).map(function (k) { return '<span>' + k + ' ' + cnt[k] + '</span>'; }).join('') + '</div>'
      + (shipMiss ? '<div class="rs-warn">받는 분 · 연락처 · 주소 · 주문번호는 서버(맥미니 프록시 /cs/kakao-reship) 연결 뒤 사무실 인터넷에서 채워져요. 그 전에는 [대화]로 채팅방을 열어 확인해 주세요.</div>' : (S.full.outside ? '<div class="rs-warn">사무실 밖이라 받는 분 정보는 가렸어요.</div>' : ''))
      + (S.mkErr ? '<div class="rs-warn">' + esc(S.mkErr) + '</div>' : '');
    var body = rows.length ? '<div class="rs-tblw"><table class="rs-tbl"><thead><tr>' + HEAD.map(function (h) { return '<th>' + h[1] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>'
      + rows.map(function (r, i) {
        var c = cols(r);
        return '<tr class="rs-row" tabindex="0" data-i="' + i + '">' + HEAD.map(function (h) {
          var k = h[0];
          if (k === 'inv') return '<td><input class="rs-in" data-f="inv" data-id="' + esc(r.id) + '" value="' + esc(c.inv) + '" placeholder="송장번호" inputmode="numeric" aria-label="송장번호"></td>';
          if (k === 'memo') return '<td><input class="rs-in" data-f="memo" data-id="' + esc(r.id) + '" value="' + esc(c.memo) + '" placeholder="메모 (개인정보 쓰지 말기)" aria-label="메모"></td>';
          if (k === 'status') return '<td><span class="rs-st ' + (ST[c.status] || 'check') + '">' + esc(c.status) + '</span></td>';
          return '<td class="c-' + k + '">' + esc(c[k]) + '</td>';
        }).join('') + '<td class="rs-act">' + (r.status === '발송함' ? '' : '<button type="button" class="rs-go rs-sent" data-id="' + esc(r.id) + '">발송함</button>') + '<button type="button" class="rs-go" data-k="' + esc(r.key) + '">대화</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="rs-empty">' + (S.err && !S.drafts ? '불러오지 못했어요 (' + esc(S.err) + ')' : '지금 나갈 건이 없어요') + '</div>';
    return {html: top + body, rows: rows.map(function (r) { return {r: r}; })};
  }
  function tsv(sep) {
    var rows = openRows();
    var q = function (v) { v = String(v == null ? '' : v); return sep === ',' ? '"' + v.replace(/"/g, '""') + '"' : v.replace(/[\t\n]/g, ' '); };
    return [HEAD.map(function (h) { return q(h[1]); }).join(sep)].concat(rows.map(function (r) { var c = cols(r); return HEAD.map(function (h) { return q(c[h[0]]); }).join(sep); })).join('\n');
  }
  async function marksLoad() {
    if (typeof SUPABASE_URL === 'undefined' || typeof _sbHeaders !== 'function') return;
    try {
      var r = await fetch(SUPABASE_URL + '/rest/v1/app_kv?key=eq.' + MK_KEY + '&select=value', {headers: _sbHeaders(), cache: 'no-cache'});
      var j = await r.json(); S.marks = (j && j[0] && j[0].value) || {}; S.mkErr = '';
    } catch (e) { S.mkErr = '송장번호 · 메모를 못 불러왔어요'; }
  }
  async function markSave(id, patch) {
    await marksLoad();
    var me = ''; try { me = (localStorage.getItem('brightbeed_diary_me') || '').trim().slice(0, 20); } catch (e) { /* noop */ }
    var m = Object.assign({}, (S.marks || {})[id] || {}, patch, {by: me, at: Date.now()});
    var all = Object.assign({}, S.marks || {}); all[id] = m;
    // 30일 지난 것은 정리
    Object.keys(all).forEach(function (k) { if (Date.now() - (all[k].at || 0) > 30 * 86400000) delete all[k]; });
    var r = await fetch(SUPABASE_URL + '/rest/v1/app_kv?on_conflict=key', {method: 'POST', headers: _sbHeaders({'Prefer': 'resolution=merge-duplicates,return=minimal'}), body: JSON.stringify({key: MK_KEY, value: all, updated_by: me})});
    if (!r.ok) throw new Error('저장 HTTP ' + r.status);
    S.marks = all;
  }
  async function sentClick(id) {
    var r = fullRows().filter(function (x) { return x.id === id; })[0]; if (!r) return;
    if (!window.confirm((r.label || '') + ' ' + r.kind + ' 건을 발송함으로 적을까요?' + (r.mark && r.mark.inv ? '' : '\n(송장번호가 비어 있어요)'))) return;
    try {
      var base = await loadProxyBase(); if (!base) throw new Error('서버 연결 안 됨');
      var me = ''; try { me = (localStorage.getItem('brightbeed_diary_me') || '').trim().slice(0, 20); } catch (e) { /* noop */ }
      var res = await fetch(base + '/cs/kakao-done', {method: 'POST', headers: {'X-Brightbeed-PIN': ghPin(), 'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify({pid: r.pid, chatId: r.key.split(':')[1], todo: r.todo || '불량 · 오배송 처리', id: 'none', by: me})});
      var j = await res.json().catch(function () { return {}; });
      if (!res.ok || !j.ok) throw new Error(j.error || 'HTTP ' + res.status);
      await markSave(id, {sent: Date.now()});
      S.mkErr = '';
    } catch (e) { S.mkErr = '발송함으로 적지 못했어요 — ' + ((e && e.message) || e); }
    draw();
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
      // 받는 분 · 주소가 든 장부 (프록시가 생기면) — 없거나 실패하면 그냥 빈칸
      try { var rf = await fetch(base + '/cs/kakao-reship', {headers: {'X-Brightbeed-PIN': ghPin(), Accept: 'application/json'}, cache: 'no-store'}); var jf = rf.ok ? await rf.json().catch(function () { return null; }) : null; S.full = jf && Array.isArray(jf.rows) ? jf : null; } catch (e) { S.full = null; }
      await marksLoad();
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
    if (!b) { if (e.target.closest && e.target.closest('.rs-in')) return; var x = rowAt(e.target); if (x) showTip(x.row, x.r); return; }
    if (b.classList.contains('rs-sent')) { hideTip(); sentClick(b.dataset.id); return; }
    if (b.dataset.rs === 'copy' || b.dataset.rs === 'csv') {
      if (b.dataset.rs === 'copy') { try { navigator.clipboard.writeText(tsv('\t')).then(function () { b.textContent = '복사했어요'; setTimeout(function () { b.textContent = '표 복사'; }, 1500); }); } catch (x) { /* noop */ } return; }
      var blob = new Blob(['﻿' + tsv(',')], {type: 'text/csv;charset=utf-8'}), u = URL.createObjectURL(blob), a2 = document.createElement('a');
      a2.href = u; a2.download = '재배송목록_' + today() + '.csv'; document.body.appendChild(a2); a2.click(); a2.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
      return;
    }
    if (b.classList.contains('rs-go')) {
      hideTip();
      var key = b.dataset.k;
      try { if (typeof triggerCs === 'function' && document.getElementById('viewCs').hidden) triggerCs(); } catch (x) { /* noop */ }
      setTimeout(function () { try { var k = document.getElementById('kkoBox'); if (k) k.scrollIntoView({behavior: 'smooth', block: 'start'}); if (typeof kkoTab === 'function') kkoTab('chat'); kkoOpenChat(key); } catch (x) { console.warn('재배송 장부 대화 열기', x); } }, 400);
      return;
    }
    if (b.dataset.rs === 're') return load(true);
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!(t.classList && t.classList.contains('rs-in'))) return;
    var p = {}; p[t.dataset.f] = String(t.value || '').trim().slice(0, t.dataset.f === 'inv' ? 20 : 120);
    t.disabled = true;
    markSave(t.dataset.id, p).then(function () { S.mkErr = ''; }).catch(function (x) { S.mkErr = '저장하지 못했어요 — ' + ((x && x.message) || x); }).then(function () { t.disabled = false; if (S.mkErr) draw(); });
  });
  function visible() { return BOX.some(function (id) { var b = document.getElementById(id); return b && b.offsetParent; }); }
  setInterval(function () { if (!document.hidden && visible()) load(false); }, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && visible()) load(false); });
  window.Reship = {load: load, draw: draw, rows: function () { return openRows(); }, state: S};
  function boot() { if (visible()) load(true); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1500); }); else setTimeout(boot, 1500);
})();
