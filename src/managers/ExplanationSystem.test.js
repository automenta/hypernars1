import {describe, expect, it} from '@jest/globals';
import {NARHyper} from '../NARHyper.js';

describe('ExplanationSystem', () => {
    it('should identify a direct assertion', () => {
        const nar = new NARHyper();
        const termId = nar.nal('term.');
        const explanation = nar.explain(termId, { depth: 1, format: 'json' });
        const path = JSON.parse(explanation);
        expect(path[0].derivationRule).toBe('assertion');
    });

    it('should identify transitive inheritance', () => {
        const nar = new NARHyper();
        const p1 = nar.inheritance('A', 'B');
        const p2 = nar.inheritance('B', 'C');

        // Manually create the conclusion, passing the derivation rule name
        const conclusion = nar.inheritance('A', 'C', { premises: [p1, p2], derivedBy: 'transitivity' });

        const explanation = nar.explain(conclusion, { depth: 3, format: 'json' });
        const path = JSON.parse(explanation);

        const conclusionStep = path.find(step => step.id === conclusion);
        expect(conclusionStep).toBeDefined();
        expect(conclusionStep.derivationRule).toBe('transitivity');
    });

    it('should identify analogy', () => {
        const nar = new NARHyper();
        const p1 = nar.similarity('A', 'B');
        const p2 = nar.inheritance('A', 'C');

        // Manually create the conclusion, passing the derivation rule name
        const conclusion = nar.inheritance('B', 'C', { premises: [p1, p2], derivedBy: 'analogy' });

        const explanation = nar.explain(conclusion, { depth: 3, format: 'json' });
        const path = JSON.parse(explanation);

        const conclusionStep = path.find(step => step.id === conclusion);
        expect(conclusionStep).toBeDefined();
        expect(conclusionStep.derivationRule).toBe('analogy');
    });

    it('should fallback to "derived" for unknown patterns', () => {
        const nar = new NARHyper();
        const p1 = nar.nal('premise1.');
        const conclusion = nar.implication('premise1', 'conclusion', { premises: [p1] });

        const explanation = nar.explain(conclusion, { depth: 2, format: 'json' });
        const path = JSON.parse(explanation);

        const conclusionStep = path.find(step => step.id === conclusion);
        expect(conclusionStep).toBeDefined();
        expect(conclusionStep.derivationRule).toBe('derived');
    });

    it('should explain a derived temporal relation', () => {
        const nar = new NARHyper();
        const t1 = nar.temporalManager.during('event_A', 1000, 2000);
        const t2 = nar.temporalManager.during('event_B', 3000, 4000);
        const t3 = nar.temporalManager.during('event_C', 5000, 6000);

        const rel1Id = nar.temporalManager.relate(t1, t2, 'before');
        const rel2Id = nar.temporalManager.relate(t2, t3, 'before');

        const conclusionId = nar.api.addHyperedge('TemporalRelation', [t1, t3, 'before'], {
            premises: [rel1Id, rel2Id],
            derivedBy: 'TransitiveTemporal'
        });

        const explanation = nar.explain(conclusionId, { format: 'detailed' });

        expect(explanation).toContain('CONCLUSION: TimeInterval before TimeInterval');
        expect(explanation).toContain('[TransitiveTemporal] TimeInterval before TimeInterval');
        expect(explanation).toContain('[assertion] TimeInterval before TimeInterval');
    });

    describe('Explanation Formats', () => {
        let nar;
        let conclusionId;

        beforeEach(() => {
            nar = new NARHyper();
            const p1 = nar.inheritance('A', 'B', { derivedBy: 'assertion' });
            const p2 = nar.inheritance('B', 'C', { derivedBy: 'assertion' });
            conclusionId = nar.inheritance('A', 'C', { premises: [p1, p2], derivedBy: 'transitivity' });
        });

        it('should generate a detailed explanation', () => {
            const explanation = nar.explain(conclusionId, { format: 'detailed' });
            expect(explanation).toContain('CONCLUSION: Inheritance(A, C)');
            expect(explanation).toContain('PRIMARY REASONING PATH:');
            expect(explanation).toContain('[transitivity] Inheritance(A, C)');
            expect(explanation).toContain('[assertion] Inheritance(A, B)');
            expect(explanation).toContain('[assertion] Inheritance(B, C)');
        });

        it('should generate a concise explanation', () => {
            const explanation = nar.explain(conclusionId, { format: 'concise' });
            // Check for the components, as premise order isn't guaranteed
            expect(explanation).toContain('Inheritance(A, B)');
            expect(explanation).toContain('Inheritance(B, C)');
            expect(explanation).toContain('Inheritance(A, C)');
            expect(explanation).toContain('->');
        });

        it('should generate a technical explanation', () => {
            const explanation = nar.explain(conclusionId, { format: 'technical' });
            expect(explanation).toContain('TECHNICAL REASONING TRACE:');
            expect(explanation).toContain('ID: Inheritance(A,C)');
            expect(explanation).toContain('DerivedBy: transitivity');
            expect(explanation).toContain('ID: Inheritance(A,B)');
            expect(explanation).toContain('DerivedBy: assertion');
        });

        it('should generate a story explanation', () => {
            const explanation = nar.explain(conclusionId, { format: 'story' });
            expect(explanation).toContain('Let me tell you how I came to believe that A is a kind of C.');
            // Check for the core content of the premises, as order and joining words can vary
            expect(explanation).toContain('A is a kind of B');
            expect(explanation).toContain('B is a kind of C');
        });
    });
});
