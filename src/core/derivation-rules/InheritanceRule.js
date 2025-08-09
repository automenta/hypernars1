import {DerivationRuleBase} from './DerivationRuleBase.js';
import {TruthValue} from '../../support/TruthValue.js';
import {getArgId, id} from '../../support/utils.js';

export class InheritanceRule extends DerivationRuleBase {
    constructor(nar, config) {
        super(nar, config, 'Inheritance', event => nar.state.hypergraph.get(event.target)?.type === 'Inheritance');
    }

    execute(hyperedge, event, ruleName) {
        this._deriveInheritance(hyperedge, event, ruleName);
    }

    _deriveInheritance({args: [subject, predicate]}, event, ruleName) {
        const subjectId = getArgId(subject);
        const predicateId = getArgId(predicate);
        const currentHyperedge = this.nar.state.hypergraph.get(id('Inheritance', [subject, predicate]));

        (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(termId => {
            const forwardChainEdge = this.nar.state.hypergraph.get(termId);
            if (forwardChainEdge?.type === 'Inheritance' && getArgId(forwardChainEdge.args[0]) === predicateId) {
                const newPredicate = forwardChainEdge.args[1];
                const context = {
                    subject: subject,
                    predicate: newPredicate,
                    premise1: currentHyperedge,
                    premise2: forwardChainEdge,
                    ruleName
                };
                this._deriveTransitiveInheritance(context, event);
            }
        });
    }

    _deriveTransitiveInheritance(context, event) {
        const {subject, predicate, premise1, premise2, ruleName} = context;
        if (!premise1 || !premise2) return;

        const {pathHash, pathLength} = event;

        const subjectId = getArgId(subject);
        const predicateId = getArgId(predicate);
        const key = this._memoKey('Inheritance', [subjectId, predicateId], pathHash);
        if (this.nar.state.memoization.has(key) && this.nar.state.memoization.get(key) <= pathLength) return;
        this.nar.state.memoization.set(key, pathLength);

        const cacheKey = `${subjectId}→${predicateId}|${premise1.id}|${premise2.id}`;
        if (this.nar.state.index.derivationCache.has(cacheKey)) return;
        this.nar.state.index.derivationCache.set(cacheKey, true);

        this._addBeliefAndPropagate({
            type: 'Inheritance',
            args: [subject, predicate],
            truth: TruthValue.transitive(premise1.getTruth(), premise2.getTruth()),
            budgetFactor: this.config.transitiveInheritanceBudgetFactor,
            activationFactor: this.config.transitiveInheritanceActivationFactor,
            derivationSuffix: 'transitivity',
            premises: [premise1.id, premise2.id]
        }, event);

        const currentHyperedge = this.nar.state.hypergraph.get(id('Inheritance', [subject, predicate]));
        if (!currentHyperedge) return;

        (this.nar.state.index.byArg.get(subjectId) || new Set()).forEach(termId => {
            const backwardChainEdge = this.nar.state.hypergraph.get(termId);
            if (backwardChainEdge?.type === 'Inheritance' && getArgId(backwardChainEdge.args[1]) === subjectId) {
                const newSubject = backwardChainEdge.args[0];
                const context = {
                    subject: newSubject,
                    predicate: predicate,
                    premise1: backwardChainEdge,
                    premise2: currentHyperedge,
                    ruleName
                };
                this._deriveTransitiveInheritance(context, event);
            }
        });

        this._addBeliefAndPropagate({
            type: 'Similarity',
            args: [subject, predicate],
            budgetFactor: this.config.similarityFromInheritanceBudgetFactor,
            activationFactor: this.config.similarityFromInheritanceActivationFactor,
            derivationSuffix: ruleName,
            truth: new TruthValue(1.0, 0.9)
        }, event);

        this._derivePropertyInheritance(subject, predicateId, event, ruleName);
        this._findAndDeriveInductionFromInheritance(subject, predicateId, ruleName, event);
    }

    _derivePropertyInheritance(subject, predicateId, event, ruleName) {
        if (this.nar.state.hypergraph.has(id('Instance', [subject, 'entity']))) {
            (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(propId => {
                const property = this.nar.state.hypergraph.get(propId);
                if (property?.type === 'Property') {
                    this._addBeliefAndPropagate({
                        type: 'Property',
                        args: [subject, property.args[1]],
                        budgetFactor: this.config.propertyInheritanceBudgetFactor,
                        activationFactor: this.config.propertyInheritanceActivationFactor,
                        derivationSuffix: 'property_derivation'
                    }, event);
                }
            });
        }
    }

    _findAndDeriveInductionFromInheritance(subject, predicateId, ruleName, event) {
        (this.nar.state.index.byArg.get(predicateId) || new Set()).forEach(termId => {
            const other = this.nar.state.hypergraph.get(termId);
            if (other?.type === 'Inheritance' && getArgId(other.args[1]) === predicateId && getArgId(other.args[0]) !== getArgId(subject)) {
                const context = {
                    term1: subject,
                    term2: other.args[0],
                    predicate: predicateId,
                    premise1: this.nar.state.hypergraph.get(id('Inheritance', [subject, predicateId])),
                    premise2: other,
                    ruleName
                };
                const similarityRule = this.nar.derivationEngine.rules.get('Similarity');
                if (similarityRule) {
                    similarityRule.performInductiveSimilarityDerivation(context, event);
                }
            }
        });
    }
}
