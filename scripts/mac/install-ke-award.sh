#!/bin/bash
# 대표 전용 마일리지 캘린더 수집기를 이 맥에 설치 — 30분마다 대한항공 공개 보너스 좌석 현황을 읽어 오피스 저장소로 (한 번만 실행).
#   bash ~/projects/Brightbeed/scripts/mac/install-ke-award.sh
# 사무실 맥(맥미니)에 설치한다 — 대한항공은 클라우드 서버 IP 를 막는다(403).
# 수집기 본체는 ~/Library/Application Support/brightbeed/ 로 복사해서 돌린다 (데스크탑 · 문서 폴더 권한 팝업 없이).
# 처음 돌면 '승인 대기' — 오피스 관리자 전용 › 마일리지 캘린더에서 [승인] 을 누르면 다음 회차부터 읽는다.
# 제거: launchctl bootout gui/$(id -u)/com.brightbeed.ke-award && rm ~/Library/LaunchAgents/com.brightbeed.ke-award.plist
set -euo pipefail
LABEL=com.brightbeed.ke-award
SRC="$(cd "$(dirname "$0")" && pwd)/ke-award.py"
APP="$HOME/Library/Application Support/brightbeed"
SCRIPT="$APP/ke-award.py"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/brightbeed-ke-award.log"
PY=/usr/bin/python3

[ -x "$PY" ] || { echo "python3 가 없습니다 (xcode-select --install)"; exit 1; }
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' || { echo "python 3.8 이상 필요 ($("$PY" -V))"; exit 1; }

mkdir -p "$APP" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cp "$SRC" "$SCRIPT"
"$PY" -I -m py_compile "$SCRIPT"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$PY</string><string>-I</string><string>$SCRIPT</string></array>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "설치 완료: 30분마다 실행 ($PLIST)"
echo "기록 보기: tail -f \"$LOG\""
sleep 8
tail -5 "$LOG" 2>/dev/null || true
