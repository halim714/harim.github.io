import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReflectionStore } from '../stores/reflectionStore';
import { ReflectionCard } from '../components/ReflectionCard';
import { IdentityReflectionCard } from '../components/IdentityReflectionCard';
import { CounterfactualView } from '../components/CounterfactualView';

export default function Reflection() {
    const navigate = useNavigate();
    const { pendingCards, queue, loadQueue, resolveCard } = useReflectionStore();

    useEffect(() => {
        loadQueue();
    }, [loadQueue]);

    const skippedTriples = queue
        .filter(q => q.status === 'rejected')
        .map(q => q.proposed_update);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* 헤더 — sticky */}
            <header className="bg-white border-b border-gray-100 sticky top-0 z-10 safe-top">
                <div className="px-4 py-3 flex items-center gap-3 max-w-xl mx-auto">
                    <button
                        onClick={() => navigate('/editor')}
                        className="p-2 -ml-2 text-gray-500 hover:text-gray-800 rounded-full text-lg"
                        aria-label="에디터로"
                    >
                        ←
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-semibold text-gray-900 leading-tight">
                            오늘의 연결
                        </h1>
                        <p className="text-xs text-gray-500">
                            {pendingCards.length > 0
                                ? `${pendingCards.length}개의 새 관계 제안`
                                : '새 관계 제안 없음'}
                        </p>
                    </div>
                </div>
            </header>

            {/* 카드 목록 */}
            <main className="flex-1 px-4 py-4 max-w-xl mx-auto w-full flex flex-col gap-3 pb-8">
                {pendingCards.length === 0 ? (
                    <EmptyState />
                ) : (
                    pendingCards.map(card =>
                        card.type === 'identity' ? (
                            <IdentityReflectionCard
                                key={card.id}
                                card={card}
                                onDecision={resolveCard}
                            />
                        ) : (
                            <ReflectionCard
                                key={card.id}
                                card={card}
                                onDecision={resolveCard}
                            />
                        )
                    )
                )}

                {/* Anti-bubble: 건너뜀 목록 */}
                {skippedTriples.length > 0 && (
                    <CounterfactualView skippedTriples={skippedTriples} />
                )}
            </main>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-4xl">🔗</span>
            <p className="text-gray-600 font-medium">새 메모를 작성하면</p>
            <p className="text-gray-400 text-sm">과거와의 연결이 여기에 나타납니다</p>
        </div>
    );
}
