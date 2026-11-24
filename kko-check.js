/* 확인할 것 — 시나리오 북 안 대화창 (2026-11-24 사장님 "시나리오 북에 … 확인해야하는거 대화창처럼 다 띄워줘"
   → 같은 날 "이전에 완료된 답변이나 이미 지나온것들은 궁금하지않아 … 지금 완벽하게 답변을 준비 못한확인해야할것들을 다 정리해보자").
   CS팀 → 에이전트 학습 → [시나리오 북] 의 첫 화면(관리자만). 아직 답을 준비 못 한 질문만 하나씩 카카오톡 대화창으로 — 고객이 하는 말 · 확인한 것 · 추천 답, 창마다 [추천대로] 를 누르거나 답을 적는다.
   지나간 시험 대화 · 끝난 답 · 직원 할 일은 여기 없다 (되살리지 말 것 — 시험 결과는 [시험 답변]).
   · 읽기 GET /cs/kakao-check (맥미니 프록시 scripts/cs_kakao.py check ← state/kakao/learn/questions.json, 고객 글 없음). 반영이 끝난 질문은 서버가 빼서 준다.
   · 적기 POST /cs/kakao-check — 사무실에서만. 적어 두기만 한다: 고객에게 안 나가고 규칙도 바로 안 바뀐다 (학습 세션이 check-answers.json 을 읽어 반영).
   · 답은 이 브라우저에 먼저 적어 두고(OUT) 보낸다 — 끊기면 저절로 다시, 번호가 같아 두 번 안 들어간다. 적다 만 글도 남는다(DRAFT).
   · 창은 한 번 그리면 다시 그리지 않는다 (적는 중에 글이 사라지지 않게) — 답을 적으면 그 창의 말풍선 · 표시만 바꾼다.
   말풍선 모양은 채팅방 창(.kko-msg) 그대로 쓴다. 고리: index.html kkoBookOpen · _kkoBookPaint 가 KkoCheck 를 부른다. */
