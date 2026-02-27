---
name: safe-edit
description: 코드 수정 시 기존 코드 파괴를 방지하는 안전 규칙. 수정 태스크를 수행하는 에이전트(api_dev, frontend_dev)가 참조한다.
---

# Safe Edit — 코드 수정 안전 규칙

> 이 스킬은 **파일을 수정하는 태스크**에서만 로드된다. 읽기 전용(test_verify)은 해당 없음.

---

## ⚠️ 과거 사고 사례

에이전트가 `vercel.json`에 CSP 헤더를 추가하면서 기존 `functions`, `rewrites`, CORS 설정을 **전부 삭제**하여 API 전체가 작동 불능에 빠졌다.

**원인**: 파일 전체를 새 내용으로 덮어씀 (기존 구조 무시)

---

## 필수 수칙

1. **파일 수정 전 반드시 전체 내용을 먼저 읽어라** (`cat` 또는 `Read` 도구 사용)
2. **추가만 하라 (Additive Only)** — 기존 코드를 삭제하거나 교체하지 마라. 새 코드를 **기존 구조 안에 추가**하라.
3. **파일 전체를 덮어쓰지 마라** — 부분 수정(`Edit` 도구)만 사용하라.
4. **수정 후 `git diff`로 의도하지 않은 삭제가 없는지 반드시 확인하라.**

---

## 보호 대상 파일 (삭제/덮어쓰기 절대 금지)

| 파일 | 보존해야 할 구조 |
|---|---|
| `vercel.json` | `functions`, `rewrites`, `headers` 섹션 |
| `package.json` | 기존 `dependencies`, `devDependencies` |
| `src/stores/` | Zustand 슬라이스 export 구조 |
| `src/services/github.js` | Octokit 래핑 함수 시그니처 |
| `src/sync/index.js` | SyncManager 클래스 구조 |

---

## 검증 체크리스트 (수정 후 반드시 실행)

```bash
# 1. 의도하지 않은 삭제 확인
git diff --stat

# 2. 삭제 라인이 추가 라인보다 많으면 경고
ADD=$(git diff --numstat | awk '{s+=$1}END{print s+0}')
DEL=$(git diff --numstat | awk '{s+=$2}END{print s+0}')
echo "additions=$ADD deletions=$DEL"

# 3. 빌드 성공 확인
npm run build
```
