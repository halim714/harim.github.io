// 환경별 로깅 제어 유틸리티
const isDevelopment = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') || false;
const isTest = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') || false;

// 로그 레벨 정의
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// 현재 로그 레벨 설정 (환경변수로 제어 가능)
const currentLogLevel = isDevelopment 
  ? LOG_LEVELS.DEBUG 
  : LOG_LEVELS.ERROR;

class Logger {
  constructor(module = 'App') {
    this.module = module;
  }

  error(...args) {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.error(`[${this.module}]`, ...args);
    }
  }

  warn(...args) {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn(`[${this.module}]`, ...args);
    }
  }

  info(...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.info(`[${this.module}]`, ...args);
    }
  }

  debug(...args) {
    if (currentLogLevel >= LOG_LEVELS.DEBUG && !isTest) {
      console.info(`[${this.module}]`, ...args);
    }
  }

  // 성능 측정용
  time(label) {
    if (currentLogLevel >= LOG_LEVELS.DEBUG && !isTest) {
      console.time(`[${this.module}] ${label}`);
    }
  }

  timeEnd(label) {
    if (currentLogLevel >= LOG_LEVELS.DEBUG && !isTest) {
      console.timeEnd(`[${this.module}] ${label}`);
    }
  }
}

// 모듈별 로거 생성 함수
export const createLogger = (module) => new Logger(module);

// 기본 로거
export const logger = new Logger('App');

// 레거시 console.log 대체용 (점진적 마이그레이션)
export const debugLog = (...args) => {
  if (isDevelopment && !isTest) {
    logger.info('[DEBUG]', ...args);
  }
};

export default logger; 