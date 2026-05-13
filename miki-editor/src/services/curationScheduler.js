/**
 * curationScheduler — 사용자 지정 시간에 큐레이션 세션 리마인더
 *
 * 메커니즘:
 *   1. 사용자가 설정 시간(기본 21:00)을 localStorage에 저장
 *   2. start() 호출 시 1분마다 현재 시각 vs 설정 시각 비교
 *   3. 정각 도달 + 오늘 미알림 + pending 메모 존재 → Notification 발송
 *   4. 사용자가 알림 클릭 → /curation 진입
 *
 * 데이터 주권: 알림은 100% 브라우저 로컬. 외부 서버 트리거 없음.
 */

import { RawMemoCache } from '../utils/database';
import { requestPermission, getPermissionStatus, showPersistentNotification } from './notify';

const STORAGE_KEY = 'meki_curation_schedule';
const LAST_NOTIFIED_KEY = 'meki_curation_last_notified';
const DEFAULTS = { hour: 21, minute: 0, enabled: true };

export function loadSchedule() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
        return { ...DEFAULTS };
    }
}

export function saveSchedule(partial) {
    const current = loadSchedule();
    const updated = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
}

/**
 * Notification 권한 요청 — notify wrapper 경유
 */
export async function requestNotificationPermission() {
    return await requestPermission();
}

let intervalHandle = null;

/**
 * 스케줄러 시작 — 1분 간격으로 시각 검사
 * App.jsx의 user 로그인 effect에서 호출
 */
export function startScheduler() {
    if (intervalHandle) return;
    intervalHandle = setInterval(tick, 60 * 1000);
    // 즉시 1회 실행 (앱이 정각 도달 후 열린 케이스 대응)
    tick();
}

export function stopScheduler() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
}

async function tick() {
    const schedule = loadSchedule();
    if (!schedule.enabled) return;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY);
    if (lastNotified === today) return;

    // 정각 도달 검사 (±1분 윈도우)
    const targetMinutes = schedule.hour * 60 + schedule.minute;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (currentMinutes < targetMinutes) return;

    // pending 메모가 없으면 알림 불필요
    const pendingCount = await RawMemoCache.pendingCount();
    if (pendingCount === 0) return;

    // 알림 발송 — notify wrapper 경유 (Service Worker 있으면 persistent, 없으면 일반)
    if (getPermissionStatus() === 'granted') {
        await showPersistentNotification({
            title: '오늘의 큐레이션',
            body: `검토할 메모 ${pendingCount}개가 있습니다`,
            tag: 'meki-curation',
            icon: '/logo192.png',
        });
    }
    localStorage.setItem(LAST_NOTIFIED_KEY, today);
}
