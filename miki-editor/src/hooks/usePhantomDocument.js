import { useState, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('usePhantomDocument');

/**
 * Phantom Document 상태 관리 훅
 * - 임시 문서의 신뢰도 레벨과 UI 상태를 관리
 * - 기존 Zustand/React Query 로직과 완전 분리
 */
export const usePhantomDocument = () => {
  const [phantomStates, setPhantomStates] = useState(new Map());

  // Phantom Document 신뢰도 레벨 설정
  const setPhantomTrustLevel = useCallback((docId, trustLevel) => {
    setPhantomStates(prev => {
      const newMap = new Map(prev);
      newMap.set(docId, {
        ...newMap.get(docId),
        trustLevel,
        updatedAt: Date.now()
      });
      logger.info(`🔮 [PHANTOM] ${docId} 신뢰도 변경: ${trustLevel}`);
      return newMap;
    });
  }, []);

  // Phantom Document 제거
  const removePhantom = useCallback((docId) => {
    setPhantomStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(docId);
      logger.info(`🗑️ [PHANTOM] ${docId} 제거됨`);
      return newMap;
    });
  }, []);

  // Phantom Document 상태 조회
  const getPhantomState = useCallback((docId) => {
    return phantomStates.get(docId);
  }, [phantomStates]);

  // 신뢰도 레벨별 CSS 클래스 반환
  const getPhantomClass = useCallback((docId) => {
    const state = phantomStates.get(docId);
    if (!state) return '';
    
    switch (state.trustLevel) {
      case 'temporary':
        return 'phantom-temporary';
      case 'saving':
        return 'phantom-saving';
      case 'error':
        return 'phantom-error';
      default:
        return '';
    }
  }, [phantomStates]);

  return {
    setPhantomTrustLevel,
    removePhantom,
    getPhantomState,
    getPhantomClass,
    phantomStates
  };
}; 