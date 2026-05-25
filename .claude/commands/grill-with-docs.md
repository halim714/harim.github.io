# grill-with-docs (방법 A + C 강제 적용 버전)

기존 도메인 모델과 실제 코드 사실에 기반하여 사용자 계획을 압박 검증하는 인터뷰 세션.
이 세션은 **1단계: 강제 코드 조회 및 캐시 생성**과 **2단계: 캐시 기반 압박 인터뷰**의 2단계 구조로 엄격하게 분리되어 진행됩니다. 에이전트가 실제 코드 대조 없이 짐작과 추론으로 명세(SPEC)를 자의 작성하는 문제를 구조적으로 차단합니다.

**사용법:** `/grill-with-docs [도메인 또는 주제]`
- 예시: `/grill-with-docs SPEC_xss_security`

> [!IMPORTANT]
> **캐시 의존성 (방법 A)**: 본 세션은 대상 도메인의 코드 분석 캐시 파일(`.agents/grill-cache/[domain].json`)이 존재할 때만 2단계 인터뷰를 진행할 수 있습니다. 캐시가 없다면 에이전트는 즉시 **Step 1**로 진입하여 코드를 강제로 전수 조회하고 캐시를 생성해야 합니다.

---

## 핵심 동작 — 압박 인터뷰

세션은 다음 원칙으로 작동합니다.

1. **한 번에 질문 하나**. 사용자 응답을 받은 뒤에야 다음으로 진행. 묶음 질문 금지.
2. **각 질문에 권장 답안을 제시**. 사용자는 ✅ / ✏️ 수정 / ❌ 거절로 판정만 하면 됨.
3. **사용자 발화로 채울 수 있는 부분은 코드 조사로 대체하지 않음** — 사용자가 답할 수 있는 것을 추측하지 말 것.
4. **사용자가 답할 수 없는 부분은 코드를 직접 읽고 사실을 제시**. graphify, Read, Grep 활용.

원본 출처: https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/

---

## 인터뷰가 해야 하는 5가지

### 1. 용어 충돌 플래그
사용자 발화가 Meki의 기존 도메인 정의와 다르면 즉시 지적.
- "당신 발화의 X는 `CLAUDE.md SPEC 인덱스`의 X 도메인과 다른 의미입니다 — 어느 쪽인가요?"
- 예: 사용자가 "동기화"라고 했는데 `SPEC_persist`(저장 정책)와 `SPEC_sync_offline`(흐름 정책) 중 어느 쪽인지 모호한 경우.

### 2. 퍼지 개념 날카롭게
모호하거나 과부하된 용어 → 정확한 정식 용어 제안.
- 예: "메모" → "raw 메모(`SPEC_curation` §1)" vs "위키 트리플(`SPEC_byok_compile` §2)" vs "Reflection 카드(`SPEC_reflection` §1)"

### 3. 시나리오 압박
구체적 엣지 케이스로 경계 조건 강제 명확화.
- "사용자가 메모를 메모 큐레이션에서 좌우 스와이프 도중 앱이 종료되면?"
- "BYOK 호출이 토큰 한도 초과로 실패하면 raw 메모는 어디 머무는가?"

### 4. 코드 vs 발화 대조
사용자 주장 vs 실제 구현 충돌 시 즉시 지적.
- 발화: "메모 큐레이션는 DOMPurify로 보호된다"
- 코드: `MemoCard.jsx:124`는 React JSX 텍스트 보간만 사용, DOMPurify 호출 없음
- → "실제 코드는 React 자동 escape에 의존합니다 — 어느 게 맞나요?"

### 5. 결정 즉시 캡처 (배치 금지)
용어/인수조건/정책이 확정되는 순간 바로 해당 파일을 갱신.
- 세션 끝에 한꺼번에 정리하지 않음 — 사용자가 마음 바꾸기 전에 박제.

---

## Meki 파일 매핑 (원본 ↔ Meki)

| 원본 grill-with-docs | Meki 대응 |
|---|---|
| `CONTEXT.md` (글로서리) | `CLAUDE.md` §SPEC 도메인 인덱스 (12개) |
| `docs/adr/0001-*.md` (ADR) | `.agents/references/ref-NNN-*.md` (`/save-ref`로 생성) |
| 단일/멀티 컨텍스트 추론 | 12개 SPEC 도메인 중 어느 것에 속하는지 추론 |
| 라이브 문서 갱신 | `.claude/docs/SPEC_[domain].md` §1~§5 인수조건 즉시 갱신 |

---

