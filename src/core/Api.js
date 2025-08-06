import {TruthValue} from '../support/TruthValue.js';
import {Budget} from '../support/Budget.js';
import {Hyperedge} from '../support/Hyperedge.js';
import {id} from '../support/utils.js';

export class Api {
    constructor(nar) {
        this.nar = nar;
        this.TruthValue = TruthValue;
        this.contradictionManager = nar.contradictionManager;
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
            this.addHyperedge('hasContext', [result, context], {truth: TruthValue.certain()});
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
        const ruleId = this.implication(premise, conclusion, options);
        this.addHyperedge('hasContext', [ruleId, contextId], {truth: TruthValue.certain()});
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
        return this.implication(premise, conclusion, {
            ...options,
            truth: new TruthValue(frequency, confidence)
        });
    }

    citedBelief(statement, citation) {
        const beliefId = this.nal(statement);
        if (citation.source) {
            this.addHyperedge('hasSource', [beliefId, `Source(${citation.source})`], {truth: TruthValue.certain()});
        }
        return beliefId;
    }

    robustRule(premise, conclusion, exception, options = {}) {
        const baseRule = this.implication(premise, conclusion, {
            ...options,
            truth: options.truth || new TruthValue(0.9, 0.8)
        });

        const exceptionPremise = id('Conjunction', [exception, premise]);
        const negatedConclusion = id('Negation', [conclusion]);

        const exceptionRule = this.implication(exceptionPremise, negatedConclusion, {
            ...options,
            truth: new TruthValue(0.95, 0.85)
        });

        return {baseRule, exceptionRule};
    }

    temporalInterval(term, start, end, options = {}) {
        return this.nar.temporalManager.interval(term, start, end, options);
    }

    temporalConstraint(event1, event2, relation, options = {}) {
        return this.nar.temporalManager.addConstraint(event1, event2, relation, options);
    }

    inferTemporalRelationship(event1, event2) {
        return this.nar.temporalManager.inferRelationship(event1, event2);
    }

    projectTemporal(term, milliseconds) {
        return this.nar.temporalManager.project(term, milliseconds);
    }

    getContradictions() {
        if (!this.nar.contradictionManager.contradictions) {
            return [];
        }
        this.nar._log('debug', 'Contradictions map state (before filter):', {map: Array.from(this.nar.contradictionManager.contradictions.keys())});
        return Array.from(this.nar.contradictionManager.contradictions.entries())
            .filter(([, data]) => !data.resolved)
            .map(([id, data]) => ({id, ...data}));
    }

    addGoal(description, utility, constraints = {}, options = {}) {
        return this.nar.goalManager.addGoal(description, utility, constraints, options);
    }

    getGoals() {
        return this.nar.goalManager.getActiveGoals();
    }

    analyzeContradiction(hyperedgeId) {
        return this.nar.contradictionManager.analyze(hyperedgeId);
    }

    resolveContradiction(hyperedgeId, strategy, options) {
        return this.nar.contradictionManager.manualResolve(hyperedgeId, strategy, options);
    }

    getTrace(depth) {
        return this.nar.cognitiveExecutive.getTrace(depth);
    }

    configureStrategy(config) {
        return this.nar.cognitiveExecutive.configureStrategy(config);
    }

    getActiveStrategy() {
        return this.nar.cognitiveExecutive.getActiveStrategy();
    }

    getMetrics() {
        const history = this.nar.cognitiveExecutive.metricsHistory;
        return history[history.length - 1] || null;
    }

    getFocus() {
        return this.nar.cognitiveExecutive.currentFocus;
    }

    term(name, options = {}) {
        return this.addHyperedge('Term', [name], options);
    }

    inheritance(subject, predicate, options = {}) {
        return this.addHyperedge('Inheritance', [subject, predicate], options);
    }

    similarity(term1, term2, options = {}) {
        return this.addHyperedge('Similarity', [term1, term2], options);
    }

    implication(premise, conclusion, options = {}) {
        return this.addHyperedge('Implication', [premise, conclusion], options);
    }

    equivalence(premise, conclusion, options = {}) {
        return this.addHyperedge('Equivalence', [premise, conclusion], options);
    }

    getBeliefs(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        return hyperedge ? hyperedge.beliefs : [];
    }

    queryBelief(pattern) {
        const parsedPattern = this.nar.expressionEvaluator.parse(pattern);
        const hyperedgeId = this.nar.expressionEvaluator._getParsedStructureId(parsedPattern);
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        return hyperedge ? hyperedge.getStrongestBelief() : null;
    }

