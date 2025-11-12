# 미키 에디터 v7 저장 기능 수정 계획서

## 📋 현재 문제 상황

### 🔍 진단 결과
- **저장 버튼 클릭 시 `manualSave` 함수가 호출되지 않음**
- **네트워크 탭에서 POST/PUT 요청 발생하지 않음**
- **IndexedDB에 문서 저장되지 않음**
- **에러 메시지도 표시되지 않음**

### 🎯 근본 원인
1. **저장 버튼 비활성화 조건 문제**
   ```javascript
   disabled={isLoadingDocuments || (!hasUnsavedChanges && !isManualSaving)}
   ```
   - `hasUnsavedChanges`가 `false`이면 저장 버튼 비활성화
   - 새 문서 생성 시나 기존 문서 로드 시 `hasUnsavedChanges = false`

2. **변경사항 감지 로직 문제**
   ```javascript
   // useAutoSave.js
   if (contentChanged || titleChanged) {
     setHasUnsavedChanges(true);  // 여기서만 true가 됨
   }
   ```
   - 사용자가 실제로 타이핑해야만 `hasUnsavedChanges`가 `true`
   - 새 문서나 로드된 문서는 저장 불가능

3. **초기 문서 상태 문제**
   ```javascript
   const createNewMemo = () => ({
     isEmpty: true,  // 빈 문서로 간주
     content: '',    // 빈 내용
   });
   ```

## 🔧 수정 계획 (옵션 2: 현재 구조 개선)

### 📌 Phase 1: 저장 버튼 활성화 조건 완화

#### 1.1 EditorPanel.jsx 수정
**목표**: 새 문서와 기존 문서 모두 저장 가능하도록 조건 완화

**현재**:
```javascript
disabled={isLoadingDocuments || (!hasUnsavedChanges && !isManualSaving)}
```

**수정 후**:
```javascript
disabled={isLoadingDocuments || isManualSaving || !currentDocument}
```

**변경 사항**:
- `hasUnsavedChanges` 조건 제거
- `currentDocument`가 존재하면 항상 저장 가능
- 수동 저장 중일 때만 비활성화

#### 1.2 저장 버튼 텍스트 동적 변경
```javascript
const getSaveButtonText = () => {
  if (isManualSaving) return '저장 중...';
  if (currentDocument?.isEmpty) return '문서 생성';
  if (hasUnsavedChanges) return '저장';
  return '저장';
};
```

### 📌 Phase 2: 변경사항 감지 로직 개선

#### 2.1 useAutoSave.js 수정
**목표**: 새 문서 생성과 문서 로드도 "저장 가능한 상태"로 인식

**추가할 로직**:
```javascript
// 새 문서 생성 시 저장 가능 상태로 설정
useEffect(() => {
  if (document?.isEmpty) {
    setHasUnsavedChanges(true);  // 새 문서는 저장 가능
  }
}, [document?.isEmpty]);

// 문서 로드 시에도 저장 가능 (제목이나 내용이 있으면)
useEffect(() => {
  if (document && (title || content)) {
    setHasUnsavedChanges(true);
  }
}, [document, title, content]);
```

#### 2.2 manualSave 함수 조건 완화
**현재**:
```javascript
const manualSave = useCallback(async () => {
  if (!document) return;  // 여기서 early return
  // ...
}, [document, content, title]);
```

**수정 후**:
```javascript
const manualSave = useCallback(async () => {
  // document가 없으면 새 문서 생성
  const documentToSave = document || {
    id: `temp-${Date.now()}`,
    title: title || '새 메모',
    content: content || '',
    isEmpty: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // 저장 로직 실행
  await saveMutation.mutateAsync(documentToSave);
}, [document, content, title, saveMutation]);
```

### 📌 Phase 3: 문서 생성 로직 개선

#### 3.1 App.jsx의 newPost 함수 수정
**목표**: 새 문서 생성 시 즉시 저장 가능한 상태로 설정

**현재**:
```javascript
const newPost = useCallback(() => {
  const newMemo = createNewMemo();
  setCurrentDocument(newMemo);
  setTitle(newMemo.title);
  setContent('');
}, [setCurrentDocument]);
```

**수정 후**:
```javascript
const newPost = useCallback(() => {
  const newMemo = createNewMemo();
  setCurrentDocument(newMemo);
  setTitle(newMemo.title);
  setContent('');
  
  // 새 문서 생성 알림
  setMessage({ 
    type: 'info', 
    text: '새 문서가 생성되었습니다. 저장 버튼을 눌러 저장하세요.' 
  });
}, [setCurrentDocument, setMessage]);
```

