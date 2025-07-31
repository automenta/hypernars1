```javascript
class NARHyper {
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
      byArg: new Map(),
      temporal: new Map(),
      compound: new Map(),
      derivationCache: new LRUMap(this.config.derivationCacheSize),
      questionCache: new Map()
    };
    this.eventQueue = new PriorityQueue((a, b) => b.budget.priority - a.budget.priority);
    this.pathCache = new Map();
    this.activations = new Map();
    this.temporalLinks = new Map();
    this.expressionEvaluator = new ExpressionEvaluator(this);
    this.listeners = new Set();
    this.questionPromises = new Map();
    this.currentStep = 0;
  }

  /* ===== MACRO FUNCTIONS FOR COMMON PATTERNS ===== */
  
  /**
   * NAL statement creation (simplifies structural knowledge addition)
   * @example nal('<bird --> flyer>. %0.8;0.75%')
   */
  nal(statement, options = {}) {
    return this.expressionEvaluator.parseAndAdd(statement, options);
  }

  /**
   * NAL question creation (triggers inference to find answer)
   * @example nalq('<tweety --> flyer>?')
   * @returns Promise that resolves to best answer
   */
  nalq(question, options = {}) {
    return this.expressionEvaluator.parseQuestion(question, options);
  }

  /**
   * Create temporal sequence with automatic timestamps
   * @example seq('wake_up', 'turn_on(kitchen)', 'start_coffee')
   */
  seq(...terms) {
    const timestamp = Date.now();
    terms.slice(0, -1).forEach((term, i) => 
      this.after(term, terms[i + 1], timestamp + i * 1000)
    );
    return this._id('Sequence', terms);
  }

  /**
   * Create conditional rule (simplifies implication)
   * @example when('motion_detected(room)', 'turn_on(light)', { priority: 0.9 })
   */
  when(premise, conclusion, options = {}) {
    return this.implication(premise, conclusion, options);
  }

  /**
   * Get all beliefs for a term with readable format
   * @example beliefTable('Inheritance(penguin,flyer)')
   */
  beliefTable(hyperedgeId) {
    return this.getBeliefs(hyperedgeId).map(b => ({
      frequency: b.truth.frequency.toFixed(2),
      confidence: b.truth.confidence.toFixed(2),
      priority: b.budget.priority.toFixed(2),
      expectation: b.expectation.toFixed(2)
    }));
  }

  /**
   * Explain how a conclusion was derived
   * @example explain('Inheritance(tweety,flyer)')
   */
  explain(hyperedgeId, depth = 3) {
    const path = [];
    this._traceDerivation(hyperedgeId, path, depth);
    return path.map((step, i) => 
      `${'  '.repeat(i)}${step.type}(${step.args.join(',')}) [${step.truth.frequency.toFixed(2)}]`
    ).join('\n');
  }

  /**
   * Create a compound term
   * @example compound('Product', 'bird', 'wings')
   */
  compound(type, ...args) {
    return this._addHyperedge(type, args, {
      truth: TruthValue.certain(),
      budget: Budget.full().scale(0.7)
    });
  }

  /**
   * Create an image term (extensional)
   * @example imageExt('eats', 'worm', 2)
   */
  imageExt(relation, arg, position = 1) {
    return this._addHyperedge('ImageExt', [relation, arg, position], {
      truth: TruthValue.certain().scale(0.8)
    });
  }

  /**
   * Create an image term (intensional)
   * @example imageInt('eats', 'bird', 1)
   */
  imageInt(relation, arg, position = 1) {
    return this._addHyperedge('ImageInt', [relation, arg, position], {
      truth: TruthValue.certain().scale(0.8)
    });
  }

  /**
   * Create a truth value
   * @example truth(0.8, 0.75)
   */
  truth(frequency, confidence, priority = 1.0) {
    return new TruthValue(frequency, confidence, priority);
  }

  /**
   * Create a budget value
   * @example budget(0.9, 0.8, 0.85)
   */
  budget(priority, durability, quality) {
    return new Budget(priority, durability, quality);
  }

  /**
   * Add an observation with current timestamp
   * @example observe('motion_detected(living_room)')
   */
  observe(term, truth = TruthValue.certain()) {
    const termId = this.term(term, { truth });
    this._addTemporal('observation', term, 'simultaneous', Date.now());
    return termId;
  }

  /**
   * Query beliefs with filtering
   * @example queryBeliefs('Inheritance(*, flyer)', { minExpectation: 0.6 })
   */
  queryBeliefs(pattern, { minExpectation = 0.5, limit = 10 } = {}) {
    return this.query(pattern)
      .filter(result => result.truth.expectation() >= minExpectation)
      .slice(0, limit);
  }

  /**
   * Derive specific relationship
   * @example derive('Inheritance', 'tweety', 'flyer')
   */
  derive(type, ...args) {
    const id = this._id(type, args);
    this._propagate(id, 0.9, Budget.full().scale(0.8), 0, 0, ['derivation_request']);
    return id;
  }

  /* ===== PUBLIC API: STRUCTURAL OPERATIONS ===== */
  
  term(name, options = {}) {
    return this._addHyperedge('Term', [name], options);
  }

  inheritance(subject, predicate, options = {}) {
    return this._addHyperedge('Inheritance', [subject, predicate], options);
  }

  similarity(term1, term2, options = {}) {
    return this._addHyperedge('Similarity', [term1, term2], options);
  }

  instance(instance, concept, options = {}) {
    return this._addHyperedge('Instance', [instance, concept], options);
  }

  property(concept, property, options = {}) {
    return this._addHyperedge('Property', [concept, property], options);
  }

  implication(premise, conclusion, options = {}) {
    return this._addHyperedge('Implication', [premise, conclusion], options);
  }

  equivalence(premise, conclusion, options = {}) {
    return this._addHyperedge('Equivalence', [premise, conclusion], options);
  }

  conjunction(...terms) {
    return this._addHyperedge('Conjunction', terms, {
      truth: terms.every(t => t.truth?.frequency > 0.5) 
        ? TruthValue.certain().scale(0.9) 
        : new TruthValue(0.5, 0.5)
    });
  }

  disjunction(...terms) {
    return this._addHyperedge('Disjunction', terms, {
      truth: terms.some(t => t.truth?.frequency > 0.5) 
        ? new TruthValue(0.7, 0.6) 
        : new TruthValue(0.3, 0.4)
    });
  }

  product(...terms) {
    return this._addHyperedge('Product', terms, {
      truth: TruthValue.certain(),
      budget: Budget.full().scale(0.7)
    });
  }

  /* ===== PUBLIC API: TEMPORAL OPERATIONS ===== */
  
  after(premise, conclusion, timestamp = Date.now()) {
    return this._addTemporal(premise, conclusion, 'after', timestamp);
  }

  before(premise, conclusion, timestamp = Date.now()) {
    return this._addTemporal(premise, conclusion, 'before', timestamp);
  }

  simultaneous(premise, conclusion, timestamp = Date.now()) {
    return this._addTemporal(premise, conclusion, 'simultaneous', timestamp);
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
      const result = hyperedge.revise(newTruth, newBudget || hyperedge.getStrongestBelief().budget);
      this._notifyListeners('revision', { hyperedgeId, newTruth, newBudget, ...result });
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
    const questionId = this._generateQuestionId(question);
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
  
  _generateQuestionId(question) {
    return `Question(${question})|${Date.now()}`;
  }
  
  _processQuestion(question, questionId) {
    try {
      const { type, args, options } = this.expressionEvaluator.parseQuestionPattern(question);
      
      // For inheritance questions: <X --> Y>?
      if (type === 'Inheritance') {
        const [subject, predicate] = args;
        
        // If subject is variable, find all instances
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
        // If predicate is variable, find all properties
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
        // Specific query - trigger derivation
        else {
          this.derive('Inheritance', subject, predicate);
        }
      }
      
      // Handle other question types similarly
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
    
    // If we already have a good enough answer, resolve immediately
    if (promise.options.minExpectation && 
        answer.truth.expectation() >= promise.options.minExpectation) {
      clearTimeout(promise.timer);
      this.questionPromises.delete(questionId);
      promise.resolve(answer);
      return;
    }
    
    // Otherwise, collect answers until timeout
    if (!this.index.questionCache.has(questionId)) {
      this.index.questionCache.set(questionId, []);
    }
    
    this.index.questionCache.get(questionId).push(answer);
    
    // If this is the best answer so far, notify listeners
    this._notifyListeners('question-answer', { questionId, answer });
  }
  
  _resolveQuestion(questionId) {
    const answers = this.index.questionCache.get(questionId) || [];
    if (answers.length === 0) return;
    
    // Sort by expectation and return the best
    const bestAnswer = answers.sort((a, b) => 
      b.truth.expectation() - a.truth.expectation())[0];
    
    const promise = this.questionPromises.get(questionId);
    if (promise) {
      clearTimeout(promise.timer);
      this.questionPromises.delete(questionId);
      promise.resolve(bestAnswer);
    }
    
    // Clean up
    this.index.questionCache.delete(questionId);
  }

  /* ===== EVENT SYSTEM ===== */
  
  on(eventType, callback) {
    const listener = { eventType, callback };
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notifyListeners(eventType, data) {
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
  
  _addHyperedge(type, args, { truth, budget, priority } = {}) {
    const id = this._id(type, args);
    const hyperedge = this.hypergraph.get(id) ?? new Hyperedge(id, type, args);
    
    if (!this.hypergraph.has(id)) {
      this.hypergraph.set(id, hyperedge);
      this._addToIndex(hyperedge);
    }
    
    const result = hyperedge.revise(
      truth || TruthValue.certain(),
      budget || Budget.full().scale(priority || 1.0)
    );
    
    this._propagate(id, 1.0, hyperedge.getStrongestBelief().budget, 0, 0, []);
    
    if (result.newBelief) {
      this._notifyListeners('belief-added', { 
        hyperedgeId: id, 
        truth: result.newBelief.truth,
        budget: result.newBelief.budget,
        expectation: result.newBelief.truth.expectation()
      });
      
      // Check if this answers any pending questions
      this._checkQuestionAnswers(id, result.newBelief);
    }
    
    return id;
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

  _addTemporal(premise, conclusion, relation, timestamp) {
    const temporalId = this._id('Temporal', [premise, conclusion, relation]);
    this.temporalLinks.set(temporalId, { premise, conclusion, relation, timestamp });
    
    [premise, conclusion].forEach(t => 
      this.index.temporal.set(t, (this.index.temporal.get(t) || new Set()).add(temporalId))
    );
    
    return temporalId;
  }

  step() {
    this.currentStep++;
    const event = this.eventQueue.pop();
    if (!event || event.budget.priority < this.config.budgetThreshold) return false;
    
    this._updateActivation(event.target, event.activation);
    this._applyDerivationRules(event);
    this._propagateWave(event);
    
    this._notifyListeners('step', { 
      step: this.currentStep,
      event, 
      activation: this.activations.get(event.target),
      queueSize: this.eventQueue.heap.length 
    });
    
    // Check if any questions can be resolved
    this.questionPromises.forEach((_, questionId) => {
      if (this.currentStep % 10 === 0) {
        this._resolveQuestion(questionId);
      }
    });
    
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
      this._processTemporalLinks(target, activation, budget, pathHash, pathLength, derivationPath);
    } else {
      (this.index.byArg.get(target) || new Set()).forEach(id => 
        this._propagateToHyperedge(id, activation, budget, pathHash, pathLength, derivationPath)
      );
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
    // Transitive inheritance: <A --> B>, <B --> C> |- <A --> C>
    (this.index.byArg.get(predicate) || new Set()).forEach(id => {
      const middle = this.hypergraph.get(id);
      if (middle?.type === 'Inheritance' && middle.args[1] === subject) {
        this._deriveTransitiveInheritance(middle.args[0], predicate, middle, 
          this.hypergraph.get(this._id('Inheritance', [subject, predicate])),
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
    
    // Conversion: <A --> B> |- <B --> A>
    this._deriveSimilarity(predicate, subject, 
      this.hypergraph.get(this._id('Inheritance', [subject, predicate])),
      activation * 0.7, budget.scale(0.6), pathHash, pathLength, derivationPath);
    
    // Instance-property derivation
    if (this.hypergraph.has(this._id('Instance', [subject, 'entity']))) {
      (this.index.byArg.get(predicate) || new Set()).forEach(propId => {
        const property = this.hypergraph.get(propId);
        if (property?.type === 'Property') {
          this._propagate(this._id('Property', [subject, property.args[1]]), 
            activation * 0.6, budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'property_derivation']);
        }
      });
    }
    
    // Induction: <A --> B>, <C --> B> |- <A <-> C>
    (this.index.byArg.get(predicate) || new Set()).forEach(id => {
      const other = this.hypergraph.get(id);
      if (other?.type === 'Inheritance' && other.args[1] === predicate && other.args[0] !== subject) {
        this._deriveInduction(subject, other.args[0], predicate, 
          this.hypergraph.get(this._id('Inheritance', [subject, predicate])),
          other,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
    
    // Revision: <A --> B>, <A --> B> |- <A --> B>
    (this.index.byArg.get(predicate) || new Set()).forEach(id => {
      const other = this.hypergraph.get(id);
      if (other?.type === 'Inheritance' && 
          other.args[0] === subject && 
          other.args[1] === predicate &&
          id !== this._id('Inheritance', [subject, predicate])) {
        this._deriveRevision(subject, predicate, 
          this.hypergraph.get(this._id('Inheritance', [subject, predicate])),
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
    this._propagate(this._id('Inheritance', [subject, predicate]), 
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
    this._propagate(this._id('Similarity', [term1, term2]), 
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
    this._propagate(this._id('Inheritance', [subject, predicate]), 
      activation * 0.9, budget.scale(0.8), pathHash, pathLength + 1, [...derivationPath, 'revision']);
  }

  _deriveSimilarity({ args: [term1, term2] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    // Symmetry: <A <-> B> |- <B <-> A>
    this._propagate(this._id('Similarity', [term2, term1]), 
      activation, budget.scale(0.9), pathHash, pathLength + 1, [...derivationPath, 'symmetry']);
    
    // Inheritance derivation from similarity
    (this.index.byArg.get(term1) || new Set()).forEach(id => {
      const premise = this.hypergraph.get(id);
      if (premise?.type === 'Inheritance') {
        const [pSubject, pPredicate] = premise.args;
        const newPredicate = pSubject === term1 ? term2 : (pPredicate === term1 ? term2 : null);
        if (newPredicate) {
          this._deriveTransitiveInheritance(
            pSubject === term1 ? term2 : term1, 
            newPredicate, 
            premise, 
            this.hypergraph.get(this._id('Similarity', [term1, term2])),
            activation, 
            budget, 
            pathHash, 
            pathLength, 
            derivationPath
          );
        }
      }
    });
    
    // Abduction: <A <-> B>, <B --> C> |- <A --> C>
    (this.index.byArg.get(term2) || new Set()).forEach(id => {
      const premise = this.hypergraph.get(id);
      if (premise?.type === 'Inheritance' && premise.args[0] === term2) {
        this._deriveAbduction(term1, term2, premise.args[1], 
          this.hypergraph.get(this._id('Similarity', [term1, term2])),
          premise,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
    
    // Analogy: <A <-> B>, <A --> C> |- <B --> C>
    (this.index.byArg.get(term1) || new Set()).forEach(id => {
      const premise = this.hypergraph.get(id);
      if (premise?.type === 'Inheritance' && premise.args[0] === term1) {
        this._deriveAnalogy(term1, term2, premise.args[1], 
          this.hypergraph.get(this._id('Similarity', [term1, term2])),
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
    this._propagate(this._id('Inheritance', [subject, predicate]), 
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
    this._propagate(this._id('Inheritance', [term2, predicate]), 
      activation * 0.6, budget.scale(0.6), pathHash, pathLength + 1, [...derivationPath, 'analogy']);
  }

  _deriveImplication({ args: [premise, conclusion] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    // Modus ponens: <P ==> Q>, P |- Q
    if (this.hypergraph.has(this._id('Term', [premise]))) {
      this._propagate(conclusion, activation * 0.9, budget.scale(0.75), 
        pathHash, pathLength + 1, [...derivationPath, 'modus_ponens']);
    }
    
    // Implication transitivity
    (this.index.byArg.get(premise) || new Set()).forEach(id => {
      const middle = this.hypergraph.get(id);
      if (middle?.type === 'Implication' && middle.args[1] === premise) {
        this._deriveTransitiveImplication(middle.args[0], conclusion, middle, 
          this.hypergraph.get(this._id('Implication', [premise, conclusion])),
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
    
    // Contraposition: <P ==> Q> |- <!Q ==> !P>
    this._propagate(this._id('Implication', [`!${conclusion}`, `!${premise}`]), 
      activation * 0.6, budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'contraposition']);
    
    // Material implication conversion
    this._propagate(this._id('Inheritance', [`(${premise}&&${conclusion})`, 'truth']), 
      activation * 0.5, budget.scale(0.4), pathHash, pathLength + 1, [...derivationPath, 'material_implication']);
    
    // Implication composition
    if (premise.includes('&&')) {
      const terms = premise.split('&&').map(t => t.trim());
      terms.forEach(term => {
        this._propagate(this._id('Implication', [term, conclusion]), 
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
    this._propagate(this._id('Implication', [premise, conclusion]), 
      activation * 0.8, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'implication_transitivity']);
  }

  _deriveEquivalence({ args: [term1, term2] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    // Equivalence to implication in both directions
    this.implication(term1, term2, { 
      truth: this.hypergraph.get(this._id('Equivalence', [term1, term2])).getTruth(), 
      budget: budget.scale(0.8) 
    });
    this.implication(term2, term1, { 
      truth: this.hypergraph.get(this._id('Equivalence', [term1, term2])).getTruth(), 
      budget: budget.scale(0.8) 
    });
    
    this._propagate(this._id('Implication', [term1, term2]), 
      activation * 0.85, budget.scale(0.8), pathHash, pathLength + 1, [...derivationPath, 'equivalence_to_implication']);
    this._propagate(this._id('Implication', [term2, term1]), 
      activation * 0.85, budget.scale(0.8), pathHash, pathLength + 1, [...derivationPath, 'equivalence_to_implication']);
  }

  _deriveConjunction({ args }, { activation, budget, pathHash, pathLength, derivationPath }) {
    // Conjunction decomposition: (A && B) |- A, (A && B) |- B
    args.forEach(term => 
      this._propagate(term, activation * 0.9, budget.scale(0.75), 
        pathHash, pathLength + 1, [...derivationPath, 'conjunction_decomposition'])
    );
    
    // Conjunction formation from independent terms
    if (args.length > 1) {
      const activeTerms = args.filter(t => (this.activations.get(t) || 0) > 0.4);
      if (activeTerms.length > 1) {
        const conjunctionId = this._id('Conjunction', activeTerms);
        const newTruth = activeTerms.every(t => this.hypergraph.get(this._id('Term', [t]))?.getTruth().frequency > 0.7)
          ? TruthValue.certain().scale(0.85)
          : new TruthValue(0.6, 0.5);
          
        this.conjunction(...activeTerms);
        this._propagate(conjunctionId, activation * 0.7, budget.scale(0.6), 
          pathHash, pathLength + 1, [...derivationPath, 'conjunction_formation']);
      }
    }
  }

  _deriveDisjunction({ args }, { activation, budget, pathHash, pathLength, derivationPath }) {
    // Disjunction introduction
    args.forEach(term => {
      const otherTerms = args.filter(t => t !== term);
      if (otherTerms.length > 0) {
        this._propagate(this._id('Disjunction', [term, `(${otherTerms.join('|')})`]), 
          activation * 0.7, budget.scale(0.6), pathHash, pathLength + 1, [...derivationPath, 'disjunction_introduction']);
      }
    });
    
    // Disjunction elimination
    if (args.length === 2) {
      const [term1, term2] = args;
      (this.index.byArg.get(term1) || new Set()).forEach(id => {
        const implication1 = this.hypergraph.get(id);
        if (implication1?.type === 'Implication' && implication1.args[0] === term1) {
          (this.index.byArg.get(term2) || new Set()).forEach(id2 => {
            const implication2 = this.hypergraph.get(id2);
            if (implication2?.type === 'Implication' && implication2.args[0] === term2) {
              if (implication1.args[1] === implication2.args[1]) {
                this._propagate(implication1.args[1], activation * 0.5, 
                  budget.scale(0.4), pathHash, pathLength + 1, [...derivationPath, 'disjunction_elimination']);
              }
            }
          });
        }
      });
    }
  }

  _deriveProduct({ args }, { activation, budget, pathHash, pathLength, derivationPath }) {
    // Product decomposition: (A * B) |- <A --> (B -->)> 
    if (args.length === 2) {
      const [arg1, arg2] = args;
      this.inheritance(arg1, `(${arg2}-->`, { 
        truth: new TruthValue(0.9, 0.8), 
        budget: budget.scale(0.7) 
      });
      this._propagate(this._id('Inheritance', [arg1, `(${arg2}-->`]), 
        activation * 0.8, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'product_decomposition']);
    }
    
    // Product composition
    if (args.length > 1) {
      const productId = this._id('Product', args);
      args.forEach((arg, i) => {
        const otherArgs = [...args.slice(0, i), ...args.slice(i + 1)];
        const imageExtId = this._id('ImageExt', [productId, arg, i + 1]);
        this.imageExt(productId, arg, i + 1);
        this._propagate(imageExtId, activation * 0.6, 
          budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'product_composition']);
      });
    }
  }

  _deriveImageExt({ args: [relation, arg, position] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    // ImageExt derivation: <(*, X) --> R> |- <X --> (/, R, _,)> 
    const positionNum = parseInt(position);
    const newTerm = `(/, ${relation}, ${'_'.repeat(positionNum - 1)})`;
    this.inheritance(arg, newTerm, { 
      truth: TruthValue.certain().scale(0.8), 
      budget: budget.scale(0.7) 
    });
    this._propagate(this._id('Inheritance', [arg, newTerm]), 
      activation * 0.75, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'imageExt_derivation']);
  }

  _deriveImageInt({ args: [relation, arg, position] }, { activation, budget, pathHash, pathLength, derivationPath }) {
    // ImageInt derivation: <X --> (/, R, _,)> |- <(*, X) --> R>
    const positionNum = parseInt(position);
    const newTerm = `(*, ${'_'.repeat(positionNum - 1)}, ${arg})`;
    this.inheritance(newTerm, relation, { 
      truth: TruthValue.certain().scale(0.8), 
      budget: budget.scale(0.7) 
    });
    this._propagate(this._id('Inheritance', [newTerm, relation]), 
      activation * 0.75, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'imageInt_derivation']);
  }

  _deriveTerm(hyperedge, { activation, budget, pathHash, pathLength, derivationPath }) {
    // Product formation: A, B |- (A * B)
    this.activations.forEach((act, otherTerm) => {
      if (act > 0.5 && otherTerm !== hyperedge.id && this.activations.get(hyperedge.id) > 0.5) {
        const productId = this._id('Product', [hyperedge.id, otherTerm]);
        this.product(hyperedge.id, otherTerm);
        this._propagate(productId, activation * 0.7, budget.scale(0.6), 
          pathHash, pathLength + 1, [...derivationPath, 'product_formation']);
      }
    });
    
    // Conjunction formation from active terms
    const activeTerms = [...this.activations].filter(([_, act]) => act > 0.6).map(([term]) => term);
    if (activeTerms.length > 1) {
      this.conjunction(...activeTerms);
      this._propagate(this._id('Conjunction', activeTerms), 
        activation * 0.6, budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'active_conjunction']);
    }
    
    // Check if this term answers any questions
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

  _processTemporalLinks(target, activation, budget, pathHash, pathLength, derivationPath) {
    const temporalLinks = this.index.temporal.get(target) || new Set();
    const now = Date.now();
    
    for (const linkId of temporalLinks) {
      const { premise, conclusion, relation, timestamp } = this.temporalLinks.get(linkId);
      const timeDelta = (now - timestamp) / 1000; // seconds
      
      if (timeDelta <= this.config.temporalHorizon) {
        const temporalActivation = activation * Math.exp(-0.2 * timeDelta);
        const temporalBudget = budget.scale(0.8);
        
        switch(relation) {
          case 'after': 
            this._propagate(conclusion, temporalActivation, temporalBudget, 
              pathHash, pathLength + 1, [...derivationPath, 'temporal_after']); 
            break;
          case 'before': 
            this._propagate(premise, temporalActivation, temporalBudget, 
              pathHash, pathLength + 1, [...derivationPath, 'temporal_before']); 
            break;
          case 'simultaneous': 
            this._propagate(conclusion, temporalActivation, temporalBudget, 
              pathHash, pathLength + 1, [...derivationPath, 'temporal_simultaneous']);
            this._propagate(premise, temporalActivation, temporalBudget, 
              pathHash, pathLength + 1, [...derivationPath, 'temporal_simultaneous']);
            break;
        }
      }
    }
  }

  _propagateToTerm(hyperedge, termId, activation, budget, pathHash, pathLength, derivationPath) {
    this._propagate(
      termId, 
      activation * hyperedge.getTruthExpectation(), 
      budget.scale(this.config.budgetDecay), 
      pathHash ^ this._hash(termId), 
      pathLength + 1, 
      [...derivationPath, 'structural_propagation']
    );
  }

  _propagateToHyperedge(hyperedgeId, activation, budget, pathHash, pathLength, derivationPath) {
    this._propagate(
      hyperedgeId, 
      activation, 
      budget.scale(this.config.budgetDecay), 
      pathHash ^ this._hash(hyperedgeId), 
      pathLength + 1, 
      [...derivationPath, 'procedural_propagation']
    );
  }

  _propagate(target, activation, budget, pathHash, pathLength, derivationPath) {
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

  _id(type, args) {
    return `${type}(${args.join(',')})`;
  }

  _memoKey(type, args, pathHash) {
    return `${this._id(type, args)}|${pathHash}`;
  }

  _addToIndex(hyperedge) {
    // Index by type
    if (!this.index.byType.has(hyperedge.type)) {
      this.index.byType.set(hyperedge.type, new Set());
    }
    this.index.byType.get(hyperedge.type).add(hyperedge.id);
    
    // Index by arguments
    hyperedge.args.forEach(arg => {
      if (!this.index.byArg.has(arg)) {
        this.index.byArg.set(arg, new Set());
      }
      this.index.byArg.get(arg).add(hyperedge.id);
    });
    
    // Index compound terms
    if (hyperedge.args.length > 1) {
      if (!this.index.compound.has(hyperedge.type)) {
        this.index.compound.set(hyperedge.type, new Map());
      }
      const compoundIndex = this.index.compound.get(hyperedge.type);
      compoundIndex.set(hyperedge.id, new Set(hyperedge.args));
    }
  }

  _hash(str) {
    return [...str].reduce((h, c) => ((h << 5) - h + c.codePointAt(0)) >>> 0, 0);
  }

  _traceDerivation(hyperedgeId, path, depth) {
    if (depth <= 0) return;
    
    const hyperedge = this.hypergraph.get(hyperedgeId);
    if (!hyperedge) return;
    
    path.push({
      id: hyperedge.id,
      type: hyperedge.type,
      args: hyperedge.args,
      truth: hyperedge.getTruth()
    });
    
    // Find potential derivation sources
    if (hyperedge.type === 'Inheritance') {
      const [subject, predicate] = hyperedge.args;
      
      // Check for transitive derivation
      (this.index.byArg.get(predicate) || new Set()).forEach(id => {
        const middle = this.hypergraph.get(id);
        if (middle?.type === 'Inheritance' && middle.args[1] === subject) {
          this._traceDerivation(middle.id, path, depth - 1);
          return;
        }
      });
      
      // Check for similarity conversion
      if (this.hypergraph.has(this._id('Similarity', [predicate, subject]))) {
        this._traceDerivation(this._id('Similarity', [predicate, subject]), path, depth - 1);
      }
      
      // Check for induction source
      (this.index.byArg.get(predicate) || new Set()).forEach(id => {
        const other = this.hypergraph.get(id);
        if (other?.type === 'Inheritance' && other.args[1] === predicate && other.args[0] !== subject) {
          this._traceDerivation(other.id, path, depth - 1);
          return;
        }
      });
    }
    
    // For other types, look for premises that could have led to this conclusion
    // This would be expanded for each derivation rule
  }
  
  _cleanup() {
    // Clear expired path cache entries
    if (Math.random() < 0.1) { // Occasionally
      for (const [id, cache] of this.pathCache) {
        if (cache.size > 1000) {
          this.pathCache.set(id, new Set([...cache].slice(-500)));
        }
      }
      
      // Clean up question cache
      for (const [questionId, answers] of this.index.questionCache) {
        if (answers.length > 10) {
          this.index.questionCache.set(questionId, answers.slice(-5));
        }
      }
    }
  }
}

/* ===== SUPPORT CLASSES ===== */

class LRUMap {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.map = new Map();
  }
  
  get(key) {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  
  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    this.map.set(key, value);
    return this;
  }
  
  has(key) {
    return this.map.has(key);
  }
}

class Hyperedge {
  constructor(id, type, args) {
    this.id = id;
    this.type = type;
    this.args = args;
    this.beliefs = [];
  }

  revise(truth, budget) {
    // Find existing belief with equivalent budget
    const existing = this.beliefs.find(b => b.budget.equivalent(budget));
    const newBelief = existing 
      ? { truth: TruthValue.revise(existing.truth, truth), budget: budget.merge(existing.budget) }
      : { truth, budget };
    
    // Check if this is a meaningful update
    const needsUpdate = !existing || 
      Math.abs(newBelief.truth.frequency - existing.truth.frequency) > 0.05 ||
      newBelief.budget.priority > existing.budget.priority;
    
    if (needsUpdate) {
      // Add new belief
      this.beliefs = [...this.beliefs.filter(b => !b.budget.equivalent(budget)), newBelief]
        .sort((a, b) => b.budget.priority - a.budget.priority)
        .slice(0, NARHyper.config.beliefCapacity);
      
      return { newBelief, needsUpdate: true };
    }
    
    return { needsUpdate: false };
  }

  getStrongestBelief() {
    return this.beliefs[0];
  }

  getTruth() {
    return this.beliefs.length ? this.beliefs[0].truth : TruthValue.unknown();
  }

  getTruthExpectation() {
    return this.beliefs.length ? this.beliefs[0].truth.expectation() : 0.5;
  }
}

class TruthValue {
  constructor(frequency, confidence, priority = 1.0) {
    this.frequency = Math.clamp(frequency, 0, 1);
    this.confidence = Math.clamp(confidence, 0, 1);
    this.priority = Math.clamp(priority, 0, 1);
  }

  expectation() {
    const { confidence } = this;
    return this.frequency * confidence / (confidence + (1 - confidence));
  }

  scale(factor) {
    return new TruthValue(
      Math.clamp(this.frequency * factor, 0, 1),
      Math.clamp(this.confidence * factor, 0, 1),
      Math.clamp(this.priority * factor, 0, 1)
    );
  }

  static revise(t1, t2) {
    const total = t1.priority + t2.priority;
    return new TruthValue(
      (t1.frequency * t1.priority + t2.frequency * t2.priority) / total,
      (t1.confidence * t1.priority + t2.confidence * t2.priority) / total,
      Math.min(total, 1.0)
    );
  }

  static transitive(t1, t2) {
    const f1 = t1.frequency, c1 = t1.confidence;
    const f2 = t2.frequency, c2 = t2.confidence;
    
    const frequency = f1 * f2;
    const confidence = c1 * c2 * Math.max(0, 1 - Math.abs(f1 - f2));
    
    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority) * 0.8);
  }
  
  static induction(t1, t2) {
    const f1 = t1.frequency, c1 = t1.confidence;
    const f2 = t2.frequency, c2 = t2.confidence;
    
    const frequency = (f1 + f2) / 2;
    const confidence = c1 * c2 * (1 - Math.abs(f1 - f2));
    
    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority) * 0.7);
  }
  
  static abduction(t1, t2) {
    const f1 = t1.frequency, c1 = t1.confidence;
    const f2 = t2.frequency, c2 = t2.confidence;
    
    const frequency = f2;
    const confidence = c1 * c2;
    
    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority) * 0.7);
  }
  
  static analogy(t1, t2) {
    const f1 = t1.frequency, c1 = t1.confidence;
    const f2 = t2.frequency, c2 = t2.confidence;
    
    const frequency = f2;
    const confidence = c1 * c2;
    
    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority) * 0.7);
  }

  static certain() {
    return new TruthValue(1.0, 0.9, 1.0);
  }

  static unknown() {
    return new TruthValue(0.5, 0.1, 0.1);
  }
}

class Budget {
  constructor(priority, durability, quality) {
    this.priority = Math.clamp(priority, 0, 1);
    this.durability = Math.clamp(durability, 0, 1);
    this.quality = Math.clamp(quality, 0, 1);
  }

  total() {
    return (this.priority + this.durability + this.quality) / 3;
  }

  scale(factor) {
    return new Budget(
      Math.clamp(this.priority * factor, 0, 1),
      Math.clamp(this.durability * factor, 0, 1),
      Math.clamp(this.quality * factor, 0, 1)
    );
  }

  merge(other) {
    return new Budget(
      (this.priority + other.priority) / 2,
      (this.durability + other.durability) / 2,
      (this.quality + other.quality) / 2
    );
  }

  equivalent(other) {
    const threshold = 0.05;
    return Math.abs(this.priority - other.priority) < threshold &&
           Math.abs(this.durability - other.durability) < threshold &&
           Math.abs(this.quality - other.quality) < threshold;
  }

  static full() {
    return new Budget(1.0, 1.0, 1.0);
  }
}

class PriorityQueue {
  constructor(comparator = (a, b) => b.budget.priority - a.budget.priority) {
    this.heap = [];
    this.comparator = comparator;
  }

  push(item) {
    this.heap.push(item);
    this._siftUp();
  }

  pop() {
    if (this.heap.length === 0) return null;
    const [top, bottom] = [this.heap[0], this.heap.pop()];
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._siftDown();
    }
    return top;
  }

  _siftUp() {
    let idx = this.heap.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.comparator(this.heap[idx], this.heap[parent]) < 0) {
        [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
        idx = parent;
      } else {
        break;
      }
    }
  }

  _siftDown() {
    let idx = 0;
    const length = this.heap.length;
    const element = this.heap[0];

    while (true) {
      let swap = null;
      const left = (idx << 1) + 1;
      const right = left + 1;

      if (left < length && this.comparator(this.heap[left], element) < 0) {
        swap = left;
      }
      
      if (right < length && 
         (swap === null ? this.comparator(this.heap[right], element) < 0 
                        : this.comparator(this.heap[right], this.heap[left]) < 0)) {
        swap = right;
      }

      if (swap === null) break;
      [this.heap[idx], this.heap[swap]] = [this.heap[swap], this.heap[idx]];
      idx = swap;
    }
  }
}

class ExpressionEvaluator {
  constructor(nar) {
    this.nar = nar;
  }

  evaluate(expression, context = {}) {
    try {
      return this._parseExpression(expression, context);
    } catch (e) {
      console.error(`Expression evaluation failed: ${expression}`, e);
      return null;
    }
  }

  query(pattern, options = { limit: 10 }) {
    const { limit } = options;
    const results = [];
    
    // Handle different pattern types
    if (pattern.includes('-->') || pattern.includes('<->')) {
      // Match inheritance/similarity patterns
      const operator = pattern.includes('-->') ? '-->' : '<->';
      const [leftPattern, rightPattern] = pattern.split(operator).map(p => p.trim());
      
      const type = operator === '-->' ? 'Inheritance' : 'Similarity';
      this.nar.index.byType.get(type)?.forEach(id => {
        const hyperedge = this.nar.hypergraph.get(id);
        if (hyperedge) {
          const [left, right] = hyperedge.args;
          
          if ((leftPattern === '*' || this._matchesPattern(left, leftPattern)) &&
              (rightPattern === '*' || this._matchesPattern(right, rightPattern))) {
            results.push({
              id,
              type,
              left,
              right,
              truth: hyperedge.getTruth(),
              activation: this.nar.getActivation(id)
            });
          }
        }
      });
    } 
    else if (pattern.includes('==>')) {
      // Match implication patterns
      const [premisePattern, conclusionPattern] = pattern.split('==>').map(p => p.trim());
      
      this.nar.index.byType.get('Implication')?.forEach(id => {
        const hyperedge = this.nar.hypergraph.get(id);
        if (hyperedge) {
          const [premise, conclusion] = hyperedge.args;
          
          if ((premisePattern === '*' || this._matchesPattern(premise, premisePattern)) &&
              (conclusionPattern === '*' || this._matchesPattern(conclusion, conclusionPattern))) {
            results.push({
              id,
              type: 'Implication',
              premise,
              conclusion,
              truth: hyperedge.getTruth(),
              activation: this.nar.getActivation(id)
            });
          }
        }
      });
    }
    else if (pattern.includes('*')) {
      // Match compound terms
      const basePattern = pattern.replace(/\*/g, '');
      this.nar.hypergraph.forEach((hyperedge, id) => {
        if (hyperedge.type.includes(basePattern) || 
            hyperedge.args.some(arg => arg.includes(basePattern))) {
          results.push({
            id,
            type: hyperedge.type,
            args: hyperedge.args,
            truth: hyperedge.getTruth(),
            activation: this.nar.getActivation(id)
          });
        }
      });
    }
    
    return results.slice(0, limit);
  }

  parseAndAdd(nalStatement, options = {}) {
    const { type, args, truth } = this.parseNAL(nalStatement);
    return this.nar._addHyperedge(type, args, { 
      truth, 
      budget: options.budget || Budget.full().scale(options.priority || 1.0) 
    });
  }

  parseQuestion(question, options = {}) {
    const questionId = this.nar._generateQuestionId(question);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.nar.questionPromises.delete(questionId);
        reject(new Error(`Question timed out after ${this.nar.config.questionTimeout}ms: ${question}`));
      }, this.nar.config.questionTimeout);
      
      this.nar.questionPromises.set(questionId, { resolve, reject, timer, options });
      this._processQuestion(question, questionId);
    });
  }
  
  _processQuestion(question, questionId) {
    try {
      const { type, args, options } = this.parseQuestionPattern(question);
      
      // For inheritance questions: <X --> Y>?
      if (type === 'Inheritance') {
        const [subject, predicate] = args;
        
        // If subject is variable, find all instances
        if (subject.startsWith('$')) {
          this.nar.index.byArg.get(predicate)?.forEach(hyperedgeId => {
            const hyperedge = this.nar.hypergraph.get(hyperedgeId);
            if (hyperedge?.type === 'Inheritance' && hyperedge.args[1] === predicate) {
              this.nar._answerQuestion(questionId, {
                type: 'Inheritance',
                args: [hyperedge.args[0], predicate],
                truth: hyperedge.getTruth()
              });
            }
          });
        } 
        // If predicate is variable, find all properties
        else if (predicate.startsWith('$')) {
          this.nar.index.byArg.get(subject)?.forEach(hyperedgeId => {
            const hyperedge = this.nar.hypergraph.get(hyperedgeId);
            if (hyperedge?.type === 'Inheritance' && hyperedge.args[0] === subject) {
              this.nar._answerQuestion(questionId, {
                type: 'Inheritance',
                args: [subject, hyperedge.args[1]],
                truth: hyperedge.getTruth()
              });
            }
          });
        }
        // Specific query - trigger derivation
        else {
          this.nar.derive('Inheritance', subject, predicate);
        }
      }
      // Handle other question types similarly
      else if (type === 'Term') {
        const term = args[0];
        const hyperedge = this.nar.hypergraph.get(`Term(${term})`);
        if (hyperedge) {
          this.nar._answerQuestion(questionId, {
            type: 'Term',
            args: [term],
            truth: hyperedge.getTruth()
          });
        } else {
          this.nar.term(term);
        }
      }
    } catch (e) {
      const promise = this.nar.questionPromises.get(questionId);
      if (promise) {
        clearTimeout(promise.timer);
        this.nar.questionPromises.delete(questionId);
        promise.reject(e);
      }
    }
  }

  parseQuestionPattern(question) {
    const trimmed = question.trim().replace(/\?$/, '');
    
    if (trimmed.startsWith('<') && trimmed.includes('-->') && trimmed.endsWith('>')) {
      // Inheritance question
      const inner = trimmed.slice(1, -1);
      const [subject, predicate] = inner.split('-->').map(s => s.trim());
      return { type: 'Inheritance', args: [subject, predicate] };
    }
    
    if (trimmed.startsWith('<') && trimmed.includes('<->') && trimmed.endsWith('>')) {
      // Similarity question
      const inner = trimmed.slice(1, -1);
      const [term1, term2] = inner.split('<->').map(s => s.trim());
      return { type: 'Similarity', args: [term1, term2] };
    }
    
    // Term question
    return { type: 'Term', args: [trimmed] };
  }

  parseNAL(statement) {
    // Parse simple NAL statements
    const trimmed = statement.trim();
    
    // Handle truth value annotations
    let truth = TruthValue.certain();
    let content = trimmed;
    
    const truthMatch = trimmed.match(/%([\d.]+);([\d.]+)%/);
    if (truthMatch) {
      truth = new TruthValue(parseFloat(truthMatch[1]), parseFloat(truthMatch[2]));
      content = trimmed.replace(truthMatch[0], '').trim();
    }
    
    // Handle different statement types
    if (content.startsWith('<') && content.includes('-->') && content.endsWith('>.')) {
      // Inheritance statement
      const inner = content.slice(1, -2);
      const [subject, predicate] = inner.split('-->').map(s => s.trim());
      return { type: 'Inheritance', args: [subject, predicate], truth };
    }
    
    if (content.startsWith('<') && content.includes('<->') && content.endsWith('>.')) {
      // Similarity statement
      const inner = content.slice(1, -2);
      const [term1, term2] = inner.split('<->').map(s => s.trim());
      return { type: 'Similarity', args: [term1, term2], truth };
    }
    
    if (content.startsWith('<') && content.includes('==>') && content.endsWith('>.') && !content.includes('<=>')) {
      // Implication statement
      const inner = content.slice(1, -2);
      const [premise, conclusion] = inner.split('==>').map(s => s.trim());
      return { type: 'Implication', args: [premise, conclusion], truth };
    }
    
    if (content.startsWith('<') && content.includes('<=>') && content.endsWith('>.')) {
      // Equivalence statement
      const inner = content.slice(1, -2);
      const [premise, conclusion] = inner.split('<=>').map(s => s.trim());
      return { type: 'Equivalence', args: [premise, conclusion], truth };
    }
    
    if (content.includes('&&') && !content.includes('==>')) {
      // Conjunction
      const terms = content.split('&&').map(t => t.trim());
      return { type: 'Conjunction', args: terms, truth };
    }
    
    if (content.includes('||')) {
      // Disjunction
      const terms = content.split('||').map(t => t.trim());
      return { type: 'Disjunction', args: terms, truth };
    }
    
    // Product
    if (content.startsWith('(') && content.includes('*') && content.endsWith(')')) {
      const terms = content.slice(1, -1).split('*').map(t => t.trim());
      return { type: 'Product', args: terms, truth };
    }
    
    // ImageExt
    if (content.includes('(/') && content.includes(',')) {
      const match = content.match(/\(\/, ([^,]+), ([^)]+)\)/);
      if (match) {
        return { type: 'ImageExt', args: [match[1], match[2], '1'], truth };
      }
    }
    
    // ImageInt
    if (content.includes('(*') && content.includes(',')) {
      const match = content.match(/\(\*, ([^,]+), ([^)]+)\)/);
      if (match) {
        return { type: 'ImageInt', args: [match[1], match[2], '1'], truth };
      }
    }
    
    // Default to Term
    return { type: 'Term', args: [content.replace(/\.$/, '')], truth };
  }

  _parseExpression(expr, context) {
    expr = expr.trim();
    
    // Handle logical operators
    if (expr.includes('&&')) {
      return expr.split('&&').every(subExpr => 
        this._parseExpression(subExpr, context));
    }
    
    if (expr.includes('||')) {
      return expr.split('||').some(subExpr => 
        this._parseExpression(subExpr, context));
    }
    
    if (expr.startsWith('!')) {
      return !this._parseExpression(expr.substring(1), context);
    }
    
    // Handle implication
    if (expr.includes('==>')) {
      const [premise, conclusion] = expr.split('==>').map(e => e.trim());
      return this._parseExpression(premise, context) 
        ? this._parseExpression(conclusion, context) 
        : true; // Vacuously true
    }
    
    // Handle variables
    if (expr.startsWith('$')) {
      return context[expr.substring(1)] || false;
    }
    
    // Check term existence with truth threshold
    if (expr.endsWith('?)')) {
      const term = expr.slice(0, -2);
      const belief = this.nar.getBeliefs(`Term(${term})`)[0];
      return belief ? belief.expectation > 0.5 : false;
    }
    
    // Check term existence
    return this.nar.hypergraph.has(`Term(${expr})`) || 
           this.nar.hypergraph.has(`Inheritance(${expr},*)`);
  }

  _matchesPattern(term, pattern) {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return term.startsWith(pattern.slice(0, -1));
    }
    if (pattern.startsWith('*')) {
      return term.endsWith(pattern.slice(1));
    }
    return term === pattern;
  }
}

/* ===== EXAMPLE USAGE: COMPLETE NARS APPLICATION ===== */

/**
 * Autonomous Vehicle Reasoning System using NARHyper
 * Demonstrates:
 * - Full NAL syntax support
 * - Advanced derivation rules (induction, abduction, analogy)
 * - NAL question processing
 * - Contradictory evidence handling
 * - Explanation tracing
 * - Event listeners
 */

// Initialize the NAR system
const vehicleReasoning = new NARHyper({
  decay: 0.1,
  budgetDecay: 0.75,
  inferenceThreshold: 0.2,
  maxPathLength: 25,
  beliefCapacity: 12,
  temporalHorizon: 10,
  questionTimeout: 5000
});

// Listen for belief additions
vehicleReasoning.on('belief-added', ({ hyperedgeId, truth, expectation }) => {
  if (hyperedgeId.includes('hazard') && expectation > 0.7) {
    console.log(`\x1b[31m⚠️ Critical hazard detected: ${hyperedgeId} (expectation: ${expectation.toFixed(2)})\x1b[0m`);
  }
});

// Listen for question answers
vehicleReasoning.on('question-answer', ({ questionId, answer }) => {
  const question = questionId.replace(/^Question\(|\|.*$/g, '');
  if (question.includes('hazard') && answer.truth.expectation() > 0.6) {
    console.log(`\x1b[33m❓ Answer to "${question}": ${answer.type}(${answer.args.join(',')}) [${answer.truth.expectation().toFixed(2)}]\x1b[0m`);
  }
});

// ===== 1. DEFINE VEHICLE ONTOLOGY (USING NAL SYNTAX) =====

console.log('Loading vehicle knowledge base...');

// Road elements
vehicleReasoning.nal('<road --> surface>. %0.95;0.9%');
vehicleReasoning.nal('<intersection --> road>. %0.9;0.85%');
vehicleReasoning.nal('<pedestrian_crossing --> road>. %0.85;0.8%');
vehicleReasoning.nal('<traffic_light --> control_device>. %0.95;0.9%');
vehicleReasoning.nal('<stop_sign --> control_device>. %0.9;0.85%');

// Vehicle states
vehicleReasoning.nal('<moving --> vehicle_state>. %0.9;0.85%');
vehicleReasoning.nal('<stopped --> vehicle_state>. %0.9;0.85%');
vehicleReasoning.nal('<turning_left --> vehicle_state>. %0.8;0.75%');
vehicleReasoning.nal('<turning_right --> vehicle_state>. %0.8;0.75%');

// Hazards
vehicleReasoning.nal('<pedestrian --> hazard>. %0.85;0.8%');
vehicleReasoning.nal('<cyclist --> hazard>. %0.8;0.75%');
vehicleReasoning.nal('<stopped_vehicle --> hazard>. %0.75;0.7%');
vehicleReasoning.nal('<red_light --> hazard>. %0.9;0.85%');
vehicleReasoning.nal('<yellow_light --> hazard>. %0.7;0.65%');

// Relationships
vehicleReasoning.nal('<red_light --> stop_required>. %0.95;0.9%');
vehicleReasoning.nal('<yellow_light --> slow_down>. %0.9;0.85%');
vehicleReasoning.nal('<green_light --> proceed>. %0.95;0.9%');
vehicleReasoning.nal('<pedestrian --> yield_required>. %0.9;0.85%');
vehicleReasoning.nal('<cyclist --> caution_required>. %0.85;0.8%');

// Similarities
vehicleReasoning.nal('<pedestrian <-> cyclist>. %0.6;0.65%');
vehicleReasoning.nal('<red_light <-> stop_sign>. %0.5;0.55%');

// Implications
vehicleReasoning.nal('<red_light ==> stop_required>. %0.95;0.9%');
vehicleReasoning.nal('<yellow_light ==> slow_down>. %0.9;0.85%');
vehicleReasoning.nal('<green_light ==> proceed>. %0.95;0.9%');
vehicleReasoning.nal('<pedestrian ==> yield_required>. %0.9;0.85%');
vehicleReasoning.nal('<cyclist ==> caution_required>. %0.85;0.8%');
vehicleReasoning.nal('<intersection && red_light ==> stop_required>. %0.92;0.88%');
vehicleReasoning.nal('<pedestrian_crossing && pedestrian ==> yield_required>. %0.93;0.89%');

// ===== 2. SIMULATE VEHICLE SENSORS =====

console.log('\nSimulating vehicle sensors...');

// Current context
vehicleReasoning.observe('at_intersection', vehicleReasoning.truth(1.0, 0.95));
vehicleReasoning.observe('traffic_light_state=red', vehicleReasoning.truth(0.95, 0.9));
vehicleReasoning.observe('pedestrian_detected', vehicleReasoning.truth(0.85, 0.8));

// Add temporal sequence
const driveStart = Date.now();
vehicleReasoning.seq(
  'vehicle_starts', 
  'approaches_intersection', 
  'detects_traffic_light', 
  'detects_pedestrian', 
  'makes_decision'
);

// ===== 3. PROCESS VEHICLE DECISIONS =====

console.log('\nProcessing vehicle decisions...');

// Ask critical questions
const hazardPromise = vehicleReasoning.nalq('<$x --> hazard>?', { minExpectation: 0.6 });
const actionPromise = vehicleReasoning.nalq('<$x --> required_action>?', { minExpectation: 0.7 });

// Run inference engine
const steps = vehicleReasoning.run(500, (nar, step) => {
  if (step % 100 === 0) process.stdout.write(`.`);
});

console.log(`\nCompleted ${steps} inference steps\n`);

// ===== 4. DISPLAY DECISION RESULTS =====

console.log('===== VEHICLE DECISION RESULTS =====\n');

// Get hazard analysis
hazardPromise.then(answer => {
  console.log('Identified hazards:');
  console.log(`- ${answer.args[0]} (expectation: ${answer.truth.expectation().toFixed(2)})`);
  
  // Show reasoning path
  console.log('\nReasoning path for hazard identification:');
  console.log(vehicleReasoning.explain(`Inheritance(${answer.args[0]},hazard)`));
  
  // Show belief table
  console.log('\nBelief table:');
  console.table(vehicleReasoning.beliefTable(`Inheritance(${answer.args[0]},hazard)`));
});

// Get required action
actionPromise.then(answer => {
  console.log('\nRequired action:');
  console.log(`- ${answer.args[0]}`);
  
  // Check if we need to stop
  if (vehicleReasoning.evaluate('stop_required?')) {
    console.log('\n\x1b[32m✅ Decision: Full stop required\x1b[0m');
  } else if (vehicleReasoning.evaluate('slow_down?')) {
    console.log('\n\x1b[33m⚠️ Decision: Slow down required\x1b[0m');
  } else {
    console.log('\n\x1b[34m➡️ Decision: Safe to proceed\x1b[0m');
  }
});

// ===== 5. SIMULATE NEW SENSOR DATA =====

console.log('\n\nSimulating new sensor data...');

// Update with more precise information
vehicleReasoning.revise(
  'Inheritance(pedestrian,hazard)',
  vehicleReasoning.truth(0.95, 0.92),
  vehicleReasoning.budget(0.95, 0.9, 0.92)
);

vehicleReasoning.observe('pedestrian_crossing_street', vehicleReasoning.truth(0.9, 0.85));

// Run additional inference
vehicleReasoning.run(100);

// ===== 6. FINAL DECISION =====

console.log('\n\n===== FINAL DECISION =====');

// Check if pedestrian is crossing
if (vehicleReasoning.evaluate('pedestrian_crossing_street?')) {
  console.log('Pedestrian is actively crossing the street');
  console.log('Final action: \x1b[31m🛑 FULL STOP REQUIRED\x1b[0m');
} else {
  console.log('Pedestrian is on sidewalk but not crossing');
  console.log('Final action: \x1b[33m⚠️ Prepare to stop\x1b[0m');
}

// ===== 7. MACRO FUNCTION DEMONSTRATION =====

console.log('\n\n===== MACRO FUNCTION DEMONSTRATION =====');

// Using nalq() macro for complex query
vehicleReasoning.nalq('<($x && $y) --> required_action>?', { minExpectation: 0.65 })
  .then(answer => {
    console.log('\nComplex query result:');
    console.log(`When ${answer.args[0]} and ${answer.args[1]}, required action is ${answer.args[2]}`);
  });

// Using compound() macro
const turningScenario = vehicleReasoning.compound('Product', 'at_intersection', 'turning_right');
console.log(`\nCreated compound term: ${turningScenario}`);

// Using image macros
const imageExtId = vehicleReasoning.imageExt('required_action', 'turning_right', 2);
const imageIntId = vehicleReasoning.imageInt('required_action', 'at_intersection', 1);
console.log('Created image terms:');
console.log(`- ImageExt: ${imageExtId}`);
console.log(`- ImageInt: ${imageIntId}`);

// Run final inference
vehicleReasoning.run(50);

console.log('\n\nVehicle reasoning system complete. Ready for deployment!');
```