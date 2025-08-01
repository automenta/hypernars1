import {DerivationEngineBase} from './DerivationEngineBase.js';
import {TruthValue} from '../support/TruthValue.js';
import {id, getArgId} from '../support/utils.js';

export class AdvancedDerivationEngine extends DerivationEngineBase {
  constructor(nar) {
    super(nar);
    this.rules = new Map();
    this.inferenceCount = 0; // For meta-reasoning
    this._registerDefaultRules();
  }

  /**
   * Register a custom derivation rule
   * @param {string} name - Rule name
   * @param {Function} condition - When to apply (returns boolean)
   * @param {Function} action - What to do when applied
   * @param {Object} [options] - Rule options
   */
  registerRule(name, condition, action, options = {}) {
    this.rules.set(name, {
      condition,
      action,
      priority: options.priority || 0.5,
      applicability: options.applicability || 0.5,
      successRate: options.successRate || 0.5,
      lastUsed: 0,
      usageCount: 0
    });
    this._sortRules();
  }

  /**
   * Evaluates and updates rule priorities based on statistics from the Learning Engine.
   * This creates a feedback loop where the system learns to prioritize effective rules.
   */
  evaluateRules() {
    const stats = this.nar.learningEngine.getRuleProductivityStats();
    if (!stats) return;

    let rulesChanged = false;
    for (const [name, rule] of this.rules) {
        const ruleStats = stats.get(name);
        if (ruleStats && ruleStats.attempts > 5) { // Only adjust after a few attempts
            const newSuccessRate = ruleStats.successes / ruleStats.attempts;

            // Smoothly update the success rate to avoid drastic changes
            const oldSuccessRate = rule.successRate;
            rule.successRate = oldSuccessRate * 0.9 + newSuccessRate * 0.1;

            // Recalculate priority
            rule.priority = rule.successRate * 0.7 + rule.applicability * 0.3;
            rulesChanged = true;
        } else {
            // Slowly decay priority of unused or untested rules
            rule.priority *= 0.995;
        }
    }

    if (rulesChanged) {
        this._sortRules();
    }
  }

  /**
   * Get active rules for the current event/context
   * @param {Object} event - The current event
   * @returns {Array} Active rules
   */
  getActiveRules(event) {
    return [...this.rules.values()]
      .filter(rule => rule.condition(event))
      .sort((a, b) => b.priority - a.priority);
  }

  _sortRules() {
      this.rules = new Map([...this.rules.entries()]
          .sort(([, a], [, b]) => b.priority - a.priority));
  }

  _registerDefaultRules() {
    this.registerRule('Inheritance', event => this.nar.state.hypergraph.get(event.target)?.type === 'Inheritance', (h, e, r) => this._deriveInheritance(h, e, r));
    this.registerRule('Similarity', event => this.nar.state.hypergraph.get(event.target)?.type === 'Similarity', (h, e, r) => this._deriveSimilarity(h, e, r));
    this.registerRule('Implication', event => this.nar.state.hypergraph.get(event.target)?.type === 'Implication', (h, e, r) => this._deriveImplication(h, e, r));
    this.registerRule('Equivalence', event => this.nar.state.hypergraph.get(event.target)?.type === 'Equivalence', (h, e, r) => this._deriveEquivalence(h, e, r));
    this.registerRule('Conjunction', event => this.nar.state.hypergraph.get(event.target)?.type === 'Conjunction', (h, e, r) => this._deriveConjunction(h, e, r));
    this.registerRule('TemporalRelation', event => this.nar.state.hypergraph.get(event.target)?.type === 'TemporalRelation', (h, e, r) => this._deriveTransitiveTemporalRelation(h, e, r));
  }

  _memoKey(type, args, pathHash) {
    return `${id(type, args)}|${pathHash}`;
  }

  applyDerivationRules(event) {
    const { target, activation, pathLength } = event;
    const hyperedge = this.nar.state.hypergraph.get(target);
    if (!hyperedge || activation <= this.nar.config.inferenceThreshold || pathLength > this.nar.config.maxDerivationDepth) return;

    // Get active rules, but don't sort them here
    const activeRules = [...this.rules.values()].filter(rule => rule.condition(event));

    if (activeRules.length === 0) return;

    // Probabilistic selection of one rule
    const totalPriority = activeRules.reduce((sum, rule) => sum + rule.priority, 0);
    if (totalPriority === 0) return;

    let random = Math.random() * totalPriority;
    let selectedRule = null;

    for (const rule of activeRules) {
        random -= rule.priority;
        if (random <= 0) {
            selectedRule = rule;
            break;
        }
    }

    // Fallback to the last rule if something goes wrong with floating point math
    if (!selectedRule) {
        selectedRule = activeRules[activeRules.length - 1];
    }

    // Apply only the selected rule
    if (selectedRule) {
        // Find the name of the rule to pass to the action
        for (const [name, ruleObject] of this.rules.entries()) {
            if (ruleObject === selectedRule) {
                selectedRule.action(hyperedge, event, name);
                selectedRule.lastUsed = Date.now();
                selectedRule.usageCount++;
                this.inferenceCount++; // Increment inference counter
                break;
            }
        }
    }
  }

