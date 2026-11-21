# naver-cafe — 네이버 카페 자동 글쓰기 (2026-11-20~)

하루 1번, KST 07:00~10:00 사이 아무 시각(분·초까지 매일 다름)에 카페 게시판에 글 1개를 올린다.
공식 카페 글쓰기 API(네이버 로그인 토큰) 사용. 맥미니·PC 필요 없음.

## 구성 (슈퍼베이스 비드유니버스 ckyjkxbqsyjoqpuqwoce)
- 표 `naver_cafe_config`(1줄): enabled · club_id · menu_id · window_start/end · next_run_at · 토큰 · cron_key
- 표 `naver_cafe_posts`: 올릴 글 (subject, content_html, images[], repeat, sort_order, status ready/posted/paused/failed)
  - ready 중 sort_order·id 가 가장 작은 글을 올림. repeat=true 면 올린 뒤 맨 뒤로 돌림
  - images: `naver-cafe` 비공개 버킷 경로 또는 https 주소
- 표 `naver_cafe_log`: 결과 기록
- 세 표 모두 RLS 켜짐·정책 없음·anon/authenticated 권한 회수 (서비스 키로만)
- 예약 `naver-cafe-1m`(pg_cron 1분): enabled 이고 next_run_at 이 지났을 때만 `/run` 호출
- 네이버 앱 '모델 구인' Client ID/Secret: Edge Function 비밀값 `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`, 없으면 `naver_cafe_config.client_id`·`client_secret` (2026-11-20 은 표에 넣음)
- 네이버 앱 Callback URL: `https://ckyjkxbqsyjoqpuqwoce.supabase.co/functions/v1/naver-cafe`

## 자주 쓰는 SQL
```sql
-- 로그인 연결 주소 만들기(30분) → https://…/functions/v1/naver-cafe/connect?k=<값>
update naver_cafe_config set login_state = encode(extensions.gen_random_bytes(16),'hex'),
  login_state_expires = now() + interval '30 minutes' where id = 1 returning login_state;
-- 켜기/끄기
update naver_cafe_config set enabled = true, next_run_at = naver_cafe_random_time((now() at time zone 'Asia/Seoul')::date + 1) where id = 1;
update naver_cafe_config set enabled = false where id = 1;
-- 상태
select enabled, club_id, menu_id, next_run_at at time zone 'Asia/Seoul' as next_kst, account_label, last_result from naver_cafe_config;
select * from naver_cafe_log order by id desc limit 10;
```

## 멈추는 경우
활동 정지(AP007/AP008/CA002) · 스팸 자동차단(AP005) · 등급/권한 없음(AP002~AP004) 이면 enabled=false 로 스스로 멈춘다.
서버 오류(5xx)는 20~40분 뒤 최대 3번 다시, 그 밖의 실패는 다음 날로 넘긴다.

## 지금 올리는 것 (2026-11-20~)
- 카페 **모델나라** `cafe.naver.com/wkqdbsxo14` (clubid 14001943) · 게시판 **기타 구인(서울/경기)** (menuid 518)
- 글 1개(posts id 1, repeat=true)를 매일 같은 내용으로: 제목 "가방,주얼리 브랜드 컨텐츠 피팅 여성 모델 모집" + 사진 6장(`model-recruit/1~6.jpg`)
- 원본 글: https://cafe.naver.com/wkqdbsxo14/2402891 · 첫 자동 글: https://cafe.naver.com/wkqdbsxo14/2406481 (11/20 16:25)
- 연결 계정 = 앱 '모델 구인'을 만든 네이버 계정(개발 중 상태 그대로 씀, 검수 안 받음)

## 겪은 함정
- **401 024 Scope Status Invalid**: 카페 글쓰기 권한은 동의 화면의 '선택' 항목이라 체크 안 하면 로그인만 되고 글쓰기는 거절.
  reprompt 로 다시 동의해도 같은 토큰 문자열이 돌아와 그대로 실패 → `grant_type=delete` 로 토큰 폐기 후 새로 동의(카페 항목 체크)해서 해결.
- **403 999**: 본문 HTML 속성값의 큰따옴표(`color="#ff0000"`) 때문. 작은따옴표로 바꾸니 바로 올라감 → 함수가 보낼 때 자동으로 바꿈.
- **말머리**: 공식 API 에 말머리 항목이 없어 말머리 없이 올라감(이 게시판은 그래도 받아줌).
- 네이버 카페 화면은 크롬 확장·내장 브라우저 모두 안전 정책으로 막힘, 글 내용 자동 읽기(공유 링크 API)도 자동 모드 검사가 막음 → 글·사진은 사용자에게 받음.

## 알림 (2026-11-20~)
- 올림·실패·멈춤·건너뜀을 **꿀꿀집 텔레그램 '꿀꿀집 카드뉴스' 방**으로 보냄 (봇·방은 `sns_settings` 의 `tg_bot_token`·`tg_chat_id` 를 같이 씀, 봇이 보낸 글은 sns-tg 웹훅에 안 들어감)
- 직접 보내기: `POST /naver-cafe/notify {"text":"…"}` (x-cafe-cron)
- 사진 위치: posts.options.image_markers='end' → 본문 끝에 `<img src='#0' />`… (공식 문서엔 없음). 말머리: options.headid (번호 아직 모름, 첫 글은 사용자가 직접 '여구인' 으로 고침)
