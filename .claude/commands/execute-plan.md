---
description: APPROVED된 plan.md를 실행한다 — 파일 수정, 빌드 검증, PROGRESS.md 업데이트
---

# /execute-plan — 계획 실행 커맨드

> Gemini의 APPROVED 이후 자동 실행된다.
> plan.md의 각 태스크를 순서대로 실행하고 빌드로 검증한다.

## 전제 조건

- `status.json`의 status가 `APPROVED` 이어야 한다.
- `plan.md` (또는 PLAN.md 내 현재 Phase 섹션)가 존재해야 한다.

---

## Step 1: 상태 확인 + EXECUTING 설정

```bash
HANDOFF="/Users/halim/Desktop/meeki/meki/.meki-agents/handoff"

python3 -c "
import json, datetime
s = json.load(open('$HANDOFF/status.json'))
assert s['status'] == 'APPROVED', f'status가 APPROVED가 아님: {s[\"status\"]}'
s['status'] = 'EXECUTING'
s['updated_at'] = datetime.datetime.utcnow().isoformat()
s['updated_by'] = 'claude-code'
json.dump(s, open('$HANDOFF/status.json', 'w'), indent=2)
print('status: EXECUTING')
"
```

---

## Step 2: plan.md 읽기 + 태스크 목록 파악

`/Users/halim/Desktop/meeki/meki/.meki-agents/handoff/plan.md` 또는 `PLAN.md`의 현재 Phase 섹션을 읽는다.

각 태스크에서 추출:
- 수정 파일 경로
- 변경 전/후 코드
- 실행 순서 (의존성 그래프 기준)

---

## Step 3: 태스크별 실행 — run-swarm.sh 병렬 스웜

의존성 그래프에 따라 **병렬 가능한 태스크는 run-swarm.sh로 동시 실행**한다.

### 실행 원칙
1. 서로 다른 파일을 수정하는 태스크 → **병렬** (`&` + `wait`)
2. 선행 태스크 결과에 의존하는 태스크 → **순차**
3. 공유 파일(App.jsx, index.js 등) 수정 태스크는 단독 실행

### 스웜 실행 템플릿

```bash
SCRIPTS="/Users/halim/Desktop/meeki/meki/miki-editor/scripts"
DIR="/Users/halim/Desktop/meeki/meki/miki-editor"

# ── Batch 1: 병렬 실행 가능한 태스크 ─────────────────────
# (수정 파일이 겹치지 않는 경우)
"$SCRIPTS/run-swarm.sh" sonnet "<T1 프롬프트>" "$DIR" api_dev "p6-t1" &
"$SCRIPTS/run-swarm.sh" sonnet "<T3 프롬프트>" "$DIR" frontend_dev "p6-t3" &
wait   # 두 에이전트 모두 완료 대기

# ── Batch 2: T1 완료 후 실행 (의존 태스크) ──────────────
"$SCRIPTS/run-swarm.sh" sonnet "<T2 프롬프트>" "$DIR" api_dev "p6-t2"

# ── Batch 3: 모든 구현 완료 후 검증 ─────────────────────
"$SCRIPTS/run-swarm.sh" sonnet "<T4 프롬프트>" "$DIR" test_verify "p6-t4"
```

### 스웜 프롬프트 작성 기준
- PLAN.md의 각 태스크 설명을 그대로 사용
- 파일 경로, 함수 시그니처, 변경 내용을 구체적으로 포함
- `npm run build` 검증 포함 지시

```bash
# 태스크 완료 후 변경 확인
git -C /Users/halim/Desktop/meeki/meki diff --stat
```

---

## Step 4: 빌드 검증

```bash
cd /Users/halim/Desktop/meeki/meki/miki-editor && npm run build 2>&1 | tail -20
```

- 빌드 성공 → Step 5로
- 빌드 실패 → 실패 원인 파악 후 수정 → 재빌드 (최대 2회)
- 2회 실패 → `status.json` → `BLOCKED` + 실패 내용 기록

---

## Step 5: 실행 결과 요약 작성

`/Users/halim/Desktop/meeki/meki/.meki-agents/handoff/execution-result.md` 작성:

```markdown
# Execution Result

## 완료 시각
<ISO timestamp>

## 변경된 파일
<git diff --name-only 결과>

## 빌드 결과
SUCCESS / FAILED

## 각 태스크 실행 결과
- T1: ✅ 완료 — src/foo.js L42 수정
- T2: ✅ 완료 — src/bar.js L15 수정
...

## 미완료 항목
없음 / <이유>
```

---

## Step 6: PROGRESS.md 업데이트

`/Users/halim/Desktop/meeki/meki/PROGRESS.md`에 완료 기록 추가:

```markdown
## 완료: <phase 이름>
- 완료일: <날짜>
- 변경 파일: <목록>
- 빌드: ✅ 성공
```

---

## Step 7: status.json → EXECUTION_DONE 설정

```bash
python3 -c "
import json, datetime
s = json.load(open('$HANDOFF/status.json'))
s['status'] = 'EXECUTION_DONE'
s['updated_at'] = datetime.datetime.utcnow().isoformat()
s['updated_by'] = 'claude-code'
json.dump(s, open('$HANDOFF/status.json', 'w'), indent=2)
print('status: EXECUTION_DONE — Gemini 최종 검증 대기')
"
```

> EXECUTION_DONE 설정 후 Gemini의 `gemini-verify.sh`가 자동 트리거된다 (route-status.sh 훅).
