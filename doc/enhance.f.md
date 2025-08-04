# Revised NARHyper Implementation: Enhanced Hybrid Reasoning System

Based on the requirements and analysis of the current implementation, I've identified several critical areas for
improvement to create a more robust, scalable, and practical hybrid reasoning system. Below are the key enhancements
that address the missing functionality while maintaining the core principles of NARS.

## 1. Enhanced Temporal Reasoning System

The current temporal implementation is too simplistic for real-world applications. I've added a complete temporal
reasoning framework based on Allen's interval algebra with dynamic horizon adjustment:

```javascript
/* ===== ENHANCED TEMPORAL REASONING ===== */
/**
 * Advanced temporal interval representation with start/end times
 * @param {string} id - Unique identifier for the temporal interval
 * @param {number} start - Start timestamp (ms)
 * @param {number} end - End timestamp (ms)
 * @param {object} options - Additional options (confidence, priority, etc.)
 */
class TimeInterval {
  constructor(id, start, end, options = {}) {
    this.id = id;
    this.start = start;
    this.end = end;
    this.duration = end - start;
    this.truth = options.truth || TruthValue.certain();
    this.budget = options.budget || Budget.full();
    this.relations = new Map(); // Stores relations to other intervals
  }
  
  /**
   * Determine temporal relation to another interval (Allen's algebra)
   * @returns {string} Relation type (before, after, meets, overlaps, during, starts, finishes, equals)
   */
  relateTo(other) {
    if (this.end < other.start) return 'before';
    if (this.start > other.end) return 'after';
    if (this.end === other.start) return 'meets';
    if (this.start === other.end) return 'metBy';
    if (this.start < other.start && this.end > other.start && this.end < other.end) return 'overlaps';
    if (other.start < this.start && other.end > this.start && other.end < this.end) return 'overlappedBy';
    if (this.start > other.start && this.end < other.end) return 'during';
    if (this.start < other.start && this.end > other.end) return 'contains';
    if (this.start === other.start && this.end < other.end) return 'starts';
    if (this.start > other.start && this.end === other.end) return 'finishes';
    if (this.start === other.start && this.end === other.end) return 'equals';
    return 'unknown';
  }
  
  /**
   * Project future state based on historical patterns
   * @param {number} futureTime - Timestamp to project to
   * @returns {TruthValue} Projected truth value at future time
   */
  project(futureTime, decayRate = 0.05) {
    const timeDelta = Math.max(0, futureTime - this.end) / 1000; // seconds
    const decayFactor = Math.exp(-decayRate * timeDelta);
    return new TruthValue(
      this.truth.frequency,
      this.truth.confidence * decayFactor,
      this.truth.priority * decayFactor
    );
  }
}

// Updated temporal operations in NARHyper
temporalInterval(subject, start, end, options = {}) {
  const intervalId = this._id('Interval', [subject, start, end]);
  const interval = new TimeInterval(intervalId, start, end, options);
  this.temporalIntervals.set(intervalId, interval);
  this._addToTemporalIndex(interval);
  return intervalId;
}

temporalRelation(interval1, interval2, relationType, options = {}) {
  const relationId = this._id('TemporalRelation', [interval1, interval2, relationType]);
  const interval1Obj = this.temporalIntervals.get(interval1);
  const interval2Obj = this.temporalIntervals.get(interval2);
  
  if (interval1Obj && interval2Obj) {
    interval1Obj.relations.set(interval2, relationType);
    interval2Obj.relations.set(interval1, this._inverseTemporalRelation(relationType));
    
    // Create symbolic representation for reasoning
    const relation = this._addHyperedge('TemporalRelation', [interval1, interval2, relationType], options);
    
    // Derive implications based on temporal relation
    this._deriveTemporalImplications(interval1, interval2, relationType, options.budget);
    
    return relation;
  }
  return null;
}

_deriveTemporalImplications(interval1, interval2, relation, budget) {
  const rules = {
    'before': () => this._propagate(interval2, 0.7, budget.scale(0.6), 0, 0, ['temporal_before']),
    'after': () => this._propagate(interval1, 0.7, budget.scale(0.6), 0, 0, ['temporal_after']),
    'during': () => {
      // If A is during B, and B implies X, then A implies X
      this.index.byArg.get(interval2)?.forEach(id => {
        const hyperedge = this.hypergraph.get(id);
        if (hyperedge?.type === 'Implication') {
          const [premise, conclusion] = hyperedge.args;
          if (premise === interval2) {
            this._propagate(this._id('Implication', [interval1, conclusion]), 
              0.6, budget.scale(0.5), 0, 0, ['during_implication']);
          }
        }
      });
    },
    'overlaps': () => {
      // Derive intersection interval
      const i1 = this.temporalIntervals.get(interval1);
      const i2 = this.temporalIntervals.get(interval2);
      if (i1 && i2) {
        const overlapStart = Math.max(i1.start, i2.start);
        const overlapEnd = Math.min(i1.end, i2.end);
        if (overlapEnd > overlapStart) {
          this.temporalInterval(
            `Overlap(${interval1},${interval2})`, 
            overlapStart, 
            overlapEnd,
            { budget: budget.scale(0.5) }
          );
        }
      }
    }
  };
  
  if (rules[relation]) rules[relation]();
}

/* ===== TEMPORAL QUERYING ===== */
/**
 * Find intervals related to a subject with temporal constraints
 * @example queryTemporal('motion_detected', { before: Date.now() - 5000, during: currentInterval })
 */
queryTemporal(subject, constraints = {}) {
  const results = [];
  this.temporalIntervals.forEach(interval => {
    if (interval.id.includes(subject)) {
      let matches = true;
      
      // Check temporal constraints
      if (constraints.before && interval.end >= constraints.before) matches = false;
      if (constraints.after && interval.start <= constraints.after) matches = false;
      if (constraints.during) {
        const duringInterval = this.temporalIntervals.get(constraints.during);
        if (duringInterval && interval.relateTo(duringInterval) !== 'during') matches = false;
      }
      
      if (matches) {
        results.push({
          interval: interval.id,
          start: interval.start,
          end: interval.end,
          truth: interval.truth,
          relation: this._getTemporalRelationToConstraints(interval, constraints)
        });
      }
    }
  });
  
  return results;
}

_getTemporalRelationToConstraints(interval, constraints) {
  if (constraints.during) {
    const duringInterval = this.temporalIntervals.get(constraints.during);
    return duringInterval ? interval.relateTo(duringInterval) : 'unknown';
  }
  return 'direct';
}
```

## 2. Advanced Contradiction Management System

The current implementation handles multiple beliefs but lacks sophisticated contradiction resolution:

