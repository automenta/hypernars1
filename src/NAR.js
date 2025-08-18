import {EventEmitter} from 'events';
import {State} from './core/State.js';
import {Api} from './core/Api.js';
import {System} from './core/System.js';
import {Propagation} from './core/Propagation.js';
import {QuestionHandler} from './core/QuestionHandler.js';
import {StateSerializer} from './core/StateSerializer.js';
import {MODULE_DEFINITIONS} from './core/moduleDefinitions.js';


const DEFAULT_CONFIG = {
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
    logLevel: 'info',
    cleanupProbability: 0.1,
    maxPathCacheSize: 1000,
    pathCacheTruncationSize: 500,
    maxQuestionCacheSize: 10,
    questionCacheTruncationSize: 5,
    cleanupInterval: 100,
    questionResolutionInterval: 10,
};


export class NAR extends EventEmitter {
    constructor(config = {}) {
        super();
        this._initConfig(config);
        this._initializeCoreComponents(config);
        this._initializeModules(config);
        this._exposeApi();
        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.on('contradiction-detected', (data) => {
            this._log('warn', `Contradiction detected for ${data.hyperedgeId}`, {
                hyperedgeId: data.hyperedgeId,
                contradictions: data.contradictions
            });
        });

        this.on('contradiction-resolved', (data) => {
            this._log('info', `Contradiction resolved for ${data.hyperedgeId}`, {
                hyperedgeId: data.hyperedgeId,
                reason: data.reason
            });
        });
    }

    _initConfig(config) {
        // First, merge the top-level defaults with the user's config.
        this.config = {...DEFAULT_CONFIG, ...config};
        this.config.ruleConfig = this.config.ruleConfig || {};

        // Now, for each module, ensure its configuration is properly merged,
        // as the top-level spread is shallow.
        for (const moduleDef of MODULE_DEFINITIONS) {
            const instanceName = moduleDef.name.charAt(0).toLowerCase() + moduleDef.name.slice(1);
            const userModuleConfig = config[instanceName] || {};
            const defaultModuleConfig = DEFAULT_CONFIG[instanceName] || {}; // This will be empty, but it's good practice

            // Explicitly merge the module's configuration.
            this.config[instanceName] = {...defaultModuleConfig, ...(this.config[instanceName] || {}), ...userModuleConfig};
        }
    }

    _initializeCoreComponents(config) {
        this.state = new State(this, {...this.config, useOptimizedIndex: config.useAdvanced});
        this.propagation = new Propagation(this);
        this.questionHandler = new QuestionHandler(this);
        this.system = new System(this);
        this.serializer = new StateSerializer(this);
    }

    _initializeModules(config) {
        const useAdvanced = config.useAdvanced || false;
        const customModules = config.modules || {};

        for (const moduleDef of MODULE_DEFINITIONS) {
            const instanceName = moduleDef.name.charAt(0).toLowerCase() + moduleDef.name.slice(1);
            const ModuleClass = customModules[moduleDef.name] || (useAdvanced ? (moduleDef.advanced || moduleDef.simple) : moduleDef.simple);

            if (ModuleClass) {
                this[instanceName] = new ModuleClass(this, this.config[instanceName]);

                if (moduleDef.base && !(this[instanceName] instanceof moduleDef.base)) {
                    throw new Error(`Module ${instanceName} does not extend its base class correctly.`);
                }
            }
        }

        this.api = new Api(this);
    }

    _exposeApi() {
        // Methods from the core Api class
        this.nal = this.api.nal.bind(this.api);
        this.nalq = this.api.nalq.bind(this.api);
        this.seq = this.api.seq.bind(this.api);
        this.contextualRule = this.api.contextualRule.bind(this.api);
        this.temporalSequence = this.api.temporalSequence.bind(this.api);
        this.probabilisticRule = this.api.probabilisticRule.bind(this.api);
        this.citedBelief = this.api.citedBelief.bind(this.api);
        this.robustRule = this.api.robustRule.bind(this.api);
        this.temporalInterval = this.api.temporalInterval.bind(this.api);
        this.temporalConstraint = this.api.temporalConstraint.bind(this.api);
        this.inferTemporalRelationship = this.api.inferTemporalRelationship.bind(this.api);
        this.projectTemporal = this.api.projectTemporal.bind(this.api);
        this.getContradictions = this.api.getContradictions.bind(this.api);
        this.getGoals = this.api.getGoals.bind(this.api);
        this.analyzeContradiction = this.api.analyzeContradiction.bind(this.api);
        this.resolveContradiction = this.api.resolveContradiction.bind(this.api);
        this.getTrace = this.api.getTrace.bind(this.api);
        this.configureStrategy = this.api.configureStrategy.bind(this.api);
        this.getActiveStrategy = this.api.getActiveStrategy.bind(this.api);
        this.getMetrics = this.api.getMetrics.bind(this.api);
        this.getFocus = this.api.getFocus.bind(this.api);
        this.term = this.api.term.bind(this.api);
        this.inheritance = this.api.inheritance.bind(this.api);
        this.similarity = this.api.similarity.bind(this.api);
        this.implication = this.api.implication.bind(this.api);
        this.equivalence = this.api.equivalence.bind(this.api);
        this.getBelief = this.api.getBelief.bind(this.api);
        this.getBeliefs = this.api.getBeliefs.bind(this.api);
        this.queryBelief = this.api.queryBelief.bind(this.api);
        this.addHyperedge = this.api.addHyperedge.bind(this.api);
        this.outcome = this.api.outcome.bind(this.api);
        this.revise = this.api.revise.bind(this.api);
        this.removeHyperedge = this.api.removeHyperedge.bind(this.api);

        // Methods from other core components
        this.run = this.system.run.bind(this.system);
        this.step = this.system.step.bind(this.system);
        this.ask = this.questionHandler.ask.bind(this.questionHandler);
        this.explain = this.explanationSystem.explain.bind(this.explanationSystem);
        this.query = this.expressionEvaluator.query.bind(this.expressionEvaluator);
        this.addGoal = this.goalManager.addGoal.bind(this.goalManager);
    }

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
        this._exposeApi();

        if (this.contradictionManager && this.contradictionManager.contradictions) {
            this.contradictionManager.contradictions.clear();
        }
    }

    saveState() {
        return this.serializer.saveState();
    }

    loadState(jsonString) {
        return this.serializer.loadState(jsonString);
    }

    _log(level, message, details = {}) {
        const levels = {'debug': 0, 'info': 1, 'warn': 2, 'error': 3};
        const currentLevel = levels[this.config.logLevel.toLowerCase()] || 1;
        const messageLevel = levels[level.toLowerCase()] || 1;

        if (messageLevel >= currentLevel) {
            let logOutput = `${message}`;
            if (Object.keys(details).length > 0) {
                logOutput += ` ${JSON.stringify(details)}`;
            }
            const logMethod = this.config.logger[level.toLowerCase()] || this.config.logger.log || console.log;
            logMethod(logOutput);
            this.emit('log', {message: logOutput, level: level, details: details});
        }
    }
}