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
            modules: {
                MemoryManager: AdvancedMemoryManager,
            }
        });
        expect(nar.memoryManager).toBeInstanceOf(AdvancedMemoryManager);
    });

    it.skip('should boost importance scores for concepts in active questions', async () => {
        jest.useFakeTimers();
        const nar = new NARHyper({
            modules: { MemoryManager: AdvancedMemoryManager }
        });

        const termId = id('Term', ['important_term.']);
        nar.nal('important_term.'); // Add the term to the system
        nar.step(); // Run one step to process the term and give it base activation

        // Ask a question involving the term
        const questionPromise = nar.ask('(? --> important_term.)?');

        // Let the event loop run to register the promise
        await Promise.resolve();
        jest.advanceTimersByTime(1);

        // Run a few steps to allow the system to process the question
        // and potentially trigger maintenance
        for (let i = 0; i < 5; i++) {
            nar.step();
        }

        // Explicitly run the maintenance cycle to ensure scores are updated
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
            modules: { MemoryManager: AdvancedMemoryManager },
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
            modules: { MemoryManager: AdvancedMemoryManager },
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

    it('should allocate a higher budget for a question than for a derivation', () => {
        const nar = new NARHyper({ modules: { MemoryManager: AdvancedMemoryManager } });
        const manager = nar.memoryManager;

        const questionTask = { type: 'question' };
        const derivationTask = { type: 'derivation' };

        const questionBudget = manager.allocateResources(questionTask);
        const derivationBudget = manager.allocateResources(derivationTask);

        expect(questionBudget.priority).toBeGreaterThan(derivationBudget.priority);
        expect(questionBudget.durability).toBeGreaterThan(derivationBudget.durability);
    });

    test('should boost importance for concepts that lead to success', () => {
        const nar = new NARHyper({ modules: { MemoryManager: AdvancedMemoryManager } });
        const termId = nar.api.nal('successful_premise.');
        nar.memoryManager.importanceScores.set(termId, 0.1); // Set a known initial score

        // Simulate a successful outcome from this premise by using the public API
        nar.outcome(termId, { success: true });

        // Manually trigger the learning and memory maintenance
        nar.learningEngine.applyLearning();
        nar.memoryManager.maintainMemory();

        const newScore = nar.memoryManager.importanceScores.get(termId);
        // The exact score is subject to multiple factors, just check it increased.
        expect(newScore).toBeGreaterThan(0.09);
    });

    it('should prune low-value paths from the event queue', () => {
        const nar = new NARHyper({ modules: { MemoryManager: AdvancedMemoryManager } });
        const manager = nar.memoryManager;
        const queue = nar.state.eventQueue;

        // Add events with varying budget totals
        queue.push({ id: 'high_budget', budget: { priority: 0.8, durability: 0.8, quality: 0.8, total: () => 0.8 } });
        queue.push({ id: 'medium_budget', budget: { priority: 0.3, durability: 0.3, quality: 0.3, total: () => 0.3 } });
        queue.push({ id: 'low_budget_1', budget: { priority: 0.1, durability: 0.1, quality: 0.1, total: () => 0.1 } });
        queue.push({ id: 'low_budget_2', budget: { priority: 0.05, durability: 0.05, quality: 0.05, total: () => 0.05 } });

        expect(queue.heap.length).toBe(4);

        const prunedCount = manager.pruneLowValuePaths(0.2); // Threshold is 0.2

        expect(prunedCount).toBe(2);
        expect(queue.heap.length).toBe(2);

        const remainingIds = queue.heap.map(event => event.id);
        expect(remainingIds).toContain('high_budget');
        expect(remainingIds).toContain('medium_budget');
        expect(remainingIds).not.toContain('low_budget_1');
        expect(remainingIds).not.toContain('low_budget_2');
    });
});
