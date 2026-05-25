# SPEC_byok_compile — selected 메모 → 트리플 추출 (BYOK)

> **도메인**: byok_compile — selected 메모 → 트리플 추출 (BYOK)
> **코드 클러스터** (graphify graph.json): C5 부분
> **관련 파일**: src/services/byokClient.js, src/services/wikiCompiler.js, src/services/secureStorage.js
> **관련 Phase**: Phase 10-B1, B2 + Phase 10.7-T4 (콜드 스타트 자동 규칙)
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **원시 데이터**: selected 된 큐레이션 마크다운 메모 내용
- **상태 데이터**: BYOK API 토큰 및 컴파일 진행 스택 정보
- **API/이벤트**: `services/byokClient.js`을 통한 LLM 트리플(개념/관계) 추출 요청 및 `wikiCompiler.js` 컴파일 이벤트

## 2. 출력 (Output)

- **상태 변경**: 컴파일러 큐 내 처리 완료 플래그 활성화 및 진행률 갱신
- **데이터 영속화**: 추출된 트리플 형태 데이터를 IndexedDB 및 miki-data 내 지식그래프 파일(`graph.jsonl`)에 추가
- **UI 렌더링**: AI 패널(`AiPanel.jsx`)에 컴파일 상태(추출 중 -> 완료) 및 추출된 키워드/트리플 미리보기 노출

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (BYOK API 통합)**: 사용자의 개인 API 키(Bring Your Own Key)를 사용하여 Gemini/Claude API 서비스 호출이 원활히 동작해야 하며 API 키가 노출되지 않도록 보안 영역(`secureStorage`)에 격리 보관해야 한다.
- [ ] **인수조건 2 (트리플 스키마 추출)**: 원시 메모로부터 의미론적인 개념(Nodes) 및 명확한 관계(Edges) 형태의 트리플을 Graphify가 허용하는 스키마 구조에 완벽히 매핑하여 추출해야 한다.
- [ ] **인수조건 3 (배선 무결성)**: `byokClient.js`의 응답 결과가 위키 컴파일러(`wikiCompiler.js`)로 안정적으로 전달되어 로컬 DB에 추가되는 배선 흐름이 끊기지 않아야 한다.

## 4. 실패 모드 (Failure Modes)

- **API 호출 한도 초과 및 오류**: Gemini API 호출 실패 시, 큐레이션 상태를 selected로 유지한 채 재시도 정책을 적용하고 명확한 API 에러 코드를 UI에 안내.
- **불량 트리플 형식 반환**: JSON 규격이 깨진 트리플 수신 시, 강제 파싱을 시도하거나 Fail Safe 상태로 Fallback 처리하여 컴파일러 크래시 방지.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test`
- **자기검증 시나리오**: mock API key 및 mock 메모를 활용하여 `byokClient`를 구동하고, 규격화된 `nodes`/`edges` 트리플 객체가 반환되는지 단위 테스트 검증.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "byok"` (BYOK 클라이언트와 AI 기능 연동 흐름 조회)
  - `graphify explain "wikiCompiler"` (트리플 가공 및 컴파일 엔진 노드 설명)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

