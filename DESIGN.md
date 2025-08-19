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
```
+-------------------------------------------------+
|              Application Layer (UI, API)        |
+-------------------------------------------------+
|                 Cognitive Managers              |
| +-----------------+ +-------------------------+ |
| | Goal Manager    | | Temporal Reasoner       | |
| +-----------------+ +-------------------------+ |
| | Learning Engine | | Contradiction Manager   | |
| +-----------------+ +-------------------------+ |
| | Meta Reasoner   | | Explanation System      | |
| +-----------------+ +-------------------------+ |
+-------------------------------------------------+
|                   Reasoning Kernel              |
| +-----------------+ +-------------------------+ |
| | Control Unit    | | Inference Engine        | |
| | (Reasoning Cycle) | | (NAL Rules)           | |
| +-----------------+ +-------------------------+ |
| |                 Memory System               | |
| |                 (Concept Graph)             | |
| +---------------------------------------------+ |
+-------------------------------------------------+
|             Symbol Grounding Interface          |
+-------------------------------------------------+
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
// A unique identifier for a term. Can be a simple string or a compound term.
type Term = string;

// A statement of a relationship between terms. This is a generic interface;
// specific statement types will implement it.
interface Statement {
    // A unique, canonical string representation of the statement, used for hashing.
    readonly key: string;
    // An array of terms involved in the statement.
    readonly terms: Term[];
    // The type of copula connecting the terms.
    readonly copula: 'inheritance' | 'similarity' | 'implication' | 'equivalence';
    // Returns a human-readable string, e.g., "<bird --> animal>".
    toString(): string;
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
        const c_rev = c1 * (1 - c2) + c2 * (1 - c1);
        const f_rev = (f1 * c1 * (1 - c2) + f2 * c2 * (1 - c1)) / c_rev;
        // Doubt is increased by conflicting evidence and merged from parents.
        const d_conflict = Math.abs(f1 - f2) / 2;
        const d_rev = 1 - (1 - d1) * (1 - d2) * (1 - d_conflict);
        return new TruthValue(f_rev, c_rev, d_rev);
    }

    // NAL Projection: Calculates truth for a component of a compound term.
    static project(t: TruthValue, numComponents: number): TruthValue {
        // A simplified projection; actual formula may be more complex.
        const c_proj = t.c / Math.sqrt(numComponents);
        return new TruthValue(t.f, c_proj, t.d);
    }

    // NAL Conjunction (Intersection): Combines two statements conjunctively.
    static and(t1: TruthValue, t2: TruthValue): TruthValue {
        const f = t1.f * t2.f;
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
     */
    static dynamicAllocate(context: { type: string, novelty: number, urgency: number, parentQuality: number }): Budget {
        let priority = 0.5, durability = 0.5, quality = context.parentQuality;
        if (context.type === 'input') {
            priority = 0.7 * context.urgency + 0.3 * context.novelty;
            durability = 0.5;
        } else if (context.type === 'goal') {
            priority = 0.9 * context.urgency;
            durability = 0.9;
        } else { // 'derived'
            priority = 0.5 * context.parentQuality + 0.2 * context.novelty;
            durability = 0.3 * context.parentQuality;
        }
        return new Budget(priority, durability, quality);
    }

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
}

// A node in the memory graph, representing a single Term.
interface Concept {
    readonly term: Term;
    // All beliefs directly related to this concept, indexed by statement key.
    readonly beliefs: Map<string, Belief>;
    // A queue of tasks to be processed, prioritized by budget.
    readonly taskQueue: PriorityQueue<Task>;
    // The current activation level of the concept.
    readonly activation: number;

    // Adds a new belief, revising if a related one exists.
    addBelief(belief: Belief): void;
    // Adds a task to the priority queue.
    addTask(task: Task): void;
    // Selects the highest-priority task from the queue.
    selectTask(): Task | null;
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
    // Use case: Logging, system state snapshot.
    kernel.hooks.run('beforeCycle', cycleContext);

    // 1. Select a Concept and a Task from memory.
    // This is a two-step process to balance between overall priority and
    // local context. First, a concept is chosen, then a task from it.
    let { concept, task } = kernel.memory.selectTaskFromOverallExperience();
    if (!task || !concept) {
        kernel.events.emit('system-idle', { idleDuration: 100 });
        kernel.wait(100); // Wait if no task is available.
        continue;
    }
    cycleContext.task = task;
    cycleContext.concept = concept;

    // HOOK: afterTaskSelection (read-only context)
    // Use case: Meta-reasoning about task selection patterns.
    kernel.hooks.run('afterTaskSelection', cycleContext);
    kernel.events.emit('task-selected', { task });

    // 2. Select a Belief from the chosen Concept to interact with the Task.
    // The belief should be relevant to the task. A common heuristic is to
    // select a belief that shares a term with the task's statement and has
    // high confidence.
    let belief = concept.selectBeliefForTask(task);
    if (!belief) continue; // No relevant belief found.
    cycleContext.belief = belief;

    // 3. Perform Local Inference.
    // The Inference Engine applies all matching rules to the task and belief.
    // The context is mutable here, allowing hooks to modify the premises.
    // HOOK: beforeInference (mutable context)
    // Use case: A Cognitive Manager could adjust the task's budget here.
    cycleContext = kernel.hooks.run('beforeInference', cycleContext);
    let derivedTasks = kernel.inferenceEngine.applyAllRules(cycleContext.task, cycleContext.belief);
    cycleContext.derivedTasks = derivedTasks;

    // 4. Process and Store Derived Tasks.
    for (let derivedTask of cycleContext.derivedTasks) {
      // The context passed to the hook is mutable.
      let taskContext = { derivedTask };
      // HOOK: beforeTaskProcessing (mutable context)
      // Use case: A learning manager could flag the task for generating a new concept.
      taskContext = kernel.hooks.run('beforeTaskProcessing', taskContext);

      // Add the (potentially modified) task to the appropriate concept.
      let targetConcept = kernel.memory.getOrCreateConcept(taskContext.derivedTask.statement.terms[0]);
      targetConcept.addTask(taskContext.derivedTask);
    }

    // 5. System-level cleanup and updates.
    // HOOK: afterCycle (read-only context)
    // Use case: Update system metrics, check for goal satisfaction.
    kernel.hooks.run('afterCycle', cycleContext);
  }
}
```