## 글로서리 충돌 처리 규칙

Meki의 글로서리는 **CLAUDE.md SPEC 인덱스 12개**입니다. 세션 중 사용자 발화가 다음과 충돌하면 즉시 플래그:

- 동일 용어가 여러 SPEC 도메인에 등장 (예: "메모" — raw/triple/card 중 어느 것?)
- SPEC 도메인 경계를 넘는 책임 주장 (예: "메모 큐레이션에서 GitHub push" — 이건 `SPEC_persist` 또는 `SPEC_sync_offline` 책임)
- 기존 ref-XX 문서가 이미 다른 결정을 기록한 경우

해결 후 SPEC 또는 ref-XX 파일 즉시 갱신.

---

## ref-XX 생성 조건 (3가지 모두 참)

세션 도중 새 ref-XX를 만들어야 할지 판단할 때 다음 3가지를 모두 충족해야 함:

1. **되돌리기 어렵다** — 나중에 마음 바꾸는 비용이 큰 결정
2. **맥락 없이 보면 놀랍다** — 미래에 코드를 본 사람이 "왜 이렇게 했지?" 묻게 됨
3. **실제 트레이드오프 결과** — 진짜 대안이 있었고 특정 이유로 선택함

세 조건이 모두 참이 아니면 `/save-ref` 호출하지 말 것. 그냥 결정대로 진행.

### 자격 있는 결정 예시
- 아키텍처 형태 (예: "BYOK API 호출은 클라이언트 사이드에서만 — 서버는 토큰 보관 안 함")
- 컨텍스트 간 통합 패턴 (예: "Reflection은 스케줄 아닌 메모 저장 즉시 이벤트로")
- 락인 있는 기술 선택 (예: "Dexie 대신 raw IndexedDB")
- 경계·범위 결정 (예: "메모 큐레이션는 평문만 — 마크다운 렌더링 안 함")
- 의도적 비표준 (예: "interventions.jsonl은 append-only — DB 안 씀")
- 코드에 안 보이는 제약 (예: "사용자 데이터 Meki 서버 미도달")
- 기각된 대안 (예: "iframe 대신 React-만 — 큐레이션 성능")

---

## SPEC 갱신 즉시 캡처 형식

용어/인수조건/정책 확정 시:

1. 해당 `.claude/docs/SPEC_[domain].md` §1~§5 중 적절한 절 갱신
2. 변경 줄에 출처 표시: `<!-- grilled YYYY-MM-DD: 사용자 발화 → 코드 사실 대조 -->`
3. 가드레일 영향 시 `.claude/rules/boundaries.md` 갱신 (구조 변경 금지 항목 추가)

---

## 실행 절차 (2-Step Pipeline)

### [Step 1] 강제 코드 조회 및 캐시 생성 (건너뜀 절대 금지)
에이전트는 `/grill-with-docs`가 시작되면 가장 먼저 `.agents/grill-cache/[domain].json` 파일이 있는지 확인합니다. 

1. **캐시 파일 미존재 시**:
   - 에이전트는 즉시 **코드 전수 검증 서브에이전트(Subagent)** 혹은 **자체 검증 루틴**을 실행합니다.
   - `graphify query "[도메인 핵심 키워드]"`를 실행하여 관련된 모든 연결 구조(callers, dependencies)를 파악합니다.
   - 파악된 모든 호출처(caller) 및 주요 소스코드 파일을 `view_file` 또는 `grep`으로 직접 열어 팩트를 검증합니다.
   - 수집된 모든 사실(실제 렌더링 경로, 사용 라이브러리, 변수명, API 스키마, 호출 관계 등)을 테이블과 JSON 포맷으로 정리합니다.
   - `.agents/grill-cache/` 디렉토리에 분석 결과를 `.agents/grill-cache/[domain].json` 파일로 저장합니다. 이 캐시가 없으면 PreToolUse hook이 SPEC 편집을 도구 레벨에서 차단합니다.
   - 생성 완료 후 분석된 팩트 테이블을 사용자에게 즉시 보고하고, **1단계 완료**를 선언합니다. 이 단계에서는 절대 스펙이나 인수조건 질문/제안을 하지 않습니다.
2. **캐시 파일 존재 시**:
   - 캐시 JSON 파일을 파싱하여 화면에 실제 코드 팩트(Fact) 요약 테이블을 먼저 렌더링하고, 사용자에게 이 팩트가 맞는지 최종 확인을 받습니다.

---

