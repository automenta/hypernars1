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

        if (strongest.evidenceStrength > (nextStrongest.evidenceStrength * 1.5)) {
            if (!suggestOnly) {
                hyperedge.beliefs = [strongest.belief];
                this.nar.notifyListeners('contradiction-resolved', { hyperedgeId, resolution: 'dominant_evidence' });
            }
            return {
                resolved: true,
                reason: 'dominant_evidence',
                primaryBelief: strongest.belief,
                evidenceStrength: strongest.evidenceStrength
            };
        } else {
            const conflictingBelief = nextStrongest.belief;
            const evidence = hyperedge.evidence?.find(e => e.beliefIndex === nextStrongest.index);
            const context = evidence?.source || 'alternative_context';
            const newHyperedgeId = `${hyperedge.id}|context:${context}`;

            if (!suggestOnly) {
                this._createContextualSpecialization(hyperedge, conflictingBelief, context);
                hyperedge.beliefs = hyperedge.beliefs.filter(b => b !== conflictingBelief);
            }

            return {
                resolved: true,
                reason: 'specialized',
                originalHyperedge: hyperedgeId,
                newHyperedge: newHyperedgeId,
                context
            };
        }
    }

    _createContextualSpecialization(originalHyperedge, conflictingBelief, context) {
        const newId = `${originalHyperedge.id}|context:${context}`;
        if (this.nar.state.hypergraph.has(newId)) {
            const existingSpecialization = this.nar.state.hypergraph.get(newId);
            existingSpecialization.revise(conflictingBelief.truth, conflictingBelief.budget, this.nar.config.beliefCapacity, conflictingBelief.premises);
            return newId;
        }
        const newArgs = [...originalHyperedge.args, `context:${context}`];
        const specialization = new Hyperedge(this.nar, newId, originalHyperedge.type, newArgs);
        specialization.revise(conflictingBelief.truth, conflictingBelief.budget, this.nar.config.beliefCapacity, conflictingBelief.premises);
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
        if (!hyperedge || !hyperedge.evidence) {
            return belief.truth.expectation() * belief.budget.priority;
        }
        const beliefIndex = hyperedge.beliefs.indexOf(belief);
        if (beliefIndex === -1) return 0;
        const totalStrength = hyperedge.evidence
            .filter(e => e.beliefIndex === beliefIndex)
            .reduce((sum, e) => sum + (e.strength || 0), 0);
        const intrinsicStrength = belief.truth.expectation() * belief.budget.priority;
        return intrinsicStrength * 0.2 + totalStrength * 0.8;
    }
}
