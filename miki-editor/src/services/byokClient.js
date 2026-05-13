/**
 * BYOK (Bring Your Own Key) API 클라이언트 추상화
 * Gemini / Claude (Anthropic) / OpenAI 통합 인터페이스
 *
 * 설계 원칙:
 * - API 키는 localStorage에만 저장 (서버 비전송)
 * - 단일 complete() 인터페이스로 provider 교체 투명
 * - wikiCompiler.js / reflectionEngine.js에서 주입받아 사용
 */

export class ByokApiError extends Error {
    constructor(message, status, provider) {
        super(message);
        this.name = 'ByokApiError';
        this.status = status;
        this.provider = provider;
    }
}

const DEFAULT_MODELS = {
    gemini: 'gemini-2.0-flash',
    claude: 'claude-haiku-4-5-20251001',
    openai: 'gpt-4o-mini',
};

export class ByokClient {
    /**
     * @param {{ provider: 'gemini'|'claude'|'openai', apiKey: string, model?: string }} config
     */
    constructor(config) {
        if (!config?.provider || !config?.apiKey) {
            throw new Error('ByokClient: provider와 apiKey가 필요합니다.');
        }
        this.provider = config.provider;
        this.apiKey = config.apiKey;
        this.model = config.model || DEFAULT_MODELS[config.provider];
        if (!this.model) throw new Error(`알 수 없는 provider: ${config.provider}`);
    }

    /**
     * 텍스트 완성 (단일 공통 인터페이스)
     * @param {string} systemPrompt
     * @param {string} userMessage
     * @param {{ maxTokens?: number, temperature?: number }} options
     * @returns {Promise<string>}
     */
    async complete(systemPrompt, userMessage, options = {}) {
        switch (this.provider) {
            case 'gemini': return this._gemini(systemPrompt, userMessage, options);
            case 'claude': return this._claude(systemPrompt, userMessage, options);
            case 'openai': return this._openai(systemPrompt, userMessage, options);
            default: throw new Error(`알 수 없는 provider: ${this.provider}`);
        }
    }

    async _gemini(systemPrompt, userMessage, options) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [{ text: userMessage }] }],
                generationConfig: {
                    maxOutputTokens: options.maxTokens ?? 2048,
                    temperature: options.temperature ?? 0.3,
                },
            }),
        });
        if (!resp.ok) throw new ByokApiError(await resp.text(), resp.status, 'gemini');
        const data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    async _claude(systemPrompt, userMessage, options) {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                // 브라우저 직접 호출에 필요한 헤더 (Anthropic 정책)
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: options.maxTokens ?? 2048,
                temperature: options.temperature ?? 0.3,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            }),
        });
        if (!resp.ok) throw new ByokApiError(await resp.text(), resp.status, 'claude');
        const data = await resp.json();
        return data.content?.[0]?.text ?? '';
    }

    async _openai(systemPrompt, userMessage, options) {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: options.maxTokens ?? 2048,
                temperature: options.temperature ?? 0.3,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
            }),
        });
        if (!resp.ok) throw new ByokApiError(await resp.text(), resp.status, 'openai');
        const data = await resp.json();
        return data.choices?.[0]?.message?.content ?? '';
    }

    /**
     * API 키 유효성 검증 (최소 토큰 호출)
     * @returns {Promise<{ valid: boolean, error?: string }>}
     */
    async validate() {
        try {
            const text = await this.complete(
                'You are a test assistant.',
                'Reply with the single word "ok".',
                { maxTokens: 10 }
            );
            return { valid: text.trim().toLowerCase().includes('ok') };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}

// ── Config persistence (secureStorage wrapper 경유) ──────────────────────
// Capacitor 전환 시 secureStorage가 Keychain으로 격상됨 — 이 모듈 코드는 그대로
import { getJSON, setJSON, removeItem } from './secureStorage';

const STORAGE_KEY = 'meki_byok_config';

// 인메모리 캐시 — 동기 호출 호환성 유지 (await 없이 createByokClient() 호출 가능)
let cachedConfig = null;
let cacheInitialized = false;

/** 앱 시작 시 1회 호출 — 비동기 저장소 → 인메모리로 워밍업 */
export async function initByokCache() {
    cachedConfig = await getJSON(STORAGE_KEY);
    cacheInitialized = true;
    return cachedConfig;
}

/**
 * 저장된 BYOK 설정 로드 (인메모리 캐시 우선)
 * @returns {{ provider: string, apiKey: string, model?: string } | null}
 */
export function loadByokConfig() {
    if (!cacheInitialized) {
        // 캐시 미초기화 — 동기 fallback (localStorage 직접 조회)
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            cachedConfig = raw ? JSON.parse(raw) : null;
        } catch {
            cachedConfig = null;
        }
        cacheInitialized = true;
    }
    return cachedConfig;
}

/**
 * BYOK 설정 저장 (서버 비전송, secureStorage 경유)
 */
export async function saveByokConfig(config) {
    cachedConfig = config;
    cacheInitialized = true;
    await setJSON(STORAGE_KEY, config);
}

/** BYOK 설정 삭제 */
export async function clearByokConfig() {
    cachedConfig = null;
    await removeItem(STORAGE_KEY);
}

/**
 * 저장된 설정으로 ByokClient 생성. 설정 없으면 null.
 * @returns {ByokClient | null}
 */
export function createByokClient() {
    const config = loadByokConfig();
    if (!config) return null;
    try {
        return new ByokClient(config);
    } catch {
        return null;
    }
}

/** 지원 provider 목록 */
export const BYOK_PROVIDERS = [
    { id: 'gemini', label: 'Google Gemini', defaultModel: DEFAULT_MODELS.gemini },
    { id: 'claude', label: 'Anthropic Claude', defaultModel: DEFAULT_MODELS.claude },
    { id: 'openai', label: 'OpenAI', defaultModel: DEFAULT_MODELS.openai },
];
