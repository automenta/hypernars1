import { TruthValue } from '../support/TruthValue.js';
import { Budget } from '../support/Budget.js';
import { Hyperedge } from '../support/Hyperedge.js';
import { id } from '../support/utils.js';
import { getArgId } from './utils.js';

export class Api {
  constructor(nar) {
    this.nar = nar;
  }

  /* ===== MACRO FUNCTIONS ===== */
  nal(statement, options = {}) {
    if (!options.timestamp && this.nar.temporalManager) {
        options.timestamp = Date.now();
    }
    if (!options.source && this.nar.metaReasoner) {
        options.source = this.nar.metaReasoner.getActiveStrategy ? this.nar.metaReasoner.getActiveStrategy() : 'default';
    }
    return this.nar.expressionEvaluator.parseAndAdd(statement, options);
  }

  nalq(question, options = {}) {
    if (!options.urgency) {
        options.urgency = this._assessQuestionUrgency(question);
    }
    if (!options.timeout) {
        options.timeout = this.nar.config.questionTimeout * (1.5 - Math.min(1.0, options.urgency || 0.5));
    }
    return this.nar.expressionEvaluator.parseQuestion(question, options);
  }

  seq(...terms) {
    const options = (typeof terms[terms.length-1] === 'object') ?
      terms.pop() : {};
    const timestamp = options.timestamp || Date.now();
    const context = options.context || this.nar.temporalManager?.getContext?.() || {};
    terms.slice(0, -1).forEach((term, i) => {
      const stepTimestamp = timestamp + (i * (options.interval || 1000));
      this.after(term, terms[i + 1], { timestamp: stepTimestamp });
      if (context.period) {
        this._addTemporalContext(term, context.period, stepTimestamp);
      }
    });
    return id('Sequence', terms);
  }

  _assessQuestionUrgency(question) {
    if (question.includes('hazard') || question.includes('danger')) return 0.9;
    if (question.includes('?')) return 0.7;
    return 0.5;
  }

  when(premise, conclusion, options = {}) { return this.implication(premise, conclusion, options); }
  contextualRule(ruleId, contextId) { this._addContextAssociation(ruleId, contextId); return ruleId; }
  citedBelief(statement, citation) {
    const beliefId = this.nal(statement);
    this._storeCitation(beliefId, citation);
    if (citation.source) {
        this.addHyperedge('hasSource', [beliefId, citation.source], { truth: TruthValue.certain() });
    }
    return beliefId;
  }

  /* ===== PUBLIC API: STRUCTURAL OPERATIONS ===== */
  term(name, options = {}) { return this.addHyperedge('Term', [name], options); }
  inheritance(subject, predicate, options = {}) { return this.addHyperedge('Inheritance', [subject, predicate], options); }
  similarity(term1, term2, options = {}) { return this.addHyperedge('Similarity', [term1, term2], options); }
  instance(instance, concept, options = {}) { return this.addHyperedge('Instance', [instance, concept], options); }
  property(concept, property, options = {}) { return this.addHyperedge('Property', [concept, property], options); }
  implication(premise, conclusion, options = {}) { return this.addHyperedge('Implication', [premise, conclusion], options); }
  equivalence(premise, conclusion, options = {}) { return this.addHyperedge('Equivalence', [premise, conclusion], options); }
  conjunction(...terms) { return this.addHyperedge('Conjunction', terms, { truth: new TruthValue(0.9, 0.9) }); }
  disjunction(...terms) { return this.addHyperedge('Disjunction', terms, { truth: terms.some(t => t.truth?.frequency > 0.5) ? new TruthValue(0.7, 0.6) : new TruthValue(0.3, 0.4) }); }
  product(...terms) { return this.addHyperedge('Product', terms, { truth: TruthValue.certain(), budget: Budget.full().scale(0.7) }); }

  /* ===== PUBLIC API: TEMPORAL & PROCEDURAL ===== */
  after(p, c, o={}) { return this.nar.temporalManager.temporalRelation(p, c, 'after', o); }
  before(p, c, o={}) { return this.nar.temporalManager.temporalRelation(p, c, 'before', o); }
  simultaneous(p, c, o={}) { return this.nar.temporalManager.temporalRelation(p, c, 'equals', o); }
  evaluate(expression, context = {}) { return this.nar.expressionEvaluator.evaluate(expression, context); }

