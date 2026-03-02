#!/bin/bash
# security-state-check.sh — 보안 상태 정밀 검증
# 에이전트가 보안 수정을 완료한 후, 오케스트레이터가 실행하여
# "구현했다고 말한 것이 실제로 작동하는지" 자동 검증
#
# 사용법: ./scripts/security-state-check.sh
#
# 검출하는 패턴:
# 1. CORS 순서 버그 (토큰 교환 전 origin 검증 여부)
# 2. 미설치 의존성 (require했지만 package.json에 없는 모듈)
# 3. HttpOnly 쿠키 설정 일관성 (res.cookie 있지만 cookie-parser 없음)
# 4. JWT payload에 민감 정보 포함 여부
# 5. 전역 CORS '*' 패턴 잔존
# 6. 파괴적 변경 영향 범위 미처리 (함수 변경 후 호출자 깨짐)

set -euo pipefail

PROJECT_DIR="${1:-/Users/halim/Desktop/meeki/meki}"
MIKI_DIR="$PROJECT_DIR/miki-editor"
WS_PROXY_DIR="$PROJECT_DIR/ws-proxy"

FAIL=0
REPORT=""

echo "🔐 Security State Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. CORS 순서 검증 ───
echo ""
echo "1️⃣  CORS 순서 검증..."
if [ -f "$MIKI_DIR/api/auth/callback.js" ]; then
  # origin 검증이 fetch('github.com/...') 전에 나오는지
  ORIGIN_LINE=$(grep -n "isAllowed\|CORS_REJECTED\|Origin not allowed" "$MIKI_DIR/api/auth/callback.js" | head -1 | cut -d: -f1)
  FETCH_LINE=$(grep -n "fetch.*github.com.*access_token" "$MIKI_DIR/api/auth/callback.js" | head -1 | cut -d: -f1)
  
  if [ -n "$ORIGIN_LINE" ] && [ -n "$FETCH_LINE" ]; then
    if [ "$ORIGIN_LINE" -lt "$FETCH_LINE" ]; then
      echo "  ✅ origin 검증(L${ORIGIN_LINE})이 토큰 교환(L${FETCH_LINE}) 전에 실행됨"
    else
      echo "  ❌ CORS 순서 버그: 토큰 교환(L${FETCH_LINE})이 origin 검증(L${ORIGIN_LINE})보다 먼저"
      REPORT="$REPORT\n❌ CORS 순서 버그"
      FAIL=1
    fi
  else
    echo "  ⚠️ CORS 검증 패턴을 찾지 못함"
  fi
fi

# ─── 2. 전역 CORS '*' 잔존 검사 ───
echo ""
echo "2️⃣  전역 CORS '*' 패턴 검사..."
WILD_CORS=$(grep -rn "Access-Control-Allow-Origin.*\*" "$MIKI_DIR/api/" "$WS_PROXY_DIR/src/" --include="*.js" 2>/dev/null | grep -v "node_modules" || true)
if [ -n "$WILD_CORS" ]; then
  echo "  ❌ 와일드카드 CORS 발견:"
  echo "$WILD_CORS" | sed 's/^/    /'
  REPORT="$REPORT\n❌ 와일드카드 CORS 잔존"
  FAIL=1
else
  echo "  ✅ 와일드카드 CORS 없음"
fi

# ─── 3. JWT payload 민감 정보 검사 ───
echo ""
echo "3️⃣  JWT payload 민감 정보 검사..."
JWT_SENSITIVE=$(grep -n "ghToken\|access_token\|client_secret" "$WS_PROXY_DIR/src/server.js" 2>/dev/null | grep -i "payload\|jwt.sign\|const payload" || true)
if [ -n "$JWT_SENSITIVE" ]; then
  echo "  ❌ JWT payload에 민감 정보 포함 의심:"
  echo "$JWT_SENSITIVE" | sed 's/^/    /'
  REPORT="$REPORT\n❌ JWT payload 민감 정보"
  FAIL=1
