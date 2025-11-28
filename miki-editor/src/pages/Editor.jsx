import { createLogger } from '../utils/logger';

const logger = createLogger('App');
import { useState, useRef, useEffect, useCallback } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// 컴포넌트 imports
import ErrorBoundary from '../components/common/ErrorBoundary';
import MessageToast from '../components/common/MessageToast';
import ErrorDisplay from '../components/common/ErrorDisplay';
import { DocumentListSkeleton, EditorSkeleton, AiPanelSkeleton } from '../components/common/LoadingSpinner';
import AppLayout from '../components/layout/AppLayout';

// 훅 imports
import { useDocuments } from '../hooks/useDocuments';
import { useDocumentStore } from '../stores';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import useAutoSave from '../hooks/useAutoSave';
import { usePhantomDocument } from '../hooks/usePhantomDocument';

// 설정 imports
import { queryClient, queryKeys } from '../config/queryClient';

// 유틸리티 imports
import { logError } from '../utils/errorHandler';
import realTimeDocSync from '../utils/RealTimeDocumentSync';
import { storage } from '../utils/storage-client'; // storage 임포트
import { usePublish } from '../hooks/usePublish'; // ✅ Publish 훅 임포트

// 유틸리티 함수들
const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const extractTitleFromContent = (content) => {
  if (!content || content.trim() === '') return '새 메모';

  // 서버와 동일한 로직: 첫 번째 # 헤더 우선 검색
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // # 헤더가 없으면 첫 줄 사용 (50자 제한)
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() || '';

  if (firstLine === '') return '새 메모';

  // 마크다운 포맷팅 제거하고 50자로 제한
  const cleanTitle = firstLine
    .replace(/^#+\s*/, '') // 헤더 마커 제거
    .replace(/\*\*(.*?)\*\*/g, '$1') // 볼드 제거
    .replace(/\*(.*?)\*/g, '$1') // 이탤릭 제거
    .replace(/`(.*?)`/g, '$1') // 인라인 코드 제거
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // 링크 제거
    .trim()
    .slice(0, 50); // 50자 제한

  return cleanTitle || '새 메모';
};

const createNewMemo = () => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return {
    id: `memo_${timestamp}_${randomSuffix}`,
    title: '새 메모',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isEmpty: true
  };
};

