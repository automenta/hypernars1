import { TrieIndex } from '../support/TrieIndex.js';
import { StructuralIndex } from '../support/StructuralIndex.js';
import { LRUMap } from '../support/LRUMap.js';

/**
 * An optimized indexing system for large knowledge bases, as proposed
 * in the enhancement documents. It combines multiple indexing strategies
 * for efficient querying.
 */
export class OptimizedIndex {
    constructor(nar) {
        this.nar = nar;

        // --- Indexing Structures ---
        this.byType = new Map();
        this.byArg = new TrieIndex();
        this.byStructure = new StructuralIndex();

        // --- Caching ---
        this.derivationCache = new LRUMap(nar.config.derivationCacheSize || 5000);
        this.questionCache = new LRUMap(1000);

        // --- Popularity and Activity Tracking ---
        this.conceptPopularity = new Map();
        this.activeConcepts = new Set();
    }

    /**
     * Adds a hyperedge to all relevant indexes.
     * @param {Hyperedge} hyperedge
     */
    addToIndex(hyperedge) {
        if (!this.byType.has(hyperedge.type)) {
            this.byType.set(hyperedge.type, new Set());
        }
        this.byType.get(hyperedge.type).add(hyperedge.id);

        hyperedge.args.forEach(arg => {
            if (typeof arg === 'string') {
                this.byArg.add(arg, hyperedge.id);
            }
        });

        this.byStructure.add(hyperedge);
        this._updatePopularity(hyperedge.id, 'add');
    }

    /**
     * Removes a hyperedge from all indexes.
     * @param {Hyperedge} hyperedge
     */
    removeFromIndex(hyperedge) {
        if (this.byType.has(hyperedge.type)) {
            this.byType.get(hyperedge.type).delete(hyperedge.id);
        }

        hyperedge.args.forEach(arg => {
            if (typeof arg === 'string') {
                this.byArg.remove(arg, hyperedge.id);
            }
        });

        this.conceptPopularity.delete(hyperedge.id);
    }

    /**
     * Finds hyperedges that match a given pattern.
     * @param {string} pattern - The search pattern.
     * @returns {Set<string>} A set of matching hyperedge IDs.
     */
    query(pattern) {
        return this.byArg.get(pattern) || new Set();
    }

    /**
     * Updates the popularity score of a concept.
     * @param {string} conceptId
     * @param {string} activityType
     */
    _updatePopularity(conceptId, activityType) {
        const score = (this.conceptPopularity.get(conceptId) || 0) + 1;
        this.conceptPopularity.set(conceptId, score);

        this.activeConcepts.add(conceptId);
        if (this.activeConcepts.size > 2000) {
            const oldest = this.activeConcepts.keys().next().value;
            this.activeConcepts.delete(oldest);
        }
    }

    /**
     * Gets a list of the least popular concepts, which are candidates for pruning.
     * @param {number} count - The number of concepts to return.
     * @returns {Array<[string, number]>} An array of [conceptId, score] tuples.
     */
    getLeastPopular(count = 100) {
        const sorted = [...this.conceptPopularity.entries()].sort((a, b) => a[1] - b[1]);
        return sorted.slice(0, count);
    }
}
