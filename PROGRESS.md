# PROGRESS.md — 현재 진행 상황 (에이전트 공유)

> **에이전트 필독**: 세션 시작 시 이 파일을 읽어 현재 어떤 작업이 진행 중인지 파악하세요.
> **수정 권한**: Antigravity(오케스트레이터)가 업데이트. 실행 에이전트는 자신의 태스크 완료 시 이 파일 업데이트 요청만 가능.

---

## ⚠️ 미이행 약속 (Unfulfilled Promises)

> 이전 Phase에서 발견되었으나 아직 이행되지 않은 항목들.
> **오케스트레이터**: 다음 Phase 프롬프트 작성 시 이 섹션의 항목을 반드시 태스크에 반영하라.
> **검증 에이전트**: Phase 완료 검증 시 이 섹션의 항목이 해소되었는지 확인하라.

| ID | 출처 | 내용 | 상태 |
|---|---|---|---|
| UP-1 | P1-T6 | HttpOnly cookie 전환 + `AuthService.getToken()` 호출자 10곳 리팩토링 + ws-client.js Feature Flag 연결 + MigrationNotice 로직 정리 | ✅ 이행 완료 (P4-T0d) |
| UP-2 | 보안감사 | callback.js CORS `*` → origin 제한 | ✅ 이행 완료 |
| UP-3 | 보안감사 | JWT payload ghToken 제거 → 서버측 sessionStore 저장 | ✅ 이행 완료 |
| UP-5 | 보안감사 | callback.js CORS 순서 버그 — 토큰 교환 전 origin 검증 | ✅ 이행 완료 |
| UP-6 | 보안감사 | ws-proxy cookie-parser 설치 + 세션 쿠키 읽기 준비 | ✅ 이행 완료 |

---

## 현재 진행 Phase

**Phase 1~9**: ✅ 모두 완료 (보안·동기화·성능·UX 기반 공사)

**Phase 10: Reflection 시스템** — ✅ 인프라 완료 (A1~F3, 23개 전체)
**Phase 10.5: 큐레이션 세션** — ✅ 완료 (T1~T8, 8개 전체)
**Phase 10.6: PWA 전환** — ✅ 코드 완료 (T1~T7) / 실기기 검증은 배포 후 별도
**Phase 10.7: Reflection 학습 루프 완성** — ⬜ 신설 (T1~T6) ← ref-12 격차 보강 필요

> **ref-12 격차 발견 (2026-05-13)**: Phase 10/10.5/10.6 코드 검증 중 ref-12 §3.3 (`edit` 인터벤션 액션), §5.1 (intervention의 학습 신호 역할), §5.4 (사용자 의미 모델 프로파일)이 PLAN.md에 누락된 채 코드도 그대로 누락된 상태가 확인됨. 구체적으로 `WikiPage.jsx` 저장 시 `interventionStore.append`가 호출되지 않아 위키 직접 편집이 AI 학습 신호로 이어지지 않음. ref-12 §2.3 "위키 직접 편집은 MVP 필수"의 절반(편집 UI)만 구현되고 나머지 절반(intervention 기록)이 빠짐.
>
> **롤백 vs 업데이트 판단**: 아키텍처(graph.jsonl SoT, 위키=렌더링, 큐레이션 파이프라인, 4분리 스토어)는 ref-12와 일치. 누락은 *기존 코드에 덧붙이는* 학습 루프 배선뿐이므로 업데이트(Phase 10.7 신설)가 적절. 롤백 시 ~95% 정상 코드 폐기 발생.

> Phase 10은 두 번의 전략 전환을 거쳐 재설계됨 (PLAN.md 참고):
> - 2026-04-30: Docker/OpenClaw 폐기 → BYOK + 노트앱 연동
> - 2026-05-07: Apple/Samsung Notes = 비협상 1순위 복귀
> - 2026-05-12: ref-12 작성 — 그래프=Prior 진실원, 위키=렌더링, intervention=불변제약

**Phase 10 상세 설계**: `.agents/references/ref-12-reflection-system-design.md`
**Phase 10 태스크 분해**: PLAN.md §Phase 10 (P10-A1 ~ P10-F3, 총 23개)

---

## 현재 활성 태스크

**Phase 10 + 10.5 + 10.6 완료** — **Phase 10.7 (ref-12 학습 루프 보강) 착수 대기**

**완료**: P10-A1~A3, P10-B1~B4, P10-C1~C3, P10-D1~D4, P10-E1~E3, P10-F1~F3, P10.5-T1~T8, P10.6-T1~T7
**다음**: **Phase 10.7** (P10.7-T1~T6) → 그 후 Phase 11

### Phase 10.7 진입점

