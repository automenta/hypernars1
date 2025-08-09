import { id } from '../../support/utils.js';
import { TruthValue } from '../../support/TruthValue.js';

export class ConceptFormer {
    constructor(learningEngine) {
        this.learningEngine = learningEngine;
        this.nar = learningEngine.nar;
        this.config = learningEngine.config;
    }

    formNewConcepts() {
        const frequentPatterns = this.learningEngine.patternMemory;

        for (const [signature, patternData] of frequentPatterns) {
            if (patternData.totalCount < this.config.conceptFormationMinInstances) continue;

            const terms = this._getTermsFromSignature(signature);
            if (terms.length < 2) continue;

            const conceptId = id('Concept', terms.sort());
            if (this.nar.state.hypergraph.has(conceptId)) continue;

            const truth = new TruthValue(
                patternData.successCount / patternData.totalCount,
                Math.min(0.9, patternData.totalCount / this.config.conceptConfidenceGrowthFactor),
                0.5
            );

            this.nar.api.addHyperedge('Concept', terms.sort(), {truth});

            terms.forEach(term => {
                this.nar.api.inheritance(conceptId, term, {
                    truth: new TruthValue(0.9, 0.8)
                });
            });

            this.nar.emit('concept-formed', {conceptId, from: terms, signature});
            this.learningEngine.patternMemory.delete(signature);
        }
    }

    _getTermsFromSignature(signature) {
        const premiseTypes = signature.split('=>')[0];
        if (premiseTypes.includes(',')) {
            return premiseTypes.split(',');
        }
        return [];
    }
}
