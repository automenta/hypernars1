export class RecencyBiasedStrategy {
    constructor(manager) {
        this.manager = manager;
    }

    resolve(hyperedgeId, contradiction) {
        const hyperedge = this.manager.nar.state.hypergraph.get(hyperedgeId);
        const mostRecent = [...hyperedge.beliefs].sort((a, b) => b.timestamp - a.timestamp)[0];
        hyperedge.beliefs = [mostRecent];
        return {reason: 'recency-biased', primaryBelief: mostRecent};
    }
}
