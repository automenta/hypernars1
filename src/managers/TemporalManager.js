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
        const table = {
            'before': { 'before': ['before'], 'meets': ['before'], 'overlaps': ['before'], 'starts': ['before'], 'during': ['before'], 'finishes': ['before'] },
            'meets': { 'before': ['before'], 'meets': ['before'], 'overlaps': ['before'], 'starts': ['before'], 'during': ['before'] },
            'overlaps': { 'before': ['before'], 'meets': ['before'], 'overlaps': ['before', 'meets', 'overlaps'], 'starts': ['overlaps', 'during'], 'during': ['overlaps', 'during'], 'finishes': ['overlaps', 'during', 'finishes'] },
            'starts': { 'overlaps': ['overlaps'], 'starts': ['starts'], 'during': ['during'], 'finishes': ['finishes'] },
            'during': { 'overlaps': ['overlaps'], 'during': ['during'], 'finishes': ['finishes'] },
            'finishes': { 'before': ['before'], 'meets': ['before'], 'overlaps': ['overlaps'], 'starts': ['finishes'], 'during': ['finishes'], 'finishes': ['finishes'] }
        };

        // Auto-populate with inverse relations
        const relations = Object.keys(table);
        for(const r1 of relations) {
            for(const r2 of relations) {
                if (table[r1] && table[r1][r2]) {
                    const inv_r1 = this._getInverseTemporalRelation(r1);
                    const inv_r2 = this._getInverseTemporalRelation(r2);
                    if(inv_r1 && inv_r2) {
                        if(!table[inv_r2]) table[inv_r2] = {};
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
            const match = relation.match(/(.+?)\\((.+?),(.+?)\\)/);
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
    predict(event, pattern, horizon) {
        // Placeholder for future implementation
        return [];
    }
}
