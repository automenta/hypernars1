import {MemoryManagerBase} from './MemoryManagerBase.js';
import {Budget} from '../support/Budget.js';

export class SimpleMemoryManager extends MemoryManagerBase {
    constructor(nar, config) {
        super(nar, config);
    }

    allocateResources(task, context = {}) {
        // Return a default, medium-priority budget.
        return new Budget(0.5, 0.5, 0.5);
    }

    maintainMemory() {
    }

    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
    }
}