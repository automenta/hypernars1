import {id} from '../support/utils.js';
import {TruthValue} from '../support/TruthValue.js';
import {Budget} from '../support/Budget.js';
import {LearningEngineBase} from './LearningEngineBase.js';

const defaultConfig = {
    experienceBufferMaxSize: 1000,
    significantExperienceAccuracyThreshold: 0.2,
    failureAnalysisAccuracyThreshold: 0.3,
    reinforcementAccuracyThreshold: 0.8,
    learningRate: 0.1,
    failurePenaltyMultiplier: 2,
    premiseAdjustmentDecay: 0.8,
    maxPremiseAdjustmentDepth: 5,
    ruleProductivityMinAttempts: 20,
    ruleDisableEffectivenessThreshold: 0.1,
    ruleEnableEffectivenessThreshold: 0.4,
    patternMinInstances: 50,
    patternSuccessRateThreshold: 0.8,
    conceptFormationMinInstances: 10,
    conceptConfidenceGrowthFactor: 20,
    shortcutConfidence: 0.9,
    shortcutPriority: 0.9,
    shortcutDurability: 0.9,
    shortcutQuality: 0.9,
    actionConsequenceConfidence: 0.7,
    actionConsequencePriority: 0.7,
    actionConsequenceDurability: 0.8,
    actionConsequenceQuality: 0.8,
    maintenanceInterval: 100,
    experienceBufferPruneSize: 250,
};

export class AdvancedLearningEngine extends LearningEngineBase {
    constructor(nar) {
        super(nar);
        this.config = {...defaultConfig, ...nar.config.advancedLearningEngine};
        this.experienceBuffer = [];
        this.patternMemory = new Map();
        this.learningRate = this.config.learningRate;
        this.ruleProductivity = new Map();
    }

