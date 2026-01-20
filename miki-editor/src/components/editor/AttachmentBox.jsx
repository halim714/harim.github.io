import { useState } from 'react';

const AttachmentBox = ({ isCollapsed, onToggle, onAttach }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="relative px-4 mb-4 flex-shrink-0">
            {/* 접기 버튼 (박스 바깥) */}
            <button
                onClick={onToggle}
                className="absolute right-4 -top-1 text-gray-400 hover:text-gray-600 text-sm z-10"
                aria-label={isCollapsed ? '첨부 영역 펼치기' : '첨부 영역 접기'}
            >
                {isCollapsed ? '▼' : '▲'}
            </button>

            {/* 박스 본체 */}
            {!isCollapsed && (
                <button
                    onClick={onAttach}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl 
                     bg-gradient-to-br from-blue-50 to-indigo-50
                     hover:border-blue-400 hover:from-blue-100 hover:to-indigo-100
                     transition-all duration-200 flex flex-col items-center justify-center"
                >
                    <span className="text-gray-400 text-sm mb-3">
                        Here what you see, read, experience, feel
                    </span>
                    <div
                        className={`w-12 h-12 rounded-full bg-blue-500 text-white 
                        flex items-center justify-center text-2xl font-light
                        transition-transform duration-200
                        ${isHovered ? 'scale-110' : 'scale-100'}`}
                    >
                        +
                    </div>
                </button>
            )}
        </div>
    );
};

export default AttachmentBox;