```javascript
/* ===== ADVANCED CONTRADICTION MANAGEMENT ===== */
/**
 * Contradiction detection and resolution system
 */
class ContradictionManager {
  constructor(nar) {
    this.nar = nar;
    this.contradictions = new Map(); // Maps hyperedge ID to contradiction records
    this.resolutionStrategies = {
      'evidence-weighted': this._evidenceWeightedResolution.bind(this),
      'recency-biased': this._recencyBiasedResolution.bind(this),
      'source-reliability': this._sourceReliabilityResolution.bind(this),
      'default': this._defaultResolution.bind(this)
    };
  }
  
  /**
   * Detect contradictions for a hyperedge
   * @returns {boolean} True if contradiction detected
   */
  detectContradictions(hyperedgeId) {
    const hyperedge = this.nar.hypergraph.get(hyperedgeId);
    if (!hyperedge || hyperedge.beliefs.length < 2) return false;
    
    // Check for contradictory truth values
    const contradictoryPairs = [];
    for (let i = 0; i < hyperedge.beliefs.length; i++) {
      for (let j = i + 1; j < hyperedge.beliefs.length; j++) {
        if (this._areContradictory(hyperedge.beliefs[i].truth, hyperedge.beliefs[j].truth)) {
          contradictoryPairs.push({
            belief1: hyperedge.beliefs[i],
            belief2: hyperedge.beliefs[j],
            severity: this._contradictionSeverity(hyperedge.beliefs[i].truth, hyperedge.beliefs[j].truth)
          });
        }
      }
    }
    
    if (contradictoryPairs.length > 0) {
      this.contradictions.set(hyperedgeId, {
        timestamp: Date.now(),
        pairs: contradictoryPairs,
        resolved: false,
        resolutionStrategy: null,
        resolvedValue: null
      });
      
      // Notify system of contradiction
      this.nar._notifyListeners('contradiction-detected', {
        hyperedgeId,
        contradictions: contradictoryPairs
      });
      
      return true;
    }
    
    // Clear if previously marked as contradiction but now resolved
    if (this.contradictions.has(hyperedgeId)) {
      this.contradictions.delete(hyperedgeId);
      this.nar._notifyListeners('contradiction-resolved', { hyperedgeId });
    }
    
    return false;
  }
  
  /**
   * Automatically resolve contradictions based on configured strategy
   */
  resolveContradictions() {
    const contradictions = Array.from(this.contradictions.entries())
      .filter(([_, data]) => !data.resolved);
      
    contradictions.forEach(([hyperedgeId, contradiction]) => {
      const strategy = this._selectResolutionStrategy(hyperedgeId, contradiction);
      const resolution = this.resolutionStrategies[strategy](hyperedgeId, contradiction);
      
      if (resolution) {
        contradiction.resolved = true;
        contradiction.resolutionStrategy = strategy;
        contradiction.resolvedValue = resolution;
        
        // Update the hyperedge with the resolved value
        this.nar.revise(
          hyperedgeId,
          resolution.truth,
          resolution.budget
        );
        
        // Notify listeners
        this.nar._notifyListeners('contradiction-resolved', {
          hyperedgeId,
          strategy,
          resolution
        });
      }
    });
  }
  
  /**
   * Manual contradiction resolution with specified strategy
   */
  manualResolve(hyperedgeId, strategyName, customParams = {}) {
    const contradiction = this.contradictions.get(hyperedgeId);
    if (!contradiction || contradiction.resolved) return false;
    
    const strategy = this.resolutionStrategies[strategyName] || this.resolutionStrategies['default'];
    const resolution = strategy(hyperedgeId, contradiction, customParams);
    
    if (resolution) {
      contradiction.resolved = true;
      contradiction.resolutionStrategy = strategyName;
      contradiction.resolvedValue = resolution;
      
      this.nar.revise(hyperedgeId, resolution.truth, resolution.budget);
      return true;
    }
    
    return false;
  }
  
  /* ===== CONTRADICTION RESOLUTION STRATEGIES ===== */
  _evidenceWeightedResolution(hyperedgeId, contradiction) {
    let totalWeight = 0;
    let weightedFrequency = 0;
    let weightedConfidence = 0;
    
    contradiction.pairs.forEach(pair => {
      const weight1 = pair.belief1.budget.priority * pair.belief1.truth.confidence;
      const weight2 = pair.belief2.budget.priority * pair.belief2.truth.confidence;
      
      weightedFrequency += pair.belief1.truth.frequency * weight1;
      weightedConfidence += pair.belief1.truth.confidence * weight1;
      weightedFrequency += pair.belief2.truth.frequency * weight2;
      weightedConfidence += pair.belief2.truth.confidence * weight2;
      
      totalWeight += weight1 + weight2;
    });
    
    if (totalWeight > 0) {
      return {
        truth: new TruthValue(
          weightedFrequency / totalWeight,
          weightedConfidence / totalWeight,
          Math.min(totalWeight / 2, 1.0)
        ),
        budget: Budget.full().scale(0.8)
      };
    }
    
    return null;
  }
  
  _recencyBiasedResolution(hyperedgeId, contradiction) {
    // In a real system, we would track when beliefs were added
    // For this example, we'll assume more recent beliefs have higher priority
    const mostRecent = contradiction.pairs
      .flatMap(pair => [pair.belief1, pair.belief2])
      .sort((a, b) => b.budget.priority - a.budget.priority)[0];
      
    return {
      truth: mostRecent.truth,
      budget: mostRecent.budget.scale(0.9)
    };
  }
  
  _sourceReliabilityResolution(hyperedgeId, contradiction, { sourceWeights = {} } = {}) {
    // This would consider the reliability of different information sources
    // For demonstration, we'll assume source weights are provided
    let totalWeight = 0;
    let weightedFrequency = 0;
    let weightedConfidence = 0;
    
    contradiction.pairs.forEach(pair => {
      const source1 = this._getSource(pair.belief1);
      const source2 = this._getSource(pair.belief2);
      
      const weight1 = (sourceWeights[source1] || 0.5) * pair.belief1.budget.priority;
      const weight2 = (sourceWeights[source2] || 0.5) * pair.belief2.budget.priority;
      
      weightedFrequency += pair.belief1.truth.frequency * weight1;
      weightedConfidence += pair.belief1.truth.confidence * weight1;
      weightedFrequency += pair.belief2.truth.frequency * weight2;
      weightedConfidence += pair.belief2.truth.confidence * weight2;
      
      totalWeight += weight1 + weight2;
    });
    
    if (totalWeight > 0) {
      return {
        truth: new TruthValue(
          weightedFrequency / totalWeight,
          weightedConfidence / totalWeight,
          Math.min(totalWeight / 2, 1.0)
        ),
        budget: Budget.full().scale(0.85)
      };
    }
    
    return null;
  }
  
  _defaultResolution(hyperedgeId, contradiction) {
    // Default to the belief with highest expectation
    const strongest = contradiction.pairs
      .flatMap(pair => [pair.belief1, pair.belief2])
      .sort((a, b) => b.truth.expectation() - a.truth.expectation())[0];
      
    return {
      truth: strongest.truth,
      budget: strongest.budget.scale(0.95)
    };
  }
  
  /* ===== HELPER METHODS ===== */
  _areContradictory(truth1, truth2) {
    const expectation1 = truth1.expectation();
    const expectation2 = truth2.expectation();
    return Math.abs(expectation1 - expectation2) > 0.5;
  }
  
  _contradictionSeverity(truth1, truth2) {
    return Math.abs(truth1.expectation() - truth2.expectation());
  }
  
  _getSource(belief) {
    // In a real implementation, this would track the source of information
    return belief.source || 'unknown';
  }
  
  _selectResolutionStrategy(hyperedgeId, contradiction) {
    // Strategy selection based on context
    // Could be enhanced with meta-reasoning about which strategy works best
    const severity = contradiction.pairs[0].severity;
    
    if (severity > 0.8) return 'evidence-weighted';
    if (this.nar._isTimeCritical(hyperedgeId)) return 'recency-biased';
    return 'default';
  }
}

// Integration into NARHyper
constructor(config = {}) {
  // ... existing initialization ...
  this.contradictionManager = new ContradictionManager(this);
  this.metaReasoner = new MetaReasoner(this);
  this.learningEngine = new LearningEngine(this);
}

_revise(hyperedgeId, newTruth, newBudget) {
  const result = super.revise(hyperedgeId, newTruth, newBudget);
  
  // Check for contradictions after revision
  if (result) {
    this.contradictionManager.detectContradictions(hyperedgeId);
  }
  
  return result;
}

// Add to step() method
step() {
  // ... existing code ...
  
  // Check for and resolve contradictions
  this.contradictionManager.resolveContradictions();
  
  // Run meta-reasoning to optimize resource allocation
  this.metaReasoner.optimizeResources();
  
  // Apply learning from recent reasoning
  this.learningEngine.applyLearning();
  
  return true;
}
```

## 3. Meta-Reasoning System for Resource Management

To better adhere to AIKR principles and prevent combinatorial explosion:

