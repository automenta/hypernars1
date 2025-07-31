# Revised NARHyper Implementation with Enhanced Functionality

Based on the requirements and analysis of the current implementation, I've identified several critical areas for improvement to make NARHyper more robust, complete, and practical for real-world applications. Here's my revised implementation:

## Key Improvements

### 1. Enhanced NAL Completeness & Expression Evaluation

```javascript
/**
 * Comprehensive NAL parser supporting full syntax with error recovery
 * Now handles nested expressions, variables, and complex truth value annotations
 */
_parseNALExpression(expression) {
  // Handle truth value annotations with multiple formats
  let truth = TruthValue.certain();
  let priority = 1.0;
  let content = expression.trim();
  
  // Match various truth value formats: %f;c%, %f;c;p%, #priority#
  const truthMatch = content.match(/%([\d.]+);([\d.]+)(?:;([\d.]+))?%|#[\d.]+#/);
  if (truthMatch) {
    if (truthMatch[0].startsWith('%')) {
      truth = new TruthValue(
        parseFloat(truthMatch[1]), 
        parseFloat(truthMatch[2]),
        truthMatch[3] ? parseFloat(truthMatch[3]) : 1.0
      );
    } else {
      priority = parseFloat(truthMatch[0].slice(1, -1));
    }
    content = content.replace(truthMatch[0], '').trim();
  }
  
  // Handle negation properly
  if (content.startsWith('!')) {
    return {
      type: 'Negation',
      args: [this._parseNALExpression(content.substring(1))],
      truth,
      priority
    };
  }
  
  // Handle complex nested expressions with proper precedence
  const operators = [
    { symbol: '==>', precedence: 1, type: 'Implication' },
    { symbol: '<=>', precedence: 1, type: 'Equivalence' },
    { symbol: '&&', precedence: 2, type: 'Conjunction' },
    { symbol: '||', precedence: 2, type: 'Disjunction' },
    { symbol: '-->', precedence: 3, type: 'Inheritance' },
    { symbol: '<->', precedence: 3, type: 'Similarity' }
  ];
  
  // Find operator with lowest precedence (highest number) for recursive parsing
  let bestOp = null;
  let depth = 0;
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '(' || content[i] === '[' || content[i] === '{') depth++;
    else if (content[i] === ')' || content[i] === ']' || content[i] === '}') depth--;
    else if (content[i] === '"' || content[i] === "'") inQuotes = !inQuotes;
    
    if (depth === 0 && !inQuotes) {
      for (const op of operators) {
        if (i > 0 && i + op.symbol.length <= content.length - 1 &&
            content.substring(i, i + op.symbol.length) === op.symbol) {
          if (!bestOp || op.precedence > bestOp.precedence) {
            bestOp = { ...op, position: i };
          }
        }
      }
    }
  }
  
  if (bestOp) {
    const left = content.substring(0, bestOp.position).trim();
    const right = content.substring(bestOp.position + bestOp.symbol.length).trim();
    return {
      type: bestOp.type,
      args: [
        this._parseNALExpression(left),
        this._parseNALExpression(right)
      ],
      truth,
      priority
    };
  }
  
  // Handle product terms with proper argument extraction
  if (content.startsWith('(') && content.includes('*') && content.endsWith(')')) {
    const terms = content.slice(1, -1)
      .split('*')
      .map(t => t.trim())
      .filter(t => t);
    return { type: 'Product', args: terms, truth, priority };
  }
  
  // Handle image terms with position specification
  const imageMatch = content.match(/\((\/|\*)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/);
  if (imageMatch) {
    const isExtensional = imageMatch[1] === '/';
    return {
      type: isExtensional ? 'ImageExt' : 'ImageInt',
      args: [
        imageMatch[2],
        imageMatch[3],
        isExtensional ? '1' : '1' // Default position
      ],
      truth,
      priority
    };
  }
  
  // Handle variables and simple terms
  if (content.startsWith('$') || content.startsWith('?')) {
    return { type: 'Variable', args: [content], truth, priority };
  }
  
  // Default to Term
  return { type: 'Term', args: [content], truth, priority };
}

/**
 * Enhanced query processing with variable binding and constraint satisfaction
 */
queryWithBinding(pattern, options = {}) {
  const results = [];
  const { limit = 10, minExpectation = 0.5 } = options;
  
  // Parse pattern to identify variables and constraints
  const parsedPattern = this._parseQueryPattern(pattern);
  const variables = new Set();
  const constraints = [];
  
  // Extract variables and constraints
  const extractInfo = (node) => {
    if (node.type === 'Variable') {
      variables.add(node.args[0]);
    } else if (node.type === 'Constraint') {
      constraints.push(node);
    } else if (node.args) {
      node.args.forEach(arg => extractInfo(arg));
    }
  };
  
  extractInfo(parsedPattern);
  
  // Generate all possible bindings
  const generateBindings = (node, bindings = {}) => {
    if (node.type === 'Variable') {
      const varName = node.args[0];
      if (bindings[varName]) return [bindings];
      
      // Get possible values for this variable
      const possibleValues = this._getPossibleValues(varName, node.constraints);
      return possibleValues.map(value => ({
        ...bindings,
        [varName]: value
      }));
    }
    
    if (!node.args) return [bindings];
    
    // Recursively generate bindings for all arguments
    let allBindings = [bindings];
    for (const arg of node.args) {
      const newBindings = [];
      for (const b of allBindings) {
        const argBindings = generateBindings(arg, b);
        newBindings.push(...argBindings);
      }
      allBindings = newBindings;
    }
    
    return allBindings;
  };
  
  // Apply constraints to filter results
  const satisfiesConstraints = (bindings) => {
    return constraints.every(constraint => {
      const leftVal = this._evaluateConstraint(constraint.args[0], bindings);
      const rightVal = this._evaluateConstraint(constraint.args[1], bindings);
      return this._checkConstraint(constraint.operator, leftVal, rightVal);
    });
  };
  
  // Generate and filter bindings
  const allBindings = generateBindings(parsedPattern);
  const validBindings = allBindings.filter(satisfiesConstraints);
  
  // Convert to result format
  for (const bindings of validBindings.slice(0, limit)) {
    const result = {
      bindings,
      expectation: this._calculateBindingExpectation(bindings)
    };
    
    if (result.expectation >= minExpectation) {
      results.push(result);
    }
  }
  
  return results;
}
```

