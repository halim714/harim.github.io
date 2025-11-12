import { renderHook, act } from '@testing-library/react';

import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let mockOnSave;
  let mockOnNewDocument;
  let mockOnSearch;
  let mockOnToggleFullscreen;
  let mockOnFocusEditor;
  let mockOnFocusSearch;

  beforeEach(() => {
    mockOnSave = jest.fn();
    mockOnNewDocument = jest.fn();
    mockOnSearch = jest.fn();
    mockOnToggleFullscreen = jest.fn();
    mockOnFocusEditor = jest.fn();
    mockOnFocusSearch = jest.fn();

    // 이벤트 리스너 스파이 설정
    jest.spyOn(document, 'addEventListener');
    jest.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('훅 초기화', () => {
    test('이벤트 리스너가 등록되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onSave: mockOnSave,
        onNewDocument: mockOnNewDocument,
        onSearch: mockOnSearch,
        onToggleFullscreen: mockOnToggleFullscreen,
        onFocusEditor: mockOnFocusEditor,
        onFocusSearch: mockOnFocusSearch
      }));

      expect(document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    test('언마운트 시 이벤트 리스너가 제거되어야 함', () => {
      const { unmount } = renderHook(() => useKeyboardShortcuts({
        onSave: mockOnSave
      }));

      unmount();

      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    test('단축키 정보를 반환해야 함', () => {
      const { result } = renderHook(() => useKeyboardShortcuts({
        onSave: mockOnSave
      }));

      expect(result.current.shortcuts).toEqual({
        save: { key: 'Ctrl+S', description: '문서 저장' },
        newDocument: { key: 'Ctrl+N', description: '새 문서 작성' },
        search: { key: 'Ctrl+F', description: '문서 검색' },
        toggleFullscreen: { key: 'Ctrl+Enter', description: '전체화면 토글' },
        focusEditor: { key: 'Ctrl+E', description: '에디터 포커스' },
        focusSearch: { key: 'Ctrl+K', description: '검색창 포커스' },
        exitFullscreen: { key: 'ESC', description: '전체화면 나가기' }
      });
    });
  });

  describe('Ctrl 키 조합', () => {
    test('Ctrl+S로 저장 함수가 호출되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onSave: mockOnSave
      }));

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnSave).toHaveBeenCalled();
    });

    test('Ctrl+N으로 새 문서 함수가 호출되어야 함 (입력 필드가 아닐 때)', () => {
      renderHook(() => useKeyboardShortcuts({
        onNewDocument: mockOnNewDocument
      }));

      const event = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnNewDocument).toHaveBeenCalled();
    });

    test('Ctrl+F로 검색 함수가 호출되어야 함 (입력 필드가 아닐 때)', () => {
      renderHook(() => useKeyboardShortcuts({
        onSearch: mockOnSearch
      }));

      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnSearch).toHaveBeenCalled();
    });

    test('Ctrl+Enter로 전체화면 토글 함수가 호출되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onToggleFullscreen: mockOnToggleFullscreen
      }));

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnToggleFullscreen).toHaveBeenCalled();
    });

    test('Ctrl+E로 에디터 포커스 함수가 호출되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onFocusEditor: mockOnFocusEditor
      }));

      const event = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnFocusEditor).toHaveBeenCalled();
    });

    test('Ctrl+K로 검색 포커스 함수가 호출되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onFocusSearch: mockOnFocusSearch
      }));

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnFocusSearch).toHaveBeenCalled();
    });
  });

  describe('Cmd 키 조합 (Mac)', () => {
    test('Cmd+S로 저장 함수가 호출되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onSave: mockOnSave
      }));

      const event = new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  describe('ESC 키', () => {
    test('ESC 키로 전체화면 토글 함수가 호출되어야 함', () => {
      // 전체화면 상태 모킹
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.body,
        writable: true
      });

      renderHook(() => useKeyboardShortcuts({
        onToggleFullscreen: mockOnToggleFullscreen
      }));

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnToggleFullscreen).toHaveBeenCalled();
    });

    test('전체화면이 아닐 때 ESC 키는 무시되어야 함', () => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        writable: true
      });

      renderHook(() => useKeyboardShortcuts({
        onToggleFullscreen: mockOnToggleFullscreen
      }));

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnToggleFullscreen).not.toHaveBeenCalled();
    });
  });

  describe('입력 필드에서의 동작', () => {
    test('INPUT 요소에서 Ctrl+N이 무시되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onNewDocument: mockOnNewDocument
      }));

      const inputElement = document.createElement('input');
      document.body.appendChild(inputElement);

      const event = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        bubbles: true
      });

      Object.defineProperty(event, 'target', {
        value: inputElement,
        enumerable: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnNewDocument).not.toHaveBeenCalled();

      document.body.removeChild(inputElement);
    });

    test('TEXTAREA 요소에서 Ctrl+F가 무시되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onSearch: mockOnSearch
      }));

      const textareaElement = document.createElement('textarea');
      document.body.appendChild(textareaElement);

      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true
      });

      Object.defineProperty(event, 'target', {
        value: textareaElement,
        enumerable: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnSearch).not.toHaveBeenCalled();

      document.body.removeChild(textareaElement);
    });

    test('contentEditable 요소에서 Ctrl+Enter가 무시되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onToggleFullscreen: mockOnToggleFullscreen
      }));

      const editableElement = document.createElement('div');
      editableElement.contentEditable = 'true';
      document.body.appendChild(editableElement);

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true
      });

      Object.defineProperty(event, 'target', {
        value: editableElement,
        enumerable: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnToggleFullscreen).not.toHaveBeenCalled();

      document.body.removeChild(editableElement);
    });

    test('입력 필드에서도 Ctrl+S는 작동해야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onSave: mockOnSave
      }));

      const inputElement = document.createElement('input');
      document.body.appendChild(inputElement);

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });

      Object.defineProperty(event, 'target', {
        value: inputElement,
        enumerable: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnSave).toHaveBeenCalled();

      document.body.removeChild(inputElement);
    });
  });

  describe('비활성화 상태', () => {
    test('disabled가 true일 때 모든 단축키가 무시되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onSave: mockOnSave,
        onNewDocument: mockOnNewDocument,
        onSearch: mockOnSearch,
        disabled: true
      }));

      // Ctrl+S 테스트
      const saveEvent = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(saveEvent);
      });

      expect(mockOnSave).not.toHaveBeenCalled();

      // Ctrl+N 테스트
      const newEvent = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(newEvent);
      });

      expect(mockOnNewDocument).not.toHaveBeenCalled();
    });
  });

  describe('이벤트 preventDefault', () => {
    test('단축키 이벤트에서 preventDefault가 호출되어야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onSave: mockOnSave
      }));

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });

      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      act(() => {
        document.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('대소문자 구분 없음', () => {
    test('대문자 키도 정상 작동해야 함', () => {
      renderHook(() => useKeyboardShortcuts({
        onSave: mockOnSave
      }));

      const event = new KeyboardEvent('keydown', {
        key: 'S', // 대문자
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  describe('콜백 함수 변경', () => {
    test('콜백 함수가 변경되면 새로운 함수가 호출되어야 함', () => {
      const newMockOnSave = jest.fn();

      const { rerender } = renderHook(
        ({ onSave }) => useKeyboardShortcuts({ onSave }),
        { initialProps: { onSave: mockOnSave } }
      );

      // 첫 번째 콜백으로 테스트
      const event1 = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event1);
      });

      expect(mockOnSave).toHaveBeenCalled();
      expect(newMockOnSave).not.toHaveBeenCalled();

      // 콜백 변경
      rerender({ onSave: newMockOnSave });

      // 새로운 콜백으로 테스트
      const event2 = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true
      });

      act(() => {
        document.dispatchEvent(event2);
      });

      expect(newMockOnSave).toHaveBeenCalled();
    });
  });
}); 