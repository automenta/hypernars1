import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { Hyperedge } from '../support/Hyperedge.js';
import { id, getArgId } from '../support/utils.js';

export class Api {
  constructor(nar) {
    this.nar = nar;
  }

  /* ===== ENHANCED MACRO FUNCTIONS (from enhance.b.md) ===== */

  /**
   * NAL statement creation with automatic context handling.
   * @example nal('<bird --> flyer>. %0.8;0.75% @context:ornithology')
   */
  nal(statement, options = {}) {
    let context = null;
    let cleanStatement = statement;

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
    return this.nar.questionHandler.ask(question, options);
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
    if (citation.source) {
        this.addHyperedge('hasSource', [beliefId, `Source(${citation.source})`], { truth: TruthValue.certain() });
    }
    return beliefId;
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

    return { baseRule, exceptionRule };
  }

  /* ===== PUBLIC API: STRUCTURAL OPERATIONS ===== */
  term(name, options = {}) { return this.addHyperedge('Term', [name], options); }
  inheritance(subject, predicate, options = {}) { return this.addHyperedge('Inheritance', [subject, predicate], options); }
  similarity(term1, term2, options = {}) { return this.addHyperedge('Similarity', [term1, term2], options); }
  implication(premise, conclusion, options = {}) { return this.addHyperedge('Implication', [premise, conclusion], options); }
  equivalence(premise, conclusion, options = {}) { return this.addHyperedge('Equivalence', [premise, conclusion], options); }

  /* ===== CORE: ADDING KNOWLEDGE ===== */
  addHyperedge(type, args, options = {}) {
    const { truth, budget, priority, premises = [] } = options;
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
        finalBudget = this.nar.memoryManager.dynamicBudgetAllocation({ type: 'revision' }, { importance: priority });
    }

    // Delegate revision and contradiction handling to the hyperedge itself
    const revisionResult = hyperedge.revise(finalTruth, finalBudget, this.nar.config.beliefCapacity, premises);

    if (revisionResult.needsUpdate) {
        this.nar.notifyListeners('revision', { hyperedgeId: termId, newTruth: finalTruth, newBudget: finalBudget });
        this.nar.propagation.propagate(termId, 1.0, finalBudget, 0, 0, []);
        this.nar.questionHandler.checkQuestionAnswers(termId, hyperedge.getStrongestBelief());
    }

    return termId;
  }
}
