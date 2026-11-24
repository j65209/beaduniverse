/* 오피스 표 엑셀 조작 — 구글시트에서 옮겨 온 표(재고 ERP erp/ · MD팀 시트 mdsheet/)가 같이 쓴다
   2026-11-24 사장님 "erp 전산팀에서 칸 시프트기능, 컨트롤기능 … 칸 텍스트 수정도 엑셀이랑 최대 유사하게 … 디자인은 너무 바꾸지말고 기능만" ·
   "디자인을 바꾸는건 아니고 구글시트에서 가져온 웬만한건 다 엑셀에서 기본적으로 쓰는 기능은 다 넣어달라"

   PC(마우스)에서만 — 휴대폰 · 태블릿은 각 화면의 예전 방식 그대로.
   · 고르기: 한 번 누르기 = 고르기, 끌기 · Shift+누르기/화살표 = 범위, Ctrl(맥 ⌘)+누르기/끌기 = 떨어진 칸 더하기(고른 칸은 빼기),
     머리글 = 열 · 행 번호 = 줄 · 왼쪽 위 '행' = 전부. Ctrl+화살표 = 글이 이어진 끝까지, Home · End · PageUp/Down · Ctrl+A · Shift/Ctrl+Space.
   · 고치기: 바로 치면 새로 쓰기('enter' — 화살표로 저장하고 옮김), 두 번 누르기 · F2 = 글자 사이('edit'), Enter/Tab, Alt+Enter 줄바꿈,
     Ctrl+Enter 고른 칸 전부, Alt+↓ 같은 열 값 목록, 자동 완성, 이름 상자 · fx 입력줄.
   · S.cell = 활성 칸, S.anc(없으면 활성 칸) ~ S.cell2 = 지금 범위, S.multi = Ctrl 로 먼저 골라 둔 범위들. 모두 줄 번호 · 열 번호로 기억해서
     자동 갱신으로 표를 다시 그려도 그대로다 (calcRng 이 보이는 줄 차례로 바꿔 그림).
   · 입력 상자(CE.el)는 하나 — 고르기만 했을 때도 그 칸 위에 안 보이게 두고 포커스를 둔다. 그래야 한글 첫 글자부터 그대로 들어간다(한글은 조합이라
     자판 이벤트로는 못 받는다). 표(table)를 다시 그려도 상자는 밖에 있어 치던 글이 안 날아간다.
   · 복사 · 잘라내기(점선, 붙일 때 옮겨짐) · 값만 · 줄/열 바꿔 붙이기 · 배수 되풀이 · 채우기 손잡이 · Ctrl+D · 되돌리기/다시 실행 ·
     찾기/바꾸기 · 메모 · 글자 모양(기울임 · 밑줄 · 취소선 · 크기 · 맞춤 · 테두리 · 숫자 모양) · 틀 고정 · 열/줄 숨기기 · 엑셀로 받기 · 인쇄.
   · 함수가 있는 화면(ctx.formulas, MD팀 시트): = 를 쓰다 칸을 누르거나 화살표 = 주소, F4 = $ 고정, 함수 칸을 복사 · 채우면 주소가 따라 움직임, Alt+= 자동 합계.
     함수가 없는 화면(ctx.calcEntry, 재고 ERP): '=120-30' 처럼 적으면 계산한 값.

   화면은 OfficeGrid({...}) 에 자기 것(표 · 상태 S · 칸 정보 editCtx · 쓰기 writeMany …)을 넘기고, 돌려받은 함수를 쓴다.
   줄 자료 · 저장 · 권한 · 잠금은 전부 화면 것 — 여기는 조작만. */
