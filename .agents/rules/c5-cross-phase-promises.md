---
trigger: always_on
description: Phase 간 약속(Promise)이 누락되지 않도록 추적·전파하는 규칙
---

# Cross-Phase Promise 추적 (약속 전파 규칙)

## 컨텍스트
Phase 1에서 test_verify 에이전트가 `⚠️ Token Storage: localStorage (Phase 2에서 HttpOnly cookies로 개선)`을 발견하고 PROGRESS.md에 기록했으나, Phase 2 태스크 프롬프트에 이 약속이 반영되지 않아 3개 Phase를 거치는 동안 이행되지 않았습니다.
원인: `⚠️` 경고가 PROGRESS.md 하단의 과거 기록 섹션에 묻혀, 다음 Phase 프롬프트 작성 시 누락됨.

## 규칙

### 검증 에이전트(test_verify)용 규칙
1. **미이행 항목 등록 의무**: Phase 검증 중 `⚠️`(경고) 또는 현재 Phase에서 해결되지 않은 보안/기능 이슈를 발견하면, PROGRESS.md의 **`⚠️ 미이행 약속` 섹션** 테이블에 새 행을 추가하라.
2. **형식**: `| UP-{N} | {출처 태스크ID} | {내용 한 줄 요약} | 🔴 미이행 |`
3. **해소 시 상태 변경**: 해당 약속이 이행되었음을 검증하면, `🔴 미이행` → `✅ 이행 완료 (P{N}-T{X})` 로 변경하라.

### 오케스트레이터(Antigravity)용 규칙
4. **Phase 시작 전 스캔**: `orchestrate-phase.md` Step 1에서 `grep "🔴 미이행" PROGRESS.md`를 실행하여 미이행 건수를 확인하라.
5. **프롬프트 반영**: `🔴 미이행` 항목 중 현재 Phase에서 해결 가능한 항목은 **반드시 해당 태스크 프롬프트에 직접 포함**하라.
6. **보류 시 기록**: 현재 Phase에서 해결 불가능하면, 미이행 약속 테이블의 상태를 `🟡 P{N} 대기`로 변경하고 사유를 기록하라.

### Phase Gate(phase-gate.md)용 규칙
7. **통과 조건 강화**: Phase Gate 검증 시 `🔴 미이행` 건수가 0이 아니면, 해당 항목이 현재 Phase 스코프 밖인지 확인하고 그렇지 않으면 Gate를 통과시키지 마라.

## 올바른 예시
```
# Phase 2 시작 전 오케스트레이터가 확인
$ grep "🔴 미이행" PROGRESS.md
| UP-1 | P1-T6 | localStorage → HttpOnly cookie 전환 | 🔴 미이행 |

# P2-T2 프롬프트에 반영
"server.js에 Express HTTP 서버를 구현하라. JWT 세션을 HttpOnly 쿠키로 발급하라.
 ★ (UP-1 이행) res.cookie('meki_session', jwt, {httpOnly: true, secure: true}) 사용"
```

## 잘못된 예시
```
# 오케스트레이터가 미이행 약속을 스캔하지 않고 바로 Phase 실행
# → UP-1이 또다시 누락됨
```
