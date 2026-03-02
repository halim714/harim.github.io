#!/bin/bash
# security-state-check.sh — 보안 상태 정밀 검증
# "구현했다고 말한 것이 실제로 올바르게 작동하는지" 자동 검증
#
# 사용법: ./scripts/security-state-check.sh [PROJECT_DIR]
# 종료코드: 0 = PASS, 1 = FAIL (❌ 또는 ⚠️ 존재)
#
# 원칙: ⚠️ 경고도 FAIL — CI에서 무시되면 안 되는 항목만 출력
# 원칙: 개별 파일이 아닌 E2E 토큰 흐름으로 검증

set -uo pipefail

PROJECT_DIR="${1:-/Users/halim/Desktop/meeki/meki}"
MIKI_DIR="${PROJECT_DIR}/miki-editor"
WS_PROXY_DIR="${PROJECT_DIR}/ws-proxy"
CALLBACK_FILE="${MIKI_DIR}/api/auth/callback.js"
SERVER_FILE="${WS_PROXY_DIR}/src/server.js"
AUTH_FILE="${MIKI_DIR}/src/services/auth.js"

FAIL=0
WARN=0
REPORT=""

mark_fail() { FAIL=1; REPORT="${REPORT}\n❌ $1"; }
mark_warn() { WARN=1; REPORT="${REPORT}\n⚠️ $1"; }

echo "🔐 Security State Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. CORS 제어 흐름 검증 ───
# 검증 방법: callback.js 전체를 위→아래로 읽으며
# "origin 거부 return"이 "fetch/GitHub API 호출"보다 먼저 나오는지 확인
# try {} 유무에 의존하지 않음
echo ""
echo "1️⃣  CORS 제어 흐름 검증..."
if [ -f "${CALLBACK_FILE}" ]; then
  REJECT_LINE=$(grep -n "return.*4[0-9][0-9].*CORS\|return.*4[0-9][0-9].*[Oo]rigin\|return.*403" "${CALLBACK_FILE}" 2>/dev/null | head -1 | cut -d: -f1 || echo "")
  FETCH_LINE=$(grep -n "fetch(" "${CALLBACK_FILE}" 2>/dev/null | head -1 | cut -d: -f1 || echo "")

  if [ -z "${REJECT_LINE}" ]; then
    echo "  ❌ CORS 거부 로직(return 4xx) 없음 — 모든 origin에서 토큰 교환 가능"
    mark_fail "CORS 거부 로직 부재"
  elif [ -z "${FETCH_LINE}" ]; then
    echo "  ✅ CORS 거부(L${REJECT_LINE}) 존재, 외부 API 호출 없음"
  elif [ "${REJECT_LINE}" -lt "${FETCH_LINE}" ]; then
    echo "  ✅ CORS 거부(L${REJECT_LINE})가 API 호출(L${FETCH_LINE}) 전에 위치"
  else
    echo "  ❌ CORS 거부(L${REJECT_LINE})가 API 호출(L${FETCH_LINE}) 뒤 — 순서 버그"
    mark_fail "CORS 순서 버그"
  fi
else
  echo "  ⚠️ ${CALLBACK_FILE} 없음"
  mark_warn "callback.js 미존재"
fi

# ─── 2. CORS 안티패턴 ───
echo ""
echo "2️⃣  CORS 안티패턴 검사..."

WILD_CORS=$(grep -rn 'Access-Control-Allow-Origin.*\*' "${MIKI_DIR}/api/" "${WS_PROXY_DIR}/src/" --include="*.js" 2>/dev/null | grep -v node_modules || true)
if [ -n "${WILD_CORS}" ]; then
  echo "  ❌ 와일드카드 CORS:"
  echo "${WILD_CORS}" | sed 's/^/    /'
  mark_fail "와일드카드 CORS"
else
  echo "  ✅ 와일드카드 CORS 없음"
fi

REFERER_FB=$(grep -rn 'origin.*referer\|referer.*origin' "${MIKI_DIR}/api/" "${WS_PROXY_DIR}/src/" --include="*.js" 2>/dev/null | grep -v node_modules || true)
if [ -n "${REFERER_FB}" ]; then
  echo "  ❌ Referer→Origin 폴백:"
  echo "${REFERER_FB}" | sed 's/^/    /'
  mark_fail "Referer→Origin 폴백"
else
  echo "  ✅ Referer→Origin 폴백 없음"
fi

