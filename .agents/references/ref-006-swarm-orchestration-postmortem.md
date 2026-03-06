# Swarm Orchestration 포스트모템: Antigravity 환경에서 claude CLI 실행 이슈

> 작성일: 2026-03-06  
> 기간: 2026-03-02 ~ 2026-03-06 (5일)  
> 관련 커밋: `3ddb6a8` (v6 최종 해결), `af2dc43` (P4-T0a), `4ce6542` (P4-T0b), `03505cd` (P4-T0c)

---

## 1. 한 줄 요약

`run-swarm.sh`에서 `claude -p ... &` (백그라운드 실행)이 Antigravity의 `run_command` 환경에서 hang/무출력을 일으켰고, **`echo "$PROMPT" | timeout N claude` (포그라운드 파이프)로 교체**하여 해결.

---

## 2. 타임라인

| 날짜 | 사건 | 스크립트 버전 |
|---|---|---|
| 2/27 | P2-T2, P3-T1 성공 (유저 터미널) | v1 |
| 3/2 | P4-T0a 첫 시도 — 300초 타임아웃, 0바이트 | v1 + `--add-dir` |
| 3/4 | `--add-dir` 제거 + init watchdog 추가 → 여전히 실패 | v4 |
| 3/5 AM | `unset CLAUDECODE` 추가, `setsid`/`nohup` 시도 → 실패 | v5 |
| 3/5 PM | P4-T0a 성공 (유저의 Claude Code 세션에서 직접 실행) | v5 (유저 터미널) |
| 3/5 PM | P4-T0b/c Antigravity에서 재시도 → init hang | v5 |
| 3/6 AM | **Bisect 테스트**: `echo \| claude` ✅, `claude -p` ❌, `& 백그라운드` ❌ | — |
| 3/6 AM | v6 작성: 포그라운드 파이프 + timeout | v6 |
| 3/6 PM | **P4-T0b, P4-T0c Antigravity에서 성공** | v6 ✅ |

---

## 3. 근본 원인 분석

### 3.1 실제 근본 원인: non-TTY 백그라운드 실행 비호환

Antigravity의 `run_command`는 내부적으로 프로세스를 spawning하며, 이 환경에서 `claude` CLI는 **특정 조건에서만** 정상 동작합니다:

| 실행 방법 | Antigravity 결과 | 유저 터미널 결과 |
|---|---|---|
| `echo "hi" \| claude --output-format text` | ✅ 정상 | ✅ 정상 |
| `claude -p "hi"` | ❌ hang | ✅ 정상 |
| `claude ... < /tmp/file` | ❌ 0바이트 | ✅ 정상 |
| `echo "hi" \| claude ... &` | ❌ 0바이트 | ✅ 정상 |
| `(echo "hi" \| claude ...) &` | ❌ 0바이트 | ✅ 정상 |

**결론**: Antigravity `run_command` 환경에서 claude CLI는 **포그라운드 파이프(`|`)에서만** 정상 동작. 이는 Claude CLI의 알려진 non-TTY 호환성 문제와 일치 (GitHub Issues 다수 보고).

### 3.2 오진한 원인들 (탐색 과정에서 배제됨)

| 가설 | 검증 방법 | 결과 |
|---|---|---|
| `--add-dir` 중복 인덱싱 | `--add-dir` 제거 | ✅ 실제 문제였으나, 동시에 init watchdog 추가 → 새 문제 유발 |
| `CLAUDECODE` 환경변수 | `unset CLAUDECODE` | ❌ Antigravity에는 해당 변수 없음 |
| 프로세스 트리 감지 | `setsid`, `nohup`, `env -i` | ❌ 모두 실패 |
| Claude CLI 버전 업그레이드 | 버전 히스토리 확인 | ❌ 버전 변경은 무관 (v1도 Antigravity에서 실패했을 것) |
| init watchdog 거짓 양성 | watchdog 제거 테스트 | △ 부분적으로 맞음, 하지만 근본 원인은 아님 |
| `script -q` PTY 래핑 | PTY 추가 후 테스트 | ❌ Antigravity에서 PTY도 무효 |

---

## 4. 해결책: run-swarm.sh v6

### 핵심 변경

