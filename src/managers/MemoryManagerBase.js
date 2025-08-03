export class MemoryManagerBase {
    constructor(nar) {
        if (this.constructor === MemoryManagerBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    maintainMemory() {
        throw new Error("Method 'maintainMemory()' must be implemented.");
    }

    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
        throw new Error("Method 'updateRelevance()' must be implemented.");
    }

    allocateResources(task, context = {}) {
        throw new Error("Method 'allocateResources()' must be implemented.");
    }
}
