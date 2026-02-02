import { useState } from 'react';
import { Loader2, X, FileText, Image, Film, Book, Link as LinkIcon, Music } from 'lucide-react';

const TYPE_ICONS = {
    book: Book,
    movie: Film,
    link: LinkIcon,
    image: Image,
    document: FileText,
    audio: Music,
    file: FileText
};

const AttachmentCard = ({ item, onRemove }) => {
    const Icon = TYPE_ICONS[item.type] || FileText;
    const isPending = item.status === 'pending';
    const isError = item.status === 'error';

    return (
        <div className={`relative group min-w-[140px] max-w-[140px] h-[100px] rounded-xl border flex flex-col items-center justify-center p-3 transition-all
      ${isPending ? 'bg-gray-50 border-dashed animate-pulse' : 'bg-white border-gray-200 hover:shadow-md hover:border-blue-300'}`}>

            {/* 삭제 버튼 */}
            {!isPending && (
                <button
                    onClick={() => onRemove(item.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-200"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            {isPending ? (
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="text-[10px] text-gray-400 text-center font-medium">AI 분석 중...</span>
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center gap-1 text-red-500">
                    <X className="w-6 h-6" />
                    <span className="text-[10px] text-center font-medium">실패</span>
                    {item.error && (
                        <span className="text-[8px] text-gray-400 text-center truncate w-full" title={item.error}>
                            {item.error}
                        </span>
                    )}
                </div>
            ) : (
                <>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 
            ${item.type === 'book' ? 'bg-orange-100 text-orange-600' :
                            item.type === 'movie' ? 'bg-purple-100 text-purple-600' :
                                item.type === 'image' ? 'bg-blue-100 text-blue-600' :
                                    item.type === 'audio' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        {item.display_url ? (
                            <img src={item.display_url} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                            <Icon className="w-6 h-6" />
                        )}
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700 truncate w-full text-center" title={item.title || item.name}>
                        {item.title || item.name}
                    </span>
                    {item.model && item.model !== 'none' && (
                        <span className="text-[8px] text-gray-400 mt-1 uppercase tracking-tighter">{item.model.split(' ')[0]}</span>
                    )}
                </>
            )}
        </div>
    );
};

const AttachmentBox = ({ attachments = [], isCollapsed, onToggle, onAttach, onRemove }) => {
    return (
        <div className="relative px-4 mb-4 flex-shrink-0">
            {/* 접기 버튼 */}
            <button
                onClick={onToggle}
                className="absolute right-6 -top-2 text-gray-400 hover:text-gray-600 transition-colors z-10 p-1"
                aria-label={isCollapsed ? '펼치기' : '접기'}
            >
                <div className={`transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}>
                    <FileText className="w-4 h-4" />
                </div>
            </button>

            {!isCollapsed && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide py-2 px-1">
                    {/* 추가 버튼 */}
                    <button
                        onClick={onAttach}
                        className="min-w-[100px] h-[100px] border-2 border-dashed border-gray-200 rounded-xl
                     bg-gray-50 hover:bg-white hover:border-blue-400 hover:text-blue-500
                     transition-all flex flex-col items-center justify-center gap-2 group flex-shrink-0"
                    >
                        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center transition-transform group-hover:scale-110">
                            <span className="text-xl font-light text-gray-400 group-hover:text-blue-500">+</span>
                        </div>
                        <span className="text-[10px] font-medium text-gray-400 group-hover:text-blue-500">새 첨부</span>
                    </button>

                    {/* 첨부 목록 */}
                    {attachments.map((item) => (
                        <AttachmentCard
                            key={item.id}
                            item={item}
                            onRemove={onRemove}
                        />
                    ))}

                    {/* 가이드 문구 (목록이 없을 때만) */}
                    {attachments.length === 0 && (
                        <div className="flex items-center ml-4 text-gray-300 pointer-events-none">
                            <span className="text-xs font-medium italic">"Every object tells a story..."</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AttachmentBox;
