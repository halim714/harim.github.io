---
description: Claude Code가 자신이 생성한 plan.md를 자기검증하고 plan.review.json을 작성한다
---

# /review-plan — Claude Code 자기검증 커맨드

> plan-phase 완료 직후 자동 실행된다.
> 환각(hallucination) 방지: 계획의 각 수정 지점을 실제 코드에서 재확인한다.

## 전제 조건

- `plan.md`(또는 PLAN.md의 현재 Phase 섹션)가 존재해야 한다.
- `status.json`의 status가 `PLANNING` 이어야 한다.

---

## Step 1: plan.md 읽기

계획의 각 태스크에서 다음을 추출:
- 수정 대상 파일 + 라인 범위
- 변경 전/후 코드 예상값
- 호출자 목록

---

## Step 2: 실제 코드 대조 (환각 방지 핵심)

각 수정 지점에 대해 Read 툴로 실제 파일을 열어:

```
[확인 체크리스트]
□ 파일이 실제로 존재하는가?
□ 라인 번호가 정확한가? (±5 허용)
□ 함수 시그니처가 계획과 일치하는가?
□ 호출자 목록이 grep 결과와 일치하는가?
□ 변경 후 코드가 기존 타입/계약과 호환되는가?
```

---

## Step 3: CRITICAL / WARNING 분류

### CRITICAL (구현 시 런타임 버그 발생)
- 존재하지 않는 파일/함수를 수정하려 함
- 함수 시그니처 변경인데 호출자 업데이트 누락
- 타입 불일치 (TypeScript 컴파일 오류 예상)
- 순환 의존성 도입

### WARNING (권장 사항, 차단하지 않음)
- 테스트 없이 로직 변경
- 린트 규칙 위반 가능성
- 성능 저하 가능성

---

## Step 4: plan.review.json 작성

```bash
HANDOFF="/Users/halim/Desktop/meeki/meki/.meki-agents/handoff"
python3 -c "
import json, datetime

review = {
    'schema_version': '1.0',
    'iteration': <현재 iteration>,
    'generated_at': datetime.datetime.utcnow().isoformat(),
    'status': 'REVIEWED',
    'critical': [
        # { 'task': 'T1', 'issue': '설명', 'fix': '수정 방법' }
    ],
    'warnings': [
        # { 'task': 'T2', 'issue': '설명' }
    ],
    'approved_if': '모든 CRITICAL 해결 시 승인'
}

path = '$HANDOFF/plan.review.json'
json.dump(review, open(path,'w'), indent=2, ensure_ascii=False)
print('plan.review.json 작성 완료')
"
```

---

## Step 5: 판단 및 다음 액션

### CRITICAL이 없는 경우 → PENDING_APPROVAL

```bash
python3 -c "
import json, datetime
path = '$HANDOFF/status.json'
s = json.load(open(path))
s['status'] = 'PENDING_APPROVAL'
s['updated_at'] = datetime.datetime.utcnow().isoformat()
s['updated_by'] = 'claude-code'
json.dump(s, open(path,'w'), indent=2)
print('status: PENDING_APPROVAL — Gemini 승인 대기 중')
"
```

### CRITICAL이 있는 경우 → plan.md 자체 수정 후 재검증

```bash
python3 -c "
import json
s = json.load(open('$HANDOFF/status.json'))
if s['iteration'] >= s['max_iterations']:
    s['status'] = 'BLOCKED'
    print('최대 반복 초과 — BLOCKED')
else:
    s['iteration'] += 1
    s['status'] = 'PLANNING'
    print(f'CRITICAL 발견 — iteration {s[\"iteration\"]}로 plan.md 재작성')
import datetime
s['updated_at'] = datetime.datetime.utcnow().isoformat()
json.dump(s, open('$HANDOFF/status.json','w'), indent=2)
"
```

CRITICAL 발견 시 → plan.md의 해당 태스크를 수정 → `/review-plan` 재실행 (최대 `max_iterations`회)

BLOCKED 상태가 되면 → 유저에게 notify (검토 요청)
