import { VaultService } from '../../utils/vault';
import { useVaultStore } from '../../stores/useVaultStore';
import { storage } from '../../utils/storage-client';
import { dbHelpers } from '../../utils/database';

import { TextEncoder, TextDecoder } from 'util';
import crypto from 'crypto';

// JSDOM Web Crypto API 폴리필
beforeAll(() => {
    if (typeof window !== 'undefined') {
        if (!window.crypto) window.crypto = {};
        if (!window.crypto.subtle && crypto.webcrypto) {
            window.crypto.subtle = crypto.webcrypto.subtle;
        }
        if (!window.crypto.getRandomValues && crypto.webcrypto) {
            window.crypto.getRandomValues = crypto.webcrypto.getRandomValues.bind(crypto.webcrypto);
        }
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

jest.mock('../../services/auth', () => ({
    AuthService: {
        getToken: jest.fn().mockReturnValue('mock-token'),
        hasLegacyToken: jest.fn().mockReturnValue(false)
    }
}));

const mockGetFile = jest.fn();
const mockCreateOrUpdateFile = jest.fn();

jest.mock('../../services/github', () => {
    return {
        GitHubService: jest.fn().mockImplementation(() => ({
            setUsername: jest.fn().mockResolvedValue(),
            getFilesWithMetadata: jest.fn().mockResolvedValue([]),
            getFile: mockGetFile,
            createOrUpdateFile: mockCreateOrUpdateFile,
            deleteFile: jest.fn().mockResolvedValue(),
        }))
    };
});

const mockVaultKeySave = jest.fn().mockResolvedValue(undefined);
const mockVaultKeyLoad = jest.fn().mockResolvedValue(null);
const mockVaultKeyClear = jest.fn().mockResolvedValue(undefined);

jest.mock('../../utils/database', () => ({
    VaultKeyStore: {
        save: (...args) => mockVaultKeySave(...args),
        load: (...args) => mockVaultKeyLoad(...args),
        clear: (...args) => mockVaultKeyClear(...args),
    },
    dbHelpers: {
        saveLocal: jest.fn().mockResolvedValue(),
        markSyncedWithUpdate: jest.fn().mockResolvedValue(),
        deleteLocal: jest.fn().mockResolvedValue()
    },
    PendingSync: {
        enqueue: jest.fn()
    },
    db: {
        documents: {
            toArray: jest.fn().mockResolvedValue([]),
            where: jest.fn().mockReturnThis(),
            equals: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue(null)
        }
    }
}));

describe('Vault E2EE Flow', () => {
    beforeEach(() => {
        useVaultStore.setState({ isVaultReady: false, cryptoKey: null });
        jest.clearAllMocks();
        mockGetFile.mockReset();
        mockCreateOrUpdateFile.mockReset();
        mockVaultKeySave.mockReset().mockResolvedValue(undefined);
        mockVaultKeyLoad.mockReset().mockResolvedValue(null);
        mockVaultKeyClear.mockReset().mockResolvedValue(undefined);
    });

    it('Vault 설정 전에는 파일이 암호화되지 않고 평문 리턴된다', async () => {
        // Vault 준비 안된 상태
        const mockFileContent = btoa('---\ntitle: Mock Title\ndocId: mock-id\n---\nHello World');
        mockGetFile.mockResolvedValueOnce({ content: mockFileContent, sha: 'mock' });

        const post = await storage.getPost('mock-id');
        expect(post.frontMatter.title).toBe('Mock Title');
        expect(post.content).toBe('Hello World');
    });

    it('Vault 설정 후 파일이 E2EE 암호화 프리픽스와 함께 저장된다', async () => {
        // 1. Vault 생성 및 활성화
        const seed = await useVaultStore.getState().createVault();
        expect(useVaultStore.getState().isVaultReady).toBe(true);

        // 2. 파일 저장 수행
        const postToSave = {
            id: 'mock-id',
            title: 'Vault Test',
            content: 'Secret Data'
        };

        const result = await storage.savePost(postToSave);
        expect(result.syncStatus).toBe('pending');
        expect(dbHelpers.saveLocal).toHaveBeenCalled();

        // 3. 백그라운드 저장이 실행되는지 검사 (Debounce 모킹 우회)
        // 실제 storage_client에서 github.createOrUpdateFile로 전달되는 데이터를 확인
        // Timeout 대기 대신, _savePostToGitHub 직접 호출
        const savedPost = await storage._savePostToGitHub(postToSave);

        // createOrUpdateFile가 호출되었는지 확인
        expect(mockCreateOrUpdateFile).toHaveBeenCalled();

        // 전달된 파일 내용에 MEKI_E2EE 프리픽스가 있는지 확인
        const callArgs = mockCreateOrUpdateFile.mock.calls[0];
        const contentSentToGithub = callArgs[2]; // 세 번째 인자가 content

        expect(contentSentToGithub).toContain('MEKI_E2EE:');
    });

    it('MEKI_E2EE 프리픽스가 있는 파일은 올바른 Vault Key로 복호화된다', async () => {
        // 1. Vault 활성화
        const seed = await useVaultStore.getState().createVault();
        const cryptoKey = useVaultStore.getState().cryptoKey;

        // 2. 실제 데이터 암호화
        const rawContent = '---\ntitle: Secret Post\ndocId: secret-id\n---\nThis is highly classified.';
        const encryptedData = await VaultService.encrypt(rawContent, cryptoKey);

        // 3. Github API가 암호화된 프리픽스가 붙은 데이터를 반환하도록 설정
        const encodedContent = btoa('MEKI_E2EE:' + encryptedData);
        mockGetFile.mockResolvedValueOnce({ content: encodedContent, sha: 'mock' });

        // 4. getPost 호출
        const post = await storage.getPost('secret-id');

        // 5. 프론트매터 및 본문이 정상적으로 파싱되었는지 확인
        expect(post.frontMatter.title).toBe('Secret Post');
        expect(post.id).toBe('secret-id');
        expect(post.content).toBe('This is highly classified.');
    });

    it('createVault()는 localStorage에 Seed를 저장하지 않고 IndexedDB에 키를 저장한다', async () => {
        const localStorageSpy = jest.spyOn(Storage.prototype, 'setItem');

        const seed = await useVaultStore.getState().createVault();

        // Seed가 반환되어야 함
        expect(typeof seed).toBe('string');
        expect(seed.length).toBeGreaterThan(0);

        // VaultKeyStore.save가 호출되어야 함 (IndexedDB 저장)
        expect(mockVaultKeySave).toHaveBeenCalledTimes(1);
        const savedKey = mockVaultKeySave.mock.calls[0][0];
        expect(savedKey).toBeDefined();
        // non-extractable 키여야 함
        expect(savedKey.extractable).toBe(false);

        // localStorage에 Seed가 저장되지 않아야 함
        const seedStorageCalls = localStorageSpy.mock.calls.filter(
            ([key]) => key === 'meki_vault_seed_encrypted_local'
        );
        expect(seedStorageCalls).toHaveLength(0);

        localStorageSpy.mockRestore();
    });

    it('checkLocalVault()는 IndexedDB 키 있으면 그것을 로드하고 localStorage는 건드리지 않는다', async () => {
        const key = await VaultService.generateKey();
        const seed = await VaultService.exportKeyAsSeed(key);
        const nonExtractableKey = await VaultService.importKeyNonExtractable(seed);

        mockVaultKeyLoad.mockResolvedValueOnce(nonExtractableKey);

        const result = await useVaultStore.getState().checkLocalVault();

        expect(result).toBe(true);
        expect(useVaultStore.getState().isVaultReady).toBe(true);
        expect(useVaultStore.getState().seedString).toBeNull();
    });

    it('Vault 연결 안된 상태에서 암호화된 문서를 열면 ⚠️ 경고 메시지가 로드된다', async () => {
        // 1. Vault 활성화 안 함
        // 2. Github API가 암호화된 데이터를 반환하도록 설정
        const encodedContent = btoa('MEKI_E2EE:some-encrypted-string');
        mockGetFile.mockResolvedValueOnce({ content: encodedContent, sha: 'mock' });

        // 3. getPost 호출
        const post = await storage.getPost('secret-id');

        // 4. 복호화 불가능 경고문 반환 확인
        expect(post.content).toContain('⚠️ [암호화된 문서입니다');
    });
});
