import {DerivationEngineBase} from './DerivationEngineBase.js';
import {TruthValue} from '../support/TruthValue.js';
import {getArgId, hash, id} from '../support/utils.js';
import {getInverseTemporalRelation, composeTemporalRelations} from '../support/temporalUtils.js';
import {config} from '../config/index.js';
import {advancedDerivationEngineConfig} from "../config/AdvancedDerivationEngine.config.js";
import {mergeConfig} from "../support/utils.js";

const defaultConfig = advancedDerivationEngineConfig;

const RULE = {
    INHERITANCE: 'Inheritance',
    SIMILARITY: 'Similarity',
    IMPLICATION: 'Implication',
    EQUIVALENCE: 'Equivalence',
    CONJUNCTION: 'Conjunction',
    TEMPORAL_RELATION: 'TemporalRelation'
};

export class AdvancedDerivationEngine extends DerivationEngineBase {
    constructor(nar) {
        super(nar);
        this.config = mergeConfig(defaultConfig, nar.config.advancedDerivationEngine);
        this.rules = new Map();
        this.inferenceCount = 0;
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
                rule.successRate = oldSuccessRate * (1 - this.config.ruleSuccessRateLearningRate) + newSuccessRate * this.config.ruleSuccessRateLearningRate;

                rule.priority = rule.successRate * this.config.ruleSuccessRateWeight + rule.applicability * this.config.ruleApplicabilityWeight;
                rulesChanged = true;
            } else {
                rule.priority *= this.config.ruleRecencyFactor;
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
        this.registerRule(RULE.INHERITANCE, event => this.nar.state.hypergraph.get(event.target)?.type === RULE.INHERITANCE, (h, e, r) => this._deriveInheritance(h, e, r));
        this.registerRule(RULE.SIMILARITY, event => this.nar.state.hypergraph.get(event.target)?.type === RULE.SIMILARITY, (h, e, r) => this._deriveSimilarity(h, e, r));
        this.registerRule(RULE.IMPLICATION, event => this.nar.state.hypergraph.get(event.target)?.type === RULE.IMPLICATION, (h, e, r) => this._deriveImplication(h, e, r));
        this.registerRule(RULE.EQUIVALENCE, event => this.nar.state.hypergraph.get(event.target)?.type === RULE.EQUIVALENCE, (h, e, r) => this._deriveEquivalence(h, e, r));
        this.registerRule(RULE.CONJUNCTION, event => this.nar.state.hypergraph.get(event.target)?.type === RULE.CONJUNCTION, (h, e, r) => this._deriveConjunction(h, e, r));
        this.registerRule(RULE.TEMPORAL_RELATION, event => this.nar.state.hypergraph.get(event.target)?.type === RULE.TEMPORAL_RELATION, (h, e, r) => this._deriveTransitiveTemporalRelation(h, e, r));
    }

    _addBeliefAndPropagate(options, event) {
        const {type, args, truth, budgetFactor, activationFactor, derivationSuffix, premises} = options;
        const {activation, budget, pathHash, pathLength, derivationPath = []} = event;

        const targetId = id(type, args);

        if (truth) {
            this.nar.api.addHyperedge(type, args, {
                truth,
                budget: budget.scale(budgetFactor),
                premises: premises,
                derivedBy: derivationSuffix
            });
        }

        this.nar.propagation.propagate({
            target: targetId,
            activation: activation * activationFactor,
            budget: budget.scale(budgetFactor),
            pathHash: pathHash ^ hash(String(targetId)),
            pathLength: pathLength + 1,
            derivationPath: [...derivationPath, derivationSuffix]
        });
    }

    _memoKey(type, args, pathHash) {
        return `${id(type, args)}|${pathHash}`;
    }

