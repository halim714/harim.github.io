import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import { useWikiStore } from '../../stores/wikiStore';
import { diffMarkdown } from '../markdownDiffer';

/**
 * WikiPage — 엔티티 위키 페이지 슬라이드-인 패널
 * Props:
 *   entityName  string   표시할 엔티티 이름
 *   onClose     () => void
 *   onSave      (added, removed) => void   트리플 변경 콜백 (선택)
 */
export function WikiPage({ entityName, onClose, onSave }) {
    const getEntityPage = useWikiStore(s => s.getEntityPage);
    const appendTriples = useWikiStore(s => s.appendTriples);

    const [originalMarkdown, setOriginalMarkdown] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const editorRef = useRef(null);

    useEffect(() => {
        const md = getEntityPage(entityName);
        setOriginalMarkdown(md);
        setIsDirty(false);
    }, [entityName, getEntityPage]);

    const handleChange = useCallback(() => {
        setIsDirty(true);
    }, []);

    const handleSave = useCallback(() => {
        const edited = editorRef.current?.getInstance().getMarkdown() || '';
        const { added, removed } = diffMarkdown(originalMarkdown, edited, entityName);

        if (added.length > 0) {
            const now = new Date().toISOString();
            const newTriples = added.map(t => ({
                ...t,
                id: `${slugify(t.subject)}:${slugify(t.predicate)}:${slugify(t.object)}`,
                entity_type: 'stance',
                evidence_tier: t.evidence_tier || 'Grounded',
                source_memo_id: 'wiki-edit',
                created_at: now,
            }));
            appendTriples(newTriples);
        }

        onSave?.(added, removed);
        setOriginalMarkdown(edited);
        setIsDirty(false);
    }, [originalMarkdown, entityName, appendTriples, onSave]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div
                className="relative h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h2 className="text-base font-semibold text-gray-900 truncate">{entityName}</h2>
                    <div className="flex items-center gap-2">
                        {isDirty && (
                            <button
                                onClick={handleSave}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                저장
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1 text-gray-500 hover:text-gray-800 rounded"
                            aria-label="닫기"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* 에디터 */}
                <div className="flex-1 overflow-hidden">
                    {originalMarkdown !== '' || true ? (
                        <Editor
                            ref={editorRef}
                            initialValue={originalMarkdown}
                            previewStyle="vertical"
                            height="100%"
                            initialEditType="wysiwyg"
                            useCommandShortcut={true}
                            onChange={handleChange}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function slugify(str) {
    return String(str).toLowerCase().replace(/\s+/g, '_').replace(/[^\w가-힣]/g, '').slice(0, 40);
}
