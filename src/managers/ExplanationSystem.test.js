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

    it('should fallback to "assertion" for beliefs with no known derivation rule', () => {
        const nar = new NARHyper();
        const p1 = nar.nal('premise1.');
        // The `derivedBy` is not specified, so it should be identified as a base assertion.
        const conclusion = nar.implication('premise1', 'conclusion', { premises: [p1] });

        const explanation = nar.explain(conclusion, { depth: 2, format: 'json' });
        const path = JSON.parse(explanation);

        const conclusionStep = path.find(step => step.id === conclusion);
        expect(conclusionStep).toBeDefined();
        // It's an assertion from the perspective of the explanation system if no rule is logged
        expect(conclusionStep.derivationRule).toBe('assertion');
    });

    it('should explain a derived temporal relation using templates', () => {
        const nar = new NARHyper();
        // Use the new API methods
        const t1 = nar.api.temporalInterval('event_A', 1000, 2000);
        const t2 = nar.api.temporalInterval('event_B', 3000, 4000);

        const rel1Id = nar.api.temporalConstraint(t1, t2, 'before');
        const conclusionId = rel1Id; // The relation itself is the conclusion

        const explanation = nar.explain(conclusionId, { format: 'detailed' });

        // The new formatter is more specific
        expect(explanation).toContain('CONCLUSION: TemporalRelation(TimeInterval(event_A,1000,2000), TimeInterval(event_B,3000,4000), before)');
        // Check for the template-based explanation
        expect(explanation).toContain('It is a direct assertion that');
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
            // Check for the new template-based output
            expect(explanation).toContain('Because Inheritance(A, B) and Inheritance(B, C), it follows through transitivity that Inheritance(A, C).');
        });

        it('should generate a concise explanation', () => {
            const explanation = nar.explain(conclusionId, { format: 'concise' });
            // The new concise format is a linear path
            expect(explanation).toBe('Inheritance(A, B) -> Inheritance(A, C)');
        });

        it('should generate a technical explanation', () => {
            const explanation = nar.explain(conclusionId, { format: 'technical' });
            expect(explanation).toContain('Step 1: [Inheritance(A,B)] Inheritance(A, B)');
            expect(explanation).toContain('Rule: assertion');
            expect(explanation).toContain('Step 2: [Inheritance(A,C)] Inheritance(A, C)');
            expect(explanation).toContain('Rule: transitivity');
        });

        it('should generate a story explanation', () => {
            const explanation = nar.explain(conclusionId, { format: 'story' });
            expect(explanation).toContain('I came to believe that A is a kind of C');
            // Check for the core content of the premises, as order and joining words can vary
            expect(explanation).toContain('I know that A is a kind of B');
        });
    });
});
