# SPEC_reflection — 트리플 → Reflection 카드 → 사용자 결정

> **도메인**: reflection — 트리플 → Reflection 카드 → 사용자 결정
> **코드 클러스터** (graphify graph.json): C4 부분
> **관련 파일**: src/stores/reflectionStore.js, src/services/reflectionEngine.js, src/pages/Reflection.jsx, src/components/ReflectionCard.jsx, src/components/IdentityReflectionCard.jsx, src/components/CounterfactualView.jsx
> **관련 Phase**: Phase 10-B4, D1~D4, E2 + Phase 10.7-T5 (드립 피드)
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **원시 데이터**: 지식그래프 파일(`graph.jsonl`) 내의 신규 또는 누적된 지식 트리플 데이터
- **상태 데이터**: Zustand `reflectionStore` 내 생성된 성찰 카드(Reflection Cards) 정보
- **API/이벤트**: `services/reflectionEngine.js`를 통한 성찰 후보군 스캔 및 성찰 유도 카드 생성 이벤트

## 2. 출력 (Output)

- **상태 변경**: `reflectionStore` 내 신규 성찰 카드 스택 적재 및 활성화
- **데이터 영속화**: 사용자의 성찰 카드에 대한 동의/거절/무시 피드백 결과 IndexedDB 및 원격 저장
- **UI 렌더링**: 성찰 페이지(`ReflectionPage.jsx`) 내 성찰 카드 슬라이더 및 시각적 피드백 수집 컴포넌트 출력

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (모순 및 연결 감지)**: 성찰 엔진(`reflectionEngine.js`)이 지식그래프를 분석하여 모순(contradicts)되거나 밀접한 연결고리가 있는 노드들을 스캔하여 성찰 카드로 자동 도출해야 한다.
- [ ] **인수조건 2 (피드백 수집 및 결합)**: 사용자가 성찰 카드를 통해 내린 명시적인 결정(승인/수정/거절)이 유실되지 않고 후속 `intervention` 파이프라인의 상태 갱신으로 이어져야 한다.
- [ ] **인수조건 3 (배선 무결성)**: 성찰 컴포넌트(`ReflectionCard.jsx`)와 성찰 엔진 및 Zustand 스토리지 간의 데이터 갱신 배선이 유기적으로 연동되어야 한다.

## 4. 실패 모드 (Failure Modes)

- **성찰 대상 노드 부족**: 지식그래프 크기가 너무 작아 성찰할 관계가 없을 경우, 크래시 없이 "더 많은 메모를 작성하여 지식을 누적하세요" 온보딩 템플릿 노출.
- **성찰 엔진 연산 과부하**: 노드 수가 대용량일 경우 성찰 후보군 필터링 연산을 chunk 단위 비동기로 처리하여 메인 스레드 블로킹 방지.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test`
- **자기검증 시나리오**: 상호 모순되는 mock 지식 트리플 2건을 주입한 뒤, 성찰 엔진을 강제 작동시켜 모순 감지 성찰 카드가 정상 발행되는지 점검.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "reflection"` (성찰 화면 및 성찰 엔진과의 연계 현황 조회)
  - `graphify explain "reflectionEngine"` (모순 감지 및 성찰 카드 추천 알고리즘 노드 설명)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