# ─── 3. JWT payload 민감 정보 ───
# jwt.sign()의 첫 번째 인자(payload 변수명)를 추적하여 해당 객체 내용을 검사
echo ""
echo "3️⃣  JWT payload 민감 정보 검사..."
if [ -f "${SERVER_FILE}" ]; then
  # jwt.sign(X, ...) 에서 X(payload 변수명) 추출
  PAYLOAD_VAR=$(grep "jwt\.sign(" "${SERVER_FILE}" 2>/dev/null | head -1 | sed 's/.*jwt\.sign(\s*//' | sed 's/[,)].*//' | tr -d ' ' || echo "")

  if [ -n "${PAYLOAD_VAR}" ]; then
    # 해당 변수의 정의 블록을 추출하고 주석 제거
    PAYLOAD_DEF=$(sed -n "/^[[:space:]]*const ${PAYLOAD_VAR}/,/};/p" "${SERVER_FILE}" 2>/dev/null | sed 's|//.*||; s|/\*.*\*/||' || true)

    if [ -z "${PAYLOAD_DEF}" ]; then
      echo "  ⚠️ payload 변수 '${PAYLOAD_VAR}' 정의를 찾지 못함 — 수동 확인 필요"
      mark_warn "JWT payload 정의 추적 실패"
    elif echo "${PAYLOAD_DEF}" | grep -qiE "ghToken|access_token|client_secret|password"; then
      echo "  ❌ ${PAYLOAD_VAR} 객체에 민감 변수 포함:"
      echo "${PAYLOAD_DEF}" | grep -iE "ghToken|access_token|client_secret|password" | sed 's/^/    /'
      mark_fail "JWT payload 민감 정보"
    else
      echo "  ✅ ${PAYLOAD_VAR} 객체에 민감 정보 없음 (sid, sub, login만 포함)"
    fi
  else
    echo "  ⚠️ jwt.sign() 호출을 찾지 못함"
    mark_warn "jwt.sign() 미발견"
  fi
else
  echo "  ⚠️ ${SERVER_FILE} 없음"
  mark_warn "server.js 미존재"
fi

# ─── 4. 의존성 일관성 ───
echo ""
echo "4️⃣  의존성 일관성 검사..."
if [ -d "${WS_PROXY_DIR}" ]; then
  for MODULE in cookie-parser express jsonwebtoken ws; do
    REQUIRED=$(grep -rq "require.*${MODULE}" "${WS_PROXY_DIR}/src/" --include="*.js" 2>/dev/null && echo "yes" || echo "no")
    IN_PKG=$(grep -q "\"${MODULE}\"" "${WS_PROXY_DIR}/package.json" 2>/dev/null && echo "yes" || echo "no")
    if [ "${REQUIRED}" = "yes" ] && [ "${IN_PKG}" = "no" ]; then
      echo "  ❌ ${MODULE}: require됨 but package.json에 없음"
      mark_fail "미설치: ${MODULE}"
    elif [ "${REQUIRED}" = "yes" ] && [ "${IN_PKG}" = "yes" ]; then
      echo "  ✅ ${MODULE}: 일치"
    fi
  done
fi

# ─── 5. HttpOnly 쿠키 일관성 ───
echo ""
echo "5️⃣  HttpOnly 쿠키 일관성 검사..."
if [ -f "${SERVER_FILE}" ]; then
  HAS_SET_COOKIE=$(grep -c "res\.cookie" "${SERVER_FILE}" 2>/dev/null || echo "0")
  HAS_COOKIE_PARSER=$(grep -c "cookieParser" "${SERVER_FILE}" 2>/dev/null || echo "0")
  HAS_COOKIE_READ=$(grep -c "req\.cookies" "${SERVER_FILE}" 2>/dev/null || echo "0")

  if [ "${HAS_SET_COOKIE}" -gt 0 ] && [ "${HAS_COOKIE_PARSER}" -eq 0 ]; then
    echo "  ❌ res.cookie() 사용하지만 cookie-parser 미등록"
    mark_fail "cookie-parser 미등록"
  elif [ "${HAS_SET_COOKIE}" -gt 0 ] && [ "${HAS_COOKIE_READ}" -eq 0 ]; then
    echo "  ⚠️ 쿠키를 설정하지만 읽는 코드(req.cookies) 없음"
    mark_warn "쿠키 읽기 코드 미구현"
  else
    echo "  ✅ 쿠키 설정/파싱/읽기 일관성 정상"
  fi
fi

