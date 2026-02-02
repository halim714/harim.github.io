import { useState, useEffect } from 'react';
import MikiEditor from '../../MikiEditor';
import { InlineLoadingSpinner } from '../common/LoadingSpinner';
import { createLogger } from '../../utils/logger';
import AttachmentBox from './AttachmentBox';
import AttachmentModal from './AttachmentModal';
import { useAttachment } from '../../hooks/useAttachment';

const logger = createLogger('EditorPanel');

const EditorPanel = ({
  title,
  saveStatus,
  isFullscreen,
  isMobile,
  activeMobilePanel,
  setActiveMobilePanel,
  isLoadingDocuments,
  editorRef,
  onTitleChange,
  onSavePost,
  onToggleFullscreen,
  onEditorContextUpdate,
  onEditorChange,
  onSendToAi,
  onNavigateRequest,
  onPublish,
  isPublishing,
  hasUnsavedChanges,
  isAutoSaving,
  isManualSaving,
  currentDocument,
  content // 추가: useAttachment 훅에 필요
}) => {
  // useAttachment 훅 사용 (문서 ID 전달)
  const { attachments, processAttachment, removeAttachment, isUploading } = useAttachment(
    content,
    onEditorChange,
    currentDocument?.id
  );

  // 첨부 박스 접기 상태 (localStorage 연동)
  const [isAttachmentCollapsed, setIsAttachmentCollapsed] = useState(() => {
    return localStorage.getItem('attachmentCollapsed') === 'true';
  });

  // 첨부 모달 상태
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('attachmentCollapsed', String(isAttachmentCollapsed));
  }, [isAttachmentCollapsed]);

  const handleAttach = () => {
    setIsAttachmentModalOpen(true);
  };

  const getSaveStatusStyle = () => {
    if (isAutoSaving || isManualSaving) {
      return 'bg-blue-100 text-blue-700';
    }
    if (hasUnsavedChanges) {
      return 'bg-yellow-100 text-yellow-700';
    }
    return 'bg-green-100 text-green-700';
  };

  const getSaveStatusContent = () => {
    if (isAutoSaving) {
      return (
        <div className="flex items-center">
          <InlineLoadingSpinner />
          <span className="ml-1">자동 저장 중...</span>
        </div>
      );
    }
    if (isManualSaving) {
      return (
        <div className="flex items-center">
          <InlineLoadingSpinner />
          <span className="ml-1">저장 중...</span>
        </div>
      );
    }
    return saveStatus;
  };

  // 저장 버튼 제거에 따라 관련 핸들러도 제거

  const getEditorKey = () => {
    const base = isFullscreen ? 'editor-full' : 'editor';
    const docId = currentDocument?.id || 'none';
    return `${base}-${docId}`;
  };

  const getContainerClass = () => {
    if (isFullscreen) {
      return "bg-white rounded shadow flex flex-col h-full";
    }
    return `bg-white rounded shadow flex flex-col ${isMobile
      ? (activeMobilePanel === 'editor' ? 'block' : 'hidden') + ' flex-grow'
      : 'flex-1 min-w-0'
      }`;
  };

  const getContainerStyle = () => {
    if (isFullscreen) {
      return {};
    }
    const base = { display: isMobile && activeMobilePanel !== 'editor' ? 'none' : 'flex', minHeight: 0 };
    if (!isMobile) {
      return {
        ...base,
        flex: '1 1 0%',
        maxWidth: '800px',
        margin: '0 auto',
        minHeight: 0,
        overflow: 'hidden'
      };
    }
    return base;
  };

  return (
    <div
      className={getContainerClass()}
      style={getContainerStyle()}
    >
      {/* 에디터 헤더 */}
      <div className="mb-4 flex flex-col p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <h2 className="text-lg font-bold">에디터</h2>
            <span className={`ml-4 text-xs px-2 py-1 rounded ${getSaveStatusStyle()}`}>
              {getSaveStatusContent()}
            </span>
            {isPublishing && (
              <span className="ml-2 text-xs px-2 py-1 rounded bg-purple-100 text-purple-700" title="배포 중">
                배포 중…
              </span>
            )}
            {/* 변경사항 인디케이터 */}
            {hasUnsavedChanges && !isAutoSaving && !isManualSaving && (
              <span className="ml-2 w-2 h-2 bg-orange-400 rounded-full" title="저장되지 않은 변경사항"></span>
            )}
          </div>

          <div className="flex items-center space-x-2">

            {/* 전체화면 토글 버튼 */}
            <button
              onClick={onToggleFullscreen}
              className="p-1 text-gray-600 hover:text-gray-900 rounded"
              title="전체화면 토글 (Ctrl+Enter)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </button>

            {/* 모바일 네비게이션 버튼 */}
            {isMobile && (
              <>
                {/* 문서 목록으로 이동 버튼 */}
                <button
                  onClick={() => setActiveMobilePanel('list')}
                  className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded flex items-center"
                  title="문서 목록으로 이동"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  목록
                </button>

                {/* AI 패널로 이동 버튼 */}
                <button
                  onClick={() => setActiveMobilePanel('ai')}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center ml-2"
                  title="AI 패널로 이동"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  AI
                </button>
              </>
            )}
          </div>
        </div>

        {/* 제목 입력 */}
        <input
          type="text"
          value={title}
          onChange={onTitleChange}
          data-current-doc={currentDocument?.id || ''}
          placeholder="문서 제목을 입력하세요 (편집기 첫 줄 텍스트가 자동으로 제목이 됩니다)"
          className="w-full px-3 py-2 text-xl font-medium focus:outline-none mb-2 bg-transparent"
        />
      </div>

      {/* 첨부 박스 */}
      <AttachmentBox
        attachments={attachments}
        isCollapsed={isAttachmentCollapsed}
        onToggle={() => setIsAttachmentCollapsed(!isAttachmentCollapsed)}
        onAttach={handleAttach}
        onRemove={removeAttachment}
      />

      {/* 에디터 영역: 스크롤은 바깥 래퍼에만 적용하여 본문 정렬이 흔들리지 않도록 처리 */}
      <div
        className="flex-grow relative editor-outer-scroll"
        style={{ overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable', flex: '1 1 0%', minHeight: 0, height: '100%' }}
      >
        <MikiEditor
          ref={editorRef}
          key={getEditorKey()}
          onContextUpdate={onEditorContextUpdate}
          onContentChange={onEditorChange}
          onSendToAi={onSendToAi}
          onNavigateRequest={onNavigateRequest}
        />
      </div>

      {/* 첨부 모달 */}
      <AttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        onAttach={processAttachment}
      />
    </div>
  );
};

export default EditorPanel;
