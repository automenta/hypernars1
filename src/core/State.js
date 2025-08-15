import { PriorityQueue } from '../support/PriorityQueue.js';
import { OptimizedIndex } from '../managers/OptimizedIndex.js';

export class State {
  constructor(nar) {
    this.nar = nar;
    this.config = nar.config;

    this.hypergraph = new Map();
    this.index = new OptimizedIndex(nar);
    this.eventQueue = new PriorityQueue((a, b) => b.budget.priority - a.budget.priority);
    this.pathCache = new Map();
    this.activations = new Map();
    this.temporalLinks = new Map();
    this.questionPromises = new Map(); // questionId -> { resolve, reject, timer, options, answered, startTime, targetId }
    this.questionsByTarget = new Map(); // targetId -> [questionId, ...]
    this.memoization = new Map();
    this.currentStep = 0;
    this.stepsSinceMaintenance = 0;
    this.sourceReliability = new Map();

    this.distributed = {
        nodeId: this.config.nodeId || `node-${Math.random().toString(36).substr(2, 9)}`,
        cluster: new Set([this.nodeId]),
        knowledgePartition: new Map(),
        pendingRequests: new Map(),
        connectionManager: null
    };
  }
}
