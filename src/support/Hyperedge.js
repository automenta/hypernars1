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
            id: `Belief_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            truth,
            budget,
            premises: premises || [],
            context,
            derivedBy,
            timestamp: Date.now()
        };

        this.beliefs.push(newBelief);
        this.beliefs.sort((a, b) => b.budget.priority - a.budget.priority);

        if (this.beliefs.length > beliefCapacity) {
            this.beliefs.length = beliefCapacity;
        }

        return {newBelief: this.getStrongestBelief(), needsUpdate: true};
    }

    getStrongestBelief() {
        return this.beliefs[0];
    }

    getWeakestBelief() {
        return this.beliefs.length > 0 ? this.beliefs[this.beliefs.length - 1] : undefined;
    }

    getTruth() {
        return this.beliefs.length ? this.beliefs[0].truth : TruthValue.unknown();
    }

    getTruthExpectation() {
        return this.beliefs.length ? this.beliefs[0].truth.expectation() : 0.5;
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            args: this.args,
            beliefs: this.beliefs.map(b => ({
                ...b,
                truth: b.truth.toJSON(),
                budget: b.budget.toJSON(),
            })),
        };
    }
}
