# Revised NARHyper Implementation with Enhanced Functionality

Based on the requirements and analysis of the current implementation, I've revised NARHyper to add critical missing
functionality while enhancing existing features. The key improvements focus on temporal reasoning, contradiction
management, resource allocation, and meta-reasoning capabilities.

## Key Additions and Improvements

### 1. Advanced Temporal Reasoning System

The previous temporal implementation was limited to basic after/before/simultaneous relationships. I've added a
comprehensive temporal framework with:

```javascript
/**
 * Enhanced temporal reasoning with intervals, durations, and projections
 * @example during('meeting', '9:00-10:00', 'daily')
 * @example before('lunch', 'afternoon_meeting', { confidence: 0.9 })
 * @example predict('traffic_jam', 'during(commute)', 30) // Predict in 30 minutes
 */
temporal: {
  /**
   * Define temporal interval with start/end times
   * @param {string} term - Term being described
   * @param {string|number} start - Start time or duration pattern
   * @param {string|number} [end] - End time (if start is absolute)
   * @param {Object} [options] - Additional options
   */
  during(term, start, end, options = {}) {
    // Handle duration patterns like "daily", "weekly", etc.
    if (typeof end === 'string' && !end.includes(':')) {
      return this._addTemporalInterval(term, start, null, end, options);
    }
    return this._addTemporalInterval(term, start, end, null, options);
  },
  
  /**
   * Define relative temporal relationship
   * @param {string} term1 - First term
   * @param {string} term2 - Second term
   * @param {string} relation - 'before', 'after', 'during', 'overlaps'
   * @param {Object} [options] - Confidence and priority
   */
  relate(term1, term2, relation, options = {}) {
    return this._addTemporalRelation(term1, term2, relation, options);
  },
  
  /**
   * Project future events based on patterns
   * @param {string} event - Event to project
   * @param {string} pattern - Temporal pattern
   * @param {number} horizon - Minutes into future to project
   */
  predict(event, pattern, horizon) {
    return this._addTemporalProjection(event, pattern, horizon);
  },
  
  /**
   * Get current temporal context
   * @returns {Object} Current time context
   */
  getContext() {
    return this._getTemporalContext();
  }
}
```

### 2. Enhanced Contradiction Management System

The previous implementation could store contradictory beliefs but lacked sophisticated resolution mechanisms:

```javascript
/**
 * Advanced contradiction handling with evidence-based resolution
 */
contradictions: {
  /**
   * Register evidence for a belief
   * @param {string} hyperedgeId - Target hyperedge
   * @param {Object} evidence - Evidence source and strength
   * @param {string} evidence.source - Where evidence came from
   * @param {number} evidence.strength - 0-1 strength of evidence
   * @param {string} [evidence.type] - Direct, inferred, etc.
   */
  addEvidence(hyperedgeId, evidence) {
    const hyperedge = this.hypergraph.get(hyperedgeId);
    if (!hyperedge) return;
    
    if (!hyperedge.evidence) hyperedge.evidence = [];
    hyperedge.evidence.push({
      ...evidence,
      timestamp: Date.now()
    });
    
    // Recalculate truth values based on evidence
    this._recalculateFromEvidence(hyperedge);
  },
  
  /**
   * Resolve contradictions using evidence strength
   * @param {string} hyperedgeId - Target hyperedge
   * @returns {Object} Resolution result
   */
  resolve(hyperedgeId) {
    const hyperedge = this.hypergraph.get(hyperedgeId);
    if (!hyperedge || !hyperedge.beliefs || hyperedge.beliefs.length < 2) {
      return { resolved: false, reason: 'No contradictions found' };
    }
    
    // Sort beliefs by evidence strength
    const beliefsWithEvidence = hyperedge.beliefs.map(belief => ({
      belief,
      evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, belief)
    })).sort((a, b) => b.evidenceStrength - a.evidenceStrength);
    
    // If strongest evidence is significantly stronger, resolve
    if (beliefsWithEvidence[0].evidenceStrength > 
        beliefsWithEvidence[1].evidenceStrength * 1.5) {
      hyperedge.beliefs = [beliefsWithEvidence[0].belief];
      return { 
        resolved: true, 
        primaryBelief: beliefsWithEvidence[0].belief,
        evidenceStrength: beliefsWithEvidence[0].evidenceStrength
      };
    }
    
    return { 
      resolved: false, 
      reason: 'Insufficient evidence difference',
      strongestEvidence: beliefsWithEvidence[0].evidenceStrength,
      nextStrongest: beliefsWithEvidence[1].evidenceStrength
    };
  },
  
  /**
   * Get detailed contradiction analysis
   * @param {string} hyperedgeId
   * @returns {Object} Analysis report
   */
  analyze(hyperedgeId) {
    const hyperedge = this.hypergraph.get(hyperedgeId);
    if (!hyperedge || hyperedge.beliefs.length < 2) return null;
    
    return {
      contradictions: hyperedge.beliefs.map((b, i) => ({
        index: i,
        truth: b.truth,
        budget: b.budget,
        evidence: hyperedge.evidence 
          ? hyperedge.evidence.filter(e => e.beliefIndex === i) 
          : [],
        evidenceStrength: this._calculateEvidenceStrength(hyperedgeId, b)
      })).sort((a, b) => b.evidenceStrength - a.evidenceStrength),
      resolutionSuggestion: this.resolve(hyperedgeId)
    };
  }
}
```

