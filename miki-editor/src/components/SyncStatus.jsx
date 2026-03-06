/**
 * SyncStatus.jsx — 동기화 상태 인디케이터
 *
 * P4-T4: SyncManager/PendingSyncProcessor 이벤트 구독 기반 UI
 *
 * 표시 상태:
 *   - offline  : 오프라인 대기 중 (황색)
 *   - syncing  : 동기화 중... (파란색, 대기 건수 포함)
 *   - synced   : 동기화 완료 (녹색)
 *
 * 화면 우하단 고정 배지 형태로 표시되며 사용자 상호작용에 영향을 주지 않습니다.
 */

import React from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';

const STATUS_CONFIG = {
  offline: {
    label: '오프라인 대기 중',
    icon: '⊘',
    dotColor: '#f59e0b',
    bg: '#fffbeb',
    border: '#f59e0b',
    color: '#92400e',
  },
  syncing: {
    label: '동기화 중',
    icon: '↻',
    dotColor: '#3b82f6',
    bg: '#eff6ff',
    border: '#93c5fd',
    color: '#1d4ed8',
  },
  synced: {
    label: '동기화 완료',
    icon: '✓',
    dotColor: '#22c55e',
    bg: '#f0fdf4',
    border: '#86efac',
    color: '#15803d',
  },
};

export function SyncStatus() {
  const { status, pendingCount } = useSyncStatus();
  const cfg = STATUS_CONFIG[status];

  const barStyle = {
    ...styles.bar,
    backgroundColor: cfg.bg,
    border: `1px solid ${cfg.border}`,
    color: cfg.color,
  };

  const dotStyle = {
    ...styles.dot,
    backgroundColor: cfg.dotColor,
  };

  return (
    <div style={barStyle} role="status" aria-live="polite" aria-label={`동기화 상태: ${cfg.label}`}>
      <span style={dotStyle} aria-hidden="true" />
      <span style={styles.icon} aria-hidden="true">{cfg.icon}</span>
      <span style={styles.label}>{cfg.label}</span>
      {status === 'syncing' && pendingCount > 0 && (
        <span style={styles.count} aria-label={`대기 ${pendingCount}건`}>
          {pendingCount}
        </span>
      )}
    </div>
  );
}

const styles = {
  bar: {
    position: 'fixed',
    bottom: '14px',
    right: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 11px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    zIndex: 900,
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    pointerEvents: 'none',
    userSelect: 'none',
    transition: 'background-color 0.25s, border-color 0.25s, color 0.25s',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  icon: {
    fontSize: '13px',
    lineHeight: 1,
  },
  label: {
    lineHeight: 1,
  },
  count: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    fontSize: '10px',
    fontWeight: 700,
    backgroundColor: 'rgba(59,130,246,0.15)',
    color: '#1d4ed8',
  },
};

export default SyncStatus;
