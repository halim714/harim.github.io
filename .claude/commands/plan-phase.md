---
description: Claude Code가 task.md를 읽고 코드를 직접 분석하여 구현 계획을 생성한다
---

# /plan-phase — Claude Code 계획 생성 커맨드

> Claude Code가 코드를 직접 읽고 분석하여 구현 계획을 작성한다.
> Gemini는 목표(task.md)만 설정하고, 구현 방법은 Claude Code가 결정한다.

## 전제 조건

- `.meki-agents/handoff/task.md` 가 존재하고 `## What`, `## Constraints` 섹션이 채워져 있어야 한다.
- `status.json`의 status가 `TASK_READY` 또는 `IDLE` 이어야 한다.

---

## Step 1: task.md 읽기

```bash
HANDOFF="/Users/halim/Desktop/meeki/meki/.meki-agents/handoff"
cat "$HANDOFF/task.md"
```

- `## What` → 목표 파악
- `## Constraints` → 변경 불가 제약 파악
- `## Approval Criteria` → 최종 승인 기준 파악

---

## Step 2: status.json → PLANNING 설정

```bash
python3 -c "
import json, datetime
path = '$HANDOFF/status.json'
s = json.load(open(path))
s['status'] = 'PLANNING'
s['updated_at'] = datetime.datetime.utcnow().isoformat()
s['updated_by'] = 'claude-code'
json.dump(s, open(path,'w'), indent=2)
"
```

---

## Step 3: 영향 범위 분석 (환각 방지)

task.md의 목표에서 수정 대상 함수/파일을 식별한 후, **실제 코드를 읽어** 확인한다.

```bash
# 수정 대상 함수의 호출자 전수 조사
grep -rn "함수명" /Users/halim/Desktop/meeki/meki/src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
```

각 수정 지점에 대해:
1. 실제 파일을 Read 툴로 열어 라인 번호 확인
2. 해당 함수의 시그니처, 호출자 목록 파악
3. 변경 시 영향받는 다운스트림 파악

---

## Step 4: plan.md 작성

`/Users/halim/Desktop/meeki/meki/PLAN.md` 또는 별도 플랜 파일에 다음 구조로 작성:

```markdown
## Plan (Claude Code 생성)
생성일: <ISO timestamp>
iteration: <n>

### 수정 파일 목록
| 파일 | 라인 범위 | 변경 내용 | 의존 태스크 |
|---|---|---|---|
| src/... | L42-L67 | ... | - |

### 태스크 의존성 그래프
T1 → T2 → T3
T4 (독립)

### 각 태스크 상세
#### T1: [설명]
- 파일: src/...
- 현재 코드 (실제 확인): `function foo(a, b) {...}`
- 변경 후: `function foo(a, b, c) {...}`
- 호출자 영향: bar.js:L12, baz.js:L34

#### T2: ...
```

---

## Step 5: /review-plan 자동 실행

plan.md 작성 완료 후 즉시 `/review-plan` 커맨드를 실행한다.

> plan-phase는 단독으로 완료되지 않는다. 반드시 review-plan까지 연결 실행한다.
