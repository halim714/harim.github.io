/**
 * mockAuth.js — 테스트 환경용 더미 유저/인증 헬퍼
 * 
 * GitHub OAuth 콜백 없이 "로그인된 상태"를 모의(Mock)합니다.
 * RTL 테스트나 Shallow Boot 검증에서 인증 의존 컴포넌트를 
 * 렌더링할 수 있도록 localStorage에 더미 데이터를 주입합니다.
 */

export const DUMMY_USER = {
    login: 'meki-test-user',
    id: 99999999,
    avatar_url: 'https://avatars.githubusercontent.com/u/99999999',
    name: 'Meki Test User',
    email: 'test@meki.dev',
};

export const DUMMY_TOKEN = 'gho_dummy_test_token_for_local_verification_only';

/**
 * 로그인된 상태를 localStorage에 주입합니다.
 * beforeEach()에서 호출하세요.
 */
export function injectDummyAuth() {
    localStorage.setItem('github_token', DUMMY_TOKEN);
    localStorage.setItem('github_user', JSON.stringify(DUMMY_USER));
}

/**
 * 주입된 더미 인증을 제거합니다.
 * afterEach()에서 호출하세요.
 */
export function clearDummyAuth() {
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user');
}
