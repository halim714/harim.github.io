/**
 * MigrationNotice.jsx — WS Proxy 마이그레이션 안내 배너
 *
 * Phase 3-T4: Frontend Migration
 *
 * VITE_USE_WS_PROXY=true 환경에서 기존 localStorage 기반 인증 토큰을
 * 보유한 사용자에게 재로그인을 유도하는 배너 컴포넌트.
 *
 * 표시 조건:
 *   - import.meta.env.VITE_USE_WS_PROXY === 'true'
 *   - localStorage에 기존 'github_token'이 존재
 *   - 사용자가 배너를 아직 닫지 않음 (meki_migration_dismissed 키 기준)
 */

import React, { useState, useEffect } from 'react';
import { AuthService } from '../services/auth';

const DISMISS_KEY = 'meki_migration_dismissed';

/**
 * WS Proxy 마이그레이션 안내 배너
 *
 * @param {Object} props
 * @param {Function} [props.onRelogin] - 재로그인 버튼 클릭 시 추가 콜백 (선택)
 */
export function MigrationNotice({ onRelogin }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Feature flag가 꺼져 있으면 표시하지 않음
    if (import.meta.env.VITE_USE_WS_PROXY !== 'true') return;

    // 이미 안내를 확인한 사용자
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    // 기존 직접 인증 토큰이 있는 경우에만 마이그레이션 안내 필요
    const hasLegacyToken = Boolean(AuthService.getToken());
    if (hasLegacyToken) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const handleRelogin = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    AuthService.logout();
    onRelogin?.();
    window.location.href = '/login';
  };

  if (!visible) return null;

  return (
    <div style={styles.banner} role="alert" aria-live="polite">
      <div style={styles.inner}>
        <span style={styles.icon} aria-hidden="true">🔄</span>
        <div style={styles.textBlock}>
          <strong style={styles.title}>인증 방식이 업그레이드되었습니다</strong>
          <span style={styles.body}>
            {' '}보안 강화를 위해 WS Proxy 기반 인증으로 전환되었습니다.
            기존 세션은 더 이상 유효하지 않으므로 재로그인이 필요합니다.
          </span>
        </div>
        <div style={styles.actions}>
          <button
            onClick={handleRelogin}
            style={styles.reloginBtn}
            type="button"
          >
            재로그인
          </button>
          <button
            onClick={handleDismiss}
            style={styles.dismissBtn}
            type="button"
            aria-label="안내 닫기"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  banner: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    backgroundColor: '#fffbeb',
    borderBottom: '1px solid #f59e0b',
    boxShadow: '0 1px 4px rgba(245, 158, 11, 0.2)',
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    maxWidth: '1200px',
    margin: '0 auto',
    flexWrap: 'wrap',
  },
  icon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    fontSize: '14px',
    color: '#92400e',
    minWidth: '200px',
  },
  title: {
    fontWeight: 600,
  },
  body: {
    fontWeight: 400,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  reloginBtn: {
    padding: '5px 14px',
    backgroundColor: '#f59e0b',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  dismissBtn: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#b45309',
    border: '1px solid #f59e0b',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    lineHeight: 1,
  },
};

export default MigrationNotice;
