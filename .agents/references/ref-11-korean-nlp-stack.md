# ref-014: Meki 한국어 NLP 스택 선정

> 작성일: 2026-05-12
> 출처: seCall(hang-in/seCall), Kiwi(bab2min/Kiwi) 분석
> 목적: Phase 10 검색/추출 파이프라인의 한국어 처리 전략 확정

---

## 왜 한국어 전용 처리가 필요한가

한국어는 교착어다. "생각했었다", "생각하는", "생각이"가 모두 다른 토큰으로 잡힌다.
영어처럼 공백 분리(whitespace tokenization)로는 검색이 안 된다.
"투자"를 검색했는데 "투자했던", "투자에", "투자를"이 검색 결과에서 빠지면 온톨로지 구축이 불가능하다.

---

## 형태소 분석기 비교

### 1. Kiwi (bab2min/Kiwi) — 1순위 후보

- **언어**: C++ 코어 (720 stars, LGPL v3)
- **정확도**: 웹 텍스트 87%, 문어 텍스트 94%
- **모호성 해소**: 86.7% (딥러닝 기반 분석기 50~70% 대비 우수)
- **오타 교정**: 0.13.0부터 내장
- **WASM 바인딩**: `bindings/wasm/` 디렉토리에 공식 존재 (RicBent 기여)
- **기타 바인딩**: Python, Java, Swift, Rust, Go, Flutter, Android(AAR), C#

**Meki 적용 가능성**:
- **브라우저(WASM)**: `bindings/wasm/`을 빌드하면 브라우저에서 직접 형태소 분석 가능. 데이터가 로컬에서만 처리되므로 프라이버시 완벽 보장.
- **MekiSync 데몬(서버사이드)**: Node.js에서 WASM으로 사용하거나, C++ 바이너리를 직접 호출 가능.
- **모델 크기 확인 필요**: WASM 빌드 시 모델 파일 크기가 브라우저 로딩에 적합한지 검증 필요 (Git LFS로 관리될 정도의 크기).

### 2. mecab-ko + kuromoji-ko (대안)

- MeCab의 한국어 사전(mecab-ko-dic) 기반
- `kuromoji-ko`가 npm 패키지로 존재
- **단점**: Kiwi 대비 정확도가 낮고, 오타 교정 기능 없음. 모호성 해소 성능 열세.

### 3. Lindera (seCall 사용)

- Rust 기반 형태소 분석기 (Lucene의 Kuromoji 포트)
- ko-dic 사전 탑재
- **단점**: Rust 전용. JS/WASM 바인딩 없음. Meki(JS/React)에서 직접 사용 불가.

---

## 결론: Kiwi WASM이 Meki의 최적 선택

| 요소 | Kiwi WASM | mecab-ko (kuromoji-ko) | Lindera |
|---|---|---|---|
| 브라우저 실행 | ✅ (공식 WASM) | ✅ (npm) | ❌ (Rust 전용) |
| 정확도 | 87~94% | 70~80% 추정 | 80% 추정 |
| 모호성 해소 | 86.7% | 50~70% | 50~70% |
| 오타 교정 | ✅ (내장) | ❌ | ❌ |
| 라이선스 | LGPL v3 | Apache 2.0 | Apache 2.0 |
| 한국어 특화 | ✅ (전용 설계) | △ (일본어 포트) | △ (일본어 포트) |

**결정**: Kiwi WASM을 1순위로 채택. LGPL v3이므로 Kiwi 자체를 수정하지 않는 한 상용 사용 가능.

---

## 임베딩 모델 (시맨틱 검색용)

### BGE-M3 (seCall 사용)

- BAAI(Beijing Academy of AI)에서 만든 다국어 임베딩 모델
- 1024차원, 100+ 언어 지원 (한국어 포함)
- seCall에서 Ollama로 로컬 실행

### Meki 적용 시 고려사항

