# HyperNARS New Implementation: DESIGN.md

This document provides the detailed technical blueprint for the new, clean-room reimplementation of the HyperNARS reasoning system.

## Table of Contents

1.  [System Architecture](#system-architecture)
2.  [Core Data Structures](#core-data-structures)
3.  [The Reasoning Cycle (Control Unit)](#the-reasoning-cycle-control-unit)
4.  [Inference Engine](#inference-engine)
5.  [Memory System](#memory-system)
6.  [I/O and Public API](#io-and-public-api)
7.  [Extension Points](#extension-points)

## 1. System Architecture

The new HyperNARS architecture will be designed as a modular, layered system. This approach enhances testability, extensibility, and maintainability. The design is inspired by the C4 model, focusing on components and their interactions.

The system is composed of a central **Reasoning Kernel** that executes the core reasoning cycle, and a suite of specialized **Cognitive Managers** that handle higher-level cognitive functions. This separation of concerns ensures the kernel remains lean and focused on pure NARS logic, while complex behaviors can be developed and tested independently in the managers.

Communication is primarily handled via an **asynchronous event bus**. The Reasoning Kernel emits events at key points in its cycle, and managers subscribe to these events to perform their functions. This ensures loose coupling and allows for flexible, emergent behavior. Managers can influence the kernel by injecting new tasks into its processing queue.

### Event-Based Communication
The Reasoning Kernel will emit events at key points in the reasoning cycle. Cognitive Managers subscribe to these events to perform their functions. Below are the core events and their data payloads:

-   **`task-selected`**: Fired when a task is chosen from a concept's task queue for processing.
    -   **Payload**: `{ task: Task }`
-   **`belief-updated`**: Fired when a belief's truth-value is updated after revision with another belief.
    -   **Payload**: `{ belief: Belief, oldTruth: TruthValue }`
-   **`belief-added`**: Fired when a new belief is added to a concept.
    -   **Payload**: `{ belief: Belief }`
-   **`contradiction-detected`**: Fired by the Memory System when a new task or belief directly contradicts an existing belief.
    -   **Payload**: `{ statement: Statement, belief1: Belief, belief2: Belief }`
-   **`concept-activated`**: Fired when a concept's activation level changes.
    -   **Payload**: `{ concept: Concept, activation: number }`
-   **`concept-created`**: Fired when a new concept is created in memory.
    -   **Payload**: `{ concept: Concept }`
-   **`system-idle`**: Fired when the reasoning cycle has no tasks to process.
    -   **Payload**: `{ idleDuration: number }` // duration in milliseconds

Managers can inject new tasks into the system via a dedicated `Kernel.addTask(task: Task): void` method. This is the primary mechanism for managers to influence the reasoning process.

### Component Diagram

```mermaid
graph TD
    subgraph AppLayer [Application Layer]
        direction TB
        UI_API(UI, API)
    end

    subgraph CogManagers [Cognitive Managers]
        direction LR
        GoalManager(Goal Manager)
        TemporalReasoner(Temporal Reasoner)
        LearningEngine(Learning Engine)
        ContradictionManager(Contradiction Manager)
        MetaReasoner(Cognitive Executive)
        ExplanationSystem(Explanation System)
    end

    subgraph Kernel [Reasoning Kernel]
        direction TB
        subgraph ControlInference [ ]
            direction LR
            ControlUnit(Control Unit / Cycle)
            InferenceEngine(Inference Engine / NAL)
        end
        MemorySystem(Memory System / Concept Graph)
    end

    subgraph Grounding [Symbol Grounding Interface]
        direction TB
        GroundingInterface(Interface)
    end

    UI_API -- "Input/Queries" --> CogManagers
    CogManagers -- "Injects Tasks" --> Kernel
    Kernel -- "Emits Events" --> CogManagers
    Kernel -- "Accesses/Modifies" --> MemorySystem
    InferenceEngine -- "Applies Rules" --> MemorySystem
    ControlUnit -- "Orchestrates" --> InferenceEngine
    Kernel -- "Grounding Requests" --> Grounding
    Grounding -- "Grounded Knowledge" --> Kernel

    classDef default fill:#fff,stroke:#333,stroke-width:1.5px;
    classDef layer fill:#f8f8f8,stroke:#666,stroke-width:2px,stroke-dasharray: 3 3;
    class AppLayer,CogManagers,Kernel,Grounding layer;
```

### Cognitive Manager Roles

The Cognitive Managers are specialized, pluggable modules that handle complex, cross-cutting concerns. They operate by subscribing to events from the Reasoning Kernel and can inject new tasks back into the system to influence its behavior.

-   **Goal Manager**: Manages the system's goals.
    -   *Subscribes to*: `belief-updated`, `belief-added`.
    -   *Action*: When a belief indicates progress toward an active goal, the manager can increase the priority of related tasks. When a goal is satisfied, it may derive new goals.
    -   *Injects*: High-priority tasks aimed at satisfying goals (e.g., questions to acquire missing knowledge).

-   **Temporal Reasoner**: Provides a comprehensive framework for understanding and reasoning about time.
    -   *Subscribes to*: `belief-added`.
    -   *Action*: Analyzes beliefs with temporal information, using **Allen's Interval Algebra** to infer new temporal relationships (e.g., if A is before B and B is before C, it infers A is before C).
    -   *Injects*: New beliefs representing the inferred temporal relationships.

-   **Learning Engine**: Responsible for abstracting knowledge and forming new concepts.
    -   *Subscribes to*: `concept-created`, `belief-added`.
    -   *Action*: Detects patterns and correlations across concepts to form higher-level abstractions or new inference rules. For example, it might notice that `(<X> --> <Y>)` and `(<Y> --> <Z>)` frequently lead to `(<X> --> <Z>)` and propose a new compositional rule.
    -   *Injects*: Tasks representing new concepts or learned rules.

-   **Contradiction Manager**: Implements sophisticated strategies for resolving contradictions.
    -   *Subscribes to*: `contradiction-detected`.
    -   *Action*: When a contradiction is detected, this manager analyzes the evidence, source reliability, and recency of the conflicting beliefs to decide on a resolution strategy (e.g., merge, discard, specialize).
    -   *Injects*: Tasks that revise or remove beliefs to resolve the contradiction.

-   **Meta Reasoner (Cognitive Executive)**: Monitors and adapts the system's overall behavior.
    -   *Subscribes to*: `task-selected`, `system-idle`, `contradiction-detected`.
    -   *Action*: Tracks system metrics (e.g., inference rate, contradiction rate). If it detects anomalies (e.g., a sudden spike in contradictions), it can dynamically adjust system parameters.
    -   *Injects*: Control tasks or directly calls configuration methods on the kernel (e.g., to adjust budget allocation strategies).

-   **Explanation System**: Generates human-readable explanations for the system's conclusions.
    -   *Subscribes to*: `belief-updated`, `belief-added`.
    -   *Action*: Maintains a trace of derivations. When the public API's `explain()` method is called, this manager is queried to construct the explanation graph.
    -   *Injects*: Does not typically inject tasks; primarily responds to API requests.

## 2. Core Data Structures

The core data structures will be designed as **immutable** objects where possible to ensure functional purity, thread safety, and predictable state management.

```typescript
// A Term is the basic unit of meaning, representing an entity or concept.
// It can be an atomic identifier (string) or a CompoundTerm.
type Term = string | CompoundTerm;

// A CompoundTerm is a structure composed of other terms, connected by an operator.
// This allows for representing complex subjects/predicates, e.g., "all birds except penguins".
// Example: The term "(&, bird, (-, penguin))" in the statement "<(&, bird, (-, penguin)) --> flyer>"
interface CompoundTerm {
    readonly operator: 'conjunction' | 'negation' | 'set'; // and other potential operators
    readonly terms: Term[];
    // A unique, canonical string representation used for hashing.
    readonly key: string;
    toString(): string;
}

// A statement of a relationship between terms. It is the primary type of hyperedge in the Concept Hypergraph.
interface Statement {
    // A unique, canonical string representation of the statement, used for hashing.
    // The key MUST be generated consistently regardless of term order for symmetric statements.
    readonly key: string;
    // An array of terms involved in the statement, in a defined order.
    readonly terms: Term[];
    // The type of copula connecting the terms.
    readonly copula: 'inheritance' | 'similarity' | 'implication' | 'equivalence' | 'conjunction';
    // Returns a human-readable string, e.g., "(bird --> animal)".
    toString(): string;
}

// Example Implementation of Statement subtypes for clarity.
class InheritanceStatement implements Statement {
    readonly key: string;
    readonly terms: Term[];
    readonly copula = 'inheritance';
    constructor(subject: Term, predicate: Term) {
        this.terms = [subject, predicate];
        this.key = `(${subject} --> ${predicate})`;
    }
    toString = () => this.key;
}
class SimilarityStatement implements Statement {
    readonly key: string;
    readonly terms: Term[];
    readonly copula = 'similarity';
    constructor(term1: Term, term2: Term) {
        // Sort terms to ensure canonical key for symmetric relation
        const sortedTerms = [term1, term2].sort();
        this.terms = sortedTerms;
        this.key = `(${sortedTerms[0]} <-> ${sortedTerms[1]})`;
    }
    toString = () => this.key;
}
class ConjunctionStatement implements Statement {
    readonly key: string;
    readonly terms: Term[];
    readonly copula = 'conjunction';
    // Terms are sorted to ensure canonical representation, e.g., (&&, A, B) is same as (&&, B, A)
    constructor(terms: Term[]) {
        this.terms = terms.sort();
        this.key = `(&&, ${this.terms.join(', ')})`;
    }
    toString = () => this.key;
}


// Represents the epistemic value of a statement, grounded in evidence.
class TruthValue {
    readonly f: number; // frequency in [0, 1]
    readonly c: number; // confidence in (0, 1)
    readonly d: number; // doubt in [0, 1]

    constructor(f: number, c: number, d: number = 0) {
        this.f = Math.max(0, Math.min(1, f));
        this.c = Math.max(0, Math.min(1, c));
        this.d = Math.max(0, Math.min(1, d));
    }

    // Expectation: The degree of positive evidence, adjusted for doubt.
    get e(): number { return this.c * (this.f - 0.5) * (1 - this.d) + 0.5; }

    // NAL Revision: Combines two pieces of evidence.
    static revise(t1: TruthValue, t2: TruthValue): TruthValue {
        const f1 = t1.f, c1 = t1.c, d1 = t1.d;
        const f2 = t2.f, c2 = t2.c, d2 = t2.d;
        const w1 = c1 * (1-c2);
        const w2 = c2 * (1-c1);
        const w = w1 + w2;
        if (w === 0) return new TruthValue(0, 0, 1); // Total contradiction
        const f_rev = (f1 * w1 + f2 * w2) / w;
        const c_rev = w / (w + (1-c1)*(1-c2));
        // Doubt is increased by conflicting evidence and merged from parents.
        const d_conflict = Math.abs(f1 - f2) / 2;
        const d_rev = 1 - (1 - d1) * (1 - d2) * (1 - d_conflict);
        return new TruthValue(f_rev, c_rev, d_rev);
    }

    // NAL Projection: Calculates truth for a component of a compound term.
    static project(t: TruthValue, numComponents: number): TruthValue {
        // According to NARS literature, projection primarily affects confidence.
        // The confidence of a projected belief is a function of the original confidence
        // and the size of the set from which it is projected.
        // c_proj = c / (1 + log2(k)) where k is numComponents.
        // This is a more theoretically grounded formula.
        const c_proj = t.c / (1 + Math.log2(numComponents));
        return new TruthValue(t.f, c_proj, t.d);
    }

    // NAL Conjunction (Intersection): Combines two statements conjunctively.
    static and(t1: TruthValue, t2: TruthValue): TruthValue {
        const f = t1.f * t2.f;
        const c = t1.c * t2.c;
        return new TruthValue(f, c);
    }

    // NAL Union: Combines two statements disjunctively.
    static or(t1: TruthValue, t2: TruthValue): TruthValue {
        const f = 1 - (1 - t1.f) * (1 - t2.f);
        const c = t1.c * t2.c;
        return new TruthValue(f, c);
    }
}

// Represents the allocation of computational resources to a task.
class Budget {
    readonly priority: number;   // [0, 1]: How important is the task now?
    readonly durability: number; // [0, 1]: How important is the task over time?
    readonly quality: number;    // [0, 1]: How well-founded is the task?

    constructor(priority: number, durability: number, quality: number);

    /**
     * Dynamically allocates a budget for a new task.
     * @param context An object with factors like:
     *        - `type`: 'input', 'derived', 'goal'
     *        - `novelty`: How new is the information? [0, 1]
     *        - `urgency`: How time-sensitive is it? [0, 1]
     *        - `parentQuality`: Quality of the parent belief/task.
     *        - `ruleUtility`: The historical success rate of the deriving rule.
     */
    static dynamicAllocate(context: { type: string, novelty: number, urgency: number, parentQuality: number, ruleUtility?: number }): Budget {
        let priority = 0.5, durability = 0.5, quality = context.parentQuality;
        const utility = context.ruleUtility ?? 1.0;
        if (context.type === 'input') {
            priority = 0.7 * context.urgency + 0.3 * context.novelty;
            durability = 0.5;
        } else if (context.type === 'goal') {
            priority = 0.9 * context.urgency;
            durability = 0.9;
        } else { // 'derived'
            priority = (0.5 * context.parentQuality + 0.2 * context.novelty) * utility;
            durability = (0.3 * context.parentQuality) * utility;
        }
        return new Budget(priority, durability, quality);
    }

    /**
     * **Rationale for `dynamicAllocate`:**
     *
     * The `dynamicAllocate` function is designed to reflect the system's priorities based on the origin and nature of a task, in accordance with AIKR. The constants and weights are heuristics chosen to produce specific behaviors:
     *
     * -   **Input Tasks**: These are considered highly important and urgent as they represent new information from the external world. They receive a high `priority` (weighted towards `urgency`) to ensure they are processed quickly, but a moderate `durability` as their long-term importance is not yet known.
     * -   **Goal Tasks**: These are the system's objectives and are given the highest `priority` and `durability` to ensure persistent focus on achieving them.
     * -   **Derived Tasks**: The budget for these tasks is a function of the `parentQuality` (the confidence of the belief that generated them) and the historical `ruleUtility`. This crucial link ensures that the system allocates more resources to lines of reasoning that are well-founded and have proven effective in the past, while reducing focus on speculative or low-confidence derivations. The `novelty` factor provides a small boost to encourage exploration.
     */

    // Merges budgets from parent tasks.
    static merge(b1: Budget, b2: Budget): Budget {
        // A simple averaging strategy. More sophisticated strategies could be used.
        return new Budget(
            (b1.priority + b2.priority) / 2,
            (b1.durability + b2.durability) / 2,
            (b1.quality + b2.quality) / 2
        );
    }
}

// An immutable pairing of a Statement and its epistemic value.
interface Belief {
    readonly statement: Statement;
    readonly truth: TruthValue;
    readonly timestamp: number; // Creation time for temporal analysis.
}

// A work unit for the system, containing a statement to be processed.
interface Task {
    readonly statement: Statement;
    readonly budget: Budget;
    readonly parentBeliefs: Belief[]; // Provenance/derivation history.
    readonly stamp: Stamp; // Derivational stamp to prevent infinite loops.
}

### 2.1. The Derivational Stamp

To prevent infinite reasoning loops (e.g., A -> B, B -> A) and redundant derivations, each `Task` carries a `Stamp`. The stamp records the IDs of the parent beliefs and tasks that contributed to its creation. Before an inference rule is applied, the system checks if the stamps of the two premises (the task and the belief) overlap. If they do, the inference is blocked, as it would mean re-deriving information from its own lineage.

Two primary implementations of the `Stamp` can be considered:

1.  **Evidential Base (OpenNARS-style):**
    -   **Representation**: The stamp is an array of unique integer IDs, where each ID corresponds to an input belief or a specific derivation step.
    -   **Merge Operation**: When two tasks/beliefs are merged, their stamp arrays are concatenated, and the resulting list is sorted and deduplicated.
    -   **Overlap Check**: Overlap is detected by performing a linear scan or a more optimized intersection check on the two sorted arrays.
    -   **Pros**: Guarantees perfect loop detection. The full derivation path is preserved.
    -   **Cons**: Can become very large for long derivation chains, consuming significant memory and making the overlap check computationally expensive.

2.  **Bloom Filter / Bitwise Representation:**
    -   **Representation**: The stamp is a bitmask or a Bloom filter, a fixed-size probabilistic data structure. Each belief ID is hashed to one or more bit positions in the filter, which are then set to `1`.
    -   **Merge Operation**: Merging two stamps is a simple, fast bitwise `OR` operation on their filters. `new_filter = filter1 | filter2`.
    -   **Overlap Check**: Overlap is checked with a bitwise `AND` operation. If `(filter1 & filter2) !== 0`, there is a potential overlap.
    -   **Pros**: Extremely fast and memory-efficient due to its fixed size.
    -   **Cons**: Probabilistic. It can produce false positives (reporting an overlap where none exists), which would incorrectly block a valid inference path. The rate of false positives can be tuned by adjusting the size of the filter and the number of hash functions, but it can never be zero. It does not preserve the full derivation path.

The choice between these two represents a classic trade-off between logical perfection and resource efficiency, a core theme in NARS. The system could even be configured to use one or the other based on the desired operational profile.

// A node in the memory graph, representing a single Term.
class Concept {
    readonly term: Term;
    // All beliefs directly related to this concept, indexed by statement key.
    readonly beliefs: Map<string, Belief>;
    // A queue of tasks to be processed, prioritized by budget.
    readonly taskQueue: PriorityQueue<Task>;
    // The current activation level of the concept.
    activation: number;
    // Max number of beliefs/tasks to store. Can be dynamic.
    capacity: number;

    /**
     * A helper function to determine if two truth values are contradictory.
     * This is based on a configurable threshold.
     * @param t1 The first truth value.
     * @param t2 The second truth value.
     * @param threshold The minimum confidence for both beliefs to be considered for contradiction.
     * @returns True if they are contradictory, false otherwise.
     */
    isContradictory(t1: TruthValue, t2: TruthValue, threshold: number = 0.51): boolean {
        // Contradictory if they are on opposite sides of the 0.5 frequency mark
        // and both have a confidence greater than the threshold.
        const oppositeFrequency = (t1.f > 0.5 && t2.f < 0.5) || (t1.f < 0.5 && t2.f > 0.5);
        const sufficientConfidence = t1.c > threshold && t2.c > threshold;
        return oppositeFrequency && sufficientConfidence;
    }

    // Adds a new belief, revising if a related one exists.
    addBelief(belief: Belief): void {
        const key = belief.statement.key;
        if (this.beliefs.has(key)) {
            const existingBelief = this.beliefs.get(key)!;
            // Check for contradiction before revising
            if (this.isContradictory(belief.truth, existingBelief.truth)) {
                kernel.events.emit('contradiction-detected', {
                    statement: belief.statement,
                    belief1: existingBelief,
                    belief2: belief
                });
                return; // The Contradiction Manager will handle resolution.
            }
            // Revise with existing belief
            const newTruth = TruthValue.revise(existingBelief.truth, belief.truth);
            const newBelief = { ...existingBelief, truth: newTruth, timestamp: Date.now() };
            this.beliefs.set(key, newBelief);
            kernel.events.emit('belief-updated', { belief: newBelief, oldTruth: existingBelief.truth });
        } else {
            // Add new belief, forgetting if at capacity
            if (this.beliefs.size >= this.capacity) {
                this.forget(this.beliefs);
            }
            this.beliefs.set(key, belief);
            kernel.events.emit('belief-added', { belief });
        }
    }

    // Adds a task to the priority queue.
    addTask(task: Task): void {
        if (this.taskQueue.length >= this.capacity) {
            this.forget(this.taskQueue);
        }
        this.taskQueue.enqueue(task, task.budget.priority);
    }

    // Selects the highest-priority task from the queue.
    selectTask(): Task | null {
        return this.taskQueue.dequeue();
    }

    // Internal forgetting mechanism for a given collection (beliefs or tasks).
    private forget(collection: Map<string, Belief> | PriorityQueue<Task>): void {
        let lowestRelevance = Infinity;
        let keyToForget: string | null = null;

        if (collection instanceof Map) { // Forgetting a belief from the beliefs Map
            for (const [key, belief] of collection.entries()) {
                // Relevance for beliefs = confidence * activation
                const relevance = belief.truth.c * this.activation;
                if (relevance < lowestRelevance) {
                    lowestRelevance = relevance;
                    keyToForget = key;
                }
            }
            if (keyToForget) {
                collection.delete(keyToForget);
            }
        } else { // Forgetting a task from the taskQueue (PriorityQueue)
            // This is conceptually simple but can be inefficient. A practical implementation
            // might use a data structure that allows for efficient removal of low-priority items.
            // For this blueprint, we describe the logic.
            const tempArray = collection.toArray(); // Assume PriorityQueue can be exported to an array
            if (tempArray.length === 0) return;

            let itemToForget: Task | null = null;
            tempArray.forEach(task => {
                // Relevance for tasks = priority * activation
                const relevance = task.budget.priority * this.activation;
                if (relevance < lowestRelevance) {
                    lowestRelevance = relevance;
                    itemToForget = task;
                }
            });

            // Reconstruct the queue without the forgotten item
            collection.clear(); // Assume clear() method
            tempArray.forEach(task => {
                if (task !== itemToForget) {
                    collection.enqueue(task, task.budget.priority);
                }
            });
        }
    }
}
```

## 3. The Reasoning Cycle (Control Unit)

The reasoning cycle is the main loop of the system, orchestrated by the Control Unit. It continuously selects tasks, processes them through local inference, and integrates the results back into memory. The entire process is guided by the principle of **insufficient knowledge and resources**.

```pseudocode
function reasoningCycle(kernel) {
  while (kernel.isRunning) {
    // A mutable context object for this cycle, passed to hooks.
    let cycleContext = { kernel, task: null, concept: null, belief: null, derivedTasks: [] };

    // HOOK: beforeCycle (read-only context)
    kernel.hooks.run('beforeCycle', cycleContext);

    // 1. Select a Concept and a Task from memory.
    let { concept, task } = kernel.memory.selectTaskFromOverallExperience();
    if (!task || !concept) {
        kernel.events.emit('system-idle', { idleDuration: 100 });
        kernel.wait(100); // Wait if no task is available.
        continue;
    }
    cycleContext.task = task;
    cycleContext.concept = concept;

    // HOOK: afterTaskSelection (read-only context)
    kernel.hooks.run('afterTaskSelection', cycleContext);
    kernel.events.emit('task-selected', { task });

    // 2. Select a Belief from the chosen Concept to interact with the Task.
    let belief = concept.selectBeliefForTask(task);
    if (!belief) continue; // No relevant belief found.
    cycleContext.belief = belief;

    // 3. Perform Local Inference.
    // HOOK: beforeInference (mutable context)
    cycleContext = kernel.hooks.run('beforeInference', cycleContext);
    let derivedTasks = kernel.inferenceEngine.applyAllRules(cycleContext.task, cycleContext.belief);
    cycleContext.derivedTasks = derivedTasks;

    // 4. Process and Store Derived Tasks.
    for (let derivedTask of cycleContext.derivedTasks) {
      let taskContext = { derivedTask };
      // HOOK: beforeTaskProcessing (mutable context)
      taskContext = kernel.hooks.run('beforeTaskProcessing', taskContext);
      let targetConcept = kernel.memory.getOrCreateConcept(taskContext.derivedTask.statement.terms[0]);
      targetConcept.addTask(taskContext.derivedTask);
    }

    // 5. System-level cleanup and updates.
    kernel.hooks.run('afterCycle', cycleContext);
  }
}
```

### 3.1. Task and Belief Selection Algorithms

The functions `selectTaskFromOverallExperience()` and `selectBeliefForTask()` are critical for guiding the system's attention.

**`selectTaskFromOverallExperience()`**

This function implements a two-level selection process to balance global priorities with local context.

1.  **Concept Selection**: First, a concept is chosen from the entire memory. This is not a uniform random selection. Instead, it's a weighted "roulette-wheel" selection where each concept's chance of being chosen is proportional to its activation level. This ensures that more active, currently relevant concepts are processed more frequently.
2.  **Task Selection**: Once a concept is selected, the highest-priority task is dequeued from its `taskQueue`.

```pseudocode
function selectTaskFromOverallExperience(memory) {
    // 1. Select a concept using a roulette-wheel method based on activation.
    let totalActivation = memory.concepts.sum(c => c.activation);
    let randomPoint = Math.random() * totalActivation;
    let currentSum = 0;
    let selectedConcept = null;
    for (let concept of memory.concepts) {
        currentSum += concept.activation;
        if (currentSum >= randomPoint) {
            selectedConcept = concept;
            break;
        }
    }

    if (!selectedConcept) return { concept: null, task: null };

    // 2. Select the best task from that concept's queue.
    let task = selectedConcept.selectTask();
    return { concept: selectedConcept, task: task };
}
```

**`selectBeliefForTask(task)`**

Given a task, the concept must select a relevant belief to interact with. Relevance is key to fostering meaningful inferences.

1.  **Candidate Selection**: Identify all beliefs in the concept that are "structurally relevant" to the task. This means they share at least one common term.
2.  **Relevance Scoring**: Score each candidate belief. A simple relevance score can be `belief.truth.confidence * structural_similarity_score`. A more advanced score could consider recency or other factors.
3.  **Best Belief Selection**: Select the belief with the highest relevance score.

```pseudocode
function selectBeliefForTask(concept, task) {
    let bestBelief = null;
    let maxRelevance = -1;

    for (let belief of concept.beliefs.values()) {
        if (hasCommonTerms(task.statement, belief.statement)) {
            // Calculate relevance (simple version: use confidence)
            let relevance = belief.truth.confidence;
            if (relevance > maxRelevance) {
                maxRelevance = relevance;
                bestBelief = belief;
            }
        }
    }
    return bestBelief;
}
```

## 4. Inference Engine

The Inference Engine is a stateless, extensible component responsible for applying Non-Axiomatic Logic (NAL) rules to derive new knowledge from existing beliefs.

### Core Principles
-   **Extensible Rule System**: The engine will use a central registry, `Map<string, InferenceRule>`, where new rules can be added at runtime via `kernel.inferenceEngine.registerRule(rule)`. This allows for the system's reasoning capabilities to be expanded or modified.
-   **Self-Optimizing Rule Application**: To manage resource allocation under AIKR, a rule's utility is a value `U in [0, 1]` that is updated over time. When a rule derives a new task, the task's budget is modulated by the rule's utility.
    -   **Utility Update**: A rule's utility `U` can be updated based on the feedback from the tasks it generates. For example, if a derived belief is later revised and its confidence increases significantly, the utility of the rule that created it could be reinforced. `U_new = U_old * (1 - alpha) + feedback * alpha`, where `alpha` is a learning rate and `feedback` is a measure of the derived task's success (e.g., the quality of the resulting belief).
    -   **Budget Modulation**: The budget for a derived task is calculated as `Budget_derived = f(Budget_parent1, Budget_parent2) * U_rule`. This prioritizes rules that have proven more effective in the current context.

### Inference Rule Categories
The engine will support a comprehensive set of NAL rules, including but not limited to:

-   **Syllogistic & Conditional Rules (NAL Levels 1-5)**:
    -   **Deduction**: `(<M --> P>., <S --> M>.) |- <S --> P>.`
    -   **Abduction**: `(<P --> M>., <S --> M>.) |- <S --> P>.` (inference to the best explanation)
    -   **Induction**: `(<M --> P>., <M --> S>.) |- <S --> P>.` (generalization)
    -   **Exemplification**: The inverse of induction.
    -   **Comparison**: `(<M --> P>., <M <-> S>.) |- <S --> P>.`
    -   **Analogy**: `(<M --> P>., <S <-> M>.) |- <S --> P>.` (a form of abduction and induction)
-   **Compositional/Structural Rules (NAL Level 6)**:
    -   **Intersection**: `(<S --> M1>., <S --> M2>.) |- <S --> (&&, M1, M2)>.`
    -   **Union**: The inverse of intersection.
-   **Temporal Rules (NAL Level 7)**: Primarily handled by the `TemporalReasoner` manager, which can inject inferred temporal statements back into the kernel.
-   **Procedural & Operational Rules (NAL Levels 8-9)**: For learning and executing skills, managed by specialized cognitive managers.

### Inference Rule Interface & Example

All rules must implement the `InferenceRule` interface.

```typescript
interface InferenceRule {
  // A unique name for the rule (e.g., "NAL_DEDUCTION_FORWARD")
  readonly name: string;
  // The historical utility of the rule, used for budget allocation.
  utility: number;

  // Checks if the rule can be applied to the given premises.
  // This involves checking statement structure and term matching.
  canApply(task: Task, belief: Belief): boolean;

  // Applies the rule and returns a new derived Task, or null if not applicable.
  apply(task: Task, belief: Belief): Task | null;
}
```

#### Example: The Deduction Rule

The deduction rule is one of the most fundamental inference rules.

-   **Logical Form**: `(M --> P), (S --> M) |- (S --> P)`
-   **Premises**:
    1.  A task `T1` with statement `(M --> P)`.
    2.  A belief `B1` with statement `(S --> M)`.
-   **Conclusion**: A new task `T2` with statement `(S --> P)`.

-   **Truth-Value Function**:
    -   `f_conclusion = f_premise1 * f_premise2`
    -   `c_conclusion = c_premise1 * c_premise2 * f_premise1`
-   **Budget Function**:
    -   `priority = (p1 + p2) / 2 * 0.9` (slightly lower than parents)
    -   `durability = (d1 + d2) / 2 * 0.9`
    -   `quality = q1 * q2`

```typescript
class DeductionRule implements InferenceRule {
    readonly name = "NAL_DEDUCTION_FORWARD";
    utility = 1.0;

    canApply(task: Task, belief: Belief): boolean {
        const s1 = task.statement;
        const s2 = belief.statement;
        // Check if both are inheritance statements and the terms match the pattern M->P, S->M
        return s1.copula === 'inheritance' &&
               s2.copula === 'inheritance' &&
               s1.terms[0] === s2.terms[1]; // M matches
    }

    apply(task: Task, belief: Belief): Task | null {
        if (!this.canApply(task, belief)) return null;

        const s1 = task.statement; // (M --> P)
        const s2 = belief.statement; // (S --> M)

        // 1. Create the new statement: (S --> P)
        const derivedStatement = new InheritanceStatement(s2.terms[0], s1.terms[1]);

        // 2. Calculate the new truth value
        const t1 = task.parentBeliefs[0].truth; // Assuming task has truth from a parent
        const t2 = belief.truth;
        const f_new = t1.f * t2.f;
        const c_new = t1.c * t2.c * t1.f; // Asymmetric confidence calculation
        const derivedTruth = new TruthValue(f_new, c_new);

        // 3. Calculate the new budget
        const b1 = task.budget;
        // The quality of the new task is based on the quality of the parent task
        // and the confidence of the parent belief.
        const quality_new = b1.quality * t2.c;

        // The priority and durability are derived from the parent task, modulated by
        // the confidence of the belief, as interacting with a high-confidence belief
        // should yield a higher-priority task.
        const urgency = b1.priority * t2.c;

        // Novelty is calculated by checking if a similar belief already exists in the target concept.
        // The more confident the existing belief, the less novel the derived task is considered.
        // This logic assumes the inference engine can query the memory system.
        const targetConcept = kernel.memory.getOrCreateConcept(derivedStatement.terms[0]);
        const existingBelief = targetConcept.beliefs.get(derivedStatement.key);
        const novelty = existingBelief
            ? 1 - existingBelief.truth.c
            : 1.0;

        const derivedBudget = Budget.dynamicAllocate({
            type: 'derived',
            novelty: novelty,
            urgency: urgency,
            parentQuality: quality_new,
            ruleUtility: this.utility
        });

        // 4. Create and return the new task
        const derivedTask: Task = {
            statement: derivedStatement,
            truth: derivedTruth,
            budget: derivedBudget,
            parentBeliefs: [task.parentBeliefs[0], belief]
        };

        return derivedTask;
    }
}
```

#### Example: The Abduction Rule

Abduction, or "inference to the best explanation," is a powerful rule for generating hypotheses.

-   **Logical Form**: `(P --> M), (S --> M) |- (S --> P)` (Note the shared predicate `M`)
-   **Premises**:
    1.  A task `T1` with statement `(P --> M)` (e.g., "ravens are black").
    2.  A belief `B1` with statement `(S --> M)` (e.g., "my pet is black").
-   **Conclusion**: A new task `T2` with statement `(S --> P)` (e.g., hypothesizing "my pet is a raven").

-   **Truth-Value Function**: Abduction produces a weaker conclusion than deduction.
    -   `f_conclusion = f_premise1`
    -   `c_conclusion = c_premise1 * c_premise2 * f_premise2` (Simplified formula)
-   **Budget Function**: The budget for an abductive task should reflect its hypothetical nature, meaning its quality is highly dependent on the confidence of the premises.

```typescript
class AbductionRule implements InferenceRule {
    readonly name = "NAL_ABDUCTION";
    utility = 1.0;

    canApply(task: Task, belief: Belief): boolean {
        const s1 = task.statement;
        const s2 = belief.statement;
        // Check if both are inheritance statements and the predicates match: P->M, S->M
        return s1.copula === 'inheritance' &&
               s2.copula === 'inheritance' &&
               s1.terms[1] === s2.terms[1]; // M matches
    }

    apply(task: Task, belief: Belief): Task | null {
        if (!this.canApply(task, belief)) return null;

        const s1 = task.statement; // <P --> M>
        const s2 = belief.statement; // <S --> M>

        // 1. Create the new statement: <S --> P>
        const derivedStatement = new InheritanceStatement(s2.terms[0], s1.terms[0]);

        // 2. Calculate the new truth value (simplified abduction)
        const t1 = task.parentBeliefs[0].truth;
        const t2 = belief.truth;
        const f_new = t1.f;
        const c_new = t1.c * t2.c * t2.f; // Simplified abduction confidence
        const derivedTruth = new TruthValue(f_new, c_new);

        // 3. Calculate the new budget
        const quality_new = task.budget.quality * belief.truth.c * t1.c;
        const derivedBudget = Budget.dynamicAllocate({
            type: 'derived',
            novelty: 0.9, // Abduction often creates highly novel hypotheses
            urgency: (task.budget.priority) / 3, // Lower urgency due to hypothetical nature
            parentQuality: quality_new,
            ruleUtility: this.utility
        });

        // 4. Create and return the new task
        const derivedTask: Task = {
            statement: derivedStatement,
            budget: derivedBudget,
            parentBeliefs: [task.parentBeliefs[0], belief]
        };
        return derivedTask;
    }
}
```

#### Example: The Induction Rule

Induction generalizes from specific evidence.

-   **Logical Form**: `(M --> P), (M --> S) |- (S --> P)`
-   **Premises**:
    1.  A task `T1` with statement `(M --> P)`.
    2.  A belief `B1` with statement `(M --> S)`.
-   **Conclusion**: A new task `T2` with statement `(S --> P)`.

-   **Truth-Value Function**:
    -   `f_conclusion = f_premise2` (The evidence for the predicate)
    -   `c_conclusion = c_premise1 * c_premise2 * (f_premise1 / (f_premise1 * c_premise1 + (1-f_premise1)*c_premise1))`
    -   This is a simplified version of the full induction formula, which is more complex. The confidence depends on the amount of evidence supporting the premise.

```typescript
class InductionRule implements InferenceRule {
    readonly name = "NAL_INDUCTION";
    utility = 1.0;

    canApply(task: Task, belief: Belief): boolean {
        const s1 = task.statement;
        const s2 = belief.statement;
        // Check if both are inheritance statements and the subjects match: M->P, M->S
        return s1.copula === 'inheritance' &&
               s2.copula === 'inheritance' &&
               s1.terms[0] === s2.terms[0]; // M matches
    }

    apply(task: Task, belief: Belief): Task | null {
        if (!this.canApply(task, belief)) return null;

        const s1 = task.statement; // <M --> P>
        const s2 = belief.statement; // <M --> S>

        // 1. Create the new statement: <S --> P>
        const derivedStatement = new InheritanceStatement(s2.terms[1], s1.terms[1]);

        // 2. Calculate the new truth value (simplified induction)
        const t1 = task.parentBeliefs[0].truth;
        const t2 = belief.truth;
        const f_new = t2.f;
        const c_new = t1.c * t2.c * t1.f; // Simplified, actual formula is complex
        const derivedTruth = new TruthValue(f_new, c_new);

        // 3. Calculate the new budget
        const quality_new = task.budget.quality * belief.truth.c;
        const derivedBudget = Budget.dynamicAllocate({
            type: 'derived',
            novelty: 0.8, // Induction often creates novel hypotheses
            urgency: (task.budget.priority) / 2,
            parentQuality: quality_new,
            ruleUtility: this.utility
        });

        // 4. Create and return the new task
        const derivedTask: Task = {
            statement: derivedStatement,
            budget: derivedBudget,
            parentBeliefs: [task.parentBeliefs[0], belief]
        };
        return derivedTask;
    }
}
```

## 5. Memory System

The Memory System is the core of the system's knowledge base, structured as a dynamic concept graph and managed by several competing algorithms to adhere to AIKR.

-   **Concept Hypergraph**: The memory is structured as a **hypergraph**, a generalization of a graph in which an edge can join any number of vertices.
    -   **Vertices**: The vertices of the hypergraph are the `Concept` objects, each representing a unique `Term`.
    -   **Hyperedges**: The hyperedges are the `Statement` objects. A `Statement` represents a relationship that can connect two or more `Concepts`. For example:
        -   A simple inheritance statement like `<A --> B>` is a directed hyperedge connecting two vertices (Concept A and Concept B).
        -   A conjunction statement like `<(&&, A, B, C) ==> D>` is a directed hyperedge connecting four vertices to one. This is where the hypergraph model becomes essential.
    -   This structure is "implicit" because the hyperedges (statements/beliefs) are stored within the `Concept` objects they are connected to, rather than in a separate, global edge list. This maintains the principle of locality. Concepts are stored in a central hash map, indexed by their `Term` for O(1) average-time lookup.

    **Hypergraph Visualization:**
    The following diagram illustrates this concept. The hyperedges are represented by the small, colored squares, connecting multiple concept nodes together.

    ```mermaid
    graph TD
        subgraph "Concept Hypergraph Example"
            A("Concept: bird")
            B("Concept: animal")
            C("Concept: flyer")
            D("Concept: penguin")
            E("Concept: not_a_flyer")

            H1( )
            H2( )

            A -- "subject" --> H1 -- "predicate" --> B
            A -- "term" --> H2
            D -- "negated term" --> H2
            H2 -- "predicate" --> C

            subgraph "Legend"
                direction LR
                L1("Concept")
                L2( )
                L1 --- L2("Hyperedge")
            end
        end

        style H1 fill:#f9f,stroke:#333,stroke-width:2px,rx:5px,ry:5px
        style H2 fill:#ccf,stroke:#333,stroke-width:2px,rx:5px,ry:5px
        style L2 fill:#f9f,stroke:#333,stroke-width:2px,rx:5px,ry:5px
    ```

-   **Activation Spreading**: This is the mechanism for managing the system's focus of attention. When a concept is accessed, a portion of its activation energy is spread to related concepts.
    -   `Activation_new(C) = Activation_old(C) * (1 - decay_rate) + Sum(Activation_in(S, C))`
    -   `Activation_in(S, C)` is the activation transferred from a source concept `S` to target `C`. This is calculated as: `Activation_in = task.budget.priority * belief.truth.confidence * relevance_factor`, where `relevance_factor` can be a constant or a function of the type of connection. The activation is then distributed among all connected concepts.
    -   `decay_rate` is a system parameter that determines how quickly concepts lose activation over time.

-   **Forgetting Algorithm**: To manage finite memory resources, the system must forget less important information. This is a continuous, gentle process rather than a periodic "garbage collection" sweep.
    -   **Relevance Metric**: The importance of any item (a `Belief` or `Task`) within a concept is its `Relevance`. The calculation depends on the item type, combining the item's intrinsic importance with the concept's current activation:
        -   For a `Belief`: `Relevance = belief.truth.confidence * concept.activation`. This prioritizes retaining high-confidence knowledge in active concepts.
        -   For a `Task`: `Relevance = task.budget.priority * concept.activation`. This prioritizes processing high-priority tasks in active concepts.
    -   **Forgetting Process**: When a new item is added to a concept and its capacity is exceeded, the item with the lowest `Relevance` score is removed. The capacity can be dynamic, potentially growing as a concept becomes more frequently used (e.g., `capacity = base_capacity + log(concept.usage_count)`).

-   **Contradiction Handling**: This is managed by the `ContradictionManager` and is a sophisticated, multi-stage process. When a `contradiction-detected` event is fired, the manager executes the following logic:

    -   **1. Detection**: A contradiction is detected when a new belief `B1` is processed that has the same statement as an existing belief `B2` but a sufficiently different truth-value (e.g., one is positive evidence, the other is negative).

    -   **2. Evidence-Based Analysis**: The manager calculates an `evidenceStrength` for each conflicting belief, synthesizing factors like `truth.confidence`, `truth.recency`, and the reliability of the information source (if available).

    -   **3. Strategy Selection & Resolution**: Based on the analysis, a strategy is chosen. This is a rule-based decision process:
        -   **IF** `strength(B1) >> strength(B2)` **THEN** apply **DominantEvidence**: The weaker belief `B2` is removed. The budget of `B1` is boosted.
        -   **IF** `strength(B1) ~= strength(B2)` **THEN** apply **Merge**: The truth values of `B1` and `B2` are revised together using `TruthValue.revise()`. The resulting belief replaces the old one. The doubt (`d`) component of the new truth value will naturally increase, indicating uncertainty.
        -   **IF** `B1` is a general statement (e.g., `<bird --> flyer>`) and `B2` represents a conflicting special case (e.g., a high-confidence belief `<penguin --> not_a_flyer>` derived from input, where the system also knows `<penguin --> bird>`), **THEN** apply **Specialize**. This is a multi-step process for learning exceptions:
            1.  **Reduce Confidence of General Rule**: The system first reduces the confidence of the general belief `<bird --> flyer>`. It is not wrong, just incomplete. This is done by revising it with the conflicting evidence, which will naturally lower its confidence and increase its doubt.
            2.  **Identify the Exception**: The system identifies `penguin` as the term representing the exception.
            3.  **Construct Compound Term**: A new, more specific subject term is constructed to explicitly exclude the exception. This term is `(&, bird, (-, penguin))`, which represents "a bird that is not a penguin". This requires the system's `Term` logic to support conjunction (`&`) and negation (`-`).
            4.  **Inject New Learning Task**: The system injects a new, high-priority task into the reasoning cycle. The goal of this task is to form the new, more accurate belief: `(<(&, bird, (-, penguin)) --> flyer>)`. This task is derived from the original `<bird --> flyer>` belief but is now conditioned on the more specific, non-exceptional term.
            5.  **Preserve Specific Knowledge**: The specific, high-confidence belief `<penguin --> not_a_flyer>` is preserved as it is considered more specific and therefore more likely to be correct in its narrow context.
            This strategy allows the system to gracefully handle exceptions without discarding useful general knowledge, leading to a more nuanced and accurate belief system.
        -   **IF** `source(B1)` is more reliable than `source(B2)` **THEN** apply **SourceReliability**: Give precedence to `B1`, but do not necessarily discard `B2`. Instead, significantly lower the budget of `B2`.
        -   **IF** strategies above are inconclusive, **THEN** apply **RecencyBiased**: Give a slight budget advantage to the more recent belief.

    This entire process is designed to be extensible, allowing new resolution strategies to be added as plugins to the `ContradictionManager`.

## 6. I/O and Public API

The public API will be designed to be clean, language-agnostic, and powerful. It will be event-driven and asynchronous.

-   **Input/Output API**:
    -   `nal(statement: string, options?: object): Promise<InputResult>`: Asynchronously inputs a NAL statement. When `nal()` is called, the system performs a critical two-step process to ensure proper provenance for new information. First, it creates a `Belief` from the input `statement`, assigning it a high-confidence `TruthValue` and a `Budget` based on the system's `DEFAULT_INPUT_BUDGET` settings. Second, it creates the main `Task` to be processed. The `parentBeliefs` array of this new task is initialized with the belief created in the first step. This mechanism ensures that all tasks, whether derived internally or received from an external source, have a clear evidence trail, which is essential for the inference and revision processes.
    -   `nalq(question: string, options?: object): Promise<Answer>`: Asks a NAL question.
    -   `on(event: 'answer' | 'contradiction' | 'goal-achieved', callback: (data: object) => void): void`: Subscribes to system events.
-   **Control & Configuration API**:
    -   `run(steps?: number): Promise<void>`: Runs the reasoning cycle for a number of steps (or indefinitely if no argument is provided).
    -   `pause(): void` / `resume(): void`: Controls the reasoning loop.
    -   `setConfig(key: string, value: any): void`: Dynamically changes system parameters.
-   **Inspection & Explainability API**:
    -   `getConcept(term: string): Promise<Concept | null>`: Retrieves the full state of a concept.
    -   `getMetrics(): Promise<SystemMetrics>`: Returns detailed operational metrics.
    -   `explain(statement: string, options?: ExplainOptions): Promise<Explanation>`: Returns a rich, structured explanation for a belief.

### API Data Structures

```typescript
// Result of an `nal()` input call.
interface InputResult {
    success: boolean;
    taskId: string; // The ID of the generated task.
    warnings?: string[]; // e.g., "Statement format is deprecated."
}

// Result of a `nalq()` question call.
interface Answer {
    bestBelief: Belief | null;
    allAnswers: Belief[];
    // How the answer was found: 'direct' (in memory) or 'derived'.
    derivationStatus: 'direct' | 'derived' | 'none';
    derivationPath?: DerivationStep[];
}

// Data structure for `getMetrics()`.
interface SystemMetrics {
    uptime: number; // in seconds
    cycleCount: number;
    inferenceRate: number; // inferences per second
    contradictionRate: number; // contradictions per 1000 cycles
    memory: {
        conceptCount: number;
        beliefCount: number;
        taskCount: number;
        usagePercentage: number;
    };
}

// Options for the `explain()` method.
interface ExplainOptions {
    format?: 'detailed' | 'concise' | 'json';
    depth?: number; // Max depth of the derivation tree to return.
}

// The rich object returned by the `explain()` method.
interface Explanation {
    conclusion: Statement;
    summary: string; // A human-readable summary.
    derivationPath: DerivationStep; // The root of the derivation tree.
    alternativePaths: DerivationStep[]; // Conflicting derivations.
}

// A single step in a derivation path, forming a tree structure.
interface DerivationStep {
    conclusion: Belief;
    ruleName: string; // e.g., "NAL_DEDUCTION_FORWARD"
    premises: DerivationStep[]; // Recursive definition for the full tree.
}
```

### Example: `derivationPath` Structure

A key feature for explainability is the `derivationPath`. Here is an example of what the JSON representation would look like for the conclusion `<penguin --> animal>` derived from `<penguin --> bird>` and `<bird --> animal>`.

```json
{
  "conclusion": {
    "statement": "(penguin --> animal)",
    "truth": { "f": 0.9, "c": 0.81, "d": 0.0 }
  },
  "ruleName": "NAL_DEDUCTION_FORWARD",
  "premises": [
    {
      "conclusion": {
        "statement": "(bird --> animal)",
        "truth": { "f": 1.0, "c": 0.9, "d": 0.0 }
      },
      "ruleName": "INPUT",
      "premises": []
    },
    {
      "conclusion": {
        "statement": "(penguin --> bird)",
        "truth": { "f": 1.0, "c": 0.9, "d": 0.0 }
      },
      "ruleName": "INPUT",
      "premises": []
    }
  ]
}
```

## 7. Extension Points

The system will be designed for deep extensibility through a multi-layered plugin architecture. This allows developers to modify or enhance system behavior at various levels of granularity, from adding a single inference rule to defining entirely new cognitive functions.

### 1. Cognitive Managers (Coarse-Grained)
This is the primary extension point for adding high-level functionality. Managers subscribe to kernel events and inject tasks to influence reasoning.

**Example: The Meta-Reasoner Manager**
The `MetaReasoner` monitors the system's health and adapts its behavior.

```typescript
class MetaReasoner {
    private kernel: Kernel;
    private contradictionHistory: number[] = [];
    private cycleCount = 0;

    constructor(kernel: Kernel) {
        this.kernel = kernel;
        this.subscribeToEvents();
    }

    private subscribeToEvents(): void {
        this.kernel.events.on('afterCycle', () => this.onAfterCycle());
        this.kernel.events.on('contradiction-detected', () => this.onContradiction());
    }

    private onAfterCycle(): void {
        this.cycleCount++;
        // Every 1000 cycles, check for anomalies.
        if (this.cycleCount % 1000 === 0) {
            this.analyzeSystemHealth();
        }
    }

    private onContradiction(): void {
        this.contradictionHistory.push(Date.now());
    }

    private analyzeSystemHealth(): void {
        // Prune old history
        const oneMinuteAgo = Date.now() - 60000;
        this.contradictionHistory = this.contradictionHistory.filter(t => t > oneMinuteAgo);

        // Check for spike in contradictions
        if (this.contradictionHistory.length > 50) { // Threshold
            console.warn("MetaReasoner: High contradiction rate detected. Increasing doubt parameter.");
            // Adapt system behavior: make the system more skeptical.
            const currentDoubt = this.kernel.getConfig('system.default.doubt');
            this.kernel.setConfig('system.default.doubt', Math.min(0.9, currentDoubt + 0.1));

            // Inject a task to reason about this anomaly
            const taskStatement = `<(high_contradiction_rate) ==> <increase_skepticism>>.`;
            this.kernel.addTask(nal(taskStatement));
        }
    }
}
```

### 2. Custom Inference Rules (Fine-Grained)
Developers can add new inference patterns to the system by implementing the `InferenceRule` interface and registering it with the engine.

**Example: A Custom "Transitive Similarity" Rule**
Let's imagine a domain-specific rule: if A is similar to B, and B is similar to C, then A is weakly similar to C.

```typescript
// 1. Define the custom rule
class TransitiveSimilarityRule implements InferenceRule {
    readonly name = "CUSTOM_SIMILARITY_TRANSITIVE";

    canApply(task: Task, belief: Belief): boolean {
        // ... (implementation)
    }

    apply(task: Task, belief: Belief): Task | null {
        // ... (implementation)
    }
}

// 2. Register it with the system instance
const nar = new HyperNARS();
nar.inferenceEngine.registerRule(new TransitiveSimilarityRule());
```

### 3. Reasoning Cycle Hooks
For even finer control, developers can attach functions to hooks at specific points in the reasoning cycle.

-   `beforeCycle`: **Read-only**. Fires before a cycle begins. Use for logging or snapshotting state.
-   `afterTaskSelection`: **Read-only**. Fires after a task and concept have been selected. Use for meta-reasoning about attention.
-   `beforeInference`: **Mutable**. Fires just before inference rules are applied. Allows modification of the task or belief. Use for dynamically adjusting budgets or redirecting reasoning.
-   `afterInference`: **Read-only**. Fires after inference, with access to the list of derived tasks. Use for analyzing the immediate output of reasoning.
-   `beforeTaskProcessing`: **Mutable**. Fires for each derived task before it's added to a concept's queue. Use for filtering, modifying, or redirecting new tasks.
-   `afterCycle`: **Read-only**. Fires after a cycle is complete. Use for updating metrics or checking for goal satisfaction.

### 4. Overridable Formulas
Core NAL formulas for truth-value and budget calculation can be swapped out via system configuration. This allows for experimenting with different probabilistic logics or resource allocation strategies without changing the core engine.

```typescript
// Example: Using a more pessimistic budget merge strategy
nar.setConfig('formulas.budget.merge', (b1, b2) => {
    return new Budget(
        Math.min(b1.priority, b2.priority),
        Math.min(b1.durability, b2.durability),
        b1.quality * b2.quality
    );
});
```

### 5. Symbol Grounding Interface
This interface connects abstract terms to external data or functions, enabling the system to interact with the "real world." Grounding is a dynamic process.

-   **Grounding Registration**: `kernel.symbolGrounding.register(term: Term, handler: Function)`
    -   The `handler` is a function that, when called, interacts with the external world (e.g., calls a sensor API, queries a database) and returns data.
-   **Grounding Trigger**: Grounding can be triggered in two ways:
    1.  **On-demand**: When the system needs to evaluate a grounded term (e.g., in a procedural rule `(<(check_temp) ==> <report_status>>)`), it invokes the handler.
    2.  **Proactive**: The external environment can proactively push information into the system. The handler can be designed to listen for external events and inject new tasks into NARS when those events occur.
-   **Lifecycle**: The handler's returned data is converted into a NARS task with a high-confidence belief (e.g., `TruthValue(1.0, 0.99)` for direct sensor readings) and injected into the appropriate concept. This new information then enters the normal reasoning cycle.

```typescript
// Example: Grounding a term to a temperature sensor.
nar.symbolGrounding.register('self.temperature', () => {
    const temp = readTemperatureSensor(); // External function call
    // Create a NARS statement from the reading.
    const statement = `<{self.temperature} --> [${temp}]>.`;
    // Inject this as a new high-priority task.
    nar.nal(statement, { urgency: 0.9 });
});
```

## 8. System Initialization and Configuration

The system's behavior is heavily influenced by a set of configurable parameters that reflect the assumptions of AIKR.

### Configuration Schema

The system is initialized with a configuration object. The following TypeScript interface defines the structure and provides examples of default values for this object.

```typescript
interface SystemConfig {
    // Maximum number of concepts allowed in memory.
    // Once reached, the forgetting mechanism becomes more active.
    MAX_CONCEPTS: number; // default: 10000

    // The rate at which concept activation decays each cycle.
    ACTIVATION_DECAY_RATE: number; // default: 0.99

    // The confidence threshold for two beliefs to be considered contradictory.
    CONTRADICTION_CONFIDENCE_THRESHOLD: number; // default: 0.51

    // Default values for new tasks injected via the API.
    DEFAULT_INPUT_BUDGET: {
        priority: number;   // default: 0.9
        durability: number; // default: 0.5
        quality: number;    // default: 0.9
    };

    // Formulas for truth-value and budget calculations.
    // These can be overridden for experimentation.
    FORMULAS: {
        BUDGET_MERGE: (b1: Budget, b2: Budget) => Budget;
        TRUTH_REVISE: (t1: TruthValue, t2: TruthValue) => TruthValue;
        // ... other overridable formulas
    };

    // Hooks for extending the reasoning cycle.
    HOOKS: {
        beforeCycle?: (context: object) => void;
        afterTaskSelection?: (context: object) => void;
        // ... other hooks
    };
}
```

### Bootstrap Process
1.  **Instantiation**: The `HyperNARS` kernel is created with an optional partial configuration object that overrides the defaults. A deep merge is performed between the user-provided config and the default config.
2.  **Module Loading**: The kernel instantiates its core components (Memory, InferenceEngine) using the final configuration.
3.  **Rule Registration**: The InferenceEngine is populated with the standard set of NAL inference rules.
4.  **Manager Initialization**: Default Cognitive Managers (like `ContradictionManager`) are instantiated and subscribed to kernel events.
5.  **Ready State**: The system is now ready to accept input via the public API. The reasoning cycle does not start automatically. It is initiated by an explicit call to `run()`.

## 9. Concurrency and Parallelism

While the core reasoning cycle is conceptually serial, the proposed architecture offers several opportunities for concurrent and parallel execution, which is crucial for scalability.

-   **Concept-Level Parallelism**: The primary unit of concurrency is the `Concept`. Since a single inference step only involves a task and a belief within one concept, operations on two different concepts are independent and can be parallelized. A potential implementation could use an **Actor Model**, where each `Concept` is an actor. In this model, each actor encapsulates its own state (beliefs, task queue) and communicates with other actors via asynchronous messages. This naturally prevents race conditions and simplifies concurrent logic.

    **Execution Flow with Actors:**
    1.  The `ControlUnit` selects a `Concept` actor to process, based on its activation level.
    2.  It sends a `ProcessTask` message to the chosen `Concept` actor.
    3.  The `Concept` actor processes one task from its internal queue. This involves selecting a belief and applying inference rules.
    4.  The inference process may generate new tasks destined for other concepts. For each new task, the `Concept` actor sends an `AddTask` message to the target `Concept` actor's mailbox.
    5.  This allows multiple concepts to be processing tasks concurrently, with the `ControlUnit` orchestrating the overall flow of attention.

    The following sequence diagram illustrates this concurrent interaction:

    ```mermaid
    sequenceDiagram
        participant CU as ControlUnit
        participant CA as Concept Actor A
        participant CB as Concept Actor B
        participant IC as InferenceCore

        CU->>CA: ProcessTask message
        activate CA
        CA->>CA: Select task T1 & belief B1
        CA->>IC: ApplyRules(T1, B1)
        activate IC
        IC-->>CA: Return derived tasks [T2, T3]
        deactivate IC
        CA-->>CB: AddTask message (Task T2)
        Note right of CB: Task for Concept B is added to its mailbox
        CA-->>CA: AddTask message (Task T3)
        Note left of CA: Task for Concept A is added to its own mailbox
        deactivate CA
    ```

-   **Event-Driven Asynchrony**: The event bus allows for asynchronous processing. For example, a `contradiction-detected` event can be handled by the `ContradictionManager` in a separate thread without blocking the main reasoning cycle, which can continue to process other, unrelated tasks.
-   **Parallel Rule Application**: Within a single inference step, the matching of all possible inference rules against the selected task and belief can be done in parallel. A `Promise.all()` or similar parallel mapping approach can be used to apply all candidate rules concurrently.
-   **I/O and Grounding**: All I/O operations, especially symbol grounding that may involve network requests or slow device access, must be fully asynchronous to prevent blocking the reasoning loop.

The design prioritizes logical correctness first, but these opportunities for performance enhancement are a key consideration for the implementation phase.

## 10. State Serialization and Persistence

To ensure that the system's learned knowledge and state can be preserved across sessions, a robust serialization mechanism is required. The entire state of the `Reasoning Kernel`—including the full `Concept` graph, all `Beliefs`, and pending `Tasks`—must be serializable to a persistent format.

### Serialization Format

The recommended format is **JSON**. It is human-readable, widely supported, and flexible enough to represent the system's complex data structures.

### State Structure

The serialized state will be a single JSON object with the following top-level keys:

-   `timestamp`: An ISO 8601 string indicating when the state was saved.
-   `config`: The full system configuration object used by the running instance. This ensures that the system is restored with the same parameters.
-   `memory`: An object representing the state of the Memory System.

### Memory Serialization

The `memory` object will contain a list of all concepts. Since the concept graph is implicit, we only need to serialize the concepts themselves.

```json
{
  "memory": {
    "concepts": [
      {
        "term": "bird",
        "activation": 0.85,
        "capacity": 100,
        "beliefs": [
          {
            "statement": "(bird --> animal)",
            "statement_type": "Inheritance",
            "terms": ["bird", "animal"],
            "truth": { "f": 1.0, "c": 0.9, "d": 0.0 },
            "timestamp": 1678886400000
          }
        ],
        "taskQueue": [
          {
            "statement": "(bird --> flyer)",
            "statement_type": "Inheritance",
            "terms": ["bird", "flyer"],
            "budget": { "priority": 0.7, "durability": 0.5, "quality": 0.9 },
            "parentBeliefs": [
              // References to parent beliefs are stored by statement key
              // to be reconstructed during deserialization.
              "(sparrow --> bird)",
              "(sparrow --> flyer)"
            ]
          }
        ]
      },
      {
        "term": "animal",
        "activation": 0.7,
        "capacity": 100,
        "beliefs": [],
        "taskQueue": []
      }
    ]
  }
}
```

### Deserialization Process

1.  **Load and Validate:** The JSON file is read and parsed. The structure is validated against the expected schema.
2.  **Instantiate Kernel:** A new `HyperNARS` kernel is instantiated using the `config` object from the saved state.
3.  **Reconstruct Concepts:** The system iterates through the `concepts` array. For each entry, it creates a new `Concept` instance.
4.  **Reconstruct Beliefs and Tasks:** For each concept, the system iterates through its `beliefs` and `taskQueue` arrays, reconstructing each `Belief` and `Task` object from the serialized data.
5.  **Re-link Provenance:** The `parentBeliefs` for tasks, which were stored as statement keys, are resolved to references to the newly reconstructed `Belief` objects. This re-establishes the derivation history.
6.  **Ready State:** Once all concepts and their contents are loaded, the system is in the same state as when it was saved and is ready to resume operation.

### Schema Versioning and Migration

As the system evolves, its core data structures (`Statement`, `TruthValue`, `Budget`, etc.) may change. To ensure backward compatibility and allow the system to load state saved from older versions, a versioning and migration strategy is essential.

1.  **Version Stamping:** The root of the serialized JSON state object will include a `version` field, corresponding to a semantic version number of the schema (e.g., `"version": "2.1.0"`).

    ```json
    {
      "version": "2.1.0",
      "timestamp": "...",
      "config": { ... },
      "memory": { ... }
    }
    ```

2.  **Migration Logic:** During deserialization, the system will compare the `version` from the saved state with its own current schema version.
    - If the versions match, deserialization proceeds as normal.
    - If the saved state's version is older, the system will apply a series of migration functions in order. Each function will transform the state from one version to the next (e.g., `migrate_2_0_0_to_2_1_0(state)`).

3.  **Migration Functions:** A migration function is a pure function that takes a state object of version `X` and returns a state object of version `Y`. For example, if a `doubt` property was added to `TruthValue` in version 2.1.0, the migrator would iterate through all beliefs and add the new property with a default value.

    ```typescript
    function migrate_2_0_0_to_2_1_0(oldState: StateV2_0_0): StateV2_1_0 {
        // Deep clone the old state to avoid mutation
        const newState = deepClone(oldState);
        // Apply transformations
        for (const concept of newState.memory.concepts) {
            for (const belief of concept.beliefs) {
                if (belief.truth.doubt === undefined) {
                    belief.truth.doubt = 0; // Add new field with default
                }
            }
        }
        newState.version = "2.1.0";
        return newState;
    }
    ```

This approach ensures that the system can gracefully handle its own evolution, preserving learned knowledge across software updates.

## 11. Error Handling and System Resilience

A production-grade reasoning system must be resilient to errors, whether from invalid user input, environmental failures, or internal inconsistencies. The system's design incorporates error handling at the API boundary and for internal operations.

### API Error Handling

The public API is the primary entry point for external interaction and must perform rigorous validation.

-   **Input Validation:** The `nal()` and `nalq()` methods must parse the input statements *before* creating a task and adding it to the system. If parsing fails due to incorrect syntax:
    -   The `Promise` returned by the method will be **rejected** with a descriptive `Error` object.
    -   The error object will contain a `code` (e.g., `'NAL_PARSE_ERROR'`) and a human-readable `message`.
    -   No partial task will be created or enter the reasoning cycle.

-   **Configuration Errors:** The `setConfig()` method will validate keys and values. Attempting to set an unknown parameter or a value of the wrong type will throw a synchronous `TypeError`.

### Symbol Grounding Failures

Symbol grounding connects the system to the outside world, which can be unreliable (e.g., network errors, sensor failures).

-   A `handler` function registered with `symbolGrounding.register()` must be wrapped in a `try...catch` block by the grounding system.
-   If the handler throws an exception, the system will:
    1.  Catch the exception to prevent it from crashing the main reasoning loop.
    2.  Log the error internally for diagnostics.
    3.  Optionally, inject a new task into the system to represent the failure, e.g., `<(grounding_failed, {self.temperature}) --> true>.`. This allows the system to reason about its own operational failures.

### Internal Robustness

While the core logic is designed to be consistent, the system should be defensive against unexpected states.

-   **Assertion-Based Programming:** Critical functions will use assertions to validate their invariants. For example, the inference engine will assert that a rule only produces a task if its `canApply` method returned true.
-   **Graceful Degradation:** In the event of a non-fatal internal error, the system will log the error and attempt to continue the reasoning cycle, skipping the failed operation. This is preferable to a full crash, in line with the principle of operating under insufficient resources (which includes imperfect code).
