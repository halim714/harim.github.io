# security-audit

현재 코드 변경에 대해 보안 취약점을 신속하게 감사합니다.
Phase 1(XSS), Phase 2(JWT/WS), Phase 5(E2EE) 태스크 완료 시 호출합니다.

**사용법:** `/security-audit [phase번호]`
- 예시: `/security-audit 1`

**Phase별 감사 항목:**

### Phase 1 감사
```bash
# XSS: innerHTML 미보호 탐지
grep -rn "innerHTML\|dangerouslySetInnerHTML" src/ | grep -v "DOMPurify\|sanitize"

# CSP: vercel.json 헤더 존재 확인
cat /Users/halim/Desktop/meeki/meki/miki-editor/vercel.json | grep -A3 "Content-Security"

# 토큰 노출: localStorage에 토큰 저장 여부
grep -rn "localStorage\.set" src/ | grep -i "token\|auth\|key"
```

### Phase 2 감사
```bash
# JWT HttpOnly 설정 확인
grep -rn "cookie" api/ | grep -c "HttpOnly"

# WS 인증 없는 핸들러 탐지
grep -rn "ws\.on\|socket\.on" . | grep -v "verify\|auth\|token"
```

### Phase 5 감사
```bash
# E2EE: content가 암호화 없이 전송되는지 확인
grep -rn "createOrUpdateFile" src/ | grep -v "vault\|encrypt"
```

### 결과 보고
```markdown
## 보안 감사 결과 — Phase $ARGUMENTS

### 🔴 Critical
- (없음 또는 항목)

### 🟡 Warning
- (없음 또는 항목)

### ✅ 통과
- (통과 항목 목록)

→ 종합: CLEAN / ISSUES FOUND
```

ISSUES FOUND인 경우 해당 파일·라인을 포함해 `/report-failure`로 보고하라.
