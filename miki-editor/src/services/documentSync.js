import { useDocumentStore } from '../stores/documentStore.js';

/**
 * 📡 문서 동기화 서비스
 * 
 * 서버와 클라이언트 스토어 간의 자동 동기화를 관리
 * - 실시간 서버 데이터 가져오기
 * - 로컬 변경사항 서버에 푸시
 * - 충돌 해결
 */
class DocumentSyncService {
  constructor() {
    this.syncInterval = null;
    this.isOnline = navigator.onLine;
    this.lastSyncTime = null;
    
    // 네트워크 상태 감지
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 [DocumentSync] 온라인 상태 - 동기화 재개');
      this.startAutoSync();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 [DocumentSync] 오프라인 상태 - 동기화 일시정지');
      this.stopAutoSync();
    });
  }
  
  /**
   * 서버에서 최신 문서 목록 가져오기
   */
  async fetchDocumentsFromServer() {
    try {
      console.log('📡 [DocumentSync] 서버에서 문서 목록 가져오는 중...');
      
      const response = await fetch('/api/posts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      const documents = await response.json();
      console.log(`🌐 [DocumentSync] 서버에서 ${documents.length}개 문서 수신`);
      
      // 스토어에 업데이트
      const documentStore = useDocumentStore.getState();
      documentStore.setDocuments(documents);
      
      this.lastSyncTime = Date.now();
      return documents;
      
    } catch (error) {
      console.error('❌ [DocumentSync] 서버 동기화 실패:', error);
      
      // 오프라인 상태로 처리
      if (error.message.includes('fetch')) {
        this.isOnline = false;
      }
      
      throw error;
    }
  }
  
  /**
   * 특정 문서를 서버에서 가져오기
   */
  async fetchDocumentById(id) {
    try {
      console.log(`📄 [DocumentSync] 문서 ${id} 가져오는 중...`);
      
      const response = await fetch(`/api/posts/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`⚠️ [DocumentSync] 문서 ${id}를 서버에서 찾을 수 없음`);
          return null;
        }
        throw new Error(`서버 응답 오류: ${response.status}`);
      }
      
      const document = await response.json();
      console.log(`✅ [DocumentSync] 문서 ${id} 수신: "${document.title}"`);
      
      // 스토어에 업데이트
      const documentStore = useDocumentStore.getState();
      documentStore.setDocument(document);
      
      return document;
      
    } catch (error) {
      console.error(`❌ [DocumentSync] 문서 ${id} 가져오기 실패:`, error);
      throw error;
    }
  }
  
  /**
   * 문서를 서버에 저장
   */
  async saveDocumentToServer(document) {
    try {
      console.log(`💾 [DocumentSync] 문서 ${document.id} 서버에 저장 중...`);
      
      const response = await fetch(`/api/posts/${document.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: document.id,
          title: document.title,
          content: document.content,
          titleMode: document.titleMode || 'auto'
        })
      });
      
      if (!response.ok) {
        throw new Error(`서버 저장 실패: ${response.status}`);
      }
      
      const savedDocument = await response.json();
      console.log(`✅ [DocumentSync] 문서 ${document.id} 서버 저장 완료`);
      
      // 스토어에서 localModified 플래그 제거
      const documentStore = useDocumentStore.getState();
      documentStore.setDocument({
        ...savedDocument,
        _localModified: false
      });
      
      return savedDocument;
      
    } catch (error) {
      console.error(`❌ [DocumentSync] 문서 ${document.id} 저장 실패:`, error);
      throw error;
    }
  }
  
  /**
   * 서버에서 문서 삭제
   */
  async deleteDocumentFromServer(id) {
    try {
      console.log(`🗑️ [DocumentSync] 문서 ${id} 서버에서 삭제 중...`);
      
      const response = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok && response.status !== 404) {
        throw new Error(`서버 삭제 실패: ${response.status}`);
      }
      
      console.log(`✅ [DocumentSync] 문서 ${id} 서버에서 삭제 완료`);
      
      // 스토어에서도 삭제
      const documentStore = useDocumentStore.getState();
      documentStore.removeDocument(id);
      
      return true;
      
    } catch (error) {
      console.error(`❌ [DocumentSync] 문서 ${id} 삭제 실패:`, error);
      throw error;
    }
  }
  
  /**
   * 수정된 문서들을 서버에 동기화
   */
  async syncModifiedDocuments() {
    try {
      const documentStore = useDocumentStore.getState();
      const modifiedDocs = documentStore.getModifiedDocuments();
      
      if (modifiedDocs.length === 0) {
        console.log('🔄 [DocumentSync] 동기화할 수정된 문서 없음');
        return [];
      }
      
      console.log(`🔄 [DocumentSync] ${modifiedDocs.length}개 수정된 문서 동기화 시작`);
      documentStore.setSyncing(true);
      
      const syncResults = [];
      
      for (const doc of modifiedDocs) {
        try {
          const result = await this.saveDocumentToServer(doc);
          syncResults.push({ success: true, document: result });
          console.log(`✅ [DocumentSync] ${doc.id} 동기화 완료`);
        } catch (error) {
          syncResults.push({ success: false, document: doc, error });
          console.error(`❌ [DocumentSync] ${doc.id} 동기화 실패:`, error);
        }
      }
      
      documentStore.setSyncing(false);
      console.log(`🔄 [DocumentSync] 동기화 완료: ${syncResults.filter(r => r.success).length}/${modifiedDocs.length} 성공`);
      
      return syncResults;
      
    } catch (error) {
      console.error('❌ [DocumentSync] 동기화 프로세스 실패:', error);
      const documentStore = useDocumentStore.getState();
      documentStore.setSyncing(false);
      throw error;
    }
  }
  
  /**
   * 전체 동기화 (서버 → 클라이언트)
   */
  async fullSync() {
    try {
      console.log('🔄 [DocumentSync] 전체 동기화 시작');
      
      // 1. 수정된 문서 먼저 서버에 저장
      await this.syncModifiedDocuments();
      
      // 2. 서버에서 최신 목록 가져오기
      await this.fetchDocumentsFromServer();
      
      console.log('✅ [DocumentSync] 전체 동기화 완료');
      
    } catch (error) {
      console.error('❌ [DocumentSync] 전체 동기화 실패:', error);
      throw error;
    }
  }
  
  /**
   * 자동 동기화 시작
   */
  startAutoSync(intervalMs = 30000) { // 30초마다
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    if (!this.isOnline) {
      console.log('📴 [DocumentSync] 오프라인 상태 - 자동 동기화 비활성화');
      return;
    }
    
    console.log(`🔄 [DocumentSync] 자동 동기화 시작 (${intervalMs / 1000}초 간격)`);
    
    this.syncInterval = setInterval(async () => {
      try {
        if (this.isOnline) {
          await this.syncModifiedDocuments();
        }
      } catch (error) {
        console.error('❌ [DocumentSync] 자동 동기화 오류:', error);
      }
    }, intervalMs);
  }
  
  /**
   * 자동 동기화 중단
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ [DocumentSync] 자동 동기화 중단');
    }
  }
  
  /**
   * 동기화 상태 확인
   */
  getSyncStatus() {
    const documentStore = useDocumentStore.getState();
    const modifiedCount = documentStore.getModifiedDocuments().length;
    
    return {
      isOnline: this.isOnline,
      isAutoSyncActive: !!this.syncInterval,
      isSyncing: documentStore.syncing,
      modifiedDocuments: modifiedCount,
      lastSyncTime: this.lastSyncTime,
      lastSyncTimeFormatted: this.lastSyncTime ? 
        new Date(this.lastSyncTime).toLocaleString() : 'Never'
    };
  }
}

// 싱글톤 인스턴스 생성
export const documentSyncService = new DocumentSyncService();

// 기본 내보내기
export default documentSyncService; 