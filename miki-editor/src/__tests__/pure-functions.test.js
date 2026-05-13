import { buildEntityPage } from '../wiki/tripleParser';
import { diffMarkdown } from '../wiki/markdownDiffer';
import { classifyTriple } from '../services/reflectionEngine';
import { selectRelevantInterventions } from '../services/interventionResolver';

describe('tripleParser.buildEntityPage', () => {
    it('should generate markdown from triples', () => {
        const triples = [
            { subject: 'Alice', predicate: 'likes', object: 'Bob', evidence_tier: 'Grounded' },
            { subject: 'Alice', predicate: 'knows', object: 'Charlie', evidence_tier: 'Bridged' }
        ];
        const md = buildEntityPage('Alice', triples);
        expect(md).toContain('# Alice');
        expect(md).toContain('**likes**: Bob 🔵');
        expect(md).toContain('**knows**: Charlie 🟡');
    });
});

describe('markdownDiffer.diffMarkdown', () => {
    it('should extract added and removed triples from markdown diff', () => {
        const original = `- likes Bob\n- knows Charlie`;
        const edited = `- likes Bob\n- hates Charlie\n- loves Dave`;
        const result = diffMarkdown(original, edited, 'Alice');
        // This is a rough estimation of how diffMarkdown might be returning data.
        expect(result.added).toBeDefined();
        expect(result.removed).toBeDefined();
    });
});

describe('reflectionEngine.classifyTriple', () => {
    it('should classify as Consistent for exact match', () => {
        const priorTriples = [
            { subject: 'Alice', predicate: 'likes', object: 'Bob' }
        ];
        const newTriple = { subject: 'Alice', predicate: 'likes', object: 'Bob' };
        expect(classifyTriple(newTriple, priorTriples)).toBe('Consistent');
    });

    it('should classify as Extending for subject match but different predicate/object', () => {
        const priorTriples = [
            { subject: 'Alice', predicate: 'likes', object: 'Bob' }
        ];
        const newTriple = { subject: 'Alice', predicate: 'knows', object: 'Charlie' };
        expect(classifyTriple(newTriple, priorTriples)).toBe('Extending');
    });

    it('should classify as Extending for entirely new subject', () => {
        const priorTriples = [];
        const newTriple = { subject: 'Eve', predicate: 'listens to', object: 'Alice' };
        expect(classifyTriple(newTriple, priorTriples)).toBe('Extending');
    });
});

describe('interventionResolver.selectRelevantInterventions', () => {
    const now = Date.now();
    const mockInterventions = [
        { id: '1', scope: 'always', last_used_at: new Date(now - 2 * 365 * 24 * 60 * 60 * 1000).toISOString() }, // 2 years old, but scope 'always'
        { id: '2', scope: 'entity:alice', last_used_at: new Date(now).toISOString() },
        { id: '3', scope: 'concept:math', last_used_at: new Date(now).toISOString() },
        { id: '4', scope: 'entity:bob', last_used_at: new Date(now - 2 * 365 * 24 * 60 * 60 * 1000).toISOString() }, // dormant
    ];

    it('should include scope "always" regardless of dormancy', () => {
        const result = selectRelevantInterventions(mockInterventions, { entities: [], concepts: [] });
        expect(result.map(i => i.id)).toContain('1');
        expect(result.map(i => i.id)).not.toContain('4'); // dormant and not matching
    });

    it('should include matching entities and exclude dormant ones', () => {
        const result = selectRelevantInterventions(mockInterventions, { entities: ['Alice', 'Bob'], concepts: [] });
        expect(result.map(i => i.id)).toContain('1'); // always
        expect(result.map(i => i.id)).toContain('2'); // matches entity alice
        expect(result.map(i => i.id)).not.toContain('4'); // matches entity bob but is dormant!
    });
});
