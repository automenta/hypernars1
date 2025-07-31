import { Hyperedge } from '../support/Hyperedge.js';
import { id } from '../support/utils.js';

export class ContradictionManager {
    constructor(nar) {
        this.nar = nar;
        this.contradictions = new Map(); // Maps hyperedge ID to contradiction records
    }

    detectContradictions(hyperedgeId) {
        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!hyperedge || hyperedge.beliefs.length < 2) return false;

        const strongestBelief = hyperedge.getStrongestBelief();
        if (!strongestBelief) return false;

        // Check against other beliefs in the same hyperedge
        for (const belief of hyperedge.beliefs) {
            if (belief === strongestBelief) continue;

            const freqDiff = Math.abs(strongestBelief.truth.frequency - belief.truth.frequency);

            const isContradiction = freqDiff > (this.nar.config.contradictionThreshold || 0.7) &&
                                    (strongestBelief.truth.confidence > 0.5 && belief.truth.confidence > 0.5);

            if (isContradiction) {
                const contradictionId = id('Contradiction', [hyperedgeId, strongestBelief.truth.toString(), belief.truth.toString()]);
                if (!this.contradictions.has(contradictionId)) {
                    const contradiction = {
                        id: contradictionId,
                        hyperedgeId: hyperedgeId,
                        beliefs: [strongestBelief, belief],
                        severity: freqDiff,
                        resolved: false,
                        timestamp: Date.now()
                    };
                    this.contradictions.set(contradictionId, contradiction);
                    this.nar.notifyListeners('contradiction-detected', contradiction);
                }
                return true;
            }
        }
        return false;
    }

    resolveContradictions() {
        this.contradictions.forEach((contradiction, id) => {
            if (!contradiction.resolved) {
                this._resolveContradiction(contradiction);
            }
        });
    }

    _resolveContradiction(contradiction) {
        const { hyperedgeId, beliefs } = contradiction;
        const [belief1, belief2] = beliefs;

        const evidence1 = this._calculateEvidenceStrength(belief1);
        const evidence2 = this._calculateEvidenceStrength(belief2);

        if (Math.abs(evidence1 - evidence2) > 0.3) {
            const stronger = evidence1 > evidence2 ? belief1 : belief2;
            const weaker = evidence1 > evidence2 ? belief2 : belief1;

            const hyperedge = this.nar.hypergraph.get(hyperedgeId);
            if (hyperedge) {
                const newBeliefs = hyperedge.beliefs.filter(b => b !== weaker);
                const weakenedBelief = {
                    ...weaker,
                    truth: weaker.truth.scale(0.5),
                    budget: weaker.budget.scale(0.5)
                };
                hyperedge.beliefs = [...newBeliefs, weakenedBelief];
            }
            contradiction.resolved = true;
            this.nar.notifyListeners('contradiction-resolved', { id: contradiction.id, resolution: 'superseded', winner: stronger, loser: weaker });
        }
        else {
            const newConceptId = this._createContextualSpecialization(hyperedgeId, belief1, belief2);
            if (newConceptId) {
                contradiction.resolved = true;
                this.nar.notifyListeners('contradiction-resolved', { id: contradiction.id, resolution: 'specialized', newConcept: newConceptId });
            }
        }
    }

    _calculateEvidenceStrength(belief) {
        return belief.budget.priority * belief.truth.confidence;
    }

    _createContextualSpecialization(originalId, belief1, belief2) {
        const original = this.nar.hypergraph.get(originalId);
        if (!original) return null;

        const context = `context_for_${originalId.replace(/[(),]/g, '_')}`;
        const newId = `${originalId}|${context}`;

        if (this.nar.hypergraph.has(newId)) return newId;

        const newHyperedge = new Hyperedge(newId, original.type, [...original.args, context]);

        newHyperedge.revise(belief2.truth, belief2.budget, this.nar.config.beliefCapacity);
        this.nar.hypergraph.set(newId, newHyperedge);
        this.nar.addToIndex(newHyperedge);

        const hyperedge = this.nar.hypergraph.get(originalId);
        hyperedge.beliefs = hyperedge.beliefs.filter(b => b !== belief2);

        this.nar.similarity(newId, originalId, {
            truth: this.nar.truth(0.8, 0.9),
            budget: this.nar.budget(0.8, 0.8, 0.8)
        });

        return newId;
    }
}