**우선**: P10.7-T1 (WikiPage 저장 시 interventionStore.append)
- `miki-editor/src/wiki/components/WikiPage.jsx` `handleSave` 내 `appendTriples` 직후 `diffMarkdown` 결과의 added/removed를 순회하며 `interventionStore.append({type:'edit', subject, predicate, object})` 호출
- `interventionStore.append`는 `db.interventionsCache.add` + `github.appendJsonl`까지 일관 처리 (현재 구현 확인 필요)
- `markdownDiffer.diffMarkdown`이 `removed`를 이미 반환하므로 wikiStore에 `removeTriples` 메서드 추가 필요

**병행 가능**: P10.7-T2 (ReflectionCard reject 시 interventionStore 기록 검증)

### Phase 10.7 의존성

```
T1 (위키 편집 → intervention) + T2 (Reflection → intervention) — 병행 (UI 레이어)
T3 (사용자 프로파일 빌더) — 코드 병행 가능, 의미는 T1·T2 누적 후
T4 (콜드 스타트 자동 규칙) — 독립
T5 (드립 피드 스케줄링) — 독립
T6 (회귀 검증) ← 전부 완료 후
```

PWA 실기기 검증은 `miki-editor/PWA_TEST_CHECKLIST.md` 참고 (배포 후 사용자 검증).

**Phase 10.5 도입 배경 (2026-05-13)**:
사용자 피드백으로 Phase 10의 자동 컴파일 흐름이 "어떤 메모를 위키화할지 결정할 권한"을 사용자에게서 빼앗았다는 점이 드러남. 흐름을 **수집(자동) → 큐레이션(의식적) → 컴파일(선택된 것만)** 3단계로 분리.

**Phase 10.5 최초 진입점**: `P10.5-T1` (raw 메모 큐레이션 상태 데이터 모델 + IndexedDB v6)

**Phase 10.5 의존성**:
```
T1 (데이터 모델) → T2 (파이프라인), T3 (스토어)
                     → T4 (큐레이션 페이지) → T5 (진입 버튼/라우트)
                     → T6 (스케줄러)
T7 (자동 흐름 정리)는 병행 가능
```

**Phase 10.7 최초 진입점**: `P10.7-T1` (WikiPage 편집 → interventionStore.append 배선 — ref-12 §3.3·§5.1 학습 루프 완성)

**Phase 11 최초 진입점** (10.7 완료 후): `P11-T1` (Tension 감지 엔진 — 4종 하위 타입 분류기)

**Phase 11 의존성 순서**:
```
P11-T1 (Tension 감지) + P11-T2 (시간축 임베딩)
  → P11-T3 (캘린더 맥락), P11-T4 (relationship_id 태깅)
  → P11-T5 (교정 타임라인 UI)
  → P11-T6 (자기 메타뷰), P11-T7 (알고리즘 환경설정)
  → P11-T8 (Consistent 재노출)
  → P11-T9 (검증)
```

---

## 완료된 태스크

