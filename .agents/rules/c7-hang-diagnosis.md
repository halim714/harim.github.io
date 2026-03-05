---
trigger: init_hang
description: 에이전트 초기화 hang 발생 시 추측 기반 진단 금지, bisect 순서로 격리 테스트 의무화
---

# C7: Hang 진단 프로토콜

## 컨텍스트
P4-T0a에서 에이전트가 init hang (45초 내 0바이트 출력)으로 종료되었을 때,
오케스트레이터가 "큰 프롬프트 → hang → 프롬프트 크기가 원인" 이라는
**피상적 상관관계를 인과관계로 오인**하여 잘못된 수정(stdin 전달)을 제안했습니다.

실제 원인은 `--add-dir`의 CWD 중복 인덱싱이었으며,
변수를 하나씩 격리하는 bisect 테스트(T0→T3→T2→T1)를 먼저 실행했다면
10분 내에 특정 가능했습니다.

## 분류: C7 — 환경/초기화 실패

### 감지 조건
`.raw` 파일 = 0바이트 AND 정상 종료 아님 (exit ≠ 0)

### 절대 금지
- 추측 기반 가설 수립 후 즉시 코드 수정
- 단순 재실행 ("다시 돌려보자")
- 한 번의 비교 테스트로 원인 확정

## bisect 순서 (필수)

hang이 감지되면 **반드시 다음 순서로 격리 테스트를 실행**하라.

### T0: 최소 실행 테스트 (2분)
```bash
timeout 15 claude -p --model "$MODEL" --dangerously-skip-permissions \
  -- "respond with OK" < /dev/null
# → 정상: 환경/프롬프트 문제. T3로 진행
# → 실패: claude CLI 자체 문제. API 키/설치 확인
```

### T3: 환경 격리 — 빈 디렉토리 (2분)
```bash
cd /tmp/test-$(date +%s) && mkdir -p . && \
timeout 30 claude -p --model "$MODEL" --dangerously-skip-permissions \
  -- "$FULL_PROMPT" < /dev/null
# → 정상: CWD 환경 문제 (CLAUDE.md 로딩, .git 크기 등)
# → 실패: 프롬프트 자체 문제. T1으로 진행
```

### T2: CWD 격리 — 원래 디렉토리에서 플래그 제거 (2분)
```bash
cd "$ORIGINAL_CWD" && \
timeout 30 claude -p --model "$MODEL" --dangerously-skip-permissions \
  -- "$FULL_PROMPT" < /dev/null
# --add-dir 없이, 기타 플래그 없이
# → 정상: CLI 플래그(-add-dir 등)가 원인
# → 실패: T1으로 진행
```

### T1: 프롬프트 크기 이분 탐색 (5분)
```bash
# 프롬프트를 절반으로 줄여서 실행
HALF_PROMPT=$(echo "$FULL_PROMPT" | head -c $((${#FULL_PROMPT} / 2)))
timeout 30 claude -p ... -- "$HALF_PROMPT" < /dev/null
# → 반복하여 hang 경계 크기 특정
```

## 결과 기록
bisect 결과를 `.agents/progress/` 에 기록:
```
**태스크 ID**: [hang이 발생한 태스크]
**담당 Role**: orchestrator
**결과**: hang 원인 특정
**T0**: [정상/실패]
**T3**: [정상/실패]
**T2**: [정상/실패]
**T1**: [정상/실패]
**확정 원인**: [예: --add-dir CWD 중복 인덱싱]
```
