# Miki Editor 레이아웃 개선 계획서

> **작성일**: 2026-01-16  
> **최종 검토**: 2026-01-16 (잠재적 리스크 반영)  
> **참조 모델**: [Hyperclast Workspace](https://github.com/hyperclast/workspace)  
> **상태**: 검토 완료 - 실행 대기

---

## 1. 개요

### 1.1 배경
현재 Miki Editor의 에디터 패널은 스켈레톤 UI와 정렬이 맞지 않고, 고정된 너비로 인해 우측으로 치우쳐 보이는 문제가 있습니다. 이로 인해 사용자 경험이 저하되고 있습니다.

### 1.2 목표
- 에디터 본문 영역을 **800px 최대 너비**로 제한하여 가독성 최적화
- **중앙 정렬**(`margin: 0 auto`)로 시각적 균형 확보
- 반응형 패딩으로 다양한 화면 크기에 유연하게 대응
- 스켈레톤 UI와 실제 UI 간 레이아웃 일관성 확보

---

## 2. 현재 상태 분석

### 2.1 문제가 있는 코드

**파일**: `src/components/editor/EditorPanel.jsx`

```javascript
// 68-77줄: getContainerClass()
const getContainerClass = () => {
  if (isFullscreen) {
    return "bg-white rounded shadow flex flex-col h-full";
  }
  return `bg-white rounded shadow flex flex-col ${
    isMobile
      ? (activeMobilePanel === 'editor' ? 'block' : 'hidden') + ' flex-grow'
      : 'shrink-0 mx-6'  // ⚠️ 문제: shrink-0으로 축소 불가능
  }`;
};

// 79-98줄: getContainerStyle()
const getContainerStyle = () => {
  if (isFullscreen) {
    return {};
  }
  const base = { display: isMobile && activeMobilePanel !== 'editor' ? 'none' : 'flex', minHeight: 0 };
  if (!isMobile) {
    return {
      ...base,
      flexBasis: '900px',      // ⚠️ 문제: 고정 너비 강제
      maxWidth: '900px',
      width: '100%',
      height: 'calc(100vh - 160px)',
      minHeight: 0,
      marginLeft: 'auto',      // ⚠️ 문제: Flexbox 내에서 우측 정렬 유발
      marginRight: 'auto'
    };
  }
  return base;
};
```

### 2.2 문제점 요약

| 문제 | 현재 코드 | 증상 |
|------|----------|------|
| 우측 정렬 | `marginLeft: 'auto'` + 3패널 Flexbox | 에디터가 오른쪽으로 치우침 |
| 고정 너비 | `flexBasis: '900px'` + `shrink-0` | 화면이 좁아져도 축소 안 됨 |
| 스켈레톤 불일치 | 스켈레톤은 `flex-1`, 실제는 고정 | 로딩 → 완료 시 레이아웃 점프 |

---

## 3. 참조 모델: Hyperclast Workspace

### 3.1 핵심 CSS 변수

```css
:root {
  --max-content-width: 800px;
  --page-padding: 48px;
}

@media (max-width: 768px) {
  :root {
    --page-padding: 20px;
  }
}
```

### 3.2 레이아웃 구조

```css
#editor-container {
  flex: 1 1 auto;              /* 유연한 확장/축소 */
  display: flex;
  flex-direction: column;
  padding: 0 var(--page-padding);
}

#editor {
  width: 100%;
  max-width: var(--max-content-width);  /* 800px 제한 */
  margin: 0 auto;                        /* 중앙 정렬 */
}
```

### 3.3 설계 원칙

1. **외부 컨테이너**: Flexbox에서 유연하게 공간을 채움
2. **내부 에디터 영역**: 최대 너비를 제한하고 중앙에 배치
3. **반응형 패딩**: 화면 크기에 따라 여백 자동 조절

---

## 4. 개선 계획

### 4.1 Phase 1: CSS 변수 도입

**파일**: `src/index.css`

```css
/* === Editor Layout Variables === */
:root {
  --editor-max-width: 800px;
  --editor-padding-desktop: 48px;
  --editor-padding-tablet: 32px;
  --editor-padding-mobile: 16px;
}
```

### 4.2 Phase 2: 에디터 래퍼 CSS 클래스 추가

**파일**: `src/index.css`

```css
/* === Editor Content Wrapper === */
.editor-content-wrapper {
  width: 100%;
  max-width: var(--editor-max-width);
  margin: 0 auto;
  padding: 0 var(--editor-padding-desktop);
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ✅ 전체화면 모드: 너비 제한 해제 */
.editor-content-wrapper-fullscreen {
  max-width: 100%;
  padding: 0 var(--editor-padding-desktop);
}

/* ✅ 태블릿: 패딩 축소 */
@media (max-width: 1024px) {
  .editor-content-wrapper {
    padding: 0 var(--editor-padding-tablet);
  }
  .editor-content-wrapper-fullscreen {
    padding: 0 var(--editor-padding-tablet);
  }
}

/* ✅ 모바일: 전체 너비 사용, 최소 패딩 */
@media (max-width: 768px) {
  .editor-content-wrapper {
    padding: 0 var(--editor-padding-mobile);
    max-width: 100%;
  }
  .editor-content-wrapper-fullscreen {
    padding: 0 var(--editor-padding-mobile);
  }
}
```

### 4.3 Phase 3: EditorPanel.jsx 수정

#### 4.3.1 getContainerClass() 수정

```javascript
// Before
: 'shrink-0 mx-6'

// After
: 'flex-1 min-w-0'
```

#### 4.3.2 getContainerStyle() 수정

```javascript
// Before (데스크톱)
if (!isMobile) {
  return {
    ...base,
    flexBasis: '900px',
    maxWidth: '900px',
    width: '100%',
    height: 'calc(100vh - 160px)',  // ⚠️ 하드코딩된 높이
    minHeight: 0,
    marginLeft: 'auto',
    marginRight: 'auto'
  };
}

// After (데스크톱) - ✅ Flex 기반 높이 계산
if (!isMobile) {
  return {
    ...base,
    flex: '1 1 0%',
    minHeight: 0,
    overflow: 'hidden'
    // ✅ height 제거 - 부모 Flexbox가 자동 계산
    // ✅ margin 제거 - 내부 래퍼에서 처리
  };
}
```

**변경 이유:**
- `calc(100vh - 160px)` 같은 하드코딩은 헤더 높이가 변할 때 깨짐
- Flexbox의 `flex: 1`은 자동으로 남은 공간을 채워 더 안전

#### 4.3.3 JSX 구조 수정

```jsx
// Before
<div className={getContainerClass()} style={getContainerStyle()}>
  <div className="mb-4 flex flex-col p-4">
    {/* 헤더 */}
  </div>
  <div className="flex-grow relative editor-outer-scroll" ...>
    <MikiEditor ... />
  </div>
</div>

// After - ✅ 전체화면 모드 조건부 클래스 적용
<div className={getContainerClass()} style={getContainerStyle()}>
  <div className={isFullscreen ? "editor-content-wrapper-fullscreen" : "editor-content-wrapper"}>
    <div className="mb-4 flex flex-col p-4">
      {/* 헤더 */}
    </div>
    <div className="flex-grow relative editor-outer-scroll" ...>
      <MikiEditor ... />
    </div>
  </div>
</div>
```

**핵심 변경점:**
- 일반 모드: `.editor-content-wrapper` (800px 제한)
- 전체화면: `.editor-content-wrapper-fullscreen` (100% 너비)

### 4.4 Phase 4: 스켈레톤 UI 동기화

**파일**: `src/pages/Editor.jsx` (약 790-800줄 부근)

```jsx
// Before
<div className="flex-1 mx-2 bg-white rounded shadow">
  {/* 스켈레톤 내용 */}
</div>

// After
<div className="flex-1 min-w-0 bg-white rounded shadow overflow-hidden">
  <div className="editor-content-wrapper">
    {/* 스켈레톤 내용 */}
  </div>
</div>
```

---

## 5. 수정 대상 파일 요약

| 순서 | 파일 | 수정 내용 | 난이도 |
|------|------|----------|--------|
| 1 | `src/index.css` | CSS 변수 및 `.editor-content-wrapper` 클래스 추가 | 낮음 |
| 2 | `src/components/editor/EditorPanel.jsx` | 컨테이너 스타일 변경, 내부 래퍼 추가 | 중간 |
| 3 | `src/pages/Editor.jsx` | 스켈레톤 UI 동기화 | 낮음 |

---

## 6. 예상 결과

### 6.1 시각적 변화

| 항목 | Before | After |
|------|--------|-------|
| 에디터 정렬 | 우측 치우침 | 중앙 정렬 |
| 화면 축소 시 | 900px 고정, 잘림 | 800px → 유연하게 축소 |
| 스켈레톤 → 에디터 | 레이아웃 점프 | 동일 위치 유지 |
| 사이드바와 간격 | 불균형 | 균등 분배 |

### 6.2 기대 효과

1. **가독성 향상**: 800px 최대 너비로 최적의 줄 길이 유지
2. **시각적 안정성**: 로딩 중 ↔ 로딩 후 레이아웃 일관성
3. **반응형 대응**: 다양한 화면 크기에서 자연스러운 동작
4. **유지보수성**: CSS 변수를 통한 일관된 스타일 관리

---

## 7. 위험 요소 및 대응 방안 (비판적 검토 반영)

### 7.1 전체화면 모드에서의 너비 제한 문제

| 구분 | 내용 |
|------|------|
| **위험** | 전체화면 모드에서도 800px 너비 제한이 적용되면 사용자 기대치와 불일치 |
| **영향도** | 중간 - 일부 사용자는 전체화면 = 화면 전체 사용을 기대 |
| **대응** | `.editor-content-wrapper-fullscreen` 클래스로 조건부 분기 처리 |
| **검증** | 전체화면 토글 시 본문 너비 변화 육안 확인 |

**상세 대응 코드:**
```javascript
// EditorPanel.jsx 내부
<div className={isFullscreen ? "editor-content-wrapper-fullscreen" : "editor-content-wrapper"}>
```

### 7.2 높이 계산 로직 (`calc(100vh - 160px)`) 문제

| 구분 | 내용 |
|------|------|
| **위험** | 하드코딩된 `160px` 보정치가 헤더 높이 변경 시 깨질 수 있음 |
| **영향도** | 높음 - 스크롤 영역이 잘못 계산되어 사용성 저하 |
| **대응** | `height` 속성 제거, Flexbox의 `flex: 1`로 자동 계산 위임 |
| **검증** | 브라우저 개발자 도구로 에디터 패널 실제 높이 측정 |

**개선 방향:**
- Before: `height: calc(100vh - 160px)` → After: `flex: 1 1 0%` + 부모에서 자동 계산

### 7.3 모바일 패딩 중첩 문제

| 구분 | 내용 |
|------|------|
| **위험** | 부모 컨테이너와 래퍼 양쪽에 패딩 적용 시 이중 여백 발생 |
| **영향도** | 낮음 - 모바일에서 본문이 너무 좁아질 수 있음 |
| **대응** | 수정 전 현재 모바일 뷰의 실제 패딩값 확인 및 조정 |
| **검증** | 375px, 414px, 768px 너비에서 좌우 여백 측정 |

**체크 사항:**
```css
/* 부모에 이미 padding이 있는지 확인 필요 */
.editor-panel-mobile {
  padding: ??? /* 기존 값 확인 */
}
```

### 7.4 Toast UI Editor 높이 동작 변경

| 구분 | 내용 |
|------|------|
| **위험** | 내부 래퍼 추가로 Toast UI의 자동 높이 계산이 영향받을 수 있음 |
| **영향도** | 중간 - 에디터가 스크롤되지 않거나 넘칠 수 있음 |
| **대응** | `.editor-outer-scroll`에 `flex: 1, overflow-y: auto` 명시 유지 |
| **검증** | 긴 문서(50줄 이상) 로드 후 스크롤 동작 테스트 |

### 7.5 3-패널 공간 배분 변경

| 구분 | 내용 |
|------|------|
| **위험** | 에디터가 `flex-1`로 변경 시 AI 패널이나 사이드바가 압축될 수 있음 |
| **영향도** | 낮음 - 기존 `w-1/5`, `w-1/4` 설정이 에디터보다 우선순위 높음 |
| **대응** | 사이드바(`min-w-[280px]`), AI패널(`min-w-[320px]`) 최소 너비 유지 확인 |
| **검증** | 1200px, 1366px, 1920px 해상도에서 3패널 균형 확인 |

---

## 8. 테스트 체크리스트

### 8.1 레이아웃 정렬 테스트
- [ ] **데스크톱(1920px)**: 에디터 본문 중앙 정렬 확인
- [ ] **데스크톱(1366px)**: 사이드바-에디터-AI 패널 균형 확인
- [ ] **데스크톱(1200px)**: 최소 해상도에서 3패널 정상 표시 확인

### 8.2 반응형 동작 테스트
- [ ] **태블릿(1024px)**: 패딩 32px로 축소 확인
- [ ] **태블릿(768px)**: 전체 너비 사용 + 패딩 16px 확인
- [ ] **모바일(414px)**: 좌우 여백 최소화 확인
- [ ] **모바일(375px)**: 패딩 중복 없음 확인

### 8.3 전체화면 모드 테스트
- [ ] **일반 → 전체화면**: 본문 너비 800px → 100% 전환 확인
- [ ] **전체화면 → 일반**: 본문 너비 100% → 800px 복귀 확인
- [ ] **전체화면 스크롤**: 긴 문서에서 스크롤 정상 동작 확인

### 8.4 스켈레톤 → 에디터 전환 테스트
- [ ] **로딩 중**: 스켈레톤 위치 확인
- [ ] **로딩 완료**: 에디터 위치가 스켈레톤과 1px 단위로 일치 확인
- [ ] **레이아웃 점프**: 시각적 깜빡임 없음 확인

### 8.5 기능 회귀 테스트
- [ ] **문서 로딩**: 기존과 동일하게 정상 로드
- [ ] **자동 저장**: `useAutoSave` 훅 정상 동작
- [ ] **수동 저장**: 저장 버튼 클릭 시 정상 저장
- [ ] **AI 명령**: AI 패널 상호작용 정상 동작
- [ ] **링크 생성**: 드래그 기반 링크 생성 정상 동작

### 8.6 Toast UI Editor 통합 테스트
- [ ] **짧은 문서(10줄)**: 에디터 정상 표시
- [ ] **긴 문서(100줄)**: 스크롤 정상 동작
- [ ] **코드 블록**: 가로 스크롤 정상 동작
- [ ] **이미지 삽입**: 레이아웃 깨짐 없음

### 8.7 3-패널 공간 배분 테스트
- [ ] **사이드바 최소 너비**: 280px 유지 확인
- [ ] **AI 패널 최소 너비**: 320px 유지 확인
- [ ] **에디터 축소**: 화면이 좁아질 때 에디터가 먼저 축소되는지 확인

---

## 9. 승인 및 진행

**검토자**: _______________  
**승인일**: _______________  
**비고**: 

---

*이 문서는 코드 수정 전 검토용으로 작성되었습니다.*