| 태스크 ID | 완료 시각 | 담당 에이전트 | 결과 |
|---|---|---|---|
| P10.6-Verify | 2026-05-13 | test_verify | ✅ Phase 10~10.6 통합 정적 분석, 단위 테스트(7건), Shallow Boot 통과 및 PWA 빌드(sw.js) 성공 확인 (Antigravity 직접 수행) |
| P10.6-T7 | 2026-05-13 | test_verify | ✅ `miki-editor/PWA_TEST_CHECKLIST.md` 작성 — iOS Safari/Android Chrome 설치·풀스크린·safe-area·스와이프·알림·오프라인 검증 항목 + 디버깅 팁. |
| P10.6-T6 | 2026-05-13 | api_dev | ✅ `services/secureStorage.js` 신규 wrapper (setItem/getItem/setJSON/getJSON). `byokClient.js` 키 저장 이 wrapper 경유 + 인메모리 캐시(`initByokCache` 워밍업). Capacitor 전환 시 이 파일만 Keychain으로 교체. |
| P10.6-T5 | 2026-05-13 | api_dev | ✅ `services/notify.js` 신규 wrapper — `requestPermission`/`showNotification`/`showPersistentNotification`(Service Worker 경유)/`isNativePlatform`. `curationScheduler.js`가 이 wrapper 사용. Capacitor 전환 시 `@capacitor/push-notifications`로 1파일 교체. |
| P10.6-T4 | 2026-05-13 | api_dev | ✅ `vite-plugin-pwa` 설치 + `vite.config.js`에 VitePWA 통합. 보수적 precache(globPatterns 정적 자산만), GitHub API NetworkOnly, CDN CacheFirst. 빌드 시 `dist/sw.js` + `workbox.js` 생성 확인 (11 entries, 1974KB precache). |
| P10.6-T3 | 2026-05-13 | frontend_dev | ✅ `public/manifest.json` Meki 브랜딩 재작성 — name/short_name 한글, start_url=/editor, display=standalone, orientation=portrait, maskable 아이콘, shortcuts(`/curation`, `/reflection`). |
| P10.6-T2 | 2026-05-13 | frontend_dev | ✅ `index.html` viewport에 `viewport-fit=cover` + `maximum-scale=1`. iOS 메타 추가(`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title=Meki`, `apple-touch-icon` 192/512). lang ko-KR. |
| P10.6-T1 | 2026-05-13 | frontend_dev | ✅ Tailwind CDN 스크립트 제거 + `postcss.config.js` 신규 + `tailwind.config.js`에 safe-area 유틸리티 정식 등록(`safe-top/bottom/left/right/x/y`, `mb-safe/mt-safe`). CSS 195KB → 240KB로 늘어남(CDN에서 silently 처리되던 클래스가 정식 빌드 결과에 포함). |
| P10.5-T8 | 2026-05-13 | frontend_dev | ✅ Phone-first 스와이프 UX — `MemoCard`(터치+마우스 스와이프, 3-state 결정, 탭→edit), `EditMemoModal`(폰 풀스크린/데스크탑 모달), `ReflectionCard`(스와이프→accept/reject, 탭→수정 인라인), `curationStore` 3-state(`decisions Map`), `Curation.jsx` 진행바·sticky 확정·미결정 메모는 다음 세션 유지. `RawMemoCache.updateContent` 추가. 빌드 성공 (2188 modules). |
| P10.5-T7 | 2026-05-13 | api_dev | ✅ `wikiCompiler.js` 헤더 경고문 추가 — "curationPipeline.confirmCuration() 경유 강제" 명시. 자동 호출 금지 사유(프라이버시 통제권) 문서화. |
| P10.5-T6 | 2026-05-13 | api_dev | ✅ `services/curationScheduler.js` 신규 — 사용자 지정 시간(기본 21:00) Notification API 알림, pending 메모 존재 시만 발송, 일 1회 제한. App.jsx 로그인 effect에 startScheduler/stopScheduler 배선. |
| P10.5-T5 | 2026-05-13 | frontend_dev | ✅ App.jsx에 `/curation` 라우트 추가. (Editor 헤더 진입 버튼은 Editor.jsx 43KB 대용량 — Phase 11 같이 진행 권장) |
| P10.5-T4 | 2026-05-13 | frontend_dev | ✅ `pages/Curation.jsx` + `components/MemoCard.jsx` 신규 — 메모 카드 그리드, 토글 선택, sticky 확정 버튼, 전체 선택/해제, lastResult 배너, 빈 상태 처리. |
| P10.5-T3 | 2026-05-13 | api_dev | ✅ `stores/curationStore.js` 신규 — pending/selectedIds(Set)/confirming/lastResult 상태, toggleSelect/selectAll/clearSelection/confirm 액션. confirm은 GitHubService 주입받아 curationPipeline 호출. |
| P10.5-T2 | 2026-05-13 | api_dev | ✅ `services/curationPipeline.js` 신규 — confirmCuration({ selectedMemos, excludedMemos, deps }). 선택 메모 일괄 compileMemo → github.appendJsonl → wikiStore.appendTriples → detectConnections → reflectionStore.pushCards. 제외 메모는 markExcluded. 한 메모 실패가 세션 중단 안 시킴. |
| P10.5-T1 | 2026-05-13 | api_dev | ✅ `database.js` IndexedDB v6 — `rawMemosCache` 테이블 신규(`&memoId, source, curationStatus, capturedAt, decidedAt`). `RawMemoCache` 클래스(enqueueForReview/getPending/markSelected/markExcluded/pendingCount/getByDateRange). ImportBridge에서 enqueueForReview 호출하도록 수정 — 자동 컴파일 경로 차단. 빌드 성공 (2187 modules, 0 errors). |
| P10-F3 | 2026-05-13 | api_dev | ✅ `open-notes-extractor/daemon/` 신규 — config.js(플랫폼별 설정 영속), syncer.js(Apple/Samsung 추출 + GitHub raw/notes/ push), index.js(setup/sync-now/install/uninstall CLI + 폴링 루프 + launchd/작업스케줄러 자동등록 + 알림). menubar 선택적 의존성. |
| P10-F2 | 2026-05-13 | api_dev | ✅ `open-notes-extractor/samsung/` 신규 (별도 repo) — extract.js(sdocx 파서), bridge-server.js(크로스플랫폼), MekiSamsungSync.ps1(Windows 래퍼). miki-editor `/import-bridge` 수신 페이지 추가. 빌드 성공. |
| P10-F1 | 2026-05-13 | api_dev | ✅ `open-notes-extractor/apple/` 신규 (별도 repo) — extract.js(JXA osascript), bridge-server.js(일회성 HTTP + 자동 종료), build-app.sh(.app 번들 생성). shared/protocol.js 공유 포맷. 빌드 성공. |
| P10-E3 | 2026-05-13 | api_dev | ✅ `stores/interventionStore.js` 신규 — load/loadFromCache/append/buildContext. GitHub append는 호출부 위임(서비스 의존 분리). 빌드 성공. |
| P10-E2 | 2026-05-13 | api_dev | ✅ `stores/reflectionStore.js` 신규 — loadQueue/pushCards/resolveCard. resolveCard → interventionStore.append() 연결. 빌드 성공. |
| P10-E1 | 2026-05-13 | api_dev | ✅ `stores/wikiStore.js` 신규 — loadTriples/loadFromCache/appendTriples/getEntityPage/listEntities. entityIndex 인메모리 빌드. 빌드 성공. |
| P10-D4 | 2026-05-13 | frontend_dev | ✅ `components/CounterfactualView.jsx` 신규 — Consistent 건너뜀 트리플 접힌 토글, "이미 위키에 있는 내용" 설명. 빌드 성공. |
| P10-D3 | 2026-05-13 | frontend_dev | ✅ `components/IdentityReflectionCard.jsx` 신규 — modeling_options 3지선다 라디오, 근거 스니펫 표시. 빌드 성공. |
| P10-D2 | 2026-05-13 | frontend_dev | ✅ `components/ReflectionCard.jsx` 신규 — 추가/건너뜀/수정 액션, rationale 푸터, 수정 입력 인라인. 빌드 성공. |
| P10-D1 | 2026-05-13 | frontend_dev | ✅ `pages/Reflection.jsx` 신규 — `/reflection` 라우트, pendingCards 타입별 분기, 빈 상태, CounterfactualView. App.jsx 라우트 연결. 빌드 성공. |
| P10-C3 | 2026-05-13 | frontend_dev | ✅ `wiki/components/WikiPage.jsx` 신규 — Toast UI Editor 슬라이드-인 패널, diffMarkdown → appendTriples 저장. 빌드 성공. |
| P10-C2 | 2026-05-13 | frontend_dev | ✅ `wiki/markdownDiffer.js` 신규 — diffMarkdown(original, edited, entityName) → {added, removed}. 정규식 파싱. 빌드 성공. |
| P10-C1 | 2026-05-13 | frontend_dev | ✅ `wiki/tripleParser.js` 신규 — buildEntityPage/listEntities/parseTripleLine. 섹션별 마크다운 렌더링. 빌드 성공. |
| P10-B4 | 2026-05-12 | api_dev | ✅ `services/reflectionEngine.js` 신규 — `classifyTriple`(Consistent/Extending/Tension), `buildReflectionQueue`, `buildIdentityReflection`, `selectDailySlots`. 빌드 성공. |
| P10-B3 | 2026-05-12 | api_dev | ✅ `services/interventionResolver.js` 신규 — `selectRelevantInterventions`(RAG, dormant 1년 필터), `buildConstraintPrompt`, `resolveInterventionContext`, `createIntervention`. 빌드 성공. |
| P10-B2 | 2026-05-12 | api_dev | ✅ `services/wikiCompiler.js` 신규 — `compileMemo`(BYOK 추출), `scheduleColdBatch`(4주 드립 스케줄), `compileAndAppend`(증분 컴파일+appendJsonl). 빌드 성공. |
| P10-B1 | 2026-05-12 | api_dev | ✅ `services/byokClient.js` 신규 — `ByokClient`(Gemini/Claude/OpenAI 통합), `ByokApiError`, `loadByokConfig`/`saveByokConfig`/`clearByokConfig`/`createByokClient`, `BYOK_PROVIDERS`. 빌드 성공. |
| P10-A3 | 2026-05-12 | api_dev | ✅ `sync/index.js` 확장 — `syncGraphFromRemote`, `syncInterventionsFromRemote`, `syncReflectionQueueFromRemote`, `initialGraphSync` 추가. `db` import 연결. 빌드 성공. |
| P10-A2 | 2026-05-12 | api_dev | ✅ `database.js` IndexedDB v5 추가 — `graphCache`(`&entityId, entityType, updatedAt`), `interventionsCache`(`&interventionId, scope, entityId`), `reflectionsQueue`(`&reflectionId, status, evidenceTier, scheduledAt`). 빌드 성공. |
| P10-A1 | 2026-05-12 | api_dev | ✅ `github.js` 확장 — `readJsonl`, `appendJsonl`, `writeJsonl`, `ensureGraphStructure` 추가. `createInitialStructure`에 `raw/notes/`, `graph.jsonl`, `interventions.jsonl`, `reflections/queue.jsonl`, `reflections/archive.jsonl` 포함. 빌드 성공 (2169 modules, 0 errors). |
| P9-T2 | 2026-03-20 | test_verify | ✅ 코드 검증 완료 — Editor.jsx(pages/) sync:changed 4케이스(optimistic/committed/failed/delete) + unsubscribe cleanup ✅, storage-client.js sync.notify 3곳 ✅, ws-handler.js broadcastToLogin + sync.notify 핸들러 ✅, git 커밋(f1bd08f, dd811ab) 확인 ✅. Meki 가치 체크 통과(데이터 주권 침해 없음). |
| P9-T1 | 2026-03-17 | frontend_dev | ✅ `Editor.jsx` `sync:changed` WS 리스너 구현 — optimistic/committed/failed/delete 4케이스 React Query 캐시 직접 패치. `storage-client.js` sync.notify 3곳 브로드캐스트(optimistic, committed, delete). `ws-handler.js` sync.notify 액션 + broadcastToLogin 구현. 빌드 확인 완료. |
| P4-T2 | 2026-03-06 | api_dev | ✅ `src/sync/PendingSyncProcessor.js` 신규 생성 — `pendingSync` 테이블 폴링(30초), djb2 해시 기반 변경 감지(title+content), 배치 처리(최대 5개/cycle), 지수 백오프(`PendingSync.markFailed`), delete 우선순위, 중복 항목 스킵(superseded). `storage-client.js` GitHub 저장 실패 시 `PendingSync.enqueue()` 추가. `sync/index.js` 재export. `App.jsx` user 로그인 시 `start()`/로그아웃 시 `stop()` 배선. 테스트 9개 통과. 빌드 성공 (2163 modules, 0 errors). |
| P4-T1 | 2026-03-06 | api_dev | ✅ `miki-editor/src/utils/database.js` IndexedDB 스키마 v3 추가 — `pendingSync` 테이블(`++id, documentId, changeType, status, queuedAt`) 신규 생성. `PendingSync` 클래스(`enqueue`, `getPending`, `markDone`, `markFailed`, `remove`, `removeByDocumentId`, `cleanup`) export. 기존 v1/v2 테이블(documents, syncQueue) 데이터 유실 없는 안전한 마이그레이션. 빌드 성공 (2158 modules, 0 errors). |
| P4-T0b | 2026-03-06 | api_dev | ✅ `CallbackPage.jsx` WS 모드 분기 추가 (POST /api/session → HttpOnly 쿠키 수신, localStorage 저장 안 함, 사용자 정보 캐시), `ws-client.js` request()에서 token 필드 제거 (쿠키 기반 인증). 빌드 성공 (2158 modules, 0 errors). |
| P4-T0c | 2026-03-06 | frontend_dev | ✅ `MigrationNotice.jsx` hasLegacyToken 로직을 `AuthService.hasLegacyToken()` 위임으로 정리 (기존 `Boolean(AuthService.getToken())` 대체). 빌드 성공 (2158 modules, 0 errors). |
| P4-T0a | 2026-03-05 | api_dev | ✅ `src/services/auth.js` 듀얼모드 리팩토링 (WS 모드: getToken→null 반환), 8개 소비자 파일(`App.jsx`, `usePublish.js` 등) 대응 완료. 에이전트 실행 환경(Claude CLI 중첩 세션 이슈, 45초 타임아웃 맹점) 진단/해결 이후 성공적으로 병합됨. 연관된 Jest SyntaxError(`import.meta`) 수정 및 단위 테스트 93개 통과/빌드 성공. |
| P3-T3 | 2026-02-27 | api_dev | ✅ `src/services/auth.js` WS 연결 상태 기반 분기 리팩토링 — isWsProxyEnabled()+wsClient.isConnected 조건으로 getCurrentUser()를 WS경로(github.getUser)와 직접 Octokit 경로로 분리, AUTH_ERROR 코드 처리, ws-client.js 동시 생성(isWsProxyEnabled export 포함), 빌드 성공 (2159 modules, 0 errors) |
| P3-T1 | 2026-02-27 | api_dev | ✅ `src/services/ws-client.js` 생성 (WsProxyClient 클래스, isWsProxyEnabled() flag, 9개 GitHub API 래퍼, 재연결 지수 백오프, heartbeat, 요청 타임아웃, singleton), `.env.example`에 VITE_USE_WS_PROXY + VITE_WS_PROXY_URL 추가, 빌드 성공 (2158 modules, 0 errors) |
| P3-T4 | 2026-02-27 | frontend_dev | ✅ `src/components/MigrationNotice.jsx` 생성 (VITE_USE_WS_PROXY 감지, 기존 토큰 보유 시 재로그인 배너 표시, dismiss 영속, App.jsx /editor 라우트에 적용), 빌드 성공 (2158 modules, 0 errors) |
| P2-T5 | 2026-02-27 | test_verify | ✅ Phase 2 구조 검증 완료 — ws-handler.js(9액션) ✅, index.js(port 8080, /health) ✅, package.json ✅; 누락 파일 발견: server.js(P2-T2), Dockerfile+fly.toml(P2-T4) ❌ |
| P2-T4 | 2026-02-27 | api_dev | ✅ `ws-proxy/Dockerfile` (Node.js 20 Alpine, non-root user, port 8080) + `ws-proxy/fly.toml` (Fly.io nrt region, /health check, 256mb shared VM) |
| P2-T3 | 2026-02-27 | api_dev | ✅ `ws-proxy/src/ws-handler.js` 구현 (WebSocket 핸들러, 9개 GitHub API 액션 릴레이, SHA 자동처리, 에러 매핑, 하트비트, 1MB 사이즈 가드) |
| P2-T2 | 2026-02-27 | api_dev | ✅ `ws-proxy/src/server.js` 생성 (Express HTTP 서버, POST /api/session JWT 발급, GET /api/session 검증, DELETE /api/session, GET /health), ESM 모듈, 전체 엔드포인트 테스트 통과 |
| P2-T1 | 2026-02-27 | api_dev | ✅ `ws-proxy/` 디렉토리 생성, package.json (Express + ws + jsonwebtoken + @octokit/rest), src/index.js (HTTP + WebSocket 서버 부트스트랩), README.md 작성 |
| P1-T6 | 2026-02-26 | test_verify | ✅ Phase 1 전체 검증 완료 (XSS 차단, DOMPurify 적용, PKCE 적용, 빌드 성공, 보안 감사) |
| P1-T2 | 2026-02-26 | api_dev | ✅ `src/utils/sanitize.js` 생성 완료 (DOMPurify + sanitizeHtml 함수) |
| P1-T3 | 2026-02-26 | frontend_dev | ✅ 마크다운 렌더러에 sanitize.js 적용 완료 (MikiEditor.jsx, IsolatedPreview.jsx, conflict.js) |
| P1-T4 | 2026-02-26 | frontend_dev | ✅ `src/components/IsolatedPreview.jsx` 생성 완료 (blob URL + iframe sandbox) |
| P1-T5 | 2026-02-26 | api_dev | ✅ `api/auth/callback.js` PKCE + State 적용 완료 (code_verifier, state 검증 추가) |
| P1-T1 | 2026-02-26 | api_dev | ✅ `vercel.json` CSP headers 추가 완료 (default-src 'self', connect-src GitHub API, script-src 'unsafe-inline') |

