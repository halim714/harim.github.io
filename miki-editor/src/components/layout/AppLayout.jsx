import DocumentSidebar from '../sidebar/DocumentSidebar';
import EditorPanel from '../editor/EditorPanel';
import AiPanelContainer from '../ai/AiPanelContainer';

const AppLayout = ({
  isFullscreen,
  isMobile,
  activeMobilePanel,
  setActiveMobilePanel,
  editorPanelClass,

  // DocumentSidebar props
  documentsData,
  currentDocument,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  onLoadPost,
  onNewPost,
  onDeletePost,
  onPublish,
  setMessage,
  content,

  // EditorPanel props
  title,
  saveStatus,
  isLoadingDocuments,
  editorRef,
  onTitleChange,
  onSavePost,
  onToggleFullscreen,
  onEditorContextUpdate,
  onEditorChange,
  onSendToAi,
  onNavigateRequest,
  isPublishing,
  hasUnsavedChanges,
  isAutoSaving,
  isManualSaving,

  // AiPanelContainer props
  aiPanelRef,
  currentDocumentId,
  editorContext,
  onApplyAiCommand,
  onStructuredCommand,
  onDisplaySuggestion
}) => {
  if (isFullscreen) {
    // 전체화면 모드
    return (
      <div className={editorPanelClass}>
        <EditorPanel
          title={title}
          saveStatus={saveStatus}
          isFullscreen={isFullscreen}
          isMobile={isMobile}
          activeMobilePanel={activeMobilePanel}
          setActiveMobilePanel={setActiveMobilePanel}
          isLoadingDocuments={isLoadingDocuments}
          editorRef={editorRef}
          onTitleChange={onTitleChange}
          onNewPost={onNewPost}
          onSavePost={onSavePost}
          onToggleFullscreen={onToggleFullscreen}
          onEditorContextUpdate={onEditorContextUpdate}
          onEditorChange={onEditorChange}
          onSendToAi={onSendToAi}
          onNavigateRequest={onNavigateRequest}
          onPublish={onPublish}
          isPublishing={isPublishing}
          currentDocument={currentDocument}
          hasUnsavedChanges={hasUnsavedChanges}
          isAutoSaving={isAutoSaving}
          isManualSaving={isManualSaving}
          content={content}
        />
      </div>
    );
  }

  // 일반 모드 (3패널 레이아웃)
  return (
    <div className="flex h-full" style={{ flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden', minHeight: 0 }}>
      {/* 문서 목록 사이드바 */}
      <DocumentSidebar
        documentsData={documentsData}
        currentDocument={currentDocument}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onLoadPost={onLoadPost}
        onNewPost={onNewPost}
        onDeletePost={onDeletePost}
        onPublish={onPublish}
        isPublishing={isPublishing}
        isMobile={isMobile}
        activeMobilePanel={activeMobilePanel}
        setActiveMobilePanel={setActiveMobilePanel}
        setMessage={setMessage}
        content={content}
      />

      {/* 에디터 패널 */}
      <EditorPanel
        title={title}
        saveStatus={saveStatus}
        isFullscreen={isFullscreen}
        isMobile={isMobile}
        activeMobilePanel={activeMobilePanel}
        setActiveMobilePanel={setActiveMobilePanel}
        isLoadingDocuments={isLoadingDocuments}
        editorRef={editorRef}
        onTitleChange={onTitleChange}
        onSavePost={onSavePost}
        onToggleFullscreen={onToggleFullscreen}
        onEditorContextUpdate={onEditorContextUpdate}
        onEditorChange={onEditorChange}
        onSendToAi={onSendToAi}
        onNavigateRequest={onNavigateRequest}
        currentDocument={currentDocument}
        hasUnsavedChanges={hasUnsavedChanges}
        isAutoSaving={isAutoSaving}
        isManualSaving={isManualSaving}
        onPublish={onPublish}
        isPublishing={isPublishing}
        content={content}
      />

      {/* AI 패널 */}
      <AiPanelContainer
        isMobile={isMobile}
        activeMobilePanel={activeMobilePanel}
        setActiveMobilePanel={setActiveMobilePanel}
        aiPanelRef={aiPanelRef}
        currentDocumentId={currentDocumentId}
        editorContext={editorContext}
        onApplyAiCommand={onApplyAiCommand}
        onStructuredCommand={onStructuredCommand}
        onDisplaySuggestion={onDisplaySuggestion}
      />
    </div>
  );
};

export default AppLayout; 