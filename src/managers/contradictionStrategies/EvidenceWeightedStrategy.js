import {TruthValue} from '../../support/TruthValue.js';
import {Budget} from '../../support/Budget.js';

export class EvidenceWeightedStrategy {
    constructor(manager) {
        this.manager = manager;
    }

    resolve(hyperedgeId, contradiction) {
        const hyperedge = this.manager.nar.state.hypergraph.get(hyperedgeId);
        let totalWeight = 0;
        let weightedFrequency = 0;
        let weightedConfidence = 0;

        hyperedge.beliefs.forEach(belief => {
            const weight = this.manager._calculateEvidenceStrength(hyperedgeId, belief);
            weightedFrequency += belief.truth.frequency * weight;
            weightedConfidence += belief.truth.confidence * weight;
            totalWeight += weight;
        });

        if (totalWeight > 0) {
            const newTruth = new TruthValue(
                weightedFrequency / totalWeight,
                weightedConfidence / totalWeight
            );
            const newBudget = new Budget({
                priority: Math.min(1.0, totalWeight / hyperedge.beliefs.length),
                durability: this.manager.config.evidenceWeightingDurability,
                quality: weightedConfidence / totalWeight
            });
            hyperedge.beliefs = [{truth: newTruth, budget: newBudget, timestamp: Date.now()}];
            return {reason: 'evidence-weighted', newTruth};
        }
        return null;
    }
}
