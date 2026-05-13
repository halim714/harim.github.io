---
id: ref-002
topic: claude-code-format
created: 2026-02-25
tags: [claude-code, format, slash-commands]
---

# Claude Code .claude 구조 레퍼런스

## 디렉토리 구조

```
.claude/
└── commands/     ← 슬래시 커맨드 (에이전트 실행 레이어)
    └── <name>.md → /name 으로 호출

~/.claude/
└── commands/     ← 개인 전역 커맨드 (모든 프로젝트에서 사용 가능)
```

## CLAUDE.md 위치와 역할

| 위치 | 역할 |
|---|---|
| 프로젝트 루트 `/CLAUDE.md` | 세션 시작 시 자동 로드. 프로젝트 전체 컨텍스트 제공 |
| 서브디렉토리 `/src/CLAUDE.md` | 해당 디렉토리 작업 시 추가 컨텍스트. 계층적 |

## Commands 포맷 (.claude/commands/*.md)

```markdown
# 커맨드 설명

내용은 자유 마크다운.
Claude Code가 이 내용을 프롬프트로 받아 실행.
```

- 파일명(확장자 제외) = `/slash-command` 이름
- 인수: `$1`, `$2` (위치 인수) 또는 `$ARGUMENTS` (전체 인수)
- 서브디렉토리로 네임스페이스 가능: `commands/deploy/vercel.md` → `/deploy/vercel`
- YAML frontmatter 없음 (Antigravity와 차이점)

## Antigravity(.agents/) vs Claude Code(.claude/) 역할 분담

| 관점 | Antigravity (.agents/) | Claude Code (.claude/) |
|---|---|---|
| 역할 | 오케스트레이터 (팀 관리) | 실행부 (개별 에이전트 액션) |
| 실행 주체 | Opus (PM 역할) | Gemini/Llama (스웜 에이전트) |
| 파일 형태 | YAML frontmatter 필수 | 순수 마크다운 |
| 복잡도 | Multi-step 워크플로우 | Single-action 커맨드 |
| 예시 | `swarm-manager` (팀 병렬 배정) | `/health-check` (내 코드 자기검증) |
