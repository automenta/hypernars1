/**
 * Abstract base class for Temporal Managers.
 * Defines the interface that all temporal managers must implement.
 */
export class TemporalManagerBase {
    constructor(nar) {
        if (this.constructor === TemporalManagerBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    /**
     * Creates a new time interval for a term.
     */
    interval(term, start, end, options = {}) {
        throw new Error("Method 'interval()' must be implemented.");
    }

    /**
     * Establishes a temporal relation between two intervals.
     */
    temporalRelation(premise, conclusion, relation, options = {}) {
        throw new Error("Method 'temporalRelation()' must be implemented.");
    }

    /**
     * Processes temporal constraints during the reasoning cycle.
     */
    processTemporalConstraints(target, activation, budget, pathHash, pathLength, derivationPath) {
        // This can be a no-op in simple implementations
    }

    /**
     * Provides the current temporal context.
     */
    getContext() {
        throw new Error("Method 'getContext()' must be implemented.");
    }

    /**
     * Predicts future events based on patterns.
     */
    predict(term, milliseconds, options = {}) {
        throw new Error("Method 'predict()' must be implemented.");
    }
}
