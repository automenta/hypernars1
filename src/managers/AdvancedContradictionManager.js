import {ContradictionManagerBase} from './ContradictionManagerBase.js';
import {Hyperedge} from '../support/Hyperedge.js';
import {TruthValue} from '../support/TruthValue.js';
import {Budget} from '../support/Budget.js';

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

        const currentStrength = this._calculateEvidenceStrength(strongestBelief);
        const newStrength = this._calculateEvidenceStrength(newBelief);

        const STRENGTH_THRESHOLD = 1.5; // How much stronger one belief must be to dominate

        if (newStrength > currentStrength * STRENGTH_THRESHOLD) {
            return { action: 'accept', reason: 'New evidence is significantly stronger' };
        } else if (currentStrength > newStrength * STRENGTH_THRESHOLD) {
            return { action: 'reject', reason: 'Existing evidence is significantly stronger' };
        } else if (context.type === 'temporal' && context.isNewer) {
            return { action: 'accept', reason: 'Newer information in temporal context' };
        } else if (context.type === 'explicit' || context.type === 'semantic' || context.type === 'contextual') {
            const newConceptId = this._createContextSpecificConcept(hyperedge, context);
            return { action: 'split', reason: `Different contexts detected (${context.type})`, context, newConceptId };
        } else {
            // Default to merging if strengths are comparable and contexts are general
            const mergedTruth = TruthValue.revise(strongestBelief.truth, newBelief.truth);
            const mergedBudget = strongestBelief.budget.merge(newBelief.budget).scale(0.8);
            return {
                action: 'merge',
                reason: 'Merging similar-strength beliefs in a general context',
                mergedTruth,
                adjustedBudget: mergedBudget
            };
        }
    }

    /**
     * Calculates the strength of a belief based on its own budget and the quality of its premises.
     * @param {object} belief - The belief object to evaluate.
     * @returns {number} A numerical strength score.
     */
    _calculateEvidenceStrength(belief) {
        if (!belief) return 0;

        let strength = belief.budget.priority * belief.truth.confidence;

        if (belief.premises && belief.premises.length > 0) {
            let premiseStrengthSum = 0;
            let validPremises = 0;

            for (const premiseId of belief.premises) {
                const premiseEdge = this.nar.state.hypergraph.get(premiseId);
                if (premiseEdge) {
                    premiseStrengthSum += premiseEdge.getTruth().expectation();
                    validPremises++;
                }
            }

            if (validPremises > 0) {
                const avgPremiseStrength = premiseStrengthSum / validPremises;
                // Combine own strength with premise strength
                strength = strength * 0.6 + avgPremiseStrength * 0.4;
            }
        }

        // Boost for having a specific context
        if (belief.context) {
            strength *= 1.1;
        }

        return strength;
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

        const newArgs = [...originalHyperedge.args, `context:${contextId}`];
        const newHyperedge = new Hyperedge(this.nar, newId, originalHyperedge.type, newArgs);

        this.nar.state.hypergraph.set(newId, newHyperedge);
        this.nar.state.index.addToIndex(newHyperedge);

        this.nar.api.similarity(newId, originalHyperedge.id, {
            truth: this._calculateContextSimilarity(context),
            budget: Budget.full().scale(0.6)
        });

        return newId;
    }

    _determineContradictionContext(hyperedge, newBelief) {
        const strongestBelief = hyperedge.getStrongestBelief();

        // 1. Temporal Context (Newer information is often more relevant)
        if (newBelief.timestamp && strongestBelief.timestamp) {
            const timeDifference = newBelief.timestamp - strongestBelief.timestamp;
            if (timeDifference > 1000) { // 1 second threshold
                return { type: 'temporal', isNewer: true, timeDifference, specificity: 0.5 };
            }
        }

        // 2. Explicit Context Property
        if (newBelief.context && strongestBelief.context && newBelief.context !== strongestBelief.context) {
            return { type: 'explicit', context1: strongestBelief.context, context2: newBelief.context, specificity: 0.9 };
        }

        // 3. Premise Discrepancy Context
        const premiseDifference = this._comparePremiseSets(strongestBelief.premises, newBelief.premises);
        if (premiseDifference.hasUniqueTo1 && premiseDifference.hasUniqueTo2) {
            return { type: 'semantic', reason: 'Derived from different premises', specificity: 0.8, difference: premiseDifference };
        }

        // 4. Source Context (if available)
        if (newBelief.derivedBy && strongestBelief.derivedBy && newBelief.derivedBy !== strongestBelief.derivedBy) {
            return { type: 'source', source1: strongestBelief.derivedBy, source2: newBelief.derivedBy, specificity: 0.7 };
        }

        return { type: 'general', specificity: 0.1 };
    }

    _comparePremiseSets(premises1, premises2) {
        const set1 = new Set(premises1);
        const set2 = new Set(premises2);
        const result = {
            hasUniqueTo1: false,
            hasUniqueTo2: false,
            intersection: new Set(),
        };

        for (const item of set1) {
            if (set2.has(item)) {
                result.intersection.add(item);
            } else {
                result.hasUniqueTo1 = true;
            }
        }
        for (const item of set2) {
            if (!set1.has(item)) {
                result.hasUniqueTo2 = true;
            }
        }
        return result;
    }

    _generateContextId(context) {
        if (context.type === 'explicit') return context.context2; // Use the new context as the ID
        if (context.type === 'semantic') return 'derived_differently';
        return context.type || 'general';
    }

    _calculateContextSimilarity(context) {
        // The more specific the context, the less similar it is to the general concept
        return new TruthValue(0.9, 0.9 - (context.specificity || 0) * 0.2);
    }
}
