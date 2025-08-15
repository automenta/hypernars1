import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { Hyperedge } from '../support/Hyperedge.js';
import { id } from '../support/utils.js';

export class Api {
  constructor(nar) {
    this.nar = nar;
    this.TruthValue = TruthValue;
  }

  /* ===== ENHANCED MACRO FUNCTIONS (from enhance.b.md) ===== */

  /**
   * NAL statement creation with automatic context handling.
   * @example nal('<bird --> flyer>. %0.8;0.75% @context:ornithology')
   */
  nal(statement, options = {}) {
    let context = null;
    let cleanStatement = statement;

    // Add temporal and source context from spec `a`
    if (!options.timestamp && this.nar.temporalManager) {
        options.timestamp = Date.now();
    }
    if (!options.source && this.nar.metaReasoner) {
        options.source = this.nar.metaReasoner.getActiveStrategy();
    }

    const contextMatch = statement.match(/@context:([^ ]+)/);
    if (contextMatch) {
      context = contextMatch[1];
      cleanStatement = statement.replace(contextMatch[0], '').trim();
    }

    const result = this.nar.expressionEvaluator.parseAndAdd(cleanStatement, options);

    if (result && context) {
      // Assuming a general way to associate context. This might need a dedicated manager.
      this.addHyperedge('hasContext', [result, context], { truth: TruthValue.certain() });
    }

    return result;
  }

  nalq(question, options = {}) {
    // Logic from spec `a` to add urgency and adjust timeout
    if (!options.urgency) {
        options.urgency = this._assessQuestionUrgency(question);
    }
    if (!options.timeout && this.nar.config) {
        options.timeout = this.nar.config.questionTimeout * (1.5 - Math.min(1.0, options.urgency || 0.5));
    }
    return this.nar.expressionEvaluator.parseQuestion(question, options);
  }

  /**
   * Create a contextual temporal sequence.
   * From spec `a`.
   */
  seq(...terms) {
    const options = (typeof terms[terms.length-1] === 'object') ? terms.pop() : {};
    const timestamp = options.timestamp || Date.now();

    // Add temporal context
    const context = options.context || this.nar.temporalManager?.getContext?.() || {};

    terms.slice(0, -1).forEach((term, i) => {
      const nextTerm = terms[i + 1];
      const stepTimestamp = timestamp + (i * (options.interval || 1000));

      // Use the temporal manager to assert the relationship
      this.nar.temporalManager.addConstraint(term, nextTerm, 'before', {
          truth: options.truth || new TruthValue(0.9, 0.9),
          timestamp: stepTimestamp
      });

      // Add contextual information (with placeholder helpers)
      if (context.period) {
        this._addTemporalContext(term, context.period, stepTimestamp);
      }
      if (context.location) {
        this._addLocationContext(term, context.location);
      }
    });

    return id('Sequence', terms);
  }

  /**
   * Create a contextualized rule that only applies in specific situations.
   */
  contextualRule(premise, conclusion, contextId, options = {}) {
    const ruleId = this.implication(premise, conclusion, options);
    this.addHyperedge('hasContext', [ruleId, contextId], { truth: TruthValue.certain() });
    return ruleId;
  }

  /**
   * Create a multi-step temporal sequence with automatic timing.
   * @example temporalSequence('wake_up', 'brush_teeth', 'have_breakfast', { interval: 5, unit: 'minutes' })
   */
  temporalSequence(...terms) {
    const options = (typeof terms[terms.length - 1] === 'object') ? terms.pop() : {};
    const { interval = 2, unit = 'minutes', timestamp = Date.now() } = options;

    const stepInterval = unit === 'minutes' ? interval * 60000 :
                        unit === 'hours' ? interval * 3600000 :
                        interval * 1000; // Default to seconds

    for (let i = 0; i < terms.length - 1; i++) {
      // Use the temporal reasoner's constraint system
      this.nar.temporalManager.addConstraint(terms[i], terms[i + 1], 'before', {
        truth: options.truth || new TruthValue(0.9, 0.9)
      });
    }

    return id('Sequence', terms);
  }

  /**
   * Create a probabilistic rule with uncertainty handling.
   */
  probabilisticRule(premise, conclusion, frequency, confidence, options = {}) {
    return this.implication(premise, conclusion, {
      ...options,
      truth: new TruthValue(frequency, confidence)
    });
  }

  /**
   * Create a belief with explicit source citation.
   */
  citedBelief(statement, citation) {
    const beliefId = this.nal(statement);
    if (!citation || typeof citation !== 'object') {
        return beliefId;
    }

    // Create a structured citation concept
    const citationParts = Object.entries(citation).map(([key, value]) => `has_${key}(${value})`);
    const citationId = this.addHyperedge('Citation', citationParts, { truth: TruthValue.certain() });

    // Link the belief to its citation
    this.addHyperedge('hasCitation', [beliefId, citationId], { truth: TruthValue.certain() });

    return { beliefId, citationId };
  }