```javascript
/* ===== META-REASONING SYSTEM ===== */
/**
 * Meta-reasoning capabilities for self-monitoring and optimization
 */
class MetaReasoner {
  constructor(nar) {
    this.nar = nar;
    this.performanceHistory = new Map(); // Tracks reasoning effectiveness
    this.resourceAllocation = {
      derivationBudget: 0.6,
      memoryBudget: 0.3,
      temporalBudget: 0.1
    };
    this.strategyEffectiveness = new Map(); // Maps strategy to success rate
    this.currentFocus = 'default'; // Current reasoning focus area
    this.focusHistory = [];
  }
  
  /**
   * Analyze recent reasoning performance to optimize resource allocation
   */
  optimizeResources() {
    // Analyze recent performance
    this._updatePerformanceMetrics();
    
    // Adjust resource allocation based on current needs
    this._adjustResourceAllocation();
    
    // Select optimal reasoning strategies
    this._selectOptimalStrategies();
    
    // Adjust focus based on system goals
    this._adjustReasoningFocus();
  }
  
  /**
   * Track the effectiveness of different reasoning paths
   */
  trackReasoningPath(pathId, outcome, metrics = {}) {
    if (!this.performanceHistory.has(pathId)) {
      this.performanceHistory.set(pathId, {
        successes: 0,
        attempts: 0,
        totalTime: 0,
        totalSteps: 0,
        lastOutcome: null,
        metricsHistory: []
      });
    }
    
    const record = this.performanceHistory.get(pathId);
    record.attempts++;
    if (outcome === 'success') record.successes++;
    record.totalTime += metrics.time || 0;
    record.totalSteps += metrics.steps || 0;
    record.lastOutcome = outcome;
    record.metricsHistory.push({
      timestamp: Date.now(),
      outcome,
      ...metrics
    });
    
    // Keep history size manageable
    if (record.metricsHistory.length > 100) {
      record.metricsHistory = record.metricsHistory.slice(-50);
    }
  }
  
  /**
   * Get effectiveness score for a reasoning strategy
   */
  getStrategyEffectiveness(strategyName) {
    const record = this.strategyEffectiveness.get(strategyName);
    if (!record) return 0.5; // Default medium effectiveness
    
    const successRate = record.successes / record.attempts;
    const recencyFactor = Math.exp(-(Date.now() - record.lastUpdated) / (1000 * 60 * 5)); // 5 minute decay
    
    return successRate * 0.7 + recencyFactor * 0.3;
  }
  
  /**
   * Update effectiveness of a strategy based on outcome
   */
  updateStrategyEffectiveness(strategyName, outcome, metrics = {}) {
    if (!this.strategyEffectiveness.has(strategyName)) {
      this.strategyEffectiveness.set(strategyName, {
        successes: 0,
        attempts: 0,
        lastUpdated: Date.now(),
        metrics: {}
      });
    }
    
    const record = this.strategyEffectiveness.get(strategyName);
    record.attempts++;
    if (outcome === 'success') record.successes++;
    record.lastUpdated = Date.now();
    
    // Update metric averages
    Object.keys(metrics).forEach(key => {
      const value = metrics[key];
      if (typeof value === 'number') {
        if (!record.metrics[key]) record.metrics[key] = { sum: 0, count: 0 };
        record.metrics[key].sum += value;
        record.metrics[key].count++;
      }
    });
  }
  
  /* ===== INTERNAL METHODS ===== */
  _updatePerformanceMetrics() {
    // Analyze recent event processing
    const recentEvents = this.nar.eventQueue.heap.slice(-50);
    let successfulDerivations = 0;
    let totalDerivations = 0;
    
    recentEvents.forEach(event => {
      if (event.derivationPath && event.derivationPath.length > 0) {
        totalDerivations++;
        if (this._wasDerivationSuccessful(event)) {
          successfulDerivations++;
        }
      }
    });
    
    // Track overall success rate
    this._trackSystemMetric('derivation_success_rate', 
      totalDerivations > 0 ? successfulDerivations / totalDerivations : 0);
      
    // Track budget utilization
    this._trackSystemMetric('budget_utilization', 
      this._calculateBudgetUtilization());
  }
  
  _wasDerivationSuccessful(event) {
    // In a real system, this would check if the derivation led to useful results
    // For this example, we'll consider it successful if it generated answers to questions
    return event.activation > 0.5 && event.budget.priority > 0.3;
  }
  
  _calculateBudgetUtilization() {
    // Calculate how effectively budget is being used
    const totalBudget = this.nar.eventQueue.heap.reduce(
      (sum, event) => sum + event.budget.priority, 0);
      
    const activeBudget = this.nar.eventQueue.heap.filter(
      event => event.budget.priority > this.nar.config.budgetThreshold).length;
      
    return activeBudget / Math.max(totalBudget, 1);
  }
  
  _adjustResourceAllocation() {
    const successRate = this._getSystemMetric('derivation_success_rate', 0.5);
    const budgetUtilization = this._getSystemMetric('budget_utilization', 0.5);
    
    // If success rate is low, allocate more resources to derivation
    if (successRate < 0.4) {
      this.resourceAllocation.derivationBudget = Math.min(
        this.resourceAllocation.derivationBudget + 0.1, 0.8);
    } 
    // If budget utilization is high but success rate is low, we're wasting resources
    else if (budgetUtilization > 0.7 && successRate < 0.6) {
      this.resourceAllocation.derivationBudget = Math.max(
        this.resourceAllocation.derivationBudget - 0.1, 0.3);
    }
    
    // Adjust other allocations to maintain sum of 1.0
    const total = Object.values(this.resourceAllocation).reduce((a, b) => a + b, 0);
    Object.keys(this.resourceAllocation).forEach(key => {
      this.resourceAllocation[key] = this.resourceAllocation[key] / total;
    });
    
    // Apply to system configuration
    this.nar.config.budgetDecay = 0.9 - this.resourceAllocation.derivationBudget * 0.3;
    this.nar.config.inferenceThreshold = 0.3 - this.resourceAllocation.derivationBudget * 0.1;
  }
  
  _selectOptimalStrategies() {
    // Identify which derivation rules are most effective
    const ruleEffectiveness = {};
    
    ['Inheritance', 'Similarity', 'Implication', 'Conjunction'].forEach(rule => {
      ruleEffectiveness[rule] = this.getStrategyEffectiveness(`derive_${rule}`);
    });
    
    // Sort rules by effectiveness
    const sortedRules = Object.entries(ruleEffectiveness)
      .sort((a, b) => b[1] - a[1])
      .map(([rule]) => rule);
      
    // Set priority for most effective rules
    this.nar.config.derivationPriority = sortedRules;
  }
  
  _adjustReasoningFocus() {
    // Determine current focus based on system needs
    const currentFocus = this._determineCurrentFocus();
    
    if (currentFocus !== this.currentFocus) {
      this.focusHistory.push({
        from: this.currentFocus,
        to: currentFocus,
        timestamp: Date.now()
      });
      
      // Limit focus history size
      if (this.focusHistory.length > 20) {
        this.focusHistory = this.focusHistory.slice(-10);
      }
      
      this.currentFocus = currentFocus;
      
      // Adjust system parameters based on focus
      this._applyFocusParameters(currentFocus);
    }
  }
  
  _determineCurrentFocus() {
    // Check for urgent questions
    if (this.nar.questionPromises.size > 0) {
      const oldestQuestion = Array.from(this.nar.questionPromises.keys())
        .sort((a, b) => a.timestamp - b.timestamp)[0];
        
      if (oldestQuestion && Date.now() - oldestQuestion.timestamp < 1000) {
        return 'question-answering';
      }
    }
    
    // Check for contradictions needing resolution
    for (const [hyperedgeId, contradiction] of this.nar.contradictionManager.contradictions) {
      if (!contradiction.resolved) {
        return 'contradiction-resolution';
      }
    }
    
    // Check for temporal reasoning needs
    if (this.nar.temporalIntervals.size > 0) {
      return 'temporal-reasoning';
    }
    
    return 'default';
  }
  
  _applyFocusParameters(focus) {
    switch (focus) {
      case 'question-answering':
        this.nar.config.maxPathLength = 20;
        this.nar.config.inferenceThreshold = 0.2;
        this.nar.config.budgetDecay = 0.7;
        break;
      case 'contradiction-resolution':
        this.nar.config.beliefCapacity = 12;
        this.nar.config.derivationCacheSize = 500;
        break;
      case 'temporal-reasoning':
        this.nar.config.temporalHorizon = 15;
        this.nar.config.maxDerivationDepth = 6;
        break;
      default:
        // Restore default configuration
        Object.assign(this.nar.config, {
          decay: 0.1,
          budgetDecay: 0.8,
          inferenceThreshold: 0.3,
          maxPathLength: 15,
          beliefCapacity: 8,
          temporalHorizon: 3,
          budgetThreshold: 0.05,
          maxDerivationDepth: 5
        });
    }
  }
  
  /* ===== UTILITY METHODS ===== */
  _trackSystemMetric(metricName, value) {
    if (!this.systemMetrics) {
      this.systemMetrics = new Map();
    }
    
    if (!this.systemMetrics.has(metricName)) {
      this.systemMetrics.set(metricName, {
        history: [],
        average: 0,
        count: 0
      });
    }
    
    const metric = this.systemMetrics.get(metricName);
    metric.history.push({ timestamp: Date.now(), value });
    metric.count++;
    metric.average = (metric.average * (metric.count - 1) + value) / metric.count;
    
    // Keep history size manageable
    if (metric.history.length > 50) {
      metric.history = metric.history.slice(-25);
    }
  }
  
  _getSystemMetric(metricName, defaultValue = 0) {
    return this.systemMetrics?.get(metricName)?.average || defaultValue;
  }
}
```

