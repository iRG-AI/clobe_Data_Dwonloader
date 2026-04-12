#!/bin/bash
# =============================================
#  clobe.ai 재무 업데이트 앱 설치 스크립트
#  실행: bash install.sh
# =============================================
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_SRC="$SCRIPT_DIR/com.irichgreen.clobe.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.irichgreen.clobe.plist"
LOG_DIR="$SCRIPT_DIR/logs"

echo ""
echo "============================================"
echo "  clobe.ai 재무 업데이트 앱 설치"
echo "============================================"
echo ""

# 1. Python 패키지 설치
echo "📦 Python 패키지 설치 중..."
pip3 install selenium webdriver-manager openpyxl --break-system-packages -q \
  || pip3 install selenium webdriver-manager openpyxl -q
echo "   ✅ Python 패키지 완료"

# 2. logs 폴더 생성
mkdir -p "$LOG_DIR"
echo "   ✅ logs 폴더 생성"

# 3. plist 경로 치환
sed "s|SCRIPT_DIR_PLACEHOLDER|$SCRIPT_DIR|g" "$PLIST_SRC" > "$PLIST_DST"
echo "   ✅ plist 설치: $PLIST_DST"

# 4. node 경로 확인 및 수정
NODE_PATH=$(which node 2>/dev/null || echo "")
if [ -z "$NODE_PATH" ]; then
  echo "   ⚠️  node 미설치. brew install node 후 재실행하세요."
else
  sed -i '' "s|/usr/local/bin/node|$NODE_PATH|g" "$PLIST_DST"
  echo "   ✅ node 경로: $NODE_PATH"
fi

# 5. 스케줄 시간 설정
echo ""
read -p "⏰ 매일 자동 실행 시간 (기본값: 06:00, HH:MM): " SCHED_TIME
SCHED_TIME="${SCHED_TIME:-06:00}"
HOUR=$(echo "$SCHED_TIME" | cut -d: -f1 | sed 's/^0//')
MIN=$(echo  "$SCHED_TIME" | cut -d: -f2 | sed 's/^0//')
HOUR="${HOUR:-6}"; MIN="${MIN:-0}"
/usr/libexec/PlistBuddy -c "Set :StartCalendarInterval:Hour $HOUR"   "$PLIST_DST"
/usr/libexec/PlistBuddy -c "Set :StartCalendarInterval:Minute $MIN"  "$PLIST_DST"
python3 -c "
import json, os
p=os.path.join('$SCRIPT_DIR','clobe-config.json')
with open(p) as f: cfg=json.load(f)
cfg['schedule']={'time':'$SCHED_TIME'}
with open(p,'w') as f: json.dump(cfg,f,ensure_ascii=False,indent=2)
print('   ✅ 스케줄 시간 저장:', '$SCHED_TIME')
"

# 6. launchd 등록
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load -w "$PLIST_DST"
echo "   ✅ launchd 등록 → 매일 ${SCHED_TIME} 자동 실행"

echo ""
echo "============================================"
echo "  ⚠️  clobe-config.json 비밀번호 입력 필요!"
echo "============================================"
echo "  $SCRIPT_DIR/clobe-config.json"
echo ""
echo "▶️  웹 UI: node $SCRIPT_DIR/clobe-server.js"
echo "         → http://localhost:3001"
echo ""
echo "▶️  즉시 테스트: launchctl start com.irichgreen.clobe"
echo "▶️  로그 확인:   tail -f $SCRIPT_DIR/logs/scheduler.log"
echo ""
