import {DerivationRuleBase} from './DerivationRuleBase.js';
import {TruthValue} from '../../support/TruthValue.js';

export class ConsequentConjunctionRule extends DerivationRuleBase {
    constructor(nar, config) {
        super(nar, config, 'ConsequentConjunction', (event) => {
            const hyperedge = nar.state.hypergraph.get(event.target);
            return event.type === 'add-belief' && hyperedge && hyperedge.type === 'Implication';
        });
        this.priority = 0.8;
    }

    execute(hyperedge, event, ruleName) {
        const antecedent = hyperedge.args[0];
        const consequentId = hyperedge.args[1];
        const consequent = this.nar.state.hypergraph.get(consequentId);

        if (consequent && consequent.type === 'Conjunction') {
            const sourceBelief = hyperedge.getStrongestBelief();
            if (!sourceBelief) return;

            consequent.args.forEach(conjunctId => {
                // For each part of the conjunction, create a new implication.
                // A --> (B && C)  |=  A --> B
                const newTruth = TruthValue.deductive(sourceBelief.truth, TruthValue.certain());

                const options = {
                    truth: newTruth,
                    budget: this.nar.memoryManager.allocateResources(
                        {type: 'derived-implication'},
                        {parentBudget: sourceBelief.budget}
                    ),
                    premises: [hyperedge.id, consequent.id],
                    derivedBy: this.name,
                };

                if (hyperedge.temporal) {
                    options.temporal = hyperedge.temporal;
                }

                this.nar.api.implication(antecedent, conjunctId, options);
            });
        }
    }
}