    applyDerivationRules(event) {
        if (event.type === 'add-belief') {
            this._handleBeliefAddition(event);
            return;
        }

        const {target, activation, pathLength} = event;
        const hyperedge = this.nar.state.hypergraph.get(target);
        if (!hyperedge || activation <= this.nar.config.inferenceThreshold || pathLength > this.nar.config.maxDerivationDepth) return;

        const activeRules = this.getActiveRules(event);
        if (activeRules.length === 0) return;

        const selectedRule = this._selectRule(activeRules);
        if (selectedRule) {
            this._executeRule(selectedRule, hyperedge, event);
        } else {
            this.nar.cognitiveExecutive.monitorDerivation('no_rule_selected', false, 0, 0);
        }
    }

    _handleBeliefAddition(event) {
        const hyperedge = this.nar.state.hypergraph.get(event.target);
        if (hyperedge) {
            const {newBelief} = hyperedge.revise(event.belief);
            this.nar.questionHandler.checkQuestionAnswers(hyperedge.id, newBelief);
        }
    }

    _selectRule(activeRules) {
        const weightedRules = activeRules.map(rule => {
            const ruleName = [...this.rules.entries()].find(([_, r]) => r === rule)?.[0];
            const dynamicFactor = this.nar.cognitiveExecutive.getRulePriority(ruleName);
            return {rule, weight: rule.priority * dynamicFactor};
        });

        const totalPriority = weightedRules.reduce((sum, item) => sum + item.weight, 0);
        if (totalPriority === 0) return null;

        let random = Math.random() * totalPriority;
        for (const item of weightedRules) {
            random -= item.weight;
            if (random <= 0) {
                return item.rule;
            }
        }
        return activeRules[activeRules.length - 1]; // Fallback
    }

    _executeRule(rule, hyperedge, event) {
        const ruleName = [...this.rules.entries()].find(([_, r]) => r === rule)?.[0];
        if (!ruleName) return;

        const startTime = Date.now();
        const initialBeliefCount = this.nar.state.hypergraph.size;

        rule.action(hyperedge, event, ruleName);

        const endTime = Date.now();
        const finalBeliefCount = this.nar.state.hypergraph.size;
        const success = finalBeliefCount > initialBeliefCount;
        const computationalCost = endTime - startTime;
        const value = success ? event.budget.priority : 0;

        this.nar.cognitiveExecutive.monitorDerivation(ruleName, success, computationalCost, value);
        this.nar.conceptFormation.trackUsage(event.target, event.activation, event.budget);

        rule.lastUsed = endTime;
        rule.usageCount++;
        this.inferenceCount++;
    }

    getAndResetInferenceCount() {
        const count = this.inferenceCount;
        this.inferenceCount = 0;
        return count;
    }

    boostRuleSuccessRate(ruleName, factor = this.config.boostFactor) {
        const rule = this.rules.get(ruleName);
        if (rule) {
            rule.successRate = rule.successRate * (1 - factor) + 1 * factor;
            this._sortRules();
        }
    }

