import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthService } from '../services/auth';
import { useAuth } from '../App';

export default function CallbackPage() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('processing');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const auth = useAuth();
    const isProcessing = useRef(false);

    useEffect(() => {
        if (isProcessing.current) return; // 중복 실행 방지
        isProcessing.current = true;

        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code) {
            setError('No authorization code received');
            setStatus('error');
            return;
        }

        // CSRF Protection: Validate state parameter
        const storedState = sessionStorage.getItem('oauth_state');
        if (!state || state !== storedState) {
            setError('Invalid state parameter - possible CSRF attack');
            setStatus('error');
            sessionStorage.removeItem('oauth_state');
            sessionStorage.removeItem('pkce_code_verifier');
            return;
        }

        // PKCE: Retrieve code_verifier
        const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
        if (!codeVerifier) {
            setError('Missing PKCE code_verifier');
            setStatus('error');
            return;
        }

        // Clear session storage
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('pkce_code_verifier');

        // Vercel Function URL (Relative path works for both Dev and Prod)
        const apiUrl = '/api/auth/callback';

        fetch(`${apiUrl}?code=${code}&code_verifier=${encodeURIComponent(codeVerifier)}&state=${encodeURIComponent(state)}`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                return res.json();
            })
            .then(async data => {
                if (data.token) {
                    if (AuthService.isWsMode()) {
                        // WS 모드: localStorage에 저장 안 하고 ws-proxy에 세션 생성 → HttpOnly 쿠키 수신
                        const wsProxyUrl = import.meta.env.VITE_WS_PROXY_URL || 'ws://localhost:8080';
                        const httpProxyUrl = wsProxyUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
                        const sessionRes = await fetch(`${httpProxyUrl}/api/session`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token: data.token }),
                            credentials: 'include', // HttpOnly 쿠키 수신
                        });
                        if (!sessionRes.ok) {
                            const errData = await sessionRes.json().catch(() => ({}));
                            throw new Error(errData.error || `Session creation failed: ${sessionRes.status}`);
                        }
                        const sessionData = await sessionRes.json();
                        // P6.1: Store session token in localStorage for WS auth
                        if (sessionData.sessionToken) {
                            localStorage.setItem('meki_session', sessionData.sessionToken);
                        }
                        // 사용자 정보 캐시 (getCachedUser()가 읽을 수 있도록)
                        if (sessionData.user) {
                            const user = {
                                id: sessionData.user.id,
                                username: sessionData.user.login,
                                name: sessionData.user.login,
                                avatar: sessionData.user.avatar_url,
                            };
                            localStorage.setItem(AuthService.USER_KEY, JSON.stringify(user));
                        }
                    } else {
                        // 일반 모드: localStorage에 토큰 저장
                        AuthService.saveToken(data.token);
                    }

                    // AuthProvider 상태 즉시 갱신 (새로고침 없이)
                    if (auth?.refreshAuth) {
                        await auth.refreshAuth();
                    }

                    setStatus('success');

                    // 1초 후 메인 페이지로 이동
                    setTimeout(() => navigate('/'), 1000);
                } else {
                    setError(data.error || 'Failed to authenticate');
                    setStatus('error');
                }
            })
            .catch(err => {
                console.error('Callback error:', err);
                setError(err.message);
                setStatus('error');
            });
    }, [searchParams, navigate]); // auth 의존성 제거

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '48px',
                maxWidth: '400px',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
            }}>
                {status === 'processing' && (
                    <div>
                        <div style={{ fontSize: '64px', marginBottom: '24px', animation: 'spin 1s linear infinite' }}>
                            🔄
                        </div>
                        <p style={{ fontSize: '20px', color: '#374151' }}>
                            Processing authentication...
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div>
                        <div style={{ fontSize: '64px', marginBottom: '24px' }}>✅</div>
                        <p style={{ fontSize: '20px', color: '#48bb78', fontWeight: '600' }}>
                            Success!
                        </p>
                        <p style={{ color: '#718096', marginTop: '8px' }}>
                            Redirecting...
                        </p>
                    </div>
                )}

                {status === 'error' && (
                    <div>
                        <div style={{ fontSize: '64px', marginBottom: '24px' }}>❌</div>
                        <p style={{ fontSize: '20px', color: '#f56565', marginBottom: '16px' }}>
                            Authentication Failed
                        </p>
                        <p style={{ color: '#718096', fontSize: '14px', marginBottom: '24px' }}>
                            {error}
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#667eea',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '600'
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
