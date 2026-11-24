/* 확인 필요 알림 — 전승훈 (CS 이미지 확인은 CS팀) (2026-11-24 사장님 "확인 필요한것들 비드오피스에 있는 모든것들은 다 알림으로 띄워줘. 전승훈에게")
   → 같은 날 "알림에 확인 필요는 cs팀은 안뜨게해주고 … 띄워달라는거는 재고 erp나 매핑이 안되거나 재고가 안되거나 그런걸 좀 말해달라고" →
   전승훈에게는 재고 ERP · 매핑 · 재고 쪽만: ERP 알림 · 매핑 요청 · ⚠ 줄 · 재고 미기재 · 재고 없는데 판매중 · 마이너스 재고 · 재고/발주 검수 · 발주 매칭 · 신상 · 리오더 · 재고 쪽 자동 업무.
   CS팀 · 디자인팀 · MD팀 · 인스타는 뺌(OFF), 승인 · 출금은 목록에만(QUIET — 띄우지 않음).
   종 모양 숫자 + 뜨는 알림 + 크롬 알림으로.
   · 읽기만 한다 — 원래 화면이 쓰는 통로(프록시 · 저장소 함수)를 그대로 읽고, 원래 화면과 같은 기준으로 고른다. 저장하는 것은 '확인했어요'(app_kv check_ack) 하나.
   · 두 번 보고 띄운다 — 처음 보이면 기억만, 70초 뒤 다시 읽어도 그대로인 것만 (모든 경보는 두 번 보고)
   · 하나하나 = 새로 생기면 한 번 뜸. 많은 것(카톡 불량 사진 등)은 한 줄로 묶음. 하루 첫 화면에서 남은 것을 한 번 정리해 띄움
   · '확인했어요' = 그 건만 목록에서 내림(PC · 휴대폰 같이). 내용이 바뀌거나 새로 생기면 다시. 원래 화면에서 해결되면 저절로 빠짐
   · 이미 자기 알림이 있는 것(ERP 문제 = erp-alert.js, 재고 미기재 = stock-blank.js, 발주 매칭 · 발주 브랜드 = index.html 발주 확인 필요 알림(#poAlert, 그 자리에서 브랜드 고르기), 출금 요청 = 크롬 알림)은 목록에만 넣고 또 띄우지 않는다
   보이는 조건 = '나는' 이름이 전승훈 (이 이름은 관리자 PIN 화면에서만 고를 수 있다 — secretOk · designHasAccess 와 같은 판정). 새 '확인 필요'가 생기면 SRC 에 한 줄 더한다.
   · 카톡 이미지(영상) 확인 필요 · 카톡 불량 사진(상품 확인 필요)은 CS팀에게 (같은 날 사장님 "cs에서 뜨는 이미지 확인이 필요한건 전승훈한테 안뜨고 cs부서에 있는 사람한테 뜨게 해줘") — SRC 의 to:'cs'.
     CS팀 = 인사팀 명단에서 팀이 C/S 인 지금 직원(이름을 코드에 적지 않는다 — 사람이 바뀌면 인사팀만 고치면 따라간다). CS팀 새 탭(?app=cs)에서도 뜬다. index.html 이 맨 끝에서 부른다 */
(function () {
'use strict';
try { if (window.parent !== window) return; } catch (e) { return; }
const CSAPP = /[?&]app=cs(&|$)/.test(location.search);          // CS팀 새 탭 — CS팀 알림만
if (/[?&]embed=/.test(location.search) || (/[?&]app=/.test(location.search) && !CSAPP)) return;
if (window.BBCheck) return;

const OWNER = '전승훈';
const MIN = 60e3, CONFIRM = 70e3;
const LS = {seen: 'bb_chk_seen_v1', ack: 'bb_check_ack_v1', day: 'bb_chk_day_v1'};
/* 전승훈 알림에서 뺀 곳 (2026-11-24 사장님 "cs팀은 안뜨게" · 재고 쪽만) — 다시 보이려면 여기서 지운다. 카톡 이미지(kkoimg) · 불량 사진(kdf)은 to:'cs' 라 CS팀에게만 */
const OFF = new Set(['kko', 'faq', 'clm', 'cjb', 'dz', 'mdp', 'dm']);
const QUIET = new Set(['appr']);          // 목록에만 — 띄우지 않음
const STOCK_JOB = /^(pro-stock|erp|po-|reorder|kd-|stock|new-products|link-watch|office-(stock|defects|reorder|report))/, STOCK_NAME = /재고|ERP|매핑|발주|리오더|입고/i;          // 자동 업무 가운데 재고 쪽만
const stockJob = x => STOCK_JOB.test(String(x.id || '')) || STOCK_NAME.test(String(x.name || x.label || ''));
const AREAS = ['재고 ERP', '발주', '신상', '리오더', '승인 · 출금', 'CS팀', '디자인팀', 'MD팀', '자동 업무'];
const BR = {kop: '코페리', apt: '아페티', koz: '코즈미', '6a': '식스에이', '6A': '식스에이', yar: '야르', akoi: '아코이하우스', pp: '프로덕트피알', bb: '브라이트비드', ct: '클리어타입', sb: '샤인비드'};
const CHN = {home: '공홈', smartstore: '스마트스토어', ably: '에이블리', zigzag: '지그재그', '29cm': '29CM', wconcept: 'W컨셉', coupang: '쿠팡', ohou: '오늘의집', eql: 'EQL'};
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const $ = (s, r) => (r || document).querySelector(s);
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const jget = k => { try { return JSON.parse(ls(k) || '{}') || {}; } catch (e) { return {}; } };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const dayDiff = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 864e5);
const md = s => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
const n = v => Number(v || 0).toLocaleString('ko-KR');
const cut = (s, l) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > l ? s.slice(0, l - 1) + '…' : s; };
// 짧은 열쇠 — '확인했어요' 기록에는 상품 이름 · 글 내용을 남기지 않는다
const hash = str => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36); };
const me = () => ls('brightbeed_unlocked') === '1' ? String(ls('brightbeed_diary_me') || '').trim() : '';
const inCs = nm => { try { return activeStaff().some(s => s.name === nm && s.team === 'C/S'); } catch (e) { return false; } };
const role = () => { const nm = me(); return !nm ? '' : nm === OWNER ? (CSAPP ? '' : 'me') : inCs(nm) ? 'cs' : ''; };          // me = 전승훈, cs = CS팀, '' = 안 뜸
const mine = () => !!role();
const say = (m, t) => { try { toast(m, t || 'ok'); } catch (e) {} };

/* ── 읽는 통로 ── */
async function px(path, o) {
  const base = await loadProxyBase(); if (!base) throw new Error('서버 연결 안 됨');
  const r = await fetch(base + path, {headers: {'X-Brightbeed-PIN': ghPin(), Accept: 'application/json'}, cache: 'no-store'});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (o && o.arr && !Array.isArray(j[o.arr])) throw new Error('모양이 달라요');
  return j;
}
async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {headers: _sbHeaders(), cache: 'no-store'});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json(); if (!Array.isArray(j)) throw new Error('모양이 달라요');
  return j;
}