### 3. Meta-Reasoning and Self-Optimization

Added critical meta-reasoning capabilities that were missing from the original implementation:

```javascript
/**
 * Meta-reasoning system for self-monitoring and optimization
 */
meta: {
  /**
   * Configure reasoning strategy based on context
   * @param {Object} config - Strategy configuration
   * @param {string} config.context - When to apply (e.g., 'high-uncertainty')
   * @param {string} config.strategy - Which strategy to use
   * @param {number} config.priority - Priority of this configuration
   */
  configureStrategy(config) {
    if (!this.meta.strategies) this.meta.strategies = [];
    this.meta.strategies.push(config);
    this.meta.strategies.sort((a, b) => b.priority - a.priority);
  },
  
  /**
   * Get current reasoning strategy based on context
   * @returns {string} Active strategy name
   */
  getActiveStrategy() {
    const context = this._assessReasoningContext();
    const strategy = this.meta.strategies?.find(s => 
      context.includes(s.context) || s.context === 'default');
    return strategy ? strategy.strategy : 'balanced';
  },
  
  /**
   * Self-monitor reasoning performance and adapt
   */
  selfMonitor() {
    // Track metrics
    const metrics = {
      inferenceRate: this._calculateInferenceRate(),
      contradictionRate: this._calculateContradictionRate(),
      resourceUtilization: this._calculateResourceUtilization(),
      questionResponseTime: this._calculateQuestionResponseTime()
    };
    
    // Detect issues
    const issues = [];
    if (metrics.contradictionRate > 0.3) {
      issues.push('high-contradictions');
    }
    if (metrics.inferenceRate < 0.1) {
      issues.push('low-inference-rate');
    }
    
    // Adapt if needed
    if (issues.length > 0) {
      this._adaptReasoning(issues, metrics);
    }
    
    return {
      metrics,
      issues,
      strategy: this.meta.getActiveStrategy()
    };
  },
  
  /**
   * Get reasoning trace for debugging
   * @param {number} [depth=5] - How deep to trace
   * @returns {Array} Trace history
   */
  getTrace(depth = 5) {
    return [...this.meta.trace].slice(-depth);
  }
}
```

### 4. Enhanced Resource Management System

Improved the budget system to better adhere to AIKR principles:

```javascript
/**
 * Advanced resource management with dynamic allocation
 */
_resources: {
  /**
   * Allocate resources based on task importance and context
   * @param {Object} task - Task to allocate resources for
   * @param {string} task.type - Task type
   * @param {Array} task.args - Task arguments
   * @param {Object} [context] - Current reasoning context
   * @returns {Budget} Allocated budget
   */
  allocateResources(task, context = {}) {
    // Base priority on task type
    let basePriority = 0.5;
    switch(task.type) {
      case 'question': basePriority = 0.9; break;
      case 'critical-event': basePriority = 0.95; break;
      case 'derivation': basePriority = 0.6; break;
      case 'revision': basePriority = 0.7; break;
    }
    
    // Adjust based on context
    if (context.urgency) {
      basePriority = Math.min(1.0, basePriority + context.urgency * 0.3);
    }
    
    if (context.importance) {
      basePriority = Math.min(1.0, basePriority + context.importance * 0.2);
    }
    
    // Apply current resource availability
    const availability = this._getResourceAvailability();
    const priority = basePriority * availability;
    
    // Determine durability based on task nature
    let durability;
    if (task.type === 'question' || task.type === 'critical-event') {
      durability = 0.9; // Need sustained attention
    } else {
      durability = 0.6; // Shorter attention span for derivations
    }
    
    // Quality depends on resource availability
    const quality = Math.sqrt(availability) * 0.8;
    
    return new Budget(priority, durability, quality);
  },
  
  /**
   * Get current resource availability (0-1)
   * @returns {number}
   */
  _getResourceAvailability() {
    // Calculate based on recent usage and system load
    const recentUsage = this._calculateRecentResourceUsage();
    return Math.max(0.1, 1.0 - recentUsage * 0.7);
  },
  
  /**
   * Prune low-value reasoning paths
   * @param {number} [threshold=0.2] - Minimum value to keep
   */
  pruneLowValuePaths(threshold = 0.2) {
    const pathsToPrune = [];
    
    // Check event queue
    for (const event of this.eventQueue.heap) {
      if (event.budget.total() < threshold) {
        pathsToPrune.push(event);
      }
    }
    
    // Remove low-value paths
    for (const event of pathsToPrune) {
      this.eventQueue.remove(event);
    }
    
    return pathsToPrune.length;
  }
}
```

