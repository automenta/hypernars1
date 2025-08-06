export class PathCache {
    constructor(maxEntries = 100000) {
        this.cache = new Map();
        this.usageCount = new Map();
        this.lastAccess = new Map();
        this.maxEntries = maxEntries;
    }

    hasLoop(conceptId, pathHash) {
        if (!this.cache.has(pathHash)) {
            return false;
        }

        const pathSet = this.cache.get(pathHash);
        const hasLoop = pathSet.has(conceptId);

        this._updateUsage(pathHash);

        return hasLoop;
    }

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

    _updateUsage(pathHash) {
        this.usageCount.set(pathHash, (this.usageCount.get(pathHash) || 0) + 1);
        this.lastAccess.set(pathHash, Date.now());
    }
}
