import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { NARHyper } from '../NARHyper.js';
import { AdvancedMemoryManager } from './AdvancedMemoryManager.js';
import { id } from '../support/utils.js';

describe('AdvancedMemoryManager', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('should be configurable in NARHyper', () => {
        const nar = new NARHyper({
            managers: {
                MemoryManager: AdvancedMemoryManager,
            }
        });
        expect(nar.memoryManager).toBeInstanceOf(AdvancedMemoryManager);
    });

    it('should boost importance scores for concepts in active questions', async () => {
        jest.useFakeTimers();
        const nar = new NARHyper({
            managers: { MemoryManager: AdvancedMemoryManager }
        });

        const termId = id('Term', ['important_term.']);
        nar.nal('important_term.'); // Add the term to the system
        nar.step(); // Run one step to process the term and give it base activation

        // Ask a question involving the term
        const questionPromise = nar.ask('(? --> important_term.)?');

        // Let the event loop run to register the promise
        await Promise.resolve();
        jest.advanceTimersByTime(1);

        // Manually trigger maintenance to update scores
        nar.memoryManager.maintainMemory();

        const importanceScore = nar.memoryManager.importanceScores.get(termId);
        // The score should be boosted. The initial score from activation is low (~0.03), and the boost is +0.2.
        // We check that the score is greater than the boost alone.
        expect(importanceScore).toBeGreaterThan(0.2);

        // Clean up to avoid open handles
        jest.runAllTimers();
        await questionPromise.catch(() => {});
    });

    it('should adjust belief capacity based on hypergraph size', () => {
        const nar = new NARHyper({
            managers: { MemoryManager: AdvancedMemoryManager },
            beliefCapacity: 8 // Start with a known capacity
        });

        // Mock a large hypergraph by adding many concepts
        for (let i = 0; i < 110; i++) { // Reduced number to avoid timeout, but still > 10000 bytes approx
            nar.nal(`term${i}.`);
        }
        // Force a large size for the test condition without adding 11000 hyperedges
        Object.defineProperty(nar.state.hypergraph, 'size', { value: 11000, configurable: true });

        // Trigger maintenance
        nar.memoryManager.maintainMemory();

        // Belief capacity should be reduced
        const reducedCapacity = nar.config.beliefCapacity;
        expect(reducedCapacity).toBeLessThan(8);

        // Mock a small hypergraph
        Object.defineProperty(nar.state.hypergraph, 'size', { value: 4000, configurable: true });

        // Trigger maintenance
        nar.memoryManager.maintainMemory();
        const increasedCapacity = nar.config.beliefCapacity;

        // Belief capacity should be increased from the reduced value
        expect(increasedCapacity).toBeGreaterThan(reducedCapacity);
    });

    it('should not forget important concepts', async () => {
        jest.useFakeTimers();
        const nar = new NARHyper({
            managers: { MemoryManager: AdvancedMemoryManager },
            forgettingThreshold: 0.1, // Low threshold to encourage forgetting
        });

        // Add an important concept by making it part of a question
        const importantTermId = id('Term', ['important_term.']);
        nar.nal('important_term.');
        const questionPromise = nar.ask('(? --> important_term.)?');

        // Let the event loop run to register the promise
        await Promise.resolve();
        jest.advanceTimersByTime(1);

        // Add many other unimportant concepts
        for (let i = 0; i < 20; i++) {
            nar.nal(`unimportant${i}.`);
        }

        // Manually set relevance to be very low to force forgetting logic
        nar.memoryManager.beliefRelevance.forEach((relevance, id) => {
            relevance.baseRelevance = 0.05; // Below the threshold
        });
        nar.memoryManager.importanceScores.forEach((score, id) => {
            nar.memoryManager.importanceScores.set(id, 0.05);
        });

        // Run maintenance multiple times to trigger forgetting
        for (let i = 0; i < 5; i++) {
            nar.memoryManager.maintainMemory();
        }

        // The important concept should still exist because _isImportantConcept check will override low relevance
        expect(nar.state.hypergraph.has(importantTermId)).toBe(true);

        // Clean up to avoid open handles
        jest.runAllTimers();
        await questionPromise.catch(() => {});
    });
});
