# SPEC.md — Meki 프로젝트 통합 스펙

> 최종 갱신: 2026-05-25
> 이 파일은 PLAN.md·PROGRESS.md·ref-09·ref-12 등 분산된 설계 문서를 하나로 압축한 **읽기 전용 종합 스펙**입니다.
> 세부 변경·작업 기록은 각 원본 문서를 수정하세요. 이 파일은 오케스트레이터만 갱신합니다.

---

## 1. 프로젝트 정의

### 한 줄 정의
> **"오늘의 질문, 어제의 메모가 답합니다."**

Meki는 사람이 자기 관점을 발견하고, 실행하고, 전파하고, 공동체 안에서 진화시키는 인프라다.
기존 노트앱(Apple Notes, Samsung Notes)을 그대로 쓰면서, 그 안에 쌓인 메모에서 자기 Prior(사전 믿음)를 추출·구조화하는 개인 의미 엔진.

### 핵심 차별점

| 기존 제품 | Meki |
|---|---|
| AI가 정리해준다 (Mem.ai, Notion AI) | AI는 제안만, 사용자가 확정 |
| 새 쓰기 도구를 강요한다 (Roam, Obsidian) | 기존 노트 습관 보존, 아래에서 연결 |
| diff 없다 (모든 제품) | **diff(나 vs 과거의 나)** 가 핵심 가치 |
| AI 판단 불투명 | Counterfactual 가시화, 알고리즘 통제권 |

### 타겟 사용자

- Apple Notes / Samsung Notes에 수백~수천 개의 날것 메모를 쌓아둔 **개인**
- 팀 협업툴 사용자는 타겟이 아님
- 30초 온보딩 필수 (Docker 설치 없음, GitHub OAuth 원클릭)

---

## 2. 핵심 가치 체계

### 2.1 Prior vs Harness 분리

**Prior (사전 믿음)** — 세계가 어떻게 구성되어 있는가
```
Prior = {
  entityTypes:   [...],        // 세계에 무엇이 있는가
  relationTypes: [...],        // 그것들이 어떻게 연결되는가
  confidenceThresholds: { accept, review, reject }
}
```
- AI 제안 + 사용자 피드백으로 자동 수렴
- graph.jsonl이 파일 형태의 Prior (Single Source of Truth)
- **공유했을 때 타인의 자유에너지를 줄이는 것 = 바이럴 객체**

**Harness (행동 구속 장치)** — 에이전트가 어떻게 행동해야 하는가
```
Harness = {
  prompts:     { extraction, tone },
  policies:    { sources, excluded, privacy, schedule },
  permissions: { autoCreateEntity, autoCreateRelation },
  model:       { provider, temperature }
}
```
- 사용자가 명시적으로 설정 (자동 갱신 안 됨)
- 공유 가치 낮음, 개인 운영 환경 종속

### 2.2 다섯 가지 핵심 가치

1. **데이터 주권** — 사용자 데이터는 사용자 GitHub repo에 저장, Meki 서버 비저장
2. **사유의 흐름** — 메모 저장 마찰 제거, 기존 노트앱 습관 보존
3. **위키 연결성** — graph.jsonl → 동적 위키 렌더링, 엔티티 간 관계 가시화
4. **원본 불변** — raw 메모는 삭제/수정 불가, interventions.jsonl은 append-only
5. **AI는 도구** — 통합·정리 주체는 AI가 아니라 사용자. AI = 제안 + 학습만

---

## 3. 시스템 아키텍처

### 3.1 전체 데이터 흐름

```
[입력] Apple/Samsung Notes (원본, 불변)
          │
          │ MekiSync 데몬 (open-notes-extractor)
          ▼
[수집] miki-data/raw/notes/        ← 메모 사본. 불변.
          │
          │ 큐레이션 세션 (사용자가 매일 저녁 선택)
          │   → pending_review → selected | excluded
          ▼
[컴파일] BYOK 컴파일 (Gemini / Claude / OpenAI)
          + interventions.jsonl 시스템 프롬프트 주입 (불변 제약)
          ▼
[Prior] miki-data/graph.jsonl      ← 트리플 스토어. Single Source of Truth.
          │
          │ Prior 변화 감지 (Extending → 발행 / Tension → Phase 11)
          ▼
[제안] miki-data/reflections/queue.jsonl
          │
          ├── Push: Daily Reflection (모바일 스와이프 / 데스크탑 카드)
          └── Pull: /wiki 직접 조회·편집
                    │
                    ▼ 마크다운 diff → 트리플 변경
[학습] interventions.jsonl append  ← AI 불변 제약 + 자아 시뮬레이터 학습 데이터
       graph.jsonl 갱신
       reflections/archive.jsonl 기록
```

