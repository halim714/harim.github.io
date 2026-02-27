---
description: Deploy a parallel swarm of Claude agents to execute tasks.
---

# Swarm Manager (Antigravity → Claude Code)

이 워크플로우는 Antigravity 오케스트레이터가 터미널 기반의 `claude` (Claude Code) 에이전트들을 병렬로 실행시켜 하위 태스크를 처리하도록 합니다.

> **Before you start**: 모든 태스크는 Meki의 핵심 가치(`mekirule.md`)를 준수해야 합니다. 특히 데이터 주권 침해, 사유 흐름 방해, 위키 연결성 훼손 여부를 사전에 확인하세요.

## 1. 사전 준비 여부 확인
- `miki-editor` 폴더 내에 `scripts/run-swarm.sh` 파일이 존재하고 실행 권한이 있는지 확인하세요.
- 존재하지 않는다면 에러를 보고하세요.

## 2. 태스크 분할 (Planning)
- 사용자가 지시한 큰 요구사항을 분석하여, **서로 의존성이 적은 독립적인 하위 태스크(최대 3개)** 로 나눕니다.
- 동일한 파일을 동시에 수정하지 않도록 태스크의 범위를 명확히 쪼개는 것이 매우 중요합니다.
- 각 태스크 프롬프트에 **반드시 참조해야 할 룰 파일**을 명시하세요: `[mekirule.md 원칙 준수, .agents/rules/ 내 관련 룰 파일 적용]`

## 3. 병렬 스웜 실행 (Execution)
- OpenRouter를 사용할 경우 `.env` 파일에 `OPENROUTER_API_KEY`가 설정되어 있어야 합니다.
- 각 태스크에 대해 적절한 모델을 선택합니다:
  - `sonnet` — 코딩 작업 (frontend_dev, api_dev) + 의미 검증 (test_verify)
  - `haiku` — 단순 읽기, 상태 확인 등 토큰 절약이 필요한 작업
  - Level 1 구조 검증은 `health-check.sh` (bash, 토큰 비용 0)
  - ⚠️ `test_verify`에 haiku를 쓰지 마라 — 검증은 가장 중요한 단계이므로 sonnet 이상 사용
- **반드시** `run_command` 도구를 사용하여 다음 명령을 백그라운드로 실행하세요:

```bash
./scripts/run-swarm.sh <모델명> "<구체적인 태스크 프롬프트>" /Users/halim/Desktop/meeki/meki/miki-editor <식별자>
```

## 4. 모니터링 및 검증 (Verification)
- 스웜 에이전트들이 실행 중인 동안 `command_status` 도구 등으로 상태를 확인하세요.
- 모든 스웜 실행이 종료(`DONE` 상태)되면:
  1. `git diff`로 변경사항을 확인하세요.
  2. **Meki 핵심 가치 체크**: 데이터 주권 침해 / 사유 흐름 방해 / 위키 연결성 훼손 여부를 검토하세요.
  3. 에이전트로서 코드가 올바르게 작성되었는지 교차 검증(Review)하세요.
  4. 테스트가 필요하다면 `npm run test` 등을 실행하세요.

## 5. 실패 처리 — Agent Improvement Protocol ⚠️

> **핵심 원칙**: 스웜 에이전트가 실패하면 **절대 단순 재실행하지 마라.**

문제가 발견되면 **반드시 `agent-improvement` 워크플로우를 실행**하세요:

```
실패 감지
  → agent-improvement 워크플로우 실행
    → 실패 분류 (C1~C5)
    → .agents/rules/ 룰 생성/업데이트
    → 업데이트된 룰 적용 후 재실행
    → 검증 완료 후 사용자에게 보고
```

단순 재실행이 허용되는 유일한 경우: **일시적 네트워크 오류** (GitHub API rate limit, 타임아웃 등)

## 6. 완료 보고
- 검증이 완료되면 사용자에게 결과를 보고하세요.
- 만약 `agent-improvement` 워크플로우가 실행되었다면, 보고서에 생성된 룰 파일과 개선 내용을 포함하세요.

