/* 회의록 사진 — 올리기 · 마우스 올리면 크게 · 전체 화면 · 글 사이에 사진 넣는 메모 칸
   (2026-11-24 사장님 "세일 래퍼런스 이미지만 넣고싶다 · 회의메모에도 이미지 추가해서 자유롭게 크게 조절할 수 있게 · 마우스오버 잊지말고. 뭐든 마우스오버 기능!")
   마케팅 회의록(meeting/) · 주간 회의록(weekly/) 이 같이 쓴다. 라이브러리 없음.

   MtgShots.init({url, key, toast})          저장소 주소 · 열쇠 · 알림 글
   MtgShots.upload(file) → {p, w, h}         슈퍼베이스 공개 보관함 mkt-meeting/{연월}/{사진 지문 32자}.jpg + 작은 사진 _t.jpg (넣기만, 지우기 없음)
   MtgShots.url(p) · thumb(p) · hash(주소)    지문이 같으면 같은 사진 (같은 파일을 두 번 올려도 한 장)
   <img data-big="큰 사진 주소">              마우스를 올리면 옆에 크게 (긴 사진은 휠로 내려 보기) · data-lb 가 있으면 눌러서 전체 화면
   MtgShots.memo(textarea, {onInput, onBlur, label}) → {value, focus(), addFiles(), busy, has(노드)}
     글과 사진을 섞어 적는 칸. 저장은 그냥 글 — 사진은 한 줄짜리 표시 [[img:202611/지문.jpg|폭|가로x세로|번호]] 라서 줄 단위로 합치기(merge3)가 그대로 된다.
     사진 = 붙여넣기(Ctrl+V) · 끌어다 놓기 · [이미지] 단추. 오른쪽 아래 모서리를 끌어 크기를 마음대로(칸보다 크게 끌면 칸이 화면 폭으로 넓어짐), 작게 · 중간 · 크게 단추, × 지우기.
   MtgShots.columns(격자, () => [왼쪽, 오른쪽])  사진이 칸보다 크면 두 칸을 위아래로
   MtgShots.mergeFix(합친 글, 내 글)          둘이 같은 사진 크기를 동시에 바꿨을 때 두 장으로 늘지 않게
   MtgShots.plain(글)                        글로 복사할 때 사진 표시 → [이미지] 주소 */
