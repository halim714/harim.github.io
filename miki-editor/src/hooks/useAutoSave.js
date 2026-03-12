import { createLogger } from '../utils/logger';

const logger = createLogger('useAutoSave');
import { useEffect, useRef, useCallback, useState } from 'react';

import { useSaveDocument } from './useDocuments';

// 🎯 Phase 1: 저장 필요 여부 판단 함수
const shouldSave = (content, title, isNewDocument) => {
  const hasContent = content.trim().length > 0;
  const hasCustomTitle = title && title.trim() && title !== '새 메모';

  // 새 문서: 내용이 생기면 저장, 제목만 변경은 저장 안 함
  if (isNewDocument) {
    return hasContent;
  }

  // 기존 문서: 내용이 비어있으면 파괴적 저장 방지 (의도적 삭제는 별도 흐름에서 처리)
  if (!hasContent) {
    return false;
  }

  // 내용이 있고, 제목이 같은지와 관계없이 저장
  return true;
};

const useAutoSave = ({
  document,
  content,
  title,
  titleMode = 'auto', // 🎯 새로 추가: 제목 모드
  enabled = true,
  interval = 3000, // 3초
  onSaveStart,
  onSaveSuccess,
  onSaveError,
  // 🚀 새로 추가: Lazy Document 생성을 위한 콜백
  onLazyDocumentCreate
}) => {
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'pending', 'error'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveTimeoutRef = useRef(null);
  const lastContentRef = useRef(content);
  const lastTitleRef = useRef(title);
  const isManualSaveRef = useRef(false);
  const lastSavedHashRef = useRef('');

  const makeHash = useCallback((text, ttl) => {
    const a = typeof text === 'string' ? text : '';
    const b = typeof ttl === 'string' ? ttl : '';
    return `${a.length}|${b.length}|${a.slice(0, 64)}|${b.slice(0, 64)}`;
  }, []);

  const saveMutation = useSaveDocument();

  // 🎯 Lazy Document 생성 함수
  const createLazyDocument = useCallback(() => {
    if (onLazyDocumentCreate) {
      logger.info('🔮 [LAZY-DOC] 자동 문서 생성 시작');
      const lazyDoc = onLazyDocumentCreate();
      logger.info('✅ [LAZY-DOC] 자동 문서 생성 완료:', lazyDoc?.id);
      return lazyDoc;
    }
    return null;
  }, [onLazyDocumentCreate]);

  // 🟢 [Fix] 문서 전환(ID 변경) 시 변경 감지 기준점 리셋
  // 이 코드가 없으면, 문서 A -> B 전환 시 내용 차이를 '수정'으로 인식하여 자동 저장해버림
  useEffect(() => {
    if (document?.id) {
      // 새로운 문서가 로드되었으므로, 현재 내용을 '기준점'으로 설정
      lastContentRef.current = content;
      lastTitleRef.current = title;

      // "변경되지 않음" 상태로 초기화
      setHasUnsavedChanges(false);

      // 저장 상태를 초기화 — 이전 문서의 "N분 전 저장됨" 표시 방지
      setSaveStatus('saved');
      setLastSaved(null);

      // 혹시 예약된 자동저장이 있다면 취소 (이전 문서의 잔여 작업 방지)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // 🔴 [Fix] 수동 저장 플래그도 초기화
      isManualSaveRef.current = false;

      logger.info(`🔄 [AUTO-SAVE] 문서 전환 감지: ${document.id} - 변경 감지 기준점 리셋`);
    }
  }, [document?.id]); // ⚠️ document.id가 바뀔 때만 실행

  // 변경사항 감지 - 🎯 Phase 1: 의미있는 변경사항만 저장 + Lazy Document 생성
  useEffect(() => {
    // 🟢 [Fix] 현재 내용이 문서 원본과 완전히 같다면, 
    // 이는 '타이핑'이 아니라 '로드 완료' 상황이므로 변경 감지 기준점만 업데이트하고 종료
    if (document && content === document.content) {
      lastContentRef.current = content;
      lastTitleRef.current = title;
      return; // 저장 로직 실행 안 함 🛑
    }

    const contentChanged = content !== lastContentRef.current;
    const titleChanged = title !== lastTitleRef.current;

    if (contentChanged || titleChanged) {
      // 🚀 핵심 개선: currentDocument가 없고 의미있는 내용이 있으면 즉시 문서 생성
      if (!document && content.trim().length > 0) {
        logger.info('🔮 [LAZY-DOC] 빈 에디터에서 내용 감지 - 자동 문서 생성 트리거');
        const lazyDoc = createLazyDocument();

        if (lazyDoc) {
          // 문서가 생성되었으므로 다음 useEffect에서 정상 저장 로직이 실행됨
          logger.info('✅ [LAZY-DOC] 자동 문서 생성 성공 - 다음 사이클에서 저장 진행');
          lastContentRef.current = content;
          lastTitleRef.current = title;
          return; // 이번 사이클은 여기서 종료, 다음 사이클에서 저장 로직 실행
        } else {
          logger.warn('⚠️ [LAZY-DOC] 자동 문서 생성 실패 - onLazyDocumentCreate 콜백 없음');
        }
      }

      // 🚀 핵심 개선: 저장할 가치가 있는 변경사항인지 판단
      const saveDecision = shouldSave(content, title, !!document?.isEmpty);

      if (saveDecision === true) {
        // 정상적인 저장 필요한 변경사항
        setHasUnsavedChanges(true);
        setSaveStatus('pending');

        // 이전 타이머 취소
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // 자동 저장이 활성화되어 있고 수동 저장 중이 아닐 때만 타이머 설정
        if (enabled && !isManualSaveRef.current) {
          saveTimeoutRef.current = setTimeout(() => {
            performAutoSave();
          }, interval);
        }

        logger.info('✅ [AUTO-SAVE] 의미있는 변경사항 감지 - 자동저장 예약');

      } else if (saveDecision === false) {
        // 빈 내용: 저장 중단
        setHasUnsavedChanges(false);
        setSaveStatus('saved');

        // 기존 자동저장 타이머 취소
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }

        logger.info('🛑 [AUTO-SAVE] 빈 내용 감지 - 자동저장 중단');

      }

      lastContentRef.current = content;
      lastTitleRef.current = title;
    }
  }, [content, title, enabled, interval, document?.isEmpty, document, createLazyDocument]);

  // 자동 저장 실행
  const performAutoSave = useCallback(async () => {
    if (!document || !hasUnsavedChanges) return;

    // 🔴 [Fix] 삭제된 문서(ID가 없는 경우 등)는 저장하지 않음
    if (!document.id) {
      logger.warn('🛑 [AUTO-SAVE] 문서 ID 없음 - 저장 중단');
      return;
    }

    // 동일 내용 재저장 방지
    const currentHash = makeHash(content, title);
    if (currentHash === lastSavedHashRef.current) {
      logger.info('🛑 [AUTO-SAVE] 동일 내용 감지 - 저장 생략');
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      return;
    }

    try {
      setSaveStatus('saving');
      onSaveStart?.();

      const documentToSave = {
        ...document,
        content,
        title,
        titleMode,
        filename: document.filename, // 🟢 [Fix] filename 보존
        // ✅ 자동저장 시에만 updatedAt 명시적으로 설정
        updatedAt: new Date().toISOString()
      };

      const savedDocument = await saveMutation.mutateAsync(documentToSave);

      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setLastSaved(new Date());
      lastSavedHashRef.current = currentHash;
      onSaveSuccess?.(savedDocument || documentToSave);

    } catch (error) {
      logger.error('자동 저장 실패:', error);
      setSaveStatus('error');
      onSaveError?.(error);
    }
  }, [document, content, title, titleMode, hasUnsavedChanges, saveMutation, onSaveStart, onSaveSuccess, onSaveError]);

  // 수동 저장
  const manualSave = useCallback(async () => {
    logger.info('🚀 [MANUAL-SAVE] 수동 저장 시작');
    logger.info('📊 [MANUAL-SAVE] 현재 상태:', {
      hasDocument: !!document,
      documentId: document?.id,
      contentLength: content?.length,
      title: title
    });

    if (!document) {
      logger.error('❌ [MANUAL-SAVE] document가 없어서 저장 불가능');
      logger.info('💡 [MANUAL-SAVE] 새 문서를 먼저 생성해야 합니다');
      return;
    }

    // 🎯 Phase 1: 수동 저장도 의미있는 내용만 저장
    const saveDecision = shouldSave(content, title, document?.isEmpty);

    if (saveDecision === false) {
      logger.info('🛑 [MANUAL-SAVE] 빈 내용이므로 저장하지 않음');
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      return;
    }
    // 동일 내용 재저장 방지
    const currentHash = makeHash(content, title);
    if (currentHash === lastSavedHashRef.current) {
      logger.info('🛑 [MANUAL-SAVE] 동일 내용 감지 - 저장 생략');
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      return;
    }

    if (saveDecision === 'CONFIRM_DELETE') {
      logger.info('⚠️ [MANUAL-SAVE] 기존 문서 삭제 확인 필요 (Phase 2에서 처리)');
      setSaveStatus('confirm_delete');
      return;
    }

    // 수동 저장 플래그 설정
    isManualSaveRef.current = true;
    logger.info('✅ [MANUAL-SAVE] 수동 저장 플래그 설정');

    // 자동 저장 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      logger.info('✅ [MANUAL-SAVE] 자동 저장 타이머 취소');
    }

    try {
      setSaveStatus('saving');
      logger.info('✅ [MANUAL-SAVE] 저장 상태를 saving으로 설정');

      onSaveStart?.();
      logger.info('✅ [MANUAL-SAVE] onSaveStart 콜백 실행');

      const documentToSave = {
        ...document,
        content,
        title,
        titleMode,
        filename: document.filename, // 🟢 [Fix] filename 보존
        updatedAt: new Date().toISOString()
      };
      logger.info('✅ [MANUAL-SAVE] 저장할 문서 데이터 준비:', {
        id: documentToSave.id,
        title: documentToSave.title,
        titleMode: documentToSave.titleMode,
        contentLength: documentToSave.content?.length
      });

      logger.info('🔄 [MANUAL-SAVE] saveMutation 실행 시작');
      const savedDocument = await saveMutation.mutateAsync(documentToSave);
      logger.info('✅ [MANUAL-SAVE] saveMutation 실행 완료');

      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setLastSaved(new Date());
      lastSavedHashRef.current = currentHash;
      logger.info('✅ [MANUAL-SAVE] 저장 상태 업데이트 완료');

      onSaveSuccess?.(savedDocument || documentToSave);
      logger.info('✅ [MANUAL-SAVE] onSaveSuccess 콜백 실행');

      // 🟢 [변경] 저장된 최신 문서 객체 반환
      return savedDocument || documentToSave;

    } catch (error) {
      logger.error('❌ [MANUAL-SAVE] 수동 저장 실패:', error);
      setSaveStatus('error');
      onSaveError?.(error);
      throw error; // 🟢 [변경] 호출자가 실패를 알 수 있도록 에러 전파
    } finally {
      // 수동 저장 플래그 해제
      isManualSaveRef.current = false;
      logger.info('✅ [MANUAL-SAVE] 수동 저장 플래그 해제');
    }
  }, [document, content, title, titleMode, saveMutation, onSaveStart, onSaveSuccess, onSaveError]);

  // 저장 상태 메시지 생성
  const getSaveStatusMessage = useCallback(() => {
    switch (saveStatus) {
      case 'saving':
        return '저장 중...';
      case 'pending':
        return '변경됨';
      case 'error':
        return '저장 실패';
      case 'saved':
        if (lastSaved) {
          const now = new Date();
          const diffMs = now - lastSaved;
          const diffMinutes = Math.floor(diffMs / 60000);

          if (diffMinutes < 1) {
            return '방금 저장됨';
          } else if (diffMinutes < 60) {
            return `${diffMinutes}분 전 저장됨`;
          } else {
            return lastSaved.toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit'
            }) + ' 저장됨';
          }
        }
        return '저장됨';
      default:
        return '저장됨';
    }
  }, [saveStatus, lastSaved]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // 페이지 이탈 시 저장되지 않은 변경사항 경고
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '저장되지 않은 변경사항이 있습니다. 정말 나가시겠습니까?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return {
    saveStatus,
    hasUnsavedChanges,
    lastSaved,
    manualSave,
    getSaveStatusMessage,
    isAutoSaving: saveStatus === 'saving' && !isManualSaveRef.current,
    isManualSaving: saveStatus === 'saving' && isManualSaveRef.current,
  };
};

export default useAutoSave; 