/* ── 모으는 곳 ── 한 줄 = {k 열쇠, a 부서, t 제목, b 설명, sig 이게 바뀌면 새 일로 침, go 누르면 갈 곳, list 묶음 속 줄, hot 빨강, q 목록에만} */
const SRC = [
  {id: 'erp', nm: 'ERP 알림 · 매핑', ev: 2, async run() {
    const [al, ask, warn] = await Promise.all([
      sb('erp_alert?select=key,level,title,body,since&resolved_at=is.null&order=since.asc&limit=60'),
      sb('erp_ask?select=k,gid,brand,in_name,in_opt,kind,why&state=eq.open&order=first_at.asc&limit=500'),
      sb(`erp_rows?select=gid,r,v&deleted_at=is.null&v->>0=${encodeURIComponent('like.*매핑*')}&limit=300`)
    ]);
    const out = al.filter(x => x.key !== '_beat').map(x => ({k: 'ea:' + x.key, a: '재고 ERP', t: x.title, b: x.body, at: x.since, hot: x.level === 'stop', q: 1, go: 'erp'}));
    const by = new Map(); ask.forEach(x => { const k = x.brand + '|' + x.in_name; if (!by.has(k)) by.set(k, []); by.get(k).push(x); });
    by.forEach((xs, k) => out.push({k: 'ask:' + k, a: '재고 ERP', t: `매핑 요청 — ${xs[0].in_name || '상품'}`, b: `${BR[xs[0].brand] || xs[0].brand || ''} · 옵션 ${xs.length}개 — 어느 재고 줄에서 뺄지 정해 주세요`, list: xs.map(x => [x.in_opt, x.why].filter(Boolean).join(' — ')), sig: String(xs.length), go: 'erp'}));
    const w = warn.filter(x => /⚠/.test((x.v || [])[0] || '') && !/처리 완료/.test((x.v || [])[0] || ''));
    if (w.length) {
      const tabs = await sb(`erp_tabs?select=gid,name,alive,deleted_at,tab_hidden_at&gid=in.(${[...new Set(w.map(x => `"${x.gid}"`))].join(',')})`), tb = new Map(tabs.map(t => [t.gid, t]));
      w.forEach(x => { const t = tb.get(x.gid); if (!t || t.alive === false || t.deleted_at || t.tab_hidden_at) return; const c = (x.v || []).slice(1, 4).filter(Boolean); out.push({k: `warn:${x.gid}:${c.join('|')}`, a: '재고 ERP', t: `매핑 확인 필요 — ${c[0] || x.r + '행'}`, b: [c.slice(1).join(' · '), t.name].filter(Boolean).join(' · '), go: 'erp'}); });
    }
    return out;
  }},
  {id: 'blank', nm: '재고 미기재', ev: 3, async run() {          // stock-blank.js 와 같은 기준 — 그쪽이 오른쪽 아래에 따로 띄우니 여기선 목록에만
    const ts = await sb('erp_tabs?select=gid,name&kind=eq.stock&alive=is.true&deleted_at=is.null&order=pos.asc'); if (!ts.length) return [];
    const gs = ts.map(x => encodeURIComponent(x.gid)).join(','), hd = await sb(`erp_rows?select=gid,v&deleted_at=is.null&gid=in.(${gs})&v->>1=eq.${encodeURIComponent('상품명')}`);
    const ok = new Map(ts.filter(x => hd.some(q => q.gid === x.gid && String((q.v || [])[11] || '').replace(/\s+/g, '') === '남은재고')).map(x => [x.gid, x.name])); if (!ok.size) return [];
    const rs = (await sb(`erp_rows?select=gid,r,c:v->>0,n:v->>1,o:v->>2&deleted_at=is.null&gid=in.(${[...ok.keys()].map(encodeURIComponent).join(',')})&v->>1=neq.&or=(v->>11.eq.,v->>11.is.null)&limit=3000`))
      .filter(x => { const nm = String(x.n || '').trim(); return nm && nm !== '상품명' && !/^\s*⚠|안\s*셈|묶음\s*→\s*낱개|^\s*세트\s*·/.test(String(x.c || '')); });
    return rs.length ? [{k: 'blank', a: '재고 ERP', t: `재고 미기재 ${n(rs.length)}건`, b: '남은 재고가 빈칸 — 실제 재고를 적어 주세요', list: rs.slice(0, 40).map(x => [String(ok.get(x.gid)).replace(/^[\d.]+\s*|\s*송장출력$/g, ''), x.n, x.o].filter(Boolean).join(' · ')), sig: hash(rs.map(x => x.gid + '|' + x.r).join(',')), q: 1, go: 'blank'}] : [];
  }},
  {id: 'zero', nm: '재고 없는데 판매중', ev: 4, async run() {          // ERP 재고 탭 맨 위 빨간 줄과 같은 기준 (남은 재고 0 이하 · 식스샵프로 판매중) + 마이너스 재고
    const ts = await sb('erp_tabs?select=gid,name&kind=eq.stock&alive=is.true&deleted_at=is.null&order=pos.asc'); if (!ts.length) return [];
    const gs = ts.map(x => encodeURIComponent(x.gid)).join(','), hd = await sb(`erp_rows?select=gid,v&deleted_at=is.null&gid=in.(${gs})&v->>1=eq.${encodeURIComponent('상품명')}`);
    const ok = new Map(ts.filter(x => hd.some(q => q.gid === x.gid && String((q.v || [])[11] || '').replace(/\s+/g, '') === '남은재고')).map(x => [x.gid, String(x.name).replace(/^[\d.]+\s*|\s*송장출력$/g, '')])); if (!ok.size) return [];
    const rs = (await sb(`erp_rows?select=gid,r,c:v->>0,n:v->>1,o:v->>2,q:v->>11&deleted_at=is.null&gid=in.(${[...ok.keys()].map(encodeURIComponent).join(',')})&v->>1=neq.&or=(v->>11.eq.0,v->>11.like.-*)&limit=2000`))
      .map(x => Object.assign(x, {z: Number(String(x.q || '').replace(/[,\s]/g, '')), n: String(x.n || '').trim(), o: String(x.o || '').trim()}))
      .filter(x => x.n && isFinite(x.z) && x.z <= 0 && !/^\s*⚠|안\s*셈|묶음\s*→\s*낱개|^\s*세트\s*·/.test(String(x.c || '')));
    const need = [...new Set(rs.map(x => x.gid))], pro = new Map(need.length ? (await sb(`erp_pro?select=gid,pro&gid=in.(${need.map(encodeURIComponent).join(',')})`)).map(p => [p.gid, p.pro || {}]) : []);
    const on = x => { const st = (pro.get(x.gid) || {})[String(x.r)]; return !!st && st[0] === 'on'; };
    // 방금 다 팔린 것은 재고 연동(5분)이 곧 품절로 돌리니, 11분 넘게 그대로일 때만
    const was = jget('bb_chk_zero_v1'), now = Date.now(), keep = {}, out = [];
    rs.filter(on).forEach(x => {
      const k = `zero:${x.gid}|${x.n}|${x.o}`, h = hash(k), t = +was[h] || now;
      keep[h] = t;
      if (now - t >= 11 * MIN) out.push({k, a: '재고 ERP', t: `재고 없는데 판매중 — ${x.n}`, b: [ok.get(x.gid), x.o, `남은 재고 ${n(x.z)}`].filter(Boolean).join(' · ') + ' — 품절 처리하거나 재고를 확인해 주세요', hot: 1, go: 'erp'});
    });
    ls('bb_chk_zero_v1', JSON.stringify(keep));
    const mi = rs.filter(x => x.z < 0 && !on(x) && !/B급/.test(x.n));          // 판매중은 위에서 · B급(반품)은 재고 연동 밖
    if (mi.length) out.push({k: 'minus', a: '재고 ERP', t: `남은 재고 마이너스 ${n(mi.length)}줄`, b: '실제보다 더 빠진 줄 — 세어서 바로잡아 주세요', list: mi.slice(0, 40).map(x => [ok.get(x.gid), x.n, x.o, n(x.z)].filter(Boolean).join(' · ')), sig: hash(mi.map(x => `${x.gid}|${x.n}|${x.o}`).join(',')), go: 'erp'});
    return out;
  }},
  {id: 'audit', nm: '재고 검수', ev: 5, run: async () => ((await px('/erp/audit')).issues || []).filter(x => x.level === 'alert').map(x => ({k: 'au:' + (x.key || x.text), a: '재고 ERP', t: '재고 검수 — 확인 필요', b: x.text, go: 'erp'}))},
  {id: 'poa', nm: '발주 검수', ev: 5, run: async () => ((await px('/erp/po-audit')).issues || []).filter(x => x.level === 'alert').map(x => ({k: 'poa:' + (x.key || x.text), a: '발주', t: '발주 검수 — 확인 필요', b: x.text, go: 'pom'}))},
  {id: 'pom', nm: '발주 매칭', ev: 5, run: async () => (await px('/erp/po-match', {arr: 'items'})).items.filter(_pomNeedsCheck).map(it => ({k: 'pom:' + it.sn, a: '발주', t: `발주 ${it.sn} — ERP 줄 확인`, b: [it.date, it.n ? _pomName(it) : (it.cands || []).map(_pomName).slice(0, 3).join(' / ') || '행 못 찾음', it.planQty || it.qty ? n(it.planQty || it.qty) + '개' : '', it.why || (it.recv && it.recv.why) || ''].filter(Boolean).join(' · '), q: 1, go: 'pom'}))},   // 띄우기는 #poAlert
  {id: 'pmd', nm: 'MD 발주 브랜드', ev: 30, async run() {
    const xs = ((await pmdRpc('po_md_panel', {p_days: 150})).items || []).filter(_pmdNeed).sort((a, b) => String(b.d).localeCompare(String(a.d)) || String(b.sn).localeCompare(String(a.sn)));
    return xs.length ? [{k: 'pmd', a: '발주', t: `발주 브랜드 확인 필요 ${n(xs.length)}건`, b: `가장 최근 ${xs[0].d} · ${xs[0].sn}`, list: xs.slice(0, 40).map(x => `${x.d} · ${x.sn} · ${x.q != null ? n(x.q) + '개 · ' : ''}${cut(x.memo || '메모 없음', 50)}`), sig: xs[0].sn, q: 1, go: 'pmd'}] : [];   // 띄우기는 #poAlert (그 자리에서 고름)
  }},
  {id: 'np', nm: '식스샵프로 신상', ev: 10, run: async () => ((await px('/erp/new-products')).recent || []).filter(x => ['hold', 'fail', 'cut'].includes(x.st) || x.lost).map(x => ({k: 'np:' + x.vid, a: '신상', t: `신상 ${x.label || ''} — ${x.name}`, b: [x.opt, x.why || (x.lost ? 'ERP 줄과 안 이어짐 — 상품명 · 옵션이 바뀌었는지 확인' : {hold: '확인 필요', fail: '못 넣음', cut: '시트 끊김'}[x.st])].filter(Boolean).join(' · '), sig: x.lost ? 'lost' : x.st, hot: x.st === 'fail', go: 'erp'}))},
  {id: 'reo', nm: '리오더 경보', ev: 5, run: async () => ((await px('/erp/reorder', {arr: 'items'})).items).map(x => ({k: `reo:${x.b}|${x.n}|${x.o}`, a: '리오더', t: `${BR[x.b] || x.b} ${x.n}`, b: [String(x.o || ''), x.stock <= 0 ? `재고 ${n(x.stock)} — 품절` : `재고 ${n(x.stock)} · 약 ${x.days}일치`].filter(Boolean).join(' · '), sig: x.sev, hot: x.stock <= 0, at: x.since, go: 'reo'}))},
  {id: 'appr', nm: '승인 · 출금', ev: 2, async run() {
    const [c, w] = await Promise.all([sb('leave_comp_requests?select=id,staff_name,work_date,days,reason,requested_at&status=eq.pending&deleted_at=is.null&order=requested_at.asc&limit=100'), sb('withdrawal_requests?select=id,requested_by,requested_at,rows&status=eq.notified&notify_muted=is.false&order=requested_at.asc&limit=100')]);
    return c.map(x => ({k: 'comp:' + x.id, a: '승인 · 출금', t: `대체휴무 승인 대기 — ${x.staff_name}`, b: [x.work_date && md(x.work_date) + ' 근무', x.days && x.days + '일', x.reason].filter(Boolean).join(' · '), at: x.requested_at, go: 'comp'}))
      .concat(w.map(x => ({k: 'wd:' + x.id, a: '승인 · 출금', t: `출금 요청 — ${x.requested_by || '벤더팀'}`, b: `${(x.rows || []).length}건`, at: x.requested_at, q: 1, go: 'vendor'})));
  }},
  {id: 'kko', nm: '카카오톡 상담', ev: 2, run: async () => (await px('/cs/kakao', {arr: 'chats'})).chats.filter(r => !r.done && r.managerCall).map(r => ({k: `kko:${r.pid}:${r.chatId}`, a: 'CS팀', t: `${BR[r.brand] || r.brand} 카톡 — 고객이 직원을 불렀어요`, b: r.nick || '', sig: 'call', at: r.lastAt, hot: 1, go: 'kko', arg: `${r.pid}:${r.chatId}`}))},
  {id: 'kkoimg', to: 'cs', nm: '카카오톡 이미지', ev: 2, run: async () => (await px('/cs/kakao', {arr: 'chats'})).chats.filter(r => !r.done && (r.photos > 0 || r.videos > 0) && !(typeof KKO_HIDE !== 'undefined' && KKO_HIDE.has(r.brand))).map(r => ({k: `kkoimg:${r.pid}:${r.chatId}`, a: 'CS팀', t: `${BR[r.brand] || r.brand} 카톡 — ${r.photos > 0 ? '이미지' : '영상'} 확인 필요`, b: [r.nick, r.photos > 0 && `사진 ${r.photos}장`, r.videos > 0 && `영상 ${r.videos}개`, r.managerCall && '직원 호출'].filter(Boolean).join(' · '), sig: `${r.photos || 0}/${r.videos || 0}`, at: r.lastAt, go: 'kko', arg: `${r.pid}:${r.chatId}`}))},          // 사진이 더 오면(sig) 다시 뜸, 직원이 답하면 저절로 빠짐
  {id: 'faq', nm: '카카오 답변 자료', ev: 60, async run() { const c = (await px('/cs/kakao-faq')).checks || []; return c.length ? [{k: 'faq', a: 'CS팀', t: `카카오 답변 자료 확인 필요 ${c.length}건`, b: '알려 주시면 에이전트 답에 고쳐 넣어요', list: c.map(x => `${BR[x.brand] ? '[' + BR[x.brand] + '] ' : ''}${x.text}`), sig: hash(c.map(x => x.text).join('|')), go: 'faq'}] : []; }},
  {id: 'kdf', to: 'cs', nm: '카톡 불량 사진', ev: 60, async run() {
    const xs = (await px('/cs/kakao-defects', {arr: 'items'})).items.filter(x => x.needsCheck), t = today();
    if (!xs.length) return [];
    const nw = xs.filter(x => String(x.date || '').slice(0, 10) === t), last = xs.map(x => String(x.date || '').slice(0, 10)).sort().pop() || '';
    return [{k: 'kdf:cs', a: 'CS팀', t: `카톡 불량 사진 — 상품 확인 필요 ${n(xs.length)}건`, b: nw.length ? `오늘 새로 ${nw.length}건` : last ? `가장 최근 ${md(last)}` : '', list: xs.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30).map(x => `${String(x.date || '').slice(5, 10).replace('-', '/')} · ${BR[x.brand] || x.label || ''} · ${cut(x.symptom || x.text || '사진', 40)}`), sig: last, go: 'voc', arg: 'p:list'}];
  }},
  {id: 'clm', nm: '반품 · 교환', ev: 60, async run() {
    await clmLoad(false); if (_clm.err) throw new Error(_clm.err);
    const open = new Set(['requested', 'collecting', 'collected', 'held']), age = l => dayDiff(today(), String(l.requested_at || l.date || today()).slice(0, 10));
    const xs = ((_clm.data || {}).lines || []).filter(l => open.has(l.stage) && age(l) > 30).sort((a, b) => age(b) - age(a)); if (!xs.length) return [];
    const ch = {}; xs.forEach(l => { ch[l.channel] = (ch[l.channel] || 0) + 1; });
    return [{k: 'clm', a: 'CS팀', t: `반품 · 교환 30일 넘게 그대로 ${n(xs.length)}건`, b: Object.entries(ch).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${CHN[c] || c} ${v}`).join(' · ') + ' — 판매자 화면에서 실제로 남았는지 확인', list: xs.slice(0, 30).map(l => `${age(l)}일 · ${CHN[l.channel] || l.channel} · ${cut(l.product, 34)}`), sig: String(Math.floor(xs.length / 10)), go: 'voc', arg: 'c:ops'}];
  }},
  {id: 'cjb', nm: '택배 접수', ev: 10, async run() { const j = await _cjbCall({action: 'list', limit: 200, q: ''}); if (!j || !j.ok) throw new Error((j && j.error) || '못 읽음'); return (j.rows || []).filter(r => r.status === 'unknown').map(r => ({k: 'cjb:' + r.id, a: 'CS팀', t: '택배 접수 확인 필요', b: [r.cust_use_no, r.gds_nm, r.result_detail].filter(Boolean).join(' · '), at: r.created_at, go: 'cjb'})); }},
  {id: 'dz', nm: '디자인팀 업무일지', ev: 10, async run() {
    const [j, w] = await Promise.all([_mdxRpc('dlog_boot', {p_recent: 2}), _wlLoad()]), L = w._, pages = j.pages || [], out = [], t = j.today || today();
    const p = pages.filter(x => x.kind === 'daily' && x.day <= t && !x.d).sort((a, b) => b.day.localeCompare(a.day))[0];
    if (p && !p.blocks) { const g = await _mdxRpc('dlog_get', {p_ids: [p.id]}); p.blocks = ((g || [])[0] || {}).blocks || []; }
    const txt = b => (b.r || []).map(s => s.t || '').join('').replace(/\s+/g, ' ').trim();
    if (p) L.sections(p.blocks).forEach(s => {
      if (['goalM', 'goalW', 'daily'].includes(s.type)) return;
      const base = Math.min(...s.items.filter(txt).map(b => b.lv || 0), 9);
      s.items.forEach(b => { if (txt(b) && (b.lv || 0) - base <= 1 && L.stOf(b, s.type) === 'chk') out.push({k: 'dz:' + (b.o || b.id), a: '디자인팀', t: cut(txt(b), 90), b: `업무일지 ${md(p.day)}${s.head ? ' · ' + txt(s.head) : ''}`, go: 'dz', arg: p.id + '|' + b.id}); });
    });
    pages.filter(x => x.kind === 'order' && !x.d && x.day < t && dayDiff(t, x.day) <= 10).forEach(x => {
      const m = x.meta || {}, st = m.st || [], ti = String(x.title || '');
      if (!st.includes('미입고') || st.some(s => /입고\s*완료|파샬/.test(s)) || !(m.ok ? ['in', 'sin', 'ship'].includes(m.ok) : /입고|도착|발송|출고/.test(ti))) return;
      out.push({k: 'dzo:' + x.id, a: '디자인팀', t: `입고 예정일 지남 — ${ti.replace(/^\s*\d{4}\s+/, '')}`, b: [`${md(x.day)} 예정 · ${dayDiff(t, x.day)}일 지남`, (m.fac || []).join(' · ')].filter(Boolean).join(' · '), go: 'dz', arg: x.id + '|'});
    });
    return out;
  }},
  {id: 'mdp', nm: 'MD 시트 단가', ev: 360, async run() {
    const tabs = ((await _mdxRpc('mdx_meta', {})).tabs || []).filter(t => !t.th && /^(apeti|coferry|kozmi)$/.test(t.book) && /^(Product List|6a|yar|반지|부자재)$/i.test(t.name) && t.n_rows < 1500), out = [];
    for (const t of tabs) {
      const rows = ((await _mdxRpc('mdx_rows_get', {p_tk: t.tk, p_since: 0, p_after: 0, p_limit: 5000, p_fx: false})).rows || []).filter(x => !x.d);
      let hi = -1, ci = -1; rows.slice(0, 8).forEach(x => { const i = (x.v || []).findIndex(c => /단가\s*메모/.test(String(c || ''))); if (i >= 0 && ci < 0) { hi = x.r; ci = i; } });
      if (ci < 0) continue;
      const xs = rows.filter(x => x.r > hi && /⚠|미기재/.test(String((x.v || [])[ci] || ''))); if (!xs.length) continue;
      out.push({k: 'mdp:' + t.tk, a: 'MD팀', t: `MD 시트 ${t.name} — 단가 확인 필요 ${xs.length}줄`, b: '단가 메모에 ⚠ · 미기재로 남은 상품', list: xs.slice(0, 40).map(x => cut((x.v || [])[2] || (x.v || [])[1] || x.r + '행', 60)), sig: String(xs.length), go: 'md'});
    }
    return out;
  }},
  {id: 'sys', nm: '자동 업무 상태', ev: 5, async run() {
    const [h, a] = await Promise.all([px('/health', {arr: 'checks'}), px('/agents/status', {arr: 'agents'})]), out = [];
    h.checks.filter(x => !x.ok && stockJob(x)).forEach(x => out.push({k: 'sys:' + x.id, a: '자동 업무', t: x.name || x.id, b: x.detail || (x.status === 'missing' ? '자료가 없어요' : '멈췄거나 늦어지고 있어요'), hot: 1, go: 'sys'}));
    a.agents.filter(x => x.status === 'stale' && stockJob(x) && !h.checks.some(c => c.id === x.id)).forEach(x => out.push({k: 'ag:' + x.id, a: '자동 업무', t: `${x.label || x.id} — 멈춤`, b: x.detail || '확인 필요', hot: 1, go: 'agents'}));
    return out;
  }},
  {id: 'dm', nm: '인스타 자동 DM', ev: 60, async run() {
    const key = ls('ggul_device_key'); if (!key) return [];
    const r = await fetch('https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/sns-dm/admin', {headers: {'x-ggul-device': key}, cache: 'no-store'}); if (!r.ok) return [];
    const j = await r.json(), w = {permission: '댓글 · 메시지 권한 확인 필요', error: '토큰 · 권한 문제로 멈춤', failing: '최근 DM 이 연달아 실패'}[j.reason];
    return j.enabled && w ? [{k: 'dm', a: '자동 업무', t: '인스타 자동 DM — 확인 필요', b: w, sig: j.reason, hot: 1, go: 'sns'}] : [];
  }}
];
/* ── 상태 ── */
const S = {src: {}, seen: jget(LS.seen), ack: jget(LS.ack), running: 0, open: false, pops: [], first: false, drawn: '', on: false, ackOpen: false};
S.first = Object.keys(S.seen).length > 0;
SRC.forEach(s => { S.src[s.id] = {items: null, at: 0, next: 0, err: '', busy: false, fails: 0}; });
const full = x => x.k + '#' + (x.sig || '');
const isAck = x => !!S.ack[hash(full(x))];
const mySrc = () => { const r = role(); return r ? SRC.filter(s => (s.to || 'me') === r && !(r === 'me' && OFF.has(s.id))) : []; };
const all = () => mySrc().flatMap(s => S.src[s.id].items || []);
const todo = () => all().filter(x => !isAck(x));
const saveSeen = () => ls(LS.seen, JSON.stringify(S.seen));
function saveAck() { try { kvSet('check_ack', LS.ack, Object.assign({}, S.ack)); } catch (e) { ls(LS.ack, JSON.stringify(S.ack)); } }
function setAck(xs, on) {
  xs.forEach(x => { const h = hash(full(x)); if (on) S.ack[h] = Date.now(); else delete S.ack[h]; });
  const old = Date.now() - 120 * 864e5; Object.keys(S.ack).forEach(h => { if (+S.ack[h] < old) delete S.ack[h]; });
  saveAck(); closePops(xs.map(full)); draw();
}
/* ── 읽기 ── */
async function runSrc(s) {
  const c = S.src[s.id]; if (c.busy) return; c.busy = true; S.running++;
  try {
    const xs = (await s.run()).map(x => Object.assign(x, {src: s.id}, QUIET.has(s.id) ? {q: 1} : {}));
    c.items = xs; c.err = ''; c.fails = 0; c.at = Date.now();
    look(s, xs);
  } catch (e) { c.fails++; c.err = (e && e.message) || String(e); }
  finally {
    c.busy = false; S.running--;
    // 아직 한 번만 본 것이 있으면 곧 다시 본다 — 그대로면 그때 띄운다
    const once = (c.items || []).some(x => { const z = S.seen[full(x)]; return z && !z.ok; });
    c.next = Date.now() + (c.fails ? Math.min(5 * MIN, 30e3 * c.fails) : once ? CONFIRM : s.ev * MIN);
    draw();
    clearTimeout(S.tk); S.tk = setTimeout(tick, 80);          // 한 번에 셋씩 이어서
  }
}
function look(s, xs) {
  const now = Date.now(), keys = new Set(xs.map(full)), fresh = [];
  xs.forEach(x => {
    const f = full(x), z = S.seen[f];
    if (!z) S.seen[f] = {s: s.id, t: now, ok: 0};
    else { z.m = 0; if (!z.ok && now - z.t >= CONFIRM - 5e3) { z.ok = now; fresh.push(x); } }
  });
  // 원래 화면에서 없어진 것 — 두 번 연달아 안 보이면 잊는다 (다시 생기면 새 일)
  Object.keys(S.seen).forEach(f => { const z = S.seen[f]; if (z.s !== s.id || keys.has(f)) return; z.m = (z.m || 0) + 1; if (z.m >= 2) { delete S.seen[f]; const h = hash(f); if (S.ack[h]) { delete S.ack[h]; S.ackGone = 1; } } });
  saveSeen();
  closeGone();
  if (S.ackGone) { S.ackGone = 0; saveAck(); }
  const show = fresh.filter(x => !x.q && !isAck(x));
  if (show.length) { S.pend = (S.pend || []).concat(show); clearTimeout(S.pendT); S.pendT = setTimeout(announce, S.first ? 1500 : 15e3); }          // 한꺼번에 여럿이면 모아서 한 번 (처음 쓰는 기기는 전부 새것이라 조금 더 모은다)
}
/* ── 띄우기 ── */
function announce() {
  const xs = (S.pend || []).filter(x => !isAck(x) && !opened(x)); S.pend = [];
  if (!xs.length || !mine()) return;
  if (!S.first) { S.first = true; summary(null); ls(LS.day, today()); notify(null, todo()); post({sum: todo()}); return; }          // 이 기기에서 처음 — 하나씩 대신 한 장으로
  if (xs.length > most()) { summary(xs); notify(xs.length > 3 ? null : xs, xs.length > 3 ? xs : null); post({sum: xs}); return; }
  xs.forEach(x => popItem(x)); notify(xs); post({pop: xs});
}
/* CS팀은 오피스 탭이 둘(홈 + CS팀 새 탭) — 어느 탭이 띄워도 보고 있는 탭에 보이고, 한 곳에서 닫으면 같이 닫힌다 (크롬 알림은 먼저 띄운 탭만) */
let BC = null; try { BC = new BroadcastChannel('bb-chk'); } catch (e) {}
function post(m) { if (BC && role() === 'cs') try { BC.postMessage(m); } catch (e) {} }
if (BC) BC.onmessage = e => {
  const m = (e && e.data) || {}; if (role() !== 'cs') return;
  if (m.sum) { S.first = true; summary(m.sum); }
  if (m.pop) m.pop.forEach(x => popItem(x));
  if (m.shut) S.pops.filter(p => m.shut === '*' ? !p.x : p.x && full(p.x) === m.shut).forEach(drop);
};
const shut = p => { drop(p); post({shut: p.x ? full(p.x) : '*'}); };
function notify(xs, sum) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const fire = (title, body, tag, x) => { try { const no = new Notification(title, {body, tag, icon: 'assets/icon-192.png?v=2', requireInteraction: !!(x && x.hot)}); no.onclick = () => { window.focus(); no.close(); if (x) go(x); else openPanel(true); }; } catch (e) {} };
  if (sum) { const by = AREAS.map(a => [a, sum.filter(x => x.a === a).length]).filter(x => x[1]); if (by.length) fire(`확인 필요 ${sum.length}건`, by.map(([a, c]) => `${a} ${c}`).join(' · '), 'bbchk-sum'); return; }
  xs.forEach(x => fire(`확인 필요 · ${x.a}`, `${x.t}${x.b ? '\n' + cut(x.b, 120) : ''}`, 'bbchk-' + hash(full(x)), x));
}
/* 하루 첫 화면 — 남은 것을 한 번 정리해 띄운다 */
function daily() {
  if (ls(LS.day) === today() || S.pops.length || !S.first || !todo().some(x => (S.seen[full(x)] || {}).ok)) return;
  const my = mySrc(); if (my.filter(s => S.src[s.id].items).length < my.length * .7) return;          // 아직 덜 읽음
  ls(LS.day, today()); summary(null); notify(null, todo()); post({sum: todo()});
}
function wrap() {
  let w = $('#bbChkPops'); if (w) return w;
  w = document.createElement('div'); w.id = 'bbChkPops'; w.setAttribute('role', 'status'); w.setAttribute('aria-live', 'polite'); document.body.appendChild(w);
  w.addEventListener('click', e => {
    const c = e.target.closest('.bc-pop'), a = e.target.closest('[data-c]'); if (!c || !a) return;
    const p = S.pops.find(x => x.el === c), k = a.dataset.c; if (!p) return;
    if (k === 'go') { shut(p); go(p.x); }
    if (k === 'ack') { shut(p); setAck([p.x], true); }
    if (k === 'all') { shut(p); openPanel(true); }
    if (k === 'x') shut(p);
  });
  return w;
}
const phone = () => innerWidth <= 600, solo = () => document.documentElement.classList.contains('solo-cs'), most = () => phone() || solo() ? 1 : 3;          // 한 번에 띄우는 장 수 — 나머지는 종 목록에
const drop = p => { p.el.remove(); S.pops = S.pops.filter(x => x !== p); };
const closePops = fs => { S.pops.filter(p => p.x && fs.includes(full(p.x))).forEach(drop); };
const closeGone = () => { const live = new Set(all().map(full)); S.pops.filter(p => p.x && S.src[p.x.src] && S.src[p.x.src].items && !live.has(full(p.x))).forEach(drop); };
function card(html, x, sum) {
  css(); place();
  while (S.pops.length >= most()) drop(S.pops[0]);
  if (sum) S.pops.slice().forEach(drop);
  const el = document.createElement('div'); el.className = 'bc-pop' + (x && x.hot ? ' hot' : ''); el.innerHTML = html;
  wrap().appendChild(el); S.pops.push({el, x});
}
const opened = x => { try { return role() === 'cs' && x.go === 'kko' && !!_kko.chat && _kko.chat.key === x.arg && !document.hidden; } catch (e) { return false; } };          // 이미 그 채팅방을 열어 보고 있음
const dropOpened = () => { if (S.pops.length) S.pops.filter(p => p.x && opened(p.x)).forEach(shut); };
function popItem(x) { if (S.pops.some(p => p.x && full(p.x) === full(x)) || opened(x)) return; card(`<header><em>${E(x.a)}</em><button type="button" data-c="x" aria-label="닫기">×</button></header><b>${E(x.t)}</b>${x.b ? `<p>${E(cut(x.b, 140))}</p>` : ''}<footer><button type="button" class="pri" data-c="go">보기</button><button type="button" data-c="ack">확인했어요</button></footer>`, x); }
function summary(xs) {
  const L = xs || todo(), by = AREAS.map(a => [a, L.filter(x => x.a === a)]).filter(x => x[1].length); if (!L.length) return;
  card(`<header><em>${xs ? '새로 확인할 것' : '확인할 것'}</em><button type="button" data-c="x" aria-label="닫기">×</button></header><b>확인 필요 ${L.length}건</b><ul>${by.map(([a, v]) => `<li><span>${E(a)}</span><i>${E(cut(v[0].t, 30))}${v.length > 1 ? ` 외 ${v.length - 1}` : ''}</i></li>`).join('')}</ul><footer><button type="button" class="pri" data-c="all">모두 보기</button></footer>`, null, true);
}
/* ── 가기 ── */
const scrollTo_ = (id, ms) => setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'}); }, ms || 350);
function go(x) {
  openPanel(false);
  const call = (f, ...a) => { try { return f(...a); } catch (e) { say('그 화면을 열지 못했어요', 'err'); } };
  switch (x.go) {
    case 'erp': return call(() => openErpPage());
    case 'blank': { const p = document.querySelector('#stockBlank [data-act="open"]'); if (p) return p.click(); return document.querySelector('#stockBlank .sb-card') ? undefined : call(() => openErpPage()); }
    case 'pom': call(() => triggerLogistics()); setTimeout(() => call(() => { if (!_pom.open) pomToggle(); }), 400); return scrollTo_('pomBox', 700);
    case 'pmd': call(() => triggerLogistics()); setTimeout(() => call(() => { if (!_pmd.open) pmdToggle(); }), 400); return scrollTo_('pmdBox', 700);
    case 'reo': call(() => goHome()); return scrollTo_('homeReorderCard', 400);
    case 'comp': return call(() => hrOpenCompReq());
    case 'vendor': return call(() => triggerVendor());
    case 'kko': call(() => triggerCs()); scrollTo_('kkoBox', 500); return setTimeout(() => call(() => { if (x.arg) kkoOpenChat(x.arg); }), 900);
    case 'faq': call(() => triggerCs()); setTimeout(() => call(() => kkoTab('learn')), 500); return scrollTo_('kkoBox', 700);
    case 'cjb': call(() => triggerCs()); setTimeout(() => call(() => cjbTab('list')), 600); return scrollTo_('cjbBox', 700);
    case 'voc': call(() => triggerCs()); scrollTo_('vocEmbed', 700); return setTimeout(() => { try { const fr = document.querySelector('#vocEmbed iframe'); if (fr && fr.contentWindow.vocGo) fr.contentWindow.vocGo(x.arg); } catch (e) {} }, 2500);
    case 'dz': call(() => triggerDesign()); return setTimeout(() => call(() => { const [pid, line] = String(x.arg || '').split('|'); if (pid && window.WL && WL._.openPage) { WL._.openPage(pid, line ? {line} : {}); if (!line) scrollTo_('wl', 100); } }), 1800);
    case 'md': return call(() => triggerMd());
    case 'sns': return call(() => openToolPage('sns'));
    case 'agents': return void (location.href = './agents.html');
    case 'sys': return call(() => { window.scrollTo(0, 0); toggleSysHealth(true); });
  }
}
/* ── 목록 ── */
function openPanel(on) { S.open = on === undefined ? !S.open : on; S.drawn = ''; draw(); if (S.open) { S.pops.filter(p => !p.x).forEach(drop); const x = $('#bbChkPanel .bc-x'); if (x) x.focus({preventScroll: true}); } }
function row(x, acked) {
  const h = hash(full(x));
  return `<div class="bc-r${x.hot ? ' hot' : ''}" data-h="${h}"><button type="button" class="bc-m" data-c="go"><b>${E(x.t)}</b>${x.b ? `<span>${E(cut(x.b, 150))}</span>` : ''}</button>${acked ? '<button type="button" class="bc-ok" data-c="unack">되돌리기</button>' : '<button type="button" class="bc-ok" data-c="ack" title="확인했어요 — 목록에서 내려요">확인</button>'}${x.list && x.list.length ? `<details><summary>${x.list.length}줄 보기</summary><ul>${x.list.map(t => `<li>${E(t)}</li>`).join('')}</ul></details>` : ''}</div>`;
}
function draw() {
  const ok = mine();
  bell(ok);
  let el = $('#bbChkPanel');
  if (!ok || !S.open) { if (el) el.remove(); const sh = $('#bbChkShade'); if (sh) sh.remove(); S.drawn = ''; return; }
  css(); place();
  const L = todo(), A = all().filter(isAck), bad = mySrc().filter(s => S.src[s.id].err && S.src[s.id].fails > 1), wait = mySrc().filter(s => !S.src[s.id].items && !S.src[s.id].err).length;
  const np = 'Notification' in window && Notification.permission === 'default';
  const html = `<header><b>확인 필요 <i>${L.length}</i></b><span></span>${L.length > 1 ? '<button type="button" class="bc-t" data-c="ackall">모두 확인</button>' : ''}<button type="button" class="bc-x" data-c="close" aria-label="닫기">×</button></header>
    ${np ? '<button type="button" class="bc-np" data-c="perm">크롬 알림도 켜기 — 다른 창을 보고 있어도 떠요</button>' : ''}
    <div class="bc-body">${AREAS.map(a => [a, L.filter(x => x.a === a)]).filter(x => x[1].length).map(([a, v]) => `<section><h4>${E(a)} <small>${v.length}</small></h4>${v.map(x => row(x)).join('')}</section>`).join('') || `<p class="bc-none">${wait ? '읽는 중…' : '지금 확인할 것이 없어요'}</p>`}
    ${wait && L.length ? `<p class="bc-none">${wait}곳 더 읽는 중…</p>` : ''}
    ${A.length ? `<details class="bc-done"${S.ackOpen ? ' open' : ''}><summary>확인한 것 ${A.length}</summary>${A.map(x => row(x, true)).join('')}</details>` : ''}
    ${bad.length ? `<p class="bc-bad">지금 못 읽은 곳 — ${bad.map(s => E(s.nm)).join(' · ')}</p>` : ''}</div>`;
  if (!el) {
    const sh = document.createElement('div'); sh.id = 'bbChkShade'; sh.onclick = () => openPanel(false); document.body.appendChild(sh);
    el = document.createElement('aside'); el.id = 'bbChkPanel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '확인 필요'); document.body.appendChild(el);
    el.addEventListener('click', onPanel);
    el.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('bc-done')) S.ackOpen = e.target.open; }, true);
  }
  if (S.drawn === html) return;
  // 펼쳐 둔 줄 · 보던 자리는 그대로
  const body = $('.bc-body', el), top = body ? body.scrollTop : 0, op = [...el.querySelectorAll('.bc-r > details[open]')].map(d => d.parentNode.dataset.h);
  S.drawn = html; el.innerHTML = html;
  op.forEach(h => { const d = el.querySelector(`.bc-r[data-h="${h}"] > details`); if (d) d.open = true; });
  const nb = $('.bc-body', el); if (nb) nb.scrollTop = top;
}
function onPanel(e) {
  const a = e.target.closest('[data-c]'); if (!a) return;
  const r = a.closest('.bc-r'), x = r && all().find(q => hash(full(q)) === r.dataset.h), k = a.dataset.c;
  if (k === 'close') return openPanel(false);
  if (k === 'go' && x) return go(x);
  if (k === 'ack' && x) return setAck([x], true);
  if (k === 'unack' && x) return setAck([x], false);
  if (k === 'ackall') { const L = todo(); setAck(L, true); say(`${L.length}건 확인했어요 — 아래 ‘확인한 것’ 에서 되돌릴 수 있어요`); return; }
  if (k === 'perm') { try { Notification.requestPermission().then(() => { S.drawn = ''; draw(); }); } catch (err) {} }
}
/* 위 막대의 종 */
function bell(ok) {
  let b = $('#bbChkBtn');
  if (!ok) { if (b) b.remove(); S.pops.slice().forEach(drop); return; }
  if (!b) {
    const host = $('.topbar-right'); if (!host) return;
    css();
    b = document.createElement('button'); b.type = 'button'; b.id = 'bbChkBtn'; b.className = 'icon-btn'; b.title = '확인 필요한 것 모두 보기';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg><i hidden></i>';
    b.onclick = () => openPanel();
    host.insertBefore(b, $('#hardReloadBtn', host) || host.firstChild);
  }
  const c = todo().length, i = $('i', b);
  i.hidden = !c; i.textContent = c > 99 ? '99+' : c; b.setAttribute('aria-label', `확인 필요 ${c}건`);
  try { if (navigator.setAppBadge) c ? navigator.setAppBadge(c).catch(() => {}) : navigator.clearAppBadge().catch(() => {}); } catch (e) {}
}
/* 위 막대 아래 — ERP 알림(erp-alert.js)이 그 자리에 떠 있으면 그 아래 */
function place() { const t = $('.topbar'), ea = $('#erpAlert'), r = ea && ea.getBoundingClientRect(); let y = t ? Math.max(0, Math.round(t.getBoundingClientRect().bottom)) : 0; if (r && r.height && r.right > innerWidth - 16 - 350) y = Math.max(y, Math.round(r.bottom)); document.documentElement.style.setProperty('--bc-top', y + 'px'); }
function css() {
  if ($('#bbChkCss')) return;
  const s = document.createElement('style'); s.id = 'bbChkCss';
  s.textContent = `#bbChkBtn{position:relative;flex:none}#bbChkBtn i{position:absolute;top:-4px;right:-5px;min-width:16px;height:16px;padding:0 4px;border-radius:99px;background:#dc2626;color:#fff;font:700 10px/16px var(--sans,sans-serif);font-style:normal;text-align:center}#bbChkBtn i[hidden]{display:none}
#bbChkPops{position:fixed;z-index:9800;right:16px;top:calc(var(--bc-top,60px) + 12px);display:flex;flex-direction:column;gap:10px;width:min(350px,calc(100vw - 24px));font-family:var(--sans,sans-serif);pointer-events:none}
.bc-pop{pointer-events:auto;padding:12px 14px 13px;border:1px solid #e3dfd8;border-radius:14px;background:#fff;color:#1f2329;box-shadow:0 14px 36px rgba(0,0,0,.16);animation:bcIn .2s ease-out}
@keyframes bcIn{from{opacity:0;transform:translateY(-8px)}}
@media (prefers-reduced-motion:reduce){.bc-pop{animation:none}}
.bc-pop header{display:flex;align-items:center;margin-bottom:3px}.bc-pop header em{flex:1;font-style:normal;font-size:12px;font-weight:600;color:#8a857e}.bc-pop header em::before{content:"";display:inline-block;width:7px;height:7px;margin:0 7px 1px 0;border-radius:50%;background:#1f2329}.bc-pop.hot header em::before{background:#dc2626}
.bc-pop header button{width:28px;height:28px;margin:-6px -8px -4px 0;padding:0;border:0;border-radius:8px;background:transparent;font-size:18px;line-height:1;color:#8a857e;cursor:pointer}
.bc-pop>b{display:block;font-size:14.5px;font-weight:700;line-height:1.45;word-break:keep-all;overflow-wrap:anywhere}.bc-pop p{margin:3px 0 0;font-size:12.5px;line-height:1.5;color:#57534e;word-break:keep-all;overflow-wrap:anywhere}
.bc-pop ul{list-style:none;margin:8px 0 0;padding:0}.bc-pop li{display:flex;gap:10px;padding:3px 0;font-size:12.5px}.bc-pop li span{flex:0 0 76px;color:#8a857e}.bc-pop li i{flex:1;min-width:0;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bc-pop footer{display:flex;gap:6px;margin-top:10px}.bc-pop footer button{height:34px;padding:0 13px;border:1px solid #ddd8d0;border-radius:9px;background:#fff;font:600 12.5px var(--sans,sans-serif);color:#57534e;cursor:pointer}.bc-pop footer .pri{border-color:#1f2329;background:#1f2329;color:#fff}
#bbChkShade{position:fixed;z-index:99994;inset:0;background:rgba(28,25,23,.18)}
#bbChkPanel{position:fixed;z-index:99995;top:0;right:0;bottom:0;width:min(440px,100vw);display:flex;flex-direction:column;background:#fff;color:#1f2329;font-family:var(--sans,sans-serif);border-left:1px solid #e3dfd8;box-shadow:-18px 0 50px rgba(0,0,0,.14);padding-top:env(safe-area-inset-top,0px)}
#bbChkPanel button{font-family:inherit;cursor:pointer}#bbChkPanel>header{display:flex;align-items:center;gap:6px;padding:14px 14px 12px 20px;border-bottom:1px solid #ebe7e1}#bbChkPanel>header b{font-size:16px;font-weight:800}#bbChkPanel>header b i{font-style:normal;margin-left:4px;color:#dc2626;font-variant-numeric:tabular-nums}#bbChkPanel>header span{flex:1}
.bc-t{height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;font-size:12.5px;font-weight:600;color:#57534e}.bc-x{width:34px;height:34px;border:0;border-radius:8px;background:transparent;font-size:21px;line-height:1;color:#8a857e}.bc-t:hover,.bc-x:hover{background:#f3f1ed;color:#1f2329}
.bc-np{margin:10px 20px 0;padding:10px 12px;border:1px solid #ddd8d0;border-radius:10px;background:#faf9f7;font-size:12.5px;font-weight:600;color:#1f2329;text-align:left}
.bc-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:6px 20px calc(26px + env(safe-area-inset-bottom,0px))}
.bc-body section{margin-top:14px}.bc-body h4{margin:0;padding:0 0 6px;border-bottom:1px solid #ebe7e1;font-size:12.5px;font-weight:700;color:#8a857e}.bc-body h4 small{margin-left:3px;font-size:12px;font-weight:600;color:#b5afa6}
.bc-r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 8px;align-items:start;padding:9px 0;border-bottom:1px solid #f3f1ed}.bc-m{padding:0;border:0;background:transparent;text-align:left;color:inherit}.bc-m b{display:block;font-size:14px;font-weight:600;line-height:1.45;word-break:keep-all;overflow-wrap:anywhere}.bc-m span{display:block;margin-top:2px;font-size:12.5px;line-height:1.5;color:#78716c;word-break:keep-all;overflow-wrap:anywhere}.bc-m:hover b{text-decoration:underline;text-decoration-color:#b8b1a6;text-underline-offset:3px}.bc-r.hot .bc-m b::before{content:"";display:inline-block;width:7px;height:7px;margin:0 7px 2px 0;border-radius:50%;background:#dc2626}
.bc-ok{height:30px;padding:0 10px;border:1px solid #ddd8d0;border-radius:8px;background:#fff;font-size:12px;font-weight:600;color:#57534e;white-space:nowrap}.bc-ok:hover{border-color:#1f2329;color:#1f2329}
.bc-r>details{grid-column:1/-1;margin-top:4px}.bc-body summary{padding:3px 0;font-size:12px;color:#8a857e;cursor:pointer;list-style:none}.bc-body summary::-webkit-details-marker{display:none}.bc-body summary::after{content:" ▾"}.bc-r ul{margin:2px 0 4px;padding:8px 12px;list-style:none;border-radius:9px;background:#faf9f7}.bc-r li{padding:3px 0;font-size:12.5px;line-height:1.5;color:#57534e;word-break:keep-all;overflow-wrap:anywhere}
.bc-done{margin-top:20px}.bc-done .bc-m{opacity:.55}.bc-none{margin:0;padding:34px 0;text-align:center;font-size:13px;color:#8a857e}.bc-bad{margin:18px 0 0;font-size:12px;color:#8a857e}
@media (max-width:600px){#bbChkPops{left:12px;right:12px;width:auto}#bbChkPanel{width:100vw;border-left:0}.bc-ok{height:34px}}
@media print{#bbChkPops,#bbChkPanel,#bbChkShade{display:none}}`;
  document.head.appendChild(s);
}
/* ── 돌리기 ── */
function tick() {
  if (!mine()) { draw(); return; }
  if (!S.on) {
    S.on = true;
    try { kvPull('check_ack', LS.ack, v => { S.ack = Object.assign({}, v || {}); closePops(all().filter(isAck).map(full)); S.drawn = ''; draw(); }); } catch (e) {}
    if (window.OfficeLive) {
      const soon = (id, ms) => () => { const c = S.src[id]; c.next = Math.min(c.next, Date.now() + (ms || 3000)); };
      window.OfficeLive.on(['erp_alert', 'erp_ask'], soon('erp')); window.OfficeLive.on(['erp_rows'], () => { soon('erp', 20e3)(); soon('zero', 60e3)(); }); window.OfficeLive.on(['leave_comp_requests'], soon('appr')); window.OfficeLive.on(['dlog_pages'], soon('dz', 30e3));
      window.OfficeLive.on(['app_kv'], () => { try { kvPull('check_ack', LS.ack, v => { S.ack = Object.assign({}, v || {}); closePops(all().filter(isAck).map(full)); S.drawn = ''; draw(); }); } catch (e) {} });
    }
  }
  const now = Date.now(), slow = document.hidden ? 2 : 1;
  for (const s of mySrc()) { if (S.running >= 3) break; const c = S.src[s.id]; if (!c.busy && now >= (c.at && slow > 1 ? c.next + s.ev * MIN : c.next)) runSrc(s); }
  daily(); bell(true);
  dropOpened();
  if (S.pops.length) place();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.open) openPanel(false); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(tick, 300); });
addEventListener('resize', place);
document.addEventListener('click', () => { if (S.pops.length) setTimeout(() => { dropOpened(); place(); }, 60); });
addEventListener('storage', e => { if (e.key === LS.seen) S.seen = jget(LS.seen); });
setInterval(tick, 10e3);
setTimeout(tick, 4000);          // 오피스 첫 화면을 먼저 그린 뒤
window.BBCheck = {S, SRC, open: openPanel, tick, todo, all, _announce: announce};
})();
