import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Octokit } from 'octokit';
import Editor from './pages/Editor';
import OnboardingSetup from './pages/OnboardingSetup';
import LoginPage from './pages/LoginPage';
import CallbackPage from './pages/CallbackPage';
import VerificationPage from './pages/VerificationPage';
import { AuthService } from './services/auth';

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
    Loading Miki...
  </div>
);

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ loading: true, user: null, needsSetup: false });

  useEffect(() => {
    const token = AuthService.getToken();

    if (!token) {
      setAuth({ loading: false, user: null, needsSetup: false });
      return;
    }

    // 사용자 정보 + needsSetup 확인
    Promise.all([
      AuthService.getCurrentUser(),
      checkRepoExists(token, 'miki-data')
    ])
      .then(([user, hasRepo]) => {
        if (user) {
          setAuth({
            loading: false,
            user,
            needsSetup: !hasRepo
          });
        } else {
          setAuth({ loading: false, user: null, needsSetup: false });
        }
      })
      .catch((error) => {
        console.error('Auth check error:', error);
        AuthService.logout();
        setAuth({ loading: false, user: null, needsSetup: false });
      });
  }, []);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
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

function AppContent() {
  const { loading, user, needsSetup } = useAuth();
  const location = useLocation();

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
          <Route path="/editor" element={<Editor />} />
          <Route path="*" element={<Navigate to="/editor" replace />} />
        </>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}