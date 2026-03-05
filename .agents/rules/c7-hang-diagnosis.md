---
trigger: manual
description: 에이전트 초기화 hang 발생 시 추측 기반 진단 금지, bisect 순서로 격리 테스트 의무화
---

# C7: Hang 진단 프로토콜

## 컨텍스트
P4-T0a에서 에이전트가 init hang (45초 내 0바이트 출력)으로 종료되었을 때,
오케스트레이터가 "큰 프롬프트 → hang → 프롬프트 크기가 원인" 이라는
**피상적 상관관계를 인과관계로 오인**하여 잘못된 수정(stdin 전달)을 제안했습니다.

실제 원인은 `--add-dir`의 CWD 중복 인덱싱이었으며,
변수를 하나씩 격리하는 bisect 테스트를 먼저 실행했다면
10분 내에 특정 가능했습니다.

## run-swarm.sh와의 관계

`run-swarm.sh` v4에는 다음이 이미 자동 내장되어 있습니다:
- **Pre-flight ≈ T0**: `/tmp`에서 `claude -p "respond with OK"` 실행 → CLI 자체 문제 감지
- **INIT_HANG 후 T3**: `/tmp` 빈 디렉토리에서 FULL_PROMPT 실행 → CWD 환경 문제 감지

따라서 hang 발생 시 T0/T3은 **자동으로 실행 완료**. 오케스트레이터는 **로그를 읽고 T2/T1만 수동 수행**.

## 분류: C7 — 환경/초기화 실패

### 감지 조건
`.raw` 파일 = 0바이트 AND 정상 종료 아님 (exit ≠ 0)

### 절대 금지
- 추측 기반 가설 수립 후 즉시 코드 수정
- 단순 재실행 ("다시 돌려보자")
- 한 번의 비교 테스트로 원인 확정

## bisect 순서

### T0: 최소 실행 (자동 — run-swarm.sh pre-flight)
```bash
# /tmp에서 실행 → CLI 자체 문제 분리
cd /tmp && timeout 15 claude -p --model "$MODEL" --dangerously-skip-permissions \
  -- "respond with OK" < /dev/null
# → 정상: CLI 정상. T3로 진행
# → 실패: claude CLI 자체 문제 (API 키/설치)
```

### T3: 환경 격리 (자동 — run-swarm.sh INIT_HANG 핸들러)
```bash
# /tmp 빈 디렉토리에서 FULL_PROMPT 포함 실행
cd /tmp/swarm-diag-$(date +%s) && timeout 60 claude -p ... -- "$FULL_PROMPT"
# → 정상: CWD(worktree) 환경이 원인 (CLAUDE.md, .git 크기 등)
# → 실패: 프롬프트 자체 또는 CLI 문제. T1으로 진행
```

### T2: CWD 격리 — worktree vs 원본 비교 (수동)
```bash
# 원본 디렉토리에서 동일 프롬프트 실행 (worktree 아닌 원본 CWD)
cd "$PROJECT_ROOT" && timeout 60 claude -p ... -- "$FULL_PROMPT" < /dev/null
# → 정상: worktree 특유의 환경 문제
# → 실패: 원본 CWD에서도 동일. T1으로 진행
```

### T1: 프롬프트 크기 이분 탐색 (수동)
```bash
HALF_PROMPT=$(echo "$FULL_PROMPT" | head -c $((${#FULL_PROMPT} / 2)))
timeout 30 claude -p ... -- "$HALF_PROMPT" < /dev/null
# → 반복하여 hang 경계 크기 특정
```

## 결과 기록
```
**태스크 ID**: [hang이 발생한 태스크]
**담당 Role**: orchestrator
**T0**: [자동 — pre-flight 결과]
**T3**: [자동 — INIT_HANG 핸들러 결과]
**T2**: [수동 — 결과]
**T1**: [수동 — 결과]
**확정 원인**: [예: worktree 환경에서 CLAUDE.md 로딩 충돌]
```
