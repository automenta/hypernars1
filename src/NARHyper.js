import { ExpressionEvaluator } from './evaluator/ExpressionEvaluator.js';
import { MemoryManager } from './managers/MemoryManager.js';
import { ContradictionManager } from './managers/ContradictionManager.js';
import { MetaReasoner } from './managers/MetaReasoner.js';
import { LearningEngine } from './managers/LearningEngine.js';
import { ExplanationSystem } from './managers/ExplanationSystem.js';
import { TemporalManager } from './managers/TemporalManager.js';
import { id } from './support/utils.js';

import { State } from './core/State.js';
import { Api } from './core/Api.js';
import { DerivationEngine } from './core/DerivationEngine.js';
import { SimpleDerivationEngine } from './core/SimpleDerivationEngine.js';
import { Propagation } from './core/Propagation.js';
import { QuestionHandler } from './core/QuestionHandler.js';
import { System } from './core/System.js';


export class NARHyper {
  constructor(config = {}) {
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
    const moduleClasses = {
        DerivationEngine,
        MemoryManager,
        ContradictionManager,
        MetaReasoner,
        LearningEngine,
        ExplanationSystem,
        TemporalManager,
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
  }

  on(eventType, callback) {
    const listener = { eventType, callback };
    this.state.listeners.add(listener);
    return () => this.state.listeners.delete(listener);
  }

  notifyListeners(eventType, data) {
    this.state.listeners.forEach(listener => {
      if (listener.eventType === eventType) {
        try {
          listener.callback(data);
        } catch (e) {
          console.error(`Listener error for ${eventType}:`, e);
        }
      }
    });
  }
}
