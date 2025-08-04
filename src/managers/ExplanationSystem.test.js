import {beforeEach, describe, expect, it} from '@jest/globals';
import {NARHyper} from '../NARHyper.js';
import {TruthValue} from '../support/TruthValue.js';

describe('ExplanationSystem', () => {
    it('should identify a direct assertion', () => {
        const nar = new NARHyper({useAdvanced: true});
        const termId = nar.nal('term.');
        const explanation = nar.explain(termId, {depth: 1, format: 'json'});
        const rootNode = JSON.parse(explanation);
        expect(rootNode.derivationRule).toBe('assertion');
    });

    it('should identify transitive inheritance', () => {
        const nar = new NARHyper({useAdvanced: true});
        const p1 = nar.inheritance('A', 'B');
        const p2 = nar.inheritance('B', 'C');

        // Manually create the conclusion, passing the derivation rule name
        const conclusion = nar.inheritance('A', 'C', {premises: [p1, p2], derivedBy: 'transitivity'});

        const explanation = nar.explain(conclusion, {depth: 3, format: 'json'});
        const rootNode = JSON.parse(explanation);

        expect(rootNode).toBeDefined();
        expect(rootNode.id).toBe(conclusion);
        expect(rootNode.derivationRule).toBe('transitivity');
        expect(rootNode.premises.length).toBe(2);
    });

    it('should identify analogy', () => {
        const nar = new NARHyper({useAdvanced: true});
        const p1 = nar.similarity('A', 'B');
        const p2 = nar.inheritance('A', 'C');

        // Manually create the conclusion, passing the derivation rule name
        const conclusion = nar.inheritance('B', 'C', {premises: [p1, p2], derivedBy: 'analogy'});

        const explanation = nar.explain(conclusion, {depth: 3, format: 'json'});
        const rootNode = JSON.parse(explanation);

        expect(rootNode).toBeDefined();
        expect(rootNode.id).toBe(conclusion);
        expect(rootNode.derivationRule).toBe('analogy');
    });

    it('should fallback to "assertion" for beliefs with no known derivation rule', () => {
        const nar = new NARHyper({useAdvanced: true});
        const p1 = nar.nal('premise1.');
        // The `derivedBy` is not specified, so it should be identified as a base assertion.
        const conclusion = nar.implication('premise1', 'conclusion', {premises: [p1]});

        const explanation = nar.explain(conclusion, {depth: 2, format: 'json'});
        const rootNode = JSON.parse(explanation);

        expect(rootNode).toBeDefined();
        expect(rootNode.id).toBe(conclusion);
        // It's an assertion from the perspective of the explanation system if no rule is logged
        expect(rootNode.derivationRule).toBe('assertion');
    });

    it('should explain a derived temporal relation using templates', () => {
        const nar = new NARHyper({useAdvanced: true});
        // Use the new API methods
        const t1 = nar.api.temporalInterval('event_A', 1000, 2000);
        const t2 = nar.api.temporalInterval('event_B', 3000, 4000);

        const rel1Id = nar.api.temporalConstraint(t1, t2, 'before');
        const conclusionId = rel1Id; // The relation itself is the conclusion

        const explanation = nar.explain(conclusionId, {format: 'detailed'});

        // The new formatter is more specific
        expect(explanation).toContain('CONCLUSION: TemporalRelation(TimeInterval(event_A, 1000, 2000), TimeInterval(event_B, 3000, 4000), before)');
        // Check for the template-based explanation
        expect(explanation).toContain('It is a direct assertion that');
    });

    describe('Explanation Formats', () => {
        let nar;
        let conclusionId;

        beforeEach(() => {
            nar = new NARHyper({useAdvanced: true});
            const p1 = nar.inheritance('A', 'B', {derivedBy: 'assertion'});
            const p2 = nar.inheritance('B', 'C', {derivedBy: 'assertion'});
            conclusionId = nar.inheritance('A', 'C', {premises: [p1, p2], derivedBy: 'transitivity'});
        });

        it('should generate a detailed explanation', () => {
            const explanation = nar.explain(conclusionId, {format: 'detailed'});
            expect(explanation).toContain('CONCLUSION: Inheritance(A, C)');
            expect(explanation).toContain('REASONING PATH:');
            expect(explanation).toContain('- Because Inheritance(A, B) and Inheritance(B, C), it follows through transitivity that Inheritance(A, C)');
            expect(explanation).toContain('  - It is a direct assertion that Inheritance(A, B)');
            expect(explanation).toContain('  - It is a direct assertion that Inheritance(B, C)');
        });

        it('should generate a concise explanation', () => {
            const explanation = nar.explain(conclusionId, {format: 'concise'});
            expect(explanation).toBe('Inheritance(A, C) -> Inheritance(A, B) -> Inheritance(B, C)');
        });

        it('should generate a technical explanation', () => {
            const explanation = nar.explain(conclusionId, {format: 'technical'});
            expect(explanation).toContain('Rule: transitivity');
            expect(explanation).toContain('Rule: assertion');
        });

        it('should generate a story explanation', () => {
            const explanation = nar.explain(conclusionId, {format: 'story'});
            expect(explanation).toContain('how I came to believe that A is a kind of C');
            expect(explanation).toContain('I know that A is a kind of B');
            expect(explanation).toContain('and that B is a kind of C');
        });
    });

    describe('Advanced Explanation Formats', () => {
        let nar;
        beforeEach(() => {
            nar = new NARHyper({useAdvanced: true});
        });

        it('should generate a justification with supporting and conflicting evidence', () => {
            const term = nar.api.inheritance('penguin', 'bird');
            // Add a conflicting belief
            nar.api.inheritance('penguin', 'bird', {truth: new TruthValue(0.2, 0.7)});

            const explanation = nar.explain(term, {format: 'justification'});

            expect(explanation).toContain('Justification for: Inheritance(penguin, bird)');
            expect(explanation).toContain('Supporting Evidence: This appears to be a base assertion.');
            expect(explanation).toContain('Conflicting Evidence (overridden or merged):');
            expect(explanation).toContain('An alternative belief exists with confidence');
        });

    });

    describe('Contradiction Explanations', () => {
        it('should include a note about a resolved contradiction in the justification', () => {
            const nar = new NARHyper({useAdvanced: true});
            const conceptId = 'Inheritance(penguin, flyer)';

            // Introduce two strong but contradictory beliefs
            nar.api.inheritance('penguin', 'flyer', {truth: new TruthValue(0.9, 0.9)});
            nar.api.inheritance('penguin', 'flyer', {truth: new TruthValue(0.1, 0.9)});

            // Manually resolve the contradiction
            nar.contradictionManager.resolveContradictions();

            // The hyperedge should still exist after a merge
            expect(nar.state.hypergraph.has(conceptId)).toBe(true);

            const explanation = nar.explain(conceptId, {format: 'justification'});
            expect(explanation).toContain("Note: This belief was part of a contradiction resolved via the 'merge' strategy.");
        });
    });
});