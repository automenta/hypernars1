import { AdvancedContradictionManager } from './AdvancedContradictionManager.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { Hyperedge } from '../support/Hyperedge.js';

export class EnhancedContradictionManager extends AdvancedContradictionManager {
    constructor(nar) {
        super(nar);
        this.nar.config.contradictionThreshold = this.nar.config.contradictionThreshold || 0.6;
    }

    /**
     * Advanced belief revision with explicit contradiction handling before committing a change.
     * From `doc/enhance.b.md`.
     */
    reviseWithContradictionHandling(hyperedge, newBelief) {
        const contradictionInfo = this._detectContradiction(hyperedge, newBelief.truth);

        if (contradictionInfo.isContradiction) {
            this.nar.emit('contradiction-detected', { hyperedgeId: hyperedge.id, newBelief });
            const resolution = this._resolveContradiction(hyperedge, newBelief, contradictionInfo);

            switch (resolution.action) {
                case 'accept':
                    hyperedge.revise(resolution.newBelief);
                    this.nar.emit('contradiction-resolved', {
                        hyperedgeId: hyperedge.id,
                        resolution,
                        action: 'accept'
                    });
                    return { updated: true, outcome: 'accepted' };

                case 'merge':
                    // For merge, we replace all existing beliefs with the new merged one
                    hyperedge.beliefs = [resolution.newBelief];
                    this.nar.emit('contradiction-resolved', {
                        hyperedgeId: hyperedge.id,
                        resolution,
                        action: 'merge'
                    });
                    return { updated: true, outcome: 'merged' };

                case 'reject':
                    this.nar.emit('contradiction-resolved', {
                        hyperedgeId: hyperedge.id,
                        resolution,
                        action: 'reject'
                    });
                    return { updated: false, outcome: 'rejected' };

                case 'split':
                    this._createContextSpecificConcept(hyperedge.id, resolution.context);
                    // Add the new belief to the newly created context-specific concept
                    const newConceptId = `${hyperedge.id}|context:${resolution.context.id}`;
                    const newConcept = this.nar.state.hypergraph.get(newConceptId);
                    if (newConcept) {
                        newConcept.revise(newBelief);
                    }
                    this.nar.emit('contradiction-resolved', {
                        hyperedgeId: hyperedge.id,
                        resolution,
                        action: 'split'
                    });
                    return { updated: true, outcome: 'split' };

                default:
                    return { updated: false, outcome: 'unresolved' };
            }
        }

        // No contradiction, proceed with normal revision
        hyperedge.revise(newBelief);
        return { updated: true, outcome: 'revised' };
    }

    /**
     * Detects potential contradictions based on `doc/enhance.b.md` logic.
     * Overrides the simple check in the parent class.
     */
    _detectContradiction(hyperedge, newTruth) {
        if (hyperedge.beliefs.length === 0) return { isContradiction: false };

        const strongestBelief = hyperedge.getStrongestBelief();
        const freqDiff = Math.abs(strongestBelief.truth.frequency - newTruth.frequency);

        const isContradiction = freqDiff > this.nar.config.contradictionThreshold;

        if (!isContradiction) return { isContradiction: false };

        // Determine the context of the contradiction
        const context = this._determineContradictionContext(strongestBelief, { truth: newTruth });

        return {
            isContradiction: true,
            frequencyDiff: freqDiff,
            strongestBelief,
            context,
            timestamp: Date.now()
        };
    }

    /**
     * Determines the context of a contradiction. Placeholder for more advanced logic.
     */
    _determineContradictionContext(belief1, belief2) {
        // This could be a very complex function in a real system, analyzing temporal, spatial, or source differences.
        if (belief1.timestamp && belief2.timestamp && Math.abs(belief1.timestamp - belief2.timestamp) > 10000) { // 10s difference
            return { type: 'temporal', isNewer: belief2.timestamp > belief1.timestamp, id: 'temporal_diff' };
        }
        // A more advanced implementation would check for source, location, etc.
        return { type: 'default', id: 'default_context' };
    }

    /**
     * Resolves contradictions based on multiple factors, from `doc/enhance.b.md`.
     */
    _resolveContradiction(hyperedge, newBelief, contradictionInfo) {
        const { strongestBelief, context } = contradictionInfo;
        const newTruth = newBelief.truth;
        const newBudget = newBelief.budget;

        const currentStrength = strongestBelief.truth.confidence * strongestBelief.budget.priority;
        const newStrength = newTruth.confidence * newBudget.priority;

        // Strategy 1: Strength-based resolution
        if (newStrength > currentStrength * 1.5) {
            return { action: 'accept', reason: 'New evidence is significantly stronger', newBelief };
        }
        if (currentStrength > newStrength * 1.5) {
            return { action: 'reject', reason: 'Existing evidence is significantly stronger' };
        }

        // Strategy 2: Context-based resolution
        if (context.type === 'temporal' && context.isNewer) {
            return { action: 'accept', reason: 'Newer information in temporal context', newBelief };
        }
        if (context.type !== 'default') {
            return { action: 'split', reason: `Different contexts: ${context.type}`, context };
        }

        // Strategy 3: Default merge
        const mergedTruth = TruthValue.revise(strongestBelief.truth, newTruth);
        mergedTruth.confidence *= 0.8; // Penalize confidence due to conflict
        const mergedBudget = strongestBelief.budget.merge(newBudget).scale(0.8);
        const mergedBelief = { ...newBelief, truth: mergedTruth, budget: mergedBudget };

        return {
            action: 'merge',
            reason: 'Merging similar-strength beliefs',
            newBelief: mergedBelief
        };
    }

    /**
     * Creates a context-specific version of a concept.
     * From `doc/enhance.b.md`.
     */
    _createContextSpecificConcept(originalId, context) {
        const contextId = context.id || 'unknown_context';
        const newId = `${originalId}|context:${contextId}`;

        if (this.nar.state.hypergraph.has(newId)) {
            return newId; // Already exists
        }

        const original = this.nar.state.hypergraph.get(originalId);
        if (!original) return null;

        const newHyperedge = new Hyperedge(this.nar, newId, original.type, [...original.args, `context:${contextId}`]);
        this.nar.state.hypergraph.set(newId, newHyperedge);
        this.nar.state.index.addToIndex(newHyperedge);

        // Link to original concept
        this.nar.api.similarity(newId, originalId, {
            truth: new TruthValue(0.7, 0.9), // Contexts are similar but distinct
            budget: Budget.full().scale(0.6)
        });

        this.nar.emit('concept-split', {
            originalId: originalId,
            newConceptId: newId,
            context: context
        });

        return newId;
    }
}
