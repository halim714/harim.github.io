---
description: 에이전트 실패 시 코드가 아닌 역할 SOP(프롬프트)를 최적화하는 Meta-Agent 워크플로우
---

# Agent Optimizer Workflow

> **이 워크플로우의 핵심 원칙**: 하위 에이전트가 실패하면 **코드를 고치지 마라. SOP를 고쳐라.**

Antigravity(Opus)가 하위 에이전트(Claude Code Swarm)의 SOP를 분석하고 업데이트하는 메타 최적화 루프입니다.

```
실패 발생
  → [이 워크플로우] Antigravity가 SOP 분석
  → .agents/roles/ 업데이트 (PR 방식)
  → 개선된 SOP로 재실행
  → 성공 or 재루프
```

---

## Step 1: 실패 보고 수집

에이전트로부터 다음 정보를 수집한다:

```
- 태스크 ID
- 어떤 role 에이전트가 실패했는가: frontend_dev / api_dev / test_verify
- 실패 유형: 빌드 오류 / 테스트 실패 / 가치 위반 / 스코프 침범
- 실패 분류: C1(컨텍스트 부재) / C2(가치 위반) / C3(스코프 혼동) / C4(검증 부재) / C5(프롬프트 모호)
- 에러 메시지 (정확한 텍스트)
- 테스트 검증 에이전트(test_verify)의 SOP 개선 제안
```

## Step 2: SOP 근본 원인 분석

다음 질문에 답하라:

1. **이 에러가 에이전트의 SOP 지침 부재에서 비롯되었는가?**
   - YES → 해당 role의 SOP를 업데이트 (Step 3)
   - NO → 다른 원인 탐색 (아래)

2. **SOP는 올바른데 에이전트가 오해했는가?**
   - YES → SOP 표현을 더 명확하게 수정 (예시/반례 추가)

3. **태스크 요구사항 자체가 모호했는가?**
   - YES → SOP가 아닌 `swarm-manager.md` 태스크 분할 지침 업데이트

4. **동일한 에러가 3회 이상 반복되는가?**
   - YES → 자동 해결 포기, 사용자에게 에스컬레이션

> **판단이 불확실할 경우 사용자에게 에스컬레이션하라. 추측으로 SOP를 수정하지 마라.**

## Step 3: SOP 업데이트 (버전 관리)

해당 role 파일의 두 곳을 수정한다:

### A. YAML frontmatter 버전 업데이트
```yaml
version: "1.1"  # 1.0 → 1.1
```

### B. "과거 실수 기록" 섹션에 항목 추가
```markdown
| v1.1 | [실수 유형] | [반드시 Y방식을 사용할 것. 이전에 X방식으로 했다가 [에러내용] 발생] |
```

### C. "필수 준수 규칙" 섹션에 새 규칙 추가 (필요 시)
```markdown
### [새 규칙 제목]
> ⚠️ v1.1 추가: [어떤 실패에서 배웠는지]
- [구체적 지침]
```

**제약:**
- 섹션당 규칙은 최대 10개 (컨텍스트 비대화 방지)
- 기존 규칙이 10개 초과 시 오래된 규칙을 `.agents/roles/archive/` 로 이동
- SOP 파일 전체 크기 2000토큰(약 8KB) 초과 금지

## Step 4: PR 방식 업데이트 (사용자 승인 필수)

```bash
# SOP 수정 내용 커밋
cd /Users/halim/Desktop/meeki/meki
git add .agents/roles/
git commit -m "feat(agents): optimize [role명] SOP v[버전] - [실패 유형 요약]"

# 브랜치 생성 (main에 직접 push 금지)
git checkout -b agent-sop/[role명]-v[버전]
git push origin agent-sop/[role명]-v[버전]

# PR 생성 (GitHub CLI 또는 사용자에게 링크 제공)
gh pr create \
  --title "🤖 Agent SOP 개선: [role명] v[버전]" \
  --body "## 개선 배경\n- 태스크: [태스크 ID]\n- 실패 분류: [C1~C5]\n- 원인: [한 줄 요약]\n\n## 변경 내용\n[변경된 규칙 설명]\n\n## 기대 효과\n[이 SOP 업데이트로 방지되는 실패]"
```

> **직접 merge 금지. 반드시 사용자 승인 후 merge.**

## Step 5: 개선된 SOP로 재실행

```bash
# 업데이트된 SOP로 swarm 재실행
./scripts/run-swarm.sh \
  "google/gemini-2.5-pro" \
  "<원래 실패한 태스크 프롬프트>" \
  /Users/halim/Desktop/meeki/meki/miki-editor \
  <role명> \
  <태스크ID>-retry
```

## Step 6: Optimizer Report 사용자에게 보고

```markdown
## 🤖 Agent Optimizer Report

**대상 에이전트**: [frontend_dev / api_dev / test_verify]
**SOP 버전**: v[이전] → v[새버전]
**실패 분류**: C[번호] — [분류명]
**근본 원인**: [한 줄 요약]

**추가된 규칙**: 
- "[새로 추가된 규칙 요약]"

**PR**: [PR URL]
**재실행 결과**: 성공 / 실패 (실패 시 사유)
```

---

## 탈출 조건 (Loop Exit)

| 조건 | 처리 |
|---|---|
| 동일 실패 3회 반복 | 즉시 사용자 에스컬레이션 |
| SOP 크기 2000토큰 초과 | archive 이동 후 사용자 알림 |
| 실패 원인을 특정 불가 | 추측 금지, 사용자 에스컬레이션 |
