import {TemporalManagerBase} from './TemporalManagerBase.js';
import {TimeInterval} from '../support/TimeInterval.js';
import {id} from '../support/utils.js';
import {TruthValue} from '../support/TruthValue.js';

const defaultConfig = {
    maxPropagationIterations: 10,
    defaultTemporalHorizon: 5,
    maxTemporalHorizon: 30,
    predictionConfidenceThreshold: 0.2,
    predictionBaseConfidence: {
        meets: 0.9,
        starts: 0.8,
        overlaps: 0.7,
        before: 0.4,
        default: 0.5
    },
    defaultIntervalConfidence: 0.9,
    recurringIntervalDurationHours: 1,
};

export class TemporalReasoner extends TemporalManagerBase {
    constructor(nar, config) {
        super(nar, config);
        this.config = {...defaultConfig, ...config};
        this._isAdvanced = true;
        this.temporalConstraints = new Map();
        this.timepoints = new Map();
        this.intervals = new Map();

        this.compositionTable = {
            'before': {
                'before': 'before',
                'meets': 'before',
                'overlaps': 'before',
                'finishedBy': 'before',
                'contains': 'before',
                'starts': 'before',
                'equals': 'before',
                'startedBy': 'before',
                'during': ['before', 'meets', 'overlaps', 'starts', 'during'],
                'finishes': ['before', 'meets', 'overlaps', 'starts', 'during'],
                'overlappedBy': ['before', 'meets', 'overlaps', 'starts', 'during'],
                'metBy': ['before', 'meets', 'overlaps', 'starts', 'during'],
                'after': ['before', 'meets', 'overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy', 'metBy', 'after']
            },
            'meets': {
                'before': 'before',
                'meets': 'before',
                'overlaps': 'before',
                'finishedBy': 'before',
                'contains': 'before',
                'starts': 'overlaps',
                'equals': 'meets',
                'startedBy': 'meets',
                'during': ['overlaps', 'starts', 'during'],
                'finishes': ['overlaps', 'starts', 'during'],
                'overlappedBy': ['overlaps', 'starts', 'during'],
                'metBy': ['finishedBy', 'equals', 'finishes'],
                'after': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after']
            },
            'overlaps': {
                'before': 'before',
                'meets': 'before',
                'overlaps': ['before', 'meets', 'overlaps'],
                'finishedBy': ['before', 'meets', 'overlaps'],
                'contains': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'],
                'starts': 'overlaps',
                'equals': 'overlaps',
                'startedBy': ['overlaps', 'finishedBy', 'contains'],
                'during': ['overlaps', 'starts', 'during'],
                'finishes': ['overlaps', 'starts', 'during'],
                'overlappedBy': ['overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy'],
                'metBy': ['contains', 'startedBy', 'overlappedBy'],
                'after': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after']
            },
            'finishedBy': {
                'before': 'before',
                'meets': 'meets',
                'overlaps': 'overlaps',
                'finishedBy': 'finishedBy',
                'contains': 'contains',
                'starts': 'overlaps',
                'equals': 'finishedBy',
                'startedBy': 'contains',
                'during': ['overlaps', 'starts', 'during'],
                'finishes': ['finishedBy', 'equals', 'finishes'],
                'overlappedBy': ['contains', 'startedBy', 'overlappedBy'],
                'metBy': ['contains', 'startedBy', 'overlappedBy'],
                'after': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after']
            },
            'contains': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'],
                'meets': ['overlaps', 'finishedBy', 'contains'],
                'overlaps': ['overlaps', 'finishedBy', 'contains'],
                'finishedBy': 'contains',
                'contains': 'contains',
                'starts': ['overlaps', 'finishedBy', 'contains'],
                'equals': 'contains',
                'startedBy': 'contains',
                'during': ['overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy'],
                'finishes': ['contains', 'startedBy', 'overlappedBy'],
                'overlappedBy': ['contains', 'startedBy', 'overlappedBy'],
                'metBy': ['contains', 'startedBy', 'overlappedBy'],
                'after': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after']
            },
            'starts': {
                'before': 'before',
                'meets': 'before',
                'overlaps': ['before', 'meets', 'overlaps'],
                'finishedBy': ['before', 'meets', 'overlaps'],
                'contains': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'],
                'starts': 'starts',
                'equals': 'starts',
                'startedBy': ['starts', 'equals', 'startedBy'],
                'during': 'during',
                'finishes': 'during',
                'overlappedBy': ['during', 'finishes', 'overlappedBy'],
                'metBy': 'metBy',
                'after': 'after'
            },
            'equals': {
                'before': 'before',
                'meets': 'meets',
                'overlaps': 'overlaps',
                'finishedBy': 'finishedBy',
                'contains': 'contains',
                'starts': 'starts',
                'equals': 'equals',
                'startedBy': 'startedBy',
                'during': 'during',
                'finishes': 'finishes',
                'overlappedBy': 'overlappedBy',
                'metBy': 'metBy',
                'after': 'after'
            },
            'startedBy': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'],
                'meets': ['overlaps', 'finishedBy', 'contains'],
                'overlaps': ['overlaps', 'finishedBy', 'contains'],
                'finishedBy': 'contains',
                'contains': 'contains',
                'starts': ['starts', 'equals', 'startedBy'],
                'equals': 'startedBy',
                'startedBy': 'startedBy',
                'during': ['during', 'finishes', 'overlappedBy'],
                'finishes': 'overlappedBy',
                'overlappedBy': 'overlappedBy',
                'metBy': 'metBy',
                'after': 'after'
            },
            'during': {
                'before': 'before',
                'meets': 'before',
                'overlaps': ['before', 'meets', 'overlaps', 'starts', 'during'],
                'finishedBy': ['before', 'meets', 'overlaps', 'starts', 'during'],
                'contains': ['before', 'meets', 'overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'starts': 'during',
                'equals': 'during',
                'startedBy': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'during': 'during',
                'finishes': 'during',
                'overlappedBy': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'metBy': 'after',
                'after': 'after'
            },
            'finishes': {
                'before': 'before',
                'meets': 'meets',
                'overlaps': ['overlaps', 'starts', 'during'],
                'finishedBy': ['finishedBy', 'equals', 'finishes'],
                'contains': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after'],
                'starts': 'during',
                'equals': 'finishes',
                'startedBy': ['overlappedBy', 'metBy', 'after'],
                'during': 'during',
                'finishes': 'finishes',
                'overlappedBy': ['overlappedBy', 'metBy', 'after'],
                'metBy': 'after',
                'after': 'after'
            },
            'overlappedBy': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'],
                'meets': ['overlaps', 'finishedBy', 'contains'],
                'overlaps': ['overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy'],
                'finishedBy': ['contains', 'startedBy', 'overlappedBy'],
                'contains': ['contains', 'startedBy', 'overlappedBy', 'metBy', 'after'],
                'starts': ['during', 'finishes', 'overlappedBy'],
                'equals': 'overlappedBy',
                'startedBy': ['overlappedBy', 'metBy', 'after'],
                'during': ['during', 'finishes', 'overlappedBy'],
                'finishes': 'overlappedBy',
                'overlappedBy': ['overlappedBy', 'metBy', 'after'],
                'metBy': 'after',
                'after': 'after'
            },
            'metBy': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains'],
                'meets': ['starts', 'equals', 'startedBy'],
                'overlaps': ['during', 'finishes', 'overlappedBy'],
                'finishedBy': 'metBy',
                'contains': 'after',
                'starts': ['during', 'finishes', 'overlappedBy'],
                'equals': 'metBy',
                'startedBy': 'after',
                'during': ['during', 'finishes', 'overlappedBy'],
                'finishes': 'metBy',
                'overlappedBy': 'after',
                'metBy': 'after',
                'after': 'after'
            },
            'after': {
                'before': ['before', 'meets', 'overlaps', 'finishedBy', 'contains', 'starts', 'equals', 'startedBy', 'during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'meets': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'overlaps': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'finishedBy': 'after',
                'contains': 'after',
                'starts': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'equals': 'after',
                'startedBy': 'after',
                'during': ['during', 'finishes', 'overlappedBy', 'metBy', 'after'],
                'finishes': 'after',
                'overlappedBy': 'after',
                'metBy': 'after',
                'after': 'after'
            }
        };
    }

    interval(term, start, end, options = {}) {
        const intervalId = id('TimeInterval', [term, start, end]);
        const interval = new TimeInterval(intervalId, term, start, end, options);
        this.intervals.set(intervalId, interval);

        this.nar.api.addHyperedge('TimeInterval', [term, start, end], options);
        return intervalId;
    }

    addConstraint(event1, event2, relation, options = {}) {
        const constraintId = id('TemporalConstraint', [event1, event2, relation]);

        if (this._wouldCreateContradiction(event1, event2, relation)) {
            this.nar.emit('log', {
                message: 'Temporal constraint would create contradiction',
                level: 'warn'
            });
            return null;
        }

        const constraint = {id: constraintId, event1, event2, relation, ...options};
        this.temporalConstraints.set(constraintId, constraint);

        const hyperedgeId = this.nar.api.addHyperedge('TemporalRelation', [event1, event2, relation], options);
        constraint.id = hyperedgeId;
        this._propagateConstraint(constraint);

        return hyperedgeId;
    }

    relate(term1, term2, relation, options = {}) {
        const interval1 = Array.from(this.intervals.values()).find(i => i.term === term1);
        const interval2 = Array.from(this.intervals.values()).find(i => i.term === term2);

        if (interval1 && interval2) {
            return this.addConstraint(interval1.id, interval2.id, relation, options);
        }
        return null;
    }

    relateById(intervalId1, intervalId2, options = {}) {
        const interval1 = this.intervals.get(intervalId1);
        const interval2 = this.intervals.get(intervalId2);

        if (!interval1 || !interval2) {
            return null;
        }

        const relationType = interval1.relateTo(interval2);
        if (relationType === 'unknown') {
            return null;
        }

        return this.addConstraint(intervalId1, intervalId2, relationType, options);
    }

    during(eventTerm, start, end, options = {}, now) {
        const patterns = ['daily', 'weekly', 'monthly'];
        if (typeof end === 'string' && patterns.includes(end.toLowerCase())) {
            return this._createRecurringInterval(eventTerm, start, end.toLowerCase(), options, now);
        }

        const intervalTerm = `interval_${start}_${end}`;
        const intervalId = this.interval(intervalTerm, start, end, options);
        return this.addConstraint(eventTerm, intervalId, 'during', options);
    }

    _createRecurringInterval(eventTerm, timeString, pattern, options, now = new Date()) {
        const [hour, minute] = timeString.split(':').map(Number);
        let nextEvent = new Date(now.getTime());

        nextEvent.setUTCHours(hour, minute, 0, 0);

        switch (pattern) {
            case 'daily':
                if (nextEvent.getTime() <= now.getTime()) {
                    nextEvent.setUTCDate(nextEvent.getUTCDate() + 1);
                }
                break;
            case 'weekly':
                if (nextEvent.getTime() <= now.getTime()) {
                    nextEvent.setUTCDate(nextEvent.getUTCDate() + 7);
                }
                break;
            case 'monthly':
                if (nextEvent.getTime() <= now.getTime()) {
                    nextEvent.setUTCMonth(nextEvent.getUTCMonth() + 1);
                }
                break;
        }

        const start = nextEvent.getTime();
        const end = start + this.config.recurringIntervalDurationHours * 60 * 60 * 1000;

        const intervalTerm = `${eventTerm}_${pattern}_${start}`;
        const intervalId = this.interval(intervalTerm, start, end, options);
        return this.addConstraint(eventTerm, intervalId, 'during', options);
    }

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

    inferRelationship(event1, event2) {
        for (const c of this.temporalConstraints.values()) {
            if (c.event1 === event1 && c.event2 === event2) return c;
            if (c.event1 === event2 && c.event2 === event1) {
                return {...c, event1, event2, relation: this._getInverseTemporalRelation(c.relation)};
            }
        }

        const queue = [{event: event1, path: []}];
        const visited = new Set([event1]);

        while (queue.length > 0) {
            const {event: currentEvent, path} = queue.shift();
            if (currentEvent === event2) {
                return this._composePath(path);
            }

            for (const c of this.temporalConstraints.values()) {
                if (c.event1 === currentEvent && !visited.has(c.event2)) {
                    visited.add(c.event2);
                    queue.push({event: c.event2, path: [...path, c]});
                } else if (c.event2 === currentEvent && !visited.has(c.event1)) {
                    visited.add(c.event1);
                    const inverseConstraint = {...c, event1: c.event2, event2: c.event1, relation: this._getInverseTemporalRelation(c.relation)};
                    queue.push({event: c.event1, path: [...path, inverseConstraint]});
                }
            }
        }
        return null;
    }

    processEventWithUncertainty(eventId, timeEstimate, uncertainty) {
        const timepoint = {id: `timepoint:${eventId}`, estimate: timeEstimate, uncertainty, timestamp: Date.now()};
        this.timepoints.set(timepoint.id, timepoint);
        this.nar.emit('temporal-update', {eventId, timepoint});
    }

    describeTemporalRelationship(event1, event2) {
        const relationship = this.inferRelationship(event1, event2);
        if (!relationship) return `No known temporal relationship between ${event1} and ${event2}`;

        const rel = relationship.relation.replace(/([A-Z])/g, ' $1').toLowerCase();
        return `The event "${event1}" happens ${rel} the event "${event2}".`;
    }

    _propagateConstraint(initialConstraint) {
        const propagationQueue = [initialConstraint];
        const maxIterations = this.temporalConstraints.size + this.config.maxPropagationIterations;
        let iterations = 0;

        while (propagationQueue.length > 0 && iterations < maxIterations) {
            const newConstraint = propagationQueue.shift();
            iterations++;

            const inferredRelations = [];

            this.temporalConstraints.forEach(existingConstraint => {
                if (newConstraint.event2 === existingConstraint.event1) {
                    const composedRelation = this._composeRelationships(newConstraint.relation, existingConstraint.relation);
                    if (composedRelation) {
                        const composedTruth = this._composeTruthValues(newConstraint, existingConstraint);
                        inferredRelations.push({
                            event1: newConstraint.event1,
                            event2: existingConstraint.event2,
                            relation: composedRelation,
                            truth: composedTruth,
                            premises: [newConstraint.id, existingConstraint.id]
                        });
                    }
                } else if (newConstraint.event1 === existingConstraint.event2) {
                    const composedRelation = this._composeRelationships(existingConstraint.relation, newConstraint.relation);
                    if (composedRelation) {
                        const composedTruth = this._composeTruthValues(existingConstraint, newConstraint);
                        inferredRelations.push({
                            event1: existingConstraint.event1,
                            event2: newConstraint.event2,
                            relation: composedRelation,
                            truth: composedTruth,
                            premises: [existingConstraint.id, newConstraint.id]
                        });
                    }
                }
            });

            inferredRelations.forEach(inferred => {
                if (this._wouldCreateContradiction(inferred.event1, inferred.event2, inferred.relation)) {
                    this.nar.emit('log', {
                        message: `Inferred temporal relation ${inferred.event1} ${inferred.relation} ${inferred.event2} creates a contradiction.`,
                        level: 'warn'
                    });
                    return;
                }

                const existing = this.inferRelationship(inferred.event1, inferred.event2);
                if (existing && JSON.stringify(existing.relation) === JSON.stringify(inferred.relation)) {
                    return;
                }

                const newId = this.nar.api.addHyperedge('TemporalRelation', [inferred.event1, inferred.event2, inferred.relation], {
                    truth: inferred.truth,
                    premises: inferred.premises,
                    derivedBy: 'TransitiveTemporal'
                });

                if (newId) {
                    const newConstraintData = {
                        id: newId,
                        event1: inferred.event1,
                        event2: inferred.event2,
                        relation: inferred.relation,
                        truth: inferred.truth,
                        premises: inferred.premises
                    };
                    this.temporalConstraints.set(newId, newConstraintData);
                    propagationQueue.push(newConstraintData);
                }
            });
        }

        if (iterations >= maxIterations && maxIterations > 10) {
            this.nar.emit('log', {message: 'Temporal propagation reached max iterations.', level: 'warn'});
        }
    }

    _composeTruthValues(constraint1, constraint2) {
        const t1 = constraint1.truth || this.nar.state.hypergraph.get(constraint1.id)?.getTruth() || TruthValue.certain();
        const t2 = constraint2.truth || this.nar.state.hypergraph.get(constraint2.id)?.getTruth() || TruthValue.certain();
        return TruthValue.transitive(t1, t2);
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
        if (resultArray.length === 0) return null;
        if (resultArray.length === 1) return resultArray[0];
        return resultArray;
    }

    _composePath(path) {
        if (path.length === 0) return null;
        let composedRelation = path[0].relation;
        for (let i = 1; i < path.length; i++) {
            composedRelation = this._composeRelationships(composedRelation, path[i].relation);
            if (!composedRelation) {
                return null;
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

    getContext() {
        const now = new Date();
        const hour = now.getHours();
        let currentPeriod = 'night';
        if (hour >= 5 && hour < 12) currentPeriod = 'morning';
        else if (hour >= 12 && hour < 17) currentPeriod = 'afternoon';
        else if (hour >= 17 && hour < 21) currentPeriod = 'evening';

        const seasons = ['winter', 'spring', 'summer', 'fall'];
        const season = seasons[Math.floor((now.getMonth() / 12) * 4) % 4];

        return {
            timestamp: now.getTime(),
            currentPeriod,
            season
        };
    }

    queryTimeWindow(start, end, options = {}) {
        const {minConfidence = 0.5} = options;
        const results = [];

        for (const interval of this.intervals.values()) {
            if (interval.overlapsWith(start, end) && interval.truth.confidence >= minConfidence) {
                results.push({
                    id: interval.id,
                    term: interval.term,
                    start: interval.start,
                    end: interval.end,
                    truth: interval.truth
                });
            }
        }
        return results;
    }

    _wouldCreateContradiction(event1, event2, newRelation) {
        const existing = this.inferRelationship(event1, event2);
        if (!existing || !existing.relation || existing.relation === 'ambiguous') {
            return false;
        }

        const existingRelations = Array.isArray(existing.relation) ? existing.relation : [existing.relation];
        const newRelations = Array.isArray(newRelation) ? newRelation : [newRelation];

        for (const er of existingRelations) {
            for (const nr of newRelations) {
                if (this._getInverseTemporalRelation(er) === nr) {
                    return true;
                }
            }
        }

        const composed = this._composeRelationships(existing.relation, this._getInverseTemporalRelation(newRelation));
        return composed === null;
    }

    adjustTemporalHorizon() {
        const numConstraints = this.temporalConstraints.size;
        const baseHorizon = this.config.defaultTemporalHorizon;
        const maxHorizon = this.config.maxTemporalHorizon;

        const newHorizon = Math.min(maxHorizon, baseHorizon + Math.floor(Math.sqrt(numConstraints)));

        if (this.nar.config.temporalHorizon !== newHorizon) {
            this.nar.config.temporalHorizon = newHorizon;
        }
    }

    predict(term, pattern, horizonInMinutes) {
        const horizon = horizonInMinutes * 60 * 1000;
        const now = Date.now();
        const futureTime = now + horizon;
        const predictions = new Map();

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

            if (['before', 'meets', 'overlaps', 'starts', 'during'].includes(relation)) {
                const sourceInterval = Array.from(this.intervals.values()).find(i => i.term === sourceEvent && i.end >= now);

                if (sourceInterval) {
                    const confidence = this._calculatePredictionConfidence(relation, sourceInterval, futureTime, horizon);

                    if (confidence > this.config.predictionConfidenceThreshold) {
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

        for (const interval of this.intervals.values()) {
            if (interval.start <= now && interval.end > futureTime) {
                const confidence = 0.95;
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

    _calculatePredictionConfidence(relation, sourceInterval, futureTime, horizon) {
        const timeToFuture = Math.max(0, futureTime - sourceInterval.end);
        const decay = Math.exp(-timeToFuture / horizon);

        let baseConfidence = this.config.predictionBaseConfidence[relation] || this.config.predictionBaseConfidence.default;

        const sourceConfidence = sourceInterval.truth?.confidence ?? this.config.defaultIntervalConfidence;

        return baseConfidence * decay * sourceConfidence;
    }
}
