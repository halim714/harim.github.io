import AiPanel from '../../AiPanel';

const AiPanelContainer = ({
  isMobile,
  activeMobilePanel,
  setActiveMobilePanel,
  aiPanelRef,
  currentDocumentId,
  editorContext,
  onApplyAiCommand,
  onStructuredCommand,
  onDisplaySuggestion
}) => {
  return (
    <div
      className={`bg-white rounded shadow overflow-hidden flex flex-col ${isMobile ? (activeMobilePanel === 'ai' ? 'block' : 'hidden') + ' flex-grow' : 'w-1/4 min-w-[320px] ml-2'
        }`}
      style={{
        display: isMobile && activeMobilePanel !== 'ai' ? 'none' : 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* AI 패널 헤더 */}
      <div className="p-3 border-b flex justify-between items-center" style={{ flexShrink: 0 }}>
        <h2 className="text-lg font-bold">AI 패널</h2>
        {isMobile && (
          <div className="flex items-center space-x-2">
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

            {/* 에디터로 이동 버튼 */}
            <button
              onClick={() => setActiveMobilePanel('editor')}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center"
              title="에디터로 이동"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              에디터
            </button>
          </div>
        )}
      </div>

      {/* AI 패널 내용 */}
      <div className="flex-grow relative">
        <AiPanel
          ref={aiPanelRef}
          key="ai-panel-fixed-key" // 고정 키 값을 사용하여 컴포넌트 재생성 방지
          currentDocumentId={currentDocumentId}
          editorContext={editorContext}
          onApplyAiCommand={onApplyAiCommand}
          onStructuredCommand={onStructuredCommand}
          onDisplaySuggestion={onDisplaySuggestion}
        />
      </div>
    </div>
  );
};

export default AiPanelContainer; 