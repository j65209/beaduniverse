/**
 * 메일로 신청한 기획전(29CM · W컨셉) → 오피스 MD팀 기획전 캘린더 (Apps Script)
 *
 * 설치: shinebead0@gmail.com 계정의 Apps Script 프로젝트 「오피스 기획전 메일 가져오기」 (2026-11-12).
 *   KEY 칸은 공개 레포라 비워서 커밋 — 붙여넣을 때만 채운다 (Supabase private_kv 'md_mail_key').
 *   처음 한 번 setup 실행 → 30분마다 sync + 최근 180일 보낸 메일 한 번 훑기.
 *
 * 하는 일: 보낸편지함에서 29CM · W컨셉 주소로 보낸(받는 사람 · 참조) 메일을 찾아
 *   제목 · 본문 · 첨부 엑셀의 글자(xlsx 안 sharedStrings)를 Supabase 함수 md-mail-events 로 보낸다.
 *   기획전 이름 · 기간 · 브랜드를 뽑는 규칙은 함수 쪽에 있다 (고치면 함수에서 reparse).
 *   한 번 보낸 메일은 다시 안 보낸다 (스크립트 속성 m_<메일ID>).
 */
const KEY = '';
const FN_URL = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/md-mail-events';
const QUERY = 'in:sent {to:wconcept.co.kr cc:wconcept.co.kr to:29cm.co.kr cc:29cm.co.kr}';

function setup() {
  if (!KEY) throw new Error('맨 위 KEY 칸에 접속 키를 넣고 저장한 뒤 다시 실행하세요.');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sync') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(30).create();
  Logger.log('설정 완료 — 처음 보낸 메일 ' + run_('newer_than:180d') + '통. 이제 30분마다 자동으로 가져옵니다.');
}
function sync() { run_('newer_than:7d'); }

function run_(range) {
  const me = Session.getActiveUser().getEmail().toLowerCase();
  const props = PropertiesService.getScriptProperties();
  const started = Date.now();
  let sent = 0;
  GmailApp.search(QUERY + ' ' + range, 0, 200).forEach(function (th) {
    th.getMessages().forEach(function (m) {
      if (Date.now() - started > 5 * 60 * 1000) return;
      if (props.getProperty('m_' + m.getId())) return;
      if (m.getFrom().toLowerCase().indexOf(me) < 0) return;          // 내가 보낸 것만
      const to = (m.getTo() + ',' + m.getCc()).toLowerCase();
      if (!/wconcept\.co\.kr|29cm\.co\.kr/.test(to)) return;
      const atts = m.getAttachments().map(function (a) {
        const name = a.getName() || '';
        return { name: name, text: /\.xlsx$/i.test(name) ? xlsxText_(a) : '' };
      });
      const res = UrlFetchApp.fetch(FN_URL, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ action: 'mail', key: KEY, msg: {
          id: m.getId(), sentAt: m.getDate().toISOString(), subject: m.getSubject(), to: to, body: m.getPlainBody(), attachments: atts,
        } }),
      });
      if (res.getResponseCode() === 401) throw new Error('접속 키가 틀립니다 — KEY 칸을 확인하세요.');
      if (res.getResponseCode() === 200) { props.setProperty('m_' + m.getId(), '1'); sent++; }
    });
  });
  return sent;
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
