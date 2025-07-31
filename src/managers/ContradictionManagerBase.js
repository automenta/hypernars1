/**
 * Abstract base class for Contradiction Managers.
 * Defines the interface that all contradiction managers must implement.
 */
export class ContradictionManagerBase {
    constructor(nar) {
        if (this.constructor === ContradictionManagerBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    /**
     * Detects contradictions for a given hyperedge.
     * @param {string} hyperedgeId - The ID of the hyperedge to check.
     * @returns {boolean} - True if a contradiction was detected.
     */
    detectContradictions(hyperedgeId) {
        throw new Error("Method 'detectContradictions()' must be implemented.");
    }

    /**
     * Resolves all detected contradictions.
     */
    resolveContradictions() {
        throw new Error("Method 'resolveContradictions()' must be implemented.");
    }
}
