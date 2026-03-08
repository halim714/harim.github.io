---
id: ref-004
topic: meki-orchestration-architecture
created: 2026-02-25
tags: [meki, orchestration, opus, swarm, openrouter]
---

# Meki 개발 자동화 아키텍처 레퍼런스

## 이원 구조 (Role Inversion Architecture)

```
[Gemini]  목표 설정 / 최종 승인
     ↕  .meki-agents/handoff/ (파일 기반 핸드오프)
     │  status.json: IDLE→TASK_READY→PLANNING→PENDING_APPROVAL→APPROVED→EXECUTING→DONE
[Claude Code]  코드 분석 → 계획 생성(/plan-phase) → 자기검증(/review-plan) → 실행
       ↓  run-swarm.sh
┌──────────┬──────────┬──────────┐
│ Agent A  │ Agent B  │ Agent C  │  Claude Code Swarm
│frontend  │ api/svc  │ test     │
└──────────┴──────────┴──────────┘
       ↓
[Claude Code]  교차 검증 → agent-optimizer → SOP 개선 PR
```

### 역할 분담

| 역할 | Gemini | Claude Code |
|---|---|---|
| 목표 설정 | task.md 작성 | - |
| 계획 생성 | - | /plan-phase 실행 |
| 자기검증 | - | /review-plan 실행 |
| 승인 게이트 | approval.json 작성 | PENDING_APPROVAL 대기 |
| 실행 | - | 계획대로 스웜 실행 |
| 완료 보고 | notify_user | status.json → DONE |

## 에이전트 도구 전체 맵

### Roles (.agents/roles/) — 에이전트 SOP
- `frontend_dev.md` — UI/컴포넌트 스코프
- `api_dev.md` — 서비스/동기화/스토어 스코프
- `test_verify.md` — 검증/Meki 가치 체크
- `devops.md` — Fly.io/Vercel/Docker
- `security_auditor.md` — 보안 감사 (읽기 전용)

### Workflows (.agents/workflows/) — 오케스트레이터 워크플로우
- `swarm-manager.md` — 병렬 팀 배정·실행·결과 검증
- `agent-improvement.md` — 실패 시 .agents/rules/ 룰 생성
- `agent-optimizer.md` — SOP 메타 최적화 (SOP 버전업 PR)
- `phase-gate.md` — Phase 전환 조건 검증 게이트
- `deploy.md` — Vercel/Fly.io 표준 배포 절차
- `rollback.md` — 배포 실패 즉시 롤백

### Skills (.agents/skills/) — 반복 패턴 자동화
- `code-reviewer/` — 코드 품질 + Meki 가치 교차 리뷰
- `sop-writer/` — 실패 로그 → SOP 업데이트 초안 생성
- `progress-tracker/` — PLAN.md/PROGRESS.md 상태 갱신
- `reference-lookup/` — 레퍼런스 조회/등록

### Commands (.claude/commands/) — Claude Code 실행 커맨드
- `/start-session` — PLAN+PROGRESS 읽고 내 태스크 파악
- `/health-check` — 빌드+가치체크+SOP크기 종합 검증
- `/report-failure` — C1~C5 실패 보고서 생성
- `/update-progress` — 태스크 상태 갱신
- `/verify-meki-values` — Meki 가치 5항목 빠른 체크
- `/security-audit` — Phase별 보안 감사
- `/commit-task` — 표준 커밋 + 완료 처리

### Scripts (miki-editor/scripts/)
- `run-swarm.sh` — SOP role 자동 로드 스웜 실행
- `run-phase.sh` — Phase 단위 자동 배정·병렬 실행
- `health-check.sh` — 종합 헬스체크 스크립트

### 조율 파일 (프로젝트 루트)
- `PLAN.md` — 전체 계획 (Phase 1~5 태스크 테이블)
- `PROGRESS.md` — 실시간 진행 상황
- `AGENTS.md` — 스웜 구조 + 모델 라우팅
- `CLAUDE.md` (miki-editor/) — Claude Code 세션 컨텍스트

## 모델 라우팅

| 복잡도 | 모델 | 비용 |
|---|---|---|
| 단순 작업 | `claude-3-5-haiku-20241022` | 저가 |
| 일반 코딩 | `claude-3-5-sonnet-20241022` | 중가 |
| 아키텍처 판단 | `claude-opus-4` | 고가 (오케스트레이터만) |
