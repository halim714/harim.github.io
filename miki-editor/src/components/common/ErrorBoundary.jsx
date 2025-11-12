import { createLogger } from '../../utils/logger';

const logger = createLogger('ErrorBoundary');
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // 다음 렌더링에서 폴백 UI가 보이도록 상태를 업데이트합니다.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 에러 로깅
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // 프로덕션에서는 에러 리포팅 서비스로 전송
    if ((typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') || false) {
      // TODO: Sentry.captureException(error, { extra: errorInfo });
    }
  }

  handleReload = () => {
    // 앱 상태 초기화 및 새로고침
    window.location.reload();
  };

  handleReset = () => {
    // 에러 상태만 리셋하여 앱 복구 시도
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <svg className="w-8 h-8 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h1 className="text-xl font-bold text-gray-900">앱 오류 발생</h1>
            </div>
            
            <p className="text-gray-600 mb-6">
              예상치 못한 오류가 발생했습니다. 아래 버튼을 클릭하여 앱을 복구해보세요.
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                앱 복구 시도
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                페이지 새로고침
              </button>
            </div>

            {/* 개발 환경에서만 상세 에러 정보 표시 */}
            {((typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') || false) && this.state.error && (
              <details className="mt-6 p-4 bg-gray-100 rounded">
                <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                  개발자 정보 (클릭하여 펼치기)
                </summary>
                <div className="text-sm text-gray-600 space-y-2">
                  <div>
                    <strong>에러:</strong>
                    <pre className="mt-1 p-2 bg-red-50 text-red-700 rounded text-xs overflow-auto">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  <div>
                    <strong>스택 트레이스:</strong>
                    <pre className="mt-1 p-2 bg-red-50 text-red-700 rounded text-xs overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 