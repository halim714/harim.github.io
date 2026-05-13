import { useState } from 'react';

/**
 * CounterfactualView — Anti-bubble 투명성 UI
 * "오늘 건너뜀(Consistent) 트리플" 목록을 접힌 토글로 표시
 * Props:
 *   skippedTriples  Array  classifyTriple()에서 Consistent로 분류된 트리플
 */
export function CounterfactualView({ skippedTriples = [] }) {
    const [open, setOpen] = useState(false);

    if (!skippedTriples.length) return null;

    return (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm text-gray-600"
            >
                <span>오늘 건너뜀 ({skippedTriples.length}개)</span>
                <span className="text-gray-400">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <ul className="divide-y divide-gray-100">
                    {skippedTriples.map((t, i) => (
                        <li key={i} className="px-4 py-2 flex items-start gap-2">
                            <span className="text-xs mt-0.5 text-gray-400 shrink-0">✓</span>
                            <span className="text-sm text-gray-700">
                                <strong>{t.subject}</strong>
                                <span className="text-gray-400 mx-1">→</span>
                                {t.predicate}
                                <span className="text-gray-400 mx-1">→</span>
                                {t.object}
                            </span>
                        </li>
                    ))}
                    <li className="px-4 py-2">
                        <p className="text-xs text-gray-400">
                            왜 건너뛰었나요? 이미 위키에 있는 내용입니다.
                        </p>
                    </li>
                </ul>
            )}
        </div>
    );
}
