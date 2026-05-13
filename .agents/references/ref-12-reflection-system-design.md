# ref-12: Reflection 시스템 설계 확정

> 작성일: 2026-05-12 (재작성)
> 의존 문서: ref-09(Phase 10 SoT), ref-10(로컬 임베딩), ref-11(한국어 NLP), ref-03(meki 소스 아키텍처)
> 목적: Phase 10 Reflection 매체의 아키텍처·스키마·발행 메커니즘·콜드 스타트·동일성 모델링·투명성·기존 코드베이스 통합 확정

---

## 0. 핵심 원칙

> **Meki에서 AI는 통합·정리하지 않는다. AI는 제안하고, 사용자의 개입(intervention)에서 사용자의 의미 모델을 학습한다. 위키는 그 의미 모델의 가시화된 가면이고, intervention은 AI에 대한 불변 제약이다.**

이 원칙이 시스템 전체를 관통한다. 네 가지 추가 원칙:

1. **Prior는 파일이다, 추상 개념이 아니다.** graph.jsonl이 단일 진실원, 위키는 그 렌더링.
2. **사용자 개입은 시스템 프롬프트의 일부다.** AI는 사용자가 한 번 확정한 것을 재제안할 수 없다.
3. **투명성은 옵션이 아니라 구조다.** 사용자는 자기 Prior 전체를 항상 열어볼 수 있어야 한다.
4. **Pull과 Push 모두 가능해야 한다.** 위키 직접 조회는 pull, Reflection은 push. Push 채널 차단되어도 사용자는 자기 데이터에 접근 가능.

---

## 1. 아키텍처 — 그래프가 진실원, 위키는 렌더링

### 1.1 저장 레이어

```
miki-data/
├── raw/                          ← MekiSync가 채움. 원본 메모 사본. 불변.
│   └── notes/2025/03/12-note.md
│
├── graph.jsonl                   ← AI 컴파일 결과. 위키의 백엔드.
│                                   nodes (entity|concept|stance) + edges (relations)
│                                   Single Source of Truth
│
├── interventions.jsonl           ← Append-only 사용자 결정 로그.
│                                   AI 컴파일 시 시스템 프롬프트로 주입.
│                                   Phase 12 자아 시뮬레이터 학습 데이터.
│
└── reflections/
    ├── queue.jsonl               ← 발행 대기 중인 wiki 업데이트 제안
    └── archive.jsonl             ← 처리된 Reflection + intervention 결과
```

**`/wiki/` 디렉토리는 존재하지 않는다.** 위키 페이지는 graph.jsonl의 파생 뷰로 프론트엔드에서 동적 렌더링.

### 1.2 데이터 흐름

```
Apple/Samsung Notes (원본, 불변)
        │
        │ MekiSync 데몬 추출
        ▼
   miki-data/raw/                   ← 메모 원본 사본
        │
        │ BYOK 컴파일 (콜드: 배치 / 일상: 증분)
        │ + interventions.jsonl 시스템 프롬프트 주입 (불변 제약)
        ▼
   miki-data/graph.jsonl            ← 트리플 스토어 (Prior)
        │
        │ Prior 변화 감지 (Extending / Tension)
        ▼
   miki-data/reflections/queue.jsonl ← 업데이트 제안 큐
        │
        ├── Push: Daily Reflection 발행 (모바일/데스크탑)
        └── Pull: 사용자가 위키 직접 조회/편집
                  │
                  ▼ 마크다운 diff → 트리플 변경
   사용자 결정 → interventions.jsonl append
                + graph.jsonl 갱신
                + reflections/archive.jsonl 기록
```

### 1.3 위키 렌더링/역파싱 레이어

- **렌더링**: graph.jsonl의 엔티티/개념/태도 노드를 마크다운 페이지로 변환
- **역파싱**: 사용자가 위키 마크다운에서 편집한 diff를 트리플 변경(추가/삭제/수정)으로 변환
- 양방향 변환이 일관성 핵심

---

## 2. 신뢰도와 발행 게이트

### 2.1 두 축 분리

이전 설계의 한 축(증거 강도) 단일 게이트는 인식론적 신뢰도와 발행 가치를 혼동했다. 두 축으로 분리:

