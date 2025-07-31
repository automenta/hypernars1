import { Hyperedge } from '../support/Hyperedge.js';
import { id } from '../support/utils.js';

export class ContradictionManager {
    constructor(nar) {
        this.nar = nar;
        this.contradictions = new Map(); // Maps hyperedge ID to contradiction records
        this.resolutionStrategies = {
            'evidence-weighted': this._evidenceWeightedResolution.bind(this),
            'recency-biased': this._recencyBiasedResolution.bind(this),
            'source-reliability': this._sourceReliabilityResolution.bind(this),
            'contextual-split': this._contextualSplitResolution.bind(this),
            'default': this._defaultResolution.bind(this)
        };
    }

    detectContradictions(hyperedgeId) {
        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!hyperedge || hyperedge.beliefs.length < 2) return false;

        const strongestBelief = hyperedge.getStrongestBelief();
        if (!strongestBelief) return false;

        // Check against other beliefs in the same hyperedge
        for (const belief of hyperedge.beliefs) {
            if (belief === strongestBelief) continue;

            const freqDiff = Math.abs(strongestBelief.truth.frequency - belief.truth.frequency);

            const isContradiction = freqDiff > (this.nar.config.contradictionThreshold || 0.7) &&
                                    (strongestBelief.truth.confidence > 0.5 && belief.truth.confidence > 0.5);

            if (isContradiction) {
                const contradictionId = id('Contradiction', [hyperedgeId, strongestBelief.truth.toString(), belief.truth.toString()]);
                if (!this.contradictions.has(contradictionId)) {
                    const contradiction = {
                        id: contradictionId,
                        hyperedgeId: hyperedgeId,
                        beliefs: [strongestBelief, belief],
                        severity: freqDiff,
                        resolved: false,
                        timestamp: Date.now()
                    };
                    this.contradictions.set(contradictionId, contradiction);
                    this.nar.notifyListeners('contradiction-detected', contradiction);
                }
                return true;
            }
        }
        return false;
    }

    resolveContradictions() {
        this.contradictions.forEach((contradiction, id) => {
            if (!contradiction.resolved) {
                const strategy = this._selectResolutionStrategy(contradiction);
                const resolution = this.resolutionStrategies[strategy](contradiction);

                if (resolution) {
                    contradiction.resolved = true;
                    contradiction.resolutionStrategy = strategy;

                    if (resolution.action === 'revise') {
                        contradiction.resolvedValue = resolution.truth;
                        this.nar.revise(contradiction.hyperedgeId, resolution.truth, resolution.budget);
                    } else if (resolution.action === 'split') {
                        contradiction.resolvedValue = resolution.newConceptId;
                    }

                    this.nar.notifyListeners('contradiction-resolved', {
                        id: contradiction.id,
                        hyperedgeId: contradiction.hyperedgeId,
                        strategy,
                        resolution
                    });
                }
            }
        });
    }

    _selectResolutionStrategy(contradiction) {
        const { severity } = contradiction;
        const hyperedge = this.nar.hypergraph.get(contradiction.hyperedgeId);

        if (!hyperedge) return 'default';

        if (severity > 0.8) return 'evidence-weighted';

        const beliefContexts = new Set(hyperedge.beliefs.map(b => b.context || 'general'));
        if (beliefContexts.size > 1) return 'contextual-split';

        const sources = new Set(hyperedge.beliefs.map(b => this._getSource(b)));
        if (sources.size > 1 && this.nar.metaReasoner?.getStrategyEffectiveness) return 'source-reliability';

        if (this.nar.metaReasoner?.currentFocus === 'temporal-reasoning') return 'recency-biased';

        return 'default';
    }

    _evidenceWeightedResolution(contradiction) {
        let totalWeight = 0;
        let weightedFrequency = 0;
        let weightedConfidence = 0;
        let totalPriority = 0;

        contradiction.beliefs.forEach(belief => {
            const weight = this._calculateEvidenceStrength(belief);
            weightedFrequency += belief.truth.frequency * weight;
            weightedConfidence += belief.truth.confidence * weight;
            totalPriority += belief.budget.priority;
            totalWeight += weight;
        });

        if (totalWeight > 0) {
            const newTruth = new this.nar.truth(
                weightedFrequency / totalWeight,
                weightedConfidence / totalWeight
            );
            const newBudget = this.nar.budget(
                totalPriority / contradiction.beliefs.length,
                0.8,
                Math.min(1, totalWeight / contradiction.beliefs.length)
            );
            return { action: 'revise', truth: newTruth, budget: newBudget };
        }
        return null;
    }

    _recencyBiasedResolution(contradiction) {
        const mostRecent = [...contradiction.beliefs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
        return { action: 'revise', truth: mostRecent.truth, budget: mostRecent.budget.scale(0.95) };
    }

    _sourceReliabilityResolution(contradiction) {
        const sourceWeights = {};
        contradiction.beliefs.forEach(belief => {
            const source = this._getSource(belief);
            sourceWeights[source] = this.nar.metaReasoner?.getStrategyEffectiveness(`source:${source}`) || 0.5;
        });

        return this._evidenceWeightedResolution(contradiction, sourceWeights);
    }

    _contextualSplitResolution(contradiction) {
        const [belief1, belief2] = contradiction.beliefs;
        const newConceptId = this._createContextualSpecialization(contradiction.hyperedgeId, belief1, belief2);
        return { action: 'split', newConceptId };
    }

    _defaultResolution(contradiction) {
        const strongest = [...contradiction.beliefs].sort((a, b) => this._calculateEvidenceStrength(b) - this._calculateEvidenceStrength(a))[0];
        return { action: 'revise', truth: strongest.truth, budget: strongest.budget };
    }

    _calculateEvidenceStrength(belief, sourceWeights = {}) {
        const source = this._getSource(belief);
        const sourceReliability = sourceWeights[source] || this.nar.metaReasoner?.getStrategyEffectiveness(`source:${source}`) || 0.5;
        const recency = belief.timestamp ? Math.exp(-(Date.now() - belief.timestamp) / (1000 * 60 * 5)) : 0.8;

        return belief.budget.priority * belief.truth.confidence * sourceReliability * recency;
    }

    _getSource(belief) {
        return belief.source || 'internal';
    }

    _createContextualSpecialization(originalId, belief1, belief2) {
        const original = this.nar.hypergraph.get(originalId);
        if (!original) return null;

        const context = belief2.context || `context_for_${originalId.replace(/[(),]/g, '_')}`;
        const newId = `${originalId}|${context}`;

        if (this.nar.hypergraph.has(newId)) return newId;

        const newHyperedge = new Hyperedge(newId, original.type, [...original.args, context]);

        newHyperedge.revise(belief2.truth, belief2.budget, this.nar.config.beliefCapacity);
        this.nar.hypergraph.set(newId, newHyperedge);
        this.nar.addToIndex(newHyperedge);

        const hyperedge = this.nar.hypergraph.get(originalId);
        hyperedge.beliefs = hyperedge.beliefs.filter(b => b !== belief2);

        this.nar.similarity(newId, originalId, {
            truth: this.nar.truth(0.8, 0.9),
            budget: this.nar.budget(0.8, 0.8, 0.8)
        });

        return newId;
    }
}
