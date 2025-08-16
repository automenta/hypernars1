import {TemporalManagerBase} from './TemporalManagerBase.js';

export class SimpleTemporalManager extends TemporalManagerBase {
    constructor(nar, config) {
        super(nar, config);
        this.intervals = new Map();
    }

    interval(term, start, end, options = {}) {
        const intervalId = `SimpleInterval(${term},${start},${end})`;
        this.intervals.set(intervalId, {term, start, end});
        return intervalId;
    }

    addConstraint(event1, event2, relation, options = {}) {
        return `SimpleConstraint(${event1},${event2})`;
    }

    relate(term1, term2, relation, options = {}) {
        return `SimpleRelation(${term1},${term2})`;
    }

    relateById(intervalId1, intervalId2, options = {}) {
        return null;
    }

    during(eventTerm, start, end, options = {}) {
        return `SimpleDuring(${eventTerm})`;
    }

    query(subject, constraints = {}) {
        return [];
    }

    inferRelationship(event1, event2) {
        return null;
    }

    processEventWithUncertainty(eventId, timeEstimate, uncertainty) {
    }

    describeTemporalRelationship(event1, event2) {
        return 'No temporal relationship known in SimpleTemporalManager.';
    }

    queryTimeWindow(start, end, options = {}) {
        return [];
    }

    predict(term, pattern, horizonInMinutes) {
        return [];
    }
}
