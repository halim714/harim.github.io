# CLAUDE.md — Meki 에이전트 핵심 라우팅 지침

> 이 파일은 Claude Code 및 Antigravity 세션 시작 시 최우선적으로 참조되는 라우팅 문서입니다.
> 세부 지침은 `.agents/skills/`와 `.agents/roles/` 및 `.agents/rules/mekirule.md`를 참조하세요.

---

## 🚀 에이전트 작업 시작 프로토콜 (모든 작업 전 필독)

어떤 코드 수정이나 분석을 하기 전에 반드시 다음 4단계를 순차적으로 실행하여 자의적 설계를 차단하라.

1. **상태 동기화**: `PLAN.md`와 `PROGRESS.md`를 읽어 현재 태스크의 상태와 맥락을 파악한다.
2. **도메인 SPEC 확인**: `.claude/docs/SPEC_[domain].md`를 찾아 해당 기능 도메인의 **인수조건(Acceptance Criteria)**을 엄격히 분석한다.
3. **코드 지식그래프 조회**: `graphify`를 사용하여 작업 대상의 컴포넌트 구조와 의존 관계를 질의하고 브리핑받는다.
   - 예시: `/Users/halim/.local/bin/graphify query "[구현할 기능 컴포넌트명]"`
   - 예시: `/Users/halim/.local/bin/graphify explain "[특정 Store/함수명]"`
4. **가드레일 점검**: `.claude/rules/boundaries.md`를 조회하여 구조 변경이 허용되지 않는 한계를 파악한다.

### 작업 완료 후 (필수)
- 코드 수정 완료 후, 지식그래프를 최신으로 유지하기 위해 아래 명령을 반드시 실행하라.
  `graphify update .`

---

## 🛠 빌드/검증 명령 퀵 레퍼런스
에이전트는 작업 완료 시 아래 명령어로 완벽히 자기검증을 완료해야 한다.

- `cd miki-editor && npm run build` — 표준 빌드 검증
- `cd miki-editor && npm test -- --watchAll=false` — Jest 전체 테스트 실행
- `cd miki-editor && npx jest src/__tests__/shallow-boot.test.jsx` — 브라우저 WSOD 방지 최소 보증 테스트
- ❌ `npm run dev` — 데몬화되거나 무한 대기하는 서버 실행은 절대 금지

---

## 📂 SPEC 도메인 인덱스 (12개)
모든 요구사항과 인수조건은 기능 도메인별 SPEC 파일에 정의되어 있다.

| SPEC | 도메인 설명 | 주요 대상 파일 |
|---|---|---|
| `SPEC_xss_security.md` | 입력층 XSS 방어 및 iframe isolated preview | `DOMPurify`, `IsolatedPreview.jsx` |
| `SPEC_auth_session.md` | OAuth PKCE + WS Proxy 세션 게이트 | `services/auth.js`, `App.jsx`, `ws-handler.js` |
| `SPEC_persist.md` | IndexedDB 캐시 + GitHub Git I/O | `utils/storage-client.js`, `services/github.js` |
| `SPEC_sync_offline.md` | 오프라인 큐 + 배치 동기화 | `sync/index.js`, `PendingSyncProcessor.js` |
| `SPEC_vault_e2ee.md` | AES-GCM 저장 E2EE 암호화 | `stores/useVaultStore.js` |
| `SPEC_publish.md` | Jekyll 블로그 발행 | `publish.js` |
| `SPEC_notes_import.md` | Apple/Samsung Notes 추출 bridge | `open-notes-extractor/` |
| `SPEC_curation.md` | raw 메모 -> Curation selected/excluded 결정 | `services/curationScheduler.js`, `utils/database.js` |
| `SPEC_byok_compile.md` | selected -> BYOK AI 트리플 컴파일 | `services/byokClient.js`, `services/wikiCompiler.js` |
| `SPEC_wiki_render.md` | 트리플 -> 마크다운 렌더 및 편집 | `wiki/tripleParser.js`, `markdownDiffer.js` |
| `SPEC_reflection.md` | 트리플 -> Reflection 카드 생성 | `services/reflectionEngine.js`, `stores/reflectionStore.js` |
| `SPEC_intervention.md` | 결정 -> interventions.jsonl 피드백 반영 | `services/interventionResolver.js` |

---

## 📋 에이전트 작업 원칙
- **자의적 코드 작성 금지**: 명세되지 않은 임의의 알고리즘이나 프레임워크를 발명하지 말고 SPEC의 인수조건에 따라 엄격하게 구현하라.
- **모듈 배선 검증**: export된 새 모듈이 실제 프로젝트 엔트리포인트나 호출 흐름에 연결되었는지 확인하라.
- **Meki 핵심 가치 수호**: 데이터 주권, 사유의 흐름, 위키 연결성, 하니스 개선 원칙을 지킨다.