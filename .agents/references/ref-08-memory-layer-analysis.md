# ref-011: 메모리 레이어 레퍼런스 분석

> 작성일: 2026-05-06
> 목적: Phase 10 메모리 레이어 자체 구축 시 참고할 오픈소스 설계 패턴 정리
> 분석 대상: Mem0, Graphify, Claude Code 내부 메모리 시스템

---

## 0. 이 결론에 도달한 과정

### 출발점

Phase 10을 Docker/OpenClaw에서 BYOK API로 전환한 뒤, 메모리 레이어를 직접 만들기로 했다(ref-012). 그 다음 질문은 "그래서 어떻게 만들 것인가"였다. Mem0와 Graphify 레포를 분석하고, 이어서 Claude Code의 내부 소스(`/Users/halim/Downloads/src`)를 직접 읽으면서 설계 방향이 구체화되었다.

### Mem0 분석에서 얻은 것

Mem0의 README에서 가장 주목한 것은 2026년 4월에 발표된 새 메모리 알고리즘이다:

> "Single-pass ADD-only extraction -- one LLM call, no UPDATE/DELETE. Memories accumulate; nothing is overwritten."

다만 소스코드(`main.py`)를 직접 확인한 결과, ADD-only는 **LLM 추출 프롬프트 레벨의 제약**이지 시스템 아키텍처 레벨의 제약이 아니다. `base.py`에 `update()`, `delete()` 메서드가 여전히 존재하고, `main.py`의 `_add_to_vector_store()`에서는 `ADDITIVE_EXTRACTION_PROMPT`를 통해 LLM에게 ADD만 요청할 뿐이다. 따라서 "Mem0가 append-only를 검증했다"는 근거는 약하다. Meki가 append-only를 선택하는 이유는 Mem0 벤치마크가 아니라 **diff를 위한 버전 히스토리 보존**이어야 한다.

여기서 한 가지 더 관찰한 것은 Entity Linking이다. `_upsert_entity()`에서 임베딩 유사도 0.95 이상이면 기존 엔티티에 `linked_memory_ids`를 추가하는 방식이다. Meki에서도 사용자가 다른 노트에서 같은 개념을 다른 표현으로 쓸 수 있으므로, 추출 후 기존 graph.jsonl의 엔티티와 중복 검사가 필요하다는 것을 확인했다.

Mem0를 직접 가져다 쓸 수 없는 이유: Python 기반(Meki는 JS/React), 클라우드 API 전제(데이터 주권 충돌). 또한 Mem0에는 `history(memory_id)` 메서드로 **개별 메모리의 변경 이력**(old→new)을 추적하는 기능이 있지만, 이것은 개별 fact의 수정 기록일 뿐이다. "3개월 전에는 '투자'가 God node였고 지금은 '교육'이다"라는 **전체 온톨로지 구조의 시점 비교(diff)**는 Mem0로 할 수 없다.

**결론**: 추출 프롬프트의 원칙(ADD-only, 1회 LLM 호출)과 Entity Linking 패턴은 차용하되, 저장·검색·구조적 diff는 Meki가 직접 만든다.

### Graphify 분석에서 얻은 것

Graphify는 코드/문서를 LLM으로 읽어 `graph.json`을 만든다. 출력 스키마가 이미 잘 정의되어 있다:

```json
{ 
  "nodes": [{ "id": "...", "type": "...", "label": "...", "properties": {} }],
  "edges": [{ "source": "...", "target": "...", "type": "...", "confidence": "..." }]
}
```

이 구조를 보면서 Meki의 graph.jsonl 엔트리 형식을 이것과 호환되게 설계하면, 향후 Graphify의 graph.html 뷰어나 생태계 도구를 재활용할 수 있겠다는 생각이 들었다.

