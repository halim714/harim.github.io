# 📋 PRD: Meki 지능형 AI 첨부 시스템

**문서 버전**: 1.0
**작성일**: 2026-02-02
**상태**: 검토 대기

---

## 1. 개요 (Overview)

### 1.1. 배경 및 문제점
현재 Meki 에디터의 첨부 기능은 사용자가 **파일 유형을 수동으로 선택**해야 합니다 (예: 책, 영화, 이미지). 이는 비개발자 사용자에게 인지 부하를 주며, 잘못된 분류로 인해 데이터 품질이 저하될 수 있습니다.

### 1.2. 제안 솔루션
**AI가 파일 내용을 자동으로 분석**하여 유형을 판단하고, 제목/요약 등의 메타데이터를 추출하는 "Zero-Selection" 시스템을 구축합니다. 사용자는 파일을 던지기만 하면 됩니다.

### 1.3. 목표 (Goals)
| 목표 | 측정 지표 |
|------|-----------|
| 사용자 인터랙션 단축 | 첨부 완료까지 클릭 수 3회 → 1회 |
| AI 분류 정확도 | 기본 유형(이미지, 문서, 링크) 95% 이상 |
| 비용 효율성 | 첨부 1건당 평균 API 비용 $0.01 이하 (Standard 모드 기준) |

---

## 2. 타겟 사용자 (Target Users)

- **페르소나**: 비개발자인 지식 근로자, 작가, 연구자
- **핵심 니즈**: 생각을 정리하고 기록하는 데 집중하고 싶음. 기술적인 설정에 시간을 들이고 싶지 않음.
- **제약 조건**: 로컬 서버(Ollama 등)를 설치하거나 관리할 수 없음.

---

## 3. 핵심 기능 (Key Features)

### 3.1. AI 자동 유형 판단 (Core)
- 사용자가 파일을 업로드하면, AI가 MIME 타입과 내용을 분석하여 카테고리를 결정합니다.
- **지원 유형**: `image`, `document`(PDF 등), `book`, `movie`, `link`, `audio`

### 3.2. 비동기 처리 및 즉각적 피드백
- 파일 업로드 즉시 UI에 "분석 중" 상태의 카드가 생성됩니다.
- 백그라운드에서 AI 분석이 완료되면 카드가 자동으로 업데이트됩니다.
- 사용자는 분석 중에도 문서 작성을 계속할 수 있습니다.

### 3.3. 모델 티어링 (Cursor AI 스타일)
| 티어 | 대상 | 제공 혜택 | 모델 및 비용 |
|------|------|-----------|--------------|
| **Standard** | 모든 사용자 | **월 200건 무료** | Qwen 72B (운영비~$0.1/월) |
| **Premium** | Pro Plan 구독자 | **자체 RAG 1,000회** + **개인 API Key(BYOK)** | Claude 3.5 Sonnet 등 자유 선택 |

---

## 4. 할당량 및 정책 (Quota Policy)

### 4.1. Standard 유저 정책
- 월 200건의 기본 AI 분석을 무료로 제공합니다.
- 할당량 초과 시, 사용자에게 **Premium 업그레이드** 또는 다음 달 갱신 대기를 안내하는 팝업을 노출합니다.

### 4.2. Premium (Pro Plan) 유저 정책
- 월 구독 모델로 운영됩니다.
- 고성능 자체 RAG 인덱싱 및 검색을 **월 1,000회**까지 보장합니다.
- 더 정밀한 Vision 분석이나 무제한 사용을 위해 **사용자의 개인 API Key(Anthropic, OpenAI 등)를 입력(BYOK)**하여 연결할 수 있는 기능을 제공합니다.

---

## 5. UX 흐름 (User Flow)

```mermaid
graph TD
    A[사용자: 파일 드롭/선택] --> B{모달 열림}
    B --> C[티어 선택 (Standard/Premium)]
    C --> D[즉시 'pending' 카드 생성]
    D --> E[백그라운드 AI 분석 시작]
    E --> F{분석 완료?}
    F -- 성공 --> G[카드 업데이트: 제목, 타입, 요약]
    F -- 실패 --> H[카드 에러 상태 표시]
    G --> I[Front Matter에 메타데이터 저장]
```

