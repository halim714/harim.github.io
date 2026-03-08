import { createLogger } from '../../utils/logger';

const logger = createLogger('DocumentSidebar');
import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDocuments } from '../../hooks/useDocuments';
import realTimeDocSync from '../../utils/RealTimeDocumentSync';
import DocumentSearchManager from '../../utils/DocumentSearchManager';
import { usePhantomDocument } from '../../hooks/usePhantomDocument';
import { storage } from '../../utils/storage-client'; // 🔥 NEW: storage client import
import Icon from '../common/Icon';
import { queryKeys } from '../../config/queryClient';
import { useConfirm } from '../../hooks/useConfirm';

const removeMarkdownFormatting = (text) => {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s+/g, '') // 헤더 제거
    .replace(/\*\*(.*?)\*\*/g, '$1') // 볼드 제거
    .replace(/\*(.*?)\*/g, '$1') // 이탤릭 제거
    .replace(/`(.*?)`/g, '$1') // 인라인 코드 제거
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 링크 제거
    .replace(/!\[.*?\]\(.*?\)/g, '') // 이미지 제거
    .replace(/^\s*[-*+]\s+/gm, '') // 리스트 마커 제거
    .replace(/^\s*\d+\.\s+/gm, '') // 번호 리스트 마커 제거
    .replace(/^\s*>\s+/gm, '') // 인용문 제거
    .replace(/```[\s\S]*?```/g, '') // 코드 블록 제거
    .replace(/\n{2,}/g, '\n') // 연속된 줄바꿈 정리
    .trim();
};

