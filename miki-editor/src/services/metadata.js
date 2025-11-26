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

    return `---
docId: "${id}"
title: "${title.replace(/"/g, '\\"')}"
titleMode: "${titleMode}"
createdAt: "${createdAt}"
updatedAt: "${updatedAt}"
permalink: "/doc/${id}/"
layout: post
date: ${dateStr}
tags: [${tags.join(', ')}]
---
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
