
// 기본 스피너 컴포넌트
export const LoadingSpinner = ({ 
  size = 'normal', 
  color = 'blue',
  className = '',
  text = ''
}) => {
  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'w-4 h-4';
      case 'large': return 'w-8 h-8';
      default: return 'w-6 h-6';
    }
  };

  const getColorClass = () => {
    switch (color) {
      case 'white': return 'text-white';
      case 'gray': return 'text-gray-500';
      case 'green': return 'text-green-500';
      case 'red': return 'text-red-500';
      default: return 'text-blue-500';
    }
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg 
        className={`animate-spin ${getSizeClass()} ${getColorClass()}`}
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && <span className="ml-2 text-sm text-gray-600">{text}</span>}
    </div>
  );
};

// 문서 목록 스켈레톤
export const DocumentListSkeleton = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="p-3 bg-gray-50 rounded">
            {/* 제목 스켈레톤 */}
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            
            {/* 내용 미리보기 스켈레톤 */}
            <div className="space-y-1">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
            
            {/* 메타 정보 스켈레톤 */}
            <div className="flex justify-between items-center mt-2">
              <div className="h-3 bg-gray-200 rounded w-24"></div>
              <div className="h-3 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// 에디터 스켈레톤
export const EditorSkeleton = () => {
  return (
    <div className="animate-pulse h-full">
      {/* 헤더 스켈레톤 */}
      <div className="mb-4 p-4 border-b">
        <div className="flex justify-between items-center mb-2">
          <div className="h-6 bg-gray-200 rounded w-20"></div>
          <div className="flex space-x-2">
            <div className="h-8 bg-gray-200 rounded w-16"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
            <div className="h-8 bg-gray-200 rounded w-8"></div>
          </div>
        </div>
        
        {/* 제목 입력 스켈레톤 */}
        <div className="h-10 bg-gray-200 rounded w-full"></div>
      </div>
      
      {/* 에디터 영역 스켈레톤 */}
      <div className="flex-grow space-y-3 p-4">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/5"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>
  );
};

// AI 패널 스켈레톤
export const AiPanelSkeleton = () => {
  return (
    <div className="animate-pulse h-full">
      {/* 헤더 스켈레톤 */}
      <div className="p-3 border-b">
        <div className="h-6 bg-gray-200 rounded w-20"></div>
      </div>
      
      {/* 대화 내용 스켈레톤 */}
      <div className="p-4 space-y-4">
        {/* 사용자 메시지 */}
        <div className="flex justify-end">
          <div className="bg-gray-200 rounded-lg p-3 max-w-xs">
            <div className="h-3 bg-gray-300 rounded w-full mb-1"></div>
            <div className="h-3 bg-gray-300 rounded w-3/4"></div>
          </div>
        </div>
        
        {/* AI 응답 */}
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
            <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
        
        {/* 사용자 메시지 */}
        <div className="flex justify-end">
          <div className="bg-gray-200 rounded-lg p-3 max-w-xs">
            <div className="h-3 bg-gray-300 rounded w-4/5"></div>
          </div>
        </div>
      </div>
      
      {/* 입력 영역 스켈레톤 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
        <div className="h-10 bg-gray-200 rounded w-full"></div>
      </div>
    </div>
  );
};

// 전체 페이지 로딩
export const PageLoadingSpinner = ({ text = '로딩 중...' }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="large" className="mb-4" />
        <p className="text-gray-600 text-lg">{text}</p>
      </div>
    </div>
  );
};

// 인라인 로딩 (버튼 내부 등)
export const InlineLoadingSpinner = ({ text = '' }) => {
  return (
    <div className="flex items-center">
      <LoadingSpinner size="small" />
      {text && <span className="ml-2">{text}</span>}
    </div>
  );
};

export default LoadingSpinner; 