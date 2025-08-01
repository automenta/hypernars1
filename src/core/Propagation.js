import { hash } from '../support/utils.js';
import { getArgId } from './utils.js';

export class Propagation {
  constructor(nar) {
    this.nar = nar;
  }

  propagateWave({ target, activation, budget, pathHash, pathLength, derivationPath }) {
    const hyperedge = this.nar.state.hypergraph.get(target);

    if (hyperedge) {
      hyperedge.args.forEach(arg =>
        this._propagateToTerm(hyperedge, arg, activation, budget, pathHash, pathLength, derivationPath)
      );
      this.nar.temporalManager.processTemporalConstraints(target, activation, budget, pathHash, pathLength, derivationPath);
    } else {
      if (typeof target === 'string') {
        (this.nar.state.index.byArg.get(target) || new Set()).forEach(id =>
            this._propagateToHyperedge(id, activation, budget, pathHash, pathLength, derivationPath)
        );
      }
    }
  }

  _propagateToTerm(hyperedge, term, activation, budget, pathHash, pathLength, derivationPath) {
    this.propagate(
      getArgId(term),
      activation * hyperedge.getTruthExpectation(),
      budget.scale(this.nar.config.budgetDecay),
      pathHash ^ hash(String(getArgId(term))),
      pathLength + 1,
      [...derivationPath, 'structural_propagation']
    );
  }

  _propagateToHyperedge(hyperedgeId, activation, budget, pathHash, pathLength, derivationPath) {
    this.propagate(
      hyperedgeId,
      activation,
      budget.scale(this.nar.config.budgetDecay),
      pathHash ^ hash(String(hyperedgeId)),
      pathLength + 1,
      [...derivationPath, 'procedural_propagation']
    );
  }

  propagate(target, activation, budget, pathHash, pathLength, derivationPath) {
    if (budget.priority < this.nar.config.budgetThreshold ||
        pathLength > this.nar.config.maxPathLength ||
        this._hasLoop(target, pathHash)) return;

    this.nar.state.eventQueue.push({
      target,
      activation: Math.min(activation, 1.0),
      budget,
      pathHash,
      pathLength,
      derivationPath
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
