import { useContext } from 'react';
import { ConfirmContext } from '../contexts/ConfirmContext';

/**
 * 전역 확인 모달을 사용하기 위한 훅
 * @returns {Function} confirm - Promise<boolean>을 반환하는 확인 함수
 * 
 * @example
 * const confirm = useConfirm();
 * const ok = await confirm({ 
 *   title: '문서 삭제', 
 *   message: '정말로 삭제하시겠습니까?',
 *   danger: true 
 * });
 * if (ok) {
 *   // 삭제 로직 실행
 * }
 */
export function useConfirm() {
    const context = useContext(ConfirmContext);

    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider');
    }

    return context.confirm;
}
