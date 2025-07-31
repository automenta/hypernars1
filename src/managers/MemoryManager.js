export class MemoryManager {
    constructor(nar) {
        this.nar = nar;
        this.beliefRelevance = new Map();
        this.forgettingThreshold = 0.1;
        this.relevanceDecayRate = 0.001;
        this.activityWindow = 300000; // 5 minutes
    }

    maintainMemory() {
        this._decayRelevance();
        this._selectivelyForget();
    }

    updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
        if (!hyperedgeId) return;
        let relevance = this.beliefRelevance.get(hyperedgeId);
        if (!relevance) {
            relevance = { baseRelevance: 0.5, lastAccess: Date.now() };
            this.beliefRelevance.set(hyperedgeId, relevance);
        }

        const now = Date.now();
        const timeSinceAccess = now - relevance.lastAccess;
        const decayFactor = Math.exp(-this.relevanceDecayRate * timeSinceAccess / 1000);

        relevance.baseRelevance = relevance.baseRelevance * decayFactor + intensity * (1 - decayFactor);
        relevance.baseRelevance = Math.min(1.0, relevance.baseRelevance);
        relevance.lastAccess = now;
    }

    _decayRelevance() {
        const now = Date.now();
        this.beliefRelevance.forEach((relevance, hyperedgeId) => {
            const timeDelta = now - relevance.lastAccess;
            if (timeDelta > 1000) { // Only decay if not accessed in the last second
                const decayFactor = Math.exp(-this.relevanceDecayRate * timeDelta / 1000);
                relevance.baseRelevance *= decayFactor;

                if (relevance.baseRelevance < 0.01 && !this.nar.hypergraph.has(hyperedgeId)) {
                    this.beliefRelevance.delete(hyperedgeId);
                }
            }
        });
    }

    _selectivelyForget() {
        const candidates = [];
        this.nar.hypergraph.forEach((hyperedge, id) => {
            const relevance = this.beliefRelevance.get(id)?.baseRelevance || 0;
            const beliefStrength = hyperedge.getTruthExpectation();

            // Do not forget very strong or very new beliefs
            if (beliefStrength > 0.9 || (this.beliefRelevance.get(id)?.lastAccess || 0) > Date.now() - 60000) {
                return;
            }

            if (relevance < this.forgettingThreshold && beliefStrength < 0.5) {
                candidates.push({ id, relevance, beliefStrength });
            }
        });

        if (candidates.length === 0) return;

        candidates.sort((a, b) => (a.relevance + a.beliefStrength) - (b.relevance + b.beliefStrength));

        const pruneCount = Math.min(5, Math.floor(candidates.length * 0.05));
        for (let i = 0; i < pruneCount; i++) {
            const idToForget = candidates[i].id;
            this._removeHyperedge(idToForget);
        }
    }

    _removeHyperedge(id) {
        const hyperedge = this.nar.hypergraph.get(id);
        if (!hyperedge) return;

        this.nar.hypergraph.delete(id);
        this.beliefRelevance.delete(id);
        this.nar.activations.delete(id);

        if (this.nar.index.byType.has(hyperedge.type)) {
            this.nar.index.byType.get(hyperedge.type).delete(id);
        }
        hyperedge.args.forEach(arg => {
            if (typeof arg === 'string') {
                this.nar.index.byArg.remove(arg, id);
            }
        });

        this.nar.notifyListeners('knowledge-pruned', { id, type: hyperedge.type });
    }
}
