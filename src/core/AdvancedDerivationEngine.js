import {DerivationEngineBase} from './DerivationEngineBase.js';
import {TruthValue} from '../support/TruthValue.js';
import {getArgId, hash, id} from '../support/utils.js';
import {getInverseTemporalRelation, composeTemporalRelations} from '../support/temporalUtils.js';
import {config} from '../config/index.js';
import {advancedDerivationEngineConfig} from "../config/AdvancedDerivationEngine.config.js";
import {mergeConfig} from "../support/utils.js";
import {InheritanceRule} from './derivation-rules/InheritanceRule.js';
import {SimilarityRule} from './derivation-rules/SimilarityRule.js';
import {ImplicationRule} from './derivation-rules/ImplicationRule.js';
import {EquivalenceRule} from './derivation-rules/EquivalenceRule.js';
import {ConjunctionRule} from './derivation-rules/ConjunctionRule.js';
import {TemporalRelationRule} from './derivation-rules/TemporalRelationRule.js';

const defaultConfig = advancedDerivationEngineConfig;

export class AdvancedDerivationEngine extends DerivationEngineBase {
    constructor(nar) {
        super(nar);
        this.config = mergeConfig(defaultConfig, nar.config.advancedDerivationEngine);
        this.rules = new Map();
        this.inferenceCount = 0;
        this._registerDefaultRules();
    }

    registerRule(rule) {
        this.rules.set(rule.name, rule);
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
        return [...this.rules.values()].filter(rule => rule.condition(event));
    }

    _sortRules() {
        this.rules = new Map([...this.rules.entries()]
            .sort(([, a], [, b]) => b.priority - a.priority));
    }

    _registerDefaultRules() {
        this.registerRule(new InheritanceRule(this.nar, this.config));
        this.registerRule(new SimilarityRule(this.nar, this.config));
        this.registerRule(new ImplicationRule(this.nar, this.config));
        this.registerRule(new EquivalenceRule(this.nar, this.config));
        this.registerRule(new ConjunctionRule(this.nar, this.config));
        this.registerRule(new TemporalRelationRule(this.nar, this.config));
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
            const dynamicFactor = this.nar.cognitiveExecutive.getRulePriority(rule.name);
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
        const ruleName = rule.name;
        if (!ruleName) return;

        const startTime = Date.now();
        const initialBeliefCount = this.nar.state.hypergraph.size;

        rule.execute(hyperedge, event, ruleName);

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
}
