import {MemoryManagerBase} from './MemoryManagerBase.js';

/**
 * A simple memory manager that provides the basic interface
 * for adding and removing hyperedges from the index, but does not
 * implement complex memory maintenance logic.
 */
export class SimpleMemoryManager extends MemoryManagerBase {
    constructor(nar) {
        super(nar);
        // The Simple manager doesn't have a complex index, so these methods are no-ops
        // but they need to exist to satisfy the API calls.
    }

    /**
     * Placeholder for adding a hyperedge to an index.
     * @param {Hyperedge} hyperedge - The hyperedge to add.
     */
    addToIndex(hyperedge) {
        // No-op in the simple manager.
    }

    /**
     * Placeholder for removing a hyperedge from an index.
     * @param {Hyperedge} hyperedge - The hyperedge to remove.
     */
    removeFromIndex(hyperedge) {
        // No-op in the simple manager.
    }

    maintainMemory() {
        // No advanced maintenance in the simple manager.
    }

    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
        // No relevance tracking in the simple manager.
    }
}