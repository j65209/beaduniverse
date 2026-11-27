/* 오늘 나갈 재배송 · 교환 · 불량 (2026-11-26 사장님 "오늘 불량 · 교환 · 재배송 나가야 하는 건은 에이전트가 매일매일 다 건별로 모아줘",
   같은 날 "대화내용 텍스트로 정리 및 이미지도 정리. 마우스오버로").
   · 장부 = 맥미니 sixshop-collector kakao-agent 의 drafts.json reship (2분, 14일) + 카톡 불량 사진 건 /cs/kakao-defects (장부에 없는 그날 건은 '확인 필요').
   · CS팀(#rsBoxCs) · 물류팀(#rsBoxLg) 맨 위. 표 하나(11-26 [오늘] · [재배송 목록] 탭 합침) — 아직 안 나간 건만, 날짜 넘기기 없음.
   · 줄에 마우스를 올리면(휴대폰은 누르면) 대화 정리 글 + 고객이 보낸 사진이 크게. 사진 · 글은 사무실 인터넷에서만(프록시가 밖이면 비움).
   · 주문번호 · 받는 분 이름 · 연락처 · 주소는 여기 없다 — [대화]로 채팅방을 열거나 주문 찾기에서. 고객 글은 가린 글. */
(function () {
  var S = {drafts: null, defects: null, full: null, marks: {}, mkErr: '', at: 0, err: '', loading: false, ret: null, pick: null};
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
      + '.rs-in{width:118px;border:1px solid #dde2e8;border-radius:6px;padding:3px 6px;font:inherit;font-size:12.5px}.rs-tbl .c-goods{min-width:240px}.rs-it{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 6px;padding:2px 0}.rs-it+.rs-it{border-top:1px dashed #e6e9ee;margin-top:3px;padding-top:4px}.rs-it b{font-size:13.5px;color:#1f2a37}.rs-op{font-size:12.5px;font-weight:700;color:#3c63a8;background:#eef3fb;border-radius:6px;padding:1px 7px}.rs-q{font-size:12px;color:#6b7580}.rs-q.many{color:#c0392b;font-weight:800}'
      + '.rs-inv{font-weight:700;font-variant-numeric:tabular-nums;margin-right:4px}.rs-tag{font-size:11px;font-weight:700;border-radius:999px;padding:1px 7px;background:#f1f3f6;color:#4a5562;white-space:nowrap}.rs-tag.ok{background:#e8f5ec;color:#2f7a45}.rs-tag.dev{background:#fff4d6;color:#8a6100}.rs-cj{border-color:#4f7fcf;color:#3c63a8;font-weight:700}'
      + '.rs-hand-box{margin:8px 0;padding:8px 10px;border-radius:10px;background:#fff1f0;border:1px solid #f5c2bd;font-size:13px}.rs-hand-box div{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px}.rs-sent{background:#4f7fcf;color:#fff;border-color:#4f7fcf}'
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
  /** 지난 날 "금일 재발송" 약속인데 보냈다는 글이 대화에 없음 (2026-11-26 사장님 "대화내용 분석하던지 아니면 확인 필요로 띄워봐")
      — 표에서 빼 확인 칸으로. [보냈어요] = 발송함, [아직 안 보냄] = 표로 되돌림 */
  function stale(r) { var m = (S.marks || {})[r.id] || {}; return r.status === '발송 대기' && r.day && r.day < today() && !m.notYet && !m.sent && !m.hand; }
  function md(d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); }
  function checkRows() {
    var t = today();
    var old = fullRows().filter(stale).map(function (r) { return {stale: 1, r: Object.assign({}, r, {summary: '[출고 확인 필요] ' + md(r.day) + '에 재발송하겠다고 답했지만, 보냈다는 글(출고 · 송장)이 대화에 없어요\n' + (r.summary || '')})}; });
    return old.concat(rowsOf(t).filter(function (x) { return x.r.status === '확인 필요'; }).map(function (x) { var m = (S.marks || {})[x.r.id]; return m && m.sent ? null : x; }).filter(Boolean));
  }
  /* 수거 접수 필요 (2026-11-27 사장님 "어제부터 자동수거 필요한것도 상단에 띄워줘. 나가야하는거랑 같이")
     = 반품 현황(/cs/returns, 식스샵프로 반품 · 교환)의 할 일 '수거 접수' + 카톡 자동 수거(/cs/kakao-pickup)의 접수 대기 · 확인 필요.
     어제(KST) 0시 뒤 들어온 것만, 같은 주문은 한 줄. 수거가 잡히면(회수 운송장 · 접수됨) 저절로 빠짐 */
  function pickRows() {
    var y = kst(Date.now() - 86400000), out = [], seen = {}, older = 0;
    ((S.pick || {}).items || []).forEach(function (p) {
      if (p.state !== 'wait' && p.state !== 'stop') return;
      var d = kst(p.at || 0);
      if (d < y) { older++; return; }
      if (p.orderId) seen[p.orderId] = 1;
      out.push({r: {id: p.id, key: p.pid && p.chatId ? p.pid + ':' + p.chatId : '', label: p.label || '', kind: p.title || '회수', goods: p.goods || '', nm: p.nick || '', orderId: p.orderId || '', day: d, at: p.at || 0,
        stop: p.state === 'stop', st: p.state === 'stop' ? '수거 확인 필요' : '수거 요청 대기',
        summary: '[수거 접수 필요] ' + (p.title || '회수') + ' · 카톡 자동 수거\n' + (p.why ? '확인할 것: ' + p.why + '\n' : '') + '상품: ' + (p.goods || '확인 필요') + (p.orderId ? '\n주문 ' + p.orderId : '')}});
    });
    ((S.ret || {}).rows || []).forEach(function (r) {
      if (r.todo !== 'book') return;
      var t = Date.parse(r.requestedAt), d = isNaN(t) ? '' : kst(t);
      if (!d || d < y) { older++; return; }
      if (r.orderId && seen[r.orderId]) return;
      seen[r.orderId] = 1;
      var ck = r.chat && /^https:\/\//.test(r.chat.link || '') ? r.chat.link : '';
      out.push({r: {id: r.key, key: '', link: ck, label: r.brandName || r.brand || '', kind: r.kind || '반품', goods: (r.items || []).join(' / '), nm: r.nm || '', orderId: r.orderId || '', day: d, at: t,
        stop: false, st: r.late ? '수거 늦음' : '수거 접수 필요',
        summary: '[수거 접수 필요] ' + (r.kind || '반품') + ' · 식스샵프로 ' + (r.claimStatus || '') + '\n' + (r.todoKo || '회수 운송장 없음') + '\n상품: ' + (r.items || []).join(' · ') + '\n주문 ' + (r.orderId || '')}});
    });
    out.sort(function (a, b) { return (b.r.stop - a.r.stop) || (a.r.at - b.r.at); });
    return {rows: out, older: older};
  }
  function draw() {
    css();
    // 송장번호 · 메모를 쓰는 중이면 다시 그리지 않음 (글자가 날아가지 않게)
    var ae = document.activeElement; if (ae && ae.classList && ae.classList.contains('rs-in')) return;
    var t = listView(), chk = checkRows(), n0 = t.rows.length;
    var chkHtml = chk.length ? '<div class="rs-sub">확인 필요 ' + chk.length + '<small>보냈는지 대화로 확인 안 된 지난 약속 · 재배송을 아직 안 정한 문의</small></div><div class="rs-list">' + chk.map(function (x, i) {
      var r = x.r, p = (r.products || []);
      return '<div class="rs-row" tabindex="0" data-i="' + (n0 + i) + '"><span class="rs-br">' + esc(r.label || '') + '</span><span class="rs-kd">' + esc(r.kind) + '</span>'
        + '<span class="rs-pd">' + esc(p.length ? p.join(' / ') : '상품 확인 필요') + '</span><span class="rs-ph">' + (r.photos ? '📷 ' + r.photos : '') + '</span>'
        + (x.stale ? '<span class="rs-st check">출고 확인 · ' + esc(md(r.day)) + ' 약속</span><span class="rs-act"><button type="button" class="rs-go rs-sent" data-id="' + esc(r.id) + '">보냈어요</button><button type="button" class="rs-go rs-notyet" data-id="' + esc(r.id) + '">아직 안 보냄</button>' : '<span class="rs-st check">확인 필요</span><span class="rs-act">')
        + '<button type="button" class="rs-go" data-k="' + esc(r.key) + '">대화</button></span></div>';
    }).join('') + '</div>' : '';
    var pk = pickRows(), n1 = n0 + chk.length;
    var pkHtml = pk.rows.length || pk.older ? '<div class="rs-sub">수거 접수 필요 ' + pk.rows.length + '<small>어제부터 들어온 반품 · 교환 · 오배송 회수 중 대한통운 수거가 아직 안 잡힌 것' + (pk.older ? ' · 그 전 ' + pk.older + '건은 반품 현황' : '') + '</small></div>'
      + (pk.rows.length ? '<div class="rs-list">' + pk.rows.map(function (x, i) {
        var r = x.r;
        return '<div class="rs-row" tabindex="0" data-i="' + (n1 + i) + '"><span class="rs-br">' + esc(r.label || '') + '</span><span class="rs-kd">' + esc(r.kind) + '</span>'
          + '<span class="rs-pd">' + esc(r.goods || '상품 확인 필요') + '<small>' + esc([r.nm, r.orderId].filter(Boolean).join(' · ')) + '</small></span><span class="rs-ph">' + esc(md(r.day)) + '</span>'
          + '<span class="rs-st ' + (r.stop ? 'wait' : 'todo') + '">' + esc(r.st) + '</span><span class="rs-act">'
          + (r.key ? '<button type="button" class="rs-go" data-k="' + esc(r.key) + '">대화</button>' : (r.link ? '<a class="rs-go rs-link" href="' + esc(r.link) + '" target="_blank" rel="noopener">카톡 방</a>' : ''))
          + '</span></div>';
      }).join('') + '</div>' : '') : '';
    BOX.forEach(function (id) {
      var b = document.getElementById(id); if (!b) return;
      b.innerHTML = t.html + chkHtml + pkHtml;
      b._rows = t.rows.concat(chk, pk.rows);
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
  /** 사유 한 줄 (2026-11-26 사장님 "사유는 대화내용을 보고 간략하게") — 고객 글 · 우리 약속에서 증상과 처리만 뽑음. 긴 대화는 마우스 올리면 */
  var SYM = [[/장식|큐빅|알(이)?\s*빠|떨어져|떨어졌|분리/, '장식 떨어짐'], [/부러|끊어|깨졌|깨져|파손|휘어|찌그러/, '파손'], [/변색|녹(이)?\s*(슬|생|났)|검게|까매|까맣/, '변색'],
    [/오배송|다른\s*(상품|제품|색|옵션|사이즈)|잘못\s*(왔|온|보내)/, '다른 상품 받음'], [/누락|빠져\s*(있|왔)|덜\s*(왔|온)|하나만\s*(왔|옴)/, '구성 누락'],
    [/분실|멈춰|멈췄|멈춤|정체|안\s*(와|옴|왔)|도착\s*(안|을\s*안)|배송.*(늦|안\s*됨)/, '배송 멈춤 · 분실'], [/불량|하자|스크래치|기스|찍힘|얼룩/, '불량']];
  function shortWhy(r) {
    var said = String(r.problem || ''), pr = String(r.promise || ''), sym = '';
    for (var i = 0; i < SYM.length && !sym; i++) if (SYM[i][0].test(said)) sym = SYM[i][1];
    for (var j = 0; j < SYM.length && !sym; j++) if (SYM[j][0].test(pr)) sym = SYM[j][1];
    if (!sym) sym = r.kind === '교환' ? '교환 요청' : r.kind === '재발송' ? '재발송 요청' : (r.kind || '');
    var act = /환불/.test(pr) && !/재발송|재출고|재배송/.test(pr) ? '환불' : /(재발송|재출고|재배송|새\s*(제품|상품)|다시\s*보내|교환)/.test(pr) ? (r.kind === '교환' ? '교환 상품 발송' : '새 제품 재발송') : '';
    var extra = /회수|수거/.test(pr) ? ' · 기존 상품 회수' : /폐기/.test(pr) ? ' · 기존 상품 폐기' : '';
    var pay = (pr.match(/(왕복|편도)?\s*배송비\s*[\d,]+\s*원[^.]{0,12}(입금|결제)/) || [])[0];
    return sym + (act ? ' → ' + act + extra : '') + (pay ? ' (' + pay.replace(/\s+/g, ' ').trim() + ' 확인 뒤)' : '');
  }
  /** 옵션 보기 좋게 — 'Style: SET (할인가 적용)' → 'SET', 'Color: White' → 'White' */
  function optShow(o) { return String(o || '').split(' / ').map(function (x) { return x.replace(/\((할인가?|특가|이벤트)[^)]*\)/g, '').replace(/^[^:]{1,14}:\s*/, '').trim(); }).filter(Boolean).join(' / '); }
  function cols(r) {
    var s = r.ship || {}, it = (s.items && s.items.length) ? s.items : (r.products || []).map(function (n) { return {name: n, option: '', qty: ''}; });
    var why = shortWhy(r), mk = r.mark || {};
    return {
      day: r.day, brand: r.label || r.brand, kind: r.kind, nm: s.nm || '', tel: s.tel || '', zip: s.zip || '', addr: [s.addr, s.detail].filter(Boolean).join(' '),
      goods: it.map(function (i) { return i.name; }).join(' / '), opt: it.some(function (i) { return i.option; }) ? it.map(function (i) { return i.option || '-'; }).join(' / ') : '', qty: it.some(function (i) { return i.qty; }) ? it.map(function (i) { return i.qty || '-'; }).join(' / ') : '',
      order: (s.orderId || (r.orderIds || [])[0] || ''), why: why, status: r.status, inv: mk.inv || '', items: it
    };
  }
  /* 복사 · 엑셀 칸 (메모 칸은 11-26 사장님 "메모칸은 없애줘"로 뺌) */
  var HEAD = [['day', '날짜'], ['brand', '브랜드'], ['kind', '구분'], ['nm', '받는 분'], ['tel', '연락처'], ['zip', '우편번호'], ['addr', '주소'], ['goods', '보낼 상품'], ['opt', '옵션'], ['qty', '수량'], ['order', '주문번호'], ['why', '사유'], ['status', '상태'], ['inv', '송장번호']];
  /* 화면 칸 — 보낼 상품 · 옵션 · 수량을 한 칸에 크게, 앞쪽에 (11-26 "옵션이나 보낼상품만 잘 보이게") */
  var VIEW = [['day', '날짜'], ['brand', '브랜드'], ['kind', '구분'], ['goods', '보낼 상품 · 옵션'], ['why', '사유'], ['nm', '받는 분'], ['tel', '연락처'], ['zip', '우편번호'], ['addr', '주소'], ['order', '주문번호'], ['status', '상태'], ['inv', '송장번호']];
  function goodsHtml(c) {
    if (!c.items.length) return '<span class="rs-op">상품 확인 필요</span>';
    return c.items.map(function (i) {
      var o = optShow(i.option), q = Number(i.qty) || 0;
      return '<div class="rs-it"><b>' + esc(i.name) + '</b>' + (o ? '<span class="rs-op">' + esc(o) + '</span>' : '') + (q ? '<span class="rs-q' + (q > 1 ? ' many' : '') + '">' + q + '개</span>' : '') + '</div>';
    }).join('');
  }
  /** 송장번호 칸 — CJ 접수로 붙은 번호는 글자로(자동), 아니면 손으로 쓰는 칸 */
  function invHtml(r, c) {
    var m = r.mark || {};
    if (m.bk && m.inv) {
      var tag = m.env !== 'prod' ? '<span class="rs-tag dev" title="CJ 운영 승인 전 개발 서버 번호 — 실제 송장 아님, 고객에게 안 보냄">시험</span>'
        : m.notify ? '<span class="rs-tag ok" title="카톡 상담 에이전트가 고객에게 송장번호를 보내요">고객 안내</span>' : m.printed ? '<span class="rs-tag">출력됨</span>' : '<span class="rs-tag" title="운송장을 출력하면 고객에게 송장번호가 나가요">출력 전</span>';
      return '<td class="c-inv"><span class="rs-inv">' + esc(m.inv) + '</span>' + tag + '</td>';
    }
    return '<td><input class="rs-in" data-f="inv" data-id="' + esc(r.id) + '" value="' + esc(c.inv) + '" placeholder="송장번호" inputmode="numeric" aria-label="송장번호"></td>';
  }
  /** 나갈 것만 — 확인 필요 · 발송함(직원 대화 · [발송함] · 대화 분석) · 희선님께 넘긴 건 빼고 */
  function openRows() { return fullRows().filter(function (r) { return r.status !== '확인 필요' && r.status !== '발송함' && !stale(r) && !(r.mark || {}).hand; }); }
  function listView() {
    var rows = openRows().sort(function (a, b) { return (a.status === '정보 대기') - (b.status === '정보 대기') || (a.firstAt || 0) - (b.firstAt || 0); });
    var shipMiss = !S.full;
    var cnt = {}; rows.forEach(function (r) { cnt[r.status] = (cnt[r.status] || 0) + 1; });
    var top = '<div class="rs-head"><span class="rs-title">나갈 재배송 · 교환 · 불량<small>보낸 건은 안 보여요 · 줄에 마우스를 올리면 대화 · 사진</small></span>'
      + '<span class="rs-nav"><button type="button" data-rs="copy">표 복사</button><button type="button" data-rs="csv">엑셀 내려받기</button><button type="button" data-rs="re" aria-label="다시 불러오기">↻</button></span></div>'
      + '<div class="rs-cnt">' + ['발송 대기', '정보 대기'].filter(function (k) { return cnt[k]; }).map(function (k) { return '<span>' + k + ' ' + cnt[k] + '</span>'; }).join('') + '</div>'
      + (shipMiss ? '<div class="rs-warn">받는 분 · 연락처 · 주소 · 주문번호는 서버(맥미니 프록시 /cs/kakao-reship) 연결 뒤 사무실 인터넷에서 채워져요. 그 전에는 [대화]로 채팅방을 열어 확인해 주세요.</div>' : (S.full.outside ? '<div class="rs-warn">사무실 밖이라 받는 분 정보는 가렸어요.</div>' : ''))
      + (S.mkErr ? '<div class="rs-warn">' + esc(S.mkErr) + '</div>' : '') + handBox();
    var body = rows.length ? '<div class="rs-tblw"><table class="rs-tbl"><thead><tr>' + VIEW.map(function (h) { return '<th>' + h[1] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>'
      + rows.map(function (r, i) {
        var c = cols(r), m = r.mark || {};
        return '<tr class="rs-row" tabindex="0" data-i="' + i + '">' + VIEW.map(function (h) {
          var k = h[0];
          if (k === 'inv') return invHtml(r, c);
          if (k === 'goods') return '<td class="c-goods">' + goodsHtml(c) + '</td>';
          if (k === 'status') return '<td><span class="rs-st ' + (ST[c.status] || 'check') + '">' + esc(c.status) + '</span></td>';
          return '<td class="c-' + k + '">' + esc(c[k]) + '</td>';
        }).join('') + '<td class="rs-act">'
          + (r.ship && r.ship.nm && !m.bk && typeof window.cjbFromReship === 'function' ? '<button type="button" class="rs-go rs-cj" data-id="' + esc(r.id) + '" title="CS 도구 건별 접수 칸에 받는 분 · 주소 · 상품을 채워요 — 접수 · 출력하면 송장번호가 여기 저절로 적혀요">CJ 접수</button>' : '')
          + (r.status === '발송함' ? '' : '<button type="button" class="rs-go rs-sent" data-id="' + esc(r.id) + '">발송함</button>')
          + '<button type="button" class="rs-go rs-hand" data-id="' + esc(r.id) + '" title="표에서 빼고 희선님 PC에 알림">희선님께</button>'
          + '<button type="button" class="rs-go" data-k="' + esc(r.key) + '">대화</button></td></tr>';
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
      if ((!res.ok || !j.ok) && res.status !== 409) throw new Error(j.error || 'HTTP ' + res.status);  // 409 = 할 일이 이미 닫힘 — 표시만 적음
      await markSave(id, {sent: Date.now()});
      S.mkErr = '';
    } catch (e) { S.mkErr = '발송함으로 적지 못했어요 — ' + ((e && e.message) || e); }
    draw();
  }
  /* ===== 희선님께 넘기기 (2026-11-26 사장님 "최미주는 희선님이 개입해서 해결할꺼니까 저기서 없애고 희선님한테 알림만 띄워줘")
     marks[id].hand = {to, at} → 표 · 복사 · 엑셀 · 확인 칸에서 빠짐. 희선님 PC 에서만 표 위 빨간 칸 + 크롬 알림(건마다 한 번).
     희선님이 [처리 끝] → hand.done (그대로 표에선 안 보임). */
  var HAND_TO = '지희선';
  function meName() { try { return localStorage.getItem('brightbeed_unlocked') === '1' ? String(localStorage.getItem('brightbeed_diary_me') || '').trim() : ''; } catch (e) { return ''; } }
  function handRows() { return fullRows().filter(function (r) { var h = (r.mark || {}).hand; return h && !h.done; }); }
  function handBox() {
    if (meName() !== HAND_TO) return '';
    var hs = handRows(); if (!hs.length) return '';
    return '<div class="rs-hand-box"><b>희선님 처리 요청 ' + hs.length + '건</b> — 재배송 표에서 빼 둔 건이에요' + hs.map(function (r) {
      return '<div><b>' + esc(r.label || '') + ' ' + esc(r.kind) + '</b> ' + esc(shortWhy(r)) + ' <span class="rs-op">' + esc((r.products || []).join(' / ').slice(0, 60)) + '</span>'
        + '<button type="button" class="rs-go" data-k="' + esc(r.key) + '">대화</button><button type="button" class="rs-go rs-handdone" data-id="' + esc(r.id) + '">처리 끝</button></div>';
    }).join('') + '</div>';
  }
  var notified = {};
  function handNotify() {
    if (meName() !== HAND_TO || typeof Notification === 'undefined') return;
    var LSK = 'bb_reship_hand_v1', seen = {}; try { seen = JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch (e) { seen = {}; }
    handRows().forEach(function (r) {
      var k = r.id + '|' + r.mark.hand.at; if (seen[k] || notified[k]) return; notified[k] = 1;
      var go = function () {
        try {
          var n = new Notification('🙋 희선님 개입 요청 — ' + (r.label || '') + ' ' + r.kind, {body: shortWhy(r) + '\n' + (r.products || []).join(' / ').slice(0, 80) + '\n누르면 채팅방으로', tag: 'reship-hand-' + r.id, requireInteraction: true});
          n.onclick = function () { window.focus(); n.close(); openChat(r.key); };
          seen[k] = Date.now(); try { localStorage.setItem(LSK, JSON.stringify(seen)); } catch (e) { /* noop */ }
        } catch (e) { /* noop */ }
      };
      if (Notification.permission === 'granted') go(); else if (Notification.permission !== 'denied') Notification.requestPermission().then(function (p) { if (p === 'granted') go(); });
    });
  }
  function openChat(key) {
    try { if (typeof triggerCs === 'function' && document.getElementById('viewCs').hidden) triggerCs(); } catch (x) { /* noop */ }
    setTimeout(function () { try { var k = document.getElementById('kkoBox'); if (k) k.scrollIntoView({behavior: 'smooth', block: 'start'}); if (typeof kkoTab === 'function') kkoTab('chat'); kkoOpenChat(key); } catch (x) { console.warn('재배송 장부 대화 열기', x); } }, 400);
  }

  /* ===== CJ 접수 → 송장번호 자동 (2026-11-26 사장님 "운송장번호 입력 안하고 cs팀에 건별접수나 파일접수를 하고 출력하면 자동으로 송장번호가 기재되면서 송장번호를 고객한테 전달해줘")
     · [CJ 접수] = CS 도구 건별 접수 칸 채움(cjbFromReship) → 접수되면 그 접수(bk)와 송장번호를 이 줄에 바로 적음.
     · 파일 접수 · 손으로 한 건별 접수도: 함수 cj list(최근 발송 80건)에서 받는 분 이름 + 전화 뒷 4자리가 같고 장부에 오른 뒤 접수된 것을 찾아 붙임.
     · 출력(printed_at)되면 — 운영(env prod) 접수일 때만 — notify 를 적고 발송함 처리 → 맥미니 카톡 에이전트가 고객에게 송장번호 안내를 보냄
       (kakao-agent 가 app_kv reship_marks 의 notify 를 읽어 '처리 완료 안내'로, 보내기는 kakao-send 잠금 그대로).
       개발 서버(지금) 접수는 번호만 '시험'으로 보이고 고객 안내 · 발송함은 안 함. */
  var CJ = {at: 0, rows: null};
  function last4(t) { var d = String(t || '').replace(/\D/g, ''); return d.slice(-4); }
  function nmEq(a, b) { return String(a || '').replace(/\s/g, '') === String(b || '').replace(/\s/g, ''); }
  async function cjSync(force) {
    if (typeof _cjbCall !== 'function') return;
    if (!force && CJ.rows && Date.now() - CJ.at < 100000) return;
    try { var j = await _cjbCall({action: 'list', limit: 80, dv: '01'}); if (j && j.ok) { CJ.rows = j.rows || []; CJ.at = Date.now(); } } catch (e) { return; }
    var rows = (CJ.rows || []).filter(function (b) { return b.invc_no && b.status !== 'failed' && b.status !== 'cancelled' && !b.cancelled_at; });
    var used = {}; Object.keys(S.marks || {}).forEach(function (k) { var m = S.marks[k]; if (m && m.bk) used[m.bk] = k; });
    var opens = fullRows().filter(function (r) { return r.status !== '발송함' && r.status !== '확인 필요' && !(r.mark || {}).hand; });
    for (var i = 0; i < opens.length; i++) {
      var r = opens[i], m = r.mark || {}, s = r.ship || {}, b = null;
      if (m.bk) b = rows.filter(function (x) { return x.id === m.bk; })[0];
      else if (s.nm && s.tel) b = rows.filter(function (x) { return !used[x.id] && nmEq(x.rcvr_nm, s.nm) && last4(x.rcvr_tel) === last4(s.tel) && Date.parse(x.created_at) >= (r.firstAt || 0) - 3600000; }).sort(function (a, c) { return c.id - a.id; })[0];
      if (!b) continue;
      var p = {};
      if (m.bk !== b.id || m.inv !== b.invc_no) Object.assign(p, {bk: b.id, inv: b.invc_no, env: b.env});
      if (b.printed_at && !m.printed) p.printed = Date.parse(b.printed_at) || Date.now();
      if (b.printed_at && b.env === 'prod' && !m.notify) { p.notify = Date.now(); p.sent = Date.now(); }
      if (!Object.keys(p).length) continue;
      used[b.id] = r.id;
      try {
        await markSave(r.id, p);
        if (p.notify) closeTodo(r);
      } catch (e) { S.mkErr = '송장번호를 적지 못했어요 — ' + ((e && e.message) || e); }
    }
  }
  /** 에이전트 할 일도 닫음 (사무실에서만 됨 — 안 되면 그대로, 표에선 이미 발송함) */
  async function closeTodo(r) {
    try {
      var base = await loadProxyBase(); if (!base) return;
      await fetch(base + '/cs/kakao-done', {method: 'POST', headers: {'X-Brightbeed-PIN': ghPin(), 'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify({pid: r.pid, chatId: r.key.split(':')[1], todo: r.todo || '불량 · 오배송 처리', id: 'none', by: 'CJ 출력'})});
    } catch (e) { /* noop */ }
  }
  /** 건별 접수가 끝나면 index.html 이 부름 — 바로 이 줄에 적음 */
  async function booked(id, j) {
    if (!id || !j || !j.invc_no) return;
    try { await markSave(id, {bk: Number(j.id), inv: String(j.invc_no), env: j.env || ''}); S.mkErr = ''; } catch (e) { S.mkErr = '송장번호를 적지 못했어요 — ' + ((e && e.message) || e); }
    draw();
  }
  function cjFill(id) {
    var r = fullRows().filter(function (x) { return x.id === id; })[0]; if (!r || !r.ship) return;
    var c = cols(r), s = r.ship, it = c.items;
    window.cjbFromReship({id: r.id, label: r.label, kind: r.kind, brand: r.brand, nm: s.nm, tel: s.tel, zip: s.zip, addr: s.addr, detail: s.detail,
      goods: it.map(function (i) { return i.name; }).join(' / ').slice(0, 100), opt: it.map(function (i) { return optShow(i.option); }).filter(Boolean).join(' / ').slice(0, 100),
      qty: it.reduce(function (a, i) { return a + (Number(i.qty) || 1); }, 0) || 1});
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
      // 수거 접수 필요 칸 (11-27) — 반품 현황 · 카톡 자동 수거, 없어도 됨
      try { var rr = await fetch(base + '/cs/returns', {headers: {'X-Brightbeed-PIN': ghPin(), Accept: 'application/json'}, cache: 'no-store'}); var jr = rr.ok ? await rr.json().catch(function () { return null; }) : null; if (jr && jr.ok) S.ret = jr; } catch (e) { /* noop */ }
      try { var rp = await fetch(base + '/cs/kakao-pickup', {headers: {'X-Brightbeed-PIN': ghPin(), Accept: 'application/json'}, cache: 'no-store'}); var jp = rp.ok ? await rp.json().catch(function () { return null; }) : null; if (jp && Array.isArray(jp.items)) S.pick = jp; } catch (e) { /* noop */ }
      await marksLoad();
      try { await cjSync(force); } catch (e) { /* CJ 기록은 없어도 됨 */ }
      handNotify();
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
    if (e.target.closest && e.target.closest('.rs-link')) return;   // 카톡 방 링크는 그대로 열림
    var b = e.target.closest && e.target.closest('[data-rs],.rs-go');
    if (!b) { if (e.target.closest && e.target.closest('.rs-in')) return; var x = rowAt(e.target); if (x) showTip(x.row, x.r); return; }
    if (b.classList.contains('rs-cj')) { hideTip(); cjFill(b.dataset.id); return; }
    if (b.classList.contains('rs-hand')) {
      hideTip();
      var hr = fullRows().filter(function (x) { return x.id === b.dataset.id; })[0];
      if (!hr || !window.confirm((hr.label || '') + ' ' + hr.kind + ' 건을 표에서 빼고 희선님께 넘길까요?\n(희선님 PC에 알림이 떠요)')) return;
      b.disabled = true; markSave(b.dataset.id, {hand: {to: HAND_TO, at: Date.now(), by: meName()}}).then(function () { S.mkErr = ''; }).catch(function (x) { S.mkErr = '저장하지 못했어요 — ' + ((x && x.message) || x); }).then(draw);
      return;
    }
    if (b.classList.contains('rs-handdone')) {
      var hm = ((S.marks || {})[b.dataset.id] || {}).hand || {};
      b.disabled = true; markSave(b.dataset.id, {hand: Object.assign({}, hm, {done: Date.now()})}).then(function () { S.mkErr = ''; }).catch(function (x) { S.mkErr = '저장하지 못했어요 — ' + ((x && x.message) || x); }).then(draw);
      return;
    }
    if (b.classList.contains('rs-sent')) { hideTip(); sentClick(b.dataset.id); return; }
    if (b.classList.contains('rs-notyet')) { hideTip(); b.disabled = true; markSave(b.dataset.id, {notYet: Date.now()}).then(function () { S.mkErr = ''; }).catch(function (x) { S.mkErr = '저장하지 못했어요 — ' + ((x && x.message) || x); }).then(draw); return; }
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
  window.Reship = {load: load, draw: draw, rows: function () { return openRows(); }, state: S, booked: booked};
  function boot() { if (visible()) load(true); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1500); }); else setTimeout(boot, 1500);
})();