### [Step 2] 캐시 기반 압박 인터뷰
사용자가 Step 1의 코드 팩트 요약 테이블을 검토하고 승인한 경우에만 인터뷰가 개시됩니다.

1. **컨텍스트 매핑**: 캐시된 데이터와 `SPEC_[domain].md` 파일, 관련 `.agents/references/`를 로드합니다.
2. **인수조건의 코드 팩트 대조**:
   - SPEC §1 (입력)부터 한 줄씩 **캐시된 실제 코드 팩트**와 직접 대조합니다.
   - 실제 코드 팩트와 어긋나거나, 존재하지 않는 변수/스토어/이벤트를 묘사하고 있다면 즉시 수정 인수조건을 제안합니다.
   - **한 번에 단 하나의 질문만** 사용자에게 던집니다. 묶음 질문은 절대 금지합니다.
3. **결정 즉시 갱신 및 저장**:
   - 사용자가 제안을 승인(✅)하거나 수정(✏️)하면, 즉시 `SPEC_[domain].md`을 업데이트하고 `<!-- grilled YYYY-MM-DD: ... -->` 태그를 남깁니다.
   - 만약 보존 가치가 높은 결정(Architecture Decision)이라면 `/save-ref` 명령을 사용자에게 권장하여 ADR을 생성합니다.
4. **종료 시 최종 보고**:
   - 갱신된 SPEC 및 규칙 파일 목록
   - 미해결 [TBD] 항목 목록
   - 새로 생성된 ref-XX 번호

---

## 주의 사항 (Strict Guardrails)

- **추론/추측 제안 절대 금지**: 캐시 파일(`.agents/grill-cache/[domain].json`)에 명시적으로 검증되지 않은 가상의 코드 동작을 기반으로 인수조건을 작성하거나 질문하지 마십시오.
- **캐시 강제화**: 캐시 파일이 없는 상태에서 Step 2 인터뷰로 바로 건너뛰려는 에이전트의 시도는 규칙 위반으로 처리됩니다.
- **1회 1질문**: 사용자의 피드백을 완전하게 수렴하기 위해 한 턴에 오직 하나의 항목만 논의하십시오.
- **세션 범위 제어**: 세션 길이가 SPEC 한 도메인의 §1~§5 분량을 초과하여 대화가 비대해지면 즉시 세션을 끊고 다음 세션으로 분할하십시오.

---

## 강제 메커니즘 (Enforcement) — 결정 2026-05-21

LLM의 자율 준수만으로는 Step 1 → Step 2 순서가 보장되지 않음 (이전 SPEC_xss_security 세션에서 실제로 위반 발생). 따라서 두 계층의 강제를 적용:

### 두 계층 강제

1. **소프트 가드 (이 문서)**: 본 SKILL 본문이 LLM 프롬프트로 주입되어 자율 준수 유도.
2. **하드 가드 (PreToolUse Hook → 외부 스크립트 호출)**:
   - `.claude/settings.json`의 PreToolUse 훅이 `Edit` / `Write` / `MultiEdit` 도구의 `file_path`가 `.claude/docs/SPEC_*.md`인 경우 트리거됨.
   - 훅은 **복잡한 판단을 직접 수행하지 않음** — `scripts/validate-grill-cache.sh [domain]` 외부 스크립트를 호출.
   - 스크립트가 다음을 검증:
     - 캐시 파일 `.agents/grill-cache/[domain].json` 존재
     - JSON 스키마 통과 (`schema_version`, `coverage`, `facts[].type`, `unchecked_callers` 등 필수 필드)
     - `coverage`가 SPEC 도메인의 최소 요건 충족
     - stale 아님 (캐시 `generated_at` > `coverage.files_read[]` 파일들의 mtime 최댓값)
   - 실패 시 exit 코드 비-0 → 훅이 도구 호출 차단 + 실패 사유 stderr로 사용자에게 표출.

### 캐시 JSON 스키마 (v1)

