import { describe, it, expect } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';

describe('MetaReasoner', () => {
    it('should track source reliability', () => {
        const nar = new NARHyper();
        const beliefId = nar.nal('a.');

        nar.metaReasoner.recordSource(beliefId, 'test_source');

        const effectiveness = nar.metaReasoner.getStrategyEffectiveness('source:test_source');
        // It's initialized with 5/10 successes and full recency, so (0.5 * 0.8) + (1.0 * 0.2) = 0.6
        expect(effectiveness).toBeCloseTo(0.6);
    });

    it('should update derivationPriority based on rule effectiveness', () => {
        const nar = new NARHyper();

        // Simulate a history of 'Inheritance' being more successful than 'Similarity'
        nar.metaReasoner.trackOutcome('derive_Inheritance', 'success');
        nar.metaReasoner.trackOutcome('derive_Inheritance', 'success');
        nar.metaReasoner.trackOutcome('derive_Similarity', 'failure');
        nar.metaReasoner.trackOutcome('derive_Similarity', 'failure');

        // Run optimization
        nar.metaReasoner.optimizeResources();

        const priorityList = nar.config.derivationPriority;

        expect(priorityList).toBeDefined();
        // Inheritance should now have a higher priority (appear earlier in the list)
        expect(priorityList.indexOf('Inheritance')).toBeLessThan(priorityList.indexOf('Similarity'));
    });

    it('should adjust resource allocation based on performance', () => {
        const nar = new NARHyper();
        const initialBudgetThreshold = nar.config.budgetThreshold;

        // Simulate high resource pressure
        for (let i = 0; i < 200; i++) {
            nar.eventQueue.push({ budget: { priority: 0.5 } });
        }
        nar.activations.set('dummy', 0.1); // To prevent division by zero

        nar.metaReasoner.optimizeResources();

        // With high pressure, the budget threshold should increase to be more selective
        expect(nar.config.budgetThreshold).toBeGreaterThan(initialBudgetThreshold);
    });
});
