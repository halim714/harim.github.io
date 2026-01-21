import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AuthService } from '../../services/auth';
import { GitHubService } from '../../services/github';

const ATTACHMENT_TYPES = [
    { id: 'book', label: '📚 책', icon: '📚' },
    { id: 'movie', label: '🎬 영화', icon: '🎬' },
    { id: 'link', label: '🔗 링크', icon: '🔗' },
    { id: 'image', label: '🖼️ 이미지', icon: '🖼️' }
];

export default function AttachmentModal({ isOpen, onClose, onSave }) {
    const [step, setStep] = useState('select'); // 'select' | 'input'
    const [selectedType, setSelectedType] = useState(null);
    const [formData, setFormData] = useState({});
    const [coverFile, setCoverFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // 모달 열릴 때 초기화
    useEffect(() => {
        if (isOpen) {
            setStep('select');
            setSelectedType(null);
            setFormData({});
            setCoverFile(null);
        }
    }, [isOpen]);

    // ESC 키 처리
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const handleTypeSelect = (type) => {
        setSelectedType(type);
        setStep('input');
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleCoverUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
        }
    };

    const handleSave = async () => {
        if (!selectedType) return;

        setIsUploading(true);
        try {
            let coverUrl = null;

            // 커버 이미지가 있으면 업로드
            if (coverFile) {
                const token = AuthService.getToken();
                const github = new GitHubService(token);
                await github.setUsername();

                coverUrl = await github.uploadImage(coverFile);
            }

            // 첨부 데이터 생성
            const attachmentData = {
                type: selectedType,
                ...formData,
                ...(coverUrl && { cover: coverUrl }),
                createdAt: new Date().toISOString()
            };

            onSave(attachmentData);
            onClose();
        } catch (error) {
            console.error('첨부 저장 실패:', error);
            alert('첨부 저장에 실패했습니다: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const renderTypeSelection = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">첨부 유형 선택</h3>
            <div className="grid grid-cols-2 gap-3">
                {ATTACHMENT_TYPES.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => handleTypeSelect(type.id)}
                        className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 
                       hover:bg-blue-50 transition-all flex flex-col items-center gap-2"
                    >
                        <span className="text-4xl">{type.icon}</span>
                        <span className="text-sm font-medium">{type.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderBookForm = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">📚 책 정보 입력</h3>

            <div>
                <label className="block text-sm font-medium mb-1">제목 *</label>
                <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="책 제목"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">저자</label>
                <input
                    type="text"
                    value={formData.author || ''}
                    onChange={(e) => handleInputChange('author', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="저자명"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">커버 이미지</label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="w-full px-3 py-2 border rounded-lg"
                />
                {coverFile && (
                    <p className="text-sm text-gray-500 mt-1">선택된 파일: {coverFile.name}</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">메모</label>
                <textarea
                    value={formData.note || ''}
                    onChange={(e) => handleInputChange('note', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="간단한 메모..."
                    rows={3}
                />
            </div>
        </div>
    );

    const renderMovieForm = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">🎬 영화 정보 입력</h3>

            <div>
                <label className="block text-sm font-medium mb-1">제목 *</label>
                <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="영화 제목"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">감독</label>
                <input
                    type="text"
                    value={formData.director || ''}
                    onChange={(e) => handleInputChange('director', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="감독명"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">포스터 이미지</label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="w-full px-3 py-2 border rounded-lg"
                />
                {coverFile && (
                    <p className="text-sm text-gray-500 mt-1">선택된 파일: {coverFile.name}</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">메모</label>
                <textarea
                    value={formData.note || ''}
                    onChange={(e) => handleInputChange('note', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="간단한 메모..."
                    rows={3}
                />
            </div>
        </div>
    );

    const renderLinkForm = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">🔗 링크 정보 입력</h3>

            <div>
                <label className="block text-sm font-medium mb-1">URL *</label>
                <input
                    type="url"
                    value={formData.url || ''}
                    onChange={(e) => handleInputChange('url', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="https://example.com"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">제목</label>
                <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="링크 제목"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">메모</label>
                <textarea
                    value={formData.note || ''}
                    onChange={(e) => handleInputChange('note', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="간단한 메모..."
                    rows={3}
                />
            </div>
        </div>
    );

    const renderImageForm = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">🖼️ 이미지 첨부</h3>

            <div>
                <label className="block text-sm font-medium mb-1">이미지 파일 *</label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                />
                {coverFile && (
                    <p className="text-sm text-gray-500 mt-1">선택된 파일: {coverFile.name}</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">캡션</label>
                <input
                    type="text"
                    value={formData.caption || ''}
                    onChange={(e) => handleInputChange('caption', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:border-blue-400 focus:outline-none"
                    placeholder="이미지 설명"
                />
            </div>
        </div>
    );

    const renderInputForm = () => {
        switch (selectedType) {
            case 'book':
                return renderBookForm();
            case 'movie':
                return renderMovieForm();
            case 'link':
                return renderLinkForm();
            case 'image':
                return renderImageForm();
            default:
                return null;
        }
    };

    const canSave = () => {
        if (!selectedType) return false;

        switch (selectedType) {
            case 'book':
            case 'movie':
                return formData.title?.trim().length > 0;
            case 'link':
                return formData.url?.trim().length > 0;
            case 'image':
                return coverFile !== null;
            default:
                return false;
        }
    };

    if (!isOpen) return null;
    if (typeof window === 'undefined') return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                {step === 'select' ? renderTypeSelection() : renderInputForm()}

                <div className="flex gap-3 justify-end mt-6 pt-4 border-t">
                    {step === 'input' && (
                        <button
                            onClick={() => setStep('select')}
                            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
                            disabled={isUploading}
                        >
                            ← 뒤로
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
                        disabled={isUploading}
                    >
                        취소
                    </button>

                    {step === 'input' && (
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-gray-400"
                            disabled={!canSave() || isUploading}
                        >
                            {isUploading ? '업로드 중...' : '저장'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
