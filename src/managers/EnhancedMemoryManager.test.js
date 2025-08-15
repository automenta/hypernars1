import { NARHyper } from '../NARHyper.js';
import { Budget } from '../support/Budget.js';
import { TruthValue } from '../support/TruthValue.js';
import { id } from '../support/utils.js';

describe('EnhancedMemoryManager', () => {
    let nar;

    beforeEach(() => {
        nar = new NARHyper({
            useEnhanced: true, // Use the enhanced manager
            logLevel: 'error' // Suppress logs during tests
        });
    });

    test('should use EnhancedMemoryManager when useEnhanced is true', () => {
        expect(nar.memoryManager.constructor.name).toBe('EnhancedMemoryManager');
    });

    test('should allocate higher budget for novel tasks', () => {
        const task = { type: 'derivation' };
        const contextWithNovelty = { noveltyScore: 0.8 };
        const contextWithoutNovelty = { noveltyScore: 0.1 };

        const budgetWithNovelty = nar.memoryManager.allocateResources(task, contextWithNovelty);
        const budgetWithoutNovelty = nar.memoryManager.allocateResources(task, contextWithoutNovelty);

        expect(budgetWithNovelty.priority).toBeGreaterThan(budgetWithoutNovelty.priority);
        expect(budgetWithNovelty.quality).toBeGreaterThan(budgetWithoutNovelty.quality);
    });

    test('should allocate higher budget for tasks with successful history', () => {
        const task = { type: 'derivation' };
        const contextWithHistory = { successHistory: 0.9 };
        const contextWithoutHistory = { successHistory: 0.1 };

        const budgetWithHistory = nar.memoryManager.allocateResources(task, contextWithHistory);
        const budgetWithoutHistory = nar.memoryManager.allocateResources(task, contextWithoutHistory);

        expect(budgetWithHistory.durability).toBeGreaterThan(budgetWithoutHistory.durability);
    });

    test('should reduce priority for tasks when system load is high', () => {
        const task = { type: 'derivation' }; // A low-base-priority task

        // Simulate high system load by populating the event queue
        for (let i = 0; i < 800; i++) {
            nar.state.eventQueue.push({ budget: new Budget(0.5, 0.5, 0.5) });
        }

        const budgetHighLoad = nar.memoryManager.allocateResources(task, {});

        // Reset queue for low load comparison
        nar.state.eventQueue.heap = [];

        const budgetLowLoad = nar.memoryManager.allocateResources(task, {});

        expect(budgetHighLoad.priority).toBeLessThan(budgetLowLoad.priority);
    });

    test('_calculatePriorityScore should return higher score for novel tasks', () => {
        const novelTask = {
            target: id('Term', ['new_concept']),
            budget: new Budget(0.5, 0.5, 0.5),
            truth: new TruthValue(0.8, 0.8)
        };
        const existingTask = {
            target: id('Term', ['existing_concept']),
            budget: new Budget(0.5, 0.5, 0.5),
            truth: new TruthValue(0.9, 0.9) // High freq diff to trigger 1.1x bonus
        };

        nar.api.addHyperedge('Term', ['existing_concept'], { truth: new TruthValue(0.5, 0.5) });

        const novelScore = nar.memoryManager._calculatePriorityScore(novelTask);
        const existingScore = nar.memoryManager._calculatePriorityScore(existingTask);

        expect(novelScore).toBeGreaterThan(existingScore);
    });
});