### 3.2 저장 레이어

```
miki-data/ (사용자 GitHub private repo)
├── raw/notes/          ← 메모 원본 사본 (불변)
├── graph.jsonl         ← Prior. append-only 트리플 스토어
├── interventions.jsonl ← 사용자 결정 로그. AI 시스템 프롬프트로 주입
└── reflections/
    ├── queue.jsonl     ← 발행 대기 Reflection
    └── archive.jsonl   ← 처리 완료 기록
```

`/wiki/` 디렉토리는 **존재하지 않는다.** 위키 페이지는 graph.jsonl의 파생 뷰로 프론트엔드 동적 렌더링.

### 3.3 프론트엔드 소스 구조 (miki-editor/src/)

```
src/
├── App.jsx                    ← 라우팅 + AuthProvider
├── pages/
│   ├── Editor.jsx             ← 메인 에디터
│   ├── Curation.jsx           ← 큐레이션 세션 (/curation)
│   └── Reflection.jsx         ← 데일리 Reflection (/reflection)
├── wiki/
│   ├── tripleParser.js        ← graph.jsonl → 마크다운 페이지
│   ├── markdownDiffer.js      ← 편집 diff → 트리플 변경
│   └── components/WikiPage.jsx← 위키 뷰어/에디터
├── stores/
│   ├── wikiStore.js           ← graph.jsonl 인메모리 인덱스
│   ├── reflectionStore.js     ← 오늘의 Reflection 큐
│   ├── interventionStore.js   ← append 처리 + 프롬프트 빌더
│   └── curationStore.js       ← pending 메모 선택 상태
├── services/
│   ├── github.js              ← GitHubService (CRUD, JSONL 읽기/쓰기)
│   ├── auth.js                ← GitHub OAuth PKCE (WS/직접 듀얼모드)
│   ├── byokClient.js          ← BYOK AI 클라이언트 (Gemini/Claude/OpenAI)
│   ├── wikiCompiler.js        ← BYOK 컴파일 파이프라인
│   ├── interventionResolver.js← interventions RAG + 사용자 프로파일
│   ├── reflectionEngine.js    ← Prior 변화 감지, 드립 피드 스케줄링
│   ├── curationPipeline.js    ← 큐레이션 확정 → 컴파일 → graph append
│   ├── curationScheduler.js   ← 21시 브라우저 알림
│   ├── notify.js              ← Notification API wrapper (Capacitor 대비)
│   └── secureStorage.js       ← localStorage wrapper (Capacitor 대비)
├── sync/
│   ├── index.js               ← SyncManager + graph/interventions 동기화
│   ├── wsAdapter.js           ← WebSocket 어댑터
│   └── conflict.js            ← 충돌 해결 전략
└── utils/
    └── database.js            ← IndexedDB v6 (documents/graphCache/
                                  interventionsCache/reflectionsQueue/rawMemosCache)
```

### 3.4 외부 컴포넌트

| 컴포넌트 | 위치 | 역할 |
|---|---|---|
| ws-proxy | `ws-proxy/` + Fly.io | WebSocket → GitHub API 릴레이, JWT 세션 |
| open-notes-extractor | 별도 repo | Apple Notes JXA 추출 / Samsung Notes sdocx 파서 / 상시 데몬 |

---

## 4. 핵심 설계 원칙

### 4.1 Prior는 파일이다

graph.jsonl이 단일 진실원. 추상 개념이 아님.
모든 위키 렌더링은 이 파일의 파생 뷰. `/wiki/` 디렉토리 없음.

### 4.2 Intervention은 불변 제약

`interventions.jsonl`은 단순 로그가 아니라 AI 컴파일 시 시스템 프롬프트로 주입되는 **절대 룰**.
AI는 사용자가 한 번 확정한 결정을 재제안할 수 없다.
사용자 수정(위키 편집, Reflection reject/edit) = 가장 강력한 학습 신호.

### 4.3 습관의 보존

