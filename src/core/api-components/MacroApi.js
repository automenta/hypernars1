import {TruthValue} from '../../support/TruthValue.js';
import {id} from '../../support/utils.js';

export class MacroApi {
    constructor(nar, api) {
        this.nar = nar;
        this.api = api;
    }

    nal(statement, options = {}) {
        let context = null;
        let cleanStatement = statement;

        if (!options.timestamp && this.nar.temporalManager) {
            options.timestamp = Date.now();
        }
        if (!options.source && this.nar.metaReasoner) {
            options.source = this.nar.metaReasoner.getActiveStrategy();
        }

        const contextMatch = statement.match(/@context:([^ ]+)/);
        if (contextMatch) {
            context = contextMatch[1];
            cleanStatement = statement.replace(contextMatch[0], '').trim();
        }

        const result = this.nar.expressionEvaluator.parseAndAdd(cleanStatement, options);

        if (result && context) {
            this.api.addHyperedge('hasContext', [result, context], {truth: TruthValue.certain()});
        }

        return result;
    }

    nalq(question, options = {}) {
        if (!options.urgency) {
            options.urgency = this._assessQuestionUrgency(question);
        }
        if (!options.timeout && this.nar.config) {
            options.timeout = this.nar.config.questionTimeout * (1.5 - Math.min(1.0, options.urgency || 0.5));
        }
        return this.nar.expressionEvaluator.parseQuestion(question, options);
    }

    seq(...terms) {
        const options = (typeof terms[terms.length - 1] === 'object') ? terms.pop() : {};
        const timestamp = options.timestamp || Date.now();

        const context = options.context || this.nar.temporalManager?.getContext?.() || {};

        terms.slice(0, -1).forEach((term, i) => {
            const nextTerm = terms[i + 1];
            const stepTimestamp = timestamp + (i * (options.interval || 1000));

            this.nar.temporalManager.relate(term, nextTerm, 'before', {
                truth: options.truth || new TruthValue(0.9, 0.9),
                timestamp: stepTimestamp
            });

            if (context.period) {
                this._addTemporalContext(term, context.period, stepTimestamp);
            }
            if (context.location) {
                this._addLocationContext(term, context.location);
            }
        });

        return id('Sequence', terms);
    }

    contextualRule(premise, conclusion, contextId, options = {}) {
        const ruleId = this.api.implication(premise, conclusion, options);
        this.api.addHyperedge('hasContext', [ruleId, contextId], {truth: TruthValue.certain()});
        return ruleId;
    }

    temporalSequence(...terms) {
        const options = (typeof terms[terms.length - 1] === 'object') ? terms.pop() : {};
        const {interval = 2, unit = 'minutes', timestamp = Date.now()} = options;

        const stepInterval = unit === 'minutes' ? interval * 60000 :
            unit === 'hours' ? interval * 3600000 :
                interval * 1000;

        for (let i = 0; i < terms.length - 1; i++) {
            this.nar.temporalManager.addConstraint(terms[i], terms[i + 1], 'before', {
                truth: options.truth || new TruthValue(0.9, 0.9)
            });
        }

        return id('Sequence', terms);
    }

    probabilisticRule(premise, conclusion, frequency, confidence, options = {}) {
        return this.api.implication(premise, conclusion, {
            ...options,
            truth: new TruthValue(frequency, confidence)
        });
    }

    citedBelief(statement, citation) {
        const beliefId = this.nal(statement);
        if (citation.source) {
            this.api.addHyperedge('hasSource', [beliefId, `Source(${citation.source})`], {truth: TruthValue.certain()});
        }
        return beliefId;
    }

    robustRule(premise, conclusion, exception, options = {}) {
        const baseRule = this.api.implication(premise, conclusion, {
            ...options,
            truth: options.truth || new TruthValue(0.9, 0.8)
        });

        const exceptionPremise = id('Conjunction', [exception, premise]);
        const negatedConclusion = id('Negation', [conclusion]);

        const exceptionRule = this.api.implication(exceptionPremise, negatedConclusion, {
            ...options,
            truth: new TruthValue(0.95, 0.85)
        });

        return {baseRule, exceptionRule};
    }

    _assessQuestionUrgency(question) {
        if (question.includes('?')) {
            return 0.7;
        }
        return 0.4;
    }

    _addTemporalContext(term, period, timestamp) {
        this.api.addHyperedge('inPeriod', [term, period], {
            truth: TruthValue.certain(),
            timestamp
        });
    }

    _addLocationContext(term, location) {
        this.api.addHyperedge('atLocation', [term, location], {
            truth: TruthValue.certain()
        });
    }
}
