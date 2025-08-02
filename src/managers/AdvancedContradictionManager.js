import { ContradictionManagerBase } from './ContradictionManagerBase.js';
import { TruthValue } from '../support/TruthValue.js';
import { Hyperedge } from '../support/Hyperedge.js';
import { Budget } from '../support/Budget.js';

/**
 * @file Advanced Contradiction Manager for HyperNAR
 * @description Implements the comprehensive contradiction handling system for HyperNAR.
 *
 * At its core, HyperNAR's approach to contradictions is fundamentally different from
 * traditional logic systems. Instead of treating contradictions as errors that invalidate
 * the system, it views them as a natural and essential part of reasoning with incomplete
 * and uncertain real-world knowledge. Contradictions are valuable signals that point to
 * areas of conflict in the system's knowledge that need refinement.
 *
 * The process can be broken down into four main stages:
 *
 * ### 1. Detection
 * A contradiction is detected when two beliefs about the **same concept** have strongly
 * opposing truth values (e.g., one has a high frequency, the other has a low frequency,
 * and both are held with high confidence). This detection happens automatically whenever
 * a belief is revised with new evidence.
 *
 * ### 2. Analysis
 * Once a contradiction is detected, the system performs a detailed analysis. It gathers
 * all available information: the conflicting beliefs, their truth values, their budgets
 * (priority/importance), and any supporting evidence. It calculates an "evidence strength"
 * for each conflicting belief and then suggests a resolution strategy.
 *
 * ### 3. Resolution
 * The system has a sophisticated toolkit of strategies to resolve the contradiction, which
 * can be triggered automatically or manually. The main strategies include:
 *
 * - **Dominant Evidence:** If one belief is backed by significantly stronger evidence,
 *   it "wins," and the weaker belief is suppressed.
 * - **Merge:** If the conflicting beliefs have similar strength, they can be merged. This
 *   typically results in a new belief with a revised truth value that reflects the
 *   uncertainty of the conflict.
 * - **Specialize (Contextualization):** If the beliefs might be true in different contexts,
 *   the system can create a new, more specific concept. For example, faced with the
 *   contradiction that "birds fly" but "penguins don't fly," it can create a specialized
 *   belief: `<(bird, context:penguin) --> NOT flyer>`. This adds nuance rather than deleting knowledge.
 * - **Recency-Biased:** This strategy resolves a conflict by favoring the most recent information,
 *   leveraging the timestamp attached to every belief.
 *
 * ### 4. Learning
 * The system learns from this entire process. The LearningEngine observes which resolution
 * strategies lead to successful outcomes (e.g., better predictions). Over time, it can learn
 * to automatically choose the best strategy for a given type of conflict, making its
 * reasoning more robust and efficient.
 */
export class AdvancedContradictionManager extends ContradictionManagerBase {
    constructor(nar) {
        super(nar);
        this.contradictions = new Map(); // Maps hyperedge ID to contradiction records
        this.resolutionStrategies = {
            'dominant_evidence': this._resolveByDominantEvidence.bind(this),
            'merge': this._resolveByMerging.bind(this),
            'specialize': this._resolveBySpecialization.bind(this),
            'evidence-weighted': this._evidenceWeightedResolution.bind(this),
            'recency-biased': this._recencyBiasedResolution.bind(this),
            'source-reliability': this._sourceReliabilityResolution.bind(this),
            'default': this._defaultResolution.bind(this)
        };

        // Circuit breaker state for contradiction resolution
        this.circuitBreaker = {
            failures: 0,
            lastFailure: 0,
            openUntil: 0,
            threshold: 5, // 5 failures in a short period
            duration: 30000 // 30 seconds
        };
    }

