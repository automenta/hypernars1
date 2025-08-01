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
    handle(hyperedge, newBelief) {
        const contradictionInfo = this._detectContradiction(hyperedge, newBelief);
        if (!contradictionInfo.isContradiction) {
            return null; // No contradiction, proceed normally
        }

        const resolution = this._resolveContradiction(hyperedge, newBelief, contradictionInfo);
        this.nar.notifyListeners(`contradiction-${resolution.action}`, {
            hyperedgeId: hyperedge.id,
            contradictionInfo,
            resolution,
        });

        // Record the outcome for the learning engine
        this.nar.learningEngine.recordExperience(
            { target: hyperedge.id, type: 'contradiction_resolution', resolution },
            { success: resolution.action !== 'reject' }
        );

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
    _detectContradiction(hyperedge, newBelief) {
        if (hyperedge.beliefs.length === 0) return { isContradiction: false };

        const strongestBelief = hyperedge.getStrongestBelief();
        const frequencyDiff = Math.abs(strongestBelief.truth.frequency - newBelief.truth.frequency);
        const confidenceDiff = Math.abs(strongestBelief.truth.confidence - newBelief.truth.confidence);

        const isContradiction = frequencyDiff > (this.nar.config.contradictionThreshold || 0.7) ||
                                (frequencyDiff > 0.2 && confidenceDiff > 0.3);

        if (!isContradiction) return { isContradiction: false };

        return {
            isContradiction: true,
            frequencyDiff,
            confidenceDiff,
            strongestBelief,
            context: this._determineContradictionContext(hyperedge, newBelief),
            timestamp: Date.now()
        };
    }

    /**
     * Resolve contradictions based on multiple factors.
     */
    _resolveContradiction(hyperedge, newBelief, contradictionInfo) {
        const { strongestBelief, context } = contradictionInfo;

        const currentStrength = strongestBelief.truth.confidence * strongestBelief.budget.priority;
        const newStrength = newBelief.truth.confidence * newBelief.budget.priority;

        if (newStrength > currentStrength * 1.2) {
            return { action: 'accept', reason: 'New evidence is significantly stronger' };
        } else if (currentStrength > newStrength * 1.2) {
            return { action: 'reject', reason: 'Existing evidence is significantly stronger' };
        } else if (context.type === 'temporal' && context.isNewer) {
            return { action: 'accept', reason: 'Newer information in temporal context' };
        } else if (context.type === 'spatial' || context.type === 'contextual') {
            const newConceptId = this._createContextSpecificConcept(hyperedge, context);
            return { action: 'split', reason: `Different contexts: ${context.type}`, context, newConceptId };
        } else {
            // Refined merge logic: evidence-weighted revision
            const mergedTruth = TruthValue.revise(strongestBelief.truth, newBelief.truth);
            const mergedBudget = strongestBelief.budget.merge(newBelief.budget).scale(0.8);
            return {
                action: 'merge',
                reason: 'Merging similar-strength beliefs',
                mergedTruth,
                adjustedBudget: mergedBudget
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

        // Get the nar instance from the hyperedge passed in, to be safe from `this` context issues.
        const nar = originalHyperedge.nar;
        const newArgs = [...originalHyperedge.args, `context:${contextId}`];
        const newHyperedge = new Hyperedge(nar, newId, originalHyperedge.type, newArgs);

        this.nar.state.hypergraph.set(newId, newHyperedge);
        this.nar.api.addToIndex(newHyperedge);

        this.nar.api.similarity(newId, originalHyperedge.id, {
            truth: this._calculateContextSimilarity(context),
            budget: Budget.full().scale(0.6)
        });

        return newId;
    }

    _determineContradictionContext(hyperedge, newBelief) {
        // Check for temporal context
        const strongestBelief = hyperedge.getStrongestBelief();
        if (newBelief.timestamp && strongestBelief.timestamp) {
            const timeDifference = newBelief.timestamp - strongestBelief.timestamp;
            // If the new belief is significantly newer (e.g., > 1 second)
            if (timeDifference > 1000) {
                return { type: 'temporal', isNewer: true, timeDifference };
            }
        }

        // Placeholder for other context detection (spatial, goal-related, etc.)
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