  /**
   * Create a conditional rule with exception handling.
   */
  robustRule(premise, conclusion, exception, options = {}) {
    const baseRule = this.implication(premise, conclusion, {
      ...options,
      truth: options.truth || new TruthValue(0.9, 0.8)
    });

    const exceptionPremise = id('Conjunction', [exception, premise]);
    const negatedConclusion = id('Negation', [conclusion]);

    const exceptionRule = this.implication(exceptionPremise, negatedConclusion, {
      ...options,
      truth: new TruthValue(0.95, 0.85)
    });

    // Link the rules to make the exception relationship explicit
    this.addHyperedge('isExceptionTo', [exceptionRule, baseRule], { truth: TruthValue.certain() });

    return { baseRule, exceptionRule };
  }

  /* ===== PUBLIC API: TEMPORAL OPERATIONS ===== */
  temporalInterval(term, start, end, options = {}) {
    return this.nar.temporalManager.interval(term, start, end, options);
  }

  temporalConstraint(event1, event2, relation, options = {}) {
    return this.nar.temporalManager.addConstraint(event1, event2, relation, options);
  }

  inferTemporalRelationship(event1, event2) {
    return this.nar.temporalManager.inferRelationship(event1, event2);
  }

  projectTemporal(term, milliseconds) {
    return this.nar.temporalManager.project(term, milliseconds);
  }

  /* ===== PUBLIC API: CONTRADICTION MANAGEMENT ===== */
  getContradictions() {
    this.nar._log('debug', 'Contradictions map state (before filter):', { map: Array.from(this.nar.contradictionManager.contradictions.keys()) });
    return Array.from(this.nar.contradictionManager.contradictions.entries())
      .filter(([, data]) => !data.resolved)
      .map(([id, data]) => ({ id, ...data }));
  }
  analyzeContradiction(hyperedgeId) { return this.nar.contradictionManager.analyze(hyperedgeId); }
  resolveContradiction(hyperedgeId, strategy, options) { return this.nar.contradictionManager.manualResolve(hyperedgeId, strategy, options); }

  /* ===== PUBLIC API: META-REASONING OPERATIONS ===== */
  getMetaTrace(depth) { return this.nar.metaReasoner.getTrace(depth); }
  configureMetaStrategy(config) { return this.nar.metaReasoner.configureStrategy(config); }
  getActiveMetaStrategy() { return this.nar.metaReasoner.getActiveStrategy(); }
  getMetaMetrics() { return this.nar.metaReasoner.metricsHistory.slice(-1)[0] || null; }
  getMetaFocus() { return this.nar.metaReasoner.currentFocus; }

  /* ===== PUBLIC API: STRUCTURAL OPERATIONS ===== */
  term(name, options = {}) { return this.addHyperedge('Term', [name], options); }
  inheritance(subject, predicate, options = {}) { return this.addHyperedge('Inheritance', [subject, predicate], options); }
  similarity(term1, term2, options = {}) { return this.addHyperedge('Similarity', [term1, term2], options); }
  implication(premise, conclusion, options = {}) { return this.addHyperedge('Implication', [premise, conclusion], options); }
  equivalence(premise, conclusion, options = {}) { return this.addHyperedge('Equivalence', [premise, conclusion], options); }

  /**
   * Retrieves all beliefs associated with a given hyperedge.
   * @param {string} hyperedgeId The ID of the hyperedge.
   * @returns {Array} An array of belief objects, or an empty array if not found.
   */
  getBeliefs(hyperedgeId) {
    const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
    return hyperedge ? hyperedge.beliefs : [];
  }

