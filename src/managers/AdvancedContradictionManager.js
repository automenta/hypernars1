import { ContradictionManagerBase } from './ContradictionManagerBase.js';
import { TruthValue } from '../support/TruthValue.js';

/**
 * Advanced contradiction handling with evidence-based resolution.
 * This manager allows for explicit evidence to be added to beliefs
 * and provides methods to resolve and analyze contradictions based on
 * the accumulated evidence.
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
     * @param {string} evidence.source - Where the evidence came from.
     * @param {number} evidence.strength - (0-1) strength of the evidence.
     * @param {number} beliefIndex - The index of the belief in the hyperedge's belief array this evidence supports.
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

        // Optionally, recalculate truth values based on new evidence
        this._recalculateFromEvidence(hyperedge);
    }

    /**
     * Resolve contradictions for a hyperedge using evidence strength.
     * @param {string} hyperedgeId - Target hyperedge ID.
     * @returns {Object} Resolution result.
     */
    resolve(hyperedgeId) {
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

        // If the strongest evidence is significantly stronger, resolve the contradiction
        // by removing all other beliefs.
        if (strongest.evidenceStrength > (nextStrongest.evidenceStrength * 1.5)) {
            hyperedge.beliefs = [strongest.belief];
            this.nar.notifyListeners('contradiction-resolved', { hyperedgeId, resolution: 'dominant_evidence' });
            return {
                resolved: true,
                primaryBelief: strongest.belief,
                evidenceStrength: strongest.evidenceStrength
            };
        }

        return {
            resolved: false,
            reason: 'Insufficient evidence difference',
            strongestEvidence: strongest.evidenceStrength,
            nextStrongest: nextStrongest.evidenceStrength
        };
    }

    /**
     * Get a detailed contradiction analysis for a hyperedge.
     * @param {string} hyperedgeId
     * @returns {Object|null} Analysis report or null if no contradiction.
     */
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

        return {
            contradictions,
            resolutionSuggestion: this.resolve(hyperedgeId)
        };
    }

    /**
     * Recalculates a hyperedge's truth values based on its evidence.
     * (This is a placeholder for a more complex implementation).
     * @private
     */
    _recalculateFromEvidence(hyperedge) {
        // This could be a complex function that adjusts belief truth values
        // based on the strength and recency of evidence. For now, it's a no-op.
        this.nar.notifyListeners('evidence-added', { hyperedgeId: hyperedge.id });
    }

    /**
     * Calculates the evidence strength for a specific belief within a hyperedge.
     * @private
     */
    _calculateEvidenceStrength(hyperedgeId, belief) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || !hyperedge.evidence) {
            // Base strength on the belief's own properties if no explicit evidence exists
            return belief.truth.expectation() * belief.budget.priority;
        }

        const beliefIndex = hyperedge.beliefs.indexOf(belief);
        if (beliefIndex === -1) return 0;

        // Sum the strength of all evidence pointing to this belief
        const totalStrength = hyperedge.evidence
            .filter(e => e.beliefIndex === beliefIndex)
            .reduce((sum, e) => sum + (e.strength || 0), 0);

        // Combine with belief's intrinsic strength, giving more weight to explicit evidence
        const intrinsicStrength = belief.truth.expectation() * belief.budget.priority;
        return intrinsicStrength * 0.2 + totalStrength * 0.8;
    }
}
