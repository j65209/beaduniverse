/**
 * 브라이트비드 오피스 · 메일 발송 서버 (Google Apps Script 웹 앱)
 *
 * 오피스앱 「📂 업무용 툴 → 📨 메일 발송」이 이 서버를 불러서 메일을 한 통씩 보낸다.
 * - 메일은 이 스크립트를 배포한 구글 계정(예: brightbeed@bead-uni.com) 이름으로 나간다.
 *   메일마다 「답장 받을 주소」(Reply-To)를 따로 정할 수 있다 (예: 답장은 brightbeed@gmail.com 으로).
 * - 발송 한도는 받는 사람 기준, 첫 발송부터 24시간 단위 (자정 초기화 아님):
 *   개인 지메일 100명 · 구글 워크스페이스 1,500명 (체험 중이거나 막 시작한 계정은 더 적을 수 있음).
 * - 제목·본문·첨부 설정은 이 계정에 저장돼서 어느 PC에서 열어도 같다.
 * - 보낸 기록은 구글 시트 「브라이트비드 메일 발송 기록」에 전부 쌓인다 (발송완료 · 실패).
 *   지메일에서 직접 보낸 메일(보낸편지함)도 이 시트로 가져와서 지금까지 보낸 기록을 한곳에서 본다
 *   — 처음엔 전체를 가져오고, 그 뒤로는 1시간마다 새로 보낸 것만 자동으로 이어 붙인다
 *     (메일 발송 화면에 연결하거나 setup 을 실행하면 1시간 트리거가 만들어진다).
 * - 중복 발송 방지: 기록에 있는 주소 + 지메일 보낸편지함에 예전에 메일을 보낸 적 있는 주소는 다시 보내지 않는다
 *   (이 툴을 쓰기 전에 직접 보낸 메일도 걸러짐).
 * - 첨부파일은 구글 드라이브 「브라이트비드 메일 첨부」 폴더에 올라간다.
 *
 * 아래 MAIL_KEY 는 오피스 메일 발송 화면의 「서버 코드 복사」 버튼이 자동으로 채운다.
 * 이 키를 아는 사람만 이 서버로 메일을 보낼 수 있으니 저장소(GitHub)에 올리지 말 것.
 */
const MAIL_KEY = '__MAIL_KEY__';
/* 「보내는 계정 바꾸기」로 복사한 코드에만 채워진다 — 예전 계정의 발송 기록 시트를 이어서 써서
   중복 발송 방지가 끊기지 않게 한다. 그 시트를 이 계정에 「편집자」로 공유해 둬야 한다. */
const LOG_SHEET_ID = '__LOG_ID__';

const SERVER_VERSION = 5;
const QUOTA_TEXT = '발송 한도를 다 썼어요 (첫 발송부터 24시간 기준). 한도가 다시 차면 이어서 보내 주세요.';
const LOG_TITLE = '브라이트비드 메일 발송 기록';
const FOLDER_TITLE = '브라이트비드 메일 첨부';
const STATUS_SENT = '발송완료';
const STATUS_FAIL = '실패';
const KIND_TOOL = '툴';
const KIND_GMAIL = '지메일 직접';
const LOG_HEADER = ['발송 시각', '이메일', '제목', '결과', '메모', '구분', '메일 ID'];
const EMAIL_RE_G = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function doGet() {
  return json_({ ok: true, app: 'brightbeed-mailer', version: SERVER_VERSION });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: '요청 형식이 잘못됐어요' });
  }
  if (!MAIL_KEY || MAIL_KEY.indexOf('__') === 0 || req.key !== MAIL_KEY) {
    return json_({ ok: false, code: 'auth', error: '발송 키가 맞지 않아요. 오피스 메일 발송 화면의 연결 설정을 확인해 주세요.' });
  }
  try {
    switch (req.action) {
      case 'ping': return json_(ping_());
      case 'saveTemplate': return json_(saveTemplate_(req.template));
      case 'upload': return json_(upload_(req.file));
      case 'sent': return json_(sentList_());
      case 'check': return json_(check_(req.emails));
      case 'history': return json_(history_(req.limit));
      case 'importSent': return json_(withLock_(function () { ensureTrigger_(); return syncSent_(25 * 1000); }));
      case 'send': return json_(withLock_(function () { return send_(req); }));
      default: return json_({ ok: false, error: '알 수 없는 요청이에요: ' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: errText_(err) });
  }
}

/* ---------------------------------------------------------------- 요청 처리 */

