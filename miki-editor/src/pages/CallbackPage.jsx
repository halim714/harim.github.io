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

        if (!code) {
            setError('No authorization code received');
            setStatus('error');
            return;
        }

        // Vercel Function URL (Relative path works for both Dev and Prod)
        const apiUrl = '/api/auth/callback';

        fetch(`${apiUrl}?code=${code}`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                return res.json();
            })
            .then(async data => {
                if (data.token) {
                    // localStorage에 토큰 저장
                    AuthService.saveToken(data.token);

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
