import {DerivationEngineBase} from './DerivationEngineBase.js';
import {TruthValue} from '../support/TruthValue.js';
import {getArgId, hash, id} from '../support/utils.js';

export class AdvancedDerivationEngine extends DerivationEngineBase {
    constructor(nar) {
        super(nar);
        this.rules = new Map();
        this.inferenceCount = 0;

        // Bind 'this' context for all derivation methods
        this._deriveInheritance = this._deriveInheritance.bind(this);
        this._deriveSimilarity = this._deriveSimilarity.bind(this);
        this._deriveImplication = this._deriveImplication.bind(this);
        this._deriveTransitiveInheritance = this._deriveTransitiveInheritance.bind(this);
        this._deriveAnalogy = this._deriveAnalogy.bind(this);
        this._propagate = this._propagate.bind(this);

        this._registerDefaultRules();
    }

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

    evaluateRules() {
        const stats = this.nar.learningEngine.getRuleProductivityStats();
        if (!stats) return;

        let rulesChanged = false;
        for (const [name, rule] of this.rules) {
            const ruleStats = stats.get(name);
            if (ruleStats && ruleStats.attempts > 5) {
                const newSuccessRate = ruleStats.successes / ruleStats.attempts;

                const oldSuccessRate = rule.successRate;
                rule.successRate = oldSuccessRate * 0.9 + newSuccessRate * 0.1;

                rule.priority = rule.successRate * 0.7 + rule.applicability * 0.3;
                rulesChanged = true;
            } else {
                rule.priority *= 0.995;
            }
        }

        if (rulesChanged) {
            this._sortRules();
        }
    }

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
        if (event.type === 'add-belief') {
            const hyperedge = this.nar.state.hypergraph.get(event.target);
            if (hyperedge) {
                const {newBelief} = hyperedge.revise(event.belief);
                this.nar.questionHandler.checkQuestionAnswers(hyperedge.id, newBelief);
            }
            return; // Stop further processing for this event
        }

        const {target, activation, pathLength} = event;
        const hyperedge = this.nar.state.hypergraph.get(target);
        if (!hyperedge || activation <= this.nar.config.inferenceThreshold || pathLength > this.nar.config.maxDerivationDepth) return;

        const activeRules = [...this.rules.values()].filter(rule => rule.enabled !== false && rule.condition(event));

        if (activeRules.length === 0) return;

        const weightedRules = activeRules.map(rule => {
            const ruleName = [...this.rules.entries()].find(([name, r]) => r === rule)?.[0];
            const dynamicFactor = this.nar.cognitiveExecutive.getRulePriority(ruleName);
            return {rule, weight: rule.priority * dynamicFactor};
        });

        const totalPriority = weightedRules.reduce((sum, item) => sum + item.weight, 0);
        if (totalPriority === 0) return;

        let random = Math.random() * totalPriority;
        let selectedRule = null;

        for (const item of weightedRules) {
            random -= item.weight;
            if (random <= 0) {
                selectedRule = item.rule;
                break;
            }
        }

        if (!selectedRule) {
            selectedRule = activeRules[activeRules.length - 1];
        }

