/**
 * markdownDiffer — 사용자 편집 마크다운 → 트리플 변경 감지
 *
 * tripleParser가 생성한 구조화된 마크다운(`- **predicate**: object`)을
 * 정규식으로 파싱해 추가/삭제된 트리플을 반환.
 * NLP 불필요 — 구조화된 형식만 처리.
 */

import { parseTripleLine } from './tripleParser';

/**
 * 마크다운 원문 vs 편집본 비교 → 트리플 변경 추출
 *
 * @param {string} original - buildEntityPage() 출력 (편집 전)
 * @param {string} edited   - 사용자 편집 후 마크다운
 * @param {string} entityName - 페이지 주체 엔티티
 * @returns {{ added: Array, removed: Array }}
 */
export function diffMarkdown(original, edited, entityName) {
    const originalLines = extractTripleLines(original, entityName);
    const editedLines = extractTripleLines(edited, entityName);

    const originalSet = new Map(originalLines.map(t => [tripleKey(t), t]));
    const editedSet = new Map(editedLines.map(t => [tripleKey(t), t]));

    const added = [];
    const removed = [];

    for (const [key, triple] of editedSet) {
        if (!originalSet.has(key)) added.push(triple);
    }

    for (const [key, triple] of originalSet) {
        if (!editedSet.has(key)) removed.push(triple);
    }

    return { added, removed };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractTripleLines(markdown, subject) {
    const triples = [];
    for (const line of markdown.split('\n')) {
        const t = parseTripleLine(line.trim(), subject);
        if (t) triples.push(t);
    }
    return triples;
}

function tripleKey(t) {
    return `${normalize(t.subject)}|${normalize(t.predicate)}|${normalize(t.object)}`;
}

function normalize(str) {
    return String(str || '').toLowerCase().trim();
}
