import { TemporalManagerBase } from './TemporalManagerBase.js';
import { TimeInterval } from '../support/TimeInterval.js';
import { id } from '../support/utils.js';

/**
 * An advanced temporal reasoner that implements Allen's Interval Algebra,
 * constraint propagation, and uncertainty handling for sophisticated
 * reasoning about time, based on the `enhance.b.md` proposal.
 */
export class TemporalReasoner extends TemporalManagerBase {
    constructor(nar) {
        super(nar);
        this._isAdvanced = true; // For tests
        this.temporalConstraints = new Map();
        this.timepoints = new Map(); // For events with uncertain timing
        this.intervals = new Map();

        // Allen's Interval Algebra Composition Table (partial, can be expanded)
        this.compositionTable = {
            'before': { 'before': 'before', 'meets': 'before', 'overlaps': ['before', 'meets', 'overlaps'], 'starts': 'before', 'during': ['before', 'meets', 'overlaps', 'during', 'starts'], 'finishes': ['before', 'meets', 'overlaps', 'during', 'starts'] },
            'meets': { 'before': 'before', 'meets': 'before', 'overlaps': 'before', 'starts': 'before', 'during': ['before', 'meets', 'overlaps'], 'finishes': ['before', 'meets', 'overlaps'] },
            'overlaps': { 'before': 'before', 'meets': 'before', 'overlaps': ['before', 'meets', 'overlaps'], 'starts': ['overlaps', 'during', 'starts'], 'during': ['overlaps', 'during'], 'finishes': ['overlaps', 'during', 'finishes', 'equals'] },
            'starts': { 'before': 'before', 'meets': 'before', 'overlaps': ['overlaps', 'during'], 'starts': 'starts', 'during': 'during', 'finishes': 'during' },
            'during': { 'before': 'before', 'meets': 'before', 'overlaps': ['overlaps', 'during'], 'starts': 'during', 'during': 'during', 'finishes': 'during' },
            'finishes': { 'before': 'before', 'meets': ['before', 'meets', 'overlaps'], 'overlaps': ['overlaps', 'during'], 'starts': 'during', 'during': 'during', 'finishes': 'finishes' },
            'after': { /* inverse of before */ },
            // Other relations can be added here
        };
    }

    /**
     * Creates and stores a temporal interval for a given term.
     * This is a helper method used by tests and for simple interval creation.
     * @param {string} term - The term to associate with the interval.
     * @param {number} start - The start timestamp (ms).
     * @param {number} end - The end timestamp (ms).
     * @param {object} options - Truth and budget options for the hyperedge.
     * @returns {string} The ID of the created interval hyperedge.
     */
    interval(term, start, end, options = {}) {
        const intervalId = id('TimeInterval', [term, start, end]);
        const interval = new TimeInterval(intervalId, term, start, end, options);
        this.intervals.set(intervalId, interval);

        // Also represent the interval symbolically in the hypergraph for general reasoning
        this.nar.api.addHyperedge('TimeInterval', [term, start, end], options);
        return intervalId;
    }

    /**
     * Adds a temporal constraint between two events.
     * @param {string} event1
     * @param {string} event2
     * @param {string} relation - e.g., 'before', 'after', 'overlaps'
     * @param {object} [options] - Truth, budget, etc.
     * @returns {string} The ID of the inferred hyperedge.
     */
    addConstraint(event1, event2, relation, options = {}) {
        const constraintId = id('TemporalConstraint', [event1, event2, relation]);

        if (this._wouldCreateContradiction(event1, event2, relation)) {
            // In a real system, this would trigger contradiction handling.
            // For now, we just warn and don't add the constraint.
            console.warn(`Temporal constraint would create contradiction: ${event1} ${relation} ${event2}`);
            return null;
        }

        const constraint = { id: constraintId, event1, event2, relation, ...options };
        this.temporalConstraints.set(constraintId, constraint);

        // Add to hypergraph and propagate
        const hyperedgeId = this.nar.api.addHyperedge('TemporalRelation', [event1, event2, relation], options);
        // Pass the hyperedgeId to the propagation logic
        constraint.id = hyperedgeId;
        this._propagateConstraint(constraint);

        return hyperedgeId;
    }

    /**
     * Creates a symbolic relationship between two existing temporal intervals.
     * This is a helper method for compatibility with tests.
     */
    relate(intervalId1, intervalId2, options = {}) {
        const interval1 = this.intervals.get(intervalId1);
        const interval2 = this.intervals.get(intervalId2);

        if (!interval1 || !interval2) {
            console.warn('Cannot create temporal relation: one or both intervals not found.');
            return null;
        }

        const relationType = interval1.relateTo(interval2);
        if (relationType === 'unknown') {
            return null;
        }

        return this.addConstraint(intervalId1, intervalId2, relationType, options);
    }

    /**
     * Finds intervals related to a subject with optional temporal constraints.
     */
    query(subject, constraints = {}) {
        const results = [];
        this.intervals.forEach(interval => {
            if (interval.term === subject) {
                let matches = true;
                if (constraints.before && interval.end >= constraints.before) matches = false;
                if (constraints.after && interval.start <= constraints.after) matches = false;

                if (matches) {
                    results.push({
                        intervalId: interval.id,
                        term: interval.term,
                        start: interval.start,
                        end: interval.end,
                        truth: interval.truth
                    });
                }
            }
        });
        return results;
    }

