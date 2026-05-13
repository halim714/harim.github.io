---
id: ref-007
topic: OpenClaw + Meki 통합 분석 — AI-first 온톨로지 구축 전략
created: 2026-03-16
tags: [openclaw, mcp, ontology, graph-rag, harness, agent, roadmap]
---

# OpenClaw + Meki 통합 분석: AI-first 온톨로지 구축 전략

## 1. OpenClaw 현황 (2026-03 기준)

### 정의
OpenClaw = 오픈소스 로컬-실행 자율 AI 에이전트 프레임워크. Docker 기반, MCP 지원, 스킬 플러그인 시스템.

### 시장 동향
- 2026년 초 중국 빅테크 앞다퉈 적용 (Tencent "lobster special forces", ByteDance "ArkClaw", Alibaba 전용 앱)
- 개발자 커뮤니티: Mac Mini + Docker + OpenClaw + 챗봇 인터페이스 + MCP 조합 광범위 채택
- 중국 정부는 보안 우려로 국영기업 사용 제한 통보

### 핵심 기능 (Meki 관련)
- **Ontology Skill**: typed knowledge graph (Entity, Relation, Type, Properties)
  - JSONL append-only 저장 (`memory/ontology/graph.jsonl`)
  - Schema validation (`memory/ontology/schema.yaml`)
  - 기본 Entity 타입: Person, Project, Task, Event, Document, Credential
- **MCP 통합**: Model Context Protocol로 외부 서비스 연결 (Notion, Slack, 이메일 등)
- **RAG**: 로컬 마크다운 파일 인덱싱, SQLite 임베딩 저장, 시맨틱 검색
- **Docker 배포**: 멀티스테이지 빌드, 에이전트 샌드박싱

### 소스
- https://docs.openclaw.ai/install/docker
- https://github.com/openclaw/skills/blob/main/skills/oswalpalash/ontology/SKILL.md
- https://openclawlaunch.com/guides/openclaw-mcp
- https://www.cnbc.com/2026/03/12/china-openclaw-ai-agent-adoption-tech-companies-government-support-lobster-shrimp.html
- https://fortune.com/2026/03/14/openclaw-china-ai-agent-boom-open-source-lobster-craze-minimax-qwen/

---

## 2. 기존 계획 vs AI-first 접근법 비교

### 기존 계획 (bottom-up, 수동)
```
Phase 9: 위키링크 완성 + 백링크
Phase 10: 지식 그래프 통합
Phase 11: Entity/Relation 1급 객체화
Phase 12: 하니스 프로파일
Phase 13: 온톨로지 버전관리
Phase 14: 트랜스개체화 인프라
```
문제: 6단계, 사용자가 수동으로 모든 관계를 구축해야 함.

### AI-first 접근법 (top-down, 자동)
```
Phase 9:  MCP 게이트웨이 + OpenClaw 통합
Phase 10: 하니스 리뷰 + 피드백 루프
Phase 11: 공동체 교환 인프라
```
장점: 3단계로 압축, AI가 온톨로지 자동 구축, 사용자는 리뷰+조정에 집중.

---

## 3. 이론 구조

```
기존 데이터 소스 (Notion, Apple Notes, Slack, KakaoTok, Email)
    ↓ MCP 연결 (감각 상태 — FEP 개체막)
OpenClaw Agent (로컬 Docker, 데이터 주권 보장)
    ↓ Ontology Skill → 자동 Graph RAG + 온톨로지 구축
사용자 리뷰 UI (하니스 조정 — 능동추론/개체화)
    ↓ 피드백 루프 → 에이전트 학습 → 온톨로지 수렴
개인 온톨로지 → 공동체 교환 (Claw Hub 등)
```

### 철학적 정합성
| 철학 축 | 대응 |
|---------|------|
| FEP 개체막 | MCP = 감각 상태, 퍼블리시 = 행위 상태, OpenClaw = 내부 생성모델 |
| 시몽동 개체화 | AI 자동 구축 → 사용자 리뷰 = 전개체적 장에서 개체화 |
| 스티글러 3차 파지 | 온톨로지 = 기억의 외재화, 하니스 = 집단 생성모델의 버전관리 |
| 유크 후이 코스모테크닉스 | 다양한 하니스 공존 = technodiversity |

---

## 4. Meki 차별화 포인트

OpenClaw = 범용 에이전트 엔진. Meki가 추가하는 것:

1. **하니스 에디터 UI** — 비개발자도 자기 온톨로지를 이해하고 조정 가능
2. **온톨로지 리뷰 뷰** — AI 구축 그래프 시각화 + 관계 수정 인터페이스
3. **버전관리 + fork/merge** — GitHub이 코드에 한 일을 의미체계에
4. **철학적 프레임워크** — 개체화 인프라라는 정체성

"OpenClaw는 엔진, Meki는 조종석"

---

## 5. 위험 요소

| 위험 | 대응 전략 |
|------|----------|
| 데이터 주권 | OpenClaw 로컬 실행 + E2EE Vault 결합 |
| 자동 온톨로지 품질 | 하니스 피드백 루프 (관계 승인/거절/수정 → 에이전트 재학습) |
| OpenClaw 의존성 | Meki가 소유하는 것 = 하니스+온톨로지 데이터(JSONL/YAML). OpenClaw는 교체 가능한 실행 엔진 |

---

## 6. 수정 로드맵 (제안)

### Phase 9: MCP 게이트웨이 + OpenClaw 통합
- 기존 노트 소스 MCP 연결 (Notion, Apple Notes, Slack 등)
- OpenClaw Docker 로컬 실행 환경
- Ontology Skill 기반 자동 그래프 구축 파이프라인

### Phase 10: 하니스 리뷰 + 피드백 루프
- 온톨로지 시각화 UI (AI 구축 그래프 열람)
- 하니스 에디터 (프롬프트/정책/스키마 조정)
- 피드백 메커니즘 (관계 승인/거절/수정 → 에이전트 학습)
- 온톨로지 버전 스냅샷

### Phase 11: 공동체 교환 인프라
- 하니스/온톨로지 퍼블리시 + fork
- 브리지 온톨로지 (다른 세계관 간 상호참조)
- 프로비넌스 체인 (기여 이력 추적)
