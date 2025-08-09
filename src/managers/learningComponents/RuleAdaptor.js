export class RuleAdaptor {
    constructor(learningEngine) {
        this.learningEngine = learningEngine;
        this.nar = learningEngine.nar;
        this.config = learningEngine.config;
        this.ruleProductivity = new Map();
    }

    adaptDerivationRules() {
        const stats = this.getRuleProductivityStats();
        if (!stats) return;

        stats.forEach((ruleStats, ruleName) => {
            if (ruleStats.attempts < this.config.ruleProductivityMinAttempts) return;

            const effectiveness = ruleStats.successes / ruleStats.attempts;
            const rule = this.nar.derivationEngine.rules.get(ruleName);
            if (!rule) return;

            if (effectiveness < this.config.ruleDisableEffectivenessThreshold) {
                if (rule.enabled !== false) {
                    rule.enabled = false;
                    this.nar.emit('rule-disabled', {
                        rule: ruleName,
                        effectiveness,
                        reason: 'Consistently produced incorrect or useless results.'
                    });
                }
            } else if (effectiveness > this.config.ruleEnableEffectivenessThreshold && rule.enabled === false) {
                rule.enabled = true;
                this.nar.emit('rule-enabled', {
                    rule: ruleName,
                    effectiveness,
                    reason: 'Performance has improved.'
                });
            }
        });
    }

    updateRuleProductivity(ruleName, wasSuccessful) {
        if (!ruleName) return;
        if (!this.ruleProductivity.has(ruleName)) {
            this.ruleProductivity.set(ruleName, {successes: 0, attempts: 0});
        }
        const stats = this.ruleProductivity.get(ruleName);
        stats.attempts++;
        if (wasSuccessful) {
            stats.successes++;
        }
    }

    getRuleProductivityStats() {
        return this.ruleProductivity;
    }
}
