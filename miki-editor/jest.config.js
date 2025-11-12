module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/src/__mocks__/fileMock.js'
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-split|@tanstack)/)'
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx}'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/setupTests.js',
    '!src/**/*.test.{js,jsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // UI 핵심 파일은 더 높은 커버리지 요구
    './src/App.jsx': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/MikiEditor.jsx': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  // 스냅샷 테스트 설정
  snapshotSerializers: ['enzyme-to-json/serializer'],
  // UI 테스트 전용 스크립트
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.{js,jsx}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub'
      },
      transform: {
        '^.+\\.(js|jsx)$': 'babel-jest'
      },
      transformIgnorePatterns: [
        'node_modules/(?!(.*\\.mjs$))'
      ],
      globals: {
        'import.meta': {
          env: {
            VITE_AI_API_TYPE: 'claude',
            VITE_AI_API_KEY: 'test-key',
            VITE_SERVER_URL: 'http://localhost:3001'
          }
        }
      }
    },
    {
      displayName: 'ui-snapshots',
      testMatch: ['<rootDir>/src/**/*.snapshot.test.{js,jsx}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub'
      },
      transform: {
        '^.+\\.(js|jsx)$': 'babel-jest'
      },
      transformIgnorePatterns: [
        'node_modules/(?!(.*\\.mjs$))'
      ],
      globals: {
        'import.meta': {
          env: {
            VITE_AI_API_TYPE: 'claude',
            VITE_AI_API_KEY: 'test-key',
            VITE_SERVER_URL: 'http://localhost:3001'
          }
        }
      }
    }
  ]
}; 