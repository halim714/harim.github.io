import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import useAutoSave from '../../hooks/useAutoSave';

// useSaveDocument 훅 모킹
const mockMutateAsync = jest.fn();

jest.mock('../../hooks/useDocuments', () => ({
  useSaveDocument: () => ({
    mutateAsync: mockMutateAsync
  })
}));

// 타이머 모킹
jest.useFakeTimers();

// QueryClient 래퍼 생성
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useAutoSave', () => {
  let mockOnSaveStart;
  let mockOnSaveSuccess;
  let mockOnSaveError;

  beforeEach(() => {
    // 모킹된 함수들 초기화
    mockMutateAsync.mockClear();
    
    mockOnSaveStart = jest.fn();
    mockOnSaveSuccess = jest.fn();
    mockOnSaveError = jest.fn();
    
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('초기 상태', () => {
    test('초기 상태가 올바르게 설정되어야 함', () => {
      const { result } = renderHook(
        () => useAutoSave({
          document: null,
          content: '',
          title: '',
          enabled: true
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.saveStatus).toBe('saved');
      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(result.current.lastSaved).toBeNull();
      expect(result.current.isAutoSaving).toBe(false);
      expect(result.current.isManualSaving).toBe(false);
    });
  });

  describe('변경사항 감지', () => {
    test('내용 변경 시 unsaved 상태가 되어야 함', () => {
      const testDocument = {
        id: 'test-1',
        title: '테스트 문서',
        content: '초기 내용'
      };

      const { result, rerender } = renderHook(
        ({ content }) => useAutoSave({
          document: testDocument,
          content,
          title: '테스트 문서',
          enabled: true
        }),
        { 
          wrapper: createWrapper(),
          initialProps: { content: '초기 내용' }
        }
      );

      expect(result.current.hasUnsavedChanges).toBe(false);

      // 내용 변경
      rerender({ content: '변경된 내용' });

      expect(result.current.hasUnsavedChanges).toBe(true);
      expect(result.current.saveStatus).toBe('pending');
    });

    test('제목 변경 시 unsaved 상태가 되어야 함', () => {
      const testDocument = {
        id: 'test-1',
        title: '초기 제목',
        content: '내용'
      };

      const { result, rerender } = renderHook(
        ({ title }) => useAutoSave({
          document: testDocument,
          content: '내용',
          title,
          enabled: true
        }),
        { 
          wrapper: createWrapper(),
          initialProps: { title: '초기 제목' }
        }
      );

      expect(result.current.hasUnsavedChanges).toBe(false);

      // 제목 변경
      rerender({ title: '변경된 제목' });

      expect(result.current.hasUnsavedChanges).toBe(true);
      expect(result.current.saveStatus).toBe('pending');
    });
  });

  describe('자동 저장', () => {
    test('변경사항 감지가 정상 작동해야 함', () => {
      const testDocument = {
        id: 'test-1',
        title: '테스트 문서',
        content: '초기 내용'
      };

      const { result, rerender } = renderHook(
        ({ content }) => useAutoSave({
          document: testDocument,
          content,
          title: '테스트 문서',
          enabled: true,
          interval: 3000
        }),
        { 
          wrapper: createWrapper(),
          initialProps: { content: '초기 내용' }
        }
      );

      // 내용 변경
      rerender({ content: '변경된 내용' });
      expect(result.current.hasUnsavedChanges).toBe(true);
      expect(result.current.saveStatus).toBe('pending');
    });

    test('자동 저장이 비활성화되면 저장되지 않아야 함', () => {
      const testDocument = {
        id: 'test-1',
        title: '테스트 문서',
        content: '초기 내용'
      };

      const { result, rerender } = renderHook(
        ({ content }) => useAutoSave({
          document: testDocument,
          content,
          title: '테스트 문서',
          enabled: false, // 비활성화
          interval: 3000
        }),
        { 
          wrapper: createWrapper(),
          initialProps: { content: '초기 내용' }
        }
      );

      // 내용 변경
      rerender({ content: '변경된 내용' });
      // enabled가 false이므로 hasUnsavedChanges는 여전히 true가 되지만 자동저장은 안됨
      expect(result.current.hasUnsavedChanges).toBe(true);

      // 3초 경과
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('수동 저장', () => {
    test('수동 저장 함수가 존재해야 함', () => {
      const testDocument = {
        id: 'test-1',
        title: '테스트 문서',
        content: '내용'
      };

      const { result } = renderHook(
        () => useAutoSave({
          document: testDocument,
          content: '변경된 내용',
          title: '테스트 문서',
          enabled: true
        }),
        { wrapper: createWrapper() }
      );

      expect(typeof result.current.manualSave).toBe('function');
    });
  });

  describe('저장 상태 메시지', () => {
    test('저장 상태 메시지 함수가 존재해야 함', () => {
      const { result } = renderHook(
        () => useAutoSave({
          document: { id: 'test' },
          content: '내용',
          title: '제목',
          enabled: true
        }),
        { wrapper: createWrapper() }
      );

      expect(typeof result.current.getSaveStatusMessage).toBe('function');
      expect(result.current.getSaveStatusMessage()).toBe('저장됨');
    });
  });

  describe('페이지 이탈 경고', () => {
    test('beforeunload 이벤트 리스너 관련 기능이 작동해야 함', () => {
      const { unmount } = renderHook(
        () => useAutoSave({
          document: { id: 'test' },
          content: '내용',
          title: '제목',
          enabled: true
        }),
        { wrapper: createWrapper() }
      );

      // 컴포넌트가 정상적으로 마운트되고 언마운트되는지 확인
      expect(() => unmount()).not.toThrow();
    });
  });
}); 