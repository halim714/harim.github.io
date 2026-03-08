---
description: 자연어 목표를 받아 Gemini ↔ Claude Code 자율 루프를 시작한다
---

# /start-loop — 자율 에이전트 루프 시작

> 사용법: /start-loop Phase 6 Stateless Session Architecture 구현
> 유저가 자연어로 목표를 입력하면 Gemini ↔ Claude Code 루프가 완전 자동 실행된다.

## 동작

1. `$ARGUMENTS`를 목표(goal)로 사용해 `orchestrate.sh`를 실행한다
2. orchestrate.sh가 전체 루프를 자동 실행한다:
   - task.md 생성
   - `/plan-phase` 실행 (Claude Code 계획)
   - Gemini 계획 승인
   - `/execute-plan` 실행 (Claude Code 구현)
   - Gemini 실행 검증
   - DONE

---

## 실행

```bash
SCRIPTS="/Users/halim/Desktop/meeki/meki/.meki-agents/scripts"
GOAL="$ARGUMENTS"

if [ -z "$GOAL" ]; then
  echo "사용법: /start-loop <목표 설명>"
  echo "예시: /start-loop Phase 6 Stateless Session Architecture 구현"
  exit 1
fi

echo "목표: $GOAL"
echo ""
echo "자율 루프 시작 — orchestrate.sh 호출..."
"$SCRIPTS/orchestrate.sh" "$GOAL"
```

---

## 완료 기준

orchestrate.sh가 `status: DONE`을 출력하면 완료.
BLOCKED 또는 REJECTED가 되면 유저에게 보고하고 종료.