---

## 6. 기술 아키텍처 (Technical Architecture)

### 5.1. 컴포넌트 구조
| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| `ai.js` | `src/services/ai.js` | AI 모델 라우팅 및 분석 API 호출 |
| `useAttachment` | `src/hooks/useAttachment.js` | 첨부 상태 관리 (pending → ready) |
| `AttachmentBox` | `src/components/editor/AttachmentBox.jsx` | 첨부 목록 UI 렌더링 |
| `AttachmentModal` | `src/components/editor/AttachmentModal.jsx` | 파일 드롭 및 티어 선택 UI |

### 5.2. 데이터 흐름
1. **업로드**: 파일 → GitHub Issues CDN (기존 로직 유지)
2. **분석**: 파일 메타데이터 → AI API (Qwen/Claude)
3. **저장**: 분석 결과 → 문서 Front Matter (`attachments` 필드)

### 5.3. AI 서비스 선택 (제안)
- **기본 (Standard)**: [OpenRouter](https://openrouter.ai) 프록시를 통해 `qwen-2.5-72b` 호출
- **프리미엄 (Premium)**: Anthropic API를 통해 `claude-3-5-sonnet` 호출

---

## 7. 비용 모델 및 최적화 (Cost & Optimization)

### 6.1. 운영 비용 추정
| 시나리오 | 입력 토큰 | 출력 토큰 | 예상 비용/건 |
|----------|-----------|-----------|--------------|
| Standard (Qwen) | ~500 | ~200 | ~$0.001 |
| Premium (Claude Sonnet) | ~1000 | ~500 | ~$0.01 |

### 6.2. 비용 절감 전략
1. **시맨틱 캐싱**: 반복 파일 분석 비용 0원
2. **모델 라우팅**: 이미지가 아니면 Standard 강제 적용
3. **Prompt Caching (Anthropic)**: 시스템 프롬프트 고정 시 90% 할인

---

## 8. 면제 조항 (Out of Scope)

- [ ] 로컬 AI 모델 실행 (Ollama 등)
- [ ] 오프라인 분석 지원
- [ ] 사용자 정의 분류 카테고리 추가

---

## 9. 성공 기준 (Success Criteria)

- [ ] 파일 드롭 후 1초 이내에 'pending' 카드가 UI에 표시됨
- [ ] Standard 모델로 기본 이미지/문서 분류 정확도 95% 이상
- [ ] 첨부 1건당 평균 API 비용 $0.01 이하 달성
- [ ] 기존 에디터 기능(저장, 게시 등)에 영향 없음

---

## 10. 구현 마일스톤 (Implementation Milestones)

| 단계 | 내용 | 예상 시간 |
|------|------|-----------|
| **Phase 1** | `useAttachment` 훅에 pending 상태 머신 도입 | 2시간 |
| **Phase 2** | `AttachmentBox` 스켈레톤 카드 및 리스트 UI 구현 | 2시간 |
| **Phase 3** | `ai.js` 서비스 레이어 (Mock → 실제 API) | 3시간 |
| **Phase 4** | `AttachmentModal` 간소화 및 티어 선택 UI | 2시간 |
| **Phase 5** | 시맨틱 캐싱 및 비용 최적화 | 2시간 |
| **Phase 6** | E2E 테스트 및 안정화 | 2시간 |

---

## 11. 리뷰 요청 사항 (Review Items)

1. **모델 선택**: Standard 기본 모델로 Qwen vs DeepSeek 중 어느 것이 더 적합할까요?
2. **비용 부담**: 기본 제공 할당량(예: 월 100건 무료)을 설정해야 할까요?
3. **UI 디자인**: 가로 스크롤 카드 리스트 vs 그리드 형태 중 선호하시는 방향이 있으신가요?
