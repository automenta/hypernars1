export class SpecializationStrategy {
    constructor(manager) {
        this.manager = manager;
    }

    resolve(hyperedgeId, contradiction) {
        const hyperedge = this.manager.nar.state.hypergraph.get(hyperedgeId);
        const beliefsWithEvidence = hyperedge.beliefs.map((belief, index) => ({
            belief,
            evidenceStrength: this.manager._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const conflictingBeliefData = beliefsWithEvidence[1];
        if (!conflictingBeliefData) return null;

        const conflictingBelief = conflictingBeliefData.belief;
        const context = this.manager._getBeliefContext(hyperedge, conflictingBelief) || 'alternative_context';

        const specializationResult = this.manager._createContextualSpecialization(hyperedge, conflictingBelief, context);
        hyperedge.beliefs = hyperedge.beliefs.filter(b => b !== conflictingBelief);

        return specializationResult;
    }
}
