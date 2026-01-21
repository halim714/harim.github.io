import React, { createContext, useState, useCallback, useRef } from 'react';
import ConfirmModal from '../components/common/ConfirmModal';

export const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        danger: false,
    });

    const resolveRef = useRef(null);

    /**
     * 확인 모달을 표시하고 사용자 응답을 Promise로 반환
     * @param {Object} options - { title, message, danger }
     * @returns {Promise<boolean>}
     */
    const confirm = useCallback(({ title, message, danger = false }) => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setModalState({
                isOpen: true,
                title,
                message,
                danger,
            });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setModalState((prev) => ({ ...prev, isOpen: false }));
        if (resolveRef.current) {
            resolveRef.current(true);
            resolveRef.current = null;
        }
    }, []);

    const handleCancel = useCallback(() => {
        setModalState((prev) => ({ ...prev, isOpen: false }));
        if (resolveRef.current) {
            resolveRef.current(false);
            resolveRef.current = null;
        }
    }, []);

    // Cleanup: 언마운트 시 대기 중인 Promise reject
    React.useEffect(() => {
        return () => {
            if (resolveRef.current) {
                resolveRef.current(false);
            }
        };
    }, []);

    const value = React.useMemo(() => ({ confirm }), [confirm]);

    return (
        <ConfirmContext.Provider value={value}>
            {children}
            <ConfirmModal
                isOpen={modalState.isOpen}
                title={modalState.title}
                message={modalState.message}
                danger={modalState.danger}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ConfirmContext.Provider>
    );
}
