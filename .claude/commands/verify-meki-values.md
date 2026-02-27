# verify-meki-values

Meki의 5가지 핵심 가치를 현재 코드 변경에 빠르게 체크합니다.
작업 완료 전 마지막 자기검증 단계에서 호출합니다.

**실행 절차:**

다음 5가지를 순서대로 확인하고 각 항목에 ✅ 또는 ❌를 표시하라:

### 1. 데이터 주권 — miki-data 데이터가 외부로 나가지 않는가?
```bash
git diff | grep "^\+" | grep -E "fetch\(|axios\." | grep -vE "api\.github\.com|gemini|openrouter"
```
→ 출력이 없으면 ✅, 있으면 ❌

### 2. 사유 흐름 보호 — Auto-Save/오프라인 기능이 정상인가?
```bash
git diff --name-only | grep -E "autosave|sync|database|SyncManager"
```
→ 관련 파일 변경 시 SyncManager 로직이 올바른지 확인

### 3. 위키 연결성 유지 — wiki-link/tag 파싱이 훼손되지 않았는가?
```bash
git diff src/ | grep -E "^\-.*(\[\[|\]\]|#[a-zA-Z])"
```
→ 기존 파싱 로직 삭제가 없으면 ✅

### 4. 원본 데이터 보호 — GitHub 파일을 API 없이 직접 수정하지 않는가?
```bash
git diff | grep "^\+" | grep -E "writeFile|fs\." | grep -v "comment"
```
→ 출력이 없으면 ✅

### 5. harness 파이프라인 호환성 — services/ 인터페이스 구조가 유지되는가?
```bash
git diff src/services/ | grep "^\-export"
```
→ export 시그니처 삭제가 없으면 ✅

### 결과 보고
```
## Meki 가치 체크 결과

- [ ] 데이터 주권: ✅/❌
- [ ] 사유 흐름 보호: ✅/❌
- [ ] 위키 연결성: ✅/❌
- [ ] 원본 데이터 보호: ✅/❌
- [ ] harness 호환성: ✅/❌

→ 전체: PASS / FAIL (❌ 항목: ___)
```

FAIL이면 `/report-failure`를 실행하라.
