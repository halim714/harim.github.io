---
description: Meki 배포 파이프라인 — Vercel(프론트엔드)과 Fly.io(WS 프록시) 배포를 표준화하는 워크플로우
---

# Deploy Pipeline Workflow

이 워크플로우는 코드 변경 후 스테이징/프로덕션 배포 시 사용합니다.
`devops` role 에이전트 또는 Antigravity가 직접 실행합니다.

---

## A. Vercel 배포 (miki-editor)

### Preview 배포 (PR 검토용)

```bash
cd /Users/halim/Desktop/meeki/meki/miki-editor
vercel
# → Preview URL 출력됨
```

### Production 배포 (main 브랜치 merge 후)

```bash
cd /Users/halim/Desktop/meeki/meki/miki-editor
vercel --prod
```

**배포 후 확인**:
```bash
# healthcheck
curl -I https://miki-editor.vercel.app | head -5

# CSP 헤더 확인 (Phase 1 이후)
curl -I https://miki-editor.vercel.app | grep "Content-Security-Policy"

# Feature Flag 환경변수 확인
vercel env ls production 2>/dev/null | grep VITE
```

---

## B. Fly.io 배포 (miki-ws-proxy, Phase 2 이후)

### 초기 배포

```bash
cd /path/to/miki-ws-proxy
flyctl auth login
fly apps create miki-ws-proxy
fly deploy
```

### 업데이트 배포

```bash
cd /path/to/miki-ws-proxy
fly deploy --config fly.toml
```

**배포 후 확인**:
```bash
# 헬스체크
curl https://miki-ws-proxy.fly.dev/health

# 로그 확인 (30초)
fly logs -a miki-ws-proxy --no-tail &
sleep 30 && kill $!

# WS 연결 테스트
wscat -c wss://miki-ws-proxy.fly.dev --execute '{"type":"ping"}'
```

---

## 배포 실패 시

```bash
# Vercel 롤백
vercel rollback

# Fly.io 롤백 → rollback.md 워크플로우 실행
```

배포 실패 시 `rollback.md` 워크플로우를 즉시 실행하십시오.
