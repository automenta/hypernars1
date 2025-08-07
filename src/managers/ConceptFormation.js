import { PatternTracker } from '../support/PatternTracker.js';
import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { id } from '../support/utils.js';

/**
 * # Adaptive Concept Formation System
 *
 * ## Core Philosophy
 * NARHyper requires explicit definition of concepts rather than discovering them organically from patterns.
 *
 * ## Key Enhancements
 *
 * ### 2. Adaptive Concept Formation System
 *
 * **Problem**: NARHyper requires explicit definition of concepts rather than discovering them organically from patterns.
 *
 * **Solution**: Implement an unsupervised concept formation mechanism that:
 *
 * - Detects frequently co-occurring patterns in the hypergraph
 * - Creates new compound concepts with appropriate truth values
 * - Determines optimal abstraction levels based on usage patterns
 * - Prunes redundant or low-value concepts
 */
class ConceptFormation {
    constructor(nar) {
        this.nar = nar;
        this.patternTracker = new PatternTracker();
        this.conceptCache = new Map();
        this.abstractionLevels = new Map(); // Tracks optimal abstraction for each context
    }

    trackUsage(hyperedgeId, activation, budget) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return;

        // Track patterns of co-activation
        this.patternTracker.recordPattern(
            hyperedgeId,
            this._getActiveNeighbors(hyperedgeId),
            activation,
            budget.priority
        );

        // Update abstraction level metrics
        this._updateAbstractionMetrics(hyperedgeId, activation);
    }

    _getActiveNeighbors(hyperedgeId) {
        const activeNeighbors = new Set();
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);

        if (hyperedge) {
            hyperedge.args.forEach((arg) => {
                if (
                    this.nar.state.activations.has(arg) &&
                    this.nar.state.activations.get(arg) > 0.4
                ) {
                    activeNeighbors.add(arg);
                }
            });
        }

        // Also check incoming references
        (this.nar.state.index.byArg.get(hyperedgeId) || new Set()).forEach(
            (refId) => {
                if (
                    this.nar.state.activations.has(refId) &&
                    this.nar.state.activations.get(refId) > 0.4
                ) {
                    activeNeighbors.add(refId);
                }
            }
        );

        return [...activeNeighbors];
    }

    discoverNewConcepts(minSupport = 0.6, minConfidence = 0.7) {
        const newConcepts = [];
        const frequentPatterns =
            this.patternTracker.getFrequentPatterns(minSupport);

        for (const pattern of frequentPatterns) {
            // Skip if this pattern is already a known concept
            if (this.nar.state.hypergraph.has(pattern.signature)) continue;

            // Calculate truth value based on pattern consistency
            const { frequency, confidence } =
                this.patternTracker.getPatternTruth(pattern);

            if (confidence >= minConfidence) {
                // Create the new concept
                const conceptId = this._createCompoundConcept(pattern.terms, {
                    frequency,
                    confidence,
                    priority: Math.min(frequency * confidence * 2, 1.0),
                });

                newConcepts.push({
                    id: conceptId,
                    terms: pattern.terms,
                    truth: { frequency, confidence },
                    support: pattern.support,
                });

                // Cache for future reference
                this.conceptCache.set(pattern.signature, conceptId);
            }
        }

        return newConcepts;
    }

    _createCompoundConcept(terms, { frequency, confidence, priority }) {
        // Sort terms to create canonical ordering
        const sortedTerms = [...terms].sort();
        const conceptId = id('Concept', sortedTerms);

        // Create the concept node
        this.nar.api.term(conceptId, {
            truth: new TruthValue(frequency, confidence, priority),
            budget: Budget.full().scale(priority * 0.8),
        });

        // Create inheritance links to component terms
        sortedTerms.forEach((term) => {
            this.nar.api.inheritance(term, conceptId, {
                truth: new TruthValue(
                    frequency,
                    confidence * 0.9,
                    priority * 0.7
                ),
                budget: Budget.full().scale(priority * 0.6),
            });
        });

        return conceptId;
    }

    pruneRedundantConcepts() {
        const conceptsToPrune = [];

        // Find concepts that are subsets of other more general concepts
        this.nar.state.index.byType.get('Concept')?.forEach((conceptId) => {
            const hyperedge = this.nar.state.hypergraph.get(conceptId);
            if (!hyperedge) return;

            const terms = hyperedge.args;
            this.nar.state.index.byType.get('Concept')?.forEach((otherId) => {
                if (conceptId === otherId) return;

                const other = this.nar.state.hypergraph.get(otherId);
                if (!other) return;

                // Check if this concept is a subset of the other
                if (terms.every((term) => other.args.includes(term))) {
                    // Compare specificity and usage
                    const thisUsage = this._getConceptUsage(conceptId);
                    const otherUsage = this._getConceptUsage(otherId);

                    if (otherUsage > thisUsage * 1.5) {
                        // Other concept is significantly more useful
                        conceptsToPrune.push({
                            redundant: conceptId,
                            replacement: otherId,
                            ratio: otherUsage / thisUsage,
                        });
                    }
                }
            });
        });

        // Execute pruning (would need careful handling of dependencies)
        return conceptsToPrune;
    }

    _updateAbstractionMetrics(hyperedgeId, activation) {
        // Placeholder
    }

    _getConceptUsage(conceptId) {
        // Placeholder
        return 0;
    }
}

export { ConceptFormation };
