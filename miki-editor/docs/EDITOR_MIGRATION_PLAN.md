# Toast UI Editor 제거 및 대체 에디터 마이그레이션 아키텍처 분석

> **작성일**: 2026-01-17  
> **목적**: Toast UI Editor를 Meki에 최적화된 에디터로 교체  
> **원칙**: 기존 기능 100% 유지하며 에디터만 교체

---

## 1. 현재 Toast UI Editor 의존성 분석

### 1.1 직접 의존 파일

| 파일 | Toast UI 사용 | 역할 |
|------|--------------|------|
| **`MikiEditor.jsx`** | ✅ 핵심 | Toast UI Editor 래퍼 컴포넌트 (1748줄) |
| **`package.json`** | ✅ 의존성 | `@toast-ui/editor`, `@toast-ui/react-editor` |
| **`index.css`** | ⚠️ 스타일 | `.toastui-editor-*` 클래스 오버라이드 |

### 1.2 Toast UI API 사용 현황

#### A. 핵심 메서드 (27회 사용)

```javascript
// 1. 인스턴스 접근 (27회)
editorRef.current.getInstance()

// 2. 콘텐츠 조작
.getMarkdown()          // 현재 마크다운 가져오기
.setMarkdown(content)   // 마크다운 설정
.insertText(text)       // 텍스트 삽입
.replaceSelection(text) // 선택 영역 교체

// 3. 선택 영역 관리
.getSelection()         // 현재 선택 영역 가져오기
.setSelection(range)    // 선택 영역 설정
.moveCursorToEnd()      // 커서를 끝으로 이동

// 4. 명령 실행 (플로팅 툴바)
.exec('bold')           // 굵게
.exec('italic')         // 기울임
.exec('strike')         // 취소선
.exec('quote')          // 인용
.exec('bulletList')     // 순서 없는 목록
.exec('orderedList')    // 순서 있는 목록
.exec('taskList')       // 체크리스트
.exec('table')          // 표
.exec('image')          // 이미지
.exec('code')           // 인라인 코드
.exec('codeBlock')      // 코드 블록
.exec('link')           // 링크
```

#### B. 이벤트 리스너

```javascript
// DOM 이벤트 (직접 등록)
editorRoot.addEventListener('keydown', handleEditorKeyDown);
editorRoot.addEventListener('paste', handlePaste);
editorRoot.addEventListener('click', handleLinkClick);

// Toast UI 이벤트 (props)
onChange={(e) => { /* 콘텐츠 변경 */ }}
onLoad={() => { /* 에디터 로드 완료 */ }}
```

---

## 2. Meki 고유 기능 분석

### 2.1 AI 통합 기능

| 기능 | 구현 위치 | Toast UI 의존도 |
|------|----------|----------------|
| **AI 제안 팝오버** | `AiSuggestionPopover` | 🟢 독립적 (위치만 계산) |
| **AI 액션 적용** | `_applySingleActionToEditor` | 🔴 높음 (insertText, replaceSelection) |
| **선택 영역 전송** | `handleEditorActivity` | 🟡 중간 (getSelection) |

### 2.2 링크 생성 시스템

| 기능 | 구현 위치 | Toast UI 의존도 |
|------|----------|----------------|
| **링크 팝오버** | `LinkCreationPopover` | 🟢 독립적 (React 컴포넌트) |
| **문서 검색** | `DocumentSearchManager` | 🟢 독립적 |
| **링크 삽입** | `handleCreateLink` | 🔴 높음 (replaceSelection) |
| **드래그 선택** | `handleSelectionChange` | 🟡 중간 (getSelection) |

### 2.3 Undo/Redo 시스템

```javascript
// 독자적인 히스토리 관리
const [commandHistory, setCommandHistory] = useState([]);
const [historyPointer, setHistoryPointer] = useState(-1);

// Toast UI 의존
editorRef.current.getInstance().setMarkdown(lastEdit.before); // Undo
editorRef.current.getInstance().setMarkdown(nextEdit.after);  // Redo
```

**의존도**: 🔴 높음 (setMarkdown 필수)

### 2.4 플로팅 툴바

```javascript
// 12개 포맷팅 명령
<button onClick={() => editorRef.current?.getInstance()?.exec('bold')}>
```

**의존도**: 🔴 높음 (exec 메서드 필수)

---

## 3. 교체 가능한 에디터 후보 분석

### 3.1 후보군

| 에디터 | 장점 | 단점 | Meki 적합도 |
|--------|------|------|------------|
| **Lexical** | Meta 개발, 확장성 높음 | 러닝 커브 높음 | ⭐⭐⭐⭐⭐ |
| **Slate** | 완전 제어 가능 | 복잡한 구조 | ⭐⭐⭐⭐ |
| **ProseMirror** | 강력한 플러그인 시스템 | 러닝 커브 높음 | ⭐⭐⭐⭐ |
| **TipTap** | ProseMirror 기반, 사용 쉬움 | 커스터마이징 제한 | ⭐⭐⭐⭐⭐ |
| **CodeMirror 6** | 코드 에디터 최적화 | 마크다운 지원 약함 | ⭐⭐⭐ |
| **Monaco Editor** | VS Code 엔진 | 무거움, 마크다운 약함 | ⭐⭐ |

