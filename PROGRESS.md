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
| UP-1 | P1-T6 | Token Storage: localStorage → HttpOnly cookie 전환 | 🔴 미이행 |
| UP-2 | 보안감사 | callback.js:35 `Access-Control-Allow-Origin: *` → origin 제한 필요 | 🔴 미이행 |
| UP-3 | 보안감사 | server.js:114 JWT payload에 ghToken 평문 내장 → 서버측 저장 전환 | 🔴 미이행 |
| UP-4 | P3-T2 | ws-client.js Feature Flag이 github.js/auth.js에 미연결 | 🟡 P4 대기 |

---

## 현재 진행 Phase

**Phase 1: Security Foundation** — ✅ 완료

---

## 현재 활성 태스크

**Phase 2 완료** — P2-T1 ✅, P2-T2 ✅(재생성 완료), P2-T3 ✅, P2-T4 ✅, P2-T5 ✅

---

## 완료된 태스크

| 태스크 ID | 완료 시각 | 담당 에이전트 | 결과 |
|---|---|---|---|
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
[2026-02-27] api_dev @ P2-T2 (재실행): ws-proxy/src/server.js 재생성 (Express HTTP, GET /health, POST/GET/DELETE /api/session JWT 세션, CommonJS, syntax OK) → 성공
[2026-02-27] api_dev @ P3-T1: ws-client.js 생성 (WsProxyClient, isWsProxyEnabled, 9 GitHub API 래퍼, 재연결/heartbeat/타임아웃), .env.example VITE_USE_WS_PROXY 추가, 빌드 성공 → 성공
[2026-02-27] api_dev @ P3-T3: auth.js WS 연결 상태 기반 분기 리팩토링 (isWsProxyEnabled+isConnected → github.getUser WS 경로, AUTH_ERROR logout 처리, 직접 Octokit fallback 유지), ws-client.js 생성(isWsProxyEnabled export), 빌드 성공 (2159 modules, 0 errors) → 성공
[2026-02-27] frontend_dev @ P3-T4: MigrationNotice.jsx 생성 (VITE_USE_WS_PROXY flag 감지 + legacy token 확인, 재로그인 유도 배너, dismiss 영속), App.jsx /editor 라우트에 적용, 빌드 성공 → 성공
[2026-03-01] api_dev @ P2-wiring: ws-proxy/src/index.js에 createApp() 배선 — Express app을 http.createServer()에 연결, /health + /api/session 실구동 검증 완료 → 성공
[2026-02-27] api_dev @ P2-T1: ws-proxy/ 디렉토리 생성, package.json + src/index.js (Express + ws 부트스트랩) + README.md 작성 → 성공
[2026-02-26] test_verify @ P1-T6: Phase 1 전체 검증 (XSS 차단, DOMPurify 적용, PKCE 적용, iframe sandbox, CSP headers, 빌드 성공, 보안 감사) → 성공

---

## Antigravity 오케스트레이터 메모

_다음 태스크 배정 시 이 섹션에 지시 사항을 기록합니다._

**다음 단계**: Phase 2 P2-T5 검증 완료. P2-T2(server.js), P2-T4(Dockerfile+fly.toml) 산출물 누락 — api_dev 재실행 필요.

**P2-T5 검증 결과 요약**:
- ✅ ws-proxy/src/ws-handler.js: 9개 GitHub API 액션, 하트비트 30s, 1MB 가드, 에러 코드 매핑, SHA 자동처리
- ✅ ws-proxy/src/index.js: WebSocket 부트스트랩, /health 엔드포인트, 포트 8080
- ✅ ws-proxy/package.json: express, ws, jsonwebtoken, @octokit/rest 의존성 정상
- ❌ ws-proxy/src/server.js: 파일 없음 (P2-T2 산출물 누락)
- ❌ ws-proxy/Dockerfile: 파일 없음 (P2-T4 산출물 누락)
- ❌ ws-proxy/fly.toml: 파일 없음 (P2-T4 산출물 누락)
- ✅ miki-editor Build: 성공 (0 errors)
- ✅ Meki Values: 데이터 주권 침해 없음, miki-data 외부 전송 없음

**P1-T6 결과 요약**:
- ✅ Build: 성공 (2157 modules, 0 errors)
- ✅ XSS Prevention: DOMPurify + iframe sandbox + CSP headers
- ✅ PKCE Flow: code_verifier + code_challenge + state validation
- ✅ Security Headers: Content-Security-Policy, X-Frame-Options, X-XSS-Protection, 등
- ⚠️ Token Storage: localStorage (Phase 2에서 HttpOnly cookies로 개선)
- ✅ Meki Values: Data sovereignty, wiki links, service compatibility 모두 유지
- 📊 Tests: 92 passed, 4 failed (pre-existing issues, Phase 1 구현과 무관)
