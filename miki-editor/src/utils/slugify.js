/**
 * 제목을 URL 친화적인 파일명으로 변환 (Legacy Logic Ported)
 * 예: "나의 첫 번째 메모" → "나의-첫-번째-메모"
 */
export function slugify(text) {
    if (!text || typeof text !== 'string') {
        return `post-${Date.now()}`;
    }

    const slug = text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9가-힣]/g, '-') // 한글, 영문, 숫자 외에는 하이픈으로
        .replace(/-+/g, '-')             // 연속된 하이픈 하나로
        .replace(/^-|-$/g, '');          // 앞뒤 하이픈 제거

    return slug || `post-${Date.now()}`;
}

/**
 * 고유한 파일명 생성 (충돌 방지)
 */
export function generateUniqueFilename(title, existingFiles = []) {
    let slug = slugify(title);
    let filename = `${slug}.md`;

    // existingFiles는 'filename.md' 형식의 배열이라고 가정
    if (existingFiles.includes(filename)) {
        // 🟢 [PRD Phase 2] 충돌 시 Short UUID 사용
        // crypto가 있으면 사용, 없으면 Math.random fallback
        const randomSuffix = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).substring(2, 10);

        filename = `${slug}-${randomSuffix}.md`;
    }

    return filename;
}

// ============================================
// 새 파일명 패턴 (YYYYMMDD-slug-uuid8.md)
// ============================================

/**
 * 새 파일명 패턴 상수
 */
const FILENAME_PATTERN = /^(\d{8})-(.+)-([a-f0-9]{8})$/;
const MAX_SLUG_LENGTH = 40;

/**
 * 날짜를 YYYYMMDD 형식으로 변환
 * @param {string|Date} date - ISO 날짜 문자열 또는 Date 객체
 * @returns {string} YYYYMMDD 형식 문자열
 */
export function formatDateForFilename(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * 슬러그 길이 제한 (한글 40자 기준)
 * @param {string} slug - slugify된 문자열
 * @param {number} maxLength - 최대 길이 (기본 40)
 * @returns {string} 절삭된 슬러그
 */
export function truncateSlug(slug, maxLength = MAX_SLUG_LENGTH) {
    if (slug.length <= maxLength) return slug;

    // 단어 경계(하이픈)에서 자르기
    const truncated = slug.substring(0, maxLength);
    const lastHyphen = truncated.lastIndexOf('-');

    return lastHyphen > maxLength * 0.5
        ? truncated.substring(0, lastHyphen)
        : truncated;
}

/**
 * 새 파일명 생성
 * @param {string} createdAt - ISO 날짜 문자열
 * @param {string} title - 문서 제목
 * @param {string} docId - UUID (전체)
 * @returns {string} 파일명 (확장자 제외)
 */
export function generateFilename(createdAt, title, docId) {
    const date = formatDateForFilename(createdAt);
    const slug = truncateSlug(slugify(title));
    const uuid8 = docId.substring(0, 8).toLowerCase();

    return `${date}-${slug}-${uuid8}`;
}

/**
 * 파일명 파싱 (새 패턴 + 구 패턴 호환)
 * @param {string} filename - 파일명 (.md 포함 가능)
 * @returns {object} { date, slug, uuid8, isLegacy }
 */
export function parseFilename(filename) {
    const name = filename.replace(/\.md$/, '');
    const match = name.match(FILENAME_PATTERN);

    if (!match) {
        // 구 패턴: slug만 있는 경우 (마이그레이션 전 파일)
        return {
            date: null,
            slug: name,
            uuid8: null,
            isLegacy: true
        };
    }

    return {
        date: match[1],      // 20240117
        slug: match[2],      // 나의-생각-그리고-더 (하이픈 포함 OK)
        uuid8: match[3],     // a1b2c3d4
        isLegacy: false
    };
}

/**
 * 문서 파일 여부 검증
 * @param {string} path - 파일 경로 (예: miki-editor/posts/test.md)
 * @param {string} filename - 파일명 (예: test.md)
 * @returns {boolean}
 */
export function isDocumentFile(path, filename) {
    // 1. 확장자 검증
    if (!filename.endsWith('.md')) return false;

    // 2. 시스템 파일 명시적 제외
    const systemFiles = [
        'README.md',
        '_config.yml',
        '.gitkeep',
        '.gitignore',
        'index.md',
        'LICENSE.md',
        'CHANGELOG.md'
    ];
    if (systemFiles.includes(filename)) {
        console.log(`⏭️ [Filter] 시스템 파일 제외: ${filename}`);
        return false;
    }

    // 3. 폴더 경로 검증 (miki-editor/posts/ 내부만 허용)
    if (!path.startsWith('miki-editor/posts/')) {
        console.log(`⏭️ [Filter] 경로 제외: ${path}`);
        return false;
    }

    // 4. 숨김 파일 및 템플릿 파일 제외
    if (filename.startsWith('.') || filename.startsWith('_')) {
        console.log(`⏭️ [Filter] 숨김/템플릿 파일 제외: ${filename}`);
        return false;
    }

    return true;
}
