# naver-cafe — 네이버 카페 자동 글쓰기 (2026-11-20~)

하루 1번, KST 07:00~10:00 사이 아무 시각(분·초까지 매일 다름)에 카페 게시판에 글 1개를 올린다.
공식 카페 글쓰기 API(네이버 로그인 토큰) 사용. 맥미니·PC 필요 없음.

## 구성 (슈퍼베이스 브라이트비드오피스 ckyjkxbqsyjoqpuqwoce)
- 표 `naver_cafe_config`(1줄): enabled · club_id · menu_id · window_start/end · next_run_at · 토큰 · cron_key
- 표 `naver_cafe_posts`: 올릴 글 (subject, content_html, images[], repeat, sort_order, status ready/posted/paused/failed)
  - ready 중 sort_order·id 가 가장 작은 글을 올림. repeat=true 면 올린 뒤 맨 뒤로 돌림
  - images: `naver-cafe` 비공개 버킷 경로 또는 https 주소
- 표 `naver_cafe_log`: 결과 기록
- 세 표 모두 RLS 켜짐·정책 없음·anon/authenticated 권한 회수 (서비스 키로만)
- 예약 `naver-cafe-1m`(pg_cron 1분): enabled 이고 next_run_at 이 지났을 때만 `/run` 호출
- 비밀값: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` (Edge Function Secrets)
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
