---
name: sop-writer
description: 에이전트 실패 로그를 분석하여 SOP Known Issues 섹션 업데이트 초안을 자동 생성하는 스킬
---

# SOP Writer Skill

이 스킬은 `agent-optimizer` 워크플로우의 Step 3(SOP 업데이트)에서 반복적으로 사용됩니다.
에이전트 실패 로그와 에러 메시지를 분석해 어떤 SOP에 어떤 규칙을 추가해야 하는지 초안을 생성합니다.

## 사용 시점

- `agent-optimizer` Step 3: SOP 업데이트 내용 작성 시
- `agent-improvement` Step 2: 룰 파일 초안 생성 시
- 실패 패턴이 3회 이상 반복될 때 근본 규칙화 시

## 절차

### Step 1: 실패 로그 파싱

```bash
# 최신 swarm 로그 파일 확인
ls -t /Users/halim/Desktop/meeki/meki/miki-editor/logs/ | head -5

# 로그에서 에러 추출
cat /Users/halim/Desktop/meeki/meki/miki-editor/logs/<최신로그파일> | grep -E "Error|error|FAIL|failed" | head -20
```

### Step 2: 실패 분류

| 에러 패턴 | 분류 | 타겟 SOP |
|---|---|---|
| `Cannot find module`, `import error` | C1 (컨텍스트 부재) | 해당 role의 SOP |
| `fetch to external`, `unauthorized transfer` | C2 (가치 위반) | `mekirule.md` |
| 다른 에이전트 파일 수정 | C3 (스코프 혼동) | 해당 role의 SOP |
| `npm test` 미실행 | C4 (검증 부재) | 해당 role의 SOP |
| 구현 방향이 요구사항과 다름 | C5 (프롬프트 모호) | `swarm-manager.md` |

### Step 3: SOP 업데이트 초안 생성

다음 형식의 마크다운 블록을 생성한다:

```markdown
<!-- SOP 업데이트 초안 — agent-optimizer가 검토 후 PR 생성 -->

### 타겟 파일: .agents/roles/[role명].md

#### YAML frontmatter 수정
version: "[현재버전 + 0.1]"

#### "과거 실수 기록" 에 추가할 행
| v[새버전] | [에러 유형 한 줄] | [재발 방지 규칙: "반드시 Y 방식을 사용할 것. X 방식은 [에러내용] 유발"] |

#### "필수 준수 규칙" 에 추가할 섹션 (필요 시)
### [규칙 제목]
> ⚠️ v[새버전] 추가: [어떤 실패에서 배웠는지]
- [구체적 지침 1]
- [구체적 지침 2]
```

### Step 4: 크기 검증

```bash
# SOP 파일 크기 확인 (8KB = 약 2000토큰 제한)
wc -c /Users/halim/Desktop/meeki/meki/.agents/roles/[role명].md
# 8000 초과 시: archive/ 로 오래된 규칙 이동 후 재측정
```
