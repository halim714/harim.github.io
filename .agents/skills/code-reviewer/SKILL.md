---
name: code-reviewer
description: Meki 프로젝트의 스웜 에이전트 결과물을 코드 품질 + Meki 핵심 가치 관점으로 자동 검토하는 스킬
---

# Code Reviewer Skill

이 스킬은 `swarm-manager` 워크플로우의 Step 4(검증)에서 반복적으로 사용됩니다.
스웜 에이전트가 작성한 코드를 Meki의 가치 관점과 코드 품질 관점으로 교차 검토합니다.

## 사용 시점

- `swarm-manager` Step 4: 에이전트 결과물 검증 시
- `agent-optimizer` Step 1: 실패 원인 분석 전 코드 확인 시
- Antigravity가 직접 코드 리뷰를 수행할 때

## 리뷰 절차

### Step 1: 변경 범위 파악
```bash
git diff --stat
git diff --name-only
```

### Step 2: Meki 가치 체크 (5가지)

```bash
# 1. 데이터 주권 침해 여부 — 외부 서버 전송 코드 탐지
git diff | grep -E "^\+" | grep -E "fetch|axios|XMLHttpRequest" | grep -v "api.github.com\|gemini\|openrouter"

# 2. 사유 흐름 방해 여부 — auto-save, offline 관련 파일 변경 확인
git diff --name-only | grep -E "sync|autosave|database"

# 3. 위키 연결성 훼손 여부 — wiki-link 파서 변경 감지
git diff src/ | grep -E "\[\[|\]\]|#tag"

# 4. 원본 데이터 직접 수정 여부 (금지)
git diff | grep -E "miki-data|\.github\.io" | grep "^\+"

# 5. harness 파이프라인 호환성 — services/ 구조 변경 감지
git diff --name-only | grep "services/"
```

### Step 3: 코드 품질 체크

```bash
# 빌드 오류
npm run build 2>&1 | grep -E "^(error|Error)" | head -10

# 스코프 침범 — 에이전트 담당 외 파일 수정 여부
# (태스크 ID의 role에 따라 허용 경로 확인)
```

### Step 4: 리뷰 결과 보고

다음 형식으로 결과를 보고한다:

```markdown
## Code Review 결과

**태스크 ID**: [P1-T1 등]
**검토한 파일**: [파일 목록]

### ✅ 통과 항목
- [ ] 데이터 주권 침해 없음
- [ ] 사유 흐름 보호
- [ ] 위키 연결성 유지
- [ ] harness 호환성
- [ ] 빌드 성공

### ❌ 문제 발견 (있을 경우)
- **문제**: [설명]
- **위치**: [파일:라인]
- **심각도**: Critical / Warning / Info
- **SOP 개선 필요**: Yes(→ agent-optimizer 실행) / No
```
