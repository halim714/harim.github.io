import { createLogger } from '../utils/logger';

const logger = createLogger('queryClient');
import { QueryClient } from '@tanstack/react-query';

// QueryClient 설정 - React Query 완전 해방을 위한 극대화된 최적화
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🎯 Phase C: 캐시 시간 무한대에 가깝게 설정 - 완전한 리페치 제로화
      staleTime: Infinity, // 무한대 - 데이터 절대 stale되지 않음
      cacheTime: Infinity, // 무한대 - 메모리에서 절대 제거되지 않음
      
      // 🎯 Phase C: 모든 자동 리페치 완전 차단 - 종합적 접근
      refetchOnWindowFocus: false, // 윈도우 포커스 시 리페치 차단
      refetchOnReconnect: false, // 네트워크 재연결 시 리페치 차단
      refetchOnMount: false, // 마운트 시 리페치 차단
      refetchInterval: false, // 주기적 리페치 완전 차단
      refetchIntervalInBackground: false, // 백그라운드 리페치 차단
      
      // 🎯 추가 차단: React Query 내부 자동 리페치 메커니즘 무력화
      retry: false, // 재시도 완전 차단
      retryOnMount: false, // 마운트 시 재시도 차단
      
      // 🎯 Phase C: Optimistic Update 완전 의존 정책
      networkMode: 'offlineFirst', // 오프라인 우선 - 캐시 의존성 극대화
      
      // 🎯 브라우저 이벤트 기반 리페치 완전 차단
      suspense: false, // Suspense 기반 리페치 차단
      useErrorBoundary: false, // ErrorBoundary 기반 리페치 차단
      
      // 🎯 수동 제어만 허용
      enabled: true, // 쿼리 자체는 활성화하되 자동 실행만 차단
      keepPreviousData: true, // 이전 데이터 유지로 깜빡임 방지
    },
    
    mutations: {
      // 뮤테이션 네트워크 모드
      networkMode: 'offlineFirst',
      
      // 뮤테이션 재시도 설정
      retry: (failureCount, error) => {
        // 네트워크 오류인 경우만 재시도
        if (error?.name === 'NetworkError' || error?.code === 'NETWORK_ERROR') {
          return failureCount < 2;
        }
        return false;
      },
      
      // 뮤테이션 재시도 지연
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

// 쿼리 키 팩토리 - 일관된 쿼리 키 관리
export const queryKeys = {
  // 문서 관련 쿼리 키
  documents: {
    all: ['documents'],
    lists: () => [...queryKeys.documents.all, 'list'],
    list: (filters) => [...queryKeys.documents.lists(), { filters }],
    details: () => [...queryKeys.documents.all, 'detail'],
    detail: (id) => [...queryKeys.documents.details(), id],
    search: (query) => [...queryKeys.documents.all, 'search', query],
  },
  
  // 서버 상태 관련
  server: {
    all: ['server'],
    status: () => [...queryKeys.server.all, 'status'],
    health: () => [...queryKeys.server.all, 'health'],
  },
  
  // 동기화 관련
  sync: {
    all: ['sync'],
    queue: () => [...queryKeys.sync.all, 'queue'],
    status: () => [...queryKeys.sync.all, 'status'],
  },
};

// 오프라인 상태 감지
export const isOnline = () => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

// 네트워크 상태 변경 이벤트 리스너 - 완전 차단 모드
export const setupNetworkListeners = (queryClient) => {
  if (typeof window === 'undefined') return;
  
  // 🎯 React Query 완전 해방: 모든 네트워크 이벤트 리스너 차단
  logger.info('🚫 네트워크 이벤트 리스너 차단됨 - React Query 완전 해방 모드');
  
  // 기존 이벤트 리스너 완전 차단
  const handleOnline = () => {
    logger.info('🌐 네트워크 연결됨 - 하지만 리페치 차단됨 (해방 모드)');
    // 🎯 완전 차단: queryClient.resumePausedMutations() 호출하지 않음
    // 🎯 완전 차단: queryClient.invalidateQueries() 호출하지 않음
  };
  
  const handleOffline = () => {
    logger.info('📴 네트워크 연결 끊김 - 오프라인 모드 (리페치 없음)');
  };
  
  // 🎯 이벤트 리스너 등록하지 않음 - 완전 차단
  // window.addEventListener('online', handleOnline);
  // window.addEventListener('offline', handleOffline);
  
  // cleanup 함수도 불필요 (등록된 리스너가 없으므로)
  return () => {
    logger.info('🚫 네트워크 이벤트 리스너 정리 - 등록된 리스너 없음');
  };
};

// 에러 처리 유틸리티
export const handleQueryError = (error, context = '') => {
  logger.error(`Query Error ${context}:`, error);
  
  // 네트워크 오류
  if (error?.name === 'NetworkError' || !isOnline()) {
    return {
      type: 'network',
      message: '네트워크 연결을 확인해주세요. 오프라인 상태에서도 편집은 계속 가능합니다.',
      canRetry: true,
    };
  }
  
  // 서버 오류
  if (error?.status >= 500) {
    return {
      type: 'server',
      message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      canRetry: true,
    };
  }
  
  // 클라이언트 오류
  if (error?.status >= 400 && error?.status < 500) {
    return {
      type: 'client',
      message: error?.message || '요청을 처리할 수 없습니다.',
      canRetry: false,
    };
  }
  
  // 기타 오류
  return {
    type: 'unknown',
    message: '알 수 없는 오류가 발생했습니다.',
    canRetry: false,
  };
};

// 로그아웃 시 모든 문서 캐시 제거 — 계정 전환 시 이전 계정 문서가 보이는 버그 방지
if (typeof window !== 'undefined') {
  window.addEventListener('meki:logout', () => {
    queryClient.removeQueries();
  });
}

export default queryClient;