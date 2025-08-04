import {id} from '../support/utils.js';
import {TruthValue} from '../support/TruthValue.js';
import {Budget} from '../support/Budget.js';
import {LearningEngineBase} from './LearningEngineBase.js';

export class AdvancedLearningEngine extends LearningEngineBase {
    constructor(nar) {
        super(nar);
        this.experienceBuffer = [];
        this.patternMemory = new Map();
        this.learningRate = 0.1;
        this.ruleProductivity = new Map(); // Tracks successes and attempts for each rule
    }

    /**
     * Records the outcome of a reasoning process or action, based on `enhance.f.md`.
     * This is the primary entry point for providing feedback to the learning engine.
     * @param {Object} context - The context in which the action/reasoning occurred.
     * @param {Object} outcome - Details about the outcome.
     * @param {Object} [options={}] - Additional details like derivation path and resource usage.
     */
    recordExperience(context, outcome, options = {}) {
        const experience = {
            id: `Exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            context, // e.g., { operation: 'derive', rule: 'Inheritance' }
            outcome, // e.g., { success: true, accuracy: 0.9 }
            ...options, // e.g., { derivationPath, resourcesUsed }
        };

        this.experienceBuffer.push(experience);
        if (this.experienceBuffer.length > 1000) {
            this.experienceBuffer.shift();
        }

        // Process significant experiences immediately for more reactive learning
        const isSignificant = options.important || (outcome.accuracy !== undefined && Math.abs(outcome.accuracy) < 0.2);
        if (isSignificant) {
            this._processSignificantExperience(experience);
        }

        this._processLearningFromOutcome(experience);
    }

    /**
     * Processes experiences that are flagged as important or are highly inaccurate,
     * allowing the system to react quickly to failures or successes.
     * @param {Object} experience - The significant experience object.
     */
    _processSignificantExperience(experience) {
        // If prediction was very inaccurate, analyze the failure.
        if (experience.outcome.accuracy !== undefined && experience.outcome.accuracy < 0.3) {
            this._analyzeFailure(experience);
        }

        // If prediction was very accurate, reinforce the pattern that led to it.
        if (experience.outcome.accuracy !== undefined && experience.outcome.accuracy > 0.8) {
            this._reinforcePattern(experience);
        }
    }

    /**
     * Adjusts the confidence of a belief and its premises based on an outcome.
     * It also provides feedback to the MetaReasoner about rule effectiveness and
     * learns action-consequence mappings.
     * @param {Object} experience - The experience object to learn from.
     */
    _processLearningFromOutcome(experience) {
        const {context, outcome, derivationPath} = experience;
        const {success, consequence} = outcome;
        const conclusionId = context.conclusionId || context.action;

        if (!conclusionId) return;

        const adjustmentFactor = success ? 1 + this.learningRate : 1 - this.learningRate;

        // Find the premises that led to the conclusion and adjust their confidence
        const conclusionHyperedge = this.nar.state.hypergraph.get(conclusionId);
        const belief = conclusionHyperedge?.getStrongestBelief();
        const premises = derivationPath ? derivationPath.slice(1).map(p => p.id) : (belief?.premises || []);

        if (premises && premises.length > 0) {
            premises.forEach(premiseId => {
                this._adjustPremiseConfidence(premiseId, adjustmentFactor, success);
            });
        }

        // Also update the productivity of the rule that led to the conclusion itself
        if (belief?.derivedBy) {
            this._updateRuleProductivity(belief.derivedBy, success);
        }

        // Learn action-consequence mappings
        if (context.operation === 'action' && consequence) {
            const actionId = context.action;
            const consequenceMappingId = id('ActionConsequence', [actionId, consequence]);
            const existingMapping = this.nar.state.hypergraph.get(consequenceMappingId);

            const newTruth = existingMapping
                ? TruthValue.revise(existingMapping.getTruth(), new TruthValue(success ? 1.0 : 0.0, 0.7))
                : new TruthValue(success ? 0.8 : 0.2, 0.7);

            this.nar.api.addHyperedge('ActionConsequence', [actionId, consequence], {
                truth: newTruth,
                budget: new Budget({priority: 0.7, durability: 0.8, quality: 0.8})
            });
        }
    }

    /**
     * Analyzes a failed reasoning path to identify the likely problematic step.
     * @param {Object} experience - The failure experience object.
     */
    _analyzeFailure(experience) {
        if (!experience.derivationPath || experience.derivationPath.length < 2) return;

        // The last step before the final, incorrect conclusion is often the culprit.
        const problematicStep = experience.derivationPath[experience.derivationPath.length - 2];
        if (!problematicStep) return;

        const hyperedge = this.nar.state.hypergraph.get(problematicStep.id);
        if (hyperedge) {
            const belief = hyperedge.getStrongestBelief();
            if (belief) {
                // Reduce confidence of the belief that led to the failure
                belief.truth.confidence *= (1 - this.learningRate * 2); // Penalize failure more heavily
                this.nar.emit('log', {
                    message: `Reduced confidence of ${problematicStep.id} due to reasoning failure.`,
                    level: 'info'
                });
            }
        }

        // Also reduce the effectiveness of the rule used in that step
        const ruleName = problematicStep.derivedBy;
        if (ruleName) {
            this._updateRuleProductivity(ruleName, false);
            this.nar.metaReasoner.updateStrategyEffectiveness(ruleName, 'failure', {penalty: 0.2});
        }
    }

    /**
     * Reinforces a successful reasoning pattern by boosting the confidence of its premises.
     * @param {Object} experience - The success experience object.
     */
    _reinforcePattern(experience) {
        if (!experience.derivationPath) return;

        experience.derivationPath.forEach((step, index) => {
            const hyperedge = this.nar.state.hypergraph.get(step.id);
            if (hyperedge) {
                const belief = hyperedge.getStrongestBelief();
                if (belief) {
                    // Boost confidence, with decay for earlier steps in the path
                    const boost = (1 + this.learningRate) * Math.pow(0.95, experience.derivationPath.length - 1 - index);
                    belief.truth.confidence = Math.min(0.99, belief.truth.confidence * boost);
                }
            }
        });
    }

    _adjustPremiseConfidence(hyperedgeId, adjustmentFactor, wasSuccessful, depth = 0, visited = new Set()) {
        if (depth > 5 || visited.has(hyperedgeId)) return;
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

        // Adjust doubt based on outcome
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
                const decayingAdjustment = 1 + (adjustmentFactor - 1) * 0.8;
                this._adjustPremiseConfidence(premiseId, decayingAdjustment, wasSuccessful, depth + 1, visited);
            });
        }
    }

    /**
     * Main learning loop, called periodically.
     */
    applyLearning() {
        if (this.experienceBuffer.length === 0) return;

        this._discoverPatterns();
        this._createRulesFromPatterns();
        this._formNewConcepts(); // Call the new method
        this._adaptDerivationRules();

        // Periodically push rule productivity stats to the derivation engine
        // so it can re-prioritize its rules.
        if (this.nar.state.currentStep % 100 === 0) { // Every 100 steps
            this.nar.derivationEngine.evaluateRules?.();
        }

        // Clear buffer periodically
        if (this.experienceBuffer.length > 500) {
            this.experienceBuffer = this.experienceBuffer.slice(-250);
        }
    }

    /**
     * Adapts derivation rules based on their measured effectiveness,
     * as proposed in `enhance.e.md`.
     */
    _adaptDerivationRules() {
        const stats = this.getRuleProductivityStats();
        if (!stats) return;

        stats.forEach((ruleStats, ruleName) => {
            if (ruleStats.attempts < 20) return; // Don't adapt without enough data

            const effectiveness = ruleStats.successes / ruleStats.attempts;
            const rule = this.nar.derivationEngine.rules.get(ruleName);
            if (!rule) return;

            // If a rule is consistently ineffective, disable it.
            if (effectiveness < 0.1) {
                if (rule.enabled !== false) { // Check to avoid repeated notifications
                    rule.enabled = false;
                    this.nar.emit('rule-disabled', {
                        rule: ruleName,
                        effectiveness,
                        reason: 'Consistently produced incorrect or useless results.'
                    });
                }
            }
            // If a rule becomes effective again, re-enable it.
            else if (effectiveness > 0.4 && rule.enabled === false) {
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

            if (pattern.instances.length > 50) pattern.instances.shift();
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
            if (successRate > 0.8 && patternData.totalCount > 5) {
                const representativeInstance = patternData.instances[patternData.instances.length - 1];
                this._createShortcutRule(representativeInstance.premises, representativeInstance.conclusion, successRate);
                this.patternMemory.delete(signature);
            }
        }
    }

    _formNewConcepts() {
        const frequentPatterns = this.patternMemory; // Simplified for now

        for (const [signature, patternData] of frequentPatterns) {
            if (patternData.totalCount < 10) continue;

            const terms = this._getTermsFromSignature(signature);
            if (terms.length < 2) continue;

            // Create a new concept representing the co-occurrence of these terms
            const conceptId = id('Concept', terms.sort());
            if (this.nar.state.hypergraph.has(conceptId)) continue; // Concept already exists

            const truth = new TruthValue(
                patternData.successCount / patternData.totalCount,
                Math.min(0.9, patternData.totalCount / 20), // Confidence grows with observations
                0.5 // Default priority
            );

            this.nar.api.addHyperedge('Concept', terms.sort(), {truth});

            // Create inheritance links from the new concept to its components
            terms.forEach(term => {
                this.nar.api.inheritance(conceptId, term, {
                    truth: new TruthValue(0.9, 0.8)
                });
            });

            this.nar.emit('concept-formed', {conceptId, from: terms, signature});
            // Clean up the pattern to avoid re-processing
            this.patternMemory.delete(signature);
        }
    }

    _getTermsFromSignature(signature) {
        // Example signature: Term,Term,Term=>Implication
        const premiseTypes = signature.split('=>')[0];
        // This is a simplification. A real implementation would need to parse the signature
        // back into the terms that formed it. For now, we'll assume the signature
        // is the premises joined by ','.
        if (premiseTypes.includes(',')) {
            return premiseTypes.split(',');
        }
        return [];
    }

    _createShortcutRule(premises, conclusionId, confidence) {
        if (!premises || premises.length === 0) return;

        // Create a stable ID for the premise conjunction
        const premiseConjunctionId = id('Conjunction', premises.sort());
        const conclusion = this.nar.state.hypergraph.get(conclusionId);
        if (!conclusion) return;

        // The ID of the potential implication rule
        const shortcutId = id('Implication', [premiseConjunctionId, conclusionId]);

        if (!this.nar.state.hypergraph.has(shortcutId)) {
            // First, ensure the conjunction exists as a concept
            this.nar.api.addHyperedge('Conjunction', premises.sort(), {truth: new TruthValue(1.0, 0.9)});

            this.nar.api.implication(premiseConjunctionId, conclusionId, {
                truth: new TruthValue(0.9, confidence),
                budget: new Budget({priority: 0.9, durability: 0.9, quality: 0.9}),
                derivedBy: 'LearnedRule'
            });
            this.nar.emit('shortcut-created', {from: premiseConjunctionId, to: conclusionId, confidence});
        }
    }

    /**
     * Updates the internal productivity stats for a given rule.
     */
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

    /**
     * Provides the latest productivity statistics to other system components.
     */
    getRuleProductivityStats() {
        return this.ruleProductivity;
    }
}
