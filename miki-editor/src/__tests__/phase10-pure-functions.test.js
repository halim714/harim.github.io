/**
 * phase10-pure-functions.test.js
 * Phase 10 핵심 pure function 단위 테스트
 *
 * 대상:
 * 1. tripleParser.buildEntityPage
 * 2. markdownDiffer.diffMarkdown
 * 3. reflectionEngine.classifyTriple
 * 4. interventionResolver.selectRelevantInterventions
 */

// ── 1. tripleParser.buildEntityPage ──────────────────────────────────────────

describe('tripleParser.buildEntityPage', () => {
    let buildEntityPage;

    beforeAll(async () => {
        const mod = await import('../wiki/tripleParser');
        buildEntityPage = mod.buildEntityPage;
    });

    it('엔티티 정보 없을 때 기본 메시지를 반환한다', () => {
        const result = buildEntityPage('김철수', []);
        expect(result).toContain('# 김철수');
        expect(result).toContain('아직 기록된 정보가 없습니다');
    });

    it('stance 트리플을 태도 섹션으로 렌더링한다', () => {
        const triples = [
            { subject: '김철수', predicate: '좋아한다', object: '독서', entity_type: 'stance', evidence_tier: 'Grounded', source_memo_id: 'memo-1', created_at: '2026-05-13' },
        ];
        const result = buildEntityPage('김철수', triples);
        expect(result).toContain('# 김철수');
        expect(result).toContain('## 태도');
        expect(result).toContain('**좋아한다**: 독서');
    });

    it('대소문자 무관하게 subject 매칭한다', () => {
        const triples = [
            { subject: '김철수', predicate: '신뢰', object: '이영희', entity_type: 'person', evidence_tier: 'Grounded', source_memo_id: 'memo-1', created_at: '2026-05-13' },
        ];
        const result = buildEntityPage('김철수', triples);
        expect(result).toContain('## 관계');
        expect(result).toContain('**신뢰**: 이영희');
    });

    it('출처 메모 ID가 포함된다', () => {
        const triples = [
            { subject: '김철수', predicate: '좋아한다', object: '음악', entity_type: 'stance', evidence_tier: 'Bridged', source_memo_id: 'memo-42', created_at: '2026-05-01' },
        ];
        const result = buildEntityPage('김철수', triples);
        expect(result).toContain('memo-42');
        expect(result).toContain('마지막 업데이트: 2026-05-01');
    });

    it('다른 subject 트리플은 포함하지 않는다', () => {
        const triples = [
            { subject: '이영희', predicate: '좋아한다', object: '음악', entity_type: 'stance', evidence_tier: 'Grounded' },
        ];
        const result = buildEntityPage('김철수', triples);
        expect(result).toContain('아직 기록된 정보가 없습니다');
        expect(result).not.toContain('이영희');
    });
});

// ── 2. markdownDiffer.diffMarkdown ───────────────────────────────────────────

describe('markdownDiffer.diffMarkdown', () => {
    let diffMarkdown;

    beforeAll(async () => {
        const mod = await import('../wiki/markdownDiffer');
        diffMarkdown = mod.diffMarkdown;
    });

    const entity = '김철수';

    it('동일한 마크다운이면 added/removed 모두 빈 배열이다', () => {
        const md = '# 김철수\n\n## 태도\n- **좋아한다**: 독서 (Grounded)\n';
        const result = diffMarkdown(md, md, entity);
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
    });

    it('새 라인 추가 시 added에 포함된다', () => {
        const original = '# 김철수\n\n## 태도\n- **좋아한다**: 독서 (Grounded)\n';
        const edited = '# 김철수\n\n## 태도\n- **좋아한다**: 독서 (Grounded)\n- **싫어한다**: 소음 (Speculative)\n';
        const result = diffMarkdown(original, edited, entity);
        expect(result.added).toHaveLength(1);
        expect(result.added[0].predicate).toBe('싫어한다');
        expect(result.added[0].object).toBe('소음');
        expect(result.removed).toHaveLength(0);
    });

    it('기존 라인 삭제 시 removed에 포함된다', () => {
        const original = '# 김철수\n\n## 태도\n- **좋아한다**: 독서 (Grounded)\n- **싫어한다**: 소음 (Speculative)\n';
        const edited = '# 김철수\n\n## 태도\n- **좋아한다**: 독서 (Grounded)\n';
        const result = diffMarkdown(original, edited, entity);
        expect(result.removed).toHaveLength(1);
        expect(result.removed[0].predicate).toBe('싫어한다');
        expect(result.added).toHaveLength(0);
    });

    it('predicate는 동일하고 object가 다르면 removed+added 각 1건이다', () => {
        const original = '# 김철수\n\n## 태도\n- **좋아한다**: 독서 (Grounded)\n';
        const edited = '# 김철수\n\n## 태도\n- **좋아한다**: 음악 (Grounded)\n';
        const result = diffMarkdown(original, edited, entity);
        expect(result.removed).toHaveLength(1);
        expect(result.added).toHaveLength(1);
        expect(result.removed[0].object).toBe('독서');
        expect(result.added[0].object).toBe('음악');
    });
});

