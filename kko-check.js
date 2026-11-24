/* 확인할 것 — 시나리오 북 안 대화창 (2026-11-24 사장님 "cs 시험답변 왜 안뜨냐 시나리오 북에 그리고 확인해야하는거 대화창처럼 다 띄워줘")
   CS팀 → 에이전트 학습 → [시나리오 북] 의 첫 화면. 정해 주셔야 할 것 · 시험 답변 · 직원 할 일을 하나씩 카카오톡 대화창으로 다 띄우고, 창마다 [맞아요] 를 누르거나 답을 적는다.
   · 읽기 GET /cs/kakao-check (맥미니 프록시 scripts/cs_kakao.py check) — 시험 답의 가린 고객 대화는 관리자 + 사무실 인터넷에서만, 밖이면 건수만.
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
const G = [   // 묶음 — 이름 · 설명 · [맞아요] 글자 · [다른 답] 글자 · 적는 칸 안내
  ['decide', '정해 주셔야 할 것', '답이 비어 있어 지금은 모두 직원에게 넘기는 것들이에요. 적어 주신 답을 모아 에이전트 답에 넣어요.', '', '직원이 계속 할게요', '이렇게 안내해 주세요'],
  ['bad', '아쉽거나 틀린 시험 답', '채점에서 아쉽거나 틀렸다고 나온 답이에요. 어떻게 답해야 하는지 적어 주세요.', '이 답도 괜찮아요', '직원이 해야 해요', '이렇게 답해야 해요'],
  ['wait', '그때 답 기다리던 문의', '시험을 돌린 때 답을 기다리던 문의예요. 채점은 없어요.', '이 답이 맞아요', '직원이 해야 해요', '다르게 답해야 하면 적어 주세요'],
  ['staff', '직원에게 넘긴 것', '에이전트가 답하지 않고 직원을 부른 문의예요. 에이전트가 답해도 되면 그 답을 적어 주세요.', '직원이 맞아요', '', '에이전트가 답해도 되면 그 답을 적어 주세요'],
  ['todo', '답하고 처리할 일로 남긴 것', '고객에게는 에이전트가 답하고, 손으로 할 일만 직원 목록에 남기는 문의예요.', '이 답이 맞아요', '직원이 해야 해요', '다르게 답해야 하면 적어 주세요'],
  ['ask', '정보를 물은 것', '주문을 찾으려고 성함 · 연락처 · 사진을 먼저 물은 문의예요.', '이 답이 맞아요', '직원이 해야 해요', '다르게 답해야 하면 적어 주세요'],
  ['answer', '바로 답한 것', '직원 없이 에이전트가 바로 답한 문의예요.', '이 답이 맞아요', '직원이 해야 해요', '다르게 답해야 하면 적어 주세요'],
  ['work', '직원 할 일', '카나나 설정처럼 직원이 손으로 고쳐야 하는 것들이에요. 끝낸 것은 [했어요] 를 눌러 주세요.', '했어요', '안 해도 돼요', '남길 말'],
];
const GM = new Map(G.map(g => [g[0], g]));
const ACT = {answer: '바로 답', ask: '정보를 물음', staff: '직원에게 넘김', todo: '답하고 처리할 일로'};
const GRADE = {bad: '틀림', weak: '아쉬움'};
const WHO = {staff: '직원', ai: '카나나', bot: '자동응답'};
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
    const sig = JSON.stringify([j.testAt, j.bookAt, j.outside, (j.items || []).map(x => x.key)]);
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
  mark(key); counts(); tail(key);
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
const hm = s => { const m = /(\d\d):(\d\d)$/.exec(s || ''); if (!m) return ''; const h = +m[1]; return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m[2]}`; };
const dayKo = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); if (!m) return ''; const d = new Date(+m[1], +m[2] - 1, +m[3]); return `${+m[1]}년 ${+m[2]}월 ${+m[3]}일 ${'일월화수목금토'[d.getDay()]}요일`; };
const when = v => { const t = new Date(v); return isNaN(t) ? '' : `${t.getMonth() + 1}/${t.getDate()} ${p2(t.getHours())}:${p2(t.getMinutes())}`; };
const AV = `<span class="kko-mav" aria-hidden="true">${typeof KKO_AV === 'string' ? KKO_AV : ''}</span>`;
const bub = (side, who, text, o) => { o = o || {};
  return `<div class="kko-msg ${side}${o.cont ? '' : ' g'} ${o.cls || ''}"${o.id ? ` data-r="${E(o.id)}"` : ''}>${side === 'c' && !o.cont ? AV : ''}<div class="kko-mcol">${who && !o.cont ? `<span class="who">${E(who)}</span>` : ''}`
    + `<div class="kko-mrow"><div class="kko-mb"><div class="b">${text}</div></div>${o.t ? `<span class="t">${E(o.t)}</span>` : ''}${o.x || ''}</div></div></div>`; };
const pill = t => `<div class="kko-day">${E(t)}</div>`;
const memo = (h, cls) => `<div class="kck-memo${cls ? ' ' + cls : ''}">${h}</div>`;
// "(사진 · 파일)" · "(메뉴 누름)" 처럼 가린 자리는 흐리게
const soft = t => E(t).replace(/\((사진 · 파일|사진|파일|메뉴 누름|전화번호|번호|주소|이메일|링크)\)/g, '<i>($1)</i>');
function logHtml(L, last) {
  let day = '', out = '', pw = '', pt = '', q = -1;
  if (last) { q = L.length - 1; while (q > 0 && L[q - 1].who === '고객' && L.length - q < 3) q--; }     // 마지막 고객 글 묶음 — 창을 열면 여기부터 보이게
  L.forEach((m, i) => {
    if (i === q) out += '<i class="kck-q" aria-hidden="true"></i>';
    const dk = dayKo(m.t);
    if (dk && dk !== day) { out += pill(dk); day = dk; pw = ''; }
    const c = m.who === '고객', cont = m.who === pw && m.t === pt;
    out += bub(c ? 'c' : 'o', m.who, soft(m.text), {t: hm(m.t), cont});
    pw = m.who; pt = m.t;
  });
  return out;
}
function caseHtml(x) {
  const L = x.log || [], keep = innerWidth <= 760 ? 2 : 6;                                      // 앞 대화는 접어 둠 (휴대폰은 마지막 글부터)
  const old = L.length > keep + 1 ? L.slice(0, -keep) : [], now = old.length ? L.slice(-keep) : L;
  const ord = (x.orders || []).length ? '<b>주문 찾기</b> ' + x.orders.map(o => `${E(o.at)} · 운송장 ${o.printed === 'yes' ? '출력됨' : o.printed === 'no' ? '출력 전' : '모름'}${(o.items || []).length ? ' · ' + E(o.items.join(', ')) : ''}`).join(' / ')
    : x.gave ? '<b>주문 찾기</b> 홈페이지 주문에 없음' : '';
  const real = String(x.real || '').replace(/알림톡\/브랜드메시지는 관리자센터에서 확인할 수 없어요\.\s*\/?\s*/g, '').trim();
  return (old.length ? `<details class="kck-old"><summary>앞 대화 ${old.length}줄</summary>${logHtml(old)}</details>` : '') + logHtml(now, true)
    + pill('시험 답 — 고객에게 안 나갔어요') + bub('o', '에이전트 시험 답', E(x.reply), {cls: 'kck-ai'})
    + (x.note || ord ? `<details class="kck-more"><summary>${[x.note ? '직원에게 남긴 말' : '', ord ? '주문 찾기' : ''].filter(Boolean).join(' · ')}</summary>${x.note ? memo(`<b>직원에게 남긴 말</b> ${E(x.note)}`) : ''}${ord ? memo(ord) : ''}</details>` : '')
    + (x.why && (x.g === 'bad' || x.g === 'weak' || x.extra) ? memo(`<b>${GRADE[x.g] ? '채점 · ' + GRADE[x.g] : '넘길 필요 없었음'}</b> ${E(x.why)}`, x.g === 'bad' ? 'bad' : '') : '')
    + (real ? pill('그때 실제 나간 답') + real.split(' / ').filter(t => t.trim()).map((t, i) => bub('o', WHO[x.actual] || x.actual || '답', E(t.trim()), {cls: 'kck-real', cont: i > 0})).join('') : '');
}
function askHtml(x) {
  const t = x.kind === 'fact'
    ? `고객이 ${(x.asks || []).map(a => `‘${E(a)}’`).join(' · ')} 하고 물으면 어떻게 답할까요?\n${E(x.label)} 브랜드 정보 ‘${E(x.fact)}’ 칸이 비어 있어서 지금은 직원에게 넘겨요.`
    : E(x.text);
  return bub('c', '에이전트', t);
}
const label = (x, r) => { const g = GM.get(x.group) || []; return r.v === 'ok' ? g[3] || '맞아요' : r.v === 'skip' ? g[4] || '직원이 할게요' : r.text; };
function meHtml(x) {
  const pend = new Set(S.out.map(o => o.id));
  return (S.rows.get(x.key) || []).map(r => bub('o', r.by || '내가 적은 답', E(label(x, r)), {cls: 'kck-me', id: r.id, t: pend.has(r.id) ? '보내는 중' : when(r.at),
    x: `<button type="button" class="kck-un" data-id="${E(r.id)}" title="이 답 지우기" aria-label="이 답 지우기">✕</button>`})).join('');
}
function chips(x) {
  const g = GM.get(x.group) || [], c = [];
  if (g[3]) c.push(['ok', g[3], '']);
  if (x.group === 'decide' && (x.fact === '회원가입혜택' || x.fact === '쿠폰안내' || /쿠폰/.test(x.text || ''))) c.push(['text', '없다고 답해요', '없음']);
  if (g[4]) c.push(['skip', g[4], '']);
  return c.map(([v, l, t]) => `<button type="button" data-v="${v}" data-t="${E(t)}">${E(l)}</button>`).join('');
}
function winHtml(x, i, dr) {
  const g = GM.get(x.group) || [], c = x.kind === 'case', ro = S.data.outside;
  const find = [x.label, x.id, x.q, x.reply, x.note, x.text, x.fact, x.real].join(' ').toLowerCase();
  return `<article class="kck-w${c ? '' : ' s'}" data-k="${E(x.key)}" data-g="${E(x.group)}" data-b="${E(x.brand)}" data-s="${E(find)}" aria-label="${E(x.label)} ${E(c ? x.id : g[1])}">`
    + `<header class="kck-h"><b>${E(x.label)}</b><span class="t">${c ? E(x.id) + ' · ' + E(when(x.at)) : E(x.fact || x.head || '')}</span>${c ? `<span class="kbk-tag ${x.act === 'staff' ? 'none' : 'agent'}">${E(ACT[x.act] || '')}</span>` : ''}`
    + `${c && GRADE[x.g] ? `<span class="kck-gr${x.g === 'bad' ? ' bad' : ''}">${GRADE[x.g]}</span>` : ''}<span class="st" aria-live="polite"></span></header>`
    + `<div class="kck-log"><div class="in">${c ? caseHtml(x) : askHtml(x)}<div class="kck-mine">${meHtml(x)}</div></div></div>`
    + (ro ? '' : `<footer class="kck-f"><div class="kck-c">${chips(x)}</div><div class="kck-in"><textarea class="kck-ta" rows="1" maxlength="1500" placeholder="${E(g[5] || '답 적기')}" aria-label="${E(g[5] || '답 적기')}">${E(dr[x.key] || '')}</textarea><button type="button" class="kck-go">적기</button></div><div class="kck-msg" aria-live="polite"></div></footer>`)
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
  const brands = [...new Map(items.map(x => [x.brand, x.label])).entries()];
  if (S.brand && !brands.some(b => b[0] === S.brand)) S.brand = '';
  const head = `<div class="kbk-head"><h2 id="kbkTitle">시나리오 북</h2>${seg('check')}<span class="sub">${d && d.testAt ? `시험 ${E(when(d.testAt))} · ` : ''}고객에게 나가지 않아요</span>`
    + `<div class="ctl">${d ? `<select id="kckB" aria-label="브랜드"><option value="">모든 브랜드</option>${brands.map(b => `<option value="${E(b[0])}"${b[0] === S.brand ? ' selected' : ''}>${E(b[1])}</option>`).join('')}</select>` : ''}`
    + `<input type="search" id="kckQ" placeholder="찾기 — 배송 · 환불 · N078" value="${E(S.q)}" aria-label="확인할 것에서 찾기" autocomplete="off">`
    + `<button type="button" class="kbk-x" id="kbkX" onclick="kkoBookClose()" aria-label="닫기" title="닫기 (Esc)">✕</button></div></div>`;
  if (!d) {
    box.innerHTML = `<div class="kbk-in kck-root" role="dialog" aria-modal="true" aria-labelledby="kbkTitle">${head}<div class="kbk-empty">${S.err ? '불러오지 못했어요 — ' + E(S.err) + ' <button type="button" class="kck-re">다시</button>' : '불러오는 중…'}</div></div>`;
  } else {
    const nav = `<nav class="kbk-nav" aria-label="확인할 것 묶음"><button type="button" data-f="all">전체<em></em></button>${G.filter(g => items.some(x => x.group === g[0])).map(g => `<button type="button" data-f="${g[0]}">${E(g[1])}<em></em></button>`).join('')}<button type="button" data-f="done">확인 끝<em></em></button></nav>`;
    const secs = G.map(g => { const xs = items.filter(x => x.group === g[0]); return xs.length ? `<section class="kck-g" data-g="${g[0]}"><h3>${E(g[1])} <em></em></h3><p>${E(g[2])}</p><div class="kck-grid">${xs.map((x, i) => winHtml(x, i, dr)).join('')}</div></section>` : ''; }).join('');
    const warn = d.outside ? `<div class="kck-out">${master() && d.hidden ? `고객 대화가 있는 시험 답 ${N(d.hidden)}개는 사무실 인터넷에서만 보여요. ` : ''}답 적기는 사무실에서만 할 수 있어요.</div>` : '';
    box.innerHTML = `<div class="kbk-in kck-root" role="dialog" aria-modal="true" aria-labelledby="kbkTitle">${head}<div class="kbk-body">${nav}<div class="kbk-main kck-main" id="kckMain">${warn}${secs}<div class="kbk-empty" id="kckNone" hidden>맞는 것이 없어요.</div></div></div></div>`;
    items.forEach(x => mark(x.key));
    if (IO) { IO.disconnect(); box.querySelectorAll('.kck-w:not(.s)').forEach(w => IO.observe(w)); }
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
    if (b.dataset.f) { S.f = b.dataset.f; filter(); const m = document.getElementById('kckMain'); if (m) m.scrollTop = 0; return; }
    const w = b.closest('.kck-w');
    if (!w) return;
    const key = w.dataset.k;
    if (b.classList.contains('kck-un')) undo(key, b.dataset.id);
    else if (b.classList.contains('kck-go')) send(w);
    else if (b.dataset.v) say(key, b.dataset.v, b.dataset.t);
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
// 창이 처음 보일 때 — 시험 답까지 길면 마지막 고객 글이 맨 위에 오게 (거꾸로 쌓는 칸이라 위쪽이 음수)
function start(w) {
  const l = w.querySelector('.kck-log'), q = l && l.querySelector('.kck-q'), inn = l && l.firstElementChild;
  if (!q || !inn || getComputedStyle(l).overflowY === 'visible') return;
  const d = inn.getBoundingClientRect().bottom - q.getBoundingClientRect().top + 4;
  if (d > l.clientHeight) l.scrollTop = -(d - l.clientHeight);
}
const IO = window.IntersectionObserver ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { IO.unobserve(e.target); start(e.target); } }), {rootMargin: '200px'}) : null;
function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 120) + 'px'; }
function tail(key) { const w = win(key), l = w && w.querySelector('.kck-log'); if (l) l.scrollTop = 0; }   // 거꾸로 쌓는 칸이라 0 = 맨 아래
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
      const ok = (S.f === 'done' ? dn : (S.f === 'all' || S.f === w.dataset.g) && !(dn && S.done0.has(k))) && (!S.brand || S.brand === w.dataset.b) && (!q || w.dataset.s.includes(q));
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
.kck-w{display:flex;flex-direction:column;height:clamp(520px,72vh,720px);border-radius:14px;overflow:hidden;background:var(--kko-sky);box-shadow:0 1px 4px rgba(0,0,0,.14);content-visibility:auto;contain-intrinsic-size:auto 340px auto 600px}
.kck-w.s{height:auto;min-height:210px;contain-intrinsic-size:auto 340px auto 260px}
.kck-w.done{background:#d5dbe0}
.kck-h{flex:none;display:flex;align-items:center;gap:6px 8px;flex-wrap:wrap;padding:10px 12px 9px;background:rgba(255,255,255,.55)}
.kck-h b{font-size:14px;font-weight:800;color:var(--kko-ink)}
.kck-h .t{font-size:11.5px;color:#4a5763;font-variant-numeric:tabular-nums}
.kck-h .kbk-tag{background:#fff}
.kck-h .kbk-tag.agent{background:var(--kko-ink)}
.kck-h .kbk-tag.none{box-shadow:none}
.kck-gr{font-size:12px;font-weight:800;color:#555}
.kck-gr.bad{color:var(--kko-redt)}
.kck-h .st{margin-left:auto;font-size:12px;font-weight:800;color:var(--kko-ink)}
.kck-log{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column-reverse}
.kck-log .in{display:flex;flex-direction:column;padding:2px 12px 14px}
.kck-log .in>.kck-mine{display:flex;flex-direction:column}
.kck-log .kko-mcol{max-width:84%}
.kck-log .kko-msg.c .kko-mcol{max-width:calc(100% - 60px)}
.kck-log .kko-msg .b{font-size:13px}
.kck-log .kko-day{text-align:center}
.kck-old summary,.kck-more summary{display:flex;justify-content:center;align-items:center;min-height:34px;font-size:12px;font-weight:700;color:#3c4853;cursor:pointer}
.kck-more summary{justify-content:flex-end;min-height:30px}
.kko-msg.kck-ai .b{box-shadow:0 0 0 2px var(--kko-ink)}
.kko-msg.kck-ai.g.o .kko-mb>.b:first-child::before{display:none}
.kko-msg.kck-real .b{background:#eef1f4}
.kko-msg.kck-real.g.o .kko-mb>.b:first-child::before{background:#eef1f4}
.kko-msg.kck-me .b{background:var(--kko-ink);color:#fff}
.kko-msg.kck-me.g.o .kko-mb>.b:first-child::before{background:var(--kko-ink)}
.kck-un{flex:none;width:26px;height:26px;border:0;border-radius:999px;background:rgba(255,255,255,.6);color:#444;font-size:11px;font-family:inherit;cursor:pointer}
.kck-un:hover{background:#fff}
.kck-memo{align-self:stretch;margin:8px 0 0;padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.62);font-size:12px;line-height:1.5;color:#333;overflow-wrap:anywhere}
.kck-memo b{font-weight:800}
.kck-memo.bad b{color:var(--kko-redt)}
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
  .kck-w,.kck-w.s{height:auto;min-height:0}
  .kck-log{overflow:visible}
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