더 중요한 관찰은 **Confidence 3단계**다. Graphify는 모든 관계에 EXTRACTED(원문에서 직접 발견) / INFERRED(추론) / AMBIGUOUS(불확실)를 태깅한다. 이것을 보고 Meki의 큐레이션 UI 우선순위가 명확해졌다 — AMBIGUOUS 항목을 먼저 보여주면 사용자의 판단이 가장 가치 있는 곳에 집중된다. 이미 EXTRACTED로 확실한 것은 자동 승인해도 되고, AMBIGUOUS인 것만 사용자에게 물으면 큐레이션 피로를 줄일 수 있다.

또한 GRAPH_REPORT.md에서 "God nodes(최다 연결 노드)"와 "의외의 연결" 개념을 발견했다. 이것은 Meki의 diff에 직접 연결된다 — 3개월 전에는 God node가 "투자"였는데 지금은 "교육"으로 바뀌었다면, 사용자의 관심축이 이동한 것이다. 이것이 diff가 보여줘야 할 것이다.

**결론**: graph.jsonl 스키마는 Graphify의 nodes/edges 구조를 참고하고, Confidence 3단계를 큐레이션 UI의 필터링 기준으로 채택한다.

### Claude Code 소스 분석에서 얻은 것

`/Users/halim/Downloads/src`의 `memdir/` 디렉토리와 `services/extractMemories/` 디렉토리를 읽었다. 이 소스에서 세 가지 결정적 관찰이 있었다.

**관찰 1: "What NOT to save" 규칙의 원칙은 유효하지만, 맥락이 다르다.**

`memoryTypes.ts`의 `WHAT_NOT_TO_SAVE_SECTION`에 이런 내용이 있다:

> "Code patterns, conventions, architecture, file paths, or project structure — these can be derived by reading the current project state."
> "These exclusions apply even when the user explicitly asks you to save."

"현재 상태에서 유도 가능한 것은 저장하지 않는다"는 원칙 자체는 유효하다. 그러나 이 규칙은 **코드 프로젝트** 맥락에서 작성되었다. 코드는 구조적이라 grep으로 대부분 찾을 수 있지만, 개인 노트는 비구조적이다. "김연아는 피겨 선수다"는 노트 원문 검색으로 찾을 수 있으므로 온톨로지에 넣을 필요가 없다. 하지만 "교육"이라는 키워드를 검색해도 "언제부터 교육에 관심이 생겼는지", "교육 관심이 이전의 투자 관심을 대체한 것인지"는 알 수 없다.

따라서 Meki용으로 규칙을 재정의해야 한다:
- ~~"검색 가능한 것은 저장하지 않는다"~~
- → **"단일 노트 안에서 완결되는 사실"은 저장하지 않는다. "노트 간 관계, 시간에 따른 변화, 암묵적 패턴"은 저장한다.**

이 재정의된 규칙이 추출 프롬프트의 핵심 가이드라인이 된다.

**관찰 2: body_structure 포맷에서 "구조화된 근거" 개념을 얻었지만, 직접 매핑은 안 된다.**

`memoryTypes.ts`의 feedback 타입에 `Rule → Why → How to apply` 3단 구조가 정의되어 있다. 그러나 이것은 **feedback(사용자가 에이전트 행동을 교정한 것)** 전용 구조다. Meki의 큐레이션 UI에서 보여주는 것은 교정이 아니라 **노트 간 관계 제안**이다.

"구조화된 근거를 함께 보여준다"는 원칙은 차용하되, Meki에 맞는 구조로 변환한다:
- **관계(What)**: "집중력"과 "몰입 경험"이 같은 관심 축이다
- **근거(Evidence)**: 노트 A(3/15)와 노트 B(4/2)에서 비슷한 맥락에서 사용됨
- **신뢰도(Confidence)**: 0.65 (INFERRED)

Rule→Why→How가 아니라 **What→Evidence→Confidence**가 Meki 큐레이션 카드의 구조다.

**관찰 3: forked agent 패턴은 백그라운드 추출의 구현 패턴이다.**

