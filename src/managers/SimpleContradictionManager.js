import {ContradictionManagerBase} from './ContradictionManagerBase.js';

/**
 * A simple implementation of a contradiction manager.
 * It detects and logs contradictions but does not resolve them.
 */
export class SimpleContradictionManager extends ContradictionManagerBase {
    constructor(nar) {
        super(nar);
        this.contradictionThreshold = this.nar.config.contradictionThreshold || 0.7;
    }

    /**
     * Detects contradictions and logs them to the console.
     * @param {string} hyperedgeId - The ID of the hyperedge to check.
     * @returns {boolean} - True if a contradiction was detected.
     */
    detectContradiction(hyperedgeId) {
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
                    console.log(`[SimpleContradictionManager] Contradiction detected in ${hyperedgeId}:`);
                    console.log(`  Belief 1: f=${belief1.truth.frequency.toFixed(2)}, c=${belief1.truth.confidence.toFixed(2)}`);
                    console.log(`  Belief 2: f=${belief2.truth.frequency.toFixed(2)}, c=${belief2.truth.confidence.toFixed(2)}`);
                    // This simple manager only logs, it doesn't store for resolution.
                    return true; // Found a contradiction
                }
            }
        }
        return false;
    }

    /**
     * This simple manager does not perform resolution. This is a no-op.
     */
    resolveContradictions() {
        // No-op.
    }
}
