---
description: Phase 실행 → 리뷰 → 판단 → 행동까지 Antigravity가 자율적으로 수행하는 통합 오케스트레이션 워크플로우
---

# Orchestrate Phase — Antigravity 자율 실행 워크플로우

> `/orchestrate-phase 2` 한 줄로 Phase 실행 → 리뷰 → 판단 → 커밋까지 완료한다.

## 전체 흐름

```
Step 1: 사전 점검 (audit-agents.sh)
Step 2: Phase 실행 (run-phase.sh)
Step 3: 리뷰 리포트 생성 (review-phase.sh)
Step 4: 리포트 읽고 자동 판단
Step 5: 판단에 따른 행동
Step 6: 커밋 + Phase Gate 검증
```

---

## Step 1: 사전 점검

Phase 실행 전 인프라 상태를 확인한다:

// turbo
```bash
# 에이전트 인프라 감사
./scripts/audit-agents.sh

# git 작업 디렉토리 클린 확인
DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$DIRTY" -gt 0 ]; then
  echo "⚠️ 미커밋 변경사항 $DIRTY개 — commit-phase.sh 실행 권장"
fi
```

- audit-agents.sh가 🔴 CRITICAL을 반환하면 → **수정 후 재시작**
- 미커밋 변경이 있으면 → `commit-phase.sh` 실행 후 계속

## Step 2: Phase 실행

// turbo
```bash
./scripts/run-phase.sh <PHASE> sonnet
```

- 백그라운드로 실행하고 `command_status`로 모니터링
- 완료까지 대기 (exit code 확인)

## Step 3: 리뷰 리포트 생성

// turbo
```bash
./scripts/review-phase.sh <PHASE>
```

생성된 리포트 파일을 읽는다: `logs/review_phase<N>.md`

## Step 4: 리포트 판단 — 의사결정 트리

리포트의 **Section 6: Antigravity Action Required**를 읽고 다음 중 하나를 선택:

### 🟢 OK (출력 + 코드 변경 정상)
→ Step 6으로 (커밋 + Phase Gate)

### 🟡 WARNING: 출력 있으나 코드 변경 없음
**원인 분석 순서:**
1. 에이전트 출력 내용 확인 (Section 2) — 에이전트가 "이미 완료" 또는 "작업 불필요"로 판단했는가?
2. PLAN.md 프롬프트가 모호한가? → PLAN.md 수정 후 재실행
3. 에이전트가 worktree 안에서 파일을 생성했지만 `git add` 전에 감지되지 않았는가? → `run-swarm.sh`의 `git status --porcelain` 확인

**행동:** PLAN.md의 해당 Phase 설명을 더 구체적으로 수정 → Step 2부터 재실행 (최대 2회)

### 🔴 CRITICAL: 모든 에이전트 출력 없음
**원인 분석 순서:**
1. `run-swarm.sh`의 `script -q` 래핑이 올바른가?
2. Claude CLI가 실제로 응답을 생성했는가? (`claude -p` 직접 테스트)
3. Rate limit에 걸렸는가?

**행동:** `run-swarm.sh` 디버깅 → 수정 → Step 2부터 재실행 (최대 2회)

### ⚠️ 회귀 감지 (regression_alerts.log에 기록)
**행동:**
1. `git diff` 확인 → 어떤 파일이 파괴되었는지 식별
2. 해당 에이전트의 변경을 **rollback**
3. `agent-improvement` 워크플로우 실행 (실패 분류 → 룰/SOP 개선)
4. 개선된 하니스로 Step 2부터 재실행

### 탈출 조건
- 동일 Phase 재실행 **3회 초과** → 사용자에게 에스컬레이션 (notify_user)
- 재실행 시마다 PROGRESS.md에 시도 횟수 기록

## Step 5: 행동 실행

Step 4의 판단에 따라 자동으로 행동한다. 행동 후 Step 2로 돌아간다.

## Step 6: 커밋 + Phase Gate 검증

// turbo
```bash
# 태스크 단위 자동 커밋
./scripts/commit-phase.sh <PHASE>

# Phase Gate 검증 (PLAN.md 기준)
./scripts/health-check.sh "phase<N>-final"
```

Phase Gate 통과 시:
1. PROGRESS.md 업데이트 (완료 기록)
2. PLAN.md의 다음 Phase 상태를 🔄로 변경
3. 사용자에게 **완료 보고** (notify_user)

Phase Gate 실패 시:
→ 실패 항목을 분석하여 해당 태스크만 재실행

---

## 자동 하니스 개선 (Self-Improvement)

Phase 실행 중 발견된 문제가 **에이전트 인프라 자체의 결함**인 경우:

1. **문제 분류**:
   - 스크립트 버그 (run-swarm.sh, health-check.sh 등) → 직접 수정
   - SOP 부족 (roles/*.md) → Known Issues 섹션 업데이트
   - 룰 부재 (.agents/rules/) → 새 룰 파일 생성
   - 프롬프트 모호 (PLAN.md) → 해당 태스크 설명 구체화

2. **수정 후 검증**: 수정한 인프라 파일로 실패했던 태스크만 재실행
3. **기록**: PROGRESS.md에 "하니스 개선: [내용]" 메모

---

## 디렉토리 감사 자동화

Phase 실행 전후로 `audit-agents.sh`를 실행하여 인프라 건강 상태를 점검한다.
감사 결과가 🔴이면 Phase 실행을 차단한다.