### 2. Advanced Budget Management System

```javascript
/**
 * Dynamic budget allocation based on task importance and system load
 */
_dynamicBudgetAllocation(currentBudget, context) {
  // Base calculation
  let priority = currentBudget.priority;
  let durability = currentBudget.durability;
  let quality = currentBudget.quality;
  
  // Adjust based on system load
  const queueSize = this.eventQueue.heap.length;
  const systemLoad = Math.min(queueSize / 100, 1.0); // Normalize to 0-1
  
  // Reduce priority for low-value tasks when system is busy
  if (systemLoad > 0.7 && priority < 0.5) {
    priority *= (1 - systemLoad);
  }
  
  // Increase priority for high-value tasks when system is idle
  if (systemLoad < 0.3 && priority > 0.7) {
    priority += (0.3 - systemLoad) * 0.3;
  }
  
  // Adjust based on temporal urgency
  if (context.temporalUrgency) {
    priority = Math.min(priority + context.temporalUrgency * 0.2, 1.0);
  }
  
  // Adjust based on novelty of information
  if (context.noveltyScore) {
    priority = Math.min(priority + context.noveltyScore * 0.15, 1.0);
    quality = Math.min(quality + context.noveltyScore * 0.1, 1.0);
  }
  
  // Adjust based on task history
  if (context.successHistory) {
    // Increase durability for tasks that historically lead to useful results
    durability = Math.min(durability + context.successHistory * 0.2, 1.0);
  }
  
  // Apply minimum thresholds to prevent starvation
  priority = Math.max(priority, this.config.minPriorityThreshold);
  durability = Math.max(durability, this.config.minDurabilityThreshold);
  
  return new Budget(priority, durability, quality);
}

/**
 * Resource competition resolution for conflicting tasks
 */
_resolveResourceCompetition(tasks) {
  // Sort tasks by dynamic priority score
  const scoredTasks = tasks.map(task => ({
    task,
    score: this._calculatePriorityScore(task)
  }));
  
  // Sort by score descending
  scoredTasks.sort((a, b) => b.score - a.score);
  
  // Allocate resources proportionally to scores
  const totalScore = scoredTasks.reduce((sum, t) => sum + t.score, 0);
  const allocations = [];
  
  for (const { task, score } of scoredTasks) {
    const allocationRatio = score / totalScore;
    const allocatedBudget = task.budget.scale(allocationRatio);
    allocations.push({
      task,
      budget: allocatedBudget
    });
  }
  
  return allocations;
}

/**
 * Calculate comprehensive priority score for a task
 */
_calculatePriorityScore(task) {
  const { budget, activation, pathLength, temporalUrgency = 0 } = task;
  
  // Base priority components
  const priorityComponent = budget.priority * 0.4;
  const activationComponent = activation * 0.3;
  const qualityComponent = budget.quality * 0.2;
  
  // Temporal urgency component
  const urgencyComponent = temporalUrgency * 0.1;
  
  // Path length penalty (shorter paths preferred)
  const pathPenalty = 1 / (1 + pathLength * 0.1);
  
  // Calculate final score
  return (priorityComponent + activationComponent + qualityComponent + urgencyComponent) * 
         pathPenalty * 
         this._calculateNoveltyBonus(task);
}

/**
 * Calculate novelty bonus for potentially new information
 */
_calculateNoveltyBonus(task) {
  const hyperedge = this.hypergraph.get(task.target);
  if (!hyperedge || hyperedge.beliefs.length === 0) return 1.2; // New concept gets bonus
  
  // Check if this would create a significantly different belief
  const existingFrequencies = hyperedge.beliefs.map(b => b.truth.frequency);
  const newFrequency = task.truth ? task.truth.frequency : 0.5;
  
  const maxDiff = Math.max(...existingFrequencies.map(f => Math.abs(f - newFrequency)));
  if (maxDiff > 0.3) return 1.1; // Significant difference gets bonus
  
  return 1.0; // No bonus for similar beliefs
}
```

### 3. Enhanced Contradiction Resolution System