  /* ===== CORE: ADDING KNOWLEDGE ===== */
  addHyperedge(type, args, options = {}) {
    const { truth, budget, priority, premises = [], derivedBy } = options;
    const termId = id(type, args);
    let hyperedge = this.nar.state.hypergraph.get(termId);

    if (!hyperedge) {
      hyperedge = new Hyperedge(this.nar, termId, type, args);
      this.nar.state.hypergraph.set(termId, hyperedge);
      this.nar.state.index.addToIndex(hyperedge);
    }

    const finalTruth = truth || new TruthValue(1.0, 0.9);
    let finalBudget = budget;

    if (finalBudget && !(finalBudget instanceof Budget)) {
        finalBudget = new Budget(finalBudget.priority, finalBudget.durability, finalBudget.quality);
    } else if (!finalBudget) {
        finalBudget = this.nar.memoryManager.allocateResources({ type: 'revision' }, { importance: priority });
    }

    // Use enhanced contradiction handling if available
    let revisionResult;
    if (typeof this.nar.contradictionManager.reviseWithContradictionHandling === 'function') {
        const newBelief = {
            truth: finalTruth,
            budget: finalBudget,
            premises,
            context: options.context,
            derivedBy,
            timestamp: Date.now()
        };
        revisionResult = this.nar.contradictionManager.reviseWithContradictionHandling(hyperedge, newBelief);
    } else {
        // Fallback to the original revision logic
        const rawResult = hyperedge.revise({
            truth: finalTruth,
            budget: finalBudget,
            beliefCapacity: this.nar.config.beliefCapacity,
            premises,
            context: options.context,
            derivedBy
        });
        revisionResult = { updated: rawResult.needsUpdate };
        if (rawResult.needsUpdate) {
            this.nar.contradictionManager.detectContradiction(termId);
        }
    }

    if (revisionResult.updated) {
        this.nar.emit('revision', { hyperedgeId: termId, newTruth: finalTruth, newBudget: finalBudget });
        this.nar.propagation.propagate({
            target: termId,
            activation: 1.0,
            budget: finalBudget,
            pathHash: 0,
            pathLength: 0,
            derivationPath: []
        });
        this.nar.questionHandler.checkQuestionAnswers(termId, hyperedge.getStrongestBelief());
    }

    return termId;
  }

  // --- Placeholder helpers for enhanced macros ---

  _assessQuestionUrgency(question) {
    const q = question.toLowerCase();
    // Keywords that imply higher urgency
    const urgentKeywords = ['what is', 'is there', 'why', 'who', 'when', 'where', 'how'];
    if (q.endsWith('?') || urgentKeywords.some(kw => q.startsWith(kw))) {
        return 0.8; // High urgency for direct questions
    }
    if (q.startsWith('<') && q.includes('-->')) {
        return 0.4; // Lower urgency for goal-like queries
    }
    return 0.5; // Default urgency
  }

  _addTemporalContext(term, period, timestamp) {
    // Placeholder: creates a hyperedge linking the term to a temporal period
    this.addHyperedge('inPeriod', [term, period], {
        truth: TruthValue.certain(),
        timestamp
    });
  }

  _addLocationContext(term, location) {
    // Placeholder: creates a hyperedge linking the term to a location
    this.addHyperedge('atLocation', [term, location], {
        truth: TruthValue.certain()
    });
  }

  /**
   * Revises a belief on an existing hyperedge.
   * This is a more direct way to update a belief than addHyperedge.
   * @param {string} hyperedgeId The ID of the hyperedge to revise.
   * @param {Object} options Options including truth and budget.
   */
  /**
   * Reports the outcome of an action or reasoning process to the Learning Engine.
   * This is the primary mechanism for providing external feedback to the system.
   * @param {Object} context - The context in which the action/reasoning occurred (e.g., { operation: 'action', action: 'move_forward' }).
   * @param {Object} outcome - Details about the outcome (e.g., { success: true, consequence: 'reached_destination' }).
   * @param {Object} [options={}] - Additional details like the derivation path that led to the action.
   */
  outcome(context, outcome, options = {}) {
    this.nar.learningEngine.recordExperience(context, outcome, options);
  }

  revise(hyperedgeId, options = {}) {
    const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
    if (!hyperedge) {
      this.nar._log('warn', `revise called on non-existent hyperedge: ${hyperedgeId}`);
      return;
    }

    const { truth, budget } = options;
    const strongestBelief = hyperedge.getStrongestBelief();

    const finalTruth = truth || strongestBelief?.truth;
    let finalBudget = budget || strongestBelief?.budget;

    if (!finalTruth || !finalBudget) {
        // Cannot revise without both truth and budget
        return;
    }

    if (finalBudget && !(finalBudget instanceof Budget)) {
        finalBudget = new Budget(finalBudget.priority, finalBudget.durability, finalBudget.quality);
    }

    const revisionResult = hyperedge.revise({
        truth: finalTruth,
        budget: finalBudget,
        beliefCapacity: this.nar.config.beliefCapacity,
        premises: strongestBelief?.premises, // Carry over premises
        derivedBy: 'revision'
    });

    if (revisionResult.needsUpdate) {
        this.nar.contradictionManager.detectContradiction(hyperedgeId);
        this.nar.emit('revision', { hyperedgeId, newTruth: finalTruth, newBudget: finalBudget });
        this.nar.propagation.propagate({
            target: hyperedgeId,
            activation: 1.0,
            budget: finalBudget,
            pathHash: 0,
            pathLength: 0,
            derivationPath: []
        });
    }
  }

  removeHyperedge(hyperedgeId) {
    const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
    if (hyperedge) {
        this.nar.state.hypergraph.delete(hyperedgeId);
        this.nar.state.index.removeFromIndex(hyperedge);
        this.nar.state.activations.delete(hyperedgeId);
        this.nar.emit('knowledge-pruned', { hyperedgeId, type: hyperedge.type });
        return true;
    }
    return false;
  }
}
