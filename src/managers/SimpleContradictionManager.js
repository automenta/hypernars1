import {ContradictionManagerBase} from './ContradictionManagerBase.js';

export class SimpleContradictionManager extends ContradictionManagerBase {
    constructor(nar) {
        super(nar);
        this.contradictionThreshold = this.nar.config.contradictionThreshold || 0.7;
    }

    detectContradictions(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || hyperedge.beliefs.length < 2) {
            return false;
        }

        const beliefs = hyperedge.beliefs;
        for (let i = 0; i < beliefs.length; i++) {
            for (let j = i + 1; j < beliefs.length; j++) {
                const belief1 = beliefs[i];
                const belief2 = beliefs[j];

                const freqDiff = Math.abs(belief1.truth.frequency - belief2.truth.frequency);

                if (freqDiff > this.contradictionThreshold && belief1.truth.confidence > 0.5 && belief2.truth.confidence > 0.5) {
                    this.nar.emit('contradiction-detected', {
                        hyperedgeId,
                        contradictions: [{belief1, belief2}]
                    });
                    return true;
                }
            }
        }
        return false;
    }

    resolveContradictions() {
        // No-op.
    }
}
