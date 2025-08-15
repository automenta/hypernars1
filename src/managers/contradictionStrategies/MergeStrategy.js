import {TruthValue} from '../../support/TruthValue.js';

export class MergeStrategy {
    constructor(manager) {
        this.manager = manager;
    }

    resolve(hyperedgeId, contradiction) {
        const hyperedge = this.manager.nar.state.hypergraph.get(hyperedgeId);
        const beliefsWithEvidence = hyperedge.beliefs.map(belief => ({
            belief,
            evidenceStrength: this.manager._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const belief1 = beliefsWithEvidence[0];
        const belief2 = beliefsWithEvidence[1];

        if (!belief1 || !belief2) {
            return null;
        }

        const mergedTruth = TruthValue.revise(belief1.belief.truth, belief2.belief.truth);
        mergedTruth.doubt = Math.min(1.0, (mergedTruth.doubt + this.manager.config.mergeDoubtPenalty) * 0.7);

        const mergedBudget = belief1.belief.budget.merge(belief2.belief.budget).scale(this.manager.config.mergeBudgetPenalty);

        return {
            reason: 'merged',
            revisions: [
                {beliefId: belief1.belief.id, newTruth: mergedTruth, newBudget: mergedBudget},
                {beliefId: belief2.belief.id, newTruth: mergedTruth, newBudget: mergedBudget.scale(0.9)}
            ],
            deletions: []
        };
    }
}
