/**
 * SyncStatus.test.jsx — P4-T4 UI 컴포넌트 검증
 *
 * useSyncStatus 훅을 모킹하여 각 상태(offline/syncing/synced)의
 * 렌더링을 검증합니다.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SyncStatus } from '../../components/SyncStatus';

// useSyncStatus 훅 모킹
jest.mock('../../hooks/useSyncStatus', () => ({
  useSyncStatus: jest.fn(),
}));

import { useSyncStatus } from '../../hooks/useSyncStatus';

describe('SyncStatus 컴포넌트', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('status=synced 일 때 "동기화 완료" 텍스트와 role=status가 렌더링되어야 함', () => {
    useSyncStatus.mockReturnValue({ isOnline: true, pendingCount: 0, status: 'synced' });

    render(<SyncStatus />);

    const bar = screen.getByRole('status');
    expect(bar).toBeInTheDocument();
    expect(screen.getByText('동기화 완료')).toBeInTheDocument();
  });

  test('status=offline 일 때 "오프라인 대기 중" 텍스트가 표시되어야 함', () => {
    useSyncStatus.mockReturnValue({ isOnline: false, pendingCount: 2, status: 'offline' });

    render(<SyncStatus />);

    expect(screen.getByText('오프라인 대기 중')).toBeInTheDocument();
  });

  test('status=syncing 일 때 "동기화 중" 텍스트와 대기 건수가 표시되어야 함', () => {
    useSyncStatus.mockReturnValue({ isOnline: true, pendingCount: 3, status: 'syncing' });

    render(<SyncStatus />);

    expect(screen.getByText('동기화 중')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText('대기 3건')).toBeInTheDocument();
  });

  test('status=syncing + pendingCount=0 이면 건수 배지가 표시되지 않아야 함', () => {
    useSyncStatus.mockReturnValue({ isOnline: true, pendingCount: 0, status: 'syncing' });

    render(<SyncStatus />);

    expect(screen.queryByLabelText(/대기/)).toBeNull();
  });

  test('aria-label이 현재 상태를 포함해야 함', () => {
    useSyncStatus.mockReturnValue({ isOnline: false, pendingCount: 0, status: 'offline' });

    render(<SyncStatus />);

    expect(screen.getByLabelText('동기화 상태: 오프라인 대기 중')).toBeInTheDocument();
  });
});
