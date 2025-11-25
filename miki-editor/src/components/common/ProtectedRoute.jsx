import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../App'; // App.jsx에서 export한 useAuth 훅 사용

export default function ProtectedRoute({ children }) {
  const { user, needsSetup } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsSetup) {
    return <Navigate to="/onboarding/choice" replace />;
  }

  return children;
}