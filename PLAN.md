# PLAN.md — Meki 개발 계획 (에이전트 공유)

> 이 파일은 **전체 개발 계획**입니다. 스웜 에이전트는 세션 시작 시 이 파일과 `PROGRESS.md`를 반드시 먼저 읽으세요.
> **수정 권한**: Antigravity(오케스트레이터)만 수정. 실행 에이전트는 읽기 전용.

---

## 프로젝트 목표

Meki = 사람이 자기 관점을 발견하고, 실행하고, 전파하고, 공동체 안에서 진화시키는 인프라

> **"오늘의 질문, 어제의 메모가 답합니다."**

- **1단계: 기반 공사** (Phase 1~9) — 끊기지 않는 작성, 오프라인, 크로스 디바이스 동기화 ✅ 완료/진행중
- **2단계: 노트 통합 + 온톨로지 구축** (Phase 10~11) — 기존 노트앱(Apple Notes, Notion, Obsidian) 데이터를 통합하고, BYOK API로 AI가 추출한 관계를 사용자가 승인/거절/수정하면서 자기 관점을 명시화. Prior(사전 믿음)/Harness(행동 규칙) 분리 설계. **diff(나 vs 과거의 나)가 핵심 가치.**
- **3단계: 네트워크화** (Phase 12) — Prior를 공유·fork·기여 추적 가능한 사회적 구조로 전환. Confidence Aggregation으로 집단 학습

> **전략 전환 이력**:
> - (2026-03-16) 위키링크 수동 구축 → OpenClaw 기반 AI 자동 온톨로지로 전환
> - (2026-04-30) Docker/OpenClaw 로컬 실행 → 웹앱 유지 + BYOK API + 노트앱 연동으로 재전환
>   근거: 30초 온보딩 필수(Docker 99% 이탈), 타겟=개인(팀툴 제거), Reflect 성장 모델 참조
> - (2026-05-07) Notion 중심 온보딩 우선주의 폐기 → Apple Notes / Samsung Notes = 비협상 1순위 복귀
>   근거: "사용자가 이미 익숙한 인터랙션을 바꾸도록 강요하지 않는다" — 기술 장벽보다 습관 보존이 우선
>   상세: `.agents/references/ref-012-phase10-pivot-decision-log.md`
> Prior/Harness 분리 · 바이럴 전략: `.agents/references/ref-009-meki-viral-prior-fork-community.md`
> 철학적 기반: `memory/project_meki_philosophy.md`

---

## Phase 1: Security Foundation ✅ 완료

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P1-T1 | `api_dev` | `vercel.json` CSP headers 추가 | ✅ 완료 |
| P1-T2 | `api_dev` | `src/utils/sanitize.js` 생성 (DOMPurify) | ✅ 완료 |
| P1-T3 | `frontend_dev` | 마크다운 렌더러에 sanitize.js 적용 | ✅ 완료 |
| P1-T4 | `frontend_dev` | `src/components/IsolatedPreview.jsx` 생성 | ✅ 완료 |
| P1-T5 | `api_dev` | `api/auth/callback.js` PKCE + State 적용 | ✅ 완료 |
| P1-T6 | `test_verify` | Phase 1 전체 검증 | ✅ 완료 |

**Phase 1 완료 기준**: ✅ XSS 인젝션 차단, ✅ iframe sandbox 동작, ✅ PKCE 적용, ✅ 빌드 성공

---

## Phase 2: WS Proxy Server ← 현재 단계 (ws-proxy/ 디렉토리)

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P2-T1 | `api_dev` | 프로젝트 루트에 `ws-proxy/` 디렉토리 생성 + Node.js 초기화 (package.json, src/index.js) | ✅ 완료 |
| P2-T2 | `api_dev` | `ws-proxy/src/server.js` — Express HTTP 서버 + JWT 세션 + /health 엔드포인트 | ✅ 완료 |
| P2-T3 | `api_dev` | `ws-proxy/src/ws-handler.js` — WebSocket 핸들러 + GitHub API relay | ✅ 완료 |
| P2-T4 | `api_dev` | `ws-proxy/Dockerfile` + `ws-proxy/fly.toml` (Node.js 20 Alpine, 포트 8080) | ✅ 완료 |
| P2-T5 | `test_verify` | ws-proxy/ 전체 구조 검증, HTTP 엔드포인트, WS 핸들러 정합성 확인 | ✅ 완료 |

**Phase 2 완료 기준**: Fly.io 배포, WS 메시지 릴레이 성공

---

## Phase 3: Frontend Migration (Feature Flag)

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P3-T1 | `api_dev` | `VITE_USE_WS_PROXY` env + `ws-client.js` | ✅ 완료 |
| P3-T2 | `api_dev` | `github.js` Feature Flag 브랜치 | ✅ 완료 |
| P3-T3 | `api_dev` | `auth.js` WS 연결 상태 기반 교체 | ✅ 완료 |
| P3-T4 | `frontend_dev` | `MigrationNotice.jsx` 재로그인 배너 | ✅ 완료 |
| P3-T5 | `test_verify` | Flag OFF/ON 동작 검증 + 서버/앱 실제 구동(vite dev) 후 WS 연결 상태 확인 (런타임 테스트 필수) | ✅ 완료 |

