---
description: Phase 전환 게이트 — 현재 Phase의 모든 태스크가 완료되고 검증을 통과했는지 확인한 후 다음 Phase로 진행 허가
---

# Phase Gate Workflow

이 워크플로우는 Phase 1→2, 2→3, 3→4, 4→5 전환 시 반드시 실행합니다.
모든 조건이 통과되어야 다음 Phase의 첫 태스크를 배정할 수 있습니다.

## 실행 조건

- 현재 Phase의 마지막 태스크(`test_verify` 역할)가 완료 보고를 한 경우
- Antigravity가 Phase 전환을 고려할 때

---

## Step 1: 태스크 완료 체크

`PLAN.md`에서 현재 Phase의 모든 태스크 상태를 확인한다:

```bash
PHASE="P1"  # 완료 확인할 Phase
grep "^| ${PHASE}-" /Users/halim/Desktop/meeki/meki/PLAN.md | grep -v "✅"
# 출력이 없으면 모든 태스크 완료
```

- ✅ 모든 태스크 완료 → Step 2로
- ❌ 미완료 태스크 있음 → 해당 태스크 완료 후 재실행

## Step 2: 기술 검증 (phase별 기준)

### Phase 1 → Phase 2 전환 기준
```bash
# CSP 헤더 적용 확인
curl -I https://miki-editor.vercel.app | grep "Content-Security-Policy"

# DOMPurify 적용 확인  
grep -rn "DOMPurify\|sanitize" src/ | head -5

# PKCE 적용 확인
grep -rn "code_verifier\|code_challenge" api/auth/callback.js
```

### Phase 2 → Phase 3 전환 기준
```bash
# WS Proxy 헬스체크
curl https://miki-ws-proxy.fly.dev/health

# JWT 세션 동작 확인 (wscat 필요)
wscat -c wss://miki-ws-proxy.fly.dev --execute "ping"
```

### Phase 3 → Phase 4 전환 기준
```bash
# Feature Flag 양방향 동작 확인
# VITE_USE_WS_PROXY=false → Octokit 직접 연결
# VITE_USE_WS_PROXY=true  → WS Proxy 연결
grep "VITE_USE_WS_PROXY" src/services/github.js
```

### Phase 4 → Phase 5 전환 기준
```bash
# 오프라인 SyncQueue 동작 확인
grep -rn "pendingSync\|SyncQueue" src/utils/database.js | head -5

# SyncStatus UI 컴포넌트 존재 확인
ls src/components/SyncStatus.jsx 2>/dev/null && echo "✅" || echo "❌ 없음"
```

## Step 3: 보안 감사 (Phase 전환 시 필수)

`security_auditor` role 에이전트를 실행하여 현재 Phase의 보안 감사를 수행한다:

```bash
./scripts/run-swarm.sh "google/gemini-2.5-pro" \
  "현재 Phase [N] 구현에 대해 보안 감사를 수행하라. security_auditor SOP를 따를 것." \
  /Users/halim/Desktop/meeki/meki/miki-editor \
  security_auditor \
  phase[N]-security-audit
```

## Step 4: PROGRESS.md 업데이트 + 다음 Phase 배정

모든 조건 통과 시:
1. `PROGRESS.md`의 "현재 진행 Phase" 섹션을 다음 Phase로 업데이트
2. `PLAN.md`의 다음 Phase 첫 태스크 상태를 `⬜ → 🔄`로 변경
3. `PROGRESS.md` 오케스트레이터 메모에 다음 배정 기록

## Step 5: 보고

```markdown
## Phase [N] → Phase [N+1] 전환 완료

**완료 확인 태스크**: [P1-T1 ~ P1-T6]
**보안 감사**: 통과 (Critical 0건)
**다음 Phase 첫 태스크**: [P2-T1] — api_dev 에이전트 배정 예정
```
