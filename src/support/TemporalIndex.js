/**
 * A placeholder for a temporal indexing system.
 * This class is intended to provide an efficient way to query for events
 * and relationships based on time. A full implementation would likely
 * use a more advanced data structure like an Interval Tree.
 *
 * @todo Implement a more robust and efficient temporal indexing mechanism.
 */
export class TemporalIndex {
    constructor() {
        // For now, we'll just use a simple array. This is not efficient.
        this.events = [];
    }

    /**
     * Adds a temporal event to the index.
     * The event object should have at least a 'startTime' and 'endTime'.
     * @param {object} event - The temporal event to add.
     */
    add(event) {
        if (event && event.startTime !== undefined && event.endTime !== undefined) {
            this.events.push(event);
        }
    }

    /**
     * Removes a temporal event from the index.
     * @param {object} event - The temporal event to remove.
     */
    remove(event) {
        this.events = this.events.filter(e => e !== event);
    }

    /**
     * Queries for events that overlap with a given time window.
     * @param {number} startTime - The start of the query window.
     * @param {number} endTime - The end of the query window.
     * @returns {Array<object>} A list of events that fall within the window.
     */
    query(startTime, endTime) {
        // This is a naive, linear scan. Not suitable for production.
        return this.events.filter(event =>
            event.startTime < endTime && event.endTime > startTime
        );
    }

    /**
     * Clears all events from the index.
     */
    clear() {
        this.events = [];
    }
}
