Excellent. This is a fantastic set of revisions and a very insightful new requirement. Merging the best of both plans and incorporating the self-analysis concept will create a truly robust and forward-looking strategy.

Here is the enhanced plan that incorporates your feedback and ideas.

----

# HyperNARS Salvage & Reimplementation Plan

## 1. Introduction

This document outlines a comprehensive plan to create a `DESIGN.md` specification for a new, clean-room reimplementation of the HyperNARS reasoning system. The goal is to learn from the existing experimental codebase, extracting its valuable design concepts while systematically addressing its shortcomings, such as a lack of modularity, insufficient documentation, and poor testability. The final `DESIGN.md` will serve as the blueprint for a robust, maintainable, and theoretically sound NARS implementation, emphasizing scalability and explainability for real-world applications.

## 2. Guiding Principles for the New Design

The new implementation will be guided by the following principles:

*   **Modularity and Extensibility:** Components (Memory, Inference Engine, I/O) will be designed as independent modules with well-defined, stable interfaces. This will allow for alternative implementations (e.g., different forgetting algorithms) and integration with external systems like machine learning frameworks.
*   **Testability:** The architecture will be designed for testability at all levels. This includes dependency injection, interfaces for inspecting internal state, and support for advanced techniques like **property-based testing** to verify the logical and probabilistic integrity of components like the truth-value functions.
*   **Clarity and Simplicity:** The design will prioritize clear, maintainable, and well-documented code. Documentation will be a first-class artifact, including inline comments, formal API documentation, and architectural overviews.
*   **Theoretical Soundness:** The implementation must be rigorously grounded in the established principles of NARS (e.g., the assumption of insufficient knowledge and resources, AIKR), as detailed in key publications, while being open to incorporating recent, justifiable advancements.
*   **Language Agnostic Specification:** The `DESIGN.md` will use diagrams (e.g., UML, C4 model), formal definitions in mathematical notation, and pseudocode, making it a universal guide for implementation in any suitable language (e.g., Python, Java, Rust).
*   **Performance and Scalability:** The design of core data structures and algorithms will consider computational complexity and memory efficiency to ensure the system can handle large-scale reasoning tasks.
*   **Traceability & Explainability:** The system must be able to explain its reasoning. It must be possible to trace any conclusion back to the premises and inference steps that produced it, which is critical for debugging, validation, and user trust.
*   **Robustness and Error Handling:** The design will include explicit strategies for handling invalid inputs, resource limits (e.g., budget overflows), and contradictions, ensuring the system remains stable and predictable.

## 3. Phase 1: Analysis & Knowledge Extraction

This phase focuses on systematically dissecting the existing HyperNARS implementation to salvage valuable knowledge and document lessons learned.

*   **Task A: Synthesize Enhancement Proposals:** Review all `doc/enhance.*.md` files. Extract, de-duplicate, and cluster all proposed features by topic (e.g., "Temporal Reasoning," "Budget Allocation"). Synthesize these into a structured "Feature Backlog," prioritized by impact and feasibility.
*   **Task B: Deconstruct and Document the "As-Is" Architecture:** Analyze the `src` directory to map out the current architecture. Create UML class diagrams for data structures and sequence diagrams for the reasoning cycle. Crucially, identify and document architectural anti-patterns and code smells (e.g., tight coupling, mutable global state) to create a "lessons learned" document.
*   **Task C: Catalog Test Scenarios as BDD Specifications:** Review the `src/tests/` directory to extract high-level reasoning scenarios. Convert these scenarios into a formal, human-readable format like Gherkin (`Given/When/Then`). This creates a language-agnostic acceptance test suite that defines the system's expected behavior.
*   **Task D: Conduct a Risk and Gap Analysis:** Compile a list of known issues and limitations from the codebase and documentation. Identify theoretical gaps (e.g., missing support for certain NAL levels) and practical gaps (e.g., inefficient memory management) to inform the priorities of the new design.

## 4. Phase 2: External Research & Best Practices

To ensure the new design is robust and state-of-the-art, this phase involves looking beyond the existing codebase.

