import { TruthValue } from '../../support/TruthValue.js';
import { Budget } from '../../support/Budget.js';

export class SourceReliabilityStrategy {
    constructor(manager) {
        this.manager = manager;
    }

    resolve(hyperedgeId, contradiction, {sourceWeights = {}} = {}) {
        const hyperedge = this.manager.nar.state.hypergraph.get(hyperedgeId);
        let totalWeight = 0;
        let weightedFrequency = 0;
        let weightedConfidence = 0;

        hyperedge.beliefs.forEach(belief => {
            const source = this.manager._getSource(belief);
            const sourceReliability = sourceWeights[source] || this.manager.nar.state.sourceReliability?.get(source) || this.manager.config.defaultSourceReliability;
            const weight = sourceReliability * belief.budget.priority;

            weightedFrequency += belief.truth.frequency * weight;
            weightedConfidence += belief.truth.confidence * weight;
            totalWeight += weight;
        });

        if (totalWeight > 0) {
            const newTruth = new TruthValue(weightedFrequency / totalWeight, weightedConfidence / totalWeight);
            hyperedge.beliefs = [{
                truth: newTruth,
                budget: Budget.full().scale(this.manager.config.sourceReliabilityBudgetScale),
                timestamp: Date.now()
            }];
            return {reason: 'source-reliability', newTruth};
        }
        return null;
    }
}
