import {EventEmitter} from 'events';
import {State} from './core/State.js';
import {Api} from './core/Api.js';
import {System} from './core/System.js';
import {Propagation} from './core/Propagation.js';
import {QuestionHandler} from './core/QuestionHandler.js';
import {ExpressionEvaluator} from './evaluator/ExpressionEvaluator.js';
import {AdvancedExpressionEvaluator} from './evaluator/AdvancedExpressionEvaluator.js';

import {DerivationEngineBase} from './core/DerivationEngineBase.js';
import {SimpleDerivationEngine} from './core/SimpleDerivationEngine.js';
import {AdvancedDerivationEngine} from './core/AdvancedDerivationEngine.js';

import {MemoryManagerBase} from './managers/MemoryManagerBase.js';
import {SimpleMemoryManager} from './managers/SimpleMemoryManager.js';
import {AdvancedMemoryManager} from './managers/AdvancedMemoryManager.js';

import {ContradictionManagerBase} from './managers/ContradictionManagerBase.js';
import {SimpleContradictionManager} from './managers/SimpleContradictionManager.js';
import {AdvancedContradictionManager} from './managers/AdvancedContradictionManager.js';

import {LearningEngineBase} from './managers/LearningEngineBase.js';
import {SimpleLearningEngine} from './managers/SimpleLearningEngine.js';
import {AdvancedLearningEngine} from './managers/AdvancedLearningEngine.js';

import {TemporalManagerBase} from './managers/TemporalManagerBase.js';
import {SimpleTemporalManager} from './managers/SimpleTemporalManager.js';
import {TemporalReasoner} from './managers/TemporalReasoner.js';

import {CognitiveExecutive} from './managers/CognitiveExecutive.js';
import {ExplanationSystem} from './managers/ExplanationSystem.js';
import {GoalManagerBase} from './managers/GoalManagerBase.js';
import {GoalManager} from './managers/GoalManager.js';
import {ConceptFormation} from './managers/ConceptFormation.js';
import { LOG_LEVELS } from '../support/constants.js';


