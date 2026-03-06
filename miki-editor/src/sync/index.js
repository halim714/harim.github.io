import { createLogger } from '../utils/logger';

const logger = createLogger('index');
import { SyncQueue } from '../utils/database';

import { HttpAdapter } from './httpAdapter';
import { WebSocketAdapter } from './wsAdapter';
import { ConflictResolver } from './conflict';
export { getPendingSyncProcessor, resetPendingSyncProcessor } from './PendingSyncProcessor';

/**
 * SyncManager - 중앙화된 동기화 관리자
 * 
 * 역할:
 * - 로컬 IndexedDB와 원격 서버 간 데이터 동기화
 * - 네트워크 상태 감지 및 오프라인 큐 관리
 * - 충돌 해결 및 재시도 로직
 */
export class SyncManager {
  constructor(options = {}) {
    this.httpAdapter = options.httpAdapter || new HttpAdapter();
    this.wsAdapter = options.wsAdapter || new WebSocketAdapter();
    this.conflictResolver = options.conflictResolver || new ConflictResolver();
    
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.syncInterval = null;
    this.retryTimeout = null;
    
    // Event listeners
    this.listeners = {
      sync: [],
      conflict: [],
      error: []
    };
    
    this.init();
  }
  
  init() {
    // Network status monitoring
    window.addEventListener('online', () => {
      logger.info('🌐 네트워크 연결됨');
      this.isOnline = true;
      this.processPendingQueue();
    });
    
    window.addEventListener('offline', () => {
      logger.info('📴 네트워크 연결 끊김');
      this.isOnline = false;
    });
    
    // Start periodic sync
    this.startPeriodicSync();
    
    // WebSocket connection for real-time sync
    if (this.isOnline) {
      this.wsAdapter.connect();
    }
  }
  
  /**
   * 문서 동기화 (Optimistic UI 패턴)
   */
  async syncDocument(documentId, operation = 'update', data = {}) {
    try {
      // 1. 로컬 큐에 추가 (오프라인 대비)
      await SyncQueue.enqueue(documentId, operation, data);
      
      // 2. 온라인 상태면 즉시 동기화 시도
      if (this.isOnline) {
        return await this.processSyncItem({
          documentId,
          operation,
          data: JSON.stringify(data)
        });
      }
      
      // 3. 오프라인이면 큐에만 저장
      this.emit('sync', {
        status: 'queued',
        documentId,
        operation,
        message: '오프라인 상태 - 큐에 저장됨'
      });
      
      return { success: true, queued: true };
      
    } catch (error) {
      logger.error('❌ 문서 동기화 실패:', error);
      this.emit('error', { documentId, operation, error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 개별 동기화 항목 처리
   */
  async processSyncItem(item) {
    try {
      const data = JSON.parse(item.data || '{}');
      let result;
      
      switch (item.operation) {
        case 'create':
          result = await this.httpAdapter.createDocument(data);
          break;
        case 'update':
          result = await this.httpAdapter.updateDocument(item.documentId, data);
          break;
        case 'delete':
          result = await this.httpAdapter.deleteDocument(item.documentId);
          break;
        default:
          throw new Error(`알 수 없는 작업: ${item.operation}`);
      }
      
      // 성공 시 큐에서 제거
      if (item.queueId) {
        await SyncQueue.markAsCompleted(item.queueId);
      }
      
      this.emit('sync', {
        status: 'completed',
        documentId: item.documentId,
        operation: item.operation,
        result
      });
      
      return { success: true, result };
      
    } catch (error) {
      logger.error(`❌ 동기화 항목 처리 실패:`, error);
      
      // 충돌 감지 (409 Conflict)
      if (error.status === 409) {
        return await this.handleConflict(item, error);
      }
      
      // 재시도 가능한 오류 (5xx, 네트워크 오류)
      if (this.isRetryableError(error)) {
        if (item.queueId) {
          await SyncQueue.markAsFailed(item.queueId, error.message);
        }
        return { success: false, retry: true, error: error.message };
      }
      
      // 재시도 불가능한 오류 (4xx)
      if (item.queueId) {
        await SyncQueue.markAsFailed(item.queueId, error.message);
      }
      
      this.emit('error', {
        documentId: item.documentId,
        operation: item.operation,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 충돌 처리
   */
  async handleConflict(item, error) {
    try {
      const serverData = error.data || {};
      const localData = JSON.parse(item.data || '{}');
      
      const resolution = await this.conflictResolver.resolve({
        documentId: item.documentId,
        local: localData,
        server: serverData,
        operation: item.operation
      });
      
      this.emit('conflict', {
        documentId: item.documentId,
        resolution,
        local: localData,
        server: serverData
      });
      
      // 해결된 데이터로 재시도
      if (resolution.action === 'merge' || resolution.action === 'use_local') {
        const mergedData = resolution.data || localData;
        return await this.httpAdapter.updateDocument(item.documentId, mergedData);
      }
      
      return { success: true, conflict: true, resolution };
      
    } catch (conflictError) {
      logger.error('❌ 충돌 해결 실패:', conflictError);
      return { success: false, error: conflictError.message };
    }
  }
  
  /**
   * 대기 중인 큐 처리
   */
  async processPendingQueue() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      const pendingItems = await SyncQueue.getPendingItems();
      logger.info(`📤 처리할 동기화 항목: ${pendingItems.length}개`);
      
      for (const item of pendingItems) {
        await this.processSyncItem(item);
        
        // Rate limiting - 100ms 간격
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      logger.error('❌ 큐 처리 실패:', error);
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * 주기적 동기화 시작
   */
  startPeriodicSync(interval = 30000) { // 30초
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.processPendingQueue();
      }
    }, interval);
  }
  
  /**
   * 주기적 동기화 중지
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  /**
   * 재시도 가능한 오류 판단
   */
  isRetryableError(error) {
    // 5xx 서버 오류
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // 네트워크 오류
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return true;
    }
    
    // 타임아웃
    if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
      return true;
    }
    
    return false;
  }
  
  /**
   * 이벤트 리스너 등록
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }
  
  /**
   * 이벤트 리스너 제거
   */
  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }
  
  /**
   * 이벤트 발생
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`❌ 이벤트 리스너 오류 (${event}):`, error);
        }
      });
    }
  }
  
  /**
   * 동기화 상태 조회
   */
  async getStatus() {
    const pendingItems = await SyncQueue.getPendingItems();
    const failedItems = await SyncQueue.getFailedItems?.() || [];
    
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pendingCount: pendingItems.length,
      failedCount: failedItems.length,
      wsConnected: this.wsAdapter.isConnected()
    };
  }
  
  /**
   * 강제 동기화
   */
  async forcSync() {
    if (!this.isOnline) {
      throw new Error('오프라인 상태에서는 동기화할 수 없습니다.');
    }
    
    return await this.processPendingQueue();
  }
  
  /**
   * 정리
   */
  destroy() {
    this.stopPeriodicSync();
    
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    
    this.wsAdapter.disconnect();
    
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    this.listeners = { sync: [], conflict: [], error: [] };
  }
}

// Singleton instance
let syncManagerInstance = null;

/**
 * SyncManager 싱글톤 인스턴스 가져오기
 */
export const getSyncManager = (options = {}) => {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager(options);
  }
  return syncManagerInstance;
};

/**
 * SyncManager 인스턴스 재설정 (테스트용)
 */
export const resetSyncManager = () => {
  if (syncManagerInstance) {
    syncManagerInstance.destroy();
    syncManagerInstance = null;
  }
}; 