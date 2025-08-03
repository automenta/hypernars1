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

    addConstraint(event1, event2, relation, options = {}) {
        // No-op in the simple manager, returns a dummy ID.
        return `SimpleConstraint(${event1},${event2})`;
    }

    relate(term1, term2, relation, options = {}) {
        // No-op, returns a dummy ID
        return `SimpleRelation(${term1},${term2})`;
    }

    relateById(intervalId1, intervalId2, options = {}) {
        // No-op, returns null
        return null;
    }

    during(eventTerm, start, end, options = {}) {
        // No-op, returns a dummy ID
        return `SimpleDuring(${eventTerm})`;
    }

    query(subject, constraints = {}) {
        // No-op, returns empty array
        return [];
    }

    inferRelationship(event1, event2) {
        // No-op, returns null.
        return null;
    }

    processEventWithUncertainty(eventId, timeEstimate, uncertainty) {
        // No-op
    }

    describeTemporalRelationship(event1, event2) {
        // No-op, returns a placeholder string.
        return 'No temporal relationship known in SimpleTemporalManager.';
    }

    queryTimeWindow(start, end, options = {}) {
        // No-op, returns empty array
        return [];
    }

    predict(term, pattern, horizonInMinutes) {
        // Returns no predictions
        return [];
    }

    // getContext() is inherited from base class
}
