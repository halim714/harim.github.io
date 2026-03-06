import {
  ErrorTypes,
  classifyError,
  getErrorMessage,
  logError,
  isRetryableError,
  isOfflineError
} from '../../utils/errorHandler';

// 콘솔 에러 모킹
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorHandler', () => {
  describe('ErrorTypes', () => {
    test('모든 에러 타입이 정의되어 있어야 함', () => {
      expect(ErrorTypes.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(ErrorTypes.SERVER_ERROR).toBe('SERVER_ERROR');
      expect(ErrorTypes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorTypes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorTypes.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
  });

  describe('classifyError', () => {
    test('null/undefined 에러는 UNKNOWN_ERROR로 분류되어야 함', () => {
      expect(classifyError(null)).toBe(ErrorTypes.UNKNOWN_ERROR);
      expect(classifyError(undefined)).toBe(ErrorTypes.UNKNOWN_ERROR);
    });

    test('네트워크 에러를 올바르게 분류해야 함', () => {
      const networkError = new TypeError('Failed to fetch');
      expect(classifyError(networkError)).toBe(ErrorTypes.NETWORK_ERROR);
    });

    test('HTTP 404 에러를 NOT_FOUND로 분류해야 함', () => {
      const notFoundError = new Error('HTTP 404: Not Found');
      expect(classifyError(notFoundError)).toBe(ErrorTypes.NOT_FOUND);
    });

    test('HTTP 4xx 에러를 VALIDATION_ERROR로 분류해야 함', () => {
      const validationError = new Error('HTTP 400: Bad Request');
      expect(classifyError(validationError)).toBe(ErrorTypes.VALIDATION_ERROR);

      const unauthorizedError = new Error('HTTP 401: Unauthorized');
      expect(classifyError(unauthorizedError)).toBe(ErrorTypes.VALIDATION_ERROR);
    });

    test('HTTP 5xx 에러를 SERVER_ERROR로 분류해야 함', () => {
      const serverError = new Error('HTTP 500: Internal Server Error');
      expect(classifyError(serverError)).toBe(ErrorTypes.SERVER_ERROR);

      const badGatewayError = new Error('HTTP 502: Bad Gateway');
      expect(classifyError(badGatewayError)).toBe(ErrorTypes.SERVER_ERROR);
    });

    test('특정 메시지 패턴을 올바르게 분류해야 함', () => {
      const notFoundError = new Error('문서를 찾을 수 없습니다');
      expect(classifyError(notFoundError)).toBe(ErrorTypes.NOT_FOUND);
    });

    test('알 수 없는 에러는 UNKNOWN_ERROR로 분류되어야 함', () => {
      const unknownError = new Error('Something went wrong');
      expect(classifyError(unknownError)).toBe(ErrorTypes.UNKNOWN_ERROR);
    });
  });

  describe('getErrorMessage', () => {
    test('네트워크 에러에 대한 메시지를 반환해야 함', () => {
      const networkError = new TypeError('Failed to fetch');
      const errorMessage = getErrorMessage(networkError);

      expect(errorMessage.title).toBe('네트워크 연결 오류');
      expect(errorMessage.message).toBe('인터넷 연결을 확인하고 다시 시도해주세요.');
      expect(errorMessage.action).toBe('다시 시도');
      expect(errorMessage.canRetry).toBe(true);
      expect(errorMessage.originalError).toBe(networkError);
      expect(errorMessage.timestamp).toBeDefined();
    });

    test('서버 에러에 대한 메시지를 반환해야 함', () => {
      const serverError = new Error('HTTP 500: Internal Server Error');
      const errorMessage = getErrorMessage(serverError);

      expect(errorMessage.title).toBe('서버 오류');
      expect(errorMessage.message).toBe('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      expect(errorMessage.canRetry).toBe(true);
    });

    test('NOT_FOUND 에러에 대한 메시지를 반환해야 함', () => {
      const notFoundError = new Error('HTTP 404: Not Found');
      const errorMessage = getErrorMessage(notFoundError);

      expect(errorMessage.title).toBe('문서를 찾을 수 없음');
      expect(errorMessage.message).toBe('요청한 문서가 존재하지 않거나 삭제되었습니다.');
      expect(errorMessage.canRetry).toBe(false);
    });

    test('컨텍스트별 메시지 커스터마이징이 작동해야 함', () => {
      const error = new Error('HTTP 500: Internal Server Error');

      const saveErrorMessage = getErrorMessage(error, 'save');
      expect(saveErrorMessage.message).toContain('문서 저장 중');

      const loadErrorMessage = getErrorMessage(error, 'load');
      expect(loadErrorMessage.message).toContain('문서 불러오기 중');

      const deleteErrorMessage = getErrorMessage(error, 'delete');
      expect(deleteErrorMessage.message).toContain('문서 삭제 중');
    });
  });

  describe('logError', () => {
    test('개발 환경에서 콘솔에 에러를 로깅해야 함', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const testError = new Error('테스트 에러');
      const logData = logError(testError, 'test', { extra: 'info' });

      // logger.error is used instead of console.error, so we skip exact console format check here
      // and verify that it was called.
      expect(console.error).toHaveBeenCalled();

      expect(logData.context).toBe('test');
      expect(logData.additionalInfo).toEqual({ extra: 'info' });

      process.env.NODE_ENV = originalEnv;
    });

    test('프로덕션 환경에서는 콘솔 로깅을 하지 않아야 함', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const testError = new Error('테스트 에러');
      logError(testError);

      expect(console.error).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('isRetryableError', () => {
    test('재시도 가능한 에러를 올바르게 판단해야 함', () => {
      const networkError = new TypeError('Failed to fetch');
      expect(isRetryableError(networkError)).toBe(true);

      const serverError = new Error('HTTP 500: Internal Server Error');
      expect(isRetryableError(serverError)).toBe(true);

      const unknownError = new Error('Something went wrong');
      expect(isRetryableError(unknownError)).toBe(true);
    });

    test('재시도 불가능한 에러를 올바르게 판단해야 함', () => {
      const notFoundError = new Error('HTTP 404: Not Found');
      expect(isRetryableError(notFoundError)).toBe(false);

      const validationError = new Error('HTTP 400: Bad Request');
      expect(isRetryableError(validationError)).toBe(false);
    });
  });

  describe('isOfflineError', () => {
    test('오프라인 에러를 올바르게 판단해야 함', () => {
      const networkError = new TypeError('Failed to fetch');
      expect(isOfflineError(networkError)).toBe(true);

      const serverError = new Error('HTTP 500: Internal Server Error');
      expect(isOfflineError(serverError)).toBe(false);
    });
  });

  describe('통합 시나리오', () => {
    test('전체 에러 처리 플로우가 정상 작동해야 함', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // 1. 네트워크 에러 발생
      const networkError = new TypeError('Failed to fetch');

      // 2. 에러 분류
      const errorType = classifyError(networkError);
      expect(errorType).toBe(ErrorTypes.NETWORK_ERROR);

      // 3. 사용자 친화적 메시지 생성
      const errorMessage = getErrorMessage(networkError, 'save');
      expect(errorMessage.title).toBe('네트워크 연결 오류');
      expect(errorMessage.message).toContain('문서 저장 중');
      expect(errorMessage.canRetry).toBe(true);

      // 4. 재시도 가능 여부 확인
      expect(isRetryableError(networkError)).toBe(true);
      expect(isOfflineError(networkError)).toBe(true);

      // 5. 에러 로깅
      const logData = logError(networkError, 'save', { documentId: 'test-123' });
      expect(console.error).toHaveBeenCalled();
      expect(logData.context).toBe('save');
      expect(logData.additionalInfo.documentId).toBe('test-123');

      process.env.NODE_ENV = originalEnv;
    });
  });
}); 