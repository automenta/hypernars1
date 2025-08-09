import {MemoryManagerBase} from './MemoryManagerBase.js';
import {OptimizedIndex} from './OptimizedIndex.js';
import {Budget} from '../support/Budget.js';
import {config} from '../config/index.js';
import {ForgettingManager} from './memoryComponents/ForgettingManager.js';
import {ImportanceManager} from './memoryComponents/ImportanceManager.js';

const defaultConfig = config.advancedMemoryManager;

export class AdvancedMemoryManager extends MemoryManagerBase {
    constructor(nar) {
        super(nar);
        this.config = {...defaultConfig, ...nar.config.advancedMemoryManager};

        this.index = new OptimizedIndex(nar);
        nar.state.index = this.index;

        this.importanceScores = new Map();
        this.contextStack = [];
        this.forgettingThreshold = this.config.forgettingThreshold;

        this.forgettingManager = new ForgettingManager(this);
        this.importanceManager = new ImportanceManager(this);
    }

    maintainMemory() {
        for (const hyperedge of this.nar.state.hypergraph.values()) {
            hyperedge.beliefs.forEach(belief => {
                belief.budget = belief.budget.scale(this.nar.config.budgetDecay);
            });
        }

        this.importanceManager.updateImportanceScores();
        this._adjustMemoryConfiguration();
        this.forgettingManager.selectivelyForget();
        this.pruneLowValuePaths();
    }

    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
        if (hyperedgeId) {
            this.index._updatePopularity(hyperedgeId, activityType);
        }
    }

    pushContext(context) {
        this.contextStack.push(context);
    }

    popContext() {
        if (this.contextStack.length > 0) {
            this.contextStack.pop();
        }
    }

    _adjustMemoryConfiguration() {
        const activeConcepts = this.nar.state.hypergraph.size;
        if (activeConcepts > this.config.beliefCapacityAdjustmentThresholdHigh) {
            this.nar.config.beliefCapacity = Math.max(this.config.minBeliefCapacity, Math.floor(this.nar.config.beliefCapacity * this.config.beliefCapacityAdjustmentFactor));
        } else if (activeConcepts < this.config.beliefCapacityAdjustmentThresholdLow) {
            this.nar.config.beliefCapacity = Math.min(this.config.maxBeliefCapacity, Math.ceil(this.nar.config.beliefCapacity * (1 + (1 - this.config.beliefCapacityAdjustmentFactor))));
        }
    }

    allocateResources(task, context = {}) {
        let basePriority = this.config.basePriority[task.type] || this.config.basePriority.default;

        if (context.urgency) {
            basePriority = Math.min(1.0, basePriority + context.urgency * this.config.urgencyPriorityFactor);
        }
        if (context.importance) {
            basePriority = Math.min(1.0, basePriority + context.importance * this.config.importancePriorityFactor);
        }

        const availability = this._getResourceAvailability();
        const priority = basePriority * availability;

        let durability;
        if (task.type === 'question' || task.type === 'critical-event') {
            durability = this.config.durability.high;
        } else {
            durability = this.config.durability.low;
        }

        const quality = Math.sqrt(availability) * this.config.qualityAvailabilityFactor;

        return new Budget(priority, durability, quality);
    }

    _getResourceAvailability() {
        const recentUsage = Math.min(this.nar.state.eventQueue.heap.length / this.config.eventQueueUsageNormalization, 1.0);
        return Math.max(this.config.resourceAvailabilityMin, 1.0 - recentUsage * this.config.resourceAvailabilityUsageFactor);
    }

    pruneLowValuePaths() {
        const threshold = this.config.lowValuePathPruningThreshold;
        const eventQueue = this.nar.state.eventQueue;
        if (!eventQueue || eventQueue.heap.length === 0) {
            return 0;
        }

        const originalSize = eventQueue.heap.length;
        const pathsToKeep = [];
        for (const event of eventQueue.heap) {
            if (event.budget.total() >= threshold) {
                pathsToKeep.push(event);
            }
        }

        const prunedCount = originalSize - pathsToKeep.length;

        if (prunedCount > 0) {
            eventQueue.heap = pathsToKeep;

            for (let i = Math.floor(eventQueue.heap.length / 2) - 1; i >= 0; i--) {
                eventQueue._siftDown(i);
            }

            this.nar.emit('pruning', {
                type: 'low-value-paths',
                count: prunedCount
            });
        }

        return prunedCount;
    }
}
