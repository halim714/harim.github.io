/**
 * sanitize.js — HTML XSS 방지 유틸리티
 * DOMPurify를 사용하여 사용자 입력 HTML을 안전하게 정제합니다.
 *
 * Phase 1-T2: Security Foundation
 */

import DOMPurify from 'dompurify';

/**
 * HTML 문자열을 안전하게 정제합니다 (XSS 방지)
 *
 * @param {string} html - 정제할 HTML 문자열
 * @returns {string} 안전하게 정제된 HTML
 *
 * @example
 * const dirty = '<img src=x onerror=alert(1)>';
 * const clean = sanitizeHtml(dirty); // '<img src="x">'
 *
 * const markdown = '<script>alert("xss")</script><p>Hello</p>';
 * const safe = sanitizeHtml(markdown); // '<p>Hello</p>'
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string') {
    console.warn('[sanitize] Non-string input received:', typeof html);
    return '';
  }

  // DOMPurify 설정: 마크다운 렌더링에 안전한 태그만 허용
  const config = {
    // 허용할 태그 (마크다운 → HTML 변환 결과)
    ALLOWED_TAGS: [
      'p', 'br', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'u', 's', 'code', 'pre',
      'blockquote', 'hr',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'details', 'summary',
    ],

    // 허용할 속성
    ALLOWED_ATTR: [
      'href', 'title', 'alt', 'src',
      'class', 'id',
      'width', 'height',
      'align', 'style', // 제한적 허용 (DOMPurify가 위험 스타일 자동 필터링)
    ],

    // 프로토콜 화이트리스트 (javascript: 등 차단)
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,

    // 추가 보안 옵션
    ALLOW_DATA_ATTR: false, // data-* 속성 차단
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true, // Mustache/Template injection 방지
  };

  try {
    const cleaned = DOMPurify.sanitize(html, config);

    // 빈 문자열이 반환되면 원본이 위험했거나 비어있던 것
    if (html.trim() && !cleaned.trim()) {
      console.warn('[sanitize] All content was removed (likely XSS attempt):', html.slice(0, 100));
    }

    return cleaned;
  } catch (error) {
    console.error('[sanitize] DOMPurify error:', error);
    // 오류 발생 시 안전하게 빈 문자열 반환
    return '';
  }
}

/**
 * 마크다운 렌더링 결과를 정제 (편의 함수)
 *
 * @param {string} markdownHtml - marked.js 등으로 변환된 HTML
 * @returns {string} XSS 방지 처리된 안전한 HTML
 */
export function sanitizeMarkdown(markdownHtml) {
  return sanitizeHtml(markdownHtml);
}

export default { sanitizeHtml, sanitizeMarkdown };
