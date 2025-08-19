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

The system is composed of a central **Reasoning Kernel** surrounded by a suite of specialized **Cognitive Managers**. Communication between managers and the kernel will be handled via a well-defined event-based system to ensure loose coupling.

### Event-Based Communication
The Reasoning Kernel will emit events at key points in the reasoning cycle. Cognitive Managers subscribe to these events to perform their functions.
- `task-selected(task)`
- `belief-revised(statement, newBelief, oldBelief)`
- `contradiction-detected(statement, belief1, belief2)`
- `concept-activated(concept)`
- `system-idle()`

Managers can inject new tasks into the system via a dedicated `Kernel.addTask(task)` method.

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

The Cognitive Managers are specialized modules that handle complex, cross-cutting concerns. They operate by subscribing to events from the Reasoning Kernel and can inject new tasks back into the system.

-   **Goal Manager**: Manages the system's goals, decomposing them into sub-goals and generating tasks to satisfy them.
-   **Temporal Reasoner**: Provides a comprehensive framework for understanding and reasoning about time. It handles not just simple before/after relationships but also temporal intervals, durations, and predictive projections based on recurring patterns.
-   **Learning Engine**: Responsible for abstracting knowledge, forming new concepts, and adapting existing rules based on experience.
-   **Contradiction Manager**: Implements sophisticated, evidence-based strategies for detecting and resolving contradictions. Instead of simple resolution, it analyzes evidence strength, source reliability, and recency to make a judgment.
-   **Meta Reasoner**: Acts as the system's "cognitive executive." It monitors the system's overall performance, tracking metrics like inference rate and contradiction rate. Based on this analysis, it can dynamically adapt the system's reasoning strategies to optimize performance and resource allocation.
-   **Explanation System**: Generates human-readable explanations for the system's conclusions. It can produce multi-format explanations (concise, detailed, technical) that include the full derivation path, confidence levels, and alternative or contradictory perspectives.

## 2. Core Data Structures

The core data structures will be designed as immutable objects to ensure functional purity and thread safety.

```typescript
// A unique identifier for a term, typically a string.
type Term = string;

// A statement of a relationship between a subject and a predicate.
interface Statement {
    readonly subject: Term;
    readonly predicate: Term;
    readonly type: 'inheritance' | 'similarity' | 'implication'; // etc.
    toString(): string; // e.g., "<bird --> flyer>"
}

// Represents the epistemic value of a statement.
class TruthValue {
    readonly f: number; // frequency in [0, 1]
    readonly c: number; // confidence in (0, 1)
    readonly d: number; // doubt in [0, 1] (optional)

    constructor(f: number, c: number, d: number = 0);
    get e(): number; // expectation, adjusted for doubt

    static revise(t1: TruthValue, t2: TruthValue): TruthValue {
        const f1 = t1.f, c1 = t1.c;
        const f2 = t2.f, c2 = t2.c;
        const new_f = (f1*c1*(1-c2) + f2*c2*(1-c1)) / (c1*(1-c2) + c2*(1-c1));
        const new_c = c1*(1-c2) + c2*(1-c1);
        // Doubt increases with conflicting evidence
        const new_d = Math.min(1, (t1.d + t2.d) * 0.5 + Math.abs(f1 - f2) * 0.5);
        return new TruthValue(new_f, new_c, new_d);
    }
    // ... other NAL truth functions
}

// Represents the allocation of computational resources.
class Budget {
    readonly priority: number;   // in [0, 1]
    readonly durability: number; // in [0, 1]
    readonly quality: number;    // in [0, 1]

    constructor(priority: number, durability: number, quality: number);

    /**
     * Dynamically allocates a budget for a task based on its type,
     * the current system context, and overall system load.
     * @param task The task to be budgeted.
     * @param context An object containing contextual factors like
     *                { urgency, importance, noveltyScore, systemLoad }.
     */
    static dynamicAllocate(task: Task, context: object): Budget;

    /**
     * Merges two budgets, for example when a new task is derived from two parents.
     * The default strategy is to average the components.
     */
    static merge(b1: Budget, b2: Budget): Budget;
}

// An immutable pairing of a Statement and a TruthValue.
interface Belief {
    readonly statement: Statement;
    readonly truth: TruthValue;
}

// A work unit for the system.
interface Task {
    readonly statement: Statement;
    readonly budget: Budget;
    readonly source: Task | 'input'; // Provenance
}

// A node in the memory graph representing a Term.
interface Concept {
    readonly term: Term;
    readonly beliefs: Map<string, Belief>;
    readonly taskQueue: PriorityQueue<Task>;
    readonly activation: number;

    addBelief(belief: Belief): void;
    addTask(task: Task): void;
    getBelief(statement: Statement): Belief | undefined;
}
```

