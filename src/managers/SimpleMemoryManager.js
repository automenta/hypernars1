import {MemoryManagerBase} from './MemoryManagerBase.js';

/**
 * TODO
 */
export class SimpleMemoryManager extends MemoryManagerBase {
    constructor(nar) {
        super(nar);
    }

    maintainMemory() {
    }

    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
    }
}
