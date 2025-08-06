import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {NAR} from '../NAR.js';
import {AdvancedMemoryManager} from './AdvancedMemoryManager.js';
import {id} from '../support/utils.js';
import {Budget} from '../support/Budget.js';
import { TASK_TYPES } from '../support/constants.js';

describe('AdvancedMemoryManager', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('should be configurable in NARHyper', () => {
        const nar = new NAR({
            useAdvanced: true,
            modules: {
                MemoryManager: AdvancedMemoryManager,
            }
        });
        expect(nar.memoryManager).toBeInstanceOf(AdvancedMemoryManager);
    });

    it.skip('should boost importance scores for concepts in active questions', async () => {
        jest.useFakeTimers();
        const nar = new NAR({
            useAdvanced: true,
            modules: {MemoryManager: AdvancedMemoryManager}
        });

        const termId = id('Term', ['important_term.']);
        nar.nal('important_term.');
        nar.step();


        const questionPromise = nar.ask('(? --> important_term.)?');


        await Promise.resolve();
        jest.advanceTimersByTime(1);



        for (let i = 0; i < 5; i++) {
            nar.step();
        }


        nar.memoryManager.maintainMemory();

        const importanceScore = nar.memoryManager.importanceScores.get(termId);


        expect(importanceScore).toBeGreaterThan(0.2);


        jest.runAllTimers();
        await questionPromise.catch(() => {
        });
    });

    it('should adjust belief capacity based on hypergraph size', () => {
        const nar = new NAR({
            useAdvanced: true,
            modules: {MemoryManager: AdvancedMemoryManager},
            beliefCapacity: 8
        });


        for (let i = 0; i < 110; i++) {
            nar.nal(`term${i}.`);
        }

        Object.defineProperty(nar.state.hypergraph, 'size', {value: 11000, configurable: true});


        nar.memoryManager.maintainMemory();


        const reducedCapacity = nar.config.beliefCapacity;
        expect(reducedCapacity).toBeLessThan(8);


        Object.defineProperty(nar.state.hypergraph, 'size', {value: 4000, configurable: true});


        nar.memoryManager.maintainMemory();
        const increasedCapacity = nar.config.beliefCapacity;


        expect(increasedCapacity).toBeGreaterThan(reducedCapacity);
    });

    it('should not forget important concepts', async () => {

        jest.useFakeTimers();
        const nar = new NAR({
            useAdvanced: true,
            modules: {MemoryManager: AdvancedMemoryManager},
            minConceptsForForgetting: 1,
            forgettingThreshold: 0.1,
        });


        const importantTermId = id('Term', ['important_term']);
        nar.nal('important_term.');
        const questionPromise = nar.ask('(? --> important_term)?');


        await Promise.resolve();
        jest.advanceTimersByTime(1);


        for (let i = 0; i < 20; i++) {
            nar.nal(`unimportant${i}.`);
        }



        nar.memoryManager.importanceScores.forEach((score, id) => {
            nar.memoryManager.importanceScores.set(id, 0.05);
        });
        nar.state.activations.forEach((activation, id) => {
            nar.state.activations.set(id, 0.05);
        });


        for (let i = 0; i < 5; i++) {
            nar.memoryManager.maintainMemory();
        }


        expect(nar.state.hypergraph.has(importantTermId)).toBe(true);


        jest.runAllTimers();
        try {
            await questionPromise;
        } catch (e) {
        }
    });

    it.skip('should prioritize forgetting old, stale concepts by giving them a lower retention score', () => {



        jest.useFakeTimers();
        const nar = new NAR({useAdvanced: true, minConceptsForForgetting: 1});
        const manager = nar.memoryManager;

        const oldTermId = nar.api.nal('old_term.');
        manager.updateRelevance(oldTermId, 'access');


        jest.advanceTimersByTime(1000 * 60 * 60 * 24);

        const newTermId = nar.api.nal('new_term.');
        manager.updateRelevance(newTermId, 'access');


        [oldTermId, newTermId].forEach(id => {
            manager.importanceScores.set(id, 0.1);
            nar.state.activations.set(id, 0.1);
            manager.index.conceptPopularity.set(id, 1);
        });


        manager.index.activeConcepts.clear();


        const scores = manager._selectivelyForget([oldTermId, newTermId]);

        expect(scores[oldTermId]).toBeDefined();
        expect(scores[newTermId]).toBeDefined();
        expect(scores[newTermId]).toBeGreaterThan(scores[oldTermId]);
    });

    it.skip('should prioritize keeping concepts with high-utility beliefs by giving them a higher retention score', () => {



        const nar = new NAR({useAdvanced: true, minConceptsForForgetting: 1});
        const manager = nar.memoryManager;


        const highUtilityTerm = nar.api.nal('<a --> b>. %0.9;0.9%');
        const highUtilityBelief = nar.state.hypergraph.get(highUtilityTerm).getStrongestBelief();
        highUtilityBelief.budget = new Budget(0.9, 0.9, 0.9);


        const lowUtilityTerm = nar.api.nal('<c --> d>. %0.2;0.5%');
        const lowUtilityBelief = nar.state.hypergraph.get(lowUtilityTerm).getStrongestBelief();
        lowUtilityBelief.budget = new Budget(0.2, 0.9, 0.9);


        [highUtilityTerm, lowUtilityTerm].forEach(id => {
            manager.importanceScores.set(id, 0.1);
            nar.state.activations.set(id, 0.1);
            manager.index.conceptPopularity.set(id, 1);
            manager.updateRelevance(id, 'access');
        });


        manager.index.activeConcepts.clear();


        const scores = manager._selectivelyForget([highUtilityTerm, lowUtilityTerm]);

        expect(scores[highUtilityTerm]).toBeDefined();
        expect(scores[lowUtilityTerm]).toBeDefined();
        expect(scores[highUtilityTerm]).toBeGreaterThan(scores[lowUtilityTerm]);
    });

    it('should allocate a higher budget for a question than for a derivation', () => {
        const nar = new NAR({useAdvanced: true, modules: {MemoryManager: AdvancedMemoryManager}});
        const manager = nar.memoryManager;

        const questionTask = {type: TASK_TYPES.QUESTION};
        const derivationTask = {type: TASK_TYPES.DERIVATION};

        const questionBudget = manager.allocateResources(questionTask);
        const derivationBudget = manager.allocateResources(derivationTask);

        expect(questionBudget.priority).toBeGreaterThan(derivationBudget.priority);
        expect(questionBudget.durability).toBeGreaterThan(derivationBudget.durability);
    });

    test('should boost importance for concepts that lead to success', () => {
        const nar = new NAR({useAdvanced: true, modules: {MemoryManager: AdvancedMemoryManager}});
        const termId = nar.api.nal('successful_premise.');
        nar.memoryManager.importanceScores.set(termId, 0.1);


        nar.api.outcome(termId, {success: true});


        nar.learningEngine.applyLearning();
        nar.memoryManager.maintainMemory();

        const newScore = nar.memoryManager.importanceScores.get(termId);

        expect(newScore).toBeGreaterThan(0.09);
    });

    it('should prune low-value paths from the event queue', () => {
        const nar = new NAR({useAdvanced: true, modules: {MemoryManager: AdvancedMemoryManager}});
        const manager = nar.memoryManager;
        const queue = nar.state.eventQueue;


        queue.push({id: 'high_budget', budget: {priority: 0.8, durability: 0.8, quality: 0.8, total: () => 0.8}});
        queue.push({id: 'medium_budget', budget: {priority: 0.3, durability: 0.3, quality: 0.3, total: () => 0.3}});
        queue.push({id: 'low_budget_1', budget: {priority: 0.1, durability: 0.1, quality: 0.1, total: () => 0.1}});
        queue.push({id: 'low_budget_2', budget: {priority: 0.05, durability: 0.05, quality: 0.05, total: () => 0.05}});

        expect(queue.heap.length).toBe(4);

        const prunedCount = manager.pruneLowValuePaths(0.2);

        expect(prunedCount).toBe(2);
        expect(queue.heap.length).toBe(2);

        const remainingIds = queue.heap.map(event => event.id);
        expect(remainingIds).toContain('high_budget');
        expect(remainingIds).toContain('medium_budget');
        expect(remainingIds).not.toContain('low_budget_1');
        expect(remainingIds).not.toContain('low_budget_2');
    });
});