## 3. The Reasoning Cycle (Control Unit)

The reasoning cycle is the main loop of the system, orchestrated by the Control Unit.

```pseudocode
function reasoningCycle() {
  while (system.isRunning) {
    // HOOK: beforeCycle
    hooks.run('beforeCycle', system);

    // 1. Task Selection from Memory
    // Tasks are selected from a priority queue. Their budgets are allocated
    // dynamically via Budget.dynamicAllocate() when they are first created,
    // considering task type, context, and system load.
    task = memory.selectTaskFromOverallExperience();
    if (!task) { system.wait(); continue; }
    hooks.run('afterTaskSelection', task);

    // 2. Concept Selection from Memory
    concept = memory.getConcept(task.statement.subject);
    if (!concept || concept.beliefs.isEmpty()) continue;

    // 3. Local Inference
    belief = concept.selectBelief(task);
    // HOOK: beforeInference
    derivedTasks = inferenceEngine.applyAllRules(task, belief);

    // 4. Process & Store Derived Tasks
    for (derivedTask in derivedTasks) {
      targetConcept = memory.getOrCreateConcept(derivedTask.statement.subject);

      // HOOK: beforeTaskAdd
      derivedTask = hooks.run('beforeTaskAdd', derivedTask);

      targetConcept.addTask(derivedTask);
    }

    // HOOK: afterCycle
    hooks.run('afterCycle', system);
  }
}
```

## 4. Inference Engine

The Inference Engine applies NAL rules. It is a stateless, extensible component.

-   **Extensible Rule System**: The engine will use a registry `Map<string, InferenceRule>` where new rules can be added at runtime via `registerRule`.
-   **Rule Categories**:
    -   **Core Syllogistic & Conditional Rules**: Deduction, Induction, Abduction, Analogy, etc.
    -   **Compositional Rules**: Intersection, Union.
    -   **Advanced Temporal Reasoning**: The system moves beyond simple "before/after" rules. Temporal reasoning is primarily handled by the `TemporalReasoner` manager, which implements a form of **Allen's Interval Algebra**. It supports all 13 interval relations (meets, overlaps, during, etc.). The system performs temporal constraint propagation and can predict future events based on learned patterns and recurring events (e.g., "daily", "weekly").

-   **Self-Optimizing Rule System**: To ensure efficiency, the Inference Engine will feature a self-optimizing mechanism.
    -   **Performance Tracking**: The system will monitor the success rate and applicability of each inference rule. A "successful" inference is one that leads to a useful conclusion (e.g., one that answers a question or resolves a contradiction).
    -   **Dynamic Prioritization**: The budget allocated to tasks derived by a rule will be weighted by the rule's historical success rate. Rules that are more effective will be favored, while inefficient or noisy rules will be used more sparingly.
    -   This feedback loop allows the system to adapt its reasoning strategy based on the specific problem domain.

```typescript
interface InferenceRule {
  // A unique name for the rule
  readonly name: string;

  // Checks if the rule can be applied to the given premises
  canApply(premise1: Task, premise2: Belief): boolean;

  // Applies the rule and returns a new derived Task
  apply(premise1: Task, premise2: Belief): Task | null;
}
```

