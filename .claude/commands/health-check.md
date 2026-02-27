# health-check

현재 코드 변경의 빌드 상태, Meki 가치 준수 여부, SOP 크기를 한번에 검증합니다.
스웜 에이전트가 작업 완료 전 자기검증 단계에서 호출합니다.

**사용법:** `/health-check [태스크ID]`

**실행 절차:**

1. 다음 스크립트를 실행하라:
```bash
cd /Users/halim/Desktop/meeki/meki/miki-editor
./scripts/health-check.sh $ARGUMENTS
```

2. 스크립트가 없거나 실행 불가한 경우 수동으로 다음을 순서대로 실행하라:

```bash
# Step 1: 빌드 확인
npm run build 2>&1 | tail -20

# Step 2: 변경 파일 요약
git diff --stat

# Step 3: 외부 전송 탐지
git diff | grep "^\+" | grep -E "fetch\(|axios\." | grep -v "api.github.com\|gemini\|openrouter"

# Step 4: SOP 파일 크기 확인
for f in /Users/halim/Desktop/meeki/meki/.agents/roles/*.md; do
  size=$(wc -c < "$f")
  [ "$size" -gt 8000 ] && echo "⚠️ 크기 초과: $f ($size bytes)"
done
```

3. 결과를 다음 형식으로 보고하라:

```
## Health Check 결과 — Task: $ARGUMENTS

- 빌드: ✅ 성공 / ❌ 실패
- 외부 전송: ✅ 없음 / ❌ 감지됨
- SOP 크기: ✅ 정상 / ⚠️ [파일명] 초과

→ 종합: PASS / FAIL
```

FAIL인 경우 즉시 작업을 중단하고 Antigravity에게 보고하라. 직접 재시도하지 마라.
