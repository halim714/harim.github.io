import React, { useState } from 'react';

export default function SetupWizard({ onComplete }) {
  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const verify = async () => {
    try {
      setError('');
      setVerifying(true);
      const res = await fetch('/api/setup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (!res.ok) throw new Error('검증 실패');
      const data = await res.json();
      const save = await fetch('/api/setup/save-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...data })
      });
      if (!save.ok) throw new Error('저장 실패');
      if (onComplete) onComplete();
    } catch (e) {
      setError(e.message || '오류');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow w-full max-w-md">
        <h1 className="text-lg font-semibold mb-3">GitHub 토큰 설정</h1>
        <input
          className="w-full border rounded px-3 py-2 mb-3"
          type="password"
          placeholder="GitHub Personal Access Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <button
          className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-60"
          disabled={!token || verifying}
          onClick={verify}
        >
          {verifying ? '검증 중…' : '저장하고 시작'}
        </button>
      </div>
    </div>
  );
}


