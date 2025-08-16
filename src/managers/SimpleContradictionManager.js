import {ContradictionManagerBase} from './ContradictionManagerBase.js';

export class SimpleContradictionManager extends ContradictionManagerBase {
    constructor(nar, config) {
        super(nar, config);
        this.contradictionThreshold = this.config.contradictionThreshold || 0.7;
    }

    detectContradictions(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) {
            return false;
        }

        // Use the helper method from the base class to iterate over belief pairs.
        return this._iterateBeliefPairs(hyperedge, (belief1, belief2) => {
            const freqDiff = Math.abs(belief1.truth.frequency - belief2.truth.frequency);

            // The original logic for what constitutes a contradiction.
            if (freqDiff > this.contradictionThreshold && belief1.truth.confidence > 0.5 && belief2.truth.confidence > 0.5) {
                this.nar.emit('contradiction-detected', {
                    hyperedgeId,
                    contradictions: [{belief1, belief2}]
                });
                return true; // Return true to stop the iteration.
            }
            return false; // Return false to continue to the next pair.
        });
    }

    resolveContradictions() {
        // No-op.
    }
}
