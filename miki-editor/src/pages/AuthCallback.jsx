import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const [status, setStatus] = useState('Processing authentication...');
  const [error, setError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code');
    let timer; // setTimeout을 위한 변수 선언

    if (!code) {
      setError('Authorization code not found');
      timer = setTimeout(() => navigate('/login'), 3000); // ✅ Cleanup
      return () => clearTimeout(timer); // ✅ Cleanup 함수 반환
    }

    fetch(`/api/auth/github/callback?code=${code}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' } // ✅ JSON 응답을 기대
    })
      .then(res => res.json()) // ✅ JSON 파싱
      .then(data => {
        if (data.success) {
          setStatus('Authentication successful! Redirecting...');
          timer = setTimeout(() => { // ✅ setTimeout 변수에 할당
            window.location.href = '/'; // ✅ Full reload
          }, 500);
          // ✅ 성공 시에도 cleanup을 위해 timer 반환
          return () => clearTimeout(timer);
        } else {
          throw new Error(data.error || 'Authentication failed');
        }
      })
      .catch(err => {
        console.error('Auth callback error:', err);
        setError(err.message || 'An unknown error occurred');
        timer = setTimeout(() => navigate('/login'), 3000); // ✅ setTimeout 변수에 할당
        // ✅ 에러 시에도 cleanup을 위해 timer 반환
        return () => clearTimeout(timer);
      });

    // useEffect의 return 함수에서 모든 타이머를 정리
    return () => {
      if (timer) clearTimeout(timer);
    };

  }, [location, navigate]);

  // ✅ 개선된 UI
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb'
    }}>
      {error ? (
        <>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚠️</div>
          <h2 style={{ color: '#dc2626', marginBottom: '8px' }}>
            Authentication Error
          </h2>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>{error}</p>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '16px' }}>
            Redirecting to login...
          </p>
        </>
      ) : (
        <>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔄</div>
          <p style={{ fontSize: '18px', color: '#374151' }}>{status}</p>
        </>
      )}
    </div>
  );
}