import { TruthValue } from '../../support/TruthValue.js';

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

        const modifiedBeliefs = otherBeliefs.map(item => {
            const modifiedBelief = {...item.belief};
            modifiedBelief.truth = new TruthValue(
                modifiedBelief.truth.frequency,
                modifiedBelief.truth.confidence * this.manager.config.weakenConfidenceFactor,
                modifiedBelief.truth.priority * this.manager.config.weakenPriorityFactor,
                Math.min(1.0, (modifiedBelief.truth.doubt || 0) + this.manager.config.weakenDoubtFactor)
            );
            return modifiedBelief;
        });

        const newBeliefs = [strongest.belief, ...modifiedBeliefs];

        return {reason: 'dominant_evidence', primaryBelief: strongest.belief, updatedBeliefs: newBeliefs};
    }
}
