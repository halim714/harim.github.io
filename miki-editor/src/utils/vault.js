/**
 * vault.js - Vault Seed E2EE (Phase 5)
 * Web Crypto API를 사용한 AES-GCM 암복호화 유틸리티
 */

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits (AES-GCM 권장)

export class VaultService {
    /**
     * 새로운 AES-GCM 키 생성
     * @returns {Promise<CryptoKey>}
     */
    static async generateKey() {
        return await window.crypto.subtle.generateKey(
            {
                name: ENCRYPTION_ALGORITHM,
                length: KEY_LENGTH,
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );
    }

    /**
     * 키를 Base64 문자열 (Seed)로 내보내기
     * @param {CryptoKey} key
     * @returns {Promise<string>}
     */
    static async exportKeyAsSeed(key) {
        const rawKey = await window.crypto.subtle.exportKey('raw', key);
        return this._bufferToBase64(rawKey);
    }

    /**
     * Base64 문자열 (Seed)로부터 키 가져오기 (extractable: true, 백업/표시용)
     * @param {string} seed
     * @returns {Promise<CryptoKey>}
     */
    static async importKeyFromSeed(seed) {
        const rawKey = this._base64ToBuffer(seed);
        return await window.crypto.subtle.importKey(
            'raw',
            rawKey,
            {
                name: ENCRYPTION_ALGORITHM,
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Base64 문자열 (Seed)로부터 non-extractable 운용 키 생성
     * JavaScript에서 키 바이트 추출 불가 (XSS 방어)
     * @param {string} seed
     * @returns {Promise<CryptoKey>}
     */
    static async importKeyNonExtractable(seed) {
        const rawKey = this._base64ToBuffer(seed);
        return await window.crypto.subtle.importKey(
            'raw',
            rawKey,
            { name: ENCRYPTION_ALGORITHM },
            false, // extractable: false (핵심 보안)
            ['encrypt', 'decrypt']
        );
    }

    /**
     * 데이터 암호화
     * @param {string} text - 평문
     * @param {CryptoKey} key - 암호화 키
     * @returns {Promise<string>} 'iv:ciphertext' 형태의 Base64 문자열
     */
    static async encrypt(text, key) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);

        // IV 무작위 생성
        const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

        // 암호화 수행
        const encryptedBuffer = await window.crypto.subtle.encrypt(
            {
                name: ENCRYPTION_ALGORITHM,
                iv: iv
            },
            key,
            data
        );

        // iv와 암호문을 결합하여 하나의 Base64 문자열로 만들기
        const ivBase64 = this._bufferToBase64(iv.buffer);
        const cipherBase64 = this._bufferToBase64(encryptedBuffer);

        return `${ivBase64}:${cipherBase64}`;
    }

    /**
     * 데이터 복호화
     * @param {string} encryptedString - 'iv:ciphertext' 형태의 Base64 문자열
     * @param {CryptoKey} key - 복호화 키
     * @returns {Promise<string>} 평문
     */
    static async decrypt(encryptedString, key) {
        if (!encryptedString || !encryptedString.includes(':')) {
            throw new Error('Invalid encrypted string format (expected iv:ciphertext)');
        }
        try {
            const parts = encryptedString.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted string format (expected iv:ciphertext)');
            }

            const ivBuffer = this._base64ToBuffer(parts[0]);
            const cipherBuffer = this._base64ToBuffer(parts[1]);

            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: ENCRYPTION_ALGORITHM,
                    iv: new Uint8Array(ivBuffer)
                },
                key,
                cipherBuffer
            );

            const decoder = new TextDecoder();
            return decoder.decode(decryptedBuffer);
        } catch (error) {
            console.error('Vault Decryption failed:', error);
            throw new Error('Decryption failed. Invalid key or corrupted data.');
        }
    }

    // Helper utils
    static _bufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    static _base64ToBuffer(base64) {
        const binary = window.atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}
