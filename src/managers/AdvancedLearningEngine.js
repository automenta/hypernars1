import {id} from '../support/utils.js';
import {TruthValue} from '../support/TruthValue.js';
import {Budget} from '../support/Budget.js';
import {LearningEngineBase} from './LearningEngineBase.js';
import {config} from '../config/index.js';
import {PatternMiner} from './learningComponents/PatternMiner.js';
import {ConceptFormer} from './learningComponents/ConceptFormer.js';
import {RuleAdaptor} from './learningComponents/RuleAdaptor.js';

const defaultConfig = config.advancedLearningEngine;

export class AdvancedLearningEngine extends LearningEngineBase {
    constructor(nar) {
        super(nar);
        this.config = {...defaultConfig, ...nar.config.advancedLearningEngine};
        this.experienceBuffer = [];
        this.patternMemory = new Map();
        this.learningRate = this.config.learningRate;

        this.patternMiner = new PatternMiner(this);
        this.conceptFormer = new ConceptFormer(this);
        this.ruleAdaptor = new RuleAdaptor(this);
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

        const isSignificant = options.important || (outcome.accuracy !== undefined && (outcome.accuracy < this.config.failureAnalysisAccuracyThreshold || outcome.accuracy > this.config.reinforcementAccuracyThreshold));
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
            this.ruleAdaptor.updateRuleProductivity(belief.derivedBy, success);
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

        const conclusionStep = experience.derivationPath[0];
        const premiseStep = experience.derivationPath[1]; // In this simplified model, we penalize the direct premise

        // 1. Penalize the rule that led to the failure by updating its productivity
        const ruleName = conclusionStep.derivedBy;
        if (ruleName) {
            this.ruleAdaptor.updateRuleProductivity(ruleName, false);
            this.nar.metaReasoner.updateStrategyEffectiveness(ruleName, 'failure', {penalty: 0.2});
        }

        // 2. Penalize the premise that was used by lowering its confidence
        if (!premiseStep) return;
        const hyperedge = this.nar.state.hypergraph.get(premiseStep.id);
        if (hyperedge) {
            const belief = hyperedge.getStrongestBelief();
            if (belief) {
                belief.truth.confidence *= (1 - this.learningRate * this.config.failurePenaltyMultiplier);
            }
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
            this.ruleAdaptor.updateRuleProductivity(ruleName, wasSuccessful);
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

        this.patternMiner.discoverPatterns();
        this.patternMiner.createRulesFromPatterns();
        this.conceptFormer.formNewConcepts();
        this.ruleAdaptor.adaptDerivationRules();

        if (this.nar.state.currentStep % this.config.maintenanceInterval === 0) {
            this.nar.derivationEngine.evaluateRules?.();
        }

        if (this.experienceBuffer.length > this.config.experienceBufferMaxSize * 0.5) {
            this.experienceBuffer = this.experienceBuffer.slice(-this.config.experienceBufferPruneSize);
        }
    }

    getRuleProductivityStats() {
        return this.ruleAdaptor.getRuleProductivityStats();
    }
}
