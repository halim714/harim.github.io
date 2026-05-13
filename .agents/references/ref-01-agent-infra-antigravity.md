---
id: ref-001
topic: antigravity-format
created: 2026-02-25
tags: [antigravity, format, agent-structure]
---

# Antigravity 에이전트/커맨드/스킬 포맷 레퍼런스

## 디렉토리 구조

```
.agents/
├── rules/        ← always_on 룰 (세션마다 자동 로드)
├── roles/        ← SOP 역할 프롬프트 (run-swarm.sh --system-prompt)
├── workflows/    ← /slash-command 워크플로우 (Antigravity 오케스트레이터용)
├── skills/       ← SKILL.md 반복 패턴 (에이전트가 참조)
└── references/   ← 조사 결과 영구 저장소 (이 디렉토리)
```

## Rules 포맷 (.agents/rules/*.md)

```yaml
---
trigger: always_on       # 세션마다 자동 로드
glob:                    # (선택) 특정 파일 패턴 매칭 시만 활성화
description: 한 줄 설명
---
```
- `trigger: always_on` → 모든 세션에서 자동 적용
- 파일명이 곧 룰 ID
- 내용: 마크다운 자유 형식

## Workflows 포맷 (.agents/workflows/*.md)

```yaml
---
description: 워크플로우 한 줄 설명
---
```
- 파일명(확장자 제외)이 곧 `/slash-command` 이름
- `// turbo` 주석: 해당 step만 auto-run
- `// turbo-all` 주석: 모든 step auto-run

## Skills 포맷 (.agents/skills/<name>/SKILL.md)

```yaml
---
name: 스킬 이름
description: 스킬 한 줄 설명
---
```
- 반드시 `SKILL.md` 파일명 사용
- 폴더 내에 scripts/, examples/, resources/ 추가 가능
- 에이전트가 `view_file`로 SKILL.md를 읽어 절차를 따름

## Roles 포맷 (.agents/roles/*.md) — Meki 커스텀

```yaml
---
role: 역할명
version: "1.0"
description: SOP 한 줄 설명
---
```
- run-swarm.sh의 `--system-prompt`로 주입
- "과거 실수 기록" 섹션: agent-optimizer가 자동 업데이트
