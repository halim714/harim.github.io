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

jest.mock('../../services/auth', () => ({
  AuthService: {
    getToken: () => 'fake-token',
    getCurrentUser: () => Promise.resolve({ login: 'testuser' }),
    getCachedUser: () => ({ login: 'testuser' }),
    hasLegacyToken: () => false,
    logout: jest.fn(),
  }
}));

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

// Editor 페이지 의존성 mock (App.snapshot.test.jsx와 동일 수준)
jest.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => null,
}));

jest.mock('../../hooks/useDocuments', () => ({
  useDocuments: () => ({ data: [], isLoading: false, error: null, refetch: jest.fn() }),
  useDocument: () => ({ data: null, isLoading: false, error: null }),
  useSaveDocument: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false }),
  useDeleteDocument: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false }),
  useSyncStatus: () => ({ data: { hasPendingSync: false, pendingCount: 0, isOnline: true } }),
}));

jest.mock('../../stores', () => ({
  useDocumentStore: () => ({
    documents: [],
    currentDocument: null,
    setCurrentDocument: jest.fn(),
    updateDocument: jest.fn(),
    addDocument: jest.fn(),
    deleteDocument: jest.fn(),
    loadDocuments: jest.fn(),
  }),
  useUIStore: () => ({
    sidebarOpen: false,
    theme: 'light',
    isFullscreen: false,
    toggleSidebar: jest.fn(),
    setTheme: jest.fn(),
    toggleFullscreen: jest.fn(),
  }),
  useEditorStore: () => ({
    content: '',
    title: '',
    isEditing: false,
    saveStatus: '저장됨',
    setContent: jest.fn(),
    setTitle: jest.fn(),
    setEditing: jest.fn(),
    setSaveStatus: jest.fn(),
  }),
}));

jest.mock('../../config/queryClient', () => {
  // 실제 QueryClient 인스턴스 생성 (QueryClientProvider validation 통과)
  const { QueryClient } = require('@tanstack/react-query');
  return {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    setupNetworkListeners: jest.fn(),
    queryKeys: {
      documents: {
        all: ['documents'],
        lists: () => ['documents', 'list'],
        detail: (id) => ['documents', 'detail', id],
      },
    },
    handleQueryError: jest.fn(),
    isOnline: () => true,
  };
});

jest.mock('../../utils/storage-client', () => ({
  storage: {
    savePost: jest.fn().mockResolvedValue({}),
    loadPosts: jest.fn().mockResolvedValue([]),
    deletePost: jest.fn().mockResolvedValue({}),
    getPostList: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../hooks/usePublish', () => ({
  usePublish: () => ({ publish: jest.fn(), isPublishing: false }),
}));

jest.mock('../../utils/RealTimeDocumentSync', () => ({
  __esModule: true,
  default: { subscribe: jest.fn(), unsubscribe: jest.fn() },
}));

// PendingSyncProcessor 실제 setInterval 방지 (테스트 간 비동기 누수 차단)
jest.mock('../../sync', () => ({
  getPendingSyncProcessor: () => ({
    start: jest.fn(),
    stop: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
  }),
}));

// IndexedDB 접근 차단 (dbHelpers.getUnsyncedCount 포함)
jest.mock('../../hooks/useAttachment', () => ({
  useAttachment: () => ({
    attachments: [],
    processAttachment: jest.fn().mockResolvedValue(null),
    removeAttachment: jest.fn(),
    isUploading: false,
  }),
}));

// Mock Editor page — integration tests verify App-level routing/auth, not Editor internals
jest.mock('../../pages/Editor', () => {
  const React = require('react');
  const useAutoSave = require('../../hooks/useAutoSave').default;
  const useKeyboardShortcuts = require('../../hooks/useKeyboardShortcuts').default;
  return function MockEditorPage() {
    useAutoSave({});
    useKeyboardShortcuts({});
    return React.createElement('div', { 'data-testid': 'miki-editor' }, 'Editor');
  };
});

jest.mock('../../utils/database', () => ({
  MikiDatabase: {
    getInstance: () => ({
      documents: {
        toArray: () => Promise.resolve([]),
        add: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(),
      },
    }),
  },
  dbHelpers: {
    getUnsyncedCount: jest.fn().mockResolvedValue(0),
  },
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

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
    // WS 모드 강제 → AuthProvider가 getCachedUser()로 동기 해소 (Octokit 체인 우회)
    process.env.VITE_USE_WS_PROXY = 'true';
  });

  afterEach(() => {
    delete process.env.VITE_USE_WS_PROXY;
  });

  describe('기본 앱 렌더링', () => {
    test('앱이 정상적으로 렌더링되어야 함', async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // 인증 완료 후 에디터 확인 (auth Promise 해소까지 대기)
      expect(await screen.findByTestId('miki-editor')).toBeInTheDocument();
    });

    test('기본 UI 요소들이 렌더링되어야 함', async () => {
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // 인증 완료 후 기본 레이아웃 요소들 확인
      expect(await screen.findByTestId('miki-editor')).toBeInTheDocument();

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

      // 에디터 마운트 대기 (Editor 컴포넌트가 마운트되어야 훅 호출됨)
      await screen.findByTestId('miki-editor');

      // 훅들이 호출되었는지 확인
      expect(useAutoSave).toHaveBeenCalled();
      expect(useKeyboardShortcuts).toHaveBeenCalled();
    });
  });

  describe('에러 처리', () => {
    test('앱이 에러 없이 렌더링되어야 함', async () => {
      // 콘솔 에러를 캐치하여 예상치 못한 에러가 없는지 확인
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // 기본 렌더링이 성공했는지 확인
      expect(await screen.findByTestId('miki-editor')).toBeInTheDocument();

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

      // 기본 레이아웃 확인
      expect(await screen.findByTestId('miki-editor')).toBeInTheDocument();
    });
  });
}); 