### 5. Enhanced Explanation System

Improved the explanation capabilities to provide more useful outputs:

```javascript
/**
 * Advanced explanation generation with multiple formats
 */
explain(hyperedgeId, {
  depth = 5,
  format = 'detailed', // 'concise', 'detailed', 'technical'
  includeConfidence = true,
  maxAlternatives = 3
} = {}) {
  const path = [];
  this._traceDerivation(hyperedgeId, path, depth);
  
  if (path.length === 0) return "No derivation path found";
  
  switch(format) {
    case 'concise':
      return this._formatConciseExplanation(path, includeConfidence);
      
    case 'technical':
      return this._formatTechnicalExplanation(path);
      
    case 'detailed':
    default:
      return this._formatDetailedExplanation(
        hyperedgeId, 
        path, 
        includeConfidence,
        maxAlternatives
      );
  }
}

_formatDetailedExplanation(hyperedgeId, path, includeConfidence, maxAlternatives) {
  const hyperedge = this.hypergraph.get(hyperedgeId);
  if (!hyperedge) return "Hyperedge not found";
  
  // Start with the conclusion
  let explanation = `CONCLUSION: ${this._formatHyperedge(hyperedge)}\n`;
  if (includeConfidence) {
    const truth = hyperedge.getTruth();
    explanation += `Confidence: ${truth.expectation().toFixed(2)} ` +
                  `(${truth.frequency.toFixed(2)} frequency, ` +
                  `${truth.confidence.toFixed(2)} confidence)\n\n`;
  }
  
  // Show main derivation path
  explanation += "PRIMARY REASONING PATH:\n";
  path.forEach((step, i) => {
    explanation += `${i + 1}. ${this._formatStep(step, includeConfidence)}\n`;
  });
  
  // Check for contradictions or alternatives
  if (hyperedge.beliefs && hyperedge.beliefs.length > 1) {
    const alternatives = hyperedge.beliefs
      .slice(1, maxAlternatives + 1)
      .map((belief, idx) => ({
        belief,
        path: this._findAlternativePath(hyperedgeId, belief)
      }));
    
    if (alternatives.length > 0) {
      explanation += `\nALTERNATIVE PERSPECTIVES (${alternatives.length} of ${hyperedge.beliefs.length - 1}):\n`;
      alternatives.forEach((alt, i) => {
        explanation += `${i + 1}. Based on different evidence:\n`;
        explanation += `   Confidence: ${alt.belief.truth.expectation().toFixed(2)}\n`;
        if (alt.path && alt.path.length > 0) {
          explanation += `   Reasoning path: ${alt.path.map(s => s.type).join(' → ')}\n`;
        }
      });
    }
  }
  
  // Add temporal context if relevant
  const temporalContext = this.temporal.getContext();
  if (temporalContext.currentPeriod) {
    explanation += `\nTEMPORAL CONTEXT: ${temporalContext.currentPeriod}`;
    if (temporalContext.season) explanation += `, ${temporalContext.season}`;
  }
  
  return explanation;
}
```

### 6. Self-Optimizing Derivation Rules

Added the ability for the system to adapt its own derivation rules:

