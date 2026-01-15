import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Loader2, CheckCircle, XCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { AuthService } from '../services/auth';
import { GitHubService } from '../services/github';
import { useAuth } from '../App';

export default function OnboardingSetup() {
    const [status, setStatus] = useState('initializing'); // 'initializing' | 'processing' | 'success' | 'error' | 'conflict'
    const [message, setMessage] = useState('준비 중...');
    const [details, setDetails] = useState(null);
    const [progress, setProgress] = useState(0);
    const navigate = useNavigate();
    const { completeSetup } = useAuth();

    useEffect(() => {
        startSetup();
    }, []);

    const startSetup = async (useExisting = false) => {
        setStatus('processing');
        setProgress(10);

        try {
            const token = AuthService.getToken();
            if (!token) {
                throw new Error('로그인이 필요합니다.');
            }

            const github = new GitHubService(token);

            // Step 1: 사용자 이름 설정
            setMessage('사용자 정보 확인 중...');
            setProgress(20);
            await github.setUsername();

            // Step 2: 충돌 확인
            setMessage('기존 저장소 확인 중...');
            setProgress(30);
            const conflicts = await github.checkConflicts();

            if (conflicts.hasConflicts && !useExisting) {
                setStatus('conflict');
                setMessage('기존 저장소가 발견되었습니다.');
                setDetails(conflicts);
                return;
            }

            // Step 3: 저장소 생성
            setMessage(useExisting ? '기존 저장소 연결 중...' : '저장소 생성 중...');
            setProgress(50);
            const result = await github.initialize({ useExisting });

            if (result.success) {
                setProgress(100);
                setStatus('success');
                setMessage('설정 완료! 🎉');
                setDetails(result);
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                // 사용자가 직접 "에디터로 이동" 버튼 클릭해야 함
            } else {
                setStatus('error');
                setMessage('설정 중 문제가 발생했습니다.');
                setDetails(result);
            }
        } catch (error) {
            console.error('Setup error:', error);
            setStatus('error');
            setMessage('설정 실패');
            setDetails({ error: error.message });
        }
    };

    const handleGoToEditor = () => {
        completeSetup();
        navigate('/editor');
    };

    const handleUseExisting = () => {
        startSetup(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full shadow-2xl border border-white/20">

                {/* 헤더 */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2">Miki 설정</h1>
                    <p className="text-gray-300">당신의 개인 위키를 준비하고 있습니다</p>
                </div>

                {/* 진행 바 */}
                {status === 'processing' && (
                    <div className="mb-8">
                        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* 상태 표시 */}
                <div className="text-center mb-8">
                    {status === 'initializing' && (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-16 h-16 animate-spin text-blue-400" />
                            <p className="text-xl">{message}</p>
                        </div>
                    )}

                    {status === 'processing' && (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-16 h-16 animate-spin text-blue-400" />
                            <p className="text-xl">{message}</p>
                            <p className="text-sm text-gray-400">잠시만 기다려주세요...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center gap-4">
                            <CheckCircle className="w-16 h-16 text-green-400" />
                            <p className="text-2xl font-bold">{message}</p>
                            {details && (
                                <div className="bg-white/5 rounded-lg p-6 text-left w-full mt-4">
                                    <h3 className="font-bold text-lg mb-3">생성된 저장소</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">프라이빗 저장소:</span>
                                            <span className="font-mono text-green-400">{details.dataRepo}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">퍼블릭 블로그:</span>
                                            <span className="font-mono text-blue-400">{details.pagesRepo}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">블로그 URL:</span>
                                            <a
                                                href={details.pagesUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-purple-400 hover:underline"
                                            >
                                                {details.pagesUrl}
                                            </a>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-4">
                                            ⏱️ 배포 예상 시간: {details.estimatedDeployTime}
                                        </p>
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={handleGoToEditor}
                                className="mt-6 px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-bold text-lg hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                            >
                                에디터로 이동 <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {status === 'conflict' && (
                        <div className="flex flex-col items-center gap-4">
                            <AlertCircle className="w-16 h-16 text-yellow-400" />
                            <p className="text-2xl font-bold">{message}</p>
                            {details && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 text-left w-full mt-4">
                                    <h3 className="font-bold text-lg mb-3 text-yellow-400">기존 저장소 발견</h3>
                                    <div className="space-y-2 text-sm">
                                        {details.dataRepoExists && (
                                            <p>• <span className="font-mono">miki-data</span> 저장소가 이미 존재합니다</p>
                                        )}
                                        {details.pagesRepoExists && (
                                            <p>• <span className="font-mono">{details.suggestions.pagesRepo}</span> 저장소가 이미 존재합니다</p>
                                        )}
                                    </div>
                                    <div className="mt-6 flex gap-3">
                                        <button
                                            onClick={handleUseExisting}
                                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
                                        >
                                            기존 저장소 사용
                                        </button>
                                        <button
                                            onClick={() => navigate('/login')}
                                            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
                                        >
                                            취소
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center gap-4">
                            <XCircle className="w-16 h-16 text-red-400" />
                            <p className="text-2xl font-bold">{message}</p>
                            {details && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-left w-full mt-4">
                                    <p className="text-sm text-red-300">{details.error || '알 수 없는 오류'}</p>
                                </div>
                            )}
                            <button
                                onClick={() => startSetup(false)}
                                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                            >
                                다시 시도
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
