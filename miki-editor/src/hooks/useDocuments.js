import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { cleanupLocalArtifactsForId } from '../utils/database';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`HTTP ${res.status} ${res.statusText} ${text}`), { status: res.status });
  }
  return res.json();
}

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents.lists(),
    queryFn: async () => fetchJson('/api/posts'),
  });
}

export function useSaveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (document) => {
      if (!document || !document.id) throw new Error('문서 ID가 필요합니다.');
      const body = {
        content: document.content ?? '',
        title: document.title ?? '',
        titleMode: document.titleMode || 'auto',
      };
      const saved = await fetchJson(`/api/posts/${encodeURIComponent(document.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { ...document, ...saved };
    },
    onSuccess: (saved) => {
      try {
        qc.setQueryData(queryKeys.documents.lists(), (old) => {
          const prev = Array.isArray(old) ? old : [];
          const filtered = prev.filter((d) => d && d.id !== saved.id);
          const preview = (saved.content || '').substring(0, 150);
          const entry = {
            id: saved.id,
            title: saved.title,
            titleMode: saved.titleMode || 'auto',
            preview,
            updatedAt: new Date().toISOString(),
            createdAt: saved.createdAt || new Date().toISOString(),
            size: (saved.content || '').length,
          };
          return [entry, ...filtered];
        });
      } catch {}
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      if (!id) throw new Error('삭제할 문서 ID가 필요합니다.');
      await fetchJson(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: async (id) => {
      try { cleanupLocalArtifactsForId(id); } catch {}
      try {
        qc.setQueryData(queryKeys.documents.lists(), (old) => {
          const prev = Array.isArray(old) ? old : [];
          return prev.filter((d) => d && d.id !== id);
        });
      } catch {}
      try { fetch(`/api/wiki/doc/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {}); } catch {}
    },
  });
}


