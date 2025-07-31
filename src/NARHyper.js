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

  contextualRule(premise, conclusion, contextId, options = {}) {
    const ruleId = this.implication(premise, conclusion, options);
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
      expectation: b.expectation.toFixed(2)
    }));
  }

  explain(hyperedgeId, depth = 3) {
    return this.explanationSystem.explain(hyperedgeId, { depth });
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
        reject(new Error(`Question timed out after ${timeout}ms: ${question}`));
      }, timeout);

      this.questionPromises.set(questionId, { resolve, reject, timer, options });
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

    if (promise.options.minExpectation &&
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

  _deriveInheritance({ args: [subject, predicate] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    (this.index.byArg.get(predicate) || new Set()).forEach(termId => {
      const middle = this.hypergraph.get(termId);
      if (middle?.type === 'Inheritance' && middle.args[1] === subject) {
        this._deriveTransitiveInheritance(middle.args[0], predicate, middle,
          this.hypergraph.get(id('Inheritance', [subject, predicate])),
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });

    this.similarity(subject, predicate, { budget: budget.scale(0.6) });

    if (this.hypergraph.has(id('Instance', [subject, 'entity']))) {
      (this.index.byArg.get(predicate) || new Set()).forEach(propId => {
        const property = this.hypergraph.get(propId);
        if (property?.type === 'Property') {
          this._propagate(id('Property', [subject, property.args[1]]),
            activation * 0.6, budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'property_derivation']);
        }
      });
    }

    (this.index.byArg.get(predicate) || new Set()).forEach(termId => {
      const other = this.hypergraph.get(termId);
      if (other?.type === 'Inheritance' && other.args[1] === predicate && other.args[0] !== subject) {
        this._deriveInduction(subject, other.args[0], predicate,
          this.hypergraph.get(id('Inheritance', [subject, predicate])),
          other,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });

    (this.index.byArg.get(predicate) || new Set()).forEach(termId => {
      const other = this.hypergraph.get(termId);
      if (other?.type === 'Inheritance' &&
          other.args[0] === subject &&
          other.args[1] === predicate &&
          termId !== id('Inheritance', [subject, predicate])) {
        this._deriveRevision(subject, predicate,
          this.hypergraph.get(id('Inheritance', [subject, predicate])),
          other,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
  }

  _deriveTransitiveInheritance(subject, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath) {
    const key = this._memoKey('Inheritance', [subject, predicate], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);

    const cacheKey = `${subject}→${predicate}|${premise1.id}|${premise2.id}`;
    if (this.index.derivationCache.has(cacheKey)) return;
    this.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.transitive(premise1.getTruth(), premise2.getTruth());
    this.inheritance(subject, predicate, { truth, budget: budget.scale(0.7) });
    this.propagate(id('Inheritance', [subject, predicate]),
      activation * 0.8, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'transitivity']);
  }

  _deriveInduction(term1, term2, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath) {
    const key = this._memoKey('Similarity', [term1, term2], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);

    const cacheKey = `${term1}↔${term2}|induction|${predicate}`;
    if (this.index.derivationCache.has(cacheKey)) return;
    this.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.induction(premise1.getTruth(), premise2.getTruth());
    this.similarity(term1, term2, { truth, budget: budget.scale(0.6) });
    this.propagate(id('Similarity', [term1, term2]),
      activation * 0.6, budget.scale(0.6), pathHash, pathLength + 1, [...derivationPath, 'induction']);
  }

  _deriveRevision(subject, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath) {
    const key = this._memoKey('Inheritance', [subject, predicate], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);

    const cacheKey = `${subject}→${predicate}|revision|${premise1.id}|${premise2.id}`;
    if (this.index.derivationCache.has(cacheKey)) return;
    this.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.revise(premise1.getTruth(), premise2.getTruth());
    this.inheritance(subject, predicate, { truth, budget: budget.scale(0.8) });
    this.propagate(id('Inheritance', [subject, predicate]),
      activation * 0.9, budget.scale(0.8), pathHash, pathLength + 1, [...derivationPath, 'revision']);
  }

  _deriveSimilarity({ args: [term1, term2] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    this.propagate(id('Similarity', [term2, term1]),
      activation, budget.scale(0.9), pathHash, pathLength + 1, [...derivationPath, 'symmetry']);

    (this.index.byArg.get(term1) || new Set()).forEach(termId => {
      const premise = this.hypergraph.get(termId);
      if (premise?.type === 'Inheritance') {
        const [pSubject, pPredicate] = premise.args;
        const newPredicate = pSubject === term1 ? term2 : (pPredicate === term1 ? term2 : null);
        if (newPredicate) {
          this._deriveTransitiveInheritance(
            pSubject === term1 ? term2 : term1,
            newPredicate,
            premise,
            this.hypergraph.get(id('Similarity', [term1, term2])),
            activation,
            budget,
            pathHash,
            pathLength,
            derivationPath
          );
        }
      }
    });

    (this.index.byArg.get(term2) || new Set()).forEach(termId => {
      const premise = this.hypergraph.get(termId);
      if (premise?.type === 'Inheritance' && premise.args[0] === term2) {
        this._deriveAbduction(term1, term2, premise.args[1],
          this.hypergraph.get(id('Similarity', [term1, term2])),
          premise,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });

    (this.index.byArg.get(term1) || new Set()).forEach(termId => {
      const premise = this.hypergraph.get(termId);
      if (premise?.type === 'Inheritance' && premise.args[0] === term1) {
        this._deriveAnalogy(term1, term2, premise.args[1],
          this.hypergraph.get(id('Similarity', [term1, term2])),
          premise,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
  }

  _deriveAbduction(subject, similar, predicate, similarity, premise, activation, budget, pathHash, pathLength, derivationPath) {
    const key = this._memoKey('Inheritance', [subject, predicate], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);

    const cacheKey = `${subject}→${predicate}|abduction|${similar}`;
    if (this.index.derivationCache.has(cacheKey)) return;
    this.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.abduction(similarity.getTruth(), premise.getTruth());
    this.inheritance(subject, predicate, { truth, budget: budget.scale(0.6) });
    this.propagate(id('Inheritance', [subject, predicate]),
      activation * 0.6, budget.scale(0.6), pathHash, pathLength + 1, [...derivationPath, 'abduction']);
  }

  _deriveAnalogy(term1, term2, predicate, similarity, premise, activation, budget, pathHash, pathLength, derivationPath) {
    const key = this._memoKey('Inheritance', [term2, predicate], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);

    const cacheKey = `${term2}→${predicate}|analogy|${term1}`;
    if (this.index.derivationCache.has(cacheKey)) return;
    this.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.analogy(similarity.getTruth(), premise.getTruth());
    this.inheritance(term2, predicate, { truth, budget: budget.scale(0.6) });
    this.propagate(id('Inheritance', [term2, predicate]),
      activation * 0.6, budget.scale(0.6), pathHash, pathLength + 1, [...derivationPath, 'analogy']);
  }

  _deriveImplication({ args: [premise, conclusion] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    if (this.hypergraph.has(id('Term', [premise]))) {
      this.propagate(conclusion, activation * 0.9, budget.scale(0.75),
        pathHash, pathLength + 1, [...derivationPath, 'modus_ponens']);
    }

    (this.index.byArg.get(premise) || new Set()).forEach(termId => {
      const middle = this.hypergraph.get(termId);
      if (middle?.type === 'Implication' && middle.args[1] === premise) {
        this._deriveTransitiveImplication(middle.args[0], conclusion, middle,
          this.hypergraph.get(id('Implication', [premise, conclusion])),
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });

    this.propagate(id('Implication', [`!${conclusion}`, `!${premise}`]),
      activation * 0.6, budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'contraposition']);

    this.propagate(id('Inheritance', [`(${premise}&&${conclusion})`, 'truth']),
      activation * 0.5, budget.scale(0.4), pathHash, pathLength + 1, [...derivationPath, 'material_implication']);

    if (premise.includes('&&')) {
      const terms = premise.split('&&').map(t => t.trim());
      terms.forEach(term => {
        this.propagate(id('Implication', [term, conclusion]),
          activation * 0.4, budget.scale(0.3), pathHash, pathLength + 1, [...derivationPath, 'implication_composition']);
      });
    }
  }

  _deriveTransitiveImplication(premise, conclusion, rule1, rule2, activation, budget, pathHash, pathLength, derivationPath) {
    const key = this._memoKey('Implication', [premise, conclusion], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);

    const cacheKey = `${premise}⇒${conclusion}|${rule1.id}|${rule2.id}`;
    if (this.index.derivationCache.has(cacheKey)) return;
    this.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.transitive(rule1.getTruth(), rule2.getTruth());
    this.implication(premise, conclusion, { truth, budget: budget.scale(0.7) });
    this.propagate(id('Implication', [premise, conclusion]),
      activation * 0.8, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'implication_transitivity']);
  }

  _deriveEquivalence({ args: [term1, term2] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    this.implication(term1, term2, {
      truth: this.hypergraph.get(id('Equivalence', [term1, term2])).getTruth(),
      budget: budget.scale(0.8)
    });
    this.implication(term2, term1, {
      truth: this.hypergraph.get(id('Equivalence', [term1, term2])).getTruth(),
      budget: budget.scale(0.8)
    });

    this.propagate(id('Implication', [term1, term2]),
      activation * 0.85, budget.scale(0.8), pathHash, pathLength + 1, [...derivationPath, 'equivalence_to_implication']);
    this.propagate(id('Implication', [term2, term1]),
      activation * 0.85, budget.scale(0.8), pathHash, pathLength + 1, [...derivationPath, 'equivalence_to_implication']);
  }

  _deriveConjunction({ args }, { activation, budget, pathHash, pathLength, derivationPath }) {
    args.forEach(term =>
      this.propagate(term, activation * 0.9, budget.scale(0.75),
        pathHash, pathLength + 1, [...derivationPath, 'conjunction_decomposition'])
    );

    if (args.length > 1) {
      const activeTerms = args.filter(t => (this.activations.get(t) || 0) > 0.4);
      if (activeTerms.length > 1) {
        const conjunctionId = id('Conjunction', activeTerms);
        const newTruth = activeTerms.every(t => this.hypergraph.get(id('Term', [t]))?.getTruth().frequency > 0.7)
          ? TruthValue.certain().scale(0.85)
          : new TruthValue(0.6, 0.5);

        this.conjunction(...activeTerms);
        this.propagate(conjunctionId, activation * 0.7, budget.scale(0.6),
          pathHash, pathLength + 1, [...derivationPath, 'conjunction_formation']);
      }
    }
  }

  _deriveDisjunction({ args }, { activation, budget, pathHash, pathLength, derivationPath }) {
    args.forEach(term => {
      const otherTerms = args.filter(t => t !== term);
      if (otherTerms.length > 0) {
        this.propagate(id('Disjunction', [term, `(${otherTerms.join('|')})`]),
          activation * 0.7, budget.scale(0.6), pathHash, pathLength + 1, [...derivationPath, 'disjunction_introduction']);
      }
    });

    if (args.length === 2) {
      const [term1, term2] = args;
      (this.index.byArg.get(term1) || new Set()).forEach(termId => {
        const implication1 = this.hypergraph.get(termId);
        if (implication1?.type === 'Implication' && implication1.args[0] === term1) {
          (this.index.byArg.get(term2) || new Set()).forEach(id2 => {
            const implication2 = this.hypergraph.get(id2);
            if (implication2?.type === 'Implication' && implication2.args[0] === term2) {
              if (implication1.args[1] === implication2.args[1]) {
                this.propagate(implication1.args[1], activation * 0.5,
                  budget.scale(0.4), pathHash, pathLength + 1, [...derivationPath, 'disjunction_elimination']);
              }
            }
          });
        }
      });
    }
  }

  _deriveProduct({ args }, { activation, budget, pathHash, pathLength, derivationPath }) {
    if (args.length === 2) {
      const [arg1, arg2] = args;
      this.inheritance(arg1, `(${arg2}-->`, {
        truth: new TruthValue(0.9, 0.8),
        budget: budget.scale(0.7)
      });
      this.propagate(id('Inheritance', [arg1, `(${arg2}-->`]),
        activation * 0.8, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'product_decomposition']);
    }

    if (args.length > 1) {
      const productId = id('Product', args);
      args.forEach((arg, i) => {
        const otherArgs = [...args.slice(0, i), ...args.slice(i + 1)];
        const imageExtId = id('ImageExt', [productId, arg, i + 1]);
        this.imageExt(productId, arg, i + 1);
        this.propagate(imageExtId, activation * 0.6,
          budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'product_composition']);
      });
    }
  }

  _deriveImageExt({ args: [relation, arg, position] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    const positionNum = parseInt(position);
    const newTerm = `(/, ${relation}, ${'_'.repeat(positionNum - 1)})`;
    this.inheritance(arg, newTerm, {
      truth: TruthValue.certain().scale(0.8),
      budget: budget.scale(0.7)
    });
    this.propagate(id('Inheritance', [arg, newTerm]),
      activation * 0.75, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'imageExt_derivation']);
  }

  _deriveImageInt({ args: [relation, arg, position] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    const positionNum = parseInt(position);
    const newTerm = `(*, ${'_'.repeat(positionNum - 1)}, ${arg})`;
    this.inheritance(newTerm, relation, {
      truth: TruthValue.certain().scale(0.8),
      budget: budget.scale(0.7)
    });
    this.propagate(id('Inheritance', [newTerm, relation]),
      activation * 0.75, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'imageInt_derivation']);
  }

  _deriveTerm(hyperedge, { activation, budget, pathHash, pathLength, derivationPath }) {
    this.activations.forEach((act, otherTerm) => {
      if (act > 0.5 && otherTerm !== hyperedge.id && this.activations.get(hyperedge.id) > 0.5) {
        const productId = id('Product', [hyperedge.id, otherTerm]);
        this.product(hyperedge.id, otherTerm);
        this.propagate(productId, activation * 0.7, budget.scale(0.6),
          pathHash, pathLength + 1, [...derivationPath, 'product_formation']);
      }
    });

    const activeTerms = [...this.activations].filter(([_, act]) => act > 0.6).map(([term]) => term);
    if (activeTerms.length > 1) {
      this.conjunction(...activeTerms);
      this.propagate(id('Conjunction', activeTerms),
        activation * 0.6, budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'active_conjunction']);
    }

    this.questionPromises.forEach((_, questionId) => {
      const { type, args } = this.expressionEvaluator.parseQuestionPattern(
        questionId.replace(/^Question\(|\|.*$/g, '')
      );

      if (type === 'Term' && args[0] === hyperedge.id) {
        this._answerQuestion(questionId, {
          type: 'Term',
          args: [hyperedge.id],
          truth: hyperedge.getTruth()
        });
      }
    });
  }

  _propagateToTerm(hyperedge, termId, activation, budget, pathHash, pathLength, derivationPath) {
    this.propagate(
      termId,
      activation * hyperedge.getTruthExpectation(),
      budget.scale(this.config.budgetDecay),
      pathHash ^ hash(String(termId)),
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
        if (typeof arg === 'string') {
            this.index.byArg.add(arg, hyperedge.id);

            for (let i = 1; i <= Math.min(5, arg.length); i++) {
                const prefix = arg.substring(0, i);
                if (!this.index.byPrefix.has(prefix)) {
                    this.index.byPrefix.set(prefix, new Set());
                }
                this.index.byPrefix.get(prefix).add(hyperedge.id);
            }

            arg.split(/[\s_\-:]/).forEach(word => {
                if (word && word.length > 2) {
                    if (!this.index.byWord.has(word)) {
                        this.index.byWord.set(word, new Set());
                    }
                    this.index.byWord.get(word).add(hyperedge.id);
                }
            });

            for (let i = 0; i <= arg.length - 3; i++) {
                const ngram = arg.substring(i, i + 3);
                if (!this.index.byNgram.has(ngram)) {
                    this.index.byNgram.set(ngram, new Set());
                }
                this.index.byNgram.get(ngram).add(hyperedge.id);
            }
        }
    });

    this.index.structural.add(hyperedge);

    if (hyperedge.args.length > 1) {
      if (!this.index.compound.has(hyperedge.type)) {
        this.index.compound.set(hyperedge.type, new Map());
      }
      const compoundIndex = this.index.compound.get(hyperedge.type);
      compoundIndex.set(hyperedge.id, new Set(hyperedge.args));
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