## 4. Enhanced Learning Engine

To make the system truly adaptive:

```javascript
/* ===== LEARNING ENGINE ===== */
/**
 * Learning capabilities for adaptive reasoning
 */
class LearningEngine {
  constructor(nar) {
    this.nar = nar;
    this.experienceBuffer = [];
    this.patternMemory = new Map(); // Maps pattern signatures to learning data
    this.ruleCreationThreshold = 0.75; // Confidence threshold for creating new rules
    this.learningRate = 0.1; // How quickly to update based on new evidence
    this.patternSimilarityThreshold = 0.8; // Threshold for considering patterns similar
  }
  
  /**
   * Apply learning from recent experiences
   */
  applyLearning() {
    // Process recent experiences
    this._processRecentExperiences();
    
    // Update truth value revision parameters
    this._updateRevisionParameters();
    
    // Discover new patterns
    this._discoverPatterns();
    
    // Create new rules from patterns
    this._createRulesFromPatterns();
    
    // Adjust derivation rule effectiveness
    this._adjustRuleEffectiveness();
  }
  
  /**
   * Record an experience for future learning
   */
  recordExperience(context, outcome, options = {}) {
    const experience = {
      id: this._generateExperienceId(context, outcome),
      timestamp: Date.now(),
      context,
      outcome,
      expectedOutcome: options.expectedOutcome,
      accuracy: options.accuracy,
      derivationPath: options.derivationPath,
      resourcesUsed: options.resourcesUsed,
      success: options.success
    };
    
    this.experienceBuffer.push(experience);
    
    // Keep buffer size manageable
    if (this.experienceBuffer.length > 1000) {
      this.experienceBuffer = this.experienceBuffer.slice(-500);
    }
    
    // Immediately process significant experiences
    if (options.important || (options.accuracy !== undefined && Math.abs(options.accuracy) < 0.2)) {
      this._processSignificantExperience(experience);
    }
  }
  
  /* ===== INTERNAL METHODS ===== */
  _processRecentExperiences() {
    const recent = this.experienceBuffer.slice(-100);
    if (recent.length === 0) return;
    
    // Calculate average accuracy
    const validExperiences = recent.filter(e => e.accuracy !== undefined);
    if (validExperiences.length > 0) {
      const avgAccuracy = validExperiences.reduce((sum, e) => sum + e.accuracy, 0) / 
                          validExperiences.length;
      
      // Track accuracy by derivation path
      const pathAccuracy = new Map();
      validExperiences.forEach(experience => {
        if (experience.derivationPath) {
          const pathKey = experience.derivationPath.join('>');
          if (!pathAccuracy.has(pathKey)) {
            pathAccuracy.set(pathKey, { sum: 0, count: 0 });
          }
          const record = pathAccuracy.get(pathKey);
          record.sum += experience.accuracy;
          record.count++;
        }
      });
      
      // Update path effectiveness
      pathAccuracy.forEach((record, pathKey) => {
        const avg = record.sum / record.count;
        this.nar.metaReasoner.updateStrategyEffectiveness(
          `path:${pathKey}`, 
          avg > 0.6 ? 'success' : 'failure',
          { accuracy: avg }
        );
      });
    }
  }
  
  _processSignificantExperience(experience) {
    // For highly accurate or inaccurate predictions, immediately adjust parameters
    if (experience.accuracy !== undefined) {
      const absAccuracy = Math.abs(experience.accuracy);
      
      // If prediction was very inaccurate, investigate why
      if (absAccuracy < 0.3) {
        this._analyzeFailure(experience);
      }
      
      // If prediction was very accurate, reinforce the pattern
      if (absAccuracy > 0.8) {
        this._reinforcePattern(experience);
      }
    }
  }
  
  _updateRevisionParameters() {
    // Analyze when revision works well vs poorly
    const revisionCases = this.experienceBuffer.filter(e => 
      e.context?.operation === 'revise');
      
    if (revisionCases.length > 20) {
      // Calculate optimal revision parameters
      const idealParams = this._calculateOptimalRevisionParameters(revisionCases);
      
      // Update TruthValue revision parameters if significantly different
      if (Math.abs(idealParams.learningRate - this.learningRate) > 0.05) {
        this.learningRate = idealParams.learningRate;
      }
    }
  }
  
  _calculateOptimalRevisionParameters(cases) {
    // In a real implementation, this would use statistical methods to determine
    // optimal revision parameters based on prediction accuracy
    
    // For demonstration, we'll use a simplified approach
    let sumFrequency = 0;
    let sumConfidence = 0;
    let count = 0;
    
    cases.forEach(c => {
      if (c.accuracy !== undefined) {
        sumFrequency += c.context.newTruth.frequency;
        sumConfidence += c.context.newTruth.confidence;
        count++;
      }
    });
    
    return {
      learningRate: count > 0 ? Math.min(0.3, 0.1 + (sumConfidence / count) * 0.2) : 0.1
    };
  }
  
  _discoverPatterns() {
    // Look for recurring patterns in successful reasoning
    const patternCandidates = this._extractPatternCandidates();
    
    patternCandidates.forEach(candidate => {
      const signature = this._patternSignature(candidate);
      
      if (!this.patternMemory.has(signature)) {
        this.patternMemory.set(signature, {
          instances: [],
          successCount: 0,
          totalCount: 0,
          averageAccuracy: 0
        });
      }
      
      const pattern = this.patternMemory.get(signature);
      pattern.instances.push(candidate);
      pattern.totalCount++;
      
      if (candidate.accuracy !== undefined && candidate.accuracy > 0.6) {
        pattern.successCount++;
      }
      
      // Calculate moving average accuracy
      const prevAccuracy = pattern.averageAccuracy || 0;
      pattern.averageAccuracy = prevAccuracy * 0.9 + 
        (candidate.accuracy || 0.5) * 0.1;
      
      // Keep instances manageable
      if (pattern.instances.length > 50) {
        pattern.instances = pattern.instances.slice(-25);
      }
    });
  }
  
  _extractPatternCandidates() {
    // Identify potential patterns from recent successful reasoning
    return this.experienceBuffer
      .slice(-200)
      .filter(e => e.success && e.accuracy > 0.7 && e.derivationPath)
      .map(e => ({
        context: e.context,
        outcome: e.outcome,
        derivationPath: e.derivationPath,
        accuracy: e.accuracy,
        timestamp: e.timestamp
      }));
  }
  
  _patternSignature(pattern) {
    // Create a signature that captures the essential structure of the pattern
    // without being too specific
    
    // For derivation patterns, use the path and key context elements
    if (pattern.derivationPath) {
      const pathKey = pattern.derivationPath.slice(-3).join('>');
      const contextKey = this._simplifyContext(pattern.context);
      return `${pathKey}|${contextKey}`;
    }
    
    return JSON.stringify(pattern.context).substring(0, 50);
  }
  
  _simplifyContext(context) {
    // Simplify context to capture essential features without exact values
    if (context.operation === 'derive' && context.rule) {
      return `derive:${context.rule}`;
    }
    if (context.operation === 'revise') {
      return `revise:${context.hyperedgeType}`;
    }
    return 'general';
  }
  
  _createRulesFromPatterns() {
    // Create new rules from high-confidence patterns
    for (const [signature, patternData] of this.patternMemory) {
      if (patternData.averageAccuracy > this.ruleCreationThreshold && 
          patternData.instances.length > 5) {
        
        const newRule = this._generateRuleFromPattern(patternData);
        if (newRule && !this._ruleExists(newRule)) {
          this._addLearnedRule(newRule);
          
          // Notify system of new rule
          this.nar._notifyListeners('learned-rule', {
            rule: newRule,
            confidence: patternData.averageAccuracy,
            support: patternData.instances.length
          });
        }
      }
    }
  }
  
  _generateRuleFromPattern(patternData) {
    // Analyze pattern to generate a new derivation rule
    const recentInstances = patternData.instances.slice(-5);
    
    // For demonstration, we'll handle a specific case: transitive inheritance
    if (recentInstances.some(i => 
        i.derivationPath.includes('transitivity') && 
        i.context.rule === 'Inheritance')) {
      
      // Create a specialized transitive rule for common patterns
      const commonSubjects = this._findCommonElements(
        recentInstances, i => i.context.args?.[0]);
      const commonPredicates = this._findCommonElements(
        recentInstances, i => i.context.args?.[1]);
      
      if (commonSubjects.length > 0 && commonPredicates.length > 0) {
        return {
          type: 'DerivationRule',
          name: `SpecializedTransitive_${commonSubjects[0]}_${commonPredicates[0]}`,
          condition: (hyperedge, event) => {
            return hyperedge.type === 'Inheritance' && 
                   hyperedge.args[0] === commonSubjects[0] &&
                   hyperedge.args[1] === commonPredicates[0];
          },
          action: (hyperedge, event) => {
            // Specialized handling for this pattern
            const [subject, predicate] = hyperedge.args;
            this.nar._propagate(predicate, 
              event.activation * 0.9, 
              event.budget.scale(0.85),
              event.pathHash,
              event.pathLength + 1,
              [...event.derivationPath, 'specialized_transitivity']);
          },
          confidence: patternData.averageAccuracy,
          support: patternData.instances.length
        };
      }
    }
    
    return null;
  }
  
  _findCommonElements(instances, extractor) {
    const counts = new Map();
    instances.forEach(instance => {
      const value = extractor(instance);
      if (value) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    });
    
    // Return elements that appear in at least 60% of instances
    return Array.from(counts.entries())
      .filter(([_, count]) => count / instances.length >= 0.6)
      .map(([value]) => value);
  }
  
  _ruleExists(newRule) {
    // Check if a similar rule already exists
    return Array.from(this.nar.derivationRules || []).some(rule => 
      rule.name === newRule.name);
  }
  
  _addLearnedRule(rule) {
    if (!this.nar.derivationRules) {
      this.nar.derivationRules = new Map();
    }
    this.nar.derivationRules.set(rule.name, rule);
  }
  
  _analyzeFailure(experience) {
    // Analyze why a prediction failed
    if (experience.derivationPath) {
      // Check which step in the derivation path might have gone wrong
      const problematicStep = this._identifyProblematicStep(experience);
      
      if (problematicStep) {
        // Adjust parameters for that step
        this._adjustStepParameters(problematicStep, experience);
      }
    }
  }
  
  _identifyProblematicStep(experience) {
    // In a real system, this would analyze the derivation path to find
    // where the reasoning likely went astray
    return experience.derivationPath[experience.derivationPath.length - 2];
  }
  
  _adjustStepParameters(step, experience) {
    // Adjust parameters for a problematic reasoning step
    const key = `step:${step}`;
    const currentEffectiveness = this.nar.metaReasoner.getStrategyEffectiveness(key);
    
    // Reduce effectiveness if this step led to failure
    if (experience.accuracy < 0.3) {
      const newEffectiveness = Math.max(0.1, currentEffectiveness - 0.2);
      this.nar.metaReasoner.updateStrategyEffectiveness(
        key, 'failure', { effectiveness: newEffectiveness });
    }
  }
  
  _reinforcePattern(experience) {
    // Strengthen a successful pattern
    if (experience.derivationPath) {
      const pathKey = experience.derivationPath.join('>');
      const currentEffectiveness = this.nar.metaReasoner.getStrategyEffectiveness(`path:${pathKey}`);
      
      // Increase effectiveness if this path led to success
      const newEffectiveness = Math.min(0.95, currentEffectiveness + 0.1);
      this.nar.metaReasoner.updateStrategyEffectiveness(
        `path:${pathKey}`, 'success', { effectiveness: newEffectiveness });
    }
  }
  
  /* ===== UTILITY METHODS ===== */
  _generateExperienceId(context, outcome) {
    return `Exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }
}
```

## 5. Enhanced Memory Management System

To improve scalability and resource usage:

```javascript
/* ===== ENHANCED MEMORY MANAGEMENT ===== */
/**
 * Advanced memory management system with selective forgetting
 */
