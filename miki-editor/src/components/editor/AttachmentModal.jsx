import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Sparkles, AlertCircle, X, Loader2 } from 'lucide-react';
import { SessionExpiredError } from '../../services/github';

export default function AttachmentModal({ isOpen, onClose, onAttach }) {
    const [tier, setTier] = useState('BASE');
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await handleUpload(file);
        }
    };

    const handleUpload = async (file) => {
        setIsProcessing(true);
        try {
            await onAttach(file, tier);
            onClose();
        } catch (error) {
            console.error('첨부 실패:', error);
            if (error instanceof SessionExpiredError) {
                if (window.confirm('무제한 이미지 업로드를 위해 GitHub 로그인이 필요합니다. 이동하시겠습니까?')) {
                    window.open('https://github.com/login', '_blank');
                }
            } else {
                alert('첨부 실패: ' + error.message);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/20">
                {/* 닫기 버튼 */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={isProcessing}
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-8">
                    <header className="mb-8 text-center">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                            지능형 첨부 분석
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            AI가 파일의 내용을 파악하여 알아서 정리해줍니다.
                        </p>
                    </header>

                    {/* 모델 티어 선택 (Cursor AI 컨셉) */}
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-8">
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
                                ? 'border-blue-500 bg-blue-50/50'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50/50'}
              ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const file = e.dataTransfer.files[0];
                            if (file) handleUpload(file);
                        }}
                    >
                        <input
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={isProcessing}
                        />

                        {isProcessing ? (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                                <div className="text-center">
                                    <p className="font-bold text-gray-700">AI 분석 시작됨</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        창을 닫으셔도 백그라운드에서 분석이 계속됩니다.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-gray-700 dark:text-gray-200">
                                        파일을 드래그하거나 클릭
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        이미지, PDF, 문서 등 모든 데이터
                                    </p>
                                </div>
                            </div>
                        )}
                    </label>

                    <footer className="mt-8 flex items-center gap-2 text-[10px] text-gray-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>고성능 모델(Premium) 사용 시 토큰 비용이 추가될 수 있습니다.</span>
                    </footer>
                </div>
            </div>
        </div>,
        document.body
    );
}