else
  echo "  ✅ JWT payload에 민감 정보 없음"
fi

# ─── 4. 의존성 일관성 검사 (require vs package.json) ───
echo ""
echo "4️⃣  의존성 일관성 검사..."
if [ -d "$WS_PROXY_DIR" ]; then
  for MODULE in cookie-parser express jsonwebtoken ws; do
    REQUIRED=$(grep -rq "require.*$MODULE\|from.*$MODULE" "$WS_PROXY_DIR/src/" --include="*.js" 2>/dev/null && echo "yes" || echo "no")
    IN_PKG=$(grep -q "\"$MODULE\"" "$WS_PROXY_DIR/package.json" 2>/dev/null && echo "yes" || echo "no")
    
    if [ "$REQUIRED" = "yes" ] && [ "$IN_PKG" = "no" ]; then
      echo "  ❌ $MODULE: require됨 but package.json에 없음"
      REPORT="$REPORT\n❌ 미설치 의존성: $MODULE"
      FAIL=1
    elif [ "$REQUIRED" = "yes" ] && [ "$IN_PKG" = "yes" ]; then
      echo "  ✅ $MODULE: require + package.json 일치"
    fi
  done
fi

# ─── 5. HttpOnly 쿠키 설정 일관성 ───
echo ""
echo "5️⃣  HttpOnly 쿠키 일관성 검사..."
HAS_SET_COOKIE=$(grep -c "res.cookie" "$WS_PROXY_DIR/src/server.js" 2>/dev/null || echo 0)
HAS_COOKIE_PARSER=$(grep -c "cookieParser" "$WS_PROXY_DIR/src/server.js" 2>/dev/null || echo 0)
HAS_COOKIE_READ=$(grep -c "req.cookies" "$WS_PROXY_DIR/src/server.js" 2>/dev/null || echo 0)

if [ "$HAS_SET_COOKIE" -gt 0 ] && [ "$HAS_COOKIE_PARSER" -eq 0 ]; then
  echo "  ❌ res.cookie() 사용하지만 cookie-parser 미등록"
  REPORT="$REPORT\n❌ cookie-parser 미등록"
  FAIL=1
elif [ "$HAS_SET_COOKIE" -gt 0 ] && [ "$HAS_COOKIE_READ" -eq 0 ]; then
  echo "  ⚠️ 쿠키를 설정하지만 읽는 코드(req.cookies) 없음"
  REPORT="$REPORT\n⚠️ 쿠키 읽기 코드 미구현"
else
  echo "  ✅ 쿠키 설정/파싱/읽기 일관성 정상"
fi

# ─── 6. 함수 변경 영향 범위 검사 ───
echo ""
echo "6️⃣  파괴적 변경 영향 범위 검사..."
# AuthService.getToken()이 localStorage를 사용하는지 + 호출자 수
if [ -f "$MIKI_DIR/src/services/auth.js" ]; then
  HAS_LOCALSTORAGE=$(grep -c "localStorage.getItem\|localStorage.setItem" "$MIKI_DIR/src/services/auth.js" 2>/dev/null || echo 0)
  CALLERS=$(grep -rn "AuthService.getToken\|getToken()" "$MIKI_DIR/src/" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v __tests__ | grep -v "auth.js" | wc -l | tr -d ' ')
  
  if [ "${HAS_LOCALSTORAGE}" -gt 0 ]; then
    echo "  ⚠️ auth.js가 여전히 localStorage 사용 (${HAS_LOCALSTORAGE}곳) — 호출자 ${CALLERS}곳 영향"
    echo "     → UP-1 (🟡 P4 대기) 해소 시 리팩토링 필요"
  else
    echo "  ✅ auth.js: localStorage 미사용"
  fi
fi

# ─── 결과 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAIL -eq 0 ]; then
  echo "✅ Security State Check PASSED"
else
  echo "❌ Security State Check FAILED"
  echo -e "$REPORT"
fi
