import { TemporalManagerBase } from './TemporalManagerBase.js';
import { TimeInterval } from '../support/TimeInterval.js';
import { id } from '../support/utils.js';
import { TruthValue } from '../support/TruthValue.js';

/**
 * An advanced temporal manager that implements a comprehensive temporal framework
 * with intervals, durations, relationships, and predictive capabilities.
 */
export class AdvancedTemporalManager extends TemporalManagerBase {
    constructor(nar) {
        super(nar);
        this.intervals = new Map(); // Stores TimeInterval objects
        this.projections = new Map(); // Stores future projections
    }

    /**
     * Define temporal interval with start/end times or a duration pattern.
     * @param {string} term - Term being described.
     * @param {string|number} start - Start time or a duration pattern like "daily".
     * @param {string|number} [end] - End time (if start is absolute) or a pattern.
     * @param {Object} [options] - Additional options.
     */
    during(term, start, end, options = {}) {
        // This handles cases like `during('meeting', '9:00-10:00', 'daily')`
        // where the third argument is a pattern.
        if (typeof end === 'string' && !end.includes(':') && !Number.isFinite(parseInt(end))) {
            const pattern = end;
            return this._addTemporalInterval(term, start, null, pattern, options);
        }
        // This handles cases like `during('meeting', 1672531200000, 1672534800000)`
        return this._addTemporalInterval(term, start, end, null, options);
    }

    /**
     * Define a relative temporal relationship between two terms.
     * @param {string} term1 - First term.
     * @param {string} term2 - Second term.
     * @param {string} relation - 'before', 'after', 'during', 'overlaps'.
     * @param {Object} [options] - Confidence and priority.
     */
    relate(term1, term2, relation, options = {}) {
        return this._addTemporalRelation(term1, term2, relation, options);
    }

    /**
     * Project future events based on patterns.
     * @param {string} event - Event to project.
     * @param {string} pattern - Temporal pattern (e.g., 'during(commute)').
     * @param {number} horizon - Minutes into the future to project.
     */
    predict(event, pattern, horizon) {
        return this._addTemporalProjection(event, pattern, horizon);
    }

    /**
     * Get the current temporal context.
     * @returns {Object} Current time context.
     */
    getContext() {
        return this._getTemporalContext();
    }

    /**
     * Internal method to add a temporal interval.
     * @private
     */
    _addTemporalInterval(term, start, end, pattern, options) {
        const finalArgs = [term, start, end, pattern].filter(Boolean);
        const intervalId = id('TimeInterval', finalArgs);
        const interval = new TimeInterval(intervalId, term, start, end, options);
        this.intervals.set(intervalId, interval);

        // Add to hypergraph, ensuring the ID matches exactly
        this.nar.api.addHyperedge('TimeInterval', finalArgs, options);
        return intervalId;
    }

    /**
     * Internal method to add a temporal relation.
     * @private
     */
    _addTemporalRelation(term1, term2, relation, options) {
        const relationId = id('TemporalRelation', [term1, term2, relation]);
        this.nar.api.addHyperedge('TemporalRelation', [term1, term2, relation], options);
        return relationId;
    }

    /**
     * Internal method to add a temporal projection.
     * @private
     */
    _addTemporalProjection(event, pattern, horizon) {
        const projectionId = id('TemporalProjection', [event, pattern, horizon]);
        const projectionTime = Date.now() + horizon * 60000; // horizon in minutes

        this.projections.set(projectionId, { event, pattern, horizon, projectionTime });

        // Add to hypergraph as a belief about the future
        this.nar.api.addHyperedge('TemporalProjection', [event, pattern, horizon], {
            truth: new TruthValue(0.7, 0.6) // Projections are uncertain
        });

        return projectionId;
    }

    /**
     * Internal method to get temporal context.
     * @private
     */
    _getTemporalContext() {
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

    /**
     * Adjusts the temporal horizon. Could be used by MetaReasoner.
     */
    adjustTemporalHorizon() {
        const now = Date.now();
        // Prune old projections
        for (const [id, proj] of this.projections.entries()) {
            if (proj.projectionTime < now) {
                this.projections.delete(id);
            }
        }
    }
}
