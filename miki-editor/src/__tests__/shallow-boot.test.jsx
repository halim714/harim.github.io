/**
 * shallow-boot.test.jsx — Shallow Boot Test (앱 크래시 방지 최소 보증)
 * 
 * 이 테스트는 앱이 "하얀 화면(White Screen of Death)"으로 
 * 뻗지 않는다는 최소한의 보증을 제공합니다.
 * 
 * OAuth 리다이렉트 없이 JSDOM 환경에서 App 컴포넌트를 
 * 마운트하여, React 런타임 에러 없이 초기 렌더링이 
 * 완료되는지 확인합니다.
 */
import React from 'react';
import { render } from '@testing-library/react';

// App.jsx를 최소한으로 마운트 (라우터, 스토어 포함)
// 외부 API 호출이 실패하더라도 앱이 크래시하지 않아야 함
describe('Shallow Boot Test', () => {
    beforeEach(() => {
        // fetch를 가짜로 대체하여 네트워크 에러를 방지
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
                status: 401,
                json: () => Promise.resolve({}),
            })
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('App이 크래시 없이 초기 렌더링에 성공해야 한다', async () => {
        // dynamic import로 App을 로드 (번들 에러 감지)
        let App;
        try {
            const mod = await import('../../App');
            App = mod.default;
        } catch (e) {
            // import 자체가 실패하면 번들/구문 에러
            throw new Error(`App import 실패 (번들 에러): ${e.message}`);
        }

        // React 런타임 에러 캐치
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => {
            render(<App />);
        }).not.toThrow();

        // React의 치명적 에러 (예: hooks 규칙 위반 등)가 없어야 함
        const fatalErrors = consoleSpy.mock.calls.filter(
            (call) =>
                typeof call[0] === 'string' &&
                (call[0].includes('Uncaught') || call[0].includes('Invalid hook'))
        );
        expect(fatalErrors).toHaveLength(0);

        consoleSpy.mockRestore();
    });
});
