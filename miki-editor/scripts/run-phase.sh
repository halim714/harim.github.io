#!/bin/bash
# run-phase.sh — Phase 단위로 관련 에이전트들을 자동 배정·병렬 실행
# 사용법: ./scripts/run-phase.sh <phase번호> [모델]
#
# 예시: ./scripts/run-phase.sh 1
#       ./scripts/run-phase.sh 1 "google/gemini-2.5-pro"

PHASE=$1
MODEL=${2:-"sonnet"}
MIKI_DIR="/Users/halim/Desktop/meeki/meki/miki-editor"
PROJECT_DIR="/Users/halim/Desktop/meeki/meki"
SWARM="$MIKI_DIR/scripts/run-swarm.sh"

if [ -z "$PHASE" ]; then
  echo "Usage: $0 <phase> [model]"
  echo "  phase: 1 | 2 | 3 | 4 | 5"
  exit 1
fi

echo "======================================"
echo "🚀 Meki Phase $PHASE — 병렬 스웜 실행"
echo "모델: $MODEL"
echo "시작: $(date)"
echo "======================================"

case $PHASE in
  1)
    echo "Phase 1: Security Foundation"
    echo "태스크 배정 중..."

    # P1-T1 + P1-T2: 병렬 실행 (의존성 없음)
    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P1-T1을 수행하라: vercel.json에 CSP 헤더를 추가하라. Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.github.com; script-src 'self' 'unsafe-inline'" \
      "$MIKI_DIR" api_dev "p1-t1-csp" &

    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P1-T2를 수행하라: DOMPurify를 설치하고 src/utils/sanitize.js를 생성하라. sanitizeHtml(html) 함수를 export 할 것." \
      "$MIKI_DIR" api_dev "p1-t2-sanitize" &

    wait
    echo "▶ P1-T1, P1-T2 완료. health-check 실행..."
    "$MIKI_DIR/scripts/health-check.sh" "p1-t1t2"

    # P1-T3 + P1-T4: 앞 단계 완료 후 실행
    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P1-T3를 수행하라: 마크다운 렌더러에 src/utils/sanitize.js의 sanitizeHtml을 적용하라." \
      "$MIKI_DIR" frontend_dev "p1-t3-renderer" &

    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P1-T4를 수행하라: src/components/IsolatedPreview.jsx를 생성하라. blob: URL과 iframe sandbox를 사용할 것." \
      "$MIKI_DIR" frontend_dev "p1-t4-preview" &

    wait
    echo "▶ P1-T3, P1-T4 완료. health-check 실행..."
    "$MIKI_DIR/scripts/health-check.sh" "p1-t3t4"

    # P1-T5: oauth 수정
    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P1-T5를 수행하라: api/auth/callback.js에 PKCE code_verifier/code_challenge와 state 파라미터를 적용하라." \
      "$MIKI_DIR" api_dev "p1-t5-pkce"

    # P1-T6: 의미 검증 (sonnet 사용 — 검증은 가장 중요한 단계)
    "$SWARM" "sonnet" \
      "PLAN.md와 PROGRESS.md를 읽고 P1-T6를 수행하라: Phase 1 구현 전체 검증. XSS 차단, DOMPurify 적용, PKCE 적용, 빌드 성공 여부 확인." \
      "$MIKI_DIR" test_verify "p1-t6-verify"
    ;;

  2)
    echo "Phase 2: WS Proxy Server"
    echo "태스크 배정 중..."

    # P2-T1: miki-ws-proxy 프로젝트 구조 생성 (meki 레포 안에 ws-proxy/ 디렉토리)
    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P2-T1을 수행하라: 프로젝트 루트에 ws-proxy/ 디렉토리를 생성하고, Node.js 프로젝트를 초기화하라 (package.json, src/index.js). Express + ws 라이브러리를 사용할 것. README.md에 목적과 사용법을 기술하라." \
      "$MIKI_DIR" api_dev "p2-t1-init"

    echo "▶ P2-T1 완료. health-check 실행..."
    "$MIKI_DIR/scripts/health-check.sh" "p2-t1"

    # P2-T2 + P2-T3: HTTP 서버 + WS 핸들러 (병렬 — 서로 다른 파일)
    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P2-T2를 수행하라: ws-proxy/src/server.js에 Express HTTP 서버를 구현하라. JWT 세션(/api/session 엔드포인트)과 헬스체크(/health)를 포함할 것." \
      "$MIKI_DIR" api_dev "p2-t2-http" &

    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P2-T3를 수행하라: ws-proxy/src/ws-handler.js에 WebSocket 핸들러를 구현하라. 클라이언트 메시지를 GitHub API로 릴레이하고 응답을 반환할 것." \
      "$MIKI_DIR" api_dev "p2-t3-ws" &

    wait
    echo "▶ P2-T2, P2-T3 완료. health-check 실행..."
    "$MIKI_DIR/scripts/health-check.sh" "p2-t2t3"

    # P2-T4: Dockerfile + fly.toml
    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P2-T4를 수행하라: ws-proxy/Dockerfile과 ws-proxy/fly.toml을 작성하라. Node.js 20 Alpine 기반, 포트 8080, Fly.io 배포 설정." \
      "$MIKI_DIR" api_dev "p2-t4-docker"

    # P2-T5: Phase 2 전체 검증 (sonnet — 의미 검증)
    "$SWARM" "sonnet" \
      "PLAN.md와 PROGRESS.md를 읽고 P2-T5를 수행하라: Phase 2 전체 검증. ws-proxy/ 디렉토리 구조, HTTP 엔드포인트, WebSocket 핸들러, Docker 설정의 정합성을 확인하라." \
      "$MIKI_DIR" test_verify "p2-t5-verify"
    ;;

  3)
    echo "태스크 배정 중..."

    # P3-T1 ~ P3-T4 병렬 실행 (서로 다른 파일 영향)
    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P3-T1을 수행하라: ws-client.js 작성 및 VITE_USE_WS_PROXY 환경변수 연동." \
      "$MIKI_DIR" api_dev "p3-t1-client" &
    PID1=$!

    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P3-T2를 수행하라: src/services/github.js를 Feature Flag(VITE_USE_WS_PROXY) 기반으로 WS/HTTP 분기 라우팅하도록 리팩토링하라." \
      "$MIKI_DIR" api_dev "p3-t2-github" &
    PID2=$!

    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P3-T3를 수행하라: src/services/auth.js를 WS 접속 상태 기반으로 동작이 분리되도록 리팩토링하라." \
      "$MIKI_DIR" api_dev "p3-t3-auth" &
    PID3=$!

    "$SWARM" "$MODEL" \
      "PLAN.md와 PROGRESS.md를 읽고 P3-T4를 수행하라: 기존 인증 기반에서 WS Proxy 기반으로 전환 시 안내할 MigrationNotice.jsx 배너 컴포넌트를 만들고 메인 화면에 적용하라." \
      "$MIKI_DIR" frontend_dev "p3-t4-notice" &
    PID4=$!

    wait $PID1 $PID2 $PID3 $PID4
    echo "▶ P3-T1~T4 완료. health-check 실행..."
    "$MIKI_DIR/scripts/health-check.sh" "p3-t1t4"

    # P3-T5: Phase 3 전체 런타임 검증
    # ⚠️ npm run dev 금지 (CLAUDE.md 규칙 2: 종료되지 않는 프로세스 실행 금지)
    # → 소스 파일 정적 검증으로 대체
    "$SWARM" "sonnet" \
      "PLAN.md와 PROGRESS.md를 읽고 P3-T5를 수행하라: Flag OFF/ON 시나리오를 정적으로 검증하라. (1) VITE_USE_WS_PROXY 환경변수 분기 코드가 ws-client.js와 github.js에 올바르게 구현되어 있는지 소스 파일을 읽고 확인하라. (2) npm run build로 빌드 성공 여부를 확인하라. (3) WS 연결 관련 오프라인/온라인 로직이 auth.js에 분기되어 있는지 확인하라. npm run dev는 실행하지 마라." \
      "$MIKI_DIR" test_verify "p3-t5-verify"
    ;;

  4|5)
    echo "Phase $PHASE: 아직 구현 전입니다. PLAN.md를 참고하여 수동 배정하세요."
    ;;

  *)
    echo "알 수 없는 Phase: $PHASE"
    exit 1
    ;;
esac

echo ""
echo "======================================"
echo "Phase $PHASE 스웜 실행 완료: $(date)"
echo "PROGRESS.md를 업데이트하세요."
echo "======================================"
