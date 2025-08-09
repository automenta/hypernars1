export class ContradictionManagerBase {
    constructor(nar) {
        if (this.constructor === ContradictionManagerBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    detectContradictions(hyperedgeId) {
        throw new Error("Method 'detectContradictions()' must be implemented.");
    }

    resolveContradictions() {
        throw new Error("Method 'resolveContradictions()' must be implemented.");
    }

    /**
     * Iterates over all unique pairs of beliefs in a hyperedge and executes a callback.
     * This is a protected helper method for subclasses to use.
     * @param {object} hyperedge The hyperedge containing the beliefs.
     * @param {function(object, object): boolean} callback The function to execute for each pair.
     *   It receives two beliefs as arguments. If it returns true, iteration stops.
     * @returns {boolean} True if the iteration was stopped by the callback, otherwise false.
     */
    _iterateBeliefPairs(hyperedge, callback) {
        const beliefs = hyperedge.beliefs;
        if (!beliefs || beliefs.length < 2) {
            return false;
        }

        for (let i = 0; i < beliefs.length; i++) {
            for (let j = i + 1; j < beliefs.length; j++) {
                if (callback(beliefs[i], beliefs[j])) {
                    return true; // Signal to stop
                }
            }
        }
        return false;
    }
}
