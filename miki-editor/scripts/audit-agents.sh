#!/bin/bash
# audit-agents.sh — 에이전트 인프라 디렉토리 비판적 감사 (토큰 비용 0)
# 사용법: ./scripts/audit-agents.sh
#
# Antigravity가 Phase 실행 전에 자동으로 실행한다.
# 죽은 파일, 중복, 연결 끊김을 자동 탐지한다.

PROJECT_DIR="/Users/halim/Desktop/meeki/meki"
MIKI_DIR="$PROJECT_DIR/miki-editor"
REPORT="$MIKI_DIR/logs/audit_agents.md"
FAIL=0

mkdir -p "$MIKI_DIR/logs"

echo "# 🔍 Agent Infrastructure Audit" > "$REPORT"
echo "" >> "$REPORT"
echo "생성 시각: $(date)" >> "$REPORT"

# ─── 1. 죽은 Role 탐지 ───
echo "" >> "$REPORT"
echo "## 1. Role 사용 현황" >> "$REPORT"
echo "" >> "$REPORT"
echo "| Role | run-phase.sh 참조 | SOP 파일 |" >> "$REPORT"
echo "|---|---|---|" >> "$REPORT"

for ROLE_FILE in "$PROJECT_DIR"/.agents/roles/*.md; do
  ROLE=$(basename "$ROLE_FILE" .md)
  # run-phase.sh에서 이 role이 사용되는지 확인
  USED=$(grep -c "$ROLE" "$MIKI_DIR/scripts/run-phase.sh" 2>/dev/null | tr -d '[:space:]')
  USED=${USED:-0}
  SIZE=$(wc -l < "$ROLE_FILE" | tr -d ' ')
  if [ "$USED" -eq 0 ]; then
    echo "| $ROLE | ❌ 미사용 | ${SIZE}줄 |" >> "$REPORT"
  else
    echo "| $ROLE | ✅ ${USED}회 | ${SIZE}줄 |" >> "$REPORT"
  fi
done

# ─── 2. 워크플로우 중복 탐지 ───
echo "" >> "$REPORT"
echo "## 2. Workflow 상태" >> "$REPORT"
echo "" >> "$REPORT"
echo "| Workflow | 줄 수 | orchestrate-phase에서 참조 |" >> "$REPORT"
echo "|---|---|---|" >> "$REPORT"

for WF in "$PROJECT_DIR"/.agents/workflows/*.md; do
  NAME=$(basename "$WF" .md)
  SIZE=$(wc -l < "$WF" | tr -d ' ')
  REFERENCED=$(grep -c "$NAME" "$PROJECT_DIR/.agents/workflows/orchestrate-phase.md" 2>/dev/null | tr -d '[:space:]')
  REFERENCED=${REFERENCED:-0}
  if [ "$REFERENCED" -gt 0 ]; then
    echo "| $NAME | ${SIZE}줄 | ✅ 참조됨 |" >> "$REPORT"
  else
    echo "| $NAME | ${SIZE}줄 | ⚠️ 미참조 |" >> "$REPORT"
  fi
done

# ─── 3. Slash Commands 동작 가능 여부 ───
echo "" >> "$REPORT"
echo "## 3. Slash Commands (claude -p 호환성)" >> "$REPORT"
echo "" >> "$REPORT"
CMD_COUNT=$(ls "$PROJECT_DIR"/.claude/commands/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "- 총 커맨드: ${CMD_COUNT}개" >> "$REPORT"
echo "- ⚠️ \`claude -p\` (비대화식 모드)에서는 slash commands가 작동하지 않음" >> "$REPORT"
echo "- → bash 스크립트로 전환하거나, 대화식 세션에서만 사용 가능" >> "$REPORT"

# ─── 4. Skills 사용 현황 ───
echo "" >> "$REPORT"
echo "## 4. Skills 참조 현황" >> "$REPORT"
echo "" >> "$REPORT"
echo "| Skill | CLAUDE.md/SOP 참조 | 줄 수 |" >> "$REPORT"
echo "|---|---|---|" >> "$REPORT"

for SKILL_DIR in "$PROJECT_DIR"/.agents/skills/*/; do
  SKILL=$(basename "$SKILL_DIR")
  SIZE=$(wc -l < "$SKILL_DIR/SKILL.md" 2>/dev/null | tr -d ' ')
  # CLAUDE.md + roles/에서 참조되는지 확인
  REFS=$(grep -rl "$SKILL" "$PROJECT_DIR/CLAUDE.md" "$PROJECT_DIR/.agents/roles/" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$REFS" -gt 0 ]; then
    echo "| $SKILL | ✅ ${REFS}곳 | ${SIZE}줄 |" >> "$REPORT"
  else
    echo "| $SKILL | ❌ 미참조 | ${SIZE}줄 |" >> "$REPORT"
  fi
done

# ─── 5. 스크립트 문법 검증 ───
echo "" >> "$REPORT"
echo "## 5. Script Syntax Check" >> "$REPORT"
echo "" >> "$REPORT"

SCRIPT_FAIL=0
for SCRIPT in "$MIKI_DIR"/scripts/*.sh; do
  NAME=$(basename "$SCRIPT")
  if bash -n "$SCRIPT" 2>/dev/null; then
    echo "- ✅ $NAME" >> "$REPORT"
  else
    echo "- ❌ $NAME — 문법 오류!" >> "$REPORT"
    SCRIPT_FAIL=1
  fi
done
[ "$SCRIPT_FAIL" -eq 1 ] && FAIL=1

# ─── 6. CLAUDE.md 크기 검증 ───
echo "" >> "$REPORT"
echo "## 6. Context Size" >> "$REPORT"
echo "" >> "$REPORT"
CLAUDE_LINES=$(wc -l < "$PROJECT_DIR/CLAUDE.md" | tr -d ' ')
echo "- CLAUDE.md: ${CLAUDE_LINES}줄" >> "$REPORT"
if [ "$CLAUDE_LINES" -gt 50 ]; then
  echo "  ⚠️ 50줄 초과 — skills로 추가 분리 권장" >> "$REPORT"
fi

TOTAL_SOP=0
for R in "$PROJECT_DIR"/.agents/roles/*.md; do
  BYTES=$(wc -c < "$R" | tr -d ' ')
  TOTAL_SOP=$((TOTAL_SOP + BYTES))
done
echo "- SOP 합계: ${TOTAL_SOP}바이트 (sop-writer 기준 8000바이트/파일)" >> "$REPORT"
if [ "$TOTAL_SOP" -gt 40000 ]; then
  echo "  ⚠️ SOP 총량 40000바이트 초과 — archive 이동 검토 필요" >> "$REPORT"
fi

# ─── 7. 종합 판정 ───
echo "" >> "$REPORT"
echo "## 7. 종합 판정" >> "$REPORT"
echo "" >> "$REPORT"

DEAD_ROLES=$(grep -c "❌ 미사용" "$REPORT")
UNREF_WF=$(grep -c "⚠️ 미참조" "$REPORT")
UNREF_SKILLS=$(grep "## 4" -A 100 "$REPORT" | grep -c "❌ 미참조")

echo "- 미사용 Role: ${DEAD_ROLES}개" >> "$REPORT"
echo "- 미참조 Workflow: ${UNREF_WF}개" >> "$REPORT"
echo "- 미참조 Skill: ${UNREF_SKILLS}개" >> "$REPORT"
echo "" >> "$REPORT"

if [ "$FAIL" -eq 1 ]; then
  echo "🔴 **CRITICAL**: 스크립트 문법 오류 — Phase 실행 차단" >> "$REPORT"
elif [ "$DEAD_ROLES" -gt 2 ] || [ "$UNREF_SKILLS" -gt 3 ]; then
  echo "🟡 **WARNING**: 죽은 코드가 많음 — 정리 권장" >> "$REPORT"
else
  echo "🟢 **OK**: 인프라 상태 양호" >> "$REPORT"
fi

# ─── 출력 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Agent Audit: $REPORT"
cat "$REPORT" | grep -E "^🔴|^🟡|^🟢|종합 판정" | tail -3
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit $FAIL
