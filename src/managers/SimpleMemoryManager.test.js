import { beforeEach, describe, expect, it } from '@jest/globals';
import { NAR } from '../NAR.js';
import { SimpleMemoryManager } from './SimpleMemoryManager.js';
import { Budget } from '../support/Budget.js';

describe('SimpleMemoryManager', () => {
    let nar;
    let memoryManager;

    beforeEach(() => {
        // We can use the default NARHyper, which uses SimpleMemoryManager
        nar = new NAR();
        memoryManager = nar.memoryManager;
    });

    it('should be an instance of SimpleMemoryManager', () => {
        expect(memoryManager).toBeInstanceOf(SimpleMemoryManager);
    });

    it('should allocate a default budget', () => {
        const budget = memoryManager.allocateResources({ type: 'test' });
        expect(budget).toBeInstanceOf(Budget);
        expect(budget.priority).toBe(0.5);
        expect(budget.durability).toBe(0.5);
        expect(budget.quality).toBe(0.5);
    });

    it('should not throw an error when maintainMemory is called', () => {
        expect(() => memoryManager.maintainMemory()).not.toThrow();
    });

    it('should not throw an error when updateRelevance is called', () => {
        expect(() =>
            memoryManager.updateRelevance('some_id', 'test')
        ).not.toThrow();
    });

    // These methods are deprecated/stubs, but we test them for completeness
    it('should not throw an error when addToIndex is called', () => {
        expect(() => memoryManager.addToIndex({})).not.toThrow();
    });

    it('should not throw an error when removeFromIndex is called', () => {
        expect(() => memoryManager.removeFromIndex({})).not.toThrow();
    });
});
