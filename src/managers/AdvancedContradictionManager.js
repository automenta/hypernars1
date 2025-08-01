import { ContradictionManagerBase } from './ContradictionManagerBase.js';
import { TruthValue } from '../support/TruthValue.js';
import { Hyperedge } from '../support/Hyperedge.js';
import { id as generateId } from '../support/utils.js';

/**
 * Advanced contradiction handling with evidence-based resolution and contextual specialization.
 * This manager allows for explicit evidence to be added to beliefs,
 * resolves contradictions based on evidence strength, and can create
 * contextual specializations (concept splitting) when evidence is ambiguous.
 */
export class AdvancedContradictionManager extends ContradictionManagerBase {
    constructor(nar) {
        super(nar);
    }

    /**
     * This manager is designed to be called reactively or on-demand,
     * so this finds and resolves the most significant contradiction.
     */
    resolveContradictions() {
        let mostContradictory = null;
        let maxContradiction = -1;

        // Find the most contradictory concept
        for (const [id, hyperedge] of this.nar.state.hypergraph.entries()) {
            if (hyperedge.beliefs && hyperedge.beliefs.length > 1) {
                const analysis = this.analyze(id);
                if (analysis && analysis.contradictions.length > 1) {
                    const strengthDiff = analysis.contradictions[0].evidenceStrength - analysis.contradictions[1].evidenceStrength;
                    const contradictionScore = (1 - strengthDiff) * hyperedge.beliefs.length; // Simple heuristic
                    if (contradictionScore > maxContradiction) {
                        maxContradiction = contradictionScore;
                        mostContradictory = id;
                    }
                }
            }
        }

        if (mostContradictory) {
            this.resolve(mostContradictory);
        }
    }

    /**
     * Register evidence for a belief on a hyperedge.
     * @param {string} hyperedgeId - Target hyperedge ID.
     * @param {Object} evidence - Evidence details.
     */
    addEvidence(hyperedgeId, evidence) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return;

        if (!hyperedge.evidence) {
            hyperedge.evidence = [];
        }
        hyperedge.evidence.push({
            ...evidence,
            timestamp: Date.now()
        });

