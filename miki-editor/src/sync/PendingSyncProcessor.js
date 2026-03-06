import { createLogger } from '../utils/logger';
import { PendingSync, db } from '../utils/database';
import { storage } from '../utils/storage-client';

const logger = createLogger('PendingSyncProcessor');

// Lightweight djb2 hash for change detection
function hashDoc(doc) {
  const str = `${doc.title || ''}::${doc.content || ''}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16);
}

// Max documents processed per flush cycle (rate-limit GitHub API)
const MAX_BATCH_SIZE = 5;
// Polling interval (ms)
const POLL_INTERVAL = 30_000;

/**
 * PendingSyncProcessor
 *
 * Polls the `pendingSync` IndexedDB table and batch-syncs pending changes
 * to GitHub using exponential backoff (via PendingSync.markFailed).
 *
 * Hash-based deduplication: if the local synced content matches the pending
 * payload, the item is marked done without a GitHub round-trip.
 *
 * Singleton — always use getPendingSyncProcessor().
 */
class PendingSyncProcessor {
  constructor() {
    this._pollTimer = null;
    this._flushing = false;
    this._online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this._handleOnline = this._handleOnline.bind(this);
    this._handleOffline = this._handleOffline.bind(this);
  }

  /** Start periodic polling + network listeners. */
  start() {
    if (this._pollTimer) return; // already started

    window.addEventListener('online', this._handleOnline);
    window.addEventListener('offline', this._handleOffline);

    // Delay initial flush slightly to avoid racing app boot
    setTimeout(() => {
      if (this._online) this.flush();
    }, 3000);

    this._pollTimer = setInterval(() => {
      if (this._online) this.flush();
    }, POLL_INTERVAL);

    logger.info('[PendingSyncProcessor] 시작됨 (30초 폴링)');
  }

  /** Stop polling and remove listeners. */
  stop() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    window.removeEventListener('online', this._handleOnline);
    window.removeEventListener('offline', this._handleOffline);
    logger.info('[PendingSyncProcessor] 중지됨');
  }

  /**
   * Enqueue an offline change for later sync.
   * Called by storage-client on GitHub save failure.
   */
  async enqueue(documentId, changeType, payload = {}) {
    await PendingSync.enqueue(documentId, changeType, payload);
  }

  _handleOnline() {
    this._online = true;
    logger.info('[PendingSyncProcessor] 온라인 복구 - 즉시 flush');
    this.flush();
  }

  _handleOffline() {
    this._online = false;
    logger.info('[PendingSyncProcessor] 오프라인 감지');
  }

  /**
   * Process all pending items in one batch cycle.
   * Groups by documentId; only the latest update per document is synced.
   * Older superseded items are marked done without a network call.
   */
  async flush() {
    if (this._flushing) return;
    this._flushing = true;

    try {
      const pending = await PendingSync.getPending();
      if (pending.length === 0) {
        logger.info('[PendingSyncProcessor] 처리할 항목 없음');
        return;
      }

      logger.info(`[PendingSyncProcessor] ${pending.length}개 항목 처리 시작`);

      const grouped = this._groupByDocument(pending);
      let processed = 0;

      for (const [documentId, items] of grouped.entries()) {
        if (processed >= MAX_BATCH_SIZE) break;
        await this._processDocumentBatch(documentId, items);
        processed++;
        // Minimal rate-limiting between documents
        await new Promise(r => setTimeout(r, 150));
      }

      await PendingSync.cleanup();
    } catch (err) {
      logger.error('[PendingSyncProcessor] flush 실패:', err);
    } finally {
      this._flushing = false;
    }
  }

  /**
   * Group pending items by documentId.
   * @returns {Map<string, object[]>} oldest-first per document
   */
  _groupByDocument(items) {
    const map = new Map();
    for (const item of items) {
      const list = map.get(item.documentId) || [];
      list.push(item);
      map.set(item.documentId, list);
    }
    return map;
  }

  /**
   * Process all pending items for one document.
   * delete > update/create priority. Superseded items are skipped.
   */
  async _processDocumentBatch(documentId, items) {
    // Sort oldest first
    items.sort((a, b) => (a.queuedAt < b.queuedAt ? -1 : 1));

    // delete takes priority over any pending updates
    const deleteItem = [...items].reverse().find(i => i.changeType === 'delete');
    if (deleteItem) {
      for (const item of items) {
        if (item.id !== deleteItem.id) {
          await PendingSync.markDone(item.id);
        }
      }
      await this._syncDelete(deleteItem);
      return;
    }

    // Process only the latest update/create; mark older ones as superseded
    const updateItem = items[items.length - 1];
    for (const item of items.slice(0, -1)) {
      logger.info(`[PendingSyncProcessor] 구버전 항목 스킵 (superseded): id=${item.id}`);
      await PendingSync.markDone(item.id);
    }

    // Hash-based dedup: skip if content unchanged from last synced version
    if (await this._isContentUnchanged(documentId, updateItem)) {
      logger.info(`[PendingSyncProcessor] 내용 동일 - 스킵: ${documentId}`);
      await PendingSync.markDone(updateItem.id);
      return;
    }

    await this._syncUpdate(updateItem);
  }

  /**
   * Returns true if the pending payload's content hash matches the
   * currently-synced local document — meaning no actual change to push.
   */
  async _isContentUnchanged(documentId, item) {
    try {
      const payload = JSON.parse(item.payload || '{}');
      const pendingHash = hashDoc(payload);

      const localDoc = await db.documents.where('docId').equals(documentId).first();
      if (!localDoc || !localDoc.synced) return false;

      const syncedHash = hashDoc({ title: localDoc.title, content: localDoc.content });
      return pendingHash === syncedHash;
    } catch {
      return false;
    }
  }

  async _syncUpdate(item) {
    try {
      const payload = JSON.parse(item.payload || '{}');
      if (!payload.id) {
        logger.warn(`[PendingSyncProcessor] payload.id 없음 - 항목 스킵: pendingSync.id=${item.id}`);
        await PendingSync.markDone(item.id);
        return;
      }

      logger.info(`[PendingSyncProcessor] GitHub 동기화: ${payload.id}`);
      await storage._savePostToGitHub(payload);
      await PendingSync.markDone(item.id);
      logger.info(`[PendingSyncProcessor] 완료: ${payload.id}`);
    } catch (err) {
      logger.error(`[PendingSyncProcessor] 동기화 실패: ${item.documentId}`, err);
      await PendingSync.markFailed(item.id, err.message);
    }
  }

  async _syncDelete(item) {
    try {
      logger.info(`[PendingSyncProcessor] 삭제 동기화: ${item.documentId}`);
      await storage.deletePost(item.documentId);
      await PendingSync.markDone(item.id);
      logger.info(`[PendingSyncProcessor] 삭제 완료: ${item.documentId}`);
    } catch (err) {
      logger.error(`[PendingSyncProcessor] 삭제 실패: ${item.documentId}`, err);
      await PendingSync.markFailed(item.id, err.message);
    }
  }
}

// Singleton
let _instance = null;

export const getPendingSyncProcessor = () => {
  if (!_instance) {
    _instance = new PendingSyncProcessor();
  }
  return _instance;
};

/** Reset singleton (test use only). */
export const resetPendingSyncProcessor = () => {
  if (_instance) {
    _instance.stop();
    _instance = null;
  }
};
