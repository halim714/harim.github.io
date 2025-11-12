import { useState, useEffect } from 'react';

const useResponsiveLayout = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [activeMobilePanel, setActiveMobilePanel] = useState('list');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 화면 크기 감지 함수
  const checkScreenSize = () => {
    const width = window.innerWidth;
    const minDesktopWidth = 1000; // 280px + 400px + 320px (최소 너비 합계)
    const newIsMobile = width <= Math.max(768, minDesktopWidth);
    const newIsTablet = width > Math.max(768, minDesktopWidth) && width <= 1024;
    
    setIsMobile(newIsMobile);
    setIsTablet(newIsTablet);
    
    // 모바일에서 데스크톱으로 전환 시 활성 패널을 에디터로 설정
    if (!newIsMobile && isMobile) {
      setActiveMobilePanel('editor');
    }
  };

  // 화면 크기 변경 감지
  useEffect(() => {
    checkScreenSize();
    
    const handleResize = () => {
      checkScreenSize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  // 전체화면 토글
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // 모바일 패널 전환
  const switchMobilePanel = (panel) => {
    if (isMobile) {
      setActiveMobilePanel(panel);
    }
  };

  // 에디터 패널 클래스 계산
  const getEditorPanelClass = () => {
    if (isFullscreen) {
      return "bg-white rounded shadow flex flex-col h-full";
    }
    return `bg-white rounded shadow flex flex-col ${
      isMobile ? (activeMobilePanel === 'editor' ? 'block' : 'hidden') + ' flex-grow' : 'flex-1 mx-2'
    }`;
  };

  // 레이아웃 정보 반환
  return {
    isMobile,
    isTablet,
    isFullscreen,
    activeMobilePanel,
    setActiveMobilePanel: switchMobilePanel,
    toggleFullscreen,
    editorPanelClass: getEditorPanelClass()
  };
};

export default useResponsiveLayout; 