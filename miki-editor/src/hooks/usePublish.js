import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '../services/auth';
import { PublishService } from '../services/publish';
import { db } from '../utils/database';

export function usePublish() {
    const queryClient = useQueryClient();

    const publishMutation = useMutation({
        mutationFn: async (document) => {
            const token = AuthService.getToken();
            if (!token) throw new Error('로그인이 필요합니다.');
            const publishService = new PublishService(token);
            return await publishService.publishDocument(document);
        },
        onSuccess: async (result, document) => {
            // 문서 상태 업데이트 (published)
            queryClient.setQueryData(['documents'], (oldData) => {
                if (!Array.isArray(oldData)) return oldData;
                return oldData.map(doc =>
                    doc.id === document.id
                        ? { ...doc, isPublished: true, publishedAt: result.finalDocument?.publishedAt || new Date().toISOString() }
                        : doc
                );
            });

            // 🟢 [Fix] 로컬 DB(IndexedDB) 상태 동기화
            try {
                await db.documents.where('docId').equals(document.id).modify(doc => {
                    doc.frontMatter = {
                        ...(doc.frontMatter || {}),
                        published: true,
                        publishedAt: result.finalDocument?.publishedAt || new Date().toISOString()
                    };
                    doc.updatedAt = new Date().toISOString();
                });
                console.log(`✅ [DB] 로컬 문서 배포 상태 업데이트 완료: ${document.id}`);
            } catch (e) {
                console.error('❌ [DB] 로컬 문서 상태 업데이트 실패:', e);
            }
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
