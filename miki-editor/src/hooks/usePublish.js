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
            // result에서 정확한 publishedAt 가져오기
            const publishedAt = result.finalDocument?.publishedAt || new Date().toISOString();

            // 1. React Query 캐시 업데이트
            queryClient.setQueryData(['documents'], (oldData) => {
                if (!Array.isArray(oldData)) return oldData;
                return oldData.map(doc =>
                    doc.id === document.id
                        ? {
                            ...doc,
                            isPublished: true,
                            status: 'published',  // 명시적으로 추가
                            publishedAt: publishedAt
                        }
                        : doc
                );
            });

            // 2. IndexedDB 업데이트 (백그라운드)
            // 실패해도 UI는 정상 작동하도록 catch 처리
            db.documents.where('docId').equals(document.id).first()
                .then(localDoc => {
                    if (localDoc) {
                        // 기존 frontMatter 보존하면서 업데이트
                        const updatedFrontMatter = {
                            ...(localDoc.frontMatter || {}),
                            published: true,
                            status: 'published',  // 명시적으로 추가
                            publishedAt: localDoc.frontMatter?.publishedAt || publishedAt  // 재배포 시 보존
                        };

                        return db.documents.update(localDoc.id, {
                            frontMatter: updatedFrontMatter,
                            synced: true  // 배포되었으므로 동기화됨
                        });
                    }
                })
                .then(() => {
                    console.log('✅ [DB] 배포 상태 업데이트 완료');
                })
                .catch(e => {
                    console.error('❌ [DB] 배포 상태 업데이트 실패 (무시):', e);
                    // 에러 무시 - 캐시는 이미 업데이트됨
                });
        }
    });

    // unpublishMutation도 동일하게 처리 필요
    const unpublishMutation = useMutation({
        mutationFn: async (document) => {
            const token = AuthService.getToken();
            if (!token) throw new Error('로그인이 필요합니다.');
            const publishService = new PublishService(token);
            return await publishService.unpublishDocument(document);
        },
        onSuccess: async (result, document) => {
            // 캐시 업데이트
            queryClient.setQueryData(['documents'], (oldData) => {
                if (!Array.isArray(oldData)) return oldData;
                return oldData.map(doc =>
                    doc.id === document.id
                        ? {
                            ...doc,
                            isPublished: false,
                            status: 'draft'
                        }
                        : doc
                );
            });

            // IndexedDB 업데이트 (백그라운드)
            db.documents.where('docId').equals(document.id).first()
                .then(localDoc => {
                    if (localDoc) {
                        const updatedFrontMatter = {
                            ...(localDoc.frontMatter || {}),
                            published: false,
                            status: 'draft'
                            // publishedAt은 유지 (이력 보존)
                        };

                        return db.documents.update(localDoc.id, {
                            frontMatter: updatedFrontMatter,
                            synced: true
                        });
                    }
                })
                .then(() => console.log('✅ [DB] 게시 취소 상태 업데이트 완료'))
                .catch(e => console.error('❌ [DB] 게시 취소 상태 업데이트 실패:', e));
        }
    });

    return {
        publish: publishMutation.mutateAsync,
        unpublish: unpublishMutation.mutateAsync,
        isPublishing: publishMutation.isPending,
        isUnpublishing: unpublishMutation.isPending
    };
}
