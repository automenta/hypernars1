import { TrieIndex } from '../support/TrieIndex.js';
import { StructuralIndex } from '../support/StructuralIndex.js';
import { LRUMap } from '../support/LRUMap.js';
import { PriorityQueue } from '../support/PriorityQueue.js';

export class State {
    constructor(config) {
        this.config = config;

        this.hypergraph = new Map();
        this.index = {
            byType: new Map(),
            byArg: new TrieIndex(),
            temporal: new Map(),
            compound: new Map(),
            derivationCache: new LRUMap(this.config.derivationCacheSize),
            questionCache: new Map(),
            byPrefix: new Map(),
            byWord: new Map(),
            byNgram: new Map(),
            structural: new StructuralIndex(),
        };
        this.eventQueue = new PriorityQueue(
            (a, b) => b.budget.priority - a.budget.priority
        );
        this.pathCache = new Map();
        this.activations = new Map();
        this.temporalLinks = new Map();
        this.questionPromises = new Map();
        this.memoization = new Map();
        this.currentStep = 0;
        this.stepsSinceMaintenance = 0;
        this.sourceReliability = new Map();

        const nodeId =
            config.nodeId || `node-${Math.random().toString(36).substr(2, 9)}`;
        this.distributed = {
            nodeId,
            cluster: new Set([nodeId]),
            knowledgePartition: new Map(),
            pendingRequests: new Map(),
            connectionManager: null,
        };
    }
}
