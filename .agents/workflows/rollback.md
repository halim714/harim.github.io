---
description: 배포 또는 Feature Flag 전환 실패 시 자동 롤백 절차
---

# Rollback Protocol Workflow

이 워크플로우는 배포 실패 또는 Phase 3 Feature Flag 전환 실패 시 즉시 실행합니다.

> **원칙**: 롤백은 빠르게 실행하고, 원인 분석은 나중에. 사용자 피해 최소화 우선.

---

## Case A: Vercel 배포 롤백

```bash
# 즉시 롤백 (이전 성공 배포로)
cd /Users/halim/Desktop/meeki/meki/miki-editor
vercel rollback

# 롤백 확인
curl -I https://miki-editor.vercel.app | head -5
echo "롤백 완료: $(date)"
```

---

## Case B: Feature Flag 롤백 (Phase 3)

WS Proxy 연결이 불안정할 경우 Feature Flag만 OFF로 전환:

```bash
# Vercel 환경변수 즉시 변경
vercel env rm VITE_USE_WS_PROXY production
vercel env add VITE_USE_WS_PROXY production
# 값 입력: false

# 즉시 재배포 (환경변수만 바뀌므로 빠름)
vercel --prod
```

---

## Case C: Fly.io 롤백 (Phase 2)

```bash
# 이전 릴리즈 목록 확인
fly releases -a miki-ws-proxy | head -5

# 특정 버전으로 롤백
fly deploy --image <이전 이미지 ID> -a miki-ws-proxy

# 롤백 확인
curl https://miki-ws-proxy.fly.dev/health
```

---

## 롤백 후 필수 조치

1. `PROGRESS.md` 차단 태스크 섹션에 기록
2. `agent-improvement` 워크플로우 실행 (배포 실패 원인 → devops SOP 업데이트)
3. 사용자에게 롤백 완료 보고:

```markdown
## ⚠️ 롤백 완료 보고

**롤백 유형**: Vercel / Feature Flag / Fly.io
**롤백 시각**: [YYYY-MM-DD HH:MM]
**롤백 이유**: [한 줄 요약]
**현재 상태**: 이전 안정 버전으로 복원 완료
**다음 조치**: agent-improvement 실행 → devops SOP 업데이트 예정
```
