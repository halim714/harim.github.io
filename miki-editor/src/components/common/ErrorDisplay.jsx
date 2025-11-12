import { getErrorMessage, isRetryableError } from '../../utils/errorHandler';

const ErrorDisplay = ({ 
  error, 
  context = '', 
  onRetry, 
  onDismiss,
  className = '',
  size = 'normal' // 'small', 'normal', 'large'
}) => {
  if (!error) return null;

  const errorInfo = getErrorMessage(error, context);
  const canRetry = isRetryableError(error);

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          container: 'p-3',
          icon: 'w-5 h-5',
          title: 'text-sm font-medium',
          message: 'text-xs',
          button: 'px-2 py-1 text-xs',
        };
      case 'large':
        return {
          container: 'p-6',
          icon: 'w-8 h-8',
          title: 'text-xl font-bold',
          message: 'text-base',
          button: 'px-4 py-2 text-base',
        };
      default:
        return {
          container: 'p-4',
          icon: 'w-6 h-6',
          title: 'text-lg font-semibold',
          message: 'text-sm',
          button: 'px-3 py-2 text-sm',
        };
    }
  };

  const sizeClasses = getSizeClasses();

  const getErrorIcon = () => {
    return (
      <svg 
        className={`${sizeClasses.icon} text-red-500 flex-shrink-0`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 15.5c-.77.833.192 2.5 1.732 2.5z" 
        />
      </svg>
    );
  };

  const getNetworkIcon = () => {
    return (
      <svg 
        className={`${sizeClasses.icon} text-orange-500 flex-shrink-0`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" 
        />
      </svg>
    );
  };

  const isNetworkError = error.name === 'TypeError' && error.message.includes('fetch');

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg ${sizeClasses.container} ${className}`}>
      <div className="flex items-start">
        <div className="mr-3">
          {isNetworkError ? getNetworkIcon() : getErrorIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`${sizeClasses.title} text-red-800 mb-1`}>
            {errorInfo.title}
          </h3>
          
          <p className={`${sizeClasses.message} text-red-700 mb-3`}>
            {errorInfo.message}
          </p>

          {/* 개발 환경에서만 상세 에러 정보 표시 */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-3">
              <summary className="cursor-pointer text-xs text-red-600 hover:text-red-800">
                개발자 정보 (클릭하여 펼치기)
              </summary>
              <pre className="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded overflow-auto">
                {error.stack || error.message}
              </pre>
            </details>
          )}

          <div className="flex items-center space-x-2">
            {/* 재시도 버튼 */}
            {canRetry && onRetry && (
              <button
                onClick={onRetry}
                className={`${sizeClasses.button} bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors`}
              >
                {errorInfo.action}
              </button>
            )}

            {/* 닫기 버튼 */}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`${sizeClasses.button} bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors`}
              >
                닫기
              </button>
            )}
          </div>
        </div>

        {/* 우상단 닫기 X 버튼 */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-2 text-red-400 hover:text-red-600 focus:outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay; 