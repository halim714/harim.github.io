---
trigger: always_on
description: 스웜 에이전트가 PLAN.md나 PROGRESS.md 같은 전역 상태 파일을 직접 수정하여 발생하는 Git 병합 충돌을 방지합니다.
---

# 전역 상태 파일 격리 (Global State Isolation)

## 컨텍스트
과거 여러 에이전트가 병렬로 실행되면서 `PLAN.md`와 `PROGRESS.md`를 동시에 수정하려다가 심각한 Git 병합 충돌(Conflict)이 발생하여 코드가 소실되는 문제가 있었습니다. 
스웜 에이전트는 코드 작성에만 집중해야 하며, 전체 프로젝트의 진행 상태 관리는 오케스트레이터(Antigravity)의 고유 권한입니다.

## 규칙
1. **전역 파일 수정 절대 금지**: 스웜 에이전트(api_dev, frontend_dev, test_verify 등)는 `PLAN.md`와 `PROGRESS.md` 파일을 **절대 직접 수정해서는 안 됩니다.** 이 파일들은 오로지 읽기 전용(Read-Only)으로만 사용하세요.
2. **격리된 상태 문서 작성**: 태스크를 완료한 후, 자신의 작업 결과를 보고하려면 `.agents/progress/` 디렉토리에 개별 마크다운 파일을 생성하세요.
   - 파일명: `.agents/progress/{태스크ID}.md` (예: `.agents/progress/p3-t3.md`)
   - 만약 `.agents/progress/` 디렉토리가 없다면 직접 생성(`mkdir -p`)하세요.
3. **격리된 상태 문서 포맷**:
   파일 내용은 다음 포맷을 엄격히 따르십시오:
   ```markdown
   **태스크 ID**: [태스크 ID]
   **담당 Role**: [Role명]
   **결과**: [성공 / 실패]
   **한 줄 요약**: [수행한 작업명 및 핵심 변경사항 한 줄 요약]
   ```
4. 이후 오케스트레이터가 이 개별 파일들을 수집하여 단방향으로 한 번에 `PROGRESS.md`를 갱신할 것입니다.

## 올바른 예시
에이전트가 작업을 마치고 `bash`나 `node` 스크립트를 통해 다음과 같이 개별 파일을 생성함:
```bash
mkdir -p .agents/progress
cat << 'EOF' > .agents/progress/p3-t3.md
**태스크 ID**: P3-T3
**담당 Role**: api_dev
**결과**: 성공
**한 줄 요약**: auth.js에 WebSocket 연결 상태 기반 분기 로직(isWsProxyEnabled) 추가 완료 및 테스트 통과
EOF
```

## 잘못된 예시
에이전트가 임의로 `PROGRESS.md` 파일의 텍스트를 찾아바꾸기 하거나, `PLAN.md`의 `[ ]`를 `[x]`로 덮어쓰기 하는 행위. (이 경우 즉시 Merge Conflict 타겟이 되어 작업물이 삭제될 수 있습니다.)
