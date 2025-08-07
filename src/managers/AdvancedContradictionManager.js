import {ContradictionManagerBase} from './ContradictionManagerBase.js';
import {TruthValue} from '../support/TruthValue.js';
import {Hyperedge} from '../support/Hyperedge.js';
import {Budget} from '../support/Budget.js';
import {id} from '../support/utils.js';

const defaultConfig = {
    circuitBreakerThreshold: 5,
    circuitBreakerDuration: 30000,
    dominantEvidenceFactor: 1.5,
    sourceReliabilityDifferenceThreshold: 0.3,
    evidenceWeightingThreshold: 2,
    weakenConfidenceFactor: 0.5,
    weakenPriorityFactor: 0.8,
    weakenDoubtFactor: 0.5,
    mergeConfidencePenalty: 0.8,
    mergeDoubtPenalty: 0.7,
    mergeBudgetPenalty: 0.8,
    specializationConfidenceBoost: 1.1,
    specializationDoubtReduction: 0.5,
    specializationBudgetBoost: 1.1,
    similarityConfidence: 0.9,
    similarityBudgetScale: 0.5,
    strongContradictionThreshold: 0.7,
    strongContradictionConfidence: 0.6,
    moderateContradictionFreqDiff: 0.3,
    moderateContradictionConfDiff: 0.4,
    moderateContradictionAvgConfidence: 0.5,
    interEdgeBudgetScale: 0.1,
    defaultSourceReliability: 0.5,
    sourceReliabilityBudgetScale: 0.85,
    evidenceWeightingDurability: 0.5,
    intrinsicStrengthWeight: 0.3,
    evidenceStrengthWeight: 0.5,
    sourceReliabilityWeight: 0.2,
    recencyWeight: 0.1,
    evidenceDecayHours: 3600,
    recencyDecayHours: 7200,
};

export class AdvancedContradictionManager extends ContradictionManagerBase {
    constructor(nar) {
        super(nar);
        this.config = {...defaultConfig, ...nar.config.advancedContradictionManager};
        this.contradictions = new Map();
        this.resolutionStrategies = {
            'dominant_evidence': this._resolveByDominantEvidence.bind(this),
            'merge': this._resolveByMerging.bind(this),
            'specialize': this._resolveBySpecialization.bind(this),
            'evidence-weighted': this._evidenceWeightedResolution.bind(this),
            'recency-biased': this._recencyBiasedResolution.bind(this),
            'source-reliability': this._sourceReliabilityResolution.bind(this),
            'default': this._defaultResolution.bind(this)
        };

        this.circuitBreaker = {
            failures: 0,
            lastFailure: 0,
            openUntil: 0,
            threshold: this.config.circuitBreakerThreshold,
            duration: this.config.circuitBreakerDuration,
        };
    }

    contradict(belief1Id, belief2Id, {strength = 0.7, context = null} = {}) {
        const belief1 = this.nar.state.hypergraph.get(belief1Id);
        const belief2 = this.nar.state.hypergraph.get(belief2Id);

        if (!belief1 || !belief2) {
            this.nar.emit('log', {
                message: 'Cannot create contradiction: one or both beliefs not found.',
                level: 'warn'
            });
            return null;
        }

        const hyperedgeId = belief1Id;
        const contradictionId = this.nar.api.id('Contradiction', [belief1Id, belief2Id, context]);

        const contradictionData = {
            id: contradictionId,
            belief1: belief1.getStrongestBelief(),
            belief2: belief2.getStrongestBelief(),
            strength,
            context,
            resolved: false,
            timestamp: Date.now()
        };

        this.contradictions.set(hyperedgeId, {
            timestamp: Date.now(),
            pairs: [contradictionData],
            resolved: false
        });

        this.nar.emit('contradiction-detected', {hyperedgeId, contradictions: [contradictionData]});

        this.resolveContradictions();

        return contradictionId;
    }

    detectContradiction(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || hyperedge.beliefs.length < 2) {
            if (this.contradictions.has(hyperedgeId)) {
                this.contradictions.delete(hyperedgeId);
                this.nar.emit('contradiction-resolved', {hyperedgeId, reason: 'belief_pruned'});
            }
            return false;
        }

