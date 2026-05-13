import { useState } from 'react';

/**
 * IdentityReflectionCard — Identity Reflection 카드
 * 두 엔티티의 동일성 여부를 사용자가 결정
 * Props:
 *   card        object   reflectionsQueue 항목 (type:'identity')
 *   onDecision  (id, modelingKey) => void
 */
export function IdentityReflectionCard({ card, onDecision }) {
    const [selected, setSelected] = useState(null);
    const { proposed_update: p, modeling_options, rationale, evidence_snippet } = card;

    const handleConfirm = () => {
        if (selected) onDecision(card.id, selected);
    };

    return (
        <div className="bg-white rounded-xl border border-purple-200 shadow-sm p-4 flex flex-col gap-3">
            {/* 헤더 */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    동일성
                </span>
                <p className="text-sm font-semibold text-gray-900">
                    "{p.subject}"와 "{p.object}" — 같은 분인가요?
                </p>
            </div>

            {/* 근거 */}
            {evidence_snippet && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 italic">
                    "{evidence_snippet}"
                </p>
            )}

            {/* 3지선다 */}
            <div className="flex flex-col gap-2">
                {(modeling_options || []).map(opt => (
                    <label
                        key={opt.key}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selected === opt.key
                                ? 'border-purple-400 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <input
                            type="radio"
                            name={`identity-${card.id}`}
                            value={opt.key}
                            checked={selected === opt.key}
                            onChange={() => setSelected(opt.key)}
                            className="accent-purple-600"
                        />
                        <span className="text-sm text-gray-800">{opt.label}</span>
                    </label>
                ))}
            </div>

            {/* 확인 버튼 */}
            <button
                onClick={handleConfirm}
                disabled={!selected}
                className="w-full py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                확인
            </button>

            {/* rationale 푸터 */}
            {rationale && (
                <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">
                    왜 이걸 보여드리나요? {rationale}
                </p>
            )}
        </div>
    );
}