(function () {
  'use strict';
  if (window.OfficeGrid) return;

  /* ── 화면과 상관없는 것 ── */
  // '=120-30*2' 같은 숫자 계산 → '60' · 계산이 아니면 null(= 로 시작 안 함) · false(함수 등 못 하는 것)
  function calc(text) {
    const s = String(text == null ? '' : text).trim();
    if (!/^=/.test(s)) return null;
    const t = s.slice(1).replace(/,/g, '').replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
    if (!t || !/^[\d.+\-*\/()%^]+$/.test(t)) return false;
    let i = 0;
    const num = () => {
      const m = t.slice(i).match(/^\d*\.?\d+(?:\.(?!\d))?|^\d+\.?/);
      if (!m) throw new Error('num');
      i += m[0].length;
      let v = parseFloat(m[0]);
      while (t[i] === '%') { v /= 100; i++; }
      return v;
    };
    const atom = () => {
      if (t[i] === '-') { i++; return -atom(); }
      if (t[i] === '+') { i++; return atom(); }
      if (t[i] === '(') { i++; let v = add(); if (t[i] !== ')') throw new Error('paren'); i++; while (t[i] === '%') { v /= 100; i++; } return v; }
      return num();
    };
    const pow = () => { const a = atom(); if (t[i] === '^') { i++; return Math.pow(a, pow()); } return a; };
    const mul = () => { let a = pow(); while (t[i] === '*' || t[i] === '/') { const op = t[i++], b = pow(); if (op === '/' && b === 0) throw new Error('div0'); a = op === '*' ? a * b : a / b; } return a; };
    const add = () => { let a = mul(); while (t[i] === '+' || t[i] === '-') { const op = t[i++], b = mul(); a = op === '+' ? a + b : a - b; } return a; };
    try {
      const v = add();
      if (i !== t.length || !isFinite(v)) return false;
      return String(Math.round(v * 1e8) / 1e8);
    } catch (e) { return false; }
  }
  const colNo = a => { let n = 0; for (const ch of a.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
  const colTx = n => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
  // 함수 속 주소를 줄 dr · 칸 dc 만큼 옮김 ($ 는 그대로, 글자 "…" · 시트 이름 '…' 안은 안 봄)
  function shiftFx(f, dr, dc) {
    if (!dr && !dc) return f;
    const c1 = (d, a) => { if (d) return a.toUpperCase(); const n = colNo(a) + dc; return n < 1 ? null : colTx(n); };
    return String(f).replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'|(?<![A-Za-z0-9_.$가-힣])(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})(?![A-Za-z0-9_(가-힣])|(?<![A-Za-z0-9_.$가-힣])(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_(가-힣])/g,
      (all, d1, a, d2, r, e1, b, e2, c) => {
        if (a) {
          const ca = c1(d1, a), rr = d2 ? +r : +r + dr;
          return ca === null || rr < 1 ? '#REF!' : d1 + ca + d2 + rr;
        }
        if (b) { const x = c1(e1, b), y = c1(e2, c); return x === null || y === null ? '#REF!' : e1 + x + ':' + e2 + y; }
        return all;
      });
  }
  /* 칸 서식 — 저장소 ofmt 한 칸: b 굵게(700) · w 두께 · fg 글자 색 · bg 칸 색 + i 기울임 · u 밑줄 · s 취소선 · sz 글자 크기(8~24) · al 맞춤(l c r) ·
     bd 테두리('tblr' 가운데 있는 것) · nf 숫자 모양(c 쉼표 · p % · w ₩ · y ¥ · n 쉼표 없이 + 소수 자리 0~6, d1 11/24 · d2 2026-11-24 · d3 11월 24일) · n 메모 · o 줄 차례(중간에 넣은 줄 — 그 줄 첫 열에만).
     b · w · fg · bg 말고는 저장소 함수 office_fmt_apply 가 새 판일 때만 저장된다 → ctx.fmtProbe 로 물어보고(저장 없이 답만 주는 함수), 옛 판이면 그 기능들을 화면에 안 내놓는다 (적어도 안 남으므로) */
  const FK = ['b', 'w', 'fg', 'bg', 'i', 'u', 's', 'sz', 'al', 'bd', 'nf', 'n', 'o'];
  const fmtPack = f => ({b: f.b ? 1 : 0, w: +f.w || 0, fg: f.fg || '', bg: f.bg || '', i: f.i ? 1 : 0, u: f.u ? 1 : 0, s: f.s ? 1 : 0, sz: +f.sz || 0, al: f.al || '', bd: f.bd || '', nf: f.nf || '', n: f.n || '', o: +f.o || 0});
  const fmtSame = (a, b) => { const x = fmtPack(a || {}), y = fmtPack(b || {}); return FK.every(k => x[k] === y[k]); };
  function fmtCss(f) {   // i · u · s · 크기 · 맞춤 · 테두리 (굵게 · 색은 화면이 이미 그림)
    if (!f) return '';
    const deco = (f.u ? ' underline' : '') + (f.s ? ' line-through' : '');
    return (f.i ? 'font-style:italic;' : '') + (deco ? `text-decoration:${deco.trim()};` : '') + (f.sz ? `font-size:${Math.max(8, Math.min(24, +f.sz))}px;line-height:1.15;` : '')
      + (f.al ? `text-align:${f.al === 'c' ? 'center' : f.al === 'r' ? 'right' : 'left'};` : '')
      + (f.bd ? (/t/.test(f.bd) ? 'border-top:1px solid #334155;' : '') + (/b/.test(f.bd) ? 'border-bottom:1px solid #334155;' : '') + (/l/.test(f.bd) ? 'border-left:1px solid #334155;' : '') + (/r/.test(f.bd) ? 'border-right:1px solid #334155;' : '') : '');
  }
  const numTx = t => { const s = String(t == null ? '' : t).replace(/[,\s]/g, '').replace(/^[₩￦$￥¥]/, '').replace(/(원|개)$/, ''); return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : /^-?\d+(\.\d+)?%$/.test(s) ? parseFloat(s) / 100 : null; };
  function dateOf(t) {
    let m = String(t).trim().match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?$/);
    if (m) return [+m[1], +m[2], +m[3]];
    m = String(t).trim().match(/^(\d{1,2})\s*[./]\s*(\d{1,2})$/);
    return m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31 ? [0, +m[1], +m[2]] : null;
  }
  function fmtText(t, nf) {   // 보이는 글만 바꿈 (저장된 값은 그대로)
    if (!nf || !t) return t;
    if (nf[0] === 'd') {
      const d = dateOf(t);
      if (!d) return t;
      const p2 = n => String(n).padStart(2, '0');
      return nf === 'd1' ? `${d[1]}/${d[2]}` : nf === 'd3' ? `${d[1]}월 ${d[2]}일` : d[0] ? `${d[0]}-${p2(d[1])}-${p2(d[2])}` : `${d[1]}/${d[2]}`;
    }
    const n = numTx(t);
    if (n === null) return t;
    const dec = Math.max(0, Math.min(6, +nf[1] || 0));
    if (nf[0] === 'p') return (n * 100).toFixed(dec) + '%';
    const s = nf[0] === 'n' ? n.toFixed(dec) : Math.abs(n).toLocaleString('ko-KR', {minimumFractionDigits: dec, maximumFractionDigits: dec});
    return nf[0] === 'n' ? s : (n < 0 ? '-' : '') + (nf[0] === 'w' ? '₩' : nf[0] === 'y' ? '¥' : '') + s;
  }

  const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';   // 시딩 마스터와 같은 도구 (처음 누를 때만 받음)
  let xlsxP = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return xlsxP || (xlsxP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = XLSX_URL;
      s.onload = () => (window.XLSX ? res(window.XLSX) : rej(new Error('xlsx')));
      s.onerror = () => { xlsxP = null; rej(new Error('xlsx')); };
      document.head.appendChild(s);
    }));
  }

  const CSS = `
  .tbl td.crng{--rt:0px;--rb:0px;--rl:0px;--rr:0px;--rf:rgba(37,99,235,.13);box-shadow:inset 0 var(--rt) 0 0 var(--info),inset 0 var(--rb) 0 0 var(--info),inset var(--rl) 0 0 0 var(--info),inset var(--rr) 0 0 0 var(--info),inset 0 0 0 999px var(--rf)!important}
  .tbl td.rg-t{--rt:2px}.tbl td.rg-b{--rb:-2px}.tbl td.rg-l{--rl:2px}.tbl td.rg-r{--rr:-2px}
  .tbl td.csel.crng{--rf:transparent}
  .tbl td.csel:not(.crng){box-shadow:inset 0 0 0 2px var(--info)!important}
  .tbl td.fh:not(.sk):not(.skr){position:relative}
  .tbl td.fh::before{content:'';position:absolute;right:0;bottom:0;z-index:2;width:8px;height:8px;background:var(--info);border:1px solid #fff;border-right:0;border-bottom:0;cursor:crosshair}
  .tbl td.fprev{box-shadow:inset 0 0 0 1px rgba(37,99,235,.5),inset 0 0 0 999px rgba(37,99,235,.07)!important}
  .tbl td.ant{--at:0px;--ab:0px;--al:0px;--ar:0px;background-image:linear-gradient(90deg,#1d4ed8 50%,#fff 0),linear-gradient(90deg,#1d4ed8 50%,#fff 0),linear-gradient(0deg,#1d4ed8 50%,#fff 0),linear-gradient(0deg,#1d4ed8 50%,#fff 0)!important;background-repeat:repeat-x,repeat-x,repeat-y,repeat-y!important;background-size:8px var(--at),8px var(--ab),var(--al) 8px,var(--ar) 8px!important;animation:ants .5s linear infinite}
  .tbl td.ant-t{--at:2px}.tbl td.ant-b{--ab:2px}.tbl td.ant-l{--al:2px}.tbl td.ant-r{--ar:2px}
  .tbl td.ant.crng{--rt:0px;--rb:0px;--rl:0px;--rr:0px}
  .tbl td.ant.csel:not(.crng){box-shadow:none!important}
  @keyframes ants{from{background-position:0 0,0 100%,0 0,100% 0}to{background-position:8px 0,-8px 100%,0 -8px,100% 8px}}
  @media (prefers-reduced-motion:reduce){ .tbl td.ant{animation-play-state:paused} }
  .tbl thead th.hl:not([style*="background-color"]){background:#e4edfd;color:var(--text)}
  .tbl tbody td.rn.hl{background:#e4edfd!important;color:var(--info);font-weight:700}
  .tbl td.pend:not(.sk):not(.skr){position:relative}
  .tbl td.big .cl{-webkit-line-clamp:1!important}
  .tbl td.nt{background-image:linear-gradient(225deg,#f59e0b 5px,transparent 5.5px)}
  .tbl th.frz{border-right:2px solid #94a3b8}
  @media (hover:hover) and (min-width:721px){
    .tbl tbody td[data-p]{cursor:cell;user-select:none;-webkit-user-select:none}
    .tbl tbody td.rn{user-select:none;-webkit-user-select:none}
    .tbl tbody td .ck,.tbl tbody td .ck0,.tbl tbody td .hchip{cursor:pointer}
  }
  body.fxon .tbl tbody td[data-p]{cursor:crosshair}
  .cedit{position:fixed;z-index:65;margin:0;padding:6px;border:2px solid var(--info);border-radius:0;background:#fff;color:var(--text);font:400 13px var(--ui);line-height:17px;outline:0;box-shadow:0 2px 8px rgba(15,23,42,.18);resize:none;overflow:hidden;white-space:pre-wrap;overflow-wrap:break-word;-webkit-appearance:none;appearance:none}
  .cedit.idle,.cedit.away{opacity:0;pointer-events:none;box-shadow:none}
  .cedit-tip{position:fixed;z-index:66;padding:3px 8px;border-radius:6px;background:#0f172a;color:#fff;font-size:11.5px;font-weight:600;line-height:1.4;white-space:nowrap;pointer-events:none;box-shadow:0 6px 16px rgba(15,23,42,.2)}
  .cedit-tip.err{background:#b91c1c}
  .cpick{position:fixed;z-index:66;min-width:120px;max-width:340px;max-height:232px;overflow:auto;padding:4px;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 30px rgba(15,23,42,.18);font-size:13px}
  .cpick div{padding:5px 9px;border-radius:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
  .cpick div:hover{background:#f1f5f9}
  .cpick div.on{background:#e8f0fe;color:var(--info)}
  .fxbar{margin-top:6px;display:flex;align-items:stretch;height:30px;border:1px solid var(--line);border-radius:8px;background:#fff;overflow:hidden}
  .fxbar:focus-within{border-color:#93c5fd}
  .fxn{flex:none;width:168px;padding:0 10px;border:0;border-right:1px solid var(--line);border-radius:0;background:#f8fafc;color:var(--text-2);font:600 12px var(--ui);outline:0;text-overflow:ellipsis}
  .fxi{flex:none;display:grid;place-items:center;width:34px;border-right:1px solid var(--line-2);color:var(--text-4);font:italic 700 13px Georgia,'Times New Roman',serif;user-select:none}
  .fxin{flex:1;min-width:0;height:28px;padding:5px 10px;border:0;outline:0;background:transparent;resize:none;color:var(--text);font:400 13px var(--ui);line-height:18px;overflow-y:auto;scrollbar-width:none}
  .fxin::-webkit-scrollbar{display:none}
  .fxin:read-only{color:var(--text-3)}
  .fxs{flex:none;align-self:center;max-width:46%;padding:0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-left:1px solid var(--line-2);font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums}
  .fxs:empty{display:none}
  .fxs b{color:var(--text-2);font-weight:700}
  @media (max-width:720px),(max-height:520px){ .fxbar{display:none!important} }
  @media (pointer:coarse){ .fxbar{display:none!important} }
  .xask{position:fixed;inset:0;z-index:95;display:grid;place-items:center;padding:16px;background:rgba(15,23,42,.32)}
  .xask .xa{width:min(380px,100%);padding:20px;border-radius:14px;background:#fff;box-shadow:0 24px 60px rgba(15,23,42,.3)}
  .xask b{display:block;font-size:15px}
  .xask p{margin:8px 0 16px;font-size:13px;line-height:1.55;color:var(--text-2)}
  .xask .xa-b{display:flex;justify-content:flex-end;gap:8px}
  .xask .xa-b button,.xnote .xn-b button,.xfind button{height:30px;padding:0 13px;border-radius:7px;background:#f1f4f8;color:var(--text-2);font-size:12.5px;font-weight:700;white-space:nowrap}
  .xask .xa-b button.ok{background:var(--danger);color:#fff}
  .xask .xa-b button:focus-visible{outline:2px solid #93c5fd;outline-offset:1px}
  .xhelp{position:fixed;z-index:87;width:min(540px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:14px 16px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 44px rgba(15,23,42,.2);font-size:12.5px}
  .xhelp h4{margin:0 0 8px;font-size:13.5px}
  .xhelp dl{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;margin:0}
  .xhelp dt{font-weight:700;color:var(--text-2);white-space:nowrap}
  .xhelp dd{margin:0;color:var(--text-2);line-height:1.45}
  .xmore{position:fixed;z-index:86;width:270px;max-height:calc(100vh - 16px);overflow:auto;padding:6px;background:#fff;border:1px solid var(--line);border-radius:11px;box-shadow:0 18px 44px rgba(15,23,42,.2);font-size:13px}
  .xmore .xr{display:flex;align-items:center;gap:3px;padding:2px 8px}
  .xmore .xr>span{flex:none;width:42px;font-size:11.5px;color:var(--text-4)}
  .xmore .xr button{flex:none;min-width:28px;height:28px;padding:0 7px;border-radius:6px;color:var(--text-2);font-size:12.5px;font-weight:600;white-space:nowrap}
  .xmore .xr button:hover,.xmore .xi:hover{background:#f1f5f9}
  .xmore .xr button.on{background:#e8f0fe;color:var(--info)}
  .xmore .xr em{flex:none;min-width:26px;font-style:normal;text-align:center;font-variant-numeric:tabular-nums;color:var(--text-2)}
  .xmore .xi{display:flex;align-items:center;gap:10px;width:100%;height:31px;padding:0 10px;border-radius:7px;color:var(--text);text-align:left;white-space:nowrap}
  .xmore .xi:disabled{opacity:.4;cursor:default;background:none}
  .xmore .xi kbd{margin-left:auto;padding-left:14px;font:600 11px/1 var(--ui);color:var(--text-4)}
  .xmore hr{margin:5px 4px;border:0;border-top:1px solid var(--line-2)}
  .xfind{position:fixed;z-index:84;width:330px;padding:12px;background:#fff;border:1px solid var(--line);border-radius:11px;box-shadow:0 18px 44px rgba(15,23,42,.2);font-size:12.5px}
  .xfind .xf-h{display:flex;align-items:center;margin-bottom:8px}
  .xfind .xf-h b{flex:1;font-size:13.5px}
  .xfind .xf-h button{width:28px;height:28px;padding:0;background:none;color:var(--text-4);font-size:15px}
  .xfind label.f{display:grid;grid-template-columns:52px 1fr;align-items:center;gap:8px;margin-bottom:6px;color:var(--text-3)}
  .xfind input[type=text]{width:100%;height:32px;padding:0 10px;border:1px solid var(--line);border-radius:7px;font:inherit;font-size:13px;color:var(--text);outline:0}
  .xfind input[type=text]:focus{border-color:#93c5fd}
  .xfind .xf-o{display:flex;flex-wrap:wrap;gap:4px 12px;margin:4px 0 9px;color:var(--text-2)}
  .xfind .xf-o label{display:inline-flex;align-items:center;gap:5px}
  .xfind .xf-b{display:flex;flex-wrap:wrap;gap:6px}
  .xfind .xf-b .pri{background:var(--info);color:#fff}
  .xfind .xf-m{margin-top:8px;min-height:17px;color:var(--text-3)}
  .xnote{position:fixed;z-index:84;width:260px;padding:10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:9px;box-shadow:0 12px 30px rgba(15,23,42,.2);font-size:12.5px}
  .xnote textarea{display:block;width:100%;height:92px;padding:7px 9px;border:1px solid #fde68a;border-radius:7px;background:#fff;font:inherit;font-size:13px;line-height:1.45;color:var(--text);outline:0;resize:vertical}
  .xnote .xn-b{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}
  .xnote .xn-b .ok{background:#f59e0b;color:#fff}
  .xfind [hidden],.xmore[hidden],.xfind[hidden],.xnote[hidden],.cpick[hidden],.fxbar[hidden],.xhelp[hidden]{display:none!important}
`;

  /* 찾기 · 바꾸기 창 — 표마다 칸 목록 · 고르기 · 쓰기만 넘기면 된다 (재고 ERP · MD팀 시트 · 시딩 마스터)
     a: at() 표 자리 · cells() [{id, t 보이는 글, …}] 보이는 차례 · picked() 고른 칸 id 들 · cur() 지금 칸 id · go(칸) · back() 표로 · raw(칸) 바꿀 원래 글(못 고치면 null) · why() 못 고치는 까닭 · apply([{c, v}], 이름, 물어볼 글) */
  function addCss() { if (!document.getElementById('ogCss')) { const st = document.createElement('style'); st.id = 'ogCss'; st.textContent = CSS; document.head.appendChild(st); } }
  function finder(a) {
    addCss();
    const box = document.createElement('div');
    box.className = 'xfind';
    box.id = 'xfind';
    box.hidden = true;
    box.innerHTML = '<div class="xf-h"><b>찾기 · 바꾸기</b><button type="button" data-f="x" title="닫기 (Esc)">✕</button></div>'
      + '<label class="f"><span>찾을 글</span><input type="text" data-k="q" autocomplete="off" spellcheck="false"></label><label class="f"><span>바꿀 글</span><input type="text" data-k="to" autocomplete="off" spellcheck="false"></label>'
      + '<div class="xf-o"><label><input type="checkbox" data-k="cs">대 · 소문자 구분</label><label><input type="checkbox" data-k="all">칸 전체가 같을 때만</label><label><input type="checkbox" data-k="sel">고른 칸에서만</label></div>'
      + '<div class="xf-b"><button type="button" class="pri" data-f="next">다음 찾기</button><button type="button" data-f="one">바꾸기</button><button type="button" data-f="many">모두 바꾸기</button></div><div class="xf-m"></div>';
    document.body.appendChild(box);
    const fq = k => box.querySelector(`[data-k="${k}"]`), say = t => { box.querySelector('.xf-m').textContent = t; };
    let sel = null;
    const re = () => { const q = fq('q').value; if (!q) return null; const s = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp(fq('all').checked ? `^${s}$` : s, (fq('cs').checked ? '' : 'i') + 'g'); };
    const has = (t, r) => { r.lastIndex = 0; return r.test(t); };
    const hits = all => { const r = re(); return r ? (all || a.cells()).filter(c => !(fq('sel').checked && sel && !sel.has(c.id)) && has(String(c.t == null ? '' : c.t), r)) : []; };
    const count = () => say(fq('q').value ? `${hits().length.toLocaleString()}칸에 있어요` : '');
    function open() {
      const p = a.picked(), many = p.length > 1;
      sel = many ? new Set(p) : null;
      fq('sel').checked = many;
      fq('sel').disabled = !many;
      if (!many && !fq('q').value) { const c = a.cells().find(x => x.id === a.cur()), t = c ? String(c.t || '') : ''; if (t && t.length < 40 && !/\n/.test(t)) fq('q').value = t; }
      box.hidden = false;
      const g = a.at();
      box.style.left = Math.max(8, g.right - 330 - 22) + 'px';
      box.style.top = Math.max(8, Math.min(g.top + 8, innerHeight - box.offsetHeight - 8)) + 'px';
      fq('q').focus();
      fq('q').select();
      count();
    }
    const close = () => { if (box.hidden) return; box.hidden = true; a.back(); };
    function next() {
      const all = a.cells(), h = hits(all);
      if (!h.length) { say('찾는 글이 없어요 (지금 보이는 줄 · 칸에서)'); return; }
      const pos = new Map(all.map((c, i) => [c.id, i])), at = pos.has(a.cur()) ? pos.get(a.cur()) : -1, n = h.find(c => pos.get(c.id) > at) || h[0];
      a.go(n);
      say(`${h.indexOf(n) + 1} / ${h.length.toLocaleString()}`);
    }
    function one(c) { const r = re(), t = r ? a.raw(c) : null; return t !== null && t !== undefined && has(String(t), r) ? {c, v: (r.lastIndex = 0, String(t).replace(r, () => fq('to').value))} : null; }
    function replace(every) {
      const why = a.why ? a.why() : '';
      if (why) { a.toast(why, true); return; }
      if (!every) {
        const c = a.cells().find(x => x.id === a.cur()), z = c ? one(c) : null;
        if (!z) { next(); return; }
        Promise.resolve(a.apply([z], '바꾸기')).then(() => { if (!box.hidden) { next(); fq('q').focus(); } });
        return;
      }
      const h = hits(), list = h.map(one).filter(Boolean);
      if (!list.length) { say(h.length ? `${h.length}칸에 있지만 고칠 수 없는 칸이에요` : '찾는 글이 없어요'); return; }
      Promise.resolve(a.apply(list, '모두 바꾸기', n => `'${a.short(fq('q').value)}'을(를) '${a.short(fq('to').value)}'(으)로 ${n}칸 바꿀까요?`)).then(r => { if (r) say(`${r.ok}칸을 바꿨어요${h.length > list.length ? ` · 못 고치는 칸 ${h.length - list.length}개는 그대로` : ''}`); });
    }
    box.addEventListener('click', e => { const b = e.target.closest('button[data-f]'); if (!b) return; if (b.dataset.f === 'x') close(); else if (b.dataset.f === 'next') next(); else replace(b.dataset.f === 'many'); });
    box.addEventListener('input', count);
    box.addEventListener('change', count);
    box.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && e.target.type === 'text') { e.preventDefault(); if (e.target.dataset.k === 'to') replace(false); else { next(); fq('q').focus(); } }
      else if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyH' || e.key === 'h')) e.preventDefault();
    });
    return {open, close, box};
  }

  window.OfficeGrid = function (ctx) {
    const {S, grid, $, narrow, hoverMQ, esc, fmt, norm, numOf, pad2, colName, tw, FONT, tabOf, curData, vstate, editCtx, roWhy, colValues, nameWarn, short, toast, toggleCheck, openDetail, closeDetail, showRow, hasVal, afterWrite, writeCell, rawOf, fmtBar, fmtApply, fmtOf, fmtBold, fmtClear} = ctx;
    const editText = x => (ctx.editText ? ctx.editText(x) : x.cell.t);
    const fmtCellOk = (r, p) => p >= 0 && p <= 255 && r > 0 && r < 1e6;   // 화면에만 있는 칸(식스샵프로 · 판매가)과 지난 상품 줄은 서식을 저장할 자리가 없다
    addCss();
    const mk = (cls, id, html) => { const el = document.createElement('div'); el.className = cls; el.id = id; el.hidden = true; if (html) el.innerHTML = html; document.body.appendChild(el); return el; };
    mk('cpick', 'cpick');
    const xhelp = mk('xhelp', 'xhelp');
    const fxBar = document.createElement('div');
    fxBar.className = 'fxbar';
    fxBar.id = 'fxBar';
    fxBar.hidden = true;
    fxBar.innerHTML = '<input class="fxn" id="fxName" autocomplete="off" spellcheck="false" aria-label="고른 칸" title="고른 칸 — 줄 번호나 칸 이름을 쓰고 Enter 하면 그리로 가요 (Ctrl+G)"><span class="fxi" aria-hidden="true">fx</span>'
      + '<textarea class="fxin" id="fxIn" rows="1" autocomplete="off" spellcheck="false" aria-label="고른 칸의 내용"></textarea><span class="fxs" id="fxStat"></span>';
    ctx.fxAfter.insertAdjacentElement('afterend', fxBar);
    const fxN = fxBar.querySelector('.fxn'), fxIn = fxBar.querySelector('.fxin'), fxStat = fxBar.querySelector('.fxs');

  const cellMode = () => !narrow.matches && hoverMQ.matches;
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');
  const modOf = e => e.ctrlKey || e.metaKey;
  const addKey = e => IS_MAC ? e.metaKey : e.ctrlKey;   // 맥에서 Ctrl+누르기는 오른쪽 누르기
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ck = (r, p) => r * 16384 + p;
  const CE = {el: null, x: null, orig: '', at: null, mode: '', src: 'cell', font: '', reject: false, pend: null, guard: 0};
  const cellTd = (r, p) => grid.querySelector(`tbody tr[data-r="${r}"] td[data-p="${p}"]`);
  const hasCell = () => !!(S.cell && S.cell.gid === S.cur);
  const ancOf = () => S.anc || S.cell;
  let ceTipEl = null, ceTipT = 0;
  function cellTip(r, p, text, err, ms) {
    const td = cellTd(r, p);
    if (!td || !text) return;
    if (!ceTipEl) { ceTipEl = document.createElement('div'); ceTipEl.className = 'cedit-tip'; document.body.appendChild(ceTipEl); }
    ceTipEl.textContent = text;
    ceTipEl.classList.toggle('err', !!err);
    ceTipEl.hidden = false;
    const rc = td.getBoundingClientRect(), w = ceTipEl.offsetWidth, h = ceTipEl.offsetHeight;
    let top = rc.bottom + 4;
    if (top + h > innerHeight - 8) top = rc.top - h - 4;
    ceTipEl.style.left = Math.max(8, Math.min(rc.left, innerWidth - w - 8)) + 'px';
    ceTipEl.style.top = top + 'px';
    clearTimeout(ceTipT);
    ceTipT = setTimeout(() => { if (ceTipEl) ceTipEl.hidden = true; }, ms || 2200);
  }
  const hideTip = () => { if (ceTipEl) ceTipEl.hidden = true; };

  /* 고른 것 계산 — 줄 · 열 번호 → 지금 보이는 차례 */
  function vIdx() {
    const vr = S.vr;
    if (vr && !vr.ri) { vr.ri = new Map(vr.list.map((x, i) => [x.r, i])); vr.ki = new Map(vr.cols.map((c, k) => [c.p, k])); }
    return vr || null;
  }
  const vAt = (i, k) => ({r: S.vr.list[i].r, p: S.vr.cols[k].p});
  function rectOf(a, b) {
    const vr = vIdx();
    if (!vr || !a || !b) return null;
    const i0 = vr.ri.get(a.r), i1 = vr.ri.get(b.r), k0 = vr.ki.get(a.p), k1 = vr.ki.get(b.p);
    if (i0 === undefined || i1 === undefined || k0 === undefined || k1 === undefined) return null;
    return {i0: Math.min(i0, i1), i1: Math.max(i0, i1), k0: Math.min(k0, k1), k1: Math.max(k0, k1)};
  }
  function selRects() {   // 고른 네모들 (지금 범위가 맨 뒤)
    if (!hasCell()) return [];
    const out = [];
    S.multi.forEach(m => { const t = rectOf(m.a, m.b); if (t) out.push(t); });
    const a = ancOf(), t = rectOf(a, S.cell2 || a) || rectOf(S.cell, S.cell);
    if (t) out.push(t);
    return out;
  }
  const curRect = () => { const rs = selRects(); return rs.length ? rs[rs.length - 1] : null; };
  const nOf = t => (t.i1 - t.i0 + 1) * (t.k1 - t.k0 + 1);
  function rngCells() {   // 고른 칸들 [{r, p}] — 범위가 없으면 고른 한 칸
    if (!hasCell()) return [];
    const vr = vIdx(), rs = selRects();
    if (!vr || !rs.length) return [{r: S.cell.r, p: S.cell.p}];
    const out = [], seen = rs.length > 1 ? new Set() : null;
    rs.forEach(t => {
      for (let i = t.i0; i <= t.i1; i++) for (let k = t.k0; k <= t.k1; k++) {
        const r = vr.list[i].r, p = vr.cols[k].p;
        if (seen) { const key = ck(r, p); if (seen.has(key)) continue; seen.add(key); }
        out.push({r, p});
      }
    });
    return out;
  }
  function inSel(r, p) {
    const vr = vIdx();
    if (!vr || !hasCell()) return false;
    const i = vr.ri.get(r), k = vr.ki.get(p);
    return selRects().some(t => i >= t.i0 && i <= t.i1 && k >= t.k0 && k <= t.k1);
  }
  function edgeMap(rects, map) {   // 칸마다 안쪽(1) · 위(2) · 아래(4) · 왼쪽(8) · 오른쪽(16) 테두리
    const vr = S.vr;
    rects.forEach(t => {
      for (let i = t.i0; i <= t.i1; i++) for (let k = t.k0; k <= t.k1; k++) {
        const key = ck(vr.list[i].r, vr.cols[k].p);
        map.set(key, (map.get(key) || 0) | 1 | (i === t.i0 ? 2 : 0) | (i === t.i1 ? 4 : 0) | (k === t.k0 ? 8 : 0) | (k === t.k1 ? 16 : 0));
      }
    });
    return map;
  }
  function calcRng() {
    const vr = vIdx(), rs = selRects();
    S.rng = S.ant = S.hr = S.hk = null;
    S.fh = 0;
    if (!vr) return;
    if (rs.length) {
      S.hr = new Set();
      S.hk = new Set();
      rs.forEach(t => { for (let i = t.i0; i <= t.i1; i++) S.hr.add(vr.list[i].r); for (let k = t.k0; k <= t.k1; k++) S.hk.add(vr.cols[k].p); });
      if (rs.length > 1 || nOf(rs[0]) > 1) S.rng = edgeMap(rs, new Map());
      if (rs.length === 1 && !S.paint && !CE.x) S.fh = ck(vr.list[rs[0].i1].r, vr.cols[rs[0].k1].p);
    }
    if (S.clip && S.clip.gid === S.cur) {
      const at = S.clip.rects.map(x => rectOf(x.a, x.b)).filter(Boolean);
      if (at.length) S.ant = edgeMap(at, new Map());
    }
  }
  function selCls(r, p) {
    const key = ck(r, p), b = S.rng && S.rng.get(key), a = S.ant && S.ant.get(key);
    let s = hasCell() && S.cell.r === r && S.cell.p === p ? ' csel' : '';
    if (b) s += ' crng' + (b & 2 ? ' rg-t' : '') + (b & 4 ? ' rg-b' : '') + (b & 8 ? ' rg-l' : '') + (b & 16 ? ' rg-r' : '');
    if (S.fh === key) s += ' fh';
    if (a) s += ' ant' + (a & 2 ? ' ant-t' : '') + (a & 4 ? ' ant-b' : '') + (a & 8 ? ' ant-l' : '') + (a & 16 ? ' ant-r' : '');
    if (S.fprev && S.fprev.has(key)) s += ' fprev';
    return s;
  }
  const SEL_RX = /(^|\s)(csel|crng|rg-[tblr]|fh|ant|ant-[tblr]|fprev)(?=\s|$)/g;
  function paintRng() {   // 고른 것 · 범위 표시 (그려 둔 칸만 — 새로 그리는 칸은 cellHtml 이 selCls 를 본다)
    calcRng();
    grid.querySelectorAll('tbody tr[data-r]').forEach(tr => {
      const r = +tr.dataset.r;
      for (const td of tr.children) {
        if (td.dataset.p !== undefined) {
          const nu = (td.className.replace(SEL_RX, '') + selCls(r, +td.dataset.p)).trim();
          if (nu !== td.className) td.className = nu;
        } else if (td.classList.contains('rn')) { const on = !!(S.hr && S.hr.has(r)); if (td.classList.contains('hl') !== on) td.classList.toggle('hl', on); }
      }
    });
    paintHeadSel();
    fmtBar();
  }
  function paintHeadSel() { grid.querySelectorAll('thead th[data-p]').forEach(th => { const on = !!(S.hk && S.hk.has(+th.dataset.p)); if (th.classList.contains('hl') !== on) th.classList.toggle('hl', on); }); }

  /* 고르기 */
  function setCell(r, p) {   // 고른 칸 하나 (r 없으면 고르기 없앰)
    S.cell = r == null ? null : {gid: S.cur, r, p};
    S.cell2 = S.anc = S.tabP = null;
    S.multi = [];
    paintRng();
    placeIdle();
  }
  function selectCell(r, p, opt) {
    opt = opt || {};
    hideTip();
    setCell(r, p);
    if (opt.tabP != null) S.tabP = opt.tabP;
    if (!opt.noScroll) revealCell(r, p);
    syncDetail(r);
    placeIdle();
  }
  function syncDetail(r) { if (S.sel && !$('detail').hidden && S.sel.r !== r) openDetail(r, false); }   // 상세 창이 열려 있으면 그 줄로
  function extendTo(r, p, opt) {   // 지금 범위의 끝을 여기로 (시작 칸은 그대로)
    const a = ancOf();
    S.cell2 = a.r === r && a.p === p ? null : {r, p};
    S.tabP = null;
    paintRng();
    if (opt && opt.reveal) {
      const t = curRect(), vr = S.vr;
      if (t && t.k1 - t.k0 + 1 === vr.cols.length && vr.cols.length > 1) showRow(r);          // 줄 전체를 고르는 중 — 옆으로는 안 넘김
      else if (t && t.i1 - t.i0 + 1 === vr.list.length && vr.list.length > 1) revealCell(r, p, true);   // 열 전체 — 위아래로는 안 넘김
      else revealCell(r, p);
    }
  }
  function keepRange() { if (hasCell()) S.multi.push({a: ancOf(), b: S.cell2 || ancOf()}); else S.multi = []; }   // Ctrl — 지금 범위를 남겨 두고
  function addCell(r, p) { keepRange(); S.cell = {gid: S.cur, r, p}; S.cell2 = S.anc = S.tabP = null; paintRng(); syncDetail(r); placeIdle(); }
  function dropCell(r, p) {   // Ctrl+누르기로 고른 칸 빼기 → 범위를 쪼갠다 (하나뿐이면 그대로)
    const vr = vIdx(), i = vr.ri.get(r), k = vr.ki.get(p), out = [];
    selRects().forEach(t => {
      if (i < t.i0 || i > t.i1 || k < t.k0 || k > t.k1) { out.push(t); return; }
      if (i > t.i0) out.push({i0: t.i0, i1: i - 1, k0: t.k0, k1: t.k1});
      if (i < t.i1) out.push({i0: i + 1, i1: t.i1, k0: t.k0, k1: t.k1});
      if (k > t.k0) out.push({i0: i, i1: i, k0: t.k0, k1: k - 1});
      if (k < t.k1) out.push({i0: i, i1: i, k0: k + 1, k1: t.k1});
    });
    if (!out.length) return;
    const z = out.pop(), a = vAt(z.i0, z.k0), b = vAt(z.i1, z.k1);
    S.multi = out.map(t => ({a: vAt(t.i0, t.k0), b: vAt(t.i1, t.k1)}));
    S.cell = {gid: S.cur, r: a.r, p: a.p};
    S.anc = S.tabP = null;
    S.cell2 = nOf(z) > 1 ? b : null;
    paintRng();
    placeIdle();
  }
  function pickRows(r, mode) {   // 줄 전체 — mode: '' 새로 · 'shift' 여기까지 · 'add' 더하기
    const vr = vIdx();
    if (!vr || !vr.cols.length) return;
    const p0 = vr.cols[0].p, p1 = vr.cols[vr.cols.length - 1].p;
    if (mode === 'shift' && hasCell()) { const a = ancOf(); S.anc = null; S.cell = {gid: S.cur, r: a.r, p: p0}; S.cell2 = {r, p: p1}; }
    else {
      if (mode === 'add') keepRange(); else S.multi = [];
      S.cell = {gid: S.cur, r, p: p0};
      S.anc = null;
      S.cell2 = vr.cols.length > 1 ? {r, p: p1} : null;
    }
    S.tabP = null;
    hideTip();
    paintRng();
    syncDetail(r);
    placeIdle();
  }
  function pickCols(p, mode) {   // 열 전체 (보이는 줄)
    const vr = vIdx();
    if (!vr || !vr.list.length) return;
    const r0 = vr.list[0].r, r1 = vr.list[vr.list.length - 1].r;
    if (mode === 'shift' && hasCell()) { const a = ancOf(); S.anc = null; S.cell = {gid: S.cur, r: r0, p: a.p}; S.cell2 = {r: r1, p}; }
    else {
      if (mode === 'add') keepRange(); else S.multi = [];
      S.cell = {gid: S.cur, r: r0, p};
      S.anc = null;
      S.cell2 = vr.list.length > 1 ? {r: r1, p} : null;
    }
    S.tabP = null;
    hideTip();
    paintRng();
    placeIdle();
  }
  function pickAll() {
    const vr = vIdx();
    if (!vr || !vr.list.length || !vr.cols.length) return;
    const a = vAt(0, 0), b = vAt(vr.list.length - 1, vr.cols.length - 1);
    if (!hasCell() || vr.ri.get(S.cell.r) === undefined || vr.ki.get(S.cell.p) === undefined) S.cell = {gid: S.cur, r: a.r, p: a.p};
    S.multi = [];
    S.anc = a;
    S.cell2 = b;
    S.tabP = null;
    paintRng();
    placeIdle();
  }
  // 고른 칸이 보이게 (아래 · 위는 showRow, 옆은 고정 칸을 피해서)
  function revealCell(r, p, colOnly) {
    if (!colOnly) showRow(r);
    const td = colOnly ? grid.querySelector(`thead th[data-p="${p}"]`) : cellTd(r, p);
    if (!td || td.classList.contains('sk') || td.classList.contains('skr')) return;
    const g = grid.getBoundingClientRect(), rc = td.getBoundingClientRect();
    const L = [...grid.querySelectorAll('thead th.sk')].reduce((m, th) => Math.max(m, th.getBoundingClientRect().right), g.left);
    const R = [...grid.querySelectorAll('thead th.skr')].reduce((m, th) => Math.min(m, th.getBoundingClientRect().left), g.left + grid.clientWidth);
    if (rc.left < L) grid.scrollLeft -= L - rc.left + 2;
    else if (rc.right > R) grid.scrollLeft += Math.min(rc.right - R + 2, rc.left - L);
  }
  // 옆 칸 — 위 · 아래 = 보이는 줄 순서(정렬 · 걸러보기 그대로), 옆 = 보이는 칸 순서. 끝이면 null
  function nextCell(dr, dc) {
    const vr = vIdx(), c = S.cell;
    if (!vr || !hasCell()) return null;
    const i = vr.ri.get(c.r), k = vr.ki.get(c.p);
    if (i === undefined || k === undefined) return null;
    const ni = clamp(i + dr, 0, vr.list.length - 1), nk = clamp(k + dc, 0, vr.cols.length - 1);
    return ni === i && nk === k ? null : vAt(ni, nk);
  }
  function moveCell(dr, dc) {
    const n = nextCell(dr, dc);
    if (n) selectCell(n.r, n.p);
    else if (hasCell()) selectCell(S.cell.r, S.cell.p);
  }
  function extendRng(dr, dc, jump) {
    const vr = vIdx();
    if (!vr || !hasCell()) return;
    const base = S.cell2 || ancOf(), i = vr.ri.get(base.r), k = vr.ki.get(base.p);
    if (i === undefined || k === undefined) return;
    const t = jump ? jumpTo(i, k, dr, dc) : {i: clamp(i + dr, 0, vr.list.length - 1), k: clamp(k + dc, 0, vr.cols.length - 1)};
    const a = vAt(t.i, t.k);
    extendTo(a.r, a.p, {reveal: true});
  }
  function cellBlank(row, col) {
    const v = ctx.virtual && ctx.virtual(row, col);   // 그 화면에만 있는 칸 (ERP 식스샵프로 · 판매가 · 단가)
    return v !== undefined && v !== null && v !== false ? v === '' : !hasVal(row.byP[col.p]);
  }
  function jumpTo(i, k, dr, dc) {   // Ctrl+화살표 — 글이 이어진 끝까지, 빈칸이면 다음 글까지, 없으면 표 끝까지 (엑셀과 같음)
    const vr = S.vr, n = dr ? vr.list.length : vr.cols.length, d = dr || dc;
    const blank = x => dr ? cellBlank(vr.list[x], vr.cols[k]) : cellBlank(vr.list[i], vr.cols[x]);
    const ok = x => x >= 0 && x < n;
    let x = dr ? i : k;
    if (!ok(x + d)) return {i, k};
    if (!blank(x) && !blank(x + d)) { while (ok(x + d) && !blank(x + d)) x += d; }
    else { x += d; while (ok(x) && blank(x)) x += d; if (!ok(x)) x -= d; }
    return dr ? {i: x, k} : {i, k: x};
  }
  function jumpCell(dr, dc) {
    const vr = vIdx();
    if (!vr || !hasCell()) return;
    const i = vr.ri.get(S.cell.r), k = vr.ki.get(S.cell.p);
    if (i === undefined || k === undefined) return;
    const t = jumpTo(i, k, dr, dc), a = vAt(t.i, t.k);
    selectCell(a.r, a.p);
  }
  function pageRows() {
    const th = grid.querySelector('thead'), tf = grid.querySelector('tfoot');
    return Math.max(1, Math.floor((grid.clientHeight - (th ? th.offsetHeight : 0) - (tf ? tf.offsetHeight : 0)) / (S.vr ? S.vr.rowH : 34)) - 1);
  }
  function cycleCell(dr, dc) {   // 범위를 고른 채 Enter · Tab = 그 안에서만 돎 (엑셀) → 했으면 true
    const rs = selRects(), vr = S.vr;
    if (!rs.length || (rs.length === 1 && nOf(rs[0]) === 1)) return false;
    const order = [];
    rs.forEach(t => {
      if (dr) for (let k = t.k0; k <= t.k1; k++) for (let i = t.i0; i <= t.i1; i++) order.push(vAt(i, k));
      else for (let i = t.i0; i <= t.i1; i++) for (let k = t.k0; k <= t.k1; k++) order.push(vAt(i, k));
    });
    const at = order.findIndex(x => x.r === S.cell.r && x.p === S.cell.p), n = order[((at < 0 ? 0 : at + (dr || dc)) + order.length) % order.length];
    S.anc = Object.assign({}, ancOf());
    S.cell = {gid: S.cur, r: n.r, p: n.p};
    hideTip();
    paintRng();
    revealCell(n.r, n.p);
    syncDetail(n.r);
    placeIdle();
    return true;
  }
  function enterMove(up) {   // Enter — Tab 으로 옆으로 왔으면 처음 열로 돌아가 다음 줄 (엑셀)
    if (cycleCell(up ? -1 : 1, 0)) return;
    const tp = S.tabP, vr = vIdx();
    if (!up && tp != null && vr && vr.ki.get(tp) !== undefined) {
      const n = nextCell(1, 0);
      selectCell(n ? n.r : S.cell.r, tp);
    } else moveCell(up ? -1 : 1, 0);
  }
  function tabMove(back) {
    if (cycleCell(0, back ? -1 : 1)) return;
    const start = S.tabP != null ? S.tabP : S.cell.p, n = nextCell(0, back ? -1 : 1);
    if (n) selectCell(n.r, n.p, {tabP: start}); else selectCell(S.cell.r, S.cell.p, {tabP: start});
  }
  // 범위 끝으로 옮기기 (ext = Shift — 범위 늘리기)
  function goTo(i, k, ext) {
    const vr = vIdx();
    if (!vr || !vr.list.length) return;
    const a = vAt(clamp(i, 0, vr.list.length - 1), clamp(k, 0, vr.cols.length - 1));
    if (ext) extendTo(a.r, a.p, {reveal: true}); else selectCell(a.r, a.p);
  }

  /* 자판 — 칸을 고르기만 했을 때 (고치는 중은 editKey) */
  const keyOf = e => /^Key[A-Z]$/.test(e.code || '') ? e.code.slice(3).toLowerCase() : String(e.key || '').toLowerCase();   // 한글 상태에서도 Ctrl+C 같은 단축키
  function gridKey(e) {
    const k = e.key, vr = vIdx();
    const eat = () => { e.preventDefault(); };
    if (!vr) return;
    if (!hasCell()) {   // 고른 칸이 없을 때 — 되돌리기 · 전부 고르기는 되고, 화살표면 맨 앞 칸부터
      const k0 = modOf(e) && !e.altKey ? keyOf(e) : '';
      if (k0 === 'z' || k0 === 'y') { eat(); if (k0 === 'y' || e.shiftKey) redo(); else undo(); }
      else if (k0 === 'a') { eat(); pickAll(); }
      else if (k0 === 'h') { eat(); openFind(); }
      else if (!k0 && /^Arrow/.test(k) && !e.altKey && vr.list.length) { eat(); goTo(0, 0); }
      return;
    }
    const base = e.shiftKey ? (S.cell2 || ancOf()) : S.cell;
    let bi = vr.ri.get(base.r), bk = vr.ki.get(base.p);
    const here = vr.ri.get(S.cell.r) !== undefined && vr.ki.get(S.cell.p) !== undefined;
    if (!here && /^(Arrow|Home|End|Page|Tab|Enter)/.test(k)) { eat(); goTo(0, 0); return; }   // 걸러보기로 사라진 칸 — 맨 앞부터
    if (bi === undefined) bi = 0;
    if (bk === undefined) bk = 0;
    const nR = vr.list.length, nC = vr.cols.length;
    if (modOf(e) && !e.altKey) {
      const kk = keyOf(e);
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowRight') {
        eat();
        const dr = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0, dc = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
        if (e.shiftKey) extendRng(dr, dc, true); else jumpCell(dr, dc);
        return;
      }
      if (k === 'Home') { eat(); goTo(0, 0, e.shiftKey); return; }
      if (k === 'End') { eat(); goTo(nR - 1, nC - 1, e.shiftKey); return; }
      if (k === ' ') { eat(); pickCols(S.cell.p, ''); return; }
      if (k === 'Backspace') { eat(); revealCell(S.cell.r, S.cell.p); return; }
      if (kk === 'z') { eat(); if (e.shiftKey) redo(); else undo(); return; }
      if (kk === 'y') { eat(); redo(); return; }
      if (kk === 'a' && !e.shiftKey) { eat(); pickAll(); return; }
      if (kk === 'd' && !e.shiftKey) { eat(); fillDown(); return; }
      if (kk === 'b' && !e.shiftKey) { eat(); fmtBold(); return; }
      if (kk === 's' && !e.shiftKey) { eat(); toast('고치면 바로 저장돼요 — 따로 저장하지 않아도 됩니다'); return; }
      if (kk === 'v' && e.shiftKey) {   // 값만 붙여넣기 — 브라우저가 paste 를 안 보내면 클립보드를 직접 읽는다
        const at = S.pasteVals = Date.now();
        setTimeout(() => { if (S.pasteVals === at && gridKeys() && navigator.clipboard && navigator.clipboard.readText) { S.pasteVals = 0; navigator.clipboard.readText().then(t => pasteText(t, {vals: true}), () => {}); } }, 160);
        return;
      }
      if (k === '\\') { eat(); fmtClear(); return; }   // 서식 지우기 (구글시트와 같은 키)
      if (k === ';' || e.code === 'Semicolon') { eat(); const d = new Date(); startEdit('enter', {text: e.shiftKey ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`}); return; }   // 오늘 날짜 · Shift 지금 시각
      if (k === 'Enter') { eat(); return; }
      if (xlKey(e, kk)) { eat(); return; }
      return;   // Ctrl+C · X · V 는 copy · cut · paste 가 받는다, 나머지는 브라우저 그대로
    }
    if (e.altKey) {
      if (k === 'ArrowDown') {   // 같은 열에 쓴 값에서 고르기 (엑셀 Alt+↓)
        const x = editCtx(S.cur, S.cell.r, S.cell.p);
        if (x && !roWhy(x) && !x.check && colValues(x).length) { eat(); e.stopPropagation(); if (startEdit('edit')) openPick(true); }
      } else if (k === 'PageDown' || k === 'PageUp') {
        eat();
        const n = Math.max(1, Math.round(nC / 3));
        goTo(bi, bk + (k === 'PageDown' ? n : -n), e.shiftKey);
      } else if ((k === '=' || e.code === 'Equal') && ctx.formulas) { eat(); autoSum(); }   // 자동 합계
      return;
    }
    switch (k) {
      case 'ArrowDown': case 'ArrowUp': case 'ArrowLeft': case 'ArrowRight': {
        eat();
        const dr = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0, dc = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
        if (e.shiftKey) extendRng(dr, dc); else moveCell(dr, dc);
        return;
      }
      case 'Home': eat(); goTo(bi, 0, e.shiftKey); return;
      case 'End': { eat(); let z = nC - 1; while (z > 0 && cellBlank(vr.list[bi], vr.cols[z])) z--; goTo(bi, z, e.shiftKey); return; }
      case 'PageDown': eat(); goTo(bi + pageRows(), bk, e.shiftKey); return;
      case 'PageUp': eat(); goTo(bi - pageRows(), bk, e.shiftKey); return;
      case 'Tab': eat(); tabMove(e.shiftKey); return;
      case 'Enter': eat(); enterMove(e.shiftKey); return;
      case 'F2': eat(); if (e.shiftKey) editNote(); else startEdit('edit'); return;   // Shift+F2 = 메모
      case 'Delete': eat(); clearSel(); return;
      case 'Backspace': eat(); startEdit('enter', {text: ''}); return;   // 비우고 고치기 (엑셀)
      case 'Escape': if (S.clip) { eat(); e.stopPropagation(); S.clip = null; paintRng(); } hideTip(); return;   // 복사 점선 없애기
      case 'ContextMenu': eat(); ctxAtCell(); return;
      case 'F10': if (e.shiftKey) { eat(); ctxAtCell(); } return;
      case ' ': {
        eat();
        if (e.shiftKey) { pickRows(S.cell.r, ''); return; }
        const x = editCtx(S.cur, S.cell.r, S.cell.p);
        if (x && x.check) { const why = roWhy(x); if (why) cellTip(S.cell.r, S.cell.p, why, true); else toggleCheck(x); }
        return;
      }
    }
    // 글자는 입력 상자가 그대로 받는다 (input · compositionstart → startEdit)
  }
  function ctxAtCell() {
    const td = cellTd(S.cell.r, S.cell.p);
    if (!td) return;
    const rc = td.getBoundingClientRect();
    if (ctx.openMenu) ctx.openMenu(rc.left + 12, rc.bottom - 4, S.cell.r);
  }

  /* 칸 입력 상자 */
  const IDLE = ' ';   // 고르기만 했을 때 상자에 넣고 골라 두는 빈칸 하나 — 치면 이 빈칸이 바뀌고, 어느 브라우저든 복사 · 잘라내기가 나간다
  function idleReset() {
    const el = CE.el;
    if (!el || CE.x) return;
    el.value = IDLE;
    if (document.activeElement === el) { try { el.setSelectionRange(0, IDLE.length); } catch (e) { /* noop */ } }
  }
  function ceEl() {
    if (CE.el) return CE.el;
    const el = document.createElement('textarea');
    el.className = 'cedit idle';
    el.rows = 1;
    el.spellcheck = false;
    el.tabIndex = -1;
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('aria-label', '고른 칸');
    el.value = IDLE;
    document.body.appendChild(el);
    el.addEventListener('keydown', e => {
      if (e.isComposing || (e.keyCode === 229 && !modOf(e))) { if (CE.x) composeKey(e); return; }   // 한글 조합 중
      if (Date.now() < CE.guard && /^(Enter|Tab|Arrow\w+)$/.test(e.key)) { e.preventDefault(); CE.guard = 0; return; }   // 조합을 끝낸 그 키가 한 번 더 온 것
      if (CE.x) editKey(e, el); else gridKey(e);
    });
    el.addEventListener('beforeinput', e => { if (/^insert(LineBreak|Paragraph)$/.test(e.inputType || '')) e.preventDefault(); });   // 줄바꿈은 Alt+Enter 만
    el.addEventListener('input', e => {
      if (CE.x) { if (CE.src === 'cell') { CE.lastRef = null; ceReveal(); ceSize(); fxIn.value = el.value; autoDone(e); openPick(false); if (ctx.onEdit) ctx.onEdit(el.value); } return; }
      if (CE.reject) { if (!e.isComposing) { CE.reject = false; idleReset(); } return; }
      if (hasCell() && cellMode() && startEdit('enter', {keep: true})) { autoDone(e); return; }
      idleReset();
    });
    el.addEventListener('compositionstart', () => {
      if (CE.x) return;
      if (!(hasCell() && cellMode() && startEdit('enter', {keep: true}))) CE.reject = true;   // 못 고치는 칸 — 조합이 끝나면 버림
    });
    el.addEventListener('compositionend', () => {
      if (CE.reject) { CE.reject = false; setTimeout(idleReset, 0); return; }
      if (CE.x) { ceSize(); fxIn.value = el.value; }
      const pk = CE.pend;
      CE.pend = null;
      if (pk && Date.now() - pk.at < 500) setTimeout(() => { if (CE.x && CE.x === pk.x) { CE.guard = Date.now() + 150; pk.run(); } }, 0);
    });
    el.addEventListener('blur', () => {
      if (!CE.x || !document.hasFocus()) return;   // 다른 창으로 갔다 오면 그대로 이어서
      setTimeout(() => { const a = document.activeElement; if (CE.x && a !== CE.el && a !== fxIn) commitCell(0, 0, true); }, 0);
    });
    return (CE.el = el);
  }
  // 한글을 조합하다 누른 Enter · Tab · 화살표 — 조합이 끝나면 그 키대로 (엑셀처럼 한 번에)
  function composeKey(e) {
    const c = e.code, x = CE.x;
    if (e.altKey) return;
    const set = run => { CE.pend = {x, at: Date.now(), run}; };
    if (c === 'Enter' || c === 'NumpadEnter') { const sh = e.shiftKey, all = modOf(e); set(() => all ? commitAll() : commitCell(sh ? -1 : 1, 0)); }
    else if (c === 'Tab') { e.preventDefault(); const sh = e.shiftKey; set(() => commitCell(0, sh ? -1 : 1)); }
    else if (CE.mode === 'enter' && CE.src === 'cell' && !e.shiftKey && /^Arrow/.test(c)) set(() => commitCell(c === 'ArrowDown' ? 1 : c === 'ArrowUp' ? -1 : 0, c === 'ArrowRight' ? 1 : c === 'ArrowLeft' ? -1 : 0));
  }
  function focusCells() {   // 고른 칸에 자판을 (고른 칸이 없으면 표에)
    if (!cellMode() || !hasCell()) { if (document.activeElement !== grid) grid.focus({preventScroll: true}); return; }
    const el = ceEl();
    placeIdle();
    if (document.activeElement !== el) el.focus({preventScroll: true});
    idleReset();
  }
  function placeIdle() {   // 고르기만 했을 때 — 안 보이는 상자를 그 칸 위에 (한글 조합 창이 그 자리에 뜨게)
    const el = CE.el;
    if (!el || CE.x) return;
    const td = hasCell() && cellMode() ? cellTd(S.cell.r, S.cell.p) : null, g = grid.getBoundingClientRect(), rc = td ? td.getBoundingClientRect() : g;
    el.style.left = clamp(rc.left, g.left, Math.max(g.left, g.right - 20)) + 'px';
    el.style.top = clamp(rc.top, g.top, Math.max(g.top, g.bottom - 20)) + 'px';
    el.style.width = Math.max(20, td ? rc.width : 20) + 'px';
    el.style.height = Math.max(16, td ? rc.height : 16) + 'px';
  }
  /* 고치기 시작 — mode 'enter'(바로 쳐서 새로 쓰기 · 화살표 = 저장하고 옮김) · 'edit'(F2 · 두 번 누르기 = 글자 사이 · 화살표 = 글자 옮김). F2 로 서로 바꿈 (엑셀과 같음)
     opt: text 처음 글 · keep 상자에 이미 친 글 그대로 · src 'fx' 위 입력줄에서 · x 누른 자리(글자 사이) */
  function startEdit(mode, opt) {
    opt = opt || {};
    if (!hasCell() || !cellMode()) return false;
    const c = S.cell, x = editCtx(S.cur, c.r, c.p), why = roWhy(x);
    revealCell(c.r, c.p);
    if (why) { cellTip(c.r, c.p, why, true, 3200); return false; }
    if (x.check) return false;
    const td = cellTd(c.r, c.p);
    if (!td) return false;
    const el = ceEl();
    hideTip();
    if (S.clip) S.clip = null;   // 고치기 시작하면 복사 점선은 사라진다 (엑셀)
    CE.x = x;
    CE.orig = editText(x);
    CE.lastRef = null;
    CE.ptr = null;
    CE.at = {r: c.r, p: c.p};
    CE.mode = mode;
    CE.src = opt.src || 'cell';
    if (!opt.keep) el.value = opt.text != null ? opt.text : CE.orig;
    const cs = getComputedStyle(td);
    CE.font = `${cs.fontWeight} ${cs.fontSize} ${FONT}`;
    el.style.fontWeight = cs.fontWeight;
    el.style.fontSize = cs.fontSize;
    el.style.color = cs.color;
    const bg = cs.backgroundColor;
    el.style.background = !bg || bg === 'transparent' || /,\s*0\)$/.test(bg) ? '#fff' : bg;
    el.classList.remove('idle');
    paintRng();   // 손잡이 · 점선 걷기
    placeCell(td);
    if (CE.src === 'cell') {
      if (document.activeElement !== el) el.focus({preventScroll: true});
      if (!opt.keep) { const n = opt.x != null ? caretAt(td, opt.x) : el.value.length; el.setSelectionRange(n, n); }
    }
    if (document.activeElement !== fxIn) fxIn.value = el.value;
    if (ctx.onEdit) ctx.onEdit(el.value);
    const warn = nameWarn(x), tip = ctx.editTip ? ctx.editTip(x, el.value) : '';
    if (warn) cellTip(x.row, x.p, warn, true, 4500);
    else if (tip) cellTip(x.row, x.p, tip, false, 4000);
    return true;
  }
  function caretAt(td, x) {   // 두 번 누른 자리의 글자 사이 (한 줄 칸)
    const v = CE.el.value;
    if (/\n/.test(v)) return v.length;
    const left = td.getBoundingClientRect().left + (parseFloat(getComputedStyle(td).paddingLeft) || 8);
    let best = v.length, bd = 1e9;
    for (let i = 0; i <= v.length && i <= 400; i++) { const d = Math.abs(left + tw(v.slice(0, i), CE.font) - x); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function ceReveal() {   // 치는 중에 칸이 화면 밖이면 다시 보이게
    if (!CE.x || !CE.el.classList.contains('away')) return;
    revealCell(CE.at.r, CE.at.p);
    placeCell(cellTd(CE.at.r, CE.at.p));
  }
  function placeCell(td) {
    const el = CE.el;
    if (!el || !CE.x) return;
    let away = !td;
    if (td) {
      const rc = td.getBoundingClientRect(), w = viewBox();
      away = rc.bottom < w.t + 4 || rc.top > w.b - 4 || rc.right < w.l + 10 || rc.left > w.r - 10;
      if (!away) { el.style.top = (rc.top - 1) + 'px'; ceSize(td); }
    }
    el.classList.toggle('away', away);
  }
  function ceSize(td) {   // 칸에 딱 맞게 — 글이 길어지면 오른쪽으로, 더 길면 아래로 (엑셀)
    const el = CE.el;
    td = td || (CE.at && cellTd(CE.at.r, CE.at.p));
    if (!el || !CE.x || !td) return;
    const rc = td.getBoundingClientRect(), g = grid.getBoundingClientRect(), pl = parseFloat(getComputedStyle(td).paddingLeft) || 8;
    const lines = String(el.value).split('\n'), longest = Math.max(...lines.map(s => tw(s, CE.font)), 0);
    const maxW = Math.max(rc.width + 1, Math.min(g.left + grid.clientWidth - rc.left - 2, 620)), w = Math.min(maxW, Math.max(rc.width + 1, longest + pl * 2 + 8));
    const h0 = rc.height + 1;
    el.style.left = (rc.left - 1) + 'px';
    el.style.width = w + 'px';
    el.style.paddingLeft = Math.max(0, pl - 1) + 'px';
    el.style.paddingRight = '4px';
    if (lines.length === 1 && longest + pl * 2 + 4 <= w) {
      const v = Math.max(0, (h0 - 4 - 17) / 2);
      el.style.paddingTop = v + 'px';
      el.style.paddingBottom = '0px';
      el.style.height = h0 + 'px';
      el.style.overflowY = 'hidden';
      return;
    }
    el.style.paddingTop = el.style.paddingBottom = '5px';
    el.style.height = '0px';
    const need = el.scrollHeight + 4, room = Math.max(h0, Math.min(320, innerHeight - rc.top - 10)), h = Math.max(h0, Math.min(need, room));
    el.style.height = h + 'px';
    el.style.overflowY = need > room ? 'auto' : 'hidden';
  }
  function closeCell(silent) {   // 고치기 끝 (저장은 commitCell)
    if (!CE.x) return;
    const el = CE.el, fx = document.activeElement === fxIn;
    CE.x = CE.at = CE.pend = null;
    CE.mode = '';
    CE.src = 'cell';
    CE.lastRef = CE.ptr = null;
    S.fprev = null;   // 함수에 넣던 칸 표시 걷기
    closePick();
    hideTip();
    if (ctx.onEdit) ctx.onEdit('');
    el.classList.add('idle');
    el.classList.remove('away');
    el.style.padding = '';
    el.style.background = '';
    if (!silent || fx) focusCells(); else idleReset();
    paintRng();
  }
  const ceVal = () => String(CE.el.value).replace(/\r\n?/g, '\n');
  // 고친 칸 저장 (값이 그대로면 그냥 닫음) → dr · dc 쪽 칸으로 (범위를 골라 뒀으면 그 안에서)
  function commitCell(dr, dc, fromBlur) {
    const x = CE.x;
    if (!x) return;
    let v = ceVal();
    const old = CE.orig, tabP = S.tabP, start = tabP != null ? tabP : x.p;
    if (v !== old && ctx.calcEntry) {   // '=120-30' 처럼 적으면 계산한 값으로 (함수를 안 쓰는 화면)
      const c = OfficeGrid.calc(v);
      if (c === false) {
        if (fromBlur) { toast('이 표에는 함수 말고 숫자 계산만 넣을 수 있어요 (예: =120-30) — 칸은 그대로 뒀어요', true); closeCell(true); return false; }
        cellTip(x.row, x.p, '이 표에는 함수 말고 숫자 계산만 돼요 (예: =120-30)', true, 4000);
        return false;
      }
      if (c !== null) v = c;
    }
    const many = selRects().reduce((n, t) => n + nOf(t), 0) > 1;
    const n = many || !(dr || dc) ? null : nextCell(dr, dc);   // 옮길 칸은 저장하기 전 화면 기준 (저장하면 정렬 · 걸러보기가 바뀔 수 있어서)
    closeCell(fromBlur);
    if (v !== old) {
      S.stick.add(x.row);   // 걸러 보는 중이어도 고친 줄은 그대로 보이게
      afterWrite(x, v, old, writeCell(x, v, old, old), () => cellTd(x.row, x.p)).catch(() => {});
    }
    if (!(dr || dc)) return;
    if (many) { cycleCell(dr, dc); return; }
    if (dc) { if (n) selectCell(n.r, n.p, {tabP: start}); }
    else if (dr > 0 && tabP != null) selectCell(n ? n.r : x.row, tabP);   // Tab 으로 왔으면 처음 열로 (엑셀)
    else if (n) selectCell(n.r, n.p);
  }
  function commitAll() {   // Ctrl+Enter — 고른 칸 전부에 같은 값 (엑셀)
    let v = ceVal();
    const cs = rngCells();
    if (cs.length <= 1) { commitCell(0, 0); return; }
    if (ctx.calcEntry) { const c = OfficeGrid.calc(v); if (c === false) { cellTip(CE.x.row, CE.x.p, '이 표에는 함수 말고 숫자 계산만 돼요 (예: =120-30)', true, 4000); return; } if (c !== null) v = c; }
    const at = {r: CE.x.row, p: CE.x.p};
    closeCell();
    applyCells(cs.map(c => ({r: c.r, p: c.p, v: ctx.formulas && /^=/.test(v) ? ctx.shiftFx(v, c.r - at.r, c.p - at.p) : v})), '한꺼번에 넣기', {ask: n => `고른 칸 ${n}개에 '${short(v)}'을(를) 넣을까요?`});
  }
  function cancelEdit() { closeCell(); }
  function newLine(el) {   // 칸 안 줄바꿈 (Alt+Enter)
    const a = el.selectionStart, b = el.selectionEnd;
    el.value = el.value.slice(0, a) + '\n' + el.value.slice(b);
    el.setSelectionRange(a + 1, a + 1);
    if (el === fxIn) CE.el.value = el.value; else fxIn.value = el.value;
    ceSize();
  }
  function editKey(e, el) {   // 고치는 중 (칸 · 위 입력줄 공통)
    const k = e.key, mod = modOf(e);
    if (PK.open && pickKey(e)) return;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(); return; }
    if (k === 'Enter' && (e.altKey || (IS_MAC && e.ctrlKey && !e.metaKey))) { e.preventDefault(); newLine(el); return; }   // 맥 엑셀은 Ctrl+Option+Enter 도
    if (k === 'Enter' && mod) { e.preventDefault(); commitAll(); return; }
    if (k === 'Enter') { e.preventDefault(); commitCell(e.shiftKey ? -1 : 1, 0); return; }
    if (k === 'Tab') { e.preventDefault(); commitCell(0, e.shiftKey ? -1 : 1); return; }
    if (k === 'F2') { e.preventDefault(); CE.mode = CE.mode === 'edit' ? 'enter' : 'edit'; return; }
    if (k === 'F4' && ctx.formulas && /^=/.test(el.value)) { e.preventDefault(); toggleAbs(el); return; }   // 주소 $ 고정 (엑셀)
    if (ctx.formulas && /^Arrow/.test(k) && !mod && !e.altKey && CE.mode === 'enter' && pointKey(e, el)) return;   // = 를 쓰다가 화살표 = 칸 주소
    if (k === 'ArrowDown' && e.altKey) { e.preventDefault(); e.stopPropagation(); openPick(true); return; }
    if (mod && keyOf(e) === 's' && !e.shiftKey) { e.preventDefault(); commitCell(0, 0); return; }
    if (el === CE.el && CE.mode === 'enter' && !e.shiftKey && !mod && !e.altKey && /^(Arrow|Page)/.test(k)) {
      e.preventDefault();
      if (/^Page/.test(k)) { commitCell(0, 0); gridKey(e); return; }
      commitCell(k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0, k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0);
    }
  }
  // 치는 동안 위 · 아래로 이어진 칸에 쓴 글이 딱 하나 맞으면 나머지를 채워 보여 줌 (엑셀 자동 완성 — 이어서 치면 바뀌고, Delete 로 지움).
  // 엑셀처럼 빈칸에서 끊고, 숫자 · 여러 줄 글은 안 함 (드문드문 적는 메모 칸에서 엉뚱한 글이 채워지지 않게)
  function adjTexts(x) {
    const vr = vIdx(), i = vr ? vr.ri.get(x.row) : undefined, k = vr ? vr.ki.get(x.p) : undefined, out = new Set();
    if (i === undefined || k === undefined || x.col.type !== 'text') return [];
    [-1, 1].forEach(d => {
      for (let j = i + d; j >= 0 && j < vr.list.length && !cellBlank(vr.list[j], vr.cols[k]); j += d) {
        const t = cellRaw(vr.list[j], vr.cols[k]).trim();
        if (t && !/\n/.test(t) && numOf(t) === null && !/^⚠/.test(t)) out.add(t);
      }
    });
    return [...out];
  }
  function autoDone(e) {
    const el = CE.el, x = CE.x;
    if (!x || CE.mode !== 'enter' || !e || e.isComposing || e.inputType !== 'insertText') return;
    const v = el.value;
    if (!v.trim() || /\n/.test(v) || /^=/.test(v) || el.selectionStart !== v.length) return;
    const hit = adjTexts(x).filter(t => t.length > v.length && t.toLowerCase().startsWith(v.toLowerCase()));
    if (hit.length !== 1) return;
    el.value = v + hit[0].slice(v.length);
    el.setSelectionRange(v.length, el.value.length);
    fxIn.value = el.value;
    ceSize();
  }
  /* 같은 열에 쓴 값 목록 — 치는 동안 비슷한 값(누르면 넣음), Alt+↓ = 전부 (↑↓ · Enter) */
  const PK = {el: $('cpick'), open: false, kb: false, list: [], i: -1};
  function closePick() { if (!PK.open) return; PK.open = PK.kb = false; PK.el.hidden = true; }
  function openPick(kb) {
    const x = CE.x;
    if (!x) return;
    if (PK.kb && !kb) kb = false;
    const q = ceVal().trim().toLowerCase(), all = /^=/.test(q) ? [] : colValues(x);
    const list = kb ? all : q ? all.filter(t => t.toLowerCase().includes(q) && t.toLowerCase() !== q).slice(0, 8) : [];
    if (!list.length) { closePick(); if (kb) cellTip(x.row, x.p, '이 열은 고를 값이 많거나 없어서 목록이 없어요'); return; }
    PK.open = true;
    PK.kb = !!kb;
    PK.list = list;
    PK.i = kb ? Math.max(0, list.findIndex(t => t.toLowerCase() === q)) : -1;
    PK.el.innerHTML = list.map((t, i) => `<div role="option" data-i="${i}"${i === PK.i ? ' class="on"' : ''}>${esc(t)}</div>`).join('');
    PK.el.hidden = false;
    const rc = CE.el.getBoundingClientRect(), h = PK.el.offsetHeight;
    PK.el.style.minWidth = Math.min(340, rc.width) + 'px';
    PK.el.style.left = Math.max(8, Math.min(rc.left, innerWidth - PK.el.offsetWidth - 8)) + 'px';
    PK.el.style.top = (rc.bottom + 2 + h > innerHeight - 8 ? Math.max(8, rc.top - h - 2) : rc.bottom + 2) + 'px';
    const on = PK.el.querySelector('.on');
    if (on) on.scrollIntoView({block: 'nearest'});
    hideTip();
  }
  function takePick(i, dr) {
    const t = PK.list[i];
    closePick();
    if (t === undefined || !CE.x) return;
    CE.el.value = t;
    commitCell(dr || 0, 0);
    focusCells();
  }
  function pickKey(e) {   // 목록이 열려 있을 때 (Alt+↓ 로 연 것만 화살표를 받는다 — 치다가 뜬 목록은 엑셀처럼 화살표 = 저장하고 옮김)
    if (e.key === 'Escape') { closePick(); if (!PK.kb) return false; e.preventDefault(); e.stopPropagation(); return true; }
    if (!PK.kb) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      PK.i = (PK.i + (e.key === 'ArrowDown' ? 1 : -1) + PK.list.length) % PK.list.length;
      PK.el.querySelectorAll('div').forEach((d, i) => d.classList.toggle('on', i === PK.i));
      const on = PK.el.querySelector('.on');
      if (on) on.scrollIntoView({block: 'nearest'});
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); takePick(PK.i, 0); return true; }
    return false;
  }
  PK.el.addEventListener('mousedown', e => { e.preventDefault(); const d = e.target.closest('div[data-i]'); if (d) takePick(+d.dataset.i, 0); });

  /* 이름 상자 · 입력줄 (표 위 fx 줄) */
  function cellRaw(row, col) {   // 그 칸의 원래 글 (표에 줄여 보이는 것 말고)
    if (!row || !col) return '';
    const v = ctx.virtual && ctx.virtual(row, col);
    if (v !== undefined && v !== null && v !== false) return v;
    const c = row.byP[col.p];
    if (!c) return '';
    if (c.cb && !c.t) return c.cb === 2 ? 'TRUE' : 'FALSE';
    if (c.img) return ctx.imgText ? c.t || '' : '';
    return c.t || c.chips.map(x => x.t).join(', ');
  }
  function paintFx() {
    const on = cellMode() && !!tabOf(S.cur);
    if (fxBar.hidden === on) fxBar.hidden = !on;
    if (!on) return;
    if (ctx.statInFx) { const cs = hasCell() ? rngCells() : [], h = cs.length > 1 ? selStat(cs) : ''; if (fxStat.innerHTML !== h) fxStat.innerHTML = h; }
    if (CE.x) return;
    const d = curData(), c = hasCell() ? S.cell : null, col = c && d ? d.cols.find(x => x.p === c.p) : null, row = col ? d.rows.find(x => x.r === c.r) : null;
    if (document.activeElement !== fxN) fxN.value = row ? ctx.cellName(row, col) : '';
    if (document.activeElement === fxIn) return;
    const x = row ? editCtx(S.cur, c.r, c.p) : null;
    fxIn.value = x && x.fx ? x.fx : cellRaw(row, col);
    const why = row ? roWhy(x) : '';
    fxIn.readOnly = !row || !!why;
    fxIn.title = why || '';
  }
  fxIn.addEventListener('focus', () => {
    if (CE.x) { CE.src = 'fx'; CE.mode = 'edit'; return; }   // 칸에서 고치다 입력줄을 누름 — 이어서
    if (!hasCell() || fxIn.readOnly) return;
    const v = fxIn.value;
    if (startEdit('edit', {src: 'fx'})) { if (fxIn.value !== CE.el.value) fxIn.value = CE.el.value; }
    else { fxIn.value = v; fxIn.readOnly = true; }
  });
  fxIn.addEventListener('input', () => { if (CE.x) { CE.src = 'fx'; CE.lastRef = null; CE.el.value = fxIn.value; ceReveal(); ceSize(); if (ctx.onEdit) ctx.onEdit(fxIn.value); } });
  fxIn.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) { if (CE.x) composeKey(e); return; }
    if (Date.now() < CE.guard && /^(Enter|Tab)$/.test(e.key)) { e.preventDefault(); CE.guard = 0; return; }
    if (CE.x) editKey(e, fxIn);
    else if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); focusCells(); }
  });
  fxIn.addEventListener('beforeinput', e => { if (/^insert(LineBreak|Paragraph)$/.test(e.inputType || '')) e.preventDefault(); });
  fxIn.addEventListener('compositionend', () => {
    if (CE.x) { CE.el.value = fxIn.value; ceSize(); }
    const pk = CE.pend;
    CE.pend = null;
    if (pk && Date.now() - pk.at < 500) setTimeout(() => { if (CE.x && CE.x === pk.x) { CE.guard = Date.now() + 150; pk.run(); } }, 0);
  });
  fxIn.addEventListener('blur', () => {
    if (!CE.x || CE.src !== 'fx' || !document.hasFocus()) return;
    setTimeout(() => { const a = document.activeElement; if (!CE.x || a === fxIn) return; if (a === CE.el) { CE.src = 'cell'; return; } commitCell(0, 0, true); }, 0);
  });
  // 이름 상자 — 줄 번호 · 칸 이름 · '남은재고 120' 을 쓰고 Enter → 그 칸으로
  fxN.addEventListener('focus', () => fxN.select());
  fxN.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); focusCells(); paintFx(); return; }
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    const vr = vIdx(), t = norm(fxN.value).replace(/행$/, ''), m = t.match(/^(.*?)·?(\d*)$/);
    if (!vr || !vr.list.length || !t) { focusCells(); return; }
    const nm = m ? m[1] : t, num = m && m[2] ? +m[2] : 0;
    let col = nm ? vr.cols.find(c => norm(c.name) === nm) || vr.cols.find(c => norm(c.name).startsWith(nm)) || (/^[a-z]{1,2}$/i.test(nm) ? vr.cols.find(c => colName(c.p) === nm.toUpperCase()) : null) : null;
    if (nm && !col) { toast(`'${fxN.value.trim()}' 칸을 찾지 못했어요`, true); fxN.select(); return; }
    const row = num ? (ctx.rowByNo ? ctx.rowByNo(num, nm) : vr.list.find(x => x.r === num)) : vr.list.find(x => hasCell() && x.r === S.cell.r) || vr.list[0];
    if (!row) { toast(`${num}행은 지금 표에 없어요 (걸러 보는 중이거나 없는 줄)`, true); fxN.select(); return; }
    if (!col) col = vr.cols.find(c => hasCell() && c.p === S.cell.p) || vr.cols[0];
    fxN.blur();
    selectCell(row.r, col.p);
    focusCells();
  });
  fxN.addEventListener('blur', () => setTimeout(paintFx, 0));

  /* 고른 칸 합계 · 평균 · 개수 (엑셀 상태 표시줄) */
  function selStat(cs) {
    const d = curData(), nr = new Set(), np = new Set();
    cs.forEach(x => { nr.add(x.r); np.add(x.p); });
    const size = nr.size * np.size === cs.length ? `${nr.size}줄 × ${np.size}열` : `${cs.length.toLocaleString()}칸`;
    if (!d || cs.length > 20000) return `<b>${size}</b>`;
    const rows = new Map(d.rows.map(x => [x.r, x])), cols = new Map(d.cols.map(x => [x.p, x]));
    let n = 0, sum = 0, nn = 0;
    cs.forEach(x => {
      const row = rows.get(x.r), col = cols.get(x.p);
      if (!row || !col || cellBlank(row, col)) return;
      n++;
      const c = row.byP[x.p], v = ctx.virtualNum && col.p > 9000 ? ctx.virtualNum(row, col) : c ? numOf(c.t) : null;
      if (v !== null && v !== undefined) { nn++; sum += v; }
    });
    return `<b>${size}</b>` + (nn ? ` · 합계 <b>${fmt(Math.round(sum * 100) / 100)}</b> · 평균 ${fmt(Math.round(sum / nn * 100) / 100)}` : '') + (n ? ` · 개수 ${fmt(n)}` : '');
  }

  /* ── 마우스 — 누르기 · 끌기 (PC) ── */
  const DG = {on: null, x: 0, y: 0, raf: 0};
  // 줄이 보이는 자리 — 머리글 · 합계 줄은 붙박이(sticky)라 thead · tfoot 이 아니라 그 안 칸의 자리로 잰다
  function viewBox() {
    const g = grid.getBoundingClientRect(), th = grid.querySelector('thead th'), tf = grid.querySelector('tfoot td');
    return {l: g.left, r: g.left + grid.clientWidth, t: th ? th.getBoundingClientRect().bottom : g.top, b: Math.min(g.top + grid.clientHeight, tf ? tf.getBoundingClientRect().top : 1e9)};
  }
  // 화면 자리 → 칸 {r, p} (표 밖이면 가장 가까운 칸, 행 번호 칸 = 첫 열)
  function cellAt(x, y) {
    const vr = vIdx(), w = viewBox();
    if (!vr || !vr.list.length) return null;
    const last = vr.tb ? vr.tb.lastElementChild : null, lb = last ? last.getBoundingClientRect().bottom - 3 : w.b;
    const el = document.elementFromPoint(clamp(x, w.l + 2, w.r - 3), clamp(y, w.t + 2, Math.max(w.t + 2, Math.min(w.b - 3, lb))));
    const td = el && el.closest ? el.closest('#grid tbody td') : null, tr = td && td.closest('tr[data-r]');
    if (!tr) return null;
    const r = +tr.dataset.r;
    if (td.dataset.p !== undefined) return {r, p: +td.dataset.p};
    return {r, p: td.classList.contains('rn') ? vr.cols[0].p : vr.cols[vr.cols.length - 1].p};
  }
  function colAt(x) {
    const w = viewBox(), th0 = grid.querySelector('thead th'), vr = vIdx();
    if (!th0 || !vr) return null;
    const b = th0.getBoundingClientRect(), el = document.elementFromPoint(clamp(x, w.l + 2, w.r - 3), b.top + b.height / 2);
    const th = el && el.closest ? el.closest('#grid thead th') : null;
    if (!th) return null;
    return th.dataset.p !== undefined ? +th.dataset.p : th.classList.contains('rn') ? vr.cols[0].p : vr.cols[vr.cols.length - 1].p;
  }
  const inHandle = (e, td) => { const b = td.getBoundingClientRect(); return td.classList.contains('fh') && e.clientX > b.right - 11 && e.clientY > b.bottom - 11; };
  grid.addEventListener('mousedown', e => {
    if (!cellMode() || e.button !== 0 || !e.target.closest) return;
    if (IS_MAC && e.ctrlKey) return;   // 맥 Ctrl+누르기 = 오른쪽 누르기
    const t = e.target;
    if (t.closest('.rz')) return;      // 칸 너비 끌기 (아래)
    if (ctx.menuBtn && t.closest(ctx.menuBtn)) { e.preventDefault(); return; }
    const mode = e.shiftKey ? 'shift' : addKey(e) ? 'add' : '';
    const th = t.closest('thead th');
    if (th) {
      e.preventDefault();
      if (th.classList.contains('fill')) return;
      if (CE.x && commitCell(0, 0, true) === false) return;
      if (ctx.closeMenus) ctx.closeMenus();
      if (th.dataset.sort === 'rn') pickAll();
      else { pickCols(+th.dataset.p, mode); DG.on = {kind: 'col'}; }
      focusCells();
      return;
    }
    const rn = t.closest('tbody td.rn');
    if (rn) {
      const tr = rn.closest('tr[data-r]');
      if (!tr) return;
      e.preventDefault();
      const r = +tr.dataset.r;
      if (CE.x) commitCell(0, 0, true);
      if (e.detail === 2 && !mode) {   // 두 번 누르기 = 그 줄 상세 창 (열려 있으면 닫기)
        if (S.sel && S.sel.r === r && !$('detail').hidden && DG.det !== r) closeDetail(); else openDetail(r, false);
        DG.det = 0;
        focusCells();
        return;
      }
      DG.det = !$('detail').hidden && S.sel && S.sel.r !== r ? r : 0;   // 이번 누르기로 상세 창이 이 줄로 바뀜 (두 번째 누르기에 닫지 않게)
      pickRows(r, mode);
      DG.on = {kind: 'row'};
      focusCells();
      return;
    }
    const td = t.closest('tbody td[data-p]'), tr = td && td.closest('tr[data-r]');
    if (!tr) return;
    if (ctx.formulas && CE.x && pointCell(e, +tr.dataset.r, +td.dataset.p)) return;   // 함수를 쓰는 중 — 누른 칸 주소를 넣는다
    if (t.closest('a,button,img.thumb')) { if (CE.x) commitCell(0, 0, true); return; }   // 링크 · 배지 · 사진은 누른 대로
    e.preventDefault();   // 글자 끌어 고르기 · 포커스 옮기기 대신 칸 고르기
    const r = +tr.dataset.r, p = +td.dataset.p;
    if (inHandle(e, td) && !mode) {   // 채우기 손잡이
      if (e.detail === 2) { DG.on = null; fillToEnd(); return; }
      DG.on = {kind: 'fill', src: curRect(), to: null};
      return;
    }
    if (CE.x) commitCell(0, 0, true);
    hideTip();
    if (e.detail === 2 && !mode && hasCell() && S.cell.r === r && S.cell.p === p) {   // 두 번 누르기 = 글자 사이에서 고치기
      DG.on = null;
      focusCells();
      const x = editCtx(S.cur, r, p), why = roWhy(x);
      if (why) cellTip(r, p, why, true, 3200); else if (!x.check) startEdit('edit', {x: e.clientX});
      return;
    }
    if (mode === 'shift' && hasCell()) extendTo(r, p);
    else if (mode === 'add' && hasCell() && inSel(r, p)) { dropCell(r, p); focusCells(); return; }
    else if (mode === 'add' && hasCell()) addCell(r, p);
    else selectCell(r, p, {noScroll: true});
    DG.on = {kind: 'cell', ck: !mode && t.closest('.ck,.ck0') ? {r, p} : null, r, p};
    focusCells();
  });
  function dragTo() {
    const D = DG.on;
    if (!D) return;
    if (D.kind === 'col') { const p = colAt(DG.x); if (p !== null && hasCell()) { const vr = vIdx(), r1 = vr.list[vr.list.length - 1].r; if (!S.cell2 || S.cell2.p !== p) { S.cell2 = {r: r1, p}; paintRng(); } } return; }
    const a = cellAt(DG.x, DG.y);
    if (!a) return;
    if (D.kind === 'row') { const vr = vIdx(), p1 = vr.cols[vr.cols.length - 1].p; if (hasCell() && (!S.cell2 || S.cell2.r !== a.r)) { S.cell2 = {r: a.r, p: p1}; paintRng(); } return; }
    if (D.kind === 'fill') { fillPreview(a); return; }
    if (D.kind === 'point') { pointTo(D, a); return; }
    if (!hasCell()) return;
    const anc = ancOf(), end = S.cell2 || anc;
    if (end.r !== a.r || end.p !== a.p) { D.moved = true; extendTo(a.r, a.p); }
  }
  function dragScroll() {   // 끌다가 표 끝을 넘으면 그쪽으로 넘긴다
    DG.raf = 0;
    if (!DG.on) return;
    const w = viewBox(), step = d => Math.sign(d) * Math.max(3, Math.min(38, Math.abs(d) * 0.35)), M = 14;   // 아래 합계 줄 · 오른쪽 끝에 닿기만 해도 천천히
    const sk = DG.on.kind === 'col' || DG.on.kind === 'row' ? w.l : [...grid.querySelectorAll('thead th.sk')].reduce((m, th) => Math.max(m, th.getBoundingClientRect().right), w.l);
    const skr = [...grid.querySelectorAll('thead th.skr')].reduce((m, th) => Math.min(m, th.getBoundingClientRect().left), w.r);
    const inSk = hasCell() && S.vr && S.vr.ki.get(ancOf().p) < S.vr.stickN;   // 고정 칸에서 끌기 시작했으면 고정 칸 안에서 옆으로 안 넘김
    const dy = DG.on.kind === 'col' ? 0 : DG.y < w.t ? step(DG.y - w.t) : DG.y > w.b - 2 ? step(DG.y - w.b + 2) : 0;
    const dx = DG.on.kind === 'row' ? 0 : DG.x < (inSk ? w.l : sk) && grid.scrollLeft > 0 ? step(DG.x - (inSk ? w.l : sk)) : DG.x > Math.min(skr, w.r - M) ? step(DG.x - Math.min(skr, w.r - M)) : 0;
    if (dx || dy) { grid.scrollTop += dy; grid.scrollLeft += dx; dragTo(); }
    DG.raf = requestAnimationFrame(dragScroll);
  }
  document.addEventListener('mousemove', e => {
    if (!DG.on) return;
    if (!(e.buttons & 1)) { dragEnd(); return; }   // 창 밖에서 단추를 놓음
    DG.x = e.clientX;
    DG.y = e.clientY;
    dragTo();
    if (!DG.raf) DG.raf = requestAnimationFrame(dragScroll);
  });
  function dragEnd(e) {
    const D = DG.on;
    DG.flip = !!(e && e.type === 'mouseup' && addKey(e));   // Ctrl 을 누른 채 놓음 — 채우기 방식 반대로
    DG.on = null;
    if (DG.raf) { cancelAnimationFrame(DG.raf); DG.raf = 0; }
    if (!D) return;
    if (D.kind === 'fill') { fillApply(D); return; }
    if (D.kind === 'point') return;
    if (S.paint && ctx.paintAt) { ctx.paintAt(); return; }   // 서식 복사 — 누르거나 끈 범위에
    if (D.ck && !D.moved) {   // 체크 네모를 누름
      const x = editCtx(S.cur, D.ck.r, D.ck.p), why = roWhy(x);
      if (why) cellTip(D.ck.r, D.ck.p, why, true, 3200); else if (x.check) toggleCheck(x);
    }
  }
  document.addEventListener('mouseup', dragEnd);

  const UNDO = new Map(), REDO = new Map(), UNDO_MAX = 100, PASTE_MAX = 2000, BATCH = 60, BIG = 20;
  function pushUndo(gid, entry) {
    const st = UNDO.get(gid) || [];
    st.push(entry);
    while (st.length > UNDO_MAX) st.shift();
    UNDO.set(gid, st);
    REDO.delete(gid);   // 새로 고치면 '다시 실행' 은 비운다 (엑셀)
  }
  // 많은 칸을 한꺼번에 바꾸기 전 — 묻고 답을 기다린다 (Esc · 취소 = 안 함)
  function askBig(text, stk) {
    return new Promise(res => {
      const box = document.createElement('div');
      box.className = 'xask';
      box.innerHTML = `<div class="xa" role="alertdialog" aria-modal="true"><b>${esc(text)}</b><p>바로 저장돼요${stk || ''}. 잘못 눌렀으면 취소하세요. (바꾼 뒤에도 Ctrl+Z 로 되돌릴 수 있어요)</p><div class="xa-b"><button type="button" class="no">취소</button><button type="button" class="ok">네, 바꿀게요</button></div></div>`;
      document.body.appendChild(box);
      const end = v => { box.remove(); focusCells(); res(v); };
      box.querySelector('.no').onclick = () => end(false);
      box.querySelector('.ok').onclick = () => end(true);
      box.addEventListener('mousedown', e => { if (e.target === box) end(false); });
      box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(false); } });
      box.querySelector('.no').focus();
    });
  }
  function selTsv() {   // 고른 범위 → 엑셀 · 구글시트에 붙는 글 (탭 · 줄바꿈, 칸 속 줄바꿈 · 따옴표는 "…"). 네모가 안 되는 여러 군데면 null
    const d = curData(), g = selGrid();
    if (!d || !g) return g === null ? null : '';
    const byR = new Map(d.rows.map(x => [x.r, x]));
    const q = v => /[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const txt = (r, p) => {
      const row = byR.get(r), c = row && row.byP[p], col = d.cols.find(x => x.p === p);
      const vt = row && col && ctx.virtual ? ctx.virtual(row, col) : undefined;
      if (vt !== undefined && vt !== null && vt !== false) return vt;
      if (!c) return rawOf(S.cur, r, p);
      if (c.cb && !c.t) return c.cb === 2 ? 'TRUE' : 'FALSE';
      return String(c.t == null ? '' : c.t);
    };
    return g.rs.map(r => g.ps.map(p => q(txt(r, p))).join('\t')).join('\n');
  }
  // 고른 칸들이 '줄 묶음 × 열 묶음' 이면 {rs, ps} (Ctrl 로 떨어진 줄 · 열을 골라도 같은 모양이면 됨 — 엑셀과 같음), 아니면 null
  function selGrid() {
    const vr = vIdx(), cs = rngCells();
    if (!vr || !cs.length) return undefined;
    const rs = [...new Set(cs.map(x => x.r))].sort((a, b) => vr.ri.get(a) - vr.ri.get(b)), ps = [...new Set(cs.map(x => x.p))].sort((a, b) => vr.ki.get(a) - vr.ki.get(b));
    return rs.length * ps.length === cs.length ? {rs, ps} : null;
  }
  const MULTI_NO = '떨어진 칸들은 줄이나 열이 서로 맞아야 복사할 수 있어요 — 한 덩어리로 골라 주세요';
  function setClip(tsv, cut) {   // 복사 · 잘라낸 자리 (점선)
    const g = selGrid(), info = (tabOf(S.cur) || {}).info;
    if (!g) return;
    S.clip = {gid: S.cur, cut, tsv: nl(tsv), rs: g.rs, ps: g.ps,
      rects: [...S.multi.map(m => ({a: Object.assign({}, m.a), b: Object.assign({}, m.b)})), {a: Object.assign({}, ancOf()), b: Object.assign({}, S.cell2 || ancOf())}],
      fmt: g.rs.map(r => g.ps.map(p => ctx.fmtCopy ? ctx.fmtCopy(r, p) : fmtOf(info, r, p))),
      fx: ctx.formulas ? g.rs.map(r => g.ps.map(p => { const x = editCtx(S.cur, r, p); return x && x.fx ? x.fx : ''; })) : null};
    S.clip.hasFmt = S.clip.fmt.some(l => l.some(Boolean));
    if (cut) S.clip.src = g.rs.map(r => g.ps.map(p => { const x = editCtx(S.cur, r, p); return x && !roWhy(x) ? {x, v: rawOf(S.cur, x.r, x.p), f: x.fx || ''} : null; }));   // 옮기고 나서 비울 칸 (지금 값 그대로일 때만 비움)
    paintRng();
  }
  const nl = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/\n$/, '');
  function parseTsv(text) {
    let s = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    if (s.endsWith('\n')) s = s.slice(0, -1);
    const out = [[]];
    let cur = '', q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"' && cur === '') { q = true; continue; }
      if (ch === '\t') { out[out.length - 1].push(cur); cur = ''; continue; }
      if (ch === '\n') { out[out.length - 1].push(cur); cur = ''; out.push([]); continue; }
      cur += ch;
    }
    out[out.length - 1].push(cur);
    return out;
  }
  function pasteTargets(g, one) {   // 붙일 칸 [{r, p, v, si, sk}] (보이는 줄 · 칸 순서, si · sk = 복사한 표의 몇째 줄 · 칸) · 표 밖으로 넘친 칸 수
    const vr = vIdx(), rs = selRects(), cells = [];
    let over = 0;
    if (!vr || !rs.length) return {cells, over};
    const gh = g.length, gw = Math.max(...g.map(x => x.length));
    if (gh === 1 && gw === 1 && !one) { rngCells().forEach(x => cells.push({r: x.r, p: x.p, v: g[0][0], si: 0, sk: 0})); return {cells, over}; }   // 한 칸 → 고른 칸 전부
    if (rs.length > 1) return {cells, over, multi: true};
    const t = rs[0], H = t.i1 - t.i0 + 1, W = t.k1 - t.k0 + 1;
    const nh = !one && H % gh === 0 ? H : gh, nw = !one && W % gw === 0 ? W : gw;   // 고른 범위가 복사한 크기의 배수면 되풀이
    for (let di = 0; di < nh; di++) for (let dk = 0; dk < nw; dk++) {
      const v = g[di % gh][dk % gw], i = t.i0 + di, k = t.k0 + dk;
      if (v === undefined) continue;
      if (i >= vr.list.length || k >= vr.cols.length) { over++; continue; }
      cells.push({r: vr.list[i].r, p: vr.cols[k].p, v, si: di % gh, sk: dk % gw});
    }
    return {cells, over};
  }
  // 여러 칸에 값 쓰기 (붙여넣기 · 채우기 · 한꺼번에 넣기) — list [{r, p, v}], opt: ask(칸 수 → 물어볼 글) · fmt [{r, p, f}] · over · undo(앞뒤로 같이 되돌릴 칸)
  async function applyCells(list, label, opt) {
    opt = opt || {};
    const gid = S.cur, items = [];
    let skip = 0;
    list.forEach(tg => {
      const x = editCtx(gid, tg.r, tg.p);
      if (!x || roWhy(x)) { skip++; return; }
      let v = String(tg.v);
      if (x.check) {
        const k = v.trim();
        if (/^(true|1|y|yes|o|v|✓|☑|체크)$/i.test(k)) v = 'TRUE'; else if (/^(false|0|n|no|x|)$/i.test(k)) v = 'FALSE'; else { skip++; return; }
      }
      if (ctx.calcEntry && /^=/.test(v)) { const c = OfficeGrid.calc(v); if (c !== null && c !== false) v = c; else v = v.replace(/^=+/, "'="); }   // 함수를 안 쓰는 표에 붙은 '=' 글
      if (x.fx ? v === x.fx : v === rawOf(gid, x.r, x.p) && !x.ofx) { tg.same = true; return; }   // 이미 같은 값
      items.push({x, v, tg});
    });
    const fmts = (opt.fmt || []).filter(f => fmtCellOk(f.r, f.p));
    if (!items.length && !fmts.length) { toast(skip ? `바꿀 수 있는 칸이 없어요 (못 고치는 칸 ${skip}개)` : '바뀐 칸이 없어요', !!skip); return null; }
    if (opt.ask && items.length > BIG && !(await askBig(opt.ask(items.length), ctx.bigNote ? ctx.bigNote(items) : ''))) return null;
    if (gid !== S.cur) return null;
    items.forEach(it => S.stick.add(it.x.row));   // 걸러 보는 중이어도 고친 줄은 그대로 보이게
    const e = {label, cells: []};
    if (fmts.length) {
      const info = (tabOf(gid) || {}).info, m = new Map(fmts.map(f => [`${f.r}:${f.p}`, f.f]));
      e.fmt = fmts.map(f => ({r: f.r, p: f.p, f: fmtOf(info, f.r, f.p), g: f.f || null}));
      fmtApply((o, x) => Object.assign({}, m.get(`${x.r}:${x.p}`) || {}), label, fmts.map(f => ({r: f.r, p: f.p})), true, true);
    }
    const res = items.length ? await ctx.writeMany(gid, items, label, {noUndo: true}) : {ok: 0, fail: 0, why: '', cells: []};
    e.cells = res.cells;
    if (opt.then) await opt.then(res, e);
    if (e.cells.length || e.fmt) pushUndo(gid, e);
    toast(`${label} · ${res.ok || (e.fmt ? e.fmt.length : 0)}칸${res.fail ? ` · 못 씀 ${res.fail}칸 (${res.why})` : ''}${skip ? ` · 못 고치는 칸 ${skip}개 건너뜀` : ''}${opt.over ? ` · 표 밖 ${opt.over}칸은 빠짐` : ''}`, !!res.fail);
    return res;
  }
  function pasteText(text, opt) {
    opt = opt || {};
    if (!hasCell()) { toast('붙여 넣을 칸을 먼저 눌러 고르세요', true); return; }
    if (ctx.canEdit && !ctx.canEdit()) { toast(ctx.noEdit, true); return; }
    let g = parseTsv(text);
    const cl = S.clip && S.clip.tsv === nl(text) ? S.clip : null, move = !!(cl && cl.cut && !opt.trans);   // 이 화면 안에서 복사한 것인지
    if (opt.trans) { const w = Math.max(...g.map(x => x.length)); g = Array.from({length: w}, (z, k) => g.map(row => row[k] === undefined ? '' : row[k])); }   // 줄 · 열 바꿔 붙이기
    if (!g.length || (g.length === 1 && g[0].length === 1 && g[0][0] === '' && !cl)) return;
    const {cells, over, multi} = pasteTargets(g, move);
    if (multi) { toast('떨어진 여러 칸에는 한 칸만 복사해서 붙여 넣을 수 있어요', true); return; }
    if (!cells.length) { toast('붙여 넣을 칸을 먼저 눌러 고르세요', true); return; }
    if (cells.length > PASTE_MAX) { toast(`한 번에 ${PASTE_MAX.toLocaleString()}칸까지 붙여 넣을 수 있어요 — 나눠서 붙여 주세요`, true); return; }
    const a = cells[0], b = cells[cells.length - 1], gid = S.cur;
    if (cl && cl.fx && !opt.vals && !opt.trans) cells.forEach(c => {   // 함수 칸 — 함수째로 (복사는 주소가 따라 움직이고, 잘라내기는 그대로)
      const f = (cl.fx[c.si] || [])[c.sk];
      if (f) c.v = move ? f : ctx.shiftFx(f, c.r - cl.rs[c.si], c.p - cl.ps[c.sk]);
    });
    const fmt = cl && cl.hasFmt && !opt.vals && !opt.trans ? cells.map(c => ({r: c.r, p: c.p, f: (cl.fmt[c.si] || [])[c.sk] || null})) : null;
    const go = applyCells(cells, move ? '옮기기' : opt.vals ? '값만 붙여넣기' : '붙여넣기', {fmt, over, then: move ? async (res, e) => {
      // 옮기기 — 붙은 칸의 원래 자리만 비운다 (붙인 자리와 겹치면 그대로). 다른 탭에서 잘라 왔으면 그 탭에
      const okKey = new Set(res.cells.map(c => ck(c.r, c.p))), dest = new Set(cells.map(c => ck(c.r, c.p))), items = [];
      cells.forEach(c => {
        const s = cl.src && (cl.src[c.si] || [])[c.sk];
        if (!s || (s.v === '' && !s.f) || !(okKey.has(ck(c.r, c.p)) || c.same)) return;
        if (cl.gid === gid && dest.has(ck(s.x.row, s.x.p))) return;
        items.push({x: s.x, v: s.x.check ? 'FALSE' : '', old: s.v});
      });
      if (!items.length) return;
      const r2 = await ctx.writeMany(cl.gid, items, '옮기기', {noUndo: true});
      if (cl.gid === gid) e.cells = e.cells.concat(r2.cells); else if (r2.cells.length) pushUndo(cl.gid, {label: '옮기기', cells: r2.cells});
      if (r2.fail) toast(`옮기기 — 원래 칸 ${r2.fail}개는 그사이 바뀌어 안 비웠어요`, true);
    } : null});
    if (cells.length > 1 && !(g.length === 1 && g[0].length === 1)) { S.multi = []; S.anc = null; S.cell = {gid, r: a.r, p: a.p}; S.cell2 = {r: b.r, p: b.p}; }   // 붙인 자리를 고른 채로 (엑셀)
    if (move) S.clip = null;
    paintRng();
    return go;
  }
  async function clearSel(label) {
    if (ctx.canEdit && !ctx.canEdit()) { toast(ctx.noEdit, true); return; }
    const cs = rngCells(), list = [];
    let skip = 0, nFull = 0;
    cs.forEach(c => {
      const x = editCtx(S.cur, c.r, c.p);
      if (!x || roWhy(x)) { if (x && x.cell && hasVal(x.cell)) skip++; return; }
      if (x.check ? x.cell && x.cell.cb === 2 : rawOf(S.cur, x.r, x.p) !== '' || x.ofx) { nFull++; list.push({r: c.r, p: c.p, v: x.check ? 'FALSE' : ''}); }
    });
    label = label || '지우기';
    if (!list.length) { toast(skip ? `지울 수 있는 칸이 없어요 (못 고치는 칸 ${skip}개)` : '지울 값이 없어요', !!skip); return; }
    await applyCells(list, label, {ask: n => `글이 든 칸 ${n}개를 지울까요?`});
  }
  /* 채우기 */
  const DATE_FILL = [   // 하루씩 늘리는 날짜 꼴 (연-월-일 · 연.월.일 · 월/일)
    [/^(\d{4})-(\d{1,2})-(\d{1,2})$/, (d, t) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`],
    [/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/, d => `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`],
    [/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, d => `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`],
    [/^()(\d{1,2})\/(\d{1,2})$/, d => `${d.getMonth() + 1}/${d.getDate()}`],
  ];
  function asDate(t) {
    for (let i = 0; i < DATE_FILL.length; i++) {
      const m = t.match(DATE_FILL[i][0]);
      if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) continue;
      return {kind: i, n: Math.round(Date.UTC(m[1] ? +m[1] : new Date().getFullYear(), +m[2] - 1, +m[3]) / 864e5)};
    }
    return null;
  }
  const dateText = (kind, n) => { const u = new Date(n * 864e5); return DATE_FILL[kind][1](new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate())); };
  /* 원래 값들 → n 번째(1부터) 다음 값을 내는 함수. 숫자 한 칸 = 그대로 · 두 칸 이상 = 이어지는 수, 날짜 · 끝이 숫자인 글 = 하나씩. flip(Ctrl) 이면 반대 (엑셀) */
  function fillSeries(vals, flip) {
    const L = vals.length, rep = n => vals[(n - 1) % L], t = vals.map(v => String(v).trim());
    if (!L) return () => '';
    const nums = t.map(v => (/^-?[\d,]*\.?\d+$/.test(v) ? numOf(v) : null));
    if (nums.every(v => v !== null)) {
      const comma = t.some(v => /\d,\d{3}/.test(v)), out = v => { const x = Math.round(v * 1e6) / 1e6; return comma ? x.toLocaleString('en-US', {maximumFractionDigits: 6}) : String(x); };
      if (L === 1) return flip ? n => out(nums[0] + n) : rep;
      if (flip) return rep;
      const mx = (L - 1) / 2, my = nums.reduce((a, b) => a + b, 0) / L;   // 엑셀과 같은 선형 추세
      const b = nums.reduce((s, y, x) => s + (x - mx) * (y - my), 0) / nums.reduce((s, y, x) => s + (x - mx) * (x - mx), 0);
      return n => out(my + b * (L - 1 + n - mx));
    }
    const ds = t.map(asDate);
    if (ds.every(d => d && d.kind === ds[0].kind)) {
      if (flip) return rep;
      const step = L === 1 ? 1 : ds[1].n - ds[0].n;
      if (L < 3 || ds.every((d, i) => !i || d.n - ds[i - 1].n === step)) return n => dateText(ds[0].kind, ds[L - 1].n + step * n);
      return rep;
    }
    const ms = t.map(v => v.match(/^([^\n]*?\D)(\d{1,6})$/));
    if (!flip && ms.every(m => m && m[1] === ms[0][1] && !/https?:/.test(m[1]))) {
      const a = ms.map(m => +m[2]), step = L === 1 ? 1 : a[1] - a[0], w = /^0/.test(ms[0][2]) ? ms[0][2].length : 0;
      if (L < 3 || a.every((x, i) => !i || x - a[i - 1] === step)) return n => ms[0][1] + String(Math.abs(a[L - 1] + step * n)).padStart(w, '0');
    }
    return rep;
  }
  const rawAt = (i, k) => { const vr = S.vr, row = vr.list[i], col = vr.cols[k], c = row.byP[col.p]; return c ? (c.cb && !c.t ? (c.cb === 2 ? 'TRUE' : 'FALSE') : String(c.t == null ? '' : c.t)) : ''; };
  // 손잡이를 끈 자리 → 채울 네모 (세로 · 가로 중 더 멀리 끈 쪽)
  function fillRect(s, a) {
    const vr = vIdx(), i = vr.ri.get(a.r), k = vr.ki.get(a.p);
    if (i === undefined || k === undefined) return null;
    const dv = i > s.i1 ? i - s.i1 : i < s.i0 ? i - s.i0 : 0, dh = k > s.k1 ? k - s.k1 : k < s.k0 ? k - s.k0 : 0;
    if (!dv && !dh) return null;
    if (Math.abs(dv) >= Math.abs(dh)) return dv > 0 ? {dir: 'down', i0: s.i1 + 1, i1: i, k0: s.k0, k1: s.k1} : {dir: 'up', i0: i, i1: s.i0 - 1, k0: s.k0, k1: s.k1};
    return dh > 0 ? {dir: 'right', i0: s.i0, i1: s.i1, k0: s.k1 + 1, k1: k} : {dir: 'left', i0: s.i0, i1: s.i1, k0: k, k1: s.k0 - 1};
  }
  const fxAt = (i, k) => { if (!ctx.formulas) return ''; const o = vAt(i, k), x = editCtx(S.cur, o.r, o.p); return x && x.fx ? x.fx : ''; };
  function fillList(s, t, flip) {   // [{r, p, v, si, sk}]
    const out = [], vert = t.dir === 'down' || t.dir === 'up', back = t.dir === 'up' || t.dir === 'left';
    const line = (vals, put, n) => { const f = fillSeries(back ? vals.slice().reverse() : vals, flip); for (let q = 1; q <= n; q++) put(q, f(q)); };
    if (vert) for (let k = t.k0; k <= t.k1; k++) {
      const vals = [];
      for (let i = s.i0; i <= s.i1; i++) vals.push(rawAt(i, k));
      line(vals, (q, v) => { const i = back ? t.i1 + 1 - q : t.i0 - 1 + q; out.push(Object.assign(vAt(i, k), {v, si: back ? s.i1 - (q - 1) % vals.length : s.i0 + (q - 1) % vals.length, sk: k})); }, t.i1 - t.i0 + 1);
    }
    else for (let i = t.i0; i <= t.i1; i++) {
      const vals = [];
      for (let k = s.k0; k <= s.k1; k++) vals.push(rawAt(i, k));
      line(vals, (q, v) => { const k = back ? t.k1 + 1 - q : t.k0 - 1 + q; out.push(Object.assign(vAt(i, k), {v, si: i, sk: back ? s.k1 - (q - 1) % vals.length : s.k0 + (q - 1) % vals.length})); }, t.k1 - t.k0 + 1);
    }
    if (ctx.formulas) out.forEach(c => { const f = fxAt(c.si, c.sk); if (f) { const o = vAt(c.si, c.sk); c.v = ctx.shiftFx(f, c.r - o.r, c.p - o.p); } });   // 함수 칸을 끌면 주소가 따라 움직인다 (엑셀)
    return out;
  }
  function fillPreview(a) {
    const D = DG.on, t = fillRect(D.src, a), key = t ? `${t.dir}${t.i0},${t.i1},${t.k0},${t.k1}` : '';
    if (key === D.key) return;
    D.key = key;
    D.to = t;
    S.fprev = t ? new Set(edgeMap([t], new Map()).keys()) : null;
    paintRng();
    if (!t) { hideTip(); return; }
    const end = t.dir === 'down' ? vAt(t.i1, t.k0) : t.dir === 'up' ? vAt(t.i0, t.k0) : t.dir === 'right' ? vAt(t.i0, t.k1) : vAt(t.i0, t.k0);
    const z = fillList(D.src, t, false).find(x => x.r === end.r && x.p === end.p);
    if (z) cellTip(end.r, end.p, short(z.v), false, 4000);
  }
  function fillApply(D) {
    S.fprev = null;
    hideTip();
    const s = D.src, t = D.to;
    if (!s || !t) { paintRng(); return; }
    runFill(s, t, DG.flip);
  }
  function runFill(s, t, flip, ask) {
    const list = fillList(s, t, flip), info = (tabOf(S.cur) || {}).info;
    const fs = list.map(c => { const o = vAt(c.si, c.sk); return {r: c.r, p: c.p, f: fmtOf(info, o.r, o.p)}; });
    const a = vAt(Math.min(s.i0, t.i0), Math.min(s.k0, t.k0)), b = vAt(Math.max(s.i1, t.i1), Math.max(s.k1, t.k1));
    S.multi = [];
    S.anc = null;
    S.cell = {gid: S.cur, r: a.r, p: a.p};
    S.cell2 = a.r === b.r && a.p === b.p ? null : b;
    paintRng();
    return applyCells(list, '채우기', {fmt: fs.some(x => x.f) ? fs : null, ask});
  }
  function fillDown() {   // Ctrl+D — 고른 범위 맨 윗줄을 아래로 (한 줄만 골랐으면 바로 윗줄 값을 — 엑셀과 같음)
    const rs = selRects(), vr = vIdx(), list = [], fmts = [], info = (tabOf(S.cur) || {}).info;
    if (!rs.length) return;
    rs.forEach(t => {
      const src = t.i1 > t.i0 ? t.i0 : t.i0 - 1;
      if (src < 0) return;
      for (let k = t.k0; k <= t.k1; k++) for (let i = t.i1 > t.i0 ? t.i0 + 1 : t.i0; i <= t.i1; i++) {
        const o = vAt(src, k), c = vAt(i, k), f = fxAt(src, k);
        list.push(Object.assign(c, {v: f ? ctx.shiftFx(f, c.r - o.r, c.p - o.p) : rawAt(src, k)}));
        fmts.push({r: c.r, p: c.p, f: fmtOf(info, o.r, o.p)});
      }
    });
    if (!list.length || !vr) { toast('맨 윗줄이라 위에서 가져올 값이 없어요', true); return; }
    applyCells(list, '아래로 채우기', {fmt: fmts.some(x => x.f) ? fmts : null, ask: n => `아래로 채우기로 칸 ${n}개를 바꿀까요?`});
  }
  function fillToEnd() {   // 손잡이 두 번 누르기 — 옆 칸에 글이 이어진 데까지 아래로 (엑셀)
    const s = curRect(), vr = vIdx();
    if (!s || !vr || selRects().length > 1) return;
    const run = k => { if (k < 0 || k >= vr.cols.length) return 0; let i = s.i1 + 1; while (i < vr.list.length && !vr.list[i].past && !cellBlank(vr.list[i], vr.cols[k])) i++; return i - 1 - s.i1; };
    const n = run(s.k0 - 1) || run(s.k1 + 1);
    if (!n) { toast('옆 칸에 이어진 글이 없어서 어디까지 채울지 몰라요 — 손잡이를 끌어 주세요'); return; }
    runFill(s, {dir: 'down', i0: s.i1 + 1, i1: s.i1 + n, k0: s.k0, k1: s.k1}, false, m => `아래로 ${m}칸을 채울까요?`);
  }
  /* 되돌리기 · 다시 실행 — 한 번에 한 일 하나씩 (값 · 서식 같이) */
  function undo() { stepBack(false); }
  function redo() { stepBack(true); }
  function stepBack(again) {
    const gid = S.cur, from = again ? REDO : UNDO, to = again ? UNDO : REDO, st = from.get(gid), word = again ? '다시 실행' : '되돌리기';
    if (!st || !st.length) {
      if (!again && window.OfficeUndo && OfficeUndo.can()) { OfficeUndo.undo(); return; }   // 칸 말고 다른 일(매핑 등) — 오피스 공용 되돌리기 (office-undo.js)
      toast(again ? '다시 실행할 게 없어요' : '되돌릴 게 없어요 (이 화면에서 이 탭에 한 일만 되돌려요)', true); return;
    }
    const e = st.pop(), val = c => (again ? c.after : c.before), cur = c => (again ? c.before : c.after);
    const keep = () => { const q = to.get(gid) || []; q.push(e); to.set(gid, q); };
    const cells = e.cells || [];
    if (ctx.undoExtra && ctx.undoExtra(e, again, keep)) return;   // 줄 지우기 · 붙여넣기 같은 그 화면만의 일
    if (e.fmt) {   // 서식
      const m = new Map(e.fmt.map(c => [`${c.r}:${c.p}`, again ? c.g : c.f]));
      fmtApply((f, x) => Object.assign({}, m.get(`${x.r}:${x.p}`) || (ctx.fmtNone ? ctx.fmtNone(x.r, x.p) : {})), `${word} (${e.label})`, e.fmt.map(c => ({r: c.r, p: c.p})), true, cells.length > 0);
      if (!cells.length) { keep(); return; }
    }
    const items = [];
    let skip = 0;
    cells.forEach(c => {
      const x = editCtx(gid, c.r, c.p);
      if (!x || roWhy(x)) { skip++; return; }
      if (norm(x.fx && !x.check ? x.fx : rawOf(gid, c.r, c.p)) !== norm(cur(c))) { skip++; return; }   // 그사이 바뀐 칸은 그대로
      items.push({x, v: val(c), old: rawOf(gid, c.r, c.p)});
    });
    if (!items.length) { toast(`${word}할 수 없어요 — 그사이 바뀌었거나 지금 안 보이는 칸 ${skip}개`, true); if (e.fmt) keep(); return; }
    keep();
    items.forEach(it => S.stick.add(it.x.row));
    if (cells.length && hasCell()) {   // 되돌린 자리를 보여 준다 (엑셀)
      const vr = vIdx(), a = cells[0];
      if (vr && vr.ri.get(a.r) !== undefined && vr.ki.get(a.p) !== undefined) selectCell(a.r, a.p);
    }
    ctx.writeMany(gid, items, word, {noUndo: true}).then(r => toast(`${word} (${e.label}) · ${r.ok}칸${r.fail ? ` · 못 씀 ${r.fail}칸` : ''}${skip ? ` · 그대로 둔 칸 ${skip}개` : ''}`, !!r.fail));
  }
  const gridKeys = () => !CE.x && hasCell() && cellMode() && (document.activeElement === CE.el || document.activeElement === grid);
  function clipEvent(e, cut) {
    if (ctx.onCopy && ctx.onCopy(e, cut)) return;
    if (!gridKeys() || !e.clipboardData) return;
    const tsv = selTsv();
    if (tsv === null) { e.preventDefault(); toast(MULTI_NO, true); return; }
    if (tsv === undefined || !rngCells().length) return;
    e.clipboardData.setData('text/plain', tsv);
    e.preventDefault();
    setClip(tsv, cut);
    idleReset();
    if (!cut && ctx.afterCopy && ctx.afterCopy(tsv)) return;
    toast(cut ? `잘라내기 · ${rngCells().length}칸 — 옮길 칸에 붙여 넣으세요` : `복사 · ${rngCells().length}칸`);
  }
  document.addEventListener('copy', e => clipEvent(e, false));
  document.addEventListener('cut', e => clipEvent(e, true));
  document.addEventListener('paste', e => {
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (ctx.onPaste && ctx.onPaste(e, text)) return;
    if (!gridKeys()) return;
    e.preventDefault();
    if (!text && !S.clip) { toast('붙여 넣을 글이 없어요 (그림은 칸에 못 넣어요)'); return; }
    pasteText(text || '', {vals: Date.now() - (S.pasteVals || 0) < 800});
    S.pasteVals = 0;
    idleReset();
  });


  /* ── 함수 쓰기 도움 (ctx.formulas — MD팀 시트) — 칸을 누르거나 화살표 = 주소, F4 = $ 고정, Alt+= 자동 합계 ── */
  const fxEl = () => (CE.src === 'fx' ? fxIn : CE.el);
  function fxPoint(el) {   // 주소를 넣을 자리인지 — 연산자 · 괄호 · 쉼표 뒤(또는 방금 넣은 주소 바로 뒤 — 바꿔 넣음)
    if (!CE.x || !/^=/.test(el.value) || el.selectionStart !== el.selectionEnd) return null;
    const a = el.selectionStart, v = el.value, lr = CE.lastRef;
    if (lr && lr.el === el && lr.end === a && v.slice(lr.start, lr.end) === lr.text) return {replace: lr};
    return /[=(,+\-*/^&<>:;{]$/.test(v.slice(0, a).replace(/\s+$/, '')) ? {} : null;
  }
  const addr = (r, p) => colName(p) + r;
  function putRef(el, text, pt) {
    const v = el.value, a = el.selectionStart, s0 = pt.replace ? pt.replace.start : a;
    el.value = v.slice(0, s0) + text + v.slice(a);
    const end = s0 + text.length;
    el.setSelectionRange(end, end);
    CE.lastRef = {el, start: s0, end, text};
    if (el === fxIn) CE.el.value = el.value; else fxIn.value = el.value;
    ceSize();
    closePick();
  }
  function showRef(a, b) {
    const t = rectOf(a, b || a);
    S.fprev = t ? new Set(edgeMap([t], new Map()).keys()) : null;
    paintRng();
  }
  function pointCell(e, r, p) {
    const el = fxEl(), pt = fxPoint(el);
    if (!pt || (r === CE.x.row && p === CE.x.p)) return false;
    e.preventDefault();
    const from = e.shiftKey && pt.replace && CE.ptr ? CE.ptr.a : {r, p};
    putRef(el, from.r === r && from.p === p ? addr(r, p) : addr(from.r, from.p) + ':' + addr(r, p), pt);
    CE.ptr = {a: from, b: {r, p}};
    CE.refAt = Date.now();
    showRef(from, {r, p});
    DG.on = {kind: 'point', el};
    return true;
  }
  function pointTo(D, a) {   // 누른 채 끌면 범위
    if (!CE.x || !CE.ptr || (CE.ptr.b.r === a.r && CE.ptr.b.p === a.p)) return;
    const pt = fxPoint(D.el);
    if (!pt || !pt.replace) return;
    const s = CE.ptr.a;
    CE.ptr.b = {r: a.r, p: a.p};
    const t = rectOf(s, a), vr = S.vr;
    const x0 = t ? vAt(t.i0, t.k0) : s, x1 = t ? vAt(t.i1, t.k1) : a;
    putRef(D.el, s.r === a.r && s.p === a.p ? addr(s.r, s.p) : addr(Math.min(x0.r, x1.r), Math.min(x0.p, x1.p)) + ':' + addr(Math.max(x0.r, x1.r), Math.max(x0.p, x1.p)), pt);
    if (vr) showRef(s, a);
  }
  function pointKey(e, el) {
    const pt = fxPoint(el), vr = vIdx();
    if (!pt || !vr) return false;
    const base = pt.replace && CE.ptr ? CE.ptr.b : {r: CE.x.row, p: CE.x.p}, i = vr.ri.get(base.r), k = vr.ki.get(base.p);
    if (i === undefined || k === undefined) return false;
    e.preventDefault();
    const ni = clamp(i + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0), 0, vr.list.length - 1), nk = clamp(k + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0), 0, vr.cols.length - 1);
    const b = vAt(ni, nk), a = e.shiftKey && pt.replace && CE.ptr ? CE.ptr.a : b;
    putRef(el, a.r === b.r && a.p === b.p ? addr(b.r, b.p) : addr(a.r, a.p) + ':' + addr(b.r, b.p), pt);
    CE.ptr = {a, b};
    showRef(a, b);
    revealCell(b.r, b.p);
    return true;
  }
  function toggleAbs(el) {   // E5 → $E$5 → E$5 → $E5 → E5
    const v = el.value, at = el.selectionStart, re = /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})/g;
    let m;
    while ((m = re.exec(v))) {
      if (at < m.index || at > m.index + m[0].length) continue;
      const k = (m[1] ? 2 : 0) + (m[3] ? 1 : 0), nx = k === 0 ? ['$', '$'] : k === 3 ? ['', '$'] : k === 1 ? ['$', ''] : ['', ''];
      const t = nx[0] + m[2].toUpperCase() + nx[1] + m[4];
      el.value = v.slice(0, m.index) + t + v.slice(m.index + m[0].length);
      el.setSelectionRange(m.index + t.length, m.index + t.length);
      CE.lastRef = null;
      if (el === fxIn) CE.el.value = el.value; else fxIn.value = el.value;
      ceSize();
      return;
    }
  }
  function autoSum() {   // 바로 위로 이어진 숫자들 (없으면 왼쪽) 을 더하는 함수를 적어 준다 — Enter 로 넣기
    const vr = vIdx();
    if (!hasCell() || !vr) return;
    const i = vr.ri.get(S.cell.r), k = vr.ki.get(S.cell.p);
    if (i === undefined || k === undefined) return;
    const isN = (a, b) => { const c = vr.list[a].byP[vr.cols[b].p]; return !!c && numOf(c.t) !== null; };
    let t0 = i, t1 = i - 1, l0 = k;
    while (t0 > 0 && isN(t0 - 1, k)) t0--;
    while (l0 > 0 && isN(i, l0 - 1)) l0--;
    let ref = '';
    if (t0 < i) { const rs = vr.list.slice(t0, t1 + 1).map(x => x.r); ref = `${addr(Math.min(...rs), S.cell.p)}:${addr(Math.max(...rs), S.cell.p)}`; }
    else if (l0 < k) { const ps = vr.cols.slice(l0, k).map(c => c.p); ref = `${addr(S.cell.r, Math.min(...ps))}:${addr(S.cell.r, Math.max(...ps))}`; }
    if (startEdit('edit', {text: `=SUM(${ref})`})) { const n = CE.el.value.length - 1; CE.el.setSelectionRange(n, n); if (ref) showRefText(ref); }
  }
  function showRefText(ref) { const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/); if (m) showRef({r: +m[2], p: colNo(m[1]) - 1}, {r: +m[4], p: colNo(m[3]) - 1}); }

  /* ── 글자 모양 · 숫자 모양 · 테두리 · 메모 ── (저장소가 받아 줄 때만 — FMT2) */
  const LK_F2 = 'og_fmt2_v1';
  let FMT2 = false;
  try { FMT2 = localStorage.getItem(LK_F2) === '1'; } catch (e) { FMT2 = false; }
  function probeFmt() {
    if (!ctx.fmtProbe) return;
    Promise.resolve(ctx.fmtProbe()).then(j => {
      const on = !!(j && j['1:1'] && j['1:1'].i === 1 && j['1:1'].n === '-');
      if (on !== FMT2) { FMT2 = on; try { localStorage.setItem(LK_F2, on ? '1' : '0'); } catch (e) { /* 다음에 다시 물어봄 */ } }
    }, () => { /* 못 물어보면 지난번 답대로 */ });
  }
  setTimeout(probeFmt, 2500);
  setInterval(() => { if (!FMT2 && document.visibilityState === 'visible') probeFmt(); }, 10 * 60e3);
  const NO_F2 = '이 기능은 저장소를 한 번 바꾼 뒤에 켜져요 (아직 준비 중)';
  const fmtCur = (r, p) => (ctx.fmtCur ? ctx.fmtCur(r, p) : fmtOf((tabOf(S.cur) || {}).info, r, p)) || {};
  const pickedFmt = () => rngCells().filter(c => fmtCellOk(c.r, c.p));
  function fmtEach(fn, label) {
    const cs = pickedFmt();
    if (!cs.length) { toast('바꿀 칸을 먼저 눌러 고르세요', true); return; }
    fmtApply(fn, label, cs);
  }
  function fmtToggle(k, label) {
    const cs = pickedFmt(), all = cs.length > 0 && cs.every(c => fmtCur(c.r, c.p)[k]);
    fmtEach(f => Object.assign(f, {[k]: all ? 0 : 1}), all ? label + ' 풀기' : label);
  }
  function fmtSize(d) {
    const cs = pickedFmt(), cur = cs.length ? +fmtCur(cs[0].r, cs[0].p).sz || 13 : 13, n = Math.max(8, Math.min(22, cur + d));
    fmtEach(f => Object.assign(f, {sz: n === 13 ? 0 : n}), `글자 크기 ${n}`);
  }
  function fmtNumber(nf) { fmtEach(f => Object.assign(f, {nf}), nf ? '숫자 모양' : '숫자 모양 일반'); }
  function fmtDec(d) {
    const cs = pickedFmt(), cur = cs.length ? String(fmtCur(cs[0].r, cs[0].p).nf || '') : '', kind = /^[cpwyn]/.test(cur) ? cur[0] : 'c', n = Math.max(0, Math.min(6, (+cur[1] || 0) + d));
    fmtNumber(kind + n);
  }
  function fmtBorder(how) {
    const rs = selRects();
    if (!rs.length) { toast('테두리를 넣을 칸을 먼저 고르세요', true); return; }
    const vr = vIdx(), m = new Map();
    rs.forEach(t => {
      for (let i = t.i0; i <= t.i1; i++) for (let k = t.k0; k <= t.k1; k++) {
        const o = vAt(i, k), s = new Set();
        if (how === 'all') 'tblr'.split('').forEach(z => s.add(z));
        if (how === 'box') { if (i === t.i0) s.add('t'); if (i === t.i1) s.add('b'); if (k === t.k0) s.add('l'); if (k === t.k1) s.add('r'); }
        if (how === 't' && i === t.i0) s.add('t');
        if (how === 'b' && i === t.i1) s.add('b');
        if (how === 'l' && k === t.k0) s.add('l');
        if (how === 'r' && k === t.k1) s.add('r');
        m.set(`${o.r}:${o.p}`, how === '' ? '' : 'tblr'.split('').filter(z => s.has(z) || (how !== 'all' && how !== 'box' && String(fmtCur(o.r, o.p).bd || '').includes(z))).join(''));
      }
    });
    if (vr) fmtEach((f, x) => Object.assign(f, {bd: m.get(`${x.r}:${x.p}`) || ''}), how ? '테두리' : '테두리 없앰');
  }
  const noteAt = (r, p) => (ctx.noteOf ? ctx.noteOf(r, p) : String(fmtCur(r, p).n || '')).replace(/^​$/, '');
  const xnote = mk('xnote', 'xnote', '<textarea maxlength="900" placeholder="메모 (Ctrl+Enter 저장 · Esc 취소)"></textarea><div class="xn-b"><button type="button" data-n="del">지우기</button><button type="button" data-n="no">취소</button><button type="button" class="ok" data-n="ok">저장</button></div>');
  let noteFor = null;
  function closeNote(back) { if (xnote.hidden) return; xnote.hidden = true; noteFor = null; if (back) focusCells(); }
  function editNote() {
    if (!FMT2) { toast(NO_F2); return; }
    if (!hasCell()) { toast('메모를 넣을 칸을 먼저 고르세요', true); return; }
    const c = S.cell;
    if (!fmtCellOk(c.r, c.p) || (ctx.canEdit && !ctx.canEdit()) || (ctx.fmtWhy && ctx.fmtWhy())) { toast((ctx.fmtWhy && ctx.fmtWhy()) || ctx.noEdit || '이 칸에는 메모를 못 넣어요', true); return; }
    revealCell(c.r, c.p);
    const td = cellTd(c.r, c.p);
    if (!td) return;
    noteFor = {r: c.r, p: c.p, old: noteAt(c.r, c.p)};
    const ta = xnote.firstChild, rc = td.getBoundingClientRect();
    ta.value = noteFor.old;
    xnote.querySelector('[data-n="del"]').hidden = !noteFor.old;
    xnote.hidden = false;
    xnote.style.left = Math.max(8, rc.right + 8 + 260 > innerWidth - 8 ? rc.left - 268 : rc.right + 8) + 'px';
    xnote.style.top = Math.max(8, Math.min(rc.top, innerHeight - xnote.offsetHeight - 8)) + 'px';
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  function saveNote(del) {
    const f0 = noteFor;
    if (!f0) return;
    const t = del ? '' : xnote.firstChild.value.trim();
    closeNote(true);
    if (t === f0.old) return;
    const base = ctx.baseNote ? ctx.baseNote(f0.r, f0.p) : '';
    fmtApply(f => Object.assign(f, {n: t || (base ? '​' : '')}), t ? '메모' : '메모 지우기', [{r: f0.r, p: f0.p}]);
  }
  xnote.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (!b) return; if (b.dataset.n === 'no') closeNote(true); else saveNote(b.dataset.n === 'del'); });
  xnote.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeNote(true); }
    else if (e.key === 'Enter' && modOf(e) && !e.isComposing) { e.preventDefault(); saveNote(false); }
  });
  document.addEventListener('pointerdown', e => { if (!xnote.hidden && !e.target.closest('#xnote')) saveNote(false); }, true);   // 밖을 누르면 저장 (엑셀)

  /* ── 열 · 줄 숨기기 · 틀 고정 (이 브라우저에서만 — 저장된 자료 · 다른 사람 화면은 그대로) ── */
  const lsJ = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  const lsW = (k, o) => { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) { /* 저장 못 해도 이번 화면은 그대로 */ } };
  const LK_COL = ctx.ns + '_hidcol_v1', LK_FRZ = ctx.ns + '_freeze_v1';
  const hidColSet = ctx.hidCols ? ctx.hidCols.get : () => { const a = lsJ(LK_COL)[ctx.layoutKey()]; return new Set(Array.isArray(a) ? a : []); };
  const setHidCols = ctx.hidCols ? ctx.hidCols.set : list => { const o = lsJ(LK_COL); if (list.length) o[ctx.layoutKey()] = list; else delete o[ctx.layoutKey()]; lsW(LK_COL, o); };
  const hidRows = new Map();   // gid → Set(줄) — 새로 열면 다시 보임 (숨긴 줄을 잊지 않게)
  const hidRowSet = () => hidRows.get(S.cur) || null;
  function hideCols() {
    const d = curData();
    if (!d || !S.hk || !S.hk.size) { toast('숨길 열의 칸을 먼저 고르세요', true); return; }
    const names = d.cols.filter(c => S.hk.has(c.p) && !c.key).map(c => norm(c.name));
    if (!names.length) { toast('상품명 열은 숨기지 않아요', true); return; }
    if (S.vr && S.vr.cols.length - names.length < 1) { toast('모든 열을 숨길 수는 없어요', true); return; }
    setHidCols([...new Set([...hidColSet(), ...names])]);
    setCell(null);
    ctx.redraw();
    toast(`열 ${names.length}개를 숨겼어요 — '숨긴 열 보기'로 되돌려요 (이 PC 에서만)`);
  }
  function hideRows() {
    if (!S.hr || !S.hr.size) { toast('숨길 줄의 칸을 먼저 고르세요', true); return; }
    if (S.vr && S.hr.size >= S.vr.list.length) { toast('모든 줄을 숨길 수는 없어요', true); return; }
    const set = new Set(hidRowSet() || []), n = S.hr.size;
    S.hr.forEach(r => set.add(r));
    hidRows.set(S.cur, set);
    setCell(null);
    ctx.redraw();
    toast(`줄 ${n}개를 숨겼어요 — '숨긴 줄 보기'로 되돌려요 (이 화면에서만, 새로 열면 다시 보임)`);
  }
  function showHidden(kind) {
    if (kind !== 'row') setHidCols([]);
    if (kind !== 'col') hidRows.delete(S.cur);
    ctx.redraw();
  }
  const freezeName = () => lsJ(LK_FRZ)[ctx.layoutKey()] || '';
  function setFreeze(name) { const o = lsJ(LK_FRZ); if (name) o[ctx.layoutKey()] = name; else delete o[ctx.layoutKey()]; lsW(LK_FRZ, o); ctx.redraw(); }
  function freezeN(cols, n) {   // 왼쪽에 고정할 열 수 — 사람이 정한 것이 있으면 그것
    const nm = freezeName();
    if (!nm) return n;
    if (nm === '-') return 0;
    const i = cols.findIndex(c => norm(c.name) === nm);
    return i < 0 ? n : i + 1;
  }
  function freezeHere() {
    const d = curData(), col = d && hasCell() ? d.cols.find(c => c.p === S.cell.p) : null;
    if (!col) { toast('고정할 열의 칸을 먼저 고르세요', true); return; }
    setFreeze(norm(col.name));
    toast(`'${col.name}' 열까지 왼쪽에 고정했어요 (이 PC 에서만)`);
  }

  /* ── 찾기 · 바꾸기 (Ctrl+H) ── 지금 보이는 줄 · 칸에서. 함수 칸 · 못 고치는 칸은 안 바꿈 */
  const finder = OfficeGrid.finder({
    at: () => grid.getBoundingClientRect(),
    cells: () => { const vr = vIdx(), out = []; if (vr) vr.list.forEach(row => vr.cols.forEach(col => out.push({id: ck(row.r, col.p), r: row.r, p: col.p, t: cellRaw(row, col)}))); return out; },
    picked: () => rngCells().map(c => ck(c.r, c.p)), cur: () => (hasCell() ? ck(S.cell.r, S.cell.p) : null),
    go: c => selectCell(c.r, c.p), back: focusCells, toast, short,
    raw: c => { const x = editCtx(S.cur, c.r, c.p); return !x || roWhy(x) || x.fx || x.check ? null : rawOf(S.cur, x.r, x.p); },
    why: () => (ctx.canEdit && !ctx.canEdit() ? ctx.noEdit : ''),
    apply: (list, label, ask) => applyCells(list.map(z => ({r: z.c.r, p: z.c.p, v: z.v})), label, {ask}),
  });
  const openFind = () => { closeNote(false); finder.open(); };

  /* ── 고르기 도움 · 엑셀로 받기 · 인쇄 ── */
  function selectMany(cells, none) {   // 떨어진 칸들 고르기 (이어진 것은 한 덩어리로)
    const vr = vIdx();
    if (!vr || !cells.length) { toast(none); return; }
    const byK = new Map();
    cells.forEach(c => { const k = vr.ki.get(c.p); if (!byK.has(k)) byK.set(k, []); byK.get(k).push(vr.ri.get(c.r)); });
    const rs = [];
    byK.forEach((a, k) => { a.sort((x, y) => x - y); let s = a[0], z = a[0]; for (let q = 1; q <= a.length; q++) { if (a[q] === z + 1) { z = a[q]; continue; } rs.push({i0: s, i1: z, k}); s = z = a[q]; } });
    const last = rs.pop();
    S.multi = rs.map(t => ({a: vAt(t.i0, t.k), b: vAt(t.i1, t.k)}));
    const a = vAt(last.i0, last.k), b = vAt(last.i1, last.k);
    S.cell = {gid: S.cur, r: a.r, p: a.p};
    S.anc = S.tabP = null;
    S.cell2 = last.i1 > last.i0 ? b : null;
    paintRng();
    focusCells();
  }
  const scopeCells = () => { const cs = rngCells(), vr = vIdx(); if (cs.length > 1 || !vr || !hasCell()) return cs; return vr.list.map(x => ({r: x.r, p: S.cell.p})); };   // 한 칸만 골랐으면 그 열 전체
  const textAt = c => { const vr = vIdx(), i = vr.ri.get(c.r), k = vr.ki.get(c.p); return i === undefined || k === undefined ? '' : cellRaw(vr.list[i], vr.cols[k]).trim(); };
  function pickDup() {
    const cs = scopeCells(), m = new Map();
    cs.forEach(c => { const t = textAt(c).toLowerCase(); if (t) m.set(t, (m.get(t) || 0) + 1); });
    const dup = cs.filter(c => (m.get(textAt(c).toLowerCase()) || 0) > 1);
    selectMany(dup, '겹치는 값이 없어요');
    if (dup.length) toast(`겹치는 값 ${dup.length}칸을 골랐어요 (${[...m.values()].filter(n => n > 1).length}가지)`);
  }
  function pickBlank() { const cs = scopeCells().filter(c => textAt(c) === ''); selectMany(cs, '빈칸이 없어요'); if (cs.length) toast(`빈칸 ${cs.length}칸을 골랐어요`); }
  const stamp = () => { const d = new Date(); return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; };
  const fileName = ext => `${ctx.title()}_${stamp()}.${ext}`.replace(/[\\/:*?"<>|]+/g, '_');
  function tableRows() {   // 지금 보이는 줄(거르기 · 찾기 · 정렬 그대로) · 칸(숨긴 열 빼고)
    const vr = vIdx();
    return vr ? {head: vr.cols.map(c => c.name), rows: vr.list.map(r => vr.cols.map(c => { const x = r.byP[c.p]; return x && x.img && !x.t ? x.img : cellRaw(r, c); })), cols: vr.cols} : null;
  }
  async function exportXlsx() {
    const t = tableRows();
    if (!t || !t.rows.length) { toast('받을 내용이 없어요', true); return; }
    let X;
    try { X = await loadXLSX(); } catch (e) { exportCsv(t); return; }
    const num = v => { const s = String(v).replace(/,/g, '').trim(); return /^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(s) ? +s : null; };
    const ws = X.utils.aoa_to_sheet([t.head]);
    t.rows.forEach((r, i) => r.forEach((v, j) => {
      if (v === '' || v == null) return;
      const n = num(v);
      ws[X.utils.encode_cell({r: i + 1, c: j})] = n !== null ? {t: 'n', v: n} : {t: 's', v: String(v)};
    }));
    ws['!ref'] = X.utils.encode_range({s: {r: 0, c: 0}, e: {r: t.rows.length, c: t.head.length - 1}});
    ws['!cols'] = t.head.map((h, j) => ({wch: Math.min(46, Math.max(6, ...[h, ...t.rows.slice(0, 200).map(r => r[j])].map(v => Math.max(...String(v == null ? '' : v).split('\n').map(z => [...z].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)))) ) + 2)}));
    ws['!autofilter'] = {ref: ws['!ref']};
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, (ctx.title().replace(/[\\/:*?[\]]/g, ' ').trim() || '표').slice(0, 31));
    X.writeFile(wb, fileName('xlsx'));
    toast(`엑셀로 받기 · ${t.rows.length.toLocaleString()}줄 × ${t.head.length}열 (지금 보이는 그대로)`);
  }
  function exportCsv(t) {
    const q = s => /[",\n\r]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : s, a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + [t.head, ...t.rows].map(r => r.map(v => q(String(v == null ? '' : v))).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    a.download = fileName('csv');
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast(`엑셀로 받기(CSV) · ${t.rows.length.toLocaleString()}줄`);
  }
  function printTable() {   // 고른 범위가 두 칸 이상이면 그 범위만, 아니면 보이는 표 전체
    const vr = vIdx(), rs = selRects(), one = rs.length === 1 && nOf(rs[0]) > 1 ? rs[0] : null;
    if (!vr || !vr.list.length) { toast('인쇄할 내용이 없어요', true); return; }
    const cols = one ? vr.cols.slice(one.k0, one.k1 + 1) : vr.cols, rows = one ? vr.list.slice(one.i0, one.i1 + 1) : vr.list;
    const cell = (r, c) => { const x = r.byP[c.p], f = fmtCur(r.r, c.p), t = x && x.img ? `<img src="${esc(x.img)}">` : esc(ctx.shown ? ctx.shown(r, c) : cellRaw(r, c)); return `<td style="${f.bg ? `background:${f.bg};` : ''}${f.fg ? `color:${f.fg};` : ''}${f.b ? 'font-weight:700;' : ''}${fmtCss(f)}">${t}</td>`; };
    const fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:800px;border:0';
    document.body.appendChild(fr);
    const w = fr.contentWindow, doc = w.document;
    doc.open();
    doc.write(`<!doctype html><meta charset="utf-8"><title>${esc(ctx.title())}</title><style>@page{margin:10mm}body{margin:0;font:11px/1.4 Pretendard,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}h1{margin:0 0 8px;font-size:15px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:3px 5px;text-align:left;vertical-align:top;white-space:pre-line}th{background:#f1f5f9;font-weight:700}thead{display:table-header-group}tr{break-inside:avoid}img{max-width:46px;max-height:46px}</style><h1>${esc(ctx.title())} <small style="font-weight:400;color:#64748b">${new Date().toLocaleString('ko-KR')}</small></h1><table><thead><tr>${cols.map(c => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => cell(r, c)).join('')}</tr>`).join('')}</tbody></table>`);
    doc.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { toast('인쇄 창을 열지 못했어요', true); } setTimeout(() => fr.remove(), 60000); }, 350);
  }

  /* ── 더보기 ▾ — 위 기능들을 한 곳에 ── */
  const xmore = mk('xmore', 'xmore');
  function closeMore() { if (!xmore.hidden) xmore.hidden = true; }
  function openMore(btn) {
    if (!xmore.hidden) { closeMore(); return; }
    const M1 = IS_MAC ? '⌘' : 'Ctrl', cs = pickedFmt(), f = cs.length ? fmtCur(cs[0].r, cs[0].p) : {}, on = v => (v ? ' class="on"' : '');
    const ro = (ctx.canEdit && !ctx.canEdit()) || (ctx.fmtWhy && ctx.fmtWhy()), it = (k, t, key, dis) => `<button type="button" class="xi" data-x="${k}"${dis ? ' disabled' : ''}>${t}${key ? `<kbd>${key}</kbd>` : ''}</button>`;
    const hc = hidColSet().size, hr = (hidRowSet() || new Set()).size;
    xmore.innerHTML = (ro || !FMT2 ? '' : `<div class="xr"><span>글자</span><button type="button" data-x="i"${on(f.i)} title="기울임 (${M1}+I)"><i>가</i></button><button type="button" data-x="u"${on(f.u)} title="밑줄 (${M1}+U)"><u>가</u></button><button type="button" data-x="s"${on(f.s)} title="취소선 (${M1}+Shift+X)"><s>가</s></button><button type="button" data-x="sz-" title="글자 작게">−</button><em>${+f.sz || 13}</em><button type="button" data-x="sz+" title="글자 크게">＋</button></div>`
      + `<div class="xr"><span>맞춤</span><button type="button" data-x="al-l"${on(f.al === 'l')}>왼쪽</button><button type="button" data-x="al-c"${on(f.al === 'c')}>가운데</button><button type="button" data-x="al-r"${on(f.al === 'r')}>오른쪽</button></div>`
      + '<div class="xr"><span>테두리</span><button type="button" data-x="bd-all">모두</button><button type="button" data-x="bd-box">바깥</button><button type="button" data-x="bd-b">아래</button><button type="button" data-x="bd-t">위</button><button type="button" data-x="bd-">없음</button></div>'
      + `<div class="xr"><span>숫자</span><button type="button" data-x="nf-"${on(!f.nf)}>일반</button><button type="button" data-x="nf-c0"${on(/^c/.test(f.nf || ''))} title="쉼표 (${M1}+Shift+1)">1,234</button><button type="button" data-x="nf-p0"${on(/^p/.test(f.nf || ''))} title="퍼센트 (${M1}+Shift+5)">%</button><button type="button" data-x="nf-w0"${on(/^w/.test(f.nf || ''))}>₩</button><button type="button" data-x="nf-y2"${on(/^y/.test(f.nf || ''))}>¥</button></div>`
      + `<div class="xr"><span></span><button type="button" data-x="dec+" title="소수 자리 늘리기">.00 ＋</button><button type="button" data-x="dec-" title="소수 자리 줄이기">.0 −</button><button type="button" data-x="nf-d1"${on(f.nf === 'd1')} title="11/24">월/일</button><button type="button" data-x="nf-d2"${on(f.nf === 'd2')} title="2026-11-24">연-월-일</button></div><hr>`
      + it('note', noteAt((hasCell() ? S.cell.r : 0), (hasCell() ? S.cell.p : 0)) ? '메모 고치기' : '메모 넣기', 'Shift+F2', !hasCell()))
      + it('find', '찾기 · 바꾸기', M1 + '+H') + (ctx.formulas && !ro ? it('sum', '자동 합계 (∑)', 'Alt+=', !hasCell()) : '')
      + it('dup', '겹치는 값 고르기', '', !hasCell()) + it('blank', '빈칸 고르기', '', !hasCell())
      + (ro ? '' : it('trans', '줄 · 열 바꿔 붙여넣기', '', !hasCell()))
      + '<hr>' + it('frz', '여기까지 틀 고정', '', !hasCell()) + (freezeName() ? it('unfrz', '틀 고정 처음으로') : it('nofrz', '틀 고정 안 함'))
      + it('hcol', '고른 열 숨기기', '', !hasCell()) + it('hrow', '고른 줄 숨기기', '', !hasCell()) + (hc ? it('scol', `숨긴 열 ${hc}개 보기`) : '') + (hr ? it('srow', `숨긴 줄 ${hr}개 보기`) : '')
      + '<hr>' + it('xlsx', '엑셀로 받기') + it('print', '인쇄', M1 + '+P') + it('help', '단축키 보기');
    xmore.hidden = false;
    const rc = btn.getBoundingClientRect(), w = xmore.offsetWidth, h = xmore.offsetHeight;
    xmore.style.left = Math.max(8, Math.min(rc.right - w, innerWidth - w - 8)) + 'px';
    xmore.style.top = Math.max(8, Math.min(rc.bottom + 6, innerHeight - h - 8)) + 'px';
    xmore._rc = rc;
  }
  function doMore(k) {
    if (k === 'i') fmtToggle('i', '기울임');
    else if (k === 'u') fmtToggle('u', '밑줄');
    else if (k === 's') fmtToggle('s', '취소선');
    else if (k === 'sz+' || k === 'sz-') fmtSize(k === 'sz+' ? 1 : -1);
    else if (/^al-/.test(k)) { const a = k.slice(3), cs = pickedFmt(), same = cs.length && cs.every(c => fmtCur(c.r, c.p).al === a); fmtEach(f => Object.assign(f, {al: same ? '' : a}), '맞춤'); }
    else if (/^bd-/.test(k)) fmtBorder(k.slice(3));
    else if (/^nf-/.test(k)) fmtNumber(k.slice(3));
    else if (k === 'dec+' || k === 'dec-') fmtDec(k === 'dec+' ? 1 : -1);
    else {
      const rc = xmore._rc;
      closeMore();
      if (k === 'note') editNote();
      else if (k === 'find') openFind();
      else if (k === 'sum') autoSum();
      else if (k === 'dup') pickDup();
      else if (k === 'blank') pickBlank();
      else if (k === 'trans') { const rd = navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText() : Promise.reject(new Error('no')); rd.then(t => pasteText(t, {trans: true}), () => toast('브라우저가 클립보드 읽기를 막았어요 — 주소창 왼쪽 자물쇠에서 클립보드를 허용해 주세요', true)); }
      else if (k === 'frz') freezeHere();
      else if (k === 'unfrz') setFreeze('');
      else if (k === 'nofrz') setFreeze('-');
      else if (k === 'hcol') hideCols();
      else if (k === 'hrow') hideRows();
      else if (k === 'scol') showHidden('col');
      else if (k === 'srow') showHidden('row');
      else if (k === 'xlsx') exportXlsx();
      else if (k === 'print') printTable();
      else if (k === 'help') toggleHelp({getBoundingClientRect: () => rc});
      return;
    }
    const btn = {getBoundingClientRect: () => xmore._rc};
    closeMore();
    openMore(btn);   // 켜진 단추 표시를 새로
    focusCells();
  }
  xmore.addEventListener('mousedown', e => e.preventDefault());
  xmore.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b && !b.disabled) doMore(b.dataset.x); });
  document.addEventListener('pointerdown', e => {
    if (!xmore.hidden && !e.target.closest('#xmore,[data-fmt="more"],.more')) closeMore();
    if (!xhelp.hidden && !e.target.closest('#xhelp')) xhelp.hidden = true;
  }, true);
  addEventListener('resize', closeMore);
  document.addEventListener('keydown', e => {   // Esc — 떠 있는 작은 창부터
    if (e.key !== 'Escape') return;
    if (!xmore.hidden) closeMore();
    else if (!xhelp.hidden) xhelp.hidden = true;
    else if (S.paint && ctx.paintStop) ctx.paintStop();
    else return;
    focusCells();
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  function xlKey(e, kk) {   // Ctrl(⌘) 단축키 더 — 했으면 true
    const c = e.code || '';
    if (!e.shiftKey) {
      if (kk === 'h') { openFind(); return true; }
      if (kk === 'g') { fxN.focus(); fxN.select(); return true; }
      if (kk === 'i' || kk === 'u') { if (!FMT2) toast(NO_F2); else fmtToggle(kk, kk === 'i' ? '기울임' : '밑줄'); return true; }
      if (kk === 'p') { printTable(); return true; }
      return false;
    }
    const f2 = fn => { if (FMT2) fn(); else toast(NO_F2); return true; };
    if (kk === 'x') return f2(() => fmtToggle('s', '취소선'));
    if (kk === 'l') { if (ctx.openFilter) ctx.openFilter(S.cell.p); return true; }
    if (c === 'Digit1') return f2(() => fmtNumber('c0'));
    if (c === 'Digit4') return f2(() => fmtNumber('w0'));
    if (c === 'Digit5') return f2(() => fmtNumber('p0'));
    if (c === 'Backquote') return f2(() => fmtNumber(''));
    return false;
  }

  /* 단축키 안내 */
  function toggleHelp(btn) {
    if (!xhelp.hidden) { xhelp.hidden = true; return; }
    const M1 = IS_MAC ? '⌘' : 'Ctrl', L = [
      ['누르기 · 끌기', '칸 고르기 · 네모 범위 고르기'],
      ['Shift+누르기 · Shift+화살표', '여기까지 범위로 고르기'],
      [`${M1}+누르기 · 끌기`, '떨어진 칸 더 고르기 (고른 칸을 다시 누르면 빼기)'],
      ['머리글 · 행 번호', `열 전체 · 줄 전체 고르기 (끌기 · Shift · ${M1} 도) · 왼쪽 위 ‘행’ = 전부`],
      ['행 번호 두 번 누르기', '그 줄 상세 창'],
      ['두 번 누르기 · F2', '글자 사이에서 고치기'],
      ['바로 글자 치기', '새로 쓰기 (화살표 · Enter · Tab 으로 저장하고 옮김)'],
      ['Enter · Shift+Enter · Tab', '아래 · 위 · 오른쪽으로'],
      ['Alt+Enter', '칸 안에서 줄바꿈'],
      [`${M1}+Enter`, '고른 칸 전부에 같은 값 넣기'],
      ['Alt+↓', '같은 열에 쓴 값에서 고르기'],
      ['Esc', '고치기 취소 · 복사 점선 없애기'],
      ['Delete · Backspace', '지우기 · 비우고 고치기'],
      [`${M1}+C · X · V`, '복사 · 잘라내기(옮기기) · 붙여넣기 (엑셀 · 구글시트와 주고받기)'],
      [`${M1}+Shift+V`, '값만 붙여넣기'],
      [`${M1}+Z · ${M1}+Y`, '되돌리기 · 다시 실행'],
      [`${M1}+D · 파란 네모 끌기`, '아래로 채우기 · 끌어서 채우기 (두 번 누르면 끝까지)'],
      [`${M1}+H · ${M1}+F`, '찾기 · 바꾸기 · 줄 찾기'],
      ...(FMT2 ? [[`${M1}+B · I · U · ${M1}+Shift+X`, '굵게 · 기울임 · 밑줄 · 취소선'], [`${M1}+Shift+1 · 4 · 5`, '1,234 · ₩ · % 로 보기'], ['Shift+F2', '메모 넣기 · 고치기']] : [[`${M1}+B`, '굵게']]),
      [`${M1}+화살표 (+Shift)`, '글이 이어진 끝으로 가기 (고르기)'],
      [`Home · End · ${M1}+Home · End`, '줄 처음 · 끝 · 표 처음 · 끝'],
      ['PageUp · PageDown', '한 화면 위 · 아래 (Alt 와 같이 = 옆으로)'],
      [`Shift+Space · ${M1}+Space · ${M1}+A`, '줄 전체 · 열 전체 · 전부 고르기'],
      [`${M1}+G`, '칸으로 가기 (이름 상자)'],
      [`${M1}+; · ${M1}+Shift+;`, '오늘 날짜 · 지금 시각'],
      [`머리글 ▾ · ${M1}+Shift+L`, '정렬 · 값으로 걸러보기'],
      [`${M1}+P`, '인쇄 (범위를 고르면 그 범위만)'],
    ].concat(ctx.formulas ? [['= 로 시작', '함수 — 칸을 누르거나 화살표 = 주소, F4 = $ 고정'], ['Alt+=', '자동 합계']] : ctx.calcEntry ? [['=120-30', '계산한 값으로 넣기']] : []).concat(ctx.helpExtra || []);
    xhelp.innerHTML = '<h4>단축키 — 엑셀과 같아요</h4><dl>' + L.map(x => `<dt>${x[0]}</dt><dd>${x[1]}</dd>`).join('') + '</dl>';
    xhelp.hidden = false;
    const rc = btn.getBoundingClientRect(), w = xhelp.offsetWidth, hh = xhelp.offsetHeight;
    xhelp.style.left = Math.max(8, Math.min(rc.right - w, innerWidth - w - 8)) + 'px';
    xhelp.style.top = Math.max(8, Math.min(rc.bottom + 6, innerHeight - hh - 8)) + 'px';
  }

    return {CE, IS_MAC, cellMode, cellTd, hasCell, cellTip, hideTip, vIdx, rngCells, selRects, curRect, inSel, calcRng, selCls, paintRng, paintHeadSel, setCell, selectCell, extendTo, pickRows, pickCols, pickAll,
      revealCell, nextCell, gridKey, focusCells, placeIdle, placeCell, startEdit, commitCell, closeCell, cancelEdit, paintFx, selStat, cellRaw, viewBox, fxBar, fxIn, fxN,
      UNDO, REDO, pushUndo, undo, redo, selTsv, setClip, parseTsv, pasteText, clearSel, fillDown, applyCells, gridKeys, idleReset, fmtCellOk,
      editNote, noteAt, openFind, fmt2: () => FMT2, openMore, closeMore, toggleHelp, exportXlsx, printTable, hidColSet, setHidCols, hidRowSet, showHidden, hideCols, hideRows, freezeN, freezeName, autoSum, askBig};
  };
  Object.assign(window.OfficeGrid, {finder, calc, shiftFx, fmtPack, fmtSame, fmtCss, fmtText, loadXLSX, colNo, colTx});
  const OfficeGrid = window.OfficeGrid;
})();