function ping_() {
  const logId = logId_();
  return {
    ok: true,
    version: SERVER_VERSION,
    sender: Session.getEffectiveUser().getEmail(),
    remaining: MailApp.getRemainingDailyQuota(),
    template: getTemplate_(),
    logUrl: logId ? logUrl_(logId) : '',
    importDone: props_().getProperty('importDone') === '1',
    lastSync: Number(props_().getProperty('lastSync') || 0) || null,
  };
}

function getTemplate_() {
  const raw = props_().getProperty('template');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function saveTemplate_(t) {
  if (!t || typeof t !== 'object') return { ok: false, error: '저장할 내용이 없어요' };
  const clean = {
    subject: String(t.subject || ''),
    body: String(t.body || ''),
    name: String(t.name || ''),
    replyTo: extractEmail_(t.replyTo),
    interval: Number(t.interval) || 3,
    attachments: (t.attachments || []).map(function (a) {
      return { id: String(a.id), name: String(a.name || ''), size: Number(a.size) || 0, mimeType: String(a.mimeType || '') };
    }),
    savedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(clean);
  if (raw.length > 8500) return { ok: false, error: '본문이 너무 길어서 저장할 수 없어요 (약 4,000자 이하로 줄여 주세요)' };
  props_().setProperty('template', raw);
  return { ok: true, template: clean };
}

function upload_(file) {
  if (!file || !file.data || !file.name) return { ok: false, error: '올릴 파일이 없어요' };
  const bytes = Utilities.base64Decode(file.data);
  if (bytes.length > 20 * 1024 * 1024) return { ok: false, error: '첨부파일은 20MB 이하만 가능해요' };
  const blob = Utilities.newBlob(bytes, file.mimeType || 'application/octet-stream', file.name);
  const saved = folder_().createFile(blob);
  return { ok: true, file: { id: saved.getId(), name: saved.getName(), size: bytes.length, mimeType: blob.getContentType() } };
}

function send_(req) {
  const test = !!req.test;
  const to = test ? Session.getEffectiveUser().getEmail() : extractEmail_(req.to);
  if (!to) return { ok: false, status: 'skip', error: '이메일 형식이 아니에요' };

  const subject = String(req.subject || '').trim();
  const body = String(req.body || '');
  if (!subject) return { ok: false, status: 'fail', error: '제목이 비어 있어요' };
  if (!body.trim()) return { ok: false, status: 'fail', error: '본문이 비어 있어요' };

  if (!test && !req.force) {
    const prev = previous_(to, sentMap_());
    if (prev) {
      return { ok: true, status: 'skip', to: to, reason: prevText_(prev), prev: prev, remaining: MailApp.getRemainingDailyQuota() };
    }
  }
  if (MailApp.getRemainingDailyQuota() < 1) {
    return { ok: false, status: 'quota', error: QUOTA_TEXT, remaining: 0 };
  }

  const attachments = (req.attachmentIds || []).map(function (id) {
    try {
      return DriveApp.getFileById(id).getBlob();
    } catch (e) {
      throw new Error('첨부파일을 찾을 수 없어요. 메일 발송 화면에서 첨부파일을 다시 올려 주세요.');
    }
  });

  const opts = { htmlBody: toHtml_(body) };
  if (req.name) opts.name = String(req.name);
  const replyTo = extractEmail_(req.replyTo);
  if (replyTo) opts.replyTo = replyTo;   // 받는 사람이 「답장」을 누르면 이 주소로 간다
  if (attachments.length) opts.attachments = attachments;

  try {
    // GmailApp = 지메일 화면에서 보내는 것과 같은 길. MailApp 으로 보내면 막 만든 워크스페이스 계정(bead-uni.com)의
    // 외부 메일을 구글이 「Message rejected」로 내보내지 않음 (2026-11-06 관리 콘솔 이메일 로그로 확인 — 지메일 화면 발송은 정상).
    GmailApp.sendEmail(to, (test ? '[테스트] ' : '') + subject, body, opts);
  } catch (e) {
    const err = errText_(e);
    if (!test) log_(to, subject, STATUS_FAIL, err);
    const quota = /too many times|quota|limit/i.test(err);
    return { ok: false, status: quota ? 'quota' : 'fail', error: quota ? QUOTA_TEXT : err, remaining: MailApp.getRemainingDailyQuota() };
  }
  if (!test) log_(to, subject, STATUS_SENT, '');
  return { ok: true, status: 'sent', to: to, remaining: MailApp.getRemainingDailyQuota() };
}

/* ---------------------------------------------------------------- 기록 시트 · 폴더 */

/** 이어서 쓰라고 지정된 예전 기록 시트 ID (없으면 '') */
function fixedLogId_() {
  return LOG_SHEET_ID.indexOf('__') === 0 ? '' : LOG_SHEET_ID;
}

function logId_() {
  return fixedLogId_() || props_().getProperty('logId') || '';
}

function logSheet_() {
  const p = props_();
  const fixed = fixedLogId_();
  if (fixed) {
    // 예전 계정의 기록을 이어서 쓴다 — 못 열면 새 시트를 만들지 않고 멈춘다 (빈 기록으로 보내면 같은 곳에 또 보내게 됨)
    let ss;
    try { ss = SpreadsheetApp.openById(fixed); } catch (e) {
      throw new Error('예전 계정의 발송 기록 시트를 열 수 없어요. 그 시트를 ' + Session.getEffectiveUser().getEmail() +
        ' 에 「편집자」로 공유한 뒤 다시 해 주세요.');
    }
    if (p.getProperty('logId') !== fixed) p.setProperty('logId', fixed);
    return ss.getSheets()[0];
  }
  const id = p.getProperty('logId');
  if (id) {
    try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { /* 지워졌으면 새로 만든다 */ }
  }
  const ss = SpreadsheetApp.create(LOG_TITLE);
  const sh = ss.getSheets()[0];
  sh.setName('발송기록');
  sh.getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.hideColumns(7);
  p.setProperty('logId', ss.getId());
  return sh;
}

/** 예전(5칸) 기록 시트에 「구분」「메일 ID」 칸을 붙인다 */
function upgradeLog_(sh) {
  if (String(sh.getRange(1, 6, 1, 1).getValues()[0][0]) === '구분') return;
  sh.getRange(1, 6, 1, 2).setValues([['구분', '메일 ID']]).setFontWeight('bold');
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 6, last - 1, 1).setValues(Array.apply(null, Array(last - 1)).map(function () { return [KIND_TOOL]; }));
  sh.hideColumns(7);
}

function log_(to, subject, status, memo) {
  const sh = logSheet_();
  upgradeLog_(sh);
  sh.appendRow([new Date(), to, subject, status, memo, KIND_TOOL, '']);
}

/* ---------------------------------------------------------------- 지메일 보낸편지함 → 기록 시트 */

/** 트리거(1시간마다) · setup 에서 부르는 공개 함수 */
function syncSent() {
  return withLock_(function () { return syncSent_(60 * 1000); }); // 짧게 — 그동안 발송이 기다리지 않게
}

/**
 * 지메일 보낸편지함의 메일을 기록 시트로 가져온다.
 * - 처음: 보낸편지함 전체를 오래 걸리면 나눠서 (어디까지 했는지 저장) → 다 끝나면 importDone
 * - 그 뒤: 마지막으로 가져온 날 이후 것만
 * - 툴로 보낸 메일(같은 주소·제목·10분 안)은 이미 기록돼 있으니 건너뛴다. 메일 ID 로 중복도 막는다.
 * - 받은 메일·임시보관 메일·나에게 보낸 메일은 뺀다. 「다른 주소로 보내기」 별칭으로 보낸 메일도 내 메일로 본다.
 */
function syncSent_(budgetMs) {
  const started = Date.now();
  const p = props_();
  const mine = myAddresses_();
  const sh = logSheet_();
  upgradeLog_(sh);
  const full = p.getProperty('importDone') !== '1';
  let start = full ? Number(p.getProperty('importStart') || 0) : 0;
  if (full && !start) p.setProperty('importBegan', String(started));
  const began = Number(p.getProperty('importBegan') || started);
  const since = Number(p.getProperty('lastSync') || started) - 2 * 86400000;
  const query = full ? 'in:sent' : 'in:sent after:' + Utilities.formatDate(new Date(since), 'Asia/Seoul', 'yyyy/MM/dd');

  // 이미 있는 메일 ID · 툴로 보낸 줄(주소|제목 → 시각·행)
  const last = sh.getLastRow();
  const known = {};
  const tool = {};
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, 7).getValues().forEach(function (r, i) {
      if (r[6]) known[String(r[6])] = true;
      if (r[5] !== KIND_GMAIL && r[3] === STATUS_SENT) {
        const k = String(r[1]).toLowerCase() + '|' + String(r[2]);
        (tool[k] = tool[k] || []).push({ t: r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]), row: i + 2, id: r[6] });
      }
    });
  }

  const added = [];
  function take(threads) {
    if (!threads.length) return;
    GmailApp.getMessagesForThreads(threads).forEach(function (msgs) {
      msgs.forEach(function (m) {
        const id = m.getId();
        if (known[id] || m.isDraft() || mine.indexOf(addrOf_(m.getFrom())) === -1) return; // 이미 있음 · 임시보관 · 받은 메일
        known[id] = true;
        const when = m.getDate();
        const subj = m.getSubject();
        const seen = {};
        (String(m.getTo()) + ',' + String(m.getCc()) + ',' + String(m.getBcc())).replace(EMAIL_RE_G, function (raw) {
          const e = raw.toLowerCase();
          if (seen[e] || mine.indexOf(e) !== -1) return raw;
          seen[e] = true;
          const hit = (tool[e + '|' + subj] || []).filter(function (x) { return Math.abs(x.t - when.getTime()) < 10 * 60 * 1000; })[0];
          if (hit) { // 툴로 보낸 메일 — 이미 기록돼 있으니 메일 ID 만 적어 둔다
            if (!hit.id) { sh.getRange(hit.row, 7, 1, 1).setValues([[id]]); hit.id = id; }
          } else {
            added.push([when, e, subj, STATUS_SENT, '지메일에서 직접 보낸 메일', KIND_GMAIL, id]);
          }
          return raw;
        });
      });
    });
  }

  let scanned = 0, done = false;
  if (full && start > 0) {
    // 나눠서 가져오는 사이에 맨 위로 올라온 스레드(새로 보냈거나 답장한 메일)를 먼저 — 순서가 밀려서 빠지는 메일이 없게
    for (let s = 0; s < 1000; s += 50) {
      const top = GmailApp.search('in:sent', s, 50);
      const fresh = top.filter(function (t) { return t.getLastMessageDate().getTime() > began - 5 * 60 * 1000; });
      take(fresh);
      if (fresh.length < top.length || top.length < 50) break;
    }
  }
  do {
    const threads = GmailApp.search(query, start, 50);
    take(threads);
    start += threads.length;
    scanned += threads.length;
    if (threads.length < 50) { done = true; break; }
  } while (Date.now() - started < budgetMs);

  if (added.length) {
    sh.getRange(sh.getLastRow() + 1, 1, added.length, 7).setValues(added);
    const n = sh.getLastRow() - 1;
    if (n > 1) sh.getRange(2, 1, n, 7).sort({ column: 1, ascending: true });
  }
  if (full) {
    p.setProperty('importStart', String(start));
    if (done) p.setProperty('importDone', '1');
  }
  if (done) p.setProperty('lastSync', String(started));
  return { ok: true, full: full, done: done, added: added.length, scanned: scanned, total: full ? start : scanned };
}