```json
{
  "schema_version": "1",
  "domain": "SPEC_xss_security",
  "generated_at": "2026-05-21T11:00:00Z",
  "coverage": {
    "graphify_queried": true,
    "graphify_bfs_depth": 2,
    "files_read": ["miki-editor/src/utils/sanitize.js", "miki-editor/src/components/IsolatedPreview.jsx"],
    "unchecked_callers": [
      {"callee": "X", "reason": "graphify BFS 범위 밖", "file_hint": "src/..."}
    ],
    "completeness_notes": "AiPanel.jsx의 IsolatedPreview 호출 여부는 grep으로 0건 — 예제 파일에만 존재"
  },
  "graphify_queries": [
    {"query": "XSS DOMPurify IsolatedPreview iframe sandbox MemoCard", "nodes_found": 43, "edges_found": 38}
  ],
  "key_files": [
    {"path": "miki-editor/src/utils/sanitize.js", "key_symbols": ["sanitizeHtml@L23"]},
    {"path": "miki-editor/src/components/IsolatedPreview.jsx", "key_symbols": ["IsolatedPreview@L34", "internal_sanitize@L58"]}
  ],
  "callers": [
    {
      "callee": "IsolatedPreview",
      "call_sites": [
        {"file": "IsolatedPreview.example.jsx", "fn": "MarkdownPreviewExample@L14", "passes_through": ["marked"], "sanitized_by_caller": false}
      ]
    }
  ],
  "facts": [
    {
      "id": "F1",
      "type": "invariant",
      "claim": "IsolatedPreview 내부에서 항상 sanitizeHtml 호출",
      "evidence": "miki-editor/src/components/IsolatedPreview.jsx:57-58"
    },
    {
      "id": "F2",
      "type": "code_observation",
      "claim": "AiPanel.jsx:1558는 sanitize 후 dangerouslySetInnerHTML 사용",
      "evidence": "grep 결과"
    },
    {
      "id": "F3",
      "type": "gap",
      "claim": "AiPanel 프로덕션에서 IsolatedPreview 직접 호출하는 부분 미확인",
      "evidence": "grep IsolatedPreview miki-editor/src/AiPanel.jsx — 0건"
    }
  ],
  "open_questions": [
    {"id": "Q1", "question": "프로덕션 AI 응답 렌더링이 어디서 일어나는가?", "needs_user": true}
  ]
}
```

### 필수 필드 의미

| 필드 | 역할 |
|---|---|
| `schema_version` | 스키마 진화 대응 (validate-grill-cache가 버전별 검증 분기) |
| `coverage` | 무엇을 어디까지 조사했고 무엇이 빠졌는지 — 검증 가능한 완결성 진술 |
| `coverage.unchecked_callers` | 미확인 caller 명시 — "조사 안 한 것"을 정직하게 표시 |
| `coverage.allow_missing_files` | `true`일 때만 `missing_files[]`에 명시된 파일의 부재를 허용 |
| `coverage.missing_files[]` | `{path, reason}` — 의도적으로 없는 파일을 명시. `allow_missing_files: true`와 함께 써야 유효 |
| `facts[].type` | `code_observation` (직접 관찰) / `invariant` (구조상 항상 참) / `constraint` (외부 제약) / `gap` (구멍) |
| `open_questions[]` | 코드로 답 안 되는 부분 — Step 2 인터뷰의 시작점 |

**facts evidence ↔ files_read 일관성 규칙**: `facts[].evidence`에 인용된 파일은 반드시 `coverage.files_read[]`에도 포함되어야 한다. 읽지 않은 파일의 증거를 facts에 쓰는 것은 스키마 위반.

### bypass.json 스키마

긴급 우회가 필요할 때 `.agents/grill-cache/SPEC_[domain].bypass.json` 생성:

```json
{
  "domain": "SPEC_xss_security",
  "reason": "우회 사유 (필수)",
  "created_at": "2026-05-21T11:00:00Z",
  "expires_in_minutes": 15
}
```

`expires_in_minutes` 경과 후 자동 만료 → 다시 cache 검증으로 복귀.

### scripts/validate-grill-cache.mjs 책임 (sh는 node 탐색 래퍼)

1. JSON 파싱 가능 여부
2. 필수 필드 존재 (`schema_version`, `domain`, `coverage`, `facts`)
3. `coverage.unchecked_callers`가 명시 (빈 배열도 OK, 누락은 불가)
4. `facts[].type`이 enum 4개 중 하나
5. missing-file 검사: `coverage.files_read[]`에 적힌 파일이 존재하지 않으면 차단. 단, `allow_missing_files: true` + `missing_files[].path`에 명시된 경우만 예외
6. stale 검사: 캐시 `generated_at`이 `coverage.files_read[]`에 나열된 모든 소스 파일의 mtime 최댓값보다 최근 (SPEC 파일 mtime과 비교하지 않음 — 동일 세션 연속 편집 시 circular 문제)

이로써 캐시 부재 상태에서 인수조건을 SPEC 파일에 쓰려는 시도가 **PreToolUse hook 도구 레벨 + Node.js 스크립트 검증 레벨**에서 이중 차단됨.
