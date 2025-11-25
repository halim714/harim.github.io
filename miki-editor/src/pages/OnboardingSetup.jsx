import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { AuthService } from '../services/auth';
import { GitHubService } from '../services/github';

export default function OnboardingSetup() {
    const [status, setStatus] = useState('initializing');
    const [message, setMessage] = useState('Preparing setup...');
    const [details, setDetails] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        startSetup();
    }, []);

    const startSetup = async (useExisting = false) => {
        setStatus('processing');
        setMessage(useExisting ? 'Connecting to existing repositories...' : 'Setting up your Miki wiki...');

        try {
            // ✅ GitHubService 직접 사용 (서버 API 호출 대신)
            const token = AuthService.getToken();
            const github = new GitHubService(token);

            const result = await github.initialize({ useExisting });

            if (result.success) {
                setStatus('success');
                setMessage('Setup complete! 🎉');
                setDetails(result);
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            } else {
                setStatus('error');
                setMessage('Setup encountered an issue.');
                setDetails(result);
            }
        } catch (error) {
            console.error('Setup error:', error);
            setStatus('error');
            setMessage('Setup failed.');
            setDetails({ error: error.message });
        }
    };

    const handleGoToEditor = () => {
        window.location.href = '/editor';
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Setting up Miki
                    </h1>
                    <p className="text-gray-400">Creating your personal wiki environment</p>
                </div>

                <div className="flex flex-col items-center justify-center space-y-6">
                    {status === 'processing' && (
                        <>
                            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                            <p className="text-lg animate-pulse">{message}</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <CheckCircle className="w-16 h-16 text-green-500" />
                            <div className="text-center">
                                <p className="text-xl font-semibold text-green-400 mb-2">{message}</p>
                                {details && (
                                    <div className="text-sm text-gray-400 bg-gray-900/50 p-4 rounded-lg mt-4 text-left">
                                        <p>📦 Data Repo: {details.dataRepo}</p>
                                        <p>🌐 Blog Repo: {details.pagesRepo}</p>
                                        <p>⏱️ Deploy Time: {details.estimatedDeployTime}</p>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleGoToEditor}
                                className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                            >
                                Start Writing <ArrowRight className="w-4 h-4" />
                            </button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <XCircle className="w-16 h-16 text-red-500" />
                            <div className="text-center">
                                <p className="text-xl font-semibold text-red-400 mb-2">{message}</p>
                                {details?.error && (
                                    <p className="text-sm text-gray-400 mt-2 bg-gray-900/50 p-2 rounded">
                                        Error: {details.error}
                                    </p>
                                )}
                                {details?.conflicts && (
                                    <div className="mt-4 text-left bg-yellow-900/20 p-4 rounded-lg border border-yellow-700/50">
                                        <p className="text-yellow-400 text-sm mb-2">Repositories already exist:</p>
                                        <ul className="list-disc list-inside text-xs text-yellow-200/80 mb-4">
                                            {details.conflicts.dataRepoExists && <li>miki-data</li>}
                                            {details.conflicts.pagesRepoExists && <li>github.io page</li>}
                                        </ul>
                                        <button
                                            onClick={() => startSetup(true)}
                                            className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm font-medium transition-colors"
                                        >
                                            Connect to Existing Repos
                                        </button>
                                    </div>
                                )}
                            </div>
                            {!details?.conflicts && (
                                <button
                                    onClick={() => startSetup(false)}
                                    className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                >
                                    Try Again
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
