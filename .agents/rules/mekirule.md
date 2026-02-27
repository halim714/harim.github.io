---
trigger: always_on
description: Meki 프로젝트의 핵심 가치, 아키텍처, 에이전트 운영 원칙
---

# Meki 프로젝트 컨텍스트

## 0. 에이전트 세션 시작 프로토콜 (MANDATORY STARTUP)

모든 에이전트는 **세션 시작 시 다음 두 파일을 반드시 먼저 읽어야** 한다:

1. **`PLAN.md`** (`/Users/halim/Desktop/meeki/meki/PLAN.md`)
   - 전체 개발 계획 (Phase 1~5)
   - 각 태스크의 담당 Role, 작업 내용, 현재 상태

2. **`PROGRESS.md`** (`/Users/halim/Desktop/meeki/meki/PROGRESS.md`)
   - 현재 진행 중인 Phase와 태스크
   - 완료된 태스크 목록
   - 최신 실패/SOP 이력
   - 오케스트레이터 메모

이 두 파일을 읽어야 **내가 담당해야 할 태스크가 무엇인지, 어디서부터 시작해야 하는지** 알 수 있다.

## 1. 정체성과 철학

**Meki = me + wiki** : 나만의 위키

기존 플랫폼(유튜브, 서브스택 등)은 완성된 생각의 공유에 최적화되어 있다. 이는 관점의 나열일 뿐, 생각이 쌓이고 연결되어 새로운 관점이 탄생하는 과정을 담지 못한다.

Meki는 글과 글을 이어서, 사람들이 스스로도 몰랐던 자기만의 관점을 발견하고 주관을 키워나가는 사적·유기적 공간이다.

**AI 시대와 Meki의 역할**: AI는 인간의 노동을 대체하지만, 신경계가 없고 생존을 걸고 적응하는 유한한 유기체가 아니기에 적합성을 판단하는 능력(포커싱)을 갖추지 못했다. 앞으로 인간에게 가장 중요한 능력은 "적합한지 판단하는 것"이며, 이를 위해 고유한 관점이 필요하다.

> **Meki의 본질적 목적: 인간의 관점(고유한 포커스)을 만드는 것**

## 2. 플랫폼 수립 방향

> "기록이 곧 에이전트가 된다. 에이전트가 일하고, 당신의 기록과 평가가 에이전트를 키운다."

Meki는 노트앱이 아니라 **개인 주권 에이전트 인프라**다:

```
[수집] Meki 노트 → [이해] GraphRAG → 개인 온톨로지
  → [컴파일] harness.md 자동 생성
  → [실행] Claude Code + GitHub Action 태스크 수행
  → [진화] 피드백 → 하니스 수정 PR → 사용자 승인 → 더 정밀한 하니스
```

**설계 원칙:**
- 원본 데이터는 절대 수정하지 않는다 (읽기 전용 파이프라인)
- 하니스 변경은 항상 PR로 — 사용자 동의 없이 자동 변경 없음
- **생성물이 아닌 하니스를 고친다** — 피드백은 항상 규칙 레벨로 매핑

## 3. 기술 스택 (현재 구현 기준)

- **Frontend**: Vite + React, Zustand(상태관리), TipTap/CodeMirror(에디터)
- **인증**: GitHub OAuth PKCE → `services/auth.js`
- **저장소**: `miki-data`(private 노트) + `[username].github.io`(public Jekyll 블로그)
- **GitHub 연동**: `services/github.js` — Octokit 래핑, 재시도, GraphQL
- **동기화**: `sync/index.js`(SyncManager) — HttpAdapter / WsAdapter / ConflictResolver
- **오프라인**: IndexedDB(`utils/database.js`) + SyncQueue + Optimistic UI
- **AI**: `services/ai.js` — Gemini API 연동, `AiPanel.jsx`
- **보안 로드맵**: CSP → DOMPurify → WS Proxy(Fly.io) → Vault Seed E2EE

## 4. 에이전트 운영 원칙 (Agent Operating Rules)

