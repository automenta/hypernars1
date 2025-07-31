import { TimeInterval } from '../support/TimeInterval.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { Hyperedge } from '../support/Hyperedge.js';
import { id, hash } from '../support/utils.js';

export class TemporalManager {
    constructor(nar) {
        this.nar = nar;
        this.temporalIntervals = new Map();
        this.temporalConstraints = new Map();
        // Ensure the temporalTerms index exists
        if (!this.nar.index.temporalTerms) {
            this.nar.index.temporalTerms = new Map();
        }
    }

    // Creates a new time interval for a term
    interval(term, start, end, options = {}) {
        const intervalId = id('TimeInterval', [term, start, end]);
        if (this.temporalIntervals.has(intervalId)) {
            return intervalId;
        }
        const interval = new TimeInterval(intervalId, start, end, options);
        this.temporalIntervals.set(intervalId, interval);
        this.nar.addToIndex(new Hyperedge(intervalId, 'TimeInterval', [term, start, end]));
        return intervalId;
    }

    // Creates a temporal constraint
    constraint(relation, minDuration, maxDuration) {
        const constraintId = id('TemporalConstraint', [relation, minDuration, maxDuration]);
        this.temporalConstraints.set(constraintId, {
            relation,
            minDuration,
            maxDuration,
            truth: TruthValue.certain().scale(0.85)
        });
        return constraintId;
    }

    // Establishes a temporal relation between two intervals
    temporalRelation(premise, conclusion, relation, options = {}) {
        const { truth, budget } = options;
        const relationId = id('TemporalRelation', [premise, conclusion, relation]);

        const premiseInterval = this.temporalIntervals.get(premise);
        const conclusionInterval = this.temporalIntervals.get(conclusion);

        if (!premiseInterval || !conclusionInterval) {
            // Silently fail if intervals don't exist, as they might be created later
            return null;
        }

        premiseInterval.relations.set(conclusion, relation);
        const inverseRelation = this._getInverseTemporalRelation(relation);
        if (inverseRelation) {
            conclusionInterval.relations.set(premise, inverseRelation);
        }

        const hyperedge = this.nar.addHyperedge('TemporalRelation', [premise, conclusion, relation], { truth, budget });
        this._deriveTransitiveTemporalRelations(premiseInterval);
        return hyperedge;
    }

