import { render, screen, fireEvent } from '@testing-library/react';

import ErrorDisplay from '../../components/common/ErrorDisplay';

describe('ErrorDisplay', () => {
  const mockOnRetry = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('렌더링', () => {
    test('에러가 없으면 아무것도 렌더링하지 않아야 함', () => {
      const { container } = render(<ErrorDisplay error={null} />);
      expect(container.firstChild).toBeNull();
    });

    test('네트워크 에러를 올바르게 렌더링해야 함', () => {
      const networkError = new TypeError('Failed to fetch');
      
      render(
        <ErrorDisplay 
          error={networkError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('네트워크 연결 오류')).toBeInTheDocument();
      expect(screen.getByText('인터넷 연결을 확인하고 다시 시도해주세요.')).toBeInTheDocument();
      expect(screen.getByText('다시 시도')).toBeInTheDocument();
      expect(screen.getByText('닫기')).toBeInTheDocument();
    });

    test('서버 에러를 올바르게 렌더링해야 함', () => {
      const serverError = new Error('HTTP 500: Internal Server Error');
      
      render(
        <ErrorDisplay 
          error={serverError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('서버 오류')).toBeInTheDocument();
      expect(screen.getByText('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();
    });

    test('NOT_FOUND 에러를 올바르게 렌더링해야 함', () => {
      const notFoundError = new Error('HTTP 404: Not Found');
      
      render(
        <ErrorDisplay 
          error={notFoundError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('문서를 찾을 수 없음')).toBeInTheDocument();
      expect(screen.getByText('요청한 문서가 존재하지 않거나 삭제되었습니다.')).toBeInTheDocument();
      expect(screen.queryByText('목록으로 돌아가기')).not.toBeInTheDocument();
    });
  });

  describe('컨텍스트별 메시지', () => {
    test('save 컨텍스트에서 메시지가 커스터마이징되어야 함', () => {
      const error = new Error('HTTP 500: Internal Server Error');
      
      render(
        <ErrorDisplay 
          error={error} 
          context="save"
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText(/문서 저장 중/)).toBeInTheDocument();
    });

    test('load 컨텍스트에서 메시지가 커스터마이징되어야 함', () => {
      const error = new Error('HTTP 500: Internal Server Error');
      
      render(
        <ErrorDisplay 
          error={error} 
          context="load"
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText(/문서 불러오기 중/)).toBeInTheDocument();
    });

    test('delete 컨텍스트에서 메시지가 커스터마이징되어야 함', () => {
      const error = new Error('HTTP 500: Internal Server Error');
      
      render(
        <ErrorDisplay 
          error={error} 
          context="delete"
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText(/문서 삭제 중/)).toBeInTheDocument();
    });
  });

  describe('크기 옵션', () => {
    test('small 크기로 렌더링되어야 함', () => {
      const error = new Error('Test error');
      
      const { container } = render(
        <ErrorDisplay 
          error={error} 
          size="small"
        />
      );

      const errorContainer = container.querySelector('.p-3');
      expect(errorContainer).toBeInTheDocument();
    });

    test('large 크기로 렌더링되어야 함', () => {
      const error = new Error('Test error');
      
      const { container } = render(
        <ErrorDisplay 
          error={error} 
          size="large"
        />
      );

      const errorContainer = container.querySelector('.p-6');
      expect(errorContainer).toBeInTheDocument();
    });

    test('기본 크기로 렌더링되어야 함', () => {
      const error = new Error('Test error');
      
      const { container } = render(
        <ErrorDisplay 
          error={error} 
          size="normal"
        />
      );

      const errorContainer = container.querySelector('.p-4');
      expect(errorContainer).toBeInTheDocument();
    });
  });

  describe('아이콘 표시', () => {
    test('네트워크 에러에 대해 네트워크 아이콘을 표시해야 함', () => {
      const networkError = new TypeError('Failed to fetch');
      
      const { container } = render(
        <ErrorDisplay error={networkError} />
      );

      const networkIcon = container.querySelector('svg.text-orange-500');
      expect(networkIcon).toBeInTheDocument();
    });

    test('일반 에러에 대해 에러 아이콘을 표시해야 함', () => {
      const generalError = new Error('General error');
      
      const { container } = render(
        <ErrorDisplay error={generalError} />
      );

      const errorIcon = container.querySelector('svg.text-red-500');
      expect(errorIcon).toBeInTheDocument();
    });
  });

  describe('버튼 동작', () => {
    test('재시도 버튼 클릭 시 onRetry가 호출되어야 함', () => {
      const retryableError = new TypeError('Failed to fetch');
      
      render(
        <ErrorDisplay 
          error={retryableError} 
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByText('다시 시도');
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    test('닫기 버튼 클릭 시 onDismiss가 호출되어야 함', () => {
      const error = new Error('Test error');
      
      render(
        <ErrorDisplay 
          error={error} 
          onDismiss={mockOnDismiss}
        />
      );

      const dismissButton = screen.getByText('닫기');
      fireEvent.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    test('우상단 X 버튼 클릭 시 onDismiss가 호출되어야 함', () => {
      const error = new Error('Test error');
      
      const { container } = render(
        <ErrorDisplay 
          error={error} 
          onDismiss={mockOnDismiss}
        />
      );

      // X 버튼을 찾기 (SVG가 포함된 버튼)
      const buttons = container.querySelectorAll('button');
      const xButton = Array.from(buttons).find(button => 
        button.querySelector('svg') && !button.textContent.trim()
      );
      
      expect(xButton).toBeTruthy();
      fireEvent.click(xButton);
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    test('재시도 불가능한 에러에서는 재시도 버튼이 표시되지 않아야 함', () => {
      const notFoundError = new Error('HTTP 404: Not Found');
      
      render(
        <ErrorDisplay 
          error={notFoundError} 
          onRetry={mockOnRetry}
        />
      );

      expect(screen.queryByText('다시 시도')).not.toBeInTheDocument();
      expect(screen.queryByText('목록으로 돌아가기')).not.toBeInTheDocument();
    });

    test('onRetry가 없으면 재시도 버튼이 표시되지 않아야 함', () => {
      const retryableError = new TypeError('Failed to fetch');
      
      render(
        <ErrorDisplay 
          error={retryableError} 
          // onRetry 없음
        />
      );

      expect(screen.queryByText('다시 시도')).not.toBeInTheDocument();
    });

    test('onDismiss가 없으면 닫기 버튼들이 표시되지 않아야 함', () => {
      const error = new Error('Test error');
      
      render(
        <ErrorDisplay 
          error={error} 
          // onDismiss 없음
        />
      );

      expect(screen.queryByText('닫기')).not.toBeInTheDocument();
    });
  });

  describe('개발자 정보', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('개발 환경에서 개발자 정보가 표시되어야 함', () => {
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      render(<ErrorDisplay error={error} />);

      expect(screen.getByText('개발자 정보 (클릭하여 펼치기)')).toBeInTheDocument();
    });

    test('프로덕션 환경에서 개발자 정보가 표시되지 않아야 함', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      render(<ErrorDisplay error={error} />);

      expect(screen.queryByText('개발자 정보 (클릭하여 펼치기)')).not.toBeInTheDocument();
    });

    test('개발자 정보 details 요소를 클릭하여 펼칠 수 있어야 함', () => {
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      render(<ErrorDisplay error={error} />);

      const details = screen.getByText('개발자 정보 (클릭하여 펼치기)');
      fireEvent.click(details);

      // 정규식을 사용하여 줄바꿈과 공백을 무시하고 텍스트 매칭
      expect(screen.getByText(/Test error/)).toBeInTheDocument();
    });
  });

  describe('CSS 클래스', () => {
    test('커스텀 className이 적용되어야 함', () => {
      const error = new Error('Test error');
      
      const { container } = render(
        <ErrorDisplay 
          error={error} 
          className="custom-error-class"
        />
      );

      const errorContainer = container.querySelector('.custom-error-class');
      expect(errorContainer).toBeInTheDocument();
    });

    test('기본 스타일 클래스들이 적용되어야 함', () => {
      const error = new Error('Test error');
      
      const { container } = render(
        <ErrorDisplay error={error} />
      );

      const errorContainer = container.querySelector('.bg-red-50.border.border-red-200.rounded-lg');
      expect(errorContainer).toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    test('버튼들이 적절한 포커스를 받을 수 있어야 함', () => {
      const retryableError = new TypeError('Failed to fetch');
      
      render(
        <ErrorDisplay 
          error={retryableError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );

      const retryButton = screen.getByText('다시 시도');
      const dismissButton = screen.getByText('닫기');

      expect(retryButton).toHaveClass('focus:outline-none', 'focus:ring-2');
      expect(dismissButton).toHaveClass('focus:outline-none', 'focus:ring-2');
    });
  });
}); 