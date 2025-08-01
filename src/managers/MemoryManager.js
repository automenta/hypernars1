import { MemoryManagerBase } from './MemoryManagerBase.js';

export class MemoryManager extends MemoryManagerBase {
    constructor(nar) {
        super(nar);
        this.beliefRelevance = new Map(); // Tracks relevance of beliefs
        this.accessPatterns = new Map(); // Tracks access patterns for cache optimization
        this.forgettingThreshold = 0.2; // Minimum relevance to retain beliefs
        this.relevanceDecayRate = 0.001; // Base rate of relevance decay
        this.activityWindow = 300000; // 5 minutes for recent activity tracking
    }

    maintainMemory() {
        this._decayRelevance();
        this._selectivelyForget();
        // Stubs for future optimization work
        // this._optimizeIndexes();
        // this._adjustCacheSizes();
    }

    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
        if (!hyperedgeId) return;

        if (!this.beliefRelevance.has(hyperedgeId)) {
            this.beliefRelevance.set(hyperedgeId, {
                baseRelevance: 0.5,
                recentActivity: [],
                lastAccess: Date.now()
            });
        }

        const relevance = this.beliefRelevance.get(hyperedgeId);
        const now = Date.now();

        // Clean up old activity records
        relevance.recentActivity = relevance.recentActivity.filter(
            record => now - record.timestamp < this.activityWindow);

        // Add new activity
        relevance.recentActivity.push({
            timestamp: now,
            type: activityType,
            intensity
        });

        // Update base relevance with decay
        const timeFactor = Math.exp(-(now - relevance.lastAccess) / this.activityWindow);
        relevance.baseRelevance = relevance.baseRelevance * timeFactor + intensity * 0.2;
        relevance.baseRelevance = Math.min(1.0, relevance.baseRelevance);
        relevance.lastAccess = now;

        this._trackAccessPattern(hyperedgeId, activityType);
    }

    _decayRelevance() {
        const now = Date.now();
        this.beliefRelevance.forEach((relevance, hyperedgeId) => {
            const timeDelta = now - relevance.lastAccess;
            if (timeDelta > 1000) { // Only decay if not accessed in the last second
                const timeDecay = Math.exp(-this.relevanceDecayRate * timeDelta / 1000);
                relevance.baseRelevance *= timeDecay;

                if (relevance.baseRelevance < 0.01 && !this.nar.hypergraph.has(hyperedgeId)) {
                    this.beliefRelevance.delete(hyperedgeId);
                }
            }
        });
    }

    _selectivelyForget() {
        const candidates = [];
        this.nar.state.hypergraph.forEach((hyperedge, id) => {
            if (this._isImportantConcept(id)) {
                return;
            }

            const relevance = this.beliefRelevance.get(id)?.baseRelevance || 0;
            const beliefStrength = hyperedge.getTruthExpectation();

            if (relevance < this.forgettingThreshold && beliefStrength < 0.5) {
                candidates.push({ id, score: relevance + beliefStrength });
            }
        });

        if (candidates.length === 0) return;

        candidates.sort((a, b) => a.score - b.score);

        const pruneCount = Math.min(10, Math.floor(candidates.length * 0.05));
        for (let i = 0; i < pruneCount; i++) {
            this._removeHyperedge(candidates[i].id);
        }
    }

    _isImportantConcept(hyperedgeId) {
        // Is it part of an active question?
        for (const questionId of this.nar.state.questionPromises.keys()) {
            if (questionId.includes(hyperedgeId)) {
                return true;
            }
        }

        // Does it have high relevance?
        const relevance = this.beliefRelevance.get(hyperedgeId);
        if (relevance && relevance.baseRelevance > 0.7) {
            return true;
        }

        // Was it accessed recently?
        if (relevance && (Date.now() - relevance.lastAccess) < (this.activityWindow / 10)) {
            return true;
        }

        return false;
    }

    _removeHyperedge(id) {
        const hyperedge = this.nar.state.hypergraph.get(id);
        if (!hyperedge) return;

        this.nar.state.hypergraph.delete(id);
        this.beliefRelevance.delete(id);
        this.nar.state.activations.delete(id);
        this.accessPatterns.delete(id);

        if (this.nar.state.index.byType.has(hyperedge.type)) {
            this.nar.state.index.byType.get(hyperedge.type).delete(id);
        }
        hyperedge.args.forEach(arg => {
            if (typeof arg === 'string') {
                this.nar.state.index.byArg.remove(arg, id);
            }
        });

        this.nar.notifyListeners('knowledge-pruned', { id, type: hyperedge.type });
    }

    _trackAccessPattern(hyperedgeId, activityType) {
        if (!this.accessPatterns.has(hyperedgeId)) {
            this.accessPatterns.set(hyperedgeId, {
                totalAccesses: 0,
                byType: new Map(),
                lastAccess: Date.now()
            });
        }

        const pattern = this.accessPatterns.get(hyperedgeId);
        pattern.totalAccesses++;
        pattern.lastAccess = Date.now();

        const typeCount = pattern.byType.get(activityType) || 0;
        pattern.byType.set(activityType, typeCount + 1);
    }
}