    penalizeRuleSuccessRate(ruleName, factor = this.config.penalizeFactor) {
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
        const currentHyperedge = this.nar.state.hypergraph.get(id(RULE.INHERITANCE, [subject, predicate]));


        (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(termId => {
            const forwardChainEdge = this.nar.state.hypergraph.get(termId);
            if (forwardChainEdge?.type === RULE.INHERITANCE && getArgId(forwardChainEdge.args[0]) === predicateId) {
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
        if (!premise1 || !premise2) return;

        const {activation, budget, pathHash, pathLength, derivationPath = []} = event;

        const subjectId = getArgId(subject);
        const predicateId = getArgId(predicate);
        const key = this._memoKey(RULE.INHERITANCE, [subjectId, predicateId], pathHash);
        if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
        this.nar.state.memoization.set(key, pathLength);

        const cacheKey = `${subjectId}→${predicateId}|${premise1.id}|${premise2.id}`;
        if (this.nar.state.index.derivationCache.has(cacheKey)) return;
        this.nar.state.index.derivationCache.set(cacheKey, true);

        this._addBeliefAndPropagate({
            type: RULE.INHERITANCE,
            args: [subject, predicate],
            truth: TruthValue.transitive(premise1.getTruth(), premise2.getTruth()),
            budgetFactor: this.config.transitiveInheritanceBudgetFactor,
            activationFactor: this.config.transitiveInheritanceActivationFactor,
            derivationSuffix: 'transitivity',
            premises: [premise1.id, premise2.id]
        }, event);

        const currentHyperedge = this.nar.state.hypergraph.get(id(RULE.INHERITANCE, [subject, predicate]));

        if (!currentHyperedge) {
            return;
        }

        (this.nar.state.index.byArg.get(subjectId) || new Set()).forEach(termId => {
            const backwardChainEdge = this.nar.state.hypergraph.get(termId);
            if (backwardChainEdge?.type === RULE.INHERITANCE && getArgId(backwardChainEdge.args[1]) === subjectId) {
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


        this._addBeliefAndPropagate({
            type: RULE.SIMILARITY,
            args: [subject, predicate],
            budgetFactor: this.config.similarityFromInheritanceBudgetFactor,
            activationFactor: this.config.similarityFromInheritanceActivationFactor,
            derivationSuffix: ruleName,
            truth: new TruthValue(1.0, 0.9) // Default truth for similarity
        }, event);

        this._derivePropertyInheritance(subject, predicateId, event, ruleName);

        this._findAndDeriveInductionFromInheritance(subject, predicateId, ruleName, event);
    }


    _derivePropertyInheritance(subject, predicateId, event, ruleName) {
        if (this.nar.state.hypergraph.has(id('Instance', [subject, 'entity']))) {
            (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(propId => {
                const property = this.nar.state.hypergraph.get(propId);
                if (property?.type === 'Property') {
                    this._addBeliefAndPropagate({
                        type: 'Property',
                        args: [subject, property.args[1]],
                        budgetFactor: this.config.propertyInheritanceBudgetFactor,
                        activationFactor: this.config.propertyInheritanceActivationFactor,
                        derivationSuffix: 'property_derivation'
                    }, event);
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
        const {activation, budget, pathHash, pathLength, derivationPath = []} = event;

        this.nar.propagation.propagate({
            target: id(RULE.SIMILARITY, [term2, term1]),
            activation,
            budget: budget.scale(this.config.similaritySymmetryBudgetFactor),
            pathHash: pathHash ^ hash(String(id(RULE.SIMILARITY, [term2, term1]))),
            pathLength: pathLength + 1,
            derivationPath: [...derivationPath, 'symmetry']
        });

        (this.nar.state.index.byArg.get(term1Id) || new Set()).forEach(termId => {
            const premise = this.nar.state.hypergraph.get(termId);
            if (premise?.type === RULE.INHERITANCE && getArgId(premise.args[0]) === term1Id) {
                const context = {
                    term1,
                    term2,
                    predicate: premise.args[1],
                    similarity: this.nar.state.hypergraph.get(id(RULE.SIMILARITY, [term1, term2])),
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
        const key = this._memoKey(RULE.SIMILARITY, [term1Id, term2Id], pathHash);
        if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
        this.nar.state.memoization.set(key, pathLength);

        const cacheKey = `${term1Id}↔${term2Id}|induction|${predicateId}`;
        if (this.nar.state.index.derivationCache.has(cacheKey)) return;
        this.nar.state.index.derivationCache.set(cacheKey, true);

        const truth = TruthValue.induction(premise1.getTruth(), premise2.getTruth());
        this.nar.api.similarity(term1, term2, {
            truth,
            budget: budget.scale(this.config.inductiveSimilarityBudgetFactor),
            premises: [premise1.id, premise2.id],
            derivedBy: 'induction'
        });
    }

    _deriveAnalogy(context, event) {
        const {term1, term2, predicate, similarity, premise, ruleName} = context;
        if (!similarity || !premise) return;

        const {budget, pathHash, pathLength} = event;

        const term2Id = getArgId(term2);
        const predicateId = getArgId(predicate);
        const key = this._memoKey(RULE.INHERITANCE, [term2Id, predicateId], pathHash);
        if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
        this.nar.state.memoization.set(key, pathLength);

        const truth = TruthValue.analogy(similarity.getTruth(), premise.getTruth());
        this.nar.api.inheritance(term2, predicate, {
            truth,
            budget: budget.scale(this.config.analogyBudgetFactor),
            premises: [similarity.id, premise.id],
            derivedBy: 'analogy'
        });
    }

    _deriveImplication({args: [premise, conclusion]}, event, ruleName) {
        const premiseId = getArgId(premise);
        if (this.nar.state.hypergraph.has(premiseId)) {
            let targetId;
            // If conclusion is a simple string (a term name), its ID is itself.
            // Otherwise, it's a complex statement that needs to be parsed to form a hyperedge ID.
            if (typeof conclusion === 'string' && /^[a-zA-Z0-9]+$/.test(conclusion)) {
                targetId = conclusion;
            } else {
                const parsedConclusion = (typeof conclusion === 'string') ? this.nar.expressionEvaluator.parse(conclusion) : conclusion;
                if (parsedConclusion && parsedConclusion.type && parsedConclusion.args) {
                    targetId = id(parsedConclusion.type, parsedConclusion.args);
                } else {
                    targetId = getArgId(conclusion); // Fallback
                }
            }

            this.nar.propagation.propagate({
                target: targetId,
                activation: event.activation * this.config.implicationActivationFactor,
                budget: event.budget.scale(this.config.implicationBudgetFactor),
                pathHash: event.pathHash,
                pathLength: event.pathLength + 1,
                derivationPath: [...(event.derivationPath || []), ruleName]
            });
        }
    }

    _deriveEquivalence({args: [term1, term2]}, event, ruleName) {
        this.nar.api.implication(term1, term2, {
            truth: event.hyperedge.getTruth(),
            budget: event.budget.scale(this.config.equivalenceBudgetFactor),
            derivedBy: ruleName
        });
        this.nar.api.implication(term2, term1, {
            truth: event.hyperedge.getTruth(),
            budget: event.budget.scale(this.config.equivalenceBudgetFactor),
            derivedBy: ruleName
        });
    }

    _deriveConjunction({args}, event, ruleName) {
        args.forEach(term =>
            this.nar.propagation.propagate({
                target: getArgId(term),
                activation: event.activation * this.config.conjunctionActivationFactor,
                budget: event.budget.scale(this.config.conjunctionBudgetFactor),
                pathHash: event.pathHash,
                pathLength: event.pathLength + 1,
                derivationPath: [...(event.derivationPath || []), ruleName]
            })
        );
    }

    _deriveTransitiveTemporalRelation({args: [premise, conclusion, relation]}, event, ruleName) {
        const premiseId = getArgId(premise);
        const eventHyperedge = this.nar.state.hypergraph.get(event.target);
        if (!eventHyperedge) return;

        (this.nar.state.index.byArg.get(premiseId) || new Set()).forEach(termId => {
            const middle = this.nar.state.hypergraph.get(termId);

            if (middle?.type === RULE.TEMPORAL_RELATION && getArgId(middle.args[1]) === premiseId) {
                const firstTerm = middle.args[0];
                const firstRelation = middle.args[2];

                const composedRelations = composeTemporalRelations(firstRelation, relation);
                if (composedRelations) {
                    composedRelations.forEach(newRelation => {
                        this.nar.api.addHyperedge(RULE.TEMPORAL_RELATION, [firstTerm, conclusion, newRelation], {
                            truth: TruthValue.transitive(middle.getTruth(), eventHyperedge.getTruth()),
                            budget: event.budget.scale(this.config.transitiveTemporalBudgetFactor),
                            premises: [middle.id, eventHyperedge.id],
                            derivedBy: 'TransitiveTemporal'
                        });
                    });
                }
            }
        });
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
