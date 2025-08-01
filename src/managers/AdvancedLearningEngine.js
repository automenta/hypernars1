import { id } from '../support/utils.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { LearningEngineBase } from './LearningEngineBase.js';

export class AdvancedLearningEngine extends LearningEngineBase {
    constructor(nar) {
        super(nar);
        this.experienceBuffer = [];
        this.patternMemory = new Map();
        this.learningRate = 0.1;
        this.ruleProductivity = new Map(); // Tracks successes and attempts for each rule
    }

    /**
     * Records the outcome of a reasoning process or action.
     * This is the primary entry point for providing feedback to the learning engine.
     * @param {string} conclusionId - The ID of the hyperedge representing the conclusion or action.
     * @param {Object} outcome - Details about the outcome.
     * @param {boolean} outcome.success - Whether the outcome was successful.
     */
    recordExperience(conclusionId, outcome) {
        const conclusionHyperedge = this.nar.state.hypergraph.get(conclusionId);
        const belief = conclusionHyperedge?.getStrongestBelief();
        if (!belief) return;

        const experience = {
            id: `Exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            conclusion: conclusionId,
            premises: belief.premises || [],
            derivedBy: belief.derivedBy,
            success: outcome.success,
        };

        this.experienceBuffer.push(experience);
        if (this.experienceBuffer.length > 1000) {
            this.experienceBuffer.shift();
        }

        // Adjust truth values and rule productivity based on the outcome
        const adjustmentFactor = outcome.success ? 1 + this.learningRate : 1 - this.learningRate;

        // Recursively adjust the premises that led to this conclusion
        this._adjustPremiseConfidence(conclusionId, adjustmentFactor, outcome.success);
    }

    /**
     * Adjusts the confidence of a belief and its premises based on an outcome.
     * It also provides feedback to the MetaReasoner about rule effectiveness.
     * @param {string} hyperedgeId - The ID of the hyperedge to start from.
     * @param {number} adjustmentFactor - The factor to multiply confidence by.
     * @param {boolean} wasSuccessful - Whether the outcome was a success.
     * @param {number} [depth=0] - Current recursion depth.
     * @param {Set<string>} [visited=new Set()] - Tracks visited nodes to prevent loops.
     */
    _adjustPremiseConfidence(hyperedgeId, adjustmentFactor, wasSuccessful, depth = 0, visited = new Set()) {
        if (depth > 5 || visited.has(hyperedgeId)) return;
        visited.add(hyperedgeId);

        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const belief = hyperedge?.getStrongestBelief();
        if (!belief) return;

        const ruleName = belief.derivedBy;
        if (ruleName) {
            // Update internal productivity stats
            this._updateRuleProductivity(ruleName, wasSuccessful);
            // Provide feedback to the MetaReasoner
            this.nar.metaReasoner.updateStrategyEffectiveness(ruleName, wasSuccessful ? 'success' : 'failure');
        }

        // Directly modify the confidence of the strongest belief
        belief.truth.confidence = Math.max(0.01, Math.min(0.99, belief.truth.confidence * adjustmentFactor));

        // Recursively adjust the premises
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
                this.patternMemory.set(signature, { instances: [], successCount: 0, totalCount: 0 });
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

    _createShortcutRule(premises, conclusionId, confidence) {
        if (!premises || premises.length === 0) return;

        const premiseConjunctionId = this.nar.api.addHyperedge('Conjunction', premises, { truth: new TruthValue(1.0, 0.9) });
        const shortcutId = id('LearnedImplication', [premiseConjunctionId, conclusionId]);

        if (!this.nar.state.hypergraph.has(shortcutId)) {
            this.nar.api.implication(premiseConjunctionId, conclusionId, {
                truth: new TruthValue(0.9, confidence),
                budget: new Budget({ priority: 0.9, durability: 0.9, quality: 0.9 }),
                derivedBy: 'LearnedRule'
            });
            this.nar.notifyListeners('shortcut-created', { from: premiseConjunctionId, to: conclusionId, confidence });
        }
    }

    /**
     * Updates the internal productivity stats for a given rule.
     */
    _updateRuleProductivity(ruleName, wasSuccessful) {
        if (!ruleName) return;
        if (!this.ruleProductivity.has(ruleName)) {
            this.ruleProductivity.set(ruleName, { successes: 0, attempts: 0 });
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
