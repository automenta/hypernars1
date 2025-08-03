import { ContradictionManagerBase } from './ContradictionManagerBase.js';
import { TruthValue } from '../support/TruthValue.js';
import { Hyperedge } from '../support/Hyperedge.js';
import { Budget } from '../support/Budget.js';

export class AdvancedContradictionManager extends ContradictionManagerBase {
    constructor(nar) {
        super(nar);
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
            threshold: 5,
            duration: 30000
        };
    }

    contradict(belief1Id, belief2Id, { strength = 0.7, context = null } = {}) {
        const belief1 = this.nar.state.hypergraph.get(belief1Id);
        const belief2 = this.nar.state.hypergraph.get(belief2Id);

        if (!belief1 || !belief2) {
            this.nar.emit('log', { message: 'Cannot create contradiction: one or both beliefs not found.', level: 'warn' });
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

        this.nar.emit('contradiction-detected', { hyperedgeId, contradictions: [contradictionData] });

        this.resolveContradictions();

        return contradictionId;
    }

    detectContradiction(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || hyperedge.beliefs.length < 2) {
            if (this.contradictions.has(hyperedgeId)) {
                this.contradictions.delete(hyperedgeId);
                this.nar.emit('contradiction-resolved', { hyperedgeId, reason: 'belief_pruned' });
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
            this.nar._log('info', `Contradiction detected for ${hyperedgeId}`, { pairs: contradictoryPairs.length });
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

        this.nar._log('debug', `No contradiction detected for ${hyperedgeId}`);
        return false;
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
        this.nar.emit('evidence-added', { hyperedgeId, beliefId });
    }

    resolveContradictions() {
        const now = Date.now();
        if (now < this.circuitBreaker.openUntil) {
            this.nar.emit('log', { message: 'Contradiction resolution circuit breaker is open.', level: 'warn' });
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
                this.nar.emit('log', { message: `Contradiction resolution circuit breaker tripped for ${this.circuitBreaker.duration}ms.`, level: 'error' });
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
            this.nar._log('info', `Contradiction resolved for ${hyperedgeId} using strategy: ${strategyName}`, { resolution });
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
            // If the resolution was to specialize, it handles its own belief modifications.

            this.nar.emit('contradiction-resolved', {
                hyperedgeId,
                strategy: strategyName,
                resolution
            });
            outcome = 'success';
        }

        // Report outcome to Learning Engine
        if (this.nar.learningEngine) {
            this.nar.learningEngine.recordExperience({
                operation: 'contradiction_resolution',
                strategy: strategyName,
                hyperedgeId: hyperedgeId,
            }, { success: outcome === 'success' });
        }

        return resolution || null;
    }

    // ===== RESOLUTION STRATEGIES =====

    _resolveByDominantEvidence(hyperedgeId, contradiction) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const beliefsWithEvidence = hyperedge.beliefs.map(belief => ({
            belief,
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const strongest = beliefsWithEvidence[0];
        const otherBeliefs = beliefsWithEvidence.slice(1);

        // Weaken the other beliefs instead of discarding them
        const modifiedBeliefs = otherBeliefs.map(item => {
            const modifiedBelief = { ...item.belief };
            modifiedBelief.truth = new TruthValue(
                modifiedBelief.truth.frequency,
                modifiedBelief.truth.confidence * 0.5,
                modifiedBelief.truth.priority * 0.8,
                Math.min(1.0, (modifiedBelief.truth.doubt || 0) + 0.5)
            );
            return modifiedBelief;
        });

        const newBeliefs = [strongest.belief, ...modifiedBeliefs];

        return { reason: 'dominant_evidence', primaryBelief: strongest.belief, updatedBeliefs: newBeliefs };
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
        // Penalize confidence and increase doubt due to conflict
        mergedTruth.confidence *= 0.8;
        mergedTruth.doubt = Math.min(1.0, (mergedTruth.doubt + 0.5) * 0.7);


        const mergedBudget = belief1.belief.budget.merge(belief2.belief.budget).scale(0.8);

        const newBelief = { ...belief1.belief, truth: mergedTruth, budget: mergedBudget, timestamp: Date.now() };

        // Directly modify the hyperedge's beliefs
        if (hyperedge) {
            hyperedge.beliefs = [newBelief];
        }

        return { reason: 'merged', newBelief };
    }

    _resolveBySpecialization(hyperedgeId, contradiction) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const beliefsWithEvidence = hyperedge.beliefs.map((belief, index) => ({
            belief,
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, belief)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        const conflictingBeliefData = beliefsWithEvidence[1]; // Specialize the weaker belief
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
                durability: 0.5,
                quality: weightedConfidence / totalWeight
            });
            hyperedge.beliefs = [{ truth: newTruth, budget: newBudget, timestamp: Date.now() }];
            return { reason: 'evidence-weighted', newTruth };
        }
        return null;
    }

    _recencyBiasedResolution(hyperedgeId, contradiction) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const mostRecent = [...hyperedge.beliefs].sort((a, b) => b.timestamp - a.timestamp)[0];
        hyperedge.beliefs = [mostRecent]; // Keep only the most recent
        return { reason: 'recency-biased', primaryBelief: mostRecent };
    }

    _sourceReliabilityResolution(hyperedgeId, contradiction, { sourceWeights = {} } = {}) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        let totalWeight = 0;
        let weightedFrequency = 0;
        let weightedConfidence = 0;

        hyperedge.beliefs.forEach(belief => {
            const source = this._getSource(belief);
            // Use provided weights or fallback to system-tracked reliability
            const sourceReliability = sourceWeights[source] || this.nar.state.sourceReliability?.get(source) || 0.5;
            const weight = sourceReliability * belief.budget.priority;

            weightedFrequency += belief.truth.frequency * weight;
            weightedConfidence += belief.truth.confidence * weight;
            totalWeight += weight;
        });

        if (totalWeight > 0) {
            const newTruth = new TruthValue(weightedFrequency / totalWeight, weightedConfidence / totalWeight);
            hyperedge.beliefs = [{ truth: newTruth, budget: Budget.full().scale(0.85), timestamp: Date.now() }];
            return { reason: 'source-reliability', newTruth };
        }
        return null;
    }

    _defaultResolution(hyperedgeId) {
        return this._resolveByDominantEvidence(hyperedgeId);
    }

    // ===== HELPER & ANALYSIS METHODS =====

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

        // Default Strategy: Merge the two strongest conflicting beliefs.
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

        const reliability1 = this.nar.state.sourceReliability?.get(source1) || 0.5;
        const reliability2 = this.nar.state.sourceReliability?.get(source2) || 0.5;

        return Math.abs(reliability1 - reliability2) > 0.3;
    }

    _shouldUseEvidenceWeighting(hyperedge) {
        return hyperedge.evidence && hyperedge.evidence.length > 2;
    }

    _hasDominantEvidence(strongest, nextStrongest) {
        // Resolve if the strongest evidence is significantly stronger.
        return strongest.evidenceStrength > (nextStrongest.evidenceStrength * 1.5);
    }

    _hasDistinctContexts(hyperedge, strongest, nextStrongest) {
        const context1 = this._getBeliefContext(hyperedge, strongest.belief);
        const context2 = this._getBeliefContext(hyperedge, nextStrongest.belief);
        // Specialize if contexts are different and the weaker one is not just default.
        return context1 !== context2 && context2 !== 'default';
    }

    _isRecencyBiased(strongest, nextStrongest) {
        if (!this.nar.config.useRecencyBias) return false;
        // Favor the most recent belief if it's not significantly older.
        return (strongest.belief.timestamp > nextStrongest.belief.timestamp);
    }

    _calculateEvidenceStrength(hyperedgeId, belief) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        const intrinsicWeight = this.nar.config.intrinsicStrengthWeight || 0.2;
        const evidenceWeight = this.nar.config.evidenceStrengthWeight || 0.8;
        const sourceReliabilityWeight = this.nar.config.sourceReliabilityWeight || 0.5;

        const evidenceList = hyperedge.evidence?.filter(e => e.beliefId === belief.id) || [];
        const totalEvidenceStrength = evidenceList.reduce((sum, e) => sum + (e.strength || 0), 0);

        const sourceReliability = evidenceList.reduce((sum, e) => {
            const reliability = this.nar.state.sourceReliability?.get(e.source) || 0.5;
            return sum + (e.strength * reliability);
        }, 0);

        const intrinsicStrength = belief.truth.confidence * belief.budget.priority;

        const finalStrength = (intrinsicStrength * intrinsicWeight) +
                              (totalEvidenceStrength * evidenceWeight) +
                              (sourceReliability * sourceReliabilityWeight);

        return finalStrength / (intrinsicWeight + evidenceWeight + sourceReliabilityWeight);
    }

    _createContextualSpecialization(originalHyperedge, conflictingBelief, context) {
        const newId = `${originalHyperedge.id}|context:${context}`;

        // When specializing, the doubt is reduced because the context explains the conflict.
        const specializedTruth = new TruthValue(
            conflictingBelief.truth.frequency,
            conflictingBelief.truth.confidence * 1.1, // Boost confidence slightly in new context
            conflictingBelief.truth.priority,
            (conflictingBelief.truth.doubt || 0) * 0.5 // Reduce doubt
        );

        const specializedBudget = conflictingBelief.budget.scale(1.1); // Slightly boost budget

        if (this.nar.state.hypergraph.has(newId)) {
            const existingSpecialization = this.nar.state.hypergraph.get(newId);
            existingSpecialization.revise({
                truth: specializedTruth,
                budget: specializedBudget
            });
            return { reason: 'specialized', newHyperedgeId: newId };
        }

        const newArgs = [...originalHyperedge.args, `context:${context}`];
        const specialization = new Hyperedge(this.nar, newId, originalHyperedge.type, newArgs);
        specialization.revise({
            truth: specializedTruth,
            budget: specializedBudget
        });
        this.nar.state.hypergraph.set(newId, specialization);

        // Add a similarity link between the original and the new specialized concept.
        // The similarity is inversely related to the confidence of the conflicting belief.
        // A high-confidence conflict suggests the contexts are very different (low similarity).
        const similarityFreq = Math.max(0.1, 1.0 - conflictingBelief.truth.confidence);
        const similarityConf = 0.9; // High confidence in the similarity assessment itself.
        this.nar.api.similarity(newId, originalHyperedge.id, {
            truth: new TruthValue(similarityFreq, similarityConf),
            budget: Budget.full().scale(0.5)
        });

        this.nar.emit('concept-split', {
            originalId: originalHyperedge.id,
            newId: newId,
            context: context
        });
        return { reason: 'specialized', newHyperedgeId: newId };
    }

    _getBeliefContext(hyperedge, belief) {
        const evidence = hyperedge.evidence?.find(e => e.beliefId === belief.id);
        return evidence?.source || 'default';
    }

    _areContradictory(truth1, truth2) {
        // More nuanced contradiction detection based on `enhance.b.md`
        const freqDiff = Math.abs(truth1.frequency - truth2.frequency);
        const confDiff = Math.abs(truth1.confidence - truth2.confidence);
        const avgConfidence = (truth1.confidence + truth2.confidence) / 2;

        // A strong contradiction occurs if frequencies are very different and confidence is high.
        const isStrongContradiction = freqDiff > (this.nar.config.contradictionThreshold || 0.7) && avgConfidence > 0.6;

        // A moderate contradiction can occur with smaller frequency differences if confidence is also divergent.
        const isModerateContradiction = freqDiff > 0.3 && confDiff > 0.4 && avgConfidence > 0.5;

        return isStrongContradiction || isModerateContradiction;
    }

    _contradictionSeverity(truth1, truth2) {
        return Math.abs(truth1.expectation() - truth2.expectation());
    }

    _getSource(belief) {
        // In a real implementation, this would track the source of information
        return belief.source || 'unknown';
    }

    analyze(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || !hyperedge.beliefs || hyperedge.beliefs.length < 2) {
            return null;
        }

        const beliefsWithEvidence = hyperedge.beliefs.map(b => ({
            belief: b,
            truth: b.truth,
            budget: b.budget,
            evidence: hyperedge.evidence ? hyperedge.evidence.filter(e => e.beliefId === b.id) : [],
            evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, b)
        })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);

        if (beliefsWithEvidence.length < 2) return null;

        const strategy = this._selectResolutionStrategy(hyperedgeId, { pairs: [] }); // Get a suggestion

        return {
            contradictions: beliefsWithEvidence,
            resolutionSuggestion: {
                strategy: strategy,
                // In a real scenario, you might simulate the resolution to get more detail
                details: `Strategy '${strategy}' would be chosen to resolve this contradiction.`
            }
        };
    }
}
