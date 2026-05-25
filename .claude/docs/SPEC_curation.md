# SPEC_curation — raw 메모 → selected/excluded 결정

> **도메인**: curation — raw 메모 → selected/excluded 결정
> **코드 클러스터** (graphify graph.json): C5 부분 + Phase 8 phantom 통합
> **관련 파일**: src/stores/curationStore.js, src/utils/database.js (RawMemoCache), src/services/curationPipeline.js, src/services/curationScheduler.js, src/pages/Curation.jsx, src/components/MemoCard.jsx, src/components/EditMemoModal.jsx
> **관련 Phase**: Phase 10.5 + Phase 8 phantom 정리 (인수조건 통합)
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **원시 데이터**: RawMemoCache에 저장된 비정제(raw) 마크다운 노도
- **상태 데이터**: Zustand `curationStore` 내 selected/excluded 상태 정보
- **API/이벤트**: `curationScheduler.js`에 의한 주기적 스캔 트리거 및 유저 큐레이션 버튼 클릭 이벤트

## 2. 출력 (Output)

- **상태 변경**: 해당 메모의 큐레이션 상태 플래그 갱신
- **데이터 영속화**: IndexedDB `database.js` 내 raw 메모 삭제 또는 selected 처리 완료
- **UI 렌더링**: 큐레이션 큐(Curation Queue) UI 화면 갱신 및 선택/제외 애니메이션 마운트

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (빈 메모 필터링)**: 알맹이가 없는 빈 메모(empty memo)는 큐레이션 대상 큐에 아예 진입하지 않도록 자동 필터링해야 한다 (Phase 8 phantom fix 통합).
- [ ] **인수조건 2 (상태 전이 정합성)**: 사용자가 selected를 누른 메모는 다음 BYOK 컴파일 파이프라인 대상 메모로 전환되어야 하고, excluded 누른 메모는 스캔 목록에서 완전히 제외되어야 한다.
- [ ] **인수조건 3 (배선 무결성)**: 큐레이션 스케줄러(`curationScheduler.js`)와 로컬 DB 래퍼(`database.js`) 간의 데이터 로드 API 호출 배선이 정상적으로 연동되어야 한다.

## 4. 실패 모드 (Failure Modes)

- **스케줄러 작업 폭주**: 큐레이션할 raw 메모가 대용량(예: >10,000개)일 경우 메인 UI 스레드를 차단(Freeze)하지 않고 Web Worker 또는 비동기 chunk 단위 스캔으로 처리 정책 적용.
- **IndexedDB 트랜잭션 충돌**: 다중 탭 환경에서 큐레이션 상태 충돌 발생 시, 상태 스토어를 최신 DB 카피본으로 동기화 롤백 처리.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test`
- **자기검증 시나리오**: 빈 내용의 모의 메모(blank mock memo)를 인큐한 후 `curationScheduler`를 구동하여 큐에 안 잡히는지 확인하고, 1건의 메모를 select하여 curationStore 상태 갱신 여부를 점검.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "curation"` (curation 스케줄러 및 큐레이션 스토어 의존 관계)
  - `graphify explain "RawMemoCache"` (raw 메모 캐시 유틸 및 데이터 흐름 노드 설명)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