(function () {
  'use strict';
  if (window.MtgShots) return;
  const BUCKET = 'mkt-meeting';
  const CFG = {url: '', key: '', toast: m => console.log(m)};
  const TOK = /^\[\[img:(\d{6}\/[0-9a-f]{32}\.(?:jpg|gif))\|(\d{2,4})\|(\d{1,5})x(\d{1,5})\|([a-z0-9]{4,12})\]\]$/;
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rid = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const pub = p => `${CFG.url}/storage/v1/object/public/${BUCKET}/${p}`;
  const thumb = p => pub(p.replace(/\.(jpg|gif)$/, '_t.jpg'));
  const hash = s => { const m = /([0-9a-f]{32})\.(?:jpg|gif)(?:$|\?)/.exec(String(s || '')); return m ? m[1] : ''; };
  const isImg = f => !!f && (/^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(f.name || ''));
  const imgFiles = list => [...(list || [])].filter(isImg);
  // 붙여넣기 · 끌어다 놓기에서 사진 파일만 (files 가 비어 있는 브라우저는 items 로)
  function filesOf(dt) {
    if (!dt) return [];
    const a = imgFiles(dt.files);
    if (a.length) return a;
    return [...(dt.items || [])].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(isImg);
  }

  /* ══════════════════════ 올리기 ══════════════════════ */
  async function decode(f) {
    try { return await createImageBitmap(f, {imageOrientation: 'from-image'}); } catch (e) { /* 아래로 */ }
    return await new Promise((ok, no) => {
      const im = new Image(), u = URL.createObjectURL(f);
      im.onload = () => ok(im);
      im.onerror = () => { URL.revokeObjectURL(u); no(new Error('이 사진 형식은 못 읽어요 — JPG · PNG 로 바꿔 주세요')); };
      im.src = u;
    });
  }
  const sizeOf = s => ({w: s.width || s.naturalWidth, h: s.height || s.naturalHeight});
  function draw(src, w, h, q, cropH) {   // cropH = 작은 사진에서 위쪽만
    const n = sizeOf(src), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(cropH || h));
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = 'high';
    if (cropH) x.drawImage(src, 0, 0, n.w, Math.min(n.h, Math.round(n.h * cropH / h)), 0, 0, c.width, c.height);
    else x.drawImage(src, 0, 0, c.width, c.height);
    return new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('사진을 바꾸지 못했어요'))), 'image/jpeg', q));
  }
  async function digest(f) {
    try {
      const b = await crypto.subtle.digest('SHA-256', await f.arrayBuffer());
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
    } catch (e) { let s = ''; while (s.length < 32) s += Math.floor(Math.random() * 16).toString(16); return s; }
  }
  async function put(path, blob, type) {
    for (let i = 0; ; i++) {
      let r = null;
      try {
        r = await fetch(`${CFG.url}/storage/v1/object/${BUCKET}/${path}`, {
          method: 'POST',
          headers: {apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': type, 'x-upsert': 'false', 'cache-control': 'max-age=31536000'},
          body: blob,
        });
      } catch (e) { r = null; }   // 인터넷이 끊김 → 다시
      if (r) {
        if (r.ok) return;
        const t = await r.text().catch(() => '');
        if (r.status === 409 || /Duplicate|already exists/i.test(t)) return;   // 같은 사진이 이미 있음
        if (r.status < 500) throw new Error(r.status === 413 ? '사진이 너무 커서 올리지 못했어요' : `사진을 올리지 못했어요 (${r.status})`);
      }
      if (i >= 2) throw new Error(r ? '저장소가 잠깐 답을 안 해요 — 조금 뒤 다시 넣어 주세요' : '인터넷이 끊겨 사진을 올리지 못했어요');
      await new Promise(z => setTimeout(z, 800 * (i + 1)));
    }
  }
  async function upload(f) {
    if (!isImg(f)) throw new Error('사진 파일만 넣을 수 있어요');
    if (f.size > 40 * 1048576) throw new Error('40MB 가 넘는 사진은 못 올려요');
    const src = await decode(f), n = sizeOf(src);
    if (!n.w || !n.h) throw new Error('사진을 읽지 못했어요');
    const id = await digest(f), month = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7).replace('-', '');
    const gif = f.type === 'image/gif' && f.size <= 8 * 1048576;
    let w = n.w, h = n.h, body = f, type = 'image/gif';
    if (!gif) {   // 긴 세일 페이지도 글자가 읽히게 — 폭 1,600 · 높이 8,000 · 800만 화소까지
      const s = Math.min(1, 1600 / n.w, 8000 / n.h, Math.sqrt(8e6 / (n.w * n.h)));
      w = Math.max(1, Math.round(n.w * s)); h = Math.max(1, Math.round(n.h * s));
      body = await draw(src, w, h, .86); type = 'image/jpeg';
      if (body.size > 1.8 * 1048576) body = await draw(src, w, h, .74);
    }
    const p = `${month}/${id}.${gif ? 'gif' : 'jpg'}`;
    const tw = Math.min(480, w), th = tw * h / w;
    await put(p.replace(/\.(jpg|gif)$/, '_t.jpg'), await draw(src, tw, th, .8, th > 720 ? 720 : 0), 'image/jpeg');
    await put(p, body, type);
    return {p, w, h};
  }

  /* ══════════════════════ 마우스 올리면 크게 ══════════════════════ */
  let zBox = null, zPic = null, zCur = null, zT = 0, zBusy = false, zNo = null;   // zNo = 이미 크게 보여서 안 띄우는 사진
  function css() {
    if (document.getElementById('msCss')) return;
    const s = document.createElement('style'); s.id = 'msCss';
    s.textContent = `
.ms-z{position:fixed;z-index:450;padding:6px;background:#fff;border:1px solid #cfd4dc;border-radius:14px;box-shadow:0 22px 60px rgba(15,23,42,.28);pointer-events:none;opacity:0;left:-9999px;top:0;transition:opacity .1s;overflow:hidden}
.ms-z.on{opacity:1}
.ms-z>div{overflow:hidden;border-radius:9px;background:#f1f3f6}
.ms-z img{display:block;width:100%}
.ms-z span{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);padding:5px 12px;border-radius:99px;background:rgba(15,23,42,.78);color:#fff;font-size:12px;font-weight:600;white-space:nowrap}
.ms-lb{position:fixed;inset:0;z-index:460;background:rgba(15,18,24,.9);display:flex;flex-direction:column}
.ms-lb-h{display:flex;align-items:center;gap:8px;padding:10px 14px;color:#fff;flex:none}
.ms-lb-h b{flex:1;min-width:0;font-size:13px;font-weight:600;opacity:.8}
.ms-lb-h a,.ms-lb-h button{height:34px;padding:0 13px;border:1px solid rgba(255,255,255,.28);border-radius:9px;background:none;color:#fff;font:600 13px inherit;font-family:inherit;text-decoration:none;display:inline-flex;align-items:center;cursor:pointer}
.ms-lb-h a:hover,.ms-lb-h button:hover{background:rgba(255,255,255,.14)}
.ms-lb-b{flex:1;min-height:0;overflow:auto;display:flex;padding:0 14px 18px;cursor:zoom-out;-webkit-overflow-scrolling:touch}
.ms-lb-b img{margin:auto;display:block;max-width:100%;max-height:100%;border-radius:6px;background:#fff}
.ms-lb-b.tall img{max-height:none;width:min(1000px,100%)}
.ms-lb .nv{position:absolute;top:50%;width:46px;height:64px;margin-top:-32px;border:0;border-radius:12px;background:rgba(255,255,255,.12);color:#fff;font-size:26px;cursor:pointer}
.ms-lb .nv:hover{background:rgba(255,255,255,.26)}
.ms-lb .nv.p{left:12px}.ms-lb .nv.n{right:12px}
.memo{min-height:140px;border:1px solid transparent;border-radius:8px;padding:6px 8px;background:#fafbfc;display:flex;flex-direction:column;cursor:text;position:relative}
.memo:hover{border-color:#e5e7eb}
.memo:focus-within{border-color:#1f2329;background:#fff}
.memo.drop{border-color:#1f2329;border-style:dashed;background:#fff}
.note .memo textarea.mt,.memo textarea.mt{display:block;width:100%;min-height:0;border:0;border-radius:0;padding:0;margin:0;outline:none;resize:none;background:none;overflow:hidden;line-height:1.65;font-size:inherit;color:inherit}
.note .memo textarea.mt:hover,.note .memo textarea.mt:focus{border:0;background:none}
.memo textarea.mt:last-child{flex:1 0 auto}
.memo.ro{opacity:.6}
.mrow{display:flex;flex-wrap:wrap;align-items:flex-start;gap:10px;margin:8px 0;cursor:default}
.mimg{position:relative;margin:0;max-width:100%;min-width:56px;border-radius:8px;outline:1px solid #e5e7eb;background:#f1f3f6;flex:none;line-height:0}
.mimg img{display:block;width:100%;height:100%;border-radius:8px;object-fit:cover;cursor:zoom-in;-webkit-user-drag:none;user-select:none}
.mimg:hover,.mimg.sel,.mimg.rs{outline:2px solid #1f2329}
.mimg .mb{position:absolute;left:6px;top:6px;display:none;gap:2px;padding:3px;border-radius:9px;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.2);z-index:3;line-height:1}
.mimg:hover .mb,.mimg.sel .mb{display:flex}
.mimg.rs .mb{display:none}
.mimg .mb button{height:26px;padding:0 8px;border:0;border-radius:6px;background:none;font:600 12px inherit;font-family:inherit;color:#1f2329;cursor:pointer;white-space:nowrap}
.mimg .mb button:hover{background:#f1f3f6}
.mimg .mb button[data-m=del]:hover{color:#dc2626}
.mimg .mh{position:absolute;right:-7px;bottom:-7px;width:24px;height:24px;border:0;padding:0;border-radius:50%;background:#1f2329;color:#fff;display:none;place-items:center;cursor:nwse-resize;touch-action:none;z-index:4;box-shadow:0 2px 8px rgba(15,23,42,.35)}
.mimg .mh svg{width:13px;height:13px}
.mimg:hover .mh,.mimg.sel .mh,.mimg.rs .mh{display:grid}
.mimg .ml{position:absolute;right:20px;bottom:8px;display:none;padding:4px 9px;border-radius:7px;background:rgba(15,23,42,.8);color:#fff;font:600 12px inherit;font-family:inherit;line-height:1.3}
.mimg.rs .ml{display:block}
.mimg.up img{opacity:.45}
.mimg.up::after{content:'올리는 중…';position:absolute;inset:0;display:grid;place-items:center;font:600 12.5px inherit;font-family:inherit;color:#1f2329}
@media (hover:none){.mimg .mh{width:32px;height:32px;right:-6px;bottom:-6px}.mimg .mb button{height:34px;padding:0 10px;font-size:13px}.mimg:hover:not(.sel):not(.rs) .mb,.mimg:hover:not(.sel):not(.rs) .mh{display:none}.mimg:hover:not(.sel):not(.rs){outline:1px solid #e5e7eb}}
@media print{.ms-z,.ms-lb{display:none}}`;
    document.head.appendChild(s);
  }
  function zMake() {
    if (zBox) return;
    css();
    zBox = document.createElement('div'); zBox.className = 'ms-z'; zBox.setAttribute('aria-hidden', 'true');
    zBox.innerHTML = '<div><img alt=""></div><span hidden>휠을 굴리면 아래로</span>';
    zPic = zBox.querySelector('img'); zPic.referrerPolicy = 'no-referrer';
    document.body.appendChild(zBox);
    zPic.addEventListener('load', zPlace);
    zPic.addEventListener('error', zHide);
  }
  function zHide() { clearTimeout(zT); zT = 0; zCur = null; if (zBox) { zBox.classList.remove('on'); zBox.style.left = '-9999px'; } }
  function zPlace() {
    if (!zCur) return;
    if (!zCur.isConnected) { zHide(); return; }
    const nw = zPic.naturalWidth, nh = zPic.naturalHeight; if (!nw || !nh) return;
    const r = zCur.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, G = 12, P = 14;
    const right = vw - r.right - G - 8, left = r.left - G - 8, side = Math.max(right, left) - P;
    const maxH = vh - 16 - P, up = Math.max(nw, nh) < 500 ? 2 : 1.15;
    // 옆에 들어가는 크기 · 화면 가운데에 놓았을 때 크기
    const fit = (W, H) => { const k = Math.min(Math.min(W, 960) / nw, H / nh, up); return {w: nw * k, h: nh * k}; };
    let s = fit(side, maxH), over = false, scroll = false;
    const tall = nh / nw > 1.9;
    if (tall) { const w = Math.min(side, 620, nw * up); if (w > s.w * 1.2) { s = {w, h: Math.min(maxH, w * nh / nw)}; scroll = w * nh / nw > maxH + 4; } }
    // 옆자리가 좁으면 화면 가운데에 (사진 카드처럼 작은 것만 — 크게 보이는 사진은 가리지 않게)
    if (s.w < Math.max(260, r.width * 1.25)) {
      if (r.width > Math.min(420, vw * .4)) { zNo = zCur; zHide(); return; }
      const c = fit(vw - 48, maxH); over = true; s = c; scroll = false;
    }
    if (s.w * s.h < r.width * r.height * 1.25) { zNo = zCur; zHide(); return; }
    const w = Math.round(s.w), h = Math.round(s.h), inner = zBox.firstChild;
    inner.style.width = w + 'px'; inner.style.height = h + 'px'; inner.scrollTop = 0;
    zBox.lastChild.hidden = !scroll; zBox.dataset.scroll = scroll ? '1' : '';
    const bw = w + P, bh = h + P;
    let x = over ? (vw - bw) / 2 : right >= left ? r.right + G : r.left - G - bw;
    let y = over ? (vh - bh) / 2 : r.top + r.height / 2 - bh / 2;
    zBox.style.left = Math.round(clamp(x, 8, Math.max(8, vw - bw - 8))) + 'px';
    zBox.style.top = Math.round(clamp(y, 8, Math.max(8, vh - bh - 8))) + 'px';
    zBox.classList.add('on');
  }
  function zShow(el) {
    zMake();
    zCur = el;
    const src = el.dataset.big || el.currentSrc || el.src;
    if (zPic.getAttribute('src') !== src) { zBox.classList.remove('on'); zPic.src = src; }
    if (zPic.complete && zPic.naturalWidth) zPlace();
  }
  const zArm = t => { zT = setTimeout(() => { zT = 0; if (t.isConnected && t.matches(':hover') && !zBusy && !lb) zShow(t); }, t.closest('.mimg') ? 350 : 130); };   // 스쳐 지나갈 땐 안 뜨게
  document.addEventListener('mouseover', e => {
    if (!canHover.matches || zBusy || e.buttons) return;
    const t = e.target && e.target.closest ? e.target.closest('[data-big]') : null;
    if (t !== zNo) zNo = null;
    if (t && t === zCur) return;
    if (zCur || zT) zHide();
    if (t && !lb && t !== zNo) zArm(t);
  }, true);
  // 휠 · 누르기로 닫힌 뒤에도 그 사진 위에서 마우스를 움직이면 다시
  document.addEventListener('mousemove', e => {
    if (zCur || zT || lb || zBusy || e.buttons || !canHover.matches) return;
    const t = e.target && e.target.closest ? e.target.closest('[data-big]') : null;
    if (t && t !== zNo) zArm(t);
  }, {passive: true, capture: true});
  document.addEventListener('mouseout', e => {
    const t = zCur; if (!t || !(e.target === t || t.contains(e.target))) return;
    if (e.relatedTarget && t.contains(e.relatedTarget)) return;
    zHide();
  }, true);
  document.addEventListener('wheel', e => {   // 긴 사진은 휠로 내려 보기
    if (!zCur || !zBox.dataset.scroll || !zBox.classList.contains('on')) { if (zCur) zHide(); return; }
    const b = zBox.firstChild, at = b.scrollTop; b.scrollTop += e.deltaY;
    if (b.scrollTop !== at) { e.preventDefault(); zBox.lastChild.hidden = true; }
  }, {passive: false, capture: true});
  document.addEventListener('mousedown', zHide, true);
  document.addEventListener('keydown', () => { if (zCur || zT) zHide(); }, true);
  document.addEventListener('scroll', e => { if ((zCur || zT) && !(zBox && zBox.contains(e.target))) zHide(); }, true);
  window.addEventListener('blur', zHide);
  window.addEventListener('resize', zHide);
  setInterval(() => { if (zCur && (!zCur.isConnected || !zCur.matches(':hover'))) zHide(); }, 400);   // 다시 그려 사진이 사라지면 같이 닫는다

  /* ══════════════════════ 전체 화면 ══════════════════════ */
  let lb = null, lbList = [], lbI = 0, lbBack = null;
  function open(list, i) {
    css(); zHide();
    lbList = list.filter(x => x && x.src); if (!lbList.length) return;
    lbI = clamp(i || 0, 0, lbList.length - 1);
    if (!lb) {
      lbBack = document.activeElement;
      lb = document.createElement('div'); lb.className = 'ms-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', '사진 크게 보기');
      lb.innerHTML = '<div class="ms-lb-h"><b></b><a target="_blank" rel="noopener">원본 열기 ↗</a><button type="button" data-l="x">닫기</button></div><div class="ms-lb-b"><img alt=""></div><button type="button" class="nv p" data-l="p" aria-label="앞 사진">‹</button><button type="button" class="nv n" data-l="n" aria-label="다음 사진">›</button>';
      lb.addEventListener('click', e => {
        const b = e.target.closest('[data-l]'), a = b && b.dataset.l;
        if (a === 'p') step(-1); else if (a === 'n') step(1);
        else if (a === 'x' || (!e.target.closest('a') && !(e.target.closest('.ms-lb-h')))) shut();
      });
      document.body.appendChild(lb);
      lb.querySelector('[data-l=x]').focus({preventScroll: true});
      lb.querySelector('.ms-lb-b img').addEventListener('load', e => {
        const b = lb && lb.querySelector('.ms-lb-b'); if (!b) return;
        b.classList.toggle('tall', e.target.naturalHeight / e.target.naturalWidth > 1.9); b.scrollTop = 0;
      });
    }
    lbPaint();
  }
  function lbPaint() {
    const x = lbList[lbI], many = lbList.length > 1;
    lb.querySelector('b').textContent = (many ? `${lbI + 1} / ${lbList.length}   ` : '') + (x.text || '');
    lb.querySelector('a').href = x.src;
    lb.querySelectorAll('.nv').forEach(n => { n.hidden = !many; n.style.display = many ? '' : 'none'; });
    const im = lb.querySelector('.ms-lb-b img');
    lb.querySelector('.ms-lb-b').classList.remove('tall');
    im.src = x.src;
  }
  function step(d) { if (!lb || lbList.length < 2) return; lbI = (lbI + d + lbList.length) % lbList.length; lbPaint(); }
  function shut() { if (!lb) return; lb.remove(); lb = null; try { if (lbBack && lbBack.focus) lbBack.focus({preventScroll: true}); } catch (e) { /* noop */ } lbBack = null; }
  document.addEventListener('keydown', e => {
    if (!lb) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); shut(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  }, true);

  /* ══════════════════════ 글 ↔ 조각 ══════════════════════
     글 = 줄들. 사진 표시 줄이 잇달아 있으면 한 줄(row)에 나란히. 조각은 늘 글 · 사진줄 · 글 · … · 글 차례 (양 끝은 글, 비어 있으면 저장할 때 뺀다) */
  const token = x => `[[img:${x.p}|${Math.round(x.w)}|${x.nw}x${x.nh}|${x.id}]]`;
  function parse(v) {
    const segs = []; let txt = [], row = null;
    String(v || '').split('\n').forEach(line => {
      const m = TOK.exec(line.trim());
      if (m) {
        const x = {p: m[1], w: +m[2], nw: +m[3] || 1, nh: +m[4] || 1, id: m[5]};
        if (row) row.list.push(x); else { segs.push({t: 'txt', v: txt.join('\n')}); txt = []; row = {t: 'row', list: [x]}; segs.push(row); }
      } else { if (row) { row = null; } txt.push(line); }
    });
    segs.push({t: 'txt', v: row ? '' : txt.join('\n')});
    return segs;
  }
  function build(segs) {
    const out = [];
    segs.forEach((s, i) => {
      if (s.t === 'row') s.list.forEach(x => out.push(token(x)));
      else if (s.v !== '' || (i > 0 && i < segs.length - 1)) out.push(s.v);
    });
    return out.join('\n');
  }
  function mergeFix(merged, mine) {
    if (!merged || merged.indexOf('[[img:') < 0) return merged;
    const want = new Map(); String(mine || '').split('\n').forEach(l => { const m = TOK.exec(l.trim()); if (m) want.set(m[5], l); });
    const seen = new Set(), out = [];
    merged.split('\n').forEach(l => {
      const m = TOK.exec(l.trim()); if (!m) { out.push(l); return; }
      if (seen.has(m[5])) return;
      seen.add(m[5]); out.push(want.get(m[5]) || l);
    });
    return out.join('\n');
  }
  const plain = v => String(v || '').split('\n').map(l => { const m = TOK.exec(l.trim()); return m ? `[이미지] ${pub(m[1])}` : l; }).join('\n');

  /* ══════════════════════ 글 + 사진 메모 칸 ══════════════════════ */
  function memo(src, opt) {
    css(); opt = opt || {};
    const root = document.createElement('div');
    root.className = 'memo'; root.id = src.id + 'Box';
    const PH = src.placeholder || '', MAX = src.maxLength > 0 ? src.maxLength : 50000, TID = src.id;
    src.replaceWith(root);
    let segs = parse(src.value), raw = src.value || '', comp = false, hold = null, drag = null, ro = !!src.disabled, upN = 0;
    const texts = () => [...root.querySelectorAll('textarea.mt')];
    const grow = t => { const y = scrollY; t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight, 24) + 'px'; if (scrollY !== y) scrollTo(0, y); };
    const inner = () => { const c = getComputedStyle(root); return Math.max(120, Math.floor(root.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight))); };
    const imgsIn = () => segs.filter(s => s.t === 'row').flatMap(s => s.list);

    function figHtml(x) {
      const ar = `${x.nw}/${x.nh}`, local = x.local ? ` src="${E(x.local)}"` : ` src="${E(pub(x.p))}" data-big="${E(pub(x.p))}"`;
      return `<figure class="mimg${x.local ? ' up' : ''}" data-id="${E(x.id)}" tabindex="0" style="width:${Math.round(x.w)}px;aspect-ratio:${ar}" aria-label="메모 사진">
<img${local} alt="" draggable="false" loading="lazy">
<div class="mb" contenteditable="false"><button type="button" data-m="s" title="작게">작게</button><button type="button" data-m="m" title="중간 크기">중간</button><button type="button" data-m="l" title="칸 가득">크게</button><button type="button" data-m="x" title="화면 가득">최대</button><button type="button" data-m="del" title="사진 지우기" aria-label="사진 지우기">지우기</button></div>
<span class="ml"></span><button type="button" class="mh" title="끌어서 크기 바꾸기" aria-label="끌어서 크기 바꾸기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L19 5M19 5h-6M19 5v6M5 19h6M5 19v-6"/></svg></button></figure>`;
    }
    function paint() {
      root.innerHTML = segs.map((s, i) => s.t === 'row'
        ? `<div class="mrow" data-i="${i}">${s.list.map(figHtml).join('')}</div>`
        : `<textarea class="mt" data-i="${i}" rows="1" maxlength="${MAX}"${i === 0 ? ` id="${E(TID)}"` : ''} aria-label="${E(opt.label || '메모')}"></textarea>`).join('');
      texts().forEach(t => { t.value = segs[+t.dataset.i].v; t.disabled = ro; });
      root.classList.toggle('ro', ro);
      ph();
      fit();
    }
    function ph() { const ts = texts(), empty = segs.length === 1; ts.forEach((t, i) => { t.placeholder = empty && i === 0 ? PH : ''; }); }
    function fit() { texts().forEach(grow); if (opt.onFit) opt.onFit(); }
    // 글자 하나하나는 조각만, 사진을 넣고 뺄 때만 다시 그린다
    function read() { texts().forEach(t => { const s = segs[+t.dataset.i]; if (s) s.v = t.value; }); }
    function changed() { hold = null; /* 기다리던 남의 글은 저장할 때 다시 합쳐진다 — 옛 것을 덮어쓰지 않게 */ raw = build(segs.map(s => (s.t === 'row' ? {t: 'row', list: s.list.filter(x => !x.local)} : s)).filter(s => s.t !== 'row' || s.list.length)); if (opt.onInput) opt.onInput(); }

    function caret() {   // 다시 그린 뒤에도 커서가 같은 줄에 있게 — 글 전체에서 몇째 글자인지 + 그 줄 글
      const t = document.activeElement; if (!t || !root.contains(t) || !t.classList.contains('mt')) return null;
      const before = t.value.slice(0, t.selectionStart), ln = before.split('\n'), full = t.value.split('\n');
      return {line: full[ln.length - 1], col: ln[ln.length - 1].length, seg: texts().indexOf(t), row: ln.length - 1};
    }
    function putCaret(c) {
      if (!c) return;
      const ts = texts(); let best = null;
      ts.forEach((t, si) => t.value.split('\n').forEach((l, li) => { if (l !== c.line) return; const d = Math.abs(si - c.seg) * 1000 + Math.abs(li - c.row); if (!best || d < best.d) best = {t, li, d}; }));
      const t = best ? best.t : ts[clamp(c.seg, 0, ts.length - 1)]; if (!t) return;
      const ls = t.value.split('\n'), li = best ? best.li : clamp(c.row, 0, ls.length - 1);
      const at = ls.slice(0, li).reduce((a, l) => a + l.length + 1, 0) + Math.min(c.col, (ls[li] || '').length);
      t.focus({preventScroll: true}); try { t.setSelectionRange(at, at); } catch (e) { /* noop */ }
    }
    function shape(ss) { return ss.map(s => (s.t === 'row' ? 'r:' + s.list.map(x => x.id).join(',') : 't')).join('|'); }
    function setValue(v) {
      v = v || '';
      if (v === raw) { hold = null; return; }
      if (comp || drag) { hold = v; return; }   // 한글 조합 중 · 크기 바꾸는 중이면 끝난 뒤에
      hold = null;
      const next = parse(v);
      if (segs.some(s => s.t === 'row' && s.list.some(x => x.local))) { pend(next); }
      if (shape(next) === shape(segs)) {
        raw = v; segs = next;
        texts().forEach(t => {
          const nv = segs[+t.dataset.i].v; if (t.value === nv) return;
          const f = document.activeElement === t, a = t.selectionStart, b = t.selectionEnd;
          t.value = nv;
          if (f) { try { t.setSelectionRange(Math.min(a, nv.length), Math.min(b, nv.length)); } catch (e) { /* noop */ } }
          grow(t);
        });
        imgsIn().forEach(x => { const f = figOf(x.id); if (f) f.style.width = Math.round(x.w) + 'px'; });
        if (opt.onFit) opt.onFit();
        return;
      }
      const c = caret();
      raw = v; segs = next; paint(); putCaret(c);
    }
    function applyHold() { if (hold == null || comp || drag) return; setValue(hold); if (opt.onHeld) opt.onHeld(); }
    // 올리는 중인 사진(아직 글에 없음)은 다른 사람 글이 들어와도 맨 끝에 남긴다
    function pend(next) {
      const ups = imgsIn().filter(x => x.local); if (!ups.length) return;
      const last = next[next.length - 1];
      if (last.v === '' && next.length > 1) next[next.length - 2].list.push(...ups);
      else next.push({t: 'row', list: ups}, {t: 'txt', v: ''});
    }
    const figOf = id => [...root.querySelectorAll('.mimg')].find(f => f.dataset.id === id);
    function locate(id) { for (let i = 0; i < segs.length; i++) if (segs[i].t === 'row') { const k = segs[i].list.findIndex(x => x.id === id); if (k >= 0) return {s: i, k, x: segs[i].list[k]}; } return null; }

    /* ── 사진 넣기 ── */
    function place() {   // 지금 커서 자리 (칸 밖이면 맨 끝)
      read();
      const t = document.activeElement && root.contains(document.activeElement) ? document.activeElement : null;
      if (t && t.classList.contains('mt')) return {i: +t.dataset.i, a: t.selectionStart, b: t.selectionEnd};
      const f = t && t.closest('.mimg'); if (f) { const l = locate(f.dataset.id); if (l) return {row: l.s, k: l.k + 1}; }
      const i = segs.length - 1; return {i, a: segs[i].v.length, b: segs[i].v.length};
    }
    function insert(xs, at) {   // 돌려주는 것 = 커서를 둘 글 조각 번호
      if (at.row != null) { segs[at.row].list.splice(at.k, 0, ...xs); return at.row + 1; }
      const s = segs[at.i], pre = s.v.slice(0, at.a).replace(/\n$/, ''), post = s.v.slice(at.b).replace(/^\n/, '');
      if (pre === '' && at.i > 0) { segs[at.i - 1].list.push(...xs); s.v = post; return at.i; }   // 바로 앞이 사진 줄 = 그 옆에 나란히
      if (post === '' && at.i < segs.length - 1) { segs[at.i + 1].list.unshift(...xs); s.v = pre; return at.i + 2; }
      segs.splice(at.i, 1, {t: 'txt', v: pre}, {t: 'row', list: xs}, {t: 'txt', v: post});
      return at.i + 2;
    }
    async function addFiles(files, at) {
      const list = imgFiles(files);
      if (!list.length) { CFG.toast('사진 파일만 넣을 수 있어요', true); return; }
      if (ro) return;
      at = at || place();
      const xs = list.map(f => ({id: rid(), p: '', w: Math.min(480, inner()), nw: 4, nh: 3, local: URL.createObjectURL(f), f}));
      const go = insert(xs, at);
      upN += xs.length;
      paint();
      const t = root.querySelector(`textarea.mt[data-i="${go}"]`); if (t) { t.focus({preventScroll: true}); try { t.setSelectionRange(0, 0); } catch (e) { /* noop */ } }
      await Promise.all(xs.map(async x => {
        try {
          const im = new Image(); im.src = x.local; await im.decode().catch(() => 0);
          if (im.naturalWidth) { x.nw = im.naturalWidth; x.nh = im.naturalHeight; x.w = clamp(Math.min(480, im.naturalWidth), 80, inner()); const f = figOf(x.id); if (f) { f.style.width = x.w + 'px'; f.style.aspectRatio = `${x.nw}/${x.nh}`; } }
          const r = await upload(x.f);
          const l = locate(x.id); if (!l) return;   // 올리는 사이 지움
          URL.revokeObjectURL(x.local);
          Object.assign(l.x, {p: r.p, nw: r.w, nh: r.h}); delete l.x.local; delete l.x.f;
          const f = figOf(x.id);
          if (f) { f.classList.remove('up'); f.style.aspectRatio = `${r.w}/${r.h}`; const im2 = f.querySelector('img'); im2.src = pub(r.p); im2.dataset.big = pub(r.p); }
          read(); changed();
        } catch (e) {
          const l = locate(x.id); if (l) { read(); drop(l); paint(); }
          CFG.toast(e.message || '사진을 올리지 못했어요', true);
        } finally { upN--; }
      }));
      if (opt.onBlur && !root.contains(document.activeElement)) opt.onBlur();
    }
    function drop(l) {   // 사진 한 장 빼기 — 그 줄이 비면 앞뒤 글을 잇는다
      segs[l.s].list.splice(l.k, 1);
      if (segs[l.s].list.length) return null;
      const a = segs[l.s - 1], b = segs[l.s + 1], at = a.v.length + (a.v && b.v ? 1 : 0);
      a.v = a.v && b.v ? a.v + '\n' + b.v : a.v + b.v;
      segs.splice(l.s, 2);
      return {i: l.s - 1, at};
    }
    function remove(id) {
      read();
      const l = locate(id); if (!l) return;
      const was = l.s, c = drop(l);
      paint(); changed();
      const t = root.querySelector(`textarea.mt[data-i="${c ? c.i : was + 1}"]`);
      if (t && canHover.matches) { t.focus({preventScroll: true}); const at = c ? c.at : 0; try { t.setSelectionRange(at, at); } catch (e) { /* noop */ } }
      if (opt.onBlur) opt.onBlur();
    }
    function setW(id, w, done) {
      const l = locate(id), f = figOf(id); if (!l || !f) return;
      l.x.w = clamp(Math.round(w), 60, 4000);
      f.style.width = l.x.w + 'px';
      if (done) { read(); changed(); if (opt.onFit) opt.onFit(); if (opt.onBlur) opt.onBlur(); }
    }
    const full = () => Math.max(inner(), opt.maxWidth ? opt.maxWidth() : inner());

    /* ── 크기 바꾸기 (마우스 · 손가락) ── */
    root.addEventListener('pointerdown', e => {
      const h = e.target.closest('.mh'); if (!h || ro) return;
      const f = h.closest('.mimg'), l = locate(f.dataset.id); if (!l) return;
      e.preventDefault(); e.stopPropagation();
      zHide(); zBusy = true;
      drag = {id: l.x.id, f, h, pid: e.pointerId, x: e.clientX, w: f.getBoundingClientRect().width, y: e.clientY, r: l.x.nw / l.x.nh};
      f.classList.add('rs'); try { h.setPointerCapture(e.pointerId); } catch (er) { /* noop */ }
    });
    root.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.pid) return;
      const dx = e.clientX - drag.x, dy = (e.clientY - drag.y) * drag.r, d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      const w = clamp(drag.w + d, 60, opt.dragMax ? Math.max(inner(), opt.dragMax()) : full());
      setW(drag.id, w);
      if (opt.onDrag) opt.onDrag(w);
      const bw = Math.round(drag.f.getBoundingClientRect().width);
      drag.f.querySelector('.ml').textContent = `${bw} × ${Math.round(bw / drag.r)}`;
    });
    const end = e => {
      if (!drag || (e.pointerId != null && e.pointerId !== drag.pid)) return;
      const d = drag; drag = null; zBusy = false;
      d.f.classList.remove('rs');
      const w = d.f.getBoundingClientRect().width;
      if (Math.abs(w - d.w) >= 1) setW(d.id, w, true); else if (opt.onFit) opt.onFit();
      applyHold();
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('lostpointercapture', end);

    /* ── 누르기 ── */
    const sel = f => { root.querySelectorAll('.mimg.sel').forEach(x => x.classList.toggle('sel', x === f)); if (f) f.classList.add('sel'); };
    root.addEventListener('click', e => {
      const f = e.target.closest('.mimg');
      const b = e.target.closest('[data-m]');
      if (b && f) {
        e.stopPropagation(); const m = b.dataset.m; zHide();
        if (m === 'del') remove(f.dataset.id);
        else setW(f.dataset.id, m === 's' ? Math.min(220, inner()) : m === 'm' ? Math.min(480, inner()) : m === 'l' ? inner() : full(), true);
        return;
      }
      if (e.target.closest('.mh')) return;
      if (f) {
        if (!canHover.matches && !f.classList.contains('sel')) { sel(f); return; }   // 휴대폰: 한 번 = 고르기(크기 · 지우기), 또 누르면 크게
        const all = imgsIn().filter(x => !x.local), i = all.findIndex(x => x.id === f.dataset.id);
        if (i >= 0) open(all.map(x => ({src: pub(x.p), text: opt.label || '회의 메모'})), i);
        return;
      }
      sel(null);
      if (e.target === root || e.target.classList.contains('mrow')) {   // 빈 자리를 누르면 그 아래 글 칸으로
        const i = e.target === root ? segs.length - 1 : +e.target.dataset.i + 1, t = root.querySelector(`textarea.mt[data-i="${i}"]`);
        if (t) { t.focus({preventScroll: true}); const n = e.target === root ? t.value.length : 0; try { t.setSelectionRange(n, n); } catch (er) { /* noop */ } }
      }
    });
    document.addEventListener('pointerdown', e => { if (!root.contains(e.target)) sel(null); }, true);

    /* ── 적기 ── */
    root.addEventListener('input', e => { if (!e.target.classList.contains('mt')) return; grow(e.target); read(); changed(); });
    root.addEventListener('compositionstart', () => { comp = true; });
    root.addEventListener('compositionend', () => { comp = false; setTimeout(applyHold, 60); });
    root.addEventListener('focusout', () => { setTimeout(() => { if (!root.contains(document.activeElement) && opt.onBlur) opt.onBlur(); }, 0); });
    root.addEventListener('keydown', e => {
      const t = e.target;
      if (t.classList.contains('mimg')) {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(t.dataset.id); }
        else if (e.key === 'Enter') { e.preventDefault(); t.querySelector('img').click(); }
        return;
      }
      if (!t.classList.contains('mt') || e.isComposing || t.selectionStart !== t.selectionEnd) return;
      const i = +t.dataset.i, go = (k, atEnd) => { const n = root.querySelector(`textarea.mt[data-i="${k}"]`); if (!n) return false; e.preventDefault(); n.focus(); const p = atEnd ? n.value.length : 0; n.setSelectionRange(p, p); return true; };
      const figAt = (k, last) => { const r = root.querySelector(`.mrow[data-i="${k}"]`); if (!r) return; const fs = r.querySelectorAll('.mimg'), f = last ? fs[fs.length - 1] : fs[0]; e.preventDefault(); sel(f); f.focus({preventScroll: true}); };
      if (e.key === 'Backspace' && t.selectionStart === 0 && i > 0) figAt(i - 1, true);          // 한 번 = 사진 고르기, 또 누르면 지우기
      else if (e.key === 'Delete' && t.selectionStart === t.value.length && i < segs.length - 1) figAt(i + 1, false);
      else if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && t.selectionStart === 0 && i > 0) go(i - 2, true);
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && t.selectionStart === t.value.length && i < segs.length - 1) go(i + 2, false);
    });
    root.addEventListener('paste', e => {
      const dt = e.clipboardData, fs = filesOf(dt); if (!fs.length) return;
      if ((dt.getData('text/plain') || '').trim()) return;   // 글이 같이 있으면 글로 (엑셀 · 워드)
      e.preventDefault(); e.stopPropagation(); addFiles(fs);
    });
    const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
    root.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; root.classList.add('drop'); });
    root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) root.classList.remove('drop'); });
    root.addEventListener('drop', e => {
      root.classList.remove('drop');
      const fs = filesOf(e.dataTransfer); if (!fs.length) return;
      e.preventDefault(); e.stopPropagation();
      const t = e.target.closest('.mt'), r = e.target.closest('.mrow'), f = e.target.closest('.mimg');
      read();
      let at = null;
      if (f) { const l = locate(f.dataset.id); if (l) at = {row: l.s, k: l.k + 1}; }
      else if (r) at = {row: +r.dataset.i, k: segs[+r.dataset.i].list.length};
      else if (t) at = {i: +t.dataset.i, a: segs[+t.dataset.i].v.length, b: segs[+t.dataset.i].v.length};
      addFiles(fs, at);
    });
    window.addEventListener('resize', () => texts().forEach(grow));
    if (window.ResizeObserver) { let w0 = 0; new ResizeObserver(() => { const w = root.clientWidth; if (w !== w0) { w0 = w; texts().forEach(grow); } }).observe(root); }
    paint();
    return {
      el: root,
      get value() { return raw; }, set value(v) { setValue(v); },
      get disabled() { return ro; }, set disabled(v) { ro = !!v; texts().forEach(t => { t.disabled = ro; }); root.classList.toggle('ro', ro); },
      get busy() { return upN > 0; },
      get inner() { return inner(); },
      get maxImg() { return imgsIn().reduce((a, x) => Math.max(a, x.w), 0); },
      addFiles, has: n => root.contains(n),
      pick() {
        const at = place(), i = document.createElement('input');
        i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.hidden = true;
        document.body.appendChild(i);
        i.addEventListener('change', () => { if (i.files.length) addFiles(i.files, at); i.remove(); });
        i.click();
      },
      focus() { const ts = texts(); if (ts.length) ts[ts.length - 1].focus(); },
      grow: fit,
    };
  }

  /* 메모 두 칸(회의 메모 · 결정) — 사진을 칸보다 크게 키우면 위아래로 놓아 화면 폭까지. box = 두 칸을 담은 격자, get() = [왼쪽, 오른쪽] */
  function columns(box, get) {
    const pad = () => { const e = get()[0], card = e && e.el.closest('.note'); return card ? card.offsetWidth - e.inner : 48; };
    const gap = () => parseFloat(getComputedStyle(box).columnGap) || 12, two = () => innerWidth > 860;
    const wide = () => Math.max(160, box.clientWidth - pad()), half = () => (two() ? Math.max(160, (box.clientWidth - gap()) / 2 - pad()) : wide());
    function layout() {
      const ed = get(); if (!ed[0] || !ed[1] || !box.clientWidth) return;
      const need = two() && Math.max(ed[0].maxImg, ed[1].maxImg) > half() + 3;
      if (box.classList.contains('wide') === need) return;
      box.classList.toggle('wide', need);
      ed[0].grow(); ed[1].grow();
    }
    window.addEventListener('resize', layout);
    // i = 몇째 칸. 왼쪽 칸은 끄는 동안 바로 넓어지고, 오른쪽 칸은 자리가 튀지 않게 칸 안에서만(더 크게는 [최대])
    const opts = i => ({maxWidth: wide, dragMax: () => (i === 0 || box.classList.contains('wide') ? wide() : half()), onDrag: () => { if (i === 0) layout(); }, onFit: layout});
    return {layout, opts};
  }

  /* 전체 화면으로 여는 작은 사진 — <img data-lb="묶음 이름"> 을 누르면 같은 묶음끼리 넘겨 본다 */
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-lb]'); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    const g = [...document.querySelectorAll('[data-lb]')].filter(x => x.dataset.lb === t.dataset.lb);
    open(g.map(x => ({src: x.dataset.big || x.src, text: x.dataset.cap || ''})), g.indexOf(t));
  }, true);

  window.MtgShots = {
    init(c) { Object.assign(CFG, c || {}); css(); return window.MtgShots; },
    upload, url: pub, thumb, hash, isImg, filesOf, open, close: shut, hide: zHide, memo, columns, parse, build, mergeFix, plain,
    get opened() { return !!lb; },
  };
})();
