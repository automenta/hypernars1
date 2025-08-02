import { Budget } from '../support/Budget.js';

/**
 * Meta-reasoning system for self-monitoring, optimization, and resource management.
 * It combines the existing self-monitoring with the more advanced resource allocation
 * and strategy tracking concepts from `enhance.f.md`.
 */
export class MetaReasoner {
    constructor(nar) {
        this.nar = nar;
        this.strategies = []; // Holds strategy configurations
        this.trace = []; // Holds a trace of recent reasoning steps
        this.metricsHistory = []; // Holds a history of performance metrics
        this.lastMetricTimestamp = Date.now();
        this.contradictionCount = 0;

        // From enhance.f.md: for tracking effectiveness and allocating resources
        this.performanceHistory = new Map(); // Tracks reasoning path effectiveness
        this.strategyEffectiveness = new Map(); // Maps strategy names to success rates
        this.resourceAllocation = { // Default allocation
            derivation: 0.6,
            memory: 0.3,
            temporal: 0.1
        };
        this.currentFocus = 'default';

        this.configureStrategy({ context: 'default', strategy: 'balanced', priority: 0 });

        this.nar.on('contradiction-resolved', () => this.contradictionCount++);
    }

    /**
     * Configure a reasoning strategy based on a specific context.
     */
    configureStrategy(config) {
        this.strategies.push(config);
        this.strategies.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get the current reasoning strategy based on the system's context.
     */
    getActiveStrategy() {
        const context = this._assessReasoningContext();
        const strategy = this.strategies.find(s =>
            context.includes(s.context) || s.context === 'default'
        );
        return strategy ? strategy.strategy : 'balanced';
    }

    /**
     * Main entry point for meta-reasoning, called from the system loop.
     * It monitors performance and adapts system parameters and resource allocation.
     */
    selfMonitor() {
        // 1. Track metrics
        const metrics = this._calculateMetrics();
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > 100) this.metricsHistory.shift();
        this.addToTrace({ type: 'self-monitor', metrics });

        // 2. Detect issues and adapt system parameters (from original implementation)
        const issues = this._detectIssues(metrics);
        if (issues.length > 0) {
            this._adaptParameters(issues, metrics);
        }

        // 3. Adjust high-level resource allocation and focus (from enhance.f.md)
        this._adjustResourceAllocation(metrics);
        this._adjustReasoningFocus(metrics);

        // 4. Perform deeper analysis periodically
        if (this.nar.state.currentStep % 100 === 0) {
            this._identifyReasoningBottlenecks();
            this._pruneLowValueKnowledge();
        }

        return {
            metrics,
            issues,
            strategy: this.getActiveStrategy(),
            focus: this.currentFocus,
            allocation: this.resourceAllocation,
        };
    }

    /**
     * Track the effectiveness of a specific reasoning path.
     * To be called by other managers (e.g., LearningEngine) when an outcome is known.
     * @param {string} pathId - A unique identifier for the reasoning path.
     * @param {string} outcome - 'success' or 'failure'.
     * @param {Object} [metrics] - Additional metrics like time or steps.
     */
    trackReasoningPath(pathId, outcome, metrics = {}) {
        const record = this.performanceHistory.get(pathId) || { successes: 0, attempts: 0, metricsHistory: [] };
        record.attempts++;
        if (outcome === 'success') record.successes++;
        record.metricsHistory.push({ timestamp: Date.now(), outcome, ...metrics });
        if (record.metricsHistory.length > 20) record.metricsHistory.shift();
        this.performanceHistory.set(pathId, record);
    }

    /**
     * Update the effectiveness of a named strategy.
     * @param {string} strategyName - The name of the strategy (e.g., a derivation rule).
     * @param {string} outcome - 'success' or 'failure'.
     */
    updateStrategyEffectiveness(strategyName, outcome) {
        const record = this.strategyEffectiveness.get(strategyName) || { successes: 0, attempts: 0, lastUpdated: 0 };
        record.attempts++;
        if (outcome === 'success') record.successes++;
        record.lastUpdated = Date.now();
        this.strategyEffectiveness.set(strategyName, record);
    }

    getTrace(depth = 5) {
        return this.trace.slice(-depth);
    }

    addToTrace(traceEntry) {
        this.trace.push({ ...traceEntry, timestamp: Date.now() });
        if (this.trace.length > 50) this.trace.shift();
    }