**축 1: 증거 강도** (UI 메타데이터 — 왜 이걸 제안하는지)

| Tier | 정의 |
|--|--|
| Grounded | 2개 이상 메모에서 명시적 동시 등장 |
| Bridged | 한 단계 추론 (공통 엔티티 경유 또는 시맨틱 근접) |
| Speculative | 패턴 기반 추측, 명시 증거 없음 |

알고리즘으로 결정. LLM 자기 평가 사용하지 않음.

**축 2: Prior 관계** (발행 게이트 — 보여줄 것인가)

| 관계 | 정의 | MVP 처리 |
|--|--|--|
| Consistent | 위키와 일치, 사용자가 이미 확정함 | Skip (기록만) |
| Extending | 위키에 없는 새 관계/엔티티, 모순 없음 | **발행** |
| Tension | 위키와 충돌 또는 패턴 변화 감지 | Phase 11로 이월 |

### 2.2 MVP 단순화 (Karpathy 패턴)

Karpathy의 wiki는 Tension 감지를 하지 않는다. 그래도 가치를 만든다. Meki MVP도 같은 길:

- **Extending만 발행** — 위키에 모순 없이 추가되는 새 관계
- **Tension은 Phase 11** — 시간축 분석, 거짓 양성 제어, 하위 타입 분리 등 복잡도 큼
- **Speculative는 발행 후보 제외** — Tension과 결합되어야 의미. Phase 11에서 함께 도입.

### 2.3 자기 강화 편향 방어

Consistent skip은 위험을 내포한다 — 사용자의 잘못된 과거 판단이 자기 강화될 수 있다. 방어:

1. **위키 직접 편집** — 사용자가 Reflection을 기다리지 않고 위키 페이지 수정 가능
2. **Counterfactual 가시화** — "오늘 발행되지 않은 후보 N개" 항상 노출 (§9)
3. **주기적 재노출** — Consistent로 분류된 관계도 6개월 후 재평가 후보로 (Phase 11)
4. **자기 메타뷰** — 사용자가 자기 패턴(approve/reject 분포)을 볼 수 있는 대시보드 (Phase 11)

---

## 3. Reflection 스키마

### 3.1 Relation Reflection (관계 제안)

위키 업데이트 제안 형식:

```jsonc
{
  "id": "refl_20260513_0001",
  "type": "relation_reflection",
  "evidence_tier": "grounded",              // UI 메타: 어디서 왔는지
  "prior_relation": "extending",            // 발행 게이트: 왜 보이는지
  "scheduled_for": "2026-05-13",

  "sources": [
    { "memo_id": "note_20250312",
      "excerpt": "김팀장 얘기할 때마다...",
      "date": "2025-03-12" },
    { "memo_id": "note_20250801",
      "excerpt": "결국 그 프로젝트도...",
      "date": "2025-08-01" }
  ],

  // 위키 업데이트 제안 (Karpathy 식 wiki page diff)
  "proposed_update": {
    "wiki_target": "entities/김팀장.md",
    "section": "관찰된 태도",
    "operation": "append",
    "content": "X 프로젝트에서도 설득을 먼저 구하는 패턴이 재현됨",
    "triples_to_add": [
      { "subject": "ent_김팀장",
        "predicate": "shows_stance",
        "object": "ent_설득우선",
        "evidence": ["note_20250312", "note_20250801"] }
    ]
  },

  // 사용자가 왜 이걸 보는지에 대한 시스템 설명 (투명성)
  "rationale": {
    "why_proposed": "3개 메모에서 명시적 동시 등장 (Grounded)",
    "why_published": "위키에 이 관계가 아직 없음 (Extending)",
    "why_today": "최근 2주 메모와 연결되어 시의적",
    "alternatives_today": 5      // 발행 안 된 후보 수
  },

  "intervention": null
  // 사용자 응답 후:
  // { "action": "approve" | "reject" | "edit",
  //   "edited_update"?: {...},
  //   "user_rationale"?: string,   // 선택 입력, 가장 강한 학습 신호
  //   "at": timestamp }
}
```

