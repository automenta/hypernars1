import { TrieIndex } from '../support/TrieIndex.js';
import { StructuralIndex } from '../support/StructuralIndex.js';
import { LRUMap } from '../support/LRUMap.js';
import { ExpiringMap } from '../support/ExpiringMap.js';
import { TemporalIndex } from '../support/TemporalIndex.js';

/**
 * Optimized indexing system for large knowledge bases, as proposed
 * in the enhancement documents. It combines multiple indexing strategies
 * for efficient querying and includes mechanisms for memory optimization.
 */
export class OptimizedIndex {
    constructor(nar) {
        this.nar = nar; // Keep a reference to the main NAR system

        // --- Indexing Structures ---
        this.byType = new Map();
        this.byArg = new TrieIndex();
        this.byStructure = new StructuralIndex();
        this.temporal = new TemporalIndex();
        this.compound = new Map();

        // --- Caching ---
        this.derivationCache = new LRUMap(nar.config.derivationCacheSize || 5000);
        this.questionCache = new ExpiringMap(nar.config.questionCacheTTL || 300000);

        // --- Popularity and Activity Tracking ---
        this.activeConcepts = new Set();
        this.conceptPopularity = new Map();

        // --- Stats for optimizeMemory ---
        this.prunedCount = 0;
        this.cacheCompressionRatio = 0;
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
                this._indexSubstrings(arg, hyperedge.id);
            }
        });

        this.byStructure.add(hyperedge);
        this._updatePopularity(hyperedge.id);
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

        this.byStructure.remove(hyperedge);

        this.conceptPopularity.delete(hyperedge.id);
        this.activeConcepts.delete(hyperedge.id);
    }

    /**
     * Finds hyperedges matching a pattern with wildcards or variables.
     * @param {string} pattern - The search pattern.
     * @returns {Set<string>} A set of matching hyperedge IDs.
     */
    queryPattern(pattern) {
        if (pattern.includes('*')) {
            return this._queryWithWildcards(pattern);
        } else if (pattern.includes('$')) {
            return this._queryWithWildcards(pattern.replace(/\$[a-zA-Z0-9_]+/g, '*'));
        } else {
            return this.byArg.get(pattern) || new Set();
        }
    }

    /**
     * Optimizes memory usage by pruning less important data and cleaning up caches.
     * @returns {object} A report of the optimization process.
     */
    optimizeMemory() {
        const startTime = Date.now();
        this.prunedCount = 0;

        this._pruneLeastPopularConcepts();
        this._compressDerivationCache();
        this.questionCache.cleanup();

        if (typeof this.byArg.optimize === 'function') {
            this.byArg.optimize();
        }

        const duration = Date.now() - startTime;
        return {
            duration,
            conceptsPruned: this.prunedCount,
            cacheCompressed: this.cacheCompressionRatio,
        };
    }

    _indexSubstrings(arg, id) {
        for (let i = 3; i < arg.length; i++) {
            const substring = arg.substring(0, i);
            this.byArg.add(substring, id);
        }
    }

    _updatePopularity(conceptId) {
        const score = (this.conceptPopularity.get(conceptId) || 0) + 1;
        this.conceptPopularity.set(conceptId, score);

        this.activeConcepts.add(conceptId);
        if (this.activeConcepts.size > (this.nar.config.activeConceptsSize || 2000)) {
            const oldest = this.activeConcepts.keys().next().value;
            this.activeConcepts.delete(oldest);
        }
    }

    _queryWithWildcards(pattern) {
        const parts = pattern.split('*');
        let results = new Set();

        if (parts.length === 1) {
            return this.byArg.get(pattern) || new Set();
        }

        const prefix = parts[0];
        const searchResults = this.byArg.search(prefix);
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

        for (const term of searchResults) {
             if (regex.test(term)) {
                 const hyperedges = this.byArg.get(term);
                 if (hyperedges) {
                     hyperedges.forEach(id => results.add(id));
                 }
             }
        }
        return results;
    }

    _pruneLeastPopularConcepts(targetReduction = 0.1) {
        const concepts = Array.from(this.conceptPopularity.entries())
            .sort((a, b) => a[1] - b[1]);

        const pruneCount = Math.floor(concepts.length * targetReduction);
        if (pruneCount === 0) return;

        for (let i = 0; i < pruneCount; i++) {
            const [conceptId] = concepts[i];
            const hyperedge = this.nar.hypergraph.get(conceptId);
            if (hyperedge) {
                this.removeFromIndex(hyperedge);
                this.prunedCount++;
            }
        }
    }

    /**
     * @todo Implement derivation cache compression.
     */
    _compressDerivationCache() {
        this.cacheCompressionRatio = 0;
    }
}
