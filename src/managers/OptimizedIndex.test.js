import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { OptimizedIndex } from './OptimizedIndex.js';
import { Hyperedge } from '../support/Hyperedge.js';

// Mock NAR system and its components
const mockNar = {
    config: {
        derivationCacheSize: 100,
        questionCacheTTL: 500,
        activeConceptsSize: 10,
    },
    hypergraph: new Map(),
};

describe('OptimizedIndex', () => {
    let index;
    let hyperedges;

    beforeEach(() => {
        // Reset hypergraph and create a fresh index for each test
        mockNar.hypergraph.clear();
        index = new OptimizedIndex(mockNar);

        // Create and add some sample hyperedges
        hyperedges = [
            new Hyperedge(mockNar, 'h1', 'Term', ['apple']),
            new Hyperedge(mockNar, 'h2', 'Term', ['apply']),
            new Hyperedge(mockNar, 'h3', 'Term', ['banana']),
            new Hyperedge(mockNar, 'h4', 'Inheritance', ['apple', 'fruit']),
            new Hyperedge(mockNar, 'h5', 'Similarity', ['apple', 'banana']),
        ];

        hyperedges.forEach((h) => {
            mockNar.hypergraph.set(h.id, h);
            index.addToIndex(h);
        });
    });

    test('should add and retrieve hyperedges directly', () => {
        const results = index.queryPattern('apple');
        expect(results).toBeInstanceOf(Set);
        expect(results.size).toBe(3); // h1, h4, h5
        expect(results).toContain('h1');
        expect(results).toContain('h4');
        expect(results).toContain('h5');
    });

    test('queryPattern should handle wildcards at the end', () => {
        const results = index.queryPattern('app*');
        expect(results.size).toBe(4); // apple, apply, h4, h5
        expect(results).toContain('h1');
        expect(results).toContain('h2');
        expect(results).toContain('h4');
        expect(results).toContain('h5');
    });

    test('queryPattern should handle variables as wildcards', () => {
        const results = index.queryPattern('$fruit');
        // This is a simple test; it will find all terms.
        // A more sophisticated variable query would involve unification.
        // Current implementation replaces $var with *
        expect(results.size).toBe(5);
    });

    test('removeFromIndex should remove a hyperedge completely', () => {
        let appleResults = index.queryPattern('apple');
        expect(appleResults.size).toBe(3);

        // Remove h1
        index.removeFromIndex(hyperedges[0]);

        appleResults = index.queryPattern('apple');
        expect(appleResults.size).toBe(2);
        expect(appleResults).not.toContain('h1');
        expect(appleResults).toContain('h4');
        expect(appleResults).toContain('h5');

        expect(index.byType.get('Term')).not.toContain('h1');
        expect(index.conceptPopularity.has('h1')).toBe(false);
    });

    test('optimizeMemory should prune least popular concepts', () => {
        // Access some concepts to make them more popular than others
        index._updatePopularity('h3'); // banana
        index._updatePopularity('h5'); // apple, banana
        index._updatePopularity('h4'); // apple, fruit

        // After setup, popularity scores are:
        // h1 ('apple'): 1
        // h2 ('apply'): 1
        // h3 ('banana'): 2
        // h4 ('apple', 'fruit'): 2
        // h5 ('apple', 'banana'): 2
        // The least popular concepts are h1 and h2.

        const removeSpy = jest.spyOn(index, 'removeFromIndex');

        // Directly test the pruning logic with a sufficient reduction rate
        index._pruneLeastPopularConcepts(0.3); // floor(5 * 0.3) = 1, so should prune 1 item

        expect(removeSpy).toHaveBeenCalledTimes(1);

        // Check that the removed hyperedge is one of the least popular ones
        const removedHyperedge = removeSpy.mock.calls[0][0];
        const leastPopularIds = ['h1', 'h2'];
        expect(leastPopularIds).toContain(removedHyperedge.id);

        expect(index.prunedCount).toBe(1);
    });

    test('optimizeMemory should clean up expired question cache entries', () => {
        const cleanupSpy = jest.spyOn(index.questionCache, 'cleanup');
        index.optimizeMemory();
        expect(cleanupSpy).toHaveBeenCalled();
    });
});
