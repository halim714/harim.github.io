# SPEC_auth_session — OAuth + WS 세션 + 인증 게이트

> **도메인**: auth_session — OAuth + WS 세션 + 인증 게이트
> **코드 클러스터** (graphify graph.json): C2 + C13
> **관련 파일**: src/services/auth.js, src/App.jsx, api/auth/callback.js, ws-proxy/src/server.js, ws-proxy/src/ws-handler.js
> **관련 Phase**: Phase 1 (PKCE) + Phase 2 (WS Proxy) + Phase 3 (Feature Flag) + Phase 4-T0 (UP-1)
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **유저 요청**: OAuth 로그인 버튼 클릭 이벤트
- **보안 토큰**: GitHub OAuth Authorization Code (PKCE flow)
- **API/이벤트**: `services/auth.js` 인증 요청, WebSocket Proxy 연결 수립 이벤트

## 2. 출력 (Output)

- **상태 변경**: Zustand `useAuth` 스토어 내 인증 및 토큰 상태 (isAuthenticated = true)
- **보안 세션**: WS Proxy 연결 및 JWT 기반 세션 HttpOnly 쿠키/토큰 보존
- **UI 렌더링**: 인증 게이트 통과 후 Meki 메인 편집기 렌더링

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (PKCE 인증 성공)**: GitHub OAuth 콜백 시 PKCE code_verifier를 사용하여 발급된 토큰이 검증을 정상 통과해야 한다.
- [ ] **인수조건 2 (WS Proxy 세션 결합)**: 브라우저가 WebSocket Proxy 세션을 맺을 때, 인증 서비스(`auth.js`)가 유효한 세션 식별자를 제공해야 한다.
- [ ] **인수조건 3 (인증 보호 라우트)**: 비인증 유저는 메인 위키 편집기 화면으로 진입할 수 없으며 로그인 화면으로 리다이렉트되어야 한다.

## 4. 실패 모드 (Failure Modes)

- **인증 토큰 획득 실패**: GitHub API 응답 지연 또는 만료 시, 인증 보류 및 명확한 에러 경고 노출.
- **WebSocket Proxy 다운**: 실시간 동기화용 프록시 서버 통신 실패 시 Offline 모드로 즉시 Fallback 동작.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test`
- **자기검증 시나리오**: mock OAuth code를 전달하여 인증 완료 및 Zustand 스토어 데이터 갱신 여부 점검.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "auth"` (auth.js 서비스 구조 및 useAuth 훅 의존성)
  - `graphify explain "AuthProvider"` (React App root AuthProvider 설명)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

