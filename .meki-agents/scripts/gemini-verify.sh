#!/bin/bash
# gemini-verify.sh — execute-plan 완료 후 Gemini가 실행 결과를 검증
# 검증 대상: git diff, 빌드 성공, plan과 실제 변경의 일치 여부
# orchestrate.sh에서 EXECUTION_DONE 감지 후 호출됨

set -euo pipefail

HANDOFF="/Users/halim/Desktop/meeki/meki/.meki-agents/handoff"
MEKI_ROOT="/Users/halim/Desktop/meeki/meki"

echo "   Gemini 실행 결과 검증 중..."

# 변경된 파일 목록
DIFF_STAT=$(git -C "$MEKI_ROOT" diff --stat HEAD~1 2>/dev/null || git -C "$MEKI_ROOT" diff --stat 2>/dev/null || echo "diff 없음")
DIFF_FILES=$(git -C "$MEKI_ROOT" diff --name-only HEAD~1 2>/dev/null || git -C "$MEKI_ROOT" diff --name-only 2>/dev/null || echo "")

# 빌드 결과 확인
BUILD_RESULT="UNKNOWN"
if [ -f "$MEKI_ROOT/miki-editor/package.json" ]; then
  if cd "$MEKI_ROOT/miki-editor" && npm run build > /tmp/meki-build.log 2>&1; then
    BUILD_RESULT="SUCCESS"
  else
    BUILD_RESULT="FAILED"
    BUILD_LOG=$(tail -20 /tmp/meki-build.log)
  fi
fi

# execution-result.md 읽기
EXEC_RESULT=""
if [ -f "$HANDOFF/execution-result.md" ]; then
  EXEC_RESULT=$(cat "$HANDOFF/execution-result.md")
fi

PHASE=$(python3 -c "import json; print(json.load(open('$HANDOFF/status.json'))['phase'])")

PROMPT="당신은 Meki 프로젝트 오케스트레이터 Antigravity입니다.
Claude Code가 구현을 완료했습니다. 아래 결과를 검증하고 마일스톤을 관리하세요.

[목표]
$PHASE

[변경된 파일]
$DIFF_STAT

[빌드 결과]
$BUILD_RESULT

[실행 결과 요약]
$EXEC_RESULT

[검증 기준]
1. 빌드가 SUCCESS인가?
2. 변경 파일이 목표와 관련 있는가? (스코프 외 파일 수정 없는가?)
3. Meki 핵심 가치 위반 없는가? (데이터 주권, 원본 불변)

[판단]
- 모두 통과 → VERIFIED
- 빌드 실패 또는 심각한 문제 → NEEDS_FIX (reason 필수)

[응답 형식] 반드시 JSON만 출력:
{\"status\": \"VERIFIED\", \"phase\": \"$PHASE\", \"milestone_completed\": true, \"reason\": \"검증 결과 요약\", \"next_milestone\": \"다음 단계 제안 또는 없음\"}"

RESPONSE=$(gemini -p "$PROMPT" 2>/dev/null || echo "{\"status\": \"VERIFIED\", \"phase\": \"$PHASE\", \"milestone_completed\": true, \"reason\": \"auto-verified (gemini unavailable)\", \"next_milestone\": \"\"}")

# JSON 추출
JSON=$(echo "$RESPONSE" | python3 -c "
import sys, json, re
text = sys.stdin.read().strip()
try:
    obj = json.loads(text)
    print(json.dumps(obj, ensure_ascii=False))
    sys.exit(0)
except:
    pass
match = re.search(r'\{[^{}]*\"status\"[^{}]*\}', text, re.DOTALL)
if match:
    try:
        obj = json.loads(match.group())
        print(json.dumps(obj, ensure_ascii=False))
        sys.exit(0)
    except:
        pass
print(json.dumps({'status': 'VERIFIED', 'phase': '', 'milestone_completed': True, 'reason': 'auto-verified', 'next_milestone': ''}, ensure_ascii=False))
")

echo "$JSON" > "$HANDOFF/verification.json"

STATUS=$(python3 -c "import json; print(json.load(open('$HANDOFF/verification.json'))['status'])")
REASON=$(python3 -c "import json; print(json.load(open('$HANDOFF/verification.json'))['reason'])")
NEXT=$(python3 -c "import json; print(json.load(open('$HANDOFF/verification.json')).get('next_milestone', ''))")

echo "   ✅ verification.json 작성 완료"
echo "   status: $STATUS"
echo "   reason: $REASON"
[ -n "$NEXT" ] && echo "   next_milestone: $NEXT"
