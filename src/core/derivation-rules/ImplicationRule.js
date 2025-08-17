import {DerivationRuleBase} from './DerivationRuleBase.js';
import {getArgId, id} from '../../support/utils.js';

export class ImplicationRule extends DerivationRuleBase {
    constructor(nar, config) {
        super(nar, config, 'Implication', event => nar.state.hypergraph.get(event.target)?.type === 'Implication');
    }

    execute(hyperedge, event, ruleName) {
        const {args: [premise, conclusion]} = hyperedge;
        const premiseId = getArgId(premise);
        const premiseHyperedge = this.nar.state.hypergraph.get(premiseId);

        if (premiseHyperedge) {
            const premiseBelief = premiseHyperedge.getStrongestBelief();
            const implicationBelief = hyperedge.getStrongestBelief();

            if (!premiseBelief || !implicationBelief) return;

            const newTruth = this.nar.api.TruthValue.deduced(premiseBelief.truth, implicationBelief.truth);

            const parsedConclusion = (typeof conclusion === 'string')
                ? this.nar.expressionEvaluator.parse(conclusion)
                : conclusion;

            if (parsedConclusion && parsedConclusion.type && parsedConclusion.args) {
                const conclusionArgs = parsedConclusion.args.map(arg => typeof arg === 'object' ? id(arg.type, arg.args) : arg);
                this.nar.api.addHyperedge(parsedConclusion.type, conclusionArgs, {truth: newTruth});

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
