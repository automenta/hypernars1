import { id } from '../../support/utils.js';
import { TruthValue } from '../../support/TruthValue.js';
import { Budget } from '../../support/Budget.js';

export class PatternMiner {
    constructor(learningEngine) {
        this.learningEngine = learningEngine;
        this.nar = learningEngine.nar;
        this.config = learningEngine.config;
    }

    discoverPatterns() {
        // This method is defensive to handle inconsistencies in how experience data is structured.
        const patternCandidates = this.learningEngine.experienceBuffer
            .filter(e => {
                const success = e.success || e.outcome?.success;
                const premises = e.premises || e.context?.premises;
                return success && premises && premises.length > 0;
            })
            .map(e => {
                return {
                    premises: e.premises || e.context.premises,
                    conclusion: e.conclusion || e.context.conclusion,
                    success: e.success || e.outcome.success,
                };
            });

        patternCandidates.forEach(candidate => {
            const signature = this._patternSignature(candidate);
            if (!this.learningEngine.patternMemory.has(signature)) {
                this.learningEngine.patternMemory.set(signature, {instances: [], successCount: 0, totalCount: 0});
            }

            const pattern = this.learningEngine.patternMemory.get(signature);
            pattern.instances.push(candidate);
            pattern.totalCount++;
            if (candidate.success) pattern.successCount++;

            if (pattern.instances.length > this.config.patternMinInstances) pattern.instances.shift();
        });
    }

    _patternSignature(pattern) {
        const premiseTypes = pattern.premises.map(p => this.nar.state.hypergraph.get(p)?.nar || 'Term').sort().join(',');
        const conclusionType = this.nar.state.hypergraph.get(pattern.conclusion)?.nar || 'Term';
        return `${premiseTypes}=>${conclusionType}`;
    }

    createRulesFromPatterns() {
        for (const [signature, patternData] of this.learningEngine.patternMemory) {
            const successRate = patternData.successCount / patternData.totalCount;
            if (successRate > this.config.patternSuccessRateThreshold && patternData.totalCount > this.config.patternMinInstances) {
                const representativeInstance = patternData.instances[patternData.instances.length - 1];
                this._createShortcutRule(representativeInstance.premises, representativeInstance.conclusion, successRate);
                this.learningEngine.patternMemory.delete(signature);
            }
        }
    }

    _createShortcutRule(premises, conclusionId, confidence) {
        if (!premises || premises.length === 0) return;

        const premiseConjunctionId = id('Conjunction', premises.sort());
        const conclusion = this.nar.state.hypergraph.get(conclusionId);
        if (!conclusion) return;

        const shortcutId = id('Implication', [premiseConjunctionId, conclusionId]);

        if (!this.nar.state.hypergraph.has(shortcutId)) {
            this.nar.api.addHyperedge('Conjunction', premises.sort(), {truth: new TruthValue(1.0, 0.9)});

            this.nar.api.implication(premiseConjunctionId, conclusionId, {
                truth: new TruthValue(this.config.shortcutConfidence, confidence),
                budget: new Budget({
                    priority: this.config.shortcutPriority,
                    durability: this.config.shortcutDurability,
                    quality: this.config.shortcutQuality
                }),
                derivedBy: 'LearnedRule'
            });
            this.nar.emit('shortcut-created', {from: premiseConjunctionId, to: conclusionId, confidence});
        }
    }
}