class MemoryManager {
  constructor(nar) {
    this.nar = nar;
    this.beliefRelevance = new Map(); // Tracks relevance of beliefs
    this.accessPatterns = new Map(); // Tracks access patterns for cache optimization
    this.forgettingThreshold = 0.2; // Minimum relevance to retain beliefs
    this.relevanceDecayRate = 0.001; // Base rate of relevance decay
    this.activityWindow = 300000; // 5 minutes for recent activity tracking
  }
  
  /**
   * Run memory maintenance operations
   */
  maintainMemory() {
    this._decayRelevance();
    this._selectivelyForget();
    this._optimizeIndexes();
    this._adjustCacheSizes();
  }
  
  /**
   * Update relevance of a belief based on usage
   */
  updateRelevance(hyperedgeId, activityType, intensity = 1.0) {
    if (!this.beliefRelevance.has(hyperedgeId)) {
      this.beliefRelevance.set(hyperedgeId, {
        baseRelevance: 0.5,
        recentActivity: [],
        lastAccess: Date.now()
      });
    }
    
    const relevance = this.beliefRelevance.get(hyperedgeId);
    const now = Date.now();
    
    // Clean up old activity records
    relevance.recentActivity = relevance.recentActivity.filter(
      record => now - record.timestamp < this.activityWindow);
      
    // Add new activity
    relevance.recentActivity.push({
      timestamp: now,
      type: activityType,
      intensity
    });
    
    // Update base relevance with decay
    const timeFactor = Math.exp(-(now - relevance.lastAccess) / this.activityWindow);
    relevance.baseRelevance = relevance.baseRelevance * timeFactor + intensity * 0.2;
    relevance.baseRelevance = Math.min(1.0, relevance.baseRelevance);
    relevance.lastAccess = now;
    
    // Track access patterns for optimization
    this._trackAccessPattern(hyperedgeId, activityType);
  }
  
  /* ===== INTERNAL METHODS ===== */
  _decayRelevance() {
    const now = Date.now();
    const decayFactor = Math.exp(-this.relevanceDecayRate * (this.nar.config.decayInterval || 100));
    
    this.beliefRelevance.forEach((relevance, hyperedgeId) => {
      // Apply decay based on time since last access
      const timeDelta = now - relevance.lastAccess;
      const timeDecay = Math.exp(-this.relevanceDecayRate * timeDelta / 1000);
      
      relevance.baseRelevance *= timeDecay;
      
      // If relevance is very low and belief is gone from hypergraph, clean up
      if (relevance.baseRelevance < 0.01 && !this.nar.hypergraph.has(hyperedgeId)) {
        this.beliefRelevance.delete(hyperedgeId);
      }
    });
  }
  
