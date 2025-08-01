import {TruthValue} from './TruthValue.js';

export class Hyperedge {
  constructor(nar, id, type, args) {
    this.nar = nar;
    this.id = id;
    this.type = type;
    this.args = args;
    this.beliefs = [];
  }

  revise(options) {
    const {
        truth,
        budget,
        beliefCapacity = 8,
        premises = [],
        context = null,
        derivedBy = null
    } = options;

    const newBelief = {
        truth,
        budget,
        premises: premises || [],
        context,
        derivedBy,
        timestamp: Date.now()
    };

    // Add the new belief to the list
    this.beliefs.push(newBelief);

    // Sort beliefs by budget priority and prune to capacity
    this.beliefs.sort((a, b) => b.budget.priority - a.budget.priority);
    if (this.beliefs.length > beliefCapacity) {
        this.beliefs = this.beliefs.slice(0, beliefCapacity);
    }

    // Always signal an update occurred
    return { newBelief, needsUpdate: true };
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