/** 1시간마다 보낸편지함을 기록 시트로 가져오는 트리거 (없으면 만든다) */
function ensureTrigger_() {
  try {
    if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'syncSent'; })) {
      ScriptApp.newTrigger('syncSent').timeBased().everyHours(1).create();
    }
    return true;
  } catch (e) {
    return false;
  }
}

/** 이 계정 주소 + 「다른 주소로 보내기」 별칭 (소문자) */
function myAddresses_() {
  const list = [String(Session.getEffectiveUser().getEmail() || '').toLowerCase()];
  try { GmailApp.getAliases().forEach(function (a) { list.push(String(a).toLowerCase()); }); } catch (e) { /* 별칭 없음 */ }
  return list.filter(function (a, i) { return a && list.indexOf(a) === i; });
}

/** "이름" <a@b.com> → a@b.com */
function addrOf_(v) {
  const s = String(v || '');
  const m = s.match(/<([^>]+)>/);
  return extractEmail_(m ? m[1] : s).toLowerCase();
}

/** 기록 시트에서 「발송완료」인 주소 → 마지막으로 보낸 시각(ISO) */
function sentMap_() {
  const sh = logSheet_();
  const last = sh.getLastRow();
  const map = {};
  if (last < 2) return map;
  sh.getRange(2, 1, last - 1, 4).getValues().forEach(function (r) { // 시각 · 이메일 · 제목 · 결과
    const e = String(r[1]).trim().toLowerCase();
    if (e && r[3] === STATUS_SENT) map[e] = r[0] instanceof Date ? r[0].toISOString() : String(r[0]);
  });
  return map;
}

