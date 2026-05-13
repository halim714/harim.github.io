---
id: ref-011
topic: src 실행 아키텍처 분석 기반 Meki 도입 계획 (Tool 인터페이스, 권한, 실행 루프)
created: 2026-04-07
tags: [architecture, tool-interface, permissions, execution-loop, phase10, phase11, adoption]
---

# src 분석 기반 Meki 도입 제안

## 1. 문서 목적

`/Users/halim/Downloads/src` 분석 결과를 Meki의 정체성/계획(Phase 10~11 중심)에 맞춰
"무엇을 도입할지, 어떤 순서로 도입할지"를 실행 가능한 형태로 정리한다.

핵심 질문:

1. Meki의 본질(에이전트 세계모델의 창)과 정합적인가?
2. Phase 10~11 네 박자 루프(자동 구축 → diff → 수정 → 재반영)를 가속하는가?
3. 데이터 주권/안전 원칙을 강화하는가?

---

## 2. 분석 범위

### 입력 소스

- 외부 코드베이스: `/Users/halim/Downloads/src`
- Meki 계획/정체성 문서:
  - `PLAN.md`
  - `PROGRESS.md`
  - `.agents/references/ref-007-openclaw-meki-integration-analysis.md`
  - `.agents/references/ref-009-meki-viral-prior-fork-community.md`
  - `.agents/references/ref-010-phase10-11-strategic-plan.md`

### src에서 집중 관찰한 축

- Tool 인터페이스 계약과 레지스트리
- 권한 체크 파이프라인
- 쿼리/턴 실행 루프와 도구 실행 오케스트레이션
- 백그라운드 태스크 안정성 패턴

---

## 3. 핵심 관찰 요약

### A. Tool 계약 표준화가 강력함

- 단일 `Tool` 인터페이스에 입력 스키마, 권한 검사, 동시성 안전성, 읽기/파괴성 성격, 렌더링/요약 훅이 모여 있음.
- `buildTool`로 안전한 기본값을 강제하여 구현 편차를 줄임.

시사점:

- MCP/온톨로지 파이프라인 확장 시 커넥터 품질을 균질화하기 좋다.

### B. 권한 결정을 "행동 + 이유"로 다룸

- allow/ask/deny 자체보다 `decisionReason(rule/mode/hook/classifier 등)`를 구조적으로 남김.
- 인터랙티브/헤드리스/코디네이터/스웜 워커 상황별 권한 분기 로직이 분리되어 있음.

시사점:

- Meki의 "설명 가능한 세계모델"과 정합적이며, 리뷰 UX의 신뢰 기반이 된다.

### C. 실행 루프 복원력이 높음

- 스트리밍 중 도구 실행, 중단/재시도, fallback, 누락 tool_result 보정, 진행/완료 메시지 정합성을 강하게 보장함.
- 동시성 안전 도구는 병렬, 비안전 도구는 직렬 처리로 성능/무결성 균형을 맞춤.

시사점:

- Phase 10의 장시간 수집/인덱싱 파이프라인과 궁합이 좋다.

### D. 백그라운드 태스크 운영 패턴이 실전적임

- stall watchdog, 상태 알림, 중복 통지 방지, abort 전파 등 운영상 디테일이 많다.

시사점:

- OpenClaw/MCP 장기 작업에서 "멈춘 것처럼 보이는" UX를 줄일 수 있다.

---

## 4. Meki 정체성과의 정합성 매핑

| src 관찰 요소 | Meki 정체성과의 연결 | 로드맵 연결 |
|---|---|---|
| Tool 계약 표준화 | "세계모델 창"의 입력/행동을 일관된 구조로 다룸 | Phase 10 |
| 권한 사유 구조화 | "왜 이 행동/추론이 일어났는가"를 설명 가능하게 만듦 | Phase 10~11 |
| 병렬/직렬 실행 오케스트레이션 | 자동 구축 속도와 데이터 무결성의 균형 | Phase 10 |
| Hook 기반 전/후처리 | 사용자 수정이 다음 실행에 반영되는 루프를 기술적으로 구현 | Phase 11 |
| headless-safe 정책 | 데이터 주권/안전 원칙 강화 | Phase 10~11 |
| 백그라운드 watchdog/알림 | 장기 실행 신뢰성 및 사용성 개선 | Phase 10 |

---

## 5. 도입 우선순위 제안

## P0 (즉시, Phase 10 착수와 동시)

### P0-1. Tool 계약 계층 도입

목표:

- Meki MCP/OpenClaw 액션을 공통 Tool 계약으로 묶는다.

도입 항목:

- 입력 스키마 검증
- 권한 체크 훅
- `isReadOnly` / `isConcurrencySafe` / `isDestructive` 메타데이터
- 사용자 노출용 요약 필드

### P0-2. 권한 결정 모델 도입 (decision + reason)

목표:

- allow/ask/deny에 reason을 반드시 포함.

도입 항목:

- `rule`, `mode`, `hook`, `classifier`, `safety` 등의 이유 타입 정의
- 추후 리뷰 UI에서 표시 가능한 형태로 저장

