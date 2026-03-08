#!/bin/bash
# route-status.sh — Claude Code PostToolUse 훅 핸들러
# .claude/settings.json의 PostToolUse Write|Edit 훅에서 자동 호출됨
# stdin: JSON { session_id, tool_name, tool_input: { file_path, content }, tool_response }
#
# 동작: status.json이 PENDING_APPROVAL로 바뀌면 gemini-review.sh를 백그라운드 실행

HANDOFF="/Users/halim/Desktop/meeki/meki/.meki-agents/handoff"
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"

# stdin에서 쓰여진 파일 경로 추출
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # PostToolUse Write: tool_input.file_path
    fp = d.get('tool_input', {}).get('file_path', '')
    print(fp)
except:
    print('')
" 2>/dev/null)

# status.json이 수정된 경우만 처리
if [[ "$FILE_PATH" == *"status.json"* ]]; then
  STATUS=$(python3 -c "
import json
try:
    print(json.load(open('$HANDOFF/status.json'))['status'])
except:
    print('UNKNOWN')
" 2>/dev/null)

  if [[ "$STATUS" == "PENDING_APPROVAL" ]]; then
    echo "[route-status] PENDING_APPROVAL 감지 — Gemini 계획 검토 시작 (백그라운드)"
    echo "[route-status] 로그: tail -f /tmp/meki-gemini-review.log"
    nohup "$SCRIPTS/gemini-review.sh" > /tmp/meki-gemini-review.log 2>&1 &

  elif [[ "$STATUS" == "EXECUTION_DONE" ]]; then
    echo "[route-status] EXECUTION_DONE 감지 — Gemini 실행 검증 시작 (백그라운드)"
    echo "[route-status] 로그: tail -f /tmp/meki-gemini-verify.log"
    nohup "$SCRIPTS/gemini-verify.sh" > /tmp/meki-gemini-verify.log 2>&1 &
  fi
fi

# 항상 0 반환 — 훅 실패가 Claude Code 세션을 차단하지 않도록
exit 0
