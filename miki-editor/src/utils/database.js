import { createLogger } from '../utils/logger';

const logger = createLogger('database');
import Dexie from 'dexie';

// Database schema
export class MikiDatabase extends Dexie {
  constructor() {
    super('MikiEditorDB');

    // Define schemas
    this.version(1).stores({
      documents: '++id, title, content, updatedAt, isUserEditedTitle, isAutoSyncedTitle',
      syncQueue: '++queueId, documentId, operation, status, retryAt, retryCount, data'
    });

    // Version 2: Add docId and synced fields
    this.version(2).stores({
      documents: '++id, docId, title, content, updatedAt, isUserEditedTitle, isAutoSyncedTitle, synced',
      syncQueue: '++queueId, documentId, operation, status, retryAt, retryCount, data'
    });

    // Add hooks for automatic timestamps
    this.documents.hook('creating', function (primKey, obj, trans) {
      obj.createdAt = new Date().toISOString();
      obj.updatedAt = new Date().toISOString();
    });

    this.documents.hook('updating', function (modifications, primKey, obj, trans) {
      modifications.updatedAt = new Date().toISOString();
    });
  }
}

// Create database instance
export const db = new MikiDatabase();

// 🔥 DB Helpers for Local-First Strategy
export const dbHelpers = {
  // 로컬 저장 (IndexedDB)
  async saveLocal(post) {
    try {
      // docId로 기존 항목 찾기 (없으면 undefined)
      const existing = await db.documents.where('docId').equals(post.id).first();

      const data = {
        docId: post.id, // 명시적 ID 저장
        title: post.title,
        content: post.content,
        frontMatter: post.frontMatter,
        filename: post.filename, // 🟢 [추가] 파일명 영구 저장
        updatedAt: new Date().toISOString(),
        synced: false, // 🔴 미동기화 상태로 저장
        // 기존 필드 유지
        isUserEditedTitle: post.titleMode === 'manual',
        isAutoSyncedTitle: post.titleMode === 'auto'
      };

      if (existing) {
        await db.documents.update(existing.id, data);
      } else {
        await db.documents.add(data);
      }
      return true;
    } catch (error) {
      console.error('Local save failed:', error);
      throw error;
    }
  },

  // 동기화 완료 표시 (업데이트 포함)
  async markSynced(docId) {
    // 하위 호환성을 위해 유지
    return this.markSyncedWithUpdate(docId);
  },

  // 🟢 [New] 동기화 완료 및 추가 데이터 업데이트
  async markSyncedWithUpdate(docId, updates = {}) {
    try {
      const doc = await db.documents.where('docId').equals(docId).first();
      if (doc) {
        await db.documents.update(doc.id, {
          synced: true, // 🟢 동기화 완료
          ...updates    // 🟢 추가 필드 업데이트 (filename 등)
        });
      }
    } catch (e) {
      console.error('Failed to mark synced:', e);
    }
  },

  // 미동기화 문서 개수 확인 (App.jsx용)
  async getUnsyncedCount() {
    return await db.documents.where('synced').equals(false).count();
  },

  // 🔴 [New] 로컬 문서 삭제
  async deleteLocal(docId) {
    try {
      // docId로 찾아서 삭제
      const doc = await db.documents.where('docId').equals(docId).first();
      if (doc) {
        await db.documents.delete(doc.id);
        console.log(`🗑️ [DB] 로컬 문서 삭제 완료: ${docId}`);
      }
    } catch (error) {
      console.error('Local delete failed:', error);
    }
  }
};

// Migration utilities
export class DatabaseMigration {
  static async migrateFromLocalStorage() {
    logger.info('🔄 localStorage → IndexedDB 마이그레이션 시작');

    try {
      const localDocs = this.getLocalStorageDocuments();
      logger.info(`📄 발견된 로컬 문서: ${localDocs.length}개`);

      if (localDocs.length === 0) {
        logger.info('✅ 마이그레이션할 문서가 없습니다.');
        return { success: true, migrated: 0 };
      }

      // Batch insert for better performance
      await db.transaction('rw', db.documents, async () => {
        for (const doc of localDocs) {
          // Check if already exists by docId
          const existing = await db.documents.where('docId').equals(doc.id).first();
          if (!existing) {
            await db.documents.add({
              docId: doc.id, // Ensure docId is set
              title: doc.title || '제목 없음',
              content: doc.content || '',
              updatedAt: doc.updatedAt || new Date().toISOString(),
              isUserEditedTitle: doc.isUserEditedTitle || false,
              isAutoSyncedTitle: doc.isAutoSyncedTitle || false,
              synced: false // Default to unsynced for migrated docs
            });
          }
        }
      });

      logger.info(`✅ ${localDocs.length}개 문서 마이그레이션 완료`);

      // Mark migration as completed
      localStorage.setItem('miki_migration_completed', 'true');

      return { success: true, migrated: localDocs.length };

    } catch (error) {
      logger.error('❌ 마이그레이션 실패:', error);
      return { success: false, error: error.message };
    }
  }

  static getLocalStorageDocuments() {
    const documents = [];
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith('miki_document_')) {
        try {
          const docData = JSON.parse(localStorage.getItem(key));
          const id = key.replace('miki_document_', '');

          documents.push({
            id: id,
            title: docData.title || localStorage.getItem(`miki_title_${id}`) || '제목 없음',
            content: docData.content || '',
            updatedAt: docData.updatedAt || new Date().toISOString(),
            isUserEditedTitle: docData.isUserEditedTitle || false,
            isAutoSyncedTitle: docData.isAutoSyncedTitle || false
          });
        } catch (error) {
          logger.warn(`⚠️ 문서 파싱 실패: ${key}`, error);
        }
      }
    }

    return documents;
  }

  static async cleanupLocalStorage() {
    logger.info('🧹 localStorage 정리 시작');

    const keysToRemove = [];
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith('miki_document_') ||
        key.startsWith('miki_title_') ||
        key.startsWith('miki_search_cache_')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    logger.info(`🗑️ ${keysToRemove.length}개 항목 정리 완료`);
  }
}

