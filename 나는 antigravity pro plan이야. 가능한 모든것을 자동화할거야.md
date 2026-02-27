<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 나는 antigravity pro plan이야. 가능한 모든것을 자동화할거야

Pro 플랜이면 거의 모든 걸 구성할 수 있어요! 실전 가능한 최강 자동화 스택을 완전히 정리해 드릴게요. 😎

***

## 전체 자동화 아키텍처

Antigravity를 **PM/오케스트레이터**, Claude Code를 **개발 실행부**로 역할 분리하는 게 핵심이에요.[^1]

```
[Antigravity Pro - Mission Control]
     ↓  태스크 기획 + 분배 (Gemini 3 Pro)
     ↓
┌────────────┬────────────┬────────────┐
│ CC Agent A │ CC Agent B │ CC Agent C │
│ (Frontend) │ (Backend)  │  (Testing) │
│OpenRouter  │OpenRouter  │Gemini API  │
│DeepSeek    │Sonnet 4    │Flash       │
└────────────┴────────────┴────────────┘
     ↓
[자동 테스트 → Vercel 자동 배포]
```


***

## Step 1: Antigravity Pro 세팅

Pro 플랜에서는 동시 서브에이전트 수 제한이 해제되고 Background 에이전트가 무제한으로 돌아요.  **Agent Skills**를 미리 정의해 두면 반복 작업을 에이전트가 자동으로 처리해요:[^2]

`antigravity.google/docs/skills`에서 Skills 파일을 만들어 아래 내용을 등록하세요:[^3]

- `code-reviewer` — PR마다 자동 코드 리뷰
- `test-writer` — 코드 변경 시 자동 테스트 생성
- `deploy-checker` — 배포 전 환경변수·빌드 에러 자동 점검

***

## Step 2: Claude Swarm으로 역할별 에이전트 정의

`claude-swarm`이 현재 가장 강력한 병렬 오케스트레이션 도구예요. YAML 한 파일로 전체 팀을 구성해요.[^4]

```yaml
# claude-swarm.yml (Meki 프로젝트 예시)
version: 1
swarm:
  name: "Meki Dev Team"
  main: architect
  instances:
    architect:
      description: "시스템 설계 및 태스크 분배"
      directory: .
      model: opus          # ← 복잡한 판단은 Opus
      connections: [frontend, backend, devops]
      vibe: true

    frontend:
      description: "Next.js UI 및 Tailwind 구현"
      directory: ./src
      model: sonnet        # ← 일반 코딩은 Sonnet
      allowed_tools: [Edit, Write, Bash]

    backend:
      description: "API, DB, 서버리스 함수"
      directory: ./api
      model: sonnet
      allowed_tools: [Edit, Write, Bash]

    devops:
      description: "Vercel 배포 및 GitHub Actions"
      directory: ./infrastructure
      model: haiku          # ← 반복 작업은 Haiku
      allowed_tools: [Read, Edit, Bash]
```

실행은 `claude-swarm` 한 줄이면 돼요.[^4]

***

## Step 3: oh-my-claudecode(OMC)로 Autopilot

OMC를 설치하면 Claude Code에 **Ultrapilot**, **Swarm**, **HUD 모니터링**이 생겨요.[^5]

```bash
# 설치
npm install -g oh-my-claudecode

# 프로젝트 초기화
/omc-setup

# 5개 에이전트 병렬 자동 실행
ultrapilot: Meki의 노트 연결 그래프 기능 전체 구현해줘

# 또는 특정 태스크 스웜
/swarm 5:executor "모든 TypeScript 에러 수정해줘"
```


***

## Step 4: 모델별 비용 최적 라우팅

OpenRouter + Gemini API를 조합해 각 에이전트에 최적 모델을 배정해요:[^6]


| 에이전트 역할 | 모델 | 경로 | 이유 |
| :-- | :-- | :-- | :-- |
| 아키텍트 (Opus) | claude-opus-4 | Anthropic 직접 | 최고 추론 품질 |
| 일반 코딩 | claude-sonnet-4 | OpenRouter | 비용·성능 밸런스 |
| 긴 파일 탐색 | gemini-2.5-pro | Gemini API 직접 | 긴 컨텍스트 강점 |
| 반복·백그라운드 | deepseek-chat | OpenRouter | 95% 저렴 |
| 빠른 단순 작업 | gemini-2.5-flash | Gemini API 직접 | 초고속 응답 |


***

## Step 5: Antigravity → Claude Code 완전 자동화 루프

Antigravity Pro의 **Workflow 기능**에 아래 루프를 등록하면 PRD 입력만으로 전체 사이클이 돌아요:[^3]

```
1. Antigravity: PRD 입력 → 태스크 리스트 생성 (Gemini 3 Pro)
2. claude-swarm 실행 → 각 에이전트 병렬 코딩 시작
3. OMC Swarm → 에러 자동 수정 루프
4. Antigravity Skills → 자동 코드 리뷰 + 테스트 생성
5. GitHub Actions → 자동 PR 생성
6. Vercel → 자동 Preview 배포
7. Antigravity 브라우저 에이전트 → Preview URL 자동 테스트
```


***

## ⚠️ 반드시 설정해야 할 것 하나

Antigravity Pro에서도 **Secure Mode**는 반드시 켜두세요. 특히 에이전트가 터미널과 파일 시스템에 직접 접근하기 때문에, `rm -rf` 류의 치명적 명령은 실행 전 승인 알림을 받도록 설정하는 게 필수예요.  프로덕션 브랜치에 직접 push하는 건 막고, **반드시 PR 경유**로만 배포되도록 GitHub 브랜치 보호 규칙도 같이 걸어두세요.[^7]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.linkedin.com/posts/juliangoldieseo_antigravity-claude-code-automate-anything-activity-7415094783901192192-IHfE

[^2]: https://antigravity.im/features

[^3]: https://www.youtube.com/watch?v=oRAeNVx2kqM

[^4]: https://github.com/parruda/claude-swarm

[^5]: https://mcpmarket.com/tools/skills/omc-setup

[^6]: https://ayyaztech.com/blog/use-claude-code-with-any-ai-model-gpt-gemini-deepseek

[^7]: https://www.youtube.com/watch?v=-WB-OzA8uu0

[^8]: https://zeabur.com/blogs/google-antigravity-agentic-ide-features

[^9]: https://discuss.ai.google.dev/t/multi-agent-use-in-antigravity/117941

[^10]: https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/

[^11]: https://ohmyclaudecode.com

[^12]: https://www.youtube.com/watch?v=8dPGCvk7Y3w

[^13]: https://www.aifire.co/p/google-antigravity-the-2026-guide-to-the-best-ai-ide

[^14]: https://www.youtube.com/watch?v=j3f8b67Pars

[^15]: https://atamel.dev/posts/2026/01-19_parallel_agents_antigravity/

[^16]: https://duststorage.tistory.com/74

