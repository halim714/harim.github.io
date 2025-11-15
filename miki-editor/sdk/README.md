# Meki SDK

Meki 프로젝트의 개발 표준과 가이드라인입니다. 모든 팀원(AI 포함)은 개발 전 반드시 이 문서를 숙지해야 합니다.

## 왜 SDK를 사용하나요?

**문제: 무계획 코딩의 함정**

3개월 후, 우리는 이런 코드를 마주하게 될 것입니다.
```javascript
// 동료 A의 코드
function Editor(props) {
  const { data } = props; // data? content? text? 뭐였지?
  // ...
}

// 동료 B의 코드
function MyEditor({ content }) { // 같은 컴포넌트인데 이름이 다름
  // ...
}
```

**해결: SDK로 명세 먼저**

SDK는 "코드를 작성하기 전에 명세를 먼저 작성한다"는 원칙을 강제합니다.

```javascript
// 1. sdk/components.js에서 확인
console.log(COMPONENTS.Editor.props.content); 
// 출력: "편집할 마크다운 텍스트"

// 2. 명확하게 작성
export function Editor({ content, onChange }) {
  // 3개월 후에도 바로 이해 가능!
}
```

---

## 핵심 워크플로우

**`plan.js` 확인 → `components.js` 확인 → 코드 작성 → `plan.js` 상태 업데이트**

### 1. 다음 작업 확인 (CLI)
```bash
node -e "import('./sdk/plan.js').then(m => console.log(m.getNextTasks()))"
```
```json
[
  {
    "id": "W1-1",
    "title": "react-resizable-panels로 레이아웃 교체",
    "target": "Layout",
    "blockers": []
  }
]
```

### 2. 작업 시작 전 Blocker 확인
```javascript
import { canStartTask } from './sdk/plan.js';

// W1-3 (툴바 구현)은 W1-2 (에디터 통합)가 끝나야 시작 가능
canStartTask('W1-3');
// ⚠️  W1-3를 시작하려면 먼저 W1-2를 완료하세요
//    Blocker: TipTap 에디터 기본 통합
```

### 3. 컴포넌트 명세 및 의존성 확인
```javascript
import { COMPONENTS, checkDependencies } from './sdk/components.js';

console.log(COMPONENTS.EditorToolbar);
// { path, props, dependencies, ... }

checkDependencies('EditorToolbar');
// ⚠️  의존 컴포넌트 'Editor'가 아직 구현되지 않음 (Blocker)
```

### 4. 코드 작성
- `sdk/conventions.js`의 모든 규칙을 준수하여 코드를 작성합니다.
- 파일명, 폴더 위치, 컴포넌트 스타일, 커밋 메시지 형식 등 모든 것이 정의되어 있습니다.

### 5. 작업 완료 후 상태 업데이트
- `sdk/plan.js`: `status`를 `'pending'`에서 `'done'`으로 변경합니다.
- `sdk/components.js`: `status`를 `'planned'`에서 `'completed'`로 변경합니다.

### 6. 커밋
```bash
git add .
git commit -m "feat: add editor toolbar component"
```
- 커밋 메시지는 `checkCommitMessage()`로 검증 가능합니다.

---

## SDK 유틸리티 함수

### `plan.js`
- `getNextTasks()`: 시작 가능한 다음 작업 목록을 보여줍니다.
- `canStartTask(taskId)`: 특정 작업을 지금 시작할 수 있는지 확인합니다.
- `getProgress()`: 전체 프로젝트 진행률을 계산합니다.
- `getWeeklyProgress()`: 주차별 진행률을 계산합니다.

### `components.js`
- `validateComponent(componentName, props)`: 컴포넌트의 props가 명세와 일치하는지 검증합니다.
- `checkDependencies(componentName)`: 컴포넌트의 의존성이 충족되었는지 확인합니다.
- `getComponentStatus(filter)`: 특정 조건(우선순위, 상태)의 컴포넌트 목록을 조회합니다.

### `conventions.js`
- `checkFileNaming(filePath)`: 파일명이 규칙에 맞는지 검사합니다.
- `checkCommitMessage(message)`: 커밋 메시지 형식이 올바른지 검사합니다.

---

## 규칙 요약

### 필수 규칙 (반드시 지킬 것)
1.  **명세 먼저**: 새 컴포넌트는 `sdk/components.js`에 명세부터 작성합니다.
2.  **계획 기반**: `plan.js`에 없는 작업은 임의로 진행하지 않습니다.
3.  **상태 업데이트**: 작업 완료 후 `plan.js`와 `components.js`의 `status`를 반드시 변경합니다.
4.  **규칙 준수**: `conventions.js`의 파일명, 코드 스타일, 커밋 메시지 규칙을 따릅니다.

### 권장 사항
- 코딩 시작 전 `canStartTask()`와 `checkDependencies()`로 선행 조건 확인하기.
- 주기적으로 `getProgress()`로 프로젝트 현황 파악하기.
- 커밋 전 `checkCommitMessage()`로 메시지 형식 검사하기.
