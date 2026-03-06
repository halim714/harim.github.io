import React, { useState, useEffect } from 'react';
import { useVaultStore } from '../stores/useVaultStore';

export function VaultSetup({ onComplete }) {
    const { isVaultReady, checkLocalVault, createVault, importVault } = useVaultStore();
    const [mode, setMode] = useState('select'); // 'select' | 'create' | 'import'
    const [createdSeed, setCreatedSeed] = useState('');
    const [copied, setCopied] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);
    const [importInput, setImportInput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkLocalVault().then((ready) => {
            setIsLoading(false);
            if (ready && onComplete) onComplete();
        });
    }, [checkLocalVault, onComplete]);

    const handleCreate = async () => {
        setIsLoading(true);
        const newSeed = await createVault();
        setCreatedSeed(newSeed);
        setMode('create');
        setIsLoading(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(createdSeed);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleConfirmCreation = () => {
        if (acknowledged && onComplete) {
            onComplete();
        }
    };

    const handleImport = async () => {
        setErrorMsg('');
        if (!importInput.trim()) {
            setErrorMsg('Seed를 입력해주세요.');
            return;
        }

        setIsLoading(true);
        const success = await importVault(importInput.trim());
        setIsLoading(false);

        if (success) {
            if (onComplete) onComplete();
        } else {
            setErrorMsg('유효하지 않은 Seed 문자열입니다. 다시 확인해주세요.');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8 bg-gray-50 rounded shadow max-w-lg mx-auto mt-20">
                <span className="text-gray-600 font-medium">Vault 초기화 중...</span>
            </div>
        );
    }

    if (isVaultReady && mode === 'select') {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-green-50 border border-green-200 rounded shadow max-w-lg mx-auto mt-20">
                <h2 className="text-2xl font-bold text-green-800 mb-2">Vault 준비 완료</h2>
                <p className="text-green-600 mb-6">현재 브라우저 환경에서 E2EE 암호화가 활성화되어 있습니다.</p>
                {onComplete && (
                    <button onClick={onComplete} className="px-6 py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700">
                        앱 시작하기
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-10 bg-white border border-gray-200 rounded-lg shadow-xl max-w-xl mx-auto mt-16">
            <h2 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">
                🔒 개인 볼트(Vault) 보호
            </h2>

            {mode === 'select' && (
                <div className="w-full text-center">
                    <p className="text-gray-600 mb-8 whitespace-pre-line">
                        {'종단간 암호화(E2EE)가 Meki에 적용됩니다.\n작성한 문서는 볼트 키로 암호화되어 GitHub에 저장되므로, 자신 외에는 열람할 수 없습니다.'}
                    </p>

                    <div className="flex flex-col gap-4">
                        <button
                            onClick={handleCreate}
                            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition"
                        >
                            새로운 Vault 생성하기 (추천)
                        </button>
                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-gray-300"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">또는</span>
                            <div className="flex-grow border-t border-gray-300"></div>
                        </div>
                        <button
                            onClick={() => setMode('import')}
                            className="w-full py-4 bg-white text-indigo-700 border border-indigo-600 shadow-sm font-bold rounded-lg hover:bg-indigo-50 transition"
                        >
                            기존 백업 Seed로 복원하기
                        </button>
                    </div>
                </div>
            )}

            {mode === 'create' && (
                <div className="w-full">
                    <p className="font-semibold text-gray-800 mb-2">당신만의 복구 Seed가 생성되었습니다.</p>
                    <p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded border border-red-200">
                        ⚠️ 이 Seed를 안전한 곳(비밀번호 매니저 등)에 보관하세요. 분실 시 데이터를 절대 복구할 수 없습니다!
                    </p>

                    <div className="w-full bg-gray-100 p-4 rounded text-sm font-mono break-all border border-gray-300 mb-3 select-all">
                        {createdSeed}
                    </div>

                    <button
                        onClick={handleCopy}
                        className={`w-full py-2 font-medium rounded transition mb-6 ${copied ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                    >
                        {copied ? '복사되었습니다!' : '클립보드에 복사'}
                    </button>

                    <div className="flex items-start mb-6">
                        <input
                            type="checkbox"
                            id="ack"
                            checked={acknowledged}
                            onChange={(e) => setAcknowledged(e.target.checked)}
                            className="mt-1 mr-3 h-5 w-5 text-indigo-600"
                        />
                        <label htmlFor="ack" className="text-sm text-gray-700 leading-snug cursor-pointer">
                            이 Seed를 안전하게 백업했으며, Meki 앱 외부(GitHub)에 보관되는 모든 데이터는 암호화되어 관리된다는 사실을 이해했습니다.
                        </label>
                    </div>

                    <button
                        onClick={handleConfirmCreation}
                        disabled={!acknowledged}
                        className={`w-full py-3 font-bold rounded-lg transition ${acknowledged ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                    >
                        Vault 보호 시작하기
                    </button>
                </div>
            )}

            {mode === 'import' && (
                <div className="w-full">
                    <p className="text-gray-700 mb-4">
                        다른 기기에서 생성했던 볼트 복구 Seed를 입력하세요.
                    </p>

                    <textarea
                        value={importInput}
                        onChange={(e) => setImportInput(e.target.value)}
                        className="w-full h-32 p-3 border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-sm mb-2"
                        placeholder="Seed 문자열 붙여넣기..."
                    />

                    {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}

                    <div className="flex gap-3">
                        <button
                            onClick={() => setMode('select')}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition"
                        >
                            뒤로가기
                        </button>
                        <button
                            onClick={handleImport}
                            className="flex-2 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 transition"
                        >
                            복원 및 접근
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