---

## Phase 4: Security Debt (UP-1) + Auto-Save + Offline

> UP-1은 Auto-Save보다 먼저 완료 필요 — `storage-client.js:19`가 `AuthService.getToken()` 사용

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P4-T0a | `api_dev` | `auth.js` 듀얼모드 리팩토링 (WS 모드: getToken→null) + 8개 소비자 파일 대응 (`App.jsx`, `usePublish.js`, `useAttachment.js`, `storage-client.js`, `OnboardingSetup.jsx`, `verify-setup.js`, `functional-test.js`) | ✅ 완료 |
| P4-T0b | `api_dev` | `CallbackPage.jsx` WS모드 세션 전환 (POST /api/session → HttpOnly 쿠키, localStorage 저장 안 함) + `ws-client.js` sessionId 기반 전환 | ✅ 완료 |
| P4-T0c | `frontend_dev` | `MigrationNotice.jsx` 로직 정리 — hasLegacyToken을 `AuthService.hasLegacyToken()` 위임 | ✅ 완료 |
| P4-T0d | `test_verify` | UP-1 검증: `security-state-check.sh` Section 8 E2E PASS + PROGRESS.md UP-1 → ✅ | ✅ 완료 |
| P4-T1 | `api_dev` | IndexedDB `pendingSync` 테이블 확장 | ✅ 완료 |
| P4-T2 | `api_dev` | SyncQueue 해시 변경 감지 + 배치 동기화 | ✅ 완료 |
| P4-T3 | `api_dev` | `visibilitychange`/`beforeunload` 핸들러 | ✅ 완료 |
| P4-T4 | `frontend_dev` | `SyncStatus.jsx` UI 컴포넌트 | ✅ 완료 |
| P4-T5 | `test_verify` | 오프라인 편집→재연결→동기화 검증 | ✅ 완료 |

---

## Phase 5: Vault Seed E2EE (장기 목표)

_Phase 2~4 안정화 후 착수_

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P5-T1 | `api_dev` | `vault.js` AES-GCM 암복호화 | ✅ 완료 |
| P5-T2 | `frontend_dev` | `VaultSetup.jsx` 강제 백업 UI | ✅ 완료 |
| P5-T3 | `api_dev` | storage-client 파이프라인 암호화 | ✅ 완료 |
| P5-T4 | `test_verify` | 암복호화 라운드트립, 발행 흐름 검증 | ✅ 완료 |

---

---

## Phase 7: 문서 로딩 성능 최적화 ✅ 완료

> 병목 분석 결과 (2026-03-12): `getPost()` 내부 `getPostList()` 재호출이 매 문서 클릭마다 500ms GitHub GraphQL 낭비. IndexedDB-first 전략 + 인메모리 캐시 + hover prefetch로 체감 로딩을 ~750ms → <100ms로 단축.

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P7-T1 | `api_dev` | `storage-client.js` `getPost()` 리팩토링 — IndexedDB-first 파일명 조회 + 인메모리 포스트 캐시(TTL 30s) + `prefetchPost()` 퍼블릭 메서드 추가 | ✅ 완료 |
| P7-T2 | `frontend_dev` | `Editor.jsx` 문서 목록 hover prefetch — 마우스오버 시 `storage.prefetchPost(id)` 호출로 클릭 전 콘텐츠 프리로드 | ✅ 완료 |
| P7-T3 | `test_verify` | 빌드 검증 + 문서 로딩 플로우 코드 리뷰 (P7-T1/T2 의존) | ✅ 완료 |

**Phase 7 완료 기준**: 빌드 성공, 문서 클릭 시 `getPostList()` 네트워크 호출 0회 (IndexedDB 캐시 hit 확인), hover 시 prefetch 동작

---

## Phase 8: UX 버그픽스 — 빈 메모 Phantom 정리

> 2026-03-14: 빈 새글 상태에서 에디터 외부(검색창·정렬 드롭다운 등)를 클릭할 때
> `loadPost()`가 호출되지 않아 phantom 항목이 사이드바에 잔류하던 문제 수정.

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P8-T1 | `frontend_dev` | `Editor.jsx` `handleEditorBlur` 추가 — `useStore.getState()` + `contentRef`로 클로저 문제 해결, 150ms 후 phantom 제거. `AppLayout.jsx` / `EditorPanel.jsx` `onEditorBlur` prop 연결 | ✅ 완료 |

**완료 기준**: 빈 새글 + 검색창 클릭 시 150ms 후 사이드바 phantom 자동 제거, 내용 입력 후 blur 시 자동저장 흐름 유지, 빌드 성공