export class NAR extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            logger: console,
            decay: 0.1,
            budgetDecay: 0.8,
            inferenceThreshold: 0.3,
            maxPathLength: 15,
            beliefCapacity: 8,
            temporalHorizon: 3,
            budgetThreshold: 0.05,
            maxDerivationDepth: 5,
            expressionTimeout: 500,
            derivationCacheSize: 1000,
            questionTimeout: 3000,
            memoryMaintenanceInterval: 100,
            logLevel: LOG_LEVELS.INFO,
            cleanupProbability: 0.1,
            maxPathCacheSize: 1000,
            pathCacheTruncationSize: 500,
            maxQuestionCacheSize: 10,
            questionCacheTruncationSize: 5,
            cleanupInterval: 100,
            questionResolutionInterval: 10,
            ...config
        };
        this.config.ruleConfig = this.config.ruleConfig || {};

        this.state = new State({...this.config, useStructuralIndex: config.useAdvanced});
        this.propagation = new Propagation(this);
        this.questionHandler = new QuestionHandler(this);
        this.system = new System(this);

        this._initializeModules(config);
    }

    _initializeModules(config) {
        const useAdvanced = config.useAdvanced || false;
        const customModules = config.modules || {};

        const moduleDefinitions = [
            {name: 'ExpressionEvaluator', simple: ExpressionEvaluator, advanced: AdvancedExpressionEvaluator},
            {
                name: 'DerivationEngine',
                simple: SimpleDerivationEngine,
                advanced: AdvancedDerivationEngine,
                base: DerivationEngineBase
            },
            {
                name: 'MemoryManager',
                simple: SimpleMemoryManager,
                advanced: AdvancedMemoryManager,
                base: MemoryManagerBase
            },
            {
                name: 'ContradictionManager',
                simple: SimpleContradictionManager,
                advanced: AdvancedContradictionManager,
                base: ContradictionManagerBase
            },
            {
                name: 'LearningEngine',
                simple: SimpleLearningEngine,
                advanced: AdvancedLearningEngine,
                base: LearningEngineBase
            },
            {
                name: 'TemporalManager',
                simple: SimpleTemporalManager,
                advanced: TemporalReasoner,
                base: TemporalManagerBase
            },
            {name: 'CognitiveExecutive', simple: CognitiveExecutive, advanced: CognitiveExecutive},
            {name: 'ExplanationSystem', simple: ExplanationSystem, advanced: ExplanationSystem},
            {name: 'GoalManager', simple: GoalManager, advanced: GoalManager, base: GoalManagerBase},
            {name: 'ConceptFormation', simple: ConceptFormation, advanced: ConceptFormation},
        ];

        for (const moduleDef of moduleDefinitions) {
            const instanceName = moduleDef.name.charAt(0).toLowerCase() + moduleDef.name.slice(1);
            const ModuleClass = customModules[moduleDef.name] || (useAdvanced ? moduleDef.advanced : moduleDef.simple);

            if (ModuleClass) {
                this[instanceName] = new ModuleClass(this);

                if (moduleDef.base && !(this[instanceName] instanceof moduleDef.base)) {
                    throw new Error(`Module ${instanceName} does not extend its base class correctly.`);
                }
            }
        }

        this.api = new Api(this);
    }

    // System Control
    run(cycles) { return this.system.run(cycles); }
    step() { return this.system.step(); }

    // Core API
    nal(statement, options) { return this.api.nal(statement, options); }
    ask(question, options) { return this.questionHandler.ask(question, options); }
    query(pattern, options) { return this.expressionEvaluator.query(pattern, options); }
    addGoal(description, utility, constraints, options) { return this.goalManager.addGoal(description, utility, constraints, options); }
    getGoals() { return this.api.getGoals(); }
    outcome(context, outcome, options) { return this.api.outcome(context, outcome, options); }

    // Advanced API & Structural Operations
    nalq(question, options) { return this.api.nalq(question, options); }
    seq(...terms) { return this.api.seq(...terms); }
    contextualRule(premise, conclusion, contextId, options) { return this.api.contextualRule(premise, conclusion, contextId, options); }
    temporalSequence(...terms) { return this.api.temporalSequence(...terms); }
    probabilisticRule(premise, conclusion, frequency, confidence, options) { return this.api.probabilisticRule(premise, conclusion, frequency, confidence, options); }
    citedBelief(statement, citation) { return this.api.citedBelief(statement, citation); }
    robustRule(premise, conclusion, exception, options) { return this.api.robustRule(premise, conclusion, exception, options); }
    term(name, options) { return this.api.term(name, options); }
    inheritance(subject, predicate, options) { return this.api.inheritance(subject, predicate, options); }
    similarity(term1, term2, options) { return this.api.similarity(term1, term2, options); }
    implication(premise, conclusion, options) { return this.api.implication(premise, conclusion, options); }
    equivalence(premise, conclusion, options) { return this.api.equivalence(premise, conclusion, options); }
    addHyperedge(type, args, options) { return this.api.addHyperedge(type, args, options); }
    removeHyperedge(hyperedgeId) { return this.api.removeHyperedge(hyperedgeId); }
    revise(hyperedgeId, options) { return this.api.revise(hyperedgeId, options); }

    // Temporal Operations
    temporalInterval(term, start, end, options) { return this.api.temporalInterval(term, start, end, options); }
    temporalConstraint(event1, event2, relation, options) { return this.api.temporalConstraint(event1, event2, relation, options); }
    inferTemporalRelationship(event1, event2) { return this.api.inferTemporalRelationship(event1, event2); }
    projectTemporal(term, milliseconds) { return this.api.projectTemporal(term, milliseconds); }

    // Introspection & Explanation
    getBeliefs(hyperedgeId) { return this.api.getBeliefs(hyperedgeId); }
    queryBelief(pattern) { return this.api.queryBelief(pattern); }
    getContradictions() { return this.api.getContradictions(); }
    analyzeContradiction(hyperedgeId) { return this.api.analyzeContradiction(hyperedgeId); }
    resolveContradiction(hyperedgeId, strategy, options) { return this.api.resolveContradiction(hyperedgeId, strategy, options); }
    explain(hyperedgeId) { return this.explanationSystem.explain(hyperedgeId); }

    // Meta-Reasoning & Cognitive Control
    getTrace(depth) { return this.api.getTrace(depth); }
    configureStrategy(config) { return this.api.configureStrategy(config); }
    getActiveStrategy() { return this.api.getActiveStrategy(); }
    getMetrics() { return this.api.getMetrics(); }
    getFocus() { return this.api.getFocus(); }

    createSandbox(options = {}) {
        const sandbox = new NAR({
            ...this.config,
            ...(options.config || {}),
        });

        const minConfidence = options.minConfidence || 0.5;
        const hypergraphToCopy = options.hypergraph || this.state.hypergraph;

        hypergraphToCopy.forEach((hyperedge) => {
            if (hyperedge.getTruthExpectation() >= minConfidence) {
                sandbox.api.addHyperedge(hyperedge.type, hyperedge.args, {
                    truth: hyperedge.getTruth(),
                    budget: hyperedge.getStrongestBelief()?.budget
                });
            }
        });

        sandbox.isSandbox = true;
        sandbox.parent = this;

        return sandbox;
    }

    clearState() {
        this.state = new State({
            ...this.config,
            useStructuralIndex: this.config.useAdvanced,
            useOptimizedIndex: this.config.useAdvanced
        });
        this._initializeModules(this.config);
        this.api = new Api(this);

        if (this.contradictionManager && this.contradictionManager.contradictions) {
            this.contradictionManager.contradictions.clear();
        }
    }

    saveState() {
        const hypergraphData = Array.from(this.state.hypergraph.values()).map(h => h.toJSON());
        const stateData = {
            version: '1.0',
            timestamp: Date.now(),
            config: this.config,
            currentStep: this.state.currentStep,
            hypergraph: hypergraphData,
        };
        return JSON.stringify(stateData, null, 2);
    }

    loadState(jsonString) {
        const stateData = JSON.parse(jsonString);

        if (!stateData.version || !stateData.hypergraph) {
            throw new Error('Invalid or unsupported state file.');
        }

        this.clearState();
        this.config = {...this.config, ...stateData.config};
        this.state.currentStep = stateData.currentStep || 0;

        for (const edgeData of stateData.hypergraph) {
            if (!edgeData.beliefs || edgeData.beliefs.length === 0) continue;

            for (const beliefData of edgeData.beliefs) {
                const options = {
                    truth: new this.api.TruthValue(beliefData.truth.frequency, beliefData.truth.confidence, beliefData.truth.priority),
                    budget: new this.api.Budget(beliefData.budget.priority, beliefData.budget.durability, beliefData.budget.quality),
                    premises: beliefData.premises,
                    derivedBy: beliefData.derivedBy,
                    timestamp: beliefData.timestamp,
                };
                this.api.addHyperedge(edgeData.type, edgeData.args, options);
            }
        }
    }

    _log(level, message, details = {}) {
        const levels = {[LOG_LEVELS.DEBUG]: 0, [LOG_LEVELS.INFO]: 1, [LOG_LEVELS.WARN]: 2, [LOG_LEVELS.ERROR]: 3};
        const currentLevel = levels[this.config.logLevel] ?? levels[LOG_LEVELS.INFO];
        const messageLevel = levels[level] ?? levels[LOG_LEVELS.INFO];

        if (messageLevel < currentLevel) {
            return;
        }

        let logOutput = `${message}`;
        if (Object.keys(details).length > 0) {
            logOutput += ` ${JSON.stringify(details)}`;
        }
        const logMethod = this.config.logger[level] || this.config.logger.log;
        if (logMethod) {
            logMethod(logOutput);
        }
    }
}