*   **Task A: Review Foundational NARS Literature:** Consult key publications (e.g., Pei Wang's works) to ensure the new design is rigorously aligned with the core principles of NARS, such as experience-grounded semantics.
*   **Task B: Analyze Other NARS Implementations:** Investigate other major open-source NARS projects (e.g., OpenNARS, ONA). Create a comparative feature matrix to learn from their architectural patterns (e.g., event-driven vs. monolithic cycle), performance optimizations, and extension mechanisms (e.g., plugin systems).
*   **Task C: Incorporate Best Practices from Related Fields:** Research design patterns from adjacent fields. This includes the Actor Model for concurrent concept processing, Event-Driven Architecture for decoupling components, and advanced testing methodologies from probabilistic programming.

## 5. Phase 3: `DESIGN.md` Specification

This is the core phase of writing the detailed technical blueprint for the new system.

**`DESIGN.md` Table of Contents:**

1.  **System Architecture:** A C4 model or similar diagram showing components (Memory, Inference Engine, Control Unit) and their interactions, including data flows and dependency graphs.
2.  **Core Data Structures:** Formal, immutable-first definitions for Term, Statement, Task, Concept, Belief, Budget, and TruthValue, specified with mathematical notation and pseudocode examples.
3.  **The Reasoning Cycle (Control Unit):** A detailed flowchart and step-by-step description of the main control loop, specifying task selection (e.g., via a priority bag), inference, memory updates, and activation spreading. The design will explicitly address opportunities for parallelism.
4.  **Inference Engine:** A formal specification for each inference rule (covering NAL-1 through NAL-8), including its preconditions, operation, and truth-value function. The design must include an extensible mechanism for adding or modifying rules.
5.  **Memory System:** A detailed design for the concept-based memory, specifying data structures (e.g., concept graph), and algorithms for activation spreading, forgetting (e.g., based on durability), and contradiction handling.
6.  **I/O and Public API:** A clear, language-agnostic API for all external interactions, including:
    *   **Input/Output:** A formal grammar (e.g., EBNF) for NAL and methods for submitting tasks.
    *   **Control & Configuration:** Methods for configuring parameters (e.g., budget thresholds) and controlling the reasoning cycle (e.g., step, pause, run).
    *   **Inspection & Explainability:** Methods for querying the internal state of concepts and, crucially, for retrieving the full derivation trace for any given belief.
7.  **Extension Points:** A specification for "hooks" or plugin interfaces for integrating advanced features from the backlog, such as temporal reasoning or procedural learning modules.

## 6. Phase 4: Staged Development & Testing Strategy

This section proposes a staged, test-driven development plan.

*   **Milestone 1: The Foundational Layer:** Implement the core data structures. This layer must be covered by a comprehensive suite of unit tests and property-based tests (e.g., ensuring truth-value revision is commutative and associative).
*   **Milestone 2: The System Scaffold:** Implement the reasoning cycle and memory structures with mocked-out components. Tests will verify that tasks are selected, budgets are handled, and activation spreads correctly according to the design.
*   **Milestone 3: Basic Inference:** Incrementally implement the most fundamental inference rules (deduction, abduction, induction). Use the BDD scenarios from Phase 1 as TDD-style integration tests.
*   **Milestone 4: Advanced Features & Public API:** Layer on advanced modules and the public-facing API. Each module must have dedicated component tests, and the API must be validated with end-to-end tests based on the BDD scenarios.

## 7. Phase 5: Metacognitive Testing & Analysis Framework

A key innovation of this plan is to leverage the reasoning system's capabilities to support its own testing and analysis. The architecture designed in Phase 3 must enable this "metacognitive loop."

*   **Design Requirement:** The **Inspection & Explainability API** (from Phase 3) is critical. It must be rich enough to expose not just final beliefs but also intermediate states, resource usage (memory, CPU per cycle), contradiction rates, and belief revision histories.
*   **Task A: Develop a "Meta-Listener" Harness:** Build a testing tool that observes the stream of data from the Inspection API during test runs. This tool will convert system events (e.g., `(cycle_123, contradiction_count, 5)`) into NAL statements.
*   **Task B: Implement Self-Analysis Scenarios:** Feed the stream of NAL-formatted operational data back into a separate instance of the HyperNARS system (or the same one, carefully partitioned). The system can then be tasked with learning patterns about its own behavior.
    *   **Example 1: Anomaly Detection:** The system learns the "normal" rate of contradictions. If a code change causes a spike, the system can form a high-confidence belief like `(<feature_X_enabled> => <high_contradiction_rate>)`, automatically flagging a potential regression.
    *   **Example 2: Performance Profiling:** The system can learn correlations between certain types of input and high resource usage, e.g., `(<complex_temporal_query> => <high_cycle_duration>)`, helping developers pinpoint performance bottlenecks.
    *   **Example 3: Automated Explanation of Test Failures:** When an E2E test fails (e.g., expected `A`, got `B`), the test harness can automatically query the system: "Why did you conclude `B`?" The system's derivation trace for `B` becomes the primary artifact for the bug report, drastically reducing debugging time.

This approach transforms testing from a simple pass/fail check into a continuous process of automated analysis, where the system helps debug and optimize itself.
