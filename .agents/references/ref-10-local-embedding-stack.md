---
id: ref-013
topic: 로컬 임베딩 + 프라이버시 보존 검색 스택
created: 2026-05-06
tags: [embedding, transformers.js, sqlite-vec, privacy, local-first, BYOK, Phase10]
---

# 로컬 임베딩 + 프라이버시 보존 검색 스택

## 핵심 결론

**"임베딩/검색은 완전 로컬로 가능. BYOK가 필요한 건 Entity/Relation 추출(고차원 추론) 단계 하나뿐."**

2026년 기준으로 브라우저 내 로컬 임베딩은 production-ready. 외부 서버 전송 없이 시맨틱 검색 구현 가능.

---

## 옵션 비교

### Option A: 완전 브라우저 (가장 강한 프라이버시)
- **패키지**: `@xenova/transformers` + `sql.js` + `sqlite-vec`
- **모델**: `all-MiniLM-L6-v2` — 23MB, 첫 로드 후 브라우저 캐시
- **장점**: 설치 불필요, 데이터가 기기 밖으로 나가지 않음
- **한계**: 첫 모델 다운로드 23MB, 저사양 기기 느릴 수 있음
- **Web Worker 필요**: 메인 스레드 블로킹 방지

### Option B: Ollama 로컬 서버 (품질 우선)
- **모델**: `nomic-embed-text` (137M, 고품질)
- **엔드포인트**: `localhost:11434/api/embed`
- **장점**: Option A보다 임베딩 품질 훨씬 좋음
- **한계**: Ollama 설치 1회 필요 → Docker와 유사한 장벽

### Option C: BYOK + 신뢰 경계 명시 (현실적 타협)
- 사용자 API 키 소유 → Meki 서버는 데이터 불통과
- "제3자 LLM 서버는 경유하지만 Meki는 아님"
- 현재 PLAN.md의 BYOK 방식

---

## 권장 아키텍처 (Meki Phase 10)

```
[시맨틱 검색 — 완전 로컬]
브라우저 내 Transformers.js
  → 노트 임포트 시 로컬 임베딩 생성
  → IndexedDB / sqlite-vec에 벡터 저장
  → 검색은 완전 로컬, 외부 전송 없음

[온톨로지 추출 — BYOK만 사용]
이 단계만 외부 LLM에 위임
  → BYOK API (Gemini/Claude)로 Entity/Relation 추출
  → 추출 결과(graph.jsonl)는 로컬(GitHub private repo) 저장
  → 사용자가 API 키 소유 = 책임 소재 명확
```

---

## 기존 코드베이스 분석 (2026-05-06 기준)

### DocumentSearchManager.js 현황
- **위치**: `src/utils/DocumentSearchManager.js`
- **현재 구현**: 키워드 검색 + 간단한 TF-IDF 스코어링 (로컬)
- **AI 검색**: `searchByAi()` — Claude API 직접 호출 (localhost:3003 프록시)
  - 문서 내용을 통째로 Claude API에 전송 → **프라이버시 문제**
  - `this.documentEmbeddings = new Map()` 슬롯이 존재하지만 미구현
- **의미 기반 검색**: `searchBySemantic()` — 실제로는 키워드 기반 TF-IDF (벡터 임베딩 아님)

### database.js 현황
- **Dexie v4** (IndexedDB 래퍼)
- **테이블**: `documents`, `syncQueue`, `pendingSync`, `vaultKeys`
- **임베딩 테이블 없음** → `embeddings` 테이블 추가 필요 (v5 스키마)
- `dbHelpers.saveLocal()` — 문서 저장 시 임베딩 생성 훅 추가 포인트

### KnowledgeGraph.jsx 현황
- `react-force-graph-2d` 사용 (이미 package.json에 있음)
- 현재: 태그/부모 기반 링크만 시각화
- 확장 포인트: `graph.jsonl`의 Entity/Relation 읽어 렌더링

### package.json 호환성
- **Vite 5.4.21** — Transformers.js v4 완전 지원
- **React 17** — Web Worker + Comlink 패턴 사용 가능
- `react-force-graph-2d` 이미 설치됨 → KnowledgeGraph 확장 비용 낮음
- `compromise` (NLP 라이브러리) 이미 설치됨 → 키워드 추출 보조 가능

---

## 구현 단계

### Phase 1: 브라우저 임베딩 (외부 전송 없음)
```javascript
// src/utils/embeddingService.js (신규)
import { pipeline } from "@xenova/transformers";

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
  { device: "wasm" }  // WebGPU 있으면 자동 전환
);

export async function embed(text) {
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);  // Float32Array → 일반 배열
}
```

### Phase 2: IndexedDB에 임베딩 저장 (database.js v5)
```javascript
this.version(5).stores({
  embeddings: '&docId, updatedAt'  // docId를 PK로, 벡터는 blob
});
```

### Phase 3: 코사인 유사도 검색
```javascript
// sqlite-vec 대신 순수 JS로도 가능 (문서 수 < 1000이면 충분)
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (magA * magB);
}
```

---

## 핵심 패키지

| 패키지 | 용도 | 크기 | 브라우저 |
|---|---|---|---|
| `@xenova/transformers` | 임베딩 생성 | 모델 23MB | ✅ |
| `sqlite-vec` | 벡터 유사도 검색 | 경량 | ✅ (WASM) |
| `sql.js` | 브라우저 SQLite | ~1MB | ✅ |
| `better-sqlite3` | Node.js SQLite | 경량 | ❌ |
| `ollama` npm | Ollama HTTP 클라이언트 | 경량 | 서버 필요 |

---

## 프라이버시 내러티브 (마케팅 포인트)

> "임베딩은 로컬(기기 안), 온톨로지 추출만 사용자 키로"

- 시맨틱 검색: 데이터가 기기 밖으로 나가지 않음
- Entity/Relation 추출: 사용자 API 키 사용 → Meki 서버 미경유
- 저장: GitHub private repo (사용자 소유)
- 미래: 온디바이스 LLM 성숙 시 추출도 로컬 전환 가능

---

## 관련 레퍼런스
- ref-009: Meki 바이럴 전략 (Prior fork)
- ref-010: Phase 10-11 전략 플랜
- ref-012: Phase 10 피벗 결정 로그
