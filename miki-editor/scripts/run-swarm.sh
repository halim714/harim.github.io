#!/bin/bash
# Meki Swarm Agent Runner v2 — SOP Role + Idle Detection + Git Worktree Isolation
# 사용법: ./scripts/run-swarm.sh <모델> "<프롬프트>" <작업디렉토리> <role명> <로그이름>
#
# role명: frontend_dev | api_dev | test_verify | none
# SOP 파일 위치: /Users/halim/Desktop/meeki/meki/.agents/roles/<role명>.md
#
# [v2 변경사항]
# - Git Worktree 격리: 각 에이전트가 독립 브랜치에서 작업 → 원본 보호
# - 삭제량 검증: merge 전 삭제가 추가보다 많으면 자동 롤백
# - 기존 기능 보존: SOP 로드, 유휴 감지, 프롬프트 주입 모두 유지

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
  echo "[worktree] Failed to create worktree — falling back to direct execution" >> "$DIR/$LOG_FILE"
  WORKTREE_DIR=""
  cd "$DIR" || exit 1
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

# ─── Claude CLI 실행 (백그라운드 + 유휴 감지) ───
# script -q로 pseudo-terminal 강제 → 출력이 .raw에 즉시 기록됨
# idle detection은 .raw 파일 크기로 모니터링
WORK_DIR="${WORKTREE_DIR:-$PROJECT_ROOT}"
RAW_FILE="$DIR/$LOG_FILE.raw"
touch "$RAW_FILE"

script -q "$RAW_FILE" \
  claude -p --model "$MODEL" --dangerously-skip-permissions \
  --add-dir "$WORK_DIR" \
  --add-dir "$WORK_DIR/miki-editor" \
  -- "$FULL_PROMPT" &
CLAUDE_PID=$!

echo "Started swarm agent with $MODEL (PID: $CLAUDE_PID)"
echo "Role SOP: $ROLE"
echo "Worktree: ${WORKTREE_DIR:-none (direct)}"
echo "Logs: $DIR/$LOG_FILE"
echo "Raw output: $RAW_FILE"

# ─── 유휴 감지 루프: .raw 파일 크기가 15초간 변하지 않으면 종료 ───
IDLE_LIMIT=15
LAST_SIZE=0
IDLE_COUNT=0

while kill -0 $CLAUDE_PID 2>/dev/null; do
  CURRENT_SIZE=$(wc -c < "$RAW_FILE" 2>/dev/null || echo 0)
  if [ "$CURRENT_SIZE" -eq "$LAST_SIZE" ]; then
    IDLE_COUNT=$((IDLE_COUNT + 1))
  else
    IDLE_COUNT=0
    LAST_SIZE=$CURRENT_SIZE
  fi

  if [ "$IDLE_COUNT" -ge "$IDLE_LIMIT" ]; then
    echo "" >> "$DIR/$LOG_FILE"
    echo "[idle-detection] ${IDLE_LIMIT}초간 출력 없음 — 작업 완료 판단, 에이전트 종료" >> "$DIR/$LOG_FILE"
    kill $CLAUDE_PID 2>/dev/null
    wait $CLAUDE_PID 2>/dev/null
    break
  fi
  sleep 1
done

# .raw 내용을 메인 로그에 합치기 (제어 문자 제거)
if [ -f "$RAW_FILE" ] && [ -s "$RAW_FILE" ]; then
  echo "" >> "$DIR/$LOG_FILE"
  echo "[agent-output]" >> "$DIR/$LOG_FILE"
  strings "$RAW_FILE" >> "$DIR/$LOG_FILE"
fi

# ─── Git Worktree Merge 검증 + 병합 ───
if [ -n "$WORKTREE_DIR" ] && [ -d "$WORKTREE_DIR" ]; then
  cd "$WORKTREE_DIR" || exit 1

  # 변경 사항이 있는지 확인 (untracked 파일 포함)
  CHANGES=$(git status --porcelain 2>/dev/null | wc -l)

  if [ "$CHANGES" -gt 0 ]; then
    # 변경 사항 커밋
    git add -A 2>> "$DIR/$LOG_FILE"
    git commit -m "agent/$LOG_NAME: 자동 커밋 by swarm runner" 2>> "$DIR/$LOG_FILE"

    # 삭제량 검증: 삭제가 추가보다 2배 이상 많으면 경고 (merge는 하되 로그에 기록)
    cd "$PROJECT_ROOT" || exit 1
    ADD=$(git diff --numstat main.."$BRANCH_NAME" 2>/dev/null | awk '{s+=$1}END{print s+0}')
    DEL=$(git diff --numstat main.."$BRANCH_NAME" 2>/dev/null | awk '{s+=$2}END{print s+0}')

    echo "[merge-check] additions=$ADD, deletions=$DEL" >> "$DIR/$LOG_FILE"

    if [ "$DEL" -gt 0 ] && [ "$DEL" -gt $((ADD * 2)) ]; then
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
