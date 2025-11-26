import { Octokit } from 'octokit';

/**
 * Authentication Service
 * localStorage 기반 토큰 관리
 */
export class AuthService {
    static TOKEN_KEY = 'github_token';
    static USER_KEY = 'github_user';

    /**
     * 토큰 가져오기
     */
    static getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    /**
     * 토큰 저장
     */
    static saveToken(token) {
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
    }

    /**
     * 현재 사용자 정보 가져오기 (GitHub API 호출)
     */
    static async getCurrentUser() {
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
