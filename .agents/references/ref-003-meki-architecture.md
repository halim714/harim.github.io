---
id: ref-003
topic: meki-architecture
created: 2026-02-25
tags: [meki, architecture, source-analysis]
---

# Meki 소스코드 아키텍처 분석 레퍼런스

## 소스 구조 (miki-editor/src/)

```
src/
├── App.jsx              ← 라우팅 + AuthProvider (Context API)
├── pages/
│   ├── Editor.jsx       ← 메인 에디터 (MikiEditor + AiPanel + Sidebar)
│   ├── LoginPage.jsx
│   ├── CallbackPage.jsx ← OAuth 콜백
│   └── OnboardingSetup.jsx
├── stores/
│   ├── index.js         ← Zustand Main Store (Document + UI + Editor Slice)
│   └── documentStore.js ← SSoT: Map<id,doc> + localStorage persist
├── services/
│   ├── github.js        ← GitHubService (Octokit, CRUD, retry, GraphQL)
│   ├── auth.js          ← GitHub OAuth PKCE 토큰 관리
│   ├── ai.js            ← Gemini API 연동
│   ├── publish.js       ← PublishService (miki-data → github.io Jekyll)
│   └── documentSync.js  ← 동기화 정책
├── sync/
│   ├── index.js         ← SyncManager (singleton, Optimistic UI, SyncQueue)
│   ├── httpAdapter.js   ← REST (Octokit) 어댑터
│   ├── wsAdapter.js     ← WebSocket 어댑터 (Phase 2~)
│   └── conflict.js      ← 충돌 해결 전략
├── utils/
│   ├── database.js      ← IndexedDB (오프라인 캐시 + SyncQueue)
│   └── slugify.js       ← 한글 URL 슬러그 생성
├── hooks/
│   └── usePublish.js    ← publish/unpublish mutation (React Query)
└── components/          ← UI 레이어
```

## 핵심 데이터 흐름

### 문서 저장
```
편집 → DocumentSlice.setContent → useAutoSave
  → SyncManager.syncDocument → HttpAdapter(or WsAdapter)
  → GitHubService.createOrUpdateFile → GitHub API
```

### 오프라인 처리
```
SyncManager 오프라인 감지 → SyncQueue(IndexedDB) 적재
  → 재연결 → processPendingQueue → conflict.js → GitHub 반영
```

### 퍼블리싱
```
usePublish.js → PublishService
  → miki-data (private) + [username].github.io (public Jekyll)
```

## 주요 패턴

| 패턴 | 구현체 |
|---|---|
| Singleton | `SyncManager.getSyncManager()` |
| Optimistic UI | `syncDocument()` → 즉시 UI 반영 → 비동기 저장 |
| SSoT | `documentStore.js` → `Map<id, doc>` |
| Observer | `SyncManager.emit('sync_start')` |
| Adapter | `httpAdapter.js` / `wsAdapter.js` 교체 |
| Persist Middleware | Zustand `persist` → localStorage |

## 의존성

```
react, react-router-dom, zustand, @tanstack/react-query
@octokit/rest, clsx, dompurify, lucide-react
react-hook-form, react-markdown, react-syntax-highlighter
@tiptap/*, uuid
```

## GitHub 레포 구조

| 레포 | 가시성 | 용도 |
|---|---|---|
| `miki-data` | private | 개인 노트 원본 저장 |
| `[username].github.io` | public | Jekyll 블로그 (발행) |
