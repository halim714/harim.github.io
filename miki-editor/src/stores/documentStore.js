import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist } from 'zustand/middleware';

// 이벤트 브리지 및 검색 캐시 무효화 헬퍼
const dispatchDocumentsChanged = (eventType, affectedIds) => {
  try {
    const detail = { eventType, affectedIds, timestamp: Date.now() };
    const evt = new CustomEvent('miki:documents:changed', { detail });
    window.dispatchEvent(evt);
  } catch (e) {
    console.warn('⚠️ [DocumentStore] 이벤트 디스패치 실패:', e);
  }
};

const clearScanCacheV2 = () => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('miki_scan_cache_v2_'));
    keys.forEach(k => localStorage.removeItem(k));
    if (keys.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`🧹 [DocumentStore] 검색 스캔 캐시(v2) 무효화: ${keys.length}개`);
    }
  } catch (e) {
    console.warn('⚠️ [DocumentStore] 검색 캐시 무효화 실패:', e);
  }
};

/**
 * 📚 통합 문서 스토어 (Single Source of Truth)
 * 
 * 모든 문서 상태를 중앙에서 관리하여 동기화 문제를 원천적으로 해결
 * - 서버 파일시스템과 동기화
 * - 모든 UI 컴포넌트에서 동일한 데이터 사용
 * - 이벤트 기반 상태 전파
 */
