import {TemporalManagerBase} from './TemporalManagerBase.js';

/**
 * TODO
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