Meki의 임베딩 전략은 ref-013에서 **Transformers.js + sqlite-vec (브라우저 로컬)**로 설계되어 있다.
BGE-M3을 Transformers.js로 브라우저에서 돌릴 수 있는지 확인 필요:
- BGE-M3은 568M 파라미터 — 브라우저에서 돌리기에는 무거울 수 있음
- 경량 대안: `bge-small-en-v1.5` (33M) 또는 `multilingual-e5-small` (118M)
- **결정 보류**: 브라우저에서 돌릴 모델 크기 한계를 먼저 벤치마크한 후 확정

---

## 검색 아키텍처 (seCall에서 차용)

seCall의 **하이브리드 검색 + RRF 융합** 구조를 Meki에 적용:

```
[사용자 쿼리]
     ├── BM25 전문 검색 (Kiwi WASM으로 형태소 분석 후 인덱싱)
     ├── 벡터 시맨틱 검색 (Transformers.js 임베딩 + sqlite-vec)
     └── RRF 융합 (k=60) → 최종 결과 정렬
```

- **BM25**: Kiwi로 형태소 분석 → 어간 추출 → SQLite FTS5 또는 브라우저 IndexedDB 인덱스
- **시맨틱**: Transformers.js로 임베딩 생성 → sqlite-vec HNSW 인덱스
- **융합**: Reciprocal Rank Fusion으로 두 결과를 병합

---

## 검증 결과 (2026-05-12 실측)

### kiwi-nlp npm 패키지

- **패키지명**: `kiwi-nlp` (npm 공식 배포, v0.23.0)
- **설치**: `npm install kiwi-nlp` — 의존성 0개, 632ms 설치 완료
- **WASM 파일**: `dist/kiwi-wasm.wasm` = **3.6MB**
- **JS 글루 코드**: `dist/build/kiwi-wasm.js` = 112KB
- **모델 파일**: 패키지에 미포함. 런타임에 URL로 `fetch`하여 로드하는 구조
- **Base 모델 크기**: 약 **34MB** (sj.knlm + sj.morph + dict 등 합산)
- **API**: `KiwiBuilder.create(wasmPath)` → `builder.build({ modelFiles })` → `kiwi.analyze(text)`
- **Worker 권장**: 공식 문서에서 "메인 스레드 차단을 피하려면 Worker에서 실행" 권고

### 브라우저 로딩 전략

| 구성 요소 | 크기 | 로딩 방식 |
|---|---|---|
| kiwi-wasm.wasm | 3.6MB | 정적 에셋으로 번들 (Vite) |
| Base 모델 파일 | ~34MB | CDN 또는 GitHub Pages에서 lazy fetch |
| **합계** | ~38MB | 첫 로딩 시 캐싱, 이후 즉시 사용 |

38MB는 브라우저 초기 로딩에는 무겁지만, 다음과 같이 대응 가능:
1. **Web Worker + lazy loading**: 메인 스레드를 차단하지 않고 백그라운드에서 모델을 로드
2. **IndexedDB 캐싱**: 첫 로딩 후 모델 파일을 IndexedDB에 저장하여 재방문 시 즉시 사용
3. **MekiSync 데몬에서 처리 (권장)**: 형태소 분석을 브라우저가 아닌 데스크톱 데몬에서 수행하면, 브라우저에 34MB를 다운로드할 필요가 없음. MekiSync가 메모를 추출할 때 동시에 형태소 분석까지 완료해서 토큰화된 결과를 Meki 서버로 전송.

**결론**: 형태소 분석은 MekiSync 데몬(데스크톱)에서 수행하는 것이 최적. 브라우저에서는 시맨틱 검색(임베딩)만 처리하고, BM25 전문 검색용 토큰은 서버에서 미리 인덱싱된 상태로 제공.

---

## Phase 10 액션 아이템

1. **Kiwi WASM 빌드 검증**: `bindings/wasm/`을 빌드하여 브라우저에서 형태소 분석이 동작하는지, 모델 파일 크기가 얼마인지 확인
2. **임베딩 모델 벤치마크**: Transformers.js에서 한국어 성능이 검증된 경량 다국어 모델 후보 3개를 브라우저에서 실행 테스트
3. **BM25 인덱스 구현**: Kiwi 형태소 분석 결과를 IndexedDB 기반 역인덱스에 저장하는 프로토타입
