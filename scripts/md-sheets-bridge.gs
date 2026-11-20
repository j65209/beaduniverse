/**
 * Bead Universe Office ↔ 구글시트 브리지 — 지금은 ERP MASTER(재고 마스터) 하나 (ERP전산팀 · 물류 자동 작업이 칸을 고칠 때)
 *
 * 2026-11-20 MD 시트 5개(주얼리 MD · MD 코페리 · MD 코즈미 · 에이블리 · 지그재그 가격표)는 구글을 끊었다 — 오피스 MD팀 시트(mdsheet/)가 원본이고
 * 이 브리지를 부르지 않는다. 아래 BOOKS 에서도 뺐다 (배포돼 있는 Apps Script 는 다음 새 버전 배포 때 같이 빠짐 — 화면은 이미 안 부름).
 *
 * ── 설치 (한 번만) ──────────────────────────────────────────────
 *  1. https://script.google.com → 새 프로젝트 → 이 파일 내용 전체를 붙여넣고 저장
 *     (6개 시트 모두 편집 권한이 있는 구글 계정으로 해야 한다)
 *  2. 오른쪽 위 [배포] → [새 배포] → 유형: 웹 앱
 *       · 실행 계정: 나
 *       · 액세스 권한: 모든 사용자
 *     → [배포] → 권한 승인 → "웹 앱 URL"(…/exec) 복사
 *  3. 오피스 MD팀 탭 → [구글시트 연결] 칸에 URL 붙여넣기 → [연결]
 *     (첫 연결 때 이 스크립트가 비밀 토큰을 만들어 오피스에 넘겨준다. 이후 다른 곳에서는 연결 불가)
 *
 *  연결을 처음부터 다시 하고 싶으면 편집기에서 resetPairing 함수를 한 번 실행한다.
 *  코드를 고친 뒤에는 [배포] → [배포 관리] → 연필 → 버전: 새 버전 → [배포] (URL 유지)
 */

// 2026-11-20 MD 시트 5개(에이블리 · 지그재그 가격표 · 코페리 · 주얼리 MD · 코즈미)는 구글을 끊고 오피스 MD팀 시트가 원본 — 이 연결로는 ERP MASTER 만 읽고 쓴다
const BOOKS = {
  invoice:    '1hE7jVLZvE3gBYWflk6d3p2vZroQC9Hz3HY7jf2eqIcA',
};

// MD 업무 탭만 — 판매원본·주문로그·날짜별 주문 원본(개인정보)·시스템(_로 시작) 탭은 오피스에 노출하지 않는다
const EXCLUDE = /판매원본|주문로그|_state|^_|^\d+\.\d+(코페리|아페티|코즈미)$|^(코페리|아페티|코즈미)\d+\.\d+$|^플토/;
// 날짜가 붙어 매일 새로 생기는 송장출력 탭은 브랜드별로 가장 왼쪽(최신) 탭 하나만
const LATEST_ONLY = /^\d+\.\d+(코페리|아페티|코즈미)송장출력$/;

const MAX_ROWS = 3000;

function doGet(e) { return route_((e && e.parameter) || {}); }
function doPost(e) {
  let p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (_) {}
  return route_(p);
}