        const contradictoryPairs = [];
        for (let i = 0; i < hyperedge.beliefs.length; i++) {
            for (let j = i + 1; j < hyperedge.beliefs.length; j++) {
                if (this._areContradictory(hyperedge.beliefs[i].truth, hyperedge.beliefs[j].truth)) {
                    contradictoryPairs.push({
                        belief1: hyperedge.beliefs[i],
                        belief2: hyperedge.beliefs[j],
                        severity: this._contradictionSeverity(hyperedge.beliefs[i].truth, hyperedge.beliefs[j].truth)
                    });
                }
            }
        }

        if (contradictoryPairs.length > 0) {
            this.contradictions.set(hyperedgeId, {
                timestamp: Date.now(),
                pairs: contradictoryPairs,
                resolved: false,
                resolutionStrategy: null,
                resolvedValue: null
            });

            this.nar.emit('contradiction-detected', {
                hyperedgeId,
                contradictions: contradictoryPairs
            });
            return true;
        }

        return false;
    }

    detectAndResolveInterEdgeContradictions(hyperedge) {
        if (hyperedge.type !== 'Inheritance') {
            return;
        }

        const subjectId = hyperedge.args[0];
        const predicateId = hyperedge.args[1];

        for (const [otherHyperedgeId, otherHyperedge] of this.nar.state.hypergraph.entries()) {
            if (otherHyperedge.type === 'Inheritance' && otherHyperedge.id !== hyperedge.id && otherHyperedge.args[0] === subjectId) {
                const otherPredicateId = otherHyperedge.args[1];

                if (predicateId === `Negation(${otherPredicateId})` || otherPredicateId === `Negation(${predicateId})`) {
                    const belief1 = hyperedge.getStrongestBelief();
                    const belief2 = otherHyperedge.getStrongestBelief();

                    if (belief1 && belief2) {
                        // Use the new, correct method for resolving contradictions
                        const revisedTruth = TruthValue.resolveContradiction(belief1.truth, belief2.truth);
                        const revisedBudget = belief1.budget.merge(belief2.budget).scale(0.9); // Scale budget down slightly after any contradiction

                        hyperedge.revise({
                            truth: revisedTruth,
                            budget: revisedBudget,
                            premises: [belief1.id, belief2.id],
                            derivedBy: 'inter_edge_contradiction_resolution'
                        });

                        // Weaken the other hyperedge's belief
                        otherHyperedge.revise({
                            truth: belief2.truth, // Keep its truth the same
                            budget: belief2.budget.scale(this.config.interEdgeBudgetScale), // But significantly weaken its budget
                            premises: belief2.premises,
                            derivedBy: 'inter_edge_contradiction_weakening'
                        });
                    }
                }
            }
        }
    }

    addEvidence(hyperedgeId, beliefId, evidence) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return;

        if (!hyperedge.evidence) {
            hyperedge.evidence = [];
        }
        hyperedge.evidence.push({
            beliefId,
            ...evidence,
            timestamp: Date.now()
        });
        this.nar.emit('evidence-added', {hyperedgeId, beliefId});
    }

    resolveContradictions() {
        const now = Date.now();
        if (now < this.circuitBreaker.openUntil) {
            this.nar.emit('log', {message: 'Contradiction resolution circuit breaker is open.', level: 'warn'});
            return;
        }

        const contradictionsToResolve = Array.from(this.contradictions.keys());
        let failuresThisRun = 0;

        for (const hyperedgeId of contradictionsToResolve) {
            const contradictionData = this.contradictions.get(hyperedgeId);
            if (contradictionData && !contradictionData.resolved) {
                const strategyName = this._selectResolutionStrategy(hyperedgeId, contradictionData);
                const resolution = this.manualResolve(hyperedgeId, strategyName);
                if (!resolution) {
                    failuresThisRun++;
                }
            }
        }

        if (failuresThisRun > 0) {
            this.circuitBreaker.failures += failuresThisRun;
            this.circuitBreaker.lastFailure = now;
            if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
                this.circuitBreaker.openUntil = now + this.circuitBreaker.duration;
                this.nar.emit('log', {
                    message: `Contradiction resolution circuit breaker tripped for ${this.circuitBreaker.duration}ms.`,
                    level: 'error'
                });
            }
        } else {
            this.circuitBreaker.failures = 0;
        }
    }

    manualResolve(hyperedgeId, strategyName, customParams = {}) {
        const contradiction = this.contradictions.get(hyperedgeId);
        if (!contradiction) return null;
        if (contradiction.resolved) return contradiction.resolvedValue;

        const strategy = this.resolutionStrategies[strategyName] || this.resolutionStrategies['default'];
        const resolution = strategy(hyperedgeId, contradiction, customParams);
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);

        let outcome = 'failure';
        if (resolution && hyperedge) {
            contradiction.resolved = true;
            contradiction.resolutionStrategy = strategyName;
            contradiction.resolvedValue = resolution;

            if (resolution.updatedBeliefs) {
                hyperedge.beliefs = resolution.updatedBeliefs;
            } else if (resolution.primaryBelief) {
                hyperedge.beliefs = [resolution.primaryBelief];
            } else if (resolution.newBelief) {
                hyperedge.beliefs = [resolution.newBelief];
            }

            this.nar.emit('contradiction-resolved', {
                hyperedgeId,
                strategy: strategyName,
                resolution
            });
            outcome = 'success';
        }

        if (this.nar.learningEngine) {
            this.nar.learningEngine.recordExperience({
                operation: 'contradiction_resolution',
                strategy: strategyName,
                hyperedgeId: hyperedgeId,
            }, {success: outcome === 'success'});
        }

        return resolution || null;
    }

    _resolveByDominantEvidence(hyperedgeId, contradiction) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const beliefsWithEvidence = hyperedge.beliefs.map(belief => ({
            belief,
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const strongest = beliefsWithEvidence[0];
        const otherBeliefs = beliefsWithEvidence.slice(1);

        const modifiedBeliefs = otherBeliefs.map(item => {
            const modifiedBelief = {...item.belief};
            modifiedBelief.truth = new TruthValue(
                modifiedBelief.truth.frequency,
                modifiedBelief.truth.confidence * this.config.weakenConfidenceFactor,
                modifiedBelief.truth.priority * this.config.weakenPriorityFactor,
                Math.min(1.0, (modifiedBelief.truth.doubt || 0) + this.config.weakenDoubtFactor)
            );
            return modifiedBelief;
        });

        const newBeliefs = [strongest.belief, ...modifiedBeliefs];

        return {reason: 'dominant_evidence', primaryBelief: strongest.belief, updatedBeliefs: newBeliefs};
    }

    _resolveByMerging(hyperedgeId, contradiction) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const beliefsWithEvidence = hyperedge.beliefs.map(belief => ({
            belief,
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const belief1 = beliefsWithEvidence[0];
        const belief2 = beliefsWithEvidence[1];

        if (!belief1 || !belief2) return null;

        const mergedTruth = TruthValue.revise(belief1.belief.truth, belief2.belief.truth);
        mergedTruth.doubt = Math.min(1.0, (mergedTruth.doubt + this.config.mergeDoubtPenalty) * 0.7);


        const mergedBudget = belief1.belief.budget.merge(belief2.belief.budget).scale(this.config.mergeBudgetPenalty);

        const newBelief = {...belief1.belief, truth: mergedTruth, budget: mergedBudget, timestamp: Date.now()};

        if (hyperedge) {
            hyperedge.beliefs = [newBelief];
        }

        return {reason: 'merged', newBelief};
    }

    _resolveBySpecialization(hyperedgeId, contradiction) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const beliefsWithEvidence = hyperedge.beliefs.map((belief, index) => ({
            belief,
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const conflictingBeliefData = beliefsWithEvidence[1];
        if (!conflictingBeliefData) return null;

        const conflictingBelief = conflictingBeliefData.belief;
        const context = this._getBeliefContext(hyperedge, conflictingBelief) || 'alternative_context';

        const specializationResult = this._createContextualSpecialization(hyperedge, conflictingBelief, context);
        hyperedge.beliefs = hyperedge.beliefs.filter(b => b !== conflictingBelief);

        return specializationResult;
    }

    _evidenceWeightedResolution(hyperedgeId, contradiction) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        let totalWeight = 0;
        let weightedFrequency = 0;
        let weightedConfidence = 0;

        hyperedge.beliefs.forEach(belief => {
            const weight = this._calculateEvidenceStrength(hyperedgeId, belief);
            weightedFrequency += belief.truth.frequency * weight;
            weightedConfidence += belief.truth.confidence * weight;
            totalWeight += weight;
        });

        if (totalWeight > 0) {
            const newTruth = new TruthValue(
                weightedFrequency / totalWeight,
                weightedConfidence / totalWeight
            );
            const newBudget = new Budget({
                priority: Math.min(1.0, totalWeight / hyperedge.beliefs.length),
                durability: this.config.evidenceWeightingDurability,
                quality: weightedConfidence / totalWeight
            });
            hyperedge.beliefs = [{truth: newTruth, budget: newBudget, timestamp: Date.now()}];
            return {reason: 'evidence-weighted', newTruth};
        }
        return null;
    }

    _recencyBiasedResolution(hyperedgeId, contradiction) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const mostRecent = [...hyperedge.beliefs].sort((a, b) => b.timestamp - a.timestamp)[0];
        hyperedge.beliefs = [mostRecent];
        return {reason: 'recency-biased', primaryBelief: mostRecent};
    }

    _sourceReliabilityResolution(hyperedgeId, contradiction, {sourceWeights = {}} = {}) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        let totalWeight = 0;
        let weightedFrequency = 0;
        let weightedConfidence = 0;

        hyperedge.beliefs.forEach(belief => {
            const source = this._getSource(belief);
            const sourceReliability = sourceWeights[source] || this.nar.state.sourceReliability?.get(source) || this.config.defaultSourceReliability;
            const weight = sourceReliability * belief.budget.priority;

            weightedFrequency += belief.truth.frequency * weight;
            weightedConfidence += belief.truth.confidence * weight;
            totalWeight += weight;
        });

        if (totalWeight > 0) {
            const newTruth = new TruthValue(weightedFrequency / totalWeight, weightedConfidence / totalWeight);
            hyperedge.beliefs = [{
                truth: newTruth,
                budget: Budget.full().scale(this.config.sourceReliabilityBudgetScale),
                timestamp: Date.now()
            }];
            return {reason: 'source-reliability', newTruth};
        }
        return null;
    }

    _defaultResolution(hyperedgeId) {
        return this._resolveByDominantEvidence(hyperedgeId);
    }

    _selectResolutionStrategy(hyperedgeId, contradiction) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const beliefsWithEvidence = hyperedge.beliefs.map((belief, index) => ({
            belief,
            index,
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const strongest = beliefsWithEvidence[0];
        const nextStrongest = beliefsWithEvidence[1];

        if (this._hasDominantEvidence(strongest, nextStrongest)) {
            return 'dominant_evidence';
        }
        if (this._hasDistinctContexts(hyperedge, strongest, nextStrongest)) {
            return 'specialize';
        }
        if (this._hasReliableSourceDifference(strongest, nextStrongest)) {
            return 'source-reliability';
        }
        if (this._isRecencyBiased(strongest, nextStrongest)) {
            return 'recency-biased';
        }
        if (this._shouldUseEvidenceWeighting(hyperedge)) {
            return 'evidence-weighted';
        }

        return 'merge';
    }

    _hasReliableSourceDifference(strongest, nextStrongest) {
        if (!this.nar.config.useSourceReliability) {
            return false;
        }

        const source1 = this._getSource(strongest.belief);
        const source2 = this._getSource(nextStrongest.belief);

        if (source1 === source2) {
            return false;
        }

        const reliability1 = this.nar.state.sourceReliability?.get(source1) || this.config.defaultSourceReliability;
        const reliability2 = this.nar.state.sourceReliability?.get(source2) || this.config.defaultSourceReliability;

        return Math.abs(reliability1 - reliability2) > this.config.sourceReliabilityDifferenceThreshold;
    }

    _shouldUseEvidenceWeighting(hyperedge) {
        return hyperedge.evidence && hyperedge.evidence.length > this.config.evidenceWeightingThreshold;
    }

    _hasDominantEvidence(strongest, nextStrongest) {
        return strongest.evidenceStrength > (nextStrongest.evidenceStrength * this.config.dominantEvidenceFactor);
    }

    _hasDistinctContexts(hyperedge, strongest, nextStrongest) {
        const context1 = this._getBeliefContext(hyperedge, strongest.belief);
        const context2 = this._getBeliefContext(hyperedge, nextStrongest.belief);
        return context1 !== context2 && context2 !== 'default';
    }

    _isRecencyBiased(strongest, nextStrongest) {
        if (!this.nar.config.useRecencyBias) return false;
        return (strongest.belief.timestamp > nextStrongest.belief.timestamp);
    }

    _calculateEvidenceStrength(hyperedgeId, belief) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) return 0;

        const intrinsicWeight = this.nar.config.intrinsicStrengthWeight || this.config.intrinsicStrengthWeight;
        const evidenceWeight = this.nar.config.evidenceStrengthWeight || this.config.evidenceStrengthWeight;
        const sourceReliabilityWeight = this.nar.config.sourceReliabilityWeight || this.config.sourceReliabilityWeight;
        const recencyWeight = this.nar.config.recencyWeight || this.config.recencyWeight;

        const now = Date.now();
        const evidenceList = hyperedge.evidence?.filter(e => e.beliefId === belief.id) || [];

        const totalEvidenceStrength = evidenceList.reduce((sum, e) => {
            const ageInSeconds = (now - e.timestamp) / 1000;
            const decay = Math.exp(-ageInSeconds / (this.nar.config.temporalHorizon * this.config.evidenceDecayHours));
            return sum + (e.strength || 0) * decay;
        }, 0);

        const sourceReliability = evidenceList.reduce((sum, e) => {
            const reliability = this.nar.state.sourceReliability?.get(e.source) || this.config.defaultSourceReliability;
            return sum + (e.strength * reliability);
        }, 0) / (evidenceList.length || 1);

        const beliefAgeInSeconds = (now - belief.timestamp) / 1000;
        const recencyFactor = Math.exp(-beliefAgeInSeconds / (this.nar.config.temporalHorizon * this.config.recencyDecayHours));

        const intrinsicStrength = belief.truth.confidence * belief.budget.priority;

        const finalStrength = (intrinsicStrength * intrinsicWeight) +
            (totalEvidenceStrength * evidenceWeight) +
            (sourceReliability * sourceReliabilityWeight) +
            (recencyFactor * recencyWeight);

        return finalStrength / (intrinsicWeight + evidenceWeight + sourceReliabilityWeight + recencyWeight);
    }

    _createContextualSpecialization(originalHyperedge, conflictingBelief, context) {
        const newId = `${originalHyperedge.id}|context:${context}`;

        const specializedTruth = new TruthValue(
            conflictingBelief.truth.frequency,
            conflictingBelief.truth.confidence * this.config.specializationConfidenceBoost,
            conflictingBelief.truth.priority,
            (conflictingBelief.truth.doubt || 0) * this.config.specializationDoubtReduction
        );

        const specializedBudget = conflictingBelief.budget.scale(this.config.specializationBudgetBoost);

        if (this.nar.state.hypergraph.has(newId)) {
            const existingSpecialization = this.nar.state.hypergraph.get(newId);
            existingSpecialization.revise({
                truth: specializedTruth,
                budget: specializedBudget
            });
            return {reason: 'specialized', newHyperedgeId: newId};
        }

        const newArgs = [...originalHyperedge.args, `context:${context}`];
        const specialization = new Hyperedge(this.nar, newId, originalHyperedge.type, newArgs);
        specialization.revise({
            truth: specializedTruth,
            budget: specializedBudget
        });
        this.nar.state.hypergraph.set(newId, specialization);

        const similarityFreq = Math.max(0.1, 1.0 - conflictingBelief.truth.confidence);
        const similarityConf = this.config.similarityConfidence;
        this.nar.api.similarity(newId, originalHyperedge.id, {
            truth: new TruthValue(similarityFreq, similarityConf),
            budget: Budget.full().scale(this.config.similarityBudgetScale)
        });

        this.nar.emit('concept-split', {
            originalId: originalHyperedge.id,
            newId: newId,
            context: context
        });
        return {reason: 'specialized', newHyperedgeId: newId};
    }

    _getBeliefContext(hyperedge, belief) {
        const evidenceList = hyperedge.evidence?.filter(e => e.beliefId === belief.id) || [];
        if (evidenceList.length === 0) return 'default';

        for (const evidence of evidenceList) {
            if (evidence.context) {
                return evidence.context;
            }
        }

        const sourceCounts = new Map();
        evidenceList.forEach(e => {
            if (e.source) {
                sourceCounts.set(e.source, (sourceCounts.get(e.source) || 0) + 1);
            }
        });

        if (sourceCounts.size > 0) {
            return [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        }

        return 'default';
    }

    _areContradictory(truth1, truth2) {
        const freqDiff = Math.abs(truth1.frequency - truth2.frequency);
        const confDiff = Math.abs(truth1.confidence - truth2.confidence);
        const avgConfidence = (truth1.confidence + truth2.confidence) / 2;

        const isStrongContradiction = freqDiff > (this.nar.config.contradictionThreshold || this.config.strongContradictionThreshold) && avgConfidence > this.config.strongContradictionConfidence;

        const isModerateContradiction = freqDiff > this.config.moderateContradictionFreqDiff && confDiff > this.config.moderateContradictionConfDiff && avgConfidence > this.config.moderateContradictionAvgConfidence;

        return isStrongContradiction || isModerateContradiction;
    }

    _contradictionSeverity(truth1, truth2) {
        return Math.abs(truth1.expectation() - truth2.expectation());
    }

    _getSource(belief) {
        return belief.source || 'unknown';
    }

    analyze(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || !hyperedge.beliefs || hyperedge.beliefs.length < 2) {
            return {
                message: "No significant contradiction found for this hyperedge.",
                contradictions: [],
                resolutionSuggestion: null,
            };
        }

        const beliefsWithAnalysis = hyperedge.beliefs.map((b, i) => ({
            index: i,
            belief: b,
            truth: b.truth,
            budget: b.budget,
            evidence: hyperedge.evidence ? hyperedge.evidence.filter(e => e.beliefId === b.id) : [],
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, b)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const strategy = this._selectResolutionStrategy(hyperedgeId, {pairs: []});
        const suggestionDetails = this._getResolutionSuggestionDetails(hyperedgeId, strategy);

        return {
            hyperedgeId,
            beliefCount: hyperedge.beliefs.length,
            contradictions: beliefsWithAnalysis,
            resolutionSuggestion: {
                strategy: strategy,
                details: suggestionDetails,
                confidence: Math.max(...beliefsWithAnalysis.map(b => b.evidenceStrength)) - Math.min(...beliefsWithAnalysis.map(b => b.evidenceStrength)),
            }
        };
    }

    _getResolutionSuggestionDetails(hyperedgeId, strategy) {
        switch (strategy) {
            case 'dominant_evidence':
                return "One belief has significantly stronger evidence and would be prioritized.";
            case 'specialize':
                return "Beliefs seem to arise from different contexts. A new, more specific concept would be created.";
            case 'merge':
                return "Conflicting beliefs have similar strength and would be merged into a new, revised belief.";
            case 'source-reliability':
                return "Resolution would be based on the reliability of the information sources.";
            case 'recency-biased':
                return "The most recent information would be prioritized.";
            case 'evidence-weighted':
                return "A new belief would be formed by weighting all existing beliefs by their evidence strength.";
            default:
                return "A default resolution strategy would be applied.";
        }
    }
}
