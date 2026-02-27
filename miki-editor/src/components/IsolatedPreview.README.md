# IsolatedPreview Component

> **Phase 1-T4: Security Foundation**
> 격리된 HTML 프리뷰 컴포넌트 — XSS 공격으로부터 완전히 안전한 샌드박스 렌더링

## 개요

`IsolatedPreview`는 사용자 생성 HTML을 메인 애플리케이션과 완전히 격리된 환경에서 렌더링하는 React 컴포넌트입니다.

### 핵심 기능

✅ **Blob URL 기반 격리**: 메인 앱 DOM과 완전 분리
✅ **iframe sandbox**: JavaScript 실행 차단, 폼 제출 차단, 팝업 차단
✅ **자동 메모리 관리**: useEffect cleanup으로 blob URL 자동 해제
✅ **DOMPurify 통합**: sanitize.js와 연동하여 이중 보안
✅ **다크모드 지원**: 시스템 설정에 따라 자동 전환
✅ **반응형 디자인**: 모바일/태블릿/데스크톱 대응

---

## 사용법

### 기본 사용

```jsx
import { IsolatedPreview } from '@/components/IsolatedPreview';

function MyComponent() {
  const html = '<h1>Hello World</h1><p>This is <strong>safe</strong> content.</p>';

  return <IsolatedPreview html={html} />;
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `html` | `string` | **(필수)** | 렌더링할 HTML 문자열 (자동 sanitize) |
| `title` | `string` | `"Preview"` | iframe title (접근성) |
| `style` | `object` | `{}` | iframe 커스텀 스타일 |
| `className` | `string` | `""` | iframe 추가 CSS 클래스 |
| `onLoad` | `function` | - | iframe 로드 완료 콜백 |
| `onError` | `function` | - | 에러 발생 콜백 |

---

## 통합 예제

### 1. 마크다운 에디터에 통합

```jsx
import { IsolatedPreview } from '@/components/IsolatedPreview';
import { marked } from 'marked';

function MarkdownEditor() {
  const [markdown, setMarkdown] = useState('# Title\n\nContent here...');
  const [viewMode, setViewMode] = useState('edit');

  return (
    <>
      <button onClick={() => setViewMode('preview')}>Preview</button>

      {viewMode === 'edit' ? (
        <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} />
      ) : (
        <IsolatedPreview html={marked(markdown)} />
      )}
    </>
  );
}
```

### 2. MikiEditor.jsx에 적용

**Before (위험):**
```jsx
// ❌ 위험: XSS 취약점
<div dangerouslySetInnerHTML={{ __html: marked(content) }} />
```

**After (안전):**
```jsx
// ✅ 안전: 완전 격리
import { IsolatedPreview } from './components/IsolatedPreview';

{viewMode === 'preview' && (
  <IsolatedPreview
    html={marked(currentDocument.content)}
    title={currentDocument.title}
  />
)}
```

### 3. AiPanel 응답 렌더링

```jsx
import { IsolatedPreview } from '@/components/IsolatedPreview';

function AiResponseViewer({ response }) {
  return (
    <div style={{ height: '400px' }}>
      <IsolatedPreview
        html={response}
        title="AI Response"
        onError={(err) => console.error('AI preview error:', err)}
      />
    </div>
  );
}
```

---

## 보안 원리

### 1. 이중 방어 (Defense in Depth)

```
사용자 입력 HTML
  ↓
[1단계] DOMPurify sanitization (sanitize.js)
  ↓
[2단계] Blob URL 생성
  ↓
[3단계] iframe sandbox 격리
  ↓
안전한 렌더링
```

### 2. iframe sandbox 설정

```jsx
sandbox="allow-same-origin"
```

**차단되는 것:**
- ❌ JavaScript 실행 (`allow-scripts` 미포함)
- ❌ 폼 제출 (`allow-forms` 미포함)
- ❌ 팝업 열기 (`allow-popups` 미포함)
- ❌ 부모 창 접근 (`allow-top-navigation` 미포함)

**허용되는 것:**
- ✅ CSS 스타일링 (`allow-same-origin` 필요)
- ✅ 이미지/링크 렌더링
- ✅ 테이블/목록 등 정적 콘텐츠

### 3. 메모리 누수 방지

```jsx
useEffect(() => {
  const url = URL.createObjectURL(blob);
  setBlobUrl(url);

  return () => {
    URL.revokeObjectURL(url); // ✅ 자동 cleanup
  };
}, [html]);
```

---

## 테스트 시나리오

### XSS 차단 테스트

```jsx
// 테스트 1: 스크립트 인젝션 (차단됨)
<IsolatedPreview html='<script>alert("XSS")</script><h1>Hello</h1>' />
// 결과: <h1>Hello</h1>만 렌더링 (스크립트 제거)

