# SPEC_publish — Jekyll 발행 (블로그)

> **도메인**: publish — Jekyll 발행 (블로그)
> **코드 클러스터** (graphify graph.json): C3 일부
> **관련 파일**: src/services/publish.js, src/utils/metadata.js, src/utils/markdown.js, src/utils/slugify.js, src/hooks/usePublish.js
> **관련 Phase**: 기존 (Phase 1~9 부산물, Phase 10과 별개)
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **유저 조작**: 블로그 발행 버튼 클릭, frontmatter 메타데이터 편집
- **원시 데이터**: 발행 대상 마크다운 파일 내용, slug용 제목 텍스트
- **API/이벤트**: `publish.js` 호출, Jekyll 메타데이터 파싱 이벤트

## 2. 출력 (Output)

- **상태 변경**: Zustand 내 해당 문서의 발행 상태 플래그 활성화
- **데이터 영속화**: public Jekyll 저장소(`[username].github.io` repo)로 frontmatter 정보가 보완된 마크다운 커밋 전송
- **UI 렌더링**: 발행 성공 알림 및 발행된 웹사이트 URL 하이퍼링크 UI 표시

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (Frontmatter 빌드)**: 발행되는 파일 상단에는 반드시 Jekyll 규격에 맞는 YAML frontmatter(title, layout, date, tags 등)가 자동 생성되어 삽입되어야 한다.
- [ ] **인수조건 2 (URL 친화적 Slug)**: 발행되는 파일명 및 경로는 제목 문자열로부터 유도된 URL-friendly 영문 slug여야 한다 (`slugify.js` 정상 작동).
- [ ] **인수조건 3 (배선 무결성)**: 발행 서비스 모듈(`publish.js`)이 에디터 사이드바(`DocumentSidebar.jsx`)와 밀접하게 연동되어 사용자 클릭 이벤트를 제대로 수신해야 한다.

## 4. 실패 모드 (Failure Modes)

- **공개 블로그 레포 부재**: 지정된 Jekyll 블로그 레포지토리에 대한 접근 권한이 없거나 없을 경우, "발행 레포 설정 확인" 명확한 안내를 출력하고 트랜잭션 중단.
- **Frontmatter 파싱 오류**: 기존 metadata 중 비정상 요소 발견 시 롤백 및 Fallback 처리 정책 적용.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test`
- **자기검증 시나리오**: 임의의 한글 제목 노트를 발행하여 영문 및 숫자로 된 slug 파일명으로 Jekyll 포맷에 맞추어 `_posts/` 폴더에 생성되는지 E2E 점검.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "publish"` (Jekyll 블로그 발행 서비스 및 frontmatter 파서 의존성)
  - `graphify explain "slugify"` (URL 친화적 slug 생성 유틸 함수 설명)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

