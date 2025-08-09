import {DerivationRuleBase} from './DerivationRuleBase.js';
import {getArgId, id} from '../../support/utils.js';

export class ImplicationRule extends DerivationRuleBase {
    constructor(nar, config) {
        super(nar, config, 'Implication', event => nar.state.hypergraph.get(event.target)?.type === 'Implication');
    }

    execute(hyperedge, event, ruleName) {
        const {args: [premise, conclusion]} = hyperedge;
        const premiseId = getArgId(premise);
        if (this.nar.state.hypergraph.has(premiseId)) {
            let targetId;
            if (typeof conclusion === 'string' && /^[a-zA-Z0-9]+$/.test(conclusion)) {
                targetId = conclusion;
            } else {
                const parsedConclusion = (typeof conclusion === 'string') ? this.nar.expressionEvaluator.parse(conclusion) : conclusion;
                if (parsedConclusion && parsedConclusion.type && parsedConclusion.args) {
                    targetId = id(parsedConclusion.type, parsedConclusion.args);
                } else {
                    targetId = getArgId(conclusion);
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
}
