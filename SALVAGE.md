# HyperNARS Salvage Plan

## 1. Introduction

This document outlines a comprehensive plan to create a `DESIGN.md` specification for a new, clean-room reimplementation of the HyperNARS reasoning system. The goal of this salvage operation is to learn from the existing experimental codebase, extracting its valuable design concepts and architectural ideas, while systematically addressing its shortcomings. The final `DESIGN.md` will serve as the blueprint for a robust, maintainable, and theoretically sound NARS implementation.

## 2. Core Principles for the New Design

The new implementation will be guided by the following principles:

*   **Modularity and Extensibility:** All components of the system (e.g., memory, inference engine, contradiction manager) will be designed as independent modules with well-defined, stable interfaces. This will allow for future extensions and alternative implementations of any given component.
*   **Testability:** The architecture must be designed from the ground up to be easily testable. This includes providing interfaces for inspecting internal state, injecting dependencies, and running components in isolation. Unit tests will be a primary development artifact.
*   **Clarity and Simplicity:** The design will prioritize clear, maintainable, and well-documented code. This stands in contrast to the previous "no comments" policy and a focus on syntactic elegance over readability.
*   **Theoretical Soundness:** The implementation must be grounded in the established principles of the Non-Axiomatic Reasoning System (NARS), as detailed in publications by its creators and the research community.
*   **Language Agnostic Specification:** The `DESIGN.md` will be specified in a language-agnostic manner, using diagrams, formal definitions, and pseudocode, so that it can serve as a guide for an implementation in any suitable high-level language (e.g., Java, TypeScript, Python).

## 3. Phase 1: Analysis & Knowledge Extraction

This phase focuses on systematically dissecting the existing HyperNARS implementation and its associated documents to salvage all valuable knowledge.

*   **Task A: Synthesize Enhancement Proposals:** Conduct a thorough review of all `doc/enhance.*.md` files. The objective is to extract, cluster by topic (e.g., "Temporal Reasoning," "Contradiction Management"), de-duplicate, and synthesize all proposed features into a single, structured document of "salvaged ideas." This will form the basis for the advanced features in the new design.
*   **Task B: Deconstruct Core Implementation:** Analyze the `src` directory to document the current "as-is" architecture. This includes mapping out the core data structures (`TruthValue`, `Budget`, `Hyperedge`), the control flow of the reasoning cycle (`System.js`), the module loading mechanism, and the public API surface (`NAR.js`).
*   **Task C: Catalog Existing Test Scenarios:** Review the extensive `src/tests/` directory. Instead of analyzing the code, the goal is to extract the high-level reasoning scenarios and questions they represent (e.g., "basic deduction," "temporal sequence reasoning"). This catalog will become a valuable acceptance test suite for the new implementation.

## 4. Phase 2: External Research & Best Practices

To ensure the new design is robust and avoids common pitfalls, this phase involves looking outside the existing codebase.

*   **Task A: Review NARS Literature:** Consult key publications on NARS (e.g., from Pei Wang and the OpenNARS community) to ensure the new design is theoretically sound and aligns with the core principles of the model.
*   **Task B: Analyze Other NARS Implementations:** Investigate other major open-source NARS projects (e.g., OpenNARS, ONA). The goal is to learn from their design choices, architectural patterns, and implementation strategies.

## 5. Phase 3: `DESIGN.md` Specification

This phase involves writing the actual `DESIGN.md` document, which will be the primary blueprint for the reimplementation. It will contain the following sections:

*   **Component 1: System Architecture:** A high-level diagram and description of the major components (Memory, Inference Engine, Control Unit, etc.) and their interactions.
*   **Component 2: Core Data Structures:** Formal, language-agnostic definitions for all core data types, including Term, Statement, Task, Concept, Belief, Budget, and TruthValue. These definitions should emphasize immutability where appropriate.
*   **Component 3: The Reasoning Cycle:** A detailed flowchart and step-by-step description of the system's main control loop, from task selection to inference and activation spreading.
*   **Component 4: Inference Engine & Rules:** A formal specification of each supported inference rule, including its preconditions, operation, and the formula for the resulting truth value. It should also specify the mechanism for selecting and applying rules.
*   **Component 5: Memory System:** A detailed design for the concept-based memory, including data structures for storing concepts and beliefs, and the algorithms for spreading activation and managing forgetting.
*   **Component 6: Public API:** A clear, language-agnostic API specification for all external interactions, including inputting NAL sentences, asking questions, configuring the system, and retrieving explanations.

## 6. Phase 4: Development & Testing Strategy

This section will propose a staged, test-driven development plan to ensure the new implementation is built in a structured and verifiable manner.

*   **Milestone 1: The Foundational Layer:** Implement the core data structures as defined in `DESIGN.md`. This layer must be covered by a comprehensive suite of unit tests before any other development proceeds.
*   **Milestone 2: The System Scaffold:** Implement the main reasoning cycle and memory structures, but without any active inference rules. Tests will verify that tasks are selected, budgets are handled, and activation spreads correctly according to the design.
*   **Milestone 3: Basic Inference:** Incrementally add the most fundamental inference rules (e.g., deduction, abduction, induction). Use the "scenario tests" cataloged in Phase 1 as the basis for integration tests, practicing Test-Driven Development (TDD).
*   **Milestone 4: Advanced Features:** Layer on the advanced modules (e.g., temporal reasoning, contradiction management) one by one. Each module must be developed with its own dedicated set of unit and integration tests.
*   **Milestone 5: The Public API:** Implement the public-facing API, ensuring it matches the specification in `DESIGN.md`.
