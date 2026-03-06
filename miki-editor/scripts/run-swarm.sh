#!/bin/bash
# Meki Swarm Agent Runner v5 — Pre-flight + Init Watchdog + Worktree Isolation + unset CLAUDECODE
# 사용법: ./scripts/run-swarm.sh <모델> "<프롬프트>" <작업디렉토리> <role명> <로그이름>
#
# role명: frontend_dev | api_dev | test_verify | none
# SOP 파일 위치: /Users/halim/Desktop/meeki/meki/.agents/roles/<role명>.md
#
# [v4 변경사항]
# - Pre-flight: /tmp 서브쉘에서 claude CLI 정상 여부 확인 (CWD 문제와 분리)
# - worktree 생성 실패 시 폴백 없이 abort (격리 보장 필수)
# - INIT_HANG 후 T0 제거, T3(빈 디렉토리) 자동 실행으로 대체
# - REGRESSION_SUSPECT 최소 임계값 추가: DEL > 10 && DEL > ADD*2

MODEL=$1
PROMPT=$2
DIR=$3
ROLE=$4
LOG_NAME=$5

PROJECT_ROOT="/Users/halim/Desktop/meeki/meki"
AGENTS_ROOT="$PROJECT_ROOT/.agents"

if [ -z "$MODEL" ] || [ -z "$PROMPT" ] || [ -z "$DIR" ] || [ -z "$LOG_NAME" ]; then
  echo "Usage: $0 <model> <prompt> <directory> <role> <log_name>"
  echo "  role: frontend_dev | api_dev | test_verify | none"
  exit 1
fi

cd "$DIR" || exit 1

# logs 폴더가 없으면 생성
mkdir -p logs

TIMESTAMP=$(date +%s)
LOG_FILE="logs/swarm_${LOG_NAME}_${TIMESTAMP}.log"
BRANCH_NAME="agent/${LOG_NAME}-${TIMESTAMP}"
WORKTREE_DIR="$PROJECT_ROOT/.worktrees/${LOG_NAME}-${TIMESTAMP}"

echo "========================================" > "$LOG_FILE"
echo "Starting swarm agent with model: $MODEL" >> "$LOG_FILE"
echo "Role (SOP): $ROLE" >> "$LOG_FILE"
echo "Prompt: $PROMPT" >> "$LOG_FILE"
echo "Directory: $DIR" >> "$LOG_FILE"
echo "Time: $(date)" >> "$LOG_FILE"
echo "Worktree: $WORKTREE_DIR" >> "$LOG_FILE"
echo "Branch: $BRANCH_NAME" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

echo "Using Anthropic direct API (Claude Code) with model: $MODEL" >> "$LOG_FILE"

# ─── Git Worktree 생성 (에이전트 격리) ───
cd "$PROJECT_ROOT" || exit 1
git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" 2>> "$DIR/$LOG_FILE"
WORKTREE_STATUS=$?

if [ $WORKTREE_STATUS -ne 0 ]; then
  echo "[worktree] ❌ worktree 생성 실패 — 격리 없는 실행은 허용하지 않음, abort" >> "$DIR/$LOG_FILE"
  echo "❌ [worktree] 생성 실패 — abort (격리 필수). git worktree prune 후 재시도하세요."
  git branch -D "$BRANCH_NAME" 2>/dev/null
  exit 1
else
  echo "[worktree] Created isolated workspace: $WORKTREE_DIR" >> "$DIR/$LOG_FILE"
  # 에이전트를 worktree 루트에서 실행 (CLAUDE.md 자동 로드를 위해)
  cd "$WORKTREE_DIR" || cd "$DIR"
fi

# ─── SOP Role 로드 ───
ROLE_FILE="${AGENTS_ROOT}/roles/${ROLE}.md"
FULL_PROMPT="$PROMPT"

if [ -n "$ROLE" ] && [ "$ROLE" != "none" ] && [ -f "$ROLE_FILE" ]; then
  SOP_CONTENT=$(cat "$ROLE_FILE")
  echo "Loading SOP from: $ROLE_FILE" >> "$DIR/$LOG_FILE"
  echo "SOP loaded successfully ($(wc -c < "$ROLE_FILE") bytes)" >> "$DIR/$LOG_FILE"
  FULL_PROMPT="[시스템 지침 - 반드시 준수]
${SOP_CONTENT}

[태스크]
${PROMPT}