        if (selectedRule) {
            for (const [name, ruleObject] of this.rules.entries()) {
                if (ruleObject === selectedRule) {
                    const startTime = Date.now();
                    const initialBeliefCount = this.nar.state.hypergraph.size;

                    selectedRule.action(hyperedge, event, name);

                    const endTime = Date.now();
                    const finalBeliefCount = this.nar.state.hypergraph.size;
                    const success = finalBeliefCount > initialBeliefCount;
                    const computationalCost = endTime - startTime;
                    const value = success ? event.budget.priority : 0;

                    this.nar.cognitiveExecutive.monitorDerivation(name, success, computationalCost, value);
                    this.nar.conceptFormation.trackUsage(target, event.activation, event.budget);

                    selectedRule.lastUsed = endTime;
                    selectedRule.usageCount++;
                    this.inferenceCount++;
                    break;
                }
            }
        } else {
            // If no rule was selected to run, we can treat this as a "failure" for the given event context.
            // We can't attribute it to a specific rule, but we can log it for general performance analysis.
            this.nar.cognitiveExecutive.monitorDerivation('no_rule_selected', false, 0, 0);
        }
    }

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

    _deriveInheritance({args: [subject, predicate]}, event, ruleName) {
        const subjectId = getArgId(subject);
        const predicateId = getArgId(predicate);
        const {activation, budget, pathHash, pathLength, derivationPath} = event;
        const currentHyperedge = this.nar.state.hypergraph.get(id('Inheritance', [subject, predicate]));


        (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(termId => {
            const forwardChainEdge = this.nar.state.hypergraph.get(termId);
            if (forwardChainEdge?.type === 'Inheritance' && getArgId(forwardChainEdge.args[0]) === predicateId) {
                const newPredicate = forwardChainEdge.args[1];
                const context = {
                    subject: subject,
                    predicate: newPredicate,
                    premise1: currentHyperedge,
                    premise2: forwardChainEdge,
                    ruleName
                };
                this._deriveTransitiveInheritance(context, event);
            }
        });
    }

    _deriveTransitiveInheritance(context, event) {
        const {subject, predicate, premise1, premise2, ruleName} = context;
        const {activation, budget, pathHash, pathLength, derivationPath} = event;

        const subjectId = getArgId(subject);
        const predicateId = getArgId(predicate);
        const key = this._memoKey('Inheritance', [subjectId, predicateId], pathHash);
        if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
        this.nar.state.memoization.set(key, pathLength);

        const cacheKey = `${subjectId}→${predicateId}|${premise1.id}|${premise2.id}`;
        if (this.nar.state.index.derivationCache.has(cacheKey)) return;
        this.nar.state.index.derivationCache.set(cacheKey, true);

        this._propagate({
            target: id('Inheritance', [subject, predicate]),
            truth: TruthValue.transitive(premise1.getTruth(), premise2.getTruth()),
            budgetFactor: 0.7,
            activationFactor: 1.0,
            derivationSuffix: 'transitivity',
            premises: [premise1.id, premise2.id]
        });

        const currentHyperedge = this.nar.state.hypergraph.get(id('Inheritance', [subject, predicate]));

        (this.nar.state.index.byArg.get(subjectId) || new Set()).forEach(termId => {
            const backwardChainEdge = this.nar.state.hypergraph.get(termId);
            if (backwardChainEdge?.type === 'Inheritance' && getArgId(backwardChainEdge.args[1]) === subjectId) {
                const newSubject = backwardChainEdge.args[0];
                const context = {
                    subject: newSubject,
                    predicate: predicate,
                    premise1: backwardChainEdge,
                    premise2: currentHyperedge,
                    ruleName
                };
                this._deriveTransitiveInheritance(context, event);
            }
        });


        this._propagate({
            target: id('Similarity', [subject, predicate]),
            budgetFactor: 0.6,
            activationFactor: 1.0,
            derivationSuffix: ruleName,
            truth: new TruthValue(1.0, 0.9) // Default truth for similarity
        });

        this._derivePropertyInheritance(subject, predicateId, activation, budget, pathHash, pathLength, derivationPath, ruleName);

        this._findAndDeriveInductionFromInheritance(subject, predicateId, ruleName, event);
    }


    _derivePropertyInheritance(subject, predicateId, activation, budget, pathHash, pathLength, derivationPath, ruleName) {
        if (this.nar.state.hypergraph.has(id('Instance', [subject, 'entity']))) {
            (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(propId => {
                const property = this.nar.state.hypergraph.get(propId);
                if (property?.type === 'Property') {
                    this._propagate({
                        target: id('Property', [subject, property.args[1]]),
                        budgetFactor: 0.5,
                        activationFactor: 0.6,
                        derivationSuffix: 'property_derivation'
                    });
                }
            });
        }
    }

    _findAndDeriveInductionFromInheritance(subject, predicateId, ruleName, event) {
        (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(termId => {
            const other = this.nar.state.hypergraph.get(termId);
            if (other?.type === 'Inheritance' && getArgId(other.args[1]) === predicateId && getArgId(other.args[0]) !== subject) {
                const context = {
                    term1: subject,
                    term2: other.args[0],
                    predicate: predicateId,
                    premise1: this.nar.state.hypergraph.get(id('Inheritance', [subject, predicateId])),
                    premise2: other,
                    ruleName
                };
                this._performInductiveSimilarityDerivation(context, event);
            }
        });
    }

    _deriveSimilarity({args: [term1, term2]}, event, ruleName) {
        const term1Id = getArgId(term1);
        const {activation, budget, pathHash, pathLength, derivationPath} = event;

        this.nar.propagation.propagate({
            target: id('Similarity', [term2, term1]),
            activation,
            budget: budget.scale(0.9),
            pathHash: pathHash ^ hash(String(id('Similarity', [term2, term1]))),
            pathLength: pathLength + 1,
            derivationPath: [...derivationPath, 'symmetry']
        });

        (this.nar.state.index.byArg.get(term1Id) || new Set()).forEach(termId => {
            const premise = this.nar.state.hypergraph.get(termId);
            if (premise?.type === 'Inheritance' && getArgId(premise.args[0]) === term1Id) {
                const context = {
                    term1,
                    term2,
                    predicate: premise.args[1],
                    similarity: this.nar.state.hypergraph.get(id('Similarity', [term1, term2])),
                    premise,
                    ruleName
                };
                this._deriveAnalogy(context, event);
            }
        });
    }

    _performInductiveSimilarityDerivation(context, event) {
        const {term1, term2, predicate, premise1, premise2} = context;
        const {budget, pathHash, pathLength} = event;

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
        this.nar.api.similarity(term1, term2, {
            truth,
            budget: budget.scale(0.6),
            premises: [premise1.id, premise2.id],
            derivedBy: 'induction'
        });
    }

    _deriveAnalogy(context, event) {
        const {term1, term2, predicate, similarity, premise, ruleName} = context;
        const {budget, pathHash, pathLength} = event;

        const term2Id = getArgId(term2);
        const predicateId = getArgId(predicate);
        const key = this._memoKey('Inheritance', [term2Id, predicateId], pathHash);
        if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
        this.nar.state.memoization.set(key, pathLength);

        const truth = TruthValue.analogy(similarity.getTruth(), premise.getTruth());
        this.nar.api.inheritance(term2, predicate, {
            truth,
            budget: budget.scale(0.6),
            premises: [similarity.id, premise.id],
            derivedBy: 'analogy'
        });
    }

    _deriveImplication({args: [premise, conclusion]}, event, ruleName) {
        const premiseId = getArgId(premise);
        if (this.nar.state.hypergraph.has(premiseId)) {
            let targetConclusion = conclusion;
            if (typeof targetConclusion === 'string') {
                targetConclusion = this.nar.expressionEvaluator.parse(targetConclusion);
            }

            this.nar.propagation.propagate({
                target: id(targetConclusion.type, targetConclusion.args),
                activation: event.activation * 0.9,
                budget: event.budget.scale(0.75),
                pathHash: event.pathHash,
                pathLength: event.pathLength + 1,
                derivationPath: [...event.derivationPath, ruleName]
            });
        }
    }

    _deriveEquivalence({args: [term1, term2]}, event, ruleName) {
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

    _deriveConjunction({args}, event, ruleName) {
        args.forEach(term =>
            this.nar.propagation.propagate({
                target: getArgId(term),
                activation: event.activation * 0.9,
                budget: event.budget.scale(0.75),
                pathHash: event.pathHash,
                pathLength: event.pathLength + 1,
                derivationPath: [...event.derivationPath, ruleName]
            })
        );
    }

    _deriveTransitiveTemporalRelation({args: [premise, conclusion, relation]}, event, ruleName) {
        const premiseId = getArgId(premise);
        const eventHyperedge = this.nar.state.hypergraph.get(event.target);
        if (!eventHyperedge) return;

        (this.nar.state.index.byArg.get(premiseId) || new Set()).forEach(termId => {
            const middle = this.nar.state.hypergraph.get(termId);

            if (middle?.type === 'TemporalRelation' && getArgId(middle.args[1]) === premiseId) {
                const firstTerm = middle.args[0];
                const firstRelation = middle.args[2];

                const composedRelations = this._composeTemporalRelations(firstRelation, relation);
                if (composedRelations) {
                    composedRelations.forEach(newRelation => {
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

    _composeTemporalRelations(rel1, rel2, triedInverse = false) {
        const table = {
            'before': {
                'before': ['before'],
                'meets': ['before'],
                'overlaps': ['before'],
                'starts': ['before'],
                'during': ['before'],
                'finishes': ['before', 'meets', 'overlaps', 'starts', 'during']
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

        // Try composing with inverse relations if a direct entry is not found, but only once.
        if (!triedInverse) {
            const inv_r1 = this._getInverseTemporalRelation(rel1);
            const inv_r2 = this._getInverseTemporalRelation(rel2);
            if (inv_r1 && inv_r2) {
                const inv_composed = this._composeTemporalRelations(inv_r2, inv_r1, true);
                if (inv_composed) {
                    return inv_composed.map(r => this._getInverseTemporalRelation(r)).filter(r => r);
                }
            }
        }
        return null;
    }

    _deriveDisjunction({args}, event) {
        // Placeholder
    }

    _deriveProduct({args}, event) {
        // Placeholder
    }

    _deriveImageExt({args}, event) {
        // Placeholder
    }

    _deriveImageInt({args}, event) {
        // Placeholder
    }

    _deriveTerm(hyperedge, event) {
        // Placeholder
    }
}
