# SPEC_sync_offline — 오프라인 큐 + 동기화 + 크로스 기기 브로드캐스트

> **도메인**: sync_offline — 오프라인 큐 + 동기화 + 크로스 기기 브로드캐스트
> **코드 클러스터** (graphify graph.json): C8 + C11 + C12
> **관련 파일**: src/sync/PendingSyncProcessor.js, src/sync/index.js (SyncManager), src/sync/wsAdapter.js (WebSocketAdapter)
> **관련 Phase**: Phase 4 (Offline) + Phase 9 (크로스 기기)
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **원시 데이터**: 오프라인 상태에서 발생한 노트 편집 변경 내역 객체
- **상태 데이터**: 로컬 IndexedDB 내 `PendingSync` 테이블 데이터 및 동기화 큐 상태
- **API/이벤트**: 네트워크 온라인 전환 이벤트, `SyncManager` 시작 신호, WebSocketAdapter 브로드캐스트

## 2. 출력 (Output)

- **상태 변경**: Zustand `syncStore` 내 동기화 진행 상태 및 큐 사이즈 반영
- **데이터 영속화**: 로컬 큐 비우기 및 GitHub 원격 레포(`miki-data`)에 변경사항 일괄 배치 커밋 완료
- **UI 렌더링**: 에디터 상단에 실시간 동기화 상태 배지(Syncing -> Synced) 표시

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (오프라인 큐 보존)**: 인터넷 연결이 차단된 상태에서의 모든 편집은 로컬 `PendingSync` 큐에 안전하게 삽입 및 보존되어야 한다.
- [ ] **인수조건 2 (온라인 배치 동기화)**: 네트워크 복구 감지 즉시 로컬 큐에 쌓인 배치 변경사항이 순차적(FIFO)으로 원격 서버에 동기화 완료되어야 한다.
- [ ] **인수조건 3 (충돌 해결 정책)**: 양방향 충돌 발생 시, 유실 없는 최종 카피(Conflict Resolution) 판단이 동작하고, 동기화 완료 상태가 크로스 기기에 브로드캐스트 되어야 한다.

## 4. 실패 모드 (Failure Modes)

- **동기화 중 갑작스런 연결 단절**: 배치 커밋 도중 단절 시, 동기화가 원자적으로 중단되고 미전송 큐를 로컬에 원본 그대로 보존.
- **인증 만료로 인한 업로드 실패**: HTTP 401/403 응답 시, 큐를 삭제하지 않고 보류 상태로 대기 및 사용자 토큰 갱신 경고 유도.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test src/sync/`
- **자기검증 시나리오**: `PendingSyncProcessor`에 임시 mock 변경사항 3건을 인큐(Enqueue)한 뒤, `SyncManager` 배치 전송 구동하여 성공 상태를 검증.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "SyncManager"` (SyncManager 동기화 어댑터 및 훅 구조)
  - `graphify explain "PendingSync"` (IndexedDB 오프라인 큐 테이블 노드 의존성)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

