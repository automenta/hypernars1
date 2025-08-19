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
    readonly p: number; // priority in [0, 1]
    readonly d: number; // durability in [0, 1]
    readonly q: number; // quality in [0, 1]

    constructor(p: number, d: number, q: number);
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
    -   **Syllogistic Rules**: Deduction, Induction, Abduction, Exemplification.
    -   **Conditional Rules**: Analogy, Resemblance, Detachment.
    -   **Compositional Rules**: Intersection, Union.
    -   **Temporal Rules**: Sequence, Before/After.
-   **Example Rule (Analogy)**:
    -   **Premises**: `<M --> P>` and `<S <-> M>`
    -   **Conclusion**: `<S --> P>`
    -   **Truth Value Function**: `f = f1 * f2`, `c = c1 * c2 * f2`

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
-   **Contradiction Handling**: Managed by the `ContradictionManager`. It subscribes to `belief-revised` events.
    -   **Example Strategy (Source Reliability)**:
        ```pseudocode
        function resolveBySourceReliability(belief1, belief2) {
            reliability1 = getSourceReliability(belief1.source);
            reliability2 = getSourceReliability(belief2.source);

            if (abs(reliability1 - reliability2) > RELIABILITY_THRESHOLD) {
                // Suppress the less reliable belief
                suppressBelief(reliability1 > reliability2 ? belief2 : belief1);
            } else {
                // Merge with weighted confidence
                mergeBeliefs(belief1, belief2, [reliability1, reliability2]);
            }
        }
        ```

## 6. I/O and Public API

The public API will be designed to be clean, language-agnostic, and powerful. It will be event-driven and asynchronous.

-   **Input/Output API**:
    -   `nal(statement: string): Promise<InputResult>`: Asynchronously inputs a NAL statement.
    -   `nalq(question: string, options?: QueryOptions): Promise<Answer>`: Asks a NAL question.
    -   `on(event: 'answer' | 'contradiction' | 'goal-achieved', callback: (data: any) => void): void`: Subscribes to system events.
-   **Control & Configuration API**:
    -   `run(steps: number): Promise<void>`: Runs the reasoning cycle for a number of steps.
    -   `pause(): void` / `resume(): void`: Controls the reasoning loop.
    -   `setConfig(key: string, value: any): void`: Dynamically changes system parameters.
-   **Inspection & Explainability API**:
    -   `getConcept(term: string): Promise<Concept | null>`: Retrieves the full state of a concept.
    -   `getBeliefs(statement: string): Promise<Belief[]>`: Gets all beliefs for a given statement.
    -   `explain(statement: string, options?: ExplainOptions): Promise<Explanation>`: Returns a structured explanation object.
    -   `getSystemHealth(): Promise<SystemStatus>`: Returns metrics on performance and memory.

-   **Example API Usage**:
    ```javascript
    const nar = new HyperNARS();
    nar.on('answer', (ans) => console.log('Answer found:', ans.statement.toString()));

    await nar.nal('<bird --> animal>.');
    await nar.nal('<penguin --> bird>.');

    const answer = await nar.nalq('<penguin --> animal>?');
    console.log(answer.truth.e); // Expectation of the answer

    const explanation = await nar.explain(answer.statement.toString());
    console.log(explanation.summary);
    ```

```typescript
interface Explanation {
  conclusion: Statement;
  confidence: number;
  derivationPath: DerivationStep[];
  alternativePaths: DerivationStep[][];
  // Natural language summary
  summary: string;
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
    class SimpleMetaReasoner implements CognitiveManager {
        private nar: HyperNARS_API;
        private performanceLog: Map<string, number> = new Map();

        constructor(nar: HyperNARS_API) {
            this.nar = nar;
            this.nar.getHooks().register('afterCycle', () => this.analyzePerformance());
        }

        private analyzePerformance() {
            const health = this.nar.getSystemHealth();
            if (health.inferenceQueue > 1000) {
                // If queue is too long, increase the budget threshold to be more selective
                const currentThreshold = this.nar.getConfig('budgetThreshold');
                this.nar.setConfig('budgetThreshold', currentThreshold * 1.1);
            }
        }
    }
    ```
