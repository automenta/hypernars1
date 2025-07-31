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
      maxBeliefRevision: 3,
      expressionTimeout: 500,
      derivationCacheSize: 1000
    }, config);

    this.hypergraph = new Map();
    this.index = {
      byType: new Map(),
      byArg: new Map(),
      temporal: new Map(),
      compound: new Map(),
      derivationCache: new LRUMap(this.config.derivationCacheSize)
    };
    this.eventQueue = new PriorityQueue((a, b) => b.budget.priority - a.budget.priority);
    this.pathCache = new Map();
    this.activations = new Map();
    this.temporalLinks = new Map();
    this.expressionEvaluator = new ExpressionEvaluator(this);
    this.listeners = new Set();
  }

  /* ===== MACRO FUNCTIONS FOR COMMON PATTERNS ===== */
  
  /**
   * NAL statement creation (simplifies structural knowledge addition)
   * @example nal('<bird --> flyer>. %0.8;0.75%')
   */
  nal(statement, options = {}) {
    const { type, args, truth, budget } = this.expressionEvaluator.parseNAL(statement);
    return this._addHyperedge(type, args, { truth, budget, ...options });
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

  imageExt(relation, arg, position = 1) {
    return this._addHyperedge('ImageExt', [relation, arg, position], {
      truth: TruthValue.certain().scale(0.8)
    });
  }

  imageInt(relation, arg, position = 1) {
    return this._addHyperedge('ImageInt', [relation, arg, position], {
      truth: TruthValue.certain().scale(0.8)
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
      hyperedge.revise(newTruth, newBudget || hyperedge.getStrongestBelief().budget);
      this._notifyListeners('revision', { hyperedgeId, newTruth, newBudget });
      return true;
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
        budget: result.newBelief.budget 
      });
    }
    
    return id;
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
    const event = this.eventQueue.pop();
    if (!event || event.budget.priority < this.config.budgetThreshold) return false;
    
    this._updateActivation(event.target, event.activation);
    this._applyDerivationRules(event);
    this._propagateWave(event);
    
    this._notifyListeners('step', { 
      event, 
      activation: this.activations.get(event.target),
      queueSize: this.eventQueue.heap.length 
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
    
    if (content.startsWith('<') && content.includes('==>') && content.endsWith('>.')) {
      // Implication statement
      const inner = content.slice(1, -2);
      const [premise, conclusion] = inner.split('==>').map(s => s.trim());
      return { type: 'Implication', args: [premise, conclusion], truth };
    }
    
    if (content.startsWith('<') && content.includes('<=>') && content.endsWith('>.') && content.includes('&&')) {
      // Equivalence with conjunction
      const inner = content.slice(1, -2);
      const [left, right] = inner.split('<=>').map(s => s.trim());
      return { type: 'Equivalence', args: [left, right], truth };
    }
    
    if (content.includes('&&')) {
      // Conjunction
      const terms = content.split('&&').map(t => t.trim());
      return { type: 'Conjunction', args: terms, truth };
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
 * Medical Diagnosis Assistant using NARHyper
 * Demonstrates:
 * - Full NAL syntax support
 * - Advanced derivation rules (induction, abduction)
 * - Contradictory evidence handling
 * - Explanation tracing
 * - Event listeners
 */

// Initialize the NAR system
const medicalDiagnosis = new NARHyper({
  decay: 0.12,
  budgetDecay: 0.75,
  inferenceThreshold: 0.25,
  maxPathLength: 20,
  beliefCapacity: 10,
  temporalHorizon: 5
});

// Listen for belief additions
medicalDiagnosis.on('belief-added', ({ hyperedgeId, truth }) => {
  if (hyperedgeId.includes('Diagnosis') && truth.expectation() > 0.6) {
    console.log(`\x1b[32mPotential diagnosis detected: ${hyperedgeId} (expectation: ${truth.expectation().toFixed(2)})\x1b[0m`);
  }
});

// ===== 1. DEFINE MEDICAL ONTOLOGY (USING NAL SYNTAX) =====

// Symptoms
medicalDiagnosis.nal('<fever --> symptom>. %0.9;0.85%');
medicalDiagnosis.nal('<cough --> symptom>. %0.85;0.8%');
medicalDiagnosis.nal('<headache --> symptom>. %0.7;0.75%');
medicalDiagnosis.nal('<rash --> symptom>. %0.6;0.7%');

// Diseases
medicalDiagnosis.nal('<flu --> disease>. %0.95;0.9%');
medicalDiagnosis.nal('<common_cold --> disease>. %0.9;0.85%');
medicalDiagnosis.nal('<measles --> disease>. %0.8;0.8%');
medicalDiagnosis.nal('<allergy --> disease>. %0.85;0.8%');

// Disease-symptom relationships
medicalDiagnosis.nal('<flu --> [fever,cough]>. %0.85;0.8%');
medicalDiagnosis.nal('<common_cold --> [cough,headache]>. %0.75;0.7%');
medicalDiagnosis.nal('<measles --> [fever,rash]>. %0.9;0.85%');
medicalDiagnosis.nal('<allergy --> [rash,headache]>. %0.8;0.75%');

// Disease similarities
medicalDiagnosis.nal('<flu <-> common_cold>. %0.6;0.65%');
medicalDiagnosis.nal('<measles <-> allergy>. %0.5;0.55%');

// Diagnostic rules
medicalDiagnosis.nal('<[fever,cough] ==> flu>. %0.8;0.75%');
medicalDiagnosis.nal('<[cough,headache] ==> common_cold>. %0.7;0.7%');
medicalDiagnosis.nal('<[fever,rash] ==> measles>. %0.85;0.8%');
medicalDiagnosis.nal('<[rash,headache] ==> allergy>. %0.75;0.7%');

// ===== 2. ADD PATIENT SYMPTOMS =====

console.log('\nAdding patient symptoms...');
medicalDiagnosis.term('fever', { truth: new TruthValue(0.9, 0.85) });
medicalDiagnosis.term('cough', { truth: new TruthValue(0.85, 0.8) });
medicalDiagnosis.term('headache', { truth: new TruthValue(0.6, 0.65) });

// Add temporal information
const visitTime = Date.now();
medicalDiagnosis.after('patient_visit', 'symptom_report', visitTime);
medicalDiagnosis.after('symptom_report', 'diagnosis_process', visitTime + 2000);

// ===== 3. RUN DIAGNOSIS ENGINE =====

console.log('\nRunning diagnosis inference engine...');
const steps = medicalDiagnosis.run(300, (nar, step) => {
  if (step % 50 === 0) {
    process.stdout.write(`.`);
  }
});
console.log(`\nCompleted ${steps} inference steps`);

// ===== 4. GET DIAGNOSIS RESULTS =====

console.log('\n\n===== DIAGNOSIS RESULTS =====');

// Check possible diagnoses
const fluBelief = medicalDiagnosis.getBeliefs('Inheritance(flu,disease)')[0];
const coldBelief = medicalDiagnosis.getBeliefs('Inheritance(common_cold,disease)')[0];
const measlesBelief = medicalDiagnosis.getBeliefs('Inheritance(measles,disease)')[0];
const allergyBelief = medicalDiagnosis.getBeliefs('Inheritance(allergy,disease)')[0];

console.log('\nDiagnosis probabilities:');
console.log(`- Flu: ${(fluBelief?.expectation * 100).toFixed(1)}%`);
console.log(`- Common Cold: ${(coldBelief?.expectation * 100).toFixed(1)}%`);
console.log(`- Measles: ${(measlesBelief?.expectation * 100).toFixed(1)}%`);
console.log(`- Allergy: ${(allergyBelief?.expectation * 100).toFixed(1)}%`);

// Examine contradictory evidence for flu diagnosis
console.log('\nFlu diagnosis evidence:');
console.log(medicalDiagnosis.explain('Inheritance(flu,disease)'));

// ===== 5. ADD ADDITIONAL TEST RESULTS =====

console.log('\n\nAdding additional test results...');
medicalDiagnosis.term('rapid_flu_test', { 
  truth: new TruthValue(0.95, 0.9) 
});

// Update belief based on test result
medicalDiagnosis.revise(
  'Inheritance(flu,disease)',
  new TruthValue(0.92, 0.88),
  Budget.full().scale(0.95)
);

medicalDiagnosis.run(50);

// ===== 6. FINAL DIAGNOSIS =====

console.log('\n\n===== FINAL DIAGNOSIS =====');
const finalFluBelief = medicalDiagnosis.getBeliefs('Inheritance(flu,disease)')[0];
console.log(`Final flu diagnosis probability: ${(finalFluBelief.expectation * 100).toFixed(1)}%`);

console.log('\nBelief table for flu diagnosis:');
console.table(medicalDiagnosis.beliefTable('Inheritance(flu,disease)'));

// ===== 7. MACRO FUNCTION DEMONSTRATION =====

console.log('\n\n===== MACRO FUNCTION DEMONSTRATION =====');

// Using nal() macro
medicalDiagnosis.nal('<sore_throat --> symptom>. %0.75;0.7%');
medicalDiagnosis.nal('<[fever,sore_throat] ==> strep_throat>. %0.8;0.75%');

// Using when() macro
medicalDiagnosis.when('fever && sore_throat', 'consider_strep_throat');

// Using seq() macro
medicalDiagnosis.seq('patient_reports_symptoms', 'doctor_orders_tests', 'receive_test_results', 'final_diagnosis');

// Run additional inference
medicalDiagnosis.run(50);

// Using beliefTable() macro
console.log('Strep throat consideration beliefs:');
console.table(medicalDiagnosis.beliefTable('Term(consider_strep_throat)'));

// Using explain() macro
console.log('\nDerivation path for strep consideration:');
console.log(medicalDiagnosis.explain('Term(consider_strep_throat)'));

console.log('\n\nDiagnosis system complete. Ready for clinical use!');
``````javascript
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
      maxBeliefRevision: 3,
      expressionTimeout: 500
    }, config);

    this.hypergraph = new Map();
    this.index = {
      byType: new Map(),
      byArg: new Map(),
      temporal: new Map(),
      compound: new Map()
    };
    this.eventQueue = new PriorityQueue((a, b) => b.budget.priority - a.budget.priority);
    this.pathCache = new Map();
    this.activations = new Map();
    this.temporalLinks = new Map();
    this.memoization = new Map();
    this.expressionEvaluator = new ExpressionEvaluator(this);
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

  imageExt(relation, arg, position = 1) {
    return this._addHyperedge('ImageExt', [relation, arg, position], {
      truth: TruthValue.certain().scale(0.8)
    });
  }

  imageInt(relation, arg, position = 1) {
    return this._addHyperedge('ImageInt', [relation, arg, position], {
      truth: TruthValue.certain().scale(0.8)
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

  sequence(...terms) {
    const timestamp = Date.now();
    for (let i = 0; i < terms.length - 1; i++) {
      this.after(terms[i], terms[i + 1], timestamp + i * 1000);
    }
    return this._id('Sequence', terms);
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
      hyperedge.revise(newTruth, newBudget || hyperedge.getStrongestBelief().budget);
      return true;
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

  /* ===== INTERNAL IMPLEMENTATION ===== */
  
  _addHyperedge(type, args, { truth, budget, priority } = {}) {
    const id = this._id(type, args);
    const hyperedge = this.hypergraph.get(id) ?? new Hyperedge(id, type, args);
    
    if (!this.hypergraph.has(id)) {
      this.hypergraph.set(id, hyperedge);
      this._addToIndex(hyperedge);
    }
    
    hyperedge.revise(
      truth || TruthValue.certain(),
      budget || Budget.full().scale(priority || 1.0)
    );
    
    this._propagate(id, 1.0, hyperedge.getStrongestBelief().budget, 0, 0, []);
    return id;
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
    const event = this.eventQueue.pop();
    if (!event || event.budget.priority < this.config.budgetThreshold) return false;
    
    this._updateActivation(event.target, event.activation);
    this._applyDerivationRules(event);
    this._propagateWave(event);
    return true;
  }

  run(maxSteps = Infinity, callback = () => {}) {
    let steps = 0;
    while (steps < maxSteps && this.step()) {
      callback(this, steps++);
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
  }

  _deriveTransitiveInheritance(subject, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath) {
    const key = this._memoKey('Inheritance', [subject, predicate], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);
    
    const truth = TruthValue.transitive(premise1.getTruth(), premise2.getTruth());
    this.inheritance(subject, predicate, { truth, budget: budget.scale(0.7) });
    this._propagate(this._id('Inheritance', [subject, predicate]), 
      activation * 0.8, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'transitivity']);
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
  }

  _deriveTransitiveImplication(premise, conclusion, rule1, rule2, activation, budget, pathHash, pathLength, derivationPath) {
    const key = this._memoKey('Implication', [premise, conclusion], pathHash);
    if (this.memoization.has(key) && this.memoization.get(key) <= pathLength) return;
    this.memoization.set(key, pathLength);
    
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
}

/* ===== SUPPORT CLASSES ===== */

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
    
    if (existing) {
      // Revise truth value
      existing.truth = TruthValue.revise(existing.truth, truth);
      // Merge budgets
      existing.budget = budget.merge(existing.budget);
    } else {
      // Add new belief
      this.beliefs.push(new Belief(truth, budget));
      
      // Sort by budget priority and trim to capacity
      this.beliefs = this.beliefs
        .sort((a, b) => b.budget.priority - a.budget.priority)
        .slice(0, NARHyper.config.beliefCapacity);
    }
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

class Belief {
  constructor(truth, budget) {
    this.truth = truth;
    this.budget = budget;
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
    
    // Simple pattern matching for demonstration
    if (pattern.includes('-->')) {
      // Match inheritance patterns
      const [subjectPattern, predicatePattern] = pattern.split('-->').map(p => p.trim());
      
      this.nar.index.byType.get('Inheritance')?.forEach(id => {
        const hyperedge = this.nar.hypergraph.get(id);
        if (hyperedge) {
          const [subject, predicate] = hyperedge.args;
          
          if ((subjectPattern === '*' || this._matchesPattern(subject, subjectPattern)) &&
              (predicatePattern === '*' || this._matchesPattern(predicate, predicatePattern))) {
            results.push({
              id,
              type: 'Inheritance',
              subject,
              predicate,
              truth: hyperedge.getTruth(),
              activation: this.nar.getActivation(id)
            });
          }
        }
      });
    }
    
    return results.slice(0, limit);
  }

  _parseExpression(expr, context) {
    // Simplified expression parser for demonstration
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
    
    // Check term existence
    return this.nar.hypergraph.has(`Term(${expr})`) || 
           this.nar.hypergraph.has(`Inheritance(${expr},*)`);
  }

  _matchesPattern(term, pattern) {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return term.startsWith(pattern.slice(0, -1));
    }
    return term === pattern;
  }
}

/* ===== EXAMPLE USAGE: COMPLETE NARS APPLICATION ===== */

/**
 * Smart Home Assistant using NARHyper
 * Demonstrates: 
 * - Structural knowledge (inheritance, similarity)
 * - Procedural knowledge (implication, temporal)
 * - Contradictory beliefs
 * - Expression evaluation
 * - Query system
 */

// Initialize the NAR system
const homeAssistant = new NARHyper({
  decay: 0.15,
  budgetDecay: 0.7,
  inferenceThreshold: 0.2,
  maxPathLength: 25,
  beliefCapacity: 12
});

// ===== 1. DEFINE ONTOLOGY (STRUCTURAL KNOWLEDGE) =====

// Device categories
homeAssistant.inheritance('light', 'device', { 
  truth: TruthValue.certain() 
});
homeAssistant.inheritance('thermostat', 'device', { 
  truth: TruthValue.certain() 
});
homeAssistant.inheritance('security_camera', 'device', { 
  truth: TruthValue.certain().scale(0.95) 
});

// Room structure
homeAssistant.inheritance('kitchen', 'room', { 
  truth: TruthValue.certain() 
});
homeAssistant.inheritance('bedroom', 'room', { 
  truth: TruthValue.certain() 
});
homeAssistant.inheritance('living_room', 'room', { 
  truth: TruthValue.certain() 
});

// Device locations
homeAssistant.inheritance('kitchen_light', 'light', { 
  truth: TruthValue.certain() 
});
homeAssistant.inheritance('kitchen_light', 'kitchen', { 
  truth: new TruthValue(0.95, 0.9) 
});

homeAssistant.inheritance('bedroom_light', 'light', { 
  truth: TruthValue.certain() 
});
homeAssistant.inheritance('bedroom_light', 'bedroom', { 
  truth: new TruthValue(0.95, 0.9) 
});

homeAssistant.inheritance('living_room_light', 'light', { 
  truth: TruthValue.certain() 
});
homeAssistant.inheritance('living_room_light', 'living_room', { 
  truth: new TruthValue(0.95, 0.9) 
});

// Similarities between devices
homeAssistant.similarity('kitchen_light', 'bedroom_light', { 
  truth: new TruthValue(0.8, 0.75) 
});
homeAssistant.similarity('bedroom_light', 'living_room_light', { 
  truth: new TruthValue(0.7, 0.65) 
});

// ===== 2. DEFINE BEHAVIOR (PROCEDURAL KNOWLEDGE) =====

// Lighting rules
homeAssistant.implication('motion_detected(living_room)', 'turn_on(living_room_light)', { 
  truth: new TruthValue(0.95, 0.9) 
});
homeAssistant.implication('no_motion_for(15min)', 'turn_off(all_lights)', { 
  truth: new TruthValue(0.9, 0.85) 
});

// Temperature rules
homeAssistant.implication('temperature > 75', 'set_thermostat(cool, 72)', { 
  truth: new TruthValue(0.92, 0.88) 
});
homeAssistant.implication('temperature < 65', 'set_thermostat(heat, 68)', { 
  truth: new TruthValue(0.9, 0.85) 
});

// Security rules
homeAssistant.implication('door_opened && time > 22:00', 'activate_security_mode', { 
  truth: new TruthValue(0.85, 0.8) 
});
homeAssistant.implication('motion_detected(outside) && security_mode_active', 'record_video', { 
  truth: new TruthValue(0.95, 0.92) 
});

// Temporal sequences
const morningRoutine = homeAssistant.sequence(
  'wake_up', 
  'turn_on(kitchen_light)', 
  'start_coffee_maker', 
  'open_blinds'
);

const eveningRoutine = homeAssistant.sequence(
  'sunset', 
  'turn_on(living_room_light)', 
  'set_thermostat(cool, 72)', 
  'play_music'
);

// ===== 3. SIMULATE ENVIRONMENT EVENTS =====

// Add current state
homeAssistant.term('motion_detected(living_room)', { 
  truth: new TruthValue(1.0, 0.95) 
});
homeAssistant.term('temperature', { 
  truth: new TruthValue(78, 0.9) 
});
homeAssistant.term('time', { 
  truth: new TruthValue(21.30, 0.95) 
});

// Add temporal events
const now = Date.now();
homeAssistant.after('motion_detected(living_room)', 'turn_on(living_room_light)', now);
homeAssistant.after('door_opened', 'check_outside_camera', now + 5000);

// Introduce contradictory information about bedroom light
homeAssistant.inheritance('bedroom_light', 'broken', { 
  truth: new TruthValue(0.2, 0.9) 
});
homeAssistant.inheritance('bedroom_light', 'working', { 
  truth: new TruthValue(0.8, 0.3) 
});

// ===== 4. RUN INFERENCE ENGINE =====

console.log('Running home assistant inference engine...');
const steps = homeAssistant.run(200, (nar, step) => {
  if (step % 50 === 0) {
    console.log(`Step ${step}: Processing ${nar.eventQueue.heap.length} pending events`);
  }
});

// ===== 5. QUERY THE SYSTEM =====

console.log('\n===== INFERENCE RESULTS =====');
console.log(`Processing steps: ${steps}`);
console.log(`Total knowledge elements: ${homeAssistant.hypergraph.size}`);

// Check lighting inference
const lightInference = homeAssistant.getBeliefs('turn_on(living_room_light)');
console.log('\nLighting inference:');
console.log(`- Living room light activation: ${lightInference[0]?.truth.expectation().toFixed(2)}`);

// Check contradictory beliefs
const lightStatus = homeAssistant.getBeliefs('bedroom_light');
console.log('\nBedroom light status (contradictory beliefs):');
lightStatus.forEach((belief, i) => 
  console.log(`  Belief #${i+1}: ${belief.truth.frequency.toFixed(2)} confidence, priority: ${belief.budget.priority.toFixed(2)}`)
);

// Query using expression evaluator
console.log('\nQuery results:');
console.log('- Active devices:', homeAssistant.evaluate('Term(light) && Term(working)'));
console.log('- Security risk:', homeAssistant.evaluate('door_opened && time > 22:00'));

// Advanced query
const lightingRules = homeAssistant.query('turn_on(*) --> motion_detected(*)');
console.log('\nLighting rules found:', lightingRules.length);
lightingRules.forEach(rule => 
  console.log(`  - ${rule.subject} triggered by ${rule.predicate} (confidence: ${rule.truth.confidence.toFixed(2)})`)
);

// ===== 6. DYNAMIC REVISION =====

console.log('\nUpdating system with new information...');
homeAssistant.revise('Inheritance(bedroom_light,broken)', 
  new TruthValue(0.05, 0.95), 
  Budget.full().scale(0.9)
);

homeAssistant.run(50);
const updatedStatus = homeAssistant.getBeliefs('bedroom_light');
console.log('Bedroom light status after revision:');
updatedStatus.forEach((belief, i) => 
  console.log(`  Belief #${i+1}: ${belief.truth.frequency.toFixed(2)} confidence, priority: ${belief.budget.priority.toFixed(2)}`)
);

console.log('\nSystem is ready to make decisions based on NARS reasoning!');
console.log('Example decision:', 
  homeAssistant.evaluate('motion_detected(living_room)') 
    ? 'Activating living room lighting sequence' 
    : 'No action required');
```