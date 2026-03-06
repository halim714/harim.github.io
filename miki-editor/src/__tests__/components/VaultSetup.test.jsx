import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VaultSetup } from '../../components/VaultSetup';
import { useVaultStore } from '../../stores/useVaultStore';
import { VaultService } from '../../utils/vault';

// === Mocking ===
jest.mock('../../stores/useVaultStore', () => ({
    useVaultStore: jest.fn(),
}));

jest.mock('../../utils/database', () => ({
    VaultKeyStore: {
        save: jest.fn().mockResolvedValue(undefined),
        load: jest.fn().mockResolvedValue(null),
        clear: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../../utils/vault', () => ({
    VaultService: {
        generateKey: jest.fn().mockResolvedValue('mock-key'),
        exportKeyAsSeed: jest.fn().mockResolvedValue('MOCK-BASE64-SEED-STRING-12345'),
        importKeyFromSeed: jest.fn().mockResolvedValue('mock-key'),
    }
}));

// Object.defineProperty(navigator, 'clipboard', {
//   value: { writeText: jest.fn() },
//   writable: true
// });

describe('VaultSetup Component', () => {
    let mockCheckLocalVault;
    let mockCreateVault;
    let mockImportVault;

    beforeEach(() => {
        mockCheckLocalVault = jest.fn().mockResolvedValue(false);
        mockCreateVault = jest.fn().mockResolvedValue('MOCK-BASE64-SEED-STRING-12345');
        mockImportVault = jest.fn().mockResolvedValue(true);

        useVaultStore.mockReturnValue({
            isVaultReady: false,
            checkLocalVault: mockCheckLocalVault,
            createVault: mockCreateVault,
            importVault: mockImportVault,
        });

        // reset clipboard mock
        Object.assign(navigator, {
            clipboard: {
                writeText: jest.fn(),
            },
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('기존 Vault가 로컬에 있으면 로딩 완료 후 onComplete를 호출한다', async () => {
        mockCheckLocalVault.mockResolvedValue(true);
        useVaultStore.mockReturnValue({
            isVaultReady: true,
            checkLocalVault: mockCheckLocalVault,
            // ...
        });
        const mockOnComplete = jest.fn();

        await act(async () => {
            render(<VaultSetup onComplete={mockOnComplete} />);
        });

        // Vault가 준비되었으므로 즉시 onComplete 호출
        expect(mockOnComplete).toHaveBeenCalled();
    });

    it('Vault가 없으면 생성/복원 선택 화면을 보여준다', async () => {
        await act(async () => {
            render(<VaultSetup />);
        });

        expect(screen.getByText(/개인 볼트\(Vault\) 보호/)).toBeInTheDocument();
        expect(screen.getByText(/새로운 Vault 생성하기/)).toBeInTheDocument();
        expect(screen.getByText(/기존 백업 Seed로 복원하기/)).toBeInTheDocument();
    });

    it('새로운 Vault 생성 시 Seed가 표시되고 확인 후 onComplete가 호출된다', async () => {
        const mockOnComplete = jest.fn();

        await act(async () => {
            render(<VaultSetup onComplete={mockOnComplete} />);
        });

        // 1. "생성하기" 버튼 클릭
        await act(async () => {
            fireEvent.click(screen.getByText(/새로운 Vault 생성하기/));
        });

        expect(mockCreateVault).toHaveBeenCalled();

        // 2. 모달에 생성된 Seed가 표시되어야 함
        expect(screen.getByText('MOCK-BASE64-SEED-STRING-12345')).toBeInTheDocument();

        // 3. 복사 버튼 클릭
        await act(async () => {
            fireEvent.click(screen.getByText(/클립보드에 복사/));
        });
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('MOCK-BASE64-SEED-STRING-12345');

        // 4. 약관(경고) 체크박스를 선택하기 전엔 버튼이 Disabled
        const startBtn = screen.getByText(/Vault 보호 시작하기/);
        expect(startBtn).toBeDisabled();

        const checkbox = screen.getByRole('checkbox');
        await act(async () => {
            fireEvent.click(checkbox);
        });

        expect(startBtn).not.toBeDisabled();

        // 5. "Vault 보호 시작하기" 클릭
        await act(async () => {
            fireEvent.click(startBtn);
        });

        expect(mockOnComplete).toHaveBeenCalled();
    });

    it('기존 백업 Seed로 복원 시 importVault가 호출된다', async () => {
        const mockOnComplete = jest.fn();

        await act(async () => {
            render(<VaultSetup onComplete={mockOnComplete} />);
        });

        // 1. "복원하기" 클릭
        await act(async () => {
            fireEvent.click(screen.getByText(/기존 백업 Seed로 복원하기/));
        });

        // 2. 텍스트 박스에 무언가 입력
        const textarea = screen.getByPlaceholderText(/Seed 문자열 붙여넣기/);
        await act(async () => {
            fireEvent.change(textarea, { target: { value: 'VALID_SEED_123' } });
        });

        // 3. 복원 버튼 클릭
        await act(async () => {
            // 버튼이 두 개 ('뒤로가기', '복원 및 접근'). 둘 다를 포괄하지 않도록 특정한 텍스트로 찾음
            fireEvent.click(screen.getByText('복원 및 접근'));
        });

        expect(mockImportVault).toHaveBeenCalledWith('VALID_SEED_123');
        expect(mockOnComplete).toHaveBeenCalled();
    });

    it('복원 실패 시 에러 메시지가 표시된다', async () => {
        mockImportVault.mockResolvedValue(false); // 실패 모의
        const mockOnComplete = jest.fn();

        await act(async () => {
            render(<VaultSetup onComplete={mockOnComplete} />);
        });

        await act(async () => {
            fireEvent.click(screen.getByText(/기존 백업 Seed로 복원하기/));
        });

        const textarea = screen.getByPlaceholderText(/Seed 문자열 붙여넣기/);
        await act(async () => {
            fireEvent.change(textarea, { target: { value: 'INVALID_SEED' } });
        });

        await act(async () => {
            fireEvent.click(screen.getByText('복원 및 접근'));
        });

        expect(mockImportVault).toHaveBeenCalledWith('INVALID_SEED');
        expect(mockOnComplete).not.toHaveBeenCalled();
        expect(screen.getByText('유효하지 않은 Seed 문자열입니다. 다시 확인해주세요.')).toBeInTheDocument();
    });
});
