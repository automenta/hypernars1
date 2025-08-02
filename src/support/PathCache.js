/**
 * Path cache with cycle detection and resource-based pruning.
 * This class is used to keep track of reasoning paths to detect loops
 * and to prune paths that are not frequently used or have become stale.
 */
export class PathCache {
    /**
     * @param {number} [maxEntries=100000] - The approximate maximum number of paths to cache.
     */
    constructor(maxEntries = 100000) {
        this.cache = new Map(); // Maps pathHash to Set<conceptId>
        this.usageCount = new Map(); // Tracks how often paths are used
        this.lastAccess = new Map(); // Tracks when paths were last accessed
        this.maxEntries = maxEntries;
    }

    /**
     * Checks if adding a concept to a given path would create a loop.
     * @param {string} conceptId - The ID of the concept being added.
     * @param {string} pathHash - The hash representing the current path.
     * @returns {boolean} True if a loop is detected, false otherwise.
     */
    hasLoop(conceptId, pathHash) {
        if (!this.cache.has(pathHash)) {
            return false;
        }

        const pathSet = this.cache.get(pathHash);
        const hasLoop = pathSet.has(conceptId);

        this._updateUsage(pathHash);

        return hasLoop;
    }

    /**
     * Adds a concept to a given path in the cache.
     * @param {string} conceptId - The ID of the concept to add.
     * @param {string} pathHash - The hash representing the path.
     */
    addConceptToPath(conceptId, pathHash) {
        if (!this.cache.has(pathHash)) {
            this.cache.set(pathHash, new Set());
            this.usageCount.set(pathHash, 0);
        }

        this.cache.get(pathHash).add(conceptId);
        this._updateUsage(pathHash);

        if (this.cache.size > this.maxEntries * 1.2) {
            this._pruneLeastUsedPaths();
        }
    }

    /**
     * Prunes the least used paths from the cache based on usage frequency and recency.
     * @param {number} [targetReduction=0.2] - The fraction of paths to prune.
     */
    _pruneLeastUsedPaths(targetReduction = 0.2) {
        const now = Date.now();
        const paths = Array.from(this.usageCount.entries()).sort((a, b) => {
            const aScore = a[1] + (now - (this.lastAccess.get(a[0]) || now)) / 1000000;
            const bScore = b[1] + (now - (this.lastAccess.get(b[0]) || now)) / 1000000;
            return aScore - bScore;
        });

        const pruneCount = Math.floor(paths.length * targetReduction);

        for (let i = 0; i < pruneCount; i++) {
            const [pathHash] = paths[i];
            this.cache.delete(pathHash);
            this.usageCount.delete(pathHash);
            this.lastAccess.delete(pathHash);
        }
    }

    /**
     * Updates the usage statistics for a given path.
     * @param {string} pathHash - The hash of the path to update.
     * @private
     */
    _updateUsage(pathHash) {
        this.usageCount.set(pathHash, (this.usageCount.get(pathHash) || 0) + 1);
        this.lastAccess.set(pathHash, Date.now());
    }
}
