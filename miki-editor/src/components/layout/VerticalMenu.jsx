import React from 'react';

function VerticalMenu({
  isMobile,
  activeMobilePanel,
  setActiveMobilePanel,
  searchInputRef,
  sidebarView,
  setSidebarView,
}) {
  const isEditorActive = isMobile ? activeMobilePanel === 'editor' : true;

  const gotoFolder = () => {
    try {
      setSidebarView && setSidebarView('library');
      if (isMobile) {
        setActiveMobilePanel && setActiveMobilePanel('list');
      } else if (searchInputRef?.current) {
        searchInputRef.current.focus();
      }
    } catch {}
  };

  const gotoCompose = () => {
    try {
      setSidebarView && setSidebarView('list');
      if (isMobile) {
        setActiveMobilePanel && setActiveMobilePanel('editor');
      }
      // 데스크톱에서는 이미 에디터가 중심이므로 동작 없음
    } catch {}
  };

  return (
    <nav
      className="bg-white rounded shadow flex flex-col items-center w-12 mr-2 select-none"
      style={{ minHeight: 0 }}
      aria-label="세로 메뉴"
    >
      <div className="flex-1 flex flex-col items-center py-2 space-y-2">
        {/* 폴더 (문서 목록) */}
        <button
          onClick={gotoFolder}
          className={`w-10 h-10 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-100 ${sidebarView === 'library' ? 'bg-gray-100' : ''}`}
          title="문서 목록"
          aria-label="문서 목록"
          aria-current={sidebarView === 'library' ? 'page' : undefined}
          style={{ border: 'none', boxShadow: 'none', outline: 'none', backgroundColor: sidebarView === 'library' ? '#f5f5f5' : 'transparent' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
        </button>

        {/* 문서작성 (에디터 화면) */}
        <button
          onClick={gotoCompose}
          className={`w-10 h-10 rounded-md flex items-center justify-center text-gray-700 hover:bg-gray-100 ${sidebarView === 'list' ? 'bg-gray-100' : ''}`}
          title="문서 작성"
          aria-label="문서 작성"
          aria-current={sidebarView === 'list' ? 'page' : undefined}
          style={{ border: 'none', boxShadow: 'none', outline: 'none', backgroundColor: sidebarView === 'list' ? '#f5f5f5' : 'transparent' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 3.5a2.121 2.121 0 113 3L8 18l-4 1 1-4 11.5-11.5z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

export default VerticalMenu;