---

## Phase 9: 크로스 기기 실시간 동기화 완성

> 2026-03-12: Device A에서 저장 시 ws-proxy를 통해 Device B로 메타데이터 브로드캐스트. Device B는 즉시 캐시를 무효화하여 새로고침 없이 변경사항 반영.

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P9-T1 | `frontend_dev` | `Editor.jsx` — `sync:changed` WebSocket 리스너 추가 및 React Query 캐시 직접 패치(optimistic/committed/failed/delete 4케이스) + `storage-client.js` sync.notify 브로드캐스트 | ✅ 완료 |
| P9-T2 | `test_verify` | 크로스 기기 동기화 시나리오 검증: Device A 저장 → Device B 실시간 반영 확인 | ✅ 완료 |

**Phase 9 완료 기준**: Device A 저장 후 <1초 내 Device B의 문서 목록 및 현재 열린 문서(필요 시) 자동 갱신 확인, 빌드 성공

---

## Phase 10: Reflection 시스템 — "익숙한 습관 위의 위키 + 개입 학습" ✅ 완료

> **상세 설계**: `.agents/references/ref-12-reflection-system-design.md` (Phase 10 Source of Truth)
> **데이터 파이프라인**: ref-09 (Phase 10 SoT)

### 핵심 흐름

```
Apple/Samsung Notes (원본 불변)
   → MekiSync (Local App Bridge / 데몬)
   → miki-data/raw/ (메모 사본)
   → BYOK 컴파일 (interventions.jsonl 불변 제약)
   → miki-data/graph.jsonl (Prior, Single Source of Truth)
   → 위키 렌더링 + Reflection 발행
   → 사용자 개입 → interventions.jsonl + graph.jsonl 갱신
```

### 핵심 설계 원칙

1. **습관의 보존**: 사용자는 Apple/Samsung Notes를 그대로 사용. Meki는 그 아래에서 조용히 연결.
2. **그래프가 진실원, 위키는 렌더링**: `graph.jsonl`이 Single Source of Truth. `/wiki/` 디렉토리는 존재하지 않고, 프론트엔드가 graph.jsonl을 마크다운 위키 페이지로 동적 렌더링. 사용자 편집은 마크다운 diff → 트리플 변경으로 역파싱.
3. **Intervention은 불변 제약**: `interventions.jsonl`이 단순 로그가 아니라 AI 컴파일 시 시스템 프롬프트로 주입되는 절대 룰. AI는 사용자가 한 번 확정한 결정을 재제안할 수 없다.
4. **두 축 분리 — 증거 vs Prior 관계**: 증거 강도(Grounded/Bridged)는 UI 메타데이터, Prior 관계(Consistent/Extending/Tension)는 발행 게이트. MVP는 Extending만 발행, Tension은 Phase 11.
5. **Anti-Bubble 투명성**: Reflection 푸터 "왜 이걸 보여드리나요?", Counterfactual 가시화("오늘 발행 안 된 후보"), 위키 직접 편집 가능 — 모두 MVP 필수.
6. **단일 목적함수 부재**: Meki는 watch time 같은 KPI 최적화 안 함. 알고리즘은 명시적이고 사용자 통제 하에.
7. **사용자 수정 = 가장 강력한 학습 신호** (ref-12 §3.3·§5.1·§5.4): 위키 직접 편집·Reflection edit·reject는 모두 `interventions.jsonl`에 기록되어 다음 컴파일의 시스템 프롬프트로 주입된다. 이게 AI가 사용자 의미 모델을 학습하는 유일한 채널이고, "AI가 잘못 알아들으면 사용자가 고친다"의 구조적 보장. **`edit` 액션이 누락되면 시스템 전체가 자기 강화 편향에 빠진다.**
8. **Pull/Push 양립** (ref-12 §0.4): Reflection은 push, 위키 직접 조회·편집은 pull. Push 채널이 막혀도 사용자는 자기 Prior에 접근 가능해야 한다.

### 기술 스펙 및 태스크

> 액션 ID는 ref-12 §7과 동기화. (확장) = 기존 파일 수정, (신규) = 신규 파일.

#### 10-A: 인프라

| ID | 담당 Role | 작업 내용 | 종류 | 상태 |
|---|---|---|---|---|
| P10-A1 | `api_dev` | miki-data repo 구조 확장: `raw/`, `graph.jsonl`, `interventions.jsonl`, `reflections/queue.jsonl`, `reflections/archive.jsonl` (`services/github.js` 확장) | 확장 | ⬜ |
| P10-A2 | `api_dev` | IndexedDB 스키마 v6 — graphCache / interventionsCache / reflectionsQueue 테이블 (`utils/database.js`) | 확장 | ⬜ |
| P10-A3 | `api_dev` | SyncManager에 graph/interventions/queue 동기화 추가 (`sync/index.js`) | 확장 | ⬜ |

