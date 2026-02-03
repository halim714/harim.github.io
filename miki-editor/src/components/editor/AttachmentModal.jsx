import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Sparkles, AlertCircle, X, Loader2, FileType } from 'lucide-react';
import { SessionExpiredError } from '../../services/github';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (GitHub Issues CDN limit)

const SUPPORTED_FORMATS = {
    images: ['JPG', 'PNG', 'GIF', 'WebP', 'SVG'],
    documents: ['PDF', 'TXT', 'MD'],
    media: ['MP4', 'MP3', 'WAV']
};

export default function AttachmentModal({ isOpen, onClose, onAttach }) {
    const [tier, setTier] = useState('BASE');
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    // 모달 열릴 때 초기화
    useEffect(() => {
        if (isOpen) {
            setIsProcessing(false);
            setError(null);
            setSelectedFile(null);
            setTier('BASE');
        }
    }, [isOpen]);

    const validateFile = (file) => {
        // 파일 크기 체크
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 지원됩니다.`);
        }
        return true;
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                validateFile(file);
                setSelectedFile(file);
                await handleUpload(file);
            } catch (err) {
                setError(err.message);
            }
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            try {
                validateFile(file);
                setSelectedFile(file);
                handleUpload(file);
            } catch (err) {
                setError(err.message);
            }
        }
    };

    const handleUpload = async (file) => {
        setIsProcessing(true);
        setError(null);

        try {
            await onAttach(file, tier);
            // 성공 시 잠시 대기 후 닫기
            await new Promise(resolve => setTimeout(resolve, 500));
            onClose();
        } catch (error) {
            console.error('첨부 실패:', error);
            setIsProcessing(false);

            if (error instanceof SessionExpiredError) {
                if (window.confirm('무제한 이미지 업로드를 위해 GitHub 로그인이 필요합니다. 이동하시겠습니까?')) {
                    window.open('https://github.com/login', '_blank');
                }
            } else {
                setError(error.message || '첨부 실패: 알 수 없는 오류');
            }
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={isProcessing ? null : onClose} />

            <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/20">
                {/* 닫기 버튼 */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                    disabled={isProcessing}
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-8">
                    <header className="mb-8 text-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4">
                            <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                            지능형 첨부 분석
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            AI가 파일의 내용을 파악하여 알아서 정리해줍니다.
                        </p>
                    </header>

                    {/* 모델 티어 선택 (Cursor AI 컨셉) */}
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-6">
                        <button
                            onClick={() => setTier('BASE')}
                            disabled={isProcessing}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2
                ${tier === 'BASE'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Sparkles className="w-4 h-4" /> Standard (Qwen)
                        </button>
                        <button
                            onClick={() => setTier('PREMIUM')}
                            disabled={isProcessing}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2
                ${tier === 'PREMIUM'
                                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                                    : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Sparkles className="w-4 h-4 fill-current" /> Premium (Claude)
                        </button>
                    </div>

                    {/* 업로드 영역 */}
                    <label
                        className={`group relative flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-3xl cursor-pointer transition-all
              ${isDragging
                                ? 'border-blue-500 bg-blue-50/50 scale-[1.02]'
                                : error
                                    ? 'border-red-300 bg-red-50/30'
                                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50/50'}
              ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={isProcessing}
                            accept="image/*,application/pdf,.txt,.md,.mp4,.mp3,.wav"
                        />

                        {isProcessing ? (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                                <div className="text-center">
                                    <p className="font-bold text-gray-700">AI 분석 시작됨</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        창을 닫으셔도 백그라운드에서 분석이 계속됩니다.
                                    </p>
                                    {selectedFile && (
                                        <p className="text-xs text-gray-500 mt-2 font-mono">
                                            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center gap-4 text-red-500">
                                <AlertCircle className="w-12 h-12" />
                                <div className="text-center px-4">
                                    <p className="font-bold">업로드 실패</p>
                                    <p className="text-sm text-gray-600 mt-2">{error}</p>
                                    <button
                                        onClick={(e) => { e.preventDefault(); setError(null); }}
                                        className="mt-4 px-4 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                                    >
                                        다시 시도
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all
                  ${isDragging
                                        ? 'bg-blue-500 text-white scale-110'
                                        : 'bg-blue-50 text-blue-500 group-hover:scale-110'}`}>
                                    <Upload className="w-8 h-8" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-gray-700 dark:text-gray-200">
                                        파일을 드래그하거나 클릭
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        최대 10MB • 이미지, PDF, 문서, 미디어
                                    </p>
                                </div>
                            </div>
                        )}
                    </label>

                    {/* 지원 형식 안내 */}
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div className="flex items-start gap-2">
                            <FileType className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                <p className="font-semibold mb-1">지원 형식</p>
                                <div className="flex flex-wrap gap-1">
                                    {Object.values(SUPPORTED_FORMATS).flat().map(format => (
                                        <span key={format} className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded text-[10px] font-mono">
                                            {format}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <footer className="mt-6 flex items-center gap-2 text-[10px] text-gray-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>고성능 모델(Premium) 사용 시 토큰 비용이 추가될 수 있습니다.</span>
                    </footer>
                </div>
            </div>
        </div>,
        document.body
    );
}
