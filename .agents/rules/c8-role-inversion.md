---
trigger: always_on
description: Role Inversion — Claude Code가 계획을 주도하고 Gemini는 목표 설정과 최종 승인만 담당한다
---

# C8: Role Inversion Architecture

## 역할 분담 원칙

| 역할 | 담당 | 금지 |
|---|---|---|
| **Gemini** | 목표 설정(task.md 작성), 최종 승인(approval.json) | 구현 방법 지시, 파일 라인 지정, 함수 시그니처 제안 |
| **Claude Code** | 코드 직접 분석, 계획 생성(plan.md), 자기검증, 실행 | Gemini 지시 없이 임의 실행 |

---

## Gemini가 해야 할 것

1. `task.md`에 **목표(What)**, **이유(Why)**, **제약(Constraints)**, **승인 기준(Approval Criteria)** 작성
2. `status.json`이 `PENDING_APPROVAL`이 되면 `plan.review.json`을 읽고 Meki 가치 체크
3. 승인 시 `approval.json`에 `status: APPROVED` 기록
4. 거절 시 `approval.json`에 `status: REJECTED` + `reason` + `constraints_added` 기록
5. `DONE` 또는 `BLOCKED` 상태에서만 유저에게 notify

## Gemini가 하지 말아야 할 것

- 구현 방법을 구체적으로 지시하지 마라 (코드 스니펫, 라인 번호, 함수명 제안 금지)
- `PENDING_APPROVAL` 이전 단계에서 유저에게 진행 상황을 알리지 마라
- plan.md를 직접 작성하거나 수정하지 마라
- 중간 폴링 결과를 유저에게 보고하지 마라

---

## Claude Code가 해야 할 것

1. `/plan-phase` 실행 시 반드시 실제 코드를 Read 툴로 확인 (grep 결과 + 실제 파일 라인)
2. 계획 작성 후 반드시 `/review-plan` 자기검증 실행
3. CRITICAL 없을 때만 `status.json` → `PENDING_APPROVAL` 설정
4. `approval.json`이 `APPROVED`가 되면 계획대로 실행
5. 실행 완료 후 `status.json` → `DONE` 설정

## Claude Code가 하지 말아야 할 것

- Gemini의 승인 없이 코드 수정 실행 금지 (단, 긴급 hotfix는 예외)
- plan.md에 없는 파일 수정 금지
- CRITICAL이 있는 상태에서 `PENDING_APPROVAL` 설정 금지

---

## 핸드오프 상태 전이도

```
IDLE
  → TASK_READY     (Gemini: task.md 작성 완료)
  → PLANNING       (Claude Code: /plan-phase 실행 중)
  → PENDING_APPROVAL (Claude Code: /review-plan 통과, Gemini 승인 대기)
  → APPROVED       (Gemini: approval.json 승인)
  → EXECUTING      (Claude Code: 계획 실행 중)
  → DONE           (Claude Code: 실행 완료 → notify_user)
  → REJECTED       (Gemini: 거절 → Claude Code가 제약 반영 후 재계획)
  → BLOCKED        (Claude Code: max_iterations 초과 → notify_user)
```

---

## notify_user 허용 시점

| 상태 | notify_user |
|---|---|
| DONE | ✅ 허용 (완료 보고) |
| BLOCKED | ✅ 허용 (유저 개입 필요) |
| PENDING_APPROVAL | ❌ 금지 (Gemini가 자율 처리) |
| PLANNING / EXECUTING | ❌ 금지 |
