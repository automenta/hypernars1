import { TruthValue } from './TruthValue.js';
import { Budget } from './Budget.js';

export class Hyperedge {
  constructor(id, type, args) {
    this.id = id;
    this.type = type;
    this.args = args;
    this.beliefs = [];
  }

  revise(truth, budget, beliefCapacity = 8, premises = [], context = null, derivedBy = null) {
    // Find existing belief with equivalent budget
    const existing = this.beliefs.find(b => b.budget.equivalent(budget));
    const newBelief = existing
      ? { truth: TruthValue.revise(existing.truth, truth), budget: budget.merge(existing.budget), premises: premises.length ? premises : (existing.premises || []), context, derivedBy: derivedBy || existing.derivedBy, timestamp: Date.now() }
      : { truth, budget, premises, context, derivedBy, timestamp: Date.now() };

    // Check if this is a meaningful update
    const needsUpdate = !existing ||
      Math.abs(newBelief.truth.frequency - existing.truth.frequency) > 0.05 ||
      newBelief.budget.priority > existing.budget.priority;

    if (needsUpdate) {
      // Add new belief
      this.beliefs = [...this.beliefs.filter(b => !b.budget.equivalent(budget)), newBelief]
        .sort((a, b) => b.budget.priority - a.budget.priority)
        .slice(0, beliefCapacity);

      return { newBelief, needsUpdate: true };
    }

    return { needsUpdate: false };
  }

  getStrongestBelief() {
    return this.beliefs[0];
  }

  getTruth() {
    return this.beliefs.length ? this.beliefs[0].truth : TruthValue.unknown();
  }

  getTruthExpectation() {
    return this.beliefs.length ? this.beliefs[0].truth.expectation() : 0.5;
  }
}
