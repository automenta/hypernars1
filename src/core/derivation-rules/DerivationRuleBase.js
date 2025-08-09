import {id, hash} from '../../support/utils.js';

export class DerivationRuleBase {
    constructor(nar, config, name, condition) {
        this.nar = nar;
        this.config = config;
        this.name = name;
        this.condition = condition;
        this.priority = 0.5;
        this.applicability = 0.5;
        this.successRate = 0.5;
        this.lastUsed = 0;
        this.usageCount = 0;
    }

    execute(hyperedge, event, ruleName) {
        throw new Error('Execute method must be implemented by subclasses');
    }

    _addBeliefAndPropagate(options, event) {
        const {type, args, truth, budgetFactor, activationFactor, derivationSuffix, premises} = options;
        const {activation, budget, pathHash, pathLength, derivationPath = []} = event;

        const targetId = id(type, args);

        if (truth) {
            this.nar.api.addHyperedge(type, args, {
                truth,
                budget: budget.scale(budgetFactor),
                premises: premises,
                derivedBy: derivationSuffix
            });
        }

        this.nar.propagation.propagate({
            target: targetId,
            activation: activation * activationFactor,
            budget: budget.scale(budgetFactor),
            pathHash: pathHash ^ hash(String(targetId)),
            pathLength: pathLength + 1,
            derivationPath: [...derivationPath, derivationSuffix]
        });
    }

    _memoKey(type, args, pathHash) {
        return `${id(type, args)}|${pathHash}`;
    }
}
