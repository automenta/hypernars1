/**
 * # Meta-Reasoning Layer (The "Cognitive Executive")
 *
 * ## Core Philosophy
 * While the current NARHyper implementation successfully unifies symbolic and subsymbolic reasoning, it lacks mechanisms
 * for *adaptive intelligence* - the ability to improve its own reasoning capabilities through experience. My proposal
 * focuses on enhancing NARHyper with meta-cognitive capabilities that enable the system to become more intelligent about
 * *how* it reasons, not just *what* it reasons about.
 *
 * ## Key Enhancements
 *
 * ### 1. Meta-Reasoning Layer (The "Cognitive Executive")
 *
 * **Problem**: Current NARHyper executes derivation rules mechanically without evaluating their effectiveness or adapting
 * strategies.
 *
 * **Solution**: Introduce a meta-reasoning subsystem that:
 *
 * - Tracks the productivity of each derivation rule (success rate, computational cost, value of conclusions)
 * - Learns which rules work best in different contexts
 * - Dynamically adjusts rule priorities based on performance metrics
 * - Identifies reasoning bottlenecks and allocates resources accordingly
 */
import {clamp, hash} from '../support/utils.js';

class CognitiveExecutive {
    constructor(nar) {
        this.nar = nar;
        this.rulePerformance = new Map(); // Tracks rule effectiveness
        this.reasoningGoals = new Set();
        this.resourceAllocationHistory = [];
    }

    monitorDerivation(ruleType, success, computationalCost, value) {
        if (!this.rulePerformance.has(ruleType)) {
            this.rulePerformance.set(ruleType, {
                successes: 0,
                attempts: 0,
                totalCost: 0,
                totalValue: 0,
                contextPatterns: new Map()
            });
        }

        const stats = this.rulePerformance.get(ruleType);
        stats.attempts++;
        if (success) stats.successes++;
        stats.totalCost += computationalCost;
        stats.totalValue += value;

        // Track context patterns where rule succeeds/fails
        const contextSignature = this._extractContextSignature();
        if (!stats.contextPatterns.has(contextSignature)) {
            stats.contextPatterns.set(contextSignature, {successes: 0, attempts: 0});
        }
        const patternStats = stats.contextPatterns.get(contextSignature);
        patternStats.attempts++;
        if (success) patternStats.successes++;
    }

    adaptRulePriorities() {
        // Calculate efficiency: value per computational cost
        const ruleEfficiencies = Array.from(this.rulePerformance.entries())
            .map(([rule, stats]) => ({
                rule,
                efficiency: stats.attempts > 0
                    ? (stats.totalValue / stats.attempts) / (stats.totalCost / stats.attempts)
                    : 0,
                contextAdaptivity: this._calculateContextAdaptivity(stats)
            }));

        // Adjust budget scaling factors based on efficiency
        ruleEfficiencies.forEach(({rule, efficiency, contextAdaptivity}) => {
            const currentConfig = this.nar.config.ruleConfig[rule] || {};
            const newScale = clamp(
                (currentConfig.budgetScale || 0.7) * (0.8 + 0.4 * efficiency),
                0.3, 1.0
            );

            // Store updated configuration
            if (!this.nar.config.ruleConfig) {
                this.nar.config.ruleConfig = {};
            }

            this.nar.config.ruleConfig[rule] = {
                ...(this.nar.config.ruleConfig[rule] || {}),
                budgetScale: newScale,
                contextAdaptivity
            };

            const ruleObject = this.nar.derivationEngine.rules.get(rule);
            if (ruleObject) {
                ruleObject.priority = newScale;
            }
        });
    }

    _extractContextSignature() {
        // Create hash of current high-priority concepts and recent questions
        const activeConcepts = [...this.nar.state.activations.entries()]
            .filter(([_, activation]) => activation > 0.5)
            .map(([id]) => id)
            .sort()
            .slice(0, 5);

        const recentQuestions = [...this.nar.state.questionPromises.keys()]
            .slice(-3)
            .map(q => q.replace(/^.+?\((.+?)\|.+$/, '$1'));

        return hash(`${activeConcepts.join('|')}~${recentQuestions.join('|')}`);
    }

    _calculateContextAdaptivity(stats) {
        // Placeholder implementation
        return 0.5;
    }

    setReasoningGoal(goal, priority = 0.8) {
        const goalId = this.nar._id('ReasoningGoal', [goal, Date.now()]);
        this.reasoningGoals.add(goalId);

        // Create a persistent high-priority event to drive toward this goal
        this.nar.eventQueue.push({
            target: goalId,
            activation: 1.0,
            budget: new Budget(priority, 0.9, 0.95),
            pathHash: 0,
            pathLength: 0,
            derivationPath: ['goal-driven']
        });

        // Register listener to detect when goal is achieved
        this.nar.on('belief-added', (data) => {
            if (this._matchesGoal(goal, data.hyperedgeId)) {
                this._recordGoalAchievement(goalId, data);
            }
        });

        return goalId;
    }

    _matchesGoal(goal, hyperedgeId) {
        // Parse goal pattern and check if hyperedge matches
        // Implementation would handle pattern matching against goal criteria
    }
}

export {CognitiveExecutive};