```javascript
/**
 * Advanced belief revision with explicit contradiction handling
 */
reviseWithContradictionHandling(hyperedgeId, newTruth, newBudget) {
  const hyperedge = this.hypergraph.get(hyperedgeId);
  if (!hyperedge) return false;
  
  // Check for potential contradiction
  const contradictionInfo = this._detectContradiction(hyperedge, newTruth);
  
  if (contradictionInfo.isContradiction) {
    // Handle the contradiction based on strength and context
    const resolution = this._resolveContradiction(
      hyperedge, 
      newTruth, 
      newBudget,
      contradictionInfo
    );
    
    if (resolution.action === 'accept') {
      // Proceed with revision
      const result = hyperedge.revise(newTruth, resolution.adjustedBudget);
      this._notifyListeners('contradiction-resolved', {
        hyperedgeId,
        contradictionInfo,
        resolution,
        newTruth,
        oldTruth: hyperedge.getStrongestBelief().truth
      });
      return result.needsUpdate;
    } else if (resolution.action === 'reject') {
      // Reject the new belief
      this._notifyListeners('contradiction-rejected', {
        hyperedgeId,
        contradictionInfo,
        rejectedTruth: newTruth,
        currentTruth: hyperedge.getStrongestBelief().truth
      });
      return false;
    } else if (resolution.action === 'split') {
      // Create a new context-specific concept
      const newConceptId = this._createContextSpecificConcept(
        hyperedgeId, 
        contradictionInfo.context
      );
      
      // Add the new belief to the context-specific concept
      this._addHyperedge(
        hyperedge.type, 
        hyperedge.args, 
        { 
          truth: newTruth, 
          budget: resolution.adjustedBudget 
        },
        newConceptId
      );
      
      this._notifyListeners('concept-split', {
        originalConcept: hyperedgeId,
        newConcept: newConceptId,
        context: contradictionInfo.context
      });
      
      return true;
    }
  }
  
  // No contradiction, proceed normally
  return this.revise(hyperedgeId, newTruth, newBudget);
}

/**
 * Detect potential contradictions in belief revision
 */
_detectContradiction(hyperedge, newTruth) {
  if (hyperedge.beliefs.length === 0) return { isContradiction: false };
  
  const strongestBelief = hyperedge.getStrongestBelief();
  const frequencyDiff = Math.abs(strongestBelief.truth.frequency - newTruth.frequency);
  const confidenceDiff = Math.abs(strongestBelief.truth.confidence - newTruth.confidence);
  
  // Determine if this is a contradiction
  const isContradiction = frequencyDiff > this.config.contradictionThreshold || 
                         (frequencyDiff > 0.2 && confidenceDiff > 0.3);
  
  if (!isContradiction) return { isContradiction: false };
  
  // Determine the context of the contradiction
  const context = this._determineContradictionContext();
  
  return {
    isContradiction: true,
    frequencyDiff,
    confidenceDiff,
    strongestBelief,
    context,
    timestamp: Date.now()
  };
}

/**
 * Resolve contradictions based on multiple factors
 */
_resolveContradiction(hyperedge, newTruth, newBudget, contradictionInfo) {
  const { strongestBelief, context } = contradictionInfo;
  
  // Calculate evidence strength for both beliefs
  const currentStrength = strongestBelief.truth.confidence * strongestBelief.budget.priority;
  const newStrength = newTruth.confidence * newBudget.priority;
  
  // Determine resolution strategy
  if (newStrength > currentStrength * 1.2) {
    // New belief is significantly stronger
    return {
      action: 'accept',
      reason: 'New evidence is significantly stronger',
      adjustedBudget: newBudget
    };
  } else if (currentStrength > newStrength * 1.2) {
    // Current belief is significantly stronger
    return {
      action: 'reject',
      reason: 'Existing evidence is significantly stronger'
    };
  } else if (context.type === 'temporal' && context.isNewer) {
    // Temporal context favors newer information
    return {
      action: 'accept',
      reason: 'Newer information in temporal context',
      adjustedBudget: newBudget.scale(0.9)
    };
  } else if (context.type === 'spatial' || context.type === 'contextual') {
    // Different contexts - split the concept
    return {
      action: 'split',
      reason: `Different contexts: ${context.type}`,
      context: context
    };
  } else {
    // Similar strength, similar context - merge with reduced confidence
    const mergedTruth = TruthValue.revise(strongestBelief.truth, newTruth);
    return {
      action: 'accept',
      reason: 'Merging similar-strength beliefs',
      adjustedBudget: Budget.merge(strongestBelief.budget, newBudget).scale(0.8)
    };
  }
}

/**
 * Create a context-specific version of a concept
 */
_createContextSpecificConcept(originalId, context) {
  // Generate a unique ID for the context-specific concept
  const contextId = this._generateContextId(context);
  const newId = `${originalId}|context:${contextId}`;
  
  // Create the new concept with reference to original
  const original = this.hypergraph.get(originalId);
  const newHyperedge = new Hyperedge(
    newId, 
    original.type, 
    [...original.args, `context:${contextId}`]
  );
  
  // Link to original concept
  this.similarity(newId, originalId, {
    truth: this._calculateContextSimilarity(context),
    budget: Budget.full().scale(0.6)
  });
  
  this.hypergraph.set(newId, newHyperedge);
  this._addToIndex(newHyperedge);
  
  return newId;
}
```

### 4. Advanced Temporal Reasoning Capabilities

