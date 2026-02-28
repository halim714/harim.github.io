#!/bin/bash
# health-check.sh — Level 1 구조 검증 (토큰 비용 0, 순수 bash)
# 사용법: ./scripts/health-check.sh [스테이지명]
#
# 에이전트 실행 후 자동으로 돌아가며, 구조적 불변 조건을 검증한다.
# 의미 검증(보안, 로직)은 Antigravity가 따로 수행한다.

STAGE=${1:-"unknown"}
MIKI_DIR="/Users/halim/Desktop/meeki/meki/miki-editor"
PROJECT_DIR="/Users/halim/Desktop/meeki/meki"
FAIL=0
REPORT=""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Health Check: $STAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. vercel.json 필수 키 확인 ───
if [ -f "$MIKI_DIR/vercel.json" ]; then
  for KEY in functions rewrites headers; do
    if ! python3 -c "import json; d=json.load(open('$MIKI_DIR/vercel.json')); assert '$KEY' in d" 2>/dev/null; then
      echo "❌ vercel.json: '$KEY' 키 누락!"
      REPORT="$REPORT\n❌ vercel.json: '$KEY' 키 누락"
      FAIL=1
    else
      echo "✅ vercel.json: '$KEY' 존재"
    fi
  done
else
  echo "❌ vercel.json 파일 자체가 없음!"
  FAIL=1
fi

# ─── 2. package.json dependencies 존재 확인 ───
if [ -f "$MIKI_DIR/package.json" ]; then
  DEP_COUNT=$(python3 -c "import json; d=json.load(open('$MIKI_DIR/package.json')); print(len(d.get('dependencies',{})))" 2>/dev/null)
  if [ "$DEP_COUNT" -lt 5 ] 2>/dev/null; then
    echo "⚠️  package.json: dependencies가 $DEP_COUNT개 (비정상적으로 적음)"
    REPORT="$REPORT\n⚠️ package.json: dependencies $DEP_COUNT개"
    FAIL=1
  else
    echo "✅ package.json: dependencies $DEP_COUNT개"
  fi
fi

# ─── 3. 빌드 성공 확인 ───
echo ""
echo "🔨 빌드 검증 중..."
cd "$MIKI_DIR" || exit 1
BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT=$?
if [ $BUILD_EXIT -eq 0 ]; then
  echo "✅ 빌드 성공"
else
  echo "❌ 빌드 실패!"
  echo "$BUILD_OUTPUT" | tail -10
  REPORT="$REPORT\n❌ 빌드 실패"
  FAIL=1
fi

# ─── 3.5. Shallow Boot Test (앱 크래시 방지 최소 보증) ───
echo ""
echo "🧪 Shallow Boot Test (JSDOM) 실행 중..."
cd "$MIKI_DIR" || exit 1
BOOT_OUTPUT=$(npx jest src/__tests__/shallow-boot.test.jsx --no-cache --forceExit 2>&1)
BOOT_EXIT=$?
if [ $BOOT_EXIT -eq 0 ]; then
  echo "✅ Shallow Boot Test 통과 (앱 크래시 없음)"
else
  echo "❌ Shallow Boot Test 실패 — WSOD 위험!"
  echo "$BOOT_OUTPUT" | tail -15
  REPORT="$REPORT\n❌ Shallow Boot Test 실패"
  FAIL=1
fi

# ─── 3.6. 런타임 부팅 검증 (ws-proxy 백엔드만) ───
echo ""
echo "🚀 런타임 부팅 검증 중..."
# ws-proxy 서버 구동 테스트
if [ -f "$PROJECT_DIR/ws-proxy/src/index.js" ]; then
  cd "$PROJECT_DIR/ws-proxy" && node src/index.js > /dev/null 2>&1 &
  WS_PID=$!
  sleep 3 # 부팅 대기
  if curl -s http://localhost:8080/health | grep -q '"status":"ok"'; then
    echo "✅ ws-proxy 서버 부팅 및 /health 응답 성공"
  else
    echo "❌ ws-proxy 서버 부팅 실패 또는 /health 무응답"
    REPORT="$REPORT\n❌ ws-proxy 부팅 실패"
    FAIL=1
  fi
  kill $WS_PID 2>/dev/null
  wait $WS_PID 2>/dev/null
else
  echo "⚠️ ws-proxy 서버 없음 (Phase 2 이전이거나 누락됨)"
fi

