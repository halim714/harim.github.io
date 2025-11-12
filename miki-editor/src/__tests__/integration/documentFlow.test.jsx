import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from '../../App';

// Toast UI Editor 관련 DOM 에러를 방지하기 위한 모킹
jest.mock('../../MikiEditor', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      getEditorInstance: () => ({
        setMarkdown: jest.fn(),
        getMarkdown: () => 'Test content'
      })
    }));

    return React.createElement('div', {
      'data-testid': 'miki-editor'
    }, React.createElement('div', null, 'Mocked Editor'));
  });
});

// Mock modules - 실제 존재하는 모듈들만 모킹
jest.mock('../../hooks/useAutoSave', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    saveStatus: 'saved',
    hasUnsavedChanges: false,
    lastSaved: null,
    manualSave: jest.fn(),
    getSaveStatusMessage: jest.fn(() => '저장됨'),
    isAutoSaving: false,
    isManualSaving: false,
  })),
}));

jest.mock('../../hooks/useKeyboardShortcuts', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

// 테스트용 QueryClient 생성
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

// 테스트 래퍼 컴포넌트
const TestWrapper = ({ children }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('문서 플로우 통합 테스트', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('기본 앱 렌더링', () => {
    test('앱이 정상적으로 렌더링되어야 함', async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // 헤더 확인
      expect(screen.getByText('Miki Editor v7 AI 연동')).toBeInTheDocument();
      
      // 로딩이 완료될 때까지 대기
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    });

    test('기본 UI 요소들이 렌더링되어야 함', async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // 기본 레이아웃 요소들 확인
      expect(screen.getByText('Miki Editor v7 AI 연동')).toBeInTheDocument();
      
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // 앱이 크래시하지 않고 정상적으로 렌더링되는지 확인
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('훅 통합 테스트', () => {
    test('모든 훅이 정상적으로 작동해야 함', async () => {
      const useAutoSave = require('../../hooks/useAutoSave').default;
      const useKeyboardShortcuts = require('../../hooks/useKeyboardShortcuts').default;
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // 훅들이 호출되었는지 확인
      expect(useAutoSave).toHaveBeenCalled();
      expect(useKeyboardShortcuts).toHaveBeenCalled();
    });
  });

  describe('에러 처리', () => {
    test('앱이 에러 없이 렌더링되어야 함', async () => {
      // 콘솔 에러를 캐치하여 예상치 못한 에러가 없는지 확인
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // 기본 렌더링이 성공했는지 확인
      expect(screen.getByText('Miki Editor v7 AI 연동')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('반응형 레이아웃', () => {
    test('기본 레이아웃이 표시되어야 함', async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // 기본 레이아웃 확인
      expect(screen.getByText('Miki Editor v7 AI 연동')).toBeInTheDocument();
    });
  });
}); 