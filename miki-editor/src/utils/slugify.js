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
    let counter = 1;
    let filename = `${slug}.md`;

    // existingFiles는 'filename.md' 형식의 배열이라고 가정
    while (existingFiles.includes(filename)) {
        filename = `${slug}-${counter}.md`;
        counter++;
    }

    return filename;
}