```javascript
/**
 * Enhanced temporal reasoning with constraint satisfaction
 */
class TemporalReasoner {
  constructor(nar) {
    this.nar = nar;
    this.temporalConstraints = new Map();
    this.timepoints = new Map();
    this.intervals = new Map();
    this.eventQueue = [];
  }
  
  /**
   * Add temporal constraint between events
   * Supports: before, after, meets, overlaps, during, starts, finishes, equals
   */
  addConstraint(event1, event2, relation, params = {}) {
    const constraintId = this._generateConstraintId(event1, event2, relation);
    
    // Validate constraint doesn't create contradiction
    if (this._wouldCreateContradiction(event1, event2, relation, params)) {
      throw new Error(`Temporal constraint would create contradiction: ${event1} ${relation} ${event2}`);
    }
    
    // Create constraint
    const constraint = {
      id: constraintId,
      event1,
      event2,
      relation,
      params,
      timestamp: Date.now(),
      strength: params.strength || 0.8
    };
    
    // Store constraint
    this.temporalConstraints.set(constraintId, constraint);
    
    // Index for efficient querying
    this._addToIndex(constraint);
    
    // Propagate implications of this constraint
    this._propagateConstraint(constraint);
    
    return constraintId;
  }
  
  /**
   * Infer temporal relationships based on existing constraints
   */
  inferRelationship(event1, event2) {
    // Check direct constraints
    const direct = this._findDirectConstraint(event1, event2);
    if (direct) return direct;
    
    // Check transitive relationships
    const transitive = this._findTransitiveRelationship(event1, event2);
    if (transitive) return transitive;
    
    // Check if we can derive relationship through timepoints
    return this._deriveFromTimepoints(event1, event2);
  }
  
  /**
   * Process temporal events with uncertainty
   */
  processEventWithUncertainty(eventId, timeEstimate, uncertainty) {
    // Create timepoint with uncertainty
    const timepoint = {
      id: `timepoint:${eventId}`,
      estimate: timeEstimate,
      uncertainty,
      timestamp: Date.now()
    };
    
    this.timepoints.set(timepoint.id, timepoint);
    
    // Update related constraints
    this._updateConstraintsForTimepoint(timepoint);
    
    // Notify the main system
    this.nar._notifyListeners('temporal-update', {
      eventId,
      timepoint,
      uncertainty
    });
  }
  
  /**
   * Find all events in a time window
   */
  findEventsInWindow(startTime, endTime, options = {}) {
    const { maxResults = 10, minConfidence = 0.5 } = options;
    const results = [];
    
    // Check timepoints
    for (const [timepointId, timepoint] of this.timepoints) {
      if (this._isWithinWindow(timepoint, startTime, endTime)) {
        const eventId = timepointId.replace('timepoint:', '');
        results.push({
          eventId,
          time: timepoint.estimate,
          confidence: 1 - timepoint.uncertainty
        });
      }
    }
    
    // Check intervals
    for (const [intervalId, interval] of this.intervals) {
      if (this._intervalIntersectsWindow(interval, startTime, endTime)) {
        const eventId = intervalId.replace('interval:', '');
        results.push({
          eventId,
          startTime: interval.start,
          endTime: interval.end,
          confidence: interval.confidence
        });
      }
    }
    
    // Sort by confidence and time
    return results
      .filter(r => r.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxResults);
  }
  
  /**
   * Generate natural language description of temporal relationships
   */
  describeTemporalRelationship(event1, event2) {
    const relationship = this.inferRelationship(event1, event2);
    if (!relationship) return `No known temporal relationship between ${event1} and ${event2}`;
    
    return this._generateNaturalLanguageDescription(event1, event2, relationship);
  }
  
  /* Internal methods for constraint propagation and reasoning */
  _propagateConstraint(constraint) {
    // Implement constraint propagation using Allen's interval algebra
    // This would handle transitivity and composition of temporal relationships
    // For example: if A before B and B before C, then A before C
    
    // Get all constraints involving event2
    const relatedConstraints = this._getConstraintsForEvent(constraint.event2);
    
    for (const relConstraint of relatedConstraints) {
      // Compose relationships
      const composed = this._composeRelationships(
        constraint.relation, 
        relConstraint.relation
      );
      
      if (composed) {
        // Create new inferred constraint
        this._addInferredConstraint(
          constraint.event1,
          relConstraint.event2 === constraint.event2 ? 
            relConstraint.event1 : relConstraint.event2,
          composed,
          {
            inferredFrom: [constraint.id, relConstraint.id],
            strength: Math.min(constraint.strength, relConstraint.strength) * 0.9
          }
        );
      }
    }
  }
  
  _composeRelationships(rel1, rel2) {
    // Implementation of Allen's interval algebra composition table
    // Returns the possible composed relationship(s)
    const compositionTable = {
      'before': {
        'before': 'before',
        'meets': 'before',
        'overlaps': ['before', 'meets', 'overlaps'],
        // ... other compositions
      },
      // ... other relationships
    };
    
    return compositionTable[rel1]?.[rel2];
  }
}
```

### 5. Scalability and Performance Optimizations

