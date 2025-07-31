import { TemporalManagerBase } from './TemporalManagerBase.js';

/**
 * A simple, no-op implementation of a temporal manager.
 * It fulfills the interface but performs no temporal reasoning.
 */
export class SimpleTemporalManager extends TemporalManagerBase {
    constructor(nar) {
        super(nar);
    }

    interval(term, start, end, options = {}) {
        // Does nothing, returns a dummy ID
        return `SimpleInterval(${term})`;
    }

    temporalRelation(premise, conclusion, relation, options = {}) {
        // Does nothing, returns a dummy ID
        return `SimpleRelation(${premise},${conclusion})`;
    }

    processTemporalConstraints(target, activation, budget, pathHash, pathLength, derivationPath) {
        // No-op
    }

    getContext() {
        return {
            timestamp: Date.now(),
            currentPeriod: 'present'
        };
    }

    predict(term, milliseconds, options = {}) {
        // Returns no predictions
        return [];
    }
}