    /**
     * Infers the relationship between two events by traversing the constraint graph.
     * @param {string} event1
     * @param {string} event2
     * @returns {object|null} The inferred relationship or null.
     */
    inferRelationship(event1, event2) {
        // Direct relationship check
        for (const c of this.temporalConstraints.values()) {
            if (c.event1 === event1 && c.event2 === event2) return c;
            if (c.event1 === event2 && c.event2 === event1) {
                return { ...c, event1, event2, relation: this._getInverseTemporalRelation(c.relation) };
            }
        }

        // Transitive relationship check (BFS)
        const queue = [{ event: event1, path: [] }];
        const visited = new Set([event1]);

        while (queue.length > 0) {
            const { event: currentEvent, path } = queue.shift();
            if (currentEvent === event2) {
                return this._composePath(path); // Found a path, compose the relations
            }

            for (const c of this.temporalConstraints.values()) {
                if (c.event1 === currentEvent && !visited.has(c.event2)) {
                    visited.add(c.event2);
                    queue.push({ event: c.event2, path: [...path, c] });
                }
            }
        }
        return null; // No path found
    }

    /**
     * Processes a temporal event with uncertainty.
     * @param {string} eventId
     * @param {number} timeEstimate - The estimated timestamp (ms).
     * @param {number} uncertainty - A value (e.g., in ms) representing the uncertainty.
     */
    processEventWithUncertainty(eventId, timeEstimate, uncertainty) {
        const timepoint = { id: `timepoint:${eventId}`, estimate: timeEstimate, uncertainty, timestamp: Date.now() };
        this.timepoints.set(timepoint.id, timepoint);
        this.nar.notifyListeners('temporal-update', { eventId, timepoint });
    }

    /**
     * Generates a natural language description of a temporal relationship.
     * @param {string} event1
     * @param {string} event2
     * @returns {string}
     */
    describeTemporalRelationship(event1, event2) {
        const relationship = this.inferRelationship(event1, event2);
        if (!relationship) return `No known temporal relationship between ${event1} and ${event2}`;

        const rel = relationship.relation.replace(/([A-Z])/g, ' $1').toLowerCase();
        return `The event "${event1}" happens ${rel} the event "${event2}".`;
    }

    /**
     * Propagates a new constraint through the network to infer new relationships.
     */
    _propagateConstraint(newConstraint) {
        const toAdd = [];

        // Infer new relations: if (A rel1 B) and (B rel2 C), then infer (A rel3 C)
        this.temporalConstraints.forEach(existingConstraint => {
            if (newConstraint.event2 === existingConstraint.event1) {
                const composed = this._composeRelationships(newConstraint.relation, existingConstraint.relation);
                if (composed && !Array.isArray(composed)) {
                    toAdd.push({ event1: newConstraint.event1, event2: existingConstraint.event2, relation: composed, premises: [newConstraint.id, existingConstraint.id] });
                }
            }
            if (newConstraint.event1 === existingConstraint.event2) {
                const composed = this._composeRelationships(existingConstraint.relation, newConstraint.relation);
                if (composed && !Array.isArray(composed)) {
                    toAdd.push({ event1: existingConstraint.event1, event2: newConstraint.event2, relation: composed, premises: [existingConstraint.id, newConstraint.id] });
                }
            }
        });

        toAdd.forEach(c => {
            const newId = this.nar.api.addHyperedge('TemporalRelation', [c.event1, c.event2, c.relation], { premises: c.premises, derivedBy: 'TransitiveTemporal' });
            const newConstraint = { id: newId, event1: c.event1, event2: c.event2, relation: c.relation, premises: c.premises };
            this.temporalConstraints.set(newId, newConstraint);
        });
    }

    _composeRelationships(rel1, rel2) {
        const inverseRel1 = this.compositionTable[this._getInverseTemporalRelation(rel1)];
        const composed = this.compositionTable[rel1]?.[rel2] || inverseRel1?.[this._getInverseTemporalRelation(rel2)];
        return composed;
    }

    _composePath(path) {
        if (path.length === 0) return null;
        let composedRelation = path[0].relation;
        for (let i = 1; i < path.length; i++) {
            composedRelation = this._composeRelationships(composedRelation, path[i].relation);
            if (!composedRelation || Array.isArray(composedRelation)) {
                return { relation: 'ambiguous' }; // Path leads to ambiguity
            }
        }
        return {
            event1: path[0].event1,
            event2: path[path.length - 1].event2,
            relation: composedRelation,
            inferred: true,
            path
        };
    }

    _getInverseTemporalRelation(relation) {
        const inverses = {
            'before': 'after', 'after': 'before',
            'meets': 'metBy', 'metBy': 'meets',
            'overlaps': 'overlappedBy', 'overlappedBy': 'overlaps',
            'during': 'contains', 'contains': 'during',
            'starts': 'startedBy', 'startedBy': 'starts',
            'finishes': 'finishedBy', 'finishedBy': 'finishes',
            'equals': 'equals'
        };
        return inverses[relation] || 'unknown';
    }

    _wouldCreateContradiction(event1, event2, relation) {
        const existingRelation = this.inferRelationship(event1, event2);
        if (!existingRelation) return false;

        // A contradiction occurs if the new relation is the inverse of the existing one.
        if (existingRelation.relation === this._getInverseTemporalRelation(relation)) {
            return true;
        }

        // A more complex check would see if the composition is empty/impossible.
        return false;
    }
}
