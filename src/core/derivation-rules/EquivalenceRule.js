import {DerivationRuleBase} from './DerivationRuleBase.js';

export class EquivalenceRule extends DerivationRuleBase {
    constructor(nar, config) {
        super(nar, config, 'Equivalence', event => nar.state.hypergraph.get(event.target)?.type === 'Equivalence');
    }

    execute(hyperedge, event, ruleName) {
        const {args: [term1, term2]} = hyperedge;
        this.nar.api.implication(term1, term2, {
            truth: hyperedge.getTruth(),
            budget: event.budget.scale(this.config.equivalenceBudgetFactor),
            derivedBy: ruleName
        });
        this.nar.api.implication(term2, term1, {
            truth: hyperedge.getTruth(),
            budget: event.budget.scale(this.config.equivalenceBudgetFactor),
            derivedBy: ruleName
        });
    }
}