(function () {
'use strict';
if (window.KkoCheck) return;
const OUT = 'bb_kko_check_out_v1', DRAFT = 'bb_kko_check_draft_v1';
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const N = v => Number(v || 0).toLocaleString('ko-KR');
const p2 = v => String(v).padStart(2, '0');
const G = [   // 묶음 — 이름 · 설명 · 적는 칸 안내
  ['ask', '정해 주셔야 하는 것', '사장님만 아시는 사실이라 추측하지 않고 여쭤보는 것들이에요. 맞으면 [추천대로], 다르면 적어 주세요.', '답을 적어 주세요'],
  ['rec', '추천 답 확인', '직원들이 실제로 해 온 답과 상품 · 주문 자료로 만든 답이에요. 틀린 것만 고쳐 주세요.', '다르게 답해야 하면 적어 주세요'],
];
const GM = new Map(G.map(g => [g[0], g]));
const S = {data: null, err: '', loading: false, box: null, f: 'all', brand: '', q: '', qt: 0, by: new Map(), rows: new Map(), done0: new Set(), out: [], sending: false, tm: 0, wait: 0, sig: ''};

const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
const me = () => { try { return (localStorage.getItem('brightbeed_diary_me') || '').trim().slice(0, 20); } catch (e) { return ''; } };
const master = () => { try { return localStorage.getItem('brightbeed_role') === 'master'; } catch (e) { return false; } };
const rid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
const touch = () => { try { return matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } };

/* ── 서버 ── */
async function api(body) {
  const base = await loadProxyBase();
  if (!base) throw new Error('서버에 연결되지 않았어요');
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 30000);
  try {
    const r = await fetch(base + '/cs/kakao-check', {method: body ? 'POST' : 'GET', headers: Object.assign({'X-Brightbeed-PIN': ghPin(), 'Accept': 'application/json'}, body ? {'Content-Type': 'application/json'} : {}),
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: ac.signal});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { const e = new Error(j.error || 'HTTP ' + r.status); e.no = [400, 403, 409, 413].includes(r.status); throw e; }   // 다시 보내도 안 받는 것
    return j;
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('응답이 늦어요');
    throw e;
  } finally { clearTimeout(tm); }
}
async function load() {
  if (S.loading) return;
  S.loading = true;
  try {
    const j = await api();
    S.err = '';
    const sig = JSON.stringify([j.outside, (j.items || []).map(x => [x.key, x.no, x.title, x.seen, x.ask, x.rec, x.q])]);
    const same = S.data && S.sig === sig;
    S.data = j; S.sig = sig;
    S.by = new Map((j.items || []).map(x => [x.key, x]));
    merge(j.rows || []);
    if (!same) { S.done0 = new Set([...S.rows].filter(([, v]) => v.length).map(([k]) => k)); build(true); }
    else { S.by.forEach((_, k) => mark(k)); counts(); filter(); }
  } catch (e) { S.err = (e && e.message) || String(e); if (!S.data) build(true); }
  finally { S.loading = false; }
  if (S.out.length) push();
}
// 서버에 적힌 답 + 아직 못 보낸 답 (같은 번호는 하나로)
function merge(rows) {
  S.rows = new Map();
  const add = r => { if (!S.rows.has(r.key)) S.rows.set(r.key, []); const xs = S.rows.get(r.key); if (!xs.some(x => x.id === r.id)) xs.push(r); };
  const gone = new Set(S.out.filter(o => o.del).map(o => o.id));
  rows.forEach(r => { if (!gone.has(r.id)) add(r); });
  S.out.forEach(o => { if (!o.del) add(o); });
  S.rows.forEach(xs => xs.sort((a, b) => (a.at || 0) - (b.at || 0)));
}

/* ── 답 적기 ── */
function say(key, v, text) {
  const it = S.by.get(key);
  if (!it) return;
  const row = {id: rid(), key, v, text: String(text || '').trim().slice(0, 1500), at: Date.now(), by: me()};
  S.out.push(row); ls(OUT, S.out);
  if (!S.rows.has(key)) S.rows.set(key, []);
  S.rows.get(key).push(row);
  mark(key); counts();
  push();
}
function undo(key, id) {
  const xs = S.rows.get(key) || [], r = xs.find(x => x.id === id);
  if (!r) return;
  S.rows.set(key, xs.filter(x => x.id !== id));
  const k = S.out.findIndex(o => o.id === id && !o.del);
  if (k >= 0 && !S.out[k].tried) S.out.splice(k, 1);          // 아직 한 번도 안 보냄
  else { if (k >= 0) S.out.splice(k, 1); S.out.push({id, key, del: true}); }
  ls(OUT, S.out);
  if (r.v === 'text' && r.text) { const ta = win(key) && win(key).querySelector('.kck-ta'); if (ta && !ta.value.trim()) { ta.value = r.text; draft(key, r.text); grow(ta); } }
  mark(key); counts();
  push();
}
async function push() {
  if (S.sending || !S.out.length) return;
  S.sending = true; clearTimeout(S.tm);
  try {
    while (S.out.length) {
      const o = S.out[0];
      o.tried = true;
      try {
        await api(o.del ? {id: o.id, del: true} : {id: o.id, key: o.key, v: o.v, text: o.text, by: o.by});
        S.out = S.out.filter(x => x !== o); ls(OUT, S.out); S.wait = 0;
        note(o.key, ''); mark(o.key);
      } catch (e) {
        if (e && e.no) {                                       // 서버가 안 받음 — 적은 글을 칸에 되돌려 놓음
          S.out = S.out.filter(x => x !== o); ls(OUT, S.out);
          if (!o.del) {
            S.rows.set(o.key, (S.rows.get(o.key) || []).filter(x => x.id !== o.id));
            const ta = win(o.key) && win(o.key).querySelector('.kck-ta');
            if (o.text && ta && !ta.value.trim()) { ta.value = o.text; draft(o.key, o.text); grow(ta); }
            else if (o.text && !ta) draft(o.key, o.text);
          }
          mark(o.key); counts(); note(o.key, '저장 안 됨 — ' + e.message, true);
          continue;
        }
        note(o.key, '아직 저장 안 됨 — 다시 보내는 중', true);
        S.wait = Math.min(S.wait ? S.wait * 2 : 2000, 30000);
        S.tm = setTimeout(push, S.wait);
        break;
      }
    }
  } finally { S.sending = false; }
}
addEventListener('online', () => push());
addEventListener('beforeunload', e => { if (S.out.length) { e.preventDefault(); e.returnValue = ''; } });

function draft(key, text) {
  const d = ls(DRAFT) || {};
  if (text && text.trim()) d[key] = text.slice(0, 1500); else delete d[key];
  ls(DRAFT, d);
}

/* ── 그리기 ── */
const win = key => S.box && S.box.querySelector(`.kck-w[data-k="${key}"]`);
const when = v => { const t = new Date(v); return isNaN(t) ? '' : `${t.getMonth() + 1}/${t.getDate()} ${p2(t.getHours())}:${p2(t.getMinutes())}`; };
const AV = `<span class="kko-mav" aria-hidden="true">${typeof KKO_AV === 'string' ? KKO_AV : ''}</span>`;
const bub = (side, who, text, o) => { o = o || {};
  return `<div class="kko-msg ${side}${o.cont ? '' : ' g'} ${o.cls || ''}"${o.id ? ` data-r="${E(o.id)}"` : ''}>${side === 'c' && !o.cont ? AV : ''}<div class="kko-mcol">${who && !o.cont ? `<span class="who">${E(who)}</span>` : ''}`
    + `<div class="kko-mrow"><div class="kko-mb"><div class="b">${text}</div></div>${o.t ? `<span class="t">${E(o.t)}</span>` : ''}${o.x || ''}</div></div></div>`; };
const memo = h => `<div class="kck-memo">${h}</div>`;
// 고객이 하는 말 → 확인한 것 → (물음) → 추천 답
function askHtml(x) {
  return (x.q || []).map((t, i) => bub('c', '고객', E(t), {cont: i > 0})).join('')
    + (x.seen ? memo(E(x.seen)) : '')
    + (x.ask ? bub('c', '에이전트', E(x.ask), {cls: 'kck-ask'}) : '')
    + (x.rec ? bub('o', '추천 답', E(x.rec), {cls: 'kck-ai'}) : '');
}
const label = (x, r) => r.v === 'ok' ? '추천대로' : r.v === 'skip' ? '직원이 할게요' : r.text;
function meHtml(x) {
  const pend = new Set(S.out.map(o => o.id));
  return (S.rows.get(x.key) || []).map(r => bub('o', r.by || '내가 적은 답', E(label(x, r)), {cls: 'kck-me', id: r.id, t: pend.has(r.id) ? '보내는 중' : when(r.at),
    x: `<button type="button" class="kck-un" data-id="${E(r.id)}" title="이 답 지우기" aria-label="이 답 지우기">✕</button>`})).join('');
}
const CHIPS = '<button type="button" data-v="ok">추천대로</button><button type="button" data-v="skip">직원이 할게요</button>';
const brandsOf = x => String(x.brand || '').split(' · ').map(t => t.trim()).filter(Boolean);
function winHtml(x, dr) {
  const g = GM.get(x.group) || [], ro = S.data.outside, find = [x.no, x.brand, x.title, (x.q || []).join(' '), x.seen, x.ask, x.rec].join(' ').toLowerCase();
  return `<article class="kck-w" data-k="${E(x.key)}" data-g="${E(x.group)}" data-b="${E(brandsOf(x).join('|'))}" data-s="${E(find)}" aria-label="${E(x.no)}번 ${E(x.title)}">`
    + `<header class="kck-h"><span class="no">${E(x.no)}</span><b>${E(x.title)}</b><span class="t">${E(x.brand)}</span><span class="st" aria-live="polite"></span></header>`
    + `<div class="kck-log"><div class="in">${askHtml(x)}<div class="kck-mine">${meHtml(x)}</div></div></div>`
    + (ro ? '' : `<footer class="kck-f"><div class="kck-c">${CHIPS}</div><div class="kck-in"><textarea class="kck-ta" rows="1" maxlength="1500" placeholder="${E(g[3] || '답 적기')}" aria-label="${E(g[3] || '답 적기')}">${E(dr[x.key] || '')}</textarea><button type="button" class="kck-go">적기</button></div><div class="kck-msg" aria-live="polite"></div></footer>`)
    + `</article>`;
}
function seg(view) {
  const left = S.data ? leftN() : null;
  return `<div class="kck-seg" role="tablist" aria-label="시나리오 북 보기"><button type="button" role="tab" aria-selected="${view === 'check'}" onclick="kkoBookView('check')">확인할 것<em id="kckSegN">${left ? N(left) : ''}</em></button>`
    + `<button type="button" role="tab" aria-selected="${view === 'book'}" onclick="kkoBookView('book')">시나리오</button></div>`;
}
const isDone = k => (S.rows.get(k) || []).length > 0;
const leftN = g => (S.data ? S.data.items : []).filter(x => (!g || x.group === g) && !isDone(x.key)).length;
// 창을 새로 그림 — 처음 열 때 · 시험 결과가 바뀌었을 때만
function build(force) {
  const box = S.box;
  if (!box || !box.isConnected || (window._kkoCheckOn && !window._kkoCheckOn())) return;
  if (!force && box.querySelector('.kck-root')) return;
  const d = S.data, dr = ls(DRAFT) || {}, items = d ? d.items : [];
  const brands = [...new Set(items.flatMap(brandsOf))].filter(b => !/전체$/.test(b));
  if (S.brand && !brands.includes(S.brand)) S.brand = '';
  const head = `<div class="kbk-head"><h2 id="kbkTitle">시나리오 북</h2>${seg('check')}<span class="sub">아직 답을 준비 못 한 질문 · 고객에게 나가지 않아요</span>`
    + `<div class="ctl">${d ? `<select id="kckB" aria-label="브랜드"><option value="">모든 브랜드</option>${brands.map(b => `<option value="${E(b)}"${b === S.brand ? ' selected' : ''}>${E(b)}</option>`).join('')}</select>` : ''}`
    + `<input type="search" id="kckQ" placeholder="찾기 — 쿠폰 · 실버 · 반품" value="${E(S.q)}" aria-label="확인할 것에서 찾기" autocomplete="off">`
    + `<button type="button" class="kbk-x" id="kbkX" onclick="kkoBookClose()" aria-label="닫기" title="닫기 (Esc)">✕</button></div></div>`;
  if (!d) {
    box.innerHTML = `<div class="kbk-in kck-root" role="dialog" aria-modal="true" aria-labelledby="kbkTitle">${head}<div class="kbk-empty">${S.err ? '불러오지 못했어요 — ' + E(S.err) + ' <button type="button" class="kck-re">다시</button>' : '불러오는 중…'}</div></div>`;
  } else {
    const nav = `<nav class="kbk-nav" aria-label="확인할 것 묶음"><button type="button" data-f="all">전체<em></em></button>${G.filter(g => items.some(x => x.group === g[0])).map(g => `<button type="button" data-f="${g[0]}">${E(g[1])}<em></em></button>`).join('')}<button type="button" data-f="done">확인 끝<em></em></button></nav>`;
    const secs = G.map(g => { const xs = items.filter(x => x.group === g[0]); return xs.length ? `<section class="kck-g" data-g="${g[0]}"><h3>${E(g[1])} <em></em></h3><p>${E(g[2])}${g[0] === 'rec' && !d.outside ? ' <button type="button" class="kck-all">남은 것 모두 추천대로</button>' : ''}</p><div class="kck-grid">${xs.map(x => winHtml(x, dr)).join('')}</div></section>` : ''; }).join('');
    const warn = d.outside ? '<div class="kck-out">답 적기는 사무실에서만 할 수 있어요.</div>' : '';
    box.innerHTML = `<div class="kbk-in kck-root" role="dialog" aria-modal="true" aria-labelledby="kbkTitle">${head}<div class="kbk-body">${nav}<div class="kbk-main kck-main" id="kckMain">${warn}${secs}<div class="kbk-empty" id="kckNone" hidden>맞는 것이 없어요.</div></div></div></div>`;
    items.forEach(x => mark(x.key));
    box.querySelectorAll('.kck-ta').forEach(ta => { if (ta.value) grow(ta); });
  }
  bind(box);
  counts(); filter();
}
function bind(box) {
  const root = box.querySelector('.kck-root');
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('kck-re')) { S.err = ''; build(true); load(); return; }
    if (b.classList.contains('kck-all')) { S.data.items.filter(x => x.group === 'rec' && !isDone(x.key)).forEach(x => say(x.key, 'ok', '')); return; }
    if (b.dataset.f) { S.f = b.dataset.f; filter(); const m = document.getElementById('kckMain'); if (m) m.scrollTop = 0; return; }
    const w = b.closest('.kck-w');
    if (!w) return;
    const key = w.dataset.k;
    if (b.classList.contains('kck-un')) undo(key, b.dataset.id);
    else if (b.classList.contains('kck-go')) send(w);
    else if (b.dataset.v) say(key, b.dataset.v, '');
  });
  root.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'kckQ') { S.q = t.value; clearTimeout(S.qt); S.qt = setTimeout(filter, 150); }
    else if (t.classList.contains('kck-ta')) { draft(t.closest('.kck-w').dataset.k, t.value); grow(t); }
  });
  root.addEventListener('change', e => { if (e.target.id === 'kckB') { S.brand = e.target.value; filter(); } });
  // PC 는 Enter = 적기 (Shift+Enter 줄 바꿈), 한글을 조합하는 중에는 안 보냄. 휴대폰은 [적기] 로만
  root.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229 || touch() || !e.target.classList.contains('kck-ta')) return;
    e.preventDefault(); send(e.target.closest('.kck-w'));
  });
}
function send(w) {
  const ta = w.querySelector('.kck-ta'), t = ta ? ta.value.trim() : '';
  if (!t) { if (ta) ta.focus(); return; }
  ta.value = ''; draft(w.dataset.k, ''); grow(ta);
  say(w.dataset.k, 'text', t);
}
function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 120) + 'px'; }
function note(key, text, bad) { const w = win(key), m = w && w.querySelector('.kck-msg'); if (m) { m.textContent = text; m.classList.toggle('bad', !!bad); } }
// 그 창의 내 말풍선 · 표시만 바꿈
function mark(key) {
  const w = win(key), x = S.by.get(key);
  if (!w || !x) return;
  const m = w.querySelector('.kck-mine'), h = meHtml(x);
  if (m && m._h !== h) { m.innerHTML = h; m._h = h; }
  const dn = isDone(key);
  w.classList.toggle('done', dn);
  const st = w.querySelector('.kck-h .st'), t = dn ? '✓ 확인' : '';
  if (st && st.textContent !== t) st.textContent = t;
}
function counts() {
  const box = S.box;
  if (!box || !S.data) return;
  const set = (el, v) => { if (el) el.textContent = v; };
  box.querySelectorAll('.kbk-nav button[data-f]').forEach(b => { const f = b.dataset.f;
    set(b.querySelector('em'), N(f === 'all' ? leftN() : f === 'done' ? S.data.items.length - leftN() : leftN(f))); });
  box.querySelectorAll('.kck-g').forEach(s => set(s.querySelector('h3 em'), N(leftN(s.dataset.g))));
  set(document.getElementById('kckSegN'), leftN() ? N(leftN()) : '');
}
// 걸러 보기 — 숨기기만. 전에 확인을 끝낸 창은 '확인 끝' 에서만, 지금 확인한 창은 그 자리에 남김
function filter() {
  const box = S.box;
  if (!box || !S.data) return;
  const q = S.q.trim().toLowerCase();
  let any = 0;
  box.querySelectorAll('.kbk-nav button[data-f]').forEach(b => b.setAttribute('aria-current', String(b.dataset.f === S.f)));
  box.querySelectorAll('.kck-g').forEach(s => {
    let n = 0;
    s.querySelectorAll('.kck-w').forEach(w => {
      const k = w.dataset.k, dn = isDone(k);
      const ok = (S.f === 'done' ? dn : (S.f === 'all' || S.f === w.dataset.g) && !(dn && S.done0.has(k))) && (!S.brand || w.dataset.b.split('|').some(b => b === S.brand || /전체$/.test(b))) && (!q || w.dataset.s.includes(q));
      w.hidden = !ok; if (ok) n++;
    });
    s.hidden = !n; any += n;
  });
  const none = document.getElementById('kckNone');
  if (none) { none.hidden = any > 0; none.textContent = S.f === 'done' ? '아직 확인한 것이 없어요.' : q || S.brand ? '맞는 것이 없어요.' : '다 확인했어요.'; }
}