사용자는 Apple/Samsung Notes를 그대로 쓴다.
Meki는 그 아래에서 조용히 연결한다. "쓰기 도구"가 아니라 "의미 구축 도구."

### 4.4 수집(자동) → 큐레이션(의식적) → 컴파일(선택된 것만)

메모 저장 즉시 graph.jsonl에 들어가지 않는다.
매일 저녁 큐레이션 세션에서 사용자가 선택한 메모만 BYOK 컴파일된다.
시의성 = 메모 저장 시각이 아니라 매일 저녁의 **의식적 회고 시간**.

### 4.5 Anti-Bubble 투명성 (구조로서)

- Reflection 푸터: "왜 이걸 보여드리나요?" (rationale 필수)
- Counterfactual 가시화: "오늘 발행 안 된 후보 N개"
- 위키 직접 편집 가능 (Pull 채널)
- 알고리즘 통제권 UI (Phase 11)
- 단일 목적함수 없음 (watch time 최적화 안 함)

---

## 5. 발행 게이트 (신뢰도 두 축)

| 축 | 기준 | 역할 |
|---|---|---|
| **증거 강도** | Grounded / Bridged / Speculative | UI 메타데이터 (왜 제안했는지) |
| **Prior 관계** | Consistent / Extending / Tension | **발행 게이트** (보여줄 것인가) |

**MVP 규칙**: Extending만 발행. Tension은 Phase 11. Speculative는 Phase 11.

| Prior 관계 | 정의 | MVP 처리 |
|---|---|---|
| Consistent | 위키와 일치, 이미 확정됨 | Skip (기록만) |
| **Extending** | 위키에 없는 새 관계, 모순 없음 | **발행** ← MVP |
| Tension | 위키와 충돌 또는 패턴 변화 | Phase 11로 이월 |

---

## 6. 학습 루프 (ref-12 §3.3·§5.1·§5.4)

```
사용자 행동                          → interventions.jsonl
─────────────────────────────────────────────────────────
위키 페이지 편집 (추가)              → { type: 'edit', ... }
위키 페이지 편집 (삭제)              → { type: 'reject', ... } + wikiStore.removeTriples
Reflection accept                    → { type: 'approve', ... }
Reflection reject                    → { type: 'reject', scope: 'entity:...' }
Reflection edit                      → { type: 'edit', edited_update: {...} }
─────────────────────────────────────────────────────────
누적 후 → interventionResolver.buildUserModelProfile
       → buildProfilePrompt → 다음 BYOK 컴파일 시스템 프롬프트에 주입
       → AI가 같은 제안 재발생 불가 (영구 차단)
```

네 박자 루프:
```
1. AI가 만든다      → BYOK 컴파일로 메모 → 트리플 추출
2. diff가 드러낸다  → 과거 graph.jsonl vs 신규 트리플 차이 가시화
3. 사용자가 고친다  → Reflection 응답 + 위키 직접 편집
4. 수정이 AI를 바꾼다 → interventions.jsonl → 다음 컴파일 시스템 프롬프트
```

---

## 7. 개발 로드맵 (Phase별 현황)

| Phase | 내용 | 상태 |
|---|---|---|
| 1 | Security Foundation (CSP, DOMPurify, PKCE) | ✅ 완료 |
| 2 | WS Proxy Server (ws-proxy/ + Fly.io) | ✅ 완료 |
| 3 | Frontend Migration (Feature Flag) | ✅ 완료 |
| 4 | Security Debt + Auto-Save + Offline | ✅ 완료 |
| 5 | Vault Seed E2EE | ✅ 완료 |
| 7 | 문서 로딩 성능 최적화 (IndexedDB-first) | ✅ 완료 |
| 8 | UX 버그픽스 (Phantom 메모 정리) | ✅ 완료 |
| 9 | 크로스 기기 실시간 동기화 | ✅ 완료 |
| 10 | Reflection 시스템 (MekiSync, BYOK, graph.jsonl, 위키, Reflection UI) | ✅ 완료 |
| 10.5 | 큐레이션 세션 (수집→큐레이션→컴파일 3단계 분리) | ✅ 완료 |
| 10.6 | PWA 전환 (Service Worker, manifest, 실기기 알림) | ✅ 완료 |
| 10.7 | Reflection 학습 루프 완성 (위키 편집→intervention 배선) | ✅ 완료 |
| **11** | **Tension 감지 + Anti-Bubble 심화** | **⬜ 착수 대기** |
| 12 | 자아 시뮬레이터 + Prior fork 커뮤니티 | ⬜ 미착수 |

