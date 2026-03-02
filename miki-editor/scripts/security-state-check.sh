#!/bin/bash
# security-state-check.sh — 보안 상태 정밀 검증
# "구현했다고 말한 것이 실제로 올바르게 작동하는지" 자동 검증
#
# 사용법: ./scripts/security-state-check.sh [PROJECT_DIR]
# 종료코드: 0 = PASS, 1 = FAIL (❌ 또는 ⚠️ 존재)
#
# 원칙: ⚠️ 경고도 FAIL로 처리 — CI에서 무시되면 안 되는 항목만 출력

set -uo pipefail
# set -e 제거 — grep 실패(exit 1)가 스크립트를 죽이지 않도록

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
echo ""
echo "1️⃣  CORS 제어 흐름 검증..."
if [ -f "${CALLBACK_FILE}" ]; then
  # 구조적 검증: origin 거부(return + 403)가 fetch 호출보다 앞에 있는지
  # 단순 라인번호가 아닌, "return이 포함된 origin 거부"가 "try {" 블록 전에 오는지 확인
  REJECT_LINE=$(grep -n "return.*403\|return.*CORS_REJECTED" "${CALLBACK_FILE}" 2>/dev/null | head -1 | cut -d: -f1 || echo "")
  TRY_LINE=$(grep -n "try {" "${CALLBACK_FILE}" 2>/dev/null | head -1 | cut -d: -f1 || echo "")

  if [ -z "${REJECT_LINE}" ]; then
    echo "  ❌ CORS 거부 로직(return 403) 없음 — 모든 origin에서 토큰 교환 가능"
    mark_fail "CORS 거부 로직 부재"
  elif [ -z "${TRY_LINE}" ]; then
    echo "  ⚠️ try 블록을 찾지 못함 — 수동 확인 필요"
    mark_warn "CORS 구조 분석 불가"
  elif [ "${REJECT_LINE}" -lt "${TRY_LINE}" ]; then
    echo "  ✅ CORS 거부(L${REJECT_LINE})가 try/fetch 블록(L${TRY_LINE}) 전에 위치"
  else
    echo "  ❌ CORS 거부(L${REJECT_LINE})가 try/fetch(L${TRY_LINE}) 뒤에 위치 — 순서 버그"
    mark_fail "CORS 순서 버그"
  fi
else
  echo "  ⚠️ ${CALLBACK_FILE} 없음"
  mark_warn "callback.js 미존재"
fi

# ─── 2. CORS 안티패턴 검사 ───
echo ""
echo "2️⃣  CORS 안티패턴 검사..."

# 2a. 와일드카드 CORS
WILD_CORS=$(grep -rn 'Access-Control-Allow-Origin.*\*' "${MIKI_DIR}/api/" "${WS_PROXY_DIR}/src/" --include="*.js" 2>/dev/null | grep -v node_modules || true)
if [ -n "${WILD_CORS}" ]; then
  echo "  ❌ 와일드카드 CORS:"
  echo "${WILD_CORS}" | sed 's/^/    /'
  mark_fail "와일드카드 CORS 잔존"
else
  echo "  ✅ 와일드카드 CORS 없음"
fi

# 2b. Referer→Origin 폴백
REFERER_FB=$(grep -rn 'origin.*referer\|referer.*origin' "${MIKI_DIR}/api/" "${WS_PROXY_DIR}/src/" --include="*.js" 2>/dev/null | grep -v node_modules || true)
if [ -n "${REFERER_FB}" ]; then
  echo "  ❌ Referer→Origin 폴백 (보안 의미 상이):"
  echo "${REFERER_FB}" | sed 's/^/    /'
  mark_fail "Referer→Origin 폴백"
else
  echo "  ✅ Referer→Origin 폴백 없음"
fi

# ─── 3. JWT payload 민감 정보 ───
echo ""
echo "3️⃣  JWT payload 민감 정보 검사..."
if [ -f "${SERVER_FILE}" ]; then
  # payload 객체 내부에 ghToken이 직접 포함되는지 (변수 할당 레벨)
  # 안전: sessionStore.set({ghToken}) — payload 밖이므로 OK
  # 위험: const payload = { ghToken } — JWT에 실제 포함
  PAYLOAD_BLOCK=$(sed -n '/const payload/,/};/p' "${SERVER_FILE}" 2>/dev/null | sed 's|//.*||' || true)
  if echo "${PAYLOAD_BLOCK}" | grep -qi "ghToken\|access_token\|client_secret"; then
    echo "  ❌ const payload = { ... } 안에 민감 변수 직접 포함"
    mark_fail "JWT payload 민감 정보"
  else
    echo "  ✅ JWT payload에 민감 정보 없음"
  fi
else
  echo "  ⚠️ ${SERVER_FILE} 없음"
  mark_warn "server.js 미존재"
fi

# ─── 4. 의존성 일관성 (require vs package.json) ───
echo ""
echo "4️⃣  의존성 일관성 검사..."
if [ -d "${WS_PROXY_DIR}" ]; then
  for MODULE in cookie-parser express jsonwebtoken ws; do
    REQUIRED=$(grep -rq "require.*${MODULE}" "${WS_PROXY_DIR}/src/" --include="*.js" 2>/dev/null && echo "yes" || echo "no")
    IN_PKG=$(grep -q "\"${MODULE}\"" "${WS_PROXY_DIR}/package.json" 2>/dev/null && echo "yes" || echo "no")

    if [ "${REQUIRED}" = "yes" ] && [ "${IN_PKG}" = "no" ]; then
      echo "  ❌ ${MODULE}: require됨 but package.json에 없음"
      mark_fail "미설치 의존성: ${MODULE}"
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
    echo "  ⚠️ auth.js: localStorage 여전히 사용 (${HAS_LS}곳) — 호출자 ${CALLERS}곳 영향"
    echo "     → UP-1 (🟡 P4 대기) 해소 시 전체 리팩토링 필요"
    mark_warn "localStorage 토큰 저장 잔존 (호출자 ${CALLERS}곳)"
  else
    echo "  ✅ auth.js: localStorage 미사용"
  fi
else
  echo "  ⚠️ ${AUTH_FILE} 없음"
fi

# ─── 결과 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "${FAIL}" -gt 0 ]; then
  echo "❌ Security State Check FAILED"
  echo -e "${REPORT}"
  exit 1
elif [ "${WARN}" -gt 0 ]; then
  echo "⚠️ Security State Check WARN (CI에서 주의 필요)"
  echo -e "${REPORT}"
  exit 1
else
  echo "✅ Security State Check PASSED"
  exit 0
fi
