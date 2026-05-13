import { useState, useEffect } from 'react';

/**
 * EditMemoModal — 큐레이션 도중 메모 본문 편집
 * 폰에서 풀스크린, 데스크탑에서는 중앙 모달
 *
 * Props:
 *   memo      { memoId, title, body }
 *   onSave    (memoId, { title, body }) => void
 *   onClose   () => void
 */
export function EditMemoModal({ memo, onSave, onClose }) {
    const [title, setTitle] = useState(memo.title || '');
    const [body, setBody] = useState(memo.body || '');

    useEffect(() => {
        setTitle(memo.title || '');
        setBody(memo.body || '');
    }, [memo.memoId]);

    const handleSave = () => {
        onSave(memo.memoId, { title: title.trim(), body });
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
            onClick={onClose}
        >
            <div
                className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[90vh] shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <button
                        onClick={onClose}
                        className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1"
                    >
                        취소
                    </button>
                    <h2 className="text-base font-semibold text-gray-900">메모 편집</h2>
                    <button
                        onClick={handleSave}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1"
                    >
                        저장
                    </button>
                </div>

                {/* 편집 영역 */}
                <div className="flex-1 overflow-auto px-4 py-3 flex flex-col gap-3">
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="제목"
                        className="text-base font-semibold w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        placeholder="본문"
                        rows={12}
                        className="text-sm w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none flex-1"
                    />
                    <p className="text-[11px] text-gray-400">
                        편집된 내용은 위키 컴파일에 사용됩니다. 원본 메모는 영향받지 않습니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
