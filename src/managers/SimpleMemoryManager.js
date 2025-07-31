import { MemoryManagerBase } from './MemoryManagerBase.js';

/**
 * A simple, no-op implementation of a memory manager.
 * It does not perform any memory management, effectively creating an infinite memory.
 */
export class SimpleMemoryManager extends MemoryManagerBase {
    constructor(nar) {
        super(nar);
    }

    /**
     * No-op.
     */
    maintainMemory() {
        // Does nothing.
    }

    /**
     * No-op.
     * @param {string} hyperedgeId
     * @param {string} activityType
     * @param {number} [intensity=1.0]
     */
    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
        // Does nothing.
    }
}