### 3.2 Identity Reflection (동일성 모델링)

엔티티 해소는 데이터 정제가 아니라 **사용자 의미론 학습**. AI는 같다/다르다를 판정하지 않고, 사용자가 의미 단위를 어떻게 자르는지 추론.

세 가지 동일성 차원:

| 차원 | 질문 | 예시 |
|--|--|--|
| 지시(Reference) | 같은 실제 대상을 가리키는가 | "그 분" = 김팀장? |
| 레지스터(Register) | 같은 대상의 다른 정동/맥락 보존 | "엄마" vs "어머니" |
| 분화(Divergence) | 같은 표면형의 시기/역할 분화 | 2020 김팀장 vs 2025 김팀장 |

스키마:

```jsonc
{
  "id": "id_refl_20260513_0007",
  "type": "identity_reflection",
  "prior_relation": "extending",      // 위키에 새 엔티티/별칭 관계 추가
  "scheduled_for": "2026-05-13",

  // AI는 판정하지 않고 관찰만 제시
  "observation": {
    "surfaces": ["엄마", "어머니"],
    "occurrence_patterns": {
      "엄마":   { "memos": 23, "context_signature": "일상·감정·회상", "tone": "친밀" },
      "어머니": { "memos": 7,  "context_signature": "공식·의례·기록",  "tone": "격식" }
    },
    "referent_likely_same": true,
    "register_difference_detected": true
  },

  // 단일 제안 대신 사용자가 의미 단위를 선택
  "modeling_options": [
    { "id": "merge_full",
      "label": "한 사람·한 표현으로 통합",
      "implication": "단일 노드, aliases: [엄마, 어머니]" },
    { "id": "merge_with_register",
      "label": "같은 인물이지만 호칭 레지스터 보존",
      "implication": "동일 referent, 두 노드, aspect: [친밀, 격식]" },
    { "id": "split_full",
      "label": "별개의 의미 단위로 분리",
      "implication": "Meki의 관점에서 별도 존재로 추적" }
  ],

  "rationale": {
    "why_proposed": "두 표면형이 같은 referent를 가리키는 패턴 감지",
    "why_published": "위키의 엔티티 구조가 아직 결정되지 않음"
  },

  "intervention": null
  // { "chosen": "merge_with_register",
  //   "user_rationale": "'어머니'는 거리감 있을 때만 쓴다",
  //   "at": timestamp }
}
```

### 3.3 공통 인터벤션 어휘

| Action | 의미 |
|--|--|
| approve | AI 제안 그대로 위키에 반영 |
| reject | 제안 거절. 재제안 영구 차단. |
| edit | 사용자 수정 후 반영 |
| defer | 판단 보류. 추가 증거 누적 후 재평가. |

`user_rationale`은 선택 입력이지만 가장 강력한 학습 신호. 사용자의 언어 그대로 보존.

---

## 4. 발행 메커니즘

### 4.1 매체 3요소 (ref-09에서 확정)

- **발행 기준**: 비자명성·근거 충분성(2개+)·중복 배제·시의성
- **주기**: 일간 1건 = 5~7개 Reflection 묶음
- **축적**: Reflection Journal — 사라지지 않는 누적

### 4.2 콜드 스타트 (Karpathy 배치)

```
임포트 완료
  ↓
raw/notes/ 전체 BYOK 일괄 컴파일 (큰 비용 한 번)
  ↓
graph.jsonl 초기 상태 수립 (Prior 탄생)
  ↓
Editorial Standards 통과 후보 추출
  ↓
드립 피드 알고리즘으로 scheduled_for 배정
  ↓
reflections/queue.jsonl 에 저장
  ↓
첫 Daily Reflection 발행 가능
```

**자동 처리 (사용자에게 묻지 않음)**:
- 표면형 유사도 ≥ 0.95 자동 merge ("김팀장"/"김팀장님")
- evidence ≥ 3 + ai_self_score ≥ 0.9 자동 grounded approve, archive.jsonl에 "auto-approved" 기록

