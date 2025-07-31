import { id } from '../support/utils.js';

export class LearningEngine {
    constructor(nar) {
        this.nar = nar;
        this.experienceBuffer = [];
        this.ruleEffectiveness = new Map();
        this.patternMemory = new Map();
        this.learningRate = 0.1;
    }

    recordExperience(event, outcome = {}) {
        const experience = {
            id: `Exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: Date.now(),
            derivationPath: event.derivationPath,
            target: event.target,
            budget: event.budget,
            outcome: outcome
        };

        this.experienceBuffer.push(experience);
        if (this.experienceBuffer.length > 1000) {
            this.experienceBuffer.shift();
        }
    }

    applyLearning() {
        this._updateRuleEffectiveness();
        this._discoverAndCreateRules();
    }

    _updateRuleEffectiveness() {
        if (this.experienceBuffer.length < 50) return;

        const recentExperiences = this.experienceBuffer.slice(-200);
        const ruleStats = new Map();

        recentExperiences.forEach(exp => {
            if (!exp.derivationPath || exp.derivationPath.length === 0) return;
            const rule = exp.derivationPath[exp.derivationPath.length - 1];
            if (!ruleStats.has(rule)) {
                ruleStats.set(rule, { successes: 0, attempts: 0 });
            }
            const stats = ruleStats.get(rule);
            stats.attempts++;
            if (exp.budget.priority > 0.7) {
                stats.successes++;
            }
        });

        ruleStats.forEach((stats, rule) => {
            const currentEffectiveness = this.ruleEffectiveness.get(rule) || { successes: 0, attempts: 0 };
            currentEffectiveness.successes += stats.successes;
            currentEffectiveness.attempts += stats.attempts;
            this.ruleEffectiveness.set(rule, currentEffectiveness);
        });

        this.experienceBuffer = this.experienceBuffer.slice(-100);
    }

    getRulePriority(ruleName) {
        const stats = this.ruleEffectiveness.get(ruleName);
        if (!stats || stats.attempts < 10) return 0.5;
        return stats.successes / stats.attempts;
    }

    _discoverAndCreateRules() {
        const pathCounts = new Map();
        this.experienceBuffer.forEach(exp => {
            if(exp.derivationPath && exp.budget.priority > 0.8) {
                const pathKey = exp.derivationPath.join('->');
                pathCounts.set(pathKey, (pathCounts.get(pathKey) || 0) + 1);
            }
        });

        pathCounts.forEach((count, pathKey) => {
            if(count > 5) {
                const path = pathKey.split('->');
                this._createShortcutRule(path);
            }
        });
    }

    _createShortcutRule(path) {
        if (path.length < 3) return;

        const premiseId = path[0];
        const conclusionId = path[path.length-1];

        const premiseHyperedge = this.nar.hypergraph.get(premiseId);
        const conclusionHyperedge = this.nar.hypergraph.get(conclusionId);

        if(premiseHyperedge && conclusionHyperedge) {
            const shortcutId = id('ShortcutRule', [premiseId, conclusionId]);
            if (!this.nar.hypergraph.has(shortcutId)) {
                this.nar.implication(premiseId, conclusionId, {
                    truth: this.nar.truth(0.9, 0.8),
                    budget: this.nar.budget(0.9, 0.9, 0.9)
                });
                this.nar.notifyListeners('shortcut-created', { from: premiseId, to: conclusionId });
            }
        }
    }
}