```diff
- # v5: 백그라운드 실행 + 2단계 watchdog
- claude -p --model "$MODEL" --dangerously-skip-permissions \
-   -- "$FULL_PROMPT" < /dev/null > "$RAW_FILE" 2>&1 &
- CLAUDE_PID=$!
- # ... 45초 init watchdog + 300초 max watchdog (80줄)

+ # v6: 포그라운드 파이프 + timeout
+ echo "$FULL_PROMPT" | timeout $MAX_WAIT claude \
+   --model "$MODEL" \
+   --dangerously-skip-permissions \
+   --output-format text \
+   > "$RAW_FILE" 2>&1
+ AGENT_EXIT=$?
```

### 구조 변경

```
v5 (모놀리식):
  run-swarm.sh = launch + init_watchdog + max_watchdog + bisect + merge
  → 288줄, 3개 백그라운드 서브쉘, flag 파일들

v6 (단순화):
  run-swarm.sh = launch (foreground blocking) + merge
  → 206줄, 백그라운드 프로세스 0개
  → 병렬 실행은 호출자(Antigravity)가 담당
```

### 병렬 실행 전략

v6에서 `run-swarm.sh`는 **1 에이전트 = 1 포그라운드 블로킹 호출**. 병렬 실행은 Antigravity가 여러 `run_command`를 동시에 발행하여 처리:

```
Antigravity:
  run_command("bash run-swarm.sh ... p4-t0b")  ──→ 블로킹 (5분)
  run_command("bash run-swarm.sh ... p4-t0c")  ──→ 블로킹 (3분)
  (두 호출이 독립 프로세스로 동시 실행)
```

---

## 5. 디버깅 과정에서 배운 교훈

### 교훈 1: 한 번에 하나의 변수만 변경하라

> `--add-dir` 제거와 init watchdog 추가를 **동시에** 적용 → 어떤 것이 효과가 있었는지 격리 불가.

**c7 규칙의 정확한 위반**. `--add-dir` 제거가 실제로 문제를 해결했는지 검증할 수 없었고, init watchdog이 새 문제(거짓 양성)를 즉시 만들었다.

### 교훈 2: "hang"과 "무출력"을 구분하라

에이전트가 API 사용량을 발생시킨다는 유저의 관찰이 돌파구였다. 프로세스가 **실행은 되지만 출력이 캡처되지 않는 것**과 **실제 hang**은 완전히 다른 문제다.

### 교훈 3: 실행 환경의 제약을 먼저 파악하라

Antigravity의 `run_command`가 어떤 stdio/TTY 특성을 갖는지 먼저 bisect했어야 했다. 최소 테스트(`claude -p "say hi"`)를 3일차가 아닌 **1일차에** 실행했다면 3일을 절약할 수 있었다.

### 교훈 4: 외부 이슈 트래커를 확인하라

Claude CLI의 non-TTY hang은 **알려진 이슈**였다. 웹 검색으로 GitHub Issues에서 동일 증상 보고를 발견했고, pipe 우회법도 이미 문서화되어 있었다.

---

## 6. 연관 규칙/문서

| 문서 | 상태 | 비고 |
|---|---|---|
| `.agents/rules/c7-hang-diagnosis.md` | 업데이트 필요 | v6 반영 (T3 bisect 제거, 포그라운드 파이프 체크 추가) |
| `.agents/workflows/swarm-manager.md` | 업데이트 필요 | v6 호출 방식 반영 |
| `.agents/references/ref-005-run-swarm-hang-diagnosis.md` | 기존 | v5까지의 진단 이력 |

---

## 7. 미해결 사항

1. **정확한 메커니즘 미확정**: Antigravity `run_command`에서 `claude` CLI가 왜 포그라운드 파이프에서만 작동하는지의 *정확한* 기술적 원인은 미확정. 후보:
   - FD 상속된 Anthropic API 소켓에 의한 nested session 감지
   - `run_command`의 PTY 할당 방식과 claude의 TTY 감지 충돌
   - 백그라운드 프로세스의 stdin이 `/dev/null`로 리다이렉트되는 쉘 동작

2. **장기적 안정성**: Claude CLI가 업데이트되면 포그라운드 파이프도 깨질 수 있음. Node.js supervisor (안 4)로의 마이그레이션을 장기 로드맵에 유지.

3. **`--output-format text` 버퍼링**: 현재 `text` 포맷은 완료 후 한꺼번에 출력. `stream-json`으로 변경하면 실시간 진행 모니터링 가능하나, 추가 파싱 로직 필요.
