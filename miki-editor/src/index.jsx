import React from 'react';
import ReactDOM from 'react-dom';

import './index.css';
import App from './App';
import { createLogger } from './utils/logger';

const logger = createLogger('Index');

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

