import {DerivationRuleBase} from './DerivationRuleBase.js';
import {TruthValue} from '../../support/TruthValue.js';
import {getArgId} from '../../support/utils.js';
import {composeTemporalRelations} from '../../support/temporalUtils.js';

export class TemporalRelationRule extends DerivationRuleBase {
    constructor(nar, config) {
        super(nar, config, 'TemporalRelation', event => nar.state.hypergraph.get(event.target)?.type === 'TemporalRelation');
    }

    execute(hyperedge, event, ruleName) {
        const {args: [premise, conclusion, relation]} = hyperedge;
        const premiseId = getArgId(premise);
        const eventHyperedge = this.nar.state.hypergraph.get(event.target);
        if (!eventHyperedge) return;

        (this.nar.state.index.byArg.get(premiseId) || new Set()).forEach(termId => {
            const middle = this.nar.state.hypergraph.get(termId);

            if (middle?.type === 'TemporalRelation' && getArgId(middle.args[1]) === premiseId) {
                const firstTerm = middle.args[0];
                const firstRelation = middle.args[2];

                const composedRelations = composeTemporalRelations(firstRelation, relation);
                if (composedRelations) {
                    composedRelations.forEach(newRelation => {
                        this.nar.api.addHyperedge('TemporalRelation', [firstTerm, conclusion, newRelation], {
                            truth: TruthValue.transitive(middle.getTruth(), eventHyperedge.getTruth()),
                            budget: event.budget.scale(this.config.transitiveTemporalBudgetFactor),
                            premises: [middle.id, eventHyperedge.id],
                            derivedBy: 'TransitiveTemporal'
                        });
                    });
                }
            }
        });
    }
}
