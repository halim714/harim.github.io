import { createLogger } from './logger';

const logger = createLogger('RealTimeDocumentSync');

class RealTimeDocumentSync {
  constructor() {
    this.titleCache = new Map();
    this.pendingUpdates = new Map();
    this.eventListeners = new Map(); // 이벤트 리스너 관리
    
    if (!window.RealTimeDocSync) {
      window.RealTimeDocSync = this;
      logger.info('🚀 RealTimeDocumentSync 전역 인스턴스 생성');
    }
    
    return window.RealTimeDocSync;
  }
  
  updateTitleImmediate(docId, newTitle) {
    const startTime = performance.now();
    
    try {
      // 1. 캐시 즉시 업데이트
      this.titleCache.set(docId, newTitle);
      
      // 2. DOM 즉시 반영
      this.updateDOMDirect(docId, newTitle);
      
      // 3. 이벤트 발생
      this.dispatchTitleChangeEvent(docId, newTitle);
      
      // 4. React 상태 백그라운드 업데이트
      this.scheduleReactUpdate(docId, newTitle);
      
      const endTime = performance.now();
      logger.info(`⚡ [REAL-TIME] 제목 즉시 업데이트: ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      logger.error(`❌ [REAL-TIME] 제목 업데이트 중 에러:`, error);
    }
  }
  
  updateDOMDirect(docId, newTitle) {
    try {
      const titleElements = document.querySelectorAll(`[data-doc-id="${docId}"] .doc-title`);
      
      titleElements.forEach(el => {
        el.textContent = newTitle;
        el.setAttribute('data-real-time', 'true');
        el.classList.add('real-time-updated');
        
        setTimeout(() => {
          el.classList.remove('real-time-updated');
        }, 200);
      });
      
      // 제목 입력 필드도 업데이트
      const titleInput = document.querySelector('input[placeholder*="문서 제목"]');
      if (titleInput && titleInput.getAttribute('data-current-doc') === docId) {
        titleInput.value = newTitle;
        titleInput.setAttribute('data-real-time', 'true');
      }
      
      logger.info(`📝 [DOM-UPDATE] DOM 직접 업데이트: ${titleElements.length}개 요소`);
    } catch (error) {
      logger.error(`❌ [DOM-UPDATE] DOM 업데이트 중 에러:`, error);
    }
  }
  
  dispatchTitleChangeEvent(docId, newTitle) {
    try {
      const event = new CustomEvent('doc-title-changed', {
        detail: { docId, newTitle, timestamp: Date.now() }
      });
      
      window.dispatchEvent(event);
      logger.info(`📡 [EVENT] 제목 변경 이벤트 발생: ${docId}`);
    } catch (error) {
      logger.error(`❌ [EVENT] 이벤트 발생 중 에러:`, error);
    }
  }
  
  scheduleReactUpdate(docId, newTitle) {
    try {
      // 기존 타임아웃이 있으면 취소
      if (this.pendingUpdates.has(docId)) {
        const existingTimeoutId = this.pendingUpdates.get(docId);
        clearTimeout(existingTimeoutId);
        logger.info(`⏰ [SCHEDULE] 기존 스케줄 취소: ${docId}`);
      }
      
      const timeoutId = setTimeout(() => {
        this.flushToReact(docId, newTitle);
        this.pendingUpdates.delete(docId);
      }, 100);
      
      this.pendingUpdates.set(docId, timeoutId);
      logger.info(`⏰ [SCHEDULE] React 업데이트 스케줄됨: 100ms 후 (총 ${this.pendingUpdates.size}개 대기)`);
    } catch (error) {
      logger.error(`❌ [SCHEDULE] React 업데이트 스케줄링 중 에러:`, error);
    }
  }
  
  flushToReact(docId, newTitle) {
    try {
      const event = new CustomEvent('flush-to-react', {
        detail: { docId, newTitle, timestamp: Date.now() }
      });
      
      window.dispatchEvent(event);
      logger.info(`🔄 [REACT-SYNC] React 상태 동기화 시작: ${docId}`);
    } catch (error) {
      logger.error(`❌ [REACT-SYNC] React 동기화 중 에러:`, error);
    }
  }

  /**
   * 이벤트 리스너 등록 (window.addEventListener 래퍼)
   * @param {string} eventType - 이벤트 타입
   * @param {Function} handler - 핸들러 함수
   */
  addEventListener(eventType, handler) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType).add(handler);
    window.addEventListener(eventType, handler);
    
    logger.info(`🎧 [LISTENER] 이벤트 리스너 등록: ${eventType}`);
  }
  
  /**
   * 이벤트 리스너 제거 (window.removeEventListener 래퍼)
   * @param {string} eventType - 이벤트 타입
   * @param {Function} handler - 핸들러 함수
   */
  removeEventListener(eventType, handler) {
    if (this.eventListeners.has(eventType)) {
      this.eventListeners.get(eventType).delete(handler);
    }
    
    window.removeEventListener(eventType, handler);
    logger.info(`🔇 [LISTENER] 이벤트 리스너 제거: ${eventType}`);
  }

  /**
   * 캐시된 제목 가져오기
   * @param {string} docId - 문서 ID
   * @returns {string|null} 캐시된 제목
   */
  getCachedTitle(docId) {
    return this.titleCache.get(docId) || null;
  }

  /**
   * 시스템 정리
   */
  cleanup() {
    try {
      // 모든 대기 중인 업데이트 취소
      this.pendingUpdates.forEach(timeoutId => clearTimeout(timeoutId));
      this.pendingUpdates.clear();
      
      // 모든 이벤트 리스너 제거
      this.eventListeners.forEach((handlers, eventType) => {
        handlers.forEach(handler => {
          window.removeEventListener(eventType, handler);
        });
      });
      this.eventListeners.clear();
      
      // 캐시 정리
      this.titleCache.clear();
      
      logger.info('🧹 [CLEANUP] RealTimeDocumentSync 정리 완료');
    } catch (error) {
      logger.error(`❌ [CLEANUP] 정리 중 에러:`, error);
    }
  }
}

const realTimeDocSync = new RealTimeDocumentSync();
export default realTimeDocSync; 
 
 
 
 
 
 
 
 
 
 
 