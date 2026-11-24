/* 오피스 사진 크게 보기 — 작은 사진(썸네일)에 마우스를 올리면 바로 옆에 크게
   (2026-11-24 사장님 "모든 이미지 썸네일이 있는 기능들에는 마우스오버로 이미지 잘 보이게 해주고")

   · 아래 LIST 의 작은 사진에만 붙는다 (로고 · 아이콘 · 프로필 같은 장식 그림은 빼려고 자리마다 적음). 새 화면은 <img data-zoom> 을 달면 된다.
   · 이미 자기 확대 창이 있는 곳은 LIST 에 넣지 않는다 — 물류 발주서 · 출고 전광판 · 판매 순위 · 광고 전광판 · 카카오톡 사진 · 매칭보드 · MD팀 시트.
   · 누르면 하던 동작 그대로 (크게 열기 · 링크 · 고르기). 마우스가 있는 PC 에서만, 휴대폰은 누르면 열리는 원래 방식.
   · 큰 사진 주소가 따로 있으면 data-zoom="주소", 없으면 화면에 보이는 사진을 그대로 키운다. */
(function () {
  'use strict';
  if (window.OfficeThumb) return;
  window.OfficeThumb = true;
  var LIST = [
    'img[data-zoom]',
    '#grid img.thumb',            // ERP전산팀 표 사진
    'img.pst-th',                 // 상품 상태
    'img.brep-thumb',             // 브랜드 분석리포트
    'img.best-sr-thumb',          // 판매 순위 찾기
    'img.pa-thumb',               // 상품 분석
    'img.bps-top-img',            // 블로그페이 현황판
    'img.lsb-ev-im', '.lsb-ph img', '.lsb-gal img',   // 라인시트 일정 · 상품
    '.dthumbs img', '.gal img'    // VOC 불량 사진 · 모델 지원자 사진
  ].join(',');
  var MAX = 400, SMALL = 190;     // 큰 사진 한 변 · 이보다 크게 보이는 사진은 이미 잘 보여서 안 띄움
  var mq = window.matchMedia ? matchMedia('(hover:hover) and (pointer:fine)') : null;
  var box = null, pic = null, cur = null, timer = 0;

  function css() {
    var s = document.createElement('style');
    s.textContent = '#otBox{position:fixed;z-index:2147481000;padding:6px;background:#fff;border:1px solid rgba(15,23,42,.1);border-radius:12px;box-shadow:0 18px 48px rgba(15,23,42,.24);pointer-events:none;opacity:0;transition:opacity .1s}'
      + '#otBox.on{opacity:1}#otBox img{display:block;border-radius:8px;background:#f1f5f9;object-fit:contain}';
    document.head.appendChild(s);
  }
  function make() {
    if (box) return;
    css();
    box = document.createElement('div');
    box.id = 'otBox';
    box.setAttribute('aria-hidden', 'true');
    pic = document.createElement('img');
    pic.alt = '';
    pic.referrerPolicy = 'no-referrer';
    box.appendChild(pic);
    document.body.appendChild(box);
    pic.addEventListener('load', place);
    pic.addEventListener('error', hide);
  }
  function hide() {
    clearTimeout(timer);
    cur = null;
    if (box) { box.classList.remove('on'); box.style.left = '-9999px'; }
  }
  function small(im) { var r = im.getBoundingClientRect(); return r.width >= 12 && r.height >= 12 && r.width <= SMALL && r.height <= SMALL; }
  function place() {
    if (!cur) return;
    if (!cur.isConnected) { hide(); return; }
    var nw = pic.naturalWidth, nh = pic.naturalHeight;
    if (!nw || !nh) return;
    var W = window.innerWidth, H = window.innerHeight, lim = Math.min(MAX, W - 40, H - 40), r = cur.getBoundingClientRect();
    var k = Math.min(lim / nw, lim / nh);
    if (k > 1) k = Math.min(k, Math.max(1, Math.min(2, 240 / Math.max(nw, nh))));   // 작은 원본은 두 배까지만 (너무 흐려지지 않게)
    var w = Math.round(nw * k), h = Math.round(nh * k);
    if (Math.max(w, h) < Math.max(r.width, r.height) * 1.3) { hide(); return; }      // 키워도 그대로인 사진
    pic.style.width = w + 'px';
    pic.style.height = h + 'px';
    var bw = w + 14, bh = h + 14, left = r.right + 10, top = r.top + r.height / 2 - bh / 2;
    if (left + bw > W - 8) left = r.left - bw - 10;
    if (left < 8) { left = Math.max(8, Math.min(W - bw - 8, r.left + r.width / 2 - bw / 2)); top = r.top - bh - 10 >= 8 ? r.top - bh - 10 : r.bottom + 10; }
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(Math.max(8, Math.min(H - bh - 8, top))) + 'px';
    box.classList.add('on');
  }
  function show(im) {
    make();
    cur = im;
    var src = im.getAttribute('data-zoom') || im.currentSrc || im.src;
    if (pic.getAttribute('src') !== src) { box.classList.remove('on'); pic.src = src; }
    if (pic.complete && pic.naturalWidth) place();
  }
  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') { if (cur) hide(); return; }
    if (t === cur) return;
    if (cur) hide();
    if ((mq && !mq.matches) || e.buttons || t.style.visibility === 'hidden' || !t.matches(LIST) || !small(t) || !(t.complete && t.naturalWidth)) return;
    clearTimeout(timer);
    timer = setTimeout(function () { if (t.isConnected && t.matches(':hover')) show(t); }, 80);   // 스쳐 지나갈 땐 안 뜨게
  }, true);
  document.addEventListener('mouseout', function (e) { if (cur && e.target === cur) hide(); else clearTimeout(timer); }, true);
  document.addEventListener('mousedown', hide, true);
  document.addEventListener('keydown', function () { if (cur) hide(); }, true);
  document.addEventListener('scroll', function () { if (cur || timer) hide(); }, true);
  document.addEventListener('dragstart', hide, true);
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);
  // 표를 다시 그려 사진이 사라지면 같이 닫는다
  setInterval(function () { if (cur && (!cur.isConnected || !cur.matches(':hover'))) hide(); }, 400);
})();
