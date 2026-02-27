/**
 * MigrationNotice.test.jsx — P3-T5 검증
 *
 * Flag OFF/ON 시나리오 및 WS 연결 상태 기반 동작 검증
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MigrationNotice } from '../../components/MigrationNotice';

const TOKEN_KEY = 'github_token';
const DISMISS_KEY = 'meki_migration_dismissed';

describe('MigrationNotice — Flag OFF/ON 시나리오', () => {
  beforeEach(() => {
    localStorage.clear();
    // 기본: Flag OFF
    delete import.meta.env.VITE_USE_WS_PROXY;
  });

  afterEach(() => {
    localStorage.clear();
    delete import.meta.env.VITE_USE_WS_PROXY;
  });

  // ── Flag OFF ─────────────────────────────────────────────────────────────

  describe('Flag OFF (VITE_USE_WS_PROXY !== "true")', () => {
    test('Flag가 없으면 배너를 렌더링하지 않아야 함', async () => {
      localStorage.setItem(TOKEN_KEY, 'ghp_testtoken');

      await act(async () => {
        render(<MigrationNotice />);
      });

      expect(screen.queryByRole('alert')).toBeNull();
    });

    test('Flag가 "false"이면 배너를 렌더링하지 않아야 함', async () => {
      import.meta.env.VITE_USE_WS_PROXY = 'false';
      localStorage.setItem(TOKEN_KEY, 'ghp_testtoken');

      await act(async () => {
        render(<MigrationNotice />);
      });

      expect(screen.queryByRole('alert')).toBeNull();
    });

    test('Flag가 없고 토큰도 없으면 배너를 렌더링하지 않아야 함', async () => {
      await act(async () => {
        render(<MigrationNotice />);
      });

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  // ── Flag ON ──────────────────────────────────────────────────────────────

  describe('Flag ON (VITE_USE_WS_PROXY === "true")', () => {
    beforeEach(() => {
      import.meta.env.VITE_USE_WS_PROXY = 'true';
    });

    test('Flag ON + 기존 토큰 존재 → 배너가 표시되어야 함', async () => {
      localStorage.setItem(TOKEN_KEY, 'ghp_testtoken');

      await act(async () => {
        render(<MigrationNotice />);
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('인증 방식이 업그레이드되었습니다')).toBeInTheDocument();
    });

    test('Flag ON + 토큰 없음 → 배너가 표시되지 않아야 함', async () => {
      // localStorage에 토큰 없음

      await act(async () => {
        render(<MigrationNotice />);
      });

      expect(screen.queryByRole('alert')).toBeNull();
    });

    test('Flag ON + dismiss됨 → 배너가 표시되지 않아야 함', async () => {
      localStorage.setItem(TOKEN_KEY, 'ghp_testtoken');
      localStorage.setItem(DISMISS_KEY, '1');

      await act(async () => {
        render(<MigrationNotice />);
      });

      expect(screen.queryByRole('alert')).toBeNull();
    });

    test('닫기(✕) 버튼 클릭 시 배너가 사라지고 dismiss가 영속화되어야 함', async () => {
      localStorage.setItem(TOKEN_KEY, 'ghp_testtoken');

      await act(async () => {
        render(<MigrationNotice />);
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();

      const dismissBtn = screen.getByLabelText('안내 닫기');
      await act(async () => {
        fireEvent.click(dismissBtn);
      });

      expect(screen.queryByRole('alert')).toBeNull();
      expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
    });

    test('재로그인 버튼 클릭 시 토큰이 삭제되고 dismiss가 영속화되어야 함', async () => {
      localStorage.setItem(TOKEN_KEY, 'ghp_testtoken');

      // window.location.href 변경을 방지
      delete window.location;
      window.location = { href: '/' };

      await act(async () => {
        render(<MigrationNotice />);
      });

      const reloginBtn = screen.getByText('재로그인');
      await act(async () => {
        fireEvent.click(reloginBtn);
      });

      expect(screen.queryByRole('alert')).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
      expect(window.location.href).toBe('/login');
    });

    test('onRelogin 콜백이 제공되면 재로그인 버튼 클릭 시 호출되어야 함', async () => {
      localStorage.setItem(TOKEN_KEY, 'ghp_testtoken');
      const mockOnRelogin = jest.fn();

      delete window.location;
      window.location = { href: '/' };

      await act(async () => {
        render(<MigrationNotice onRelogin={mockOnRelogin} />);
      });

      const reloginBtn = screen.getByText('재로그인');
      await act(async () => {
        fireEvent.click(reloginBtn);
      });

      expect(mockOnRelogin).toHaveBeenCalledTimes(1);
    });
  });
});

// ── WsClient 기본 동작 검증 ────────────────────────────────────────────────

describe('WsClient — Flag 기반 WS 연결 상태 검증', () => {
  let originalWebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
  });

  test('VITE_USE_WS_PROXY OFF 시 WsClient가 import되지 않으면 WS 연결 시도 없어야 함', () => {
    // Flag OFF 상태에서는 ws-client를 사용하지 않으므로 WebSocket 호출 없음
    const wsConnectSpy = jest.fn();
    global.WebSocket = jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn(),
      readyState: 1,
      send: jest.fn(),
      close: jest.fn(),
    }));

    // MigrationNotice만 렌더링 (ws-client import 없음)
    delete import.meta.env.VITE_USE_WS_PROXY;
    render(<MigrationNotice />);

    // ws-client.js는 MigrationNotice에서 사용하지 않으므로 WebSocket 호출 없어야 함
    expect(global.WebSocket).not.toHaveBeenCalled();
  });

  test('WsClient 클래스가 singleton 패턴으로 작동해야 함', async () => {
    // WsClient를 직접 테스트 (ws-proxy 없이 mock)
    global.WebSocket = jest.fn().mockImplementation((url) => {
      const ws = {
        _url: url,
        readyState: WebSocket.CONNECTING || 0,
        addEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
      };
      return ws;
    });
    global.WebSocket.OPEN = 1;
    global.WebSocket.CONNECTING = 0;

    const { getWsClient, WsClient } = await import('../../services/ws-client');

    // 같은 인스턴스를 반환해야 함 (singleton)
    const client1 = getWsClient();
    const client2 = getWsClient();
    expect(client1).toBe(client2);
    expect(client1).toBeInstanceOf(WsClient);

    client1.close();
  });

  test('WsClient.isConnected는 연결 상태를 정확히 반영해야 함', async () => {
    let mockWs;
    global.WebSocket = jest.fn().mockImplementation((url) => {
      mockWs = {
        readyState: 0, // CONNECTING
        addEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
      };
      return mockWs;
    });
    global.WebSocket.OPEN = 1;
    global.WebSocket.CONNECTING = 0;

    // 모듈 캐시 클리어 (singleton 재초기화)
    jest.resetModules();
    const { WsClient } = await import('../../services/ws-client');
    const client = new WsClient('ws://localhost:8080');

    // 아직 연결 안됨
    expect(client.isConnected).toBe(false);

    client.close();
  });
});
