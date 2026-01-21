import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmModal({
    isOpen,
    title,
    message,
    danger = false,
    onConfirm,
    onCancel,
}) {
    // ESC 키 처리
    const handleKeyDown = useCallback(
        (event) => {
            if (event.key === 'Escape') {
                onCancel();
            }
        },
        [onCancel]
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // 포커스 트랩 및 스크롤 방지
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    // SSR 대응
    if (typeof window === 'undefined') return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancel}
                aria-hidden="true"
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                <h2
                    id="modal-title"
                    className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100"
                >
                    {title}
                </h2>

                <p className="text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-line">
                    {message}
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        autoFocus={!danger}
                    >
                        취소
                    </button>

                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-lg transition-colors ${danger
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        autoFocus={danger}
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
