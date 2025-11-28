import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '../services/auth';
import { PublishService } from '../services/publish';
import { dbHelpers } from '../utils/database'; // 🟢 추가

export function usePublish() {
    const queryClient = useQueryClient();

    const publishMutation = useMutation({
        mutationFn: async (document) => {
            const token = AuthService.getToken();
            if (!token) throw new Error('로그인이 필요합니다.');
            const publishService = new PublishService(token);
            return await publishService.publishDocument(document);
        },
        onSuccess: (result, document) => {
            // result에서 publishedAt 가져오기
            const publishedAt = result.publishedAt || result.finalDocument?.publishedAt || new Date().toISOString();

            // 🟢 백그라운드에서 로컬 DB 업데이트 (UI 블로킹 방지)
            dbHelpers.markPublished(document.id, publishedAt).catch(e => {
                console.error('[PUBLISH] 로컬 DB 업데이트 실패 (무시):', e);
                // 실패해도 캐시는 업데이트되므로 UI는 정상 작동
            });

            // 문서 상태 업데이트 (published)
            queryClient.setQueryData(['documents'], (oldData) => {
                if (!Array.isArray(oldData)) return oldData;
                return oldData.map(doc =>
                    doc.id === document.id
                        ? { ...doc, isPublished: true, status: 'published', publishedAt }
                        : doc
                );
            });
        }
    });

    const unpublishMutation = useMutation({
        mutationFn: async (document) => {
            const token = AuthService.getToken();
            if (!token) throw new Error('로그인이 필요합니다.');
            const publishService = new PublishService(token);
            return await publishService.unpublishDocument(document);
        },
        onSuccess: (result, document) => {
            // 🟢 백그라운드에서 로컬 DB 업데이트
            dbHelpers.markUnpublished(document.id).catch(e => {
                console.error('[UNPUBLISH] 로컬 DB 업데이트 실패 (무시):', e);
            });

            queryClient.setQueryData(['documents'], (oldData) => {
                if (!Array.isArray(oldData)) return oldData;
                return oldData.map(doc =>
                    doc.id === document.id
                        ? { ...doc, isPublished: false, publishedAt: null, status: 'draft' }
                        : doc
                );
            });
        }
    });

    return {
        publish: publishMutation.mutateAsync,
        unpublish: unpublishMutation.mutateAsync,
        isPublishing: publishMutation.isPending,
        isUnpublishing: unpublishMutation.isPending
    };
}
