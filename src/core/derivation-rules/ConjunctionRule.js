import {DerivationRuleBase} from './DerivationRuleBase.js';
import {getArgId} from '../../support/utils.js';

export class ConjunctionRule extends DerivationRuleBase {
    constructor(nar, config) {
        super(nar, config, 'Conjunction', event => nar.state.hypergraph.get(event.target)?.type === 'Conjunction');
    }

    execute(hyperedge, event, ruleName) {
        const {args} = hyperedge;
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
}
