import { useState, useEffect, useCallback } from 'react';
import matter from 'gray-matter';

/**
 * useAttachment Hook
 * Front Matter를 통해 문서의 첨부 정보 관리
 * 
 * @param {string} content - 마크다운 콘텐츠
 * @param {function} onContentChange - 콘텐츠 변경 콜백
 * @returns {object} - { attachments, addAttachment, removeAttachment, updateAttachment }
 */
export function useAttachment(content, onContentChange) {
    const [attachments, setAttachments] = useState([]);
    const [frontMatter, setFrontMatter] = useState({});

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
        frontMatter
    };
}
