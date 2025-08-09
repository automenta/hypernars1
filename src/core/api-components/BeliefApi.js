export class BeliefApi {
    constructor(nar) {
        this.nar = nar;
    }

    getBelief(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        return hyperedge ? hyperedge.getStrongestBelief() : null;
    }

    getBeliefs(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        return hyperedge ? hyperedge.beliefs : [];
    }

    queryBelief(pattern) {
        const parsedPattern = this.nar.expressionEvaluator.parse(pattern);
        const hyperedgeId = this.nar.expressionEvaluator._getParsedStructureId(parsedPattern);
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        return hyperedge ? hyperedge.getStrongestBelief() : null;
    }
}
