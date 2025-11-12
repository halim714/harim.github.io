import { createLogger } from '../utils/logger';

const logger = createLogger('index');
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';

import { db } from '../utils/database';

// Document slice
const createDocumentSlice = (set, get) => ({
  // State
  documents: {},
  currentDocumentId: null,
  isLoading: false,
  saveStatus: '저장됨',
  serverSaveStatus: '저장됨',
  isSaving: false,
  
  // Document CRUD actions
  setCurrentDocument: (docOrId) => set((state) => {
    logger.info('🔄 [STORE] setCurrentDocument 호출:', docOrId);
    
    if (typeof docOrId === 'object' && docOrId !== null) {
      // 객체가 전달된 경우: documents에 추가하고 ID 설정
      const doc = docOrId;
      logger.info('✅ [STORE] 문서 객체 받음 - documents에 추가:', doc.id);
      state.documents[doc.id] = doc;
      state.currentDocumentId = doc.id;
      logger.info('✅ [STORE] currentDocumentId 설정 완료:', doc.id);
    } else if (typeof docOrId === 'string') {
      // 문자열 ID가 전달된 경우
      logger.info('✅ [STORE] 문서 ID 받음:', docOrId);
      state.currentDocumentId = docOrId;
    } else if (docOrId === null || docOrId === undefined) {
      // null/undefined인 경우
      logger.info('✅ [STORE] currentDocument 초기화');
      state.currentDocumentId = null;
    } else {
      logger.warn('⚠️ [STORE] 잘못된 타입의 docOrId:', typeof docOrId, docOrId);
    }
  }),
  
  addDocument: (doc) => set((state) => {
    state.documents[doc.id] = doc;
  }),
  
  updateDocument: (id, updates) => set((state) => {
    if (state.documents[id]) {
      Object.assign(state.documents[id], updates, {
        updatedAt: new Date().toISOString()
      });
    }
  }),
  
  deleteDocument: (id) => set((state) => {
    delete state.documents[id];
    if (state.currentDocumentId === id) {
      state.currentDocumentId = null;
    }
  }),
  
  // Title management with flags
  setTitle: (id, title, isUserEdit = false) => set((state) => {
    if (state.documents[id]) {
      state.documents[id].title = title;
      state.documents[id].isUserEditedTitle = isUserEdit;
      state.documents[id].isAutoSyncedTitle = !isUserEdit;
      state.documents[id].updatedAt = new Date().toISOString();
    }
  }),
  
  setContent: (id, content) => set((state) => {
    if (state.documents[id]) {
      state.documents[id].content = content;
      state.documents[id].updatedAt = new Date().toISOString();
      
      // Auto-extract title if not user-edited
      if (!state.documents[id].isUserEditedTitle) {
        const extractedTitle = extractTitleFromContent(content);
        if (extractedTitle && extractedTitle !== state.documents[id].title) {
          state.documents[id].title = extractedTitle;
          state.documents[id].isAutoSyncedTitle = true;
        }
      }
    }
  }),
  
  // Save status management
  setSaveStatus: (status) => set((state) => {
    state.saveStatus = status;
  }),
  
  setServerSaveStatus: (status) => set((state) => {
    state.serverSaveStatus = status;
  }),
  
  setIsSaving: (saving) => set((state) => {
    state.isSaving = saving;
  }),
  
  // Async actions
  loadDocuments: async () => {
    set((state) => { state.isLoading = true; });
    try {
      const docs = await db.documents.toArray();
      set((state) => {
        state.documents = {};
        docs.forEach(doc => {
          state.documents[doc.id] = doc;
        });
        state.isLoading = false;
      });
    } catch (error) {
      logger.error('문서 로드 실패:', error);
      set((state) => { state.isLoading = false; });
    }
  },
  
  saveDocument: async (id) => {
    const doc = get().documents[id];
    if (!doc) return;
    
    set((state) => { state.isSaving = true; });
    try {
      await db.documents.put(doc);
      set((state) => { 
        state.saveStatus = '저장됨';
        state.isSaving = false;
      });
    } catch (error) {
      logger.error('문서 저장 실패:', error);
      set((state) => { 
        state.saveStatus = '저장 실패';
        state.isSaving = false;
      });
    }
  }
});

