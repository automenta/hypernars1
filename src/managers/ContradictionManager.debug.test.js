import {beforeEach, describe, expect, it} from '@jest/globals';
import {NAR} from '../NAR.js';

describe('AdvancedContradictionManager new resolution mechanism', () => {
    let nar;

    beforeEach(() => {
        nar = new NAR({
            useAdvanced: true,
            advancedContradictionManager: {
                // High thresholds to prevent automatic strategy selection
                dominantEvidenceFactor: 1000,
                sourceReliabilityDifferenceThreshold: 1000,
            }
        });
    });

    it('should correctly execute a merge resolution plan', () => {
        const statement = '<tweety --> flyer>.';

        // Use the parser to get the canonical ID for the hyperedge
        const parsed = nar.expressionEvaluator.parse(statement);
        const hyperedgeId = nar.expressionEvaluator._getParsedStructureId(parsed);

        // 1. Add two contradictory beliefs to the same hyperedge
        nar.nal(`${statement} %0.9;0.9%`);
        nar.nal(`${statement} %0.1;0.9%`);

        const hyperedge = nar.state.hypergraph.get(hyperedgeId);
        expect(hyperedge).toBeDefined();
        expect(hyperedge.beliefs.length).toBe(2);

        const belief1_original = hyperedge.beliefs[0];
        const belief2_original = hyperedge.beliefs[1];

        // 2. Manually trigger contradiction detection and resolution
        nar.contradictionManager.detectContradictions(hyperedgeId);
        const resolution = nar.contradictionManager.manualResolve(hyperedgeId, 'merge');

        // 3. Assert the resolution plan is what we expect from the planner
        expect(resolution.reason).toBe('merged');
        expect(resolution.revisions.length).toBe(2);
        expect(resolution.deletions.length).toBe(0);

        // 4. Assert that the hyperedge was modified correctly by the executor
        expect(hyperedge.beliefs.length).toBe(2);

        // 5. Assert the truth value was revised as expected for both beliefs
        // The revision formula for confidence is c = 1 - (1-c1)(1-c2)
        // For c1=0.9, c2=0.9, the result is 1 - (0.1*0.1) = 0.99
        for (const belief of hyperedge.beliefs) {
            expect(belief.truth.frequency).toBeCloseTo(0.5);
            expect(belief.truth.confidence).toBeCloseTo(0.99);
        }
    });
});
