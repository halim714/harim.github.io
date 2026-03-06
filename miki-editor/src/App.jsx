import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Octokit } from 'octokit';
import Editor from './pages/Editor';
import OnboardingSetup from './pages/OnboardingSetup';
import LoginPage from './pages/LoginPage';
import CallbackPage from './pages/CallbackPage';
import VerificationPage from './pages/VerificationPage';
import { AuthService } from './services/auth';
import { ConfirmProvider } from './contexts/ConfirmContext';
import MigrationNotice from './components/MigrationNotice';

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
    Loading Miki...
  </div>
);

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ loading: true, user: null, needsSetup: false });

  // 초기 로드 시 인증 상태 확인
  useEffect(() => {
    refreshAuth();
  }, []);

  // 토큰 저장 후 호출하여 상태 즉시 갱신 (새로고침 없이)
  const refreshAuth = async () => {
    // WS 모드: 토큰은 서버 세션에 있음. 캐시된 사용자로 UI 복원.
    if (import.meta.env.VITE_USE_WS_PROXY === 'true') {
      const user = AuthService.getCachedUser();
      setAuth({ loading: false, user: user || null, needsSetup: false });
      return;
    }

    const token = AuthService.getToken();

    if (!token) {
      setAuth({ loading: false, user: null, needsSetup: false });
      return;
    }

    try {
      const [user, hasRepo] = await Promise.all([
        AuthService.getCurrentUser(),
        checkRepoExists(token, 'miki-data')
      ]);
      if (user) {
        setAuth({ loading: false, user, needsSetup: !hasRepo });
      } else {
        setAuth({ loading: false, user: null, needsSetup: false });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      AuthService.logout();
      setAuth({ loading: false, user: null, needsSetup: false });
    }
  };

  // 온보딩 완료 시 호출
  const completeSetup = () => {
    setAuth(prev => ({ ...prev, needsSetup: false }));
  };

  return (
    <AuthContext.Provider value={{ ...auth, refreshAuth, completeSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

// 저장소 존재 확인 헬퍼
async function checkRepoExists(token, repoName) {
  try {
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    await octokit.rest.repos.get({
      owner: user.login,
      repo: repoName
    });
    return true;
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
}

export const useAuth = () => useContext(AuthContext);

import { dbHelpers } from './utils/database';
import { getPendingSyncProcessor } from './sync';

function AppContent() {
  const { loading, user, needsSetup } = useAuth();
  const location = useLocation();

  // 오프라인 보류 항목 배치 동기화 (로그인 상태에서만 실행)
  useEffect(() => {
    if (!user) return;
    const processor = getPendingSyncProcessor();
    processor.start();
    return () => processor.stop();
  }, [user]);

  // 🛡️ 종료 방지: 미동기화 문서 확인
  useEffect(() => {
    const handleBeforeUnload = async (e) => {
      // 동기화 안 된 문서가 하나라도 있으면 경고
      const count = await dbHelpers.getUnsyncedCount();

      if (count > 0) {
        e.preventDefault();
        e.returnValue = '아직 GitHub에 저장되지 않은 문서가 있습니다. 잠시 후 다시 시도해주세요.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // CallbackPage 최우선 처리
  if (location.pathname === '/callback') {
    return (
      <Routes>
        <Route path="/callback" element={<CallbackPage />} />
      </Routes>
    );
  }

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      {/* 로그인 안 된 사용자 */}
      {!user && (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}

      {/* 로그인 + 설정 필요 */}
      {user && needsSetup && (
        <>
          <Route path="/onboarding" element={<OnboardingSetup />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </>
      )}

      {/* 로그인 + 설정 완료 */}
      {user && !needsSetup && (
        <>
          <Route path="/editor" element={
            <>
              <MigrationNotice />
              <Editor />
            </>
          } />
          <Route path="*" element={<Navigate to="/editor" replace />} />
        </>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ConfirmProvider>
    </BrowserRouter>
  );
}