import { TrieIndex } from './support/TrieIndex.js';
import { StructuralIndex } from './support/StructuralIndex.js';
import { LRUMap } from './support/LRUMap.js';
import { PriorityQueue } from './support/PriorityQueue.js';
import { ExpressionEvaluator } from './evaluator/ExpressionEvaluator.js';
import { MemoryManager } from './managers/MemoryManager.js';
import { ContradictionManager } from './managers/ContradictionManager.js';
import { MetaReasoner } from './managers/MetaReasoner.js';
import { LearningEngine } from './managers/LearningEngine.js';
import { ExplanationSystem } from './managers/ExplanationSystem.js';
import { TemporalManager } from './managers/TemporalManager.js';
import { Hyperedge } from './support/Hyperedge.js';
import { TruthValue } from './support/TruthValue.js';
import { Budget } from './support/Budget.js';
import { id, hash } from './support/utils.js';

export class NARHyper {
  constructor(config = {}) {
    this.config = Object.assign({
      decay: 0.1,
      budgetDecay: 0.8,
      inferenceThreshold: 0.3,
      maxPathLength: 15,
      beliefCapacity: 8,
      temporalHorizon: 3,
      budgetThreshold: 0.05,
      maxDerivationDepth: 5,
      expressionTimeout: 500,
      derivationCacheSize: 1000,
      questionTimeout: 3000
    }, config);

    this.hypergraph = new Map();
    this.index = {
      byType: new Map(),
      byArg: new TrieIndex(),
      temporal: new Map(),
      compound: new Map(),
      derivationCache: new LRUMap(this.config.derivationCacheSize),
      questionCache: new Map(),
      byPrefix: new Map(),
      byWord: new Map(),
      byNgram: new Map(),
      structural: new StructuralIndex(),
    };
    this.eventQueue = new PriorityQueue((a, b) => b.budget.priority - a.budget.priority);
    this.pathCache = new Map();
    this.activations = new Map();
    this.temporalLinks = new Map();
    this.expressionEvaluator = new ExpressionEvaluator(this);
    this.listeners = new Set();
    this.questionPromises = new Map();
    this.memoization = new Map();
    this.currentStep = 0;

    // Enhanced systems
    this.memoryManager = new MemoryManager(this);
    this.contradictionManager = new ContradictionManager(this);
    this.metaReasoner = new MetaReasoner(this);
    this.learningEngine = new LearningEngine(this);
    this.explanationSystem = new ExplanationSystem(this);
    this.temporalManager = new TemporalManager(this);

    // Maintenance interval
    this.memoryMaintenanceInterval = config.memoryMaintenanceInterval || 100;
    this.stepsSinceMaintenance = 0;

    this.distributed = {
        nodeId: config.nodeId || `node-${Math.random().toString(36).substr(2, 9)}`,
        cluster: new Set([this.nodeId]),
        knowledgePartition: new Map(),
        pendingRequests: new Map(),
        connectionManager: null
    };
    if (config.distributed) {
        this._initDistributedProcessing(config.distributed);
    }
  }

  /* ===== MACRO FUNCTIONS FOR COMMON PATTERNS ===== */

  nal(statement, options = {}) {
    if (!options.timestamp && this.temporalManager) {
        options.timestamp = Date.now();
    }
    if (!options.source && this.metaReasoner) {
        options.source = this.metaReasoner.getActiveStrategy ? this.metaReasoner.getActiveStrategy() : 'default';
    }
    return this.expressionEvaluator.parseAndAdd(statement, options);
  }

  nalq(question, options = {}) {
    if (!options.urgency) {
        options.urgency = this._assessQuestionUrgency(question);
    }
    if (!options.timeout) {
        options.timeout = this.config.questionTimeout * (1.5 - Math.min(1.0, options.urgency || 0.5));
    }
    return this.expressionEvaluator.parseQuestion(question, options);
  }