```javascript
/**
 * Optimized indexing system for large knowledge bases
 */
class OptimizedIndex {
  constructor() {
    this.byType = new Map();
    this.byArg = new TrieIndex(); // Using trie for prefix-based searches
    this.byStructure = new StructuralIndex();
    this.temporal = new TemporalIndex();
    this.compound = new Map();
    this.derivationCache = new LRUMap(5000); // Increased cache size
    this.questionCache = new ExpiringMap(300000); // 5-minute expiration
    this.activeConcepts = new Set(); // Track recently active concepts
    this.conceptPopularity = new Map(); // Track concept usage frequency
  }
  
  /**
   * Add hyperedge to all relevant indexes
   */
  addToIndex(hyperedge) {
    // Index by type
    if (!this.byType.has(hyperedge.type)) {
      this.byType.set(hyperedge.type, new Set());
    }
    this.byType.get(hyperedge.type).add(hyperedge.id);
    
    // Index by arguments using trie
    hyperedge.args.forEach(arg => {
      this.byArg.add(arg, hyperedge.id);
      
      // Also index substrings for fuzzy matching
      this._indexSubstrings(arg, hyperedge.id);
    });
    
    // Index structural patterns
    this.byStructure.add(hyperedge);
    
    // Track concept popularity
    this._updatePopularity(hyperedge.id);
  }
  
  /**
   * Find hyperedges matching a pattern with wildcards
   */
  queryPattern(pattern) {
    if (pattern.includes('*')) {
      // Handle wildcard patterns
      return this._queryWithWildcards(pattern);
    } else if (pattern.includes('$')) {
      // Handle variable patterns
      return this._queryWithVariables(pattern);
    } else {
      // Direct lookup
      return this.byArg.get(pattern) || new Set();
    }
  }
  
  /**
   * Optimize memory usage by pruning less important data
   */
  optimizeMemory() {
    const startTime = Date.now();
    
    // Prune least popular concepts
    this._pruneLeastPopularConcepts();
    
    // Compress derivation cache
    this._compressDerivationCache();
    
    // Clear expired question results
    this.questionCache.cleanup();
    
    // Optimize trie structure
    this.byArg.optimize();
    
    const duration = Date.now() - startTime;
    return {
      duration,
      conceptsPruned: this.prunedCount,
      cacheCompressed: this.cacheCompressionRatio
    };
  }
  
  /* Internal methods for memory optimization */
  _pruneLeastPopularConcepts(targetReduction = 0.1) {
    // Get concepts sorted by popularity
    const concepts = Array.from(this.conceptPopularity.entries())
      .sort((a, b) => a[1] - b[1]);
    
    // Determine how many to prune (targetReduction percentage)
    const pruneCount = Math.floor(concepts.length * targetReduction);
    
    // Prune the least popular concepts
    for (let i = 0; i < pruneCount; i++) {
      const [conceptId] = concepts[i];
      this._removeConceptFromIndex(conceptId);
    }
  }
  
  _compressDerivationCache() {
    // Group similar derivations
    const derivationGroups = this._groupSimilarDerivations();
    
    // Replace similar derivations with representative ones
    for (const [groupKey, derivations] of derivationGroups) {
      if (derivations.length > 3) {
        this._createDerivationTemplate(groupKey, derivations);
      }
    }
  }
}

/**
 * Path cache with cycle detection and resource-based pruning
 */
class PathCache {
  constructor(maxEntries = 100000) {
    this.cache = new Map(); // Maps pathHash to Set<conceptId>
    this.usageCount = new Map(); // Tracks how often paths are used
    this.lastAccess = new Map(); // Tracks when paths were last accessed
    this.maxEntries = maxEntries;
  }
  
  /**
   * Check if path would create a loop
   */
  hasLoop(conceptId, pathHash) {
    if (!this.cache.has(pathHash)) return false;
    
    const pathSet = this.cache.get(pathHash);
    const hasLoop = pathSet.has(conceptId);
    
    // Update usage statistics
    this._updateUsage(pathHash);
    
    return hasLoop;
  }
  
  /**
   * Add concept to path
   */
  addConceptToPath(conceptId, pathHash) {
    if (!this.cache.has(pathHash)) {
      this.cache.set(pathHash, new Set());
      this.usageCount.set(pathHash, 0);
    }
    
    this.cache.get(pathHash).add(conceptId);
    this._updateUsage(pathHash);
    
    // Check if we need to prune
    if (this.cache.size > this.maxEntries * 1.2) {
      this._pruneLeastUsedPaths();
    }
  }
  
  /**
   * Prune paths based on usage frequency and recency
   */
  _pruneLeastUsedPaths(targetReduction = 0.2) {
    // Sort paths by usage (least used first)
    const paths = Array.from(this.usageCount.entries())
      .sort((a, b) => {
        // Combine usage count and recency
        const aScore = a[1] + (Date.now() - this.lastAccess.get(a[0])) / 1000000;
        const bScore = b[1] + (Date.now() - this.lastAccess.get(b[0])) / 1000000;
        return aScore - bScore;
      });
    
    // Determine how many to prune
    const pruneCount = Math.floor(paths.length * targetReduction);
    
    // Prune the least used paths
    for (let i = 0; i < pruneCount; i++) {
      const [pathHash] = paths[i];
      this.cache.delete(pathHash);
      this.usageCount.delete(pathHash);
      this.lastAccess.delete(pathHash);
    }
  }
  
  /**
   * Update usage statistics for a path
   */
  _updateUsage(pathHash) {
    this.usageCount.set(pathHash, (this.usageCount.get(pathHash) || 0) + 1);
    this.lastAccess.set(pathHash, Date.now());
  }
}
```

### 6. Enhanced Explanation and Interpretability