    // Retrieves the inverse of a temporal relation
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
        return inverses[relation];
    }

    // Derives new temporal relations through transitivity
    _deriveTransitiveTemporalRelations(interval) {
        const premiseId = interval.id;
        for (const [conclusionId, relation1] of interval.relations) {
            const conclusionInterval = this.temporalIntervals.get(conclusionId);
            if (!conclusionInterval) continue;

            for (const [finalId, relation2] of conclusionInterval.relations) {
                if (finalId === premiseId) continue; // Avoid direct loops

                const composedRelations = this._composeTemporalRelations(relation1, relation2);
                if (composedRelations) {
                    for (const composed of composedRelations) {
                        this.temporalRelation(premiseId, finalId, composed, {
                            truth: TruthValue.certain().scale(0.7), // derived truth
                            budget: Budget.full().scale(0.6)
                        });
                    }
                }
            }
        }
    }

    // Allen's Interval Algebra composition table
    _composeTemporalRelations(rel1, rel2) {
        const b = ['before'];
        const m = ['meets'];
        const o = ['overlaps'];
        const s = ['starts'];
        const d = ['during'];
        const f = ['finishes'];
        const e = ['equals'];
        const a = ['after'];
        const mb = ['metBy'];
        const ob = ['overlappedBy'];
        const sb = ['startedBy'];
        const c = ['contains'];
        const fb = ['finishedBy'];

        const all = ['before', 'meets', 'overlaps', 'starts', 'during', 'finishes', 'equals', 'after', 'metBy', 'overlappedBy', 'startedBy', 'contains', 'finishedBy'];

        const table = {
            'before': {
                'before': b, 'meets': b, 'overlaps': b, 'starts': b, 'during': b, 'finishes': b, 'equals': b,
                'after': all, 'metBy': all, 'overlappedBy': all, 'startedBy': all, 'contains': all, 'finishedBy': all
            },
            'meets': {
                'before': b, 'meets': b, 'overlaps': b, 'starts': b, 'during': b, 'finishes': m, 'equals': m,
                'after': all, 'metBy': ['overlaps', 'during', 'finishes'], 'overlappedBy': ['overlaps', 'during', 'finishes'], 'startedBy': all, 'contains': all, 'finishedBy': all
            },
            'overlaps': {
                'before': b, 'meets': b, 'overlaps': ['before', 'meets', 'overlaps'], 'starts': ['before', 'meets', 'overlaps'], 'during': ['before', 'meets', 'overlaps'], 'finishes': ['overlaps', 'during', 'finishes'], 'equals': ['overlaps', 'during', 'finishes'],
                'after': all, 'metBy': ['starts', 'during', 'contains'], 'overlappedBy': ['starts', 'during', 'contains'], 'startedBy': all, 'contains': all, 'finishedBy': all
            },
            'starts': {
                'before': b, 'meets': m, 'overlaps': o, 'starts': s, 'during': d, 'finishes': f, 'equals': e,
                'after': a, 'metBy': mb, 'overlappedBy': ob, 'startedBy': sb, 'contains': c, 'finishedBy': fb
            },
            'during': {
                'before': b, 'meets': m, 'overlaps': o, 'starts': s, 'during': d, 'finishes': d, 'equals': d,
                'after': a, 'metBy': ob, 'overlappedBy': ob, 'startedBy': c, 'contains': c, 'finishedBy': c
            },
            'finishes': {
                'before': b, 'meets': m, 'overlaps': o, 'starts': o, 'during': d, 'finishes': f, 'equals': f,
                'after': a, 'metBy': ob, 'overlappedBy': ob, 'startedBy': c, 'contains': c, 'finishedBy': fb
            },
            'equals': {
                'before': b, 'meets': m, 'overlaps': o, 'starts': s, 'during': d, 'finishes': f, 'equals': e,
                'after': a, 'metBy': mb, 'overlappedBy': ob, 'startedBy': sb, 'contains': c, 'finishedBy': fb
            },
        };

        // Build out the full table using inverses to avoid manual entry for all 169 pairs
        if (Object.keys(table).length < 13) {
            const relations = ['before', 'meets', 'overlaps', 'starts', 'during', 'finishes', 'equals'];
            for (const r1 of relations) {
                const inv_r1 = this._getInverseTemporalRelation(r1);
                if (inv_r1 && inv_r1 !== r1) {
                    table[inv_r1] = {};
                }
            }
             for (const r1 of relations) {
                for (const r2 of relations) {
                    const inv_r1 = this._getInverseTemporalRelation(r1);
                    const inv_r2 = this._getInverseTemporalRelation(r2);
                    if (inv_r1 && inv_r2) {
                        const composed = table[r1][r2].map(r => this._getInverseTemporalRelation(r)).filter(r => r);
                        if (composed.length > 0) {
                           table[inv_r2][inv_r1] = composed;
                        }
                    }
                }
            }
        }
        return table[rel1]?.[rel2];
    }

    // Processes temporal constraints during the reasoning cycle
    processTemporalConstraints(target, activation, budget, pathHash, pathLength, derivationPath) {
        const constraints = Array.from(this.temporalConstraints.values()).filter(c =>
            c.relation.includes(target) || c.relation.includes('*'));

        for (const constraint of constraints) {
            const { relation, minDuration, maxDuration } = constraint;
            const match = relation.match(/(.+?)\((.+?),(.+?)\)/);
            if(!match) continue;

            const [_, op, term1, term2] = match;

            if (this._hasTemporalEvidence(term1, term2, minDuration, maxDuration)) {
              const distance = this._temporalDistance(term1, term2);
              const constraintActivation = activation * (1 - Math.min(1, Math.abs(distance - (minDuration + maxDuration) / 2) / maxDuration));
              this.nar.propagate(term2, constraintActivation, budget.scale(0.7),
                pathHash ^ hash(`constraint:${relation}`), pathLength + 1,
                [...derivationPath, 'temporal_constraint']);
            }
        }
    }

    // Checks if there is temporal evidence satisfying a constraint
    _hasTemporalEvidence(term1, term2, minDur, maxDur) {
        const now = Date.now();
        // This assumes temporal links are stored in nar.temporalLinks, which needs to be ensured.
        const links = Array.from(this.nar.temporalLinks.values()).filter(link =>
            (link.premise === term1 && link.conclusion === term2) ||
            (link.premise === term2 && link.conclusion === term1));

        return links.some(link => {
            const duration = Math.abs(link.timestamp - now);
            return duration >= minDur && duration <= maxDur;
        });
    }

    // Calculates the temporal distance between two terms
    _temporalDistance(term1, term2) {
        const now = Date.now();
        const links = Array.from(this.nar.temporalLinks.values()).filter(link =>
            (link.premise === term1 && link.conclusion === term2) ||
            (link.premise === term2 && link.conclusion === term1));
        if(links.length > 0) {
            // Return average distance if multiple links exist
            const avgTimestamp = links.reduce((sum, link) => sum + link.timestamp, 0) / links.length;
            return Math.abs(avgTimestamp - now);
        }
        return Infinity;
    }

    // Provides the current temporal context
    getContext() {
        const now = Date.now();
        let currentPeriod = 'present';
        // This is a placeholder. A real implementation would have more sophisticated context detection.
        return {
            timestamp: now,
            currentPeriod
        };
    }

    // Predicts future events based on patterns
    predict(term, milliseconds, options = {}) {
        const now = Date.now();
        const future = now + milliseconds;
        const results = [];

        // Find all temporal relationships involving the term
        // This requires iterating through intervals that involve the term.
        this.temporalIntervals.forEach(interval => {
            if (interval.id.includes(term)) {
                const relation = interval.relations.values().next().value; // Simplified: gets first relation
                const otherIntervalId = interval.relations.keys().next().value;
                if (!otherIntervalId) return;

                const otherInterval = this.temporalIntervals.get(otherIntervalId);
                if(!otherInterval) return;

                const eventTerm = otherInterval.id;

                // Calculate if the event would be true at the future time
                let isTrueAtFuture = false;
                switch(relation) {
                  case 'before':
                    isTrueAtFuture = (interval.end) < future;
                    break;
                  case 'during':
                    isTrueAtFuture = interval.start <= future && (interval.end) >= future;
                    break;
                  case 'after':
                    isTrueAtFuture = interval.start > future;
                    break;
                  // Additional cases for all Allen relations...
                }

                if (isTrueAtFuture) {
                  const hyperedge = this.nar.hypergraph.get(id('Term', [eventTerm]));
                  if (hyperedge) {
                    results.push({
                      term: eventTerm,
                      truth: hyperedge.getTruth(),
                      confidence: this._calculateTemporalConfidence(relation, interval.start, future, interval.duration)
                    });
                  }
                }
            }
        });

        // Sort by confidence
        return results.sort((a, b) => b.confidence - a.confidence);
    }

    _calculateTemporalConfidence(relation, timestamp, futureTime, duration) {
        const timeDelta = Math.max(0, futureTime - timestamp) / 1000; // seconds
        const decayFactor = Math.exp(-0.05 * timeDelta);
        return (this.nar.config.baseTemporalConfidence || 0.8) * decayFactor;
    }

    queryTemporal(subject, constraints = {}) {
        const results = [];
        this.temporalIntervals.forEach(interval => {
            if (interval.id.includes(subject)) {
                let matches = true;

                // Check temporal constraints
                if (constraints.before && interval.end >= constraints.before) matches = false;
                if (constraints.after && interval.start <= constraints.after) matches = false;
                if (constraints.during) {
                    const duringInterval = this.temporalIntervals.get(constraints.during);
                    if (duringInterval && interval.relateTo(duringInterval) !== 'during') matches = false;
                }

                if (matches) {
                    results.push({
                        interval: interval.id,
                        start: interval.start,
                        end: interval.end,
                        truth: interval.truth,
                    });
                }
            }
        });
        return results;
    }
}