# ─── 6. 파괴적 변경 영향 범위 ───
echo ""
echo "6️⃣  파괴적 변경 영향 범위 검사..."
if [ -f "${AUTH_FILE}" ]; then
  HAS_LS=$(grep -E -c "localStorage\.(get|set)Item" "${AUTH_FILE}" 2>/dev/null || echo "0")
  CALLERS=$(grep -rn "AuthService\.getToken" "${MIKI_DIR}/src/" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v __tests__ | grep -v "auth.js" | wc -l | tr -d ' ')
  if [ "${HAS_LS}" -gt 0 ]; then
    echo "  ⚠️ auth.js: localStorage 사용 (${HAS_LS}곳) — 호출자 ${CALLERS}곳 영향"
    mark_warn "localStorage 토큰 저장 (호출자 ${CALLERS}곳)"
  else
    echo "  ✅ auth.js: localStorage 미사용"
  fi
fi

# ─── 7. callback.js 토큰 반환 검사 ───
# callback.js가 raw access_token을 JSON 응답으로 클라이언트에 반환하는지 검증
# 이 토큰을 받은 클라이언트가 localStorage에 저장하면 보안 체인이 무력화됨
echo ""
echo "7️⃣  callback.js 토큰 반환 검사..."
if [ -f "${CALLBACK_FILE}" ]; then
  # res.json({ token: data.access_token }) 패턴 검색
  RAW_TOKEN_RETURN=$(grep -n "res\.json.*token.*access_token\|res\.json.*access_token" "${CALLBACK_FILE}" 2>/dev/null | sed 's|//.*||' || true)
  if [ -n "${RAW_TOKEN_RETURN}" ]; then
    echo "  ⚠️ callback.js가 raw access_token을 JSON 응답으로 반환:"
    echo "${RAW_TOKEN_RETURN}" | sed 's/^/    /'
    echo "     → 클라이언트가 이 토큰을 localStorage에 저장할 수 있음"
    mark_warn "callback.js raw token 반환"
  else
    echo "  ✅ callback.js: raw access_token 직접 반환 없음"
  fi
fi

# ─── 8. E2E 토큰 흐름 검증 ───
# 개별 파일이 아닌 전체 경로로 검증:
# callback.js → auth.js → localStorage 경로가 동시에 살아있으면
# 서버에 HttpOnly 쿠키를 설정해도 토큰은 여전히 평문 저장됨
echo ""
echo "8️⃣  E2E 토큰 흐름 검증..."
E2E_ISSUES=0

# Chain 1: callback.js가 raw token 반환 + auth.js가 localStorage 사용 = 평문 토큰 체인 활성
CB_RETURNS_TOKEN=$(grep -c "res\.json.*token" "${CALLBACK_FILE}" 2>/dev/null || echo "0")
AUTH_USES_LS=$(grep -E -c "localStorage\.(set|get)Item" "${AUTH_FILE}" 2>/dev/null || echo "0")

if [ "${CB_RETURNS_TOKEN}" -gt 0 ] && [ "${AUTH_USES_LS}" -gt 0 ]; then
  echo "  ❌ 평문 토큰 체인 활성:"
  echo "     callback.js → res.json({token}) → 클라이언트 → auth.js → localStorage"
  echo "     서버 HttpOnly 쿠키와 무관하게 토큰이 평문 저장됨"
  mark_fail "E2E: callback→localStorage 평문 체인 활성"
  E2E_ISSUES=$((E2E_ISSUES + 1))
fi

# Chain 2: ws-client.js가 메시지마다 raw token 전송
if [ -f "${MIKI_DIR}/src/services/ws-client.js" ]; then
  if grep -q "token:" "${MIKI_DIR}/src/services/ws-client.js" 2>/dev/null; then
    WS_RAW_TOKEN=$(grep -c "token:" "${MIKI_DIR}/src/services/ws-client.js" 2>/dev/null || echo "0")
    echo "  ⚠️ ws-client.js: 메시지에 token 필드 포함 (${WS_RAW_TOKEN}곳)"
    echo "     → sessionId 기반으로 전환 필요"
    mark_warn "WS 메시지 raw token 전송"
    E2E_ISSUES=$((E2E_ISSUES + 1))
  fi
fi

if [ "${E2E_ISSUES}" -eq 0 ]; then
  echo "  ✅ E2E 토큰 흐름 안전"
fi

# ─── 결과 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "${FAIL}" -gt 0 ]; then
  echo "❌ Security State Check FAILED"
  echo -e "${REPORT}"
  exit 1
elif [ "${WARN}" -gt 0 ]; then
  echo "⚠️ Security State Check WARN (CI 주의)"
  echo -e "${REPORT}"
  exit 1
else
  echo "✅ Security State Check PASSED"
  exit 0
fi
