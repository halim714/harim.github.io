/**
 * IsolatedPreview.example.jsx — 사용 예제
 *
 * IsolatedPreview 컴포넌트를 기존 코드에 통합하는 방법
 */

import React, { useState } from 'react';
import { IsolatedPreview } from './IsolatedPreview';
import { marked } from 'marked'; // 또는 사용 중인 마크다운 라이브러리

/**
 * 예제 1: 기본 마크다운 프리뷰
 */
export function MarkdownPreviewExample() {
  const [markdown, setMarkdown] = useState('# Hello World\n\nThis is **safe** markdown.');

  // 마크다운을 HTML로 변환
  const html = marked(markdown);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* 에디터 */}
      <textarea
        style={{ flex: 1, padding: '16px', fontFamily: 'monospace' }}
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        placeholder="마크다운을 입력하세요..."
      />

      {/* 프리뷰 (격리된 iframe) */}
      <div style={{ flex: 1, borderLeft: '1px solid #ccc' }}>
        <IsolatedPreview
          html={html}
          title="Markdown Preview"
          onLoad={() => console.log('Preview loaded!')}
          onError={(err) => console.error('Preview error:', err)}
        />
      </div>
    </div>
  );
}

/**
 * 예제 2: MikiEditor에 통합
 *
 * 기존 MikiEditor.jsx의 프리뷰 모드에 IsolatedPreview 적용
 */
export function MikiEditorIntegrationExample() {
  const [content, setContent] = useState('# 안전한 프리뷰\n\nXSS 공격을 차단합니다.');
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview'

  const renderHtml = (markdown) => {
    // marked 또는 showdown 사용
    return marked(markdown);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 툴바 */}
      <div style={{ padding: '8px', borderBottom: '1px solid #ccc' }}>
        <button onClick={() => setViewMode('edit')}>Edit</button>
        <button onClick={() => setViewMode('preview')}>Preview</button>
      </div>

      {/* 에디터 또는 프리뷰 */}
      {viewMode === 'edit' ? (
        <textarea
          style={{ flex: 1, padding: '16px', fontFamily: 'monospace' }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      ) : (
        <IsolatedPreview html={renderHtml(content)} />
      )}
    </div>
  );
}

/**
 * 예제 3: AiPanel 응답 렌더링 (XSS 방지)
 *
 * AI가 생성한 HTML을 안전하게 표시
 */
export function AiPanelPreviewExample({ aiResponse }) {
  // AI 응답에 HTML이 포함될 수 있으므로 IsolatedPreview 사용
  return (
    <div style={{ height: '400px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <IsolatedPreview
        html={aiResponse}
        title="AI Response"
        style={{ borderRadius: '4px' }}
      />
    </div>
  );
}

/**
 * 예제 4: 커스텀 스타일링
 */
export function CustomStyledPreviewExample() {
  const html = `
    <h1>커스텀 프리뷰</h1>
    <p>iframe 스타일을 커스터마이징할 수 있습니다.</p>
  `;

  return (
    <IsolatedPreview
      html={html}
      className="my-custom-preview"
      style={{
        border: '2px solid #007bff',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        height: '500px'
      }}
    />
  );
}

/**
 * 예제 5: 에러 핸들링
 */
export function ErrorHandlingExample() {
  const [html, setHtml] = useState('<h1>정상 콘텐츠</h1>');

  const tryMaliciousContent = () => {
    // 이 내용은 sanitize에 의해 제거됨
    setHtml('<script>alert("XSS")</script><h1>악의적인 콘텐츠</h1>');
  };

  return (
    <div>
      <button onClick={tryMaliciousContent}>XSS 시도 (차단됨)</button>
      <div style={{ height: '400px', marginTop: '16px' }}>
        <IsolatedPreview
          html={html}
          onError={(err) => {
            console.error('프리뷰 에러:', err);
            alert('프리뷰 렌더링 실패');
          }}
        />
      </div>
    </div>
  );
}

/**
 * MikiEditor.jsx에 통합하는 방법:
 *
 * 1. import 추가
 *    import { IsolatedPreview } from './components/IsolatedPreview';
 *
 * 2. 프리뷰 모드에서 사용
 *    {viewMode === 'preview' && (
 *      <IsolatedPreview
 *        html={marked(currentDocument.content)}
 *        title={currentDocument.title}
 *      />
 *    )}
 *
 * 3. 기존 dangerouslySetInnerHTML 제거
 *    - 대신 IsolatedPreview 사용으로 XSS 완전 차단
 */
