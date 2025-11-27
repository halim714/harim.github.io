import { extractTitle, extractTags } from '../utils/markdown';

/**
 * Front Matter 생성 (Legacy Logic Ported + Jekyll Compatible)
 */
export function generateFrontMatter(document) {
    const title = document.title || extractTitle(document.content);
    const titleMode = document.titleMode || 'auto';
    const now = new Date().toISOString();
    const createdAt = document.createdAt || now;
    const updatedAt = now; // 항상 현재 시간으로 갱신
    const id = document.id;

    // Jekyll 호환성을 위한 필드 추가
    const tags = document.tags || extractTags(document.content);
    const dateStr = createdAt.split('T')[0]; // YYYY-MM-DD

    // ✅ 배포 상태 추가
    const published = document.published || false;
    const status = document.status || (published ? 'published' : 'draft');

    // ✅ 기존 Front Matter 병합 (태그, 커스텀 필드 보존)
    const existingFrontMatter = document.frontMatter || {};

    // 기본 필드 외의 커스텀 필드만 추출
    const customFields = {};
    const excludeKeys = ['docId', 'title', 'titleMode', 'createdAt', 'updatedAt', 'published', 'status', 'permalink', 'layout', 'date', 'tags'];

    Object.keys(existingFrontMatter).forEach(key => {
        if (!excludeKeys.includes(key)) {
            customFields[key] = existingFrontMatter[key];
        }
    });

    // 커스텀 필드 YAML 문자열 생성
    let customFieldsYaml = '';
    if (Object.keys(customFields).length > 0) {
        customFieldsYaml = Object.entries(customFields)
            .map(([key, value]) => {
                if (typeof value === 'string') return `${key}: "${value.replace(/"/g, '\\"')}"`;
                return `${key}: ${JSON.stringify(value)}`;
            })
            .join('\n') + '\n';
    }

    return `---
docId: "${id}"
title: "${title.replace(/"/g, '\\"')}"
titleMode: "${titleMode}"
createdAt: "${createdAt}"
updatedAt: "${updatedAt}"
published: ${published}
status: ${status}
permalink: "/doc/${id}/"
layout: post
date: ${dateStr}
tags: [${tags.join(', ')}]
${customFieldsYaml}---
`;
}

/**
 * Publish용 마크다운 변환 (Front Matter 추가 + 링크 변환)
 */
export function prepareForPublish(document) {
    const frontMatter = generateFrontMatter(document);
    let content = document.content;

    // 내부 링크를 Jekyll 링크로 변환: [[docId]] -> [docId](/doc/docId/)
    // 참고: permalink가 /doc/:id/ 형식이므로 이에 맞춤
    content = content.replace(/\[\[([^\]]+)\]\]/g, '[$1](/doc/$1/)');

    return frontMatter + '\n' + content;
}