function AppContent() {
  // 상태 관리
  const [message, setMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editorContext, setEditorContext] = useState(null);
  const [error, setError] = useState(null);
  // isPublishing state removed (handled by usePublish hook)

  // 🎯 제목 관리 개선: 사용자 의도 추적
  const [titleMode, setTitleMode] = useState('auto'); // 'auto' | 'manual'
  const titleModeRef = useRef('auto'); // 성능 최적화용
  const lastAutoTitleRef = useRef(''); // 마지막 자동 추출 제목 추적

  // Refs
  const editorRef = useRef(null);
  const aiPanelRef = useRef(null);
  const searchInputRef = useRef(null);

  // 커스텀 훅들
  const { isMobile, isFullscreen, activeMobilePanel, setActiveMobilePanel, toggleFullscreen, editorPanelClass } = useResponsiveLayout();
  const [sidebarView, setSidebarView] = useState('list'); // 'list' | 'library'
  const { data: documentsData, isLoading: isLoadingDocuments, error: documentsError, refetch: refetchDocuments } = useDocuments();
  const { currentDocument, setCurrentDocument, addDocument } = useDocumentStore();
  const queryClient = useQueryClient();

  // 🔥 NEW: Phantom Document 상태 관리
  const { setPhantomTrustLevel, removePhantom } = usePhantomDocument();

  // 자동 저장 훅
  const {
    saveStatus,
    hasUnsavedChanges,
    lastSaved,
    manualSave,
    getSaveStatusMessage,
    isAutoSaving,
    isManualSaving
  } = useAutoSave({
    document: currentDocument,
    content,
    title,
    titleMode,
    enabled: true,
    // 🚀 새로 추가: Lazy Document 자동 생성 콜백
    onLazyDocumentCreate: () => {
      logger.info('🔮 [LAZY-DOC] useAutoSave에서 자동 문서 생성 요청');
      const lazyDoc = createNewMemo();
      setCurrentDocument(lazyDoc);
      logger.info('✅ [LAZY-DOC] 자동 문서 생성 및 설정 완료:', lazyDoc.id);
      return lazyDoc;
    },
    onSaveStart: () => {
      setMessage({ type: 'info', text: '저장 중...' });
      // 🔥 NEW: Phantom Document를 "저장 중" 상태로 업데이트
      if (currentDocument?.isEmpty) {
        setPhantomTrustLevel(currentDocument.id, 'saving');
      }
    },
    onSaveSuccess: (savedDocument) => {
      setMessage({ type: 'success', text: '저장되었습니다.' });

      // 🎯 간단한 캐시 갱신 (비판 반영)
      queryClient.invalidateQueries(['documents']);

      // 🔥 NEW: 저장 성공 시 Phantom Document 제거하고 React Query 캐시 업데이트
      if (currentDocument?.isEmpty && savedDocument?.id) {
        removePhantom(currentDocument.id);

        // ✅ CRITICAL FIX: ID 동기화 및 파일명(filename) 최신화
        // ID가 같더라도 파일명이 바뀌었을 수 있으므로 무조건 동기화
        if (savedDocument && savedDocument.id === currentDocument?.id) {
          logger.info(`🔄 [SYNC] 문서 상태 동기화 (파일명 변경 등 반영): ${savedDocument.filename}`);
          setCurrentDocument(savedDocument);
        } else if (currentDocument.id.startsWith('memo_') && savedDocument.id !== currentDocument.id) {
          // 기존 로직: 임시 ID -> 실제 ID 변경 시
          logger.info(`🔄 [ID-SYNC] ${currentDocument.id} → ${savedDocument.id}`);
          setCurrentDocument(savedDocument);
        }

        // React Query 캐시에 즉시 추가하여 Phantom에서 Real로 전환
        queryClient.setQueryData(['documents'], (oldData) => {
          if (!oldData) return [savedDocument];

          // 안전성 강화: savedDocument가 유효한지 확인
          if (!savedDocument || !savedDocument.id) {
            logger.warn('⚠️ [CACHE-UPDATE] savedDocument가 유효하지 않음, 캐시 업데이트 건너뜀');
            return oldData;
          }

          const filteredData = oldData.filter(doc => doc && doc.id && doc.id !== savedDocument.id);
          return [savedDocument, ...filteredData];
        });
      }
    },
    onSaveError: (error) => {
      logError(error, 'save');
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
      // 🔥 NEW: 저장 실패 시 Phantom Document를 "오류" 상태로 업데이트
      if (currentDocument?.isEmpty) {
        setPhantomTrustLevel(currentDocument.id, 'error');
      }
    },
    onNewDocumentCreated: (newDocument) => {
      // Zustand store가 이미 문서 추가와 currentDocument 설정을 처리했으므로
      // 여기서는 로그만 출력
      logger.info('✅ 새 문서가 서버에 저장되고 currentDocument로 설정됨:', newDocument.id);
    }
  });

  // 🔎 단축키 도움말(튜토리얼) 상태 & body 클래스 토글
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const toggleHelp = useCallback(() => setHelpOpen(v => !v), []);
  useEffect(() => {
    const body = document.body;
    if (helpOpen) body.classList.add('miki-help-open');
    else body.classList.remove('miki-help-open');
  }, [helpOpen]);

  // 하단 툴바에서 발생시키는 전역 도움말 토글 이벤트 리스너
  useEffect(() => {
    const handler = () => setHelpOpen(v => !v);
    window.addEventListener('miki:toggleHelp', handler);
    return () => window.removeEventListener('miki:toggleHelp', handler);
  }, []);

  // 키보드 단축키 훅
  useKeyboardShortcuts({
    onSave: manualSave,
    onNewDocument: () => newPost(),
    onSearch: () => searchInputRef.current?.focus(),
    onToggleFullscreen: toggleFullscreen,
    onFocusEditor: () => editorRef.current?.focus?.(),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onToggleHelp: toggleHelp,
    disabled: false
  });

  // 에러 처리
  useEffect(() => {
    if (documentsError) {
      logError(documentsError, 'load');
      setError(documentsError);
    }
  }, [documentsError]);

  // 메시지 닫기 핸들러
  const handleCloseMessage = useCallback(() => {
    setMessage(null);
  }, []);

  // 에러 닫기 핸들러
  const handleCloseError = useCallback(() => {
    setError(null);
  }, []);

  // 에러 재시도 핸들러
  const handleRetryError = useCallback(() => {
    setError(null);
    refetchDocuments();
  }, [refetchDocuments]);

  // 제목 변경 핸들러
  const handleTitleChange = useCallback((e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    // 🎯 사용자 의도 존중: 제목을 지우면 지워진 상태 유지
    if (newTitle.trim() === '') {
      // 빈 제목이어도 수동 모드 유지 (사용자가 의도적으로 지웠을 수 있음)
      if (titleModeRef.current === 'auto') {
        // 자동 모드였다면 계속 자동 모드
        const autoTitle = extractTitleFromContent(content);
        setTitle(autoTitle);
        lastAutoTitleRef.current = autoTitle;

        // 실시간 동기화
        if (currentDocument && currentDocument.id) {
          realTimeDocSync.updateTitleImmediate(currentDocument.id, autoTitle);
          logger.info(`⚡ [TITLE-AUTO] 자동 제목 업데이트: ${currentDocument.id} → ${autoTitle}`);
        }
      } else {
        // 수동 모드였다면 빈 제목 그대로 유지
        setTitleMode('manual');
        titleModeRef.current = 'manual';

        // 실시간 동기화 (빈 제목으로)
        if (currentDocument && currentDocument.id) {
          realTimeDocSync.updateTitleImmediate(currentDocument.id, '');
          logger.info(`⚡ [TITLE-MANUAL] 빈 제목 유지: ${currentDocument.id} → (빈 제목)`);
        }
      }
    } else {
      // 뭔가 입력하면 수동 모드 전환
      setTitleMode('manual');
      titleModeRef.current = 'manual';

      // 실시간 동기화
      if (currentDocument && currentDocument.id) {
        realTimeDocSync.updateTitleImmediate(currentDocument.id, newTitle);
        logger.info(`⚡ [TITLE-MODE] 수동 모드 전환 + 즉시 동기화: ${currentDocument.id} → ${newTitle}`);
      }
    }
  }, [content, currentDocument]);

  // 에디터 컨텍스트 업데이트 핸들러
  const handleEditorContextUpdate = useCallback((context) => {
    setEditorContext(context);
  }, []);

  // 에디터 내용 변경 핸들러
  const handleEditorChange = useCallback((newContent) => {
    setContent(newContent);

    // 🎯 핵심 개선: 자동 모드일 때만 제목 추출
    if (titleModeRef.current === 'auto') {
      const extractedTitle = extractTitleFromContent(newContent);

      // 성능 최적화: 실제로 변경된 경우만 업데이트
      if (extractedTitle !== lastAutoTitleRef.current) {
        setTitle(extractedTitle);
        lastAutoTitleRef.current = extractedTitle;

        // 실시간 동기화
        if (currentDocument && currentDocument.id) {
          realTimeDocSync.updateTitleImmediate(currentDocument.id, extractedTitle);
          logger.info(`⚡ [TITLE-AUTO] 자동 추출 + 즉시 동기화: ${currentDocument.id} → ${extractedTitle}`);
        }
      }
    } else {
      // 수동 모드일 때는 제목 추출 안함
      logger.info(`🔒 [TITLE-MANUAL] 수동 모드이므로 제목 자동 추출 건너뜀`);
    }
  }, [currentDocument]);

  // ✅ Publish 훅 추가
  const { publish, unpublish, isPublishing, isUnpublishing } = usePublish();

  // 배포 핸들러
  const handlePublish = useCallback(async () => {
    try {
      if (!currentDocument || !currentDocument.id) {
        setMessage({ type: 'warning', text: '배포할 문서를 먼저 선택하거나 저장하세요.' });
        return;
      }
      if (isPublishing) return;

      window.dispatchEvent(new Event('miki:publish:started'));
      setMessage({ type: 'info', text: '배포 중... (GitHub Pages)' });

      // 🔄 라이브 업데이트
      try {
        queryClient.setQueryData(queryKeys.documents.lists(), (oldData) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map(d => d && d.id === currentDocument.id ? { ...d, isPublishing: true } : d);
        });
      } catch { }

      // ✅ Client-Side Publish 실행
      // 🟢 [변경] 배포 전 저장 강제 및 최신 문서 획득
      let docToPublish;
      try {
        const savedDoc = await manualSave();
        // 저장된 문서가 있으면 그것을 사용, 없으면(변경사항 없음 등) 현재 상태 사용
        docToPublish = savedDoc || {
          ...currentDocument,
          title: title,
          content: content
        };
      } catch (saveError) {
        setMessage({ type: 'error', text: '저장 실패. 배포를 중단합니다.' });
        return; // 저장 실패 시 배포 중단
      }

      const result = await publish(docToPublish);

      setMessage({
        type: 'success',
        text: `배포 완료! ${result.estimatedDeployTime} 후 확인 가능합니다. (${result.publicUrl})`
      });

      // ✅ 성공 시 상태 갱신
      try {
        queryClient.setQueryData(queryKeys.documents.lists(), (oldData) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map(d => d && d.id === currentDocument.id ? { ...d, isPublishing: false, status: 'published', publishedAt: new Date().toISOString() } : d);
        });
      } catch { }

    } catch (e) {
      logError(e, 'publish');
      setMessage({ type: 'error', text: e?.message || '배포 중 오류가 발생했습니다.' });
    } finally {
      window.dispatchEvent(new Event('miki:publish:finished'));
      try {
        queryClient.setQueryData(queryKeys.documents.lists(), (oldData) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map(d => d && d.id === currentDocument?.id ? { ...d, isPublishing: false } : d);
        });
      } catch { }
    }
  }, [currentDocument, isPublishing, queryClient, publish, title, content]);

  // 문서 로드
  const loadPost = useCallback(async (id) => {
    try {
      logger.info(`문서 로드 시작: ${id}`);

      // 🚨 사용자 시나리오 처리: 현재 작성 중인 문서가 있는지 확인
      if (currentDocument) {
        // 🟢 [수정] 실제 원본과 달라진 경우에만 저장 (Strict Comparison)
        // 기존에는 내용이 존재하기만 하면 저장했으나, 이제는 변경 여부를 확인
        const isContentChanged = content !== (currentDocument.content || '');
        const isTitleChanged = title !== (currentDocument.title || '');

        const hasUnsavedWork = isContentChanged || isTitleChanged;

        if (hasUnsavedWork) {
          logger.info('💾 [LOAD-POST] 변경된 내용 감지 - 자동 저장 시도');

          // Q1-b: 자동 저장 시도 (Fire-and-forget)
          // Local-First 전략: 저장을 기다리지 않고 즉시 로드 진행
          manualSave().catch(err => {
            logger.error('❌ [LOAD-POST] 백그라운드 저장 실패:', err);
          });
          logger.info('✅ [LOAD-POST] 저장 요청 보냄 (기다리지 않음) - 새 문서 로드 진행');
        } else if (currentDocument.isEmpty) {
          // Q2-B: 아무것도 적지 않은 새글인 경우 - 그냥 진행 (버리기)
          logger.info('🗑️ [LOAD-POST] 빈 새글 감지 - 저장 없이 진행');

          // 🟢 [Fix] 캐시에서 임시 문서 제거 (UI 목록에서 즉시 사라지게 함)
          queryClient.setQueryData(queryKeys.documents.lists(), (oldData) => {
            if (!Array.isArray(oldData)) return oldData;
            return oldData.filter(d => d.id !== currentDocument.id);
          });
        }
      }

      // 로딩 상태 표시
      setMessage({ type: 'info', text: '문서를 불러오는 중...' });

      // API를 통해 문서 데이터 가져오기
      const document = await storage.getPost(id); // <-- storage.getPost() 사용
      logger.info(`문서 로드 성공:`, document);

      // Zustand store에 문서 추가 (중요: currentDocument가 올바르게 설정되도록)
      setCurrentDocument(document);

      // 상태 업데이트
      setTitle(document.title || extractTitleFromContent(document.content));
      setContent(document.content || '');

      // 🎯 제목 모드 설정: 로드된 문서의 제목이 자동 추출된 것인지 판단
      const autoExtractedTitle = extractTitleFromContent(document.content || '');
      if (document.title === autoExtractedTitle || !document.title) {
        // 자동 추출된 제목이거나 제목이 없으면 자동 모드
        setTitleMode('auto');
        titleModeRef.current = 'auto';
        lastAutoTitleRef.current = autoExtractedTitle;
        logger.info(`📖 [TITLE-LOAD] 자동 모드로 설정: ${document.title || autoExtractedTitle}`);
      } else {
        // 사용자가 커스텀한 제목이면 수동 모드
        setTitleMode('manual');
        titleModeRef.current = 'manual';
        logger.info(`📝 [TITLE-LOAD] 수동 모드로 설정: ${document.title}`);
      }

      // 에디터에 내용 설정
      if (editorRef.current) {
        const editorInstance = editorRef.current.getEditorInstance();
        if (editorInstance) {
          editorInstance.setMarkdown(document.content || '');
        }
      }

      // 🎯 Phase C: 문서별 독립적 AI 대화 관리 - 스마트 클리어 시스템
      if (aiPanelRef.current) {
        const currentConversation = aiPanelRef.current.getConversation();

        // 🔑 핵심: 현재 로드하는 문서와 관련된 대화인지 확인
        const isCurrentDocumentConversation = currentConversation &&
          currentConversation.length > 0 &&
          currentConversation.some(msg => {
            // 메시지에 documentId가 없으면 현재 문서의 대화로 간주 (하위 호환성)
            return !msg.documentId || msg.documentId === document.id;
          });

        const hasMeaningfulConversation = currentConversation &&
          currentConversation.length > 0 &&
          currentConversation.some(msg =>
            msg.text &&
            msg.text.trim().length > 0 &&
            !msg.isLoading &&
            !msg.isPendingCommand
          );

        // 🎯 스마트 클리어: 다른 문서의 대화만 클리어, 현재 문서 대화는 보존
        if (hasMeaningfulConversation && !isCurrentDocumentConversation) {
          aiPanelRef.current.clearConversation();
          logger.info('🔄 다른 문서 AI 대화 클리어됨, 현재 문서 대화 복원 예정');
        } else if (isCurrentDocumentConversation) {
          logger.info('🎯 현재 문서 AI 대화 유지 - 문서별 독립적 관리 활성화');
        } else {
          logger.info('🎯 빈 대화 또는 무의미한 대화 - 클리어 건너뜀으로 상태 변경 차단');
        }
      }

      // 성공 메시지
      setMessage({ type: 'success', text: '문서를 불러왔습니다.' });

      // 메시지 자동 제거
      setTimeout(() => setMessage(null), 2000);

    } catch (error) {
      logger.error('문서 로드 실패:', error);
      logError(error, 'load');

      // 404 오류인 경우 현재 문서 초기화
      if (error.message.includes('찾을 수 없습니다')) {
        setCurrentDocument(null);
        setTitle('');
        setContent('');
        if (editorRef.current) {
          editorRef.current.getEditorInstance().setMarkdown('');
        }
      }

      setMessage({
        type: 'error',
        text: error.message || '문서 로드 중 오류가 발생했습니다.'
      });

      // 오류 메시지 자동 제거 (5초 후)
      setTimeout(() => setMessage(null), 5000);
    }
  }, [setCurrentDocument, refetchDocuments, currentDocument, content, title, manualSave]);

  // 새 글 생성
  const newPost = useCallback(() => {
    logger.info('🚀 [NEW-POST] 새 글 생성 시작');

    try {
      const newMemo = createNewMemo();
      logger.info('✅ [NEW-POST] 새 메모 생성 완료:', newMemo);

      // Zustand store가 문서 추가와 currentDocument 설정을 한 번에 처리
      setCurrentDocument(newMemo);
      logger.info('✅ [NEW-POST] currentDocument 설정 완료');

      // 🔄 라이브러리/문서목록 즉시 반영: React Query 캐시에 새 항목 삽입 (optimistic)
      try {
        queryClient.setQueryData(queryKeys.documents.lists(), (oldData) => {
          const list = Array.isArray(oldData) ? oldData : [];
          if (list.find(d => d && d.id === newMemo.id)) return list;
          return [{ ...newMemo, preview: '', size: 0 }, ...list];
        });
      } catch { } // 에러 발생해도 무시

      setTitle(newMemo.title);
      logger.info('✅ [NEW-POST] 제목 설정 완료:', newMemo.title);

      // 🎯 새 글은 항상 자동 모드로 시작
      setTitleMode('auto');
      titleModeRef.current = 'auto';
      lastAutoTitleRef.current = newMemo.title;
      logger.info('✅ [NEW-POST] 제목 모드를 자동으로 설정');

      setContent('');
      logger.info('✅ [NEW-POST] 내용 초기화 완료');

      if (editorRef.current) {
        editorRef.current.getEditorInstance().setMarkdown('');
        logger.info('✅ [NEW-POST] 에디터 내용 초기화 완료');
      } else {
        logger.warn('⚠️ [NEW-POST] editorRef.current가 없음');
      }

      if (aiPanelRef.current) {
        aiPanelRef.current.clearConversation();
        logger.info('✅ [NEW-POST] AI 대화 초기화 완료');
      } else {
        logger.warn('⚠️ [NEW-POST] aiPanelRef.current가 없음');
      }

      logger.info('🎉 [NEW-POST] 새 글 생성 전체 과정 완료');

    } catch (error) {
      logger.error('❌ [NEW-POST] 새 글 생성 중 오류:', error);
    }
  }, [setCurrentDocument, queryClient]);

  // 앱 최초 진입 시 자동으로 새 문서에서 시작
  useEffect(() => {
    if (!isLoadingDocuments && !currentDocument) {
      newPost();
    }
  }, [isLoadingDocuments, currentDocument, newPost]);

  // 문서 삭제 후 처리
  const handleDeletePost = useCallback((deletedPost) => {
    if (currentDocument && currentDocument.id === deletedPost.id) {
      if (editorRef.current) {
        editorRef.current.getEditorInstance().setMarkdown('');
      }

      if (aiPanelRef.current) {
        aiPanelRef.current.clearConversation();
      }

      setCurrentDocument(null);
      setTitle('');
      setContent('');
    }
  }, [currentDocument, setCurrentDocument]);

  // AI 명령 처리
  const handleAiCommand = useCallback((command) => {
    logger.info('AI 명령 처리 시작:', command);

    // 강화된 에디터 인스턴스 확인 로직
    if (!editorRef.current) {
      logger.warn('⚠️ editorRef.current가 null입니다');
      return;
    }

    if (!command) {
      logger.warn('⚠️ command가 없습니다');
      return;
    }

    try {
      // Toast UI Editor 인스턴스 안전하게 가져오기
      const mikiEditorInstance = editorRef.current;
      const toastUIEditorInstance = mikiEditorInstance.getEditorInstance();

      if (!toastUIEditorInstance) {
        logger.warn('⚠️ Toast UI Editor 인스턴스가 아직 초기화되지 않았습니다. 0.5초 후 재시도...');
        setTimeout(() => handleAiCommand(command), 500);
        return;
      }

      // applyStructuredAiCommand 메서드 확인 및 호출
      if (typeof mikiEditorInstance.applyStructuredAiCommand === 'function') {
        mikiEditorInstance.applyStructuredAiCommand(command);
        logger.info('✅ AI 명령 적용 성공');
      } else {
        logger.warn('⚠️ applyStructuredAiCommand 메서드를 찾을 수 없음');
      }
    } catch (error) {
      logger.error('❌ AI 명령 적용 실패:', error);
    }
  }, []);

  // AI 제안 표시
  const handleAiSuggestion = useCallback((suggestion) => {
    logger.info('AI 제안 처리 시작:', suggestion);

    // 강화된 에디터 인스턴스 확인 로직
    if (!editorRef.current) {
      logger.warn('⚠️ editorRef.current가 null입니다');
      return;
    }

    if (!suggestion) {
      logger.warn('⚠️ suggestion이 없습니다');
      return;
    }

    try {
      // Toast UI Editor 인스턴스 안전하게 가져오기
      const mikiEditorInstance = editorRef.current;
      const toastUIEditorInstance = mikiEditorInstance.getEditorInstance();

      if (!toastUIEditorInstance) {
        logger.warn('⚠️ Toast UI Editor 인스턴스가 아직 초기화되지 않았습니다. 0.5초 후 재시도...');
        setTimeout(() => handleAiSuggestion(suggestion), 500);
        return;
      }

      // displayAiSuggestion 메서드 확인 및 호출
      if (typeof mikiEditorInstance.displayAiSuggestion === 'function') {
        mikiEditorInstance.displayAiSuggestion(suggestion);
        logger.info('✅ AI 제안 표시 성공');
      } else {
        logger.warn('⚠️ displayAiSuggestion 메서드를 찾을 수 없음');
      }
    } catch (error) {
      logger.error('❌ AI 제안 표시 실패:', error);
    }
  }, []);

  // 내부 문서 링크 네비게이션
  const handleNavigateToId = useCallback(async (docId) => {
    if (!docId || docId === currentDocument?.id) return;
    logger.info(`네비게이션 요청: ${docId}`);
    try {
      await loadPost(docId);
    } catch (error) {
      logError(error, 'load');
      setMessage({ type: 'error', text: `문서(${docId}) 로드 중 오류 발생` });
    }
  }, [loadPost, currentDocument?.id]);

  // 상단 메뉴 상태
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // 로딩 상태 처리
  // This logic is now handled by App.jsx's AuthProvider and routing.
  // The old SetupWizard is no longer needed here.

  if (isLoadingDocuments) {
    return (
      <div className="miki-root h-screen flex flex-col bg-gray-100">
        {/* 상단 메뉴 바 (로딩 상태) */}
        <header className="px-4 py-2 bg-white border-b">
          <div className="container mx-auto flex justify-between items-center">
            <button onClick={toggleMenu} className="p-2 rounded hover:bg-gray-100" aria-label="메뉴">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute mt-40 left-4 z-50 bg-white border rounded shadow text-sm" onMouseLeave={closeMenu}>
                <div className="px-3 py-2 text-gray-500">로딩 중...</div>
              </div>
            )}
            <div />
          </div>
        </header>

        <div className="flex-grow p-4 overflow-hidden">
          <div className="flex h-full" style={{ flexDirection: isMobile ? 'column' : 'row' }}>
            {/* 문서 목록 스켈레톤 */}
            <div className={`bg-white rounded shadow flex flex-col ${isMobile ? 'block flex-grow mb-2' : 'w-1/5 mr-2'
              }`}>
              <div className="p-3 border-b">
                <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
              </div>
              <div className="flex-grow overflow-auto p-3">
                <DocumentListSkeleton />
              </div>
            </div>

            {/* 에디터 스켈레톤 */}
            <div className={`bg-white rounded shadow flex flex-col ${isMobile ? 'block flex-grow mb-2' : 'flex-1 mx-2'
              }`}>
              <EditorSkeleton />
            </div>

            {/* AI 패널 스켈레톤 */}
            <div className={`bg-white rounded shadow flex flex-col ${isMobile ? 'block flex-grow' : 'w-1/4 ml-2'
              }`}>
              <AiPanelSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="miki-root h-screen flex flex-col bg-gray-100">
      {/* 상단 메뉴 바 제거 (세로 메뉴로 대체) */}
      <header className={`px-4 py-2 bg-white border-b ${isFullscreen ? 'hidden' : ''}`} style={{ display: 'none' }} />
      {/* 단축키 도움말 오버레이 */}
      {helpOpen && (
        <div className="miki-help-overlay" onClick={() => setHelpOpen(false)}>
          <div className="miki-help-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div className="font-semibold">단축키 도움말</div>
              <button className="p-1 rounded hover:bg-gray-100" onClick={() => setHelpOpen(false)} aria-label="닫기">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>
            <div className="miki-help-content text-sm">
              <div className="mb-2 text-gray-600">앱 어디서든 <span className="miki-kbd">?</span> 를 눌러 이 패널을 열 수 있어요. ESC로 닫기.</div>
              <ul className="space-y-1">
                <li><span className="miki-kbd">Ctrl</span> + <span className="miki-kbd">S</span> — 문서 저장</li>
                <li><span className="miki-kbd">Ctrl</span> + <span className="miki-kbd">N</span> — 새 문서</li>
                <li><span className="miki-kbd">Ctrl</span> + <span className="miki-kbd">F</span> — 문서 검색</li>
                <li><span className="miki-kbd">Ctrl</span> + <span className="miki-kbd">Enter</span> — 전체화면 토글</li>
                <li><span className="miki-kbd">Ctrl</span> + <span className="miki-kbd">E</span> — 에디터 포커스</li>
                <li><span className="miki-kbd">Ctrl</span> + <span className="miki-kbd">K</span> — 검색창 포커스</li>
                <li><span className="miki-kbd">ESC</span> — 전체화면 나가기 / 이 패널 닫기</li>
              </ul>
              <hr className="my-3" />
              <div className="text-gray-700">
                <div className="font-semibold mb-1">기초 튜토리얼</div>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>좌측 상단의 <strong>문서+ 아이콘</strong>을 눌러 새 문서를 만듭니다.</li>
                  <li>본문을 입력하면 제목이 자동으로 추출됩니다. 필요하면 상단에서 직접 수정하세요.</li>
                  <li>링크 버튼으로 문서 간 연결을 만들 수 있습니다. 검색/AI를 활용해 빠르게 연결하세요.</li>
                  <li>자동저장이 켜져 있습니다. <span className="miki-kbd">Ctrl</span>+<span className="miki-kbd">S</span> 로 수동 저장도 가능합니다.</li>
                  <li>배포 전, 사이드바의 <strong>배포</strong> 버튼으로 프리플라이트 점검을 통과한 뒤 위키에 게시하세요.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="p-4">
          <ErrorDisplay
            error={error}
            context="load"
            onRetry={handleRetryError}
            onDismiss={handleCloseError}
          />
        </div>
      )}

      {/* 메시지 토스트 */}
      <MessageToast message={message} onClose={handleCloseMessage} />

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-grow p-4 overflow-hidden" style={{ minHeight: 0 }}>
        <AppLayout
          isFullscreen={isFullscreen}
          isMobile={isMobile}
          activeMobilePanel={activeMobilePanel}
          setActiveMobilePanel={setActiveMobilePanel}
          editorPanelClass={editorPanelClass}
          sidebarView={sidebarView}
          setSidebarView={setSidebarView}

          // DocumentSidebar props
          currentDocument={currentDocument}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchInputRef={searchInputRef}
          onLoadPost={loadPost}
          onNewPost={newPost}
          onDeletePost={handleDeletePost}
          setMessage={setMessage}
          content={content}
          onPublish={handlePublish}
          isPublishing={isPublishing}

          // EditorPanel props
          title={title}
          titleMode={titleMode}
          saveStatus={getSaveStatusMessage()}
          isLoadingDocuments={isLoadingDocuments}
          editorRef={editorRef}
          onTitleChange={handleTitleChange}
          onSavePost={manualSave}
          onToggleFullscreen={toggleFullscreen}
          onEditorContextUpdate={handleEditorContextUpdate}
          onEditorChange={handleEditorChange}
          onSendToAi={(data) => aiPanelRef.current?.triggerAiProcessing(data)}
          onNavigateRequest={handleNavigateToId}
          hasUnsavedChanges={hasUnsavedChanges}
          isAutoSaving={isAutoSaving}
          isManualSaving={isManualSaving}

          // AiPanelContainer props
          aiPanelRef={aiPanelRef}
          currentDocumentId={currentDocument?.id}
          editorContext={editorContext}
          onApplyAiCommand={handleAiCommand}
          onStructuredCommand={handleAiCommand}
          onDisplaySuggestion={handleAiSuggestion}
        />
      </div>
    </div>
  );
}

// QueryClientProvider로 감싸는 메인 App 컴포넌트
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* SSOT 강제 설정: 레거시 localStorage 스캔 비활성화 */}
        {(() => { try { if (typeof window !== 'undefined') window.MIKI_STRICT_SSOT = true; } catch { } return null; })()}
        <AppContent />
        {/* 🎯 React Query 완전 해방: DevTools 완전 비활성화 */}
        {/* DevTools가 리페치를 유발할 수 있으므로 완전 차단 */}
        {false && process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;