**위험 회피**:
- 레지스터 차이 있는 표면형(다른 문자열)은 자동 merge 금지 — 항상 Identity Reflection으로
- 시기 차 1년 이상인 같은 표면형은 자동 처리 금지 — 항상 Identity Reflection으로

### 4.3 일상 사용 (이벤트 기반 증분)

```
MekiSync 신규 메모 감지
  ↓
miki-data/raw/ 에 파일 추가
  ↓
이벤트: WebSocket으로 클라이언트 알림
  ↓
BYOK 증분 컴파일:
  System: interventions.jsonl 관련 룰 (불변 제약)
  Context: graph.jsonl 관련 부분 (RAG)
  Input: 신규 메모 + 인접 시간 메모
  ↓
트리플 업데이트 후보 생성
  ↓
Prior 관계 분류 (Consistent / Extending)
  ↓
Extending만 queue.jsonl 에 append
```

증분 컴파일이므로 BYOK 비용 적음. 콜드 스타트만 비쌈.

### 4.4 드립 피드 스케줄링

```
하루 목표:   Daily Reflection 1건 = 3~5개 Reflection
배포 기간:   max(14, min(28, total_candidates / 4)) 일
배치 순서:
  1주차      최근 3개월 메모 우선
  2주차      6~12개월 전
  3~4주차    그 이전
혼합:        Identity : Relation = 1~2 : 4~5
첫 1주:      개수 제한 (≤3개) — 적응 시간
```

사용자에게 알고리즘은 노출 안 함. "최근 것부터"만 인지.

---

## 5. 선호 학습 — interventions.jsonl as System Prompt

### 5.1 Intervention의 두 역할

```
interventions.jsonl 의 각 항목 = 두 가지 역할
  (1) 학습 신호      — 사용자의 의미 모델 추론에 사용
  (2) 불변 제약      — 다음 컴파일에서 AI가 위반 불가
```

이 이중성이 자기 강화 편향과 AI 환각 양쪽을 동시에 막는다.

### 5.2 시스템 프롬프트 빌더

매 BYOK 호출 시:

```
System:
  "You are compiling a personal wiki for user.
   The following user-confirmed rules are IMMUTABLE.
   Never propose anything that violates them.
   
   [관련 interventions.jsonl 항목]
   - 엔티티 [엄마] ≠ [어머니] — 레지스터 보존
   - 관계 [김팀장 — 무능] reject — 영구
   - 위키 페이지 [투자]의 'A주식 매각' 사용자 수정 — 보존
   
   Compile updates based on these new memos:
   ..."
```

### 5.3 토큰 비용 통제 (RAG 주입)

interventions.jsonl이 1만 줄이 되어도 전체를 매번 주입할 수 없음.

- **항상 주입**: `scope: always` 룰 전체
- **검색 주입**: 신규 메모의 엔티티/개념과 관련된 룰만 RAG 추출
- **휴면 처리**: 1년 이상 미사용 룰은 archive 플래그, 비활성

이 RAG 레이어가 `services/interventionResolver.js`로 구현될 예정.

### 5.4 사용자 의미 모델 프로파일

intervention 누적의 통계적 요약:

```
사용자 A 프로파일 (graph.jsonl + interventions.jsonl에서 도출)
─────────────────────────────────
호칭 레지스터:    보존 선호 (엄마/어머니 split 다수)
시기 분화:        미선호 (전·현 직장 김팀장 merge)
역할 분화:        강한 선호 (학생/직장인 자아 split)
거절 패턴:        직장 stance reject 多
선호 패턴:        가족 관계 approve 多
```

다음 컴파일 시 system prompt 컨텍스트에 주입 → modeling_options 순서 조정, Speculative 임계값 조정.

---

## 6. Phase 12와의 연결

축적된 두 파일이 Phase 12 자아 시뮬레이터의 데이터:

- **graph.jsonl 시간 스냅샷** = "과거의 나의 의미 모델"
- **interventions.jsonl 변천사** = "내가 의미를 어떻게 다르게 자르게 되었는가"

diff = 자아의 진화 기록. Reflection 시스템은 단순 UX가 아니라 **자아 시뮬레이터의 데이터 파이프라인**이다.

---

## 7. Phase 10 액션 아이템 — 기존 코드 통합