#### 10-B: BYOK 컴파일 파이프라인

| ID | 담당 Role | 작업 내용 | 종류 | 상태 |
|---|---|---|---|---|
| P10-B1 | `api_dev` | BYOK 클라이언트 추상화 — Gemini/Claude/OpenAI 통합 (`services/byokClient.js`) | 신규 | ⬜ |
| P10-B2 | `api_dev` | `wikiCompiler` — 콜드 배치 컴파일 + 이벤트 기반 증분 컴파일 (`services/wikiCompiler.js`) | 신규 | ⬜ |
| P10-B3 | `api_dev` | `interventionResolver` — interventions.jsonl 시스템 프롬프트 RAG 빌더 (토큰 비용 통제) (`services/interventionResolver.js`) | 신규 | ⬜ |
| P10-B4 | `api_dev` | `reflectionEngine` — graph 변화 감지 → queue.jsonl 생성. Consistent/Extending 분류. (`services/reflectionEngine.js`) | 신규 | ⬜ |

#### 10-C: 위키 렌더링/역파싱

| ID | 담당 Role | 작업 내용 | 종류 | 상태 |
|---|---|---|---|---|
| P10-C1 | `frontend_dev` | `tripleParser` — graph.jsonl → 엔티티/개념/태도 페이지 마크다운 (`wiki/tripleParser.js`) | 신규 | ⬜ |
| P10-C2 | `frontend_dev` | `markdownDiffer` — 사용자 편집 마크다운 → 트리플 변경 (`wiki/markdownDiffer.js`) | 신규 | ⬜ |
| P10-C3 | `frontend_dev` | `WikiPage` 컴포넌트 — 엔티티/개념/태도 페이지 뷰 + 편집 (Toast UI Editor 재사용) (`wiki/components/WikiPage.jsx`) | 신규 | ⬜ |

#### 10-D: Reflection UI

| ID | 담당 Role | 작업 내용 | 종류 | 상태 |
|---|---|---|---|---|
| P10-D1 | `frontend_dev` | DailyReflection 페이지 — 모바일 스와이프 + 데스크탑 카드 그리드 (`pages/Reflection.jsx`) | 신규 | ⬜ |
| P10-D2 | `frontend_dev` | `ReflectionCard` — rationale 푸터("왜 이걸 보여드리나요?") 포함 (`components/ReflectionCard.jsx`) | 신규 | ⬜ |
| P10-D3 | `frontend_dev` | `IdentityReflectionCard` — modeling_options 선택형 (merge_full / merge_with_register / split_full) (`components/IdentityReflectionCard.jsx`) | 신규 | ⬜ |
| P10-D4 | `frontend_dev` | `CounterfactualView` — "오늘 발행 안 된 후보" 열람 UI (Anti-bubble 필수) (`components/CounterfactualView.jsx`) | 신규 | ⬜ |

#### 10-E: Zustand 스토어 (책임 분리)

| ID | 담당 Role | 작업 내용 | 종류 | 상태 |
|---|---|---|---|---|
| P10-E1 | `frontend_dev` | `wikiStore` — graph.jsonl 인메모리 인덱스 + 엔티티 조회 (`stores/wikiStore.js`) | 신규 | ⬜ |
| P10-E2 | `frontend_dev` | `reflectionStore` — 오늘의 Reflection + queue 관리 (`stores/reflectionStore.js`) | 신규 | ⬜ |
| P10-E3 | `frontend_dev` | `interventionStore` — append 처리 + 시스템 프롬프트 빌더 호출 (`stores/interventionStore.js`) | 신규 | ⬜ |

#### 10-F: MekiSync 외부 프로젝트 (별도 repo `open-notes-extractor`)

| ID | 담당 Role | 작업 내용 | 종류 | 상태 |
|---|---|---|---|---|
| P10-F1 | `api_dev` | **Apple Notes Local App Bridge**: `Meki_Notes_Sync.app` (Script Editor JXA + localhost 임시 서버). 실행 → 추출 → `app.meki.com/import-bridge`로 전송 → 자동 종료. Gatekeeper 회피: 초기 미서명(우클릭→열기 가이드), 바이럴 후 Apple Developer $99 코드서명. | 신규 (별도 repo) | ⬜ |
| P10-F2 | `api_dev` | **Samsung Notes Local App Bridge**: Windows `.exe` (PowerShell 번들). `twangodev/sdocx` 파서로 `.sdocx` → 텍스트 → localhost 브릿지. 법적 보호: `open-notes-extractor` MIT 오픈소스로 분리. | 신규 (별도 repo) | ⬜ |
| P10-F3 | `api_dev` | 상시 가동 데몬 버전 — Mac 메뉴바 / Windows 트레이. 신규 메모 자동 동기화. Phase 10 후반에 진행. | 신규 (별도 repo) | ⬜ |

### 의존성 그래프