  _selectivelyForget() {
    // Identify beliefs with low relevance
    const candidates = Array.from(this.beliefRelevance.entries())
      .filter(([id, relevance]) => {
        // Don't forget recently added beliefs
        if (relevance.lastAccess > Date.now() - 60000) return false;
        
        // Don't forget high-priority system knowledge
        const hyperedge = this.nar.hypergraph.get(id);
        if (hyperedge && hyperedge.beliefs.some(b => 
            b.budget.priority > 0.7 && b.truth.confidence > 0.7)) {
          return false;
        }
        
        return relevance.baseRelevance < this.forgettingThreshold;
      })
      .sort((a, b) => a[1].baseRelevance - b[1].baseRelevance);
      
    // Forget up to 5% of low-relevance beliefs
    const forgetCount = Math.min(10, Math.floor(candidates.length * 0.05));
    candidates.slice(0, forgetCount).forEach(([id]) => {
      this._forgetBelief(id);
    });
  }
  
  _forgetBelief(hyperedgeId) {
    const hyperedge = this.nar.hypergraph.get(hyperedgeId);
    if (!hyperedge) return;
    
    // Don't completely remove, just reduce priority
    hyperedge.beliefs = hyperedge.beliefs.map(belief => ({
      ...belief,
      budget: belief.budget.scale(0.3),
      truth: new TruthValue(
        belief.truth.frequency,
        belief.truth.confidence * 0.5,
        belief.truth.priority * 0.3
      )
    }));
    
    // If all beliefs have very low priority, consider removing
    if (hyperedge.beliefs.every(b => b.budget.total() < 0.1)) {
      this.nar.hypergraph.delete(hyperedgeId);
      this._removeFromIndexes(hyperedgeId);
      this.beliefRelevance.delete(hyperedgeId);
      
      this.nar._notifyListeners('belief-forgotten', { hyperedgeId });
    }
  }
  
  _removeFromIndexes(hyperedgeId) {
    // Remove from all indexes
    const hyperedge = this.nar.hypergraph.get(hyperedgeId);
    if (hyperedge) {
      // Remove from type index
      if (this.nar.index.byType.has(hyperedge.type)) {
        const set = this.nar.index.byType.get(hyperedge.type);
        set.delete(hyperedgeId);
        if (set.size === 0) this.nar.index.byType.delete(hyperedge.type);
      }
      
      // Remove from argument index
      hyperedge.args.forEach(arg => {
        if (this.nar.index.byArg.has(arg)) {
          const set = this.nar.index.byArg.get(arg);
          set.delete(hyperedgeId);
          if (set.size === 0) this.nar.index.byArg.delete(arg);
        }
      });
    }
  }
  
  _optimizeIndexes() {
    // Analyze index usage patterns and optimize
    const frequentPatterns = this._analyzeFrequentQueryPatterns();
    
    // Create specialized indexes for frequent patterns
    frequentPatterns.forEach(pattern => {
      if (!this.nar.index.specialized.has(pattern.signature)) {
        this._createSpecializedIndex(pattern);
      }
    });
  }
  
  _analyzeFrequentQueryPatterns() {
    // In a real system, this would analyze query logs
    // For demonstration, we'll look for common argument patterns
    const argFrequency = new Map();
    
    this.nar.index.byArg.forEach((ids, arg) => {
      argFrequency.set(arg, ids.size);
    });
    
    // Find the most frequently used arguments
    return Array.from(argFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([arg, count]) => ({
        signature: `byArg:${arg}`,
        pattern: { type: 'byArg', arg },
        frequency: count
      }));
  }
  
  _createSpecializedIndex(pattern) {
    if (pattern.pattern.type === 'byArg') {
      const arg = pattern.pattern.arg;
      const index = new Set();
      
      // Populate index with hyperedges containing this argument
      this.nar.index.byArg.get(arg)?.forEach(hyperedgeId => {
        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (hyperedge) {
          index.add(hyperedgeId);
        }
      });
      
      this.nar.index.specialized.set(pattern.signature, {
        type: 'byArg',
        arg,
        index
      });
    }
  }
  
  _adjustCacheSizes() {
    // Dynamically adjust cache sizes based on usage patterns
    const cacheUsage = this._analyzeCacheUsage();
    
    // Adjust derivation cache
    if (cacheUsage.derivationCache.missRate > 0.3) {
      // Increase cache size if miss rate is high
      this.nar.config.derivationCacheSize = Math.min(
        this.nar.config.derivationCacheSize * 1.2, 2000);
    } else if (cacheUsage.derivationCache.missRate < 0.1) {
      // Decrease cache size if miss rate is low
      this.nar.config.derivationCacheSize = Math.max(
        this.nar.config.derivationCacheSize * 0.8, 500);
    }
    
    // Update the actual cache
    if (this.nar.index.derivationCache && 
        this.nar.index.derivationCache.maxSize !== this.nar.config.derivationCacheSize) {
      const newCache = new LRUMap(this.nar.config.derivationCacheSize);
      // Transfer existing entries
      this.nar.index.derivationCache.map.forEach((value, key) => {
        newCache.set(key, value);
      });
      this.nar.index.derivationCache = newCache;
    }
  }
  
  _analyzeCacheUsage() {
    // In a real system, this would track cache hits/misses
    // For demonstration, we'll assume some metrics
    return {
      derivationCache: {
        hitRate: 0.7,
        missRate: 0.3,
        size: this.nar.index.derivationCache?.map.size || 0
      }
    };
  }
  
  _trackAccessPattern(hyperedgeId, activityType) {
    if (!this.accessPatterns.has(hyperedgeId)) {
      this.accessPatterns.set(hyperedgeId, {
        totalAccesses: 0,
        byType: new Map(),
        lastAccess: Date.now()
      });
    }
    
    const pattern = this.accessPatterns.get(hyperedgeId);
    pattern.totalAccesses++;
    pattern.lastAccess = Date.now();
    
    const typeCount = pattern.byType.get(activityType) || 0;
    pattern.byType.set(activityType, typeCount + 1);
  }
}
```

## 6. Integration Points in NARHyper

To complete the implementation, I'll add integration points for these new systems:

```javascript
// In NARHyper constructor
constructor(config = {}) {
  // ... existing initialization ...
  
  // Enhanced systems
  this.memoryManager = new MemoryManager(this);
  this.contradictionManager = new ContradictionManager(this);
  this.metaReasoner = new MetaReasoner(this);
  this.learningEngine = new LearningEngine(this);
  
  // Memory maintenance interval
  this.memoryMaintenanceInterval = config.memoryMaintenanceInterval || 100;
  this.stepsSinceMaintenance = 0;
}

// In step() method
step() {
  this.currentStep++;
  const event = this.eventQueue.pop();
  
  if (!event || event.budget.priority < this.config.budgetThreshold) return false;
  
  // Track relevance of processed belief
  this.memoryManager.updateRelevance(
    event.target, 
    'processing', 
    event.budget.priority
  );
  
  this._updateActivation(event.target, event.activation);
  this._applyDerivationRules(event);
  this._propagateWave(event);
  
  // Record experience for learning
  this._recordReasoningExperience(event);
  
  this._notifyListeners('step', { 
    step: this.currentStep,
    event, 
    activation: this.activations.get(event.target),
    queueSize: this.eventQueue.heap.length 
  });
  
  // Check if any questions can be resolved
  this.questionPromises.forEach((_, questionId) => {
    if (this.currentStep % 10 === 0) {
      this._resolveQuestion(questionId);
    }
  });
  
  // Run maintenance operations periodically
  this.stepsSinceMaintenance++;
  if (this.stepsSinceMaintenance >= this.memoryMaintenanceInterval) {
    this._runMaintenance();
    this.stepsSinceMaintenance = 0;
  }
  
  return true;
}

_recordReasoningExperience(event) {
  // Record experience for learning
  this.learningEngine.recordExperience({
    operation: 'derive',
    rule: this._getDerivationRule(event),
    hyperedgeType: this._getHyperedgeType(event),
    args: this._getHyperedgeArgs(event)
  }, {
    activation: event.activation,
    budget: event.budget
  }, {
    derivationPath: event.derivationPath,
    resourcesUsed: {
      priority: event.budget.priority,
      steps: 1
    }
  });
}

_getDerivationRule(event) {
  const hyperedge = this.hypergraph.get(event.target);
  return hyperedge ? hyperedge.type : 'unknown';
}

_getHyperedgeType(event) {
  const hyperedge = this.hypergraph.get(event.target);
  return hyperedge ? hyperedge.type : 'Term';
}