각 액션 항목에 **(확장|신규)** 표시와 의존성 명시:

### 7.1 인프라

| ID | 작업 | 파일 | 종류 |
|--|--|--|--|
| A1 | miki-data repo 구조 확장: raw/, graph.jsonl, interventions.jsonl, reflections/ 디렉토리 추가 | `services/github.js` 확장 | 확장 |
| A2 | IndexedDB 스키마 v6: graphCache, interventionsCache, reflectionsQueue 테이블 | `utils/database.js` | 확장 |
| A3 | SyncManager에 graph/interventions/queue 동기화 추가 | `sync/index.js` | 확장 |

### 7.2 컴파일 파이프라인 (BYOK)

| ID | 작업 | 파일 | 종류 |
|--|--|--|--|
| B1 | BYOK 클라이언트 추상화 (Gemini/Claude/OpenAI) | `services/byokClient.js` | 신규 |
| B2 | wikiCompiler — 콜드 배치 + 증분 컴파일 | `services/wikiCompiler.js` | 신규 |
| B3 | interventionResolver — 시스템 프롬프트 RAG 빌더 | `services/interventionResolver.js` | 신규 |
| B4 | reflectionEngine — graph 변화 감지 → queue 생성 | `services/reflectionEngine.js` | 신규 |

### 7.3 위키 렌더링/역파싱

| ID | 작업 | 파일 | 종류 |
|--|--|--|--|
| C1 | tripleParser — graph.jsonl → 엔티티 페이지 마크다운 | `wiki/tripleParser.js` | 신규 |
| C2 | markdownDiffer — 마크다운 편집 diff → 트리플 변경 | `wiki/markdownDiffer.js` | 신규 |
| C3 | WikiPage 컴포넌트 (엔티티/개념/태도 페이지) | `wiki/components/WikiPage.jsx` | 신규 |

### 7.4 Reflection UI

| ID | 작업 | 파일 | 종류 |
|--|--|--|--|
| D1 | DailyReflection 페이지 (모바일 우선 스와이프 + 데스크탑 카드 그리드) | `pages/Reflection.jsx` | 신규 |
| D2 | ReflectionCard 컴포넌트 (rationale 푸터 포함) | `components/ReflectionCard.jsx` | 신규 |
| D3 | IdentityReflectionCard (modeling_options 선택형) | `components/IdentityReflectionCard.jsx` | 신규 |
| D4 | Counterfactual 뷰 ("오늘 발행 안 된 후보") | `components/CounterfactualView.jsx` | 신규 |

### 7.5 Zustand 스토어

| ID | 작업 | 파일 | 종류 |
|--|--|--|--|
| E1 | wikiStore — graph.jsonl 인메모리 인덱스 | `stores/wikiStore.js` | 신규 |
| E2 | reflectionStore — 오늘의 Reflection + 큐 | `stores/reflectionStore.js` | 신규 |
| E3 | interventionStore — append + 시스템 프롬프트 빌더 | `stores/interventionStore.js` | 신규 |

### 7.6 MekiSync 데몬 (외부 프로젝트, 별도)

| ID | 작업 | 종류 |
|--|--|--|
| F1 | Apple Notes Local App Bridge (JXA + localhost server) — open-notes-extractor | 신규 (별도 repo) |
| F2 | Samsung Notes Local App Bridge (sdocx 파서 + PowerShell) — open-notes-extractor | 신규 (별도 repo) |
| F3 | 상시 가동 데몬 버전 (Mac 메뉴바 / Windows 트레이) — Phase 10 후반 | 신규 (별도 repo) |

기존 miki-editor 코드 침습 없음. 단지 miki-data/raw/에 파일을 쓰는 외부 프로세스.

### 7.7 의존성 그래프

```
A1 (repo 구조) → A2, A3 → B1~B4 → C1~C2 → D1~D4
                                     ↓
                                  E1~E3
F1, F2는 독립 진행 가능
```

---

## 8. 호환성 — 기존 meki editor와의 통합

### 8.1 침습 없는 부분

