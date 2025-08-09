export class TemporalApi {
    constructor(nar) {
        this.nar = nar;
    }

    temporalInterval(term, start, end, options = {}) {
        return this.nar.temporalManager.interval(term, start, end, options);
    }

    temporalConstraint(event1, event2, relation, options = {}) {
        return this.nar.temporalManager.addConstraint(event1, event2, relation, options);
    }

    inferTemporalRelationship(event1, event2) {
        return this.nar.temporalManager.inferRelationship(event1, event2);
    }

    projectTemporal(term, milliseconds) {
        return this.nar.temporalManager.project(term, milliseconds);
    }
}