    _identifyReasoningBottlenecks() {
        const bottlenecks = [];
        for (const [pathId, record] of this.performanceHistory.entries()) {
            if (record.attempts > 10 && (record.successes / record.attempts) < 0.3) {
                bottlenecks.push({
                    pathId,
                    type: 'low_success_rate',
                    successRate: record.successes / record.attempts,
                    attempts: record.attempts
                });
            }

            // If a path is frequently successful, consider creating a shortcut
            if (record.attempts > 20 && (record.successes / record.attempts) > 0.8) {
                this._createShortcutRule(pathId, record);
            }
        }
        return bottlenecks;
    }

    _createShortcutRule(pathId, record) {
        // pathId is expected to be a string of hyperedge IDs separated by '->'
        const path = pathId.split('->');
        if (path.length < 2) return;

        const premise = path[0];
        const conclusion = path[path.length - 1];

        // Avoid creating trivial or self-implying rules
        if (premise === conclusion) return;

        // Calculate reliability of the path
        const reliability = record.successes / record.attempts;

        this.nar.api.implication(premise, conclusion, {
            truth: new TruthValue(reliability, 0.8), // High confidence in the learned rule
            budget: new Budget({ priority: reliability, durability: 0.9, quality: 0.9 }),
            derivedBy: 'shortcut'
        });

        this.nar.emit('shortcut-created', {
            premise,
            conclusion,
            reliability
        });
    }

    // ===== PRIVATE HELPERS =====

    _calculateMetrics() {
        const now = Date.now();
        const timeDelta = (now - this.lastMetricTimestamp) / 1000 || 1;
        const inferenceCount = this.nar.derivationEngine.getAndResetInferenceCount();

        const metrics = {
            timestamp: now,
            inferenceRate: Math.min(1.0, (inferenceCount / timeDelta) / 200), // Normalize
            contradictionRate: Math.min(1.0, (this.contradictionCount / timeDelta) / 5), // Normalize
            resourceUtilization: Math.min(1.0, this.nar.state.eventQueue.heap.length / 2000), // Normalize
            queueSize: this.nar.state.eventQueue.heap.length,
        };

        this.lastMetricTimestamp = now;
        this.contradictionCount = 0;
        return metrics;
    }

    _detectIssues(metrics) {
        const issues = [];
        if (metrics.contradictionRate > 0.3) issues.push('high-contradictions');
        if (metrics.inferenceRate < 0.1 && metrics.queueSize > 100) issues.push('low-inference-rate');
        if (metrics.resourceUtilization > 0.8) issues.push('high-resource-utilization');
        return issues;
    }

    _adaptParameters(issues, metrics) {
        this.addToTrace({ type: 'adaptation', issues, metrics });
        const policy = this.nar.config;
        const rate = 0.1;

        if (issues.includes('high-contradictions')) {
            policy.inferenceThreshold = Math.min(0.6, policy.inferenceThreshold * (1 + rate));
        } else if (issues.includes('low-inference-rate')) {
            policy.inferenceThreshold = Math.max(0.05, policy.inferenceThreshold * (1 - rate));
            policy.budgetThreshold = Math.max(0.01, policy.budgetThreshold * (1 - rate * 0.5));
        }

        if (issues.includes('high-resource-utilization')) {
            policy.budgetThreshold = Math.min(0.25, policy.budgetThreshold * (1 + rate * 2));
            policy.maxPathLength = Math.max(5, policy.maxPathLength - 1);
        } else if (policy.maxPathLength < this.nar.config.maxPathLength) {
            policy.maxPathLength++;
        }

        this._adaptRulePriorities();
    }

    /**
     * Gets the priority scaling factor for a given derivation rule.
     * The DerivationEngine will use this to modulate budget for rules.
     * @param {string} ruleName
     * @returns {number} A scaling factor, typically around 1.0.
     */
    getRulePriority(ruleName) {
        const stats = this.strategyEffectiveness.get(ruleName);
        if (!stats || stats.attempts < 10) {
            return 1.0; // Default priority
        }
        const successRate = stats.successes / stats.attempts;
        // Scale priority from 0.5 (for 0% success) to 1.5 (for 100% success)
        return 0.5 + successRate;
    }

