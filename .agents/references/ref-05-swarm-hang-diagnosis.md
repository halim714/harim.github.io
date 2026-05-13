---
id: ref-005
topic: run-swarm-hang-diagnosis
created: 2026-03-05
tags: [run-swarm, claude-cli, worktree, --add-dir, timeout, hang, swarm-agent]
---

# run-swarm.sh — claude -p 초기화 hang 진단 및 수정 이력

## 증상

- `run-swarm.sh`로 실행된 에이전트가 stdout/stderr에 아무것도 출력하지 않음
- `.raw` 파일 크기 = 0바이트
- 300초 하드 타임아웃 후에야 종료 감지
- `claude -p` 단독 실행 테스트(시나리오 5~7)에서는 정상 동작 → 스크립트 환경 문제

---

## 근본 원인: `--add-dir` 중복 인덱싱

### 문제 코드 (v2)

```bash
WORK_DIR="${WORKTREE_DIR:-$PROJECT_ROOT}"   # = worktree root
cd "$WORKTREE_DIR"                           # CWD = worktree root

claude -p --model "$MODEL" --dangerously-skip-permissions \
  --add-dir "$WORK_DIR" \                   # ❌ CWD와 동일 → 중복
  --add-dir "$WORK_DIR/miki-editor" \       # ❌ CWD 하위 → 중복
  -- "$FULL_PROMPT" < /dev/null > "$RAW_FILE" 2>&1 &
```

### 왜 hang이 발생하는가

| 디렉토리 | 인덱싱 횟수 |
|---|---|
| worktree root 전체 | CWD로 1회 + `--add-dir "$WORK_DIR"`로 1회 = **2회** |
| miki-editor | CWD 스캔 시 1회 + `--add-dir "$WORK_DIR"` 포함 1회 + `--add-dir "$WORK_DIR/miki-editor"` 1회 = **3회** |

Claude Code는 `--add-dir`로 지정한 경로를 project context로 별도 로드한다. CWD를 이미 project root로 인식한 상태에서 동일 경로를 중복 추가하면 초기화 단계에서 디렉토리 스캔이 중첩 실행되어 hang 발생.

### `--add-dir`의 올바른 사용법

> **CWD 외부** 디렉토리를 추가할 때만 사용한다.
> CWD = worktree root인 경우 `--add-dir`은 필요 없다.

---

## 수정 1: `--add-dir` 제거 (근본 원인 해소)

```bash
# v3 수정 코드
claude -p --model "$MODEL" --dangerously-skip-permissions \
  -- "$FULL_PROMPT" < /dev/null > "$RAW_FILE" 2>&1 &
```

CWD(worktree root)에서 실행하므로 claude가 이미 모든 파일에 접근 가능.

---

## 수정 2: 2단계 타임아웃 (안전망)

### 기존 설계의 결함

v2의 타임아웃 주석:
> "idle detection 불필요 + 오히려 응답 전에 죽이는 문제 발생"

이 전제는 **claude가 정상 시작된 경우에만** 유효하다. 초기화 hang 시에는:
- 출력: 0바이트 (영구 대기)
- 감지: 300초 후 타임아웃 (낭비)
- 실패는 사실 t=15~45s에 이미 확정된 상태

### 2단계 타임아웃 설계

```
INIT_TIMEOUT = 45s  → 첫 출력까지 최대 대기 (초기화 hang 전용)
MAX_WAIT     = 300s → 전체 타임아웃 (기존 유지)
```

```bash
# Phase 1: 초기화 워치독 — 45초 내 첫 출력 없으면 hang 판정
(sleep "${INIT_TIMEOUT}"
 if kill -0 $CLAUDE_PID 2>/dev/null; then
   RAWSIZE=$(wc -c < "$RAW_FILE" 2>/dev/null | tr -d ' ')
   if [ "${RAWSIZE:-0}" -eq 0 ]; then
     echo "[init-hang] ${INIT_TIMEOUT}초 경과, 출력 0바이트 — hang 판정"
     touch "$INIT_FLAG"
     kill $CLAUDE_PID 2>/dev/null
   fi
 fi) &

# Phase 2: 전체 타임아웃 (기존 방식 유지)
(sleep $MAX_WAIT && kill -0 $CLAUDE_PID 2>/dev/null && touch "$TIMEOUT_FLAG" && kill ...) &
```

**45초 근거**: claude -p 정상 초기화(CLAUDE.md 로드 + 첫 토큰 출력)는 실측 5~20초. 45초는 이 범위의 2배 이상 여유.

**출력 중 idle 감지는 복원하지 않은 이유**: claude가 긴 추론 시 30~60초 pause 후 출력하는 패턴이 있어 오탐 위험이 높다. "첫 출력까지" 감지만으로 충분.

### 종료 원인 구분

```bash
INIT_HANG=1  → 초기화 hang (45s 내 출력 없음)  → merge 차단, exit 1
TIMED_OUT=1  → 전체 타임아웃 (300s)             → merge 차단, exit 1
정상 종료     → AGENT_EXIT=0                     → 정상 merge 진행
```

---

## 기각된 대안: stdin 전달 방식

### 제안

```bash
# echo "$FULL_PROMPT" | claude -p ... > "$RAW_FILE" 2>&1 &
```

