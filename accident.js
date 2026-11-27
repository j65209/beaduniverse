/* 택배 사고접수 (2026-11-27 사장님 야르 정시인 건 "사고처리 해야하니까 식스샵프로 주문내역 화면 전체 캡처해서 상단에 툴 만들어줘.
   사고접수 내역은 주문내역 캡처본만 있으면돼").
   · 건 = 맥미니 sixshop-collector cs-accident (10분) — 카톡 처리함 '분실 의심 · 전액 환불' 방 → 식스샵프로 주문 · 택배 마지막 단계 · 환불 여부.
   · 캡처 = 식스샵프로 관리자 주문 화면 전체(PNG). 줄의 [캡처]를 누르면 크게 · [내려받기]. 고객 · 주문 · 캡처는 사무실 인터넷에서만(프록시 /cs/accidents).
   · CS팀 맨 위(#acBoxCs). 건이 없으면 카드를 숨김. 디자인은 재배송 장부(reship.js rs-*) 그대로. */
(function () {
  var S = {d: null, err: '', at: 0, loading: false, urls: {}};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function md(iso) { var t = Date.parse(iso); if (!t) return ''; var d = new Date(t + 9 * 3600000); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); }
  function box() { return document.getElementById('acBoxCs'); }
  function css() {
    if (document.getElementById('acCss')) return;
    var st = document.createElement('style'); st.id = 'acCss';
    st.textContent = '.ac-shot{position:fixed;inset:0;z-index:9999;background:rgba(15,20,30,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px}'
      + '.ac-shot>div{background:#fff;border-radius:12px;max-width:min(1200px,96vw);padding:10px 12px}.ac-shot img{display:block;max-width:100%;height:auto;border:1px solid #eef0f3;border-radius:8px}'
      + '.ac-bar{display:flex;gap:6px;align-items:center;margin:0 0 8px;font-size:13px;font-weight:700}.ac-bar span{margin-right:auto}'
      + '.ac-err{font-size:11.5px;color:#8a6100}.ac-items{font-size:12.5px;color:#4a5562}.ac-ref{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap}.ac-ref.need{background:#fff1f0;color:#c0392b}.ac-ref.ok{background:#e8f5ec;color:#2f7a45}'
      + '@media (max-width:700px){#acBoxCs .rs-tblw{overflow:visible;max-height:none;border:0}#acBoxCs .rs-tbl thead{display:none}#acBoxCs .rs-tbl,#acBoxCs .rs-tbl tbody{display:block}#acBoxCs .rs-tbl tr.rs-row{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;border:1px solid #eef0f3;border-radius:10px;padding:8px 10px;margin-bottom:6px}#acBoxCs .rs-tbl td{border:0;padding:0;min-width:0!important}#acBoxCs .rs-tbl td.c-goods,#acBoxCs .rs-tbl td.ac-ship{flex-basis:100%}#acBoxCs .rs-row .rs-go{display:inline-block}}';
    document.head.appendChild(st);
  }
  function draw() {
    var b = box(); if (!b) return;
    css();
    var rows = (S.d && S.d.rows) || [];
    if (!rows.length && !S.err) { b.hidden = true; return; }
    b.hidden = false;
    var h = '<div class="rs-head"><span class="rs-title">🚨 택배 사고접수<small>분실 의심 · 식스샵프로 주문 화면 캡처</small></span><span class="rs-nav"><button type="button" data-ac="re">새로고침</button></span></div>';
    if (S.err) h += '<div class="rs-warn">' + esc(S.err) + '</div>';
    if (rows.length) {
      h += '<div class="rs-tblw"><table class="rs-tbl"><thead><tr><th>접수</th><th>브랜드</th><th>고객</th><th>주문번호</th><th>상품</th><th>운송장 · 마지막 단계</th><th>환불</th><th>캡처</th><th></th></tr></thead><tbody>';
      rows.forEach(function (r) {
        var items = (r.items || []).map(function (i) { return esc(i.name) + (i.option ? ' (' + esc(i.option) + ')' : '') + ' ' + (i.qty || 1) + '개'; }).join('<br>');
        var cap = r.img ? '<button type="button" class="rs-go rs-cj" data-ac="shot" data-id="' + esc(r.orderId) + '">캡처 보기</button>'
          : '<span class="ac-err">' + esc(r.imgErr || (r.err ? '' : '찍는 중 (10분 안)')) + '</span>';
        h += '<tr class="rs-row"><td class="c-day">' + esc(md(new Date(r.at).toISOString())) + '</td><td class="c-brand rs-br">' + esc(r.label) + '</td><td class="c-nm">' + esc(r.nick) + '</td>'
          + '<td class="c-order"><span class="rs-inv">' + esc(r.orderId || '-') + '</span>' + (r.market === 'naver-pay' ? '<span class="rs-tag">네이버페이</span>' : '') + (r.err ? '<div class="ac-err">' + esc(r.err) + '</div>' : '') + '</td>'
          + '<td class="c-goods ac-items">' + items + '</td>'
          + '<td class="ac-ship">' + (r.inv ? '<span class="rs-inv">' + esc(r.inv) + '</span>' : '-') + '<div class="ac-items">' + esc(r.last || '') + (r.lastAt ? ' · ' + esc(r.lastAt) : '') + '</div></td>'
          + '<td><span class="ac-ref ' + (r.refund === '완료' ? 'ok' : 'need') + '">' + (r.refund === '완료' ? '환불 완료' : '환불 필요') + '</span></td>'
          + '<td>' + cap + '</td><td><button type="button" class="rs-go" data-ac="chat" data-k="' + esc(r.key) + '">대화</button></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    b.innerHTML = h;
  }
  async function load(force) {
    if (S.loading || (!force && Date.now() - S.at < 110000 && S.d)) return;
    S.loading = true;
    try {
      var base = await loadProxyBase(); if (!base) throw new Error('서버 연결 안 됨');
      var r = await fetch(base + '/cs/accidents', {headers: {'X-Brightbeed-PIN': ghPin(), Accept: 'application/json'}, cache: 'no-store'});
      var j = await r.json().catch(function () { return null; });
      if (r.status === 403) { S.d = null; S.err = ''; }
      else if (!r.ok || !j || !j.ok) { if (r.status !== 503) S.err = '사고 건을 못 불러왔어요 — ' + ((j && j.error) || ('HTTP ' + r.status)); }
      else { S.d = j; S.err = ''; }
      S.at = Date.now();
    } catch (e) { S.err = '사고 건을 못 불러왔어요 — ' + ((e && e.message) || e); }
    S.loading = false;
    draw();
  }
  async function shot(id) {
    var wrap = document.createElement('div'); wrap.className = 'ac-shot';
    wrap.innerHTML = '<div><div class="ac-bar"><span>식스샵프로 주문 ' + esc(id) + '</span><button type="button" class="rs-go" data-ac="dl">내려받기</button><button type="button" class="rs-go" data-ac="x">닫기</button></div><div class="rs-empty">불러오는 중…</div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null;
      if (e.target === wrap || (t && t.dataset.ac === 'x')) { wrap.remove(); return; }
      if (t && t.dataset.ac === 'dl' && S.urls[id]) { var a = document.createElement('a'); a.href = S.urls[id]; a.download = '주문내역_' + id + '.png'; document.body.appendChild(a); a.click(); a.remove(); }
    });
    try {
      if (!S.urls[id]) {
        var base = await loadProxyBase();
        var r = await fetch(base + '/cs/accident-img?id=' + encodeURIComponent(id), {headers: {'X-Brightbeed-PIN': ghPin()}, cache: 'no-store'});
        if (!r.ok) throw new Error(r.status === 403 ? '사무실 인터넷에서만 볼 수 있어요' : '캡처가 아직 없어요');
        S.urls[id] = URL.createObjectURL(await r.blob());
      }
      wrap.querySelector('.rs-empty').outerHTML = '<img alt="식스샵프로 주문 화면" src="' + S.urls[id] + '">';
    } catch (e) { wrap.querySelector('.rs-empty').textContent = (e && e.message) || String(e); }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('#acBoxCs button[data-ac]') : null;
    if (!b) return;
    if (b.dataset.ac === 're') return load(true);
    if (b.dataset.ac === 'shot') return shot(b.dataset.id);
    if (b.dataset.ac === 'chat') {
      var key = b.dataset.k;
      setTimeout(function () { try { var k = document.getElementById('kkoBox'); if (k) k.scrollIntoView({behavior: 'smooth', block: 'start'}); if (typeof kkoTab === 'function') kkoTab('chat'); kkoOpenChat(key); } catch (x) { console.warn('사고접수 대화 열기', x); } }, 200);
    }
  });
  function visible() { var b = box(); return b && b.parentElement && b.parentElement.offsetParent; }
  setInterval(function () { if (!document.hidden && visible()) load(false); }, 10000);
  window.Accident = {load: load, state: S};
  function boot() { if (visible()) load(true); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1500); }); else setTimeout(boot, 1500);
})();
