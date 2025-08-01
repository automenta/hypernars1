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

    during(term, start, end, options = {}) {
        throw new Error("Method 'during()' must be implemented.");
    }

    relate(term1, term2, relation, options = {}) {
        throw new Error("Method 'relate()' must be implemented.");
    }

    /**
     * Provides the current temporal context.
     */
    getContext() {
        throw new Error("Method 'getContext()' must be implemented.");
    }

    predict(event, pattern, horizon) {
        throw new Error("Method 'predict()' must be implemented.");
    }

    adjustTemporalHorizon() {
        // Optional method
    }
}