  seq(...terms) {
    const options = (typeof terms[terms.length-1] === 'object') ?
      terms.pop() : {};
    const timestamp = options.timestamp || Date.now();

    const context = options.context || this.temporalManager?.getContext?.() || {};

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
    if (question.includes('hazard') || question.includes('danger')) {
        return 0.9;
    }
    if (question.includes('?')) {
        return 0.7;
    }
    return 0.5;
  }

  when(premise, conclusion, options = {}) {
    return this.implication(premise, conclusion, options);
  }

  contextualRule(ruleId, contextId) {
      this._addContextAssociation(ruleId, contextId);
      return ruleId;
  }

  citedBelief(statement, citation) {
    const beliefId = this.nal(statement);
    this._storeCitation(beliefId, citation);
    return beliefId;
  }

  robustRule(premise, conclusion, exception, options = {}) {
    const baseRule = this.implication(premise, conclusion, {
      ...options,
      truth: options.truth || new TruthValue(0.9, 0.8)
    });

    const exceptionRule = this.implication(
      `${exception} && ${premise}`,
      `!${conclusion}`,
      {
        ...options,
        truth: new TruthValue(0.95, 0.85)
      }
    );

    this.equivalence(baseRule, `!${exceptionRule}`, {
      truth: TruthValue.certain().scale(0.7)
    });

    return { baseRule, exceptionRule };
  }

  _addTemporalContext(term, context, timestamp) {
      // Placeholder
  }

  _addContextAssociation(ruleId, contextId) {
      // Placeholder
  }

  _storeCitation(beliefId, citation) {
      // Placeholder
  }

  beliefTable(hyperedgeId) {
    return this.getBeliefs(hyperedgeId).map(b => ({
      frequency: b.truth.frequency.toFixed(2),
      confidence: b.truth.confidence.toFixed(2),
      priority: b.budget.priority.toFixed(2),
      expectation: b.truth.expectation().toFixed(2)
    }));
  }

  explain(hyperedgeId, options = {}) {
    return this.explanationSystem.explain(hyperedgeId, options);
  }

  compound(type, ...args) {
    return this.addHyperedge(type, args, {
      truth: TruthValue.certain(),
      budget: Budget.full().scale(0.7)
    });
  }

  imageExt(relation, arg, position = 1) {
    return this.addHyperedge('ImageExt', [relation, arg, position], {
      truth: TruthValue.certain().scale(0.8)
    });
  }

  imageInt(relation, arg, position = 1) {
    return this.addHyperedge('ImageInt', [relation, arg, position], {
      truth: TruthValue.certain().scale(0.8)
    });
  }

  truth(frequency, confidence, priority = 1.0) {
    return new TruthValue(frequency, confidence, priority);
  }

  budget(priority, durability, quality) {
    return new Budget(priority, durability, quality);
  }

  observe(term, truth = TruthValue.certain()) {
    const termId = this.term(term, { truth });
    const now = Date.now();
    this.temporalManager.interval(term, now, now+1, { truth });
    return termId;
  }

  queryBeliefs(pattern, { minExpectation = 0.5, limit = 10 } = {}) {
    return this.query(pattern)
      .filter(result => result.truth.expectation() >= minExpectation)
      .slice(0, limit);
  }

  derive(type, ...args) {
    const termId = id(type, args);
    this.propagate(termId, 0.9, Budget.full().scale(0.8), 0, 0, ['derivation_request']);
    return termId;
  }

  /* ===== PUBLIC API: STRUCTURAL OPERATIONS ===== */

  term(name, options = {}) {
    return this.addHyperedge('Term', [name], options);
  }

  inheritance(subject, predicate, options = {}) {
    return this.addHyperedge('Inheritance', [subject, predicate], options);
  }

  similarity(term1, term2, options = {}) {
    return this.addHyperedge('Similarity', [term1, term2], options);
  }

  instance(instance, concept, options = {}) {
    return this.addHyperedge('Instance', [instance, concept], options);
  }

  property(concept, property, options = {}) {
    return this.addHyperedge('Property', [concept, property], options);
  }

  implication(premise, conclusion, options = {}) {
    return this.addHyperedge('Implication', [premise, conclusion], options);
  }

