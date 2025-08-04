import {clamp, hash} from '../support/utils.js';
import {Budget} from '../support/Budget.js';
import {TruthValue} from '../support/TruthValue.js';

/**
 * The CognitiveExecutive is the primary meta-reasoning module of NARHyper.
 * It combines system health monitoring, resource management, and performance-based
 * adaptation to guide the reasoning process, making it more efficient and intelligent.
 * This class merges the original concepts from `CognitiveExecutive` and `MetaReasoner`.
 */
export class CognitiveExecutive {
    constructor(nar) {
        this.nar = nar;

        // From CognitiveExecutive
        this.rulePerformance = new Map(); // Tracks rule effectiveness
        this.reasoningGoals = new Set();
        this.resourceAllocationHistory = [];

        // From MetaReasoner
        this.strategies = [];
        this.trace = [];
        this.metricsHistory = [];
        this.lastMetricTimestamp = Date.now();
        this.contradictionCount = 0;
        this.performanceHistory = new Map();
        this.strategyEffectiveness = new Map();
        this.resourceAllocation = {
            derivation: 0.6,
            memory: 0.3,
            temporal: 0.1
        };
        this.currentFocus = 'default';

        this.configureStrategy({context: 'default', strategy: 'balanced', priority: 0});
        this.nar.on('contradiction-resolved', () => this.contradictionCount++);
    }

    // ===== Core Monitoring and Adaptation Loop =====

    /**
     * Main entry point for meta-reasoning, called from the system loop.
     * It monitors performance and adapts system parameters and resource allocation.
     */
    selfMonitor() {
        const metrics = this._calculateMetrics();
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > 100) this.metricsHistory.shift();
        this.addToTrace({type: 'self-monitor', metrics});

        const issues = this._detectIssues(metrics);
        if (issues.length > 0) {
            this._adaptReasoningParameters(issues, metrics);
        }

        this._adjustResourceAllocation(metrics);
        this._adjustReasoningFocus(metrics);

