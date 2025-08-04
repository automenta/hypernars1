export class System {
    constructor(nar) {
        this.nar = nar;
    }

    step() {
        this.nar.state.currentStep++;
        const event = this.nar.state.eventQueue.pop();
        if (!event || event.budget.priority < this.nar.config.budgetThreshold) return false;

        this.nar.memoryManager.updateRelevance(event.target, 'processing', event.budget.priority);

        this.nar.propagation.updateActivation(event.target, event.activation);
        this.nar.derivationEngine.applyDerivationRules(event);
        this.nar.propagation.propagateWave(event);

        this.nar.emit('step', {
            step: this.nar.state.currentStep,
            event,
            activation: this.nar.state.activations.get(event.target),
            queueSize: this.nar.state.eventQueue.heap.length
        });

        if (this.nar.state.currentStep % this.nar.config.questionResolutionInterval === 0) {
            for (const questionId of this.nar.state.questionPromises.keys()) {
                this.nar.questionHandler._resolveQuestion(questionId);
            }
        }

        this.nar.state.stepsSinceMaintenance++;
        if (this.nar.state.stepsSinceMaintenance >= this.nar.config.memoryMaintenanceInterval) {
            this._runMaintenance();
            this.nar.state.stepsSinceMaintenance = 0;
        }

        return true;
    }

    run(maxSteps = Infinity, callback = () => {
    }) {
        let steps = 0;
        while (steps < maxSteps && this.step()) {
            callback(this.nar, steps++);
            if (steps % this.nar.config.cleanupInterval === 0) this._cleanup();
        }
        return steps;
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

    _runMaintenance() {
        this.nar.memoryManager.maintainMemory();
        this.nar.contradictionManager.resolveContradictions();
        this.nar.cognitiveExecutive.selfMonitor();
        this.nar.learningEngine.applyLearning();
        this.nar.temporalManager.adjustTemporalHorizon?.();
        this.nar.goalManager?.processGoals();
    }
}
