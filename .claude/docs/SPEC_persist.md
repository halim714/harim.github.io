# SPEC_persist — 메모/문서 저장 (IndexedDB 캐시 + GitHub I/O)

> **도메인**: persist — 메모/문서 저장 (IndexedDB 캐시 + GitHub I/O)
> **코드 클러스터** (graphify graph.json): C3 + C7
> **관련 파일**: src/utils/storage-client.js, src/services/github.js, src/utils/database.js, src/components/editor/AttachmentModal.jsx
> **관련 Phase**: Phase 7 (성능 캐시) + 일반 저장 흐름 (publish 제외)
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **유저 조작**: 노트 신규 생성, 노트 본문 수정, 첨부파일 업로드
- **원시 데이터**: 마크다운 텍스트, 바이너리 이미지/파일 데이터
- **API/이벤트**: `storage-client.js` 저장 트리거, `github.js` 파일 전송 이벤트

## 2. 출력 (Output)

- **상태 변경**: 로컬 `documentStore` 갱신 및 메모리 내 저장 대기열 갱신
- **데이터 영속화**: IndexedDB 캐시 스토리지(`database.js`) 저장 및 GitHub private API를 통한 miki-data 레포 커밋
- **UI 렌더링**: 저장 성공 시 UI 상에 동기화 완료 또는 로컬 저장 성공 인디케이터 표시

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (로컬 우선 저장)**: 노트 본문 편집 시 즉시 IndexedDB 로컬 저장소에 캐시가 저장되어 어떠한 상황에서도 편집 내용이 손실되지 않아야 한다 (Optimistic local save).
- [ ] **인수조건 2 (GitHub Git I/O)**: 로컬 저장 이후 비동기적으로 GitHub private 레포(`miki-data`)에 마크다운 및 리소스 파일이 Git API로 커밋되어야 한다.
- [ ] **인수조건 3 (배선 무결성)**: 에디터 컴포넌트(`Editor.jsx`)에서 저장소 API(`storage-client.js`) 함수들을 안정적으로 import하여 호출 배선이 정상 동작해야 한다.

## 4. 실패 모드 (Failure Modes)

- **GitHub API 속도 제한 (Rate Limit)**: API 한도 초과 시, 에러로 전체 서비스가 먹통되지 않고 로컬 캐시에 안전하게 보관 후 대기 정책 적용.
- **Git Merge Conflict**: 로컬과 원격 간 변경 불일치 시, 로컬 데이터를 덮어쓰지 않고 최신 로컬 카피 보존 처리.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test src/__tests__/utils/storage-client.test.js`
- **자기검증 시나리오**: 인터넷 연결을 차단(mocking)한 상태에서 노트 작성 후, IndexedDB에 정상 저장되었는지 조회하는 테스트 E2E 진행.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "storage-client"` (storage-client.js 유틸 및 로컬 스토리지 인터페이스)
  - `graphify explain "GitHubService"` (GitHub 연동 서비스 노드 의존성)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