function route_(p) {
  try {
    if (p.action === 'pair') return json_(pair_());
    if (!checkToken_(p.token)) return json_({ ok: false, error: 'unauthorized' });
    switch (p.action) {
      case 'ping':  return json_({ ok: true });
      case 'meta':  return json_(meta_(p.fresh === '1' || p.fresh === true));
      case 'read':  return json_(read_(p.book, p.sheet, p.have || null, p.parts || ''));
      case 'write': return json_(write_(p.book, p.sheet, p.edits || []));
      default:      return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ── 연결(페어링) ── */
function pair_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('TOKEN')) return { ok: false, error: 'already_paired' };
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  props.setProperty('TOKEN', token);
  return { ok: true, token: token };
}
function checkToken_(t) {
  const saved = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return !!saved && t === saved;
}
function resetPairing() {
  PropertiesService.getScriptProperties().deleteProperty('TOKEN');
  CacheService.getScriptCache().remove('meta');
}

/* ── 탭 목록 ── */
function allowedSheets_(ss) {
  const seenLatest = {};
  return ss.getSheets().filter(function (sh) {
    const name = sh.getName();
    if (sh.isSheetHidden() || EXCLUDE.test(name)) return false;
    const m = name.match(LATEST_ONLY);
    if (m) {
      if (seenLatest[m[1]]) return false;
      seenLatest[m[1]] = true;
    }
    return true;
  });
}
function openBook_(key) {
  const id = BOOKS[key];
  if (!id) throw new Error('unknown_book');
  return SpreadsheetApp.openById(id);
}
function sheetOf_(key, name) {
  const ss = openBook_(key);
  const sh = ss.getSheetByName(name);
  if (!sh || sh.isSheetHidden() || EXCLUDE.test(name)) throw new Error('sheet_not_allowed');
  // 날짜 붙은 송장출력 탭만 "브랜드별 최신 1개" 규칙을 확인한다 (전체 탭 훑기는 이때만)
  if (LATEST_ONLY.test(name) && !allowedSheets_(ss).some(function (s) { return s.getName() === name; })) throw new Error('sheet_not_allowed');
  return { ss: ss, sh: sh };
}

/* ── 캐시 — CacheService 값 1개당 100KB 제한이라 잘라서 저장한다 ── */
const CHUNK = 30000;
function cachePut_(key, obj, ttl) {
  try {
    const s = JSON.stringify(obj), n = Math.max(1, Math.ceil(s.length / CHUNK)), m = {};
    for (let i = 0; i < n; i++) m[key + ':' + i] = s.slice(i * CHUNK, (i + 1) * CHUNK);
    m[key + ':n'] = String(n);
    CacheService.getScriptCache().putAll(m, ttl);
  } catch (_) {}
}
function cacheGet_(key) {
  try {
    const c = CacheService.getScriptCache(), n = Number(c.get(key + ':n'));
    if (!n) return null;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(key + ':' + i);
    const got = c.getAll(keys);
    let s = '';
    for (let i = 0; i < n; i++) {
      const part = got[key + ':' + i];
      if (part == null) return null;
      s += part;
    }
    return JSON.parse(s);
  } catch (_) { return null; }
}
function cacheDel_(key) { try { CacheService.getScriptCache().remove(key + ':n'); } catch (_) {} }
function sig_(s) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8));
}

function meta_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) {
    const hit = cache.get('meta');
    if (hit) return JSON.parse(hit);
  }
  const books = Object.keys(BOOKS).map(function (key) {
    try {
      const ss = openBook_(key);
      return {
        key: key, id: BOOKS[key], name: ss.getName(), url: ss.getUrl(),
        tabs: allowedSheets_(ss).map(function (sh) {
          return { name: sh.getName(), gid: sh.getSheetId() };
        }),
      };
    } catch (err) {
      return { key: key, id: BOOKS[key], error: String((err && err.message) || err), tabs: [] };
    }
  });
  const out = { ok: true, books: books, at: new Date().toISOString() };
  try { cache.put('meta', JSON.stringify(out), 1800); } catch (_) {}
  return out;
}

/* ── 읽기 v2 ──
 * 내용(표시값·수식)과 구조(서식·드롭다운·숨김열·병합)를 따로 캐시한다.
 *  · 내용 20초 캐시 (쓰기 때 지움) — 여러 사람이 같은 탭을 보거나 60초 갱신이 몰려도 시트를 한 번만 읽는다
 *  · 구조 30분 캐시 — 서식·드롭다운은 거의 안 바뀌는데 큰 탭에서 가장 오래 걸린다
 * 같은 수식(아래로 채우기)은 R1C1 로 한 번만, 서식은 같은 열의 연속 구간 단위로 묶어 보낸다.
 * 오피스가 have={ct,st} 로 이미 가진 버전을 알려주면 바뀐 부분만 보낸다. */