function sentList_() {
  const map = sentMap_();
  return { ok: true, emails: Object.keys(map), dates: map };
}

/** 예전에 보낸 적 있는지: 발송 기록 → 지메일 보낸편지함 순서로 확인 */
function previous_(email, map) {
  const k = String(email).toLowerCase();
  if (map[k]) return { source: 'log', when: map[k] };
  const threads = GmailApp.search('in:sent to:' + k, 0, 1);
  if (threads.length) return { source: 'gmail', when: threads[0].getLastMessageDate().toISOString() };
  return null;
}

function prevText_(prev) {
  const d = String(prev.when || '').slice(0, 10);
  return prev.source === 'log'
    ? '이미 보낸 주소 (발송 기록' + (d ? ' ' + d : '') + ')'
    : '예전에 메일 보낸 적 있음 (지메일 보낸편지함' + (d ? ' ' + d : '') + ')';
}

/** 보내기 전에 여러 주소를 한 번에 확인 (한 번에 최대 40개) */
function check_(emails) {
  const map = sentMap_();
  const found = {};
  (emails || []).slice(0, 40).forEach(function (raw) {
    const e = extractEmail_(raw);
    if (!e) return;
    const prev = previous_(e, map);
    if (prev) found[e.toLowerCase()] = prev;
  });
  return { ok: true, found: found };
}

