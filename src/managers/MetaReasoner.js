export class MetaReasoner {
    constructor(nar) {
        this.nar = nar;
        this.performanceHistory = [];
        this.strategyEffectiveness = new Map();
        this.currentFocus = 'default';
        this.focusHistory = [];
        this.recentContradictions = 0;

        // Default effectiveness for sources
        this.strategyEffectiveness.set('source:internal', { successes: 10, attempts: 12 }); // Assume internal is mostly reliable

        // Listen for events to track system activity
        this.nar.on('contradiction-resolved', () => this.recentContradictions++);
    }

/**
 * Records the source of a belief, allowing the system to track source reliability.
 * @param {string} hyperedgeId The ID of the belief.
 * @param {string} source The source identifier (e.g., 'user_input', 'sensor_A').
 */
recordSource(hyperedgeId, source) {
    const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
    if (!hyperedge) return;

    // Find the primary belief to attach the source to
    const belief = hyperedge.getStrongestBelief();
    if (belief) {
        belief.source = source;
    }

    // Initialize source effectiveness if not already tracked
    if (!this.strategyEffectiveness.has(`source:${source}`)) {
        this.strategyEffectiveness.set(`source:${source}`, { successes: 5, attempts: 10, lastUpdated: Date.now() }); // Start with neutral effectiveness
    }
}

    optimizeResources() {
        this._updatePerformanceMetrics();
        this._adjustReasoningFocus();
        this._adjustResourceAllocation();
        this._selectOptimalStrategies();
    }

    trackOutcome(strategyName, outcome, metrics = {}) {
        if (!this.strategyEffectiveness.has(strategyName)) {
            this.strategyEffectiveness.set(strategyName, {
                successes: 0,
                attempts: 0,
                lastUpdated: Date.now(),
                metrics: {}
            });
        }

        const record = this.strategyEffectiveness.get(strategyName);
        record.attempts++;
        if (outcome === 'success') {
            record.successes++;
        }
        record.lastUpdated = Date.now();
    }

    getStrategyEffectiveness(strategyName) {
        const record = this.strategyEffectiveness.get(strategyName);
        if (!record || record.attempts === 0) return 0.5; // Default effectiveness

        const successRate = record.successes / record.attempts;
        const recencyFactor = Math.exp(-(Date.now() - record.lastUpdated) / (1000 * 60 * 10)); // 10 minute decay

        return successRate * 0.8 + recencyFactor * 0.2;
    }

    _updatePerformanceMetrics() {
        const queueSize = this.nar.state.eventQueue.heap.length;
        const activeConcepts = this.nar.state.activations.size;
        const resourcePressure = Math.min(1.0, queueSize / (activeConcepts * 10 + 1));

        // Decay the contradiction counter
        this.recentContradictions *= 0.95;

        const performance = {
            timestamp: Date.now(),
            queueSize,
            activeConcepts,
            resourcePressure,
            questionSuccessRate: this._getQuestionSuccessRate(),
            contradictionRate: this.recentContradictions
        };

        this.performanceHistory.push(performance);
        if (this.performanceHistory.length > 200) {
            this.performanceHistory.shift();
        }
    }

    _getQuestionSuccessRate() {
        let successes = 0;
        let total = 0;
        // This is a simplified proxy. A real implementation would need to track question outcomes.
        this.nar.state.questionPromises.forEach(promise => {
            if (promise.resolved) successes++;
            total++;
        });

        if (total === 0) return 0.75; // Assume good performance if no questions asked
        return successes / total;
    }

    _adjustReasoningFocus() {
        let newFocus = 'default';

        if (this.nar.state.questionPromises.size > 2) {
            newFocus = 'question-answering';
        } else if (this.recentContradictions > 2) { // Check the decayed counter
            newFocus = 'contradiction-resolution';
        }

        if (newFocus !== this.currentFocus) {
            this.focusHistory.push({ from: this.currentFocus, to: newFocus, timestamp: Date.now() });
            if (this.focusHistory.length > 20) this.focusHistory.shift();
            this.currentFocus = newFocus;
            this.nar.notifyListeners('focus-changed', { newFocus });
        }
    }

    _adjustResourceAllocation() {
        const lastPerf = this.performanceHistory[this.performanceHistory.length - 1];
        if (!lastPerf) return;

        const { resourcePressure, questionSuccessRate, contradictionRate } = lastPerf;
        const policy = this.nar.config;
        const adaptationRate = 0.05;

        // If success rate is low, be more generous with resources
        if (questionSuccessRate < 0.6) {
            policy.budgetThreshold = Math.max(0.01, policy.budgetThreshold * (1 - adaptationRate));
            policy.maxPathLength = Math.min(20, policy.maxPathLength + 1);
            policy.inferenceThreshold = Math.max(0.1, policy.inferenceThreshold * (1 - adaptationRate));
        }

        // If pressure is high, be more strict
        if (resourcePressure > 0.7) {
            policy.budgetThreshold = Math.min(0.2, policy.budgetThreshold * (1 + adaptationRate));
            policy.maxPathLength = Math.max(8, Math.floor(policy.maxPathLength * (1 - adaptationRate)));
        }

        // If contradiction rate is high, be more cautious
        if (contradictionRate > 1.5) { // The counter is decayed, so > 1.5 means several recent contradictions
            policy.inferenceThreshold = Math.min(0.5, policy.inferenceThreshold * (1 + adaptationRate));
            if (this.nar.learningEngine) {
                this.nar.learningEngine.learningRate *= 0.9; // Learn more slowly from potentially noisy data
            }
        } else {
             if (this.nar.learningEngine) {
                this.nar.learningEngine.learningRate = Math.min(0.1, this.nar.learningEngine.learningRate * 1.05); // Gradually restore learning rate
            }
        }

        // Adapt based on focus
        if (this.currentFocus === 'question-answering') {
            policy.inferenceThreshold *= 0.9; // Be more eager to infer
        } else if (this.currentFocus !== 'contradiction-resolution') {
            policy.inferenceThreshold = Math.min(0.3, policy.inferenceThreshold * 1.01); // Gradually restore to default
        }
    }

    _selectOptimalStrategies() {
        // Example: prioritize derivation rules based on effectiveness
        const ruleEffectiveness = {};
        const ruleNames = ['Inheritance', 'Similarity', 'Implication']; // Example rules

        ruleNames.forEach(rule => {
            ruleEffectiveness[rule] = this.getStrategyEffectiveness(`derive_${rule}`);
        });

        const sortedRules = Object.entries(ruleEffectiveness)
            .sort((a, b) => b[1] - a[1])
            .map(([rule]) => rule);

        // This can be used by the derivation system to prioritize rules
        this.nar.config.derivationPriority = sortedRules;
    }
}
