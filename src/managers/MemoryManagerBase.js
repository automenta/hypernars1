/**
 * Abstract base class for Memory Managers.
 * Defines the interface that all memory managers must implement.
 */
export class MemoryManagerBase {
    constructor(nar) {
        if (this.constructor === MemoryManagerBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    /**
     * Performs memory maintenance, such as forgetting and optimization.
     */
    maintainMemory() {
        throw new Error("Method 'maintainMemory()' must be implemented.");
    }

    /**
     * Updates the relevance of a hyperedge based on some activity.
     * @param {string} hyperedgeId - The ID of the hyperedge.
     * @param {string} activityType - The type of activity.
     * @param {number} [intensity=1.0] - The intensity of the activity.
     */
    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
        throw new Error("Method 'updateRelevance()' must be implemented.");
    }
}
