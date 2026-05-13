import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'meki_bridge_import';

/**
 * ImportBridge — 외부 노트 수신 페이지
 *
 * 세 가지 경로로 노트를 받는다:
 * 1. URL 파라미터: /import-bridge?title=...&text=...&source=apple_notes
 *    → Apple 단축어(Shortcuts)에서 호출
 * 2. localStorage: meki_bridge_import 키에 JSON 배열
 *    → 별도 브릿지 앱(MekiSync 등)
 * 3. 클립보드 붙여넣기: 사용자가 수동으로 텍스트 붙여넣기
 */
export default function ImportBridge() {
    const navigate = useNavigate();
    const [status, setStatus] = useState('idle'); // idle | loading | success | empty | error | paste
    const [result, setResult] = useState({ count: 0, source: '' });
    const [pasteText, setPasteText] = useState('');
    const [pasteTitle, setPasteTitle] = useState('');

    useEffect(() => {
        // 1순위: URL 파라미터 (Apple 단축어)
        const params = new URLSearchParams(window.location.search);
        const urlText = params.get('text') || params.get('body');
        const urlTitle = params.get('title');

        if (urlText) {
            saveNotes([{
                id: `url-${Date.now()}`,
                title: urlTitle || extractTitle(urlText),
                body: urlText,
                source: params.get('source') || 'apple_notes',
                folder: params.get('folder') || '',
                createdAt: new Date().toISOString(),
            }], params.get('source') || 'apple_notes');
            return;
        }

        // 2순위: localStorage (MekiSync 앱)
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            let payload;
            try { payload = JSON.parse(raw); } catch { setStatus('error'); return; }
            const { notes = [], source = '' } = payload;
            if (notes.length) {
                saveNotes(notes, source);
                localStorage.removeItem(STORAGE_KEY);
                return;
            }
        }

        // 3순위: 클립보드 붙여넣기 UI 표시
        setStatus('paste');
    }, []);

    async function saveNotes(notes, source) {
        setStatus('loading');
        try {
            const { dbHelpers, RawMemoCache } = await import('../utils/database');
            for (const note of notes) {
                const docId = `bridge-${note.source || source}-${note.id}`;
                await dbHelpers.saveLocal({
                    id: docId,
                    title: note.title || '제목 없음',
                    content: buildContent(note),
                    filename: null,
                    titleMode: 'manual',
                });
                await RawMemoCache.enqueueForReview({
                    id: docId,
                    title: note.title,
                    body: note.body,
                    source: note.source || source,
                    folder: note.folder,
                    createdAt: note.modifiedAt || note.createdAt,
                });
            }
            setResult({ count: notes.length, source });
            setStatus('success');
        } catch (err) {
            console.error('[ImportBridge] 저장 실패:', err);
            setStatus('error');
        }
    }

    const handlePasteFromClipboard = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) {
                setPasteText(text);
                setPasteTitle(extractTitle(text));
            }
        } catch {
            // 권한 거부 시 textarea에서 직접 붙여넣기
        }
    }, []);

    const handlePasteSubmit = useCallback(() => {
        if (!pasteText.trim()) return;
        saveNotes([{
            id: `paste-${Date.now()}`,
            title: pasteTitle.trim() || extractTitle(pasteText),
            body: pasteText,
            source: 'paste',
            folder: '',
            createdAt: new Date().toISOString(),
        }], 'paste');
    }, [pasteText, pasteTitle]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-12 px-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 w-full max-w-sm">

                {status === 'loading' && (
                    <div className="text-center py-4">
                        <div className="text-3xl mb-3">⏳</div>
                        <p className="text-gray-700 font-medium">노트를 가져오는 중...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="text-3xl mb-3">✅</div>
                        <p className="text-gray-900 font-semibold mb-1">
                            {result.count}개 노트 가져오기 완료
                        </p>
                        <p className="text-sm text-gray-500 mb-5">
                            {sourceLabel(result.source)}에서 가져왔습니다.
                        </p>
                        <button
                            onClick={() => navigate('/curation')}
                            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
                        >
                            큐레이션에서 검토하기
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="text-3xl mb-3">⚠️</div>
                        <p className="text-gray-700 font-medium mb-4">가져오기 실패</p>
                        <button onClick={() => setStatus('paste')} className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200">
                            직접 붙여넣기
                        </button>
                    </div>
                )}

                {status === 'paste' && (
                    <>
                        <h2 className="text-base font-semibold text-gray-900 mb-1">노트 가져오기</h2>
                        <p className="text-xs text-gray-500 mb-4">
                            Apple 메모에서 복사한 텍스트를 붙여넣거나,
                            아래 단축어 설정으로 자동화하세요.
                        </p>

                        {/* 클립보드 붙여넣기 */}
                        <button
                            onClick={handlePasteFromClipboard}
                            className="w-full mb-3 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
                        >
                            <span>📋</span> 클립보드에서 붙여넣기
                        </button>

                        <div className="mb-3">
                            <input
                                value={pasteTitle}
                                onChange={e => setPasteTitle(e.target.value)}
                                placeholder="제목 (선택)"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2 outline-none focus:border-blue-400"
                            />
                            <textarea
                                value={pasteText}
                                onChange={e => setPasteText(e.target.value)}
                                placeholder="여기에 Apple 메모 내용을 붙여넣으세요..."
                                rows={6}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 resize-none"
                            />
                        </div>

                        <button
                            onClick={handlePasteSubmit}
                            disabled={!pasteText.trim()}
                            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed mb-4"
                        >
                            가져오기
                        </button>

                        {/* Apple 단축어 안내 */}
                        <details className="group">
                            <summary className="text-xs text-blue-600 cursor-pointer select-none list-none flex items-center gap-1">
                                <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                                Apple 단축어로 자동화하기
                            </summary>
                            <div className="mt-3 text-xs text-gray-600 space-y-2 bg-gray-50 rounded-xl p-3">
                                <p className="font-medium text-gray-800">단축어 만드는 방법:</p>
                                <ol className="space-y-1.5 list-decimal list-inside">
                                    <li>iPhone <strong>단축어</strong> 앱 열기</li>
                                    <li>"+" 눌러 새 단축어 생성</li>
                                    <li><strong>"공유 시트에서 받기"</strong> 액션 추가 (입력: 텍스트)</li>
                                    <li><strong>"URL 열기"</strong> 액션 추가</li>
                                    <li>URL 입력:</li>
                                </ol>
                                <div className="bg-white border border-gray-200 rounded-lg p-2 font-mono text-[10px] break-all select-all">
                                    {`${window.location.origin}/import-bridge?source=apple_notes&title=[제목]&text=[입력한 텍스트]`}
                                </div>
                                <p className="text-gray-500">Apple 메모에서 공유 → 단축어 선택하면 자동으로 Meki에 전송됩니다.</p>
                            </div>
                        </details>
                    </>
                )}
            </div>
        </div>
    );
}

function extractTitle(text) {
    const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').trim();
    return firstLine.slice(0, 50) || '붙여넣기 메모';
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
    if (source === 'paste') return '클립보드';
    return source;
}
