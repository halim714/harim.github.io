#!/bin/bash
# review-phase.sh — Phase 완료 후 Antigravity 자동 리뷰 리포트 생성
# 사용법: ./scripts/review-phase.sh <phase번호>
#
# Phase 실행 후 모든 로그를 수집하여 하나의 리뷰 리포트를 생성한다.
# Antigravity는 이 리포트 파일 1개만 읽으면 전체 상황을 파악할 수 있다.

PHASE=$1
MIKI_DIR="/Users/halim/Desktop/meeki/meki/miki-editor"
PROJECT_DIR="/Users/halim/Desktop/meeki/meki"
REPORT="$MIKI_DIR/logs/review_phase${PHASE}.md"

if [ -z "$PHASE" ]; then
  echo "Usage: $0 <phase>"
  exit 1
fi

echo "# Phase $PHASE — Antigravity Auto Review Report" > "$REPORT"
echo "" >> "$REPORT"
echo "생성 시각: $(date)" >> "$REPORT"
echo "" >> "$REPORT"

# ─── 1. 에이전트 실행 요약 ───
echo "## 1. Agent Execution Summary" >> "$REPORT"
echo "" >> "$REPORT"
echo "| Task | Model | Duration | Output | Changes |" >> "$REPORT"
echo "|---|---|---|---|---|" >> "$REPORT"

for LOG in "$MIKI_DIR"/logs/swarm_p${PHASE}-*.log; do
  [ -f "$LOG" ] || continue
  TASK=$(basename "$LOG" .log | sed "s/swarm_//" | sed "s/_[0-9]*$//")
  
  # 모델 추출
  MODEL_USED=$(grep "model:" "$LOG" | head -1 | sed 's/.*model: //')
  
  # 시작/종료 시간 추출
  START_TIME=$(grep "^Time:" "$LOG" | head -1 | sed 's/Time: //')
  END_TIME=$(grep "Agent finished" "$LOG" | head -1 | sed 's/.*finished at //')
  
  # 에이전트 출력 유무 확인
  RAW="$LOG.raw"
  if [ -f "$RAW" ] && [ -s "$RAW" ]; then
    OUTPUT_SIZE=$(wc -c < "$RAW" | tr -d ' ')
    OUTPUT_STATUS="✅ ${OUTPUT_SIZE}B"
  else
    OUTPUT_STATUS="❌ 없음"
  fi
  
  # worktree 변경 사항
  MERGE_INFO=$(grep -E "\[merge\]|\[worktree\] 변경" "$LOG" | tail -1 | sed 's/\[.*\] //')
  
  echo "| $TASK | $MODEL_USED | $START_TIME → $END_TIME | $OUTPUT_STATUS | $MERGE_INFO |" >> "$REPORT"
done

# ─── 2. Agent 출력 내용 (각 에이전트별) ───
echo "" >> "$REPORT"
echo "## 2. Agent Output Details" >> "$REPORT"

for RAW in "$MIKI_DIR"/logs/swarm_p${PHASE}-*.log.raw; do
  [ -f "$RAW" ] || continue
  TASK=$(basename "$RAW" .log.raw | sed "s/swarm_//" | sed "s/_[0-9]*$//")
  
  echo "" >> "$REPORT"
  echo "### $TASK" >> "$REPORT"
  
  if [ -s "$RAW" ]; then
    echo '```' >> "$REPORT"
    strings "$RAW" | head -50 >> "$REPORT"
    echo '```' >> "$REPORT"
  else
    echo "_출력 없음 — 에이전트가 작업을 수행하지 않았거나 출력이 캡처되지 않음_" >> "$REPORT"
  fi
done

# ─── 3. Git Diff Summary ───
echo "" >> "$REPORT"
echo "## 3. Git Changes" >> "$REPORT"
echo "" >> "$REPORT"
cd "$PROJECT_DIR" || exit 1
echo '```' >> "$REPORT"
git diff --stat HEAD >> "$REPORT" 2>&1
echo "" >> "$REPORT"
echo "Untracked files:" >> "$REPORT"
git ls-files --others --exclude-standard >> "$REPORT" 2>&1
echo '```' >> "$REPORT"

