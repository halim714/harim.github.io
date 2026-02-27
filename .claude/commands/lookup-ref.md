# lookup-ref

.agents/references/ 에서 레퍼런스를 검색하고 읽습니다.
새 조사를 시작하기 전에 기존 레퍼런스를 확인해 중복 조사를 방지합니다.

**사용법:** `/lookup-ref [검색어]`
- 예시: `/lookup-ref architecture`
- 예시: `/lookup-ref format`
- 인수 없으면 전체 목록 출력

**실행 절차:**

1. 인수가 없으면 전체 레퍼런스 목록을 출력하라:
```bash
echo "=== 레퍼런스 목록 ==="
for f in /Users/halim/Desktop/meeki/meki/.agents/references/ref-*.md; do
  id=$(grep "^id:" "$f" | sed 's/id: //')
  topic=$(grep "^topic:" "$f" | sed 's/topic: //')
  echo "  $id — $topic"
done
```

2. 검색어가 있으면 매칭되는 레퍼런스를 찾아라:
```bash
grep -rl "$ARGUMENTS" /Users/halim/Desktop/meeki/meki/.agents/references/ 2>/dev/null
```

3. 검색 결과가 있으면 해당 파일의 내용을 읽고 요약하라.

4. 검색 결과가 없으면:
```
❌ "$ARGUMENTS" 관련 레퍼런스가 없습니다.
조사 후 /save-ref 으로 저장하세요.
```
