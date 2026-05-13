/**
 * tripleParser — graph.jsonl 트리플 → 엔티티별 마크다운 페이지
 *
 * 출력 예시:
 * # 김철수
 * ## 관계
 * - **신뢰**: 이영희 (Grounded)
 * ## 태도
 * - **좋아한다**: 독서 (Speculative)
 * _마지막 업데이트: 2026-05-12_
 */

const TIER_LABEL = { Grounded: '🔵', Bridged: '🟡', Speculative: '⚪' };
const TIER_KO = { Grounded: '명시', Bridged: '추론', Speculative: '추측' };

/**
 * 특정 엔티티의 마크다운 페이지 생성
 * @param {string} entityName
 * @param {Array} allTriples
 * @returns {string}
 */
export function buildEntityPage(entityName, allTriples) {
    const name = entityName.trim();
    const related = allTriples.filter(
        t => normalize(t.subject) === normalize(name)
    );

    if (!related.length) {
        return `# ${name}\n\n_아직 기록된 정보가 없습니다._\n`;
    }

    const byType = groupBy(related, t => t.entity_type || 'stance');
    const sections = [];

    if (byType.person?.length) {
        sections.push(renderSection('관계', byType.person));
    }
    if (byType.relationship?.length) {
        sections.push(renderSection('관계', byType.relationship));
    }
    if (byType.stance?.length) {
        sections.push(renderSection('태도', byType.stance));
    }

    // 출처 메모 링크
    const memoIds = [...new Set(related.map(t => t.source_memo_id).filter(Boolean))];
    const sourceSection = memoIds.length
        ? `\n## 출처 메모\n${memoIds.map(id => `- \`${id}\``).join('\n')}\n`
        : '';

    const updatedAt = related
        .map(t => t.created_at)
        .filter(Boolean)
        .sort()
        .at(-1)
        ?.slice(0, 10) || '';

    return [
        `# ${name}`,
        '',
        ...sections,
        sourceSection,
        updatedAt ? `_마지막 업데이트: ${updatedAt}_` : '',
    ].join('\n').trimEnd() + '\n';
}

/**
 * 전체 트리플에서 등장하는 엔티티(subject) 목록
 * @param {Array} allTriples
 * @returns {string[]}
 */
export function listEntities(allTriples) {
    const seen = new Set();
    for (const t of allTriples) {
        if (t.subject) seen.add(t.subject.trim());
    }
    return [...seen].sort();
}

/**
 * 마크다운 라인에서 트리플 파싱 (markdownDiffer용)
 * `- **{predicate}**: {object} ({tier})` 형식
 * @param {string} line
 * @param {string} subject
 * @returns {{ subject, predicate, object, evidence_tier } | null}
 */
export function parseTripleLine(line, subject) {
    const match = line.match(/^-\s+\*\*(.+?)\*\*:\s+(.+?)(?:\s+\((\w+)\))?$/);
    if (!match) return null;
    const [, predicate, object, tier] = match;
    return {
        subject,
        predicate: predicate.trim(),
        object: object.trim(),
        evidence_tier: tier || 'Speculative',
    };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function renderSection(title, triples) {
    const lines = triples.map(t => {
        const icon = TIER_LABEL[t.evidence_tier] || '⚪';
        const ko = TIER_KO[t.evidence_tier] || '추측';
        return `- **${t.predicate}**: ${t.object} ${icon}`;
    });
    return `## ${title}\n${lines.join('\n')}\n`;
}

function normalize(str) {
    return String(str || '').toLowerCase().trim();
}

function groupBy(arr, keyFn) {
    const result = {};
    for (const item of arr) {
        const key = keyFn(item);
        if (!result[key]) result[key] = [];
        result[key].push(item);
    }
    return result;
}
