import { createLogger } from './logger';
import { db } from './database';
import { useDocumentStore } from '../stores/documentStore';

const logger = createLogger('DocumentResolver');

/**
 * 단일 진입점: 문서 식별자(id 또는 slug)로 최신 문서를 해석
 * 순서: Store → IndexedDB → Server
 */
export async function resolveByIdOrSlug(idOrSlug) {
  if (!idOrSlug || typeof idOrSlug !== 'string') return null;

  try {
    // 1) Store
    const store = useDocumentStore.getState();
    const fromStore = store.getDocumentById(idOrSlug);
    if (fromStore) {
      const hasContentField = Object.prototype.hasOwnProperty.call(fromStore, 'content');
      if (hasContentField) {
        logger.info(`📦 [RESOLVER] Store 히트(Full): ${idOrSlug}`);
        return fromStore;
      }
      logger.info(`📦 [RESOLVER] Store 히트(Partial) → 계속 탐색: ${idOrSlug}`);
    }

    // 2) IndexedDB
    try {
      const fromDb = await db.documents.get(idOrSlug);
      if (fromDb) {
        const hasContentField = Object.prototype.hasOwnProperty.call(fromDb, 'content');
        if (hasContentField) {
          logger.info(`💾 [RESOLVER] IndexedDB 히트(Full): ${idOrSlug}`);
          // Store에 채워 최신화
          store.setDocument(fromDb);
          return fromDb;
        }
        logger.info(`💾 [RESOLVER] IndexedDB 히트(Partial) → 계속 탐색: ${idOrSlug}`);
      }
    } catch (e) {
      logger.warn('IndexedDB 조회 실패:', e);
    }

    // 3) Server
    try {
      const resp = await fetch(`/api/posts/${idOrSlug}`);
      if (resp.ok) {
        const doc = await resp.json();
        if (!doc || typeof doc.content !== 'string') {
          logger.warn('🌐 [RESOLVER] Server 응답에 content가 없음, 무시하고 다음 단계로 진행');
        } else {
          logger.info(`🌐 [RESOLVER] Server 히트(Full): ${idOrSlug}`);
          await cacheLatest(doc);
          return doc;
        }
      }
    } catch (e) {
      logger.warn('Server 조회 실패:', e);
    }

    // 4) 서버 목록에서 슬러그/제목으로 검색 (느리지만 마지막 안전장치)
    try {
      const listResp = await fetch('/api/posts');
      if (listResp.ok) {
        const posts = await listResp.json();
        const matched = posts.find(p => p.id === idOrSlug);
        if (matched) {
          const docResp = await fetch(`/api/posts/${matched.id}`);
          if (docResp.ok) {
            const full = await docResp.json();
            await cacheLatest(full);
            return full;
          }
        }
      }
    } catch (e) {
      logger.warn('Server 목록 검색 실패:', e);
    }

    return null;
  } catch (error) {
    logger.error('문서 해석 실패:', error);
    return null;
  }
}

/**
 * 최신 문서를 Store와 IndexedDB에 캐시
 */
export async function cacheLatest(doc) {
  if (!doc || !doc.id) return;
  try {
    const store = useDocumentStore.getState();
    store.setDocument(doc);
    await db.documents.put({ ...doc, syncStatus: 'synced' });
    logger.info(`🧩 [RESOLVER] 최신 문서 캐시 완료: ${doc.id}`);
  } catch (e) {
    logger.warn('최신 문서 캐시 실패:', e);
  }
}


