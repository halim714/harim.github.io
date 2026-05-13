import { useState, useEffect } from 'react';
import { useWikiStore } from '../stores/wikiStore';
import { WikiPage } from '../wiki/components/WikiPage';

export default function WikiIndex() {
    const loadFromCache = useWikiStore(s => s.loadFromCache);
    const storeListEntities = useWikiStore(s => s.listEntities);

    const [entities, setEntities] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedEntity, setSelectedEntity] = useState(null);

    useEffect(() => {
        loadFromCache().then(() => {
            setEntities(useWikiStore.getState().listEntities());
        });
    }, [loadFromCache]);

    const filtered = search.trim()
        ? entities.filter(e => e.toLowerCase().includes(search.toLowerCase()))
        : entities;

    return (
        <div className="min-h-screen bg-gray-50 md:pl-12 flex flex-col" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <header className="bg-white border-b border-gray-100 sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
                <div className="px-4 py-3 max-w-2xl mx-auto md:mx-0">
                    <h1 className="text-base font-semibold text-gray-900 mb-2">위키</h1>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="엔티티 검색..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-gray-50"
                    />
                </div>
            </header>

            <main className="flex-1 px-4 py-3 max-w-2xl mx-auto md:mx-0 w-full">
                {entities.length === 0 ? (
                    <EmptyState />
                ) : filtered.length === 0 ? (
                    <p className="text-sm text-gray-400 mt-12 text-center">"{search}"에 해당하는 엔티티 없음</p>
                ) : (
                    <ul className="divide-y divide-gray-100 bg-white rounded-xl shadow-sm overflow-hidden">
                        {filtered.map(entity => (
                            <li key={entity}>
                                <button
                                    onClick={() => setSelectedEntity(entity)}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 transition-colors flex items-center justify-between"
                                >
                                    <span>{entity}</span>
                                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </main>

            {selectedEntity && (
                <WikiPage
                    entityName={selectedEntity}
                    onClose={() => setSelectedEntity(null)}
                />
            )}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-4xl">📖</span>
            <p className="text-gray-600 font-medium">위키가 비어 있습니다</p>
            <p className="text-gray-400 text-sm">
                큐레이션에서 메모를 확정하면<br />위키에 관계가 쌓입니다
            </p>
        </div>
    );
}