  query(pattern, options = { limit: 10 }) {
    if (!pattern.includes('*')) {
        return this.nar.expressionEvaluator.query(pattern, options);
    }

    const results = [];
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));

    for (const [id, hyperedge] of this.nar.state.hypergraph.entries()) {
        if (regex.test(id)) {
            results.push({
                id,
                type: hyperedge.type,
                args: hyperedge.args,
                truth: hyperedge.getTruth(),
            });
        }
        if (results.length >= options.limit) {
            break;
        }
    }
    return results;
  }

  revise(hyperedgeId, newTruth, newBudget, premises = [], derivedBy = null) {
    const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
    if (!hyperedge) return false;

    // The responsibility for contradiction handling is now moved to Hyperedge.revise
    const result = hyperedge.revise(newTruth, newBudget, this.nar.config.beliefCapacity, premises, null, derivedBy);

    if (result.needsUpdate) {
        this.nar.notifyListeners('revision', { hyperedgeId, newTruth, newBudget });
    }

    return result.needsUpdate;
  }

  /* ===== CORE: ADDING KNOWLEDGE ===== */
  addHyperedge(type, args, options = {}) {
    const { truth, budget, priority, premises = [], context = null, derivedBy = null } = options;
    const termId = id(type, args);
    const hyperedge = this.nar.state.hypergraph.get(termId) ?? new Hyperedge(this.nar, termId, type, args);

    if (!this.nar.state.hypergraph.has(termId)) {
      this.nar.state.hypergraph.set(termId, hyperedge);
      this.addToIndex(hyperedge);
    }

    const finalTruth = truth || TruthValue.certain();
    let finalBudget = budget;

    if (finalBudget && !(finalBudget instanceof Budget)) {
        finalBudget = new Budget(finalBudget.priority, finalBudget.durability, finalBudget.quality);
    }

    if (!finalBudget) {
        if (this.nar.memoryManager.dynamicBudgetAllocation) {
            const task = { type: 'revision', hyperedgeType: type };
            const context = { importance: priority };
            finalBudget = this.nar.memoryManager.dynamicBudgetAllocation(task, context);
        } else {
            finalBudget = new Budget(priority || 0.5, 0.5, 0.5);
        }
    }

    // Use the new proactive revision logic
    this.revise(termId, finalTruth, finalBudget, premises, derivedBy);

    const currentBelief = hyperedge.getStrongestBelief();
    if (!currentBelief) return termId; // Revision was rejected

    this.nar.propagation.propagate(termId, 1.0, currentBelief.budget, 0, 0, []);

    this.nar.notifyListeners('belief-added', {
      hyperedgeId: termId,
      truth: currentBelief.truth,
      budget: currentBelief.budget,
      expectation: currentBelief.truth.expectation()
    });
    this.nar.questionHandler.checkQuestionAnswers(termId, currentBelief);

    return termId;
  }

  addToIndex(hyperedge) {
    if (!this.nar.state.index.byType.has(hyperedge.type)) {
        this.nar.state.index.byType.set(hyperedge.type, new Set());
    }
    this.nar.state.index.byType.get(hyperedge.type).add(hyperedge.id);

    hyperedge.args.forEach(arg => {
        const argId = getArgId(arg);
        if (typeof argId === 'string') {
            this.nar.state.index.byArg.add(argId, hyperedge.id);
        }
    });

    this.nar.state.index.structural.add(hyperedge);

    if (hyperedge.args.length > 1) {
      if (!this.nar.state.index.compound.has(hyperedge.type)) {
        this.nar.state.index.compound.set(hyperedge.type, new Map());
      }
      const compoundIndex = this.nar.state.index.compound.get(hyperedge.type);
      compoundIndex.set(hyperedge.id, new Set(hyperedge.args.map(arg => getArgId(arg))));
    }
  }

  /* ===== HELPERS ===== */
  getTruth(hyperedgeId) {
    const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
    return hyperedge ? hyperedge.getTruth() : null;
  }
  getBeliefs(hyperedgeId) {
    const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
    return hyperedge ? hyperedge.beliefs.map(b => ({ truth: b.truth, budget: b.budget, expectation: b.truth.expectation() })) : [];
  }
  getActivation(termId) {
    return this.nar.state.activations.get(termId) || 0;
  }
}
