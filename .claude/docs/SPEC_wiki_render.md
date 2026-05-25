# SPEC_wiki_render — 트리플 → 마크다운 페이지 + 직접 편집

> **도메인**: wiki_render — 트리플 → 마크다운 페이지 + 직접 편집
> **코드 클러스터** (graphify graph.json): C4 부분
> **관련 파일**: src/stores/wikiStore.js, src/wiki/tripleParser.js, src/wiki/markdownDiffer.js, src/wiki/components/WikiPage.jsx, src/pages/WikiIndex.jsx
> **관련 Phase**: Phase 10-C1, C2, C3 + Phase 10-E1
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **유저 조작**: 위키 페이지 링크(`[[link]]`) 클릭, 직접적인 위키 페이지 내용 텍스트 편집
- **원시 데이터**: 파싱된 지식 트리플 데이터, 마크다운 위키 페이지 문자열
- **API/이벤트**: `wiki/tripleParser.js` 트리거, Zustand `wikiStore` 로드 요청 및 `markdownDiffer.js` 비교 트리거

## 2. 출력 (Output)

- **상태 변경**: `wikiStore` 상태 동기화 및 선택된 위키 문서 객체 상태 갱신
- **데이터 영속화**: 변경된 마크다운 페이지를 IndexedDB 캐시 스토어 및 miki-data Git 저장소에 커밋
- **UI 렌더링**: 위키 편집 화면 및 위키 그래프 인스펙터 내 연관 링크 노드 시각화

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (연결성 파싱)**: 마크다운 위키 페이지 내 `[[양방향 링크]]` 및 `#태그` 구문을 파서(`tripleParser.js`)가 정확하게 검출하여 온톨로지 구조에 매핑해야 한다.
- [ ] **인수조건 2 (텍스트 디퍼링)**: 위키 내용 수동 편집 시, 기존 지식그래프 상태를 훼손하지 않기 위해 `markdownDiffer.js`가 수정된 부위만 정확히 식별하여 원격에 반영해야 한다.
- [ ] **인수조건 3 (배선 무결성)**: 위키 렌더링 컴포넌트(`WikiPage.jsx`, `WikiIndex.jsx`)와 Zustand 스토어(`wikiStore`) 간 데이터 통신 및 갱신 이벤트 루프가 정상 배선되어야 한다.

## 4. 실패 모드 (Failure Modes)

- **순환 참조 고리 형성**: 위키 노드들 간에 순환 참조가 과도하게 발생할 경우, 렌더링 그래프가 무한 루프에 빠져 UI가 크래시되지 않도록 최대 깊이 제한(Depth cap) 및 Fallback 처리 정책 적용.
- **존재하지 않는 노드 링크 클릭**: 아직 미생성된 `[[유령 노드]]` 클릭 시 빈 위키 생성/편집 화면으로 안전하게 진입 유도.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test src/wiki/`
- **자기검증 시나리오**: `[[A]] -> [[B]]` 링크가 포함된 마크다운을 넣어 `tripleParser`가 정상적으로 트리플 관계 엣지를 생성하는지 검증.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "wiki"` (위키 렌더러와 위키스토어 연동 현황 조회)
  - `graphify explain "tripleParser"` (위키 텍스트 파싱 및 양방향 연결성 파서 설명)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

