import { useState, useRef } from 'react';

/**
 * ReflectionCard — Relation Reflection 카드 (Phone-first 스와이프)
 *
 * 제스처:
 *   - 오른쪽 스와이프 → 수락 (accepted)
 *   - 왼쪽 스와이프 → 거절 (rejected)
 *   - 탭 → 수정 모드 토글 (인라인 입력)
 *
 * Props:
 *   card        object (reflectionsQueue 항목, type:'relation')
 *   onDecision  (id, decision, note?) => void
 */
const TIER_STYLE = {
    Grounded: 'bg-blue-100 text-blue-800',
    Bridged: 'bg-yellow-100 text-yellow-800',
    Speculative: 'bg-gray-100 text-gray-600',
};
const TIER_KO = { Grounded: '명시', Bridged: '추론', Speculative: '추측' };

const SWIPE_THRESHOLD = 80;

export function ReflectionCard({ card, onDecision }) {
    const [editing, setEditing] = useState(false);
    const [note, setNote] = useState('');
    const [dragX, setDragX] = useState(0);
    const [animating, setAnimating] = useState(false);
    const touch = useRef({ startX: 0, startY: 0, dragging: false, mouseDown: false });

    const { proposed_update: p, evidence_tier, rationale } = card;

    const begin = (clientX, clientY) => {
        if (editing) return;
        touch.current = { startX: clientX, startY: clientY, dragging: false, mouseDown: true };
        setAnimating(false);
    };

    const move = (clientX, clientY, e) => {
        if (editing) return;
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
        if (editing) return;
        if (!touch.current.mouseDown && !touch.current.dragging) return;
        const dx = dragX;

        if (!touch.current.dragging && Math.abs(dx) < 5) {
            setEditing(true);
        } else if (dx > SWIPE_THRESHOLD) {
            onDecision(card.id, 'accepted');
        } else if (dx < -SWIPE_THRESHOLD) {
            onDecision(card.id, 'rejected');
        }

        setAnimating(true);
        setDragX(0);
        touch.current.dragging = false;
        touch.current.mouseDown = false;
    };

    const handleModifySubmit = () => {
        if (note.trim()) {
            onDecision(card.id, 'modified', note.trim());
        }
        setEditing(false);
        setNote('');
    };

    const rotate = dragX / 30;
    const bgTint =
        dragX > 20 ? 'bg-green-50/70' :
        dragX < -20 ? 'bg-red-50/70' :
        'bg-white';

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
                transform: editing ? 'none' : `translateX(${dragX}px) rotate(${rotate}deg)`,
                transition: animating ? 'transform 0.2s ease-out' : 'none',
                touchAction: editing ? 'auto' : 'pan-y',
                userSelect: editing ? 'auto' : 'none',
            }}
            className={`relative ${bgTint} rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 cursor-pointer select-none`}
        >
            {/* 스와이프 인디케이터 */}
            {dragX > 20 && (
                <div className="absolute top-3 right-3 text-green-600 font-bold text-sm pointer-events-none">
                    ✓ 수락
                </div>
            )}
            {dragX < -20 && (
                <div className="absolute top-3 left-3 text-red-600 font-bold text-sm pointer-events-none">
                    ✕ 거절
                </div>
            )}

            {/* 티어 배지 + 관계 */}
            <div className="flex items-start gap-2 pr-16">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TIER_STYLE[evidence_tier] || TIER_STYLE.Speculative}`}>
                    {TIER_KO[evidence_tier] || evidence_tier}
                </span>
                <p className="text-sm text-gray-900 leading-snug">
                    <strong>{p.subject}</strong>
                    <span className="text-gray-400 mx-1">→</span>
                    <span className="text-gray-700">{p.predicate}</span>
                    <span className="text-gray-400 mx-1">→</span>
                    <strong>{p.object}</strong>
                </p>
            </div>

            {/* 인라인 편집 모드 */}
            {editing && (
                <div className="flex flex-col gap-2">
                    <input
                        autoFocus
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleModifySubmit()}
                        placeholder="어떻게 수정하시겠어요?"
                        className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleModifySubmit}
                            disabled={!note.trim()}
                            className="flex-1 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40"
                        >
                            수정 저장
                        </button>
                        <button
                            onClick={() => { setEditing(false); setNote(''); }}
                            className="flex-1 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            취소
                        </button>
                    </div>
                </div>
            )}

            {/* rationale 푸터 + 제스처 힌트 */}
            {!editing && (
                <>
                    {rationale && (
                        <p className="text-xs text-gray-500 border-t border-gray-100 pt-2 leading-relaxed">
                            왜 이걸 보여드리나요? {rationale}
                        </p>
                    )}
                    <p className="text-[10px] text-gray-400 text-center -mt-1">
                        ← 거절 · 수락 → · 탭하여 수정
                    </p>
                </>
            )}
        </div>
    );
}
