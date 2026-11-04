# 발주 상품 리스트 이름 정리 — 인수인계

대상: 물류팀 → 발주 관리 → 발주 상품 리스트 (data/orders.json 1,190종, 이름은 data/product-name-overrides.json)
목표: (1) 중국어로 보이는 이름을 사진 보고 한국어 제품명으로, (2) 6A·야르 공홈 제품이면 공홈 이름(이름만, 예: Coffs)으로.

## 지금까지 반영된 것 (main에 이미 push됨)
- 6A·야르 공홈 사진 대조 매칭 64개: 확실 42개 → overrides, 애매 22개 → auto_overrides(앱에서 🤖 승인/취소)
- 중국어 이름 730개 → 한국어 "텍스트 번역"으로 overrides 반영 (커밋 764aae7)
  - 문제: 사진을 안 보고 옵션명만 번역해서 400개가 "실버", "블랙", "오픈 조절형"처럼 품목이 안 드러남 → 아래 1번으로 교체해야 함
- 사장님이 앱에서 직접 고친 22개, 숨김 3개는 손대지 않음

## 남은 일
1. 사진 보고 한국어 제품명 다시 붙이기 (723개, 사진 있는 번역 항목 전부)
   - 완료: data/names_B.json (144개). 나머지(ns_00~06, 13~30 시트 분량)는 아직.
   - 형식: [색상/소재] + [특징] + [품목], 예) "실버 큐빅 별 오픈 반지", "블랙 가죽 크로스백", "화이트 무광 택배 봉투"
     - 옵션 텍스트의 색상으로 변형을 고름 (银色=실버, 黑色=블랙, 白K=화이트골드, 泰银=앤틱 실버, 钢色=스틸 …)
     - 품번(JZ0951 등)은 빼기(앱이 원문을 이름 아래에 같이 보여줌), 사이즈는 의미 있을 때만 괄호로 (7호, 45cm)
   - 반영: `python3 -I scripts/names_apply.py <WORK> data/product-name-overrides.json`
     (앱에서 누가 이미 고친 이름은 덮어쓰지 않음)
2. 종류별 전수 대조 (공홈 이름 붙이기)
   - 아직 발주 리스트와 연결 안 된 판매중 공홈 제품 169개: 반지 127, 목걸이 33, 팔찌·뱅글·키링 9 → catalog/cat_*.jpg, catalog/catalog.json
   - 같은 종류의 발주 사진 전부와 비교 (상위 후보만 보면 놓침: 이미 이름 붙은 67쌍으로 재보니 자동 유사도 상위 8개 안에 정답이 1/3만 있었음)
   - 예: 발주 "TJ-2180《上帝之眼》戒指" = 6A mesquite 반지 (아직 미반영)
   - 종류: 번역 항목은 1번 이름의 품목, 나머지 267개는 data/types_clip.json
   - 확실 → overrides에 이름만 (예: mesquite), 애매 → auto_overrides {"name","src","ref"}
3. 참고: 6A Starly 와 야르 Inthestar는 같은 디자인 (6A 발주라 Starly로 🤖 제안해둠)

## 작업 환경 재구성
```bash
W=~/po-names-work; mkdir -p $W/data && cp handoff/po-names/data/* $W/data/
# 이미지 다시 받기 + official.json/po.json 로컬 경로로 재생성
python3 -I handoff/po-names/scripts/download_images.py $W data/orders.json data/product-name-overrides.json
# (선택) 이름 붙이기 시트
python3 -I handoff/po-names/scripts/make_name_sheets.py $W 24   # → $W/namesheets/ns_XX.jpg/json
```
- 공홈 상품 목록 원본: data/official_*.tsv (6A 144 + 야르 160, 판매중·노출중, 이미지 코드 c:/m:/y:/m274464:/m277817: → download_images.py의 PREFIX 참고)
- 유사도: data/fused.npy (CLIP+DINOv2 z점수 평균, 행=data/fused_index.json po_ids, 열=off_ids), data/emb_dino.npz
- 이름 규칙(공홈 → 이름만): scripts/corename.py

## 반영 방법
main 최신을 받은 뒤 data/product-name-overrides.json 수정 → commit → push. 앱이 GitHub API로 이 파일을 다시 읽음.
