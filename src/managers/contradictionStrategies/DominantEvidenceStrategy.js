import {TruthValue} from '../../support/TruthValue.js';

export class DominantEvidenceStrategy {
    constructor(manager) {
        this.manager = manager;
    }

    resolve(hyperedgeId, contradiction) {
        const hyperedge = this.manager.nar.state.hypergraph.get(hyperedgeId);
        const beliefsWithEvidence = hyperedge.beliefs.map(belief => ({
            belief,
            evidenceStrength: this.manager._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const strongest = beliefsWithEvidence[0];
        const otherBeliefs = beliefsWithEvidence.slice(1);

        const revisions = otherBeliefs.map(item => {
            const newTruth = new TruthValue(
                item.belief.truth.frequency,
                item.belief.truth.confidence * this.manager.config.weakenConfidenceFactor,
                item.belief.truth.priority * this.manager.config.weakenPriorityFactor,
                Math.min(1.0, (item.belief.truth.doubt || 0) + this.manager.config.weakenDoubtFactor)
            );
            // Weaken the budget as well
            const newBudget = item.belief.budget.scale(this.manager.config.weakenBudgetFactor || 0.5);
            return {beliefId: item.belief.id, newTruth, newBudget};
        });

        return {
            reason: 'dominant_evidence',
            revisions: revisions,
            deletions: [] // No deletions in this strategy
        };
    }
}
