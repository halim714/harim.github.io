#!/bin/bash
# orchestrate.sh — Claude Code 실행 릴레이
# 역할: task.md 생성 → claude /plan-phase → claude /execute-plan
# Gemini 검토/검증은 Antigravity가 직접 JSON을 읽고 처리한다 (gemini CLI 호출 없음)
#
# 사용법: ./orchestrate.sh "목표 설명"
# 예시:   ./orchestrate.sh "Phase 6: Stateless Session Architecture 구현"

set -euo pipefail

GOAL="${1:-}"
[ -z "$GOAL" ] && echo "사용법: $0 '목표 설명'" && exit 1

HANDOFF="/Users/halim/Desktop/meeki/meki/.meki-agents/handoff"
MAX_WAIT=600  # 10분 타임아웃

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

# ── Step 1: task.md 생성 + status 초기화 ──────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo "  Meki 자율 오케스트레이터 시작"
echo "  목표: $GOAL"
echo "════════════════════════════════════════════"
echo ""

cat > "$HANDOFF/task.md" << EOF
# Task (orchestrate.sh 자동 생성)

## What: $GOAL

## Why: Meki 개발 자동화 — 유저 릴레이 없는 완전 자율 실행

## Constraints:
- 기존 코드 삭제 금지
- 스코프 외 파일 수정 금지
- npm run dev 실행 금지 (프로세스 종료 불가)
- 수정 후 npm run build로 검증 필수

## Approval Criteria:
- [ ] CRITICAL 항목 없음
- [ ] Meki 핵심 가치 준수 (데이터 주권, 원본 불변)
- [ ] npm run build 성공
EOF

python3 - << PYEOF
import json, datetime
s = {
  "status": "TASK_READY",
  "phase": """$GOAL""",
  "iteration": 0,
  "max_iterations": 3,
  "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "updated_by": "orchestrate.sh"
}
json.dump(s, open("$HANDOFF/status.json", "w"), indent=2, ensure_ascii=False)
print("status.json: TASK_READY")
PYEOF

echo "✅ task.md + status.json 초기화 완료"
echo ""

# ── Step 2: Claude Code 계획 생성 (헤드리스) ──────────────────────
echo "▶ [Claude Code] /plan-phase 실행 중 (헤드리스)..."
echo "   → task.md 분석 → 코드 grep → plan.md 생성 → /review-plan 자기검증"
echo ""

claude -p "/plan-phase" \
  --allowedTools "Read,Write,Edit,Bash,Grep,Glob" \
  --output-format text

echo ""

# ── Step 3: PENDING_APPROVAL 대기 ─────────────────────────────────
poll_status "PENDING_APPROVAL"

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Claude Code 계획 완료 — PENDING_APPROVAL"
echo ""
echo "  👉 다음 단계: Antigravity가 아래 파일을 검토 후"
echo "     approval.json 작성 + status.json → APPROVED 설정"
echo ""
echo "  검토 파일:"
echo "    $HANDOFF/plan.review.json"
echo ""
echo "  승인 후 실행:"
echo "    ./orchestrate-execute.sh"
echo "════════════════════════════════════════════"
echo ""

# Antigravity(Gemini)가 이어받아 검토한다.
# gemini -p 호출 제거 — CLI가 없거나 interactive 모드로 hang되는 문제 방지.
exit 0
