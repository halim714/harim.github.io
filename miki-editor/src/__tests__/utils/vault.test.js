import { VaultService } from '../../utils/vault';
import { TextEncoder, TextDecoder } from 'util';
import crypto from 'crypto';

// JSDOM 환경에서 Web Crypto API 및 TextEncoder/Decoder 폴리필
beforeAll(() => {
    if (typeof window !== 'undefined') {
        if (!window.crypto) window.crypto = {};
        if (!window.crypto.subtle && crypto.webcrypto) {
            window.crypto.subtle = crypto.webcrypto.subtle;
        }
        if (!window.crypto.getRandomValues && crypto.webcrypto) {
            window.crypto.getRandomValues = crypto.webcrypto.getRandomValues.bind(crypto.webcrypto);
        }

        // btoa, atob 폴리필 (Node.js 환경 대비)
        if (!window.btoa) {
            window.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
        }
        if (!window.atob) {
            window.atob = (str) => Buffer.from(str, 'base64').toString('binary');
        }
    }

    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
});

describe('VaultService (AES-GCM Encryption)', () => {
    it('새로운 키를 생성하고 Seed로 추출/복원할 수 있어야 한다', async () => {
        // 1. 키 생성
        const key = await VaultService.generateKey();
        expect(key).toBeDefined();
        expect(key.algorithm.name).toBe('AES-GCM');

        // 2. 키를 Seed 문자열로 내보내기
        const seed = await VaultService.exportKeyAsSeed(key);
        expect(typeof seed).toBe('string');
        expect(seed.length).toBeGreaterThan(0);

        // 3. Seed 문자열로부터 키 복원하기
        const importedKey = await VaultService.importKeyFromSeed(seed);
        expect(importedKey).toBeDefined();
        expect(importedKey.algorithm.name).toBe('AES-GCM');

        // 다시 내보내서 같은 Seed인지 확인 (대칭키 일치 확인)
        const seed2 = await VaultService.exportKeyAsSeed(importedKey);
        expect(seed).toBe(seed2);
    });

    it('텍스트를 암호화하고 정상적으로 복호화할 수 있어야 한다', async () => {
        const key = await VaultService.generateKey();
        const originalText = 'Hello, Vault! 이스트에그 암호화 테스트 🚀';

        // 암호화
        const encryptedString = await VaultService.encrypt(originalText, key);
        expect(typeof encryptedString).toBe('string');
        expect(encryptedString).toContain(':'); // iv:ciphertext 형식 확인
        expect(encryptedString).not.toContain('Vault!'); // 원문 노출 없음

        // 복호화
        const decryptedText = await VaultService.decrypt(encryptedString, key);
        expect(decryptedText).toBe(originalText);
    });

    it('단일 키로 여러 텍스트를 각각 독립된 IV로 암호화해야 한다', async () => {
        const key = await VaultService.generateKey();
        const text = 'Same Text';

        const enc1 = await VaultService.encrypt(text, key);
        const enc2 = await VaultService.encrypt(text, key);

        // IV가 무작위이므로 같은 평문이라도 암호문은 달라야 한다
        expect(enc1).not.toBe(enc2);

        // 둘 다 정상 복호화 되어야 한다
        const dec1 = await VaultService.decrypt(enc1, key);
        const dec2 = await VaultService.decrypt(enc2, key);

        expect(dec1).toBe(text);
        expect(dec2).toBe(text);
    });

    it('importKeyNonExtractable()로 생성된 키는 extractable: false이며 암복호화는 정상 작동해야 한다', async () => {
        const key = await VaultService.generateKey();
        const seed = await VaultService.exportKeyAsSeed(key);

        const nonExtractableKey = await VaultService.importKeyNonExtractable(seed);
        expect(nonExtractableKey).toBeDefined();
        expect(nonExtractableKey.extractable).toBe(false);
        expect(nonExtractableKey.algorithm.name).toBe('AES-GCM');

        // exportKey 시도 시 에러 발생 확인
        await expect(
            window.crypto.subtle.exportKey('raw', nonExtractableKey)
        ).rejects.toThrow();

        // 암호화/복호화는 정상 작동해야 함
        const text = 'non-extractable key test';
        const encrypted = await VaultService.encrypt(text, nonExtractableKey);
        const decrypted = await VaultService.decrypt(encrypted, nonExtractableKey);
        expect(decrypted).toBe(text);
    });

    it('잘못된 키나 변조된 데이터로 복호화 시도시 에러가 발생해야 한다', async () => {
        const key1 = await VaultService.generateKey();
        const key2 = await VaultService.generateKey();

        const originalText = 'Secret Data';
        const encrypted = await VaultService.encrypt(originalText, key1);

        // 다른 키로 복호화 시도
        await expect(VaultService.decrypt(encrypted, key2)).rejects.toThrow(/Decryption failed/);

        // 손상된 데이터로 복호화 시도 (일부 문자열 변경)
        const corrupted = encrypted.slice(0, -5) + 'AAAAA';
        await expect(VaultService.decrypt(corrupted, key1)).rejects.toThrow(/Decryption failed/);

        // 잘못된 포맷
        await expect(VaultService.decrypt('invalid_format_string', key1)).rejects.toThrow(/Invalid encrypted string format/);
    });
});
