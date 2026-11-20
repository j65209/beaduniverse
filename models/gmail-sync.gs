/**
 * 모델 지원 메일 → 오피스 「모델 지원자」 (Apps Script)
 *
 * 어디에 붙이나: brightbeed@bead-uni.com 계정 (2026-11-12 설치, 프로젝트 「오피스 모델 지원자 가져오기」).
 *   관리 콘솔 주소 매핑이 「원본 위치로 전달: 사용」이라 받은 메일이 bead-uni 와 brightbeed@gmail.com 둘 다에 남는다.
 *   script.google.com → 새 프로젝트 → 이 코드 전체 붙여넣기 → 저장.
 *
 * 처음 한 번:
 *   1) 함수 목록에서 setup 선택 → 실행 → 권한 허용 (지메일 읽기 · 외부 주소 호출)
 *      → 접속 키를 묻는 대신 아래 KEY 칸에 받은 키를 넣고 저장한 뒤 실행.
 *   2) setup 이 5분마다 sync 를 돌리는 트리거를 만들고, 최근 60일 메일을 한 번 가져온다.
 *
 * 하는 일: 받는사람이 TO_ADDR 인 새 메일(스팸함 포함)을 찾아 본문 · 보낸 사람 · 첨부(사진 · 파일)를
 *   Supabase 함수 model-apply 로 보낸다. 스팸함에 있던 메일은 받은편지함으로 옮긴다.
 *   이미 보낸 메일은 다시 안 보낸다 (스크립트 속성 d_<메일ID>).
 *
 * 키는 공개 레포에 올리지 않는다 — KEY 칸은 비워서 커밋, 붙여넣은 뒤에만 채운다.
 *
 * 2026-11-20 네이버 '대용량 첨부': 네이버 메일은 큰 파일을 첨부 대신 다운로드 링크로 보낸다(getAttachments 에 안 잡힘).
 *   링크가 평문 본문에 없고 HTML 에만 있는 메일이 있어서 링크가 있으면 html 도 같이 보낸다 — 파일 받기는 Supabase 함수가 한다.
 *   이미 가져온 메일도 메일마다 한 번(스크립트 속성 b_<메일ID>) 다시 봐서 링크가 있으면 'big' 으로 보낸다.
 *   바꿔 넣을 때: 맨 위 KEY 줄은 지금 것 그대로 두고 나머지만 바꿔 붙이기 → 저장. 트리거는 그대로라 setup 다시 안 돌려도 됨.
 */
const KEY = '';                                  // ← 오피스 담당자에게 받은 접속 키
const TO_ADDR = 'brightbeed@bead-uni.com';
const FN_URL = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/model-apply';
const MIN_IMAGE_BYTES = 15 * 1024;               // 서명 · 로고 같은 작은 그림은 건너뜀
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function setup() {
  if (!KEY) throw new Error('맨 위 KEY 칸에 접속 키를 넣고 저장한 뒤 다시 실행하세요.');
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(5).create();
  const n = run_('newer_than:60d');
  Logger.log('설정 완료 — 처음 가져온 지원 메일 ' + n + '통. 이제 5분마다 자동으로 가져옵니다.');
}

function sync() { run_('newer_than:3d'); }

/** 오래된 메일까지 다시 훑기 (필요할 때 직접 실행) */
function backfillYear() { Logger.log(run_('newer_than:365d') + '통'); }

function run_(range) {
  const props = PropertiesService.getScriptProperties();
  const q = 'to:' + TO_ADDR + ' in:anywhere -in:trash -from:me -from:' + TO_ADDR + ' -from:mailer-daemon -from:google.com -from:googlemail.com -from:noreply -from:no-reply ' + range;
  const threads = GmailApp.search(q, 0, 100);
  let sent = 0;
  const started = Date.now();
  threads.forEach(function (th) {
    if (Date.now() - started > 4.5 * 60 * 1000) return;   // 6분 제한 전에 멈춤, 다음 회차에 이어서
    let wasSpam = false;
    th.getMessages().forEach(function (m) {
      if (Date.now() - started > 4.5 * 60 * 1000) return;
      const id = m.getId();
      const done = props.getProperty('d_' + id);
      if (done && props.getProperty('b_' + id)) return;
      if (m.isInTrash()) return;
      const to = (m.getTo() + ',' + m.getCc()).toLowerCase();
      if (to.indexOf(TO_ADDR) < 0) return;                 // 같은 스레드의 내 답장 등은 빼기
      if (m.isInChats && m.isInChats()) return;
      if (done) {
        // 전에 가져온 메일 — 대용량 첨부 링크가 HTML 에만 있던 것 (메일마다 한 번, 실패하면 다음 회차에 다시)
        const html = bigHtml_(m);
        const r = html ? post_({ action: 'big', key: KEY, gmailId: id, html: html }) : { ok: true };
        if (r && (r.ok || r.error === 'no applicant')) props.setProperty('b_' + id, '1');
        return;
      }
      if (th.isInSpam()) wasSpam = true;
      if (sendOne_(m, th)) { props.setProperty('d_' + id, '1'); props.setProperty('b_' + id, '1'); sent++; }
    });
    if (wasSpam) th.moveToInbox();
  });
  return sent;
}

function sendOne_(m, th) {
  const from = m.getFrom();
  const mm = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  const fromName = mm ? mm[1].trim() : '';
  const fromEmail = mm ? mm[2].trim() : from.trim();
  const r = post_({
    action: 'apply', key: KEY,
    msg: {
      id: m.getId(), threadId: th.getId(), date: m.getDate().toISOString(),
      fromName: fromName, fromEmail: fromEmail, subject: m.getSubject(), body: m.getPlainBody(),
      html: bigHtml_(m),                                  // 네이버 대용량 첨부 링크가 있을 때만 (없으면 '')
    },
  });
  if (!r || !r.id) return false;
  const atts = m.getAttachments({ includeInlineImages: true, includeAttachments: true });
  let ok = true;
  atts.forEach(function (a) {
    const size = a.getSize();
    const mime = a.getContentType() || '';
    if (size > MAX_FILE_BYTES) return;
    if (/^image\//.test(mime) && size < MIN_IMAGE_BYTES) return;
    const res = post_({
      action: 'file', key: KEY, gmailId: m.getId(),
      name: a.getName() || 'file', mime: mime, size: size,
      b64: Utilities.base64Encode(a.getBytes()),
    });
    if (!res || !res.ok) ok = false;
  });
  return ok;
}

/** 네이버 대용량 첨부 링크가 있으면 HTML 본문(본문에 박힌 큰 그림 데이터는 뺌), 없으면 '' */
function bigHtml_(m) {
  let h = '';
  try { h = m.getBody() || ''; } catch (e) { return ''; }
  if (h.indexOf('bigfile.mail.naver.com') < 0) return '';
  return h.replace(/data:[^"')\s]{200,}/g, '').slice(0, 400000);
}

function post_(obj) {
  const res = UrlFetchApp.fetch(FN_URL, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(obj), muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code === 401) throw new Error('접속 키가 틀립니다 — KEY 칸을 확인하세요.');
  try { return JSON.parse(res.getContentText()); } catch (e) { return null; }
}
