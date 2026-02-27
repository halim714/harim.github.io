#!/bin/bash
# aggregate-progress.sh — 개별 에이전트 상태 문서(.agents/progress/*.md)를 수집하여 PROGRESS.md에 단방향 갱신
# 사용법: ./scripts/aggregate-progress.sh

PROJECT_DIR="/Users/halim/Desktop/meeki/meki"
PROGRESS_DIR="$PROJECT_DIR/.agents/progress"
PROGRESS_FILE="$PROJECT_DIR/PROGRESS.md"
DATE_STR=$(date "+%Y-%m-%d")

if [ ! -d "$PROGRESS_DIR" ]; then
  exit 0
fi

shopt -s nullglob
FILES=("$PROGRESS_DIR"/*.md)

if [ ${#FILES[@]} -eq 0 ]; then
  exit 0
fi

echo "집계할 에이전트 상태 문서를 찾았습니다: ${#FILES[@]}개"

# 수집된 로그를 PROGRESS.md 끝에 추가
echo "" >> "$PROGRESS_FILE"

for f in "${FILES[@]}"; do
  # 마크다운 포맷 파싱
  TASK_ID=$(awk -F': ' '/\*\*태스크 ID\*\*/ {print $2}' "$f" | tr -d '\r')
  ROLE=$(awk -F': ' '/\*\*담당 Role\*\*/ {print $2}' "$f" | tr -d '\r')
  RESULT=$(awk -F': ' '/\*\*결과\*\*/ {print $2}' "$f" | tr -d '\r')
  SUMMARY=$(awk -F': ' '/\*\*한 줄 요약\*\*/ {print $2}' "$f" | tr -d '\r')
  
  LOG_LINE="[$DATE_STR] $ROLE @ $TASK_ID: $SUMMARY → $RESULT"
  echo "$LOG_LINE" >> "$PROGRESS_FILE"
  
  # 수집 완료 후 격리된 파일 삭제
  rm "$f"
done

echo "✅ 개별 에이전트 상태 로그를 PROGRESS.md에 성공적으로 수집했습니다."
