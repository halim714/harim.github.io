# PLAN.md — Meki 개발 계획 (에이전트 공유)

> 이 파일은 **전체 개발 계획**입니다. 스웜 에이전트는 세션 시작 시 이 파일과 `PROGRESS.md`를 반드시 먼저 읽으세요.
> **수정 권한**: Antigravity(오케스트레이터)만 수정. 실행 에이전트는 읽기 전용.

---

## 프로젝트 목표

Meki = 개인 주권 에이전트 인프라 (1단계: GitHub 기반 마크다운 에디터)
현재 목표: 보안 강화 + 오프라인 동기화 + WS 프록시 마이그레이션

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
| P3-T1 | `api_dev` | `VITE_USE_WS_PROXY` env + `ws-client.js` | ⬜ 미시작 |
| P3-T2 | `api_dev` | `github.js` Feature Flag 브랜치 | ⬜ 미시작 |
| P3-T3 | `api_dev` | `auth.js` WS 연결 상태 기반 교체 | ⬜ 미시작 |
| P3-T4 | `frontend_dev` | `MigrationNotice.jsx` 재로그인 배너 | ⬜ 미시작 |
| P3-T5 | `test_verify` | Flag OFF/ON 동작 검증 + 서버/앱 실제 구동(vite dev) 후 WS 연결 상태 확인 (런타임 테스트 필수) | ⬜ 미시작 |

---

## Phase 4: Auto-Save + Offline

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P4-T1 | `api_dev` | IndexedDB `pendingSync` 테이블 확장 | ⬜ 미시작 |
| P4-T2 | `api_dev` | SyncQueue 해시 변경 감지 + 배치 동기화 | ⬜ 미시작 |
| P4-T3 | `api_dev` | `visibilitychange`/`beforeunload` 핸들러 | ⬜ 미시작 |
| P4-T4 | `frontend_dev` | `SyncStatus.jsx` UI 컴포넌트 | ⬜ 미시작 |
| P4-T5 | `test_verify` | 오프라인 편집→재연결→동기화 검증 | ⬜ 미시작 |

---

## Phase 5: Vault Seed E2EE (장기 목표)

_Phase 2~4 안정화 후 착수_

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P5-T1 | `api_dev` | `vault.js` AES-GCM 암복호화 | ⬜ 미시작 |
| P5-T2 | `frontend_dev` | `VaultSetup.jsx` 강제 백업 UI | ⬜ 미시작 |
| P5-T3 | `api_dev` | storage-client 파이프라인 암호화 | ⬜ 미시작 |
| P5-T4 | `test_verify` | 암복호화 라운드트립, 발행 흐름 검증 | ⬜ 미시작 |

---

## 상태 범례
- ⬜ 미시작
- 🔄 진행중 (PROGRESS.md 참고)
- ✅ 완료
- ❌ 실패 (agent-optimizer 실행 필요)
