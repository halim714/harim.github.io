---
id: ref-13
topic: plan-vs-spec-hierarchy
created: 2026-05-20
tags: [meta, design-rules, spec, plan, regression-prevention, anti-arbitrariness]
---

# PLAN vs SPEC 위계 — 자의적 설계 재발 방지

> 이 문서는 2026-05-20 인터랙티브 세션에서 사용자가 직접 도출한 메타 규칙을 보존한다. 미래 모든 Phase 작업에 적용.

## 1. 진단 — 동일 패턴의 사건 3건

이 위계가 부재하여 발생한 사건들. **공통 메커니즘**: 사용자가 준 발화보다 많이 쓴다. 학습 데이터의 "이런 명세는 보통 이런 형태"가 사용자 의도를 덮는다.

| 일자 | 사건 | 패턴 |
|---|---|---|
| 2026-05-13 15:10 | **단일 커밋 `f15198c`** (78 파일, 9,874줄) | PLAN.md 태스크 목록(P10-A1~F3, 23개)을 한 세션 swarm으로 일괄 생성. spec 없음. |
| 2026-05-13 | **P10-F1 Apple Bridge** | PLAN 한 줄 "JXA + localhost 임시 서버" → 에이전트가 JXA + localhost bridge 패턴 통째로 발명. 실 macOS에서 한 번도 실행 안 됨. |
| 2026-05-18 | **ref-09/12 자의 보강** | 사용자가 5줄 흐름(임포트→raw→안내→선택→graph + "20~30건/일")을 주자 인터랙티브 세션이 100줄로 부풀림. 자의 추가: "1주차 ≤10건/일", `max(14, ceil(total_pending/25))` 공식, 정렬 순서, 큐 재개 정책, "P10.8 결정 예정" 라벨 등. 후 사용자 진단으로 `git reset --hard origin/main` 폐기. |

## 2. 사용자 진단 (2026-05-20 직접 발화 인용)

> "현재에 보이는 모순점들은 모두 2026-05-13 15:10 단일 커밋(f15198c)에서 한꺼번에 만들어졌습니다. 그때 서비스 레이어, 스토어, 페이지, 컴포넌트, 위키 파서, MekiSync 전부 — 가 하나의 커밋으로 동시에 생성되었습니다."

> "요는 spec.md를 생성하지 않고 plan.md를 임의로 만들어 llm이 정크코드를 자의적으로 생성했다는 것입니다. 인수조건을 반드시 잡아놨어야 하는데 인수조건이 없이해서 완전히 제멋대로인 코드가 나왔습니다"

> "SPEC.md로부터 PLAN이 나와야하는거 아닌가요? 나는 PLAN.md가 테스크로서 작동하길 원합니다. 지금 플랜에 적혀있는것은 goals와 what에 대한것입니다."

## 3. 올바른 위계

```
SPEC  (인수조건의 진실원 — 입력/출력/실패 모드/검증 조건)
  │
  │ 도출
  ▼
PLAN.md  (검증 가능한 task 단위 — 각 task = "어떤 SPEC 절을 구현·검증")
  │
  │ 위임
  ▼
구현 (swarm 또는 수동 — 인수조건 통과해야 완료)
```

### 각 층의 책임

| 층 | 무엇 | 단위 |
|---|---|---|
| **SPEC** | 어떻게 동작해야 하는지의 명세 | 인수조건 (입력/출력/실패 모드) |
| **ref-XX** | WHY/설계 추론 | 결정 근거, 트레이드오프 |
| **PLAN.md** | 무엇을 할지의 task 목록 | "SPEC §X 인수조건 1~5 구현. 검증: A/B/C" |
| **구현** | 코드 | SPEC 통과해야 완료 |

### 잘못된 사용 vs 올바른 사용

| | 잘못 (f15198c 사건) | 올바름 |
|---|---|---|
| PLAN task 한 줄 | "P10-F1 Apple Bridge — Meki_Notes_Sync.app (JXA + localhost 임시 서버)" | "SPEC_notes_import §3 인수조건 1~6 구현. 검증: 가짜 메모 3건 fixture로 E2E 통과" |
| swarm 위임 시 | 한 줄 명세만 전달 → "그럴듯하게 만들어라" → 자의 발명 | 인수조건 명세 전달 → "이 조건 만족해라" → 검증 가능 코드 |
| 완료 판정 | "그럴듯해 보임" | "체크리스트 통과" |