### Phase 11 상세 (다음 단계)

| 태스크 ID | 내용 | 의존성 |
|---|---|---|
| P11-T1 | Tension 감지 엔진 — 4종 하위 타입(모순/드리프트/신규/재배열) + 거짓 양성 필터 | — |
| P11-T2 | 시간축 임베딩 누적 분석 — Prior 시간 변화 추적, graph.jsonl 스냅샷 | — |
| P11-T3 | 캘린더/맥락 통합 — 로컬 캘린더 + 타임스탬프 + 노트 맥락 결합 | T1+T2 |
| P11-T4 | `relationship_id` 자동 태깅 엔진 | T3 |
| P11-T5 | 관계별 교정 타임라인 UI | T4 |
| P11-T6 | 자기 메타뷰 대시보드 (approve/reject 패턴, 드리프트 가시화) | T5 |
| P11-T7 | 알고리즘 환경설정 UI (다양성·counterprogramming·망각 보완) | T5 |
| P11-T8 | Consistent 주기적 재노출 (6개월 후 재평가 큐) | T6 |
| P11-T9 | Tension 정확도 검증 (거짓 양성률, 사용자 응답 패턴) | T1~T8 |

### ⚠️ UP-7 (선행 회귀 5건 — Phase 11 전 해소 권장)

| 파일 | 실패 원인 |
|---|---|
| `vaultFlow.test.jsx` | Phase 10 이전부터 실패 (학습 루프와 무관) |
| `storage-client.test.js` | `db.documents.where` undefined — DB mock 미설정 |
| `MigrationNotice.test.jsx` | 재로그인 버튼 클릭 후 dismiss 영속화 검증 실패 |
| `useAutoSave.test.js` | 제목 변경 시 unsaved 상태 감지 실패 |
| `IsolatedPreview.test.jsx` | iframe 커스텀 스타일 미적용 |

---

## 8. 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | React 18, Vite, Zustand, TanStack Query, Tailwind CSS |
| 에디터 | Toast UI Editor (WYSIWYG/Markdown) |
| 백엔드 | Vercel Serverless Functions (api/) |
| WS Proxy | Express + ws, Fly.io (Node.js 20) |
| 저장소 | GitHub REST/GraphQL API + GitHub Pages (Jekyll) |
| 오프라인 | IndexedDB (Dexie.js), Service Worker (Workbox) |
| AI | BYOK — Gemini 2.0 Flash / Claude 3.5 Haiku / OpenAI gpt-4o-mini |
| 인증 | GitHub OAuth PKCE + HttpOnly 쿠키 (WS 모드) |
| PWA | vite-plugin-pwa, Web Push API, Capacitor 대비 wrapper |
| 노트 추출 | JXA/AppleScript (macOS), PowerShell/sdocx (Windows) |

---

## 9. 보안 정책

| 항목 | 구현 |
|---|---|
| XSS 방어 | DOMPurify (sanitize.js), iframe sandbox (IsolatedPreview) |
| CSP | vercel.json — default-src 'self', connect-src GitHub API |
| OAuth | PKCE + State, HttpOnly 쿠키 세션, localStorage 토큰 미저장 |
| 토큰 관리 | WS 모드: 쿠키 기반, getToken() → null |
| E2EE | AES-GCM vault (vault.js), 강제 백업 UI |
| CORS | callback.js — origin 화이트리스트 제한 |

---

## 10. 문서 인덱스

| 문서 | 역할 |
|---|---|
| `PLAN.md` | 전체 개발 계획, 태스크별 상태 |
| `PROGRESS.md` | 실행 이력, 에이전트 세션 로그 |
| `SPEC.md` (이 파일) | 종합 스펙 요약 |
| `miki-editor/CONTEXT.md` | 에디터 컴포넌트 정의 |
| `.agents/references/ref-09` | Phase 10 전략 전환 의사결정 기록 |
| `.agents/references/ref-12` | Reflection 시스템 설계 SoT |
| `.agents/references/ref-07` | Prior fork + 바이럴 전략 (Phase 12) |
| `.agents/references/ref-03` | 소스 아키텍처 분석 |
| `miki-editor/PWA_TEST_CHECKLIST.md` | 실기기 PWA 검증 체크리스트 |
