import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { cleanupLocalArtifactsForId } from '../utils/database';
import { storage } from '../utils/storage-client'; // storage-client 임포트

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents.lists(),
    queryFn: () => storage.getPostList(),
    // GitHub-first: 탭 포커스 복귀 시 재동기화 (다른 기기에서 저장한 내용 반영)
    refetchOnWindowFocus: true,
    // 5분 캐시 — 같은 탭 내 잦은 재조회 방지, 단 5분 후엔 GitHub 재조회
    staleTime: 5 * 60 * 1000,
    // 비WS 모드 fallback: 2분 폴링 (WS 모드에선 push로 갱신하므로 불필요)
    refetchInterval: import.meta.env.VITE_USE_WS_PROXY === 'true' ? false : 2 * 60 * 1000,
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
          id: document.id, // 🔥 이 줄이 누락되어 있었음!
          content: document.content ?? '',
          title: document.title ?? '',
          titleMode: document.titleMode || 'auto',
          sha: document.sha, // 기존 파일이면 SHA도 전달
          frontMatter: document.frontMatter // ✅ Pass preserved frontMatter
        });
      } else {
        saved = await storage.updatePost(document.id, {
          content: document.content ?? '',
          title: document.title ?? '',
          titleMode: document.titleMode || 'auto',
          frontMatter: document.frontMatter // ✅ Pass preserved frontMatter
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
            // ✅ FIX: saved에서 받은 시간 그대로 사용
            updatedAt: saved.updatedAt || new Date().toISOString(),
            createdAt: saved.createdAt || new Date().toISOString(),
            size: (saved.content || '').length,
          };
          return [entry, ...filtered];
        });
      } catch { }
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
      try { cleanupLocalArtifactsForId(id); } catch { }
      try {
        qc.setQueryData(queryKeys.documents.lists(), (old) => {
          const prev = Array.isArray(old) ? old : [];
          return prev.filter((d) => d && d.id !== id);
        });
      } catch { }
      // 위키 포스트 삭제는 별도 API 호출 유지
      try { fetch(`/api/wiki/doc/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => { }); } catch { }
    },
  });
}