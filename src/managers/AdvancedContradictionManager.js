import {ContradictionManagerBase} from './ContradictionManagerBase.js';
import {TruthValue} from '../support/TruthValue.js';
import {Hyperedge} from '../support/Hyperedge.js';
import {Budget} from '../support/Budget.js';
import {id} from '../support/utils.js';
import {config} from '../config/index.js';
import {ContradictionStrategyFactory} from './contradictionStrategies/ContradictionStrategyFactory.js';

const defaultConfig = config.advancedContradictionManager;

export class AdvancedContradictionManager extends ContradictionManagerBase {
    constructor(nar) {
        super(nar);
        this.config = {...defaultConfig, ...nar.config.advancedContradictionManager};
        this.contradictions = new Map();
        this.strategyFactory = new ContradictionStrategyFactory(this);

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

    detectContradictions(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || !hyperedge.beliefs || hyperedge.beliefs.length < 2) {
            if (this.contradictions.has(hyperedgeId)) {
                this.contradictions.delete(hyperedgeId);
                this.nar.emit('contradiction-resolved', {hyperedgeId, reason: 'belief_pruned'});
            }
            return false;
        }

        const contradictoryPairs = [];
        // Use the helper method from the base class to find all contradictory pairs.
        this._iterateBeliefPairs(hyperedge, (belief1, belief2) => {
            if (this._areContradictory(belief1.truth, belief2.truth)) {
                contradictoryPairs.push({
                    belief1: belief1,
                    belief2: belief2,
                    severity: this._contradictionSeverity(belief1.truth, belief2.truth)
                });
            }
            return false; // Always return false to ensure we check all pairs.
        });

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

        var strategy = this.strategyFactory.getStrategy(strategyName);
        if (!strategy) {
            // Fallback to default if strategy not found
            strategy = this.strategyFactory.getStrategy('default');
        }

        const resolution = strategy.resolve(hyperedgeId, contradiction, customParams);
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
