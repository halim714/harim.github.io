#!/bin/bash
# commit-phase.sh — Phase 완료 후 태스크 단위 자동 커밋
# 사용법: ./scripts/commit-phase.sh <phase번호>
#
# 동작:
# 1. .gitignore 적용된 상태에서 변경 파일 분류
# 2. 인프라 파일 (.agents/, .claude/, scripts/) → 별도 커밋
# 3. 태스크별 코드 변경 → 태스크 단위 커밋
# 4. 잔여 변경 → 정리 커밋

PHASE=$1
PROJECT_DIR="/Users/halim/Desktop/meeki/meki"

if [ -z "$PHASE" ]; then
  echo "Usage: $0 <phase>"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Auto-Commit: Phase $PHASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 0. .gitignore 먼저 커밋 ───
if git status --porcelain .gitignore 2>/dev/null | grep -q "."; then
  git add .gitignore
  git commit -m "chore: update .gitignore for agent infrastructure"
  echo "✅ .gitignore 커밋"
fi

# ─── 0.5. 개별 에이전트 상태 로그 수집 (PROGRESS.md 단방향 갱신) ───
"$PROJECT_DIR/miki-editor/scripts/aggregate-progress.sh"

# ─── 1. 인프라 파일 커밋 (에이전트 설정) ───
INFRA_FILES=""
for DIR in ".agents" ".claude" "CLAUDE.md" "AGENTS.md" "PLAN.md" "PROGRESS.md" "miki-editor/scripts"; do
  if git status --porcelain "$DIR" 2>/dev/null | grep -q "."; then
    INFRA_FILES="$INFRA_FILES $DIR"
  fi
done

if [ -n "$INFRA_FILES" ]; then
  git add $INFRA_FILES
  git commit -m "chore(agents): swarm infrastructure v2 — worktree isolation, SOP roles, skills"
  echo "✅ 인프라 커밋: $INFRA_FILES"
fi

# ─── 2. 태스크별 코드 커밋 ───
# PLAN.md에서 태스크 목록을 추출하여 관련 파일을 자동 매핑
case $PHASE in
  1)
    # P1-T1: CSP
    if git status --porcelain "miki-editor/vercel.json" 2>/dev/null | grep -q "."; then
      git add miki-editor/vercel.json
      git commit -m "feat(p1-t1): add CSP security headers to vercel.json"
      echo "✅ P1-T1: CSP headers"
    fi

    # P1-T2: DOMPurify
    if git status --porcelain "miki-editor/src/utils/sanitize.js" 2>/dev/null | grep -q "."; then
      git add miki-editor/src/utils/sanitize.js miki-editor/package.json miki-editor/package-lock.json 2>/dev/null
      git commit -m "feat(p1-t2): add DOMPurify sanitization utility"
      echo "✅ P1-T2: DOMPurify"
    fi

    # P1-T3: Renderer sanitization
    RENDERER_FILES=""
    for F in "miki-editor/src/MikiEditor.jsx" "miki-editor/src/AiPanel.jsx" "miki-editor/src/sync/conflict.js"; do
      git status --porcelain "$F" 2>/dev/null | grep -q "." && RENDERER_FILES="$RENDERER_FILES $F"
    done
    if [ -n "$RENDERER_FILES" ]; then
      git add $RENDERER_FILES
      git commit -m "feat(p1-t3): apply XSS sanitization to markdown renderer"
      echo "✅ P1-T3: Renderer sanitization"
    fi

    # P1-T4: IsolatedPreview
    PREVIEW_FILES=""
    for F in "miki-editor/src/components/IsolatedPreview.jsx" "miki-editor/src/components/IsolatedPreview.example.jsx" "miki-editor/src/components/IsolatedPreview.README.md" "miki-editor/src/components/__tests__"; do
      git status --porcelain "$F" 2>/dev/null | grep -q "." && PREVIEW_FILES="$PREVIEW_FILES $F"
    done
    if [ -n "$PREVIEW_FILES" ]; then
      git add $PREVIEW_FILES
      git commit -m "feat(p1-t4): add IsolatedPreview component with iframe sandbox"
      echo "✅ P1-T4: IsolatedPreview"
    fi

    # P1-T5: PKCE
    PKCE_FILES=""
    for F in "miki-editor/api/auth/callback.js" "miki-editor/src/pages/LoginPage.jsx" "miki-editor/src/pages/CallbackPage.jsx"; do
      git status --porcelain "$F" 2>/dev/null | grep -q "." && PKCE_FILES="$PKCE_FILES $F"
    done
    if [ -n "$PKCE_FILES" ]; then
      git add $PKCE_FILES
      git commit -m "feat(p1-t5): implement PKCE + state parameter for OAuth security"
      echo "✅ P1-T5: PKCE"
    fi
    ;;

  2)
    # P2-T1~T4: ws-proxy 전체
    if git status --porcelain "ws-proxy/" 2>/dev/null | grep -q "."; then
      git add ws-proxy/
      git commit -m "feat(p2): add WebSocket proxy server (Express + ws + Dockerfile)"
      echo "✅ P2: WebSocket proxy"
    fi
    ;;

  *)
    echo "Phase $PHASE 커밋 매핑 미구현"
    ;;
esac

# ─── 3. 잔여 변경 정리 커밋 ───
REMAINING=$(git status --porcelain 2>/dev/null | grep -v "^??" | wc -l | tr -d ' ')
UNTRACKED=$(git status --porcelain 2>/dev/null | grep "^??" | wc -l | tr -d ' ')

if [ "$REMAINING" -gt 0 ] || [ "$UNTRACKED" -gt 0 ]; then
  echo ""
  echo "📋 잔여 변경: tracked=$REMAINING, untracked=$UNTRACKED"
  git add -A
  git commit -m "chore: Phase $PHASE 잔여 파일 정리"
  echo "✅ 잔여 정리 커밋"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Auto-Commit 완료"
git log --oneline -10
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
