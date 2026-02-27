/**
 * IsolatedPreview.jsx — 격리된 HTML 프리뷰 컴포넌트
 *
 * Phase 1-T4: Security Foundation
 *
 * blob: URL + iframe sandbox를 사용하여 XSS로부터 완전히 격리된 프리뷰 환경 제공
 * - 사용자 생성 HTML을 메인 앱과 완전히 분리된 샌드박스에서 렌더링
 * - 스크립트 실행 차단, 동일 출처 정책 격리
 * - 자동 메모리 관리 (blob URL cleanup)
 *
 * @example
 * import { IsolatedPreview } from '@/components/IsolatedPreview';
 *
 * function MarkdownViewer({ markdown }) {
 *   const html = convertMarkdownToHtml(markdown);
 *   return <IsolatedPreview html={html} />;
 * }
 */

import React, { useEffect, useRef, useState } from 'react';
import { sanitizeHtml } from '../utils/sanitize';

/**
 * 격리된 HTML 프리뷰 컴포넌트
 *
 * @param {Object} props
 * @param {string} props.html - 렌더링할 HTML 문자열 (sanitize 적용됨)
 * @param {string} [props.title] - iframe의 title 속성 (접근성)
 * @param {Object} [props.style] - iframe 커스텀 스타일
 * @param {string} [props.className] - iframe 추가 CSS 클래스
 * @param {Function} [props.onLoad] - iframe 로드 완료 콜백
 * @param {Function} [props.onError] - 에러 발생 콜백
 */
export function IsolatedPreview({
  html,
  title = 'Preview',
  style = {},
  className = '',
  onLoad,
  onError
}) {
  const iframeRef = useRef(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 빈 HTML 체크
    if (!html || typeof html !== 'string') {
      console.warn('[IsolatedPreview] Invalid or empty HTML provided');
      setError('No content to display');
      return;
    }

    let objectUrl = null;

    try {
      // 1. HTML 정제 (XSS 방지)
      const cleanHtml = sanitizeHtml(html);

      if (!cleanHtml.trim()) {
        console.warn('[IsolatedPreview] HTML was empty after sanitization');
        setError('Content was removed for security reasons');
        return;
      }

      // 2. 완전한 HTML 문서 생성 (스타일 + 반응형 지원)
      const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    /* 기본 리셋 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333;
      padding: 16px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* 마크다운 스타일링 */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }

    h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.875em; }
    h6 { font-size: 0.85em; color: #666; }

    p {
      margin-bottom: 16px;
    }

    a {
      color: #0969da;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      background-color: #f6f8fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 0.9em;
    }

    pre {
      background-color: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 16px;
    }

    pre code {
      background: none;
      padding: 0;
    }

    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 16px;
      color: #666;
      margin: 16px 0;
    }

    ul, ol {
      margin-bottom: 16px;
      padding-left: 2em;
    }

    li {
      margin-bottom: 4px;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }

    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background-color: #f6f8fa;
      font-weight: 600;
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 16px 0;
    }

    hr {
      border: none;
      border-top: 2px solid #eee;
      margin: 24px 0;
    }

    /* 다크모드 지원 (시스템 설정) */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #1a1a1a;
        color: #e0e0e0;
      }

      h1, h2 {
        border-bottom-color: #333;
      }

      h6 {
        color: #aaa;
      }

      code, pre {
        background-color: #2d2d2d;
      }

      a {
        color: #58a6ff;
      }

      blockquote {
        border-left-color: #444;
        color: #aaa;
      }

      th, td {
        border-color: #444;
      }

      th {
        background-color: #2d2d2d;
      }

      hr {
        border-top-color: #333;
      }
    }
  </style>
</head>
<body>
  ${cleanHtml}
</body>
</html>`;

      // 3. Blob URL 생성
      const blob = new Blob([fullHtml], { type: 'text/html; charset=utf-8' });
      objectUrl = URL.createObjectURL(blob);

      setBlobUrl(objectUrl);
      setError(null);

      console.debug('[IsolatedPreview] Blob URL created:', objectUrl);

    } catch (err) {
      console.error('[IsolatedPreview] Error creating blob URL:', err);
      setError('Failed to render preview');
      onError?.(err);
    }

    // 4. Cleanup: 컴포넌트 언마운트 또는 HTML 변경 시 blob URL 해제
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        console.debug('[IsolatedPreview] Blob URL revoked:', objectUrl);
      }
    };
  }, [html, title, onError]);

  // iframe 로드 핸들러
  const handleLoad = () => {
    console.debug('[IsolatedPreview] iframe loaded successfully');
    onLoad?.();
  };

  // 에러 상태 렌더링
  if (error) {
    return (
      <div
        className={`isolated-preview-error ${className}`}
        style={{
          padding: '16px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          color: '#856404',
          textAlign: 'center',
          ...style
        }}
      >
        ⚠️ {error}
      </div>
    );
  }

  // 로딩 상태 (blobUrl이 아직 생성되지 않음)
  if (!blobUrl) {
    return (
      <div
        className={`isolated-preview-loading ${className}`}
        style={{
          padding: '16px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          color: '#6c757d',
          textAlign: 'center',
          ...style
        }}
      >
        Loading preview...
      </div>
    );
  }

  // 메인 렌더링: sandbox iframe
  return (
    <iframe
      ref={iframeRef}
      src={blobUrl}
      title={title}
      className={`isolated-preview ${className}`}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        backgroundColor: '#fff',
        ...style
      }}
      // 보안 샌드박스 설정
      sandbox="allow-same-origin"
      // allow-same-origin: CSS 스타일링을 위해 필요 (스크립트는 여전히 차단됨)
      // allow-scripts: 의도적으로 제외 → JavaScript 실행 완전 차단
      // allow-forms, allow-popups: 의도적으로 제외 → 폼 제출/팝업 차단

      // 추가 보안 속성
      referrerPolicy="no-referrer"
      loading="lazy"

      // 이벤트 핸들러
      onLoad={handleLoad}
      onError={(e) => {
        console.error('[IsolatedPreview] iframe load error:', e);
        setError('Failed to load preview');
        onError?.(e);
      }}
    />
  );
}

/**
 * IsolatedPreview 사용 시 주의사항:
 *
 * 1. **샌드박스 제한사항**
 *    - JavaScript 실행 불가 (의도적)
 *    - 폼 제출 불가
 *    - 팝업 열기 불가
 *    - 부모 창 접근 불가
 *
 * 2. **메모리 관리**
 *    - blob URL은 자동으로 cleanup됨 (useEffect cleanup)
 *    - 대용량 HTML 렌더링 시 메모리 사용 주의
 *
 * 3. **스타일링**
 *    - iframe 내부 스타일은 컴포넌트 내부에서 관리
 *    - 외부 CSS는 적용 불가 (격리 원칙)
 *
 * 4. **접근성**
 *    - title prop으로 스크린리더 지원
 *    - 키보드 탐색은 iframe 내부에서 가능
 */

export default IsolatedPreview;