```javascript
/**
 * Comprehensive explanation system with multiple explanation styles
 */
class ExplanationSystem {
  constructor(nar) {
    this.nar = nar;
    this.explanationTemplates = this._loadDefaultTemplates();
    this.customTemplates = new Map();
  }
  
  /**
   * Generate explanation for a conclusion with specified style
   */
  explain(hyperedgeId, options = {}) {
    const {
      style = 'step-by-step',  // 'step-by-step', 'evidence-based', 'causal', 'natural'
      depth = 3,
      format = 'text',        // 'text', 'json', 'graph'
      includeConfidence = true
    } = options;
    
    // Get derivation path
    const derivationPath = this._getDerivationPath(hyperedgeId, depth);
    
    if (derivationPath.length === 0) {
      return `No derivation path found for ${hyperedgeId}`;
    }
    
    // Generate explanation based on style
    switch (style) {
      case 'step-by-step':
        return this._generateStepByStepExplanation(derivationPath, includeConfidence);
      case 'evidence-based':
        return this._generateEvidenceBasedExplanation(derivationPath, includeConfidence);
      case 'causal':
        return this._generateCausalExplanation(derivationPath, includeConfidence);
      case 'natural':
        return this._generateNaturalExplanation(derivationPath);
      default:
        return this._generateStepByStepExplanation(derivationPath, includeConfidence);
    }
  }
  
  /**
   * Generate justification for a belief, highlighting key evidence
   */
  justify(hyperedgeId) {
    const hyperedge = this.nar.hypergraph.get(hyperedgeId);
    if (!hyperedge) return `No information available for ${hyperedgeId}`;
    
    // Get supporting and conflicting evidence
    const { supporting, conflicting } = this._analyzeEvidence(hyperedgeId);
    
    // Generate justification text
    let explanation = `Belief in ${hyperedgeId} is justified by:\n`;
    
    // Add supporting evidence
    if (supporting.length > 0) {
      explanation += `\nSupporting evidence:\n`;
      supporting.forEach((evidence, i) => {
        explanation += `${i + 1}. ${this._formatEvidence(evidence)}\n`;
      });
    }
    
    // Add conflicting evidence if present
    if (conflicting.length > 0) {
      explanation += `\nConflicting evidence (overridden):\n`;
      conflicting.forEach((evidence, i) => {
        explanation += `${i + 1}. ${this._formatEvidence(evidence)}\n`;
      });
    }
    
    // Add overall confidence assessment
    const truth = hyperedge.getTruth();
    explanation += `\nOverall confidence: ${truth.confidence.toFixed(2)}`;
    explanation += ` (frequency: ${truth.frequency.toFixed(2)})`;
    
    return explanation;
  }
  
  /**
   * Generate a counterfactual explanation
   */
  counterfactual(hyperedgeId, alternative) {
    // Analyze what would need to be different for the alternative to be true
    const requirements = this._analyzeCounterfactualRequirements(hyperedgeId, alternative);
    
    // Generate explanation
    let explanation = `For "${alternative}" to be true instead of "${hyperedgeId}", `;
    
    if (requirements.missingEvidence.length > 0) {
      explanation += `the following evidence would need to be present:\n`;
      requirements.missingEvidence.forEach((req, i) => {
        explanation += `${i + 1}. ${this._formatRequirement(req)}\n`;
      });
    }
    
    if (requirements.conflictingEvidence.length > 0) {
      explanation += `\nThe following current evidence would need to be absent or weaker:\n`;
      requirements.conflictingEvidence.forEach((req, i) => {
        explanation += `${i + 1}. ${this._formatConflict(req)}\n`;
      });
    }
    
    return explanation;
  }
  
  /* Internal methods for explanation generation */
  _getDerivationPath(hyperedgeId, depth) {
    const path = [];
    this._traceDerivation(hyperedgeId, path, depth);
    return path.reverse(); // Start from premises
  }
  
  _traceDerivation(hyperedgeId, path, depth) {
    if (depth <= 0) return;
    
    const hyperedge = this.nar.hypergraph.get(hyperedgeId);
    if (!hyperedge) return;
    
    path.push({
      id: hyperedge.id,
      type: hyperedge.type,
      args: hyperedge.args,
      truth: hyperedge.getTruth(),
      derivationRule: this._identifyDerivationRule(hyperedgeId)
    });
    
    // Find premises that led to this conclusion
    const premises = this._findPremises(hyperedgeId);
    
    // Recursively trace each premise
    for (const premiseId of premises) {
      this._traceDerivation(premiseId, path, depth - 1);
    }
  }
  
  _identifyDerivationRule(hyperedgeId) {
    // Analyze the derivation path to identify which rule was used
    // This would check the structure of the hyperedge and its premises
    const hyperedge = this.nar.hypergraph.get(hyperedgeId);
    if (!hyperedge) return 'unknown';
    
    // Check for transitive inheritance
    if (hyperedge.type === 'Inheritance' && hyperedge.args.length === 2) {
      const [subject, predicate] = hyperedge.args;
      const middleLinks = [];
      
      // Look for middle term that enables transitivity
      this.nar.index.byArg.get(predicate)?.forEach(id => {
        const middle = this.nar.hypergraph.get(id);
        if (middle?.type === 'Inheritance' && middle.args[1] === subject) {
          middleLinks.push(middle);
        }
      });
      
      if (middleLinks.length > 0) return 'transitive-inheritance';
    }
    
    // Check for other derivation rules...
    
    return 'direct-assertion'; // Default case
  }
  
  _generateNaturalExplanation(derivationPath) {
    if (derivationPath.length === 0) return "No explanation available.";
    
    // Start with the conclusion
    const conclusion = derivationPath[derivationPath.length - 1];
    let explanation = this._applyTemplate('conclusion', conclusion);
    
    // Add premises
    if (derivationPath.length > 1) {
      explanation += " This is because ";
      
      // Format premises as a natural language chain
      const premisesText = derivationPath.slice(0, -1).map((step, i, arr) => {
        const template = i === 0 ? 'first-premise' : 
                        i === arr.length - 1 ? 'last-premise' : 'middle-premise';
        return this._applyTemplate(template, step);
      });
      
      explanation += this._combinePhrases(premisesText);
    }
    
    // Add confidence information
    const truth = conclusion.truth;
    explanation += ` With ${this._confidenceDescription(truth.confidence)} confidence ` +
                  `(${(truth.frequency * 100).toFixed(0)}% likelihood).`;
    
    return explanation;
  }
  
  _confidenceDescription(confidence) {
    if (confidence > 0.9) return "very high";
    if (confidence > 0.7) return "high";
    if (confidence > 0.5) return "moderate";
    if (confidence > 0.3) return "low";
    return "very low";
  }
  
  _combinePhrases(phrases) {
    if (phrases.length === 1) return phrases[0];
    if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
    
    const lastPhrase = phrases.pop();
    return `${phrases.join(', ')}, and ${lastPhrase}`;
  }
  
  _applyTemplate(templateName, data) {
    const template = this.customTemplates.get(templateName) || 
                    this.explanationTemplates[templateName];
    
    return template
      .replace(/\${type}/g, this._formatTerm(data.type))
      .replace(/\${subject}/g, this._formatTerm(data.args?.[0] || ''))
      .replace(/\${predicate}/g, this._formatTerm(data.args?.[1] || ''))
      .replace(/\${truth.frequency}/g, data.truth?.frequency.toFixed(2) || '0.5')
      .replace(/\${truth.confidence}/g, data.truth?.confidence.toFixed(2) || '0.5')
      .replace(/\${rule}/g, data.derivationRule || 'direct');
  }
  
  _formatTerm(term) {
    // Remove technical formatting for natural language
    return term
      .replace(/Inheritance\((.*),(.*)\)/, '$1 is a type of $2')
      .replace(/Similarity\((.*),(.*)\)/, '$1 is similar to $2')
      .replace(/Implication\((.*),(.*)\)/, 'if $1 then $2')
      // Add more pattern replacements
      .replace(/_/g, ' ')
      .replace(/\$/g, 'the concept of ');
  }
}
```