```
P10-A1 (repo 구조) → P10-A2, P10-A3 → P10-B1~B4 → P10-C1~C2 → P10-D1~D4
                                                       ↓
                                                    P10-E1~E3
P10-F1, F2는 독립 진행 가능 (별도 repo, 본 코드 침습 없음)
```

### Phase 10 완료 기준

1. Apple Notes Local App Bridge로 메모 100건+ 임포트 성공
2. BYOK 콜드 배치 컴파일로 graph.jsonl 생성
3. 사용자가 위키 페이지를 마크다운으로 열어보고 직접 편집 가능
4. Daily Reflection이 발행되고 모바일 스와이프 UI로 응답 가능
5. `intervention` 항목이 interventions.jsonl에 append되고 다음 컴파일 시 시스템 프롬프트로 주입됨
6. Counterfactual View로 "발행 안 된 후보" 열람 가능
7. 빌드 성공 + 기존 블로그 포스트 흐름 무손상 (회귀 테스트)

---

## Phase 10.5: 큐레이션 세션 — 의식적 회고로서의 위키 갱신 ← 현재 단계

> Phase 10은 "메모 저장 = 즉시 자동 컴파일" 흐름을 만들었다. 이는 사용자에게 *어떤 메모를 위키화할지 결정할 권한*을 빼앗는다.
> Phase 10.5는 흐름을 **수집(자동) → 큐레이션(의식적) → 컴파일(선택된 것만)** 3단계로 분리한다.
>
> **시의성의 재정의**: "메모 저장 시각"이 아니라 **"매일 저녁의 회고 의식"** 이 시의성의 의미.
> **프라이버시 기본값**: raw 메모는 모두 `pending_review`. 사용자가 명시적으로 선택한 것만 graph.jsonl에 들어간다.
>
> 일기(raw/notes/, 비공개) vs 위키(graph.jsonl, 외부화된 자기 이해) — 두 층을 명확히 분리.

| 태스크 ID | 담당 Role | 작업 내용 | 종류 | 상태 |
|---|---|---|---|---|
| P10.5-T1 | `api_dev` | raw 메모 큐레이션 상태 데이터 모델 — frontmatter에 `curation_status`(`pending_review`/`selected`/`excluded`) 추가. IndexedDB v6 `rawMemosCache` 테이블 신규. | 신규 | ⬜ |
| P10.5-T2 | `api_dev` | `services/curationPipeline.js` 신규 — 확정 트리거: 선택된 메모만 `compileMemo()` 일괄 호출 → graph.jsonl append → `detectConnections()` → reflection queue push. | 신규 | ⬜ |
| P10.5-T3 | `api_dev` | `stores/curationStore.js` 신규 — pending 메모 목록, 선택 상태(Map), 확정 액션. | 신규 | ⬜ |
| P10.5-T4 | `frontend_dev` | `pages/Curation.jsx` + `components/MemoCard.jsx` 신규 — 메모 카드 그리드, 토글 선택, "선택한 N개 확정" 버튼. | 신규 | ⬜ |
| P10.5-T5 | `frontend_dev` | Editor 헤더에 "오늘의 큐레이션" 진입 버튼 + 미검토 메모 개수 배지. `/curation` 라우트 등록. | 확장 | ⬜ |
| P10.5-T6 | `api_dev` | `services/curationScheduler.js` 신규 — 사용자 지정 시간(기본 21시)에 브라우저 Notification API로 리마인더. 설정은 localStorage. | 신규 | ⬜ |
| P10.5-T7 | `api_dev` | 기존 자동 컴파일 흐름 정리 — `wikiCompiler.compileAndAppend()`의 직접 호출처가 생기지 않도록 명시적으로 큐레이션 파이프라인 경유 강제. 주석/문서 갱신. | 정리 | ⬜ |

### Phase 10.5 의존성

```
T1 (데이터 모델) → T2 (파이프라인), T3 (스토어)
                     → T4 (큐레이션 페이지) → T5 (진입 버튼/라우트)
                     → T6 (스케줄러)
T7 (자동 흐름 정리)는 병행 가능
```

### Phase 10.5 완료 기준

1. 메모 작성/임포트 시 graph.jsonl에 *자동으로 들어가지 않음* (모든 신규 메모는 `pending_review`)
2. `/curation` 페이지에서 오늘의 메모를 보고 개별 토글 선택 가능
3. "확정" 클릭 시 선택된 메모만 BYOK 컴파일되어 graph.jsonl에 append
4. 미선택 메모는 raw/notes/에 남되 `curation_status: excluded`로 표시되어 위키에 영향 없음
5. 사용자 지정 시간에 브라우저 알림이 와서 큐레이션 세션 진입 유도
6. 큐레이션 후 새 트리플이 과거와 이어지면 Reflection 카드 생성 (Phase 10 D 그룹 재사용)

### Phase 10 → 10.5 의미적 차이 요약