const DocumentSidebar = ({
  currentDocument,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  onLoadPost,
  onNewPost,
  onDeletePost,
  onPublish,
  isPublishing,
  isMobile,
  activeMobilePanel,
  setActiveMobilePanel,
  setMessage,
  content // 🔥 NEW: Phantom Document 미리보기를 위한 content prop 추가
}) => {
  const queryClient = useQueryClient();
  const { data: documentsData, isLoading, error, refetch } = useDocuments();

  // 🎯 성능 측정을 위한 ref 생성
  const documentListRef = useRef(null);

  // 🎯 실시간 제목 동기화를 위한 상태
  const [realtimeTitles, setRealtimeTitles] = useState(new Map());

  // 🔥 NEW: useConfirm 훅 사용
  const confirm = useConfirm();

  // 🔥 NEW: DocumentSearchManager 인스턴스 생성 및 검색 상태 관리
  const [searchManager] = useState(() => new DocumentSearchManager());
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchMode, setSearchMode] = useState('basic'); // 'basic', 'advanced', 'ai'
  const [sort, setSort] = useState('updated_desc'); // 'updated_desc' | 'updated_asc' | 'title_asc'

  // 🔥 NEW: documentsData 변경 시 searchManager에 실제 문서 데이터 주입
  useEffect(() => {
    if (documentsData && documentsData.length > 0) {
      logger.info(`📊 [DATA-BRIDGE] documentsData → searchManager 주입: ${documentsData.length}개 문서`);

      // 서버 문서를 searchManager가 사용할 수 있는 형태로 변환
      const serverDocuments = documentsData.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.preview || '', // 우선 preview를 content로 사용
        path: `/doc/${doc.id}`,
        isFromServer: true,
        serverData: doc // 원본 서버 데이터 보존
      }));

      // DocumentSearchManager에 서버 문서 데이터 주입
      if (searchManager.setServerDocuments) {
        searchManager.setServerDocuments(serverDocuments);
      } else {
        // setServerDocuments 메서드가 없으면 임시로 documentCache에 저장
        serverDocuments.forEach(doc => {
          if (searchManager.documentCache) {
            searchManager.documentCache.set(doc.id, doc);
          }
        });
        logger.info(`📊 [DATA-BRIDGE] documentCache에 ${serverDocuments.length}개 문서 캐시됨`);
      }
    }
  }, [documentsData, searchManager]);

  // 🔥 NEW: 디바운싱된 검색 함수
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId;
      return (query) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          if (!query.trim()) {
            setSearchResults([]);
            setSearchMode('basic');
            return;
          }

          setIsSearching(true);
          try {
            logger.info(`🔍 [SEARCH] 기본 키워드 검색만 사용 (AI 검색 비활성화): "${query}"`);

            // 🔥 DISABLED: AI 검색 비활성화 - 토큰 절약
            // const results = await searchManager.searchDocuments(query);

            // 기본 검색으로만 처리
            setSearchResults([]);
            setSearchMode('basic');

            logger.info(`✅ [SEARCH] 기본 검색 모드로 전환됨`);

          } catch (error) {
            logger.error('🚨 [SEARCH] 검색 오류:', error);
            setMessage({
              type: 'error',
              text: '검색 중 오류가 발생했습니다.'
            });
            // 오류 시 기본 필터링으로 폴백
            setSearchResults([]);
            setSearchMode('basic');
          } finally {
            setIsSearching(false);
          }
        }, 300); // 300ms 디바운싱
      };
    })(),
    [searchManager, setMessage]
  );

  // 🔥 NEW: 검색어 변경 시 통합 검색 실행
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // 🔥 NEW: Phantom Document 상태 관리
  const { getPhantomClass } = usePhantomDocument();

  // 🔥 ENHANCED: 검색 필터링된 문서 목록 (하이브리드 방식)
  const filteredPosts = useMemo(() => {
    if (!documentsData) return [];

    if (!searchQuery.trim()) {
      // 🔥 NEW: 일반 모드에서도 고유 렌더링 키 추가
      let posts = documentsData.map(doc => ({
        ...doc,
        _renderKey: `normal-${doc.id}`
      }));

      // 🔥 PHANTOM: currentDocument가 임시이고 목록에 없으면 맨 위에 추가
      if (currentDocument?.isEmpty &&
        !posts.find(p => p.id === currentDocument.id)) {

        const phantomDoc = {
          ...currentDocument,
          preview: content ? content.substring(0, 100) + '...' : '새 메모를 작성하세요...',
          _isPhantom: true,
          _trustLevel: 'temporary',
          _renderKey: `phantom-${currentDocument.id}-${Date.now()}`
        };

        posts.unshift(phantomDoc);
        logger.info(`🔮 [PHANTOM] 임시 문서를 목록에 추가: ${currentDocument.id}`);
      }

      // 정렬 적용 (라이브러리와 동일한 정책)
      const sorted = [...posts];
      if (sort === 'title_asc') {
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else if (sort === 'updated_asc') {
        sorted.sort((a, b) => new Date(a.updatedAt || a.createdAt || 0) - new Date(b.updatedAt || b.createdAt || 0));
      } else {
        sorted.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      }
      return sorted;
    }

    // 고급 검색 결과가 있으면 우선 사용
    if (searchMode !== 'basic' && searchResults.length > 0) {
      logger.info(`🎯 [FILTER] 고급 검색 모드: ${searchMode}, ${searchResults.length}개 결과 사용`);

      // 🔥 NEW: Map을 사용한 중복 제거 및 정체성 보장 시스템
      const uniqueDocumentsMap = new Map();

      // DocumentSearchManager 결과를 documentsData 형태로 변환하면서 중복 제거
      searchResults
        .filter(result => !result.isError && !result.isCreateNew)
        .forEach(result => {
          // 기존 documentsData에서 해당 문서 찾기
          const existingDoc = documentsData.find(doc =>
            doc.id === result.id ||
            doc.title === result.title ||
            doc.title.toLowerCase() === result.title.toLowerCase()
          );

          let finalDoc;
          if (existingDoc) {
            finalDoc = {
              ...existingDoc,
              // 검색 결과 메타데이터 추가
              searchScore: result.score || result.semanticScore,
              searchMode: searchMode,
              searchPreview: result.preview,
              isAiResult: result.isAiGenerated,
              isSemanticResult: !!result.semanticScore,
              // 🔥 NEW: 고유 렌더링 식별자 추가
              _renderKey: `search-${existingDoc.id}-${searchMode}`
            };
          } else {
            // 새로운 검색 결과인 경우 (AI 생성 등)
            finalDoc = {
              id: result.id,
              title: result.title,
              preview: result.preview || result.content?.substring(0, 150),
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              size: result.content?.length || 0,
              searchScore: result.score || result.semanticScore,
              searchMode: searchMode,
              isAiResult: result.isAiGenerated,
              isSemanticResult: !!result.semanticScore,
              // 🔥 NEW: 고유 렌더링 식별자 추가
              _renderKey: `new-${result.id}-${searchMode}`
            };
          }

          // Map에서 중복 제거: ID를 키로 사용하여 마지막 결과만 유지
          uniqueDocumentsMap.set(finalDoc.id, finalDoc);
        });

      // Map을 배열로 변환하여 반환
      const finalResults = Array.from(uniqueDocumentsMap.values());
      logger.info(`🎯 [DEDUP] 중복 제거 완료: ${searchResults.length}개 → ${finalResults.length}개`);

      return finalResults;
    }

    // 기본 필터링 (폴백)
    logger.info(`📋 [FILTER] 기본 필터링 모드 사용`);
    return documentsData.filter(doc =>
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.preview?.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(doc => ({
      ...doc,
      _renderKey: `basic-${doc.id}`
    }));
  }, [documentsData, searchQuery, searchResults, searchMode, currentDocument, content, sort]);

  // 🎯 실시간 제목 변경 이벤트 리스너 등록
  useEffect(() => {
    const isDebugMode = process.env.NODE_ENV === 'development';

    const handleTitleChange = (event) => {
      const { docId, newTitle } = event.detail;
      setRealtimeTitles(prev => new Map(prev.set(docId, newTitle)));

      // 🎯 로그 최적화: 개발 환경에서만 상세 로그
      if (isDebugMode) {
        logger.info(`📝 [REAL-TIME] 문서목록 제목 실시간 업데이트: ${docId} → ${newTitle}`);
      }
    };

    const handleReactSync = (event) => {
      const { docId, newTitle } = event.detail;

      // 🎯 로그 최적화: 개발 환경에서만 로그
      if (isDebugMode) {
        logger.info(`🔄 [REACT-SYNC] 백그라운드 동기화 완료: ${docId}`);
      }
      // React 상태 업데이트는 기존 Optimistic Update가 처리
    };

    // 이벤트 리스너 등록
    realTimeDocSync.addEventListener('doc-title-changed', handleTitleChange);
    realTimeDocSync.addEventListener('flush-to-react', handleReactSync);

    return () => {
      realTimeDocSync.removeEventListener('doc-title-changed', handleTitleChange);
      realTimeDocSync.removeEventListener('flush-to-react', handleReactSync);
    };
  }, []);

  // 🎯 성능 측정 전역 객체 초기화
  useEffect(() => {
    if (!window.DocumentListPerfTracker) {
      // 🎯 로그 최적화: 개발 환경에서만 상세 로그
      const isDebugMode = process.env.NODE_ENV === 'development';

      window.DocumentListPerfTracker = {
        markDataReceived: (timestamp) => {
          if (isDebugMode) {
            console.log(`📊 [LIST-PERF] 데이터 수신: ${timestamp.toFixed(2)}ms`);
          }
        },
        markDOMUpdate: (timestamp) => {
          if (isDebugMode) {
            console.log(`📋 [LIST-PERF] DOM 업데이트: ${timestamp.toFixed(2)}ms`);
          }
        },
        markDataChangeStart: () => {
          if (isDebugMode) {
            console.log(`🔄 [LIST-PERF] 데이터 변경 시작: ${performance.now().toFixed(2)}ms`);
            // 스택 트레이스로 변경 원인 추적 (개발 환경에서만)
            console.trace('🔍 [LIST-PERF] 데이터 변경 트리거 스택 트레이스');
          }
        },
        lastDataTime: null,
        dataChangeCount: 0,
        isDebugMode: isDebugMode
      };
    }
  }, []);

  // 🎯 실시간 제목 가져오기 헬퍼 함수
  const getDisplayTitle = (post) => {
    const realtimeTitle = realtimeTitles.get(post.id);
    const actualTitle = realtimeTitle || post.title;

    // 제목이 비어있으면 문서 내용의 첫 줄을 표시
    if (!actualTitle || actualTitle.trim() === '') {
      const firstLine = (post.content || '').split('\n')[0].trim();
      if (firstLine) {
        // 마크다운 포맷팅 제거하고 최대 30자까지만 표시
        return removeMarkdownFormatting(firstLine).substring(0, 30) + (firstLine.length > 30 ? '...' : '');
      }
      return '(제목 없음)';
    }

    return actualTitle;
  };

  const handleRefresh = () => {
    console.log('🔄 [MANUAL-REFRESH] 수동 새로고침 시작 - 사용자 요청');
    console.log('🎯 [LIBERATION] React Query 완전 해방 모드에서 유일한 리페치 방법');

    // 🎯 완전 해방 모드에서는 수동 새로고침만이 유일한 리페치 방법
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() });

    // 강제 리페치 (staleTime: Infinity를 무시하고 강제 실행)
    refetch();

    setMessage({
      type: 'info',
      text: 'React Query 해방 모드: 수동 새로고침 실행됨'
    });
  };

  const handleCleanup = async () => {
    try {
      const { default: DataSyncManager } = await import('../../utils/DataSyncManager.js');
      const syncManager = new DataSyncManager();
      const result = syncManager.immediateLocalCleanup(['제니', '로제', '먐시리', '블랙핑크']);

      setMessage({
        type: 'success',
        text: `로컬 정리 완료: ${result.preservedDocuments}개 보존, ${result.deletedDocuments}개 삭제`
      });
    } catch (error) {
      logger.error('수동 정리 오류:', error);
      setMessage({
        type: 'error',
        text: '정리 중 오류가 발생했습니다.'
      });
    }
  };

  const handleDocumentClick = (post) => {
    onLoadPost(post.id);
    if (isMobile) setActiveMobilePanel('editor');
  };

  const handleNewPostClick = () => {
    onNewPost();
    if (isMobile) setActiveMobilePanel('editor');
  };

  const handleDeleteDocument = async (post) => {
    const ok = await confirm({
      title: '문서 삭제',
      message: `'${post.title}'을(를) 삭제하시겠습니까?`,
      danger: true,
    });

    if (ok) {
      try {
        // 🔥 Phase 2: Optimistic Delete - 즉시 UI에서 제거
        console.log(`🚀 [DELETE] 삭제 시작: ${post.title}`);

        const previousData = queryClient.getQueryData(queryKeys.documents.lists());
        const optimisticData = previousData?.filter(doc => doc.id !== post.id);

        // 즉시 캐시 업데이트 (UI에서 바로 사라짐)
        queryClient.setQueryData(queryKeys.documents.lists(), optimisticData);

        // ✅ Serverless Delete: storage client 사용
        await storage.deletePost(post.id);

        // ✅ 삭제 성공 - 로컬 스토리지 정리
        try {
          console.log(`✅ [DELETE] 삭제 완료: ${post.title}`);

          // 1. 메인 문서 데이터 삭제
          localStorage.removeItem(`miki_document_${post.id}`);
          localStorage.removeItem(`miki_title_${post.id}`);

          // 2. 최근 문서 목록에서 정확한 ID만 제거
          const recentDocsJson = localStorage.getItem('miki_recent_docs');
          if (recentDocsJson) {
            const recentDocs = JSON.parse(recentDocsJson);
            const filteredDocs = recentDocs.filter(doc => doc.id !== post.id);
            localStorage.setItem('miki_recent_docs', JSON.stringify(filteredDocs));
          }

          // 3. 현재 문서 처리 콜백
          onDeletePost(post);

          // 4. 최종 캐시 검증 (서버와 동기화)
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() });
          }, 1000);

          setMessage({ type: 'success', text: '글이 삭제되었습니다.' });

        } catch (localError) {
          console.error('❌ [DELETE] 로컬 스토리지 정리 오류:', localError);
        }

      } catch (error) {
        // ❌ 오류 발생 - 원본 데이터 복원
        console.error('❌ [DELETE] 삭제 실패:', error);
        const previousData = queryClient.getQueryData(queryKeys.documents.lists());

        // 안전 장치: 삭제된 문서가 캐시에 없으면 서버에서 다시 가져오기
        if (!previousData?.find(doc => doc.id === post.id)) {
          queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() });
        }

        setMessage({ type: 'error', text: '삭제 실패: ' + (error.message || '알 수 없는 오류') });
      }
    }
  };

  // 🎯 성능 측정 강화: 데이터 변경 간격과 트리거 원인 추적 (최적화됨)
  const [lastDocumentsDataRef, setLastDocumentsDataRef] = useState(null);

  // 🎯 성능 최적화: Throttled 데이터 변경 로깅
  const throttledDataLogger = useMemo(() => {
    let lastLogTime = 0;
    const LOG_INTERVAL = 1000; // 1초에 최대 1회만 로깅
    const isDebugMode = process.env.NODE_ENV === 'development';

    return (documentsData, now) => {
      if (now - lastLogTime < LOG_INTERVAL) {
        return; // 로깅 생략
      }

      lastLogTime = now;

      if (window.DocumentListPerfTracker) {
        window.DocumentListPerfTracker.markDataReceived(now);
        window.DocumentListPerfTracker.dataChangeCount++;

        // 🎯 로그 최적화: 중요한 정보만 출력
        if (isDebugMode) {
          console.log(`📊 [LIST-PERF] 총 데이터 변경 횟수: ${window.DocumentListPerfTracker.dataChangeCount}회`);
        }

        // 🔥 삭제 작업 감지 로직 (중요한 정보이므로 항상 출력)
        if (lastDocumentsDataRef) {
          const prevLength = JSON.parse(lastDocumentsDataRef).length;
          const currentLength = documentsData?.length || 0;

          if (currentLength < prevLength) {
            console.log(`🗑️ [DELETE-SYNC] 문서 삭제: ${prevLength} → ${currentLength}`);
            if (isDebugMode) {
              console.log(`⚡ [REAL-TIME] 문서 삭제 → 목록 실시간 동기화 정상 작동`);
            }
          } else if (currentLength > prevLength) {
            console.log(`📝 [CREATE-SYNC] 문서 생성: ${prevLength} → ${currentLength}`);
          } else if (isDebugMode) {
            console.log(`🔍 [LIST-PERF] 변경 원인: Optimistic Update (실시간 제목/내용 연동)`);
          }
        } else if (isDebugMode) {
          console.log(`🔍 [LIST-PERF] 초기 데이터 로드`);
        }

        if (isDebugMode) {
          console.log(`✅ [REAL-TIME] 에디터 ↔ 문서목록 실시간 동기화 정상 작동`);

          // 캐시 상태 정보 (간소화)
          const cacheData = queryClient.getQueryData(queryKeys.documents.lists());
          console.log(`💾 [CACHE-INFO] 캐시 데이터 존재: ${!!cacheData}`);
          console.log(`💾 [CACHE-INFO] 캐시 데이터 길이: ${cacheData?.length || 0}`);

          // 데이터 변경 간격 측정 (간소화)
          if (window.DocumentListPerfTracker.lastDataTime) {
            const interval = now - window.DocumentListPerfTracker.lastDataTime;
            console.log(`📊 [LIST-PERF] 데이터 변경 간격: ${interval.toFixed(2)}ms`);

            // 성능 요약 로그 (조건부)
            if (window.DocumentListPerfTracker.dataChangeCount >= 3) {
              console.log(`📝 [REAL-TIME] 실시간 동기화 활발히 작동 중: ${window.DocumentListPerfTracker.dataChangeCount}회 변경`);
              console.log(`🎯 [OPTIMIZATION] Optimistic Update 기반 즉시 반응 - 사용자 경험 최적화`);
            }
          }
        }

        window.DocumentListPerfTracker.lastDataTime = now;
      }
    };
  }, [queryClient, lastDocumentsDataRef]);

  useEffect(() => {
    if (documentsData) {
      // 🎯 Phase 3: 실제 변경사항 확인 - 불필요한 리렌더링 방지
      const currentDataString = JSON.stringify(documentsData.map(doc => ({
        id: doc.id,
        title: doc.title,
        updatedAt: doc.updatedAt,
        contentLength: doc.content?.length || 0
      })));

      if (lastDocumentsDataRef === currentDataString) {
        console.log('🎯 [RENDER-OPT] 동일한 데이터 - useEffect 건너뜀');
        return;
      }

      setLastDocumentsDataRef(currentDataString);

      const now = performance.now();

      // 🎯 Throttled 로깅 적용
      throttledDataLogger(documentsData, now);
    }
  }, [documentsData, throttledDataLogger]);

  // 🎯 성능 최적화: Debounced DOM 업데이트 측정
  const debouncedDOMLogger = useMemo(() => {
    let timeoutId = null;
    let updateCount = 0;

    return (timestamp) => {
      updateCount++;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        if (updateCount > 1) {
          console.log(`📋 [LIST-PERF] 배치 DOM 업데이트 완료: ${updateCount}회 업데이트, 마지막: ${timestamp.toFixed(2)}ms`);
        } else {
          console.log(`📋 [LIST-PERF] DOM 업데이트 완료: ${timestamp.toFixed(2)}ms`);
        }
        updateCount = 0;
      }, 100); // 100ms 디바운스
    };
  }, []);

  // 🎯 DOM 업데이트 시점 정밀 측정 (최적화됨)
  useEffect(() => {
    if (documentListRef.current) {
      const observer = new MutationObserver((mutations) => {
        const timestamp = performance.now();

        // 🎯 의미있는 변경사항만 감지
        const hasSignificantChanges = mutations.some(mutation => {
          return mutation.type === 'childList' &&
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) &&
            Array.from(mutation.addedNodes).some(node =>
              node.nodeType === Node.ELEMENT_NODE &&
              node.classList &&
              (node.classList.contains('document-item') || node.querySelector('.document-item'))
            );
        });

        if (hasSignificantChanges) {
          debouncedDOMLogger(timestamp);

          if (window.DocumentListPerfTracker) {
            window.DocumentListPerfTracker.markDOMUpdate(timestamp);
          }
        }
      });

      observer.observe(documentListRef.current, {
        childList: true,
        subtree: true,
        attributes: false, // 속성 변경 무시
        characterData: false // 텍스트 변경 무시
      });

      return () => observer.disconnect();
    }
  }, [documentListRef.current, debouncedDOMLogger]);

  return (
    <div
      className={`bg-white rounded shadow flex flex-col ${isMobile ? (activeMobilePanel === 'list' ? 'block' : 'hidden') + ' flex-grow' : 'w-1/5 min-w-[280px] mr-2'
        }`}
      style={{ display: isMobile && activeMobilePanel !== 'list' ? 'none' : 'flex' }}
    >
      {/* 헤더 (라이브러리와 동일 레이아웃) */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">문서 목록</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onNewPost}
              className="h-9 px-2 rounded-md flex items-center text-gray-700 hover:bg-gray-100"
              title="새 글"
              aria-label="새 글"
            >
              <Icon name="doc-plus" size={18} className="text-gray-700" />
              <span className="ml-1 text-sm">새글</span>
            </button>
            <button
              onClick={() => onPublish && onPublish()}
              disabled={!!isPublishing}
              className={`h-9 px-2 rounded-md flex items-center ${isPublishing ? 'cursor-not-allowed opacity-60 text-gray-500' : 'text-gray-700 hover:bg-gray-100'}`}
              title={isPublishing ? '게시 중…' : '게시'}
            >
              {isPublishing ? (
                <svg className="w-4 h-4 mr-1 animate-spin text-gray-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              ) : (
                <Icon name="paper-plane" size={18} className="mr-1 text-gray-600" />
              )}
              <span className="text-sm">{isPublishing ? '게시 중…' : '게시'}</span>
            </button>
          </div>
        </div>
        {/* 검색 + 정렬 */}
        <div className="flex items-center space-x-2">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border rounded-md pr-10 focus:outline-none focus:ring-2 focus:ring-blue-300 flex-grow"
            style={{ maxWidth: '60%' }}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-2 py-2 border rounded-md text-sm bg-white"
            title="정렬"
            style={{ width: 110 }}
          >
            <option value="updated_desc">최신순</option>
            <option value="updated_asc">오래된순</option>
            <option value="title_asc">제목순</option>
          </select>
        </div>
        <div className="mt-1 text-xs text-gray-500 text-right">{(documentsData || []).length}개의 문서</div>
      </div>

      {/* 검색 입력 */}
      {/* 기존 검색 블록은 헤더로 이동하여 통합됨 */}

      {/* 문서 목록 */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="text-center py-4 text-gray-500">로딩 중...</div>
        ) : error ? (
          <div className="text-center py-4">
            <div className="text-red-500 mb-2 text-sm">GitHub에서 문서를 불러오지 못했습니다.</div>
            <div className="text-gray-400 mb-3 text-xs">{error.message || '연결을 확인하세요.'}</div>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              다시 시도
            </button>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            {searchQuery ? (
              isSearching ? '검색 중...' : '검색 결과가 없습니다.'
            ) : '문서가 없습니다.'}
          </div>
        ) : (
          <ul className="divide-y">
            {filteredPosts.map(post => {
              const phantomClass = post._isPhantom ? (getPhantomClass(post.id) || 'phantom-temporary') : '';
              const selectedClass = currentDocument?.id === post.id
                ? 'bg-gray-50 border-l-4 border-l-gray-400'
                : 'border-l-4 border-l-transparent';

              const formatDay = (iso) => {
                try { return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { return ''; }
              };
              const formatTime = (iso) => {
                try { return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return ''; }
              };

              return (
                <li
                  key={post._renderKey || post.id}
                  className={`py-3 px-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors duration-150 border-b last:border-b-0 leading-tight ${selectedClass} ${phantomClass}`}
                >
                  <button
                    onClick={() => handleDocumentClick(post)}
                    className="text-left w-full"
                  >
                    {/* 1행: 제목 + 상단 우측 메뉴(세로점) */}
                    <div className="flex items-center justify-between">
                      <div className="text-gray-900 font-medium truncate">
                        {getDisplayTitle(post)}
                      </div>
                      <div className="ml-3 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); /* openDocMenu(post) */ }}
                          title="문서 설정"
                          className="p-1 text-gray-400 hover:text-gray-600"
                          aria-label="문서 설정"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path d="M10 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 11.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 19a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* 2행: 미리보기 */}
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {post.isEmpty ? (
                        <span className="text-gray-400 italic">새 메모를 작성하세요...</span>
                      ) : (
                        removeMarkdownFormatting(post.searchPreview || post.preview)
                      )}
                    </p>
                    {/* 3행: 날짜/시간(좌측), 원형 배지(최우측) */}
                    <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                      <div className="flex items-center w-full">
                        <span>{formatDay(post.updatedAt)}</span>
                        <span className="ml-2 flex-1 text-right">{formatTime(post.updatedAt)}</span>
                      </div>
                      <span
                        className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${post.status === 'published' ? 'bg-green-500' : 'bg-gray-400'}`}
                        title={post.status === 'published' ? '배포됨' : '작성 중'}
                      ></span>
                    </div>
                  </button>

                  {/* 삭제 버튼 (옵션) */}
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(post);
                      }}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DocumentSidebar; 