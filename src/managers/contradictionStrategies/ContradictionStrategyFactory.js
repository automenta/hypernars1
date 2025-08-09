import {DominantEvidenceStrategy} from './DominantEvidenceStrategy.js';
import {MergeStrategy} from './MergeStrategy.js';
import {SpecializationStrategy} from './SpecializationStrategy.js';
import {EvidenceWeightedStrategy} from './EvidenceWeightedStrategy.js';
import {RecencyBiasedStrategy} from './RecencyBiasedStrategy.js';
import {SourceReliabilityStrategy} from './SourceReliabilityStrategy.js';

const strategies = {
    'dominant_evidence': DominantEvidenceStrategy,
    'merge': MergeStrategy,
    'specialize': SpecializationStrategy,
    'evidence-weighted': EvidenceWeightedStrategy,
    'recency-biased': RecencyBiasedStrategy,
    'source-reliability': SourceReliabilityStrategy,
};

export class ContradictionStrategyFactory {
    constructor(manager) {
        this.manager = manager;
        this.strategyInstances = new Map();
    }

    getStrategy(strategyName) {
        if (!this.strategyInstances.has(strategyName)) {
            const StrategyClass = strategies[strategyName] || strategies['dominant_evidence'];
            if (StrategyClass) {
                this.strategyInstances.set(strategyName, new StrategyClass(this.manager));
            }
        }
        return this.strategyInstances.get(strategyName);
    }
}
