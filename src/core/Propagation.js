import { hash, getArgId } from '../support/utils.js';

export class Propagation {
  constructor(nar) {
    this.nar = nar;
  }

  propagateWave(event) {
    const hyperedge = this.nar.state.hypergraph.get(event.target);

    if (hyperedge) {
        hyperedge.args.forEach(arg => this._propagateToTerm(hyperedge, arg, event));
    } else if (typeof event.target === 'string') {
        (this.nar.state.index.byArg.get(event.target) || new Set()).forEach(id =>
            this._propagateToHyperedge(id, event)
        );
    }
  }

  _propagateToTerm(hyperedge, term, originalEvent) {
    this.propagate({
        target: getArgId(term),
        activation: originalEvent.activation * hyperedge.getTruthExpectation(),
        budget: originalEvent.budget.scale(this.nar.config.budgetDecay),
        pathHash: originalEvent.pathHash ^ hash(String(getArgId(term))),
        pathLength: originalEvent.pathLength + 1,
        derivationPath: [...originalEvent.derivationPath, 'structural_propagation']
    });
  }

  _propagateToHyperedge(hyperedgeId, originalEvent) {
    this.propagate({
        target: hyperedgeId,
        activation: originalEvent.activation,
        budget: originalEvent.budget.scale(this.nar.config.budgetDecay),
        pathHash: originalEvent.pathHash ^ hash(String(hyperedgeId)),
        pathLength: originalEvent.pathLength + 1,
        derivationPath: [...originalEvent.derivationPath, 'procedural_propagation']
    });
  }

  propagate(event) {
    if (event.budget.priority < this.nar.config.budgetThreshold ||
        event.pathLength > this.nar.config.maxPathLength ||
        this._hasLoop(event.target, event.pathHash)) return;

    this.nar.state.eventQueue.push({
        ...event,
        activation: Math.min(event.activation, 1.0)
    });
  }

  _hasLoop(id, pathHash) {
    const cache = this.nar.state.pathCache.get(id) || new Set();
    if (cache.has(pathHash)) return true;
    this.nar.state.pathCache.set(id, cache.add(pathHash));
    return false;
  }

  updateActivation(id, activation) {
    const currentActivation = this.nar.state.activations.get(id) || 0;
    const newActivation = (1 - this.nar.config.decay) * currentActivation + this.nar.config.decay * activation;
    this.nar.state.activations.set(id, newActivation);
  }
}