| 항목 | Phase 10 (현재) | Phase 10.5 (목표) |
|---|---|---|
| 메모 저장 → 위키 추가 | 자동 즉시 | 사용자 선택 후 |
| 트리거 | `메모 저장` 이벤트 | `큐레이션 확정` 이벤트 |
| 프라이버시 기본값 | 공개 (제외 메커니즘 없음) | 비공개, 선택 시 공개 |
| 시의성의 의미 | 즉각성 | 의식적 회고 시간 |

---

## Phase 10.6: PWA 전환 — 폰 1차 UI 완성

> Phase 10.5의 약속(21시 알림, 폰에서 스와이프 큐레이션/Reflection)이 실제로 폰에서 작동하려면 PWA 인프라가 필수. 또한 미래 Capacitor 네이티브 앱 전환을 쉽게 하기 위해 알림/저장 API를 wrapper로 분리.

| 태스크 ID | 담당 Role | 작업 내용 | 종류 | 상태 |
|---|---|---|---|---|
| P10.6-T1 | `frontend_dev` | Tailwind CDN 제거 + `tailwind.config.js`에 safe-area 유틸리티(`safe-top`/`safe-bottom`) 정식 등록. PostCSS 빌드만 사용. | 정리 | ⬜ |
| P10.6-T2 | `frontend_dev` | `index.html` viewport에 `viewport-fit=cover` + `maximum-scale=1` 추가. iOS 메타 태그 추가(`apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`). | 신규 | ⬜ |
| P10.6-T3 | `frontend_dev` | `public/manifest.json` Meki 브랜딩 재작성 (name, short_name 한글, 192/512 아이콘, theme_color, background_color). | 신규 | ⬜ |
| P10.6-T4 | `api_dev` | `vite-plugin-pwa` 도입 + 최소 Service Worker 설정. precache 보수적, 비즈 로직 SW에 두지 않음(Capacitor 전환 용이성). Web Push 권한 요청 통합. | 신규 | ⬜ |
| P10.6-T5 | `api_dev` | **(Capacitor 대비)** `services/notify.js` wrapper — `Notification API` 추상화. `curationScheduler.js`가 이 wrapper만 사용하도록 수정. | 신규 | ⬜ |
| P10.6-T6 | `api_dev` | **(Capacitor 대비)** `services/secureStorage.js` wrapper — `localStorage` 추상화. `byokClient.js` API 키 저장/로드 이 wrapper 경유. | 신규 | ⬜ |
| P10.6-T7 | `test_verify` | 실기기 테스트 체크리스트 작성 (iOS Safari / Android Chrome): 홈화면 설치, 21시 알림 수신, 스와이프 제스처, safe-area, 오프라인. | 검증 | ⬜ |

### Phase 10.6 의존성

```
T1 (Tailwind 정리) → T2 (HTML meta), T3 (manifest)
T4 (Service Worker) ← T5와 독립
T5 (notify wrapper), T6 (secureStorage wrapper) — 병행 가능, 마이그레이션 무손실
T7 (실기기 검증) ← 모든 작업 완료 후
```

### Phase 10.6 완료 기준

1. `npm run build` 후 dist/에 `manifest.webmanifest` + `sw.js` 생성됨
2. iOS Safari에서 "공유 → 홈 화면에 추가" 시 "Meki" 아이콘이 깔끔하게 표시됨
3. Android Chrome "홈 화면에 추가" 동일 동작
4. 홈 화면 아이콘 탭 → 풀스크린 standalone 모드 진입
5. 21시 알림이 PWA 설치 상태에서 실제로 도달 (iOS 16.4+ 가정)
6. notch 영역(iPhone)에 sticky 헤더가 가려지지 않음
7. `services/notify.js`와 `services/secureStorage.js`가 외부에 노출되어 Capacitor 마이그레이션 시 두 파일만 교체하면 됨

---

## Phase 10.7: Reflection 학습 루프 완성 — ref-12 격차 보강 ← 현재 단계

> Phase 10/10.5/10.6 코드 검증 (2026-05-13) 중 **ref-12 §3.3·§5.1·§5.4의 학습 루프가 PLAN과 코드 양쪽에서 누락**된 것이 발견됐다. 위키 직접 편집·Reflection edit이 `interventions.jsonl`에 기록되지 않아 AI가 사용자 의미 모델을 학습하지 못하는 상태.
>
> "AI가 잘못 알아들으면 어떻게 합니까?"라는 사용자 우려가 이 누락의 정확한 진단. ref-12는 이 답을 `edit` intervention + 시스템 프롬프트 주입 + 사용자 프로파일 누적으로 명시했으나 PLAN.md에 옮겨지지 않았다.
>
> **롤백하지 않는 이유**: Phase 10 아키텍처(graph.jsonl SoT, 위키=렌더링, 큐레이션 파이프라인, 4분리 스토어)는 ref-12와 일치. 누락은 *기존 코드에 덧붙이는* 학습 루프 배선뿐이므로 추가형 보강이 적절.

