import {clamp, hash} from '../support/utils.js';

const defaultConfig = {
    METRICS_HISTORY_LENGTH: 100,
    MAINTENANCE_INTERVAL: 100,
    INFERENCE_RATE_NORMALIZATION: 200,
    CONTRADICTION_RATE_NORMALIZATION: 5,
    RESOURCE_UTILIZATION_NORMALIZATION: 2000,
    HIGH_CONTRADICTION_THRESHOLD: 0.3,
    LOW_INFERENCE_THRESHOLD: 0.1,
    LOW_INFERENCE_QUEUE_SIZE: 100,
    HIGH_RESOURCE_THRESHOLD: 0.8,
    SLOW_QUESTION_RESPONSE_THRESHOLD: 0.4,
    ADAPTATION_RATE: 0.1,
    MAX_INFERENCE_THRESHOLD: 0.6,
    MIN_INFERENCE_THRESHOLD: 0.05,
    MIN_BUDGET_THRESHOLD: 0.01,
    MAX_BUDGET_THRESHOLD: 0.25,
    MIN_PATH_LENGTH: 5,
    LOW_INFERENCE_RATE_ALLOCATION_THRESHOLD: 0.2,
    HIGH_INFERENCE_RATE_ALLOCATION_THRESHOLD: 0.7,
    HIGH_CONTRADICTION_ALLOCATION_THRESHOLD: 0.4,
    RESOURCE_ALLOCATION_ADJUSTMENT_RATE: 0.05,
    MAX_DERIVATION_ALLOCATION: 0.8,
    MIN_DERIVATION_ALLOCATION: 0.3,
    MAX_MEMORY_ALLOCATION: 0.5,
    KNOWLEDGE_TTL: 3600000,
    LOW_BELIEF_STRENGTH_PRUNE_THRESHOLD: 0.2,
    MAX_PRUNE_CANDIDATES: 10,
    PRUNE_CANDIDATE_RATIO: 0.05,
    TRACE_LENGTH: 50,
    HIGH_UNCERTAINTY_THRESHOLD: 0.3,
    ACTIVE_CONCEPT_THRESHOLD: 0.5,
    ACTIVE_CONCEPT_COUNT: 5,
    RECENT_QUESTION_COUNT: 3,
    MIN_ATTEMPTS_FOR_PRIORITY: 10,
    MIN_RULE_PRIORITY: 0.5,
    EFFICIENCY_EPSILON: 0.01,
    DEFAULT_BUDGET_SCALE: 0.7,
    BUDGET_SCALE_ADJUSTMENT_FACTOR_1: 0.7,
    BUDGET_SCALE_ADJUSTMENT_FACTOR_2: 0.4,
    MIN_BUDGET_SCALE: 0.3,
    MAX_BUDGET_SCALE: 1.0,
};