// Sync queue management
export class SyncQueue {
  static async enqueue(documentId, operation, data = {}) {
    try {
      await db.syncQueue.add({
        documentId,
        operation, // 'create', 'update', 'delete'
        status: 'pending',
        retryAt: new Date().toISOString(),
        retryCount: 0,
        data: JSON.stringify(data),
        createdAt: new Date().toISOString()
      });

      logger.info(`📤 동기화 큐에 추가: ${operation} - ${documentId}`);
    } catch (error) {
      logger.error('❌ 동기화 큐 추가 실패:', error);
    }
  }

  static async getPendingItems() {
    return await db.syncQueue
      .where('status')
      .equals('pending')
      .and(item => new Date(item.retryAt) <= new Date())
      .toArray();
  }

  static async markAsCompleted(queueId) {
    await db.syncQueue.update(queueId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  }

  static async markAsFailed(queueId, error) {
    const item = await db.syncQueue.get(queueId);
    const retryCount = (item?.retryCount || 0) + 1;
    const maxRetries = 5;

    if (retryCount >= maxRetries) {
      await db.syncQueue.update(queueId, {
        status: 'failed',
        retryCount,
        lastError: error,
        failedAt: new Date().toISOString()
      });
    } else {
      // Exponential backoff: 2^retryCount minutes
      const retryDelay = Math.pow(2, retryCount) * 60 * 1000;
      const retryAt = new Date(Date.now() + retryDelay).toISOString();

      await db.syncQueue.update(queueId, {
        status: 'pending',
        retryCount,
        retryAt,
        lastError: error
      });
    }
  }

  static async cleanup() {
    // Remove completed items older than 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.syncQueue
      .where('status')
      .equals('completed')
      .and(item => item.completedAt < weekAgo)
      .delete();
  }
}

// Database utilities
export class DatabaseUtils {
  static async exportData() {
    try {
      const documents = await db.documents.toArray();
      const syncQueue = await db.syncQueue.toArray();

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        documents,
        syncQueue
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      logger.error('❌ 데이터 내보내기 실패:', error);
      throw error;
    }
  }

  static async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);

      if (data.version !== 1) {
        throw new Error('지원하지 않는 데이터 버전입니다.');
      }

      await db.transaction('rw', [db.documents, db.syncQueue], async () => {
        // Clear existing data
        await db.documents.clear();
        await db.syncQueue.clear();

        // Import documents
        if (data.documents?.length > 0) {
          await db.documents.bulkAdd(data.documents);
        }

        // Import sync queue
        if (data.syncQueue?.length > 0) {
          await db.syncQueue.bulkAdd(data.syncQueue);
        }
      });

      logger.info('✅ 데이터 가져오기 완료');
      return { success: true };

    } catch (error) {
      logger.error('❌ 데이터 가져오기 실패:', error);
      return { success: false, error: error.message };
    }
  }

  static async getStorageInfo() {
    try {
      const docCount = await db.documents.count();
      const queueCount = await db.syncQueue.count();

      // Estimate storage usage (rough calculation)
      const docs = await db.documents.toArray();
      const totalSize = docs.reduce((size, doc) => {
        return size + (doc.content?.length || 0) + (doc.title?.length || 0);
      }, 0);

      return {
        documentCount: docCount,
        queueCount: queueCount,
        estimatedSize: totalSize,
        formattedSize: this.formatBytes(totalSize)
      };
    } catch (error) {
      logger.error('❌ 저장소 정보 조회 실패:', error);
      return null;
    }
  }

  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Initialize database and handle migrations
export const initializeDatabase = async () => {
  try {
    // Open database
    await db.open();
    logger.info('✅ IndexedDB 연결 성공');

    // Check if migration is needed
    const migrationCompleted = localStorage.getItem('miki_migration_completed');

    if (!migrationCompleted) {
      const result = await DatabaseMigration.migrateFromLocalStorage();

      if (result.success && result.migrated > 0) {
        // Optional: Clean up localStorage after successful migration
        // await DatabaseMigration.cleanupLocalStorage();
        logger.info('📦 마이그레이션 완료, localStorage는 백업용으로 유지됩니다.');
      }
    }

    // Cleanup old sync queue items
    await SyncQueue.cleanup();

    return { success: true };

  } catch (error) {
    logger.error('❌ 데이터베이스 초기화 실패:', error);
    return { success: false, error: error.message };
  }
};

// 로컬 아티팩트 정리 유틸리티 (문서 삭제 후 로컬 흔적 제거)
export const cleanupLocalArtifactsForId = (id) => {
  try {
    if (!id) return;
    localStorage.removeItem(`miki_document_${id}`);
    localStorage.removeItem(`miki_title_${id}`);

    const recentJson = localStorage.getItem('miki_recent_docs');
    if (recentJson) {
      const recent = JSON.parse(recentJson);
      const filtered = Array.isArray(recent) ? recent.filter(d => d && d.id !== id) : [];
      localStorage.setItem('miki_recent_docs', JSON.stringify(filtered));
    }
  } catch { }
};