## 4. Inference Engine

The Inference Engine is a stateless, extensible component responsible for applying Non-Axiomatic Logic (NAL) rules to derive new knowledge from existing beliefs.

### Core Principles
-   **Extensible Rule System**: The engine will use a central registry, `Map<string, InferenceRule>`, where new rules can be added at runtime via `kernel.inferenceEngine.registerRule(rule)`. This allows for the system's reasoning capabilities to be expanded or modified.
-   **Self-Optimizing Rule Application**: To manage resource allocation under AIKR, the engine will feature a self-optimizing mechanism. It will track the historical success rate (i.e., utility) of each inference rule. The budget allocated to tasks derived by a rule will be weighted by its success rate, prioritizing rules that have proven more effective in the current context.

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
    1.  A task `T1` with statement `<M --> P>`.
    2.  A belief `B1` with statement `<S --> M>`.
-   **Conclusion**: A new task `T2` with statement `<S --> P>`.

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

        const s1 = task.statement; // <M --> P>
        const s2 = belief.statement; // <S --> M>

        // 1. Create the new statement: <S --> P>
        const derivedStatement: Statement = {
            key: `<${s2.terms[0]} --> ${s1.terms[1]}>`,
            terms: [s2.terms[0], s1.terms[1]],
            copula: 'inheritance',
            toString: () => `<${s2.terms[0]} --> ${s1.terms[1]}>`
        };

        // 2. Calculate the new truth value
        const t1 = task.parentBeliefs[0].truth; // Assuming task has truth
        const t2 = belief.truth;
        const f_new = t1.f * t2.f;
        const c_new = t1.c * t2.c * t1.f; // Asymmetric confidence calculation
        const derivedTruth = new TruthValue(f_new, c_new);

        // 3. Calculate the new budget
        const b1 = task.budget;
        const b2 = belief.budget; // Note: Beliefs don't have budgets, this is a simplification.
                                  // In reality, we'd use the concept's budget or a default.
        const quality_new = b1.quality * b2.quality;
        const derivedBudget = Budget.dynamicAllocate({
            type: 'derived',
            novelty: 0.5, // This should be calculated based on memory
            urgency: (b1.priority + b2.priority) / 2,
            parentQuality: quality_new
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

## 5. Memory System

The Memory System is the core of the system's knowledge base, structured as a dynamic concept graph and managed by several competing algorithms to adhere to AIKR.

-   **Concept Graph**: The memory is an **implicit graph** where `Concept` objects are the nodes. The edges are not explicitly stored; instead, they are represented by the `Beliefs` held within each concept. A belief in a statement like `<A --> B>` acts as a directed link from Concept A to Concept B. This structure allows for a flexible, sparsely connected network. Concepts are stored in a hash map, indexed by their `Term` for O(1) average-time lookup.

-   **Activation Spreading**: This is the mechanism for managing the system's focus of attention. When a concept is accessed, a portion of its activation energy is spread to related concepts.
    -   `Activation_new(C) = Activation_old(C) * (1 - decay_rate) + Sum(Activation_in(S, C))`
    -   `Activation_in(S, C)` is the activation transferred from a source concept `S` to target `C`. It is proportional to the budget of the task that triggered the spread and the relevance of the belief linking `S` and `C`.
    -   `decay_rate` is a system parameter that determines how quickly concepts lose activation over time.

-   **Forgetting Algorithm**: To manage finite memory resources, the system must forget less important information. This is a continuous, gentle process rather than a periodic "garbage collection" sweep.
    -   **Relevance Metric**: The importance of any item (a `Belief` or `Task`) in a concept is its `Relevance`, calculated as: `Relevance = budget.priority * concept.activation`. This metric combines short-term importance (activation) with long-term importance (priority/durability).
    -   **Forgetting Process**: When a new item is added to a concept and the concept's memory capacity is exceeded, the item with the lowest `Relevance` score is removed. This ensures that the most relevant information is retained. The memory capacity of a concept can be dynamic, potentially growing as the concept becomes more important.

-   **Contradiction Handling**: This is managed by the `ContradictionManager` and is a sophisticated, multi-stage process. When a `contradiction-detected` event is fired, the manager executes the following logic:

    -   **1. Detection**: A contradiction is detected when a new belief `B1` is processed that has the same statement as an existing belief `B2` but a sufficiently different truth-value (e.g., one is positive evidence, the other is negative).

    -   **2. Evidence-Based Analysis**: The manager calculates an `evidenceStrength` for each conflicting belief, synthesizing factors like `truth.confidence`, `truth.recency`, and the reliability of the information source (if available).

    -   **3. Strategy Selection & Resolution**: Based on the analysis, a strategy is chosen. This is a rule-based decision process:
        -   **IF** `strength(B1) >> strength(B2)` **THEN** apply **DominantEvidence**: The weaker belief `B2` is removed. The budget of `B1` is boosted.
        -   **IF** `strength(B1) ~= strength(B2)` **THEN** apply **Merge**: The truth values of `B1` and `B2` are revised together using `TruthValue.revise()`. The resulting belief replaces the old one. The doubt (`d`) component of the new truth value will naturally increase, indicating uncertainty.
        -   **IF** `B1` is a general statement (e.g., `<bird --> flyer>`) and `B2` is a more specific, conflicting statement (e.g., `<penguin --> flyer>`), **THEN** apply **Specialize**: The system does not simply discard the general rule. Instead, it reduces the confidence of `<bird --> flyer>` and may generate a new task to investigate this exception, potentially leading to new knowledge like `<(bird, not penguin) --> flyer>`.
        -   **IF** `source(B1)` is more reliable than `source(B2)` **THEN** apply **SourceReliability**: Give precedence to `B1`, but do not necessarily discard `B2`. Instead, significantly lower the budget of `B2`.
        -   **IF** strategies above are inconclusive, **THEN** apply **RecencyBiased**: Give a slight budget advantage to the more recent belief.

    This entire process is designed to be extensible, allowing new resolution strategies to be added as plugins to the `ContradictionManager`.

## 6. I/O and Public API

The public API will be designed to be clean, language-agnostic, and powerful. It will be event-driven and asynchronous.

-   **Input/Output API**:
    -   `nal(statement: string, options?: object): Promise<InputResult>`: Asynchronously inputs a NAL statement.
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
    "statement": "<penguin --> animal>",
    "truth": { "f": 0.9, "c": 0.81, "d": 0.0 }
  },
  "ruleName": "NAL_DEDUCTION_FORWARD",
  "premises": [
    {
      "conclusion": {
        "statement": "<bird --> animal>",
        "truth": { "f": 1.0, "c": 0.9, "d": 0.0 }
      },
      "ruleName": "INPUT",
      "premises": []
    },
    {
      "conclusion": {
        "statement": "<penguin --> bird>",
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
This is the primary extension point for adding high-level functionality. As shown in the "System Architecture" section, managers are classes that subscribe to kernel events and inject tasks to influence reasoning. The `MetaReasoner` example below shows how a manager can implement a self-monitoring and adaptation loop.

### 2. Custom Inference Rules (Fine-Grained)
Developers can add new inference patterns to the system by implementing the `InferenceRule` interface and registering it with the engine.

**Example: A Custom "Transitive Similarity" Rule**
Let's imagine a domain-specific rule: if A is similar to B, and B is similar to C, then A is weakly similar to C.

```typescript
// 1. Define the custom rule
class TransitiveSimilarityRule implements InferenceRule {
    readonly name = "CUSTOM_SIMILARITY_TRANSITIVE";

    canApply(task: Task, belief: Belief): boolean {
        // Ensure both are similarity statements and terms align: A~B, B~C
        return task.statement.copula === 'similarity' &&
               belief.statement.copula === 'similarity' &&
               task.statement.terms[1] === belief.statement.terms[0];
    }

    apply(task: Task, belief: Belief): Task | null {
        if (!this.canApply(task, belief)) return null;

        const s1 = task.statement; // <A <-> B>
        const s2 = belief.statement; // <B <-> C>

        // Create conclusion: <A <-> C>
        const conclusion = createStatement({ subject: s1.terms[0], predicate: s2.terms[1], copula: 'similarity' });

        // Calculate truth: transitive similarity is weaker
        const t1 = task.parentBeliefs[0].truth;
        const t2 = belief.truth;
        const f_new = (t1.f + t2.f) / 2; // Average frequency
        const c_new = t1.c * t2.c * 0.5; // Confidence is significantly reduced
        const truth = new TruthValue(f_new, c_new);

        // Calculate budget
        const budget = Budget.merge(task.budget, belief.budget);
        budget.priority *= 0.5; // Lower priority than a standard deduction

        return createTask({ statement: conclusion, truth, budget, parentBeliefs: [task.parentBeliefs[0], belief] });
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
This interface connects abstract terms to external data or functions. For example, the term `<(*, self, temperature) --> hot>` could be grounded to a sensor.

```typescript
nar.symbolGrounding.groundTerm('hot', (term) => {
    const temp = readTemperatureSensor(); // External function call
    // Return a truth value based on the sensor reading
    if (temp > 40) return new TruthValue(1.0, 0.99);
    return new TruthValue(0.0, 0.99);
});
```