// UI slice
const createUISlice = (set, get) => ({
  // State
  isFullscreen: false,
  searchQuery: '',
  windowWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
  isMobile: false,
  isTablet: false,
  activeMobilePanel: 'editor',
  message: { type: '', text: '' },
  messageVisible: false,
  
  // Actions
  setFullscreen: (fullscreen) => set((state) => {
    state.isFullscreen = fullscreen;
  }),
  
  setSearchQuery: (query) => set((state) => {
    state.searchQuery = query;
  }),
  
  setWindowDimensions: (width) => set((state) => {
    state.windowWidth = width;
    state.isMobile = width < 768;
    state.isTablet = width >= 768 && width < 1024;
  }),
  
  setActiveMobilePanel: (panel) => set((state) => {
    state.activeMobilePanel = panel;
    try {
      localStorage.setItem('miki_active_mobile_panel', panel);
    } catch (e) {
      logger.warn('패널 상태 저장 실패:', e);
    }
  }),
  
  showMessage: (type, text) => set((state) => {
    state.message = { type, text };
    state.messageVisible = true;
  }),
  
  hideMessage: () => set((state) => {
    state.messageVisible = false;
  })
});

// Editor context slice
const createEditorSlice = (set, get) => ({
  // State
  editorContext: {
    fullContent: '',
    selection: null
  },
  
  // Actions
  setEditorContext: (context) => set((state) => {
    state.editorContext = context;
  })
});

// Helper function for title extraction
const extractTitleFromContent = (content) => {
  if (!content || typeof content !== 'string') return '';
  
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      // Remove markdown formatting
      return trimmed
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .substring(0, 50);
    }
  }
  return '';
};

// Create the main store
export const useStore = create(
  subscribeWithSelector(
    immer((...a) => ({
      ...createDocumentSlice(...a),
      ...createUISlice(...a),
      ...createEditorSlice(...a),
      
      // Reset method for testing
      reset: () => a[0]((state) => {
        // Reset document slice
        state.documents = {};
        state.currentDocumentId = null;
        state.isLoading = false;
        state.saveStatus = '저장됨';
        state.serverSaveStatus = '저장됨';
        state.isSaving = false;
        
        // Reset UI slice
        state.isFullscreen = false;
        state.searchQuery = '';
        state.windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
        state.isMobile = false;
        state.isTablet = false;
        state.activeMobilePanel = 'editor';
        state.message = { type: '', text: '' };
        state.messageVisible = false;
        
        // Reset editor slice
        state.editorContext = {
          fullContent: '',
          selection: null
        };
      })
    }))
  )
);

// Selectors for better performance
export const useCurrentDocument = () => useStore((state) => {
  const currentId = state.currentDocumentId;
  return currentId ? state.documents[currentId] : null;
});

export const useDocumentList = () => useStore((state) => 
  Object.values(state.documents).sort((a, b) => 
    new Date(b.updatedAt) - new Date(a.updatedAt)
  )
);

export const useUIState = () => useStore((state) => ({
  isFullscreen: state.isFullscreen,
  searchQuery: state.searchQuery,
  windowWidth: state.windowWidth,
  isMobile: state.isMobile,
  isTablet: state.isTablet,
  activeMobilePanel: state.activeMobilePanel,
  message: state.message,
  messageVisible: state.messageVisible
}));

// Individual store hooks for App.jsx compatibility
export const useDocumentStore = () => {
  const documents = useStore((state) => Object.values(state.documents));
  const currentDocumentId = useStore((state) => state.currentDocumentId);
  const currentDocument = useStore((state) => 
    state.currentDocumentId ? state.documents[state.currentDocumentId] : null
  );
  const setCurrentDocument = useStore((state) => state.setCurrentDocument);
  const updateDocument = useStore((state) => state.updateDocument);
  const addDocument = useStore((state) => state.addDocument);
  const deleteDocument = useStore((state) => state.deleteDocument);
  const loadDocuments = useStore((state) => state.loadDocuments);
  
  return {
    documents,
    currentDocument,
    setCurrentDocument,
    updateDocument,
    addDocument,
    deleteDocument,
    loadDocuments,
  };
};

export const useUIStore = () => useStore((state) => ({
  sidebarOpen: false, // 기본값
  theme: 'light', // 기본값
  isFullscreen: state.isFullscreen,
  toggleSidebar: () => {}, // 기본 구현
  setTheme: () => {}, // 기본 구현
  toggleFullscreen: () => state.setFullscreen(!state.isFullscreen),
}));

export const useEditorStore = () => useStore((state) => ({
  content: state.currentDocumentId ? state.documents[state.currentDocumentId]?.content || '' : '',
  title: state.currentDocumentId ? state.documents[state.currentDocumentId]?.title || '' : '',
  isEditing: false, // 기본값
  saveStatus: state.saveStatus,
  setContent: (content) => {
    if (state.currentDocumentId) {
      state.setContent(state.currentDocumentId, content);
    }
  },
  setTitle: (title) => {
    if (state.currentDocumentId) {
      state.setTitle(state.currentDocumentId, title, true);
    }
  },
  setEditing: () => {}, // 기본 구현
  setSaveStatus: state.setSaveStatus,
})); 