[시스템 필수 명령어]
작업을 완료하면 사용자에게 질문하지 마라. 즉시 결과를 요약하고 세션을 종료하라."
else
  if [ "$ROLE" != "none" ] && [ ! -f "$ROLE_FILE" ]; then
    echo "WARNING: Role file not found: $ROLE_FILE. Running without SOP." >> "$DIR/$LOG_FILE"
  fi
fi

# ─── Pre-flight: claude CLI 정상 여부 확인 (중립 환경 /tmp에서 실행) ───
# P1 fix: CWD가 원인인 hang이면 pre-flight도 같이 실패하므로, /tmp 서브쉘로 격리
echo "[pre-flight] claude 기본 실행 테스트 (/tmp에서)..." >> "$DIR/$LOG_FILE"
PF_RESULT=$(cd /tmp && unset CLAUDECODE && echo "respond with OK" | timeout 15 claude --model "${MODEL}" --dangerously-skip-permissions \
  --output-format text 2>&1 || true)
if echo "${PF_RESULT}" | grep -qi "OK"; then
  echo "[pre-flight] ✅ claude 정상" >> "$DIR/$LOG_FILE"
else
  echo "[pre-flight] ❌ claude CLI 자체 실행 실패, abort" >> "$DIR/$LOG_FILE"
  echo "[pre-flight] 출력: ${PF_RESULT}" >> "$DIR/$LOG_FILE"
  echo "❌ [pre-flight] claude CLI 실행 실패 — API 키/설치 확인 필요"
  echo "[PRE_FLIGHT_FAIL] ${LOG_NAME}" >> "$DIR/logs/regression_alerts.log"
  # worktree 정리
  if [ -n "${WORKTREE_DIR}" ] && [ -d "${WORKTREE_DIR}" ]; then
    cd "${PROJECT_ROOT}" || exit 1
    git worktree remove "${WORKTREE_DIR}" --force 2>/dev/null
    git branch -D "${BRANCH_NAME}" 2>/dev/null
  fi
  exit 2
fi

# ─── Claude CLI 실행 ───
RAW_FILE="$DIR/$LOG_FILE.raw"
touch "$RAW_FILE"

# CLAUDECODE 환경변수가 설정된 경우(Claude Code 세션 내 실행) 중첩 세션 차단 우회
unset CLAUDECODE

# claude -p는 non-TTY 환경(Antigravity, CI 등)에서 hang하는 알려진 버그 있음.
# pipe(stdin)로 프롬프트를 전달하면 정상 동작.
# ref: GitHub Issues — claude -p hang in non-interactive/non-TTY context
echo "$FULL_PROMPT" | claude --model "$MODEL" --dangerously-skip-permissions \
  --output-format text > "$RAW_FILE" 2>&1 &
CLAUDE_PID=$!

echo "Started swarm agent with $MODEL (PID: $CLAUDE_PID)"
echo "Role SOP: $ROLE"
echo "Worktree: ${WORKTREE_DIR:-none (direct)}"
echo "Logs: $DIR/$LOG_FILE"
echo "Raw output: $RAW_FILE"

# ─── 2단계 타임아웃: 초기화 워치독 + 전체 타임아웃 ───
#
# Phase 1 (INIT_TIMEOUT): 첫 출력까지 45초 대기
#   - 정상 초기화는 5~20초. 45초는 2배+ 여유
#   - 첫 출력 없으면 hang 판정 → 즉시 종료 (300초 낭비 방지)
#
# Phase 2 (MAX_WAIT): 첫 출력 확인 후 전체 300초 타임아웃
#   - 출력 중 idle(긴 추론 pause)은 감지하지 않음 → 오탐 방지
#
INIT_TIMEOUT=45
MAX_WAIT=300

echo "Waiting for agent (init: ${INIT_TIMEOUT}s, max: ${MAX_WAIT}s)..." >> "$DIR/$LOG_FILE"

TIMEOUT_FLAG="$DIR/logs/.timeout_${LOG_NAME}_${TIMESTAMP}"
INIT_FLAG="$DIR/logs/.init_hang_${LOG_NAME}_${TIMESTAMP}"

# Phase 1: 초기화 워치독 — 45초 내에 첫 출력이 없으면 hang 판정
(sleep "${INIT_TIMEOUT}"
 if kill -0 $CLAUDE_PID 2>/dev/null; then
   RAWSIZE=$(wc -c < "$RAW_FILE" 2>/dev/null | tr -d ' ')
   if [ "${RAWSIZE:-0}" -eq 0 ]; then
     echo "[init-hang] ${INIT_TIMEOUT}초 경과, 출력 0바이트 — 초기화 hang 판정" >> "$DIR/$LOG_FILE"
     touch "$INIT_FLAG"
     kill $CLAUDE_PID 2>/dev/null
   fi
 fi) &