// ── 3. reflectionEngine.classifyTriple ───────────────────────────────────────

describe('reflectionEngine.classifyTriple', () => {
    let classifyTriple;

    beforeAll(async () => {
        const mod = await import('../services/reflectionEngine');
        classifyTriple = mod.classifyTriple;
    });

    const prior = [
        { subject: '김철수', predicate: '좋아한다', object: '독서', id: 'p1' },
        { subject: '이영희', predicate: '신뢰한다', object: '김철수', id: 'p2' },
    ];

    it('완전 일치(subject+predicate+object)는 Consistent를 반환한다', () => {
        const newTriple = { subject: '김철수', predicate: '좋아한다', object: '독서' };
        expect(classifyTriple(newTriple, prior)).toBe('Consistent');
    });

    it('subject는 일치하지만 predicate/object가 다르면 Extending을 반환한다', () => {
        const newTriple = { subject: '김철수', predicate: '좋아한다', object: '음악' };
        expect(classifyTriple(newTriple, prior)).toBe('Extending');
    });

    it('subject 자체가 Prior에 없으면 Extending을 반환한다', () => {
        const newTriple = { subject: '박민수', predicate: '좋아한다', object: '독서' };
        expect(classifyTriple(newTriple, prior)).toBe('Extending');
    });

    it('대소문자·공백 무관하게 Consistent로 처리한다', () => {
        const newTriple = { subject: '  김철수  ', predicate: '  좋아한다  ', object: '  독서  ' };
        expect(classifyTriple(newTriple, prior)).toBe('Consistent');
    });

    it('Prior가 비어있으면 항상 Extending이다', () => {
        const newTriple = { subject: '김철수', predicate: '좋아한다', object: '독서' };
        expect(classifyTriple(newTriple, [])).toBe('Extending');
    });
});

// ── 4. interventionResolver.selectRelevantInterventions ──────────────────────

describe('interventionResolver.selectRelevantInterventions', () => {
    let selectRelevantInterventions;

    beforeAll(async () => {
        const mod = await import('../services/interventionResolver');
        selectRelevantInterventions = mod.selectRelevantInterventions;
    });

    const now = new Date().toISOString();
    const recent = now; // last_used_at이 현재 → 활성

    // 1년 전 날짜 생성
    const dormantDate = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString();

    const interventions = [
        { id: 'i1', scope: 'always', subject: 'A', predicate: 'p', object: 'B', last_used_at: dormantDate },
        { id: 'i2', scope: 'entity:김철수', subject: 'A', predicate: 'p', object: 'C', last_used_at: recent },
        { id: 'i3', scope: 'entity:이영희', subject: 'D', predicate: 'p', object: 'E', last_used_at: recent },
        { id: 'i4', scope: 'concept:독서', subject: 'F', predicate: 'p', object: 'G', last_used_at: recent },
        { id: 'i5', scope: 'entity:박민수', subject: 'H', predicate: 'p', object: 'I', last_used_at: dormantDate },
    ];

    it('scope:always는 dormant 여부와 무관하게 항상 포함된다', () => {
        const result = selectRelevantInterventions(interventions, {});
        expect(result.map(r => r.id)).toContain('i1');
    });

    it('scope:entity:X는 context.entities에 X가 있을 때 포함된다', () => {
        const result = selectRelevantInterventions(interventions, { entities: ['김철수'] });
        const ids = result.map(r => r.id);
        expect(ids).toContain('i2');
        expect(ids).not.toContain('i3');
    });

    it('scope:concept:Y는 context.concepts에 Y가 있을 때 포함된다', () => {
        const result = selectRelevantInterventions(interventions, { concepts: ['독서', '음악'] });
        const ids = result.map(r => r.id);
        expect(ids).toContain('i4');
    });

    it('1년 이상 dormant이고 scope가 always가 아니면 제외된다', () => {
        const result = selectRelevantInterventions(interventions, { entities: ['박민수'] });
        const ids = result.map(r => r.id);
        // i5는 entity:박민수 매칭이지만 dormant → 제외
        expect(ids).not.toContain('i5');
    });

    it('매칭 없으면 scope:always만 반환된다', () => {
        const result = selectRelevantInterventions(interventions, { entities: [], concepts: [] });
        expect(result.every(r => r.scope === 'always')).toBe(true);
    });
});