---

## 차단된 태스크 (Blockers)

| 태스크 ID | 차단 이유 | 해결 필요 사항 |
|---|---|---|
| ~~P2-T2~~ | ✅ 해결됨 — server.js 재생성 완료 (2026-02-27) | — |
| ~~P2-T4~~ | ✅ 해결됨 — Dockerfile + fly.toml 재생성 완료 (2026-02-27) | — |

---

## 최근 실패 및 SOP 업데이트 이력

| 날짜 | 태스크 ID | 실패 분류 | 업데이트된 SOP | 버전 |
|---|---|---|---|---|
| 2026-02-27 | P2-T2/T4 | C1 (미구현) | api_dev SOP에 "작업 완료 후 파일 존재 여부 확인 후 커밋" 규칙 추가 필요 | v1.1 |

---

## P2-Wiring 완료 (2026-03-01)

- ✅ `ws-proxy/src/index.js`: `const { createApp } = require('./server')` 추가, `http.createServer(app)` Express 연결
- ✅ `/health` 엔드포인트: `{"status":"ok","service":"meki-ws-proxy","ts":...}` 정상 응답
- ✅ `/api/session` GET: 토큰 없을 시 `{"error":"Missing Authorization header","code":"UNAUTHENTICATED"}` 정상 응답
- ✅ c4-wiring-verification 룰 준수: createApp 배선 grep 확인 완료

