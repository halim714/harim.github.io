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

## Phase 6: Stateless Session Architecture (BFF)

> 목표: "서버 재시작 시 세션 소멸" 문제의 근본적인 해결을 위해 서버 메모리 제약을 없애고, 암호화된 토큰을 포함한 100% Stateless JWT 쿠키 기반 아키텍처로 전환합니다.

| 태스크 ID | 담당 Role | 작업 내용 | 상태 |
|---|---|---|---|
| P6-T1 | `api_dev` | `ws-proxy/src/server.js` 토큰 암호화 (AES-256-GCM) 및 JWT 내장 체계 구현, `cookie` 패키지 추가 | ⬜ 미시작 |
| P6-T2 | `api_dev` | `ws-proxy/src/ws-handler.js` 연결 시 쿠키 파싱, 복호화 및 WS 객체에 ghToken 바인딩, `dispatch` 간소화 | ⬜ 미시작 |
| P6-T3 | `frontend_dev` | `miki-editor` 내 `ws-client.js`, `CallbackPage.jsx`, `auth.js`의 `sessionId` 상태 관리 로직 일체 제거 | ⬜ 미시작 |
| P6-T4 | `test_verify` | Fly.io 재시작 시뮬레이션 및 새로고침 시 세션 복구 동작 E2E 검증 | ⬜ 미시작 |

---

## Plan (Claude Code 생성)
생성일: 2026-03-07T13:10:00Z
iteration: 1

### 아키텍처 변환 요약

```
[현재: Stateful]
POST /api/session → ghToken 서버 메모리(sessionStore Map)에 저장 → sessionId를 JWT sid에 포함
WS message: { id, action, sessionId } → getGitHubToken(sessionId) 조회

[Phase 6: Stateless]
POST /api/session → ghToken을 AES-256-GCM으로 암호화 → enc_token을 JWT payload에 포함
WS connect: meki_session 쿠키 파싱 → JWT 검증 → enc_token 복호화 → ws.ghToken 바인딩
WS message: { id, action, payload } (sessionId 필드 없음)
```

### 수정 파일 목록

| 파일 | 변경 내용 | 의존 태스크 |
|---|---|---|
| `ws-proxy/src/server.js` | sessionStore 제거, AES-256-GCM 암호화 추가, JWT에 enc_token 저장, getGitHubToken 제거 | P6-T1 |
| `ws-proxy/src/ws-handler.js` | getGitHubToken import 제거, 연결 시 쿠키 파싱·JWT 검증·복호화, ws.ghToken 바인딩, dispatch 간소화 | P6-T2 (P6-T1 이후) |
| `miki-editor/src/services/ws-client.js` | _sessionId 변수 제거, setSessionId export 제거, sessionId 메시지 필드 제거 | P6-T3 |
| `miki-editor/src/pages/CallbackPage.jsx` | setSessionId import·호출 제거 | P6-T3 |
| `miki-editor/src/services/auth.js` | checkWsSession()의 setSessionId 블록 제거 | P6-T3 |

### 태스크 의존성 그래프

```
P6-T1 (server.js) → P6-T2 (ws-handler.js)
P6-T3 (frontend) — 독립 (P6-T1/T2와 병렬 가능)
P6-T4 (검증) — P6-T1 + P6-T2 + P6-T3 완료 후
```

### 각 태스크 상세

---

#### P6-T1: ws-proxy/src/server.js — Stateless JWT (AES-256-GCM)

**파일**: `ws-proxy/src/server.js`

**제거할 코드 (실제 확인)**:
- L38: `const sessionStore = new Map();` — 서버 메모리 세션 저장소 전체
- L46-L49: `function getGitHubToken(sessionId)` 전체 함수
- L52-L60: `setInterval` 만료 세션 정리 코드
- L144-L152: `sessionStore.set(sessionId, {...})` 블록
- L154-L158: JWT payload의 `sid: sessionId` 필드
- L172-L176: response body의 `sessionId` 필드

**추가할 코드**:
```js
// AES-256-GCM 암호화 헬퍼
const ENCRYPTION_KEY = (() => {
    const raw = process.env.ENCRYPTION_KEY || 'meki-dev-enc-key-change-in-production';
    return crypto.scryptSync(raw, 'meki-salt', 32); // 32바이트 키
})();

function encryptToken(plainText) {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptToken(encoded) {
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const encrypted = buf.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
}
```

**POST /api/session 수정**:
```js
// 기존: sessionStore에 저장 + JWT에 sid
const payload = {
    sub: String(user.id),
    login: user.login,
    enc_token: encryptToken(githubToken)  // AES-256-GCM 암호화된 토큰
};
// Response: sessionId 필드 제거
return res.status(201).json({
    expiresIn: JWT_EXPIRES,
    user: { login: user.login, id: user.id, avatar_url: user.avatar_url }
});
```

**GET /api/session 수정** (L187-193):
```js
const { sub, login, exp } = req.session;
res.json({
    valid: true,
    user: { login, id: sub },
    expiresAt: exp ? new Date(exp * 1000).toISOString() : null
    // sessionId 필드 제거
});
```

**exports 수정** (L258):
```js
module.exports = { createApp, decryptToken }; // getGitHubToken 제거
```