  /**
   * Returns the number of inferences made since the last call and resets the counter.
   * @returns {number}
   */
  getAndResetInferenceCount() {
      const count = this.inferenceCount;
      this.inferenceCount = 0;
      return count;
  }

  boostRuleSuccessRate(ruleName, factor = 0.1) {
      const rule = this.rules.get(ruleName);
      if (rule) {
          rule.successRate = rule.successRate * (1 - factor) + 1 * factor;
          this._sortRules();
      }
  }

  penalizeRuleSuccessRate(ruleName, factor = 0.1) {
      const rule = this.rules.get(ruleName);
      if (rule) {
          rule.successRate = rule.successRate * (1 - factor) + 0 * factor;
          this._sortRules();
      }
  }

  _deriveInheritance({ args: [subject, predicate] }, event, ruleName) {
    const subjectId = getArgId(subject);
    const predicateId = getArgId(predicate);
    const { activation, budget, pathHash, pathLength, derivationPath } = event;

    // Transitivity
    (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(termId => {
      const middle = this.nar.state.hypergraph.get(termId);
      if (middle?.type === 'Inheritance' && getArgId(middle.args[1]) === subjectId) {
        this._deriveTransitiveInheritance(middle.args[0], predicate, middle,
          this.nar.state.hypergraph.get(id('Inheritance', [subject, predicate])),
          activation, budget, pathHash, pathLength, derivationPath, ruleName);
      }
    });

    this.nar.api.similarity(subject, predicate, { budget: budget.scale(0.6), derivedBy: ruleName });

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
          activation, budget, pathHash, pathLength, derivationPath, ruleName);
      }
    });
  }

  _deriveTransitiveInheritance(subject, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath, ruleName) {
    const subjectId = getArgId(subject);
    const predicateId = getArgId(predicate);
    const key = this._memoKey('Inheritance', [subjectId, predicateId], pathHash);
    if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
    this.nar.state.memoization.set(key, pathLength);

    const cacheKey = `${subjectId}→${predicateId}|${premise1.id}|${premise2.id}`;
    if (this.nar.state.index.derivationCache.has(cacheKey)) return;
    this.nar.state.index.derivationCache.set(cacheKey, true);

    const truth = TruthValue.transitive(premise1.getTruth(), premise2.getTruth());
    this.nar.api.inheritance(subject, predicate, { truth, budget: budget.scale(0.7), premises: [premise1.id, premise2.id], derivedBy: 'transitivity' });
  }

  _deriveInduction(term1, term2, predicate, premise1, premise2, activation, budget, pathHash, pathLength, derivationPath, ruleName) {
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
    this.nar.api.similarity(term1, term2, { truth, budget: budget.scale(0.6), premises: [premise1.id, premise2.id], derivedBy: 'induction' });
  }

  _deriveSimilarity({ args: [term1, term2] }, event, ruleName) {
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
          activation, budget, pathHash, pathLength, derivationPath, ruleName);
      }
    });
  }

  _deriveAnalogy(term1, term2, predicate, similarity, premise, activation, budget, pathHash, pathLength, derivationPath, ruleName) {
    const term2Id = getArgId(term2);
    const predicateId = getArgId(predicate);
    const key = this._memoKey('Inheritance', [term2Id, predicateId], pathHash);
    if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
    this.nar.state.memoization.set(key, pathLength);

    const truth = TruthValue.analogy(similarity.getTruth(), premise.getTruth());
    this.nar.api.inheritance(term2, predicate, { truth, budget: budget.scale(0.6), premises: [similarity.id, premise.id], derivedBy: 'analogy' });
  }

  _deriveImplication({ args: [premise, conclusion] }, event, ruleName) {
      const premiseId = getArgId(premise);
      if (this.nar.state.hypergraph.has(premiseId)) {
          this.nar.propagation.propagate(id(conclusion.type, conclusion.args), event.activation * 0.9, event.budget.scale(0.75),
              event.pathHash, event.pathLength + 1, [...event.derivationPath, ruleName]);
      }
  }

  _deriveEquivalence({ args: [term1, term2] }, event, ruleName) {
      this.nar.api.implication(term1, term2, {
          truth: event.hyperedge.getTruth(),
          budget: event.budget.scale(0.8),
          derivedBy: ruleName
      });
      this.nar.api.implication(term2, term1, {
          truth: event.hyperedge.getTruth(),
          budget: event.budget.scale(0.8),
          derivedBy: ruleName
      });
  }

  _deriveConjunction({ args }, event, ruleName) {
    args.forEach(term =>
      this.nar.propagation.propagate(getArgId(term), event.activation * 0.9, event.budget.scale(0.75),
        event.pathHash, event.pathLength + 1, [...event.derivationPath, ruleName])
    );
  }

  _deriveTransitiveTemporalRelation({ args: [premise, conclusion, relation] }, event, ruleName) {
      const premiseId = getArgId(premise);
      const eventHyperedge = this.nar.state.hypergraph.get(event.target);
      if (!eventHyperedge) return;

      // Find all temporal relations that conclude with our premise: (X --rel1--> P)
      (this.nar.state.index.byArg.get(premiseId) || new Set()).forEach(termId => {
          const middle = this.nar.state.hypergraph.get(termId);

          // Ensure it's a temporal relation ending in our premise
          if (middle?.type === 'TemporalRelation' && getArgId(middle.args[1]) === premiseId) {
              const firstTerm = middle.args[0];
              const firstRelation = middle.args[2];

              const composedRelations = this._composeTemporalRelations(firstRelation, relation);
              if (composedRelations) {
                  composedRelations.forEach(newRelation => {
                      // Derive the new transitive relation: (firstTerm --new_relation--> conclusion)
                      this.nar.api.addHyperedge('TemporalRelation', [firstTerm, conclusion, newRelation], {
                          truth: TruthValue.transitive(middle.getTruth(), eventHyperedge.getTruth()),
                          budget: event.budget.scale(0.7),
                          premises: [middle.id, eventHyperedge.id],
                          derivedBy: 'TransitiveTemporal'
                      });
                  });
              }
          }
      });
  }

  _getInverseTemporalRelation(relation) {
      const inverses = {
          'before': 'after', 'after': 'before',
          'meets': 'metBy', 'metBy': 'meets',
          'overlaps': 'overlappedBy', 'overlappedBy': 'overlaps',
          'during': 'contains', 'contains': 'during',
          'starts': 'startedBy', 'startedBy': 'starts',
          'finishes': 'finishedBy', 'finishedBy': 'finishes',
          'equals': 'equals'
      };
      return inverses[relation];
  }

  _composeTemporalRelations(rel1, rel2) {
      const table = {
          'before': {
              'before': ['before'], 'meets': ['before'], 'overlaps': ['before'],
              'starts': ['before'], 'during': ['before'], 'finishes': ['before', 'meets', 'overlaps', 'starts', 'during']
          },
          'meets': {
              'before': ['before'], 'meets': ['before'], 'overlaps': ['before'],
              'starts': ['starts'], 'during': ['during']
          },
          'overlaps': {
              'before': ['before'], 'meets': ['before'], 'overlaps': ['before', 'meets', 'overlaps'],
              'starts': ['overlaps'], 'during': ['during', 'overlaps', 'finishes']
          },
          'starts': {
              'starts': ['starts'], 'during': ['during'], 'finishes': ['finishes', 'during', 'overlaps']
          },
          'during': {
              'during': ['during'], 'finishes': ['finishes']
          },
          'finishes': {
              'finishes': ['finishes']
          },
          'equals': {
              'before': ['before'], 'meets': ['meets'], 'overlaps': ['overlaps'],
              'starts': ['starts'], 'during': ['during'], 'finishes': ['finishes'],
              'equals': ['equals']
          }
      };

      let composed = table[rel1]?.[rel2];
      if (composed) return composed;

      // Try composing with inverse relations if a direct entry is not found
      const inv_r1 = this._getInverseTemporalRelation(rel1);
      const inv_r2 = this._getInverseTemporalRelation(rel2);
      if (inv_r1 && inv_r2) {
          const inv_composed = this._composeTemporalRelations(inv_r2, inv_r1);
          if (inv_composed) {
              return inv_composed.map(r => this._getInverseTemporalRelation(r)).filter(r => r);
          }
      }
      return null;
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