/** 발송 기록 (최근 것부터) + 전체 건수 */
function history_(limit) {
  const sh = logSheet_();
  const last = sh.getLastRow();
  const counts = { sent: 0, fail: 0, tool: 0, gmail: 0 };
  const url = logUrl_(logId_());
  if (last < 2) return { ok: true, total: 0, rows: [], counts: counts, logUrl: url };
  const all = sh.getRange(2, 1, last - 1, 6).getValues();
  all.forEach(function (r) {
    if (r[3] !== STATUS_SENT) { counts.fail++; return; }
    counts.sent++;
    if (r[5] === KIND_GMAIL) counts.gmail++; else counts.tool++;
  });
  const n = Math.min(all.length, Math.max(1, Math.min(Number(limit) || 500, 2000)));
  const rows = all.slice(all.length - n).reverse().map(function (r) {
    return { t: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), email: String(r[1]), subject: String(r[2]), result: String(r[3]), memo: String(r[4]), kind: String(r[5] || KIND_TOOL) };
  });
  return { ok: true, total: all.length, rows: rows, counts: counts, logUrl: url };
}

function logUrl_(id) {
  return 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
}

function folder_() {
  const p = props_();
  const id = p.getProperty('folderId');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* 지워졌으면 새로 만든다 */ }
  }
  const f = DriveApp.createFolder(FOLDER_TITLE);
  p.setProperty('folderId', f.getId());
  return f;
}

/* ---------------------------------------------------------------- 보조 */

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(75000)) return { ok: false, status: 'fail', busy: true, error: '다른 작업이 진행 중이에요. 잠시 뒤 다시 시도해 주세요.' };
  try { return fn(); } finally { lock.releaseLock(); }
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function extractEmail_(value) {
  const m = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : '';
}

function toHtml_(text) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<div style="font-family:\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif;font-size:14px;line-height:1.7;color:#222">' +
    esc.replace(/\r?\n/g, '<br>') + '</div>';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errText_(e) {
  return String((e && e.message) || e);
}

/**
 * 편집기에서 한 번 실행(▶)해서 권한을 허용하는 용도. 서버 코드를 새 버전으로 바꿨을 때도 한 번 실행해 주세요.
 * 실행하면 기록 시트와 첨부 폴더를 미리 만들어 둔다.
 */
function setup() {
  // 권한 창에서 체크박스를 하나라도 빼면 여기서 멈추고 구글이 다시 물어본다 (지메일 읽기 권한이 없으면 기록을 못 가져옴)
  if (typeof ScriptApp.requireAllScopes === 'function') ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  upgradeLog_(logSheet_());
  folder_();
  ensureTrigger_(); // 지메일에서 직접 보낸 메일 1시간마다 기록 시트로
  const r = withLock_(function () { return syncSent_(4.5 * 60 * 1000); }); // 지금까지 보낸 메일 가져오기 (많으면 나머지는 이어서)
  Logger.log(r.ok ? '보낸편지함 가져오기: ' + r.added + '건 추가' + (r.done ? ' · 전부 가져옴' : ' · 남은 건 1시간마다 이어서 가져옴') : r.error);
  Logger.log('준비 완료 · 보내는 계정: ' + Session.getEffectiveUser().getEmail() + ' · 남은 한도(24시간): ' + MailApp.getRemainingDailyQuota() +
    (fixedLogId_() ? ' · 예전 계정의 기록 시트를 이어서 씀' : ''));
}