    /**
     * Explicitly marks a contradiction between two beliefs, as proposed in `enhance.g.md`.
     * This can be used to flag known inconsistencies for the system to resolve.
     * @param {string} belief1Id - ID of the first hyperedge in the contradiction.
     * @param {string} belief2Id - ID of the second hyperedge.
     * @param {object} [options={}] - Options like context and strength.
     * @returns {string|null} The ID of the created contradiction record, or null if beliefs are invalid.
     */
    contradict(belief1Id, belief2Id, { strength = 0.7, context = null } = {}) {
        const belief1 = this.nar.state.hypergraph.get(belief1Id);
        const belief2 = this.nar.state.hypergraph.get(belief2Id);

        if (!belief1 || !belief2) {
            this.nar.emit('log', { message: 'Cannot create contradiction: one or both beliefs not found.', level: 'warn' });
            return null;
        }

        // A contradiction is typically about the same concept having opposing truths.
        // We'll use the ID of the first belief as the primary key for the contradiction.
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
            pairs: [contradictionData], // Simplified for explicit contradiction
            resolved: false
        });

        this.nar.emit('contradiction-detected', { hyperedgeId, contradictions: [contradictionData] });

        // Optionally trigger immediate resolution
        this.resolveContradictions();

        return contradictionId;
    }

    /**
     * Detects contradictions for a hyperedge after a revision.
     * If a contradiction is found, it's tracked in the `this.contradictions` map.
     * @param {string} hyperedgeId - The ID of the hyperedge to check.
     * @returns {boolean} True if a new contradiction was detected.
     */
    detectContradiction(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge || hyperedge.beliefs.length < 2) {
            // If there were contradictions before but now there's only one belief, it's resolved.
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

    /**
     * Register evidence for a belief on a hyperedge.
     * This is kept for compatibility with tests and for cases where evidence is provided externally.
     * @param {string} hyperedgeId - Target hyperedge ID.
     * @param {Object} evidence - Evidence details { source, strength, beliefIndex }.
     */
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

    /**
     * Iterates through tracked contradictions and resolves them using the best strategy.
     * This is intended to be called periodically by the main system loop.
     * Includes a circuit breaker to prevent runaway resolution processes.
     */
    resolveContradictions() {
        // Check circuit breaker
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

        // Update circuit breaker state
        if (failuresThisRun > 0) {
            this.circuitBreaker.failures += failuresThisRun;
            this.circuitBreaker.lastFailure = now;
            if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
                this.circuitBreaker.openUntil = now + this.circuitBreaker.duration;
                this.nar.emit('log', { message: `Contradiction resolution circuit breaker tripped for ${this.circuitBreaker.duration}ms.`, level: 'error' });
            }
        } else {
            // Reset failures on a successful run
            this.circuitBreaker.failures = 0;
        }
    }

    /**
     * Manually resolves a contradiction on a hyperedge using a specified strategy.
     * @param {string} hyperedgeId - The ID of the hyperedge with the contradiction.
     * @param {string} strategyName - The name of the strategy to use.
     * @param {Object} [customParams={}] - Custom parameters for the strategy.
     * @returns {object|null} The resolution result or null if failed.
     */
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

            if (resolution.primaryBelief) {
                hyperedge.beliefs = [resolution.primaryBelief];
            } else if (resolution.newBelief) {
                hyperedge.beliefs = [resolution.newBelief];
            } else {
                // If the resolution was to specialize, the original hyperedge might be modified differently
                // For now, we assume specialization handles the belief list itself.
            }

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

        return { reason: 'dominant_evidence', primaryBelief: strongest.belief };
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
        mergedTruth.confidence *= 0.8; // Penalize confidence due to conflict

        const mergedBudget = belief1.belief.budget.merge(belief2.belief.budget).scale(0.8);

        const newBelief = { ...belief1.belief, truth: mergedTruth, budget: mergedBudget, timestamp: Date.now() };

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

        // Strategy 1: If one belief has significantly stronger evidence, it dominates.
        if (this._hasDominantEvidence(strongest, nextStrongest)) {
            return 'dominant_evidence';
        }

        // Strategy 2: If beliefs might be true in different contexts, specialize.
        if (this._hasDistinctContexts(hyperedge, strongest, nextStrongest)) {
            return 'specialize';
        }

        // Strategy 3: If source reliability is a factor and sources are different and reliable.
        const source1 = this._getSource(strongest.belief);
        const source2 = this._getSource(nextStrongest.belief);
        if (this.nar.config.useSourceReliability && source1 !== source2) {
            const reliability1 = this.nar.state.sourceReliability?.get(source1) || 0.5;
            const reliability2 = this.nar.state.sourceReliability?.get(source2) || 0.5;
            if (Math.abs(reliability1 - reliability2) > 0.3) { // Significant difference in reliability
                return 'source-reliability';
            }
        }

        // Strategy 4: If configured, favor the most recent information.
        if (this._isRecencyBiased(strongest, nextStrongest)) {
            return 'recency-biased';
        }

        // Strategy 5: If there are multiple pieces of evidence, weigh them.
        if (hyperedge.evidence && hyperedge.evidence.length > 2) {
            return 'evidence-weighted';
        }

        // Default Strategy: Merge the two strongest conflicting beliefs.
        return 'merge';
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

        const intrinsicStrength = belief.truth.expectation() * belief.budget.priority;

        const finalStrength = (intrinsicStrength * intrinsicWeight) +
                              (totalEvidenceStrength * evidenceWeight) +
                              (sourceReliability * sourceReliabilityWeight);

        return finalStrength / (intrinsicWeight + evidenceWeight + sourceReliabilityWeight);
    }

    _createContextualSpecialization(originalHyperedge, conflictingBelief, context) {
        const newId = `${originalHyperedge.id}|context:${context}`;
        if (this.nar.state.hypergraph.has(newId)) {
            const existingSpecialization = this.nar.state.hypergraph.get(newId);
            existingSpecialization.revise({
                truth: conflictingBelief.truth,
                budget: conflictingBelief.budget
            });
            return newId;
        }

        const newArgs = [...originalHyperedge.args, `context:${context}`];
        const specialization = new Hyperedge(this.nar, newId, originalHyperedge.type, newArgs);
        specialization.revise({
            truth: conflictingBelief.truth,
            budget: conflictingBelief.budget
        });
        this.nar.state.hypergraph.set(newId, specialization);

        // Add a similarity link between the original and the new specialized concept
        this.nar.api.similarity(newId, originalHyperedge.id, {
            truth: new TruthValue(0.8, 0.8), // High similarity
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

    /**
     * Provides a detailed analysis of a contradiction on a hyperedge without resolving it.
     * @param {string} hyperedgeId
     * @returns {Object|null} An analysis report or null if no contradiction exists.
     */
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
