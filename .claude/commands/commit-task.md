# commit-task

태스크 완료 후 변경사항을 표준 형식의 커밋 메시지로 커밋합니다.
Meki 프로젝트의 커밋 컨벤션을 강제합니다.

**사용법:** `/commit-task [태스크ID]`
- 예시: `/commit-task P1-T1`

**실행 절차:**

1. 변경된 파일을 확인하라:
```bash
git diff --stat
git status
```

2. 다음 규칙에 따라 커밋 타입을 결정하라:

| 변경 내용 | 타입 |
|---|---|
| 새 기능 추가 | `feat` |
| 버그 수정 | `fix` |
| 보안 관련 | `security` |
| 인프라/설정 | `chore` |
| 리팩터링 | `refactor` |
| 테스트 추가 | `test` |
| 문서 추가/수정 | `docs` |

3. 다음 형식으로 커밋하라:

```bash
git add -p  # 대화형 스테이징 (전체 파일이면 git add <파일>)
git commit -m "<type>(<scope>): <설명> [<태스크ID>]"
```

**예시 커밋 메시지:**
```
security(csp): add Content-Security-Policy headers to vercel.json [P1-T1]
feat(sanitize): add DOMPurify-based sanitizeHtml utility [P1-T2]
feat(preview): create IsolatedPreview component with iframe sandbox [P1-T4]
```

**금지 사항:**
- `git add .`로 모든 파일 일괄 커밋 금지 → 반드시 변경 파일 확인 후 선택적 스테이징
- `.env`, `.env.local` 파일 커밋 금지

4. 커밋 후 `/update-progress $ARGUMENTS done`을 실행하라.
