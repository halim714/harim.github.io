/**
 * 충돌 없는 고유 문서 ID 생성
 */
export function generateDocumentId() {
    // ✅ crypto.randomUUID() 사용 (RFC 4122 표준)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback (older browsers)
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 임시 메모 ID인지 확인
 */
export function isTemporaryId(id) {
    return !id || id.startsWith('memo_');
}

/**
 * UUID 형식인지 확인
 */
export function isUUID(id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}
