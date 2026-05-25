#!/usr/bin/env bash
# validate-grill-cache.sh — PreToolUse hook 래퍼 → Node.js 구현으로 위임
# .claude/settings.json의 command 경로를 유지하기 위한 얇은 래퍼

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# node 탐색: command -v → nvm 경로 → 없으면 bash fallback
NODE_BIN=$(command -v node 2>/dev/null \
  || ls "$HOME/.nvm/versions/node"/*/bin/node 2>/dev/null | sort -V | tail -1 \
  || true)

if [[ -n "$NODE_BIN" && -x "$NODE_BIN" ]]; then
  exec "$NODE_BIN" "$SCRIPT_DIR/validate-grill-cache.mjs"
fi

# ── node 없음 — bash fallback: SPEC 파일이면 차단, 비-SPEC은 통과 ───────────
PAYLOAD=$(cat)
FILE_PATH=$(echo "$PAYLOAD" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
  | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || true)
if [[ -z "$FILE_PATH" ]]; then
  FILE_PATH=$(echo "$PAYLOAD" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
    | sed 's/.*"path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || true)
fi

SPEC_BASENAME=$(basename "$FILE_PATH" 2>/dev/null || true)
if [[ "$SPEC_BASENAME" == SPEC_*.md ]]; then
  echo "❌ [grill-cache] node.js를 찾을 수 없습니다 — SPEC 편집 차단." >&2
  echo "   설치: brew install node  또는  https://nodejs.org" >&2
  exit 2
fi

exit 0
