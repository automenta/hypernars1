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

    this.nar.notifyListeners('step', {
      step: this.nar.state.currentStep,
      event,
      activation: this.nar.state.activations.get(event.target),
      queueSize: this.nar.state.eventQueue.heap.length
    });

    this.nar.state.questionPromises.forEach((_, questionId) => {
      if (this.nar.state.currentStep % 10 === 0) {
        this.nar.questionHandler._resolveQuestion(questionId);
      }
    });

    this.nar.state.stepsSinceMaintenance++;
    if (this.nar.state.stepsSinceMaintenance >= this.nar.config.memoryMaintenanceInterval) {
        this._runMaintenance();
        this.nar.state.stepsSinceMaintenance = 0;
    }

    return true;
  }

  run(maxSteps = Infinity, callback = () => {}) {
    let steps = 0;
    while (steps < maxSteps && this.step()) {
      callback(this.nar, steps++);
      if (steps % 100 === 0) this._cleanup();
    }
    return steps;
  }

  _cleanup() {
    if (Math.random() < 0.1) {
      for (const [id, cache] of this.nar.state.pathCache) {
        if (cache.size > 1000) {
          this.nar.state.pathCache.set(id, new Set([...cache].slice(-500)));
        }
      }

      for (const [questionId, answers] of this.nar.state.index.questionCache) {
        if (answers.length > 10) {
          this.nar.state.index.questionCache.set(questionId, answers.slice(-5));
        }
      }
    }
  }

  _runMaintenance() {
    this.nar.memoryManager.maintainMemory();
    this.nar.contradictionManager.resolveContradictions();
    this.nar.metaReasoner.selfMonitor();
    this.nar.learningEngine.applyLearning();
    this.nar.temporalManager.adjustTemporalHorizon?.();
  }
}
