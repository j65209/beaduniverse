/**
 * 브라이트비드 오피스 · 메일 발송 서버 (Google Apps Script 웹 앱)
 *
 * 오피스앱 「📂 업무용 툴 → 📨 메일 발송」이 이 서버를 불러서 메일을 한 통씩 보낸다.
 * - 메일은 이 스크립트를 배포한 구글 계정(예: brightbeed@gmail.com) 이름으로 나간다.
 * - 개인 지메일은 하루 100명(받는 사람 기준)까지 보낼 수 있다.
 * - 제목·본문·첨부 설정은 이 계정에 저장돼서 어느 PC에서 열어도 같다.
 * - 보낸 기록은 구글 시트 「브라이트비드 메일 발송 기록」에 쌓이고, 이미 보낸 주소는 다시 보내지 않는다.
 * - 첨부파일은 구글 드라이브 「브라이트비드 메일 첨부」 폴더에 올라간다.
 *
 * 아래 MAIL_KEY 는 오피스 메일 발송 화면의 「서버 코드 복사」 버튼이 자동으로 채운다.
 * 이 키를 아는 사람만 이 서버로 메일을 보낼 수 있으니 저장소(GitHub)에 올리지 말 것.
 */
const MAIL_KEY = '__MAIL_KEY__';

const LOG_TITLE = '브라이트비드 메일 발송 기록';
const FOLDER_TITLE = '브라이트비드 메일 첨부';
const STATUS_SENT = '발송완료';
const STATUS_FAIL = '실패';

function doGet() {
  return json_({ ok: true, app: 'brightbeed-mailer', version: 1 });
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
      case 'sent': return json_({ ok: true, emails: sentEmails_() });
      case 'send': return json_(withLock_(function () { return send_(req); }));
      default: return json_({ ok: false, error: '알 수 없는 요청이에요: ' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: errText_(err) });
  }
}

/* ---------------------------------------------------------------- 요청 처리 */

function ping_() {
  const logId = props_().getProperty('logId');
  return {
    ok: true,
    sender: Session.getEffectiveUser().getEmail(),
    remaining: MailApp.getRemainingDailyQuota(),
    template: getTemplate_(),
    logUrl: logId ? 'https://docs.google.com/spreadsheets/d/' + logId + '/edit' : '',
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

  if (!test && !req.force && sentEmails_().indexOf(to.toLowerCase()) !== -1) {
    return { ok: true, status: 'skip', to: to, reason: '이미 보낸 주소', remaining: MailApp.getRemainingDailyQuota() };
  }
  if (MailApp.getRemainingDailyQuota() < 1) {
    return { ok: false, status: 'quota', error: '오늘 발송 한도를 다 썼어요. 24시간 뒤 다시 보내 주세요.', remaining: 0 };
  }

  const attachments = (req.attachmentIds || []).map(function (id) {
    try {
      return DriveApp.getFileById(id).getBlob();
    } catch (e) {
      throw new Error('첨부파일을 찾을 수 없어요. 메일 발송 화면에서 첨부파일을 다시 올려 주세요.');
    }
  });

  const msg = { to: to, subject: (test ? '[테스트] ' : '') + subject, body: body, htmlBody: toHtml_(body) };
  if (req.name) msg.name = String(req.name);
  if (attachments.length) msg.attachments = attachments;

  try {
    MailApp.sendEmail(msg);
  } catch (e) {
    const err = errText_(e);
    if (!test) log_(to, subject, STATUS_FAIL, err);
    const quota = /too many times|quota|limit/i.test(err);
    return { ok: false, status: quota ? 'quota' : 'fail', error: quota ? '오늘 발송 한도를 다 썼어요. 24시간 뒤 다시 보내 주세요.' : err, remaining: MailApp.getRemainingDailyQuota() };
  }
  if (!test) log_(to, subject, STATUS_SENT, '');
  return { ok: true, status: 'sent', to: to, remaining: MailApp.getRemainingDailyQuota() };
}

/* ---------------------------------------------------------------- 기록 시트 · 폴더 */

function logSheet_() {
  const p = props_();
  const id = p.getProperty('logId');
  if (id) {
    try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { /* 지워졌으면 새로 만든다 */ }
  }
  const ss = SpreadsheetApp.create(LOG_TITLE);
  const sh = ss.getSheets()[0];
  sh.setName('발송기록');
  sh.getRange(1, 1, 1, 5).setValues([['발송 시각', '이메일', '제목', '결과', '메모']]).setFontWeight('bold');
  sh.setFrozenRows(1);
  p.setProperty('logId', ss.getId());
  return sh;
}

function log_(to, subject, status, memo) {
  logSheet_().appendRow([new Date(), to, subject, status, memo]);
}

function sentEmails_() {
  const sh = logSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 2, last - 1, 3).getValues(); // 이메일 · 제목 · 결과
  const seen = {};
  const out = [];
  rows.forEach(function (r) {
    const e = String(r[0]).trim().toLowerCase();
    if (e && r[2] === STATUS_SENT && !seen[e]) { seen[e] = true; out.push(e); }
  });
  return out;
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
  if (!lock.tryLock(30000)) return { ok: false, status: 'fail', error: '다른 발송이 진행 중이에요. 잠시 뒤 다시 시도해 주세요.' };
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
 * 처음 한 번 편집기에서 실행해서 권한을 허용하는 용도 (배포 화면에서 허용했다면 안 해도 됨).
 * 실행하면 기록 시트와 첨부 폴더를 미리 만들어 둔다.
 */
function setup() {
  logSheet_();
  folder_();
  Logger.log('준비 완료 · 보내는 계정: ' + Session.getEffectiveUser().getEmail() + ' · 오늘 남은 한도: ' + MailApp.getRemainingDailyQuota());
}
