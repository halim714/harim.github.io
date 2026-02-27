import { createLogger } from './utils/logger';

const logger = createLogger('MikiEditor');
import { useRef, useCallback, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Editor } from '@toast-ui/react-editor';

import '@toast-ui/editor/dist/toastui-editor.css';
import '@toast-ui/editor/dist/theme/toastui-editor-dark.css'; // Optional: Dark theme
import DocumentSearchManager from './utils/DocumentSearchManager'; // 추가된 임포트
import { resolveByIdOrSlug } from './utils/DocumentResolver';
import { useConfirm } from './hooks/useConfirm';
import { sanitizeHtml } from './utils/sanitize';

// debounce 함수 정의
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Helper to slugify strings for internal links
const slugify = (str) => {
  if (!str || str.trim() === '') {
    // 빈 문자열이나 공백만 있는 경우 타임스탬프 기반 ID 생성
    return `doc-${Date.now()}`;
  }

  // 1단계: 기본 변환 (소문자로 변환, 양쪽 공백 제거)
  let result = str.toLowerCase().trim();

  // 2단계: URL에 안전하지 않은 문자 처리
  result = result
    // 연속된 공백, 특수문자를 하이픈으로 변환 (한글은 보존)
    .replace(/[\s\t\r\n]+/g, '-')  // 공백류 문자 변환
    .replace(/[^\w\u3131-\uD79D-]+/g, '-') // 한글(유니코드 범위)과 영숫자, 언더스코어를 제외한 문자를 하이픈으로 변환
    .replace(/-+/g, '-')  // 중복된 하이픈 제거
    .replace(/^-+|-+$/g, ''); // 시작/끝 하이픈 제거

  // 3단계: 결과가 빈 문자열이면 타임스탬프 사용
  if (!result || result === '') {
    return `doc-${Date.now()}`;
  }

  return result;
};

// 마크다운을 WYSIWYG 호환 형식으로 변환하는 함수
const convertMarkdownToHTML = (markdownText) => {
  if (!markdownText || typeof markdownText !== 'string') return markdownText;

  // 헤딩 변환 (# 제목 -> <h1>제목</h1>)
  const headingProcessed = markdownText
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^###### (.+)$/gm, '<h6>$1</h6>');

  // 굵게, 기울임, 취소선 변환
  const styleProcessed = headingProcessed
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>');

  // 목록 변환
  const listProcessed = styleProcessed
    .replace(/^- (.+)$/gm, '<ul><li>$1</li></ul>')
    .replace(/^\* (.+)$/gm, '<ul><li>$1</li></ul>')
    .replace(/^[0-9]+\. (.+)$/gm, '<ol><li>$1</li></ol>');

  // 코드 블록 및 인라인 코드
  const codeProcessed = listProcessed
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/```(.+?)```/gs, '<pre><code>$1</code></pre>');

  // 링크 및 이미지 변환
  const linkProcessed = codeProcessed
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">');

  // 인용문 변환
  const quoteProcessed = linkProcessed
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // XSS 방지: DOMPurify로 정제
  return sanitizeHtml(quoteProcessed);
};

