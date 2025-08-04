export class TemporalManagerBase {
    constructor(nar) {
        if (this.constructor === TemporalManagerBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    interval(term, start, end, options = {}) {
        throw new Error("Method 'interval()' must be implemented.");
    }

    addConstraint(event1, event2, relation, options = {}) {
        throw new Error("Method 'addConstraint()' must be implemented.");
    }

    relate(term1, term2, relation, options = {}) {
        throw new Error("Method 'relate()' must be implemented.");
    }

    relateById(intervalId1, intervalId2, options = {}) {
        throw new Error("Method 'relateById()' must be implemented.");
    }

    during(eventTerm, start, end, options = {}) {
        throw new Error("Method 'during()' must be implemented.");
    }

    query(subject, constraints = {}) {
        throw new Error("Method 'query()' must be implemented.");
    }

    inferRelationship(event1, event2) {
        throw new Error("Method 'inferRelationship()' must be implemented.");
    }

    processEventWithUncertainty(eventId, timeEstimate, uncertainty) {
        throw new Error("Method 'processEventWithUncertainty()' must be implemented.");
    }

    describeTemporalRelationship(event1, event2) {
        throw new Error("Method 'describeTemporalRelationship()' must be implemented.");
    }

    queryTimeWindow(start, end, options = {}) {
        throw new Error("Method 'queryTimeWindow()' must be implemented.");
    }

    predict(term, pattern, horizonInMinutes) {
        throw new Error("Method 'predict()' must be implemented.");
    }

    adjustTemporalHorizon() {
    }

    getContext() {
        return {
            timestamp: Date.now(),
            currentPeriod: 'present',
            season: 'unknown'
        };
    }
}
