---
name: architecture-context
description: Meki 프로젝트의 디렉토리 구조, 기술 스택, Role별 파일 스코프를 제공한다. 파일 위치를 파악해야 할 때 참조.
---

# Architecture Context — Meki 프로젝트 구조

---

## 디렉토리 구조

```
meki/
├── PLAN.md              ← 전체 계획 (읽기 전용)
├── PROGRESS.md          ← 진행 상황 (업데이트 가능)
├── AGENTS.md            ← 스웜 구조 설명
├── CLAUDE.md            ← 에이전트 핵심 규칙
├── .agents/
│   ├── roles/           ← 에이전트 SOP (frontend_dev, api_dev, test_verify)
│   ├── workflows/       ← 오케스트레이터 워크플로우
│   ├── skills/          ← 반복 패턴 자동화 (이 파일 포함)
│   └── references/      ← 레퍼런스 문서
├── .claude/commands/    ← Claude Code 슬래시 커맨드
└── miki-editor/         ← 프론트엔드 (Vite + React)
    ├── src/
    │   ├── components/  ← UI 컴포넌트 (MikiEditor, IsolatedPreview 등)
    │   ├── services/    ← API 연동 (github.js, ai.js, auth.js)
    │   ├── stores/      ← Zustand 상태관리 (useStore)
    │   ├── sync/        ← 동기화 (SyncManager, ConflictResolver)
    │   ├── utils/       ← 유틸리티 (database.js, sanitize.js)
    │   ├── hooks/       ← 커스텀 훅
    │   └── pages/       ← 라우트 페이지 (LoginPage, CallbackPage)
    ├── api/             ← Vercel 서버리스 함수
    ├── scripts/         ← 배포/스웜 스크립트
    └── vercel.json      ← CSP 헤더 + 라우팅 + CORS
```

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| Frontend | Vite + React 18, Zustand, TipTap/CodeMirror |
| 인증 | GitHub OAuth PKCE (LoginPage → CallbackPage → api/auth/callback) |
| 저장소 | GitHub API (Octokit) → miki-data(private) / username.github.io(public) |
| 오프라인 | IndexedDB + SyncQueue + Optimistic UI |
| 보안 | CSP headers, DOMPurify, iframe sandbox, PKCE + state |
| 배포 | Vercel (Frontend) + Fly.io (WS Proxy, 예정) |

---

## Role별 파일 스코프

| Role | 수정 가능 | 수정 금지 |
|---|---|---|
| `frontend_dev` | `src/components/`, `src/hooks/`, `src/pages/`, CSS | `src/services/`, `src/sync/`, `src/stores/` |
| `api_dev` | `src/services/`, `src/sync/`, `src/stores/`, `src/utils/`, `api/`, `vercel.json` | `src/components/` |
| `test_verify` | 테스트 파일, PROGRESS.md | 소스 코드 수정 금지 (읽기만) |
