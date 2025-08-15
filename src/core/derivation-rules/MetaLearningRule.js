import {DerivationRuleBase} from './DerivationRuleBase.js';

export class MetaLearningRule extends DerivationRuleBase {
    constructor(nar, config) {
        // The condition function is passed to the base class constructor
        super(nar, config, 'MetaLearningRule', event => {
            const hyperedge = this.nar.state.hypergraph.get(event.target);
            if (!hyperedge || hyperedge.type !== 'Inheritance') {
                return false;
            }
            const [subject] = hyperedge.args;
            return subject.startsWith('Term(*,') && subject.endsWith(')');
        });
        this.priority = 1.0; // High priority to act on meta-beliefs quickly
    }

    execute(hyperedge, event, ruleName) {
        const [subject, predicate] = hyperedge.args;

        try {
            // Extract config key from subject, e.g., "Term(*, budgetThreshold)" -> "budgetThreshold"
            const configKeyMatch = subject.match(/\(\*, (.+)\)/);
            if (!configKeyMatch || !configKeyMatch[1]) return;
            const configKey = configKeyMatch[1];

            // Extract value from predicate, e.g., "Term(0.1)" -> "0.1"
            const valueMatch = predicate.match(/\((.+)\)/);
            if (!valueMatch || !valueMatch[1]) return;
            const valueStr = valueMatch[1];
            const value = parseFloat(valueStr);

            if (configKey && !isNaN(value)) {
                if (this.nar.config.hasOwnProperty(configKey)) {
                    console.log(`[MetaLearningRule] Applying config change: ${configKey} = ${value}`);
                    this.nar.config[configKey] = value;
                    this.nar.emit('meta-learning-applied', {configKey, value});
                } else {
                    console.warn(`[MetaLearningRule] Config key not found: ${configKey}`);
                }
            }
        } catch (error) {
            console.error(`[MetaLearningRule] Error applying meta-learning rule: ${error}`);
        }
    }
}