  equivalence(premise, conclusion, options = {}) {
    return this.addHyperedge('Equivalence', [premise, conclusion], options);
  }

  conjunction(...terms) {
    return this.addHyperedge('Conjunction', terms, {
      truth: terms.every(t => t.truth?.frequency > 0.5)
        ? TruthValue.certain().scale(0.9)
        : new TruthValue(0.5, 0.5)
    });
  }

  disjunction(...terms) {
    return this.addHyperedge('Disjunction', terms, {
      truth: terms.some(t => t.truth?.frequency > 0.5)
        ? new TruthValue(0.7, 0.6)
        : new TruthValue(0.3, 0.4)
    });
  }

  product(...terms) {
    return this.addHyperedge('Product', terms, {
      truth: TruthValue.certain(),
      budget: Budget.full().scale(0.7)
    });
  }

  /* ===== PUBLIC API: TEMPORAL OPERATIONS ===== */

  after(premise, conclusion, options={}) {
    return this.temporalManager.temporalRelation(premise, conclusion, 'after', options);
  }

  before(premise, conclusion, options={}) {
    return this.temporalManager.temporalRelation(premise, conclusion, 'before', options);
  }

  simultaneous(premise, conclusion, options={}) {
    return this.temporalManager.temporalRelation(premise, conclusion, 'equals', options);
  }

  /* ===== PUBLIC API: PROCEDURAL OPERATIONS ===== */

  evaluate(expression, context = {}) {
    return this.expressionEvaluator.evaluate(expression, context);
  }

  query(pattern, options = { limit: 10 }) {
    return this.expressionEvaluator.query(pattern, options);
  }

  revise(hyperedgeId, newTruth, newBudget) {
    const hyperedge = this.hypergraph.get(hyperedgeId);
    if (hyperedge) {
      const result = hyperedge.revise(newTruth, newBudget || hyperedge.getStrongestBelief().budget, this.config.beliefCapacity);
      this.notifyListeners('revision', { hyperedgeId, newTruth, newBudget, ...result });

      if (result.needsUpdate) {
        this.contradictionManager.detectContradictions(hyperedgeId);
      }

      return result.needsUpdate;
    }
    return false;
  }

  getTruth(hyperedgeId) {
    const hyperedge = this.hypergraph.get(hyperedgeId);
    return hyperedge ? hyperedge.getTruth() : null;
  }

  getActivation(termId) {
    return this.activations.get(termId) || 0;
  }

  getBeliefs(hyperedgeId) {
    const hyperedge = this.hypergraph.get(hyperedgeId);
    return hyperedge ? hyperedge.beliefs.map(b => ({
      truth: b.truth,
      budget: b.budget,
      expectation: b.truth.expectation()
    })) : [];
  }

  /* ===== QUESTION HANDLING ===== */