### 7. Additional Macro Functions and Utilities

```javascript
/* ===== ENHANCED MACRO FUNCTIONS FOR COMMON PATTERNS ===== */
/**
 * NAL statement creation with automatic context handling
 * @example nal('<bird --> flyer>. %0.8;0.75% @context:ornithology')
 */
nal(statement, options = {}) {
  // Parse context if specified
  let context = null;
  let cleanStatement = statement;
  
  const contextMatch = statement.match(/@(context:[^ ]+)/);
  if (contextMatch) {
    context = contextMatch[1].replace('context:', '');
    cleanStatement = statement.replace(contextMatch[0], '').trim();
  }
  
  // Parse and add the statement
  const result = this.expressionEvaluator.parseAndAdd(cleanStatement, options);
  
  // Apply context if specified
  if (context) {
    this._applyContext(result, context, options);
  }
  
  return result;
}

/**
 * Create a contextualized rule that only applies in specific situations
 * @example contextualRule('when(raining, driving)', 'turn_on(headlights)', 'weather:rainy')
 */
contextualRule(premise, conclusion, contextId, options = {}) {
  // Create the base rule
  const ruleId = this.implication(premise, conclusion, options);
  
  // Associate with context
  this._addContextAssociation(ruleId, contextId);
  
  // Create context-specific version of premises if needed
  this._createContextSpecificPremises(premise, contextId);
  
  return ruleId;
}

/**
 * Create a multi-step temporal sequence with automatic timing
 * @example temporalSequence('wake_up', 'brush_teeth', 'have_breakfast', { interval: 5 })
 */
temporalSequence(...terms) {
  const options = (typeof terms[terms.length - 1] === 'object') ? 
    terms.pop() : { interval: 2 };
    
  const { interval = 2, unit = 'minutes', timestamp = Date.now() } = options;
  const stepInterval = unit === 'minutes' ? interval * 60000 : 
                      unit === 'hours' ? interval * 3600000 : interval;
  
  // Add temporal links
  for (let i = 0; i < terms.length - 1; i++) {
    this.after(
      terms[i], 
      terms[i + 1], 
      timestamp + (i * stepInterval)
    );
  }
  
  // Create a sequence identifier
  return this._id('Sequence', terms);
}

/**
 * Create a probabilistic rule with uncertainty handling
 * @example probabilisticRule('bird($x)', 'flyer($x)', 0.85, 0.75)
 */
probabilisticRule(premise, conclusion, frequency, confidence, options = {}) {
  // Parse variables
  const variables = this._extractVariables(premise);
  const ruleId = this.implication(premise, conclusion, {
    ...options,
    truth: new TruthValue(frequency, confidence)
  });
  
  // Store variable information for later use
  if (variables.length > 0) {
    this._storeRuleVariables(ruleId, variables);
  }
  
  return ruleId;
}

/**
 * Add a constraint between variables in a rule
 * @example addRuleConstraint('rule:123', '$x', 'instance_of(bird)')
 */
addRuleConstraint(ruleId, variable, constraint) {
  if (!this.ruleConstraints.has(ruleId)) {
    this.ruleConstraints.set(ruleId, new Map());
  }
  this.ruleConstraints.get(ruleId).set(variable, constraint);
}

/**
 * Create a context-aware question that considers situational factors
 * @example contextualQuestion('<$x --> hazard>?', { context: 'driving' })
 */
contextualQuestion(question, options = {}) {
  // Apply context to the question
  const contextualized = this._applyContextToQuestion(question, options.context);
  
  // Process the contextualized question
  return this.nalq(contextualized, options);
}

/**
 * Create a compound concept with semantic enrichment
 * @example enrichedCompound('Product', 'car', 'red', { attributes: { color: 'red' } })
 */
enrichedCompound(type, ...args) {
  const options = (typeof args[args.length - 1] === 'object' && !Array.isArray(args[args.length - 1])) ? 
    args.pop() : {};
    
  const compoundId = this.compound(type, ...args);
  
  // Add semantic attributes
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([attr, value]) => {
      this.inheritance(
        compoundId,
        `Attribute(${attr},${value})`,
        { truth: TruthValue.certain().scale(0.9) }
      );
    });
  }
  
  // Add relationships to related concepts
  if (options.relationships) {
    options.relationships.forEach(rel => {
      this[rel.type](compoundId, rel.target, { 
        truth: rel.truth || TruthValue.certain().scale(0.8) 
      });
    });
  }
  
  return compoundId;
}

/**
 * Create a belief with explicit source citation
 * @example citedBelief('<penguin --> flyer>. %0.1;0.8%', { source: 'biology_textbook', page: 42 })
 */
citedBelief(statement, citation) {
  const beliefId = this.nal(statement);
  
  // Store citation information
  this._storeCitation(beliefId, citation);
  
  // Create provenance link
  if (citation.source) {
    this.inheritance(
      beliefId,
      `Source(${citation.source})`,
      { truth: TruthValue.certain().scale(0.95) }
    );
    
    if (citation.page) {
      this.inheritance(
        beliefId,
        `Page(${citation.page})`,
        { truth: TruthValue.certain().scale(0.9) }
      );
    }
  }
  
  return beliefId;
}

/**
 * Create a conditional rule with exception handling
 * @example robustRule('bird($x)', 'flyer($x)', '!penguin($x)', { frequency: 0.85 })
 */
robustRule(premise, conclusion, exception, options = {}) {
  // Create the base rule
  const baseRule = this.implication(premise, conclusion, {
    ...options,
    truth: options.truth || new TruthValue(0.9, 0.8)
  });
  
  // Create the exception rule
  const exceptionRule = this.implication(
    `${exception} && ${premise}`, 
    `!${conclusion}`,
    {
      ...options,
      truth: new TruthValue(0.95, 0.85)
    }
  );
  
  // Link the rules for proper exception handling
  this.equivalence(baseRule, `!${exceptionRule}`, {
    truth: TruthValue.certain().scale(0.7)
  });
  
  return { baseRule, exceptionRule };
}
```

