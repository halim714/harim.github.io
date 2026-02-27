---
name: progress-tracker
description: 태스크 완료/실패 시 PLAN.md와 PROGRESS.md의 상태를 자동으로 갱신하는 스킬
---

# Progress Tracker Skill

이 스킬은 모든 태스크 완료 또는 실패 시 반복적으로 사용됩니다.
에이전트가 직접 PLAN.md/PROGRESS.md를 수정하는 대신, 이 스킬이 정해진 형식으로 상태를 업데이트합니다.

## 사용 시점

- 스웜 에이전트의 태스크 완료/실패 시
- Phase 단위 완료 확인 시
- 오케스트레이터가 다음 태스크를 배정할 때

## 절차

### Step 1: 태스크 상태 업데이트 (PLAN.md)

```bash
PLAN=/Users/halim/Desktop/meeki/meki/PLAN.md
TASK_ID="P1-T1"  # 완료된 태스크 ID
NEW_STATUS="✅"  # ⬜→🔄→✅ 또는 ❌

# 상태 교체 (sed 사용)
sed -i '' "s/| ${TASK_ID} |.*⬜/$(grep "${TASK_ID}" "$PLAN" | sed "s/⬜/${NEW_STATUS}/")/" "$PLAN"
```

수동 업데이트가 더 안전한 경우 다음 형식을 직접 적용:
- `⬜ 미시작` → `🔄 진행중`
- `🔄 진행중` → `✅ 완료`
- `🔄 진행중` → `❌ 실패`

### Step 2: PROGRESS.md 업데이트

**완료 시**:
```markdown
## 완료된 태스크
| [태스크 ID] | [YYYY-MM-DD HH:MM] | [role명] | ✅ [결과 한 줄] |
```

**실패 시**:
```markdown
## 차단된 태스크
| [태스크 ID] | [실패 이유 한 줄] | agent-optimizer 실행 필요 |

## 최근 실패 및 SOP 업데이트 이력
| [YYYY-MM-DD] | [태스크 ID] | [C1~C5] | [업데이트된 SOP 파일] | [버전] |
```

**세션 로그 추가**:
```markdown
## 에이전트 세션 로그
[YYYY-MM-DD HH:MM] <role명> @ <태스크 ID>: <완료한 작업 한 줄> → <결과>
```

### Step 3: 다음 태스크 확인

```bash
# PLAN.md에서 미시작(⬜) 태스크 중 현재 Phase의 다음 것 확인
grep "⬜" /Users/halim/Desktop/meeki/meki/PLAN.md | head -3
```

결과를 Antigravity에게 보고하여 다음 배정을 받는다.