_getHyperedgeArgs(event) {
  const hyperedge = this.hypergraph.get(event.target);
  return hyperedge ? hyperedge.args : [event.target];
}

_runMaintenance() {
  // Run memory maintenance
  this.memoryManager.maintainMemory();
  
  // Run contradiction resolution
  this.contradictionManager.resolveContradictions();
  
  // Run meta-reasoning
  this.metaReasoner.optimizeResources();
  
  // Apply learning
  this.learningEngine.applyLearning();
}

// In _propagate method
_propagate(target, activation, budget, pathHash, pathLength, derivationPath) {
  if (budget.priority < this.config.budgetThreshold || 
      pathLength > this.config.maxPathLength || 
      this._hasLoop(target, pathHash)) return;
      
  // Update relevance before propagation
  this.memoryManager.updateRelevance(
    target,
    'propagation',
    budget.priority
  );
  
  this.eventQueue.push({ 
    target, 
    activation: Math.min(activation, 1.0),
    budget,
    pathHash,
    pathLength,
    derivationPath
  });
}

// In revise method
revise(hyperedgeId, newTruth, newBudget) {
  const hyperedge = this.hypergraph.get(hyperedgeId);
  if (hyperedge) {
    // Track relevance of revision activity
    this.memoryManager.updateRelevance(
      hyperedgeId,
      'revision',
      newBudget ? newBudget.priority : 0.5
    );
    
    const result = hyperedge.revise(newTruth, newBudget || hyperedge.getStrongestBelief().budget);
    this._notifyListeners('revision', { hyperedgeId, newTruth, newBudget, ...result });
    
    // Record revision experience
    this.learningEngine.recordExperience({
      operation: 'revise',
      hyperedgeId,
      hyperedgeType: hyperedge.type,
      newTruth,
      newBudget
    }, {
      oldTruth: hyperedge.getTruth(),
      oldBudget: hyperedge.getStrongestBelief().budget
    }, {
      accuracy: this._calculateRevisionAccuracy(hyperedge, newTruth),
      success: result.needsUpdate
    });
    
    return result.needsUpdate;
  }
  return false;
}

_calculateRevisionAccuracy(hyperedge, newTruth) {
  // In a real system, this would compare to ground truth
  // For demonstration, we'll assume some accuracy calculation
  const oldExpectation = hyperedge.getTruth().expectation();
  const newExpectation = newTruth.expectation();
  
  // If we had a way to know the "correct" value, we'd compare to that
  // For now, we'll just measure the change magnitude
  return 1 - Math.abs(oldExpectation - newExpectation);
}

// In ask method
ask(question, options = {}) {
  // Track relevance of question
  this.memoryManager.updateRelevance(
    this._generateQuestionId(question),
    'question',
    options.minExpectation || 0.5
  );
  
  // ... existing implementation ...
}

// In _answerQuestion method
_answerQuestion(questionId, answer) {
  // Record experience for question answering
  this.learningEngine.recordExperience({
    operation: 'answer',
    questionId,
    answerType: answer.type
  }, {
    answer
  }, {
    accuracy: answer.truth.expectation(),
    success: true
  });
  
  // ... existing implementation ...
}
```

## 7. Enhanced Explanation System

To improve transparency and explainability:

```javascript
/* ===== ENHANCED EXPLANATION SYSTEM ===== */
/**
 * Advanced explanation generation with confidence metrics
 */
class ExplanationSystem {
    constructor(nar) {
        this.nar = nar;
        this.explanationTemplates = {
            'transitivity': "Because {premise1} and {premise2}, therefore {conclusion}",
            'induction': "Since both {term1} and {term2} are {predicate}, they are likely similar",
            'abduction': "Given that {similar} is {predicate} and {subject} is similar to {similar}, {subject} is likely {predicate}",
            'analogy': "Since {term1} is {predicate} and {term1} is similar to {term2}, {term2} is likely {predicate}",
            'modus_ponens': "Because {premise} is true and {premise} implies {conclusion}, therefore {conclusion}",
            'revision': "Updated belief based on new evidence: {newTruth} (was {oldTruth})"
        };
    }

    /**
     * Generate a natural language explanation for a conclusion
     */
    explain(hyperedgeId, depth = 3) {
        const explanation = this._buildExplanation(hyperedgeId, depth);
        return this._formatExplanation(explanation);
    }

    /**
     * Generate a confidence-weighted explanation showing uncertainty
     */
    explainWithConfidence(hyperedgeId, depth = 3) {
        const explanation = this._buildExplanation(hyperedgeId, depth);
        return this._formatExplanationWithConfidence(explanation);
    }

    /* ===== INTERNAL METHODS ===== */
    _buildExplanation(hyperedgeId, depth, visited = new Set()) {
        if (depth <= 0 || visited.has(hyperedgeId)) {
            return null;
        }

        visited.add(hyperedgeId);
        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!hyperedge) return null;

        const explanation = {
            id: hyperedgeId,
            type: hyperedge.type,
            args: hyperedge.args,
            truth: hyperedge.getTruth(),
            derivationPath: [],
            premises: []
        };

        // Find derivation sources
        if (hyperedge.type === 'Inheritance') {
            const [subject, predicate] = hyperedge.args;

            // Check for transitive derivation
            const transitive = this._findTransitiveDerivation(subject, predicate);
            if (transitive) {
                explanation.derivationPath.push('transitivity');
                explanation.premises = transitive;
                return explanation;
            }

            // Check for induction
            const induction = this._findInductionDerivation(subject, predicate);
            if (induction) {
                explanation.derivationPath.push('induction');
                explanation.premises = induction;
                return explanation;
            }

            // Check for revision
            const revision = this._findRevisionDerivation(hyperedgeId);
            if (revision) {
                explanation.derivationPath.push('revision');
                explanation.premises = revision;
                return explanation;
            }
        } else if (hyperedge.type === 'Implication') {
            const [premise, conclusion] = hyperedge.args;

            // Check for modus ponens
            if (this.nar.hypergraph.has(`Term(${premise})`)) {
                explanation.derivationPath.push('modus_ponens');
                explanation.premises = [premise, hyperedgeId];
                return explanation;
            }
        }

