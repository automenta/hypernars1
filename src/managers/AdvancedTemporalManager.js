import {TemporalManagerBase} from './TemporalManagerBase.js';
import {TimeInterval} from '../support/TimeInterval.js';
import {id} from '../support/utils.js';

/**
 * An advanced temporal manager that implements Allen's Interval Algebra
 * for sophisticated reasoning about time.
 */
export class AdvancedTemporalManager extends TemporalManagerBase {
    constructor(nar) {
        super(nar);
        this._isAdvanced = true; // Debug property
        // This map will store the actual TimeInterval objects.
        // The key is the hyperedge ID of the interval term.
        this.intervals = new Map();
        this.relations = new Map();
    }

    /**
     * Creates and stores a temporal interval for a given term.
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
     * Creates a symbolic relationship between two existing temporal intervals.
     * It computes the relation using Allen's algebra and asserts it into the hypergraph.
     * @param {string} intervalId1 - The ID of the first interval hyperedge.
     * @param {string} intervalId2 - The ID of the second interval hyperedge.
     * @param {object} options - Truth and budget options for the relation.
     * @returns {string|null} The ID of the created relation hyperedge, or null if intervals don't exist.
     */
    relate(intervalId1, intervalId2, options = {}) {
        const interval1 = this.intervals.get(intervalId1);
        const interval2 = this.intervals.get(intervalId2);

        if (!interval1 || !interval2) {
            console.warn('Cannot create temporal relation: one or both intervals not found.', { intervalId1, intervalId2 });
            return null;
        }

        const relationType = interval1.relateTo(interval2);
        if (relationType === 'unknown') {
            return null;
        }

        // Store the computed relation symbolically in the hypergraph
        const relationId = this.nar.api.addHyperedge('TemporalRelation', [intervalId1, intervalId2, relationType], options);

        // Also store it on the interval objects for quick access
        interval1.relations.set(intervalId2, relationType);
        interval2.relations.set(intervalId1, this._getInverseTemporalRelation(relationType));

        return relationId;
    }

    /**
     * Finds intervals related to a subject with optional temporal constraints.
     * @param {string} subject - The term to query for.
     * @param {object} [constraints={}] - Constraints like { before: timestamp, after: timestamp }.
     * @returns {Array<object>} A list of matching intervals and their details.
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
     * Gets the inverse of a temporal relation.
     * @param {string} relation - The relation from Allen's algebra.
     * @returns {string} The inverse relation.
     */
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

    /**
     * Adjusts the temporal horizon. This is a placeholder for now but could be
     * used by the MetaReasoner to focus or broaden temporal analysis.
     */
    adjustTemporalHorizon() {
        // This could be used to prune old intervals from the `this.intervals` map
        // or to adjust the scope of temporal queries.
    }

    /**
     * Gets the current temporal context.
     * @returns {{timestamp: number, currentPeriod: string}}
     */
    getContext() {
        return { timestamp: Date.now(), currentPeriod: 'present' };
    }
}
