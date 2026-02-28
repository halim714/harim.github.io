---
trigger: always_on
description: 새 모듈 생성 후 진입점에서 import/require되지 않아 Dead Code가 되는 실패를 방지합니다.
---

# 모듈 배선 검증 (Wiring Verification)

## 컨텍스트
Phase 2에서 `server.js`(Express HTTP 서버)를 만들었으나, 진입점(`index.js`)이 이를 import하지 않아 JWT 세션 엔드포인트 전체가 Dead Code로 남는 사고가 발생했습니다. 
원인: 태스크 프롬프트에 "파일을 만들어라"만 적고, **"그것을 어디서 호출해야 하는지"**를 명시하지 않았기 때문입니다.

## 규칙

### 오케스트레이터(Antigravity)용 규칙
1. **배선 지시 의무화**: 새 모듈 생성 태스크를 만들 때, 해당 모듈을 호출하는 진입점(Entry Point) 수정을 **반드시 프롬프트에 포함**하라.
   - 올바른 예: *"server.js를 만들고, **index.js에서 createApp()을 import하여 HTTP 서버로 사용하도록 수정하라**"*
   - 잘못된 예: *"server.js를 만들어라"* (호출 지점 미명시)
2. **공유 파일 감지 및 순차 분리**: 병렬 태스크들이 **동일한 파일을 수정해야 하는 경우**, 해당 파일 수정은 병렬에서 제외하고 **별도의 순차 배선(Wiring) 태스크**로 분리하라.
   - 올바른 예: P2-T2, P2-T3를 병렬 실행 후, `P2-T2.5-wiring`을 순차 실행하여 `index.js`에서 `server.js`와 `ws-handler.js`를 통합
   - 잘못된 예: P2-T1과 P2-T2가 모두 `index.js`를 수정하도록 병렬 배정

### 스웜 에이전트(api_dev, frontend_dev)용 규칙
3. **export 후 import 확인**: 새 모듈에서 함수를 `module.exports` 또는 `export`한 경우, 해당 함수가 프로젝트의 다른 파일에서 **실제로 import/require되는지** 반드시 확인하라.
   ```bash
   # 자기검증: 내가 export한 createApp이 어딘가에서 사용되는지
   grep -rn "createApp\|require.*server" ws-proxy/src/ --include="*.js" | grep -v "server.js"
   ```
4. **진입점 수정이 프롬프트에 없더라도**: export한 모듈이 어디서도 호출되지 않는다면, 해당 사실을 `.agents/progress/` 상태 문서에 **경고로 기록**하라.

## 올바른 예시
```
# 태스크 프롬프트 (오케스트레이터가 작성)
P2-T2: server.js에 Express HTTP 서버를 구현하라.
       ★ 완료 후 index.js에서 const { createApp } = require('./server'); 로
         createApp()을 import하고, 기존 http.createServer를 교체하라.

# 에이전트 자기검증
$ grep -rn "createApp" ws-proxy/src/ --include="*.js" | grep -v "server.js"
ws-proxy/src/index.js:3:const { createApp } = require('./server');
→ ✅ 배선 확인됨
```

## 잘못된 예시
```
# 태스크 프롬프트 (배선 지시 없음)
P2-T2: server.js에 Express HTTP 서버를 구현하라.

# 에이전트가 server.js만 생성하고 끝냄
$ grep -rn "createApp" ws-proxy/src/ --include="*.js" | grep -v "server.js"
(결과 없음)
→ ❌ Dead Export — server.js의 createApp()이 아무데서도 호출되지 않음
```