`extractMemories.ts`에서 가장 눈에 띈 것은 `runForkedAgent` 호출이다. 메인 대화의 prompt cache를 공유하면서 서브에이전트가 별도로 추출을 실행한다. 메인 에이전트가 이미 메모리를 직접 썼으면(`hasMemoryWritesSince`) 서브에이전트를 스킵한다. 최대 5턴 제한으로 검증 루프에 빠지는 것을 방지한다.

Meki에서는 이것이 "노트 저장 후 백그라운드 BYOK API 호출"로 번역된다. 사용자가 노트를 저장하면 UI는 즉시 반환되고, 백그라운드에서 LLM이 관계를 추출한다. 추출이 끝나면 큐레이션 큐에 들어가서 사용자가 다음에 앱을 열 때 "승인할 관계 3건"이 대기하고 있는 형태다.

또한 `findRelevantMemories.ts`에서 Sonnet이 전체 메모리 중 관련된 것 5개만 선별하는 패턴도 관찰했다. 이것은 Meki의 큐레이션 UI에서 "지금 보고 있는 노트와 관련된 기존 엔티티/관계"를 보여줄 때 쓸 수 있다 — graph.jsonl의 전체 엔트리를 보여주는 것이 아니라, LLM이 현재 맥락과 관련된 것만 추려서 보여주는 방식이다.

### 세 분석이 합쳐진 결론

각 소스에서 관찰한 것이 Meki의 서로 다른 레이어에 매핑된다:

```
[추출] Mem0의 ADD-only 1회 호출 프롬프트
  + Claude Code의 "What NOT to save" 필터링
  → P10-T2: BYOK LLM 서비스의 추출 프롬프트 설계

[저장] Graphify의 graph.json 스키마 (nodes/edges/confidence)
  + Mem0의 Entity Linking (중복 방지)
  → P10-T3: graph.jsonl 엔트리 형식 + prior.yaml 스키마

[표시] Graphify의 Confidence 3단계 (AMBIGUOUS 우선 검토)
  + Claude Code에서 착안한 구조화된 근거 (What → Evidence → Confidence)
  → P10-T4: 큐레이션 UI 카드 구성

[실행] Claude Code의 forked agent (백그라운드, UI 논블로킹)
  + findRelevantMemories (관련 항목만 선별)
  → 향후 구현: 저장 후 백그라운드 추출 파이프라인
```

이 네 레이어 모두에서 빠져 있는 것이 Meki의 핵심이다:
- **루틴적 큐레이션**: Claude Code는 사용자가 명시적으로 "기억해/잊어"라고 요청하면 수동 개입이 가능하지만, 이것은 예외적 행위다. Meki에서 사용자 승인은 매일 반복되는 핵심 루프다.
- **구조적 diff**: Mem0는 개별 fact의 수정 이력(`history()`)을 추적하지만, 전체 온톨로지 구조의 시점 비교는 제공하지 않는다. "God node가 바뀌었다"는 구조적 관찰은 어디에도 없다.

이 두 가지를 Meki가 직접 설계하는 것이 Phase 10-11의 본질이다.

---

## 1. Mem0 (github.com/mem0ai/mem0)

**개요**: AI 에이전트용 범용 메모리 레이어. 54.9k stars, Apache 2.0.

**핵심 구조**:
- 텍스트 입력 → 1회 LLM 호출로 fact 추출 (`ADDITIVE_EXTRACTION_PROMPT`로 ADD만 요청. 단, 시스템 레벨에서는 update/delete API 존재)
- Entity Linking: `_upsert_entity()`에서 임베딩 유사도 ≥0.95이면 기존 엔티티에 연결
- Multi-signal 검색: semantic + BM25 keyword + entity matching 병렬 처리 후 fusion
- 변경 이력: `history(memory_id)`로 개별 fact의 old→new 추적 (SQLite)

