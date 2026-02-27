---
name: reference-lookup
description: .agents/references/ 디렉토리에서 레퍼런스를 검색·읽기·등록하는 스킬
---

# Reference Lookup Skill

이 스킬은 에이전트가 과거 조사 결과나 아키텍처 분석을 재활용할 때 사용합니다.
`.agents/references/` 디렉토리에 저장된 레퍼런스 문서를 검색하고 읽습니다.

## 레퍼런스 디렉토리 위치

```
/Users/halim/Desktop/meeki/meki/.agents/references/
```

## 레퍼런스 문서 포맷

모든 레퍼런스 파일은 다음 YAML frontmatter를 가진다:

```yaml
---
id: ref-NNN           # 순차 번호
topic: 주제-키워드     # 검색 키
created: YYYY-MM-DD
tags: [tag1, tag2]    # 검색 보조 태그
---
```

파일명 규칙: `ref-NNN-주제.md`

## 사용법

### A. 레퍼런스 검색 (주제로)

```bash
# 태그 또는 주제 키워드로 검색
grep -rl "keyword" /Users/halim/Desktop/meeki/meki/.agents/references/

# frontmatter의 topic으로 검색
grep -l "topic: .*architecture" /Users/halim/Desktop/meeki/meki/.agents/references/*.md

# 태그로 검색
grep -l "tags:.*meki" /Users/halim/Desktop/meeki/meki/.agents/references/*.md
```

### B. 레퍼런스 목록 조회

```bash
# 전체 목록 (id + topic)
head -4 /Users/halim/Desktop/meeki/meki/.agents/references/ref-*.md | grep -E "^id:|^topic:"
```

### C. 레퍼런스 읽기

`view_file` 도구로 해당 파일을 직접 읽는다.

### D. 새 레퍼런스 등록

1. 기존 레퍼런스의 최대 ID를 확인:
```bash
ls /Users/halim/Desktop/meeki/meki/.agents/references/ref-*.md | tail -1
```

2. 다음 번호로 새 파일 생성 (frontmatter 포함):
```markdown
---
id: ref-NNN
topic: 새-조사-주제
created: YYYY-MM-DD
tags: [관련태그1, 관련태그2]
---

# 제목

[조사 내용]
```

## 현재 등록된 레퍼런스

| ID | 주제 | 태그 |
|---|---|---|
| ref-001 | antigravity-format | antigravity, format, agent-structure |
| ref-002 | claude-code-format | claude-code, format, slash-commands |
| ref-003 | meki-architecture | meki, architecture, source-analysis |
| ref-004 | meki-orchestration-architecture | meki, orchestration, opus, swarm |

## 에이전트 사용 지침

- **새 조사를 시작하기 전** 반드시 기존 레퍼런스를 검색하라
- **이미 있는 내용을 다시 조사하지 마라** — 레퍼런스에서 읽어라
- **조사 완료 후** 재사용 가치가 있으면 레퍼런스로 등록하라
- 레퍼런스가 오래되어 부정확하면 내용을 업데이트하고 `updated: YYYY-MM-DD`를 추가하라