    _adaptRulePriorities() {
        // This method can be used to perform more complex, periodic adjustments
        // to rule configurations if needed. For now, the direct `getRulePriority`
        // provides dynamic scaling.
        const ruleEfficiencies = new Map();
        this.strategyEffectiveness.forEach((stats, ruleName) => {
            if (stats.attempts > 10) {
                const successRate = stats.successes / stats.attempts;
                ruleEfficiencies.set(ruleName, successRate);
            }
        });

        // The DerivationEngine can now use `getRulePriority` to get these dynamic weights.
        this.nar.emit('log', { message: 'MetaReasoner adapted rule priorities.', level: 'debug', details: Object.fromEntries(ruleEfficiencies) });
    }

    _adjustResourceAllocation(metrics) {
        const { inferenceRate, contradictionRate } = metrics;
        const alloc = this.resourceAllocation;

        if (inferenceRate < 0.2) {
            alloc.derivation = Math.min(0.8, alloc.derivation + 0.05);
        } else if (inferenceRate > 0.7) {
            alloc.derivation = Math.max(0.3, alloc.derivation - 0.05);
        }

        if (contradictionRate > 0.4) {
            // If lots of contradictions, maybe we need better memory management to find supporting evidence
            alloc.memory = Math.min(0.5, alloc.memory + 0.05);
        }

        // Normalize allocations to sum to 1
        const total = Object.values(alloc).reduce((a, b) => a + b, 0);
        Object.keys(alloc).forEach(key => alloc[key] = alloc[key] / total);

        // This is where the allocation would be *used*, for example,
        // by adjusting the budget given to tasks of different types.
        // We can implement this by having the MemoryManager's allocateResources
        // method consult this meta-reasoner.
    }

    _adjustReasoningFocus(metrics) {
        const oldFocus = this.currentFocus;

        if (this.nar.state.questionPromises.size > 0) {
            this.currentFocus = 'question-answering';
        } else if (metrics.contradictionRate > 0.4) {
            this.currentFocus = 'contradiction-resolution';
        } else {
            this.currentFocus = 'default';
        }

        if (oldFocus !== this.currentFocus) {
            this.addToTrace({ type: 'focus-change', from: oldFocus, to: this.currentFocus });
            this._applyFocusParameters(this.currentFocus);
        }
    }

    _applyFocusParameters(focus) {
        // This is a simplified implementation. A more advanced one would
        // dynamically change rule priorities or budget allocation formulas.
        const policy = this.nar.config;
        switch (focus) {
            case 'question-answering':
                policy.maxPathLength = Math.min(25, this.nar.config.maxPathLength + 5);
                policy.inferenceThreshold *= 0.8;
                break;
            case 'contradiction-resolution':
                policy.beliefCapacity = Math.min(12, this.nar.config.beliefCapacity + 2);
                break;
            default:
                // Slowly revert to defaults if not in a specific focus
                policy.maxPathLength = Math.max(this.nar.config.maxPathLength, policy.maxPathLength - 1);
                policy.beliefCapacity = Math.max(this.nar.config.beliefCapacity, policy.beliefCapacity - 1);
                break;
        }
    }

    _assessReasoningContext() {
        const context = ['default'];
        const lastMetric = this.metricsHistory[this.metricsHistory.length - 1];
        if (!lastMetric) return context;

        if (lastMetric.contradictionRate > 0.3) context.push('high-uncertainty');
        if (this.nar.state.questionPromises.size > 0) context.push('question-answering');
        return context;
    }

    _pruneLowValueKnowledge() {
        const now = Date.now();
        const cutoff = now - (this.nar.config.knowledgeTTL || 3600000); // 1 hour default
        const candidates = [];

        for (const [id, hyperedge] of this.nar.state.hypergraph.entries()) {
            const lastAccess = this.nar.state.activations.get(id) || 0;
            const beliefStrength = hyperedge.getTruthExpectation();
            const isStructural = hyperedge.type === 'Inheritance' || hyperedge.type === 'Similarity';

            // Don't prune very strong beliefs or core structural knowledge
            if (beliefStrength > 0.8 && isStructural) continue;

            if (lastAccess < cutoff && beliefStrength < 0.2) {
                candidates.push({ id, value: beliefStrength + (lastAccess / now) });
            }
        }

        // Sort by value (least valuable first) and prune a small percentage
        candidates.sort((a, b) => a.value - b.value);
        const pruneCount = Math.min(10, Math.floor(candidates.length * 0.05));
        for (let i = 0; i < pruneCount; i++) {
            this.nar.api.removeHyperedge(candidates[i].id);
        }
    }
}