## 4. 디렉토리 구조 결정 (2026-05-20 확정)

```
project-root/
├── CLAUDE.md                    ← 라우팅 + Graphify 쿼리 지시 (사용자 발화)
├── PLAN.md                      ← 현재 작업 상태 (SPEC 기반으로 재구조화 예정)
│
├── .claude/
│   ├── rules/
│   │   └── boundaries.md        ← 구조 변경 금지 가드레일
│   └── docs/
│       ├── SPEC_xss_security.md
│       ├── SPEC_auth_session.md
│       ├── SPEC_persist.md
│       ├── SPEC_sync_offline.md
│       ├── SPEC_vault_e2ee.md
│       ├── SPEC_publish.md
│       ├── SPEC_notes_import.md
│       ├── SPEC_curation.md
│       ├── SPEC_byok_compile.md
│       ├── SPEC_wiki_render.md
│       ├── SPEC_reflection.md
│       └── SPEC_intervention.md
│
└── .graphify/                   ← [TBD — 추후 결정]
    ├── raw/
    ├── wiki/
    └── schema.md
```

- 에이전트는 관련 도메인 SPEC만 필요할 때 로드 (라우팅 흐름)
- CLAUDE.md `## 작업 라우팅`:
  1. 관련 도메인 SPEC 확인 → `.claude/docs/SPEC_[domain].md` 참조
  2. 현재 구현 상태 확인 → `/graphify query "[작업 컴포넌트명]"`
  3. 변경 금지 항목 확인 → `.claude/rules/boundaries.md`
- 작업 완료 후: `/graphify update` 실행해서 wiki 동기화

## 5. SPEC 도메인 분할 (방식 Y 데이터 흐름) — 12개

ref-14 (graphify-cluster-to-spec-mapping) 참조.

## 6. 인터랙티브 세션 vs 백그라운드 swarm

| 모드 | 사용자 질문 | 결정 모호 시 |
|---|---|---|
| **백그라운드 swarm** (`run-swarm.sh`) | 금지 (무한 대기 위험) | 명세대로만 실행 |
| **인터랙티브 세션** | 필수 | **반드시 사용자 확인** |

두 모드 혼동 금지. 인터랙티브 세션에서 "효율을 위한 자의 채움"은 ref-09/12 사건의 패턴 그 자체.

## 7. 미래 작업에 적용할 검증 질문

새 명세를 작성하거나 swarm에 task를 위임하기 전 자문:

1. 이 task는 어떤 SPEC의 어떤 인수조건을 구현하는가?
2. 인수조건이 검증 가능한가? (통과/실패를 명확히 가릴 수 있나?)
3. 사용자가 직접 발화한 부분과 내 추정 부분이 구분되어 있나?
4. 줄 수가 사용자 발화보다 많아졌다면 자의 채움이 들어간 부분은 어디인가?

## 8. 폐기된 시도 (왜 폐기됐는지)

이전 세션에서 같은 문제를 해결하려고 시도했던 안:

- **CLAUDE.md에 "명세·설계 문서 작성 규칙" SOP 절 추가** (2026-05-19 커밋 `07d44a2`) → 사용자가 "극단적으로 보수적이게 설정됐다. 나는 모델의 능력을 극대화하기를 원합니다" 진단으로 `c597247`에서 revert
- 교훈: 모델을 묶어서 5줄 받으면 5줄만 쓰게 하는 건 능력 낭비. 해결책은 "투명한 구분"이지 "축소"가 아님. 인수조건이 있으면 모델은 자유롭게 능력 발휘하면서도 검증 가능.

## 9. 관련 파일

- `.claude/docs/SPEC_*.md` (12개) — 본 위계의 SPEC 층
- `.claude/rules/boundaries.md` — 가드레일
- `CLAUDE.md` — 라우팅
- `PLAN.md` — 향후 SPEC 기반 task 단위로 재구조화 예정
- ref-14-graphify-cluster-to-spec-mapping.md — 도메인 분할 근거