        this._recalculateFromEvidence(hyperedge);
    }

    /**
     * Resolve contradictions for a hyperedge using evidence strength or contextual specialization.
     * @param {string} hyperedgeId - Target hyperedge ID.
     * @param {boolean} [suggestOnly=false] - If true, returns the suggested resolution without applying it.
     * @returns {Object} Resolution result.
     */
    resolve(hyperedgeId, suggestOnly = false) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || !hyperedge.beliefs || hyperedge.beliefs.length < 2) {
            return { resolved: false, reason: 'No contradictions found' };
        }

        const beliefsWithEvidence = hyperedge.beliefs.map((belief, index) => ({
            belief,
            index,
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const strongest = beliefsWithEvidence[0];
        const nextStrongest = beliefsWithEvidence[1];

        // Strategy 1: Resolve by dominant evidence if one is significantly stronger
        if (strongest.evidenceStrength > (nextStrongest.evidenceStrength * 1.5)) {
            return this._resolveByDominantEvidence(hyperedge, strongest, suggestOnly);
        }

        // Strategy 2: Attempt to specialize if contexts are different
        const context1 = this._getBeliefContext(hyperedge, strongest);
        const context2 = this._getBeliefContext(hyperedge, nextStrongest);
        if (context1 !== context2 && context2 !== 'default') {
             return this._resolveBySpecialization(hyperedge, nextStrongest, suggestOnly);
        }

        // Strategy 3: Merge beliefs if evidence is similar and contexts are not distinct
        return this._resolveByMerging(hyperedge, strongest, nextStrongest, suggestOnly);
    }

    _resolveByDominantEvidence(hyperedge, strongestBelief, suggestOnly) {
        if (!suggestOnly) {
            hyperedge.beliefs = [strongestBelief.belief];
            this.nar.notifyListeners('contradiction-resolved', { hyperedgeId: hyperedge.id, resolution: 'dominant_evidence' });
        }
        return {
            resolved: true,
            reason: 'dominant_evidence',
            primaryBelief: strongestBelief.belief,
            evidenceStrength: strongestBelief.evidenceStrength
        };
    }

    _resolveByMerging(hyperedge, belief1, belief2, suggestOnly) {
        const mergedTruth = TruthValue.revise(belief1.belief.truth, belief2.belief.truth);
        // Penalize confidence due to conflict
        mergedTruth.confidence *= 0.8;

        const mergedBudget = belief1.belief.budget.merge(belief2.belief.budget).scale(0.8);

        if (!suggestOnly) {
            hyperedge.beliefs = [
                { ...belief1.belief, truth: mergedTruth, budget: mergedBudget },
                ...hyperedge.beliefs.filter(b => b !== belief1.belief && b !== belief2.belief)
            ];
            // Prune weakest beliefs after merging
            hyperedge.beliefs.sort((a, b) => b.budget.priority - a.budget.priority);
            if (hyperedge.beliefs.length > this.nar.config.beliefCapacity) {
                hyperedge.beliefs = hyperedge.beliefs.slice(0, this.nar.config.beliefCapacity);
            }
            this.nar.notifyListeners('contradiction-resolved', { hyperedgeId: hyperedge.id, resolution: 'merged' });
        }

        return {
            resolved: true,
            reason: 'merged',
            mergedTruth: mergedTruth,
            mergedBudget: mergedBudget
        };
    }

    _resolveBySpecialization(hyperedge, conflictingBeliefData, suggestOnly) {
        const conflictingBelief = conflictingBeliefData.belief;
        const context = this._getBeliefContext(hyperedge, conflictingBeliefData) || 'alternative_context';
        const newHyperedgeId = `${hyperedge.id}|context:${context}`;

        if (!suggestOnly) {
            this._createContextualSpecialization(hyperedge, conflictingBelief, context);
            // Remove the now-specialized belief from the original concept
            hyperedge.beliefs = hyperedge.beliefs.filter(b => b !== conflictingBelief);
            this.nar.notifyListeners('contradiction-resolved', { hyperedgeId: hyperedge.id, resolution: 'specialized' });
        }

        return {
            resolved: true,
            reason: 'specialized',
            originalHyperedge: hyperedge.id,
            newHyperedge: newHyperedgeId,
            context
        };
    }

    _getBeliefContext(hyperedge, beliefData) {
        const evidence = hyperedge.evidence?.find(e => e.beliefIndex === beliefData.index);
        return evidence?.source || 'default';
    }

    _createContextualSpecialization(originalHyperedge, conflictingBelief, context) {
        const newId = `${originalHyperedge.id}|context:${context}`;
        if (this.nar.state.hypergraph.has(newId)) {
            const existingSpecialization = this.nar.state.hypergraph.get(newId);
            existingSpecialization.revise({
                truth: conflictingBelief.truth,
                budget: conflictingBelief.budget,
                beliefCapacity: this.nar.config.beliefCapacity,
                premises: conflictingBelief.premises
            });
            return newId;
        }
        const newArgs = [...originalHyperedge.args, `context:${context}`];
        const specialization = new Hyperedge(this.nar, newId, originalHyperedge.type, newArgs);
        specialization.revise({
            truth: conflictingBelief.truth,
            budget: conflictingBelief.budget,
            beliefCapacity: this.nar.config.beliefCapacity,
            premises: conflictingBelief.premises
        });
        this.nar.state.hypergraph.set(newId, specialization);
        this.nar.notifyListeners('concept-split', {
            originalId: originalHyperedge.id,
            newId: newId,
            context: context
        });
        return newId;
    }

    analyze(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || !hyperedge.beliefs || hyperedge.beliefs.length < 2) {
            return null;
        }

        const contradictions = hyperedge.beliefs.map((b, i) => ({
            index: i,
            truth: b.truth,
            budget: b.budget,
            evidence: hyperedge.evidence ? hyperedge.evidence.filter(e => e.beliefIndex === i) : [],
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, b)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const resolutionSuggestion = this.resolve(hyperedgeId, true);

        return {
            contradictions,
            resolutionSuggestion
        };
    }

    _recalculateFromEvidence(hyperedge) {
        this.nar.notifyListeners('evidence-added', { hyperedgeId: hyperedge.id });
    }

    _calculateEvidenceStrength(hyperedgeId, belief) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const intrinsicWeight = this.nar.config.intrinsicStrengthWeight || 0.2;
        const evidenceWeight = this.nar.config.evidenceStrengthWeight || 0.8;
        const sourceReliabilityWeight = this.nar.config.sourceReliabilityWeight || 0.5;


        const beliefIndex = hyperedge.beliefs.indexOf(belief);
        if (beliefIndex === -1) return 0;

        const evidenceList = hyperedge.evidence?.filter(e => e.beliefIndex === beliefIndex) || [];
        const totalEvidenceStrength = evidenceList.reduce((sum, e) => sum + (e.strength || 0), 0);

        // Factor in source reliability
        const sourceReliability = evidenceList.reduce((sum, e) => {
            const reliability = this.nar.state.sourceReliability?.get(e.source) || 0.5; // Default reliability
            return sum + (e.strength * reliability);
        }, 0);


        const intrinsicStrength = belief.truth.expectation() * belief.budget.priority;

        // Weighted average of intrinsic strength, evidence strength, and source reliability
        const finalStrength = (intrinsicStrength * intrinsicWeight) +
                              (totalEvidenceStrength * evidenceWeight) +
                              (sourceReliability * sourceReliabilityWeight);

        return finalStrength / (intrinsicWeight + evidenceWeight + sourceReliabilityWeight);
    }
}
