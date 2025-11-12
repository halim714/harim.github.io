// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import { createLogger } from './utils/logger';
const logger = createLogger('setupTests');
import '@testing-library/jest-dom';

// Mock window.matchMedia
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

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock fetch
global.fetch = jest.fn();

// 🔧 JSDOM 브라우저 API 폴리필 추가 (2단계 - 테스트 환경 안정화)

// Mock scrollIntoView (AiPanel.jsx 669줄에서 사용)
Element.prototype.scrollIntoView = jest.fn();

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock MutationObserver
global.MutationObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(),
}));

// Mock window.getComputedStyle
global.getComputedStyle = jest.fn().mockImplementation(() => ({
  getPropertyValue: jest.fn(),
  setProperty: jest.fn(),
}));

// Mock window.requestAnimationFrame
global.requestAnimationFrame = jest.fn().mockImplementation(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn().mockImplementation(id => clearTimeout(id));

// Mock window.requestIdleCallback
global.requestIdleCallback = jest.fn().mockImplementation(cb => setTimeout(cb, 0));
global.cancelIdleCallback = jest.fn().mockImplementation(id => clearTimeout(id));

// Mock HTMLElement.offsetHeight, offsetWidth 등
Object.defineProperties(HTMLElement.prototype, {
  offsetHeight: {
    get() { return parseFloat(this.style.height) || 0; }
  },
  offsetWidth: {
    get() { return parseFloat(this.style.width) || 0; }
  },
  offsetTop: {
    get() { return parseFloat(this.style.top) || 0; }
  },
  offsetLeft: {
    get() { return parseFloat(this.style.left) || 0; }
  },
});

// Mock window.location
delete window.location;
window.location = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock import.meta.env for Vite compatibility
global.importMeta = {
  env: {
    NODE_ENV: 'test',
    VITE_API_BASE_URL: 'http://localhost:3000',
    VITE_AI_API_URL: 'http://localhost:3000/api/ai',
  }
};

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File and FileReader
global.File = jest.fn().mockImplementation((bits, name, options) => ({
  name,
  size: bits.length,
  type: options?.type || '',
  lastModified: Date.now(),
}));

global.FileReader = jest.fn().mockImplementation(() => ({
  readAsText: jest.fn(),
  readAsDataURL: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  result: null,
  error: null,
}));

// Mock Clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
  writable: true,
});

// Mock navigator.userAgent
Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Node.js) Jest/Test',
  writable: true,
});

// Mock window.crypto
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: jest.fn().mockImplementation(arr => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    randomUUID: jest.fn().mockReturnValue('mocked-uuid-1234'),
  },
  writable: true,
});

logger.info('✅ JSDOM 브라우저 API 폴리필 로드 완료 (2단계 - 테스트 환경 안정화)');
