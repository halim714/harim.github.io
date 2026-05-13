# References 인덱스 (2026-05-12 정리)

## 활성 레퍼런스 (12개)

### 기반 문서 — 에이전트 인프라

| 파일 | 내용 |
|---|---|
| ref-01-agent-infra-antigravity.md | Antigravity 에이전트/커맨드/스킬 포맷 |
| ref-02-agent-infra-claude-code.md | Claude Code .claude 구조 + 역할 분담 |
| ref-03-meki-source-architecture.md | miki-editor 소스 구조 (services/sync/stores) |
| ref-04-agent-tool-map.md | 에이전트 도구 전체 맵 (roles/workflows/skills/commands) |

### 운영 이력 — 스웜 인프라

| 파일 | 내용 |
|---|---|
| ref-05-swarm-hang-diagnosis.md | run-swarm.sh hang 원인 분석 (v1~v5) |
| ref-06-swarm-postmortem.md | 포그라운드 파이프 해결 포스트모템 (v6 최종) |

### Phase 10~12 설계

| 파일 | 내용 |
|---|---|
| ref-07-viral-community-strategy.md | Prior fork + 커뮤니티 바이럴 전략 (Phase 12) |
| ref-08-memory-layer-analysis.md | Mem0/Graphify/Claude Code 메모리 시스템 분석. confidence 3단계 출처 |
| **ref-09-phase10-source-of-truth.md** | **Phase 10 Source of Truth** — 피벗 기록, 데이터 파이프라인, Reflection 매체 구조, 네 박자 루프/append-only/Tool 계약 |
| ref-10-local-embedding-stack.md | 로컬 임베딩 스택 (Transformers.js + sqlite-vec) |
| ref-11-korean-nlp-stack.md | Kiwi WASM 한국어 형태소 분석 + 실측 결과 |
| **ref-12-reflection-system-design.md** | **Reflection 시스템 SoT** — 증거 기반 tier(Grounded/Bridged/Speculative), Relation/Identity Reflection 스키마, 드립 피드 발행, 콜드 스타트, 선호 학습 루프 |

---

## 아카이브 (archive/) — 4개

| 파일 | 폐기 이유 | 계승 내용 |
|---|---|---|
| archived-openclaw-integration.md | OpenClaw → BYOK 전환 | append-only → ref-09 |
| archived-openclaw-roadmap.md | OpenClaw 기반 로드맵 폐기 | graph.jsonl 구조 → ref-09 |
| archived-openclaw-strategic-plan.md | OpenClaw 기반 설계 폐기 | 네 박자 루프 / diff → ref-09 |
| archived-tool-contract-adoption.md | Tool 계약 도입 제안 | Tool 계약 패턴 → ref-09 |
