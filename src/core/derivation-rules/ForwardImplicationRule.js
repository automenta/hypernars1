import { DerivationRuleBase } from './DerivationRuleBase.js';
import { getArgId, id } from '../../support/utils.js';

export class ForwardImplicationRule extends DerivationRuleBase {
    constructor(nar, config) {
        super(nar, config, 'ForwardImplication', event => {
            const hyperedge = nar.state.hypergraph.get(event.target);
            return hyperedge && hyperedge.type !== 'Implication';
        });
    }

    execute(hyperedge, event, ruleName) {
        const premiseId = hyperedge.id;

        for (const implication of this.nar.state.hypergraph.values()) {
            if (implication.type !== 'Implication') continue;

            const { args: [impPremise] } = implication;
            const impPremiseId = getArgId(impPremise);

            if (impPremiseId !== premiseId) continue;

            const implicationBelief = implication.getStrongestBelief();
            const premiseBelief = hyperedge.getStrongestBelief();

            if (!premiseBelief || !implicationBelief) continue;

            const newTruth = this.nar.api.TruthValue.deduced(premiseBelief.truth, implicationBelief.truth);

            const { args: [, conclusion] } = implication;
            const parsedConclusion = (typeof conclusion === 'string')
                ? this.nar.expressionEvaluator.parse(conclusion)
                : conclusion;

            if (parsedConclusion && parsedConclusion.type && parsedConclusion.args) {
                const conclusionArgs = parsedConclusion.args.map(arg => typeof arg === 'object' ? id(arg.type, arg.args) : arg);
                this.nar.api.addHyperedge(parsedConclusion.type, conclusionArgs, { truth: newTruth });

                const targetId = id(parsedConclusion.type, conclusionArgs);
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
}