#### 3.2 createNewMemo 함수 개선
```javascript
const createNewMemo = () => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return {
    id: `memo_${timestamp}_${randomSuffix}`,
    title: '새 메모',
    content: '# 새 메모\n\n여기에 내용을 작성하세요.',  // 기본 내용 추가
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isEmpty: true,
    isNew: true  // 새 문서 플래그 추가
  };
};
```

### 📌 Phase 4: 저장 상태 표시 개선

#### 4.1 저장 상태 메시지 개선
```javascript
const getSaveStatusMessage = useCallback(() => {
  if (isManualSaving) return '저장 중...';
  if (isAutoSaving) return '자동 저장 중...';
  if (document?.isNew && !hasUnsavedChanges) return '새 문서 (저장 필요)';
  if (hasUnsavedChanges) return '변경됨';
  if (saveStatus === 'error') return '저장 실패';
  
  // 저장 완료 상태
  if (lastSaved) {
    const now = new Date();
    const diffMs = now - lastSaved;
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return '방금 저장됨';
    if (diffMinutes < 60) return `${diffMinutes}분 전 저장됨`;
    return lastSaved.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    }) + ' 저장됨';
  }
  
  return '저장됨';
}, [isManualSaving, isAutoSaving, document, hasUnsavedChanges, saveStatus, lastSaved]);
```

### 📌 Phase 5: 디버깅 로그 추가

#### 5.1 저장 과정 추적 로그
```javascript
// useAutoSave.js의 manualSave 함수에 추가
const manualSave = useCallback(async () => {
  logger.info('🔄 수동 저장 시작', {
    document: document?.id,
    title,
    content: content?.length,
    hasUnsavedChanges
  });
  
  try {
    // 저장 로직...
    logger.info('✅ 수동 저장 성공');
  } catch (error) {
    logger.error('❌ 수동 저장 실패:', error);
  }
}, []);
```

#### 5.2 버튼 클릭 추적 로그
```javascript
// EditorPanel.jsx의 저장 버튼에 추가
<button 
  onClick={() => {
    logger.info('💾 저장 버튼 클릭됨', {
      disabled: isLoadingDocuments || isManualSaving || !currentDocument,
      currentDocument: currentDocument?.id,
      hasUnsavedChanges,
      isManualSaving
    });
    onSavePost();
  }}
  // ...
>
```

## 🎯 예상 결과

### ✅ 수정 후 동작
1. **새 글 버튼 클릭** → 새 메모 생성 → **저장 버튼 활성화** ✅
2. **저장 버튼 클릭** → `manualSave` 함수 호출 → POST 요청 발생 ✅
3. **기존 문서 로드** → **저장 버튼 활성화** → 수정 후 저장 가능 ✅
4. **자동 저장** → 3초 후 자동으로 저장 ✅

### 📊 성공 지표
- [ ] 저장 버튼 클릭 시 브라우저 콘솔에 로그 출력
- [ ] 네트워크 탭에서 POST/PUT 요청 확인
- [ ] 서버 로그에서 저장 요청 확인
- [ ] IndexedDB에 문서 저장 확인
- [ ] 저장 상태 메시지 정상 표시

## 🚀 구현 순서

1. **Phase 1** → 저장 버튼 활성화 (즉시 효과)
2. **Phase 5** → 디버깅 로그 추가 (문제 추적)
3. **Phase 2** → 변경사항 감지 개선 (자동 저장)
4. **Phase 3** → 문서 생성 로직 개선 (UX 향상)
5. **Phase 4** → 상태 표시 개선 (사용자 피드백)

## 📝 테스트 시나리오

### 시나리오 1: 새 문서 생성 및 저장
1. 새 글 버튼 클릭
2. 저장 버튼이 활성화되는지 확인
3. 저장 버튼 클릭
4. 서버에 POST 요청 발생하는지 확인

### 시나리오 2: 기존 문서 수정 및 저장
1. 사이드바에서 기존 문서 클릭
2. 문서 로드 후 저장 버튼 상태 확인
3. 내용 수정
4. 저장 버튼 클릭하여 PUT 요청 확인

### 시나리오 3: 자동 저장
1. 새 문서 생성
2. 내용 입력
3. 3초 후 자동 저장 동작 확인

---

**작성일**: 2025-06-15  
**작성자**: AI Assistant  
**버전**: v1.0  
**상태**: 계획 수립 완료, 구현 대기 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 