  ask(question, options = {}) {
    const questionId = this.generateQuestionId(question);
    const { timeout = this.config.questionTimeout } = options;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.questionPromises.delete(questionId);
        this.learningEngine.recordExperience(
            { derivationPath: ['timeout'], target: questionId },
            { success: false }
        );
        reject(new Error(`Question timed out after ${timeout}ms: ${question}`));
      }, timeout);

      this.questionPromises.set(questionId, { resolve, reject, timer, options, answered: false });
      this._processQuestion(question, questionId);
    });
  }

  generateQuestionId(question) {
    return `Question(${question})|${Date.now()}`;
  }

  _processQuestion(question, questionId) {
    try {
      const { type, args, options } = this.expressionEvaluator.parseQuestionPattern(question);

      if (type === 'Inheritance') {
        const [subject, predicate] = args;

        if (subject.startsWith('$')) {
          this.index.byArg.get(predicate)?.forEach(hyperedgeId => {
            const hyperedge = this.hypergraph.get(hyperedgeId);
            if (hyperedge?.type === 'Inheritance' && hyperedge.args[1] === predicate) {
              this._answerQuestion(questionId, {
                type: 'Inheritance',
                args: [hyperedge.args[0], predicate],
                truth: hyperedge.getTruth()
              });
            }
          });
        }
        else if (predicate.startsWith('$')) {
          this.index.byArg.get(subject)?.forEach(hyperedgeId => {
            const hyperedge = this.hypergraph.get(hyperedgeId);
            if (hyperedge?.type === 'Inheritance' && hyperedge.args[0] === subject) {
              this._answerQuestion(questionId, {
                type: 'Inheritance',
                args: [subject, hyperedge.args[1]],
                truth: hyperedge.getTruth()
              });
            }
          });
        }
        else {
          this.derive('Inheritance', subject, predicate);
        }
      }

    } catch (e) {
      const promise = this.questionPromises.get(questionId);
      if (promise) {
        clearTimeout(promise.timer);
        this.questionPromises.delete(questionId);
        promise.reject(e);
      }
    }
  }

  _answerQuestion(questionId, answer) {
    const promise = this.questionPromises.get(questionId);
    if (!promise) return;

    if (!promise.answered) {
        this.learningEngine.recordExperience(
            { derivationPath: answer.derivationPath || ['answered'], target: questionId },
            { success: true, accuracy: answer.truth.expectation() }
        );
        promise.answered = true;
    }

    if (promise.options && promise.options.minExpectation &&
        answer.truth.expectation() >= promise.options.minExpectation) {
      clearTimeout(promise.timer);
      this.questionPromises.delete(questionId);
      promise.resolve(answer);
      return;
    }

    if (!this.index.questionCache.has(questionId)) {
      this.index.questionCache.set(questionId, []);
    }
    this.index.questionCache.get(questionId).push(answer);

    this.notifyListeners('question-answer', { questionId, answer });
  }

  _resolveQuestion(questionId) {
    const answers = this.index.questionCache.get(questionId) || [];
    if (answers.length === 0) return;

    const bestAnswer = answers.sort((a, b) =>
      b.truth.expectation() - a.truth.expectation())[0];

    const promise = this.questionPromises.get(questionId);
    if (promise) {
      clearTimeout(promise.timer);
      this.questionPromises.delete(questionId);
      promise.resolve(bestAnswer);
    }

    this.index.questionCache.delete(questionId);
  }

  /* ===== EVENT SYSTEM ===== */

  on(eventType, callback) {
    const listener = { eventType, callback };
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(eventType, data) {
    this.listeners.forEach(listener => {
      if (listener.eventType === eventType) {
        try {
          listener.callback(data);
        } catch (e) {
          console.error(`Listener error for ${eventType}:`, e);
        }
      }
    });
  }

  /* ===== INTERNAL IMPLEMENTATION ===== */

  addHyperedge(type, args, { truth, budget, priority } = {}) {
    const termId = id(type, args);
    const hyperedge = this.hypergraph.get(termId) ?? new Hyperedge(termId, type, args);

    if (!this.hypergraph.has(termId)) {
      this.hypergraph.set(termId, hyperedge);
      this.addToIndex(hyperedge);
    }

    const result = hyperedge.revise(
      truth || TruthValue.certain(),
      budget || Budget.full().scale(priority || 1.0),
      this.config.beliefCapacity
    );

    this.propagate(termId, 1.0, hyperedge.getStrongestBelief().budget, 0, 0, []);

    if (result.newBelief) {
      this.notifyListeners('belief-added', {
        hyperedgeId: termId,
        truth: result.newBelief.truth,
        budget: result.newBelief.budget,
        expectation: result.newBelief.truth.expectation()
      });

      this._checkQuestionAnswers(termId, result.newBelief);
    }

    return termId;
  }

  _checkQuestionAnswers(hyperedgeId, belief) {
    const hyperedge = this.hypergraph.get(hyperedgeId);
    if (!hyperedge) return;

    this.questionPromises.forEach((_, questionId) => {
      const { type, args } = this.expressionEvaluator.parseQuestionPattern(questionId.replace(/^Question\(|\|.*$/g, ''));

      if (type === hyperedge.type) {
        const matches = args.every((pattern, i) =>
          pattern === '*' ||
          pattern === hyperedge.args[i] ||
          (pattern.startsWith('$') && hyperedge.args[i])
        );

        if (matches) {
          this._answerQuestion(questionId, {
            type: hyperedge.type,
            args: hyperedge.args,
            truth: belief.truth
          });
        }
      }
    });
  }

  step() {
    this.currentStep++;
    const event = this.eventQueue.pop();
    if (!event || event.budget.priority < this.config.budgetThreshold) return false;

    this.memoryManager.updateRelevance(event.target, 'processing', event.budget.priority);

    this._updateActivation(event.target, event.activation);
    this._applyDerivationRules(event);
    this._propagateWave(event);

    this.learningEngine.recordExperience(event);

    this.notifyListeners('step', {
      step: this.currentStep,
      event,
      activation: this.activations.get(event.target),
      queueSize: this.eventQueue.heap.length
    });

    this.questionPromises.forEach((_, questionId) => {
      if (this.currentStep % 10 === 0) {
        this._resolveQuestion(questionId);
      }
    });

    this.stepsSinceMaintenance++;
    if (this.stepsSinceMaintenance >= this.memoryMaintenanceInterval) {
        this._runMaintenance();
        this.stepsSinceMaintenance = 0;
    }

    return true;
  }

  run(maxSteps = Infinity, callback = () => {}) {
    let steps = 0;
    while (steps < maxSteps && this.step()) {
      callback(this, steps++);
      if (steps % 100 === 0) this._cleanup();
    }
    return steps;
  }

  /* ===== DERIVATION SYSTEM ===== */

  _propagateWave({ target, activation, budget, pathHash, pathLength, derivationPath }) {
    const hyperedge = this.hypergraph.get(target);

    if (hyperedge) {
      hyperedge.args.forEach(arg =>
        this._propagateToTerm(hyperedge, arg, activation, budget, pathHash, pathLength, derivationPath)
      );
      this.temporalManager.processTemporalConstraints(target, activation, budget, pathHash, pathLength, derivationPath);
    } else {
      if (typeof target === 'string') {
        (this.index.byArg.get(target) || new Set()).forEach(id =>
            this._propagateToHyperedge(id, activation, budget, pathHash, pathLength, derivationPath)
        );
      }
    }
  }

  _applyDerivationRules(event) {
    const { target, activation, budget, pathHash, pathLength, derivationPath } = event;
    const hyperedge = this.hypergraph.get(target);
    if (!hyperedge || activation <= this.config.inferenceThreshold || pathLength > this.config.maxDerivationDepth) return;

    const rules = {
      'Inheritance': () => this._deriveInheritance(hyperedge, event),
      'Similarity': () => this._deriveSimilarity(hyperedge, event),
      'Implication': () => this._deriveImplication(hyperedge, event),
      'Equivalence': () => this._deriveEquivalence(hyperedge, event),
      'Conjunction': () => this._deriveConjunction(hyperedge, event),
      'Disjunction': () => this._deriveDisjunction(hyperedge, event),
      'Product': () => this._deriveProduct(hyperedge, event),
      'ImageExt': () => this._deriveImageExt(hyperedge, event),
      'ImageInt': () => this._deriveImageInt(hyperedge, event),
      'Term': () => this._deriveTerm(hyperedge, event)
    }[hyperedge.type];

    rules && rules();
  }

  _getArgId(arg) {
      if (typeof arg === 'string') return arg;
      if (arg && arg.type && arg.args) return id(arg.type, arg.args);
      if (arg !== null && arg !== undefined) return String(arg);
      return 'undefined_arg';
  }

  _deriveInheritance({ args: [subject, predicate] }, event) {
    const subjectId = this._getArgId(subject);
    const predicateId = this._getArgId(predicate);
    const { activation, budget, pathHash, pathLength, derivationPath } = event;

    // Transitivity
    (this.index.byArg.get(predicateId) || new Set()).forEach(termId => {
      const middle = this.hypergraph.get(termId);
      if (middle?.type === 'Inheritance' && this._getArgId(middle.args[1]) === subjectId) {
        this._deriveTransitiveInheritance(middle.args[0], predicate, middle,
          this.hypergraph.get(id('Inheritance', [subject, predicate])),
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });

    this.similarity(subject, predicate, { budget: budget.scale(0.6) });

    // Property Inheritance
    if (this.hypergraph.has(id('Instance', [subject, 'entity']))) {
      (this.index.byArg.get(predicateId) || new Set()).forEach(propId => {
        const property = this.hypergraph.get(propId);
        if (property?.type === 'Property') {
          this._propagate(id('Property', [subject, property.args[1]]),
            activation * 0.6, budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'property_derivation']);
        }
      });
    }

    // Induction
    (this.index.byArg.get(predicateId) || new Set()).forEach(termId => {
      const other = this.hypergraph.get(termId);
      if (other?.type === 'Inheritance' && this._getArgId(other.args[1]) === predicateId && this._getArgId(other.args[0]) !== subjectId) {
        this._deriveInduction(subject, other.args[0], predicate,
          this.hypergraph.get(id('Inheritance', [subject, predicate])),
          other,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
  }

  _deriveTransitiveInheritance(subject, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath) {
    const subjectId = this._getArgId(subject);
    const predicateId = this._getArgId(predicate);
    const key = this._memoKey('Inheritance', [subjectId, predicateId], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);

    const cacheKey = `${subjectId}→${predicateId}|${premise1.id}|${premise2.id}`;
    if (this.index.derivationCache.has(cacheKey)) return;
    this.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.transitive(premise1.getTruth(), premise2.getTruth());
    this.inheritance(subject, predicate, { truth, budget: budget.scale(0.7) });
  }

  _deriveInduction(term1, term2, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath) {
    const term1Id = this._getArgId(term1);
    const term2Id = this._getArgId(term2);
    const predicateId = this._getArgId(predicate);
    const key = this._memoKey('Similarity', [term1Id, term2Id], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);

    const cacheKey = `${term1Id}↔${term2Id}|induction|${predicateId}`;
    if (this.index.derivationCache.has(cacheKey)) return;
    this.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.induction(premise1.getTruth(), premise2.getTruth());
    this.similarity(term1, term2, { truth, budget: budget.scale(0.6) });
  }

  _deriveSimilarity({ args: [term1, term2] }, event) {
    const term1Id = this._getArgId(term1);
    const term2Id = this._getArgId(term2);
    const { activation, budget, pathHash, pathLength, derivationPath } = event;

    this.propagate(id('Similarity', [term2, term1]),
      activation, budget.scale(0.9), pathHash, pathLength + 1, [...derivationPath, 'symmetry']);

    (this.index.byArg.get(term1Id) || new Set()).forEach(termId => {
      const premise = this.hypergraph.get(termId);
      if (premise?.type === 'Inheritance' && this._getArgId(premise.args[0]) === term1Id) {
        this._deriveAnalogy(term1, term2, premise.args[1],
          this.hypergraph.get(id('Similarity', [term1, term2])),
          premise,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
  }

  _deriveAnalogy(term1, term2, predicate, similarity, premise, activation, budget, pathHash, pathLength, derivationPath) {
    const term2Id = this._getArgId(term2);
    const predicateId = this._getArgId(predicate);
    const key = this._memoKey('Inheritance', [term2Id, predicateId], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);

    const truth = TruthValue.analogy(similarity.getTruth(), premise.getTruth());
    this.inheritance(term2, predicate, { truth, budget: budget.scale(0.6) });
  }

  _deriveImplication({ args: [premise, conclusion] }, event) {
      const premiseId = this._getArgId(premise);
      if (this.hypergraph.has(premiseId)) {
          this.propagate(id(conclusion.type, conclusion.args), event.activation * 0.9, event.budget.scale(0.75),
              event.pathHash, event.pathLength + 1, [...event.derivationPath, 'modus_ponens']);
      }
  }

  _deriveEquivalence({ args: [term1, term2] }, event) {
      this.implication(term1, term2, {
          truth: event.hyperedge.getTruth(),
          budget: event.budget.scale(0.8)
      });
      this.implication(term2, term1, {
          truth: event.hyperedge.getTruth(),
          budget: event.budget.scale(0.8)
      });
  }

  _deriveConjunction({ args }, event) {
    args.forEach(term =>
      this.propagate(this._getArgId(term), event.activation * 0.9, event.budget.scale(0.75),
        event.pathHash, event.pathLength + 1, [...event.derivationPath, 'conjunction_decomposition'])
    );
  }

  _deriveDisjunction({ args }, event) {
      // Placeholder
  }
  _deriveProduct({ args }, event) {
      // Placeholder
  }
  _deriveImageExt({ args }, event) {
      // Placeholder
  }
  _deriveImageInt({ args }, event) {
      // Placeholder
  }
  _deriveTerm(hyperedge, event) {
      // Placeholder
  }

  _propagateToTerm(hyperedge, term, activation, budget, pathHash, pathLength, derivationPath) {
    this.propagate(
      this._getArgId(term),
      activation * hyperedge.getTruthExpectation(),
      budget.scale(this.config.budgetDecay),
      pathHash ^ hash(String(this._getArgId(term))),
      pathLength + 1,
      [...derivationPath, 'structural_propagation']
    );
  }

  _propagateToHyperedge(hyperedgeId, activation, budget, pathHash, pathLength, derivationPath) {
    this.propagate(
      hyperedgeId,
      activation,
      budget.scale(this.config.budgetDecay),
      pathHash ^ hash(String(hyperedgeId)),
      pathLength + 1,
      [...derivationPath, 'procedural_propagation']
    );
  }

  propagate(target, activation, budget, pathHash, pathLength, derivationPath) {
    if (budget.priority < this.config.budgetThreshold ||
        pathLength > this.config.maxPathLength ||
        this._hasLoop(target, pathHash)) return;

    this.eventQueue.push({
      target,
      activation: Math.min(activation, 1.0),
      budget,
      pathHash,
      pathLength,
      derivationPath
    });
  }

  _hasLoop(id, pathHash) {
    const cache = this.pathCache.get(id) || new Set();
    if (cache.has(pathHash)) return true;
    this.pathCache.set(id, cache.add(pathHash));
    return false;
  }

  _updateActivation(id, activation) {
    this.activations.set(id, (1 - this.config.decay) * (this.activations.get(id) || 0) + this.config.decay * activation);
  }

  _memoKey(type, args, pathHash) {
    return `${id(type, args)}|${pathHash}`;
  }

  addToIndex(hyperedge) {
    if (!this.index.byType.has(hyperedge.type)) {
        this.index.byType.set(hyperedge.type, new Set());
    }
    this.index.byType.get(hyperedge.type).add(hyperedge.id);

    hyperedge.args.forEach(arg => {
        const argId = this._getArgId(arg);
        if (typeof argId === 'string') {
            this.index.byArg.add(argId, hyperedge.id);
        }
    });

    this.index.structural.add(hyperedge);

    if (hyperedge.args.length > 1) {
      if (!this.index.compound.has(hyperedge.type)) {
        this.index.compound.set(hyperedge.type, new Map());
      }
      const compoundIndex = this.index.compound.get(hyperedge.type);
      compoundIndex.set(hyperedge.id, new Set(hyperedge.args.map(arg => this._getArgId(arg))));
    }
  }

  _cleanup() {
    if (Math.random() < 0.1) {
      for (const [id, cache] of this.pathCache) {
        if (cache.size > 1000) {
          this.pathCache.set(id, new Set([...cache].slice(-500)));
        }
      }

      for (const [questionId, answers] of this.index.questionCache) {
        if (answers.length > 10) {
          this.index.questionCache.set(questionId, answers.slice(-5));
        }
      }
    }
  }

  _runMaintenance() {
    this.memoryManager.maintainMemory();
    this.contradictionManager.resolveContradictions();
    this.metaReasoner.optimizeResources();
    this.learningEngine.applyLearning();
  }
}