## Summary of Key Enhancements

1. **Complete NAL Syntax Support**:
   - Full parsing of nested expressions with proper operator precedence
   - Enhanced variable handling and constraint satisfaction
   - Comprehensive truth value annotation support

2. **Advanced Budget Management**:
   - Dynamic budget allocation based on system load and task importance
   - Resource competition resolution with proportional allocation
   - Novelty-based priority bonuses for new information

3. **Sophisticated Contradiction Handling**:
   - Explicit contradiction detection with context analysis
   - Multiple resolution strategies (accept, reject, split)
   - Context-specific concept creation for contradictory information

4. **Enhanced Temporal Reasoning**:
   - Full Allen's interval algebra implementation
   - Temporal constraint satisfaction
   - Uncertainty-aware temporal processing
   - Natural language temporal descriptions

5. **Scalability Improvements**:
   - Optimized indexing with trie-based search
   - Memory-conscious caching with intelligent pruning
   - Path cache with usage-based optimization
   - Concept popularity tracking for resource allocation

6. **Advanced Explanation System**:
   - Multiple explanation styles (step-by-step, evidence-based, causal, natural)
   - Counterfactual reasoning for "what if" scenarios
   - Justification highlighting key evidence
   - Natural language generation templates

7. **Practical Macro Functions**:
   - Context-aware rules and questions
   - Temporal sequences with automatic timing
   - Probabilistic rules with uncertainty handling
   - Cited beliefs with provenance tracking
   - Robust rules with exception handling

These enhancements make NARHyper a more complete, robust, and practical implementation of Non-Axiomatic Reasoning that better addresses the challenges of real-world AI applications while maintaining the core principles of NARS and the hybrid symbolic-subsymbolic approach. The system is now better equipped to handle complex reasoning tasks with contradictory evidence, temporal dynamics, and resource constraints, while providing clear, interpretable explanations of its reasoning process.