# AGENTS.md — Meki Swarm Agent Instructions

> 이 파일은 Claude Code 스웜 에이전트(실행부)의 역할과 운영 방식을 정의합니다.
> `swarm-manager` 워크플로우로 실행되는 모든 에이전트는 이 파일을 준수해야 합니다.

## 🚀 세션 시작 필수 절차 (MANDATORY STARTUP)

**어떤 코드 작업도 시작하기 전에 반드시 다음 두 파일을 읽어라:**

| 파일 | 경로 | 목적 |
|---|---|---|
| `PLAN.md` | `/Users/halim/Desktop/meeki/meki/PLAN.md` | 전체 개발 계획, 내 담당 태스크 확인 |
| `PROGRESS.md` | `/Users/halim/Desktop/meeki/meki/PROGRESS.md` | 현재 진행 상황, 완료 작업, 오케스트레이터 지시 |

읽은 후 확인:
- [ ] 내가 배정받은 태스크 ID는 무엇인가? (`PLAN.md`)
- [ ] 이미 완료된 작업을 중복 수행하지 않는가? (`PROGRESS.md`)
- [ ] 의존 태스크가 완료되었는가? (`PROGRESS.md`)

---

## 🧠 오케스트레이션 구조

```
┌─────────────────────────────────────────┐
│  Antigravity (Claude Opus)              │
│  역할: PM / 오케스트레이터              │
│  - 태스크 분석 및 하위 태스크 분할     │
│  - 스웜 실행 및 결과 교차 검증         │
│  - Meki 가치 적합성 최종 판단          │
│  - agent-improvement 트리거            │
└────────────────┬────────────────────────┘
                 │  태스크 분배 (run-swarm.sh)
     ┌───────────┼───────────┐
     ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Agent A  │ │Agent B  │ │Agent C  │
│Frontend │ │Service/ │ │Test/    │
│(UI 작업)│ │Logic    │ │Verify   │
│         │ │(비즈니스)│ │         │
│OpenRouter│ │OpenRouter│ │OpenRouter│
│cheap model│ │cheap model│ │cheap model│
└─────────┘ └─────────┘ └─────────┘
```

### 역할 정의

| 역할 | 담당 | 권장 모델 |
|---|---|---|
| **Antigravity (Opus)** | 기획·분배·검증·harness 개선 | claude-opus (Anthropic 직접) |
| **Agent A** | UI 컴포넌트, 레이아웃, CSS | `sonnet` (Claude Pro) |
| **Agent B** | 서비스 로직, API 연동, 상태관리 | `sonnet` (Claude Pro) |
| **Agent C** | 테스트 작성, 검증, 빌드 확인 | `haiku` (Claude Pro) |

---

## 🔧 환경 설정

### OpenRouter 설정

```bash
# .env.local (절대 커밋하지 마세요)
OPENROUTER_API_KEY=sk-or-v1-...
ANTHROPIC_API_KEY=sk-ant-...  # Opus 직접 호출 시
```

### run-swarm.sh 실행 방식

```bash
# SOP Role 포함 스웜 실행 (권장)
./scripts/run-swarm.sh <model> "<task_prompt>" <working_dir> <role> <task_id>

# role 종류: frontend_dev | api_dev | test_verify | none
# SOP 파일: .agents/roles/<role>.md 자동 로드 → --system-prompt로 주입

# 예시 — 프론트엔드 컴포넌트 작업
./scripts/run-swarm.sh "sonnet" \
  "SyncStatus.jsx 컴포넌트를 생성하라. SyncManager 이벤트를 구독하여 동기화 상태를 표시." \
  /Users/halim/Desktop/meeki/meki/miki-editor \
  frontend_dev \
  task-sync-status-ui

# 예시 — 서비스 레이어 작업
./scripts/run-swarm.sh "sonnet" \
  "IndexedDB pendingSync 테이블을 추가하고 SyncQueue를 구현하라." \
  /Users/halim/Desktop/meeki/meki/miki-editor \
  api_dev \
  task-phase4-syncqueue

# 예시 — 검증
./scripts/run-swarm.sh "meta-llama/llama-3.3-70b-instruct:free" \
  "Phase 4 구현 결과를 검증하라. Meki 가치 체크 및 빌드 확인." \
  /Users/halim/Desktop/meeki/meki/miki-editor \
  test_verify \
  task-phase4-verify
```

