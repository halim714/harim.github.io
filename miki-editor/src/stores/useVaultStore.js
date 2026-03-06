import { create } from 'zustand';
import { VaultService } from '../utils/vault';
import { VaultKeyStore } from '../utils/database';

// 마이그레이션 전용 — 신규 저장 없음
const VAULT_SEED_STORAGE_KEY = 'meki_vault_seed_encrypted_local';

export const useVaultStore = create((set, get) => ({
    isVaultReady: false,
    cryptoKey: null,
    seedString: null,

    // Vault 초기화 여부 확인
    checkLocalVault: async () => {
        // 1. IndexedDB에서 non-extractable 키 로드 시도
        try {
            const cryptoKey = await VaultKeyStore.load();
            if (cryptoKey) {
                set({ isVaultReady: true, cryptoKey, seedString: null });
                return true;
            }
        } catch (err) {
            console.error('Failed to load vault key from IndexedDB:', err);
        }

        // 2. 구 localStorage Seed 마이그레이션
        const savedSeed = localStorage.getItem(VAULT_SEED_STORAGE_KEY);
        if (savedSeed) {
            try {
                const key = await VaultService.importKeyNonExtractable(savedSeed);
                await VaultKeyStore.save(key);
                localStorage.removeItem(VAULT_SEED_STORAGE_KEY);
                set({ isVaultReady: true, cryptoKey: key, seedString: null });
                return true;
            } catch (err) {
                console.error('Failed to migrate vault seed from localStorage:', err);
                return false;
            }
        }

        return false;
    },

    // 새 Vault (Seed/Key) 생성
    createVault: async () => {
        // extractable 키로 Seed 추출 (사용자에게 표시용)
        const extractableKey = await VaultService.generateKey();
        const seed = await VaultService.exportKeyAsSeed(extractableKey);

        // non-extractable 운용 키로 변환 후 IndexedDB 저장
        const nonExtractableKey = await VaultService.importKeyNonExtractable(seed);
        await VaultKeyStore.save(nonExtractableKey);

        set({ isVaultReady: true, cryptoKey: nonExtractableKey, seedString: null });
        return seed;
    },

    // 외부로부터 발급된 Seed (기존 기기 백업) 등록
    importVault: async (seed) => {
        try {
            const key = await VaultService.importKeyNonExtractable(seed);
            await VaultKeyStore.save(key);
            set({ isVaultReady: true, cryptoKey: key, seedString: null });
            return true;
        } catch {
            return false;
        }
    },

    // Vault 제거 (기기 연동 해제 등)
    clearVault: async () => {
        await VaultKeyStore.clear();
        localStorage.removeItem(VAULT_SEED_STORAGE_KEY);
        set({ isVaultReady: false, cryptoKey: null, seedString: null });
    }
}));
