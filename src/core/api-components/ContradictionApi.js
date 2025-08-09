export class ContradictionApi {
    constructor(nar) {
        this.nar = nar;
    }

    getContradictions() {
        if (!this.nar.contradictionManager.contradictions) {
            return [];
        }
        return Array.from(this.nar.contradictionManager.contradictions.entries())
            .filter(([, data]) => !data.resolved)
            .map(([id, data]) => ({id, ...data}));
    }

    analyzeContradiction(hyperedgeId) {
        return this.nar.contradictionManager.analyze(hyperedgeId);
    }

    resolveContradiction(hyperedgeId, strategy, options) {
        return this.nar.contradictionManager.manualResolve(hyperedgeId, strategy, options);
    }
}
