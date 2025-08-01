import {TruthValue} from './TruthValue.js';

export class Hyperedge {
  constructor(nar, id, type, args) {
    this.nar = nar;
    this.id = id;
    this.type = type;
    this.args = args;
    this.beliefs = [];
  }

  revise(truth, budget, beliefCapacity = 8, premises = [], context = null, derivedBy = null) {
    const newBelief = {
        truth,
        budget,
        premises: premises || [],
        context,
        derivedBy,
        timestamp: Date.now()
    };

    const resolution = this.nar.contradictionManager.handle(this, newBelief);

    if (resolution) {
        switch (resolution.action) {
            case 'reject':
                return { needsUpdate: false }; // The new belief is rejected
            case 'accept':
                this.beliefs = [newBelief]; // Replace all with the new accepted belief
                break;
            case 'merge':
                // The resolution provided a merged belief, make it the only one
                const mergedBelief = { ...newBelief, truth: resolution.mergedTruth, budget: resolution.adjustedBudget };
                this.beliefs = [mergedBelief];
                break;
            case 'split':
                // The new belief is added to a different, new concept.
                // The original hyperedge remains untouched by this specific new belief.
                const newHyperedge = this.nar.state.hypergraph.get(resolution.newConceptId);
                if (newHyperedge) {
                    // This is a direct revision on the new hyperedge, no contradiction check needed here.
                    newHyperedge.beliefs = [newBelief];
                }
                return { needsUpdate: true }; // A change was made to the system
            default:
                // Default case, fall through to normal processing
                this.beliefs = [...this.beliefs, newBelief];
        }
    } else {
        // No contradiction, proceed with normal revision by adding the new belief
        this.beliefs.push(newBelief);
    }

    // Sort and manage capacity
    this.beliefs.sort((a, b) => b.budget.priority - a.budget.priority).slice(0, beliefCapacity);

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
