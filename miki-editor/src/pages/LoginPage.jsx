import React from 'react';
import { Github } from 'lucide-react';
import '../index.css';

export default function LoginPage() {
    const handleLogin = () => {
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        const redirectUri = `${window.location.origin}/callback`;

        // GitHub OAuth Web Flow
        window.location.href =
            `https://github.com/login/oauth/authorize?` +
            `client_id=${clientId}&` +
            `redirect_uri=${redirectUri}&` +
            `scope=repo user`;
    };

    return (
        <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-black selection:bg-blue-500 selection:text-white">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] rounded-full bg-indigo-500/10 blur-[80px] animate-pulse delay-700" />
            </div>

            {/* Glass Card */}
            <div className="relative z-10 w-full max-w-md p-1">
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-white/5 rounded-2xl blur-sm" />
                <div className="relative p-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">

                    {/* Logo / Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
                            <span className="text-3xl">✨</span>
                        </div>
                        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white/80 tracking-tight">
                            Miki Editor
                        </h1>
                        <p className="mt-3 text-gray-400 text-sm font-medium tracking-wide uppercase opacity-80">
                            Your Personal AI Knowledge Base
                        </p>
                    </div>

                    {/* Action Area */}
                    <div className="space-y-6">
                        <button
                            onClick={handleLogin}
                            className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-black font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-[0.98]"
                        >
                            <Github className="w-5 h-5 transition-transform group-hover:scale-110" />
                            <span>Continue with GitHub</span>
                            <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 group-hover:ring-white/40 transition-all" />
                        </button>

                        <div className="flex items-center gap-4 text-xs text-gray-500 justify-center">
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <span>Secure Access</span>
                            </div>
                            <div className="w-1 h-1 rounded-full bg-gray-700" />
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span>Private Data</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-10 pt-6 border-t border-white/5 text-center">
                        <p className="text-[10px] text-gray-600">
                            By continuing, you agree to our Terms of Service and Privacy Policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
