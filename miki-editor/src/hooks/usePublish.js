import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '../services/auth';
import { PublishService } from '../services/publish';

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
            // 문서 상태 업데이트 (published)
            queryClient.setQueryData(['documents'], (oldData) => {
                if (!Array.isArray(oldData)) return oldData;
                return oldData.map(doc =>
                    doc.id === document.id
                        ? { ...doc, isPublished: true, publishedAt: new Date().toISOString() }
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
            queryClient.setQueryData(['documents'], (oldData) => {
                if (!Array.isArray(oldData)) return oldData;
                return oldData.map(doc =>
                    doc.id === document.id
                        ? { ...doc, isPublished: false, publishedAt: null }
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