### 기각 이유

1. **hang 원인과 무관**: 원인은 `--add-dir` 중복이었으며, 프롬프트 전달 방식은 관계없음
2. **CLI argument 크기 제한 미도달**: SOP(~3816B) + 태스크 ≈ 5KB << macOS ARG_MAX(256KB+)
3. **`echo` 플래그 오해석**: SOP 내용이 `-e`, `-n`으로 시작하면 echo가 플래그로 해석
4. **파이프 + `&` PID 불안정**: 파이프라인 백그라운드에서 `$!` 신뢰성 감소
5. **`< /dev/null` 보호 소멸**: 현재의 stdin 차단 역할이 사라짐

---

## 결론 요약

| 수정 | 효과 |
|---|---|
| `--add-dir "$WORK_DIR"` 제거 | 중복 인덱싱 → hang 원인 제거 |
| `--add-dir "$WORK_DIR/miki-editor"` 제거 | 3중 인덱싱 방지 |
| INIT_TIMEOUT=45s 워치독 추가 | 미래 hang 45s 내 감지 (300s → 45s) |
| INIT_HANG flag 분리 | 타임아웃 vs 초기화 hang 원인 구분 가능 |

---

---

## 수정 3: `script PTY` + MAX_WAIT 증가 (v4 → v5)

### 증상 (복합 문제)

`--add-dir` 제거 후에도 RAW 파일 0바이트 지속.

### 원인 분석 (시간순 사실 기반)

| 시점 | 테스트 | 결과 | 해석 |
|---|---|---|---|
| 2/27 | P2-T2 (~150s) | ✅ exit=0 | 빠른 완료 → stdout 정상 flush |
| 2/27 | P3-T1 (~300s) | ⚠️ timeout, 523 additions | git commit은 있으나 stdout 0바이트 가능성 |
| 3/2 | P4-T0a v1 (--add-dir) | ❌ 300s, 0B | 문제 A: genuine hang |
| 3/4 | P4-T0a v4 (init 45s) | ❌ 45s, 0B | 문제 B: 자가 유발 |
| 3/5 | 직접 `claude -p > file` | ❌ 0B exit 0 | stdout → 파일 시 claude가 출력 안 함 |
| 3/5 | 직접 `claude -p` (TTY) | ✅ 정상 | TTY일 때만 출력 |

**세 가지 독립 문제의 중첩:**
1. **문제 A**: `--add-dir` genuine hang → P4-T0a v1에서 확인
2. **문제 B**: init watchdog 45s 거짓 양성 → `claude -p`는 stdout이 파일이면 출력 안 씀 → 작업 중 RAW 항상 0바이트 → watchdog 100% 발동
3. **문제 C**: MAX_WAIT 300s 부족 → P4-T0a는 400-600s 필요

**문제 B의 근본**: `claude -p`가 stdout이 TTY가 아닐 때 출력을 생성하지 않는 것은 Node.js의 TTY 감지에 기인. `script` 명령으로 가짜 PTY를 생성하면 claude가 실시간으로 출력 → init watchdog 정상 동작 회복.

**동시 변경 오류**: --add-dir 제거와 init watchdog 추가를 동시에 적용 → 어느 것이 효과가 있었는지 격리 불가. c7 규칙(`한 번에 하나의 변수만 변경`) 위반.

### 수정 (v5)

```bash
# 실제 실행: script PTY로 TTY 환경 시뮬레이션
script -q "$RAW_FILE" \
  claude -p --model "$MODEL" --dangerously-skip-permissions \
  -- "$FULL_PROMPT" < /dev/null &

# MAX_WAIT: 300 → 600 (복잡한 태스크 대응)
MAX_WAIT=600

# ANSI escape 코드 strip (PTY 출력 정리)
sed 's/\x1b\[[0-9;]*[mGKHF]//g; s/\r//g' "$RAW_FILE" >> "$DIR/$LOG_FILE"
```

init watchdog(45s)은 유지 — script PTY로 실시간 출력이 가능하므로 genuine hang 감지 정상 동작.

## 수정 4: `unset CLAUDECODE` (보조)

### 증상

Claude Code 인터랙티브 세션 내에서 run-swarm.sh를 실행할 때 모든 claude -p 호출이 실패:

```
Error: Claude Code cannot be launched inside another Claude Code session.
Nested sessions share runtime resources and will crash all active sessions.
To bypass this check, unset the CLAUDECODE environment variable.
```

사용자 터미널에서 직접 실행 시에는 동일 커맨드가 정상 동작 → `CLAUDECODE` 환경변수 유무 차이.

### 원인

Claude Code는 실행 시 `CLAUDECODE` 환경변수를 설정한다. 인터랙티브 세션 안에서 run-swarm.sh를 실행하면 이 변수가 자식 프로세스(swarm)에 상속되고, 중첩 세션 방지 로직이 작동해 차단된다.

### 수정

`claude -p` 호출 직전에 `unset CLAUDECODE` 추가. pre-flight, 실제 실행, T3 bisect 세 곳 모두 적용.

---

## 관련 파일

- `miki-editor/scripts/run-swarm.sh` — 수정 적용 위치 (v2→v3→v5)
- `miki-editor/scripts/run-phase.sh` — run-swarm.sh 호출부
