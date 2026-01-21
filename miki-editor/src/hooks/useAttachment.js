import { useState, useEffect, useCallback } from 'react';
import matter from 'gray-matter';
import { AuthService } from '../services/auth';
import { GitHubService } from '../services/github';

/**
 * 파일명 정규화: abc123-screenshot.png
 */
const generateAttachmentId = () => Math.random().toString(36).substring(2, 10);

const slugifyFilename = (name) => {
    const ext = name.split('.').pop();
    const base = name.replace(/\.[^/.]+$/, '');
    const slugged = base.toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 30);
    return `${generateAttachmentId()}-${slugged}.${ext}`;
};

/**
 * useAttachment Hook
 * Front Matter를 통해 문서의 첨부 정보 관리 (이중 업로드 전략)
 * 
 * @param {string} content - 마크다운 콘텐츠
 * @param {function} onContentChange - 콘텐츠 변경 콜백
 * @param {string} docId - 현재 문서 ID
 * @returns {object} - { attachments, addAttachment, removeAttachment, updateAttachment, uploadImage }
 */
export function useAttachment(content, onContentChange, docId) {
    const [attachments, setAttachments] = useState([]);
    const [frontMatter, setFrontMatter] = useState({});
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);

    // Front Matter 파싱
    useEffect(() => {
        if (!content) {
            setAttachments([]);
            setFrontMatter({});
            return;
        }

        try {
            const parsed = matter(content);
            const attachmentData = parsed.data.attachments || [];

            setAttachments(attachmentData);
            setFrontMatter(parsed.data);
        } catch (error) {
            console.error('Front Matter 파싱 실패:', error);
            setAttachments([]);
            setFrontMatter({});
        }
    }, [content]);

    /**
     * Front Matter와 본문을 결합하여 마크다운 생성
     */
    const generateMarkdown = useCallback((newFrontMatter, markdownBody) => {
        return matter.stringify(markdownBody, newFrontMatter);
    }, []);

    /**
     * 이미지 업로드 (이중 전략: Repository + CDN)
     */
    const uploadImage = useCallback(async (file) => {
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('10MB 초과');
        }

        if (!docId) {
            throw new Error('문서 ID가 필요합니다');
        }

        setIsUploading(true);
        setError(null);

        try {
            const token = AuthService.getToken();
            const github = new GitHubService(token);
            await github.setUsername();

            const safeName = slugifyFilename(file.name);
            const repoPath = `miki-editor/attachments/${docId}/${safeName}`;

            // 이중 업로드: Repository + CDN 시도
            const urls = await github.uploadToAttachments(file, repoPath);

            // 첨부 인덱스 생성
            const attachment = {
                id: safeName.split('-')[0],
                name: file.name,
                repo_path: repoPath,
                cdn_url: urls.cdnUrl,
                issues_cdn_url: urls.issuesCdnUrl,
                display_url: urls.displayUrl,
                created_at: new Date().toISOString()
            };

            return attachment;

        } catch (e) {
            setError(e.message);
            throw e;
        } finally {
            setIsUploading(false);
        }
    }, [docId]);

    /**
     * 첨부 추가
     */
    const addAttachment = useCallback((newAttachment) => {
        const updatedAttachments = [...attachments, newAttachment];
        const updatedFrontMatter = {
            ...frontMatter,
            attachments: updatedAttachments
        };

        // 기존 본문 추출
        const parsed = matter(content || '');
        const newContent = generateMarkdown(updatedFrontMatter, parsed.content);

        setAttachments(updatedAttachments);
        setFrontMatter(updatedFrontMatter);

        if (onContentChange) {
            onContentChange(newContent);
        }

        return newContent;
    }, [attachments, frontMatter, content, generateMarkdown, onContentChange]);

    /**
     * 첨부 삭제
     */
    const removeAttachment = useCallback((index) => {
        const updatedAttachments = attachments.filter((_, i) => i !== index);
        const updatedFrontMatter = {
            ...frontMatter,
            attachments: updatedAttachments.length > 0 ? updatedAttachments : undefined
        };

        // 기존 본문 추출
        const parsed = matter(content || '');
        const newContent = generateMarkdown(updatedFrontMatter, parsed.content);

        setAttachments(updatedAttachments);
        setFrontMatter(updatedFrontMatter);

        if (onContentChange) {
            onContentChange(newContent);
        }

        return newContent;
    }, [attachments, frontMatter, content, generateMarkdown, onContentChange]);

    /**
     * 첨부 수정
     */
    const updateAttachment = useCallback((index, updatedData) => {
        const updatedAttachments = attachments.map((att, i) =>
            i === index ? { ...att, ...updatedData } : att
        );
        const updatedFrontMatter = {
            ...frontMatter,
            attachments: updatedAttachments
        };

        // 기존 본문 추출
        const parsed = matter(content || '');
        const newContent = generateMarkdown(updatedFrontMatter, parsed.content);

        setAttachments(updatedAttachments);
        setFrontMatter(updatedFrontMatter);

        if (onContentChange) {
            onContentChange(newContent);
        }

        return newContent;
    }, [attachments, frontMatter, content, generateMarkdown, onContentChange]);

    return {
        attachments,
        addAttachment,
        removeAttachment,
        updateAttachment,
        uploadImage,
        isUploading,
        error,
        frontMatter
    };
}
