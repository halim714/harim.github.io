import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { cleanupLocalArtifactsForId } from '../utils/database';
import { storage } from '../utils/storage-client'; // storage-client 임포트

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents.lists(),
    queryFn: () => storage.getPostList(), // storage.getPostList() 사용
  });
}

export function useSaveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (document) => {
      if (!document || !document.id) throw new Error('문서 ID가 필요합니다.');
      
      const isNew = document.isEmpty || !document.sha;
      let saved;

      if (isNew) {
        saved = await storage.savePost({
          content: document.content ?? '',
          title: document.title ?? '',
          titleMode: document.titleMode || 'auto',
        });
      } else {
        saved = await storage.updatePost(document.id, {
          content: document.content ?? '',
          title: document.title ?? '',
          titleMode: document.titleMode || 'auto',
        });
      }
      
      // [분석 결과 반영] 서버 응답과 원래 document 객체를 합쳐서 반환
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
      await storage.deletePost(id);
      // [분석 결과 반영] onSuccess 콜백을 위해 id를 반환
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
      // 위키 포스트 삭제는 별도 API 호출 유지
      try { fetch(`/api/wiki/doc/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {}); } catch {}
    },
  });
}