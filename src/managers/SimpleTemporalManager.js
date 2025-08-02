import {TemporalManagerBase} from './TemporalManagerBase.js';

/**
 * A simple implementation of a temporal manager that provides the necessary
 * interface but does not perform complex temporal reasoning.
 */
export class SimpleTemporalManager extends TemporalManagerBase {
    constructor(nar) {
        super(nar);
        this.intervals = new Map();
    }

    interval(term, start, end, options = {}) {
        const intervalId = `SimpleInterval(${term},${start},${end})`;
        this.intervals.set(intervalId, { term, start, end });
        return intervalId;
    }

    temporalRelation(premise, conclusion, relation, options = {}) {
        // Does nothing, returns a dummy ID
        return `SimpleRelation(${premise},${conclusion})`;
    }

    addConstraint(event1, event2, relation, options = {}) {
        // No-op in the simple manager, returns a dummy ID.
        return `SimpleConstraint(${event1},${event2})`;
    }

    inferRelationship(event1, event2) {
        // No-op, returns null.
        return null;
    }

    describeTemporalRelationship(event1, event2) {
        // No-op, returns a placeholder string.
        return 'No temporal relationship known in SimpleTemporalManager.';
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
