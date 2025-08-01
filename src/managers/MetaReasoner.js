/**
 * Meta-reasoning system for self-monitoring and optimization of the NAR.
 * It allows the system to adapt its strategies and resource allocation
 * based on performance and context.
 */
export class MetaReasoner {
    constructor(nar) {
        this.nar = nar;
        this.strategies = []; // Holds strategy configurations
        this.trace = []; // Holds a trace of recent reasoning steps
        this.metricsHistory = []; // Holds a history of performance metrics
        this.lastMetricTimestamp = Date.now();
        this.contradictionCount = 0;

        // Add a default strategy
        this.configureStrategy({
            context: 'default',
            strategy: 'balanced',
            priority: 0
        });

        // Listen for contradictions to calculate rate
        this.nar.on('contradiction-resolved', () => {
            this.contradictionCount++;
        });
    }

    /**
     * Configure a reasoning strategy based on a specific context.
     * @param {Object} config - Strategy configuration.
     * @param {string} config.context - When to apply (e.g., 'high-uncertainty').
     * @param {string} config.strategy - Which strategy to use.
     * @param {number} config.priority - Priority of this configuration.
     */
    configureStrategy(config) {
        this.strategies.push(config);
        this.strategies.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get the current reasoning strategy based on the system's context.
     * @returns {string} Active strategy name.
     */
    getActiveStrategy() {
        const context = this._assessReasoningContext();
        const strategy = this.strategies.find(s =>
            context.includes(s.context) || s.context === 'default'
        );
        return strategy ? strategy.strategy : 'balanced';
    }

    /**
     * Self-monitor reasoning performance and adapt strategies and parameters.
     * This method should be called periodically in the main system loop.
     */
    selfMonitor() {
        // 1. Track metrics
        const metrics = {
            timestamp: Date.now(),
            inferenceRate: this._calculateInferenceRate(),
            contradictionRate: this._calculateContradictionRate(),
            resourceUtilization: this._calculateResourceUtilization(),
            queueSize: this.nar.state.eventQueue.heap.length,
        };
        this.lastMetricTimestamp = metrics.timestamp; // Reset timestamp for next interval
        this.contradictionCount = 0; // Reset for the next interval
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > 100) {
            this.metricsHistory.shift();
        }
        this.addToTrace({ type: 'self-monitor', metrics });

        // 2. Detect issues based on metrics
        const issues = [];
        if (metrics.contradictionRate > 0.3) issues.push('high-contradictions');
        if (metrics.inferenceRate < 0.1) issues.push('low-inference-rate');
        if (metrics.resourceUtilization > 0.8) issues.push('high-resource-utilization');

        // 3. Adapt if needed
        if (issues.length > 0) {
            this._adaptReasoning(issues, metrics);
        }

        return {
            metrics,
            issues,
            strategy: this.getActiveStrategy()
        };
    }

    /**
     * Get the reasoning trace for debugging and analysis.
     * @param {number} [depth=5] - How deep to trace back.
     * @returns {Array} The last `depth` entries of the trace history.
     */
    getTrace(depth = 5) {
        return this.trace.slice(-depth);
    }

    /**
     * Adds an entry to the reasoning trace.
     * @param {Object} traceEntry - The entry to add to the trace.
     */
    addToTrace(traceEntry) {
        this.trace.push({ ...traceEntry, timestamp: Date.now() });
        if (this.trace.length > 50) { // Keep trace to a manageable size
            this.trace.shift();
        }
    }

    // --- Private Helper Methods for Self-Monitoring ---

    _assessReasoningContext() {
        // This is a simplified context assessment. A more advanced version
        // would analyze the nature of current tasks and knowledge.
        const context = ['default'];
        const lastMetric = this.metricsHistory[this.metricsHistory.length - 1];
        if (!lastMetric) return context;

        if (lastMetric.contradictionRate > 0.3) context.push('high-uncertainty');
        if (this.nar.state.questionPromises.size > 0) context.push('question-answering');
        return context;
    }

    _calculateInferenceRate() {
        const now = Date.now();
        const timeDelta = (now - this.lastMetricTimestamp) / 1000; // in seconds
        if (timeDelta < 0.1) return 0; // Avoid division by zero or tiny intervals

        const inferenceCount = this.nar.derivationEngine.getAndResetInferenceCount();
        const rate = inferenceCount / timeDelta;

        // Normalize the rate to a 0-1 range for metric consistency.
        // Assumes a target rate of around 100 inferences/sec for a score of 0.5.
        const normalizedRate = Math.min(1.0, rate / 200);

        return normalizedRate;
    }

    _calculateContradictionRate() {
        const now = Date.now();
        const timeDelta = (now - this.lastMetricTimestamp) / 1000;
        if (timeDelta < 1) return 0; // Don't calculate for very short intervals

        const rate = this.contradictionCount / timeDelta;
        // Don't reset here, reset in selfMonitor after both metrics have used the count.

        // Normalize the rate. Assumes a "high" rate is 5 contradictions/sec.
        return Math.min(1.0, rate / 5);
    }

    _calculateResourceUtilization() {
        const queueSize = this.nar.state.eventQueue.heap.length;
        const maxQueueSize = 2000; // Assumed max
        return Math.min(1.0, queueSize / maxQueueSize);
    }

    _adaptReasoning(issues, metrics) {
        this.addToTrace({ type: 'adaptation', issues, metrics });
        const policy = this.nar.config;
        const adaptationRate = 0.1; // Make adaptation slightly more aggressive

        if (issues.includes('high-contradictions')) {
            // If contradictions are high, become more skeptical and prioritize revision.
            this.addToTrace({ type: 'adaptation-detail', message: 'High contradictions detected. Increasing skepticism.' });
            policy.inferenceThreshold = Math.min(0.6, policy.inferenceThreshold * (1 + adaptationRate));
            // In a more advanced system, we could change the active strategy here.
            this.configureStrategy({ context: 'high-uncertainty', strategy: 'skeptical', priority: 10 });
        }
        if (issues.includes('low-inference-rate')) {
            // If inference is low, be more eager and allocate more budget.
            this.addToTrace({ type: 'adaptation-detail', message: 'Low inference rate detected. Becoming more eager.' });
            policy.inferenceThreshold = Math.max(0.05, policy.inferenceThreshold * (1 - adaptationRate));
            policy.budgetThreshold = Math.max(0.01, policy.budgetThreshold * (1 - adaptationRate * 0.5));
        }
        if (issues.includes('high-resource-utilization')) {
            // If resources are strained, be much stricter with budgets and derivation depth.
            this.addToTrace({ type: 'adaptation-detail', message: 'High resource utilization. Tightening resource limits.' });
            policy.budgetThreshold = Math.min(0.25, policy.budgetThreshold * (1 + adaptationRate * 2));
            policy.maxPathLength = Math.max(5, policy.maxPathLength - 1);
        } else if (policy.maxPathLength < this.nar.config.maxPathLength) {
            // If resources are not strained, slowly relax the path length limit.
            policy.maxPathLength++;
        }
    }
}