INIT_WATCHDOG_PID=$!

# Phase 2: 전체 타임아웃 워치독 — MAX_WAIT 초 후 강제 종료
(sleep $MAX_WAIT && kill -0 $CLAUDE_PID 2>/dev/null && \
  echo "[timeout] ${MAX_WAIT}초 초과 — 에이전트 강제 종료" >> "$DIR/$LOG_FILE" && \
  touch "$TIMEOUT_FLAG" && \
  kill $CLAUDE_PID 2>/dev/null) &
WATCHDOG_PID=$!

# 에이전트 자연 종료 대기
wait $CLAUDE_PID 2>/dev/null
AGENT_EXIT=$?

# 워치독 정리
kill $INIT_WATCHDOG_PID 2>/dev/null
kill $WATCHDOG_PID 2>/dev/null
wait $INIT_WATCHDOG_PID 2>/dev/null
wait $WATCHDOG_PID 2>/dev/null

# 종료 원인 판별
TIMED_OUT=0
INIT_HANG=0
if [ -f "$INIT_FLAG" ]; then
  INIT_HANG=1
  rm -f "$INIT_FLAG"
elif [ -f "$TIMEOUT_FLAG" ]; then
  TIMED_OUT=1
  rm -f "$TIMEOUT_FLAG"
fi

echo "[agent] 종료 (exit=${AGENT_EXIT}, timed_out=${TIMED_OUT}, init_hang=${INIT_HANG})" >> "$DIR/$LOG_FILE"

# ─── INIT_HANG 자동 bisect: T3 (c7-hang-diagnosis.md 준거) ───
# P2 fix: pre-flight(=/tmp T0)가 이미 통과 → T0 중복 제거. T3(빈 디렉토리)를 자동 실행
if [ "${INIT_HANG}" -eq 1 ]; then
  echo "[diag] INIT_HANG 감지 — pre-flight 통과 상태이므로 T3(환경 격리) 실행" >> "$DIR/$LOG_FILE"
  T3_DIR="/tmp/swarm-diag-$(date +%s)"
  mkdir -p "${T3_DIR}"
  T3_RESULT=$(cd "${T3_DIR}" && unset CLAUDECODE && echo "${FULL_PROMPT}" | timeout 60 claude --model "${MODEL}" --dangerously-skip-permissions \
    --output-format text 2>&1 || true)
  T3_SIZE=$(echo -n "${T3_RESULT}" | wc -c | tr -d ' ')
  rm -rf "${T3_DIR}"
  if [ "${T3_SIZE}" -gt 0 ]; then
    echo "[diag] T3 정상 (${T3_SIZE}B) → CWD(worktree) 환경이 원인" >> "$DIR/$LOG_FILE"
    echo "[diag] worktree의 CLAUDE.md/.git 크기/구조를 확인하세요" >> "$DIR/$LOG_FILE"
    echo "⚠️  [diag] T3 정상 → CWD(worktree) 환경이 원인. worktree 구조 확인 필요"
  else
    echo "[diag] T3 실패 (0B) → 프롬프트 자체 또는 CLI 문제" >> "$DIR/$LOG_FILE"
    echo "[diag] c7-hang-diagnosis.md 참조: T1(프롬프트 이분 탐색)" >> "$DIR/$LOG_FILE"
    echo "⚠️  [diag] T3 실패 → 프롬프트 자체 문제. c7-hang-diagnosis.md T1 참조"
  fi
  echo "[diag] 자동 재시도 없음 — 수동 개입 필요" >> "$DIR/$LOG_FILE"
  echo "ℹ️  [diag] 자동 재시도 없음 — 수동 개입 필요 (로그: $DIR/$LOG_FILE)"
fi

# .raw 내용을 메인 로그에 합치기
if [ -f "$RAW_FILE" ] && [ -s "$RAW_FILE" ]; then
  echo "" >> "$DIR/$LOG_FILE"
  echo "[agent-output]" >> "$DIR/$LOG_FILE"
  cat "$RAW_FILE" >> "$DIR/$LOG_FILE"
fi

