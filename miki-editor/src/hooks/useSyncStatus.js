import { useState, useEffect, useRef } from 'react';
import { PendingSync } from '../utils/database';

const POLL_INTERVAL = 5000;

/**
 * useSyncStatus — 동기화 상태 훅
 *
 * window online/offline 이벤트와 PendingSync 테이블 폴링을 통해
 * 현재 동기화 상태를 반환합니다.
 *
 * @returns {{ isOnline: boolean, pendingCount: number, status: 'offline'|'syncing'|'synced' }}
 */
export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const pollPending = async () => {
      try {
        const items = await PendingSync.getPending();
        setPendingCount(items.length);
      } catch {
        // DB가 초기화되기 전이거나 접근 불가 시 무시
      }
    };

    pollPending();
    pollRef.current = setInterval(pollPending, POLL_INTERVAL);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pollRef.current);
    };
  }, []);

  let status;
  if (!isOnline) {
    status = 'offline';
  } else if (pendingCount > 0) {
    status = 'syncing';
  } else {
    status = 'synced';
  }

  return { isOnline, pendingCount, status };
}

export default useSyncStatus;