---

## 에이전트 세션 로그

각 에이전트는 세션 종료 시 아래에 간략한 요약을 추가해 주세요:

```
[YYYY-MM-DD] <role명> @ <태스크 ID>: <완료한 작업 한 줄 요약> → <결과: 성공/실패>
```

[2026-02-26] api_dev @ P1-T2: DOMPurify 설치 확인 및 src/utils/sanitize.js 생성 (sanitizeHtml, sanitizeMarkdown 함수 export) → 성공
[2026-02-26] frontend_dev @ P1-T3: 마크다운 렌더러 3곳에 sanitizeHtml 적용 (MikiEditor.jsx:93, IsolatedPreview.jsx:58, conflict.js:231-233) → 성공
[2026-02-26] frontend_dev @ P1-T4: src/components/IsolatedPreview.jsx 생성 (blob URL + iframe sandbox, 자동 cleanup, 다크모드 지원) → 성공
[2026-02-26] api_dev @ P1-T5: api/auth/callback.js에 PKCE code_verifier + state 검증 적용, CallbackPage.jsx에 CSRF 보호 로직 추가 → 성공
[2026-02-26] api_dev @ P1-T1: vercel.json의 CSP 헤더 검증 완료 (이미 정확히 설정되어 있음) → 성공
[2026-02-27] test_verify @ P2-T5: ws-proxy/ 전체 구조 검증 — ws-handler.js(9액션, 하트비트, 1MB가드) ✅, index.js(/health, WS부트스트랩) ✅, package.json ✅, miki-editor build ✅; server.js/Dockerfile/fly.toml 누락 발견 → 완료(차단 보고)
[2026-02-27] api_dev @ P2-T4 (재실행): ws-proxy/Dockerfile (Node.js 20 Alpine, non-root user wsuser, port 8080) + ws-proxy/fly.toml (Fly.io nrt, /health HTTP 헬스체크, 256mb shared VM, TCP/HTTP 서비스) 재생성 완료 → 성공
[2026-02-27] api_dev @ P2-T3: ws-proxy/src/ws-handler.js 구현 (handleWsConnection, 9개 GitHub API 액션 릴레이, SHA 자동처리, 하트비트 30s, 1MB 가드) → 성공
[2026-05-12] api_dev @ P10-A1~A3: github.js readJsonl/appendJsonl/writeJsonl/ensureGraphStructure 추가 + database.js v5 스키마(graphCache/interventionsCache/reflectionsQueue) + sync/index.js 그래프·intervention·queue 동기화 메서드 추가. 빌드 성공 (2169 modules) → 성공
[2026-02-27] api_dev @ P2-T2 (재실행): ws-proxy/src/server.js 재생성 (Express HTTP, GET /health, POST/GET/DELETE /api/session JWT 세션, CommonJS, syntax OK) → 성공
[2026-02-27] api_dev @ P3-T1: ws-client.js 생성 (WsProxyClient, isWsProxyEnabled, 9 GitHub API 래퍼, 재연결/heartbeat/타임아웃), .env.example VITE_USE_WS_PROXY 추가, 빌드 성공 → 성공
[2026-02-27] api_dev @ P3-T3: auth.js WS 연결 상태 기반 분기 리팩토링 (isWsProxyEnabled+isConnected → github.getUser WS 경로, AUTH_ERROR logout 처리, 직접 Octokit fallback 유지), ws-client.js 생성(isWsProxyEnabled export), 빌드 성공 (2159 modules, 0 errors) → 성공
[2026-02-27] frontend_dev @ P3-T4: MigrationNotice.jsx 생성 (VITE_USE_WS_PROXY flag 감지 + legacy token 확인, 재로그인 유도 배너, dismiss 영속), App.jsx /editor 라우트에 적용, 빌드 성공 → 성공
[2026-03-20] test_verify @ P9-T2: 크로스 기기 동기화 코드 검증 — Editor.jsx(pages/) sync:changed 4케이스(optimistic/committed/failed/delete)+unsubscribe cleanup, storage-client.js sync.notify 3곳, ws-handler.js broadcastToLogin+sync.notify 핸들러, git 커밋(f1bd08f/dd811ab) 모두 확인, Meki 가치 체크 통과 → 성공
[2026-03-17] frontend_dev @ P9-T1: Editor.jsx sync:changed 리스너(4케이스 캐시 패치) + storage-client.js sync.notify 브로드캐스트 + ws-handler.js broadcastToLogin — 기존 구현 확인, 코드 완성 상태 검증 → 성공
[2026-03-06] test_verify @ P4-T0d: security-state-check.sh 실행 — Section 8 E2E ✅ (토큰 흐름 안전), UP-1 이행 완료 처리 → 성공
[2026-03-06] frontend_dev @ P4-T0c: MigrationNotice.jsx hasLegacyToken 로직을 AuthService.hasLegacyToken() 위임으로 정리 (Boolean(AuthService.getToken()) 제거), 빌드 성공 → 성공
[2026-03-06] frontend_dev @ P4-T4: SyncStatus.jsx 생성 (useSyncStatus 훅, offline/syncing/synced 상태 UI, 하단 우측 고정 배지), App.jsx /editor 라우트에 배치. RTL 테스트 5개 통과, 빌드 성공 (2165 modules, 0 errors) → 성공
[2026-03-06] api_dev @ P4-T3: App.jsx에 visibilitychange(탭 백그라운드 전환 시 즉시 flush) + beforeunload(종료 직전 fire-and-forget flush) 핸들러 추가. 빌드 성공 (0 errors) → 성공
[2026-03-06] api_dev @ P4-T2: PendingSyncProcessor.js 생성 (pendingSync 폴링, djb2 해시 변경감지, 배치동기화, 지수백오프), storage-client.js enqueue on failure, sync/index.js 재export, App.jsx 배선 완료. 테스트 9개 통과, 빌드 성공 (2163 modules) → 성공
[2026-03-06] api_dev @ P4-T1: database.js IndexedDB v3 스키마 추가 (pendingSync 테이블), PendingSync 클래스 export, 기존 데이터 유실 없음, 빌드 성공 (2158 modules) → 성공
[2026-03-06] api_dev @ P4-T0b: CallbackPage.jsx WS 모드 분기(POST /api/session → HttpOnly 쿠키, 사용자 캐시), ws-client.js request() token 필드 제거(쿠키 기반 인증), 빌드 성공 → 성공
[2026-03-05] api_dev @ P4-T0a: auth.js 듀얼모드 리팩토링 (isWsMode, getToken→null in WS, saveToken→no-op in WS, hasLegacyToken 추가, getCurrentUser→getCachedUser in WS), 8개 소비자 파일 WS 분기 추가 (App.jsx/usePublish.js/useAttachment.js/storage-client.js/OnboardingSetup.jsx/verify-setup.js/functional-test.js), 빌드 성공 (2158 modules, 0 errors) → 성공
[2026-03-01] api_dev @ P2-wiring: ws-proxy/src/index.js에 createApp() 배선 — Express app을 http.createServer()에 연결, /health + /api/session 실구동 검증 완료 → 성공
[2026-02-27] api_dev @ P2-T1: ws-proxy/ 디렉토리 생성, package.json + src/index.js (Express + ws 부트스트랩) + README.md 작성 → 성공
[2026-02-26] test_verify @ P1-T6: Phase 1 전체 검증 (XSS 차단, DOMPurify 적용, PKCE 적용, iframe sandbox, CSP headers, 빌드 성공, 보안 감사) → 성공