| 태스크 ID | 담당 Role | 작업 내용 | 종류 | 상태 |
|---|---|---|---|---|
| P10.7-T1 | `frontend_dev` | WikiPage 저장 시 added→type:edit, removed→type:reject 각각 interventionStore.append. removed는 wikiStore.removeTriples도 호출. 44줄 변경. | 확장 | ✅ |
| P10.7-T2 | `frontend_dev` | reflectionStore.resolveCard rejected 분기 추가 (TYPE_MAP), user_note "재제안 영구 차단". 7줄 변경 (cherry-pick — 회귀 가드레일 false positive). | 확장 | ✅ |
| P10.7-T3 | `api_dev` | interventionResolver에 buildUserModelProfile + buildProfilePrompt 신규 export. resolveInterventionContext가 userProfile·profilePrompt·fullSystemPrompt 반환. 93줄 추가. | 확장 | ✅ |
| P10.7-T4 | `api_dev` | wikiCompiler에 autoProcessCandidates + buildAutoApprovedArchiveEntries 신규 export. 표면형 ≥0.95·evidence≥3+score≥0.9 자동, register_differs·시기차 1년+ needsReview. 87줄 추가. | 확장 | ✅ |
| P10.7-T5 | `api_dev` | reflectionEngine에 scheduleDripFeed + selectTodaysSlot 신규 export. periodDays=max(14,min(28,total/4)), 첫 1주 dailyLimit ≤3. 57줄 추가 (cherry-pick). | 확장 | ✅ |
| P10.7-T6 | `test_verify` | gpt-5.5 검증: T1~T5 학습 루프 항목 전체 ✅, 빌드 ✅, 회귀(시그니처 보존) ✅, shallow-boot ✅. 5개 선행 회귀(P10.7 무관) 발견 — UP-7로 기록. | 검증 | ✅ |

### Phase 10.7 의존성

```
T1 (위키 편집 → intervention) + T2 (Reflection → intervention) — 병행 가능 (UI 레이어)
T3 (프로파일 빌더) ← T1·T2 데이터 누적 후 의미. 단 코드는 병행 작성 가능
T4 (콜드 스타트 자동 규칙) — 독립
T5 (드립 피드) — 독립
T6 (검증) ← 모두 완료 후
```

### Phase 10.7 완료 기준

1. 사용자가 위키 페이지 편집 → `interventions.jsonl`에 `{type:'edit', ...}` append 확인
2. Reflection reject 시 `interventions.jsonl`에 `{type:'reject', scope:'entity:...'}` append → 다음 컴파일에서 시스템 프롬프트로 주입되어 동일 제안 재발생 안 함
3. `removed` 트리플이 graph.jsonl에서 실제 제거되고 wikiStore에 반영
4. interventions 누적 후 `interventionResolver.buildSystemPrompt`가 사용자 프로파일 통계를 포함
5. 콜드 임포트 100건 → 자동 처리된 항목(표면형 ≥0.95 merge 등)이 archive.jsonl에 "auto-approved" 기록
6. Daily Reflection이 드립 피드 스케줄대로 1일 3~5건 배포되고 첫 1주는 ≤3건

---

## Phase 11: Tension 감지 + 시공간 맥락 + Anti-Bubble 강화

> Phase 10이 Extending(위키 확장)만 다뤘다면, Phase 11은 **Tension(위키와의 충돌·드리프트)** 감지를 도입한다. 동시에 캘린더/시간 맥락을 결합해 `relationship_id` 자동 태깅과 관계별 교정 타임라인을 구축한다. Anti-bubble 메커니즘(자기 메타뷰, 알고리즘 통제권)도 이 단계에서 완성한다.

### 핵심 설계 원칙
1. **Tension의 하위 타입화**: "Prior와 충돌"을 단일 카테고리로 다루지 않음. 직접 모순 / 빈도 드리프트 / 신규 패턴 / 구조 재배열로 분리. 각 타입에 다른 임계값과 알고리즘 적용. 거짓 양성 제어.
2. **맥락 기반 추론**: 노트 내용 + 작성 시간 + 캘린더 일정 등 메타 맥락 조합으로 `relationship_id` 추론.
3. **관계별 타임라인**: 특정 주제/관계에 대한 사용자 관점(교정 패턴)의 시간 변화를 시계열 가시화.
4. **사용자 통제권 강화**: 자기 메타뷰(approve/reject 패턴), 알고리즘 환경설정(다양성·counterprogramming·망각 보완), Consistent 주기적 재노출.

