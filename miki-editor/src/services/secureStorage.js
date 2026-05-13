/**
 * secureStorage — 민감한 키/값 저장 추상화
 *
 * Capacitor 마이그레이션 시 이 파일만 교체:
 *   PWA:        localStorage (브라우저 격리)
 *   Capacitor:  @capacitor/preferences (Encrypted Shared Preferences / Keychain)
 *
 * 호출부(byokClient.js의 BYOK 키 등)는 이 모듈만 import.
 *
 * ⚠️ 주의: PWA 단계에서는 localStorage라 진정한 의미의 secure가 아님.
 *   같은 origin의 XSS에 노출됨. 그래서 CSP 강화 + DOMPurify가 함께 필요.
 *   Capacitor 전환 시 Keychain으로 격상되어 진짜 secure가 됨.
 */

/**
 * 값 저장 (비동기 인터페이스 — Capacitor와 호환)
 * @param {string} key
 * @param {string} value
 * @returns {Promise<void>}
 */
export async function setItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (err) {
        // 용량 초과 또는 private mode
        console.warn('[secureStorage] setItem 실패:', err);
        throw err;
    }
}

/**
 * 값 조회
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getItem(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

/**
 * 값 삭제
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function removeItem(key) {
    try {
        localStorage.removeItem(key);
    } catch { /* ignore */ }
}

/**
 * JSON 객체 저장/로드 헬퍼
 */
export async function setJSON(key, obj) {
    return setItem(key, JSON.stringify(obj));
}

export async function getJSON(key) {
    const raw = await getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}
