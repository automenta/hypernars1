import {DerivationRuleBase} from './DerivationRuleBase.js';
import {TruthValue} from '../../support/TruthValue.js';
import {getArgId, hash, id} from '../../support/utils.js';

export class SimilarityRule extends DerivationRuleBase {
    constructor(nar, config) {
        super(nar, config, 'Similarity', event => nar.state.hypergraph.get(event.target)?.type === 'Similarity');
    }

    execute(hyperedge, event, ruleName) {
        this._deriveSimilarity(hyperedge, event, ruleName);
    }

    _deriveSimilarity({args: [term1, term2]}, event, ruleName) {
        const term1Id = getArgId(term1);
        const {activation, budget, pathHash, pathLength, derivationPath = []} = event;

        this.nar.propagation.propagate({
            target: id('Similarity', [term2, term1]),
            activation,
            budget: budget.scale(this.config.similaritySymmetryBudgetFactor),
            pathHash: pathHash ^ hash(String(id('Similarity', [term2, term1]))),
            pathLength: pathLength + 1,
            derivationPath: [...derivationPath, 'symmetry']
        });

        (this.nar.state.index.byArg.get(term1Id) || new Set()).forEach(termId => {
            const premise = this.nar.state.hypergraph.get(termId);
            if (premise?.type === 'Inheritance' && getArgId(premise.args[0]) === term1Id) {
                const context = {
                    term1,
                    term2,
                    predicate: premise.args[1],
                    similarity: this.nar.state.hypergraph.get(id('Similarity', [term1, term2])),
                    premise,
                    ruleName
                };
                this._deriveAnalogy(context, event);
            }
        });
    }

    performInductiveSimilarityDerivation(context, event) {
        const {term1, term2, predicate, premise1, premise2} = context;
        const {budget, pathHash, pathLength} = event;

        const term1Id = getArgId(term1);
        const term2Id = getArgId(term2);
        const predicateId = getArgId(predicate);
        const key = this._memoKey('Similarity', [term1Id, term2Id], pathHash);
        if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
        this.nar.state.memoization.set(key, pathLength);

        const cacheKey = `${term1Id}↔${term2Id}|induction|${predicateId}`;
        if (this.nar.state.index.derivationCache.has(cacheKey)) return;
        this.nar.state.index.derivationCache.set(cacheKey, true);

        const truth = TruthValue.induction(premise1.getTruth(), premise2.getTruth());
        this.nar.api.similarity(term1, term2, {
            truth,
            budget: budget.scale(this.config.inductiveSimilarityBudgetFactor),
            premises: [premise1.id, premise2.id],
            derivedBy: 'induction'
        });
    }

    _deriveAnalogy(context, event) {
        const {term1, term2, predicate, similarity, premise, ruleName} = context;
        if (!similarity || !premise) return;

        const {budget, pathHash, pathLength} = event;

        const term2Id = getArgId(term2);
        const predicateId = getArgId(predicate);
        const key = this._memoKey('Inheritance', [term2Id, predicateId], pathHash);
        if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
        this.nar.state.memoization.set(key, pathLength);

        const truth = TruthValue.analogy(similarity.getTruth(), premise.getTruth());
        this.nar.api.inheritance(term2, predicate, {
            truth,
            budget: budget.scale(this.config.analogyBudgetFactor),
            premises: [similarity.id, premise.id],
            derivedBy: 'analogy'
        });
    }
}
