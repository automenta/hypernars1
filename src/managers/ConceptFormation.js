import {PatternTracker} from '../support/PatternTracker.js';
import {TruthValue} from '../support/TruthValue.js';
import {Budget} from '../support/Budget.js';
import {id} from '../support/utils.js';

class ConceptFormation {
    constructor(nar) {
        this.nar = nar;
        this.patternTracker = new PatternTracker();
        this.conceptCache = new Map();
        this.abstractionLevels = new Map();
    }

    trackUsage(hyperedgeId, activation, budget) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return;


        this.patternTracker.recordPattern(
            hyperedgeId,
            this._getActiveNeighbors(hyperedgeId),
            activation,
            budget.priority
        );


        this._updateAbstractionMetrics(hyperedgeId, activation);
    }

    _getActiveNeighbors(hyperedgeId) {
        const activeNeighbors = new Set();
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);

        if (hyperedge) {
            hyperedge.args.forEach(arg => {
                if (this.nar.state.activations.has(arg) && this.nar.state.activations.get(arg) > 0.4) {
                    activeNeighbors.add(arg);
                }
            });
        }


        (this.nar.state.index.byArg.get(hyperedgeId) || new Set()).forEach(refId => {
            if (this.nar.state.activations.has(refId) && this.nar.state.activations.get(refId) > 0.4) {
                activeNeighbors.add(refId);
            }
        });

        return [...activeNeighbors];
    }

    discoverNewConcepts(minSupport = 0.6, minConfidence = 0.7) {
        const newConcepts = [];
        const frequentPatterns = this.patternTracker.getFrequentPatterns(minSupport);

        for (const pattern of frequentPatterns) {

            if (this.nar.state.hypergraph.has(pattern.signature)) continue;


            const {frequency, confidence} = this.patternTracker.getPatternTruth(pattern);

            if (confidence >= minConfidence) {

                const conceptId = this._createCompoundConcept(pattern.terms, {
                    frequency,
                    confidence,
                    priority: Math.min(frequency * confidence * 2, 1.0)
                });

                newConcepts.push({
                    id: conceptId,
                    terms: pattern.terms,
                    truth: {frequency, confidence},
                    support: pattern.support
                });


                this.conceptCache.set(pattern.signature, conceptId);
            }
        }

        return newConcepts;
    }

    _createCompoundConcept(terms, {frequency, confidence, priority}) {

        const sortedTerms = [...terms].sort();
        const conceptId = id('Concept', sortedTerms);


        this.nar.api.term(conceptId, {
            truth: new TruthValue(frequency, confidence, priority),
            budget: Budget.full().scale(priority * 0.8)
        });


        sortedTerms.forEach(term => {
            this.nar.api.inheritance(term, conceptId, {
                truth: new TruthValue(frequency, confidence * 0.9, priority * 0.7),
                budget: Budget.full().scale(priority * 0.6)
            });
        });

        return conceptId;
    }

    pruneRedundantConcepts() {
        const conceptsToPrune = [];


        this.nar.state.index.byType.get('Concept')?.forEach(conceptId => {
            const hyperedge = this.nar.state.hypergraph.get(conceptId);
            if (!hyperedge) return;

            const terms = hyperedge.args;
            this.nar.state.index.byType.get('Concept')?.forEach(otherId => {
                if (conceptId === otherId) return;

                const other = this.nar.state.hypergraph.get(otherId);
                if (!other) return;


                if (terms.every(term => other.args.includes(term))) {

                    const thisUsage = this._getConceptUsage(conceptId);
                    const otherUsage = this._getConceptUsage(otherId);

                    if (otherUsage > thisUsage * 1.5) {
                        conceptsToPrune.push({
                            redundant: conceptId,
                            replacement: otherId,
                            ratio: otherUsage / thisUsage
                        });
                    }
                }
            });
        });


        return conceptsToPrune;
    }

    _updateAbstractionMetrics(hyperedgeId, activation) {

    }

    _getConceptUsage(conceptId) {

        return 0;
    }
}

export {ConceptFormation};
