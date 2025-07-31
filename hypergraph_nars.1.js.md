enhancements```javascript
class NARHyper {
  constructor(config = {}) {
    this.config = Object.assign({
      decay: 0.1, budgetDecay: 0.8, inferenceThreshold: 0.3,
      maxPathLength: 15, beliefCapacity: 8, maxDerivationDepth: 5,
      temporalHorizon: 3, budgetThreshold: 0.05
    }, config);

    this.hypergraph = new Map();
    this.index = { byType: new Map(), byArg: new Map(), temporal: new Map() };
    this.eventQueue = new PriorityQueue((a, b) => b.budget.total() - a.budget.total());
    this.pathCache = new Map();
    this.activations = new Map();
    this.temporalLinks = new Map();
    this.memoization = new Map();
  }

  addTerm(term, truth = new TruthValue(1.0, 0.9), budget = new Budget(1.0, 1.0, 1.0)) {
    return this.addHyperedge('Term', [term], truth, budget);
  }

  addInheritance(subject, predicate, truth, budget = new Budget(1.0, 1.0, 1.0)) {
    return this.addHyperedge('Inheritance', [subject, predicate], truth, budget);
  }

  addSimilarity(term1, term2, truth, budget = new Budget(1.0, 1.0, 1.0)) {
    return this.addHyperedge('Similarity', [term1, term2], truth, budget);
  }

  addInstance(instance, concept, truth, budget = new Budget(1.0, 1.0, 1.0)) {
    return this.addHyperedge('Instance', [instance, concept], truth, budget);
  }

  addProperty(concept, property, truth, budget = new Budget(1.0, 1.0, 1.0)) {
    return this.addHyperedge('Property', [concept, property], truth, budget);
  }

  addImplication(premise, conclusion, truth, budget = new Budget(1.0, 1.0, 1.0)) {
    return this.addHyperedge('Implication', [premise, conclusion], truth, budget);
  }

  addTemporal(premise, conclusion, relation, timestamp) {
    const temporalId = `Temporal(${premise},${conclusion},${relation})`;
    this.temporalLinks.set(temporalId, { premise, conclusion, relation, timestamp });
    this.index.temporal.set(premise, (this.index.temporal.get(premise) || new Set()).add(temporalId));
    this.index.temporal.set(conclusion, (this.index.temporal.get(conclusion) || new Set()).add(temporalId));
    return temporalId;
  }

  addHyperedge(type, args, truth, budget) {
    const id = this._generateId(type, args);
    let hyperedge = this.hypergraph.get(id);
    
    if (!hyperedge) {
      hyperedge = new Hyperedge(id, type, args);
      this.hypergraph.set(id, hyperedge);
      this._addToIndex(hyperedge);
    }
    
    hyperedge.reviseBelief(truth, budget);
    this._propagateActivation(id, 1.0, budget, 0, 0, []);
    return id;
  }

  step() {
    const event = this.eventQueue.pop();
    if (!event || event.budget.total() < this.config.budgetThreshold) return;
    
    this._updateActivation(event.target, event.activation);
    this._applyDerivationRules(event);
    this._propagateWave(event);
  }

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

  _applyDerivationRules({ target, activation, budget, pathHash, pathLength, derivationPath }) {
    const hyperedge = this.hypergraph.get(target);
    if (!hyperedge || activation <= this.config.inferenceThreshold) return;
    
    const rules = {
      'Inheritance': this._applyInheritanceRules,
      'Similarity': this._applySimilarityRules,
      'Implication': this._applyImplicationRules,
      'Term': this._applyTermRules
    }[hyperedge.type];
    
    rules && rules.call(this, hyperedge, activation, budget, pathHash, pathLength, derivationPath);
  }

  _applyInheritanceRules(hyperedge, activation, budget, pathHash, pathLength, derivationPath) {
    const [subject, predicate] = hyperedge.args;
    
    // Transitive inheritance: <A --> B>, <B --> C> |- <A --> C>
    (this.index.byArg.get(predicate) || new Set()).forEach(id => {
      const potentialMiddle = this.hypergraph.get(id);
      if (potentialMiddle?.type === 'Inheritance' && potentialMiddle.args[1] === subject) {
        const [newSubject, newPredicate] = [potentialMiddle.args[0], predicate];
        this._deriveInheritance(newSubject, newPredicate, hyperedge, potentialMiddle, 
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
    
    // Conversion: <A --> B> |- <B --> A>
    this._deriveSimilarity(predicate, subject, hyperedge, 
      activation * 0.7, budget.scale(0.6), pathHash, pathLength, derivationPath);
  }

  _deriveInheritance(subject, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath) {
    const key = `Inheritance(${subject},${predicate})|${pathHash}`;
    if (this.memoization.has(key) && this.memoization.get(key) >= pathLength) return;
    this.memoization.set(key, pathLength);
    
    const truth = TruthValue.transitive(premise1.getStrongestBelief().truth, 
                                      premise2.getStrongestBelief().truth);
    this.addInheritance(subject, predicate, truth, budget.scale(0.7));
    this._enqueuePropagation(`Inheritance(${subject},${predicate})`, 
      activation * 0.8, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'transitivity']);
  }

  _deriveSimilarity(term1, term2, premise, activation, budget, pathHash, pathLength, derivationPath) {
    const key = `Similarity(${term1},${term2})|${pathHash}`;
    if (this.memoization.has(key) && this.memoization.get(key) >= pathLength) return;
    this.memoization.set(key, pathLength);
    
    const truth = premise.getStrongestBelief().truth;
    this.addSimilarity(term1, term2, truth, budget);
    this._enqueuePropagation(`Similarity(${term1},${term2})`, 
      activation, budget, pathHash, pathLength + 1, [...derivationPath, 'conversion']);
  }

  _applySimilarityRules(hyperedge, activation, budget, pathHash, pathLength, derivationPath) {
    const [term1, term2] = hyperedge.args;
    
    // Symmetry: <A <-> B> |- <B <-> A>
    this._enqueuePropagation(`Similarity(${term2},${term1})`, 
      activation, budget.scale(0.9), pathHash, pathLength + 1, [...derivationPath, 'symmetry']);
    
    // Inheritance derivation
    (this.index.byArg.get(term1) || new Set()).forEach(id => {
      const premise = this.hypergraph.get(id);
      if (premise?.type === 'Inheritance') {
        const [pSubject, pPredicate] = premise.args;
        const newPredicate = pSubject === term1 ? term2 : (pPredicate === term1 ? term2 : null);
        if (newPredicate) {
          this._deriveInheritance(pSubject === term1 ? term2 : term1, newPredicate, 
            premise, hyperedge, activation, budget, pathHash, pathLength, derivationPath);
        }
      }
    });
  }

  _applyImplicationRules(hyperedge, activation, budget, pathHash, pathLength, derivationPath) {
    const [premise, conclusion] = hyperedge.args;
    
    // Modus ponens: <P ==> Q>, P |- Q
    if (this.hypergraph.has(`Term(${premise})`)) {
      this._enqueuePropagation(conclusion, activation * 0.9, 
        budget.scale(0.75), pathHash, pathLength + 1, [...derivationPath, 'modus_ponens']);
    }
    
    // Implication transitivity
    (this.index.byArg.get(premise) || new Set()).forEach(id => {
      const potentialMiddle = this.hypergraph.get(id);
      if (potentialMiddle?.type === 'Implication' && potentialMiddle.args[1] === premise) {
        this._deriveImplication(potentialMiddle.args[0], conclusion, hyperedge, potentialMiddle,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
  }

  _deriveImplication(premise, conclusion, rule1, rule2, activation, budget, pathHash, pathLength, derivationPath) {
    const key = `Implication(${premise},${conclusion})|${pathHash}`;
    if (this.memoization.has(key) && this.memoization.get(key) >= pathLength) return;
    this.memoization.set(key, pathLength);
    
    const truth = TruthValue.transitive(rule1.getStrongestBelief().truth, 
                                      rule2.getStrongestBelief().truth);
    this.addImplication(premise, conclusion, truth, budget.scale(0.7));
    this._enqueuePropagation(`Implication(${premise},${conclusion})`, 
      activation * 0.8, budget.scale(0.7), pathHash, pathLength + 1, [...derivationPath, 'implication_transitivity']);
  }

  _applyTermRules(hyperedge, activation, budget, pathHash, pathLength, derivationPath) {
    // Product formation: A, B |- (A * B)
    (this.activations.get(hyperedge.id) > 0.5 ? this.activations : new Map())
      .forEach((act, otherTerm) => {
        if (act > 0.5 && otherTerm !== hyperedge.id) {
          const productId = `Product(${hyperedge.id},${otherTerm})`;
          this.addHyperedge('Product', [hyperedge.id, otherTerm], 
            new TruthValue(0.9, 0.85), budget.scale(0.6));
          this._enqueuePropagation(productId, activation * 0.7, 
            budget.scale(0.6), pathHash, pathLength + 1, [...derivationPath, 'product_formation']);
        }
      });
  }

  _processTemporalLinks(target, activation, budget, pathHash, pathLength, derivationPath) {
    const temporalLinks = this.index.temporal.get(target) || new Set();
    const now = Date.now();
    
    for (const linkId of temporalLinks) {
      const { premise, conclusion, relation, timestamp } = this.temporalLinks.get(linkId);
      const timeDelta = now - timestamp;
      
      if (timeDelta <= this.config.temporalHorizon * 1000) {
        const temporalActivation = activation * Math.exp(-0.1 * timeDelta / 1000);
        const temporalBudget = budget.scale(0.8);
        
        switch(relation) {
          case 'after': this._enqueuePropagation(conclusion, temporalActivation, temporalBudget, pathHash, pathLength + 1, [...derivationPath, 'temporal_after']); break;
          case 'before': this._enqueuePropagation(premise, temporalActivation, temporalBudget, pathHash, pathLength + 1, [...derivationPath, 'temporal_before']); break;
          case 'simultaneous': 
            this._enqueuePropagation(conclusion, temporalActivation, temporalBudget, pathHash, pathLength + 1, [...derivationPath, 'temporal_simultaneous']);
            this._enqueuePropagation(premise, temporalActivation, temporalBudget, pathHash, pathLength + 1, [...derivationPath, 'temporal_simultaneous']);
            break;
        }
      }
    }
  }

  _propagateToTerm(hyperedge, termId, activation, budget, pathHash, pathLength, derivationPath) {
    const expectation = hyperedge.getTruthExpectation();
    this._enqueuePropagation(termId, activation * expectation, 
      budget.scale(this.config.budgetDecay), pathHash ^ this._hash(termId), 
      pathLength + 1, [...derivationPath, 'structural_propagation']);
  }

  _propagateToHyperedge(hyperedgeId, activation, budget, pathHash, pathLength, derivationPath) {
    this._enqueuePropagation(hyperedgeId, activation, 
      budget.scale(this.config.budgetDecay), pathHash ^ this._hash(hyperedgeId), 
      pathLength + 1, [...derivationPath, 'procedural_propagation']);
  }

  _enqueuePropagation(target, activation, budget, pathHash, pathLength, derivationPath) {
    if (budget.total() < this.config.budgetThreshold || 
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
    const current = this.activations.get(id) || 0;
    this.activations.set(id, (1 - this.config.decay) * current + this.config.decay * activation);
  }

  _generateId(type, args) {
    return `${type}(${args.join(',')})`;
  }

  _addToIndex(hyperedge) {
    [this.index.byType, this.index.byArg].forEach(index => {
      const key = index === this.index.byType ? hyperedge.type : null;
      hyperedge.args.forEach(arg => {
        const target = index.get(key ?? arg) || new Set();
        index.set(key ?? arg, target.add(hyperedge.id));
      });
    });
  }

  _hash(str) {
    return [...str].reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0) >>> 0;
  }
}

class Hyperedge {
  constructor(id, type, args) {
    this.id = id;
    this.type = type;
    this.args = args;
    this.beliefs = [];
  }

  reviseBelief(truth, budget) {
    const existing = this.beliefs.find(b => b.budget.equivalent(budget));
    if (existing) {
      existing.truth = TruthValue.revise(existing.truth, truth);
      existing.budget = budget.merge(existing.budget);
    } else {
      this.beliefs.push(new Belief(truth, budget));
      if (this.beliefs.length > NARHyper.config.beliefCapacity) {
        this.beliefs = this.beliefs.sort((a, b) => b.budget.total() - a.budget.total())
          .slice(0, NARHyper.config.beliefCapacity);
      }
    }
  }

  getStrongestBelief() {
    return this.beliefs.reduce((max, b) => 
      b.budget.total() > max.budget.total() ? b : max, this.beliefs[0]);
  }

  getTruthExpectation() {
    return this.beliefs.length ? this.getStrongestBelief().truth.expectation() : 0.5;
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
    const confidence = c1 * c2 * (1 - Math.abs(f1 - f2));
    
    return new TruthValue(frequency, confidence, Math.min(t1.priority, t2.priority) * 0.8);
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
}

class PriorityQueue {
  constructor(comparator = (a, b) => b.budget.total() - a.budget.total()) {
    this.heap = [];
    this.comparator = comparator;
  }

  push(item) {
    this.heap.push(item);
    this._siftUp();
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
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
      } else break;
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

      if (left < length && this.comparator(this.heap[left], element) < 0) 
        swap = left;
      
      if (right < length && 
         (swap === null ? this.comparator(this.heap[right], element) < 0 
                        : this.comparator(this.heap[right], this.heap[left]) < 0)) 
        swap = right;

      if (swap === null) break;
      [this.heap[idx], this.heap[swap]] = [this.heap[swap], this.heap[idx]];
      idx = swap;
    }
  }
}

// Functional completeness demonstration with all NARS features
const nars = new NARHyper({
  decay: 0.12, budgetDecay: 0.75, inferenceThreshold: 0.25,
  maxPathLength: 20, beliefCapacity: 10, temporalHorizon: 5
});

// Structural knowledge
nars.addInheritance('bird', 'flyer', new TruthValue(0.8, 0.75));
nars.addInheritance('penguin', 'bird', new TruthValue(0.95, 0.8));
nars.addProperty('penguin', 'swimmer', new TruthValue(0.9, 0.85));
nars.addSimilarity('robin', 'sparrow', new TruthValue(0.7, 0.65));

// Procedural knowledge
nars.addImplication('rain', 'wet_ground', new TruthValue(0.9, 0.8));
nars.addImplication('wet_ground', 'slippery', new TruthValue(0.7, 0.6));

// Temporal knowledge
nars.addTerm('rain', new TruthValue(0.3, 0.5));
const rainTimestamp = Date.now();
nars.addTemporal('rain', 'wet_ground', 'after', rainTimestamp);
nars.addTemporal('wet_ground', 'slippery', 'after', rainTimestamp + 1000);

// Run the system until we get a conclusion about penguins flying
let steps = 0;
while (steps++ < 500) {
  nars.step();
  
  const penguinFlying = nars.hypergraph.get('Inheritance(penguin,flyer)');
  if (penguinFlying && penguinFlying.getTruthExpectation() > 0.2) {
    console.log(`Penguin flies with expectation: ${penguinFlying.getTruthExpectation().toFixed(2)}`);
    break;
  }
  
  const slipperyNow = nars.hypergraph.get('Term(slippery)');
  if (slipperyNow && nars.activations.get('slippery') > 0.6) {
    console.log(`Ground is slippery with activation: ${nars.activations.get('slippery').toFixed(2)}`);
  }
}

// Demonstrate contradictory beliefs
nars.addInheritance('penguin', 'flyer', new TruthValue(0.1, 0.9));  // Strong evidence penguins don't fly well
nars.addInheritance('penguin', 'flyer', new TruthValue(0.6, 0.3));  // Weaker evidence they can glide

// Run additional steps to see belief revision
for (let i = 0; i < 50; i++) nars.step();

const finalBelief = nars.hypergraph.get('Inheritance(penguin,flyer)');
console.log(`Final penguin flying belief after contradictory evidence: ${finalBelief.getTruthExpectation().toFixed(2)}`);
console.log(`Number of contradictory beliefs: ${finalBelief.beliefs.length}`);
console.log(`Strongest belief priority: ${finalBelief.getStrongestBelief().budget.total().toFixed(2)}`);
```