import React from 'react';
import ReactDOM from 'react-dom'; // 'react-dom/client' 대신 'react-dom'을 사용

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { createLogger } from './utils/logger';
import { initializeDatabase } from './utils/database';

const logger = createLogger('Index');

// Initialize IndexedDB
initializeDatabase().then(() => {
  console.log('✅ Database initialized');
}).catch(err => {
  console.error('❌ Database initialization failed:', err);
});

logger.info('Miki Editor v7 시작 중...');
logger.debug('React 버전:', React.version);
logger.debug('DOM 요소 확인:', document.getElementById('root'));

// React 17 방식으로 렌더링
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

logger.info('렌더링 완료, React 마운트 되었습니다.');
console.log('렌더링 완료, React 마운트 되었습니다.');