# ─── 4. 배선 검증 (Wiring Verification — Dead Export 감지) ───
echo ""
echo "🔌 배선 검증 (Dead Export 감지) 중..."
DEAD_EXPORTS=0

# ws-proxy: server.js의 createApp이 index.js에서 사용되는지
if [ -f "$PROJECT_DIR/ws-proxy/src/server.js" ]; then
  if ! grep -q "createApp\|require.*server\|from.*server" "$PROJECT_DIR/ws-proxy/src/index.js" 2>/dev/null; then
    echo "❌ Dead Export: ws-proxy/src/server.js의 createApp()이 index.js에서 호출되지 않음"
    REPORT="$REPORT\n❌ Dead Export: server.js → index.js 배선 누락"
    DEAD_EXPORTS=$((DEAD_EXPORTS + 1))
  else
    echo "✅ server.js → index.js 배선 정상"
  fi
fi

# ws-proxy: ws-handler.js의 handleWsConnection이 index.js에서 사용되는지
if [ -f "$PROJECT_DIR/ws-proxy/src/ws-handler.js" ]; then
  if ! grep -q "handleWsConnection\|require.*ws-handler\|from.*ws-handler" "$PROJECT_DIR/ws-proxy/src/index.js" 2>/dev/null; then
    echo "❌ Dead Export: ws-proxy/src/ws-handler.js가 index.js에서 호출되지 않음"
    REPORT="$REPORT\n❌ Dead Export: ws-handler.js → index.js 배선 누락"
    DEAD_EXPORTS=$((DEAD_EXPORTS + 1))
  else
    echo "✅ ws-handler.js → index.js 배선 정상"
  fi
fi

# miki-editor: ws-client.js의 isWsProxyEnabled가 services에서 사용되는지
if [ -f "$MIKI_DIR/src/services/ws-client.js" ]; then
  WS_USAGE=$(grep -rn "isWsProxyEnabled\|getWsClient\|ws-client" "$MIKI_DIR/src/services/" "$MIKI_DIR/src/pages/" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "ws-client.js" | wc -l | tr -d ' ')
  if [ "$WS_USAGE" -eq 0 ]; then
    echo "❌ Dead Export: ws-client.js의 함수들이 다른 서비스에서 사용되지 않음"
    REPORT="$REPORT\n❌ Dead Export: ws-client.js 배선 누락"
    DEAD_EXPORTS=$((DEAD_EXPORTS + 1))
  else
    echo "✅ ws-client.js 배선 정상 (${WS_USAGE}건 참조)"
  fi
fi

if [ $DEAD_EXPORTS -gt 0 ]; then
  echo "⚠️  배선 누락 $DEAD_EXPORTS건 감지 — 순차 배선(Wiring) 태스크 필요"
  echo "[DEAD_EXPORT] $DEAD_EXPORTS건" >> "$MIKI_DIR/logs/wiring_alerts.log"
  FAIL=1
fi

# ─── 5. git diff 삭제량 검증 ───
cd "$PROJECT_DIR" || exit 1
ADD=$(git diff --numstat 2>/dev/null | awk '{s+=$1}END{print s+0}')
DEL=$(git diff --numstat 2>/dev/null | awk '{s+=$2}END{print s+0}')
echo ""
echo "📊 Git diff: +$ADD / -$DEL"
if [ "$DEL" -gt 0 ] && [ "$DEL" -gt $((ADD * 2)) ]; then
  echo "⚠️  삭제($DEL)가 추가($ADD)의 2배 초과 — 회귀 의심!"
  REPORT="$REPORT\n⚠️ 삭제량 비정상: +$ADD / -$DEL"
  FAIL=1
fi

# ─── 5. 필수 파일 존재 확인 ───
for F in "src/utils/sanitize.js" "src/components/IsolatedPreview.jsx" "src/services/github.js" "src/sync/index.js"; do
  if [ ! -f "$MIKI_DIR/$F" ]; then
    echo "❌ 필수 파일 누락: $F"
    REPORT="$REPORT\n❌ 필수 파일 누락: $F"
    FAIL=1
  fi
done

# ─── 결과 요약 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAIL -eq 0 ]; then
  echo "✅ Health Check PASSED: $STAGE"
else
  echo "❌ Health Check FAILED: $STAGE"
  echo -e "$REPORT"
  # 실패 로그 저장
  echo "[$(date)] FAILED: $STAGE $REPORT" >> "$MIKI_DIR/logs/health-check-failures.log"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit $FAIL
