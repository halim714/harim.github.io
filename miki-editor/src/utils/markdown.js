import yaml from 'js-yaml';

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
 * Front Matter 파싱 (Production-Grade)
 * - js-yaml 사용으로 안전성 확보
 * - 유연한 정규식으로 Double Front Matter 방지
 */
export function parseFrontMatter(content) {
    if (!content) return { data: {}, content: '' };

    // ✅ 유연한 정규식: 공백 허용, 줄바꿈 방식 무관 (\r\n 지원)
    const frontMatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
        return {
            data: {},
            content: content
        };
    }

    const yamlBlock = match[1];
    const body = match[2];

    try {
        // ✅ js-yaml로 안전하게 파싱
        const data = yaml.load(yamlBlock) || {};
        return { data, content: body };
    } catch (error) {
        console.error('❌ [YAML-PARSE] Front Matter 파싱 실패:', error);
        // 파싱 실패 시 안전하게 원본 반환
        return {
            data: {},
            content: content
        };
    }
}

/**
 * Front Matter 생성 (Production-Grade)
 * - js-yaml 사용으로 안전하게 직렬화
 */
export function stringifyFrontMatter(data) {
    if (!data || Object.keys(data).length === 0) {
        return '';
    }

    try {
        // ✅ js-yaml로 안전하게 직렬화
        const yamlString = yaml.dump(data, {
            indent: 2,
            lineWidth: -1, // 줄바꿈 안 함
            noRefs: true,  // 참조 사용 안 함
            sortKeys: false // 키 정렬 안 함 (입력 순서 유지)
        });

        return `---\n${yamlString}---\n`;
    } catch (error) {
        console.error('❌ [YAML-STRINGIFY] Front Matter 생성 실패:', error);
        return '';
    }
}