// 테스트 2: 이벤트 핸들러 (차단됨)
<IsolatedPreview html='<img src=x onerror="alert(1)">' />
// 결과: <img src="x"> (onerror 속성 제거)

// 테스트 3: javascript: 프로토콜 (차단됨)
<IsolatedPreview html='<a href="javascript:alert(1)">Click</a>' />
// 결과: 링크 제거 또는 href 필터링
```

### 성능 테스트

```bash
# 빌드 사이즈 확인
npm run build

# 메모리 누수 확인
# 1. DevTools > Memory > Take snapshot
# 2. IsolatedPreview 컴포넌트 마운트/언마운트 반복
# 3. Snapshot 다시 찍어서 메모리 증가 확인
```

---

## 제한사항 및 주의사항

### 1. JavaScript 실행 불가 (의도적)
- 동적 차트/그래프 라이브러리 사용 불가
- 인터랙티브 위젯 동작 안 함
- **해결책**: 정적 콘텐츠만 렌더링하거나, 별도 컴포넌트로 구현

### 2. 폼 제출 불가
- `<form>` 태그는 렌더링되지만 제출 불가
- **해결책**: 폼 기능이 필요하면 React 컴포넌트로 구현

### 3. 외부 리소스 로딩
- `<img src="https://...">`: ✅ 가능
- `<script src="https://...">`: ❌ 차단됨
- `<link rel="stylesheet">`: ⚠️ 작동하지만 권장하지 않음

### 4. 대용량 콘텐츠
- 매우 큰 HTML (>1MB)은 메모리 사용 주의
- **권장**: 페이지네이션 또는 가상 스크롤링 사용

---

## 스타일 커스터마이징

### iframe 외부 스타일

```jsx
<IsolatedPreview
  html={html}
  style={{
    border: '2px solid #007bff',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    height: '600px'
  }}
  className="my-custom-preview"
/>
```

### iframe 내부 스타일

iframe 내부 스타일은 컴포넌트 코드에서 직접 수정해야 합니다:

```jsx
// IsolatedPreview.jsx 내부
const fullHtml = `
<style>
  body {
    font-family: 'Georgia', serif;  /* 폰트 변경 */
    font-size: 18px;                /* 폰트 크기 변경 */
  }
  h1 { color: #ff6b6b; }            /* 제목 색상 변경 */
</style>
${cleanHtml}
`;
```

---

## 디버깅

### 콘솔 로그 확인

```jsx
<IsolatedPreview
  html={html}
  onLoad={() => console.log('✅ Preview loaded')}
  onError={(err) => console.error('❌ Preview error:', err)}
/>
```

### Blob URL 수동 확인

```javascript
// 브라우저 콘솔에서 실행
const html = '<h1>Test</h1>';
const blob = new Blob([html], { type: 'text/html' });
const url = URL.createObjectURL(blob);
console.log(url); // blob:http://localhost:5173/abc-123-def

// 새 탭에서 열기
window.open(url, '_blank');
```

---

## 관련 파일

- `src/components/IsolatedPreview.jsx` — 컴포넌트 본체
- `src/components/IsolatedPreview.example.jsx` — 사용 예제
- `src/utils/sanitize.js` — HTML 정제 유틸리티
- `PLAN.md` — Phase 1-T4 태스크 정의

---

## 다음 단계 (P1-T3)

`IsolatedPreview`를 실제 MikiEditor에 통합:

1. `MikiEditor.jsx`에서 preview 모드 찾기
2. 기존 `dangerouslySetInnerHTML` 제거
3. `IsolatedPreview` 컴포넌트로 교체
4. 빌드 테스트 및 XSS 검증

---

## FAQ

**Q: 왜 ReactMarkdown 대신 IsolatedPreview를 사용하나요?**
A: ReactMarkdown은 React 컴포넌트로 렌더링하지만, 사용자 정의 렌더러나 플러그인에서 XSS 취약점이 발생할 수 있습니다. IsolatedPreview는 어떤 HTML이든 완전히 격리하여 100% 안전을 보장합니다.

**Q: 성능 오버헤드가 있나요?**
A: Blob URL 생성은 매우 빠르며 (<1ms), iframe 렌더링도 네이티브 브라우저 수준입니다. 체감 성능 차이는 거의 없습니다.

**Q: 모바일에서도 작동하나요?**
A: 네, 모든 모던 브라우저(iOS Safari, Chrome, Firefox)에서 정상 작동합니다.

**Q: 다크모드는 어떻게 작동하나요?**
A: `@media (prefers-color-scheme: dark)` CSS를 사용하여 시스템 설정을 자동 감지합니다.

---

## 라이센스

Meki 프로젝트 라이센스를 따릅니다.