# ─── Git Worktree Merge 검증 + 병합 ───
if [ -n "$WORKTREE_DIR" ] && [ -d "$WORKTREE_DIR" ]; then
  cd "$WORKTREE_DIR" || exit 1

  # 초기화 hang 또는 타임아웃 종료 시 불완전한 작업을 main에 merge하지 않음
  if [ "$INIT_HANG" -eq 1 ] || [ "$TIMED_OUT" -eq 1 ]; then
    if [ "$INIT_HANG" -eq 1 ]; then
      echo "[merge] ⛔ 초기화 hang — merge 차단 (${INIT_TIMEOUT}초 내 출력 없음)" >> "$DIR/$LOG_FILE"
    else
      echo "[merge] ⛔ 타임아웃 종료 — 불완전한 작업 merge 차단" >> "$DIR/$LOG_FILE"
    fi
    echo "   수동 확인: git diff main..$BRANCH_NAME" >> "$DIR/$LOG_FILE"
    echo "[BLOCKED] $LOG_NAME (init_hang=$INIT_HANG, timeout=$TIMED_OUT)" >> "$DIR/logs/regression_alerts.log"
    cd "$PROJECT_ROOT" || exit 1
    git worktree remove "$WORKTREE_DIR" --force 2>/dev/null
    git branch -D "$BRANCH_NAME" 2>/dev/null
    echo "[worktree] 정리 완료: $WORKTREE_DIR" >> "$DIR/$LOG_FILE"
    echo "[swarm] Agent finished at $(date)" >> "$DIR/$LOG_FILE"
    exit 1
  fi

  # 변경 사항이 있는지 확인 (untracked 파일 또는 새 커밋)
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
  NEW_COMMITS=$(git rev-list --count main..HEAD 2>/dev/null || echo 0)

  if [ "$UNCOMMITTED" -gt 0 ] || [ "$NEW_COMMITS" -gt 0 ]; then
    # 변경 사항 커밋 (uncommitted가 있다면)
    if [ "$UNCOMMITTED" -gt 0 ]; then
      git add -A 2>> "$DIR/$LOG_FILE"
      git commit -m "agent/$LOG_NAME: 자동 커밋 by swarm runner" 2>> "$DIR/$LOG_FILE"
    fi

    # 삭제량 검증: 삭제가 추가보다 2배 이상 많으면 경고 (merge는 하되 로그에 기록)
    cd "$PROJECT_ROOT" || exit 1
    ADD=$(git diff --numstat main.."$BRANCH_NAME" 2>/dev/null | awk '{s+=$1}END{print s+0}')
    DEL=$(git diff --numstat main.."$BRANCH_NAME" 2>/dev/null | awk '{s+=$2}END{print s+0}')

    echo "[merge-check] additions=$ADD, deletions=$DEL" >> "$DIR/$LOG_FILE"

    if [ "$DEL" -gt 10 ] && [ "$DEL" -gt $((ADD * 2)) ]; then
      echo "⚠️  [merge-check] 삭제($DEL)가 추가($ADD)의 2배 초과 — 회귀 의심! merge 보류" >> "$DIR/$LOG_FILE"
      echo "   수동 확인: git diff main..$BRANCH_NAME" >> "$DIR/$LOG_FILE"
      echo "[REGRESSION_SUSPECT] $LOG_NAME" >> "$DIR/logs/regression_alerts.log"
    else
      # 안전한 변경 — 자동 merge
      git checkout main 2>> "$DIR/$LOG_FILE"
      git merge "$BRANCH_NAME" --no-edit 2>> "$DIR/$LOG_FILE"
      MERGE_STATUS=$?
      if [ $MERGE_STATUS -eq 0 ]; then
        echo "[merge] ✅ $BRANCH_NAME → main 병합 성공" >> "$DIR/$LOG_FILE"
      else
        echo "[merge] ❌ 충돌 발생 — 수동 확인 필요: git merge $BRANCH_NAME" >> "$DIR/$LOG_FILE"
        git merge --abort 2>/dev/null
      fi
    fi
  else
    echo "[worktree] 변경 사항 없음 — 이미 완료된 태스크" >> "$DIR/$LOG_FILE"
  fi

  # Worktree 정리
  cd "$PROJECT_ROOT" || exit 1
  git worktree remove "$WORKTREE_DIR" --force 2>/dev/null
  git branch -D "$BRANCH_NAME" 2>/dev/null
  echo "[worktree] 정리 완료: $WORKTREE_DIR" >> "$DIR/$LOG_FILE"
fi

echo "[swarm] Agent finished at $(date)" >> "$DIR/$LOG_FILE"
