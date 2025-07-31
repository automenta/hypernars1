import { ContradictionManagerBase } from './ContradictionManagerBase.js';
import { Hyperedge } from '../support/Hyperedge.js';
import { id } from '../support/utils.js';

/**
 * A robust contradiction manager that resolves conflicts by either
 * merging beliefs or creating context-specific specializations.
 */
export class ContradictionManager extends ContradictionManagerBase {
    constructor(nar) {
        super(nar);
        this.contradictions = new Map();
    }

    /**
     * Detects if a hyperedge has contradictory beliefs.
     */
    detectContradictions(hyperedgeId) {
        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!hyperedge || hyperedge.beliefs.length < 2) {
            return false;
        }

        const beliefs = hyperedge.beliefs;
        // Check all pairs of beliefs for contradiction
        for (let i = 0; i < beliefs.length; i++) {
            for (let j = i + 1; j < beliefs.length; j++) {
                const belief1 = beliefs[i];
                const belief2 = beliefs[j];
                const freqDiff = Math.abs(belief1.truth.frequency - belief2.truth.frequency);

                if (freqDiff > (this.nar.config.contradictionThreshold || 0.7)) {
                    const contradictionId = id('Contradiction', [hyperedgeId, belief1.truth.toString(), belief2.truth.toString()]);
                    if (!this.contradictions.has(contradictionId)) {
                        this.contradictions.set(contradictionId, {
                            id: contradictionId,
                            hyperedgeId: hyperedgeId,
                            beliefs: [belief1, belief2],
                            resolved: false,
                        });
                        this.nar.notifyListeners('contradiction-detected', { id: contradictionId });
                    }
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Resolves all currently detected contradictions.
     */
    resolveContradictions() {
        this.contradictions.forEach((contradiction, id) => {
            if (contradiction.resolved) return;

            const { hyperedgeId, beliefs } = contradiction;
            const [belief1, belief2] = beliefs;

            const context1 = belief1.context || 'general';
            const context2 = belief2.context || 'general';

            if (context1 !== context2) {
                this._contextualSplit(hyperedgeId, belief1, belief2);
            } else {
                this._evidenceWeightedRevision(hyperedgeId, beliefs);
            }

            contradiction.resolved = true;
            this.nar.notifyListeners('contradiction-resolved', { id });
        });
    }

    /**
     * Merges contradictory beliefs based on their evidence strength.
     */
    _evidenceWeightedRevision(hyperedgeId, beliefs) {
        let totalWeight = 0;
        let weightedFrequency = 0;
        let weightedConfidence = 0;
        let totalPriority = 0;

        beliefs.forEach(belief => {
            const weight = belief.budget.priority * belief.truth.confidence;
            weightedFrequency += belief.truth.frequency * weight;
            weightedConfidence += belief.truth.confidence * weight;
            totalPriority += belief.budget.priority;
            totalWeight += weight;
        });

        if (totalWeight > 0) {
            const newTruth = this.nar.truth(
                weightedFrequency / totalWeight,
                weightedConfidence / totalWeight
            );
            const newBudget = this.nar.budget(
                totalPriority / beliefs.length, 0.8, Math.min(1, totalWeight / beliefs.length)
            );
            // Revise the hyperedge with the new merged belief
            this.nar.revise(hyperedgeId, newTruth, newBudget);
        }
    }

    /**
     * Splits a concept into a general case and a specific, contextual case.
     */
    _contextualSplit(hyperedgeId, belief1, belief2) {
        const originalHyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!originalHyperedge) return;

        // 1. Identify general vs. specific belief
        const generalBelief = (belief1.context === 'general' || !belief1.context) ? belief1 : belief2;
        const specificBelief = (belief1 === generalBelief) ? belief2 : belief1;
        const context = specificBelief.context;

        if (!context) return; // Should not happen if contexts are different

        // 2. Create the new hyperedge for the specific context
        const newId = `${hyperedgeId}|${context}`;
        if (!this.nar.hypergraph.has(newId)) {
            const newHyperedge = new Hyperedge(newId, originalHyperedge.type, [...originalHyperedge.args, context]);
            newHyperedge.revise(specificBelief.truth, specificBelief.budget, this.nar.config.beliefCapacity, specificBelief.premises, context);
            this.nar.hypergraph.set(newId, newHyperedge);
            this.nar.addToIndex(newHyperedge);

            // 3. Link the new concept to the old one
            setTimeout(() => {
                this.nar.similarity(newId, hyperedgeId, {
                    truth: this.nar.truth(0.8, 0.9),
                    budget: this.nar.budget(0.8, 0.8, 0.8)
                });
            }, 0);
        }

        // 4. Replace the beliefs on the original hyperedge with ONLY the general belief
        originalHyperedge.beliefs.length = 0;
        originalHyperedge.beliefs.push(generalBelief);
    }
}