### 3.2 권장: **Lexical** 또는 **TipTap**

#### Lexical 선택 시
- ✅ Meta의 공식 지원
- ✅ React 네이티브 통합
- ✅ 플러그인 시스템 강력
- ✅ 마크다운 플러그인 공식 제공
- ❌ 초기 설정 복잡

#### TipTap 선택 시
- ✅ ProseMirror 기반 (안정성)
- ✅ React 컴포넌트 제공
- ✅ 마크다운 지원 우수
- ✅ 빠른 마이그레이션 가능
- ❌ 일부 고급 기능 제한

---

## 4. 마이그레이션 전략

### 4.1 Adapter 패턴 적용

```
┌─────────────────────────────────────────────────┐
│  MikiEditor.jsx (기존 인터페이스 유지)          │
├─────────────────────────────────────────────────┤
│  EditorAdapter (추상화 레이어)                  │
│  ┌───────────────────────────────────────────┐  │
│  │ - getMarkdown()                           │  │
│  │ - setMarkdown(content)                    │  │
│  │ - insertText(text)                        │  │
│  │ - replaceSelection(text)                  │  │
│  │ - getSelection()                          │  │
│  │ - setSelection(range)                     │  │
│  │ - exec(command)                           │  │
│  └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐       ┌──────────────┐        │
│  │ ToastUIImpl │  OR   │ LexicalImpl  │        │
│  └─────────────┘       └──────────────┘        │
└─────────────────────────────────────────────────┘
```

### 4.2 단계별 마이그레이션

| 단계 | 작업 | 위험도 | 예상 시간 |
|------|------|--------|----------|
| **Phase 0** | Adapter 인터페이스 설계 | 🟢 낮음 | 2시간 |
| **Phase 1** | ToastUI Adapter 구현 (기존 래핑) | 🟢 낮음 | 4시간 |
| **Phase 2** | 신규 에디터 Adapter 구현 | 🟡 중간 | 8시간 |
| **Phase 3** | Feature Flag로 전환 가능하게 | 🟢 낮음 | 2시간 |
| **Phase 4** | 기능 검증 및 테스트 | 🟡 중간 | 6시간 |
| **Phase 5** | Toast UI 의존성 제거 | 🟢 낮음 | 1시간 |

**총 예상 시간**: 23시간

---

## 5. 필수 구현 API 목록

### 5.1 콘텐츠 조작 (7개)

```typescript
interface EditorAdapter {
  // 읽기
  getMarkdown(): string;
  getHTML(): string;
  
  // 쓰기
  setMarkdown(content: string): void;
  insertText(text: string, position?: number): void;
  replaceSelection(text: string): void;
  
  // 선택
  getSelection(): { start: number, end: number, text: string };
  setSelection(start: number, end: number): void;
}
```

### 5.2 포맷팅 명령 (12개)

```typescript
interface EditorCommands {
  exec(command: 
    | 'bold' 
    | 'italic' 
    | 'strike' 
    | 'quote' 
    | 'bulletList' 
    | 'orderedList' 
    | 'taskList' 
    | 'table' 
    | 'image' 
    | 'code' 
    | 'codeBlock' 
    | 'link'
  ): void;
}
```

### 5.3 이벤트 (3개)

```typescript
interface EditorEvents {
  onChange(callback: (content: string) => void): void;
  onSelectionChange(callback: (selection: Selection) => void): void;
  onLoad(callback: () => void): void;
}
```

---

## 6. 위험 요소 및 대응

### 6.1 데이터 손실 위험

| 위험 | 대응 |
|------|------|
| 마크다운 파싱 차이 | 양방향 변환 테스트 필수 |
| 선택 영역 계산 차이 | 오프셋 기반 통일 |
| 포맷팅 명령 차이 | 명령어 매핑 테이블 작성 |

### 6.2 기능 손실 위험

| 기능 | Toast UI | 신규 에디터 | 대응 |
|------|----------|------------|------|
| 테이블 편집 | ✅ 내장 | ⚠️ 플러그인 | 플러그인 설치 |
| 이미지 업로드 | ✅ 내장 | ⚠️ 커스텀 | 직접 구현 |
| 코드 하이라이팅 | ✅ 플러그인 | ✅ 플러그인 | 플러그인 교체 |

---

## 7. 다음 단계

1. **에디터 선택 확정**: Lexical vs TipTap
2. **Adapter 인터페이스 설계 검토**
3. **PoC (Proof of Concept) 구현**
   - 기본 CRUD
   - AI 액션 적용
   - 링크 생성
4. **Feature Flag 구현**
5. **점진적 마이그레이션 실행**

---

**승인 후 다음 작업**: 
- [ ] 에디터 선택 확정
- [ ] Adapter 인터페이스 상세 설계
- [ ] PoC 구현 시작

