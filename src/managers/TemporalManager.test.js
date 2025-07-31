import { describe, it, expect } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { id } from '../support/utils.js';

describe('TemporalManager', () => {
    let nar;

    beforeEach(() => {
        nar = new NARHyper();
    });

    it('should derive transitive temporal relations correctly', () => {
        // A before B
        const intervalA = nar.temporalManager.interval('A', 10, 20);
        const intervalB = nar.temporalManager.interval('B', 30, 40);
        nar.temporalManager.temporalRelation(intervalA, intervalB, 'before');

        // B meets C
        const intervalC = nar.temporalManager.interval('C', 40, 50);
        nar.temporalManager.temporalRelation(intervalB, intervalC, 'meets');

        // Expected: A before C
        const expectedRelationId = id('TemporalRelation', [intervalA, intervalC, 'before']);
        expect(nar.hypergraph.has(expectedRelationId)).toBe(true);
    });

    it('should handle complex transitive derivations', () => {
        // A overlaps B
        const intervalA = nar.temporalManager.interval('A', 10, 30);
        const intervalB = nar.temporalManager.interval('B', 20, 40);
        nar.temporalManager.temporalRelation(intervalA, intervalB, 'overlaps');

        // B starts C
        const intervalC = nar.temporalManager.interval('C', 20, 50);
        nar.temporalManager.temporalRelation(intervalB, intervalC, 'starts');

        // Expected compositions for "overlaps" then "starts" are: "overlaps", "meets", "before"
        const expectedRelation1 = id('TemporalRelation', [intervalA, intervalC, 'overlaps']);
        const expectedRelation2 = id('TemporalRelation', [intervalA, intervalC, 'meets']);
        const expectedRelation3 = id('TemporalRelation', [intervalA, intervalC, 'before']);

        expect(nar.hypergraph.has(expectedRelation1)).toBe(true);
        expect(nar.hypergraph.has(expectedRelation2)).toBe(true);
        expect(nar.hypergraph.has(expectedRelation3)).toBe(true);
    });

    it('should correctly build the full composition table', () => {
        const manager = nar.temporalManager;
        const rel1 = 'after';
        const rel2 = 'finishedBy';

        // This composition is not in the hardcoded part of the table,
        // so it relies on the programmatic completion of the table.
        // The inverse of 'after' is 'before'. The inverse of 'finishedBy' is 'finishes'.
        // The composition of 'finishes' and 'before' is 'before'.
        // So the inverse of that result ('after') should be the answer.
        const composed = manager._composeTemporalRelations(rel1, rel2);

        expect(composed).toBeDefined();
        expect(composed).toContain('after');
    });

    it('should predict a future event based on a "before" relation', () => {
        const now = Date.now();
        const intervalA = nar.temporalManager.interval('A', now - 1000, now); // Event A just happened
        const intervalB = nar.temporalManager.interval('B', now + 4000, now + 5000); // Event B happens in 4-5 seconds
        nar.temporalManager.temporalRelation(intervalA, intervalB, 'before');

        // Predict 3 seconds into the future
        const predictions = nar.temporalManager.predict('A', 3000);

        expect(predictions.length).toBeGreaterThan(0);
        // Check if the expected consequence is among the predictions
        const consequencePrediction = predictions.find(p => p.type === 'consequence');
        expect(consequencePrediction).toBeDefined();
        expect(consequencePrediction.term).toBe(intervalB);
    });

    it('should adjust temporal horizon based on recent activity', () => {
        const initialHorizon = nar.config.temporalHorizon;

        // Add a lot of recent temporal activity
        const now = Date.now();
        for (let i = 0; i < 60; i++) {
            nar.temporalManager.interval(`RecentEvent${i}`, now - (i * 100), now - (i * 100) + 50);
        }

        nar.temporalManager.adjustTemporalHorizon();

        // With high activity, horizon should shrink
        const shrunkenHorizon = nar.config.temporalHorizon;
        expect(shrunkenHorizon).toBeLessThan(initialHorizon);

        // Clear intervals and check if it expands back
        nar.temporalManager.temporalIntervals.clear();
        nar.temporalManager.adjustTemporalHorizon();
        expect(nar.config.temporalHorizon).toBeGreaterThan(shrunkenHorizon);
    });
});
