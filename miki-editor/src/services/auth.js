import { Octokit } from 'octokit';

/**
 * Authentication Service
 * 듀얼모드: VITE_USE_WS_PROXY=true 시 WS 프록시 모드 (토큰은 서버 세션에 있음)
 */
export class AuthService {
    static TOKEN_KEY = 'github_token';
    static USER_KEY = 'github_user';

    /** WS 프록시 모드 여부 */
    static isWsMode() {
        return import.meta.env.VITE_USE_WS_PROXY === 'true';
    }

    /**
     * localStorage에 기존(레거시) 토큰이 있으면 true.
     * WS 모드 여부와 무관하게 항상 localStorage를 직접 확인.
     */
    static hasLegacyToken() {
        return !!localStorage.getItem(this.TOKEN_KEY);
    }

    /**
     * 토큰 가져오기.
     * WS 모드에서는 null 반환 (토큰은 서버 세션에 있음).
     */
    static getToken() {
        if (this.isWsMode()) return null;
        return localStorage.getItem(this.TOKEN_KEY);
    }

    /**
     * 토큰 저장.
     * WS 모드에서는 no-op (토큰은 서버 세션에서 관리).
     */
    static saveToken(token) {
        if (this.isWsMode()) return;
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(`${this.TOKEN_KEY}_timestamp`, Date.now().toString());
    }

    /**
     * 로그아웃 (토큰 삭제)
     */
    static logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(`${this.TOKEN_KEY}_timestamp`);
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem('meki_session'); // P6.1: Remove local session token
    }

    /**
     * WS 모드에서 HttpOnly 쿠키로 세션을 검증하고 sessionId 복원 및 사용자 정보 반환
     */
    static async checkWsSession() {
        const wsProxyUrl = import.meta.env.VITE_WS_PROXY_URL || 'ws://localhost:8080';
        const httpProxyUrl = wsProxyUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');

        // P6.1: Read sessiontoken from localStorage
        const sessionToken = localStorage.getItem('meki_session');
        if (!sessionToken) return null;

        try {
            const res = await fetch(`${httpProxyUrl}/api/session`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${sessionToken}` // P6.1: Use Bearer auth instead of credentials: 'include'
                }
            });
            if (!res.ok) {
                if (res.status === 401) {
                    this.logout(); // 쿠키 무효화 시 캐시 삭제
                }
                return null;
            }
            const data = await res.json();
            if (data.valid && data.user) {
                const user = {
                    id: data.user.id,
                    username: data.user.login,
                    name: data.user.login,
                    avatar: this.getCachedUser()?.avatar || '' // Try to keep avatar from cache
                };
                localStorage.setItem(this.USER_KEY, JSON.stringify(user));
                return user;
            }
            return null;
        } catch (e) {
            console.error('Session check failed:', e);
            // 네트워크 에러 시 캐시된 사용자 반환 (오프라인)
            return this.getCachedUser();
        }
    }

    /**
     * 현재 사용자 정보 가져오기.
     * WS 모드에서는 캐시된 사용자 반환 (세션 복구는 위 checkWsSession에서 수행)
     */
    static async getCurrentUser() {
        if (this.isWsMode()) {
            return this.getCachedUser();
        }

        const token = this.getToken();
        if (!token) return null;

        try {
            const octokit = new Octokit({ auth: token });
            const { data } = await octokit.rest.users.getAuthenticated();

            const user = {
                id: data.id,
                username: data.login,
                name: data.name,
                email: data.email,
                avatar: data.avatar_url,
                bio: data.bio
            };

            // 캐시
            localStorage.setItem(this.USER_KEY, JSON.stringify(user));
            return user;
        } catch (error) {
            console.error('Failed to fetch user:', error);

            // 401 = 토큰 무효
            if (error.status === 401) {
                this.logout();
            }

            return null;
        }
    }

    /**
     * 캐시된 사용자 정보 (API 호출 없음)
     */
    static getCachedUser() {
        const cached = localStorage.getItem(this.USER_KEY);
        if (!cached) return null;

        try {
            return JSON.parse(cached);
        } catch {
            return null;
        }
    }

    /**
     * Octokit 인스턴스 생성
     */
    static createOctokit() {
        const token = this.getToken();
        if (!token) {
            throw new Error('No GitHub token found. Please login first.');
        }
        return new Octokit({ auth: token });
    }
}