---

## 📋 스웜 에이전트 운영 원칙

### 원칙 1: 단일 책임 (Single Responsibility)
- 각 에이전트는 **하나의 명확한 스코프**만 담당한다
- 동일한 파일을 두 에이전트가 동시에 수정하지 않는다
- 의존 관계가 있으면 순차 실행한다

### 원칙 2: 자기검증 필수 (Self-Verification)
에이전트는 작업 완료 후 반드시 다음을 실행한다:

```bash
# 1. 빌드 확인
cd /Users/halim/Desktop/meeki/meki/miki-editor
npm run build 2>&1 | tail -20

# 2. 테스트 실행 (테스트 파일이 있을 경우)
npm test -- --watchAll=false 2>&1 | tail -30

# 3. 변경 내용 요약
git diff --stat
```

### 원칙 3: Meki 가치 준수 체크
작업 완료 전 반드시 확인:
- [ ] 데이터 주권 침해 없음 (miki-data 외부 전송 없음)
- [ ] 사유 흐름 방해 없음 (auto-save, offline 기능 무결)
- [ ] 위키 연결성 훼손 없음 (`[[link]]`, `#tag` 파싱 동작)
- [ ] harness 파이프라인 호환성 (`services/` 구조 유지)

### 원칙 4: 실패 보고 형식
에이전트가 실패하면 다음 형식으로 보고한다:

```
## 실패 보고
- 태스크 ID: <task_id>
- 실패 단계: [빌드/테스트/로직 오류/기타]
- 에러 메시지: <정확한 에러>
- 시도한 해결책: <설명>
- 실패 분류 추정: C1(컨텍스트) / C2(가치위반) / C3(스코프) / C4(검증부재) / C5(프롬프트모호)
```

---

## 📂 작업 파일 경로 규칙

| 영역 | 경로 |
|---|---|
| 소스 루트 | `miki-editor/src/` |
| 서비스 레이어 | `miki-editor/src/services/` |
| Zustand 스토어 | `miki-editor/src/stores/` |
| 동기화 레이어 | `miki-editor/src/sync/` |
| UI 컴포넌트 | `miki-editor/src/components/` |
| 커스텀 훅 | `miki-editor/src/hooks/` |
| 유틸리티 | `miki-editor/src/utils/` |
| 에이전트 룰 | `.agents/rules/` |
| 에이전트 워크플로우 | `.agents/workflows/` |
| 로그 출력 | `miki-editor/logs/` |

---

## 🔄 harness 진화 루프

```
에이전트 실행
  └─ 성공 → Opus 검증 → 완료 보고
  └─ 실패 → agent-improvement 실행
              └─ 실패 분류 (C1~C5)
              └─ .agents/rules/ 룰 생성
              └─ (필요 시) swarm-manager 워크플로우 수정
              └─ 개선된 하니스로 재실행
              └─ 사용자에게 Improvement Report 보고
```

---

## 📊 모델 라우팅 전략 (비용 최적화)

| 태스크 복잡도 | 모델 | 경로 |
|---|---|---|
| 단순 반복 (로그 추가, 리네임 등) | `meta-llama/llama-3.3-70b-instruct:free` | OpenRouter 무료 |
| 일반 코딩 (훅, 컴포넌트 작성) | `google/gemini-2.5-pro` | OpenRouter |
| 복잡한 아키텍처 판단 | `claude-opus-4` | Anthropic 직접 (Antigravity) |
| 긴 파일 분석 | `google/gemini-2.5-pro` | OpenRouter (긴 컨텍스트) |