        // Default: just the statement itself
        explanation.derivationPath.push('direct');
        return explanation;
    }

    _findTransitiveDerivation(subject, predicate) {
        const premises = [];

        // Look for middle term: <subject --> X> and <X --> predicate>
        for (const id of (this.nar.index.byArg.get(subject) || [])) {
            const hyperedge = this.nar.hypergraph.get(id);
            if (hyperedge?.type === 'Inheritance' && hyperedge.args[0] === subject) {
                const middle = hyperedge.args[1];

                for (const id2 of (this.nar.index.byArg.get(middle) || [])) {
                    const hyperedge2 = this.nar.hypergraph.get(id2);
                    if (hyperedge2?.type === 'Inheritance' &&
                        hyperedge2.args[0] === middle &&
                        hyperedge2.args[1] === predicate) {
                        premises.push(hyperedge.id, hyperedge2.id);
                        return premises;
                    }
                }
            }
        }

        return null;
    }

    _findInductionDerivation(term, predicate) {
        const premises = [];

        // Look for another term with the same predicate
        for (const id of (this.nar.index.byArg.get(predicate) || [])) {
            const hyperedge = this.nar.hypergraph.get(id);
            if (hyperedge?.type === 'Inheritance' &&
                hyperedge.args[1] === predicate &&
                hyperedge.args[0] !== term) {
                premises.push(hyperedge.id);
                // Find the current belief
                const currentId = this.nar._id('Inheritance', [term, predicate]);
                if (this.nar.hypergraph.has(currentId)) {
                    premises.push(currentId);
                    return premises;
                }
            }
        }

        return null;
    }

    _findRevisionDerivation(hyperedgeId) {
        const hyperedge = this.nar.hypergraph.get(hyperedgeId);
        if (!hyperedge || hyperedge.beliefs.length < 2) return null;

        // Return the two most recent beliefs
        return [
            this._getPreviousBeliefId(hyperedgeId),
            hyperedgeId
        ].filter(id => id !== null);
    }

    _getPreviousBeliefId(hyperedgeId) {
        // In a real system, this would track belief history
        // For demonstration, we'll assume a naming convention
        return `${hyperedgeId}_prev`;
    }

    _formatExplanation(explanation) {
        if (!explanation) return "No explanation available";

        // Format the main conclusion
        const conclusion = this._formatStatement(explanation);

        // Format the reasoning path
        let reasoning = "";
        if (explanation.derivationPath.length > 0) {
            const path = explanation.derivationPath[0];
            const template = this.explanationTemplates[path] || "{conclusion}";

            if (path === 'transitivity' && explanation.premises.length >= 2) {
                const premise1 = this._formatStatementFromId(explanation.premises[0]);
                const premise2 = this._formatStatementFromId(explanation.premises[1]);
                reasoning = template
                    .replace("{premise1}", premise1)
                    .replace("{premise2}", premise2)
                    .replace("{conclusion}", conclusion);
            } else if (path === 'induction' && explanation.premises.length >= 1) {
                const [term1, term2, predicate] = this._extractInductionTerms(explanation);
                reasoning = template
                    .replace("{term1}", term1)
                    .replace("{term2}", term2)
                    .replace("{predicate}", predicate);
            } else if (path === 'revision') {
                const oldTruth = this._getPreviousTruth(explanation.id);
                reasoning = template
                    .replace("{newTruth}", this._formatTruth(explanation.truth))
                    .replace("{oldTruth}", this._formatTruth(oldTruth));
            } else {
                reasoning = `Based on ${path} reasoning: ${conclusion}`;
            }
        }

        // Add supporting evidence
        let evidence = "";
        if (explanation.premises && explanation.premises.length > 0) {
            const premiseExplanations = explanation.premises
                .map(id => this._formatStatementFromId(id))
                .filter(text => text)
                .slice(0, 2); // Limit to 2 premises for clarity

            if (premiseExplanations.length > 0) {
                evidence = `
Supporting evidence:
- ${premiseExplanations.join('
                    - ')}`;
                }
    }
    
    return reasoning + evidence;
  }
  
  _formatExplanationWithConfidence(explanation) {
    if (!explanation) return "No explanation available";
    
    const baseExplanation = this._formatExplanation(explanation);
    const confidence = this._calculateExplanationConfidence(explanation);
    
    return `
                $
                {
                    baseExplanation
                }

                Confidence: $
                {
                    this._formatConfidence(confidence)
                }
                `;
  }
  
  _calculateExplanationConfidence(explanation) {
    if (!explanation) return 0;
    
    // Base confidence on truth value
    let confidence = explanation.truth.confidence;
    
    // Adjust based on derivation path
    if (explanation.derivationPath.length > 0) {
      const path = explanation.derivationPath[0];
      
      // Transitivity reduces confidence
      if (path === 'transitivity') {
        confidence *= 0.8;
      }
      // Induction has variable confidence
      else if (path === 'induction') {
        confidence *= 0.7;
      }
      // Direct beliefs have higher confidence
      else if (path === 'direct') {
        confidence = Math.min(1.0, confidence * 1.2);
      }
    }
    
    // Confidence can't exceed 1.0
    return Math.min(1.0, confidence);
  }
  
  _formatConfidence(confidence) {
    if (confidence >= 0.9) return `
                High($
                {
                    (confidence * 100).toFixed(0)
                }
            %)
                -Very
                reliable`;
    if (confidence >= 0.7) return `
                Medium - High($
                {
                    (confidence * 100).toFixed(0)
                }
            %)
                -Generally
                reliable`;
    if (confidence >= 0.5) return `
                Medium($
                {
                    (confidence * 100).toFixed(0)
                }
            %)
                -Somewhat
                reliable`;
    if (confidence >= 0.3) return `
                Low - Medium($
                {
                    (confidence * 100).toFixed(0)
                }
            %)
                -Questionable`;
    return `
                Low($
                {
                    (confidence * 100).toFixed(0)
                }
            %)
                -Unreliable`;
  }
  
  /* ===== UTILITY METHODS ===== */
  _formatStatement(explanation) {
    switch (explanation.type) {
      case 'Inheritance':
        return ` < $
                {
                    explanation.args[0]
                }
                -- > $
                {
                    explanation.args[1]
                }
            >
                `;
      case 'Similarity':
        return ` < $
                {
                    explanation.args[0]
                }
                <->
                $
                {
                    explanation.args[1]
                }
            >
                `;
      case 'Implication':
        return ` < $
                {
                    explanation.args[0]
                }
            ==>
                $
                {
                    explanation.args[1]
                }
            >
                `;
      default:
        return explanation.id;
    }
  }
  
  _formatStatementFromId(id) {
    const hyperedge = this.nar.hypergraph.get(id);
    if (!hyperedge) return null;
    
    return this._formatStatement({
      type: hyperedge.type,
      args: hyperedge.args
    });
  }
  
  _formatTruth(truth) {
    return `
                frequency: $
                {
                    truth.frequency.toFixed(2)
                }
            ,
                confidence: $
                {
                    truth.confidence.toFixed(2)
                }
                `;
  }
  
  _extractInductionTerms(explanation) {
    // For induction, we need two terms and a predicate
    if (explanation.type === 'Similarity') {
      return [explanation.args[0], explanation.args[1], null];
    }
    
    // For inheritance with induction path
    if (explanation.type === 'Inheritance' && explanation.premises.length > 0) {
      const premiseId = explanation.premises[0];
      const premise = this.nar.hypergraph.get(premiseId);
      if (premise && premise.type === 'Inheritance') {
        return [
          explanation.args[0],
          premise.args[0],
          explanation.args[1]
        ];
      }
    }
    
    return [null, null, null];
  }
  
  _getPreviousTruth(hyperedgeId) {
    // In a real system, this would retrieve the previous truth value
    // For demonstration, return a lower confidence version
    const hyperedge = this.nar.hypergraph.get(hyperedgeId);
    return hyperedge && hyperedge.beliefs.length > 1
      ? hyperedge.beliefs[1].truth
      : new TruthValue(
          hyperedge?.beliefs[0]?.truth.frequency || 0.5,
          (hyperedge?.beliefs[0]?.truth.confidence || 0.5) * 0.7,
          (hyperedge?.beliefs[0]?.truth.priority || 0.5) * 0.7
        );
  }
}
```

## 8. Integration of Explanation System

```javascript
// In NARHyper constructor
constructor(config = {}) {
  // ... existing initialization ...
  this.explanationSystem = new ExplanationSystem(this);
}

// Replace existing explain method
explain(hyperedgeId, depth = 3, withConfidence = false) {
  return withConfidence
    ? this.explanationSystem.explainWithConfidence(hyperedgeId, depth)
    : this.explanationSystem.explain(hyperedgeId, depth);
}

// Add a method for detailed explanation
explainDetailed(hyperedgeId, depth = 3) {
  const explanation = this.explanationSystem.explainWithConfidence(hyperedgeId, depth);
  const beliefTable = this.beliefTable(hyperedgeId);
  
  return `${explanation}

Detailed belief history:
${this._formatBeliefTable(beliefTable)}`;
}

_formatBeliefTable(beliefTable) {
  return beliefTable.map((belief, i) => 
    `#${i + 1}: freq=${belief.frequency}, conf=${belief.confidence}, ` +
    `priority=${belief.priority}, expectation=${belief.expectation}`
  ).join('\n');
}
```

These revisions significantly enhance the NARHyper implementation by:

1. Adding a comprehensive temporal reasoning system with interval algebra
2. Implementing advanced contradiction detection and resolution
3. Creating a meta-reasoning system for self-optimization under AIKR constraints
4. Adding adaptive learning capabilities that improve over time
5. Enhancing memory management with selective forgetting
6. Improving explanation generation with confidence metrics

The implementation remains true to the NARS principles while addressing the specific requirements outlined in the
knowledge base. It maintains the symbolic nature of NARS without relying on lossy embeddings, handles combinatorial
explosion through sophisticated resource management, and provides a practical, scalable system for real-world
applications.