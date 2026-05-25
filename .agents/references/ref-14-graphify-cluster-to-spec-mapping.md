---
id: ref-14
topic: graphify-cluster-to-spec-mapping
created: 2026-05-20
tags: [architecture, spec, graphify, code-clusters, domain-modeling]
---

# graphify 코드 클러스터 → SPEC 도메인 매핑

> 2026-05-20 사용자와 함께 도출. graphify가 자동 발견한 코드 응집 클러스터를 사용자가 보는 *기능 도메인* 단위(SPEC)로 매핑한 근거.

## 1. 출처 — graphify 추출 (2026-05-19 갱신)

- 노드: 914 (이전 5/6 추출본 644 → +270)
- 엣지: 1,256
- 커뮤니티: 94 (Louvain)
- 토큰 절감: 평균 **27.9×** (질문에 따라 11.5×~51.3×)

## 2. Top 14 커뮤니티 (graphify 사실)

| Cluster | 크기 | 핵심 노드 | 주요 파일 |
|---|---|---|---|
| **C0** | 49 | PLAN, PROGRESS, Phase 10 Reflection System 등 | PLAN.md, PROGRESS.md, miki-editor/index.html |
| **C1** | 48 | App.jsx, Editor.jsx, AppContent | stores/index.js, old_Editor.jsx, utils/errorHandler.js |
| **C2** | 48 | App.jsx, AuthProvider, useAuth, AppContent | services/auth.js, App.jsx, services/curationScheduler.js |
| **C3** | 45 | storage-client, WsGitHubProxy | utils/storage-client.js, utils/slugify.js, utils/markdown.js |
| **C4** | 43 | wikiStore, interventionStore, reflectionStore | services/reflectionEngine.js, wiki/tripleParser.js, services/interventionResolver.js |
| **C5** | 42 | curationStore, RawMemoCache, ByokClient | services/byokClient.js, utils/database.js, services/wikiCompiler.js |
| **C6** | 37 | MikiEditor, AiSuggestionPopover | sync/conflict.js, MikiEditor.jsx, components/IsolatedPreview.example.jsx |
| **C7** | 36 | AttachmentModal, github.js, SessionExpiredError | services/github.js, components/editor/AttachmentModal.jsx, __tests__/utils/storage-client.test.js |
| **C8** | 32 | PendingSync, .enqueue/.getPending/.markDone | sync/PendingSyncProcessor.js, utils/database.js |
| **C9** | 27 | extract.js, bridge-server, runDaemon | open-notes-extractor/{apple,samsung,daemon}/ |
| **C10** | 26 | useVaultStore, MikiDatabase, VaultKeyStore | utils/database.js, index.jsx, stores/useVaultStore.js |
| **C11** | 23 | SyncManager | sync/index.js |
| **C12** | 23 | WebSocketAdapter | sync/wsAdapter.js |
| **C13** | 21 | callback.js, ws-handler.js, broadcastToLogin | ws-proxy/src/ws-handler.js, miki-editor/api/auth/callback.js |

### God Nodes (degree 상위)

```
GitHubService           37   ← 모든 동기화·publish·jsonl I/O 의존
createLogger()          33   ← 전 모듈 호출
Phase 10 Reflection System  26    ← 신규 개념 허브
WebSocketAdapter        22
AuthService             21
SyncManager             20
```

## 3. 도메인 분할 방식 — 3가지 후보 비교

| 방식 | 단위 | 개수 | 트레이드오프 |
|---|---|---|---|
| X. 코드 응집도 그대로 | 클러스터 1:1 | 14 | 정직하지만 작고 많음 |
| **Y. 데이터 흐름** ✅ | 입력→처리→출력 | 12 | 인수조건이 입력→출력으로 표현. swarm 위임 시 한 SPEC=한 task 명확 |
| Z. 사용자 행위 단위 | 한 의식 행동 | 5 | 너무 굵음. swarm 단위 안 됨 |

**채택**: 방식 Y. 사용자 결정.

## 4. 12개 SPEC 매핑 (확정)

### Phase 1~9 영역 (6개)

| SPEC | 출처 클러스터 | 데이터 흐름 |
|---|---|---|
| `SPEC_xss_security` | Phase 1 (모듈 흩어짐) | 외부 마크다운 → DOMPurify → iframe sandbox 렌더 |
| `SPEC_auth_session` | C2 + C13 | OAuth PKCE → 토큰 → WS 세션 → 인증 게이트 |
| `SPEC_persist` | C3 + C7 | 메모/문서 → IndexedDB 캐시 → GitHub I/O (publish 제외) |
| `SPEC_sync_offline` | C8 + C11 + C12 | 로컬 변경 → 큐 → 배치 동기화 → 크로스 기기 브로드캐스트 |
| `SPEC_vault_e2ee` | C10 | 평문 → AES-GCM → IndexedDB/GitHub |
| `SPEC_publish` | C3 일부 | 선택 문서 → frontmatter → Jekyll 빌드 → GitHub Pages |

