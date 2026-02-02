import { useState, useCallback, useEffect } from 'react';
import matter from 'gray-matter';
import { GitHubService } from '../services/github';
import { AuthService } from '../services/auth';
import { AiService } from '../services/ai';

/**
 * 첨부 파일 관리 훅
 * @param {string} content - 현재 에디터 콘텐츠 (마크다운 문자열)
 * @param {function} onContentChange - 콘텐츠 변경 시 호출되는 상위 콜백
 * @param {string} docId - 현재 문서 ID (파일 경로 결정에 사용)
 * @returns {{
 *   attachments: Array,
 *   processAttachment: (file: File, tier: string) => Promise<void>,
 *   removeAttachment: (id: string) => void,
 *   isUploading: boolean,
 *   error: string|null
 * }}
 */
export function useAttachment(content, onContentChange, docId) {
    const [attachments, setAttachments] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);

    // Front Matter에서 attachments 파싱
    useEffect(() => {
        if (!content) {
            setAttachments([]);
            return;
        }

        try {
            const parsed = matter(content);
            const fm = parsed.data || {};
            setAttachments(fm.attachments || []);
        } catch (err) {
            console.error('Failed to parse front matter:', err);
            setAttachments([]);
        }
    }, [content]);

    /**
     * Front Matter 업데이트 헬퍼
     */
    const updateContentInStorage = useCallback((newAttachments) => {
        if (!content || !onContentChange) return;

        try {
            const parsed = matter(content);
            const updatedFrontMatter = {
                ...parsed.data,
                attachments: newAttachments
            };

            const newContent = matter.stringify(parsed.content, updatedFrontMatter);
            onContentChange(newContent);
        } catch (err) {
            console.error('Failed to update front matter:', err);
        }
    }, [content, onContentChange]);

    /**
     * 핵심 함수: 파일 업로드 + AI 분석 병렬 실행
     */
    const processAttachment = useCallback(async (file, tier = 'BASE') => {
        // [Critical Check] docId가 없으면 업로드 경로를 생성할 수 없음
        if (!docId) {
            console.error('Document ID missing');
            alert('문서가 완전히 로드된 후 다시 시도해주세요.');
            return;
        }

        const tempId = crypto.randomUUID();
        const pendingItem = {
            id: tempId,
            name: file.name,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        // 1. 즉시 UI에 pending 상태로 추가
        const initialAttachments = [...attachments, pendingItem];
        setAttachments(initialAttachments);
        updateContentInStorage(initialAttachments);

        try {
            setIsUploading(true);
            setError(null);

            const token = AuthService.getToken();
            if (!token) throw new Error('인증 토큰이 없습니다. 로그인해주세요.');

            const github = new GitHubService(token);
            await github.setUsername();

            // 파일명 충돌 방지를 위한 타임스탬프 추가
            const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const repoPath = `miki-editor/attachments/${docId}/${safeName}`;

            // 2. 병렬 실행: 업로드 & AI 분석
            // [Robustness] AI가 실패해도 파일은 남아야 함
            let uploadResult, aiMetadata;

            try {
                [uploadResult, aiMetadata] = await Promise.all([
                    github.uploadToAttachments(file, repoPath),
                    AiService.analyzeAttachment(file, tier).catch(err => {
                        console.warn('AI Analysis failed, falling back to basic metadata:', err);
                        return {
                            type: 'file',
                            title: file.name,
                            description: 'AI 분석 실패',
                            model: 'none'
                        };
                    })
                ]);
            } catch (uploadError) {
                // 업로드 자체가 실패하면 전체 실패 처리
                throw uploadError;
            }

            // 3. 상태 업데이트: pending -> ready
            const readyItem = {
                id: tempId,
                name: file.name,
                status: 'ready',
                type: aiMetadata.type,
                title: aiMetadata.title,
                description: aiMetadata.description,
                model: aiMetadata.model,
                repo_path: repoPath,
                cdn_url: uploadResult.cdnUrl,
                display_url: aiMetadata.type === 'image' ? uploadResult.displayUrl : undefined,
                created_at: new Date().toISOString()
            };

            // 4. Front Matter에 저장
            const updatedAttachments = initialAttachments.map(a =>
                a.id === tempId ? readyItem : a
            );
            setAttachments(updatedAttachments);
            updateContentInStorage(updatedAttachments);

            return readyItem;

        } catch (err) {
            console.error('Attachment processing error:', err);
            setError(err.message);

            // 5. 상태 업데이트: pending -> error
            const failedAttachments = initialAttachments.map(a =>
                a.id === tempId ? { ...a, status: 'error', error: err.message } : a
            );
            setAttachments(failedAttachments);
            updateContentInStorage(failedAttachments);

            throw err;
        } finally {
            setIsUploading(false);
        }
    }, [docId, attachments, updateContentInStorage]);

    /**
     * 첨부 파일 삭제
     */
    const removeAttachment = useCallback((id) => {
        const updatedAttachments = attachments.filter(a => a.id !== id);
        setAttachments(updatedAttachments);
        updateContentInStorage(updatedAttachments);
    }, [attachments, updateContentInStorage]);

    return {
        attachments,
        processAttachment,
        removeAttachment,
        isUploading,
        error
    };
}
