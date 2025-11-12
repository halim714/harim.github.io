import { render } from '@testing-library/react';

import '@testing-library/jest-dom';
import App from '../App';

// Mock TanStack Query
jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn().mockImplementation(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
    removeQueries: jest.fn(),
    cancelQueries: jest.fn(),
    resumePausedMutations: jest.fn(),
  })),
  QueryClientProvider: ({ children }) => children,
  useQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useMutation: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    error: null,
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  }),
}));

jest.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => null,
}));

// Mock config modules
jest.mock('../config/queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  },
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
}));

jest.mock('../config/featureFlags', () => ({
  FEATURE_FLAGS: {},
  isFeatureEnabled: () => true,
}));

// Mock hooks
jest.mock('../hooks/useDocuments', () => ({
  useDocuments: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useDocument: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
  useSaveDocument: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
  }),
  useDeleteDocument: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
  }),
  useSyncStatus: () => ({
    data: { hasPendingSync: false, pendingCount: 0, isOnline: true },
  }),
}));

// Mock dependencies that might cause issues in test environment
jest.mock('../utils/database', () => ({
  MikiDatabase: {
    getInstance: () => ({
      documents: {
        toArray: () => Promise.resolve([]),
        add: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve()
      }
    })
  }
}));

jest.mock('../stores', () => ({
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
  })
}));

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('App Component Snapshots', () => {
  beforeEach(() => {
    // Reset any mocks before each test
    jest.clearAllMocks();
  });

  test('App 컴포넌트 기본 렌더링 스냅샷', () => {
    const { asFragment } = render(<App />);
    expect(asFragment()).toMatchSnapshot();
  });

  test('App 컴포넌트 DOM 구조 검증', () => {
    const { container } = render(<App />);
    
    // 실제 App.jsx 구조에 맞는 핵심 UI 요소들이 존재하는지 확인
    expect(container.querySelector('header')).toBeInTheDocument();
    expect(container.querySelector('.flex-grow')).toBeInTheDocument();
    
    // 스냅샷으로 전체 구조 보존
    expect(container.firstChild).toMatchSnapshot('app-dom-structure');
  });

  test('반응형 레이아웃 스냅샷 (모바일)', () => {
    // 모바일 뷰포트 시뮬레이션
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query.includes('max-width: 768px'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { asFragment } = render(<App />);
    expect(asFragment()).toMatchSnapshot('app-mobile-layout');
  });

  test('반응형 레이아웃 스냅샷 (데스크톱)', () => {
    // 데스크톱 뷰포트 시뮬레이션
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });
    
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { asFragment } = render(<App />);
    expect(asFragment()).toMatchSnapshot('app-desktop-layout');
  });
});

describe('Critical UI Components Snapshots', () => {
  test('MikiEditor 컴포넌트 스냅샷', async () => {
    // MikiEditor가 별도로 테스트 가능한 경우
    const MikiEditor = (await import('../MikiEditor')).default;
    const { asFragment } = render(<MikiEditor />);
    expect(asFragment()).toMatchSnapshot('miki-editor-component');
  });

  test('AiPanel 컴포넌트 스냅샷', async () => {
    // AiPanel이 별도로 테스트 가능한 경우
    const AiPanel = (await import('../AiPanel')).default;
    const { asFragment } = render(<AiPanel />);
    expect(asFragment()).toMatchSnapshot('ai-panel-component');
  });
}); 