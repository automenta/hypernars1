import {beforeEach, describe, expect, it} from '@jest/globals';
import {State} from './State.js';
import {TrieIndex} from '../support/TrieIndex.js';
import {StructuralIndex} from '../support/StructuralIndex.js';
import {LRUMap} from '../support/LRUMap.js';
import {PriorityQueue} from '../support/PriorityQueue.js';

describe('State', () => {
    let mockNar;
    let minimalConfig;

    beforeEach(() => {
        minimalConfig = {
            derivationCacheSize: 100,
            nodeId: 'test-node'
        };
        mockNar = {config: minimalConfig};
    });


    it('should initialize with a minimal config', () => {
        const state = new State(mockNar, minimalConfig);

        // Check top-level properties
        expect(state.config).toBe(minimalConfig);
        expect(state.hypergraph).toBeInstanceOf(Map);
        expect(state.hypergraph.size).toBe(0);
        expect(state.eventQueue).toBeInstanceOf(PriorityQueue);
        expect(state.pathCache).toBeInstanceOf(Map);
        expect(state.activations).toBeInstanceOf(Map);
        expect(state.temporalLinks).toBeInstanceOf(Map);
        expect(state.questionPromises).toBeInstanceOf(Map);
        expect(state.memoization).toBeInstanceOf(Map);
        expect(state.currentStep).toBe(0);
        expect(state.stepsSinceMaintenance).toBe(0);
        expect(state.sourceReliability).toBeInstanceOf(Map);

        // Check index properties
        const {index} = state;
        expect(index.byType).toBeInstanceOf(Map);
        expect(index.byArg).toBeInstanceOf(TrieIndex);
        expect(index.temporal).toBeInstanceOf(Map);
        expect(index.compound).toBeInstanceOf(Map);
        expect(index.derivationCache).toBeInstanceOf(LRUMap);
        expect(index.questionCache).toBeInstanceOf(Map);
        expect(index.byPrefix).toBeInstanceOf(Map);
        expect(index.byWord).toBeInstanceOf(Map);
        expect(index.byNgram).toBeInstanceOf(Map);
        expect(index.structural).toBeInstanceOf(StructuralIndex);

        // Check distributed properties
        const {distributed} = state;
        expect(distributed.nodeId).toBe('test-node');
        expect(distributed.cluster).toBeInstanceOf(Set);
        expect(distributed.cluster.has('test-node')).toBe(true);
        expect(distributed.knowledgePartition).toBeInstanceOf(Map);
        expect(distributed.pendingRequests).toBeInstanceOf(Map);
        expect(distributed.connectionManager).toBeNull();
    });

    it('should use config values for initialization', () => {
        const specificConfig = {
            derivationCacheSize: 5000,
            nodeId: 'my-special-node-123'
        };
        const state = new State(mockNar, specificConfig);

        expect(state.index.derivationCache.maxSize).toBe(5000);
        expect(state.distributed.nodeId).toBe('my-special-node-123');
        expect(state.distributed.cluster.has('my-special-node-123')).toBe(true);
    });

    it('should generate a random nodeId if not provided', () => {
        const config = {derivationCacheSize: 100};
        const state = new State(mockNar, config);
        expect(state.distributed.nodeId).toBeDefined();
        expect(state.distributed.nodeId).toMatch(/^node-/);
    });

});
