#!/bin/bash
# orchestrate-execute.sh — Antigravity 승인 후 Claude Code 실행 릴레이
# 전제: approval.json == APPROVED, status.json == APPROVED
# 역할: claude /execute-plan → EXECUTION_DONE 대기 → exit 0 (검증은 Antigravity)
#
# 사용법: ./orchestrate-execute.sh

set -euo pipefail

HANDOFF="/Users/halim/Desktop/meeki/meki/.meki-agents/handoff"
MAX_WAIT=600

poll_status() {
  local TARGET="$1"
  local ELAPSED=0
  echo "⏳ status.json == '$TARGET' 대기 중..."
  while true; do
    local S
    S=$(python3 -c "import json; print(json.load(open('$HANDOFF/status.json'))['status'])")
    [ "$S" = "$TARGET" ] && return 0
    [ "$S" = "BLOCKED" ] && echo "❌ BLOCKED — 유저 개입 필요" && exit 1
    [ $ELAPSED -ge $MAX_WAIT ] && echo "❌ TIMEOUT (${MAX_WAIT}초)" && exit 1
    sleep 10
    ELAPSED=$((ELAPSED + 10))
  done
}

# 전제 조건 확인
APPROVAL=$(python3 -c "import json; print(json.load(open('$HANDOFF/approval.json'))['status'])" 2>/dev/null || echo "MISSING")
STATUS=$(python3 -c "import json; print(json.load(open('$HANDOFF/status.json'))['status'])" 2>/dev/null || echo "MISSING")

if [ "$APPROVAL" != "APPROVED" ]; then
  echo "❌ approval.json 상태가 APPROVED가 아님: $APPROVAL"
  echo "   Antigravity가 먼저 plan.review.json을 검토하고 approval.json을 작성해야 합니다."
  exit 1
fi

if [ "$STATUS" != "APPROVED" ]; then
  echo "❌ status.json 상태가 APPROVED가 아님: $STATUS"
  echo "   status.json의 status를 APPROVED로 설정하세요."
  exit 1
fi

PHASE=$(python3 -c "import json; print(json.load(open('$HANDOFF/status.json'))['phase'])")
echo ""
echo "════════════════════════════════════════════"
echo "  Meki 실행 단계 시작"
echo "  목표: $PHASE"
echo "════════════════════════════════════════════"
echo ""

# ── Step 4: Claude Code 실행 (헤드리스) ───────────────────────────
echo "▶ [Claude Code] /execute-plan 실행 중 (헤드리스)..."
echo ""

claude -p "/execute-plan" \
  --allowedTools "Read,Write,Edit,Bash,Grep,Glob" \
  --output-format text

echo ""

# ── Step 5: EXECUTION_DONE 대기 ───────────────────────────────────
poll_status "EXECUTION_DONE"

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Claude Code 실행 완료 — EXECUTION_DONE"
echo ""
echo "  👉 다음 단계: Antigravity가 아래 파일을 검토 후"
echo "     verification.json 작성 + status.json → DONE 설정"
echo ""
echo "  검토 파일:"
echo "    $HANDOFF/execution-result.md"
echo "════════════════════════════════════════════"
echo ""

# Antigravity(Gemini)가 이어받아 최종 검증한다.
# gemini -p 호출 제거 — CLI hang 방지.
exit 0
