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
        this.recentSuccesses = new Set(); // Tracks IDs of hyperedges that were useful
        this.ruleProductivity = new Map(); // Tracks successes and attempts for each rule
    }

    // Bridge method to maintain compatibility with parts of the system still calling this.
    recordExperience(event, outcome = {}) {
        this.recordOutcome(event.target, outcome);
    }

    /**
     * Records that a hyperedge was useful (e.g., answered a question).
     * This method now also provides feedback to the derivation engine.
     * @param {string} hyperedgeId
     */
    /**
     * Records the outcome of a reasoning process or action.
     * This is the primary entry point for providing feedback to the learning engine.
     * @param {string} conclusionId - The ID of the hyperedge representing the conclusion or action.
     * @param {Object} outcome - Details about the outcome.
     * @param {boolean} outcome.success - Whether the outcome was successful.
     * @param {number} [outcome.accuracy] - A numerical score of the outcome's accuracy (e.g., for predictions).
     */
    recordOutcome(conclusionId, outcome) {
        const conclusionHyperedge = this.nar.state.hypergraph.get(conclusionId);
        const belief = conclusionHyperedge?.getStrongestBelief();
        if (!belief) return;

        const experience = {
            id: `Exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            conclusion: conclusionId,
            premises: belief.premises || [],
            derivationPath: belief.derivationPath || [], // Assuming derivation path is stored on belief
            success: outcome.success,
            accuracy: outcome.accuracy
        };

        this.experienceBuffer.push(experience);
        if (this.experienceBuffer.length > 1000) {
            this.experienceBuffer.shift();
        }

        // Adjust truth values and rule productivity based on the outcome
        const learningFactor = this.learningRate;
        const adjustment = outcome.success ? 1 + learningFactor : 1 - learningFactor;

        // Recursively adjust the premises that led to this conclusion
        this._adjustPremiseConfidence(conclusionId, adjustment);

        // Immediately process significant experiences for pattern detection
        if (!outcome.success || (outcome.accuracy && outcome.accuracy < 0.3)) {
            this._analyzeFailure(experience);
        } else if (outcome.success && (!outcome.accuracy || outcome.accuracy > 0.8)) {
            this._reinforceSuccess(experience);
        }
    }

    _adjustPremiseConfidence(hyperedgeId, adjustmentFactor, depth = 0, visited = new Set()) {
        if (depth > 5 || visited.has(hyperedgeId)) return;
        visited.add(hyperedgeId);

        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const belief = hyperedge?.getStrongestBelief();
        if (!belief) return;

        // Update the productivity of the rule that derived this
        this._updateRuleProductivity(belief.derivedBy, adjustmentFactor > 1);

        // Directly modify the confidence of the strongest belief
        belief.truth.confidence = Math.min(0.99, belief.truth.confidence * adjustmentFactor);
        belief.truth.confidence = Math.max(0.01, belief.truth.confidence); // Ensure confidence doesn't drop to zero


        // Recursively adjust the premises
        if (belief.premises && belief.premises.length > 0) {
            belief.premises.forEach(premiseId => {
                // The adjustment decays with depth
                this._adjustPremiseConfidence(premiseId, 1 + (adjustmentFactor - 1) * 0.8, depth + 1, visited);
            });
        }
    }

    applyLearning() {
        if (this.experienceBuffer.length === 0) return;

        this._processRecentExperiences();
        this._discoverPatterns();
        this._createRulesFromPatterns();

        // Clear buffer periodically
        if (this.experienceBuffer.length > 500) {
            this.experienceBuffer = this.experienceBuffer.slice(-250);
        }
    }


    _processRecentExperiences() {
        const recent = this.experienceBuffer.slice(-100);
        if (recent.length === 0) return;

        // Update strategy effectiveness in MetaReasoner
        recent.forEach(exp => {
            if (exp.derivationPath && exp.derivationPath.length > 0) {
                const pathKey = exp.derivationPath.join('->');
                this.nar.metaReasoner.addToTrace({
                    type: 'learning-outcome',
                    path: pathKey,
                    outcome: exp.success ? 'success' : 'failure',
                    accuracy: exp.accuracy
                });
            }
        });
    }

    _discoverPatterns() {
        const patternCandidates = this._extractPatternCandidates();

        patternCandidates.forEach(candidate => {
            const signature = this._patternSignature(candidate);
            if (!this.patternMemory.has(signature)) {
                this.patternMemory.set(signature, { instances: [], successCount: 0, totalCount: 0, averageAccuracy: 0 });
            }

            const pattern = this.patternMemory.get(signature);
            pattern.instances.push(candidate);
            pattern.totalCount++;
            if (candidate.success) pattern.successCount++;
            pattern.averageAccuracy = (pattern.averageAccuracy * (pattern.totalCount - 1) + (candidate.accuracy || 0.5)) / pattern.totalCount;

            if (pattern.instances.length > 50) pattern.instances.shift();
        });
    }

    _extractPatternCandidates() {
        return this.experienceBuffer
            .filter(e => e.success && e.premises && e.premises.length > 0)
            .map(e => ({
                premises: e.premises,
                conclusion: e.conclusion,
                accuracy: e.accuracy,
                success: e.success
            }));
    }

    _patternSignature(pattern) {
        // Create a signature based on the structure of the rule
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
                // Reset pattern to avoid re-creating the rule
                this.patternMemory.delete(signature);
            }
        }
    }

    _createShortcutRule(premises, conclusionId, confidence) {
        if (!premises || premises.length === 0) return;

        // Create a conjunction of all premises for a more accurate rule
        const premiseConjunctionId = this.nar.api.addHyperedge('Conjunction', premises);

        const shortcutId = id('LearnedRule', [premiseConjunctionId, conclusionId]);
        if (!this.nar.state.hypergraph.has(shortcutId)) {
            this.nar.api.addHyperedge('Implication', [premiseConjunctionId, conclusionId], {
                truth: new TruthValue(0.9, confidence),
                budget: new Budget(0.9, 0.9, 0.9),
                premises: [] // Learned rules are atomic
            });
            this.nar.notifyListeners('shortcut-created', { from: premiseConjunctionId, to: conclusionId, confidence });
        }
    }

    /**
     * Updates the productivity stats for a given rule.
     * @param {string} ruleName - The name of the rule.
     * @param {boolean} wasSuccessful - Whether the derivation was successful.
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
     * @returns {Map<string, {successes: number, attempts: number}>}
     */
    getRuleProductivityStats() {
        return this.ruleProductivity;
    }

    _analyzeFailure(experience) {
        if (!experience.derivationPath) return;

        // Weaken the beliefs along the derivation path that led to failure
        experience.derivationPath.forEach((stepKey, index) => {
            const event = this.nar.state.eventQueue.heap.find(e => e.derivationPath.join('->').endsWith(stepKey));
            if (!event) return;

            const hyperedge = this.nar.state.hypergraph.get(event.target);
            if (hyperedge) {
                const belief = hyperedge.getStrongestBelief();
                this._updateRuleProductivity(belief?.derivedBy, false);

                const learningFactor = this.learningRate * Math.pow(0.8, experience.derivationPath.length - 1 - index);
                const currentTruth = hyperedge.getTruth();
                const newTruth = new TruthValue(
                    currentTruth.frequency,
                    currentTruth.confidence * (1 - learningFactor) // Reduce confidence
                );
                this.nar.api.revise(event.target, {
                    truth: newTruth,
                    budget: belief.budget.scale(0.9)
                });
            }
        });
    }

    _reinforceSuccess(experience) {
        if (!experience.derivationPath) return;

        // Strengthen the beliefs along the derivation path that led to success
        experience.derivationPath.forEach((stepKey, index) => {
            const event = this.nar.state.eventQueue.heap.find(e => e.derivationPath.join('->').endsWith(stepKey));
            if (!event) return;

            const hyperedge = this.nar.state.hypergraph.get(event.target);
            if (hyperedge) {
                const belief = hyperedge.getStrongestBelief();
                this._updateRuleProductivity(belief?.derivedBy, true);

                const learningFactor = this.learningRate * Math.pow(0.9, index);
                const currentTruth = hyperedge.getTruth();
                const newTruth = new TruthValue(
                    currentTruth.frequency,
                    Math.min(0.99, currentTruth.confidence * (1 + learningFactor)) // Increase confidence
                );
                this.nar.api.revise(event.target, {
                    truth: newTruth,
                    budget: belief.budget.scale(1.05)
                });
            }
        });
    }
}