### 기술 스펙 및 태스크
| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P11-T1 | `api_dev` | Tension 감지 엔진 — 4종 하위 타입 분류기(모순/드리프트/신규/재배열) + 거짓 양성 필터링. `services/reflectionEngine.js` 확장 | ⬜ |
| P11-T2 | `api_dev` | 시간축 임베딩 누적 분석 — Prior의 시간 변화 추적. graph.jsonl 스냅샷 + 빈도 추이 통계 검정 | ⬜ |
| P11-T3 | `api_dev` | 캘린더/맥락 통합 모듈 — 기기 로컬 캘린더 일정 + 타임스탬프를 노트 맥락과 결합 | ⬜ |
| P11-T4 | `api_dev` | `relationship_id` 자동 태깅 엔진 — 메타 맥락 기반 관계 ID 추론 및 부여 | ⬜ |
| P11-T5 | `frontend_dev` | 관계별 교정 타임라인 UI — 개입 이력 시계열 뷰어 | ⬜ |
| P11-T6 | `frontend_dev` | **자기 메타뷰 대시보드** — approve/reject 분포, 주제별 패턴, 관점 드리프트 가시화 (Anti-bubble) | ⬜ |
| P11-T7 | `frontend_dev` | **알고리즘 환경설정 UI** — 다양성 우선·counterprogramming·망각 보완·거짓 양성 감수 옵션 (Anti-bubble) | ⬜ |
| P11-T8 | `api_dev` | Consistent 주기적 재노출 — 6개월 후 재평가 큐 (자기 강화 편향 방어) | ⬜ |
| P11-T9 | `test_verify` | Tension 정확도 검증 — 거짓 양성률 측정, 사용자 응답 패턴 분석 | ⬜ |

---

## Phase 12: 자아 시뮬레이터 + Prior fork 커뮤니티

> Phase 10·11에서 축적된 `graph.jsonl` 시간 스냅샷과 `interventions.jsonl` 변천사가 자아 시뮬레이터의 학습 데이터다. "과거의 나라면?"을 묻고 답하는 AI 거울을 구축한다. 동시에 ref-07의 Prior fork 바이럴 전략으로 위키 일부 공개 옵션을 도입한다.

### 핵심 설계 원칙
1. **시간 스냅샷 학습**: graph.jsonl의 과거 시점 상태 = "과거의 나의 의미 모델". interventions.jsonl 변천사 = "내가 의미를 어떻게 다르게 자르게 되었는가".
2. **사고 시뮬레이션**: 새 질문/상황 → 축적된 의미 모델 + 결정 패턴을 컨텍스트로 → 사용자 관점 모방 답변.
3. **Prior fork 커뮤니티 (ref-07)**: 사용자가 자기 위키 페이지를 "공개"로 마크 → 다른 사용자가 fork 가능. Prior가 공유되는 사회적 구조로 진화.

### 기술 스펙 및 태스크
| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P12-T1 | `api_dev` | graph.jsonl 시간 스냅샷 인덱서 — 특정 시점의 Prior 상태 복원 가능하도록 | ⬜ |
| P12-T2 | `api_dev` | 개입 패턴 분석기 — interventions.jsonl에서 사용자 판단 기준 추출 | ⬜ |
| P12-T3 | `api_dev` | 시뮬레이션 프롬프트 엔진 — Prior 스냅샷 + 패턴을 컨텍스트로 주입한 프롬프트 체인 | ⬜ |
| P12-T4 | `frontend_dev` | 시뮬레이션 대화 UI — "과거의 내 관점" 에이전트와의 채팅 인터페이스 | ⬜ |
| P12-T5 | `api_dev` | Prior fork 인프라 — 위키 페이지 공개 마크 + Jekyll 발행 + fork 관계 추적 (ref-07) | ⬜ |
| P12-T6 | `frontend_dev` | Prior fork UI — 공개 옵션, fork 버튼, 커뮤니티 탐색 | ⬜ |
| P12-T7 | `test_verify` | 시뮬레이션 튜닝 — 사용자 관점과의 유사도 블라인드 테스트, 파라미터 조정 | ⬜ |

---

## 전체 진화 조감도

```
[1단계: 개인 도구 기반]            Phase 1~9   ✅ 완료
  보안 · 동기화 · 성능 · UX

[2단계: Reflection 시스템]         Phase 10    ✅ 완료
  Local App Bridge → raw/ → BYOK 컴파일 → graph.jsonl(Prior)
  → 위키 렌더링 + Reflection 발행 → 사용자 개입 → intervention.jsonl

[3단계: Tension + 맥락 + 통제권]   Phase 11    ← 현재
  위키와의 충돌·드리프트 감지 + 캘린더 맥락 + 자기 메타뷰 + 알고리즘 통제

[4단계: 자아 시뮬레이터 + Fork]    Phase 12
  Prior 시간 스냅샷 → "과거의 나" 시뮬레이션 + Prior fork 커뮤니티
```

## 상태 범례
- ⬜ 미시작
- 🔄 진행중 (PROGRESS.md 참고)
- ✅ 완료
- ❌ 실패 (agent-optimizer 실행 필요)