### P0-3. 도구 실행 오케스트레이션 도입

목표:

- 읽기성 작업 병렬, 쓰기성 작업 직렬 실행.

도입 항목:

- 도구 배치 분할기
- 병렬 실행 제한(concurrency cap)
- 실패 시 sibling 취소 정책(최소한 쓰기계열)

### P0-4. Pre/Post Hook 파이프라인 도입

목표:

- 실행 전후에 정책/피드백/메트릭을 일관되게 다룬다.

도입 항목:

- PreToolUse: 정책 검증, 위험 경고, 수정 제안
- PostToolUse: 결과 요약, Prior/Harness 반영 후보 생성

---

## P1 (Phase 10 후반 ~ Phase 11 초반)

### P1-1. headless-safe 권한 정책

- UI 프롬프트가 불가능한 문맥(자동화/백그라운드)에서 기본 deny + 리뷰 큐 적재.

### P1-2. 실행 루프 복원력 강화

- 스트리밍/중단/재시도 시 메시지 정합성 보정.
- 실패를 즉시 터뜨리지 않고 recoverable 경로 분리.

### P1-3. 장기 작업 watchdog + 운영 알림

- 정체 감지, 사용자 조치 힌트, 중복 알림 억제.

---

## P2 (Phase 11 안정화 이후)

### P2-1. 자동 분류기(classifier) 기반 권한 보조

- 고빈도 안전 작업 자동승인 후보를 분류기로 보조.
- 단, 데이터 주권/오탐 비용을 고려해 보수적으로 도입.

### P2-2. 실행/권한 텔레메트리 고도화

- 사용자의 수정 루프(accept/reject/modify)가 어디서 막히는지 정량화.

---

## 6. Meki 코드베이스 도입 초안 (파일 레벨)

대상 루트: `miki-editor/src`

### 신규 제안

- `src/tools/ToolContract.ts`
  - Tool 인터페이스, ToolResult, PermissionDecision 타입
- `src/tools/buildTool.ts`
  - 기본값 주입 빌더
- `src/services/tools/orchestrator.ts`
  - 병렬/직렬 실행 분할 + 실행기
- `src/services/tools/executor.ts`
  - validate → pre-hook → permission → call → post-hook 표준 플로우
- `src/services/permissions/engine.ts`
  - rule/mode/hook/classifier 기반 권한 엔진
- `src/services/permissions/types.ts`
  - decisionReason 타입 집합
- `src/services/hooks/toolHooks.ts`
  - Pre/Post tool hook 실행기

### 기존 연결점

- `src/sync/`:
  - 실행기 결과를 기존 동기화 상태/UI와 연결
- `src/components/`:
  - 권한 ask/reject 사유 표시 컴포넌트
- `src/stores/`:
  - 권한/실행 상태의 단일 상태 저장소 연결

---

## 7. 검증 기준 (Phase 10~11 관점)

### 기능 검증

1. 읽기 도구 3개 동시 호출 시 병렬 처리된다.
2. 쓰기 도구 호출은 직렬 보장된다.
3. 권한 거절 시 "거절 이유"가 구조화되어 기록된다.
4. Pre/Post Hook에서 생성한 피드백이 다음 실행 입력에 반영된다.

### 정체성 검증

1. 사용자에게 "무엇이 실행됐는지"뿐 아니라 "왜 그렇게 판단됐는지"가 보인다.
2. 리뷰 결과가 다음 실행에 실제로 영향을 준다.
3. 데이터 공유 경계(Prior 공유, Instances/Harness 비공유)가 깨지지 않는다.

---

## 8. 리스크와 대응

### 리스크 1: 과도한 일반화

- 문제: 초기 Phase 10에서 Tool 계약을 과하게 크게 잡으면 개발 속도 저하.
- 대응: P0에서는 필수 필드만 도입하고, 렌더링/고급 훅은 P1 이후 확장.

### 리스크 2: 권한 UX 마찰

- 문제: ask가 너무 많으면 사용성 급락.
- 대응: 안전한 읽기성 작업은 정책적으로 allow 기본값 + 감사 로그 중심.

### 리스크 3: 루프 복잡도 증가

- 문제: 실행 오케스트레이션 도입 시 디버깅 난도 상승.
- 대응: tool 실행 단계별 이벤트 로그 표준 키를 먼저 정의하고 도입.

---

## 9. 즉시 실행안 (다음 태스크 단위)

1. `ToolContract + PermissionDecisionReason` 타입만 먼저 도입
2. 기존 핵심 2~3개 액션(읽기 2, 쓰기 1)을 Tool 계약에 마이그레이션
3. 간단한 오케스트레이터(읽기 병렬/쓰기 직렬) 적용
4. Pre/Post Hook에서 "Prior/Harness 반영 후보" 로그만 우선 수집

이 4단계를 완료하면, Phase 10 자동 구축 파이프라인과 Phase 11 피드백 루프의
핵심 기술 기반이 동시에 준비된다.