### 원칙 1: 하니스를 고친다 (Meta-Engineering over Code-Fixing)
에이전트가 잘못된 코드를 생성했을 때, **코드만 수정하지 마라.**
실패의 근본 원인을 파악하고, 해당 실패 클래스를 방지하는 룰을 `.agents/rules/`에 추가하거나 워크플로우를 개선하라.
실패 → 코드 패치가 아닌, 실패 → 하니스(룰/워크플로우) 개선이 항상 우선이다.

### 원칙 2: 에이전트 주도 검증 (Agent-Driven Verification)
사용자는 코드를 직접 검토하지 않는다. **에이전트가 테스트를 작성하고 터미널로 자기검증을 완료**해야 한다.
사용자가 검토하는 것은 코드 결과물이 아닌, 에이전트의 테스트 전략과 워크플로우의 적합성이다.

### 원칙 3: 컨텍스트 최소화 (Context Minimization)
에이전트 실패의 주요 원인은 컨텍스트 과다 또는 모호함이다.
새로운 실패 패턴이 발생하면 메인 프롬프트에 내용을 추가하는 대신, **새롭고 구체적인 규칙 파일 또는 서브워크플로우를 생성**하라.

### 원칙 4: Meki의 가치를 코드에 반영하라 (Value-Driven Development)
모든 새 기능은 Meki의 핵심 가치와 일치해야 한다:
- 사용자의 데이터 주권을 침해하는가?
- 사유의 흐름을 방해하는가?
- 위키 연결성(링크, 태그, 그래프)을 강화하는가?
- 향후 `harness.md` 파이프라인과 연결 가능한가?

### 원칙 5: 스웜 실패는 워크플로우 트리거 (Swarm Failure = Improvement Trigger)
스웜 에이전트(Claude Code)가 실패하면, 단순히 재실행하지 마라. **반드시 `agent-improvement` 워크플로우를 실행**하여 실패 원인을 룰 레벨로 매핑하라.

---

## 5. 개발 자동화 구조 (Orchestration Architecture)

Meki 개발은 **Antigravity(Opus) = PM/오케스트레이터 / Claude Code Swarm = 실행부** 이원 구조로 운영된다.

```
[Antigravity - Claude Opus]  ← 이 에이전트
  역할: 기획 · 태스크 분해 · 결과 검증 · harness 개선
  모델: claude-opus (최고 추론 품질)
       ↓  run-swarm.sh 로 병렬 실행
┌──────────┬──────────┬──────────┐
│ Agent A  │ Agent B  │ Agent C  │
│ Frontend │ Logic    │ Test     │
│ gemini   │ gemini   │ llama    │
│ (OpenRouter 저렴 모델)          │
└──────────┴──────────┴──────────┘
       ↓  결과 반환
[Antigravity]  교차 검증 → 실패 시 agent-improvement → harness PR
```

### 오케스트레이터(Antigravity)의 책임
1. **PRD → 태스크 리스트** 생성 (의존성 분석 포함)
2. **스웜 실행** (`swarm-manager` 워크플로우 사용)
3. **결과 교차 검증** — Meki 가치 체크 + 코드 품질 리뷰
4. **실패 시 `agent-improvement` 즉시 실행** (재실행 금지)
5. **harness 개선 PR 생성** → 사용자 승인 대기

### 실행 에이전트(Claude Code)의 책임
1. `CLAUDE.md` + `AGENTS.md` + `.agents/rules/` 룰 준수
2. 할당된 스코프만 수정 (타 에이전트 스코프 침범 금지)
3. 작업 완료 후 **자기검증 필수** (`npm test`, `git diff`)
4. 실패 시 **실패 보고 형식**으로 보고 (재시도 금지)

### 참조 파일
- `CLAUDE.md` — 프로젝트 아키텍처 + 절대 금지 사항
- `AGENTS.md` — 스웜 구조 + 모델 라우팅 + 실행 방법
- `.agents/rules/` — 세션마다 자동 로드되는 구체적 규칙들
- `.agents/workflows/swarm-manager.md` — 스웜 실행 절차
- `.agents/workflows/agent-improvement.md` — 실패 시 harness 개선 절차