export class MetaReasoner {
    constructor(nar) {
        this.nar = nar;
        this.stats = {
            successfulInferences: 0,
            failedInferences: 0,
            questionSuccessCount: 0,
            questionTotalCount: 0,
            recentPerformance: [],
        };
        this.resourcePolicy = {
            budgetThreshold: nar.config.budgetThreshold,
            maxPathLength: nar.config.maxPathLength,
            inferenceThreshold: nar.config.inferenceThreshold,
        };

        this.nar.on('question-answer', () => this.stats.questionSuccessCount++);
        this.nar.on('question-timeout', () => this.stats.questionTotalCount++); // Assuming a timeout event
        this.nar.on('belief-added', () => this.stats.successfulInferences++);
    }

    optimizeResources() {
        const performance = this._analyzeReasoningPerformance();
        this._adaptResourcePolicies(performance);
    }

    _analyzeReasoningPerformance() {
        const questionSuccessRate = this.stats.questionTotalCount > 0
            ? this.stats.questionSuccessCount / this.stats.questionTotalCount
            : 0.5;

        const totalInferences = this.stats.successfulInferences + this.stats.failedInferences;
        const inferenceEffectiveness = totalInferences > 0
            ? this.stats.successfulInferences / totalInferences
            : 0.5;

        const queueSize = this.nar.eventQueue.heap.length;
        const resourcePressure = Math.min(1.0, queueSize / 2000); // Normalize pressure

        const performance = { questionSuccessRate, inferenceEffectiveness, resourcePressure };
        this.stats.recentPerformance.push({ timestamp: Date.now(), ...performance });
        if (this.stats.recentPerformance.length > 100) {
            this.stats.recentPerformance.shift();
        }

        // Reset counters for next cycle
        this.stats.questionSuccessCount = 0;
        this.stats.questionTotalCount = 0;
        this.stats.successfulInferences = 0;

        return performance;
    }

    _adaptResourcePolicies(performance) {
        const policy = this.resourcePolicy;
        const adaptationRate = 0.05; // Slow adaptation

        // If questions are failing, be less strict with budgets
        if (performance.questionSuccessRate < 0.5) {
            policy.budgetThreshold = Math.max(0.01, policy.budgetThreshold * (1 - adaptationRate));
        } else {
            policy.budgetThreshold = Math.min(0.2, policy.budgetThreshold * (1 + adaptationRate));
        }

        // If under high pressure, shorten reasoning paths
        if (performance.resourcePressure > 0.8) {
            policy.maxPathLength = Math.max(5, Math.floor(policy.maxPathLength * (1 - adaptationRate)));
        } else if (performance.resourcePressure < 0.2) {
            policy.maxPathLength = Math.min(25, policy.maxPathLength + 1);
        }

        // Apply policies to the main NAR config
        this.nar.config.budgetThreshold = policy.budgetThreshold;
        this.nar.config.maxPathLength = policy.maxPathLength;

        this.nar.notifyListeners('meta-reasoning', {
            performance,
            policies: { ...this.resourcePolicy },
            timestamp: Date.now()
        });
    }
}
