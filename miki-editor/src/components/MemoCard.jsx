import { useState, useRef } from 'react';

/**
 * MemoCard — 큐레이션 세션의 메모 카드 (Phone-first 스와이프)
 *
 * 제스처:
 *   - 오른쪽 스와이프 (≥80px) → onSelect (위키 추가)
 *   - 왼쪽 스와이프 (≥80px) → onExclude (비공개)
 *   - 탭 → onTap (edit 모달)
 *   - 임계값 미만 → 원위치 스냅백
 *
 * Props:
 *   memo       { memoId, title, body, source, capturedAt, folder }
 *   decision   null | 'selected' | 'excluded'
 *   onSelect   () => void
 *   onExclude  () => void
 *   onTap      () => void
 */
export function MemoCard({ memo, decision, onSelect, onExclude, onTap }) {
    const [dragX, setDragX] = useState(0);
    const [animating, setAnimating] = useState(false);
    const touch = useRef({ startX: 0, startY: 0, dragging: false, mouseDown: false });

    const SWIPE_THRESHOLD = 80;
    const TAP_THRESHOLD = 5;

    const begin = (clientX, clientY) => {
        touch.current = { startX: clientX, startY: clientY, dragging: false, mouseDown: true };
        setAnimating(false);
    };

    const move = (clientX, clientY, e) => {
        if (!touch.current.mouseDown && !e?.touches) return;
        const dx = clientX - touch.current.startX;
        const dy = clientY - touch.current.startY;
        if (!touch.current.dragging && Math.abs(dx) > Math.abs(dy) + 5) {
            touch.current.dragging = true;
        }
        if (touch.current.dragging) {
            e?.preventDefault?.();
            setDragX(dx);
        }
    };

    const end = () => {
        if (!touch.current.mouseDown && !touch.current.dragging) return;
        const dx = dragX;

        if (!touch.current.dragging && Math.abs(dx) < TAP_THRESHOLD) {
            onTap?.();
        } else if (dx > SWIPE_THRESHOLD) {
            onSelect?.();
        } else if (dx < -SWIPE_THRESHOLD) {
            onExclude?.();
        }

        setAnimating(true);
        setDragX(0);
        touch.current.dragging = false;
        touch.current.mouseDown = false;
    };

    // 시각 효과
    const rotate = dragX / 30;
    const opacity = decision === 'excluded' ? 0.5 : 1;
    const bgTint =
        dragX > 20 ? 'bg-green-50/70' :
        dragX < -20 ? 'bg-red-50/70' :
        decision === 'selected' ? 'bg-blue-50' :
        decision === 'excluded' ? 'bg-gray-50' :
        'bg-white';
    const borderTint =
        decision === 'selected' ? 'border-blue-400' :
        decision === 'excluded' ? 'border-gray-300' :
        'border-gray-200';

    return (
        <div
            onTouchStart={e => begin(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={e => move(e.touches[0].clientX, e.touches[0].clientY, e)}
            onTouchEnd={end}
            onMouseDown={e => begin(e.clientX, e.clientY)}
            onMouseMove={e => touch.current.mouseDown && move(e.clientX, e.clientY)}
            onMouseUp={end}
            onMouseLeave={() => touch.current.mouseDown && end()}
            style={{
                transform: `translateX(${dragX}px) rotate(${rotate}deg)`,
                transition: animating ? 'transform 0.2s ease-out' : 'none',
                opacity,
                touchAction: 'pan-y',
                userSelect: 'none',
            }}
            className={`relative w-full p-4 rounded-2xl border ${borderTint} ${bgTint} shadow-sm cursor-pointer select-none`}
        >
            {/* 스와이프 인디케이터 — 오른쪽 */}
            {dragX > 20 && (
                <div className="absolute top-3 right-3 text-green-600 font-bold text-sm pointer-events-none">
                    ✓ 추가
                </div>
            )}
            {/* 스와이프 인디케이터 — 왼쪽 */}
            {dragX < -20 && (
                <div className="absolute top-3 left-3 text-red-600 font-bold text-sm pointer-events-none">
                    ✕ 비공개
                </div>
            )}
            {/* 결정 배지 (스와이프 중 아닐 때) */}
            {Math.abs(dragX) < 5 && decision === 'selected' && (
                <div className="absolute top-3 right-3 text-blue-600 font-bold text-xs">
                    ✓ 추가됨
                </div>
            )}
            {Math.abs(dragX) < 5 && decision === 'excluded' && (
                <div className="absolute top-3 right-3 text-gray-500 font-medium text-xs">
                    🔒 비공개
                </div>
            )}

            {/* 메모 내용 */}
            <div className="pr-16">
                <h3 className="text-base font-semibold text-gray-900 truncate leading-tight">
                    {memo.title || '제목 없음'}
                </h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-3 leading-relaxed">
                    {(memo.body || '').slice(0, 200).trim() || '내용 없음'}
                </p>
                <div className="flex items-center gap-2 mt-3 text-[11px] text-gray-400">
                    <span>{sourceLabel(memo.source)}</span>
                    {memo.folder && <span>· {memo.folder}</span>}
                    <span className="ml-auto">{formatTime(memo.capturedAt)}</span>
                </div>
            </div>

            {/* 탭 힌트 (결정 안 됐을 때만) */}
            {!decision && Math.abs(dragX) < 5 && (
                <p className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
                    ← 비공개 · 추가 → · 탭하여 편집
                </p>
            )}
        </div>
    );
}

function formatTime(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function sourceLabel(source) {
    if (source === 'apple_notes') return 'Apple Notes';
    if (source === 'samsung_notes') return 'Samsung Notes';
    if (source === 'meki_editor') return 'Meki';
    return source || '';
}