**호출자 영향**:
- `ws-handler.js`: `getGitHubToken` import 제거 → `decryptToken` import 추가
- `CallbackPage.jsx`: response에서 `sessionId` 읽는 코드 제거 (P6-T3)

---

#### P6-T2: ws-proxy/src/ws-handler.js — 연결 시 인증

**파일**: `ws-proxy/src/ws-handler.js`

**현재 코드 (실제 확인)**:
- L25: `const { getGitHubToken } = require('./server');` — 제거
- L298-L313: `dispatch()` 내 sessionId/token 분기 전체 — 제거
- L434: `await dispatch(msg)` — `await dispatch(ws, msg)` 로 변경

**추가할 코드 (상단)**:
```js
const jwt = require('jsonwebtoken');
const { decryptToken } = require('./server');
const JWT_SECRET = process.env.JWT_SECRET || 'meki-dev-secret-change-in-production';

// 쿠키 헤더 파서 (외부 패키지 없이)
function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach(part => {
        const eqIdx = part.indexOf('=');
        if (eqIdx < 0) return;
        const name = part.slice(0, eqIdx).trim();
        const val = part.slice(eqIdx + 1).trim();
        try { cookies[name] = decodeURIComponent(val); } catch { cookies[name] = val; }
    });
    return cookies;
}
```

**handleWsConnection 수정** — 연결 시 인증 블록 추가 (L371 아래):
```js
function handleWsConnection(ws, req) {
    // ── 연결 시 인증 ─────────────────────────────────────────────────────
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies.meki_session;
    if (!sessionToken) {
        ws.send(fail(null, 'Authentication required', 'UNAUTHENTICATED'));
        ws.close();
        return;
    }
    try {
        const payload = jwt.verify(sessionToken, JWT_SECRET);
        ws.ghToken = decryptToken(payload.enc_token);
        ws.wsLogin = payload.login;
    } catch (err) {
        ws.send(fail(null, 'Invalid or expired session', 'UNAUTHENTICATED'));
        ws.close();
        return;
    }
    // ... 기존 heartbeat/message 처리 계속
```

**dispatch 함수 수정** (L298-L360):
```js
// 변경 전: async function dispatch(msg) { ... token/sessionId 분기 ... }
// 변경 후:
async function dispatch(ws, msg) {
    const { id, action, payload = {} } = msg;

    if (action === 'ping') {
        return ok(id, { pong: true, ts: Date.now() });
    }

    const resolvedToken = ws.ghToken;
    if (!resolvedToken) {
        return fail(id, 'Missing authentication token', 'UNAUTHENTICATED');
    }
    // ... 이하 기존 Octokit 처리 코드 동일 ...
```

**dispatch 호출 수정** (L434):
```js
// 변경 전: const response = await dispatch(msg);
// 변경 후:
const response = await dispatch(ws, msg);
```

**호출자 영향**: 없음 (내부 함수 시그니처 변경만)

---

#### P6-T3: miki-editor — sessionId 제거

**파일 1**: `miki-editor/src/services/ws-client.js`

현재 코드 (실제 확인):
- L23: `let _sessionId = null;` — 제거
- L30-L32: `export function setSessionId(sid) { _sessionId = sid; }` — 제거
- L94: `_sessionId = null;` (auth error 핸들러 내) — 제거
- L162: `const message = JSON.stringify({ id, action, payload, sessionId: _sessionId });`
  → `const message = JSON.stringify({ id, action, payload });`

**파일 2**: `miki-editor/src/pages/CallbackPage.jsx`

현재 코드 (실제 확인):
- L5: `import { setSessionId } from '../services/ws-client';` — 제거
- L77-L79: `if (sessionData.sessionId) setSessionId(sessionData.sessionId);` — 제거

**파일 3**: `miki-editor/src/services/auth.js`

현재 코드 (실제 확인):
- L72-L75: setSessionId 블록 제거
  ```js
  // 제거 대상:
  if (data.sessionId) {
      const { setSessionId } = await import('./ws-client');
      setSessionId(data.sessionId);
  }
  ```

**호출자 영향**:
- `setSessionId` export 제거 시 → CallbackPage.jsx와 auth.js의 import도 함께 제거 (동일 태스크)
- ws-client.js 수정 후 `miki-editor` 빌드 검증 필수

---

#### P6-T4: 검증

**빌드 검증**:
```bash
cd /Users/halim/Desktop/meeki/meki/miki-editor && npm run build
```

**정적 분석 검증**:
- `sessionId`가 WS 메시지에 포함되지 않는지 확인
- `sessionStore` Map이 server.js에 없는지 확인
- `getGitHubToken` 함수가 제거되었는지 확인
- `enc_token` 필드가 JWT payload에 포함되는지 확인

**런타임 시뮬레이션** (서버 재시작 내성):
- ws-proxy 재시작 후에도 기존 HttpOnly 쿠키(JWT)로 WS 인증이 성공해야 함
- 단, `ENCRYPTION_KEY`와 `JWT_SECRET`이 환경변수로 고정되어 있어야 함 (Fly.io secrets)

---

## 상태 범례
- ⬜ 미시작
- 🔄 진행중 (PROGRESS.md 참고)
- ✅ 완료
- ❌ 실패 (agent-optimizer 실행 필요)
