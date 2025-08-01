import { TruthValue } from '../support/TruthValue.js';
import { id } from '../support/utils.js';
import { getArgId } from './utils.js';

export class DerivationEngine {
  constructor(nar) {
    this.nar = nar;
  }

  _memoKey(type, args, pathHash) {
    return `${id(type, args)}|${pathHash}`;
  }

  applyDerivationRules(event) {
    const { target, activation, pathLength } = event;
    const hyperedge = this.nar.state.hypergraph.get(target);
    if (!hyperedge || activation <= this.nar.config.inferenceThreshold || pathLength > this.nar.config.maxDerivationDepth) return;

    const allRules = {
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
    };

    const rulePriority = this.nar.config.derivationPriority || Object.keys(allRules);

    for (const ruleName of rulePriority) {
        if (ruleName === hyperedge.type && allRules[ruleName]) {
            allRules[ruleName]();
            break;
        }
    }
  }

  _deriveInheritance({ args: [subject, predicate] }, event) {
    const subjectId = getArgId(subject);
    const predicateId = getArgId(predicate);
    const { activation, budget, pathHash, pathLength, derivationPath } = event;

    // Transitivity
    (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(termId => {
      const middle = this.nar.state.hypergraph.get(termId);
      if (middle?.type === 'Inheritance' && getArgId(middle.args[1]) === subjectId) {
        this._deriveTransitiveInheritance(middle.args[0], predicate, middle,
          this.nar.state.hypergraph.get(id('Inheritance', [subject, predicate])),
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });

    this.nar.api.similarity(subject, predicate, { budget: budget.scale(0.6) });

    // Property Inheritance
    if (this.nar.state.hypergraph.has(id('Instance', [subject, 'entity']))) {
      (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(propId => {
        const property = this.nar.state.hypergraph.get(propId);
        if (property?.type === 'Property') {
          this.nar.propagation.propagate(id('Property', [subject, property.args[1]]),
            activation * 0.6, budget.scale(0.5), pathHash, pathLength + 1, [...derivationPath, 'property_derivation']);
        }
      });
    }

    // Induction
    (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(termId => {
      const other = this.nar.state.hypergraph.get(termId);
      if (other?.type === 'Inheritance' && getArgId(other.args[1]) === predicateId && getArgId(other.args[0]) !== subjectId) {
        this._deriveInduction(subject, other.args[0], predicate,
          this.nar.state.hypergraph.get(id('Inheritance', [subject, predicate])),
          other,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
  }

  _deriveTransitiveInheritance(subject, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath) {
    const subjectId = getArgId(subject);
    const predicateId = getArgId(predicate);
    const key = this._memoKey('Inheritance', [subjectId, predicateId], pathHash);
    if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
    this.nar.state.memoization.set(key, pathLength);

    const cacheKey = `${subjectId}→${predicateId}|${premise1.id}|${premise2.id}`;
    if (this.nar.state.index.derivationCache.has(cacheKey)) return;
    this.nar.state.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.transitive(premise1.getTruth(), premise2.getTruth());
    this.nar.api.inheritance(subject, predicate, { truth, budget: budget.scale(0.7), premises: [premise1.id, premise2.id] });
  }

  _deriveInduction(term1, term2, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath) {
    const term1Id = getArgId(term1);
    const term2Id = getArgId(term2);
    const predicateId = getArgId(predicate);
    const key = this._memoKey('Similarity', [term1Id, term2Id], pathHash);
    if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
    this.nar.state.memoization.set(key, pathLength);

    const cacheKey = `${term1Id}↔${term2Id}|induction|${predicateId}`;
    if (this.nar.state.index.derivationCache.has(cacheKey)) return;
    this.nar.state.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.induction(premise1.getTruth(), premise2.getTruth());
    this.nar.api.similarity(term1, term2, { truth, budget: budget.scale(0.6), premises: [premise1.id, premise2.id] });
  }

  _deriveSimilarity({ args: [term1, term2] }, event) {
    const term1Id = getArgId(term1);
    const term2Id = getArgId(term2);
    const { activation, budget, pathHash, pathLength, derivationPath } = event;

    this.nar.propagation.propagate(id('Similarity', [term2, term1]),
      activation, budget.scale(0.9), pathHash, pathLength + 1, [...derivationPath, 'symmetry']);

    (this.nar.state.index.byArg.get(term1Id) || new Set()).forEach(termId => {
      const premise = this.nar.state.hypergraph.get(termId);
      if (premise?.type === 'Inheritance' && getArgId(premise.args[0]) === term1Id) {
        this._deriveAnalogy(term1, term2, premise.args[1],
          this.nar.state.hypergraph.get(id('Similarity', [term1, term2])),
          premise,
          activation, budget, pathHash, pathLength, derivationPath);
      }
    });
  }

  _deriveAnalogy(term1, term2, predicate, similarity, premise, activation, budget, pathHash, pathLength, derivationPath) {
    const term2Id = getArgId(term2);
    const predicateId = getArgId(predicate);
    const key = this._memoKey('Inheritance', [term2Id, predicateId], pathHash);
    if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
    this.nar.state.memoization.set(key, pathLength);

    const truth = TruthValue.analogy(similarity.getTruth(), premise.getTruth());
    this.nar.api.inheritance(term2, predicate, { truth, budget: budget.scale(0.6), premises: [similarity.id, premise.id] });
  }

  _deriveImplication({ args: [premise, conclusion] }, event) {
      const premiseId = getArgId(premise);
      if (this.nar.state.hypergraph.has(premiseId)) {
          this.nar.propagation.propagate(id(conclusion.type, conclusion.args), event.activation * 0.9, event.budget.scale(0.75),
              event.pathHash, event.pathLength + 1, [...event.derivationPath, 'modus_ponens']);
      }
  }

  _deriveEquivalence({ args: [term1, term2] }, event) {
      this.nar.api.implication(term1, term2, {
          truth: event.hyperedge.getTruth(),
          budget: event.budget.scale(0.8)
      });
      this.nar.api.implication(term2, term1, {
          truth: event.hyperedge.getTruth(),
          budget: event.budget.scale(0.8)
      });
  }

  _deriveConjunction({ args }, event) {
    args.forEach(term =>
      this.nar.propagation.propagate(getArgId(term), event.activation * 0.9, event.budget.scale(0.75),
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
}
