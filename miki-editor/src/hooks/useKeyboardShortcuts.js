import { useEffect, useCallback } from 'react';

const useKeyboardShortcuts = ({
  onSave,
  onNewDocument,
  onSearch,
  onToggleFullscreen,
  onFocusEditor,
  onFocusSearch,
  onToggleHelp,
  disabled = false
}) => {
  const handleKeyDown = useCallback((event) => {
    // 단축키가 비활성화되어 있거나 입력 필드에서 타이핑 중일 때는 무시
    if (disabled) return;
    
    // 입력 필드, 텍스트 영역, contenteditable에서는 일부 단축키만 허용
    const isInputElement = event.target.tagName === 'INPUT' || 
                          event.target.tagName === 'TEXTAREA' || 
                          event.target.contentEditable === 'true';

    // Ctrl/Cmd 키 조합 처리
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    
    if (isCtrlOrCmd) {
      switch (event.key.toLowerCase()) {
        case 's':
          // Ctrl+S: 저장
          event.preventDefault();
          onSave?.();
          break;
          
        case 'n':
          // Ctrl+N: 새 문서 (입력 필드가 아닐 때만)
          if (!isInputElement) {
            event.preventDefault();
            onNewDocument?.();
          }
          break;
          
        case 'f':
          // Ctrl+F: 검색 (입력 필드가 아닐 때만)
          if (!isInputElement) {
            event.preventDefault();
            onSearch?.();
          }
          break;
          
        case 'enter':
          // Ctrl+Enter: 전체화면 토글 (입력 필드가 아닐 때만)
          if (!isInputElement) {
            event.preventDefault();
            onToggleFullscreen?.();
          }
          break;
          
        case 'e':
          // Ctrl+E: 에디터 포커스 (입력 필드가 아닐 때만)
          if (!isInputElement) {
            event.preventDefault();
            onFocusEditor?.();
          }
          break;
          
        case 'k':
          // Ctrl+K: 검색 포커스 (입력 필드가 아닐 때만)
          if (!isInputElement) {
            event.preventDefault();
            onFocusSearch?.();
          }
          break;
      }
    }

    // 물음표(Shift + /) 눌렀을 때: 단축키 도움말 토글
    // 일부 브라우저는 '?' 대신 '/' + shift 로만 전달되므로 둘 다 처리
    if ((event.key === '?' || (event.key === '/' && event.shiftKey)) && !isCtrlOrCmd) {
      // 입력 필드에서는 열지 않음 (의도치 않은 입력 방지)
      if (!isInputElement) {
        event.preventDefault();
        onToggleHelp?.();
      }
    }
    
    // ESC 키 처리
    if (event.key === 'Escape') {
      // 전체화면 모드에서 ESC로 나가기
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        onToggleFullscreen?.();
      }
    }
  }, [
    onSave, 
    onNewDocument, 
    onSearch, 
    onToggleFullscreen, 
    onFocusEditor, 
    onFocusSearch, 
    onToggleHelp,
    disabled
  ]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // 단축키 도움말 정보 반환
  const shortcuts = {
    save: { key: 'Ctrl+S', description: '문서 저장' },
    newDocument: { key: 'Ctrl+N', description: '새 문서 작성' },
    search: { key: 'Ctrl+F', description: '문서 검색' },
    toggleFullscreen: { key: 'Ctrl+Enter', description: '전체화면 토글' },
    focusEditor: { key: 'Ctrl+E', description: '에디터 포커스' },
    focusSearch: { key: 'Ctrl+K', description: '검색창 포커스' },
    exitFullscreen: { key: 'ESC', description: '전체화면 나가기' },
  };

  return { shortcuts };
};

export default useKeyboardShortcuts; 