### Phase 10+ 영역 (6개)

| SPEC | 출처 클러스터 | 데이터 흐름 |
|---|---|---|
| `SPEC_notes_import` | C9 | Apple/Samsung Notes → 추출 → /import-bridge |
| `SPEC_curation` | C5 부분 + Phase 8 통합 | raw 메모 → selected/excluded 결정 |
| `SPEC_byok_compile` | C5 부분 | selected → BYOK API → 트리플 추출 |
| `SPEC_wiki_render` | C4 부분 | 트리플 → 마크다운 페이지 + 직접 편집 |
| `SPEC_reflection` | C4 부분 | 트리플 → Reflection 카드 → 사용자 결정 |
| `SPEC_intervention` | C4 부분 | 사용자 결정 → interventions.jsonl → 시스템 프롬프트 |

## 5. 사용자 결정 — 분할 vs 통합

직전 토론에서 3가지 모호점을 사용자가 결정 (2026-05-20):

| # | 결정 사항 | 사용자 선택 | 근거 |
|---|---|---|---|
| A | persist + sync_offline | **분리** | persist는 저장 정책(어디에 무엇), sync는 흐름 정책(언제 어떻게) |
| B | xss_security + vault_e2ee | **분리** | XSS는 입력층, vault는 저장층. 인수조건 종류가 완전히 다름 |
| C | Phase 8 phantom fix | **통합** (`SPEC_curation` 안의 인수조건) | "빈 메모는 큐에 들어가지 않는다" 정도의 인수조건 |

## 6. 비 1:1 매핑 — 한 클러스터가 여러 SPEC

graphify 클러스터와 SPEC은 1:1이 아님. 특히:

- **C4 (43노드) → 3개 SPEC 분할**:
  - `SPEC_wiki_render` (tripleParser, markdownDiffer, wikiStore, WikiPage, WikiIndex)
  - `SPEC_reflection` (reflectionStore, reflectionEngine, Reflection page, ReflectionCard 등)
  - `SPEC_intervention` (interventionStore, interventionResolver)
- **C5 (42노드) → 2개 SPEC 분할**:
  - `SPEC_curation` (curationStore, RawMemoCache, curationPipeline, curationScheduler)
  - `SPEC_byok_compile` (byokClient, wikiCompiler, secureStorage)

이유: 코드는 같은 store 패턴/같은 디렉토리로 응집되지만 사용자가 보는 *능력 단위*는 분리되어야 인수조건 설계가 명확.

- **C3 (45노드) → 2개 SPEC 분할**:
  - `SPEC_persist` (storage-client, github.js, AttachmentModal 등)
  - `SPEC_publish` (publish.js, metadata.js, slugify.js)

publish는 별도. 사용자 명시 결정.

## 7. graphify 사용 패턴 (검증 결과)

SPEC 작성 시 graphify 활용:

| 명령 | 효과 |
|---|---|
| `graphify query "<SPEC 도메인 키워드>"` | 관련 코드만 추출 (평균 2,186 토큰. 코퍼스 전체 60,933 토큰 대비 1/28) |
| `graphify path "A" "B"` | 두 개념 간 최단 경로 — 의존성 추적 |
| `graphify explain "<노드명>"` | 한 노드 평어 설명 |
| `graphify --update` | 새 파일 반영 (코드만이면 LLM 무료, 문서 포함 시 semantic 추출) |

각 SPEC §6 (참조) 절에 도메인 키워드 명시하면 에이전트가 자동 조회 가능.

## 8. 검증되지 않은 부분 (자의 채움 가능성)

자의 채움 방지 (ref-13 §7 검증 질문 적용):

- 12개 SPEC의 각 §1~§5 인수조건은 **아직 [TBD]** — 사용자와 함께 작성해야 함
- "어느 클러스터가 어느 SPEC에 속하는지"의 매핑은 사용자 결정 (A/B/C 분기 받음)
- "방식 Y" 자체는 graphify 사실(코드 응집) + 사용자 행위 단위 결합. 다른 방식(X/Z) 가능했음

미래 클러스터 변경 시:
- `graphify --update` 후 클러스터 재계산
- 클러스터 분할/통합이 일어나면 본 매핑표 재검토 필요
- 단, SPEC 도메인 자체가 *데이터 흐름*에 기반하므로 코드 구조 변경에 비교적 강건

## 9. 관련 파일

- `.claude/docs/SPEC_*.md` × 12 (이 매핑이 가리키는 SPEC 골격)
- `graphify-out/graph.json` (914 노드 — 2026-05-19 갱신)
- `graphify-out/GRAPH_REPORT.md` (커뮤니티별 노드 목록, 응집도)
- ref-13-plan-vs-spec-hierarchy.md (위계 메타 규칙)
