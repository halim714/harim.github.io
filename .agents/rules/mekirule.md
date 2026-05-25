# Meki 에이전트 통합 규칙 (Routing & Rules)

> 이 파일은 Meki 프로젝트 에이전트들의 메인 가이드라인입니다.
> 장황한 아키텍처 상세는 각 SPEC 문서에 위임하고, 이 문서에서는 핵심 라우팅과 기본 원칙만 정의합니다.

---

## 🚀 에이전트 세션 시작 프로토콜
세션 시작 후 어떤 작업을 수행하기 전 **반드시 아래 단계를 순서대로 실행**해야 한다:

1. **상태 동기화**: `PLAN.md`와 `PROGRESS.md`를 읽어 현재 Phase 정보와 내가 맡을 태스크를 확인한다.
2. **도메인 SPEC 확인**: `.claude/docs/SPEC_[domain].md`를 찾아 해당 기능 도메인의 **인수조건(Acceptance Criteria)**을 철저히 학습한다. (자의적인 설계 및 코드 발명을 절대 금지한다.)
3. **코드 지식그래프 조회**: `graphify query "[작업 컴포넌트나 핵심 도메인명]"` 또는 `graphify explain "[핵심 노드]"`를 실행하여 현재 코드베이스 구조 및 관계를 브리핑받는다. (자의적인 ad-hoc 튜닝 방지)
4. **가드레일 점검**: `.claude/rules/boundaries.md`를 조회하여 수정하면 안 되는 경계를 파악한다.

---

## 🛠 빌드 및 자기검증 명령
에이전트는 코드 작성 완료 후 반드시 로컬 검증을 거쳐야 한다:
- `cd miki-editor && npm run build` — 표준 빌드 테스트
- `cd miki-editor && npm test -- --watchAll=false` — Jest 전체 단위/통합 테스트
- `cd miki-editor && npx jest src/__tests__/shallow-boot.test.jsx` — 최소 WSOD 보증 테스트
- `graphify update .` — 코드 수정 완료 후 지식그래프 동기화 (AST-only, 무비용)

---

## 📋 에이전트 행동 핵심 원칙

### 원칙 1: 하니스를 고친다 (Meta-Engineering)
에이전트 오동작 발생 시 코드만 고치지 말고, 해당 실패 패턴에 매핑되는 룰을 `.agents/rules/`나 `.claude/rules/`에 추가하거나 하니스(워크플로우)를 개선하라.

### 원칙 2: 에이전트 주도 검증 (Self-Verification)
사용자는 코드를 직접 검토하지 않는다. 에이전트 스스로 완벽한 검증을 설계하고 테스트 통과 여부를 명확한 사실로 입증해야 한다.

### 원칙 3: 모듈 배선 검증 (Wiring Verification)
새로운 함수/모듈을 export/import 할 경우, 실제 호출점(Entry Point)에 배선이 제대로 연결되었는지 검증해야 하며 Dead Code로 남지 않게 감시한다.

### 원칙 4: Meki 가치 체인 수호
- **데이터 주권**: 사용자의 로컬 프라이버시 유지, `miki-data` 외부 전송 절대 엄금.
- **사유의 흐름**: 원본 불변, 오프라인 큐 및 optimistic UI 동작 무결성 보장.
- **위키 연결성**: 트리플(`[[link]]`, `#tag`) 파싱 및 그래프 렌더 연결 유지.

---

## 📂 작업 폴더 및 도메인 SPEC 라우팅
상세 규칙은 `.claude/docs/` 아래의 각 도메인 SPEC 문서에 정의되어 있다:
- `SPEC_xss_security.md`: 입력층 XSS 방어 및 iframe sandbox
- `SPEC_auth_session.md`: OAuth PKCE + WS Proxy 세션
- `SPEC_persist.md`: IndexedDB 캐시 + GitHub Git I/O
- `SPEC_sync_offline.md`: 오프라인 큐 + 배치 동기화
- `SPEC_vault_e2ee.md`: AES-GCM 저장 E2EE 암호화
- `SPEC_publish.md`: Jekyll 블로그 발행
- `SPEC_notes_import.md`: Apple/Samsung 메모 추출 브릿지
- `SPEC_curation.md`: raw 메모 -> Curation 결정 (selected/excluded)
- `SPEC_byok_compile.md`: selected -> BYOK AI 트리플 컴파일
- `SPEC_wiki_render.md`: 트리플 -> 마크다운 렌더 및 편집
- `SPEC_reflection.md`: 트리플 -> Reflection 카드 생성
- `SPEC_intervention.md`: 결정 -> interventions.jsonl 피드백 반영