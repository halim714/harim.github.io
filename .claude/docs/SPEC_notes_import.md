# SPEC_notes_import — Apple/Samsung Notes → Meki 진입

> **도메인**: notes_import — Apple/Samsung Notes → Meki 진입
> **코드 클러스터** (graphify graph.json): C9
> **관련 파일**: open-notes-extractor/{apple,samsung,daemon}/, src/pages/ImportBridge.jsx
> **관련 Phase**: Phase 10-F1 / F2 / F3 (현재 가설 코드 — 미실행)
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **원시 데이터**: Apple/Samsung Notes 로컬 데이터베이스 또는 백업 파일
- **상태 데이터**: 로컬 온톨로지 추출 스토리지 큐 상태
- **API/이벤트**: `extractor/extract.js` 구동, `bridge-server`를 통한 `/import-bridge` HTTP API POST 요청

## 2. 출력 (Output)

- **상태 변경**: raw 메모 수집 스토어 내 pending 수집 목록 추가
- **데이터 영속화**: 로컬 캐시 스토리지(`database.js` 내 RawMemoCache)에 추출된 마크다운 메모 및 메타데이터 적재
- **UI 렌더링**: 가져오기(Import) 완료 알림 및 가져온 메모 요약 목록 UI 출력

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (추출 데이터 포맷)**: 외부 메모 앱으로부터의 수집 데이터는 최소 생성일, 수정일, 본문 마크다운 및 태그 정보가 명확히 분리 및 보완된 상태여야 한다.
- [ ] **인수조건 2 (중복 수집 방지)**: 이미 수집된 메모 ID와 대조하여 동일한 고유 식별자(UUID)를 가진 메모의 중복 삽입을 방지해야 한다.
- [ ] **인수조건 3 (브릿지 배선 무결성)**: 로컬 추출 스크립트와 `miki-editor` 로컬 수신 브릿지 서버(`bridge-server`)가 `/import-bridge` 경로를 통해 페이로드를 누수 없이 안정적으로 상호 교환해야 한다.

## 4. 실패 모드 (Failure Modes)

- **원격 DB 잠김 (Locked state)**: Apple Notes 등의 SQLite 파일이 OS 보호 하에 잠겨 있을 경우, 에러 충돌 없이 "접근 권한 획득 실패" 안내를 남기고 안전 종료.
- **비정상 데이터 포맷 수신**: 파싱 불가능한 깨진 미디어 파일 수신 시, 해당 항목 건너뛰고 정상 텍스트 데이터만 우선 추출 정책 적용.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd open-notes-extractor && npm test` (추출기 테스트)
- **자기검증 시나리오**: 임의의 모의 메모(mock memo) 데이터셋을 `/import-bridge`로 POST 전송하여 RawMemoCache에 정상 삽입되는지 API 호출 E2E 검증.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "extractor"` (open-notes-extractor 내부 모듈 및 흐름 조회)
  - `graphify explain "bridge-server"` (bridge-server 웹 소켓/HTTP 데몬 설명)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