**Meki 차용 포인트**:
- **ADD-only 추출 프롬프트 패턴**: LLM에게 ADD만 요청하는 프롬프트 설계 참고
- **Entity Linking**: 같은 개념이 다른 표현으로 등장할 때 중복 방지 로직

**못 쓰는 것**: Python 기반(Meki는 JS/React), 클라우드 API 전제. 개별 fact 이력은 있으나 전체 온톨로지 구조의 시점 비교(diff)는 없음

---

## 2. Graphify (github.com/safishamsi/graphify)

**개요**: 코드/문서/미디어를 LLM으로 읽어 knowledge graph 생성. 43.5k stars, MIT.

**출력물**:
```
graphify-out/
├── graph.html     # 브라우저 인터랙티브 뷰어
├── GRAPH_REPORT.md # God nodes, 의외의 연결, 제안 질문
└── graph.json      # 전체 그래프 (nodes + edges)
```

**Meki 차용 포인트**:
- **Confidence 3단계**: EXTRACTED(원문 직접 발견) / INFERRED(추론) / AMBIGUOUS(불확실)
  → Prior의 confidenceThresholds와 대응. 큐레이션 UI에서 AMBIGUOUS부터 검토 유도
- **graph.json 스키마**: `{ nodes: [{id, type, label, properties}], edges: [{source, target, type, confidence}] }`
  → graph.jsonl 엔트리 형식 설계 시 참고
- **GRAPH_REPORT.md 패턴**: God nodes(최다 연결), 의외의 연결 → 큐레이션 가이드로 활용

**못 쓰는 것**: 코드 분석 특화(자연어 노트 파싱과 다름), Python CLI(웹앱 직접 통합 불가)

---

## 3. Claude Code 내부 메모리 시스템 (비공개 소스 분석)

**개요**: Claude Code가 대화에서 자동으로 기억을 추출/저장/검색하는 시스템.

**아키텍처**:
```
대화 진행 → 쿼리 루프 종료 시
  → forked agent(서브에이전트)가 대화 분석 (메인 prompt cache 공유)
  → 4가지 타입으로 분류
  → MEMORY.md(인덱스) + 개별 .md 파일로 저장
  → 다음 대화 시 Sonnet이 관련 기억 선별 (최대 5개) → context 주입
```

### 3.1 메모리 타입 분류 (memoryTypes.ts)

| 타입 | 설명 | Meki Prior entityType 대응 |
|---|---|---|
| `user` | 사용자의 역할, 목표, 지식, 선호도 | Person, Role |
| `feedback` | 작업 접근법에 대한 교정/확인 피드백 | Insight, Decision |
| `project` | 진행 중인 작업, 목표, 버그, 사건 | Project, Risk |
| `reference` | 외부 시스템 정보 위치 포인터 | Tool, Reference |

### 3.2 핵심 설계 원칙 (직접 차용 가능)

**"What NOT to save" 규칙** (원본은 코드 프로젝트 맥락 — Meki용 재정의 필요):
- 원본: 현재 상태에서 grep/검색으로 찾을 수 있는 것은 저장하지 않음
- 원본: Git history, 디버깅 솔루션, 임시 태스크 디테일 제외
- 원본: **사용자가 명시적으로 저장을 요청해도 위 규칙 적용**

→ **Meki 재정의**: 코드는 구조적이라 grep으로 대부분 찾지만, 개인 노트는 비구조적이다. 따라서:
- **단일 노트 안에서 완결되는 사실**은 추출하지 않는다 (노트 원문 검색으로 충분)
- **노트 간 관계, 시간에 따른 변화, 암묵적 패턴**은 추출한다 (전문 검색으로 발견 불가)

**큐레이션 카드 구조** (Claude Code의 body_structure에서 착안, Meki용으로 변환):
- 원본: Rule → Why → How to apply (feedback 교정 전용)
- **Meki 변환**: What(관계) → Evidence(근거) → Confidence(신뢰도)

