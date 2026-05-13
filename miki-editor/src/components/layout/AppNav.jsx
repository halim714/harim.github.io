import { useLocation, useNavigate } from 'react-router-dom';
import { useCurationStore } from '../../stores/curationStore';
import { useReflectionStore } from '../../stores/reflectionStore';

function Badge({ count }) {
    if (!count) return null;
    return (
        <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none px-0.5">
            {count > 9 ? '9+' : count}
        </span>
    );
}

const PencilIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
);

const ClipboardIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
);

const LinkIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
);

const BookIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.753 0-3.332.477-4.5 1.253" />
    </svg>
);

const NAV_ITEMS = [
    { path: '/editor', label: '쓰기', Icon: PencilIcon },
    { path: '/curation', label: '큐레이션', Icon: ClipboardIcon, badgeKey: 'curation' },
    { path: '/reflection', label: '연결', Icon: LinkIcon, badgeKey: 'reflection' },
    { path: '/wiki', label: '위키', Icon: BookIcon },
];

export default function AppNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const curationPending = useCurationStore(s => s.pending.length);
    const reflectionPending = useReflectionStore(s => s.pendingCards.length);

    const badges = { curation: curationPending, reflection: reflectionPending };

    const isActive = (path) =>
        location.pathname === path ||
        (path === '/editor' && (location.pathname === '/' || location.pathname === ''));

    return (
        <>
            {/* Desktop: fixed left rail */}
            <nav
                className="hidden md:flex fixed left-0 top-0 h-screen w-12 bg-white border-r border-gray-200 flex-col items-center py-3 gap-1 z-40"
                aria-label="앱 네비게이션"
            >
                {NAV_ITEMS.map(({ path, label, Icon, badgeKey }) => (
                    <button
                        key={path}
                        onClick={() => navigate(path)}
                        className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            isActive(path)
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                        }`}
                        title={label}
                        aria-label={label}
                        aria-current={isActive(path) ? 'page' : undefined}
                    >
                        <Icon />
                        {badgeKey && <Badge count={badges[badgeKey]} />}
                    </button>
                ))}
            </nav>

            {/* Mobile: fixed bottom tab bar */}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-stretch z-40"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                aria-label="앱 네비게이션"
            >
                {NAV_ITEMS.map(({ path, label, Icon, badgeKey }) => (
                    <button
                        key={path}
                        onClick={() => navigate(path)}
                        className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                            isActive(path) ? 'text-blue-600' : 'text-gray-400'
                        }`}
                        aria-label={label}
                        aria-current={isActive(path) ? 'page' : undefined}
                    >
                        <Icon />
                        <span className="text-[10px] leading-tight">{label}</span>
                        {badgeKey && <Badge count={badges[badgeKey]} />}
                    </button>
                ))}
            </nav>
        </>
    );
}