## 5. Memory System

The Memory System is a concept graph managed by several algorithms.

-   **Concept Graph**: A collection of `Concept` objects, indexed by `Term` for efficient lookup.
-   **Activation Spreading**: An algorithm to manage attention. Activation spreads from a processed concept to its directly related concepts.
    -   `Activation_new(C) = Activation_old(C) * (1 - decay_rate) + InputActivation`
-   **Forgetting Algorithm**: Periodically removes tasks and beliefs with low "relevance".
    -   `Relevance = priority * activation`
-   **Contradiction Handling**: Managed by the `ContradictionManager`, this is a sophisticated, multi-stage process designed to handle conflicting information robustly.
    -   **1. Detection**: The manager subscribes to `belief-revised` events. When a new belief is added that contradicts an existing one, the contradiction is logged.
    -   **2. Evidence-Based Analysis**: The system does not use a single, fixed resolution strategy. Instead, it first calculates an `evidenceStrength` for each conflicting belief. This metric synthesizes multiple factors:
        -   The belief's intrinsic truth value (frequency and confidence).
        -   The strength and recency of external evidence supporting the belief.
        -   The historical reliability of the information sources.
    -   **3. Strategy Selection**: Based on the evidence analysis, the manager selects the most appropriate strategy from a pool of options, including:
        -   **DominantEvidence**: If one belief is backed by significantly stronger evidence, it wins.
        -   **Merge**: If beliefs have comparable evidence, their truth values are merged.
        -   **Specialize**: If contradictions appear to arise from different contexts, the system may create a new, more specific concept to resolve the conflict (e.g., `<penguin --> flyer>` might be false, but `<penguin(in_water) --> flyer>` might be true in the sense of "flying" through water).
        -   **SourceReliability**: Prioritizes the belief from the more reliable source.
        -   **RecencyBiased**: Gives preference to the most recent information.
    -   **4. Resolution**: The chosen strategy is executed, which may result in revising beliefs, deleting beliefs, or creating new concepts. This entire process is designed to be extensible, allowing new resolution strategies to be added.

## 6. I/O and Public API

The public API will be designed to be clean, language-agnostic, and powerful. It will be event-driven and asynchronous.

-   **Input/Output API**:
    -   `nal(statement: string, options?: object): Promise<InputResult>`: Asynchronously inputs a NAL statement. The `options` object can provide context like `{ timestamp, source, truth, budget }`.
    -   `nalq(question: string, options?: object): Promise<Answer>`: Asks a NAL question. The `options` can specify query parameters like `{ timeout, urgency }`.
    -   `on(event: 'answer' | 'contradiction' | 'goal-achieved', callback: (data: any) => void): void`: Subscribes to system events.
-   **Control & Configuration API**:
    -   `run(steps: number): Promise<void>`: Runs the reasoning cycle for a number of steps.
    -   `pause(): void` / `resume(): void`: Controls the reasoning loop.
    -   `setConfig(key: string, value: any): void`: Dynamically changes system parameters (e.g., budget thresholds, strategy flags).
    -   `configureStrategy(config: object): void`: Configures when to apply specific reasoning strategies based on context.
-   **Inspection & Explainability API**:
    -   `getConcept(term: string): Promise<Concept | null>`: Retrieves the full state of a concept.
    -   `getBeliefs(statement: string): Promise<Belief[]>`: Gets all beliefs for a given statement.
    -   `getMetrics(): Promise<SystemMetrics>`: Returns detailed metrics on performance, memory usage, contradiction rates, etc.
    -   `explain(statement: string, options?: ExplainOptions): Promise<Explanation>`: Returns a rich, structured explanation for a belief. This is a core feature for transparency and debugging.

