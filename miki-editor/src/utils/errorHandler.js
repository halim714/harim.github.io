import { createLogger } from '../utils/logger';
const logger = createLogger('errorHandler');
// 에러 타입 정의
export const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

// 에러 분류 함수
export const classifyError = (error) => {
  if (!error) return ErrorTypes.UNKNOWN_ERROR;

  // 네트워크 연결 오류
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return ErrorTypes.NETWORK_ERROR;
  }

  // HTTP 상태 코드 기반 분류
  if (error.message.includes('HTTP')) {
    const statusMatch = error.message.match(/HTTP (\d+)/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      if (status === 404) return ErrorTypes.NOT_FOUND;
      if (status >= 400 && status < 500) return ErrorTypes.VALIDATION_ERROR;
      if (status >= 500) return ErrorTypes.SERVER_ERROR;
    }
  }

  // 특정 에러 메시지 패턴
  if (error.message.includes('찾을 수 없습니다')) {
    return ErrorTypes.NOT_FOUND;
  }

  return ErrorTypes.UNKNOWN_ERROR;
};

// 사용자 친화적 에러 메시지 생성
export const getErrorMessage = (error, context = '') => {
  const errorType = classifyError(error);
  
  const messages = {
    [ErrorTypes.NETWORK_ERROR]: {
      title: '네트워크 연결 오류',
      message: '인터넷 연결을 확인하고 다시 시도해주세요.',
      action: '다시 시도',
      canRetry: true,
    },
    [ErrorTypes.SERVER_ERROR]: {
      title: '서버 오류',
      message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      action: '다시 시도',
      canRetry: true,
    },
    [ErrorTypes.NOT_FOUND]: {
      title: '문서를 찾을 수 없음',
      message: '요청한 문서가 존재하지 않거나 삭제되었습니다.',
      action: '목록으로 돌아가기',
      canRetry: false,
    },
    [ErrorTypes.VALIDATION_ERROR]: {
      title: '입력 오류',
      message: '입력한 정보를 확인하고 다시 시도해주세요.',
      action: '수정하기',
      canRetry: false,
    },
    [ErrorTypes.UNKNOWN_ERROR]: {
      title: '알 수 없는 오류',
      message: '예상치 못한 오류가 발생했습니다.',
      action: '다시 시도',
      canRetry: true,
    },
  };

  const errorInfo = messages[errorType];
  
  // 컨텍스트별 메시지 커스터마이징
  if (context) {
    switch (context) {
      case 'save':
        errorInfo.message = `문서 저장 중 ${errorInfo.message.toLowerCase()}`;
        break;
      case 'load':
        errorInfo.message = `문서 불러오기 중 ${errorInfo.message.toLowerCase()}`;
        break;
      case 'delete':
        errorInfo.message = `문서 삭제 중 ${errorInfo.message.toLowerCase()}`;
        break;
    }
  }

  return {
    ...errorInfo,
    originalError: error,
    timestamp: new Date().toISOString(),
  };
};

// 에러 로깅 함수
export const logError = (error, context = '', additionalInfo = {}) => {
  const errorInfo = getErrorMessage(error, context);
  
  const logData = {
    ...errorInfo,
    context,
    additionalInfo,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };

  // 개발 환경에서만 상세 로그 출력
  if ((typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') || false) {
    logger.error('🔍 Error Details:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }

  // 프로덕션 환경에서는 에러 리포팅 서비스로 전송
  if ((typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') || false) {
    // TODO: Sentry.captureException(error, { extra: logData });
  }

  return logData;
};

// 재시도 가능한 에러인지 확인
export const isRetryableError = (error) => {
  const errorType = classifyError(error);
  return [ErrorTypes.NETWORK_ERROR, ErrorTypes.SERVER_ERROR, ErrorTypes.UNKNOWN_ERROR].includes(errorType);
};

// 오프라인 상태 감지
export const isOfflineError = (error) => {
  return classifyError(error) === ErrorTypes.NETWORK_ERROR;
}; 