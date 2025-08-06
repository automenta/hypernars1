import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {OptimizedIndex} from './OptimizedIndex.js';
import {Hyperedge} from '../support/Hyperedge.js';


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

        mockNar.hypergraph.clear();
        index = new OptimizedIndex(mockNar);


        hyperedges = [
            new Hyperedge(mockNar, 'h1', 'Term', ['apple']),
            new Hyperedge(mockNar, 'h2', 'Term', ['apply']),
            new Hyperedge(mockNar, 'h3', 'Term', ['banana']),
            new Hyperedge(mockNar, 'h4', 'Inheritance', ['apple', 'fruit']),
            new Hyperedge(mockNar, 'h5', 'Similarity', ['apple', 'banana']),
        ];

        hyperedges.forEach(h => {
            mockNar.hypergraph.set(h.id, h);
            index.addToIndex(h);
        });
    });

    test('should add and retrieve hyperedges directly', () => {
        const results = index.queryPattern('apple');
        expect(results).toBeInstanceOf(Set);
        expect(results.size).toBe(3);
        expect(results).toContain('h1');
        expect(results).toContain('h4');
        expect(results).toContain('h5');
    });

    test('queryPattern should handle wildcards at the end', () => {
        const results = index.queryPattern('app*');
        expect(results.size).toBe(4);
        expect(results).toContain('h1');
        expect(results).toContain('h2');
        expect(results).toContain('h4');
        expect(results).toContain('h5');
    });

    test('queryPattern should handle variables as wildcards', () => {
        const results = index.queryPattern('$fruit');



        expect(results.size).toBe(5);
    });

    test('removeFromIndex should remove a hyperedge completely', () => {
        let appleResults = index.queryPattern('apple');
        expect(appleResults.size).toBe(3);


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

        index._updatePopularity('h3');
        index._updatePopularity('h5');
        index._updatePopularity('h4');









        const removeSpy = jest.spyOn(index, 'removeFromIndex');


        index._pruneLeastPopularConcepts(0.3);

        expect(removeSpy).toHaveBeenCalledTimes(1);


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
