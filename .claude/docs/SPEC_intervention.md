# SPEC_intervention — 사용자 결정 → interventions.jsonl → 시스템 프롬프트

> **도메인**: intervention — 사용자 결정 → interventions.jsonl → 시스템 프롬프트
> **코드 클러스터** (graphify graph.json): C4 부분
> **관련 파일**: src/stores/interventionStore.js, src/services/interventionResolver.js
> **관련 Phase**: Phase 10-B3, E3 + Phase 10.7-T1, T2, T3 (학습 루프 완성)
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **원시 데이터**: 사용자가 성찰 카드를 통해 확정한 결정(승인/수정/거절) 내역 데이터
- **상태 데이터**: Zustand `interventionStore` 내 등록된 intervention 규칙 목록
- **API/이벤트**: `services/interventionResolver.js` 호출 및 시스템 프롬프트 업데이트 트리거 이벤트

## 2. 출력 (Output)

- **상태 변경**: `interventionStore` 내 개입(Intervention) 규칙 리스트 갱신 및 활성화
- **데이터 영속화**: 개입 피드백 내역을 `interventions.jsonl` 파일 형식으로 IndexedDB 및 Git 원격지에 안전 보관
- **UI 렌더링**: 개입 규칙 목록 및 현재 적용 중인 AI 지침 큐레이션 인디케이터 UI 노출

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (개입 지침 영속성)**: 사용자의 의도적 결정 사항은 반드시 `interventions.jsonl` 파일 내 독립된 라인으로 축적 기록되어야 한다 (원본 불변 및 기록 축적).
- [ ] **인수조건 2 (프롬프트 동적 주입)**: 후속 AI 질의 시, 활성화된 개입 규칙(`interventionResolver.js` 동작)이 시스템 프롬프트 접두어(System Prompt Prefix)로 동적으로 조합되어 주입되어야 한다.
- [ ] **인수조건 3 (배선 무결성)**: 개입 컴포넌트 및 리졸버(`interventionResolver.js`) 간의 데이터 전이 및 Zustand 스토어 업데이트 배선이 정상적으로 연계되어 동작해야 한다.

## 4. 실패 모드 (Failure Modes)

- **상반되는 개입 규칙 충돌**: 하나의 개념에 대해 서로 충돌하는 개입 규칙 발견 시, 가장 최신의 시간 타임스탬프를 가진 사용자의 마지막 결정을 우선 적용하는 덮어쓰기/안전화 정책 적용.
- **interventions.jsonl 파싱 오류**: 파일 손상 또는 빈 라인 존재 시, 전체 AI 인터렉션이 크래시되지 않도록 Fallback 디폴트 지침 적용 정책 보장.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test`
- **자기검증 시나리오**: mock 성찰 피드백 결정을 입력하여 `interventions.jsonl`에 한 줄이 정상 append되는지 확인하고, AI 호출 프롬프트에 해당 지침이 반영되어 전송되는지 mock request 페이로드 로그 검증.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "intervention"` (사용자 개입 기능과 개입 스토어 연계 상태 조회)
  - `graphify explain "interventionResolver"` (개입 규칙 해소 및 시스템 프롬프트 조합기 노드 설명)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