-   **Example API Usage**:
    ```javascript
    const nar = new HyperNARS();
    nar.on('answer', (ans) => console.log('Answer found:', ans.statement.toString()));

    await nar.nal('<bird --> animal>.', { source: 'user_input' });
    await nar.nal('<penguin --> bird>.');

    const answer = await nar.nalq('<penguin --> animal>?');

    // Get a detailed, human-readable explanation
    const explanation = await nar.explain(answer.statement.toString(), { format: 'detailed' });
    console.log(explanation.summary);

    // Get a counterfactual explanation
    const counterfactual = await nar.explain(answer.statement.toString(), {
      perspective: 'counterfactual',
      alternative: '<penguin --> mammal>.'
    });
    console.log(counterfactual);
    ```

```typescript
// Options for the explain() method
interface ExplainOptions {
  format?: 'detailed' | 'concise' | 'technical' | 'json' | 'story';
  perspective?: 'evidential' | 'causal' | 'counterfactual';
  depth?: number;
  maxAlternatives?: number;
  // Used for counterfactual perspective
  alternative?: string;
}

// The rich object returned by the explain() method
interface Explanation {
  // The conclusion being explained
  conclusion: Statement;
  // A human-readable summary of the reasoning path
  summary: string;
  // The detailed, tree-structured derivation path
  derivationPath: DerivationStep[];
  // Any alternative or conflicting beliefs about the conclusion
  alternativePaths: DerivationStep[][];
  // The temporal context in which the reasoning occurred
  temporalContext: object;
  // The raw data for visualization libraries
  visual?: { nodes: object[], edges: object[] };
}

interface DerivationStep {
    id: string;
    type: string;
    args: string[];
    truth: TruthValue;
    derivationRule: string;
    premises: DerivationStep[];
}
```

## 7. Extension Points

The system will be designed for extensibility through a plugin architecture.

-   **Cognitive Managers**: The primary extension point. A manager must conform to a `CognitiveManager` interface and can be registered with the system.
-   **Derivation Rules**: `inferenceEngine.registerRule(rule: InferenceRule)`.
-   **Truth Value & Budget Formulas**: The core formulas can be overridden via configuration.
-   **Symbol Grounding**: The `SymbolGroundingInterface` will define methods like `groundTerm(term: Term, data: any)` that modules can implement.
-   **Hooks**: The reasoning cycle will have well-defined hooks.

- **Example Plugin (`MetaReasoner`)**
    ```typescript
    class AdvancedMetaReasoner implements CognitiveManager {
        private nar: HyperNARS_API;

        constructor(nar: HyperNARS_API) {
            this.nar = nar;
            // Periodically run self-monitoring
            setInterval(() => this.selfMonitor(), 10000);
        }

        private async selfMonitor() {
            const metrics = await this.nar.getMetrics();
            const issues = [];

            // 1. Detect issues based on metrics
            if (metrics.contradictionRate > 0.3) {
                issues.push('high-contradiction-rate');
            }
            if (metrics.inferenceRate < 10) { // inferences per second
                issues.push('low-inference-rate');
            }
            if (metrics.memoryUsage > 0.9) {
                issues.push('high-memory-pressure');
            }

            // 2. Adapt reasoning strategy if issues are detected
            if (issues.length > 0) {
                this.adaptReasoning(issues, metrics);
            }
        }

        private adaptReasoning(issues: string[], metrics: SystemMetrics) {
            if (issues.includes('high-contradiction-rate')) {
                // If contradiction rate is high, be more skeptical.
                // Increase the confidence threshold for accepting new beliefs.
                const currentThreshold = this.nar.getConfig('newBeliefConfidenceThreshold');
                this.nar.setConfig('newBeliefConfidenceThreshold', currentThreshold * 1.2);
            }

            if (issues.includes('low-inference-rate')) {
                // If inference is slow, be less selective to encourage exploration.
                const currentThreshold = this.nar.getConfig('taskSelectionBudgetThreshold');
                this.nar.setConfig('taskSelectionBudgetThreshold', currentThreshold * 0.9);
            }
        }
    }
    ```
