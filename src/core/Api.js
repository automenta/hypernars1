import {TruthValue} from '../support/TruthValue.js';
import {MacroApi} from './api-components/MacroApi.js';
import {TemporalApi} from './api-components/TemporalApi.js';
import {ContradictionApi} from './api-components/ContradictionApi.js';
import {GoalApi} from './api-components/GoalApi.js';
import {CognitiveApi} from './api-components/CognitiveApi.js';
import {StructuralApi} from './api-components/StructuralApi.js';
import {BeliefApi} from './api-components/BeliefApi.js';
import {CoreApi} from './api-components/CoreApi.js';

export class Api {
    constructor(nar) {
        this.nar = nar;
        this.TruthValue = TruthValue;

        this.macro = new MacroApi(nar, this);
        this.temporal = new TemporalApi(nar);
        this.contradiction = new ContradictionApi(nar);
        this.goal = new GoalApi(nar);
        this.cognitive = new CognitiveApi(nar);
        this.structural = new StructuralApi(nar, this);
        this.belief = new BeliefApi(nar);
        this.core = new CoreApi(nar);
    }

    nal(statement, options = {}) {
        return this.macro.nal(statement, options);
    }

    nalq(question, options = {}) {
        return this.macro.nalq(question, options);
    }

    seq(...terms) {
        return this.macro.seq(...terms);
    }

    contextualRule(premise, conclusion, contextId, options = {}) {
        return this.macro.contextualRule(premise, conclusion, contextId, options);
    }

    temporalSequence(...terms) {
        return this.macro.temporalSequence(...terms);
    }

    probabilisticRule(premise, conclusion, frequency, confidence, options = {}) {
        return this.macro.probabilisticRule(premise, conclusion, frequency, confidence, options);
    }

    citedBelief(statement, citation) {
        return this.macro.citedBelief(statement, citation);
    }

    robustRule(premise, conclusion, exception, options = {}) {
        return this.macro.robustRule(premise, conclusion, exception, options);
    }

    temporalInterval(term, start, end, options = {}) {
        return this.temporal.temporalInterval(term, start, end, options);
    }

    temporalConstraint(event1, event2, relation, options = {}) {
        return this.temporal.temporalConstraint(event1, event2, relation, options);
    }

    inferTemporalRelationship(event1, event2) {
        return this.temporal.inferTemporalRelationship(event1, event2);
    }

    projectTemporal(term, milliseconds) {
        return this.temporal.projectTemporal(term, milliseconds);
    }

    getContradictions() {
        return this.contradiction.getContradictions();
    }

    analyzeContradiction(hyperedgeId) {
        return this.contradiction.analyzeContradiction(hyperedgeId);
    }

    resolveContradiction(hyperedgeId, strategy, options) {
        return this.contradiction.resolveContradiction(hyperedgeId, strategy, options);
    }

    addGoal(description, utility, constraints = {}, options = {}) {
        return this.goal.addGoal(description, utility, constraints, options);
    }

    getGoals() {
        return this.goal.getGoals();
    }

    getTrace(depth) {
        return this.cognitive.getTrace(depth);
    }

    configureStrategy(config) {
        return this.cognitive.configureStrategy(config);
    }

    getActiveStrategy() {
        return this.cognitive.getActiveStrategy();
    }

    getMetrics() {
        return this.cognitive.getMetrics();
    }

    getFocus() {
        return this.cognitive.getFocus();
    }

    term(name, options = {}) {
        return this.structural.term(name, options);
    }

    inheritance(subject, predicate, options = {}) {
        return this.structural.inheritance(subject, predicate, options);
    }

    similarity(term1, term2, options = {}) {
        return this.structural.similarity(term1, term2, options);
    }

    implication(premise, conclusion, options = {}) {
        return this.structural.implication(premise, conclusion, options);
    }

    equivalence(premise, conclusion, options = {}) {
        return this.structural.equivalence(premise, conclusion, options);
    }

    getBelief(hyperedgeId) {
        return this.belief.getBelief(hyperedgeId);
    }

    getBeliefs(hyperedgeId) {
        return this.belief.getBeliefs(hyperedgeId);
    }

    queryBelief(pattern) {
        return this.belief.queryBelief(pattern);
    }

    addHyperedge(type, args, options = {}) {
        return this.core.addHyperedge(type, args, options);
    }

    outcome(context, outcome, options = {}) {
        return this.core.outcome(context, outcome, options);
    }

    revise(hyperedgeId, options = {}) {
        return this.core.revise(hyperedgeId, options);
    }

    removeHyperedge(hyperedgeId) {
        return this.core.removeHyperedge(hyperedgeId);
    }
}