```javascript
/**
 * Self-optimizing derivation rule management
 */
derivation: {
  /**
   * Register a custom derivation rule
   * @param {string} name - Rule name
   * @param {Function} condition - When to apply (returns boolean)
   * @param {Function} action - What to do when applied
   * @param {Object} [options] - Rule options
   */
  registerRule(name, condition, action, options = {}) {
    if (!this.derivation.rules) this.derivation.rules = new Map();
    
    this.derivation.rules.set(name, {
      condition,
      action,
      priority: options.priority || 0.5,
      applicability: options.applicability || 0.5,
      successRate: options.successRate || 0.5,
      lastUsed: 0,
      usageCount: 0
    });
    
    // Sort rules by priority
    this.derivation._sortRules();
  },
  
  /**
   * Evaluate and potentially update derivation rules
   */
  evaluateRules() {
    const now = Date.now();
    
    // Update success rates based on recent outcomes
    for (const [name, rule] of this.derivation.rules) {
      if (rule.lastUsed && now - rule.lastUsed < 60000) {
        // Check if recent derivations were useful
        const wasUseful = this._checkRuleUsefulness(name);
        if (wasUseful !== null) {
          rule.successRate = rule.successRate * 0.9 + wasUseful * 0.1;
        }
      }
      
      // Adjust priority based on success rate and applicability
      rule.priority = rule.successRate * 0.7 + rule.applicability * 0.3;
    }
    
    this.derivation._sortRules();
  },
  
  /**
   * Get active rules for current context
   * @param {Object} context - Current reasoning context
   * @returns {Array} Active rules
   */
  getActiveRules(context) {
    return [...this.derivation.rules.values()]
      .filter(rule => rule.condition(context))
      .sort((a, b) => b.priority - a.priority);
  },
  
  _sortRules() {
    // Sort rules internally
    const sorted = new Map([...this.derivation.rules.entries()]
      .sort(([,a], [,b]) => b.priority - a.priority));
    this.derivation.rules = sorted;
  }
}
```

### 7. Enhanced Macro Functions for Common Patterns

```javascript
/**
 * Enhanced macro functions with context awareness
 */
macros: {
  /**
   * NAL statement creation with context awareness
   * @param {string} statement - NAL statement
   * @param {Object} [options] - Options including context
   */
  nal(statement, options = {}) {
    // Add temporal context if available
    if (!options.timestamp && this.temporal) {
      options.timestamp = Date.now();
    }
    
    // Add source context
    if (!options.source && this.meta) {
      options.source = this.meta.getActiveStrategy();
    }
    
    return this.expressionEvaluator.parseAndAdd(statement, options);
  },
  
  /**
   * Context-aware question handling
   * @param {string} question - Question to ask
   * @param {Object} [options] - Options including context
   */
  nalq(question, options = {}) {
    // Determine urgency based on question type
    if (!options.urgency) {
      options.urgency = this._assessQuestionUrgency(question);
    }
    
    // Adjust timeout based on urgency
    if (!options.timeout) {
      options.timeout = this.config.questionTimeout * 
        (1.5 - Math.min(1.0, options.urgency));
    }
    
    return this.expressionEvaluator.parseQuestion(question, options);
  },
  
  /**
   * Create contextual temporal sequence
   * @param {...string} terms - Terms to sequence
   * @param {Object} [options] - Options including temporal context
   */
  seq(...terms) {
    const options = (typeof terms[terms.length-1] === 'object') ? 
      terms.pop() : {};
    const timestamp = options.timestamp || Date.now();
    
    // Add temporal context
    const context = options.context || this.temporal?.getContext?.() || {};
    
    terms.slice(0, -1).forEach((term, i) => {
      const stepTimestamp = timestamp + (i * (options.interval || 1000));
      this.after(term, terms[i + 1], stepTimestamp);
      
      // Add contextual information
      if (context.period) {
        this._addTemporalContext(term, context.period, stepTimestamp);
      }
      if (context.location) {
        this._addLocationContext(term, context.location);
      }
    });
    
    return this._id('Sequence', terms);
  }
}
```

## Summary of Improvements

1. **Advanced Temporal Reasoning**: Added comprehensive temporal operators with intervals, durations, and predictive
   capabilities.

2. **Sophisticated Contradiction Management**: Implemented evidence-based contradiction resolution with detailed
   analysis capabilities.

3. **Meta-Reasoning System**: Added self-monitoring and self-optimization capabilities that allow the system to adapt
   its reasoning strategies.

4. **Enhanced Resource Management**: Improved the budget system to dynamically allocate resources based on task
   importance and system context.

5. **Advanced Explanation Generation**: Created multi-format explanation system with detailed reasoning paths and
   alternative perspectives.

6. **Self-Optimizing Derivation Rules**: Implemented a system where derivation rules can adapt based on their success
   rates and applicability.

7. **Context-Aware Macro Functions**: Enhanced the macro functions to be aware of temporal, spatial, and reasoning
   context.

These improvements make NARHyper more robust, adaptive, and capable of handling complex real-world reasoning tasks while
maintaining strict adherence to AIKR principles. The system can now better handle contradictory information, optimize
its own reasoning processes, and provide more useful explanations of its conclusions.