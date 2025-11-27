/**
 * 마크다운에서 제목 추출 (Legacy Logic Ported)
 */
export function extractTitle(content) {
    if (!content || content.trim() === '') return 'New memo';

    // 1. 첫 번째 # 헤더 찾기
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) return titleMatch[1].trim();

    // 2. 헤더가 없으면 첫 줄 사용 (50자 제한)
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim() || '';

    if (firstLine === '') return 'New memo';

    return firstLine
        .replace(/^#+\s*/, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .trim()
        .slice(0, 50) || 'New memo';
}

/**
 * 마크다운에서 내부 링크 추출 ([[link]])
 */
export function extractInternalLinks(markdown) {
    if (!markdown) return [];
    const linkPattern = /\[\[([^\]]+)\]\]/g;
    const links = [];
    let match;
    while ((match = linkPattern.exec(markdown)) !== null) {
        links.push(match[1].trim());
    }
    return [...new Set(links)];
}

/**
 * 마크다운에서 태그 추출 (#tag)
 */
export function extractTags(markdown) {
    if (!markdown) return [];
    const tagPattern = /#([a-zA-Z가-힣0-9_-]+)/g;
    const tags = [];
    let match;
    while ((match = tagPattern.exec(markdown)) !== null) {
        tags.push(match[1]);
    }
    return [...new Set(tags)];
}

/**
 * 메타데이터 추출 통합 함수
 */
export function extractMetadata(markdown) {
    return {
        title: extractTitle(markdown),
        internalLinks: extractInternalLinks(markdown),
        tags: extractTags(markdown),
        wordCount: markdown.split(/\s+/).length,
        characterCount: markdown.length,
        lastModified: new Date().toISOString()
    };
}

/**
 * Front Matter 파싱 (Browser-safe Regex implementation)
 * (Restored for GraphQL integration)
 */
/**
 * Front Matter 파싱 + docId 추출 우선순위
 */
export function parseFrontMatter(content) {
    if (!content) return { data: {}, content: '' };

    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
        return {
            data: {},
            content: content
        };
    }

    const yamlBlock = match[1];
    const body = match[2];
    const data = {};

    // Simple YAML parser (key: value)
    yamlBlock.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let value = parts.slice(1).join(':').trim();

            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            // Parse booleans
            if (value === 'true') value = true;
            if (value === 'false') value = false;

            data[key] = value;
        }
    });

    return { data, content: body };
}

/**
 * Front Matter 생성 (docId 포함)
 */
export function stringifyFrontMatter(data) {
    const lines = Object.entries(data).map(([key, value]) => {
        if (typeof value === 'boolean') {
            return `${key}: ${value}`;
        } else if (typeof value === 'string') {
            return `${key}: "${value.replace(/"/g, '\\"')}"`;
        } else {
            return `${key}: ${value}`;
        }
    });

    return `---\n${lines.join('\n')}\n---\n`;
}
