import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurationStore } from '../stores/curationStore';
import { MemoCard } from '../components/MemoCard';
import { EditMemoModal } from '../components/EditMemoModal';
import { GitHubService } from '../services/github';
import { AuthService } from '../services/auth';

/**
 * Curation — 큐레이션 세션 페이지 (Phone-first)
 * 라우트: /curation
 *
 * UX:
 *   - 카드 스택 (세로 스크롤)
 *   - 오른쪽 스와이프 = 추가 / 왼쪽 = 비공개 / 탭 = 편집
 *   - sticky 하단 진행 + 확정 버튼
 *   - 결정된 메모만 컴파일됨. 미결정은 다음 세션으로
 */
export default function Curation() {
    const navigate = useNavigate();
    const {
        pending, decisions, editingMemo, confirming, lastResult,
        loadPending, markSelected, markExcluded,
        openEditor, closeEditor, saveEdit, confirm,
    } = useCurationStore();

    const [error, setError] = useState(null);

    useEffect(() => { loadPending(); }, [loadPending]);

    const decidedCount = decisions.size;
    const selectedCount = [...decisions.values()].filter(v => v === 'selected').length;
    const excludedCount = decidedCount - selectedCount;

    const handleConfirm = async () => {
        setError(null);
        try {
            const token = AuthService.getToken();
            const github = new GitHubService(token);
            await github.setUsername();
            const result = await confirm({ github, dataRepo: 'miki-data' });
            if (result.reflections > 0) {
                navigate('/reflection');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* 헤더 */}
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
                            오늘의 큐레이션
                        </h1>
                        <p className="text-xs text-gray-500">
                            {pending.length > 0
                                ? `${decidedCount} / ${pending.length} 결정됨`
                                : '결정할 메모 없음'}
                        </p>
                    </div>
                </div>
                {/* 진행 바 */}
                {pending.length > 0 && (
                    <div className="h-0.5 bg-gray-100">
                        <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${(decidedCount / pending.length) * 100}%` }}
                        />
                    </div>
                )}
            </header>

            {/* 카드 목록 */}
            <main className="flex-1 px-4 py-4 max-w-xl mx-auto w-full pb-32 flex flex-col gap-3">
                {lastResult && (
                    <Banner
                        result={lastResult}
                        onDismiss={() => useCurationStore.setState({ lastResult: null })}
                    />
                )}

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                        {error}
                    </div>
                )}

                {pending.length === 0 ? (
                    <EmptyState onBack={() => navigate('/editor')} />
                ) : (
                    pending.map(memo => (
                        <MemoCard
                            key={memo.memoId}
                            memo={memo}
                            decision={decisions.get(memo.memoId) || null}
                            onSelect={() => markSelected(memo.memoId)}
                            onExclude={() => markExcluded(memo.memoId)}
                            onTap={() => openEditor(memo)}
                        />
                    ))
                )}
            </main>

            {/* sticky 하단 — 확정 영역 */}
            {pending.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 safe-bottom">
                    <div className="max-w-xl mx-auto flex items-center gap-3">
                        <div className="text-xs text-gray-500 flex flex-col leading-tight">
                            <span><strong className="text-blue-600">{selectedCount}</strong> 추가</span>
                            <span><strong className="text-gray-700">{excludedCount}</strong> 비공개</span>
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={confirming || decidedCount === 0}
                            className="ml-auto px-5 py-3 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                            {confirming ? '컴파일 중...' : `${decidedCount}개 확정`}
                        </button>
                    </div>
                </div>
            )}

            {/* 편집 모달 */}
            {editingMemo && (
                <EditMemoModal
                    memo={editingMemo}
                    onSave={saveEdit}
                    onClose={closeEditor}
                />
            )}
        </div>
    );
}

function EmptyState({ onBack }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-5xl">📭</span>
            <p className="text-gray-700 font-medium">검토할 메모가 없습니다</p>
            <p className="text-gray-400 text-sm">
                새 메모를 작성하면<br />이곳에 나타납니다
            </p>
            <button
                onClick={onBack}
                className="mt-4 px-5 py-2.5 text-sm bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 active:bg-gray-300"
            >
                에디터로 돌아가기
            </button>
        </div>
    );
}

function Banner({ result, onDismiss }) {
    return (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-start justify-between gap-2">
            <div>
                <p className="font-medium">✅ {result.compiled}개 메모 컴파일 완료</p>
                <p className="text-xs text-green-700 mt-0.5">
                    {result.triples}개 트리플 · {result.reflections}개 reflection
                </p>
            </div>
            <button
                onClick={onDismiss}
                className="text-green-600 hover:text-green-900 text-lg leading-none p-1"
            >
                ✕
            </button>
        </div>
    );
}
