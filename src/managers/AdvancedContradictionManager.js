import { ContradictionManagerBase } from './ContradictionManagerBase.js';
import { Hyperedge } from '../support/Hyperedge.js';
import { id } from '../support/utils.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';

/**
 * A robust contradiction manager that resolves conflicts by either
 * merging beliefs or creating context-specific specializations.
 */
export class AdvancedContradictionManager extends ContradictionManagerBase {
    constructor(nar) {
        super(nar);
    }

    /**
     * This method is called by the belief revision process when a new belief is added.
     * It detects and resolves contradictions proactively.
     * @param {Hyperedge} hyperedge - The hyperedge being revised.
     * @param {TruthValue} newTruth - The new truth value being introduced.
     * @param {Budget} newBudget - The budget of the new belief.
     * @returns {object|null} An object indicating the resolution, or null if no contradiction.
     */
    handle(hyperedge, newTruth, newBudget) {
        const contradictionInfo = this._detectContradiction(hyperedge, newTruth);
        if (!contradictionInfo.isContradiction) {
            return null; // No contradiction, proceed normally
        }

        const resolution = this._resolveContradiction(hyperedge, newTruth, newBudget, contradictionInfo);
        this.nar.notifyListeners(`contradiction-${resolution.action}`, {
            hyperedgeId: hyperedge.id,
            contradictionInfo,
            resolution,
        });

        return resolution;
    }

    /**
     * No-op for the maintenance cycle, as this manager is proactive.
     */
    resolveContradictions() {
        // This manager acts proactively during revision, not reactively during maintenance.
    }

    /**
     * Detect potential contradictions in belief revision.
     */
    _detectContradiction(hyperedge, newTruth) {
        if (hyperedge.beliefs.length === 0) return { isContradiction: false };

        const strongestBelief = hyperedge.getStrongestBelief();
        const frequencyDiff = Math.abs(strongestBelief.truth.frequency - newTruth.frequency);
        const confidenceDiff = Math.abs(strongestBelief.truth.confidence - newTruth.confidence);

        const isContradiction = frequencyDiff > (this.nar.config.contradictionThreshold || 0.7) ||
                                (frequencyDiff > 0.2 && confidenceDiff > 0.3);

        if (!isContradiction) return { isContradiction: false };

        return {
            isContradiction: true,
            frequencyDiff,
            confidenceDiff,
            strongestBelief,
            context: this._determineContradictionContext(),
            timestamp: Date.now()
        };
    }

    /**
     * Resolve contradictions based on multiple factors.
     */
    _resolveContradiction(hyperedge, newTruth, newBudget, contradictionInfo) {
        const { strongestBelief, context } = contradictionInfo;

        const currentStrength = strongestBelief.truth.confidence * strongestBelief.budget.priority;
        const newStrength = newTruth.confidence * newBudget.priority;

        if (newStrength > currentStrength * 1.2) {
            return { action: 'accept', reason: 'New evidence is significantly stronger', adjustedBudget: newBudget };
        } else if (currentStrength > newStrength * 1.2) {
            return { action: 'reject', reason: 'Existing evidence is significantly stronger' };
        } else if (context.type === 'temporal' && context.isNewer) {
            return { action: 'accept', reason: 'Newer information in temporal context', adjustedBudget: newBudget.scale(0.9) };
        } else if (context.type === 'spatial' || context.type === 'contextual') {
            const newConceptId = this._createContextSpecificConcept(hyperedge, context);
            return { action: 'split', reason: `Different contexts: ${context.type}`, context, newConceptId };
        } else {
            const mergedTruth = TruthValue.revise(strongestBelief.truth, newTruth);
            return {
                action: 'merge',
                reason: 'Merging similar-strength beliefs',
                mergedTruth,
                adjustedBudget: strongestBelief.budget.merge(newBudget).scale(0.8)
            };
        }
    }

    /**
     * Create a context-specific version of a concept.
     */
    _createContextSpecificConcept(originalHyperedge, context) {
        const contextId = this._generateContextId(context);
        const newId = `${originalHyperedge.id}|context:${contextId}`;

        if (this.nar.state.hypergraph.has(newId)) {
            return newId; // Already exists
        }

        const newHyperedge = new Hyperedge(newId, originalHyperedge.type, [...originalHyperedge.args, `context:${contextId}`]);
        this.nar.state.hypergraph.set(newId, newHyperedge);
        this.nar.api.addToIndex(newHyperedge);

        this.nar.api.similarity(newId, originalHyperedge.id, {
            truth: this._calculateContextSimilarity(context),
            budget: Budget.full().scale(0.6)
        });

        return newId;
    }

    _determineContradictionContext() {
        // Placeholder for a more sophisticated context detection mechanism
        // Could check temporal manager, active goals, etc.
        return { type: 'general' };
    }

    _generateContextId(context) {
        // Simple context ID generation
        return context.type || 'general';
    }

    _calculateContextSimilarity(context) {
        // The more specific the context, the less similar it is to the general concept
        return new TruthValue(0.9, 0.9 - (context.specificity || 0) * 0.2);
    }
}
