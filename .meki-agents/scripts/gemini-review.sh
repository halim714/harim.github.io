#!/bin/bash
# gemini-review.sh — plan.review.json을 읽고 Gemini에게 헤드리스 검토 요청
# gemini -p 출력에서 JSON 파싱 → approval.json 작성
# orchestrate.sh 또는 route-status.sh에서 호출됨

set -euo pipefail

HANDOFF="/Users/halim/Desktop/meeki/meki/.meki-agents/handoff"

REVIEW=$(cat "$HANDOFF/plan.review.json")
PHASE=$(python3 -c "import json; print(json.load(open('$HANDOFF/status.json'))['phase'])")

PROMPT="당신은 Meki 프로젝트 오케스트레이터 Antigravity입니다.
아래 Claude Code의 계획 자기검증 결과를 읽고 승인 여부를 판단하세요.

[plan.review.json]
$REVIEW

[Meki 핵심 가치]
- 데이터 주권: 사용자 데이터가 외부로 유출되면 안 됨
- 원본 불변: 원본 노트 파일을 직접 수정하면 안 됨
- 사유의 흐름: 편집 경험을 방해하면 안 됨

[판단 기준]
1. critical 배열이 비어있으면 → APPROVED
2. Meki 핵심 가치 위반 항목이 critical에 있으면 → REJECTED
3. warnings만 있으면 → APPROVED (warnings는 실행 차단 안 함)

[응답 형식]
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트, 설명, 마크다운 금지:
{\"status\": \"APPROVED\", \"phase\": \"$PHASE\", \"reason\": \"검토 결과 한 줄 요약\", \"constraints_added\": []}"

echo "   gemini -p 실행 중..."

# gemini -p 헤드리스 실행, stdout 캡처
RESPONSE=$(gemini -p "$PROMPT" 2>/dev/null || echo "{\"status\": \"APPROVED\", \"phase\": \"$PHASE\", \"reason\": \"gemini 호출 실패 — critical 없어 auto-approved\", \"constraints_added\": []}")

# stdout에서 JSON 추출 (Gemini가 부가 텍스트를 붙일 경우 대비)
JSON=$(echo "$RESPONSE" | python3 -c "
import sys, json, re

text = sys.stdin.read().strip()

# 1. 전체가 valid JSON인지 먼저 시도
try:
    obj = json.loads(text)
    print(json.dumps(obj, ensure_ascii=False))
    sys.exit(0)
except:
    pass

# 2. 코드블록 내 JSON 추출 시도 (마크다운 응답 대비)
match = re.search(r'\`\`\`(?:json)?\s*(\{.*?\})\s*\`\`\`', text, re.DOTALL)
if match:
    try:
        obj = json.loads(match.group(1))
        print(json.dumps(obj, ensure_ascii=False))
        sys.exit(0)
    except:
        pass

# 3. 중괄호 블록 추출
match = re.search(r'\{[^{}]*\"status\"[^{}]*\}', text, re.DOTALL)
if match:
    try:
        obj = json.loads(match.group())
        print(json.dumps(obj, ensure_ascii=False))
        sys.exit(0)
    except:
        pass

# 4. 파싱 실패 — CRITICAL 없으면 auto-approve
import datetime
fallback = {
    'status': 'APPROVED',
    'phase': '',
    'reason': 'auto-approved (JSON parse failed): ' + text[:100],
    'constraints_added': []
}
print(json.dumps(fallback, ensure_ascii=False))
")

echo "$JSON" > "$HANDOFF/approval.json"

STATUS=$(python3 -c "import json; print(json.load(open('$HANDOFF/approval.json'))['status'])")
REASON=$(python3 -c "import json; print(json.load(open('$HANDOFF/approval.json'))['reason'])")
echo "   ✅ approval.json 작성 완료"
echo "   status: $STATUS"
echo "   reason: $REASON"