        if (this.nar.state.currentStep % 100 === 0) {
            this.adaptRulePriorities();
            this._pruneLowValueKnowledge();
            if (this.nar.conceptFormation && this.nar.conceptFormation.discoverNewConcepts) {
                this.nar.conceptFormation.discoverNewConcepts();
            }
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
     * Monitors a single derivation attempt to track rule performance.
     * To be called by the DerivationEngine.
     */
    monitorDerivation(ruleType, success, computationalCost, value) {
        if (!this.rulePerformance.has(ruleType)) {
            this.rulePerformance.set(ruleType, {
                successes: 0,
                attempts: 0,
                totalCost: 0,
                totalValue: 0,
            });
        }

        const stats = this.rulePerformance.get(ruleType);
        stats.attempts++;
        if (success) stats.successes++;
        stats.totalCost += computationalCost;
        stats.totalValue += value;

        this.updateStrategyEffectiveness(ruleType, success ? 'success' : 'failure');
    }

    // ===== Strategy and Priority Management =====

    configureStrategy(config) {
        this.strategies.push(config);
        this.strategies.sort((a, b) => b.priority - a.priority);
    }

    getActiveStrategy() {
        const context = this._assessReasoningContext();
        const strategy = this.strategies.find(s =>
            context.includes(s.context) || s.context === 'default'
        );
        return strategy ? strategy.strategy : 'balanced';
    }

    /**
     * Dynamically adjusts the priorities of derivation rules based on their
     * observed efficiency and effectiveness.
     */
    adaptRulePriorities() {
        const ruleEfficiencies = Array.from(this.rulePerformance.entries())
            .map(([rule, stats]) => {
                const efficiency = stats.attempts > 0
                    ? (stats.totalValue / stats.attempts) / (stats.totalCost / stats.attempts + 0.01)
                    : 0;
                return {rule, efficiency};
            });

        ruleEfficiencies.forEach(({rule, efficiency}) => {
            const currentConfig = this.nar.config.ruleConfig[rule] || {};
            const newScale = clamp(
                (currentConfig.budgetScale || 0.7) * (0.8 + 0.4 * efficiency),
                0.3, 1.0
            );

            if (!this.nar.config.ruleConfig) this.nar.config.ruleConfig = {};
            this.nar.config.ruleConfig[rule] = {...currentConfig, budgetScale: newScale};

            const ruleObject = this.nar.derivationEngine.rules?.get(rule);
            if (ruleObject) {
                ruleObject.priority = newScale;
            }
        });
    }

    updateStrategyEffectiveness(strategyName, outcome) {
        const record = this.strategyEffectiveness.get(strategyName) || {successes: 0, attempts: 0, lastUpdated: 0};
        record.attempts++;
        if (outcome === 'success') record.successes++;
        record.lastUpdated = Date.now();
        this.strategyEffectiveness.set(strategyName, record);
    }

    // ===== System Health and Parameter Adaptation =====

    _calculateMetrics() {
        const now = Date.now();
        const timeDelta = (now - this.lastMetricTimestamp) / 1000 || 1;
        const inferenceCount = this.nar.derivationEngine.getAndResetInferenceCount ? this.nar.derivationEngine.getAndResetInferenceCount() : 0;
        const responseTimes = this.nar.questionHandler.getAndResetQuestionResponseTimes();

        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0;

        const metrics = {
            timestamp: now,
            inferenceRate: Math.min(1.0, (inferenceCount / timeDelta) / 200),
            contradictionRate: Math.min(1.0, (this.contradictionCount / timeDelta) / 5),
            resourceUtilization: Math.min(1.0, this.nar.state.eventQueue.heap.length / 2000),
            questionResponseTime: Math.max(0, 1 - (avgResponseTime / this.nar.config.questionTimeout)),
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
        if (metrics.questionResponseTime < 0.4) issues.push('slow-question-response');
        return issues;
    }

    _adaptReasoningParameters(issues, metrics) {
        this.addToTrace({type: 'adaptation', issues, metrics});
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
        }
    }

    _adjustResourceAllocation(metrics) {
        const {inferenceRate, contradictionRate} = metrics;
        const alloc = this.resourceAllocation;

        if (inferenceRate < 0.2) alloc.derivation = Math.min(0.8, alloc.derivation + 0.05);
        else if (inferenceRate > 0.7) alloc.derivation = Math.max(0.3, alloc.derivation - 0.05);
        if (contradictionRate > 0.4) alloc.memory = Math.min(0.5, alloc.memory + 0.05);

        const total = Object.values(alloc).reduce((a, b) => a + b, 0);
        Object.keys(alloc).forEach(key => alloc[key] = alloc[key] / total);
    }

    _adjustReasoningFocus(metrics) {
        const oldFocus = this.currentFocus;
        if (this.nar.state.questionPromises.size > 0) this.currentFocus = 'question-answering';
        else if (metrics.contradictionRate > 0.4) this.currentFocus = 'contradiction-resolution';
        else this.currentFocus = 'default';

        if (oldFocus !== this.currentFocus) {
            this.addToTrace({type: 'focus-change', from: oldFocus, to: this.currentFocus});
        }
    }

    _pruneLowValueKnowledge() {
        const now = Date.now();
        const cutoff = now - (this.nar.config.knowledgeTTL || 3600000);
        const candidates = [];

        for (const [id, hyperedge] of this.nar.state.hypergraph.entries()) {
            const lastAccess = this.nar.state.activations.get(id) || 0;
            const beliefStrength = hyperedge.getTruthExpectation();
            if (lastAccess < cutoff && beliefStrength < 0.2) {
                candidates.push({id, value: beliefStrength + (lastAccess / now)});
            }
        }

        candidates.sort((a, b) => a.value - b.value);
        const pruneCount = Math.min(10, Math.floor(candidates.length * 0.05));
        for (let i = 0; i < pruneCount; i++) {
            this.nar.api.removeHyperedge(candidates[i].id);
        }
    }

    // ===== Trace and Context Methods =====

    getTrace(depth = 5) {
        return this.trace.slice(-depth);
    }

    addToTrace(traceEntry) {
        this.trace.push({...traceEntry, timestamp: Date.now()});
        if (this.trace.length > 50) this.trace.shift();
    }

    _assessReasoningContext() {
        const context = ['default'];
        const lastMetric = this.metricsHistory[this.metricsHistory.length - 1];
        if (!lastMetric) return context;

        if (lastMetric.contradictionRate > 0.3) context.push('high-uncertainty');
        if (this.nar.state.questionPromises.size > 0) context.push('question-answering');
        return context;
    }

    _extractContextSignature() {
        const activeConcepts = [...this.nar.state.activations.entries()]
            .filter(([_, activation]) => activation > 0.5)
            .map(([id]) => id)
            .sort()
            .slice(0, 5);
        const recentQuestions = [...this.nar.state.questionPromises.keys()]
            .slice(-3)
            .map(q => q.replace(/^.+?\((.+?)\|.+$/, '$1'));
        return hash(`${activeConcepts.join('|')}~${recentQuestions.join('|')}`);
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
            return 1.0; // Default priority for rules without enough data
        }
        const successRate = stats.successes / stats.attempts;
        // Scale priority from 0.5 (for 0% success) to 1.5 (for 100% success)
        return 0.5 + successRate;
    }
}
