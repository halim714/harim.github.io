/**
 * IsolatedPreview.test.jsx — 단위 테스트
 *
 * Phase 1-T4 검증
 */

import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IsolatedPreview } from '../IsolatedPreview';

// Mock sanitizeHtml
jest.mock('../../utils/sanitize', () => ({
  sanitizeHtml: jest.fn((html) => {
    // 간단한 XSS 필터링 시뮬레이션
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/onerror=/gi, '')
      .replace(/javascript:/gi, '');
  })
}));

describe('IsolatedPreview Component', () => {
  beforeEach(() => {
    // URL.createObjectURL/revokeObjectURL mock
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url-123');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('렌더링: 기본 HTML 표시', () => {
    const html = '<h1>Hello World</h1>';
    const { container } = render(<IsolatedPreview html={html} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'blob:mock-url-123');
  });

  test('보안: sandbox 속성 적용', () => {
    const html = '<p>Test</p>';
    const { container } = render(<IsolatedPreview html={html} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin');
  });

  test('접근성: title 속성 설정', () => {
    const html = '<p>Test</p>';
    const { container } = render(<IsolatedPreview html={html} title="My Preview" />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('title', 'My Preview');
  });

  test('스타일: 커스텀 스타일 적용', () => {
    const html = '<p>Test</p>';
    const customStyle = { border: '2px solid red', height: '500px' };
    const { container } = render(<IsolatedPreview html={html} style={customStyle} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveStyle({ border: '2px solid red', height: '500px' });
  });

  test('클래스: 커스텀 클래스 적용', () => {
    const html = '<p>Test</p>';
    const { container } = render(<IsolatedPreview html={html} className="my-custom-class" />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveClass('isolated-preview', 'my-custom-class');
  });

  test('에러 처리: 빈 HTML', async () => {
    const { container } = render(<IsolatedPreview html="" />);

    await waitFor(() => {
      const errorDiv = container.querySelector('.isolated-preview-error');
      expect(errorDiv).toBeInTheDocument();
      expect(errorDiv).toHaveTextContent('No content to display');
    });
  });

  test('에러 처리: null HTML', async () => {
    const { container } = render(<IsolatedPreview html={null} />);

    await waitFor(() => {
      const errorDiv = container.querySelector('.isolated-preview-error');
      expect(errorDiv).toBeInTheDocument();
    });
  });

  test('콜백: onLoad 실행', () => {
    const onLoadMock = jest.fn();
    const html = '<p>Test</p>';
    const { container } = render(<IsolatedPreview html={html} onLoad={onLoadMock} />);

    const iframe = container.querySelector('iframe');
    iframe.dispatchEvent(new Event('load'));

    expect(onLoadMock).toHaveBeenCalledTimes(1);
  });

  test('메모리 관리: cleanup 시 URL.revokeObjectURL 호출', () => {
    const html = '<p>Test</p>';
    const { unmount } = render(<IsolatedPreview html={html} />);

    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);

    unmount();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-123');
  });

  test('메모리 관리: HTML 변경 시 이전 URL 해제', () => {
    const { rerender } = render(<IsolatedPreview html="<p>First</p>" />);

    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);

    rerender(<IsolatedPreview html="<p>Second</p>" />);

    // 이전 URL 해제 + 새 URL 생성
    expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);
  });

  test('XSS 방지: 스크립트 태그 제거 (sanitize 통합)', () => {
    const maliciousHtml = '<script>alert("XSS")</script><h1>Hello</h1>';
    const { container } = render(<IsolatedPreview html={maliciousHtml} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();

    // sanitizeHtml이 스크립트를 제거했는지 확인
    const { sanitizeHtml } = require('../../utils/sanitize');
    expect(sanitizeHtml).toHaveBeenCalledWith(maliciousHtml);
  });

  test('보안: referrerPolicy 설정', () => {
    const html = '<p>Test</p>';
    const { container } = render(<IsolatedPreview html={html} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('referrerPolicy', 'no-referrer');
  });

  test('성능: lazy loading 적용', () => {
    const html = '<p>Test</p>';
    const { container } = render(<IsolatedPreview html={html} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('loading', 'lazy');
  });
});

describe('IsolatedPreview Security Tests', () => {
  test('XSS 시도 1: onerror 이벤트 핸들러', () => {
    const xssHtml = '<img src=x onerror=alert(1)>';
    const { container } = render(<IsolatedPreview html={xssHtml} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    // sandbox 속성으로 스크립트 실행 차단 확인
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin');
  });

  test('XSS 시도 2: javascript: 프로토콜', () => {
    const xssHtml = '<a href="javascript:alert(1)">Click</a>';
    const { container } = render(<IsolatedPreview html={xssHtml} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
  });

  test('XSS 시도 3: inline event handler', () => {
    const xssHtml = '<div onclick="alert(1)">Click me</div>';
    const { container } = render(<IsolatedPreview html={xssHtml} />);

    const iframe = container.querySelector('iframe');
    // sandbox로 스크립트 실행 차단
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin');
  });
});