export class CognitiveExecutive {
    constructor(nar) {
        this.nar = nar;

        this.config = {...defaultConfig, ...nar.config.cognitiveExecutive};

        this.rulePerformance = new Map();
        this.reasoningGoals = new Set();
        this.resourceAllocationHistory = [];

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

    selfMonitor() {
        const metrics = this._calculateMetrics();
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.config.METRICS_HISTORY_LENGTH) this.metricsHistory.shift();
        this.addToTrace({type: 'self-monitor', metrics});

        const issues = this._detectIssues(metrics);
        if (issues.length > 0) {
            this._adaptReasoningParameters(issues, metrics);
        }

        this._adjustResourceAllocation(metrics);
        this._adjustReasoningFocus(metrics);

        if (this.nar.state.currentStep % this.config.MAINTENANCE_INTERVAL === 0) {
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

    adaptRulePriorities() {
        const ruleEfficiencies = Array.from(this.rulePerformance.entries())
            .map(([rule, stats]) => {
                const efficiency = stats.attempts > 0
                    ? (stats.totalValue / stats.attempts) / (stats.totalCost / stats.attempts + this.config.EFFICIENCY_EPSILON)
                    : 0;
                return {rule, efficiency};
            });

        ruleEfficiencies.forEach(({rule, efficiency}) => {
            const currentConfig = this.nar.config.ruleConfig[rule] || {};
            const newScale = clamp(
                (currentConfig.budgetScale || this.config.DEFAULT_BUDGET_SCALE) * (this.config.BUDGET_SCALE_ADJUSTMENT_FACTOR_1 + this.config.BUDGET_SCALE_ADJUSTMENT_FACTOR_2 * efficiency),
                this.config.MIN_BUDGET_SCALE, this.config.MAX_BUDGET_SCALE
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
            inferenceRate: Math.min(1.0, (inferenceCount / timeDelta) / this.config.INFERENCE_RATE_NORMALIZATION),
            contradictionRate: Math.min(1.0, (this.contradictionCount / timeDelta) / this.config.CONTRADICTION_RATE_NORMALIZATION),
            resourceUtilization: Math.min(1.0, this.nar.state.eventQueue.heap.length / this.config.RESOURCE_UTILIZATION_NORMALIZATION),
            questionResponseTime: Math.max(0, 1 - (avgResponseTime / this.nar.config.questionTimeout)),
            queueSize: this.nar.state.eventQueue.heap.length,
        };

        this.lastMetricTimestamp = now;
        this.contradictionCount = 0;
        return metrics;
    }

    _detectIssues(metrics) {
        const issues = [];
        if (metrics.contradictionRate > this.config.HIGH_CONTRADICTION_THRESHOLD) issues.push('high-contradictions');
        if (metrics.inferenceRate < this.config.LOW_INFERENCE_THRESHOLD && metrics.queueSize > this.config.LOW_INFERENCE_QUEUE_SIZE) issues.push('low-inference-rate');
        if (metrics.resourceUtilization > this.config.HIGH_RESOURCE_THRESHOLD) issues.push('high-resource-utilization');
        if (metrics.questionResponseTime < this.config.SLOW_QUESTION_RESPONSE_THRESHOLD) issues.push('slow-question-response');
        return issues;
    }

    _adaptReasoningParameters(issues, metrics) {
        this.addToTrace({type: 'adaptation', issues, metrics});
        const policy = this.nar.config;
        const rate = this.config.ADAPTATION_RATE;

        if (issues.includes('high-contradictions')) {
            policy.inferenceThreshold = Math.min(this.config.MAX_INFERENCE_THRESHOLD, policy.inferenceThreshold * (1 + rate));
        } else if (issues.includes('low-inference-rate')) {
            policy.inferenceThreshold = Math.max(this.config.MIN_INFERENCE_THRESHOLD, policy.inferenceThreshold * (1 - rate));
            policy.budgetThreshold = Math.max(this.config.MIN_BUDGET_THRESHOLD, policy.budgetThreshold * (1 - rate * 0.5));
        }

        if (issues.includes('high-resource-utilization')) {
            policy.budgetThreshold = Math.min(this.config.MAX_BUDGET_THRESHOLD, policy.budgetThreshold * (1 + rate * 2));
            policy.maxPathLength = Math.max(this.config.MIN_PATH_LENGTH, policy.maxPathLength - 1);
        }
    }

    _adjustResourceAllocation(metrics) {
        const {inferenceRate, contradictionRate} = metrics;
        const alloc = this.resourceAllocation;
        const rate = this.config.RESOURCE_ALLOCATION_ADJUSTMENT_RATE;

        if (inferenceRate < this.config.LOW_INFERENCE_RATE_ALLOCATION_THRESHOLD) alloc.derivation = Math.min(this.config.MAX_DERIVATION_ALLOCATION, alloc.derivation + rate);
        else if (inferenceRate > this.config.HIGH_INFERENCE_RATE_ALLOCATION_THRESHOLD) alloc.derivation = Math.max(this.config.MIN_DERIVATION_ALLOCATION, alloc.derivation - rate);
        if (contradictionRate > this.config.HIGH_CONTRADICTION_ALLOCATION_THRESHOLD) alloc.memory = Math.min(this.config.MAX_MEMORY_ALLOCATION, alloc.memory + rate);

        const total = Object.values(alloc).reduce((a, b) => a + b, 0);
        Object.keys(alloc).forEach(key => alloc[key] = alloc[key] / total);
    }

    _adjustReasoningFocus(metrics) {
        const oldFocus = this.currentFocus;
        if (this.nar.questionHandler.questionPromises.size > 0) this.currentFocus = 'question-answering';
        else if (metrics.contradictionRate > this.config.HIGH_CONTRADICTION_ALLOCATION_THRESHOLD) this.currentFocus = 'contradiction-resolution';
        else this.currentFocus = 'default';

        if (oldFocus !== this.currentFocus) {
            this.addToTrace({type: 'focus-change', from: oldFocus, to: this.currentFocus});
        }
    }

    _pruneLowValueKnowledge() {
        const now = Date.now();
        const cutoff = now - (this.nar.config.knowledgeTTL || this.config.KNOWLEDGE_TTL);
        const candidates = [];

        for (const [id, hyperedge] of this.nar.state.hypergraph.entries()) {
            const lastAccess = this.nar.state.activations.get(id) || 0;
            const beliefStrength = hyperedge.getTruthExpectation();
            if (lastAccess < cutoff && beliefStrength < this.config.LOW_BELIEF_STRENGTH_PRUNE_THRESHOLD) {
                candidates.push({id, value: beliefStrength + (lastAccess / now)});
            }
        }

        candidates.sort((a, b) => a.value - b.value);
        const pruneCount = Math.min(this.config.MAX_PRUNE_CANDIDATES, Math.ceil(candidates.length * this.config.PRUNE_CANDIDATE_RATIO));
        for (let i = 0; i < pruneCount; i++) {
            this.nar.api.removeHyperedge(candidates[i].id);
        }
    }

    getTrace(depth = 5) {
        return this.trace.slice(-depth);
    }

    addToTrace(traceEntry) {
        this.trace.push({...traceEntry, timestamp: Date.now()});
        if (this.trace.length > this.config.TRACE_LENGTH) this.trace.shift();
    }

    _assessReasoningContext() {
        const context = ['default'];
        const lastMetric = this.metricsHistory[this.metricsHistory.length - 1];
        if (!lastMetric) return context;

        if (lastMetric.contradictionRate > this.config.HIGH_UNCERTAINTY_THRESHOLD) context.push('high-uncertainty');
        if (this.nar.questionHandler.questionPromises.size > 0) context.push('question-answering');
        return context;
    }

    _extractContextSignature() {
        const activeConcepts = [...this.nar.state.activations.entries()]
            .filter(([_, activation]) => activation > this.config.ACTIVE_CONCEPT_THRESHOLD)
            .map(([id]) => id)
            .sort()
            .slice(0, this.config.ACTIVE_CONCEPT_COUNT);
        const recentQuestions = [...this.nar.questionHandler.questionPromises.keys()]
            .slice(-this.config.RECENT_QUESTION_COUNT)
            .map(q => q.replace(/^.+?\((.+?)\|.+$/, '$1'));
        return hash(`${activeConcepts.join('|')}~${recentQuestions.join('|')}`);
    }

    getRulePriority(ruleName) {
        const stats = this.strategyEffectiveness.get(ruleName);
        if (!stats || stats.attempts < this.config.MIN_ATTEMPTS_FOR_PRIORITY) {
            return 1.0;
        }
        const successRate = stats.successes / stats.attempts;
        return this.config.MIN_RULE_PRIORITY + successRate;
    }

    tick() {
        if (this.nar.state.currentStep % this.nar.config.questionResolutionInterval === 0) {
            this._resolveQuestions();
        }

        this.nar.state.stepsSinceMaintenance++;
        if (this.nar.state.stepsSinceMaintenance >= this.nar.config.memoryMaintenanceInterval) {
            this._runMaintenance();
            this.nar.state.stepsSinceMaintenance = 0;
        }

        this.nar.state.stepsSinceCleanup++;
        if (this.nar.state.stepsSinceCleanup >= this.nar.config.cleanupInterval) {
            this._cleanup();
            this.nar.state.stepsSinceCleanup = 0;
        }
    }

    _resolveQuestions() {
        // Fix: Iterate over the correct question promises map in the handler
        for (const questionId of this.nar.questionHandler.questionPromises.keys()) {
            this.nar.questionHandler._resolveQuestion(questionId);
        }
    }

    _runMaintenance() {
        this.nar.memoryManager.maintainMemory();
        this.nar.contradictionManager.resolveContradictions();
        this.selfMonitor();
        this.nar.learningEngine.applyLearning();
        this.nar.temporalManager.adjustTemporalHorizon?.();
        this.nar.goalManager?.processGoals();
    }

    _cleanup() {
        if (Math.random() < this.nar.config.cleanupProbability) {
            for (const [id, cache] of this.nar.state.pathCache) {
                if (cache.size > this.nar.config.maxPathCacheSize) {
                    this.nar.state.pathCache.set(id, new Set([...cache].slice(-this.nar.config.pathCacheTruncationSize)));
                }
            }

            for (const [questionId, answers] of this.nar.state.index.questionCache) {
                if (answers.length > this.nar.config.maxQuestionCacheSize) {
                    this.nar.state.index.questionCache.set(questionId, answers.slice(-this.nar.config.questionCacheTruncationSize));
                }
            }
        }
    }
}