    recordExperience(context, outcome, options = {}) {
        const experience = {
            id: `Exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            context,
            outcome,
            ...options,
        };

        this.experienceBuffer.push(experience);
        if (this.experienceBuffer.length > this.config.experienceBufferMaxSize) {
            this.experienceBuffer.shift();
        }

        const isSignificant = options.important || (outcome.accuracy !== undefined && Math.abs(outcome.accuracy) < this.config.significantExperienceAccuracyThreshold);
        if (isSignificant) {
            this._processSignificantExperience(experience);
        }

        this._processLearningFromOutcome(experience);
    }

    _processSignificantExperience(experience) {
        if (experience.outcome.accuracy !== undefined && experience.outcome.accuracy < this.config.failureAnalysisAccuracyThreshold) {
            this._analyzeFailure(experience);
        }

        if (experience.outcome.accuracy !== undefined && experience.outcome.accuracy > this.config.reinforcementAccuracyThreshold) {
            this._reinforcePattern(experience);
        }
    }

    _processLearningFromOutcome(experience) {
        const {context, outcome, derivationPath} = experience;
        const {success, consequence} = outcome;
        const conclusionId = context.conclusionId || context.action;

        if (!conclusionId) return;

        const adjustmentFactor = success ? 1 + this.learningRate : 1 - this.learningRate;

        const conclusionHyperedge = this.nar.state.hypergraph.get(conclusionId);
        const belief = conclusionHyperedge?.getStrongestBelief();
        const premises = derivationPath ? derivationPath.slice(1).map(p => p.id) : (belief?.premises || []);

        if (premises && premises.length > 0) {
            premises.forEach(premiseId => {
                this._adjustPremiseConfidence(premiseId, adjustmentFactor, success);
            });
        }

        if (belief?.derivedBy) {
            this._updateRuleProductivity(belief.derivedBy, success);
        }

        if (context.operation === 'action' && consequence) {
            this._learnActionConsequence(context.action, consequence, success);
        }
    }

    _learnActionConsequence(actionId, consequence, success) {
        const consequenceMappingId = id('ActionConsequence', [actionId, consequence]);
        const existingMapping = this.nar.state.hypergraph.get(consequenceMappingId);

        const newTruth = existingMapping
            ? TruthValue.revise(existingMapping.getTruth(), new TruthValue(success ? 1.0 : 0.0, this.config.actionConsequenceConfidence))
            : new TruthValue(success ? 0.8 : 0.2, this.config.actionConsequenceConfidence);

        this.nar.api.addHyperedge('ActionConsequence', [actionId, consequence], {
            truth: newTruth,
            budget: new Budget({
                priority: this.config.actionConsequencePriority,
                durability: this.config.actionConsequenceDurability,
                quality: this.config.actionConsequenceQuality
            })
        });
    }

    _analyzeFailure(experience) {
        if (!experience.derivationPath || experience.derivationPath.length < 2) return;

        const problematicStep = experience.derivationPath[experience.derivationPath.length - 2];
        if (!problematicStep) return;

        const hyperedge = this.nar.state.hypergraph.get(problematicStep.id);
        if (hyperedge) {
            const belief = hyperedge.getStrongestBelief();
            if (belief) {
                belief.truth.confidence *= (1 - this.learningRate * this.config.failurePenaltyMultiplier);
            }
        }

        const ruleName = problematicStep.derivedBy;
        if (ruleName) {
            this._updateRuleProductivity(ruleName, false);
            this.nar.metaReasoner.updateStrategyEffectiveness(ruleName, 'failure', {penalty: 0.2});
        }
    }

    _reinforcePattern(experience) {
        if (!experience.derivationPath) return;

        experience.derivationPath.forEach((step, index) => {
            const hyperedge = this.nar.state.hypergraph.get(step.id);
            if (hyperedge) {
                const belief = hyperedge.getStrongestBelief();
                if (belief) {
                    const boost = (1 + this.learningRate) * Math.pow(0.95, experience.derivationPath.length - 1 - index);
                    belief.truth.confidence = Math.min(0.99, belief.truth.confidence * boost);
                }
            }
        });
    }

    _adjustPremiseConfidence(hyperedgeId, adjustmentFactor, wasSuccessful, depth = 0, visited = new Set()) {
        if (depth > this.config.maxPremiseAdjustmentDepth || visited.has(hyperedgeId)) return;
        visited.add(hyperedgeId);

        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const belief = hyperedge?.getStrongestBelief();
        if (!belief) return;

        const ruleName = belief.derivedBy;
        if (ruleName) {
            this._updateRuleProductivity(ruleName, wasSuccessful);
            this.nar.metaReasoner.updateStrategyEffectiveness(ruleName, wasSuccessful ? 'success' : 'failure');
        }

        const currentTruth = belief.truth;
        const newConfidence = Math.max(0.01, Math.min(0.99, currentTruth.confidence * adjustmentFactor));

        let newDoubt;
        if (wasSuccessful) {
            newDoubt = Math.max(0, (currentTruth.doubt || 0) - this.learningRate * 0.1);
        } else {
            newDoubt = Math.min(1.0, (currentTruth.doubt || 0) + this.learningRate * 0.5);
        }

        const newTruth = new TruthValue(currentTruth.frequency, newConfidence, currentTruth.priority, newDoubt);

        const newBudget = new Budget(
            Math.min(1.0, belief.budget.priority * 1.01),
            belief.budget.durability,
            belief.budget.quality
        );

        hyperedge.revise({truth: newTruth, budget: newBudget});

        if (belief.premises && belief.premises.length > 0) {
            belief.premises.forEach(premiseId => {
                const decayingAdjustment = 1 + (adjustmentFactor - 1) * this.config.premiseAdjustmentDecay;
                this._adjustPremiseConfidence(premiseId, decayingAdjustment, wasSuccessful, depth + 1, visited);
            });
        }
    }

    applyLearning() {
        if (this.experienceBuffer.length === 0) return;

        this._discoverPatterns();
        this._createRulesFromPatterns();
        this._formNewConcepts();
        this._adaptDerivationRules();

        if (this.nar.state.currentStep % this.config.maintenanceInterval === 0) {
            this.nar.derivationEngine.evaluateRules?.();
        }

        if (this.experienceBuffer.length > this.config.experienceBufferMaxSize * 0.5) {
            this.experienceBuffer = this.experienceBuffer.slice(-this.config.experienceBufferPruneSize);
        }
    }

    _adaptDerivationRules() {
        const stats = this.getRuleProductivityStats();
        if (!stats) return;

        stats.forEach((ruleStats, ruleName) => {
            if (ruleStats.attempts < this.config.ruleProductivityMinAttempts) return;

            const effectiveness = ruleStats.successes / ruleStats.attempts;
            const rule = this.nar.derivationEngine.rules.get(ruleName);
            if (!rule) return;

            if (effectiveness < this.config.ruleDisableEffectivenessThreshold) {
                if (rule.enabled !== false) {
                    rule.enabled = false;
                    this.nar.emit('rule-disabled', {
                        rule: ruleName,
                        effectiveness,
                        reason: 'Consistently produced incorrect or useless results.'
                    });
                }
            }
            else if (effectiveness > this.config.ruleEnableEffectivenessThreshold && rule.enabled === false) {
                rule.enabled = true;
                this.nar.emit('rule-enabled', {
                    rule: ruleName,
                    effectiveness,
                    reason: 'Performance has improved.'
                });
            }
        });
    }

    _discoverPatterns() {
        const patternCandidates = this.experienceBuffer
            .filter(e => e.success && e.premises && e.premises.length > 0)
            .map(e => ({
                premises: e.premises,
                conclusion: e.conclusion,
                success: e.success
            }));

        patternCandidates.forEach(candidate => {
            const signature = this._patternSignature(candidate);
            if (!this.patternMemory.has(signature)) {
                this.patternMemory.set(signature, {instances: [], successCount: 0, totalCount: 0});
            }

            const pattern = this.patternMemory.get(signature);
            pattern.instances.push(candidate);
            pattern.totalCount++;
            if (candidate.success) pattern.successCount++;

            if (pattern.instances.length > this.config.patternMinInstances) pattern.instances.shift();
        });
    }

    _patternSignature(pattern) {
        const premiseTypes = pattern.premises.map(p => this.nar.state.hypergraph.get(p)?.type || 'Term').sort().join(',');
        const conclusionType = this.nar.state.hypergraph.get(pattern.conclusion)?.type || 'Term';
        return `${premiseTypes}=>${conclusionType}`;
    }

    _createRulesFromPatterns() {
        for (const [signature, patternData] of this.patternMemory) {
            const successRate = patternData.successCount / patternData.totalCount;
            if (successRate > this.config.patternSuccessRateThreshold && patternData.totalCount > this.config.patternMinInstances) {
                const representativeInstance = patternData.instances[patternData.instances.length - 1];
                this._createShortcutRule(representativeInstance.premises, representativeInstance.conclusion, successRate);
                this.patternMemory.delete(signature);
            }
        }
    }

    _formNewConcepts() {
        const frequentPatterns = this.patternMemory;

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
            this.patternMemory.delete(signature);
        }
    }

    _getTermsFromSignature(signature) {
        const premiseTypes = signature.split('=>')[0];
        if (premiseTypes.includes(',')) {
            return premiseTypes.split(',');
        }
        return [];
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

    _updateRuleProductivity(ruleName, wasSuccessful) {
        if (!ruleName) return;
        if (!this.ruleProductivity.has(ruleName)) {
            this.ruleProductivity.set(ruleName, {successes: 0, attempts: 0});
        }
        const stats = this.ruleProductivity.get(ruleName);
        stats.attempts++;
        if (wasSuccessful) {
            stats.successes++;
        }
    }

    getRuleProductivityStats() {
        return this.ruleProductivity;
    }
}