    addHyperedge(type, args, options = {}) {
        const {truth, budget, priority, premises = [], derivedBy} = options;
        const termId = id(type, args);
        let hyperedge = this.nar.state.hypergraph.get(termId);

        if (!hyperedge) {
            hyperedge = new Hyperedge(this.nar, termId, type, args);
            this.nar.state.hypergraph.set(termId, hyperedge);
            if (this.nar.state.index.structural) {
                this.nar.state.index.structural.addToIndex(hyperedge);
            } else {
                this.nar.state.index.addToIndex(hyperedge);
            }
        }

        const finalTruth = truth || new TruthValue(1.0, 0.9);
        let finalBudget = budget;

        if (finalBudget && !(finalBudget instanceof Budget)) {
            finalBudget = new Budget(finalBudget.priority, finalBudget.durability, finalBudget.quality);
        } else if (!finalBudget) {
            finalBudget = this.nar.memoryManager.allocateResources({type: 'revision'}, {importance: priority});
        }

        const revisionResult = hyperedge.revise({
            truth: finalTruth,
            budget: finalBudget,
            beliefCapacity: this.nar.config.beliefCapacity,
            premises,
            context: options.context,
            derivedBy
        });

        if (revisionResult.needsUpdate) {
            this.nar.contradictionManager.detectContradiction(termId);
            this.nar._log('debug', `Checking for inter-edge contradictions. Manager has method: ${!!this.nar.contradictionManager.detectAndResolveInterEdgeContradictions}`);
            if (this.nar.contradictionManager.detectAndResolveInterEdgeContradictions) {
                this.nar.contradictionManager.detectAndResolveInterEdgeContradictions(hyperedge);
            }
            this.nar.emit('revision', {hyperedgeId: termId, newTruth: finalTruth, newBudget: finalBudget});
            this.nar.propagation.propagate({
                target: termId,
                activation: 1.0,
                budget: finalBudget,
                pathHash: 0,
                pathLength: 0,
                derivationPath: []
            });
            this.nar.questionHandler.checkQuestionAnswers(termId, hyperedge.getStrongestBelief());
        }

        return termId;
    }

    _assessQuestionUrgency(question) {
        if (question.includes('?')) {
            return 0.7;
        }
        return 0.4;
    }

    _addTemporalContext(term, period, timestamp) {
        this.addHyperedge('inPeriod', [term, period], {
            truth: TruthValue.certain(),
            timestamp
        });
    }

    _addLocationContext(term, location) {
        this.addHyperedge('atLocation', [term, location], {
            truth: TruthValue.certain()
        });
    }

    outcome(context, outcome, options = {}) {
        this.nar.learningEngine.recordExperience(context, outcome, options);
    }

    revise(hyperedgeId, options = {}) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (!hyperedge) {
            this.nar._log('warn', `revise called on non-existent hyperedge: ${hyperedgeId}`);
            return;
        }

        const {truth, budget} = options;
        const strongestBelief = hyperedge.getStrongestBelief();

        const finalTruth = truth || strongestBelief?.truth;
        let finalBudget = budget || strongestBelief?.budget;

        if (!finalTruth || !finalBudget) {
            return;
        }

        if (finalBudget && !(finalBudget instanceof Budget)) {
            finalBudget = new Budget(finalBudget.priority, finalBudget.durability, finalBudget.quality);
        }

        const revisionResult = hyperedge.revise({
            truth: finalTruth,
            budget: finalBudget,
            beliefCapacity: this.nar.config.beliefCapacity,
            premises: strongestBelief?.premises,
            derivedBy: 'revision'
        });

        if (revisionResult.needsUpdate) {
            this.nar.contradictionManager.detectContradiction(hyperedgeId);
            this.nar.emit('revision', {hyperedgeId, newTruth: finalTruth, newBudget: finalBudget});
            this.nar.propagation.propagate({
                target: hyperedgeId,
                activation: 1.0,
                budget: finalBudget,
                pathHash: 0,
                pathLength: 0,
                derivationPath: []
            });
        }
    }

    removeHyperedge(hyperedgeId) {
        const hyperedge = this.nar.state.hypergraph.get(hyperedgeId);
        if (hyperedge) {
            this.nar.state.hypergraph.delete(hyperedgeId);
            if (this.nar.state.index.structural) {
                this.nar.state.index.structural.removeFromIndex(hyperedge);
            } else {
                this.nar.state.index.removeFromIndex(hyperedge);
            }
            this.nar.state.activations.delete(hyperedgeId);
            this.nar.emit('knowledge-pruned', {hyperedgeId, type: hyperedge.type});
            return true;
        }
        return false;
    }
}
