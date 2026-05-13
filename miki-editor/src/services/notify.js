/**
 * notify — 알림 API 추상화
 *
 * Capacitor 마이그레이션 시 이 파일만 교체:
 *   PWA:        Notification API (Web Push)
 *   Capacitor:  @capacitor/local-notifications + @capacitor/push-notifications
 *
 * 호출부(curationScheduler.js 등)는 이 모듈만 import — 네이티브 전환 무손실.
 */

/**
 * 알림 권한 요청
 * @returns {Promise<'granted'|'denied'|'default'>}
 */
export async function requestPermission() {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return await Notification.requestPermission();
}

/**
 * 권한 상태 조회 (요청하지 않음)
 * @returns {'granted'|'denied'|'default'|'unsupported'}
 */
export function getPermissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

/**
 * 즉시 로컬 알림 표시
 * @param {{ title: string, body?: string, tag?: string, icon?: string, onClick?: () => void }} params
 * @returns {boolean} 알림 표시 성공 여부
 */
export function showNotification({ title, body, tag, icon, onClick }) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
        const notif = new Notification(title, {
            body,
            tag,
            icon: icon || '/logo192.png',
            badge: '/logo192.png',
        });
        if (onClick) notif.onclick = onClick;
        return true;
    } catch {
        return false;
    }
}

/**
 * Service Worker 경유 알림 (PWA 설치본에서 백그라운드 알림용)
 * iOS 16.4+ PWA에서 백그라운드 푸시를 받을 때 사용
 * @param {{ title, body, tag, icon }} params
 * @returns {Promise<boolean>}
 */
export async function showPersistentNotification({ title, body, tag, icon }) {
    if (!('serviceWorker' in navigator)) return showNotification({ title, body, tag, icon });
    if (Notification.permission !== 'granted') return false;
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return showNotification({ title, body, tag, icon });
        await reg.showNotification(title, {
            body,
            tag,
            icon: icon || '/logo192.png',
            badge: '/logo192.png',
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * 네이티브 환경 감지 (Capacitor 전환 후 분기용)
 * @returns {boolean}
 */
export function isNativePlatform() {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}