- 기존 블로그 포스트 흐름(`documentStore.js`, `services/publish.js`) 변경 없음
- Jekyll 발행 흐름 변경 없음
- OAuth/auth 변경 없음
- Toast UI Editor 변경 없음 (위키 편집에 재사용 가능)
- WS 프록시 변경 없음 (새 이벤트 타입만 추가)

### 8.2 결정된 통합 정책

- **위키 비공개 고정 (MVP)**: 위키는 사적 Prior. 발행 안 함. Phase 12 Prior fork에서 공개 옵션 추가.
- **에디터 재사용**: 위키 페이지 편집에 Toast UI Editor 사용. 통일감 우선.
- **스토어 분리**: documentStore(블로그) / wikiStore(위키) / reflectionStore(Reflection) / interventionStore(개입) 4분리. 책임 분리 명확.
- **AiPanel 유지**: 에디터 사이드 도우미는 그대로. Reflection은 별도 페이지(`pages/Reflection.jsx`).

### 8.3 모바일 UX 분리

- 데스크탑: 풀 위키 + Reflection 카드 그리드
- 모바일: Reflection 스와이프 우선 + 읽기 전용 위키
- 같은 store/service 사용. 컴포넌트만 분기.

---

## 9. 투명성과 사용자 통제 — Anti-Bubble 설계

Push 시스템은 구조적으로 YouTube식 필터 버블 위험을 안는다. Meki는 자동으로 안전하지 않다. 다음 메커니즘은 **MVP 필수**:

### 9.1 Reflection 푸터: "왜 이걸 보여드리나요?"

매 카드에 항상 펼침 가능:
- 증거 강도와 출처 메모
- 발행 결정 근거 (Prior 관계)
- 시의성 사유
- 오늘 발행 안 된 후보 수 (Counterfactual 진입점)

스키마의 `rationale` 필드가 이 데이터를 직접 제공.

### 9.2 Counterfactual 가시화

`reflections/queue.jsonl`에서 오늘 발행 안 된 항목 전부 열람 가능:

```
오늘 Daily Reflection: 4개 발행 (열기)
오늘 보류된 Reflection: 12개 (열기)
   ├─ Consistent skip: 8개
   ├─ 시의성 미달:    3개
   └─ 거짓 양성 우려: 1개
```

게이트키핑 독점 제거. 사용자가 시스템 결정 전체를 볼 수 있다.

### 9.3 위키 직접 편집

Reflection을 기다리지 않고 위키 페이지 수정 가능. push 채널이 막혀도 사용자는 자기 Prior에 접근.

### 9.4 Phase 11에서 추가될 것

- 자기 메타뷰 (approve/reject 패턴 대시보드)
- 알고리즘 환경설정 (다양성 우선, counterprogramming, 망각 보완)
- Consistent 주기적 재노출

### 9.5 단일 목적함수 부재 선언

> **Meki는 watch time 같은 단일 목적함수를 갖지 않는다. 발행 알고리즘은 명시적이고, 사용자 통제 하에 있다.**

이 원칙이 모든 알고리즘 결정의 상위 제약. 후일 누군가 "approve rate를 KPI로" 같은 제안을 하면 이 선언이 거부 근거.

---

## 10. 한 줄 선언

> **Meki에서 위키는 사용자의 의미 모델의 가시화된 가면이고, intervention은 그 모델을 형성하는 사용자의 결정 흔적이다. AI는 두 가지 모두에 종속된다.**

이 한 줄이 시스템 설계의 의도를 표현한다. 코드 리뷰, UI 카피, 외부 설명에서 일관되게 유지.

---

## 관련 레퍼런스

- ref-03: meki 소스 아키텍처 (확장될 기존 컴포넌트)
- ref-09: Phase 10 Source of Truth (Reflection 매체 구조 원본)
- ref-10: 로컬 임베딩 스택 (Bridged tier 시맨틱 근접)
- ref-11: 한국어 NLP 스택 (표면형 정규화, 형태소 분석)
- ref-07: 바이럴 커뮤니티 전략 (Phase 12 자아 시뮬레이터의 사회적 확장)
- ref-08: 메모리 레이어 분석 (폐기된 confidence 3단계의 원출처)