→ **Meki 적용**: graph.jsonl Relation의 `evidence` 필드가 Evidence에, Graphify의 Confidence 점수가 Confidence에 대응.

**Stale memory 검증**:
- "메모리가 X를 말한다 ≠ X가 지금도 존재한다"
- 메모리가 파일/함수/플래그를 명시하면 → 실제 존재 여부 확인 후 추천
- 활동 로그, 아키텍처 스냅샷은 시점 고정 → 현재 상태 질문에는 실제 코드 우선

→ **Meki 적용**: graph.jsonl 엔트리의 `createdAt` 기반 freshness 표시. diff 엔진의 기초 데이터.

### 3.3 추출 파이프라인 (extractMemories.ts)

**실행 조건**:
- 쿼리 루프 종료 시 (매 턴이 아님, N턴마다 실행 가능)
- 메인 에이전트가 이미 메모리를 작성한 경우 스킵 (중복 방지)
- 서브에이전트/원격 모드에서는 실행 안 함

**forked agent 패턴**:
- 메인 대화의 prompt cache를 공유하면서 백그라운드에서 추출
- 최대 5턴 제한 (read → write, 검증 루프 방지)
- UI 블로킹 없음

→ **Meki 적용**: 노트 저장 후 백그라운드로 BYOK API 호출. 사용자는 다음 노트를 계속 작성 가능.

### 3.4 관련 기억 선별 (findRelevantMemories.ts)

- 전체 메모리 파일의 frontmatter(name, description, type)만 스캔
- Sonnet에게 현재 쿼리와 관련된 기억 최대 5개 선별 요청
- JSON Schema 강제 출력 (`{ selected_memories: string[] }`)
- 이미 표시된 기억은 제외 (alreadySurfaced)

→ **Meki 적용**: 큐레이션 시 graph.jsonl 전체가 아니라 현재 노트와 관련된 엔트리만 보여주는 데 활용.

---

## 4. Meki와의 근본적 차이

| | Mem0 | Claude Code | Meki |
|---|---|---|---|
| 추출 | AI 자동 | AI 자동 + 명시 요청 시 수동 | AI 제안 + **루틴적 사용자 승인/거절** |
| 저장 | 클라우드 벡터DB | 로컬 ~/.claude | **사용자 GitHub private repo** |
| 버전 관리 | 개별 fact 이력 (history()) | 없음 (파일 덮어쓰기) | **append-only + 타임스탬프 + 구조적 스냅샷** |
| 핵심 가치 | 기억/검색 | 세션 간 연속성 | **diff (전체 온톨로지의 시점 비교)** |

자동 추출은 이미 해결된 문제. Meki의 차별점은:
1. 루틴적 큐레이션을 통한 관점 명시화 (Human-in-the-Loop)
2. 개별 fact 이력이 아닌, 전체 온톨로지 구조의 시점 비교(diff)

---

## 5. Phase 10 태스크별 차용 매핑

| 태스크 | 차용할 것 | 출처 |
|---|---|---|
| P10-T2 (BYOK LLM 서비스) | ADD-only 추출 프롬프트, Meki용 "What NOT to extract" 재정의 규칙 | Mem0 + Claude Code (원칙 차용, 맥락 재정의) |
| P10-T3 (저장 구조) | graph.json 스키마, Confidence 3단계 (EXTRACTED/INFERRED/AMBIGUOUS) | Graphify |
| P10-T4 (큐레이션 UI) | What→Evidence→Confidence 카드 구조, stale memory 경고 | Claude Code (착안) + Meki 변환 |
| P10-T5 (그래프 뷰어) | God nodes, 의외의 연결 하이라이트 | Graphify GRAPH_REPORT |
| 향후 (백그라운드 추출) | forked agent 패턴, findRelevantMemories 선별 로직 | Claude Code |
