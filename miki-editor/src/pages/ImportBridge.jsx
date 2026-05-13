import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'meki_bridge_import';

/**
 * ImportBridge — Local App Bridge 수신 페이지
 *
 * Local App Bridge(Apple/Samsung)가 localStorage에 쓴 노트 데이터를 읽어
 * miki-editor 문서로 변환한다.
 *
 * 라우트: /import-bridge
 * 인증 불필요 — 로컬 데이터만 읽음 (GitHub 저장은 로그인 후 자동)
 */
export default function ImportBridge() {
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading'); // loading | success | empty | error
    const [result, setResult] = useState({ count: 0, source: '' });

    useEffect(() => {
        processImport();
    }, []);

    async function processImport() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            setStatus('empty');
            return;
        }

        let payload;
        try {
            payload = JSON.parse(raw);
        } catch {
            setStatus('error');
            return;
        }

        const { notes = [], source = '' } = payload;
        if (!notes.length) {
            setStatus('empty');
            localStorage.removeItem(STORAGE_KEY);
            return;
        }

        try {
            // 1. IndexedDB documents에 저장 (블로그/문서 흐름과 호환)
            // 2. rawMemosCache에 pending_review로 큐잉 — 큐레이션 세션에서 선택
            const { dbHelpers, RawMemoCache } = await import('../utils/database');

            for (const note of notes) {
                const docId = `bridge-${note.source}-${note.id}`;
                await dbHelpers.saveLocal({
                    id: docId,
                    title: note.title || '제목 없음',
                    content: buildContent(note),
                    filename: null,
                    titleMode: 'manual',
                });
                // Phase 10.5: 자동 컴파일 금지 — 큐레이션 대기 큐로
                await RawMemoCache.enqueueForReview({
                    id: docId,
                    title: note.title,
                    body: note.body,
                    source: note.source,
                    folder: note.folder,
                    createdAt: note.modifiedAt || note.createdAt,
                });
            }

            localStorage.removeItem(STORAGE_KEY);
            setResult({ count: notes.length, source });
            setStatus('success');
        } catch (err) {
            console.error('[ImportBridge] 저장 실패:', err);
            setStatus('error');
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
                {status === 'loading' && (
                    <>
                        <div className="text-3xl mb-3">⏳</div>
                        <p className="text-gray-700 font-medium">노트를 가져오는 중...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="text-3xl mb-3">✅</div>
                        <p className="text-gray-900 font-semibold mb-1">
                            {result.count}개 노트 가져오기 완료
                        </p>
                        <p className="text-sm text-gray-500 mb-5">
                            {sourceLabel(result.source)}에서 가져왔습니다.
                            GitHub에 동기화 중입니다.
                        </p>
                        <button
                            onClick={() => navigate('/editor')}
                            className="w-full py-2 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
                        >
                            에디터로 이동
                        </button>
                    </>
                )}

                {status === 'empty' && (
                    <>
                        <div className="text-3xl mb-3">📭</div>
                        <p className="text-gray-600 mb-5">가져올 노트가 없습니다.</p>
                        <button
                            onClick={() => navigate('/editor')}
                            className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200"
                        >
                            에디터로 이동
                        </button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="text-3xl mb-3">⚠️</div>
                        <p className="text-gray-700 font-medium mb-1">가져오기 실패</p>
                        <p className="text-sm text-gray-500 mb-5">
                            MekiSync 앱을 다시 실행해 보세요.
                        </p>
                        <button
                            onClick={() => navigate('/editor')}
                            className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200"
                        >
                            에디터로 이동
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function buildContent(note) {
    const lines = [`# ${note.title}`, ''];
    if (note.folder && note.folder !== '기본') {
        lines.push(`> 폴더: ${note.folder}`, '');
    }
    lines.push(note.body || '');
    return lines.join('\n');
}

function sourceLabel(source) {
    if (source === 'apple_notes') return 'Apple Notes';
    if (source === 'samsung_notes') return 'Samsung Notes';
    return source;
}