# ─── 4. Health Check 이력 ───
echo "" >> "$REPORT"
echo "## 4. Health Check Results" >> "$REPORT"
echo "" >> "$REPORT"
if [ -f "$MIKI_DIR/logs/health-check-failures.log" ]; then
  FAILURES=$(grep "p${PHASE}" "$MIKI_DIR/logs/health-check-failures.log" 2>/dev/null)
  if [ -n "$FAILURES" ]; then
    echo "❌ 실패 기록:" >> "$REPORT"
    echo '```' >> "$REPORT"
    echo "$FAILURES" >> "$REPORT"
    echo '```' >> "$REPORT"
  else
    echo "✅ Phase $PHASE 관련 health-check 실패 없음" >> "$REPORT"
  fi
else
  echo "✅ health-check 실패 기록 없음 (전체)" >> "$REPORT"
fi

# ─── 5. Regression Alerts ───
echo "" >> "$REPORT"
echo "## 5. Regression Alerts" >> "$REPORT"
echo "" >> "$REPORT"
if [ -f "$MIKI_DIR/logs/regression_alerts.log" ]; then
  ALERTS=$(grep "p${PHASE}" "$MIKI_DIR/logs/regression_alerts.log" 2>/dev/null)
  if [ -n "$ALERTS" ]; then
    echo "⚠️ 회귀 의심 기록:" >> "$REPORT"
    echo '```' >> "$REPORT"
    echo "$ALERTS" >> "$REPORT"
    echo '```' >> "$REPORT"
  else
    echo "✅ Phase $PHASE 관련 회귀 의심 없음" >> "$REPORT"
  fi
else
  echo "✅ 회귀 의심 기록 없음 (전체)" >> "$REPORT"
fi

# ─── 6. Antigravity 판단 요청 ───
echo "" >> "$REPORT"
echo "## 6. Antigravity Action Required" >> "$REPORT"
echo "" >> "$REPORT"

# 자동 진단: 출력이 있는 에이전트 수 확인
TOTAL=0
HAS_OUTPUT=0
HAS_CHANGES=0
for RAW in "$MIKI_DIR"/logs/swarm_p${PHASE}-*.log.raw; do
  [ -f "$RAW" ] || continue
  TOTAL=$((TOTAL + 1))
  [ -s "$RAW" ] && HAS_OUTPUT=$((HAS_OUTPUT + 1))
done
for LOG in "$MIKI_DIR"/logs/swarm_p${PHASE}-*.log; do
  [ -f "$LOG" ] || continue
  grep -q "\[merge\] ✅" "$LOG" && HAS_CHANGES=$((HAS_CHANGES + 1))
done

echo "- 전체 에이전트: $TOTAL" >> "$REPORT"
echo "- 출력 생성: $HAS_OUTPUT" >> "$REPORT"
echo "- 코드 변경(merge): $HAS_CHANGES" >> "$REPORT"
echo "" >> "$REPORT"

if [ "$HAS_OUTPUT" -eq 0 ]; then
  echo "🔴 **CRITICAL**: 모든 에이전트 출력 없음 → script 캡처 실패 또는 에이전트 미작동" >> "$REPORT"
  echo "→ 권장 조치: run-swarm.sh script 래핑 확인 후 재실행" >> "$REPORT"
elif [ "$HAS_OUTPUT" -lt "$TOTAL" ]; then
  echo "🟡 **WARNING**: 일부 에이전트 출력 없음 ($HAS_OUTPUT/$TOTAL)" >> "$REPORT"
  echo "→ 권장 조치: 실패한 에이전트 로그 확인 후 선택적 재실행" >> "$REPORT"
elif [ "$HAS_CHANGES" -eq 0 ]; then
  echo "🟡 **WARNING**: 출력은 있으나 코드 변경 없음" >> "$REPORT"
  echo "→ 가능한 원인: PLAN.md 프롬프트 모호, 에이전트가 작업 불필요 판단" >> "$REPORT"
  echo "→ 권장 조치: 에이전트 출력 내용 확인 후 PLAN.md/프롬프트 수정" >> "$REPORT"
else
  echo "🟢 **OK**: 에이전트 출력 + 코드 변경 정상" >> "$REPORT"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Review report: $REPORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
