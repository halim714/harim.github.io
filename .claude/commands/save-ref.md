# save-ref

새로운 조사 결과를 .agents/references/ 에 레퍼런스로 저장합니다.
재사용 가치가 있는 조사·분석 결과를 영구 보관합니다.

**사용법:** `/save-ref [주제]`
- 예시: `/save-ref github-api-rate-limits`

**실행 절차:**

1. 기존 레퍼런스의 최대 번호를 확인하라:
```bash
ls /Users/halim/Desktop/meeki/meki/.agents/references/ref-*.md 2>/dev/null | sort -V | tail -1
```

2. 다음 번호를 계산하라.

3. 다음 형식으로 파일을 생성하라:

```
파일명: ref-NNN-$ARGUMENTS.md
위치: /Users/halim/Desktop/meeki/meki/.agents/references/
```

```markdown
---
id: ref-NNN
topic: $ARGUMENTS
created: [오늘 날짜]
tags: [관련 태그들]
---

# [제목]

[조사/분석 내용 — 재사용 가능한 형태로 구조화]
```

4. 생성 후 확인:
```
✅ 레퍼런스 저장 완료
- ID: ref-NNN
- 주제: $ARGUMENTS
- 경로: .agents/references/ref-NNN-$ARGUMENTS.md
```

**주의:** 이미 같은 주제의 레퍼런스가 있으면 새로 생성하지 말고 기존 파일을 업데이트하라.
