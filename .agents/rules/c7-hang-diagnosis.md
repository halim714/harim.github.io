---
trigger: manual
description: 에이전트 초기화 hang 발생 시 추측 기반 진단 금지, bisect 순서로 격리 테스트 의무화
---

# C7: Hang 진단 프로토콜

## 컨텍스트
P4-T0a에서 에이전트가 백그라운드 실행 불가(0바이트 출력) 문제로 오류를 겪었을 때,
오케스트레이터가 "큰 프롬프트 → hang → 프롬프트 크기가 원인" 이라는
**피상적 상관관계를 인과관계로 오인**하여 잘못된 수정(stdin 전달)을 제안했던 이력이 있습니다.

현재 `run-swarm.sh` v6부터는 `echo "$PROMPT" | timeout N claude` 방식의 **포그라운드 파이프라인**을 사용하므로,
에이전트 스크립트 내부에서의 백그라운드 관리나 INIT_HANG 핸들러는 제거되었습니다.
따라서, hang 발생 시 포그라운드 파이프라인 자체의 호환성 및 timeout을 중심으로 bisect를 진행해야 합니다.

## 분류: C7 — 환경/초기화 실패

### 감지 조건
`.raw` 파일 = 0바이트 AND 정상 종료 아님 (exit ≠ 0)

### 절대 금지
- 추측 기반 가설 수립 후 즉시 코드 수정
- 단순 재실행 ("다시 돌려보자")
- 한 번의 비교 테스트로 원인 확정

## bisect 순서

### T0: 파이프라인 최소 실행 (포그라운드)
```bash
# /tmp에서 포그라운드 파이프가 동작하는지 파악 → CLI/파이프 자체 문제 분리
cd /tmp && echo "respond with OK" | timeout 15 claude -p --model "sonnet" --dangerously-skip-permissions > /tmp/test-output.txt 2>&1
# → 정상: CLI 파이프 작동 정상. T2로 진행
# → 실패: claude CLI 자체 문제 (API 키, 권한, 외부 호환성 붕괴)
```

### T2: CWD 격리 — worktree 파이프라인 비교 (수동)
```bash
# 원본 디렉토리에서 동일 프롬프트 실행 (worktree 아닌 원본 CWD)
cd "$PROJECT_ROOT" && echo "$FULL_PROMPT" | timeout 60 claude -p ... > /tmp/test-output2.txt 2>&1
# → 정상: worktree 특유의 환경 문제 (git 히스토리 과다 등)
# → 실패: 원본 CWD에서도 동일하게 hang 혹은 무출력. T4로 진행
```

### T4: 환경변수 격리 (수동)
```bash
# 부모 프로세스의 환경변수를 확인
env | grep -iE "claude|anthropic|session"
# CLAUDECODE=1 등 중복 세션 유발 변수 발견 시 unset 후 실행
unset CLAUDECODE && echo "$FULL_PROMPT" | timeout 60 claude -p ... > /tmp/test-output3.txt 2>&1
# → 정상: 환경변수가 원인
# → 실패: 프롬프트 자체 문제 혹은 모델 오류. T1으로 진행
```

### T1: 프롬프트 크기 이분 탐색 (수동)
```bash
HALF_PROMPT=$(echo "$FULL_PROMPT" | head -c $((${#FULL_PROMPT} / 2)))
echo "$HALF_PROMPT" | timeout 30 claude -p ... > /tmp/test-output4.txt 2>&1
# → 반복하여 hang 경계 크기 특정
```

## 결과 기록
```
**태스크 ID**: [hang이 발생한 태스크]
**담당 Role**: orchestrator
**T0**: [수동 — 파이프라인 최소 실행 결과]
**T2**: [수동 — CWD 격리 결과]
**T4**: [수동 — 환경변수 격리 결과]
**T1**: [수동 — 프롬프트 이분 탐색 결과]
**확정 원인**: [예: 호환성 문제, CWD 문제 등]
```

