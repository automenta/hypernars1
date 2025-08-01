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

        // Allen's Interval Algebra Composition Table (Full)
        this.compositionTable = {
            'before': {
                'before': 'before', 'meets': 'before', 'overlaps': 'before', 'finishedBy': 'before', 'contains': 'before',
                'starts': 'before', 'equals': 'before', 'startedBy': 'before', 'during': ['before', 'meets', 'overlaps', 'starts', 'during'],
                'finishes': ['before', 'meets', 'overlaps', 'starts', 'during'], 'overlappedBy': ['before', 'meets', 'overlaps', 'starts', 'during'],
                'metBy': ['before', 'meets', 'overlaps', 'starts', 'during'], 'after': ['before', 'meets', 'overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy', 'metBy', 'after']
            },
            'meets': {
                'before': 'before', 'meets': 'before', 'overlaps': 'before', 'finishedBy': 'before', 'contains': 'before',
                'starts': 'meets', 'equals': 'meets', 'startedBy': 'meets', 'during': ['overlaps', 'starts', 'during'],
                'finishes': ['overlaps', 'starts', 'during'], 'overlappedBy': ['overlaps', 'starts', 'during'],
                'metBy': ['finishedBy', 'equals', 'finishes'], 'after': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after']
            },
            'overlaps': {
                'before': 'before', 'meets': 'before', 'overlaps': ['before', 'meets', 'overlaps'], 'finishedBy': ['before', 'meets', 'overlaps'],
                'contains': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'], 'starts': 'overlaps', 'equals': 'overlaps',
                'startedBy': ['overlaps', 'finishedBy', 'contains'], 'during': ['overlaps', 'starts', 'during'], 'finishes': ['overlaps', 'starts', 'during'],
                'overlappedBy': ['overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy'],
                'metBy': ['contains', 'startedBy', 'overlappedBy'], 'after': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after']
            },
            'finishedBy': {
                'before': 'before', 'meets': 'meets', 'overlaps': 'overlaps', 'finishedBy': 'finishedBy', 'contains': 'contains',
                'starts': 'overlaps', 'equals': 'finishedBy', 'startedBy': 'contains', 'during': ['overlaps', 'starts', 'during'],
                'finishes': ['finishedBy', 'equals', 'finishes'], 'overlappedBy': ['contains', 'startedBy', 'overlappedBy'],
                'metBy': ['contains', 'startedBy', 'overlappedBy'], 'after': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after']
            },
            'contains': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'], 'meets': ['overlaps', 'finishedBy', 'contains'],
                'overlaps': ['overlaps', 'finishedBy', 'contains'], 'finishedBy': 'contains', 'contains': 'contains', 'starts': ['overlaps', 'finishedBy', 'contains'],
                'equals': 'contains', 'startedBy': 'contains', 'during': ['overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy'],
                'finishes': ['contains', 'startedBy', 'overlappedBy'], 'overlappedBy': ['contains', 'startedBy', 'overlappedBy'],
                'metBy': ['contains', 'startedBy', 'overlappedBy'], 'after': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after']
            },
            'starts': {
                'before': 'before', 'meets': 'before', 'overlaps': ['before', 'meets', 'overlaps'], 'finishedBy': ['before', 'meets', 'overlaps'],
                'contains': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'], 'starts': 'starts', 'equals': 'starts',
                'startedBy': ['starts', 'equals', 'startedBy'], 'during': 'during', 'finishes': 'during', 'overlappedBy': ['during', 'finishes', 'overlappedBy'],
                'metBy': 'metBy', 'after': 'after'
            },
            'equals': {
                'before': 'before', 'meets': 'meets', 'overlaps': 'overlaps', 'finishedBy': 'finishedBy', 'contains': 'contains',
                'starts': 'starts', 'equals': 'equals', 'startedBy': 'startedBy', 'during': 'during', 'finishes': 'finishes',
                'overlappedBy': 'overlappedBy', 'metBy': 'metBy', 'after': 'after'
            },
            'startedBy': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'], 'meets': ['overlaps', 'finishedBy', 'contains'],
                'overlaps': ['overlaps', 'finishedBy', 'contains'], 'finishedBy': 'contains', 'contains': 'contains',
                'starts': ['starts', 'equals', 'startedBy'], 'equals': 'startedBy', 'startedBy': 'startedBy',
                'during': ['during', 'finishes', 'overlappedBy'], 'finishes': 'overlappedBy', 'overlappedBy': 'overlappedBy', 'metBy': 'metBy', 'after': 'after'
            },
            'during': {
                'before': 'before', 'meets': 'before', 'overlaps': ['before', 'meets', 'overlaps', 'starts', 'during'],
                'finishedBy': ['before', 'meets', 'overlaps', 'starts', 'during'], 'contains': ['before', 'meets', 'overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'starts': 'during', 'equals': 'during', 'startedBy': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'during': 'during', 'finishes': 'during', 'overlappedBy': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'], 'metBy': 'after', 'after': 'after'
            },
            'finishes': {
                'before': 'before', 'meets': 'meets', 'overlaps': ['overlaps', 'starts', 'during'], 'finishedBy': ['finishedBy', 'equals', 'finishes'],
                'contains': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after'], 'starts': 'during', 'equals': 'finishes',
                'startedBy': ['overlappedBy', 'metBy', 'after'], 'during': 'during', 'finishes': 'finishes',
                'overlappedBy': ['overlappedBy', 'metBy', 'after'], 'metBy': 'after', 'after': 'after'
            },
            'overlappedBy': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'], 'meets': ['overlaps', 'finishedBy', 'contains'],
                'overlaps': ['overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy'],
                'finishedBy': ['contains', 'startedBy', 'overlappedBy'], 'contains': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after'],
                'starts': ['during', 'finishes', 'overlappedBy'], 'equals': 'overlappedBy', 'startedBy': ['overlappedBy', 'metBy', 'after'],
                'during': ['during', 'finishes', 'overlappedBy'], 'finishes': 'overlappedBy', 'overlappedBy': ['overlappedBy', 'metBy', 'after'],
                'metBy': 'after', 'after': 'after'
            },
            'metBy': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'], 'meets': ['starts', 'equals', 'startedBy'],
                'overlaps': ['during', 'finishes', 'overlappedBy'], 'finishedBy': 'metBy', 'contains': 'after', 'starts': ['during', 'finishes', 'overlappedBy'],
                'equals': 'metBy', 'startedBy': 'after', 'during': ['during', 'finishes', 'overlappedBy'], 'finishes': 'metBy',
                'overlappedBy': 'after', 'metBy': 'after', 'after': 'after'
            },
            'after': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'meets': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'], 'overlaps': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'finishedBy': 'after', 'contains': 'after', 'starts': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'equals': 'after', 'startedBy': 'after', 'during': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'finishes': 'after', 'overlappedBy': 'after', 'metBy': 'after', 'after': 'after'
            }
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
        const relations1 = Array.isArray(rel1) ? rel1 : [rel1];
        const relations2 = Array.isArray(rel2) ? rel2 : [rel2];
        let resultSet = new Set();

        for (const r1 of relations1) {
            for (const r2 of relations2) {
                const composed = this.compositionTable[r1]?.[r2];
                if (composed) {
                    if (Array.isArray(composed)) {
                        composed.forEach(c => resultSet.add(c));
                    } else {
                        resultSet.add(composed);
                    }
                }
            }
        }

        const resultArray = Array.from(resultSet);
        if (resultArray.length === 0) return null; // No possible relation
        if (resultArray.length === 1) return resultArray[0]; // Single relation
        return resultArray; // Disjunction of relations
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

    _wouldCreateContradiction(event1, event2, newRelation) {
        const existing = this.inferRelationship(event1, event2);
        if (!existing || !existing.relation || existing.relation === 'ambiguous') {
            return false; // No existing concrete relationship, so no contradiction possible yet.
        }

        const existingRelations = Array.isArray(existing.relation) ? existing.relation : [existing.relation];

        // The new state would be the intersection of the existing possibilities and the new relation.
        // If the intersection is empty, it's a contradiction.
        // Since we are only adding a single new relation, we just check if it's in the existing set.
        if (existingRelations.includes(newRelation)) {
            return false; // It's redundant, but not a contradiction.
        }

        // A more robust check: the composition of the existing relation and the inverse of the
        // new relation must be possible (i.e., not an empty set). If it's empty, it's a contradiction.
        // This is a basic path-consistency check for the link between event1 and event2.
        const composed = this._composeRelationships(existing.relation, this._getInverseTemporalRelation(newRelation));

        // If the composition results in an empty set of possible relations, it's a contradiction.
        return composed === null;
    }

    /**
     * Adjusts the system's temporal horizon based on the number of active
     * temporal constraints, making the system more focused when temporal
     * reasoning is more active.
     */
    adjustTemporalHorizon() {
        const numConstraints = this.temporalConstraints.size;
        const baseHorizon = 5; // Default base horizon from config
        const maxHorizon = 30; // A reasonable maximum to prevent excessive lookahead

        // Increase horizon based on the number of constraints, with diminishing returns
        const newHorizon = Math.min(maxHorizon, baseHorizon + Math.floor(Math.sqrt(numConstraints)));

        if (this.nar.config.temporalHorizon !== newHorizon) {
            this.nar.notifyListeners('log', {
                message: `Adjusting temporal horizon from ${this.nar.config.temporalHorizon} to ${newHorizon} based on ${numConstraints} constraints.`
            });
            this.nar.config.temporalHorizon = newHorizon;
        }
    }

    /**
     * Projects what might be true at a future time based on current temporal knowledge.
     * @param {string} term - The starting term for the projection.
     * @param {number} milliseconds - How far into the future to project (in ms).
     * @returns {Array<object>} A list of predicted future events with confidence.
     */
    project(term, milliseconds) {
        const now = Date.now();
        const futureTime = now + milliseconds;
        const predictions = new Map(); // Use map to avoid duplicate predictions

        // Find all constraints involving the given term
        for (const constraint of this.temporalConstraints.values()) {
            let sourceEvent, relation, predictedEvent;

            if (constraint.event1 === term) {
                sourceEvent = constraint.event1;
                relation = constraint.relation;
                predictedEvent = constraint.event2;
            } else if (constraint.event2 === term) {
                sourceEvent = constraint.event2;
                relation = this._getInverseTemporalRelation(constraint.relation);
                predictedEvent = constraint.event1;
            } else {
                continue;
            }

            // Only consider relations that imply future occurrence
            if (['before', 'meets', 'overlaps', 'starts', 'during'].includes(relation)) {
                const sourceInterval = Array.from(this.intervals.values()).find(i => i.term === sourceEvent && i.end >= now);

                if (sourceInterval) {
                     const confidence = this._calculateProjectionConfidence(relation, sourceInterval, futureTime);

                     if (confidence > 0.2) { // Confidence threshold
                        const predictedHyperedge = this.nar.state.hypergraph.get(id('Term', [predictedEvent]));
                        if (!predictions.has(predictedEvent) || predictions.get(predictedEvent).confidence < confidence) {
                            predictions.set(predictedEvent, {
                                term: predictedEvent,
                                confidence,
                                truth: predictedHyperedge ? predictedHyperedge.getTruth() : TruthValue.unknown(),
                                reason: `${sourceEvent} ${relation} ${predictedEvent}`
                            });
                        }
                     }
                }
            }
        }

        // Also consider ongoing intervals
        for (const interval of this.intervals.values()) {
            if (interval.start <= now && interval.end > futureTime) {
                const confidence = 0.95; // High confidence if it will still be active
                if (!predictions.has(interval.term) || predictions.get(interval.term).confidence < confidence) {
                    predictions.set(interval.term, {
                        term: interval.term,
                        confidence,
                        truth: interval.truth,
                        reason: `Ongoing interval ${interval.id}`
                    });
                }
            }
        }

        return Array.from(predictions.values()).sort((a, b) => b.confidence - a.confidence);
    }

    _calculateProjectionConfidence(relation, sourceInterval, futureTime) {
        const timeToFuture = Math.max(0, futureTime - sourceInterval.end);
        const decay = Math.exp(-timeToFuture / (this.nar.config.temporalHorizon * 1000));

        let baseConfidence = 0.5;
        if (relation === 'meets') baseConfidence = 0.9;
        if (relation === 'starts') baseConfidence = 0.8;
        if (relation === 'overlaps') baseConfidence = 0.7;
        if (relation === 'before') baseConfidence = 0.4;

        return baseConfidence * decay * sourceInterval.truth.confidence;
    }
}
