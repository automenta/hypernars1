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

        this.nar.cognitiveExecutive.tick();

        return true;
    }

    run(maxSteps = Infinity, callback = () => {
    }) {
        let steps = 0;
        while (steps < maxSteps && this.step()) {
            callback(this.nar, steps++);
        }
        return steps;
    }
}