export const useDocumentStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // 📋 핵심 데이터
        documents: new Map(), // id → Document 객체 매핑
        currentDocumentId: null,
        searchIndex: new Map(), // 검색 인덱스 캐시
        
        // 🔄 상태 관리
        loading: false,
        syncing: false,
        error: null,
        lastSyncTime: null,
        
        // 📊 통계
        totalDocuments: 0,
        
        // ✨ 문서 관리 액션들
        
        /**
         * 문서 설정/업데이트
         */
        setDocument: (doc) => {
          set((state) => {
            const newDocs = new Map(state.documents);
            newDocs.set(doc.id, {
              ...doc,
              updatedAt: new Date().toISOString(),
              _localModified: true
            });
            
            // 검색 인덱스 업데이트
            const newSearchIndex = new Map(state.searchIndex);
            const searchableText = `${doc.title} ${doc.content || ''}`.toLowerCase();
            newSearchIndex.set(doc.id, {
              title: doc.title,
              searchText: searchableText,
              lastIndexed: Date.now()
            });
            
            console.log(`📝 [DocumentStore] 문서 설정: ${doc.id} → "${doc.title}"`);
            
            return {
              documents: newDocs,
              searchIndex: newSearchIndex,
              totalDocuments: newDocs.size,
              lastSyncTime: Date.now()
            };
          });
          clearScanCacheV2();
          dispatchDocumentsChanged('upsert', [doc.id]);
        },
        
        /**
         * 여러 문서 일괄 설정
         */
        setDocuments: (docs) => {
          set((state) => {
            const newDocs = new Map();
            const newSearchIndex = new Map();
            
            docs.forEach(doc => {
              newDocs.set(doc.id, {
                ...doc,
                _localModified: false // 서버에서 받은 데이터
              });
              
              const searchableText = `${doc.title} ${doc.content || ''}`.toLowerCase();
              newSearchIndex.set(doc.id, {
                title: doc.title,
                searchText: searchableText,
                lastIndexed: Date.now()
              });
            });
            
            console.log(`📚 [DocumentStore] 문서 일괄 설정: ${docs.length}개`);
            
            return {
              documents: newDocs,
              searchIndex: newSearchIndex,
              totalDocuments: newDocs.size,
              lastSyncTime: Date.now(),
              loading: false,
              error: null
            };
          });
          clearScanCacheV2();
          dispatchDocumentsChanged('bulk_set', docs.map(d => d.id));
        },
        
        /**
         * 문서 삭제
         */
        removeDocument: (id) => {
          set((state) => {
            const newDocs = new Map(state.documents);
            const newSearchIndex = new Map(state.searchIndex);
            
            const removedDoc = newDocs.get(id);
            newDocs.delete(id);
            newSearchIndex.delete(id);
            
            console.log(`🗑️ [DocumentStore] 문서 삭제: ${id} → "${removedDoc?.title || 'Unknown'}"`);
            
            // 현재 문서가 삭제된 문서라면 null로 설정
            const newCurrentId = state.currentDocumentId === id ? null : state.currentDocumentId;
            
            return {
              documents: newDocs,
              searchIndex: newSearchIndex,
              currentDocumentId: newCurrentId,
              totalDocuments: newDocs.size,
              lastSyncTime: Date.now()
            };
          });
          clearScanCacheV2();
          dispatchDocumentsChanged('delete', [id]);
        },
        
        /**
         * 현재 문서 설정
         */
        setCurrentDocument: (id) => {
          set((state) => {
            if (state.documents.has(id)) {
              console.log(`📄 [DocumentStore] 현재 문서 변경: ${id}`);
              return { currentDocumentId: id };
            }
            console.warn(`⚠️ [DocumentStore] 존재하지 않는 문서 ID: ${id}`);
            return state;
          });
        },
        
        /**
         * 로딩 상태 설정
         */
        setLoading: (loading) => set({ loading }),
        
        /**
         * 동기화 상태 설정
         */
        setSyncing: (syncing) => set({ syncing }),
        
        /**
         * 에러 상태 설정
         */
        setError: (error) => {
          console.error('❌ [DocumentStore] 에러:', error);
          set({ error, loading: false, syncing: false });
        },
        
        // 🔍 조회 헬퍼들
        
        /**
         * 모든 문서 배열로 반환
         */
        getAllDocuments: () => {
          const docs = Array.from(get().documents.values());
          return docs.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        },
        
        /**
         * ID로 문서 조회
         */
        getDocumentById: (id) => {
          return get().documents.get(id) || null;
        },
        
        /**
         * 현재 문서 조회
         */
        getCurrentDocument: () => {
          const { currentDocumentId, documents } = get();
          return currentDocumentId ? documents.get(currentDocumentId) || null : null;
        },
        
        /**
         * 검색 인덱스로 문서 검색
         */
        searchDocuments: (query) => {
          const { searchIndex, documents } = get();
          const lowercaseQuery = query.toLowerCase();
          const results = [];
          
          for (const [id, indexData] of searchIndex) {
            if (indexData.searchText.includes(lowercaseQuery)) {
              const doc = documents.get(id);
              if (doc) {
                results.push({
                  ...doc,
                  relevanceScore: indexData.searchText.indexOf(lowercaseQuery) === -1 ? 0 : 
                    Math.round((1 - indexData.searchText.indexOf(lowercaseQuery) / indexData.searchText.length) * 100)
                });
              }
            }
          }
          
          return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
        },
        
        /**
         * 수정된 문서들 반환 (서버 동기화용)
         */
        getModifiedDocuments: () => {
          const docs = Array.from(get().documents.values());
          return docs.filter(doc => doc._localModified);
        },

        /**
         * 호환 어댑터: 기존 코드에서 사용하는 CRUD 메서드 제공
         * 다른 스토어 구현(`src/stores/index.js`)과의 인터페이스 차이를 흡수
         */
        addDocument: (doc) => {
          // setDocument와 동일 동작, 신규 문서 추가 시 사용
          get().setDocument(doc);
        },

        updateDocument: (id, updates) => {
          const existing = get().documents.get(id);
          if (!existing) {
            console.warn('⚠️ [DocumentStore] updateDocument: 존재하지 않는 문서 ID:', id);
            return;
          }
          const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
          get().setDocument(merged);
        },

        deleteDocument: (id) => {
          get().removeDocument(id);
        },
        
        /**
         * 전체 스토어 초기화
         */
        reset: () => {
          console.log('🔄 [DocumentStore] 스토어 초기화');
          set({
            documents: new Map(),
            currentDocumentId: null,
            searchIndex: new Map(),
            loading: false,
            syncing: false,
            error: null,
            lastSyncTime: null,
            totalDocuments: 0
          });
        }
      }),
      {
        name: 'miki-document-store', // localStorage 키
        storage: {
          getItem: (name) => {
            const item = localStorage.getItem(name);
            if (!item) return null;
            
            try {
              const parsed = JSON.parse(item);
              // Map 객체 복원
              if (parsed.state && parsed.state.documents) {
                parsed.state.documents = new Map(Object.entries(parsed.state.documents));
              }
              if (parsed.state && parsed.state.searchIndex) {
                parsed.state.searchIndex = new Map(Object.entries(parsed.state.searchIndex));
              }
              return parsed;
            } catch (error) {
              console.error('DocumentStore 복원 실패:', error);
              return null;
            }
          },
          setItem: (name, value) => {
            try {
              // Map 객체를 Object로 변환하여 저장
              const stateToSave = {
                ...value,
                state: {
                  ...value.state,
                  documents: value.state.documents instanceof Map ? 
                    Object.fromEntries(value.state.documents) : value.state.documents,
                  searchIndex: value.state.searchIndex instanceof Map ? 
                    Object.fromEntries(value.state.searchIndex) : value.state.searchIndex
                }
              };
              localStorage.setItem(name, JSON.stringify(stateToSave));
            } catch (error) {
              console.error('DocumentStore 저장 실패:', error);
            }
          },
          removeItem: (name) => localStorage.removeItem(name)
        }
      }
    )
  )
);

// 📡 이벤트 기반 동기화를 위한 구독 헬퍼
export const subscribeToDocumentChanges = (callback) => {
  return useDocumentStore.subscribe(
    (state) => state.documents,
    (documents, prevDocuments) => {
      if (documents !== prevDocuments) {
        callback(Array.from(documents.values()));
      }
    }
  );
};

// 📊 디버깅용 스토어 상태 출력
export const debugDocumentStore = () => {
  const state = useDocumentStore.getState();
  console.group('📚 DocumentStore 상태');
  console.log('문서 수:', state.totalDocuments);
  console.log('현재 문서:', state.currentDocumentId);
  console.log('로딩:', state.loading);
  console.log('동기화:', state.syncing);
  console.log('마지막 동기화:', state.lastSyncTime ? new Date(state.lastSyncTime).toLocaleString() : 'Never');
  console.log('문서 목록:', Array.from(state.documents.keys()));
  console.groupEnd();
}; 