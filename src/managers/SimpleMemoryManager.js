import {MemoryManagerBase} from './MemoryManagerBase.js';

export class SimpleMemoryManager extends MemoryManagerBase {
    constructor(nar) {
        super(nar);
    }

    addToIndex(hyperedge) {
    }

    removeFromIndex(hyperedge) {
    }

    maintainMemory() {
    }

    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
    }
}