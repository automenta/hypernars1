import { EventEmitter } from 'events';
import { State } from './core/State.js';
import { Api } from './core/Api.js';
import { System } from './core/System.js';
import { Propagation } from './core/Propagation.js';
import { QuestionHandler } from './core/QuestionHandler.js';
import { ExpressionEvaluator } from './evaluator/ExpressionEvaluator.js';

import { DerivationEngineBase } from './core/DerivationEngineBase.js';
import { SimpleDerivationEngine } from './core/SimpleDerivationEngine.js';
import { AdvancedDerivationEngine } from './core/AdvancedDerivationEngine.js';

import { MemoryManagerBase } from './managers/MemoryManagerBase.js';
import { SimpleMemoryManager } from './managers/SimpleMemoryManager.js';
import { AdvancedMemoryManager } from './managers/AdvancedMemoryManager.js';

import { ContradictionManagerBase } from './managers/ContradictionManagerBase.js';
import { SimpleContradictionManager } from './managers/SimpleContradictionManager.js';
import { AdvancedContradictionManager } from './managers/AdvancedContradictionManager.js';

import { LearningEngineBase } from './managers/LearningEngineBase.js';
import { SimpleLearningEngine } from './managers/SimpleLearningEngine.js';
import { AdvancedLearningEngine } from './managers/AdvancedLearningEngine.js';

import { TemporalManagerBase } from './managers/TemporalManagerBase.js';
import { SimpleTemporalManager } from './managers/SimpleTemporalManager.js';
import { TemporalReasoner } from './managers/TemporalReasoner.js';

import { MetaReasoner } from './managers/MetaReasoner.js';
import { ExplanationSystem } from './managers/ExplanationSystem.js';


export class NARHyper extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = Object.assign({
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
    }, config);

    this.state = new State(this.config);
    this.propagation = new Propagation(this);
    this.questionHandler = new QuestionHandler(this);
    this.system = new System(this);
    this.api = new Api(this);

    this.expressionEvaluator = new ExpressionEvaluator(this);
    this._initializeModules(config);

    this._exposeApi();
  }

  _initializeModules(config) {
    const useAdvanced = config.useAdvanced || false;

    const moduleSelection = {
        DerivationEngine: useAdvanced ? AdvancedDerivationEngine : SimpleDerivationEngine,
        MemoryManager: useAdvanced ? AdvancedMemoryManager : SimpleMemoryManager,
        ContradictionManager: useAdvanced ? AdvancedContradictionManager : SimpleContradictionManager,
        LearningEngine: useAdvanced ? AdvancedLearningEngine : SimpleLearningEngine,
        TemporalManager: useAdvanced ? TemporalReasoner : SimpleTemporalManager,
    };

    const singletonModules = {
        MetaReasoner,
        ExplanationSystem,
    };

    const moduleClasses = { ...moduleSelection, ...singletonModules, ...(config.modules || {}) };

    const modules = {
        derivationEngine: new moduleClasses.DerivationEngine(this),
        memoryManager: new moduleClasses.MemoryManager(this),
        contradictionManager: new moduleClasses.ContradictionManager(this),
        learningEngine: new moduleClasses.LearningEngine(this),
        temporalManager: new moduleClasses.TemporalManager(this),
        metaReasoner: new moduleClasses.MetaReasoner(this),
        explanationSystem: new moduleClasses.ExplanationSystem(this),
    };

    Object.assign(this, modules);

    const validationMap = {
        derivationEngine: DerivationEngineBase,
        memoryManager: MemoryManagerBase,
        contradictionManager: ContradictionManagerBase,
        learningEngine: LearningEngineBase,
        temporalManager: TemporalManagerBase,
    };

    for (const [name, baseClass] of Object.entries(validationMap)) {
        if (!(this[name] instanceof baseClass)) {
            throw new Error(`Module ${name} does not extend its base class correctly.`);
        }
    }
  }

  _exposeApi() {
    const apiMethods = [
      'nal', 'nalq', 'seq', 'contextualRule', 'temporalSequence',
      'probabilisticRule', 'citedBelief', 'robustRule', 'temporalInterval',
      'temporalConstraint', 'inferTemporalRelationship', 'projectTemporal',
      'getContradictions', 'analyzeContradiction', 'resolveContradiction',
      'getMetaTrace', 'configureMetaStrategy', 'getActiveMetaStrategy',
      'getMetaMetrics', 'getMetaFocus', 'term', 'inheritance', 'similarity',
      'implication', 'equivalence', 'getBeliefs', 'addHyperedge', 'outcome',
      'revise', 'removeHyperedge'
    ];
    apiMethods.forEach(method => {
      if (this.api[method]) {
        this[method] = this.api[method].bind(this.api);
      }
    });

    this.run = this.system.run.bind(this.system);
    this.step = this.system.step.bind(this.system);
    this.ask = this.questionHandler.ask.bind(this.questionHandler);
    this.explain = this.explanationSystem.explain.bind(this.explanationSystem);
    this.query = this.expressionEvaluator.query.bind(this.expressionEvaluator);
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
    this.state = new State(this.config);
    this._initializeModules(this.config);
    this.api = new Api(this);
    this._exposeApi();
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
    const levels = { 'debug': 0, 'info': 1, 'warn': 2, 'error': 3 };
    const currentLevel = levels[this.config.logLevel.toLowerCase()] || 1;
    const messageLevel = levels[level.toLowerCase()] || 1;

    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      let logOutput = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      if (Object.keys(details).length > 0) {
        logOutput += ` ${JSON.stringify(details)}`;
      }
      console.log(logOutput);
    }
  }
}