const st = document.createElement('style');
st.textContent = `
.kck-seg{display:inline-flex;padding:3px;border-radius:10px;background:var(--kko-pill)}
.kck-seg button{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:0 14px;border:0;border-radius:8px;background:none;color:#666;font:inherit;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}
.kck-seg button[aria-selected="true"]{background:#fff;color:var(--kko-ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.kck-seg em{font-style:normal;font-variant-numeric:tabular-nums;color:var(--kko-redt)}
.kck-seg em:empty{display:none}
.kck-root .kbk-nav button[aria-current="true"]{background:var(--kko-ink);color:#fff}
.kck-root .kbk-nav button[aria-current="true"] em{color:#fff}
.kck-root .kbk-nav button span{min-width:0}
.kck-main{background:#f7f8f9}
.kck-g{margin:0 0 34px}
.kck-g[hidden],.kck-w[hidden],#kckNone[hidden]{display:none}
.kck-g>h3{margin:0 0 4px;font-size:16px;font-weight:800}
.kck-g>h3 em{font-style:normal;color:var(--kko-redt);font-variant-numeric:tabular-nums}
.kck-g>p{margin:0 0 12px;font-size:12.5px;line-height:1.55;color:#666}
.kck-out{margin:0 0 16px;padding:10px 14px;border-radius:10px;background:#fff;border:1px solid #ececec;font-size:13px;color:#555}
.kck-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.kck-w{display:flex;flex-direction:column;border-radius:14px;overflow:hidden;background:var(--kko-sky);box-shadow:0 1px 4px rgba(0,0,0,.14)}
.kck-w.done{background:#d5dbe0}
.kck-h{flex:none;display:flex;align-items:center;gap:6px 8px;flex-wrap:wrap;padding:10px 12px 9px;background:rgba(255,255,255,.55)}
.kck-h b{font-size:14px;font-weight:800;color:var(--kko-ink)}
.kck-h .t{font-size:11.5px;color:#4a5763;font-variant-numeric:tabular-nums}
.kck-h .no{flex:none;min-width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:var(--kko-ink);color:#fff;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
.kck-h .st{margin-left:auto;font-size:12px;font-weight:800;color:var(--kko-ink)}
.kck-log{flex:1;min-height:0}
.kck-log .in{display:flex;flex-direction:column;padding:2px 12px 14px}
.kck-log .in>.kck-mine{display:flex;flex-direction:column}
.kck-log .kko-mcol{max-width:84%}
.kck-log .kko-msg.c .kko-mcol{max-width:calc(100% - 60px)}
.kck-log .kko-msg .b{font-size:13px}
.kko-msg.kck-ai .b{box-shadow:0 0 0 2px var(--kko-ink)}
.kko-msg.kck-ai.g.o .kko-mb>.b:first-child::before{display:none}
.kko-msg.kck-ask .b{font-weight:700}
.kko-msg.kck-me .b{background:var(--kko-ink);color:#fff}
.kko-msg.kck-me.g.o .kko-mb>.b:first-child::before{background:var(--kko-ink)}
.kck-un{flex:none;width:26px;height:26px;border:0;border-radius:999px;background:rgba(255,255,255,.6);color:#444;font-size:11px;font-family:inherit;cursor:pointer}
.kck-un:hover{background:#fff}
.kck-memo{align-self:stretch;margin:8px 0 0;padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.62);font-size:12px;line-height:1.5;color:#333;overflow-wrap:anywhere}
.kck-all{margin-left:8px;min-height:32px;padding:0 13px;border:1.5px solid #dcdcdc;border-radius:999px;background:#fff;color:var(--kko-ink);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.kck-all:hover{border-color:var(--kko-ink)}
.kck-f{flex:none;display:flex;flex-direction:column;gap:7px;padding:9px 10px 10px;background:#fff}
.kck-c{display:flex;gap:6px;flex-wrap:wrap}
.kck-c button{min-height:34px;padding:0 13px;border:1.5px solid #dcdcdc;border-radius:999px;background:#fff;color:var(--kko-ink);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.kck-c button:hover{border-color:var(--kko-ink)}
.kck-in{display:flex;align-items:flex-end;gap:6px}
.kck-ta{flex:1;min-width:0;min-height:38px;max-height:120px;padding:8px 12px;border:1px solid transparent;border-radius:10px;background:var(--kko-pill);color:var(--kko-ink);font:inherit;font-size:13px;line-height:1.5;resize:none;box-sizing:border-box}
.kck-ta:focus{outline:none;border-color:var(--kko-ink);background:#fff}
.kck-go{flex:none;min-height:38px;padding:0 15px;border:0;border-radius:10px;background:var(--kko-yellow);color:var(--kko-ink);font:inherit;font-size:13px;font-weight:800;cursor:pointer}
.kck-go:hover{background:var(--kko-yellow-h)}
.kck-msg{font-size:12px;color:#666}
.kck-msg:empty{display:none}
.kck-msg.bad{color:var(--kko-redt);font-weight:700}
.kck-re{margin-left:8px;min-height:32px;padding:0 12px;border:0;border-radius:8px;background:var(--kko-pill);font:inherit;font-weight:700;cursor:pointer}
@media (max-width:760px){
  .kck-grid{grid-template-columns:minmax(0,1fr)}
  .kck-seg{order:3;width:100%}
  .kck-seg button{flex:1;justify-content:center;min-height:38px}
  .kck-root .kbk-head .ctl{order:4}
  .kck-root .kbk-head .sub{display:none}
  .kck-c button,.kck-go,.kck-ta{min-height:42px}
  .kck-un{width:34px;height:34px}
  .kck-ta{font-size:16px}
}`;
document.head.appendChild(st);

S.out = (ls(OUT) || []).filter(o => o && o.id && o.key);
window.KkoCheck = {
  show(box) { S.box = box; build(!box.querySelector('.kck-root')); },
  open(box) { S.box = box; S.f = 'all'; if (S.data) S.done0 = new Set([...S.rows].filter(([, v]) => v.length).map(([k]) => k)); load(); },
  seg, master, load,
  typing() { const a = document.activeElement; return !!(a && a.classList && a.classList.contains('kck-ta') && a.value.trim()); },
};
})();
