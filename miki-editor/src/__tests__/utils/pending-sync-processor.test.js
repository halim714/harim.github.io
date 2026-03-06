import {
  getPendingSyncProcessor,
  resetPendingSyncProcessor,
} from '../../sync/PendingSyncProcessor';
import { PendingSync, db } from '../../utils/database';
import { storage } from '../../utils/storage-client';

// ---- Mocks ----

jest.mock('../../utils/database', () => ({
  PendingSync: {
    getPending: jest.fn(),
    markDone: jest.fn(),
    markFailed: jest.fn(),
    enqueue: jest.fn(),
    cleanup: jest.fn(),
  },
  db: {
    documents: {
      where: jest.fn(),
    },
  },
}));

jest.mock('../../utils/storage-client', () => ({
  storage: {
    _savePostToGitHub: jest.fn(),
    deletePost: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Helper: return a db.documents chain that resolves to `doc`
const mockLocalDoc = (doc) => {
  db.documents.where.mockReturnValue({
    equals: jest.fn().mockReturnValue({ first: jest.fn().mockResolvedValue(doc) }),
  });
};

// Helper: build a minimal pendingSync item
const makeItem = (overrides = {}) => ({
  id: Math.random(),
  documentId: 'doc-1',
  changeType: 'update',
  payload: JSON.stringify({ id: 'doc-1', title: 'T', content: 'C' }),
  queuedAt: new Date().toISOString(),
  retryCount: 0,
  ...overrides,
});

// ---- Tests ----

describe('PendingSyncProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPendingSyncProcessor();
    PendingSync.cleanup.mockResolvedValue();
    PendingSync.markDone.mockResolvedValue();
    PendingSync.markFailed.mockResolvedValue();
  });

  it('does nothing when no pending items', async () => {
    PendingSync.getPending.mockResolvedValue([]);
    const processor = getPendingSyncProcessor();
    await processor.flush();
    expect(storage._savePostToGitHub).not.toHaveBeenCalled();
  });

  it('syncs a pending update item to GitHub', async () => {
    const doc = { id: 'doc-1', title: 'Hello', content: 'World' };
    PendingSync.getPending.mockResolvedValue([
      makeItem({ payload: JSON.stringify(doc) }),
    ]);
    mockLocalDoc(null); // no synced local doc → must sync
    storage._savePostToGitHub.mockResolvedValue({ ...doc, sha: 'abc123' });

    const processor = getPendingSyncProcessor();
    await processor.flush();

    expect(storage._savePostToGitHub).toHaveBeenCalledWith(doc);
    expect(PendingSync.markDone).toHaveBeenCalled();
  });

  it('marks item failed (with backoff) on GitHub error', async () => {
    const doc = { id: 'doc-1', title: 'T', content: 'C' };
    const item = makeItem({ id: 42, payload: JSON.stringify(doc) });
    PendingSync.getPending.mockResolvedValue([item]);
    mockLocalDoc(null);
    storage._savePostToGitHub.mockRejectedValue(new Error('Network error'));

    const processor = getPendingSyncProcessor();
    await processor.flush();

    expect(PendingSync.markFailed).toHaveBeenCalledWith(item.id, 'Network error');
    expect(PendingSync.markDone).not.toHaveBeenCalled();
  });

  it('skips unchanged content (hash deduplication)', async () => {
    const doc = { id: 'doc-1', title: 'Same', content: 'NoChange' };
    const item = makeItem({ id: 7, payload: JSON.stringify(doc) });
    PendingSync.getPending.mockResolvedValue([item]);
    // Local doc is already synced with identical content
    mockLocalDoc({ synced: true, title: 'Same', content: 'NoChange' });

    const processor = getPendingSyncProcessor();
    await processor.flush();

    expect(storage._savePostToGitHub).not.toHaveBeenCalled();
    expect(PendingSync.markDone).toHaveBeenCalledWith(item.id);
  });

  it('syncs when local doc not yet synced (even if content matches)', async () => {
    const doc = { id: 'doc-1', title: 'T', content: 'C' };
    const item = makeItem({ payload: JSON.stringify(doc) });
    PendingSync.getPending.mockResolvedValue([item]);
    // synced: false → must push regardless of content
    mockLocalDoc({ synced: false, title: 'T', content: 'C' });
    storage._savePostToGitHub.mockResolvedValue({ ...doc, sha: 'sha' });

    const processor = getPendingSyncProcessor();
    await processor.flush();

    expect(storage._savePostToGitHub).toHaveBeenCalledWith(doc);
  });

  it('processes only the latest update; marks older ones done (superseded)', async () => {
    const old = makeItem({ id: 10, documentId: 'doc-2', payload: JSON.stringify({ id: 'doc-2', title: 'v1', content: 'old' }), queuedAt: '2026-01-01T00:00:00Z' });
    const latest = makeItem({ id: 11, documentId: 'doc-2', payload: JSON.stringify({ id: 'doc-2', title: 'v2', content: 'new' }), queuedAt: '2026-01-01T00:01:00Z' });
    PendingSync.getPending.mockResolvedValue([old, latest]);
    mockLocalDoc(null);
    storage._savePostToGitHub.mockResolvedValue({ id: 'doc-2', sha: 'xyz' });

    const processor = getPendingSyncProcessor();
    await processor.flush();

    // Older item superseded
    expect(PendingSync.markDone).toHaveBeenCalledWith(old.id);
    // Latest item synced
    expect(storage._savePostToGitHub).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'new' })
    );
    expect(PendingSync.markDone).toHaveBeenCalledWith(latest.id);
  });

  it('delete wins over pending updates for same document', async () => {
    const update = makeItem({ id: 20, documentId: 'doc-3', changeType: 'update', queuedAt: '2026-01-01T00:00:00Z' });
    const del = makeItem({ id: 21, documentId: 'doc-3', changeType: 'delete', queuedAt: '2026-01-01T00:01:00Z' });
    PendingSync.getPending.mockResolvedValue([update, del]);
    storage.deletePost.mockResolvedValue({ id: 'doc-3' });

    const processor = getPendingSyncProcessor();
    await processor.flush();

    expect(storage.deletePost).toHaveBeenCalledWith('doc-3');
    expect(storage._savePostToGitHub).not.toHaveBeenCalled();
    // update item marked done (superseded)
    expect(PendingSync.markDone).toHaveBeenCalledWith(update.id);
    // delete item marked done (synced)
    expect(PendingSync.markDone).toHaveBeenCalledWith(del.id);
  });

  it('marks delete failed on error', async () => {
    const del = makeItem({ id: 30, changeType: 'delete' });
    PendingSync.getPending.mockResolvedValue([del]);
    storage.deletePost.mockRejectedValue(new Error('Not found'));

    const processor = getPendingSyncProcessor();
    await processor.flush();

    expect(PendingSync.markFailed).toHaveBeenCalledWith(del.id, 'Not found');
  });

  it('skips items with missing payload id', async () => {
    const item = makeItem({ id: 40, payload: JSON.stringify({ title: 'No ID' }) });
    PendingSync.getPending.mockResolvedValue([item]);
    mockLocalDoc(null);

    const processor = getPendingSyncProcessor();
    await processor.flush();

    expect(storage._savePostToGitHub).not.toHaveBeenCalled();
    expect(PendingSync.markDone).toHaveBeenCalledWith(item.id);
  });
});