---

## Antigravity 오케스트레이터 메모

_다음 태스크 배정 시 이 섹션에 지시 사항을 기록합니다._

### Phase 10 착수 가이드 (2026-05-12)

**우선 진입**: P10-A1 (miki-data repo 구조 확장)

작업 내용:
- miki-data repo에 4개 새 디렉토리/파일 생성:
  - `raw/notes/` (MekiSync가 메모 파일을 쓸 위치)
  - `graph.jsonl` (Single Source of Truth, 빈 파일로 시작)
  - `interventions.jsonl` (append-only 사용자 결정 로그, 빈 파일로 시작)
  - `reflections/queue.jsonl`, `reflections/archive.jsonl`
- `miki-editor/src/services/github.js`에 새 파일 CRUD 메서드 추가
- 기존 블로그 포스트 흐름(documents 디렉토리)은 무손상 유지

검증 기준:
- miki-data repo에 새 구조 커밋 (빈 jsonl 파일이라도 ok)
- github.js에서 새 파일 읽기/쓰기 가능
- 기존 블로그 포스트 동기화 회귀 없음 (smoke test)

### 핵심 설계 원칙 (모든 Phase 10 태스크 공통)

1. **그래프가 진실원, 위키는 렌더링**: graph.jsonl이 SoT. `/wiki/` 디렉토리는 없음. UI가 동적 렌더링.
2. **Intervention은 불변 제약**: interventions.jsonl은 시스템 프롬프트로 주입되는 절대 룰. AI는 사용자 확정 결정을 재제안할 수 없음.
3. **두 축 분리**: 증거 강도(Grounded/Bridged) = UI 메타데이터. Prior 관계(Consistent/Extending/Tension) = 발행 게이트.
4. **MVP는 Extending만**: Tension 감지는 Phase 11로 이월. MVP 단순화.
5. **Anti-Bubble 필수**: Reflection 푸터 / Counterfactual / 위키 직접 편집 / 단일 목적함수 부재.

### 호환성 정책

- 기존 코드 침습 최소화. 신규 디렉토리(`src/wiki/`, `src/services/byok*`, `src/stores/wiki*`)로 분리.
- 블로그 포스트 흐름 변경 없음.
- Toast UI Editor 재사용.
- AiPanel.jsx는 에디터 사이드 도우미로 유지, Reflection은 별도 페이지(`pages/Reflection.jsx`).

### 과거 Phase 결과 보존 (참고용 아카이브)

**Phase 9 완료 (2026-03-20)**: 크로스 기기 실시간 동기화 — Editor.jsx sync:changed WS 리스너, storage-client.js sync.notify, ws-handler.js broadcastToLogin.

**Phase 4 완료 (2026-03-06)**: Auto-Save + Offline — pendingSync 테이블 v3, PendingSyncProcessor, visibilitychange/beforeunload flush, SyncStatus.jsx.

**Phase 2 완료 (2026-02-27)**: WS Proxy Server — Express HTTP + WebSocket 핸들러, JWT 세션, Fly.io 배포 설정.

**Phase 1 완료 (2026-02-26)**: Security Foundation — CSP, DOMPurify, IsolatedPreview, PKCE OAuth.
