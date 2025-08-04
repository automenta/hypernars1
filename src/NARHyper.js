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


export class NARHyper extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = Object.assign({
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
            logLevel: 'debug',
            cleanupProbability: 0.1,
            maxPathCacheSize: 1000,
            pathCacheTruncationSize: 500,
            maxQuestionCacheSize: 10,
            questionCacheTruncationSize: 5,
            cleanupInterval: 100,
            questionResolutionInterval: 10,
        }, config);
        this.config.ruleConfig = this.config.ruleConfig || {};

        this.state = new State({...this.config, useStructuralIndex: config.useAdvanced});
        this.propagation = new Propagation(this);
        this.questionHandler = new QuestionHandler(this);
        this.system = new System(this);

        this._initializeModules(config);

        this._exposeApi();
    }

    _initializeModules(config) {
        const useAdvanced = config.useAdvanced || false;
        const customModules = config.modules || {};

        const moduleDefinitions = [
            { name: 'ExpressionEvaluator', simple: ExpressionEvaluator, advanced: AdvancedExpressionEvaluator },
            { name: 'DerivationEngine', simple: SimpleDerivationEngine, advanced: AdvancedDerivationEngine, base: DerivationEngineBase },
            { name: 'MemoryManager', simple: SimpleMemoryManager, advanced: AdvancedMemoryManager, base: MemoryManagerBase },
            { name: 'ContradictionManager', simple: SimpleContradictionManager, advanced: AdvancedContradictionManager, base: ContradictionManagerBase },
            { name: 'LearningEngine', simple: SimpleLearningEngine, advanced: AdvancedLearningEngine, base: LearningEngineBase },
            { name: 'TemporalManager', simple: SimpleTemporalManager, advanced: TemporalReasoner, base: TemporalManagerBase },
            { name: 'CognitiveExecutive', simple: CognitiveExecutive, advanced: CognitiveExecutive },
            { name: 'ExplanationSystem', simple: ExplanationSystem, advanced: ExplanationSystem },
            { name: 'GoalManager', simple: GoalManager, advanced: GoalManager, base: GoalManagerBase },
            { name: 'ConceptFormation', simple: ConceptFormation, advanced: ConceptFormation },
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

    _exposeApi() {
        // Bind methods from the Api class
        for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(this.api))) {
            const method = this.api[methodName];
            if (typeof method === 'function' && methodName !== 'constructor' && !methodName.startsWith('_')) {
                this[methodName] = method.bind(this.api);
            }
        }

        // Bind methods from other core components
        this.run = this.system.run.bind(this.system);
        this.step = this.system.step.bind(this.system);
        this.ask = this.questionHandler.ask.bind(this.questionHandler);
        this.explain = this.explanationSystem.explain.bind(this.explanationSystem);
        this.query = this.expressionEvaluator.query.bind(this.expressionEvaluator);
        this.addGoal = this.goalManager.addGoal.bind(this.goalManager);
    }

    createSandbox(options = {}) {
        const sandbox = new NARHyper({
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
        this._exposeApi();

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
        this.config = Object.assign(this.config, stateData.config);
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
        const levels = {'debug': 0, 'info': 1, 'warn': 2, 'error': 3};
        const currentLevel = levels[this.config.logLevel.toLowerCase()] || 1;
        const messageLevel = levels[level.toLowerCase()] || 1;

        if (messageLevel >= currentLevel) {
            const logMethod = this.config.logger[level.toLowerCase()] || this.config.logger.log || console.log;
            let logOutput = `${message}`;
            if (Object.keys(details).length > 0) {
                logOutput += ` ${JSON.stringify(details)}`;
            }
            logMethod(logOutput);
        }
    }
}