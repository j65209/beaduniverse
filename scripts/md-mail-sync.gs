/**
 * 29CM · W컨셉 기획전 메일 → 오피스 MD팀 기획전 캘린더 (Apps Script)
 *
 * 설치: shinebead0@gmail.com 계정의 Apps Script 프로젝트 「오피스 기획전 메일 가져오기」 (2026-11-12).
 *   접속 키는 코드에 두지 않는다 — 프로젝트 설정 → 스크립트 속성 MD_MAIL_KEY (Supabase private_kv 'md_mail_key' 와 같은 값).
 *   새 버전을 붙여넣으면 setup 을 한 번 더 실행 → 최근 1년 메일을 훑고(5분씩 나눠서, 끝날 때까지 30분마다 이어서) 30분마다 sync.
 *
 * 하는 일: 29CM · W컨셉과 주고받은 메일을 찾아 제목 · 본문 · 첨부(엑셀은 안의 글자)를 Supabase 함수 md-mail-events 로 보낸다.
 *   - 내가 보낸 메일(dir 'sent')     → 기획전 신청 → 캘린더 상태 '신청함'
 *   - 받은 메일(dir 'received')      → 기획전 제안 → '제안받음' (나중에 신청 메일을 보내면 '신청함')
 *   기획전 이름 · 기간 · 브랜드를 뽑는 규칙은 함수 쪽에 있다 (고치면 함수에서 reparse).
 *   한 번 보낸 메일은 다시 안 보낸다 (스크립트 속성 m_<메일ID>). 뉴스레터 · 자동 발신 주소는 건너뛴다.
 */
const FN_URL = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/md-mail-events';
const DOMAINS = /wconcept\.co\.kr|29cm\.co\.kr/;
const QUERY = '{to:wconcept.co.kr cc:wconcept.co.kr from:wconcept.co.kr to:29cm.co.kr cc:29cm.co.kr from:29cm.co.kr}';
const SKIP_FROM = /unsubscribe|no-?reply|newsletter|mailer|notice@|news@/i;

function key_() { return PropertiesService.getScriptProperties().getProperty('MD_MAIL_KEY') || ''; }

function setup() {
  if (!key_()) throw new Error('접속 키가 없습니다 — 프로젝트 설정 → 스크립트 속성에 MD_MAIL_KEY 를 넣고 다시 실행하세요.');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sync') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(30).create();
  PropertiesService.getScriptProperties().setProperty('backfill', '1');
  const r = run_('newer_than:365d');
  if (r.done) PropertiesService.getScriptProperties().deleteProperty('backfill');
  Logger.log('설정 완료 — 이번에 ' + r.sent + '통 보냄' + (r.done ? ' (1년치 끝).' : ' — 나머지는 30분마다 이어서 가져옵니다.'));
}
function sync() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('backfill')) {
    const r = run_('newer_than:365d');
    if (r.done) props.deleteProperty('backfill');
    return;
  }
  run_('newer_than:7d');
}

function run_(range) {
  const KEY = key_();
  const me = Session.getActiveUser().getEmail().toLowerCase();
  const props = PropertiesService.getScriptProperties();
  const started = Date.now();
  let sent = 0, timedOut = false;
  for (let start = 0; !timedOut; start += 100) {
    const threads = GmailApp.search(QUERY + ' ' + range, start, 100);
    if (!threads.length) break;
    threads.forEach(function (th) {
      th.getMessages().forEach(function (m) {
        if (timedOut || Date.now() - started > 5 * 60 * 1000) { timedOut = true; return; }
        if (props.getProperty('m_' + m.getId())) return;
        const from = m.getFrom().toLowerCase();
        const to = (m.getTo() + ',' + m.getCc()).toLowerCase();
        let dir;
        if (from.indexOf(me) >= 0) { if (!DOMAINS.test(to)) return; dir = 'sent'; }
        else if (DOMAINS.test(from) && !SKIP_FROM.test(from)) dir = 'received';
        else { props.setProperty('m_' + m.getId(), '1'); return; }
        // 받은 제안 메일의 엑셀은 양식(예시 날짜)이라 이름만 보낸다
        const atts = m.getAttachments().map(function (a) {
          const name = a.getName() || '';
          return { name: name, text: dir === 'sent' && /\.xlsx$/i.test(name) ? xlsxText_(a) : '' };
        });
        const res = UrlFetchApp.fetch(FN_URL, {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({ action: 'mail', key: KEY, msg: {
            id: m.getId(), dir: dir, sentAt: m.getDate().toISOString(), subject: m.getSubject(), from: from, to: to, body: m.getPlainBody(), attachments: atts,
          } }),
        });
        if (res.getResponseCode() === 401) throw new Error('접속 키가 틀립니다 — 스크립트 속성 MD_MAIL_KEY 를 확인하세요.');
        if (res.getResponseCode() === 200) { props.setProperty('m_' + m.getId(), '1'); sent++; }
      });
    });
    if (threads.length < 100) break;
  }
  return { sent: sent, done: !timedOut };
}

/** xlsx(zip) 안의 글자 칸 모음 — '종료기간: 11. 09 ~11. 19' 같은 기간을 함수가 찾는다 */
function xlsxText_(att) {
  try {
    const blob = att.copyBlob().setContentType('application/zip');
    const files = Utilities.unzip(blob);
    let out = '';
    files.forEach(function (f) {
      if (/sharedStrings\.xml$/.test(f.getName())) {
        out += f.getDataAsString('UTF-8').replace(/<\/si>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      }
    });
    return out.slice(0, 20000);
  } catch (e) {
    return '';
  }
}