// --- AI Suggestion Popover Component ---
const AiSuggestionPopover = ({ suggestion, onAccept, onCancel, position }) => {
  if (!suggestion || !suggestion.visible || suggestion.suggestionType === 'clarification_needed') return null;

  const positionStyle = {
    top: `${position?.top || 0}px`,
    left: `${position?.left || 0}px`,
  };

  return (
    <div
      style={positionStyle}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg p-3 shadow-lg max-w-sm"
    >
      <p className="mb-3 text-sm text-gray-700">{suggestion.displayText}</p>
      <div className="flex justify-end space-x-2">
        <button
          onClick={() => onAccept(suggestion)}
          className="px-4 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
        >
          Run
        </button>
        <button
          onClick={() => onCancel(suggestion.suggestionId)}
          className="px-4 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// --- Link Suggestion Popover Component ---
const LinkCreationPopover = ({ position, onCreateLink, onCancel, selectedText }) => {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useAiSearch, setUseAiSearch] = useState(false); // 기본: 키워드 검색 → 필요 시 AI 토글
  const docSearchManager = useMemo(() => new DocumentSearchManager(), []);

  // debounced 검색 함수
  const debouncedSearch = useCallback(
    debounce(async (searchTerm) => {
      if (!searchTerm || searchTerm.trim().length === 0) {
        setSearchResults([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        logger.info("링크 검색 시작:", searchTerm);

        // URL 형식인지 확인
        if (/^https?:\/\//i.test(searchTerm.trim())) {
          setSearchResults([{
            id: 'url',
            title: `URL: ${searchTerm.trim()}`,
            path: searchTerm.trim(),
            isUrl: true
          }]);
          setLoading(false);
          return;
        }

        // 검색 방식 선택 (AI 또는 키워드)
        let results;
        if (useAiSearch) {
          logger.info("AI 검색 모드로 실행 중...");
          // AI 검색 사용
          results = await docSearchManager.searchByAi(searchTerm);
        } else {
          logger.info("키워드 검색 모드로 실행 중...");
          // 키워드 검색만 사용
          results = await docSearchManager.searchByKeyword(searchTerm);
        }

        // 검색 결과가 없으면 새 문서 만들기 옵션 제공
        if (results.length === 0) {
          const searchQuery = searchTerm.trim();

          // 개선된 slugify 함수 정의 (내부용)
          const slugifyText = (text) => {
            if (!text || text.trim() === '') {
              return `doc-${Date.now()}`;
            }

            const result = text.toLowerCase().trim()
              .replace(/[\s\t\r\n]+/g, '-')
              .replace(/[^\w\u3131-\uD79D-]+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-+|-+$/g, '');

            return result || `doc-${Date.now()}`;
          };

          setSearchResults([{
            id: 'new_' + searchQuery,
            title: `"${searchQuery}" 새 문서 생성`,
            path: `/doc/${slugifyText(searchQuery)}`,
            preview: `"${searchQuery}" 문서를 새로 생성합니다.`,
            isCreateNew: true
          }]);
        } else {
          setSearchResults(results);
        }

        setLoading(false);
      } catch (err) {
        logger.error("검색 오류:", err);
        setError("검색 중 오류가 발생했습니다.");
        setSearchResults([]);
        setLoading(false);
      }
    }, 300),
    [useAiSearch] // useAiSearch 값이 변경될 때마다 함수 재생성
  );

  // 컴포넌트 마운트 시: 기본은 키워드 검색(빠름). 선택 텍스트가 있으면 즉시 키워드 검색만 수행
  useEffect(() => {
    if (selectedText && selectedText.trim().length > 0) {
      setInputValue(selectedText);
      // 강제로 키워드 검색을 우선 실행
      (async () => {
        setLoading(true);
        const kw = selectedText.trim();
        const results = await docSearchManager.searchByKeyword(kw);
        setSearchResults(results);
        setLoading(false);
      })();
    }
  }, [selectedText]);

  // 입력값 변경 핸들러
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setError(null);

    if (value.trim().length > 0) {
      setLoading(true);
      debouncedSearch(value);
    } else {
      setSearchResults([]);
    }
  };

  // 검색 결과 선택 핸들러: 부모 핸들러로 위임(선택 복원 포함)
  const handleResultClick = (result) => {
    const linkText = selectedText || result.title || result.path;
    const linkUrl = result.path;
    onCreateLink(linkUrl, linkText);
  };

  // 팝업 위치 계산 개선
  const calculatePopupPosition = () => {
    const popupWidth = 320;
    const popupHeight = 400;
    const margin = 10;

    // 화면 크기
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 기본 위치
    let calculatedTop = position.top;
    let calculatedLeft = position.left;

    // 오른쪽 경계 체크
    if (calculatedLeft + popupWidth > viewportWidth - margin) {
      calculatedLeft = viewportWidth - popupWidth - margin;
    }

    // 왼쪽 경계 체크
    if (calculatedLeft < margin) {
      calculatedLeft = margin;
    }

    // 아래쪽 경계 체크
    if (calculatedTop + popupHeight > viewportHeight - margin) {
      // 팝업을 위로 이동 (커서 위에 표시)
      calculatedTop = position.top - popupHeight - 10;

      // 위로 이동했는데도 화면 밖이면 화면 상단에 고정
      if (calculatedTop < margin) {
        calculatedTop = margin;
      }
    }

    return {
      top: calculatedTop,
      left: calculatedLeft
    };
  };

  const finalPosition = calculatePopupPosition();

  return (
    <div className="link-creation-popover" style={{
      position: 'fixed',
      top: `${finalPosition.top}px`,
      left: `${finalPosition.left}px`,
      zIndex: 9999,
      backgroundColor: 'white',
      border: '1px solid #ccc',
      borderRadius: '6px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      padding: '12px',
      width: window.innerWidth < 480 ? '280px' : '300px',
      maxHeight: '380px',
      overflow: 'auto',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <div style={{ fontWeight: 'bold' }}>링크 생성</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: '12px',
          color: '#666'
        }}>
          <span style={{ marginRight: '6px' }}>AI 검색</span>
          <label style={{
            position: 'relative',
            display: 'inline-block',
            width: '34px',
            height: '18px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={useAiSearch}
              onChange={() => setUseAiSearch(!useAiSearch)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: useAiSearch ? '#2196F3' : '#ccc',
              borderRadius: '14px',
              transition: '0.4s'
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '14px',
                width: '14px',
                left: useAiSearch ? '17px' : '3px',
                bottom: '2px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transition: '0.4s'
              }}></span>
            </span>
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="URL 또는 문서 검색어 입력..."
          value={inputValue}
          onChange={handleInputChange}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
          }}
          autoFocus
        />
      </div>

      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #3498db',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            animation: 'spin 2s linear infinite',
          }}></div>
          <style>
            {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            `}
          </style>
          <span style={{ marginLeft: '8px' }}>검색 중...</span>
        </div>
      ) : error ? (
        <div style={{
          color: 'red',
          padding: '10px',
          backgroundColor: '#fff8f8',
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          {error}
        </div>
      ) : (
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {searchResults.length === 0 && inputValue.trim() !== '' ? (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: '#666'
            }}>
              <p>검색 결과가 없습니다.</p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>
                다른 검색어를 시도하거나 새 문서를 생성하세요.
              </p>
            </div>
          ) : (
            searchResults.map((result, index) => (
              <div
                key={`${result.id}-${index}-${Date.now()}`}
                onClick={e => {
                  e.stopPropagation();
                  handleResultClick(result);
                }}
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  backgroundColor: result.isCreateNew ? '#f0f8ff' : (result.isSemanticMatch ? '#fff8e6' : 'white'),
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'background-color 0.2s',
                  borderRadius: '2px',
                  ':hover': {
                    backgroundColor: '#f5f5f5'
                  }
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = result.isCreateNew ? '#e6f0ff' : (result.isSemanticMatch ? '#fff0d0' : '#f5f5f5')}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = result.isCreateNew ? '#f0f8ff' : (result.isSemanticMatch ? '#fff8e6' : 'white')}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {result.title}
                  {result.isUrl && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '10px',
                      backgroundColor: '#e8f5e9',
                      color: '#43a047',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      verticalAlign: 'middle'
                    }}>URL</span>
                  )}
                </div>

                {result.preview && (
                  <div style={{
                    fontSize: '12px',
                    color: '#666',
                    marginTop: '4px',
                    whiteSpace: 'normal',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {result.preview}
                  </div>
                )}

                {result.isSemanticMatch && result.relevanceScore && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginTop: '4px',
                  }}>
                    <span style={{
                      fontSize: '10px',
                      color: '#ef6c00',
                      backgroundColor: '#fff3e0',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      fontWeight: '500',
                    }}>
                      <span style={{ marginRight: '2px' }}>✨</span>
                      관련도 {result.relevanceScore}%
                    </span>

                    {result.reason && (
                      <span style={{
                        fontSize: '10px',
                        color: '#757575',
                        marginLeft: '6px',
                        fontStyle: 'italic',
                      }}>
                        {result.reason.length > 40 ? result.reason.substring(0, 40) + '...' : result.reason}
                      </span>
                    )}
                  </div>
                )}

                {result.isCreateNew && (
                  <div style={{
                    fontSize: '10px',
                    color: '#1976d2',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: '500',
                  }}>
                    <span style={{ marginRight: '2px' }}>➕</span>
                    새 문서 생성
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div style={{
        marginTop: '10px',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 12px',
            backgroundColor: '#f0f0f0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          취소
        </button>

        <button
          onClick={() => {
            if (inputValue.trim()) {
              // URL 형식이면 그대로 사용
              if (/^https?:\/\//i.test(inputValue.trim())) {
                onCreateLink(inputValue.trim(), selectedText || inputValue.trim());
              } else {
                // 아니면 새 문서 생성 링크로 사용
                const slugify = (text) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
                onCreateLink(`/doc/${slugify(inputValue.trim())}`, selectedText || inputValue.trim());
              }
            }
          }}
          style={{
            padding: '6px 12px',
            backgroundColor: '#4c9aff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: inputValue.trim() ? 1 : 0.6,
          }}
          disabled={!inputValue.trim()}
        >
          링크 생성
        </button>
      </div>
    </div>
  );
};

// --- Link Button Component ---
const LinkButton = ({ position, onClick, selectedText }) => {
  return (
    <button
      style={{
        position: 'fixed',
        top: `${position?.top || 0}px`,
        left: `${position?.left || 0}px`,
        zIndex: 1000,
        transform: 'translateX(-50%)',
      }}
      className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 shadow-lg flex items-center justify-center"
      onClick={() => onClick(selectedText)}
      title="링크 생성"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
        <path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 10.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z" />
        <path d="M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z" />
      </svg>
    </button>
  );
};

// --- MikiEditor Component ---
const MikiEditor = forwardRef(({ onContentChange, onSendToAi, onContextUpdate, onNavigateRequest }, ref) => {
  const editorRef = useRef(null);
  const [currentContent, setCurrentContent] = useState('');
  const [editorSelection, setEditorSelection] = useState(null); // Store { range, text, cursor }
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [activeSuggestion, setActiveSuggestion] = useState(null); // Stores the AI suggestion object
  const [pendingCommand, setPendingCommand] = useState(null);
  const [showLinkButton, setShowLinkButton] = useState(false);
  const [linkButtonPosition, setLinkButtonPosition] = useState({ top: 0, left: 0 });
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkPopoverPosition, setLinkPopoverPosition] = useState({ top: 0, left: 0 });
  const lastContentRef = useRef(''); // 마지막 내용을 저장하기 위한 ref
  const updateCountRef = useRef(0); // 디버깅용 업데이트 카운터
  const [selectedTextForLink, setSelectedTextForLink] = useState(''); // 링크용 선택 텍스트 상태 추가
  const [savedSelection, setSavedSelection] = useState(null); // WYSIWYG용 선택 영역 저장
  const baselineContentRef = useRef(''); // 문서 로드 직후 기준 내용
  const hasEditedSinceLoadRef = useRef(false);

  // 플로팅 툴바 상태
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(true);

  // 🔥 NEW: useConfirm 훅 사용
  const confirm = useConfirm();

  // 에디터 컨텍스트 업데이트를 위한 디바운스 함수
  const debouncedContextUpdate = useCallback(
    debounce((markdownContent, selectionInfo) => {
      if (onContextUpdate) {
        onContextUpdate({ fullContent: markdownContent, selection: selectionInfo });
      }
    }, 300),
    [onContextUpdate]
  );

  // 에디터 내용 변경 콜백을 위한 디바운스 함수 (더 짧은 시간)
  const debouncedContentChange = useCallback(
    debounce((content) => {
      if (onContentChange && lastContentRef.current !== content) {
        // 실제 내용이 변경되었을 때만 호출
        lastContentRef.current = content;
        onContentChange(content);
      }
    }, 150), // 타이핑 응답성을 위해 짧게 설정
    [onContentChange]
  );

  // 편집 커서가 하단에 너무 붙지 않도록 스크롤을 보정하는 유틸들
  const findOuterScrollContainer = (element) => {
    let node = element;
    while (node) {
      if (node.classList && node.classList.contains('editor-outer-scroll')) return node;
      node = node.parentElement;
    }
    return null;
  };

  const findScrollParent = (element) => {
    let node = element?.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY || style.overflow;
      if (/auto|scroll/i.test(overflowY)) return node;
      node = node.parentElement;
    }
    return window;
  };

  const ensureCaretBottomBuffer = useCallback((options = {}) => {
    try {
      if (!editorRef.current) return;
      const instance = editorRef.current.getInstance();
      const editorRoot = instance.wwEditor?.el || instance.mdEditor?.el;
      if (!editorRoot) return;
      const prose = editorRoot.querySelector('.ProseMirror') || editorRoot;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      let caretRect = null;
      const rects = range.getClientRects();
      if (rects && rects.length > 0) {
        caretRect = rects[rects.length - 1];
      } else {
        const approx = prose.getBoundingClientRect();
        caretRect = { top: approx.bottom - 1, bottom: approx.bottom, left: approx.left, right: approx.left + 1, height: 1, width: 1 };
      }

      const outerContainer = findOuterScrollContainer(editorRoot);
      const scrollParent = outerContainer || findScrollParent(prose) || window;

      const containerRect = (scrollParent instanceof Window || scrollParent === window)
        ? { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }
        : scrollParent.getBoundingClientRect();

      const lineHeightPx = parseInt(getComputedStyle(prose).lineHeight, 10) || 20;
      const toolbar = document.querySelector('.miki-floating-toolbar');
      const toolbarBuffer = toolbar ? (toolbar.getBoundingClientRect().height + 12) : 0;
      const minLines = typeof options.minLines === 'number' ? options.minLines : 3;
      const minBuffer = (minLines * lineHeightPx) + toolbarBuffer;

      const distanceToBottom = containerRect.bottom - caretRect.bottom;
      if (distanceToBottom < minBuffer) {
        const need = minBuffer - distanceToBottom;
        if (scrollParent instanceof Window || scrollParent === window || scrollParent === document.scrollingElement || scrollParent === document.documentElement || scrollParent === document.body) {
          window.scrollBy({ top: need, behavior: 'smooth' });
        } else {
          scrollParent.scrollTo({ top: scrollParent.scrollTop + need, behavior: 'smooth' });
        }
      }
    } catch { }
  }, []);

  // Handles editor content and selection changes - 디바운스 처리
  const handleEditorActivity = useCallback(
    debounce(() => {
      if (!editorRef.current) return;
      const instance = editorRef.current.getInstance();
      const markdownContent = instance.getMarkdown();
      const selection = instance.getSelection(); // [[line, char], [line, char]]
      const selectedText = instance.getSelectedText();
      let cursorPositionInfo = null;
      if (selection && selection.length === 2 && selection[0] && selection[0].length === 2) {
        cursorPositionInfo = selection[0]; // [line, char] for the start of the selection or cursor
      }

      const selectionInfo = {
        range: selection,
        text: selectedText,
        cursor: cursorPositionInfo,
      };

      // 내용이 변경된 경우에만 상태 업데이트 및 콜백 호출
      if (currentContent !== markdownContent) {
        updateCountRef.current++;

        // 개발 로그는 10회마다 출력 (로그 수 감소)
        if (updateCountRef.current % 10 === 0) {
          logger.info(`에디터 내용 업데이트 (${updateCountRef.current}회): 길이=${markdownContent.length}`);
        }

        setCurrentContent(markdownContent);
        debouncedContentChange(markdownContent);
      }

      setEditorSelection(selectionInfo);
      // 에디터에 포커스가 있으면 툴바 노출
      setShowFloatingToolbar(true);
      debouncedContextUpdate(markdownContent, selectionInfo);
    }, 50), // 50ms 디바운스로 업데이트 빈도 제한
    [debouncedContextUpdate, debouncedContentChange, currentContent]
  );

  // 텍스트 선택 시 링크 버튼 표시 처리
  const handleSelectionChange = useCallback(() => {
    if (!editorRef.current) return;
    const instance = editorRef.current.getInstance();
    const selectedText = instance.getSelectedText();

    if (selectedText && selectedText.trim().length > 0) {
      // 선택 영역 위치 계산
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // 에디터 요소의 경계 가져오기
        const editorEl = instance.wwEditor?.el || instance.mdEditor?.el;
        const editorRect = editorEl ? editorEl.getBoundingClientRect() : { left: 0, right: window.innerWidth };

        // 선택된 텍스트의 중간 지점 계산
        const leftPos = rect.left + (rect.width / 2);

        // 선택된 텍스트 저장
        setSelectedTextForLink(selectedText);

        // 링크 버튼 위치 설정 (선택 텍스트 중간 지점 기준)
        setLinkButtonPosition({
          top: rect.bottom + window.scrollY + 5, // 텍스트 아래에 약간의 여백 추가
          left: leftPos // 텍스트의 중간 위치
        });
        setShowLinkButton(true);
        setShowFloatingToolbar(true);
      }
    } else {
      setShowLinkButton(false);
    }
  }, []);

  // 에디터 이벤트 리스너 수정 - 최적화
  useEffect(() => {
    const instance = editorRef.current?.getInstance();
    if (instance) {
      // 이전 리스너 모두 제거
      instance.off('change');
      instance.off('caretChange');

      // 필수 이벤트만 등록
      instance.on('change', () => {
        hasEditedSinceLoadRef.current = true;
        handleEditorActivity();
        // 커서가 하단에 붙지 않도록 자동 스크롤 보정
        ensureCaretBottomBuffer({ minLines: 3 });
      });

      // 캐럿 변경은 선택 변경에만 영향을 줌
      instance.on('caretChange', () => {
        handleSelectionChange();
        ensureCaretBottomBuffer({ minLines: 3 });
      });

      const editorRoot = instance.wwEditor?.el || instance.mdEditor?.el;
      if (editorRoot) {
        // 키보드 관련 이벤트는 키다운만 사용 (중복 방지)
        const handleEditorKeyDown = (event) => {
          // Baseline 이전으로의 Undo 차단: 내용이 기준선과 동일하면 더 이상 되돌리지 않음
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
            try {
              const content = instance.getMarkdown();
              if (!hasEditedSinceLoadRef.current || content === baselineContentRef.current) {
                event.preventDefault();
                return;
              }
            } catch { }
          }

          // Enter 키 처리를 위한 로직 - AI 연동
          if (event.key === 'Enter' && !event.shiftKey) {
            const currentSelection = instance.getSelection();
            if (currentSelection && currentSelection.length > 0 && currentSelection[0] && currentSelection[0].length > 0) {
              const lineIndex = currentSelection[0][0]; // 0-based line index
              const currentLineText = instance.getMarkdown().split('\n')[lineIndex];

              if (currentLineText && currentLineText.trim().length > 0 && onSendToAi) {
                // 콘솔 로그 최소화
                // logger.info(`Enter pressed on line ${lineIndex + 1}`);

                onSendToAi({
                  text: currentLineText.trim(),
                  type: 'user_command_editor_enter',
                  commandContext: {
                    lineNumber: lineIndex + 1, // 1-based for AI
                    fullLineText: currentLineText,
                    currentSelection: editorSelection, // Send full editor selection context
                    fullContent: instance.getMarkdown()
                  }
                });
              }
            }
          }
        };

        // 링크 클릭 이벤트 핸들러 추가
        const handleLinkClick = (event) => {
          const link = event.target.closest('a');
          if (link && link.getAttribute('href')) { // .href 대신 getAttribute 사용
            const href = link.getAttribute('href');
            // 내부 문서 링크인지 확인 (/doc/ 접두사)
            if (href.startsWith('/doc/')) {
              event.preventDefault();
              event.stopPropagation();

              // 문서 경로 추출
              const docPath = href.split('/doc/')[1].replace('/', '');
              logger.info(`내부 문서 링크 클릭: ${docPath}`);

              // 부모 컴포넌트(App.jsx)의 네비게이션 함수 호출
              if (onNavigateRequest) {
                onNavigateRequest(docPath);
              } else {
                logger.warn('onNavigateRequest prop이 MikiEditor에 전달되지 않았습니다.');
              }
            } else if (href.startsWith('http')) {
              // 외부 링크는 새 탭에서 열기
              event.preventDefault();
              window.open(href, '_blank', 'noopener,noreferrer');
            }
            // 그 외 (mailto: 등)는 기본 동작 허용
          }
        };

        // 붙여넣기 이벤트 (주요 이벤트이므로 유지)
        const handlePaste = () => {
          // 붙여넣기 후 약간의 지연을 주어 내용이 반영된 후 호출
          setTimeout(handleEditorActivity, 10);
        };

        // 이벤트 리스너 정리 - 필수 이벤트만 등록
        editorRoot.addEventListener('keydown', handleEditorKeyDown);
        editorRoot.addEventListener('paste', handlePaste);
        editorRoot.addEventListener('mouseup', handleSelectionChange);
        editorRoot.addEventListener('click', handleLinkClick); // 링크 클릭 이벤트 추가

        return () => {
          editorRoot.removeEventListener('keydown', handleEditorKeyDown);
          editorRoot.removeEventListener('paste', handlePaste);
          editorRoot.removeEventListener('mouseup', handleSelectionChange);
          editorRoot.removeEventListener('click', handleLinkClick);
        };
      }
    }
  }, [handleEditorActivity, onSendToAi, editorSelection, commandHistory, historyPointer, ref, handleSelectionChange, onNavigateRequest]);

  // Calculates position for the suggestion popover
  const calculateSuggestionPosition = (actionRange) => {
    if (!editorRef.current) return { top: 100, left: 100 }; // Default fallback
    const editorInstance = editorRef.current.getInstance();
    const editorDomElement = editorInstance.wwEditor?.el || editorInstance.mdEditor?.el;
    if (!editorDomElement) return { top: 100, left: 100 };
    const editorRect = editorDomElement.getBoundingClientRect();

    let targetRangeForPos = actionRange;
    if (typeof actionRange === 'string') {
      if (actionRange === 'cursor' || actionRange === 'selection') {
        targetRangeForPos = editorSelection?.range;
      }
      // 'document_start', 'document_end', 'line_number' might need more specific handling
    }

    if (targetRangeForPos && targetRangeForPos.from && Array.isArray(targetRangeForPos.from)) {
      try {
        const winSel = window.getSelection();
        if (winSel && winSel.rangeCount > 0) {
          const range = winSel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (editorDomElement.contains(range.commonAncestorContainer) && (rect.width > 0 || rect.height > 0)) {
            return {
              top: rect.bottom + window.scrollY + 5,
              left: rect.left + window.scrollX,
            };
          }
        }
        // Fallback if window selection is not useful or not in editor
        const approxLineHeight = 20;
        const targetLine = targetRangeForPos.from[0]; // 0-based line
        return {
          top: editorRect.top + window.scrollY + (targetLine * approxLineHeight) + approxLineHeight + 10,
          left: editorRect.left + window.scrollX + editorRect.width * 0.1, // Indent a bit
        };
      } catch (e) {
        logger.warn("Error calculating suggestion position from range, using fallback.", e);
      }
    }
    // General fallback if no specific range info
    return { top: editorRect.top + window.scrollY + 50, left: editorRect.left + window.scrollX + 50 };
  };

  /**
   * AI 액션을 에디터에 적용하는 함수
   * @param {Object} action - 적용할 액션 객체
   * @param {Object} editorInstance - 에디터 인스턴스
   * @returns {boolean} - 액션 적용 성공 여부
   */
  const _applySingleActionToEditor = (action, editorInstance) => {
    if (!action || !editorInstance) return false;
    try {
      switch (action.actionType) {
        // 일반 텍스트 삽입 (대화/글 확장)
        case 'insert_content':
          editorInstance.insertText(action.content);
          return true;
        // 선택/범위 교체 또는 전체 교체
        case 'replace_content': {
          const contentToInsert = action.content || '';
          if (action.range && action.range.from && action.range.to) {
            editorInstance.replaceSelection(
              contentToInsert,
              action.range.from,
              action.range.to
            );
            return true;
          }
          const currentSel = editorInstance.getSelection();
          if (currentSel && Array.isArray(currentSel) && currentSel[0] && currentSel[1]) {
            editorInstance.replaceSelection(contentToInsert, currentSel[0], currentSel[1]);
            return true;
          }
          editorInstance.setMarkdown(contentToInsert || '');
          return true;
        }
        // 마크다운 링크 삽입
        case 'insert_markdown_link':
          editorInstance.insertText(action.content);
          return true;
        // 기존 문서 복원 (전체 문서 교체)
        case 'restore_document':
          if (action.range === 'full_document') {
            editorInstance.setMarkdown(action.content || '');
            return true;
          }
          return false;
        // 특정 라인 교체
        case 'replace_line': {
          const currentMarkdown = editorInstance.getMarkdown();
          const lines = currentMarkdown.split('\n');
          let lineNumber = action.lineNumber;
          if (!lineNumber && Array.isArray(action.range?.from)) {
            lineNumber = (action.range.from[0] ?? 0) + 1; // 1-based
          }
          if (!lineNumber) {
            const sel = editorInstance.getSelection();
            if (sel && sel[0]) lineNumber = sel[0][0] + 1;
          }
          if (lineNumber && lineNumber >= 1 && lineNumber <= lines.length) {
            lines[lineNumber - 1] = action.content || '';
            editorInstance.setMarkdown(lines.join('\n'));
            return true;
          }
          return false;
        }
        // 하이라이트 (강조 표시)
        case 'highlight':
          if (action.content) {
            editorInstance.insertText(`\n\n📌 **강조:** ${action.content}\n`);
            return true;
          }
          return false;

        // 노트 추가
        case 'note':
          if (action.content) {
            editorInstance.insertText(`\n\n💡 **메모:** ${action.content}\n`);
            return true;
          }
          return false;

        // 서식 적용 (formatting)
        case 'formatting':
          if (action.target === 'title' && action.style === 'bold') {
            const currentContent = editorInstance.getMarkdown();
            const lines = currentContent.split('\n');
            if (lines.length > 0) {
              const title = lines[0].trim();
              if (title && !title.startsWith('**')) {
                lines[0] = `**${title}**`;
                editorInstance.setMarkdown(lines.join('\n'));
                return true;
              }
            }
          }
          return false;
        // 인라인 서식 적용
        case 'apply_style': {
          const style = action.commandType || action.style;
          const sel = editorInstance.getSelection();
          const selectedText = editorInstance.getSelectedText();
          const wrap = (l, r) => editorInstance.replaceSelection(`${l}${selectedText}${r}`, sel[0], sel[1]);
          if (!selectedText) return false;
          if (style === 'bold') { wrap('**', '**'); return true; }
          if (style === 'italic') { wrap('*', '*'); return true; }
          if (style === 'strike') { wrap('~~', '~~'); return true; }
          if (style === 'quote') { editorInstance.replaceSelection(`> ${selectedText}`, sel[0], sel[1]); return true; }
          if (style === 'code') { wrap('`', '`'); return true; }
          return false;
        }

        // 문서 지우기
        case 'clear_document':
          editorInstance.setMarkdown('');
          logger.info('문서 내용이 모두 삭제되었습니다.');
          return true;

        // 기타 마크다운 서식 액션들 (예시)
        case 'format_bold':
        case 'format_italic':
          // 필요시 서식 처리 추가
          return true;

        // 헤딩 생성
        case 'create_heading': {
          const content = action.content || '# New Heading';
          const sel = editorInstance.getSelection();
          if (sel && sel[0]) {
            const current = editorInstance.getMarkdown().split('\n');
            const line = sel[0][0];
            current[line] = content;
            editorInstance.setMarkdown(current.join('\n'));
            return true;
          }
          editorInstance.insertText(`\n${content}\n`);
          return true;
        }

        // 리스트 생성
        case 'create_list': {
          const listType = action.commandType || 'ul';
          const items = Array.isArray(action.content) ? action.content : [action.content || 'Item'];
          let block = '';
          if (listType === 'ol') {
            block = items.map((it, idx) => `${idx + 1}. ${it}`).join('\n');
          } else if (listType === 'taskList') {
            block = items.map(it => `- [ ] ${it}`).join('\n');
          } else {
            block = items.map(it => `- ${it}`).join('\n');
          }
          editorInstance.insertText(`\n${block}\n`);
          return true;
        }

        // 테이블 생성
        case 'create_table': {
          const cfg = typeof action.content === 'object' ? action.content : {};
          const cols = Math.max(1, parseInt(cfg.cols, 10) || 2);
          const rows = Math.max(1, parseInt(cfg.rows, 10) || 2);
          const headers = Array.isArray(cfg.headers) && cfg.headers.length > 0
            ? cfg.headers.slice(0, cols)
            : Array(cols).fill(null).map((_, i) => `Header ${i + 1}`);
          const headerRow = `| ${headers.join(' | ')} |`;
          const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
          const bodyRows = Array(rows).fill(null)
            .map(() => `| ${Array(cols).fill('').join(' | ')} |`)
            .join('\n');
          const tableMarkdown = `${headerRow}\n${separatorRow}\n${bodyRows}\n`;
          editorInstance.insertText(`\n${tableMarkdown}\n`);
          return true;
        }

        // 코드 블록 삽입
        case 'insert_code_block': {
          const language = action.commandType || '';
          const code = action.content || '';
          const block = `\n\n\
\`\`\`${language}\n${code}\n\`\`\`\n\n`;
          editorInstance.insertText(block);
          return true;
        }

        default:
          logger.warn(`지원되지 않는 액션 타입: ${action.actionType}`);
          return false;
      }
    } catch (e) {
      logger.error('액션 적용 오류:', e);
      return false;
    }
  };

  // Handles accepting an AI suggestion
  const handleAcceptSuggestion = (suggestion) => {
    if (!editorRef.current || !suggestion || !Array.isArray(suggestion.actions) || suggestion.actions.length === 0) {
      setActiveSuggestion(null);
      logger.warn('Attempted to accept an invalid or empty suggestion:', suggestion);
      return;
    }
    const editorInstance = editorRef.current.getInstance();
    const beforeStateAllActions = editorInstance.getMarkdown();
    let anyActionApplied = false;

    suggestion.actions.forEach(action => {
      // Validate action structure here if needed, or assume valid from AI
      const commandApplied = _applySingleActionToEditor(action, editorInstance);
      if (commandApplied) {
        anyActionApplied = true;
      }
    });

    if (anyActionApplied) {
      const afterStateAllActions = editorInstance.getMarkdown();
      if (beforeStateAllActions !== afterStateAllActions) {
        const newHistory = commandHistory.slice(0, historyPointer + 1);
        newHistory.push({
          before: beforeStateAllActions,
          after: afterStateAllActions,
          // Store the whole suggestion for context, or just the applied actions
          command: { type: "ai_suggestion", suggestionId: suggestion.suggestionId, actions: suggestion.actions }
        });
        setCommandHistory(newHistory);
        setHistoryPointer(newHistory.length - 1);
      }
      handleEditorActivity(); // Update context after applying actions
    }
    setActiveSuggestion(null); // Hide popover
  };

  // Handles cancelling an AI suggestion
  const handleCancelSuggestion = (suggestionId) => {
    setActiveSuggestion(null);
    // Optionally, send feedback to AI that suggestion was cancelled
  };

  // 4단계: AI 구조화 명령 적용 함수
  const handleApplySuggestion = useCallback(() => {
    if (!pendingCommand || !editorRef.current) return;
    logger.info("구조화 명령 적용 시도:", pendingCommand); // 디버깅 로그 추가
    const editorInstance = editorRef.current.getInstance();
    let anyActionApplied = false;

    // 다양한 명령 형식 처리
    if (pendingCommand.actions && Array.isArray(pendingCommand.actions)) {
      // v7 actions 배열 형식
      pendingCommand.actions.forEach(action => {
        const commandApplied = _applySingleActionToEditor(action, editorInstance);
        if (commandApplied) anyActionApplied = true;
      });
    } else if (pendingCommand.action && typeof pendingCommand.action === 'object') {
      // action 객체가 직접 있는 경우
      const commandApplied = _applySingleActionToEditor(pendingCommand.action, editorInstance);
      if (commandApplied) anyActionApplied = true;
    } else if (pendingCommand.actionType) {
      // 자체가 액션 객체인 경우
      const commandApplied = _applySingleActionToEditor(pendingCommand, editorInstance);
      if (commandApplied) anyActionApplied = true;
    } else if (pendingCommand.displayText && !pendingCommand.isSuggestion) {
      // 단순 표시용 텍스트만 있는 경우
      logger.info("표시용 텍스트 응답:", pendingCommand.displayText);
      // 아무 액션도 수행하지 않음
    } else {
      logger.warn("알 수 없는 명령 형식:", pendingCommand);
    }

    if (anyActionApplied) {
      handleEditorActivity();
      logger.info("구조화 명령 적용 성공"); // 디버깅 로그 추가
    } else {
      logger.warn("구조화 명령 적용 실패 또는 표시 전용 명령"); // 디버깅 로그 추가
    }
    setPendingCommand(null);
  }, [pendingCommand, editorRef, handleEditorActivity]);

  // AiPanel에서 구조화 명령을 받는 콜백
  const handleStructuredCommand = useCallback((cmd) => {
    setPendingCommand(cmd);
  }, []);

  // pendingCommand가 변경될 때 handleApplySuggestion 호출
  useEffect(() => {
    if (pendingCommand) {
      handleApplySuggestion();
    }
  }, [pendingCommand, handleApplySuggestion]);

  // Expose methods to parent component (App.js)
  useImperativeHandle(ref, () => ({
    insertText(textToInsert, atRange) { // Simple text insertion, can be part of AI action too
      if (editorRef.current) {
        const instance = editorRef.current.getInstance();
        if (instance.getMode && instance.getMode() !== 'wysiwyg') instance.changeMode('wysiwyg');
        const beforeState = instance.getMarkdown();

        let insertFrom = atRange?.from;
        let insertTo = atRange?.to;
        if (!insertFrom || !insertTo) {
          const currentSel = instance.getSelection();
          insertFrom = currentSel[0];
          insertTo = currentSel[0]; // insert at cursor start
        }

        instance.replaceSelection(textToInsert, insertFrom, insertTo);

        const afterState = instance.getMarkdown();
        if (beforeState !== afterState) {
          const newHistory = commandHistory.slice(0, historyPointer + 1);
          newHistory.push({ before: beforeState, after: afterState, command: { type: 'insertText', content: textToInsert } });
          setCommandHistory(newHistory);
          setHistoryPointer(newHistory.length - 1);
        }
        handleEditorActivity();
      }
    },
    // App.jsx에서 호출하는 applyStructuredAiCommand 메서드 구현
    async applyStructuredAiCommand(commandAction) {
      logger.info("applyStructuredAiCommand 호출됨:", commandAction);

      // 사용자 확인이 필요한 명령인지 확인
      const requiresConfirmation = true; // 모든 명령에 대해 사용자 확인 필요

      if (requiresConfirmation) {
        // 명령 내용 설명 준비
        let actionDesc = "에디터 내용을 수정하려고 합니다.";
        if (commandAction.displayText) {
          actionDesc = commandAction.displayText;
        } else if (commandAction.actionType) {
          actionDesc = `${commandAction.actionType} 작업을 수행하려고 합니다.`;
        }

        // 사용자 확인 요청
        const ok = await confirm({
          title: 'AI 작업 승인',
          message: `AI가 다음 작업을 수행하려고 합니다:\n\n${actionDesc}\n\n허용하시겠습니까?`,
          danger: false,
        });

        if (ok) {
          // 사용자가 확인한 경우에만 명령 실행
          handleStructuredCommand(commandAction);
        } else {
          logger.info("사용자가 명령 실행을 취소했습니다.");
        }
      } else {
        // 즉시 실행이 필요한 특수한 경우가 있다면 여기에 추가
        handleStructuredCommand(commandAction);
      }
    },
    undo() {
      if (historyPointer < 0) return;
      const lastEdit = commandHistory[historyPointer];
      editorRef.current.getInstance().setMarkdown(lastEdit.before);
      setHistoryPointer(historyPointer - 1);
      handleEditorActivity();
    },
    redo() {
      if (historyPointer + 1 >= commandHistory.length) return;
      const nextEdit = commandHistory[historyPointer + 1];
      editorRef.current.getInstance().setMarkdown(nextEdit.after);
      setHistoryPointer(historyPointer + 1);
      handleEditorActivity();
    },
    displayAiSuggestion(suggestionObject) {
      // Expect suggestionObject to be the parsed JSON from AI according to v7 schema
      const isSuggestion = suggestionObject?.isSuggestion === true || suggestionObject?.isSuggestion === 'true';

      if (suggestionObject && isSuggestion && suggestionObject.actions && suggestionObject.actions.length > 0) {
        // Determine position based on the first action's range, or a general position
        const firstActionRange = suggestionObject.actions[0].range;
        const pos = calculateSuggestionPosition(firstActionRange);
        setActiveSuggestion({ ...suggestionObject, visible: true, position: pos });

        // 사용자에게 제안 내용 알림을 위한 로그
        logger.info("✅ 에디터에 AI 제안이 표시됩니다:", suggestionObject.displayText);
      } else if (suggestionObject && suggestionObject.suggestionType === 'clarification_needed') {
        // Handle clarification requests (e.g., show a different UI or send to AiPanel)
        logger.info("Clarification needed from AI:", suggestionObject.displayText, suggestionObject.clarificationDetails);
        // For now, just log it. AiPanel could handle this.
        if (onSendToAi && suggestionObject.clarificationDetails && suggestionObject.clarificationDetails.query) {
          // Example: Forward clarification to AiPanel to display options
          // This part needs AiPanel to be able to handle such interactions
        }
        setActiveSuggestion(null); // Don't show standard popover for clarifications
      } else {
        logger.warn('❌ AI 제안 표시 실패 - 유효하지 않은 제안 객체:', {
          hasSuggestionObject: !!suggestionObject,
          isSuggestion: suggestionObject?.isSuggestion,
          hasActions: !!suggestionObject?.actions,
          actionsLength: suggestionObject?.actions?.length,
          suggestionObject
        });
        setActiveSuggestion(null); // Hide popover if any
      }
    },
    getEditorInstance() {
      return editorRef.current?.getInstance();
    },
    getCurrentContext() {
      return { fullContent: currentContent, selection: editorSelection };
    }
  }));

  // 링크 버튼 클릭 핸들러
  const handleLinkButtonClick = useCallback((selectedText) => {
    logger.info("링크 버튼 클릭됨, 선택된 텍스트:", selectedText);
    // 선택 영역 저장 (WYSIWYG 모드에서 필요)
    if (editorRef.current) {
      const instance = editorRef.current.getInstance();
      setSavedSelection(instance.getSelection());
    }
    setLinkPopoverPosition(linkButtonPosition);
    setShowLinkButton(false);
    setShowLinkPopover(true);
  }, [linkButtonPosition]);

  // 링크 생성 핸들러
  const handleLinkCreate = useCallback((linkUrl, linkText) => {
    logger.info(`링크 생성: ${linkText} -> ${linkUrl}`);
    if (!editorRef.current) return;

    const editor = editorRef.current.getInstance();

    try {
      // 저장된 선택 범위 복원(WYSIWYG 모드에서 커서 이동 문제 방지)
      try {
        if (savedSelection && Array.isArray(savedSelection) && savedSelection[0] && savedSelection[1]) {
          editor.setSelection(savedSelection[0], savedSelection[1]);
        }
      } catch { }

      if (editor.isWysiwygMode()) {
        // WYSIWYG 모드: Toast UI Editor의 addLink 명령 사용
        try {
          editor.exec('addLink', {
            linkText: linkText || linkUrl,
            linkUrl: linkUrl
          });
          logger.info(`WYSIWYG 모드에서 링크 삽입 성공: ${linkText} -> ${linkUrl}`);
        } catch (addLinkError) {
          logger.warn('addLink 명령 실패, 대체 방법 시도:', addLinkError);

          // 대체 방법: HTML 직접 삽입
          const linkHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText || linkUrl}</a>`;
          editor.insertHTML(linkHtml);
          logger.info(`HTML 직접 삽입으로 링크 생성 성공`);
        }
      } else {
        // 마크다운 모드: 마크다운 문법으로 삽입
        const markdownLink = `[${linkText || linkUrl}](${linkUrl})`;
        editor.insertText(markdownLink);
        logger.info(`마크다운 모드에서 링크 삽입: ${markdownLink}`);
      }
    } catch (error) {
      logger.error("링크 생성 오류:", error);

      // 최후의 방법: 클립보드에 복사 후 알림
      try {
        const fallbackText = `[${linkText || linkUrl}](${linkUrl})`;
        navigator.clipboard.writeText(fallbackText);
        alert(`링크 생성에 실패했습니다. 마크다운 링크가 클립보드에 복사되었습니다:\n${fallbackText}\n\nCtrl+V로 붙여넣기 해주세요.`);
      } catch (clipboardErr) {
        logger.error("클립보드 복사 실패:", clipboardErr);
        alert(`링크 생성에 실패했습니다. 수동으로 링크를 추가해주세요:\n[${linkText || linkUrl}](${linkUrl})`);
      }
    }

    setShowLinkPopover(false);
  }, []);

  // 링크 생성 취소 핸들러
  const handleCancelLinkCreation = useCallback(() => {
    setShowLinkPopover(false);
  }, []);

  // EditorUI 스타일 참조
  const editorStyle = {
    height: '100%',
    overflow: 'visible', // 스크롤은 외부 래퍼에서만
    display: 'flex',
    flexDirection: 'column',
  };

  // 에디터 인스턴스 관련 스타일
  const toastUIEditorStyle = {
    flex: 1,
    overflow: 'visible', // 스크롤은 외부 래퍼에서만
    minHeight: '200px',
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
  };

  // 전역 접근을 위해 window 객체에 설정
  useEffect(() => {
    window.editorRef = editorRef;
    const setPublishing = (flag) => {
      try {
        editorRef.current && (editorRef.current.isPublishing = flag);
      } catch { }
    };
    const onStart = () => setPublishing(true);
    const onFinish = () => setPublishing(false);
    window.addEventListener('miki:publish:started', onStart);
    window.addEventListener('miki:publish:finished', onFinish);
    return () => {
      delete window.editorRef;
      window.removeEventListener('miki:publish:started', onStart);
      window.removeEventListener('miki:publish:finished', onFinish);
    };
  }, []);

  // 에디터에 문서 로드하는 함수
  const loadDocumentToEditor = useCallback(async (docData, linkText) => {
    logger.info(`에디터에 문서 로드: ${docData.title || linkText}`);

    try {
      // 현재 문서가 변경되었으면 저장 여부 확인
      if (currentContent && currentContent.trim() !== '' && onContentChange) {
        const ok = await confirm({
          title: '변경사항 저장',
          message: '현재 문서에 저장되지 않은 변경사항이 있습니다.\n\n저장하고 새 문서를 여시겠습니까?',
          danger: false,
        });

        if (ok) {
          // 현재 문서 저장 로직 호출 (App.jsx의 saveCurrentDocument)
          if (window.saveCurrentDocument) {
            await window.saveCurrentDocument();
          }
        }
      }

      // 에디터에 새 문서 내용 로드
      if (editorRef.current) {
        const editor = editorRef.current.getInstance();
        const content = docData.content || '';

        editor.setMarkdown(content);
        logger.info(`에디터에 내용 로드 완료: ${content.length}자`);
        // Undo 베이스라인 설정
        baselineContentRef.current = content;
        hasEditedSinceLoadRef.current = false;
      }

      // 상태 업데이트 (App.jsx의 상태 업데이트 함수들 호출)
      if (window.setCurrentDocument) window.setCurrentDocument(docData);
      if (window.setTitle) window.setTitle(docData.title || linkText || '');
      if (window.setSaveStatus) window.setSaveStatus('저장됨');

      // 사용자에게 성공 알림
      if (onContextUpdate) {
        onContextUpdate({
          message: {
            type: 'success',
            text: `"${docData.title || linkText}" 문서를 열었습니다.`
          }
        });
      }

      logger.info(`문서 로드 완료: ${docData.title || linkText}`);
    } catch (error) {
      logger.error('에디터 문서 로드 오류:', error);
      throw error;
    }
  }, [currentContent, onContentChange, onContextUpdate]);

  // 새 문서 생성 함수
  const createNewDocument = useCallback((title) => {
    logger.info(`새 문서 생성: ${title}`);

    try {
      // 에디터 초기화
      if (editorRef.current) {
        const editor = editorRef.current.getInstance();
        const initialContent = `# ${title}\n\n`;
        editor.setMarkdown(initialContent);
      }

      // 상태 업데이트
      if (window.setCurrentDocument) window.setCurrentDocument(null);
      if (window.setTitle) window.setTitle(title);
      if (window.setSaveStatus) window.setSaveStatus('변경됨');

      // 사용자에게 알림
      if (onContextUpdate) {
        onContextUpdate({
          message: {
            type: 'info',
            text: `"${title}" 새 문서를 생성했습니다.`
          }
        });
      }

      logger.info(`새 문서 생성 완료: ${title}`);
    } catch (error) {
      logger.error('새 문서 생성 오류:', error);
    }
  }, [onContextUpdate]);

  return (
    <div style={{
      position: 'relative',
      height: '100%',
      overflow: 'visible',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }} className="miki-editor-container flex-grow">
      <Editor
        ref={editorRef}
        initialValue=""
        previewStyle={window.innerWidth > 1000 ? 'vertical' : 'tab'}
        height="100%"
        initialEditType="wysiwyg"
        hideModeSwitch={true}
        useCommandShortcut={true} // Enables default shortcuts, but we override some
        theme={localStorage.getItem('theme') === 'dark' ? 'dark' : 'default'}
        usageStatistics={false}
        // 링크 클릭 활성화 설정
        linkAttributes={{
          target: '_self', // 같은 탭에서 열기
          rel: null // rel 속성 제거
        }}
        // 서식 도구모음 추가
        toolbarItems={[
          ['heading', 'bold', 'italic', 'strike'],
          ['hr', 'quote', 'ul', 'ol', 'task'],
          ['table', 'image', 'link'],
          ['code', 'codeblock']
        ]}
        // 에디터 확장 옵션 추가
        extendedAutolinks={true}
        // WYSIWYG 모드에서 링크 클릭 허용
        viewer={false}
        customHTMLRenderer={{
          // 마크다운 문법이 WYSIWYG에서 제대로 표시되도록 사용자 정의 렌더러 추가
          heading: (node) => {
            const { level } = node;
            const tagName = `h${level}`;

            return {
              type: 'element',
              tagName,
              attributes: {},
              children: node.children
            };
          },
          // 링크 렌더러 개선 - 클릭 가능하도록 설정 + XSS 방지
          link: (node) => {
            // XSS 방지: javascript: 프로토콜 차단
            const safeDestination = node.destination && /^(https?|mailto|tel):/.test(node.destination)
              ? node.destination
              : '#';
            const safeTitle = node.title ? String(node.title).replace(/[<>"']/g, '') : '';

            return {
              type: 'element',
              tagName: 'a',
              attributes: {
                href: safeDestination,
                title: safeTitle,
                // 내부 링크와 외부 링크 구분
                target: safeDestination.startsWith('http') ? '_blank' : '_self',
                rel: safeDestination.startsWith('http') ? 'noopener noreferrer' : null,
                // 클릭 가능하도록 스타일 추가
                style: 'color: #2563eb; text-decoration: underline; cursor: pointer;'
              },
              children: node.children
            };
          },
          // 이미지 렌더러 추가 + XSS 방지
          image: (node) => {
            // XSS 방지: data:, http(s):만 허용
            const safeDestination = node.destination && /^(https?|data):/.test(node.destination)
              ? node.destination
              : '';
            const safeTitle = node.title ? String(node.title).replace(/[<>"']/g, '') : '';

            return {
              type: 'element',
              tagName: 'img',
              attributes: {
                src: safeDestination,
                alt: safeTitle,
                title: safeTitle
              },
              children: []
            };
          },
          // 코드 블록 렌더러 추가 (XSS 방지: text 노드는 자동 이스케이프됨)
          codeBlock: (node) => {
            // data-language는 안전하게 처리 (알파벳+숫자만)
            const safeLang = node.info ? String(node.info).replace(/[^a-zA-Z0-9-_]/g, '') : '';

            return {
              type: 'element',
              tagName: 'pre',
              attributes: {},
              children: [{
                type: 'element',
                tagName: 'code',
                attributes: {
                  'data-language': safeLang
                },
                children: [{
                  type: 'text',
                  content: node.literal || ''
                }]
              }]
            };
          },
          // 인라인 코드 렌더러 추가 (XSS 방지: text 노드는 자동 이스케이프됨)
          code: (node) => {
            return {
              type: 'element',
              tagName: 'code',
              attributes: {},
              children: [{
                type: 'text',
                content: node.literal || ''
              }]
            };
          },
          // 인용구 렌더러 추가
          blockQuote: (node) => {
            return {
              type: 'element',
              tagName: 'blockquote',
              attributes: {},
              children: node.children
            };
          }
        }}
      />

      {/* 하단 중앙 플로팅 툴바 */}
      {showFloatingToolbar && (
        <div className="miki-floating-toolbar" onMouseDown={(e) => e.preventDefault()}>
          {/* Heading */}
          <button title="Heading" onClick={() => {
            const inst = editorRef.current?.getInstance();
            if (!inst) return;
            if (inst.isWysiwygMode()) {
              inst.exec('heading', { level: 2 });
            } else {
              inst.insertText('\n## ');
            }
          }}>
            H
          </button>
          <button title="Bold" onClick={() => { editorRef.current?.getInstance()?.exec('bold'); }}>
            <strong>B</strong>
          </button>
          <button title="Italic" onClick={() => { editorRef.current?.getInstance()?.exec('italic'); }}>
            <em style={{ fontStyle: 'italic' }}>I</em>
          </button>
          <button title="Strike" onClick={() => { editorRef.current?.getInstance()?.exec('strike'); }}>
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>
          <span className="divider" />
          <button title="Quote" onClick={() => { editorRef.current?.getInstance()?.exec('quote'); }}>“”</button>
          <button title="Bulleted list" onClick={() => { editorRef.current?.getInstance()?.exec('bulletList'); }}>•</button>
          <button title="Ordered list" onClick={() => { editorRef.current?.getInstance()?.exec('orderedList'); }}>1.</button>
          <span className="divider" />
          <button title="Checklist" onClick={() => { editorRef.current?.getInstance()?.exec('taskList'); }}>☑</button>
          <button title="Table" onClick={() => { editorRef.current?.getInstance()?.exec('table'); }}>▦</button>
          <button title="Image" onClick={() => { editorRef.current?.getInstance()?.exec('image'); }}>🖼</button>
          <button title="Link" onClick={() => {
            // 기존 링크 팝오버 로직 재사용
            const inst = editorRef.current?.getInstance();
            if (!inst) return;
            setSavedSelection(inst.getSelection());
            setLinkPopoverPosition({ top: window.innerHeight - 160, left: window.innerWidth / 2 - 150 });
            setShowLinkPopover(true);
          }}>🔗</button>
          <span className="divider" />
          <button title="Inline code" onClick={() => { editorRef.current?.getInstance()?.exec('code'); }}>
            {'</>'}
          </button>
          <button title="Code block" onClick={() => { editorRef.current?.getInstance()?.exec('codeBlock'); }}>CB</button>
          {/* 도움말 토글 버튼 (우측) */}
          <span className="divider" />
          <button title="도움말" onClick={() => {
            window.dispatchEvent(new Event('miki:toggleHelp'));
          }}>?
          </button>
        </div>
      )}

      {/* 링크 생성 버튼 */}
      {showLinkButton && (
        <LinkButton
          position={linkButtonPosition}
          onClick={handleLinkButtonClick}
          selectedText={selectedTextForLink}
        />
      )}

      {/* 링크 생성 팝오버 */}
      {showLinkPopover && (
        <LinkCreationPopover
          position={linkPopoverPosition}
          selectedText={selectedTextForLink}
          onCreateLink={handleLinkCreate}
          onCancel={handleCancelLinkCreation}
        />
      )}

      {/* AI 제안 표시용 팝오버 */}
      {activeSuggestion && (
        <AiSuggestionPopover
          suggestion={activeSuggestion}
          position={calculateSuggestionPosition(activeSuggestion.actionRange || 'cursor')}
          onAccept={handleAcceptSuggestion}
          onCancel={handleCancelSuggestion}
        />
      )}
    </div>
  );
});

export default MikiEditor;

