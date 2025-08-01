import {ExpressionEvaluator} from './evaluator/ExpressionEvaluator.js';
import {AdvancedMemoryManager} from './managers/AdvancedMemoryManager.js';
import {AdvancedContradictionManager} from './managers/AdvancedContradictionManager.js';
import {MetaReasoner} from './managers/MetaReasoner.js';
import {AdvancedLearningEngine} from './managers/AdvancedLearningEngine.js';
import {ExplanationSystem} from './managers/ExplanationSystem.js';
import {TemporalReasoner} from './managers/TemporalReasoner.js';

import {State} from './core/State.js';
import {Api} from './core/Api.js';
import {AdvancedDerivationEngine} from './core/AdvancedDerivationEngine.js';
import {Propagation} from './core/Propagation.js';
import {QuestionHandler} from './core/QuestionHandler.js';
import {System} from './core/System.js';
import { EventEmitter } from 'events';


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
    }, config);

    // Core components
    this.state = new State(this.config);
    this.propagation = new Propagation(this);
    this.questionHandler = new QuestionHandler(this);
    this.system = new System(this);
    this.api = new Api(this);

    // Evaluator, Managers, and Derivation Engine
    this.expressionEvaluator = new ExpressionEvaluator(this);
    this._initializeModules(config);

    // Expose public API methods
    this._exposeApi();
  }

  _initializeModules(config) {
    // Default to the advanced managers, but allow overrides from config
    const moduleClasses = {
        DerivationEngine: AdvancedDerivationEngine,
        MemoryManager: AdvancedMemoryManager,
        ContradictionManager: AdvancedContradictionManager,
        MetaReasoner,
        LearningEngine: AdvancedLearningEngine,
        ExplanationSystem,
        TemporalManager: TemporalReasoner,
        ...(config.modules || {})
    };

    this.derivationEngine = new moduleClasses.DerivationEngine(this);
    this.memoryManager = new moduleClasses.MemoryManager(this);
    this.contradictionManager = new moduleClasses.ContradictionManager(this);
    this.metaReasoner = new moduleClasses.MetaReasoner(this);
    this.learningEngine = new moduleClasses.LearningEngine(this);
    this.explanationSystem = new moduleClasses.ExplanationSystem(this);
    this.temporalManager = new moduleClasses.TemporalManager(this);
  }

  _exposeApi() {
    // This makes the API methods directly callable on the NARHyper instance
    Object.getOwnPropertyNames(Api.prototype).forEach(methodName => {
        if (methodName !== 'constructor') {
            this[methodName] = this.api[methodName].bind(this.api);
        }
    });

    // Expose system methods
    this.run = this.system.run.bind(this.system);
    this.step = this.system.step.bind(this.system);

    // Expose question handler method
    this.ask = this.questionHandler.ask.bind(this.questionHandler);

    // Expose explanation system method
    this.explain = this.explanationSystem.explain.bind(this.explanationSystem);

    // Expose evaluator query method
    this.query = this.expressionEvaluator.query.bind(this.expressionEvaluator);
  }

  /**
   * Creates a sandboxed environment for safe experimentation and counterfactual reasoning.
   * Based on the proposal in `enhance.e.md`.
   * @param {Object} options - Configuration for the sandbox.
   * @returns {NARHyper} A new NARHyper instance configured as a sandbox.
   */
  createSandbox(options = {}) {
    // Create a new NARHyper instance with a similar config, but isolated state
    const sandbox = new NARHyper({
      ...this.config,
      // Allow overriding config for the sandbox
      ...(options.config || {}),
    });

    // Copy a subset of knowledge into the sandbox
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
    this._initializeModules(this.config); // Re-init managers with the new state
    this.api = new Api(this); // Re-init API
    this._exposeApi(); // Re-expose methods
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

    // Basic validation
    if (!stateData.version || !stateData.hypergraph) {
      throw new Error('Invalid or unsupported state file.');
    }

    this.clearState();
    this.config = Object.assign(this.config, stateData.config);
    this.state.currentStep = stateData.currentStep || 0;

    // Re-create hyperedges using the API to ensure all indexes are built
    for (const edgeData of stateData.hypergraph) {
      if (!edgeData.beliefs || edgeData.beliefs.length === 0) continue;

      // Re-add each belief to the hyperedge
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

}