const SPILL = /\b(QUERY|FILTER|SORT|SORTN|SEQUENCE|ARRAYFORMULA|UNIQUE|IMPORTRANGE|FLATTEN|TRANSPOSE)\s*\(/i;
function cacheBase_(key, sh) {
  return key + ':' + sh.getSheetId() + ':' + Math.min(sh.getLastRow(), MAX_ROWS) + 'x' + sh.getLastColumn();
}
function read_(key, name, have, parts) {
  const T = {}, t0 = Date.now();
  const sh = sheetOf_(key, name).sh;
  T.open = Date.now() - t0;
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn(), gid = sh.getSheetId(), at = new Date().toISOString();
  if (!lastRow || !lastCol) {
    return { ok: true, v: 2, rows: 0, cols: 0, totalRows: 0, gid: gid, at: at,
      content: { sig: 'empty', values: [], fxList: [], fxRuns: [], img: {}, ro: false },
      structure: { sig: 'empty', bg: [], fc: [], bold: [], dv: [], lists: [], hiddenCols: [], merges: [], frozenRows: 0, frozenCols: 0 } };
  }
  const nRows = Math.min(lastRow, MAX_ROWS), base = cacheBase_(key, sh);
  if (parts === 'formulas') {
    const tf = Date.now();
    let fx = cacheGet_('f2:' + base);
    if (!fx) { fx = readFormulas_(sh, nRows, lastCol); cachePut_('f2:' + base, fx, 600); }
    T.formulas = Date.now() - tf;
    const o = { ok: true, v: 2, rows: nRows, cols: lastCol, totalRows: lastRow, truncated: lastRow > nRows, gid: gid, at: at, ms: T };
    if (!have || have.fx !== fx.sig) o.fx = fx;
    return o;
  }
  // parts='content' 면 값만(빠름), 'structure' 면 서식만 — 오피스가 처음 여는 탭은 둘을 따로 받아 값부터 그린다
  const out = { ok: true, v: 2, rows: nRows, cols: lastCol, totalRows: lastRow, truncated: lastRow > nRows, gid: gid, at: at, ms: T };
  let t = Date.now();
  if (parts !== 'structure') {
    let content = cacheGet_('c2:' + base);
    if (!content) { content = readContent_(sh, nRows, lastCol); cachePut_('c2:' + base, content, 20); }
    if (!have || have.ct !== content.sig) out.content = content;
  }
  T.content = Date.now() - t; t = Date.now();
  if (parts !== 'content') {
    let st = cacheGet_('s2:' + base);
    if (!st) { st = readStructure_(sh, nRows, lastCol, key + ':' + base); cachePut_('s2:' + base, st, 1800); }
    if (!have || have.st !== st.sig) out.structure = st;
  }
  T.structure = Date.now() - t;
  return out;
}

// 같은 열에서 연속된 같은 값을 [열, 시작행, 끝행, 값] 으로 묶는다 (값이 null 이면 생략)
function runs_(grid, nRows, nCols, pick) {
  const out = [];
  for (let c = 0; c < nCols; c++) {
    let run = null;
    for (let r = 0; r < nRows; r++) {
      const v = pick(grid[r][c], r, c);
      if (run && run[3] === v && run[2] === r - 1) { run[2] = r; continue; }
      if (run && run[3] != null) out.push(run);
      run = [c, r, r, v];
    }
    if (run && run[3] != null) out.push(run);
  }
  return out;
}

function readContent_(sh, nRows, nCols) {
  const rg = sh.getRange(1, 1, nRows, nCols);
  const values = rg.getDisplayValues();
  const fr = rg.getFormulasR1C1();
  const fxList = [], fxIdx = {}, img = {};
  let ro = false;
  const fxRuns = runs_(fr, nRows, nCols, function (f, r, c) {
    if (!f) return null;
    if (!(f in fxIdx)) { fxIdx[f] = fxList.length; fxList.push(f); if (SPILL.test(f)) ro = true; }
    const src = imageSrc_(f, r, c, values);
    if (src) img[r + ',' + c] = src;
    return fxIdx[f];
  });
  // 뒤쪽 빈칸·빈 행은 잘라서 전송량을 줄인다
  for (let r = 0; r < values.length; r++) {
    let e = values[r].length;
    while (e > 0 && values[r][e - 1] === '') e--;
    values[r] = values[r].slice(0, e);
  }
  let last = values.length;
  while (last > 0 && !values[last - 1].length) last--;
  values.length = last;
  const body = { values: values, fxList: fxList, fxRuns: fxRuns, img: img, ro: ro };
  body.sig = sig_(JSON.stringify(body));
  return body;
}

function readFormulas_(sh, nRows, nCols) {
  const fr = sh.getRange(1, 1, nRows, nCols).getFormulasR1C1();
  const fxList = [], fxIdx = {};
  let ro = false;
  const fxRuns = runs_(fr, nRows, nCols, function (f) {
    if (!f) return null;
    if (!(f in fxIdx)) { fxIdx[f] = fxList.length; fxList.push(f); if (SPILL.test(f)) ro = true; }
    return fxIdx[f];
  });
  const body = { fxList: fxList, fxRuns: fxRuns, ro: ro };
  body.sig = sig_(JSON.stringify(body));
  return body;
}

function imageSrc_(f, r, c, values) {
  const m = f.match(/^=\s*IMAGE\s*\(\s*(?:"([^"]+)"|R(\[-?\d+\]|\d+)?C(\[-?\d+\]|\d+)?)/i);
  if (!m) return '';
  if (m[1]) return m[1];
  const v = String(((values[relIdx_(m[2], r)] || [])[relIdx_(m[3], c)]) || '');
  return /^https?:\/\//i.test(v) ? v : '';
}
function relIdx_(part, base) {
  if (part == null || part === '') return base;
  if (part.charAt(0) === '[') return base + Number(part.slice(1, -1));
  return Number(part) - 1;
}

function readStructure_(sh, nRows, nCols, ckey) {
  const rg = sh.getRange(1, 1, nRows, nCols);
  const lower = function (def) { return function (x) { x = String(x || '').toLowerCase(); return x && x !== def ? x : null; }; };
  const bg = runs_(rg.getBackgrounds(), nRows, nCols, lower('#ffffff'));
  const fc = runs_(rg.getFontColors(), nRows, nCols, lower('#000000'));
  const bold = runs_(rg.getFontWeights(), nRows, nCols, function (x) { return x === 'bold' ? 1 : null; });
  const dvHit = ckey ? cacheGet_('d2:' + ckey) : null;
  const lists = dvHit ? dvHit.lists : [], listIdx = {}, rangeCache = {};
  const dv = dvHit ? dvHit.dv : runs_(rg.getDataValidations(), nRows, nCols, function (v) {
    if (!v) return null;
    const spec = dvSpec_(v, rangeCache);
    if (!spec) return null;
    const sk = JSON.stringify(spec);
    if (!(sk in listIdx)) { listIdx[sk] = lists.length; lists.push(spec); }
    return listIdx[sk];
  });
  if (!dvHit && ckey) cachePut_('d2:' + ckey, { dv: dv, lists: lists }, 21600);
  const hiddenCols = [];
  for (let c = 1; c <= nCols; c++) if (sh.isColumnHiddenByUser(c)) hiddenCols.push(c - 1);
  const merges = rg.getMergedRanges().map(function (m) {
    return [m.getRow() - 1, m.getColumn() - 1, m.getNumRows(), m.getNumColumns()];
  });
  const st = { bg: bg, fc: fc, bold: bold, dv: dv, lists: lists, hiddenCols: hiddenCols, merges: merges,
    frozenRows: sh.getFrozenRows(), frozenCols: sh.getFrozenColumns() };
  st.sig = sig_(JSON.stringify(st));
  return st;
}

// 편집기에서 실행해 큰 탭 읽기 속도를 본다 (두 번째 실행은 캐시 효과)

function dvSpec_(v, rangeCache) {
  const type = v.getCriteriaType(), args = v.getCriteriaValues();
  const T = SpreadsheetApp.DataValidationCriteria;
  if (type === T.VALUE_IN_LIST) return { t: 'list', items: (args[0] || []).map(String).slice(0, 300) };
  if (type === T.VALUE_IN_RANGE) {
    const range = args[0];
    if (!range) return null;
    const a1 = range.getSheet().getName() + '!' + range.getA1Notation();
    if (!(a1 in rangeCache)) {
      const seen = {}, items = [];
      range.getDisplayValues().forEach(function (row) {
        row.forEach(function (x) { if (x !== '' && !seen[x]) { seen[x] = 1; items.push(x); } });
      });
      rangeCache[a1] = items.slice(0, 500);
    }
    return { t: 'list', items: rangeCache[a1] };
  }
  if (type === T.CHECKBOX) {
    return { t: 'check', on: args.length ? String(args[0]) : 'TRUE', off: args.length > 1 ? String(args[1]) : 'FALSE' };
  }
  return null;
}

/* ── 쓰기 ── 수식 칸은 거부, 그 사이 다른 사람이 바꾼 칸은 충돌로 돌려보낸다 */
function write_(key, name, edits) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const o = sheetOf_(key, name), sh = o.sh;
    const results = [], touchedRows = {};
    edits.slice(0, 200).forEach(function (e) {
      const r = Number(e.r), c = Number(e.c);
      if (!(r >= 1 && c >= 1)) { results.push({ r: r, c: c, ok: false, error: 'bad_cell' }); return; }
      const cell = sh.getRange(r, c);
      if (cell.getFormula()) { results.push({ r: r, c: c, ok: false, error: 'formula_cell' }); return; }
      const cur = cell.getDisplayValue();
      if (e.old != null && String(e.old) !== cur) {
        results.push({ r: r, c: c, ok: false, error: 'conflict', current: cur }); return;
      }
      cell.setValue(coerce_(cell, e.v));
      touchedRows[r] = true;
      results.push({ r: r, c: c, ok: true });
    });
    SpreadsheetApp.flush();
    cacheDel_('c2:' + cacheBase_(key, sh));
    const lastCol = sh.getLastColumn();
    const rows = {};
    Object.keys(touchedRows).forEach(function (r) {
      rows[r] = sh.getRange(Number(r), 1, 1, lastCol).getDisplayValues()[0];
    });
    return { ok: true, results: results, rows: rows, at: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

// 오피스에서 입력한 글자를 그 칸의 원래 형식(숫자·날짜·체크박스)에 맞춰 넣는다. '='로 시작하면 수식이 아닌 글자로 넣는다.
function coerce_(cell, input) {
  const s = input == null ? '' : String(input);
  if (s === '') return '';
  if (s.charAt(0) === '=') return "'" + s;
  const raw = cell.getValue();
  if (typeof raw === 'boolean') {
    if (/^(true|1|y|yes|o|✓)$/i.test(s)) return true;
    if (/^(false|0|n|no|x)$/i.test(s)) return false;
  }
  if (raw instanceof Date) {
    const m = s.match(/^(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const t = s.replace(/[,\s₩￦원]/g, '');
  if (/^-?\d+(\.\d+)?%$/.test(t)) return parseFloat(t) / 100;
  if (/^-?\d+(\.\d+)?$/.test(t) && !/^0\d/.test(t)) return parseFloat(t);
  return s;
}
