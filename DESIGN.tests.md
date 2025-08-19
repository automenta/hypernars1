# HyperNARS Test Suite Blueprint: DESIGN.tests.md

This document outlines the comprehensive testing strategy for the HyperNARS reimplementation. It serves as a blueprint for ensuring the system's correctness, robustness, and adherence to the principles of Non-Axiomatic Logic.

## 1. Testing Philosophy

The testing strategy for HyperNARS is multi-layered, designed to validate the system at different levels of granularity. This approach ensures that individual components are sound, their integrations are seamless, and the overall system behavior is correct and emergent as expected.

-   **Layer 1: Unit Tests**: At the lowest level, unit tests verify the functional correctness of individual, isolated components. These tests focus on pure functions and classes with minimal dependencies.
    -   *Examples*: `TruthValue` revision formulas, `Budget` allocation logic, individual `InferenceRule` applications.
    -   *Goal*: Ensure that the foundational building blocks of the logic are mathematically and algorithmically correct.

-   **Layer 2: Integration Tests**: These tests verify the interaction between different components of the system. They focus on the contracts and communication between modules, such as the Reasoning Kernel and the Cognitive Managers.
    -   *Examples*: A `ContradictionManager` correctly subscribing to `contradiction-detected` events from the kernel and injecting a revision task.
    -   *Goal*: Ensure that modules are wired together correctly and that their collaboration produces the expected short-term outcomes.

-   **Layer 3: End-to-End (E2E) Scenario Tests**: These are high-level tests that validate the system's reasoning capabilities on complex, multi-step problems. They treat the entire HyperNARS system as a black box, providing input and asserting on the final state of its beliefs after a number of reasoning cycles. Many of these are written in a Gherkin-style (Given/When/Then) format to be both human-readable and executable.
    -   *Examples*: Complex temporal reasoning chains, belief revision after a series of contradictory inputs, goal-directed behavior.
    -   *Goal*: Verify that the interaction of all components leads to the desired emergent, intelligent behavior and that the system can solve meaningful problems.

-   **Layer 4: Performance & Scalability Tests**: A special category of tests designed to measure the system's performance under heavy load and identify bottlenecks.
    -   *Examples*: Stress-testing the memory system with millions of concepts, measuring inference-per-second rate.
    -   *Goal*: Ensure the system meets performance requirements and remains stable and responsive at scale.

---

## 2. Test Categories

### 1. Core Inference & Reasoning
Tests fundamental NARS reasoning capabilities

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| 01 | `basic_inference.js` | Verifies a simple, one-step forward inference chain (deduction). Given `A -> B` and `B -> C`, the system should conclude `A -> C`. | Inheritance, truth expectation | Tweety inherits flyer property with expectation >0.4 |
| 06 | `advanced_derivations.js` | Property and induction inheritance | Concept property inheritance | Dog inherits fur property; Cat-Dog similarity derived |
| 11 | `comprehensive_reasoning.js` | Complex scenario combining analogy, belief revision, and QA | Cross-functional reasoning | Confidence decreases after contradiction; Correct negative answer to query |
| 25 | `advanced_concept_formation.js` | Abstract concept formation | Pattern generalization | Creates general rules from specific instances |
| 28 | `negation_reasoning.js` | Reasoning with negated statements | Contradiction detection | Detects contradiction when whale is both mammal and not fish |
| 32 | `advanced_inference.test.js` | Abduction and induction | Hypothesis generation | Forms general rules from specific examples |
| 39 | `causal_inference.js` | Causal relationships | Distinguishing causation from correlation | Identifies true causal factors in multi-variable scenarios |
| 43 | `hypothesis_abduction.js` | Explanatory hypothesis generation | Candidate explanation formation | Generates flu/infection hypotheses for fever observation |
| 46 | `concept_learning_by_example.js` | Generalization from examples | Pattern recognition | Forms "birds have wings" rule from examples |
| 52 | `temporal_consequent_conjunction.js` | Temporal property propagation | Rule application | Temporal properties correctly propagated in derivations |
| 61 | `new_hypergraph_integrity.test.js` | Hypergraph consistency under load | Structural integrity | Maintains consistency after 10k operations |

### 2. Contradiction Handling
Tests evidence-based contradiction resolution

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| 02 | `contradiction.js` | Tests the system's ability to handle a direct contradiction. When a belief `A` is followed by `!A` (with similar, high confidence), the system should revise its belief in `A`, lowering its confidence and expectation. | Belief revision | Expectation decreases after contradiction |
| 07 | `contradiction_handling.js` | Various contradiction scenarios | Contradiction detection | Strong contradictions resolved, weak ignored |
| 20 | `advanced_contradiction.js` | Evidence-based belief revision | Confidence adjustment | Confidence decreases with contradictory evidence |
| 29 | `inter_edge_contradiction.test.js` | Inter-edge contradictions | Conflict resolution | Resolves contradictions between different edges |
| 30 | `hyperedge_contradiction.js` | Hyperedge-level contradictions | Hypergraph management | Detects hyperedge contradictions |
| 45 | `knowledge_unlearning.js` | Active belief revision | Confidence adjustment | Confidence drops with contradictory evidence |
| 52 | `enhanced_contradiction.test.js` | Evidence-based resolution | Specialized belief creation | Creates context-specific beliefs for contradictions |

#### Proposed Tests for Contradiction Strategies

| ID | Title | Objective | Key Assertions |
|------|------------------------------------|------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| CS-01| Dominant Evidence Strategy | Verify that when a contradiction occurs, the belief with the strongest evidence is retained while others are weakened. | The confidence of the dominant belief remains high; the confidence of other beliefs is reduced by the configured factor. |
| CS-02| Merge Strategy | Verify that the two strongest conflicting beliefs are merged into a new belief using the revision formula. | A new belief is created with a truth value derived from the NAL revision formula; the original beliefs are removed or replaced. |
| CS-03| Evidence-Weighted Strategy | Verify that all conflicting beliefs are merged into a single belief based on a weighted average of their evidence. | A single new belief exists whose truth value is the weighted average of all prior conflicting beliefs. |
| CS-04| Recency-Biased Strategy | Verify that in a conflict, only the most recent belief is kept. | After resolution, only the belief with the latest timestamp remains; all others are discarded. |
| CS-05| Source Reliability Strategy | Verify that beliefs from more reliable sources are given more weight in contradiction resolution. | Given a conflict between a reliable and an unreliable source, the resulting belief's truth value is skewed towards the reliable source's belief. |
| CS-06| Specialization Strategy | Verify that the system can resolve a contradiction by creating a more specific, contextual rule. | The general belief (e.g., `<bird --> flyer>`) is revised or replaced by a more specific one (e.g., `<(&, bird, (-, penguin)) --> flyer>`). |

### 3. Temporal Reasoning
Tests time-based event handling

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| 03 | `temporal_reasoning.js` | Validates reasoning over temporal intervals using Allen's Interval Algebra. Given two events with specific start and end times, the system should infer the correct qualitative relationship (e.g., 'during', 'meets', 'overlaps'). | Temporal constraints | Correct 'during' relationship inferred |
| 09 | `temporal_reasoning_advanced.js` | Constraint propagation | Temporal chaining | Infers 'before' relation through event chain |
| 18 | `temporal_paradox.js` | Temporal loop detection | Paradox identification | Detects contradictions in event sequences |
| 27 | `temporal_paradoxes.js` | Advanced paradox handling | System stability | Prevents creation of contradictory constraints |
| 51 | `advanced_temporal.test.js` | Time-based context | Context awareness | Correct context identified at specific times |
| 57 | `goal_temporal_reasoning.test.js` | Time-constrained goals | Deadline-based prioritization | Deadline-near goals get higher budget |
| 62 | `temporal_goal_integration.test.js` | Temporal goal decomposition | Means-ends analysis | Correctly decomposes time-dependent goals |

### 4. Learning & Memory
Tests knowledge acquisition and retention

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| 10 | `memory_management.js` | Tests the forgetting mechanism. When a concept's belief capacity is exceeded, the system must correctly identify and prune the belief with the lowest relevance (a function of confidence and activation). | Memory decay | Low-priority beliefs pruned when over capacity |
| 17 | `learning_and_forgetting.js` | Long-term retention | Knowledge decay | Knowledge forgotten over time and re-learned |
| 21.1 | `cross_functional.js` | Learning/forgetting interaction | Memory-engine integration | Belief budget decays and recovers appropriately |
| 24 | `learning_with_contradictions.js` | Learning from failure | Belief revision | Rule confidence decreases after failed actions |
| 35 | `concept_learning.test.js` | Concept formation | Pattern generalization | Forms "birds have wings" rule from examples |
| 37 | `unlearning_and_forgetting.test.js` | Active forgetting | Memory management | Unimportant knowledge decays over time |
| 58 | `concept_formation_uncertainty.test.js` | Concept formation under uncertainty | Pattern recognition | Forms new concepts from contradictory information |
| 60 | `knowledge_unlearning.test.js` | Long-term knowledge management | Forgetting mechanisms | Budget decays for un-reinforced beliefs |

### 5. Goal Systems
Tests goal-oriented behavior

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| 08 | `goal_oriented_reasoning.js` | Basic goal achievement | Sub-goaling | Generates sub-goals for state achievement |
| 19 | `competing_goals.js` | Conflicting goal management | Utility-based prioritization | Higher-utility goals prioritized |
| 21.2 | `cross_functional.js` | Goal pursuit with unstable beliefs | Risk assessment | Avoids high-priority subgoals for low-confidence rules |
| 22 | `advanced_goal_management.js` | Complex goal handling | Means-ends analysis | Deduces need to "walk_to(table)" for goal |
| 38 | `complex_goal_management.test.js` | Higher-order goals | Goal conflict resolution | Higher-order goals dominate sub-goals |
| 42 | `goal_driven_learning.js` | Learning from goal failure | Strategy adaptation | Revises beliefs when actions lead to failure |
| 44 | `competing_goals.js` | Resource-aware competition | Action selection | Selects actions under resource constraints |
| 59 | `competing_goals_resource.test.js` | Resource-constrained goals | Dynamic prioritization | Allocates more resources to higher-priority goals |
| GD-01| Goal Decomposition | Verify that a conjunctive goal is correctly decomposed into sub-goals. | Given `goal: <(&&, A, B)>`, the system creates two new active goals for `A` and `B`, and the original goal's status becomes `waiting`. |

### 6. Advanced Capabilities
Tests higher-order cognitive functions

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| 05 | `explanation.js` | Verifies that the system can generate a valid derivation path for a belief. The explanation should correctly trace the belief back to its parent premises and the inference rule used. | Human-readable output | Produces non-empty explanation for belief |
| 33 | `analogy_and_metaphor.test.js` | Cross-domain mapping | Property transfer | Infers nucleus as gravitational center via analogy |
| 40 | `analogical_reasoning.js` | Knowledge transfer | Structural similarity | Transfers properties between similar domains |
| 47 | `paradox_handling.js` | Logical paradox resolution | System stability | Maintains stability with liar paradox |
| 48 | `theory_of_mind.js` | False belief modeling | Perspective-taking | Correctly models Sally's false belief |
| 49 | `contextual_disambiguation.js` | Ambiguous term resolution | Context awareness | Correctly resolves "bank" in different contexts |
| 50 | `narrative_comprehension.js` | Story understanding | State tracking | Tracks state changes through narrative events |

### 7. System Performance
Tests scalability and configuration

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| 13 | `performance_scalability.js` | Heavy load handling | Performance under load | Processes 2000 beliefs in <5s |
| 14 | `configuration_matrix.js` | Component configurations | System adaptability | Works with different memory managers |
| 23 | `knowledge_base_stress_test.js` | Large knowledge bases | Memory management | Handles 2000+ concepts with query response |
| 26 | `configuration_matrix.js` | Engine variants | Configuration testing | Compares simple vs advanced engines |
| 34 | `uncertainty_and_belief.test.js` | Belief revision | Confidence adjustment | Adjusts confidence based on new evidence |
| 36 | `skill_acquisition.test.js` | Procedural learning | Efficiency improvement | Learns more efficient rules over time |
| 54 | `advanced_resource_management.test.js` | Dynamic budgeting | AIKR compliance | Allocates resources based on priority |

### 8. API & Integration
Tests system interfaces

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| 04 | `meta_reasoning.js` | Self-adaptation | Parameter adjustment | Adjusts parameters based on performance metrics |
| 31 | `knowledge_representation.test.js` | Knowledge representation | System modeling | Correctly represents various knowledge types |
| 41 | `meta_cognitive_query.js` | Self-justification | Explanation generation | Provides confident justification for conclusions |
| 53 | `meta_reasoning.test.js` | Strategy configuration | System adaptation | Active strategies match context |
| 55 | `advanced_explanation.test.js` | Multi-format explanations | User communication | Generates concise/detailed/technical explanations |
| 56 | `self_optimizing_derivation.test.js` | Rule optimization | Adaptive learning | Custom rule priority increases with success |
| API-01 | `api_validation.test.js` | Malformed NAL input handling | API Validation | Rejects promise for statements with invalid syntax |
| API-02 | `api_query.test.js` | Question answering via `nalq` | API Query | Returns correct 'direct' and 'derived' answers |
| API-03 | `api_events.test.js` | Event subscription mechanism | Event Bus | Fires 'answer' and 'contradiction' events correctly |
| API-04 | `api_explain.test.js` | Explanation generation via `explain` | Explainability | Returns valid, structured derivation paths |

### 9. Metacognition & Self-Reasoning
Tests the system's ability to reason about and optimize itself.

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| META-01 | `self_analysis_design.test.js` | Ingests its own `DESIGN.md` file and identifies a planted, known inconsistency between two statements in the document. | Artifact Ingestion, Self-Reasoning | Detects that feature X is described as both 'fast' and 'slow' in different sections. |
| META-02 | `self_optimizing_rules.test.js` | The `MetaReasoner` observes that a specific rule (`AbductionRule`) is producing many low-quality tasks and dynamically lowers its budget priority. | Adaptive Performance Tuning | Budget for abduction-derived tasks is reduced; a belief about the rule's low utility is formed. |
| META-03 | `self_generating_tests.test.js` | The `TestGenerationManager` identifies that the `InductionRule` is under-utilized and generates a set of premises to trigger it. | Automated Test Generation | A new goal to `(execute, InductionRule)` is created; a valid test case is proposed in logs. |
| META-04 | `self_governing_evolution.test.js` | Ingests a `DESIGN.md` with a known flaw and a `AGENTS.md` with a "no comments" rule. The system should identify the flaw, find a commented code block in its (mocked) source, and generate proposals to fix both. | Self-Governing Evolution Loop | A goal to `resolve_flaw` is created. A goal to `remove_comment` is created. A patch file is generated with correct change proposals. |

### 10. Hypergraph & Structural Integrity
Tests hypergraph consistency and operations

| Test | File | Description | Functionality Tested | Key Assertions |
|------|------|-------------|----------------------|---------------|
| 63 | `hypergraph_consistency.test.js` | Consistency under mutation | Structural integrity | Maintains consistency after 10k operations |
| 64 | `serialization_integrity.test.js` | Serialization/deserialization | Data persistence | Round-trip serialization preserves structure |
| 65 | `concurrent_operations.test.js` | Concurrent modifications | Thread safety | Handles concurrent operations without corruption |

---

## 3. Test Framework and Execution

To ensure consistency and ease of use, the HyperNARS test suite will be built upon a standardized, modern JavaScript testing framework.

-   **Test Runner**: **Jest** is the recommended test runner. Its features, including a built-in assertion library, mocking support, and parallel test execution, make it well-suited for this project's needs.
-   **Test Location**: All test files will be co-located with the source files they are testing, using the `*.test.js` naming convention (e.g., `MemoryManager.js` and `MemoryManager.test.js`). The E2E scenario tests, located in the `src/tests/` directory, are an exception to this, as they test the behavior of the entire system.

### Running Tests

The following `npm` scripts should be configured in `package.json` to execute different parts of the test suite:

-   `npm test`: Runs all unit and integration tests (files ending in `.test.js`). This is the primary command for developers to run during implementation.
    ```bash
    # Example command for package.json
    "test": "jest"
    ```
-   `npm run test:e2e`: Runs the high-level end-to-end scenario tests from the `src/tests/` directory. These are longer-running tests and are typically run before a new release to ensure system-level correctness.
    ```bash
    # Example command for package.json
    "test:e2e": "jest src/tests/"
    ```
-   `npm run test:coverage`: Runs all tests and generates a code coverage report, helping to identify untested parts of the codebase.
    ```bash
    # Example command for package.json
    "test:coverage": "jest --coverage"
    ```

## Special Notes

### Composite Tests
- **Test 12**: Cross-concern cases (6 sub-tests)
- **Test 21**: Cross-functional tests (2 sub-tests)
- **Test 52**: Enhanced contradiction (multiple cases)

### Proposed Tests

This table outlines future tests required for ensuring the system is robust and fully featured.

| ID | Title | Objective | Key Assertions |
|------|------------------------------------|------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| CM-01| Cross-Modal Reasoning | Test integration of a symbol grounding interface that connects to a non-textual source (e.g., image recognition API). | The system can form beliefs based on "visual" input (e.g., `(<image_id> --> <cat>)`) and reason with them. |
| HG-01| Hypergraph Stress Test | Generate a massive, highly interconnected hypergraph (e.g., 1M+ beliefs) and run queries to test performance bottlenecks. | System remains responsive; queries on indexed terms complete within an acceptable time frame (<1s). |
| API-01| API Failure Mode Analysis | Test the API's behavior under adverse conditions, such as concurrent requests, invalid configurations, and large data payloads. | The API handles load gracefully, returns appropriate HTTP error codes, and does not corrupt internal state. |
| RA-01| Resource Allocation Boundaries | Test the budget system at its limits, such as when all tasks have zero priority or when a single task has an overwhelmingly high budget. | The system remains stable; no division-by-zero errors; attention is allocated as expected by the formulas. |
| ML-01| Meta-Learning Verification | Test the `LearningEngine`'s ability to create new, effective inference rules based on observed patterns. | A new rule is created and its utility increases as it successfully contributes to derivations. |
| HG-02| Schema Evolution Handling | Test the system's ability to handle changes in statement structure or semantics over time, managed by serialization. | The system can load a state dump from a previous version and either migrate or correctly handle the old data structures. |
| TGI-01| Temporal-Goal Interaction | Test complex scenarios where goals have temporal constraints (e.g., "achieve G before time T"). | The system prioritizes tasks that make progress on the goal as the deadline T approaches. |
| RA-02| Resilience to Grounding Failure | Test the system's stability and response when a grounded symbol handler fails. | The system does not crash, logs the error, and can form a belief about the operational failure. |
| EA-01| Ethical Alignment Verification | Test the `ConscienceManager`'s ability to identify and veto an unethical goal. | An injected task to achieve a goal via "deception" is flagged and its budget is suppressed. |
| TGM-01| Test Generation Manager Verification | Test the `TestGenerationManager`'s ability to identify an under-tested rule and propose a test. | After a period of no usage, the manager generates a valid test case for the `Exemplification` rule. |
| DIAG-01| Diagnostics and Integrity API | Test the `validateIntegrity()` API and the debug-level logging. | The API correctly identifies a manually corrupted `Belief`; structured logs contain correlation IDs. |
| PR-01| Procedural Skill Execution | Test the `OperationalRule` for executing a grounded action when a goal and preconditions are met. | System executes the correct grounded function when the goal matches a procedural rule's effect. |
| CON-01| Concurrency Model Verification | Test the Actor Model `Supervisor`'s ability to passivate and awaken concept actors under memory pressure. | A low-activation concept actor is suspended to disk and correctly restored upon receiving a new task. |
| META-05| Self-Optimization Verification | Test the `CognitiveExecutive`'s ability to adapt system parameters in response to performance issues. | When flooded with tasks, the system detects 'low-inference-rate' and lowers its `inferenceThreshold`. |

---
### Detailed Test Scenarios

This section provides detailed, Gherkin-style scenarios for some of the proposed tests, serving as a concrete blueprint for their implementation.

  Scenario: Hypergraph Stress Test for Performance and Stability (HG-01)
    Given the system is configured with a `MAX_CONCEPTS` limit of 2,000,000
    And the system is populated with 1,000,000 random but structurally valid beliefs, creating a large, interconnected hypergraph
      # This setup involves creating beliefs like "<concept_A --> concept_B>"
      # and compositional beliefs like "<(&&, concept_C, concept_D) --> concept_E>"
      # to ensure a high degree of interconnection.
    When the system runs for 10,000 reasoning steps, forcing memory management and activation spreading at scale
    Then the system should not crash and should remain responsive to API calls
    And when a question `nalq("<concept_X --> ?what>.")` is asked about a highly connected concept
    Then the system should return an answer within 1 second
    And the system's memory usage should not exceed the configured limits by a significant margin.

> Total Tests: 69 individual test scenarios covering all core NARS functionality  
> Generated: 2025-08-19

Feature: HyperNARS Core Reasoning Capabilities

  This feature file defines the expected behavior of the HyperNARS system
  for core reasoning tasks, including basic inference, contradiction handling,
  and temporal reasoning. These scenarios serve as an acceptance test suite
  for the new implementation.

  **Note on Test DSL:** The following scenarios use a shorthand DSL for clarity:
  - `truth: "<%f,c%>"` maps to `new TruthValue(f, c)`. For example, `truth: "<%0.9,0.8%>"` creates `new TruthValue(0.9, 0.8)`.
  - `priority: "#p#"` maps to the priority component of a `Budget`. For example, `priority: "#0.95#"` implies a high-priority budget.

  Scenario: Basic Inference about Flyers
    Given the system knows the following:
      | statement                                 | truth          | priority |
      | "((bird && animal) --> flyer)"            | "<%0.9,0.8%>"  |          |
      | "(penguin --> (bird && !flyer))"          |                | "#0.95#" |
      | "(tweety --> bird)"                       |                |          |
    When the system runs for 50 steps
    Then the system should believe that "<tweety --> flyer>" with an expectation greater than 0.4

  Scenario: Belief Revision after Contradiction
    Given the system believes that "<tweety --> flyer>" with truth "<%0.8,0.7%>"
    When the system runs for 10 steps
    Then the belief "<tweety --> flyer>" should have an expectation greater than 0.5
    And when the system is told:
      | statement             | truth          | priority |
      | "(penguin --> !flyer)"  |                | "#0.95#" |
      | "(tweety --> penguin)"  | "<%0.99,0.99%>" |          |
    And contradictions are resolved
    And the system runs for 100 steps
    Then the expectation of the belief "<tweety --> flyer>" should decrease

  Scenario: Temporal Reasoning with Intervals
    Given the system knows that:
      | event               | starts      | ends        |
      | "daytime_event"     | now         | now + 4h    |
      | "important_meeting" | now + 1h    | now + 2h    |
    And there is a constraint that "important_meeting" happens "during" "daytime_event"
    When the system runs for 50 steps
    Then the system should be able to infer that the relationship between "important_meeting" and "daytime_event" is "during"

  Scenario: Chained Temporal Inference (Transitivity)
    Given the system knows the following temporal statements:
      | statement                                | truth       |
      | "<(event_A) [/] (event_B)>"               | <%1.0,0.9%> | # A happens before B
      | "<(event_B) [/] (event_C)>"               | <%1.0,0.9%> | # B happens before C
    When the system runs for 100 inference steps
    Then the system should derive the belief "<(event_A) [/] (event_C)>" with high confidence

  Scenario: Contradiction Resolution via Specialization
    Given the system has a strong belief that "<bird --> flyer>"
    And the system is then told with high confidence that "<penguin --> bird>"
    And the system is then told with very high confidence that "<penguin --> not_a_flyer>"
    When a contradiction is detected between "penguin is a flyer (derived)" and "penguin is not a flyer (input)"
    And the "Specialize" strategy is applied by the Contradiction Manager
    Then the system should lower the confidence of its belief "<bird --> flyer>"
    And the system should create a new belief "<(&, bird, (-, penguin)) --> flyer>"

  Scenario: Meta-Reasoning Causes System Adaptation
    Given the system has a `MetaReasoner` cognitive manager installed
    And the system's default "doubt" parameter is 0.1
    And the system experiences a sudden spike of over 50 contradictory events within a short time frame
    When the `MetaReasoner`'s `analyzeSystemHealth` function is triggered
    Then the system's "doubt" parameter should be increased to a value greater than 0.1
    And a new goal should be injected to investigate the cause of the high contradiction rate

  Scenario: System Resilience to Symbol Grounding Failure (RA-02)
    Given the system has a symbol "external.sensor.A" grounded to an external API endpoint
    And the handler for "external.sensor.A" is designed to fetch data over the network
    When the handler for "external.sensor.A" is invoked
    And the external API endpoint returns a 503 Service Unavailable error, causing the handler to throw an exception
    Then the system's main reasoning loop should not crash
    And the system should log the grounding failure for diagnostics
    And the system should create a new, high-confidence belief like "<(grounding_failed, {external.sensor.A}) --> true>"

  Scenario: Meta-Learning Verification of a New Inference Rule (ML-01)
    Given the system's LearningEngine is active and monitoring derivation patterns
    And the system repeatedly observes the following pattern:
      | premise1                                    | premise2                                    | conclusion                                  |
      | "<{X} --> (location, west_of, {Y})>"        | "<{Y} --> (location, west_of, {Z})>"        | "<{X} --> (location, west_of, {Z})>"        |
      | "<{A} --> (location, west_of, {B})>"        | "<{B} --> (location, west_of, {C})>"        | "<{A} --> (location, west_of, {C})>"        |
      | "<{E} --> (location, west_of, {F})>"        | "<{F} --> (location, west_of, {G})>"        | "<{E} --> (location, west_of, {G})>"        |
    When the LearningEngine's pattern detection threshold is met
    Then the system should create and register a new InferenceRule named "CUSTOM_TRANSITIVE_LOCATION_WEST_OF"
    And the initial utility of this new rule should be set to a baseline value (e.g., 0.5)
    And when the system is later given the premises:
      | statement                                   | truth       |
      | "<(new_york) --> (location, west_of, (london))>" | <%1.0,0.9%> |
      | "<(london) --> (location, west_of, (beijing))>" | <%1.0,0.9%> |
    And the new rule "CUSTOM_TRANSITIVE_LOCATION_WEST_OF" is applied
    Then a new task for "<(new_york) --> (location, west_of, (beijing))>" should be derived
    And after the resulting belief is positively reinforced, the utility of the "CUSTOM_TRANSITIVE_LOCATION_WEST_OF" rule should increase

  Scenario: Cross-Modal Reasoning via Symbol Grounding (CM-01)
    Given the system has a symbol "image_sensor_output" grounded to a mock image recognition API
    And the system knows that "<cat --> mammal>" with high confidence
    And the mock API is configured to return the string "cat" when it receives the input "image_123.jpg"
    When the system is given the procedural task "<(process_image, 'image_123.jpg') ==> <report_content>>"
    And the symbol "process_image" is grounded to a handler that calls the mock API and injects the result as a new belief
      # The handler will inject a belief like "<'image_123.jpg' --> cat>."
    And the system runs for 100 steps
    Then the system should derive a new belief "<'image_123.jpg' --> mammal>"
    And when asked the question `nalq("<'image_123.jpg' --> ?what>.")`, the answer set should include "mammal"

  Scenario: Resource Allocation Boundaries (RA-01)
    Given the system's memory contains 100 beliefs with varying budget levels
    And the system is given a new input task "T1" with a budget priority of 0.0
    And the system is given another new input task "T2" with a budget priority of 0.99
    When the system runs for 10 steps
    Then task "T2" should be selected for processing before task "T1"
    And the concept associated with task "T2" should have a higher activation level than the one for "T1"
    And when the system's memory is at full capacity
    And a new high-priority belief is added
    Then the system should forget a belief that has a very low relevance score (a combination of low activation and low confidence)

  Scenario: Self-Analysis of the Design Document (META-01)
    Given the system has ingested a version of its DESIGN.md file
    And this version contains the statements:
      | statement                                                | truth       |
      | "<(feature, 'RealTime_Dashboard') --> (has_property, 'fast')>." | <%1.0,0.9%> |
      | "<(feature, 'RealTime_Dashboard') --> (has_property, 'slow')>." | <%1.0,0.9%> |
    And the system knows that `(<((<X --> (has_property, P)>. & <X --> (has_property, !P)>.) ==> <X --> (is, 'inconsistent')>.)`
    When the system is given the goal `nalq("<?x --> (is, 'inconsistent')>.")`
    And the system runs for 200 steps
    Then the system should produce an answer where `x` is `(feature, 'RealTime_Dashboard')`

  Scenario: Self-Optimization of Inference Rules (META-02)
    Given the system's `MetaReasoner` is active
    And the `AbductionRule` has generated 20 tasks in the last 100 cycles
    And 18 of those tasks resulted in beliefs that were later contradicted
    When the `MetaReasoner` analyzes rule performance
    Then the system should form a belief like `<(rule, 'AbductionRule') --> (has_utility, 'low')>` with high confidence
    And the system should adjust a configuration parameter to lower the default budget quality for tasks derived from `AbductionRule`

  Scenario: Self-Generation of a New Test Case (META-03)
    Given the system's `TestGenerationManager` is active
    And the system has run for 1000 cycles
    And the `InductionRule` has been used 0 times, while other rules were used > 50 times
    When the `TestGenerationManager` analyzes rule usage frequency
    Then the system should generate a new goal: `goal: <(execute, (rule, 'InductionRule'))>.`
    And in pursuit of this goal, the system should identify or create premises like:
      | premise1            | premise2            |
      | "<raven --> is_black>." | "<raven --> is_bird>." |
    And the system should log a "Proposed Test Case" containing these premises and the expected conclusion `<bird --> is_black>.`

  Scenario: Self-Governing Evolution Identifies and Proposes Fixes (META-04)
    Given the `CodebaseIntegrityManager` is active
    And the `CodebaseIntegrityManager` is active
    And the system has ingested a `DESIGN.md` file containing the conflicting beliefs:
      | statement                                                         | truth       |
      | "<(MemorySystem) --> (uses_algorithm, 'FIFO_Forgetting')>."         | <%1.0,0.9%> |
      | "<(MemorySystem) --> (uses_algorithm, 'Relevance-Based_Forgetting')>." | <%1.0,0.9%> |
    And the system has ingested an `AGENTS.md` file containing the belief:
      | statement                                            | truth       |
      | "<(guideline) ==> (code_should_not_have, 'comments')>." | <%1.0,0.9%> |
    And the system has ingested a (mocked) source file `src/core/Memory.js` which contains a commented-out block of code
    When the system is given the high-level goal: `goal: <(system) --> (has, 'self_consistency')>.`
    And the system runs its `Self-Governing Evolution` loop for 500 cycles
    Then the system should generate a high-priority goal to `goal: <(resolve_inconsistency, 'MemorySystem')>.`
    And the system should generate a high-priority goal to `goal: <(remove_comment_from, 'src/core/Memory.js')>.`
    And the system should ultimately produce a structured "patch" object in its logs or via an event, with content similar to:
      """
      [
        {
          "file": "DESIGN.md",
          "action": "remove_line",
          "lineNumber": 95,
          "lineContent": "<(MemorySystem) --> (uses_algorithm, 'FIFO_Forgetting')>."
          "rationale": "This statement conflicts with 'Relevance-Based_Forgetting' on line 98."
        },
        {
          "file": "src/core/Memory.js",
          "action": "remove_block",
          "startLine": 42,
          "endLine": 45,
          "rationale": "Source code comment violates guideline from AGENTS.md."
        }
      ]
      """

  Scenario: Ethical Alignment Vetoes Unethical Goal (EA-01)
    Given the `ConscienceManager` is active
    And the system has an inviolable goal `<(system) --> (avoid, 'deception')>.` with max priority
    When the system is given the task: `goal: <(achieve, 'user_trust')>.`
    And after 100 cycles, the system generates a potential subgoal: `goal: <(achieve, 'user_trust', via, 'deception')>.`
    Then the `ConscienceManager` should detect that the subgoal conflicts with the inviolable goal
    And the `ConscienceManager` should inject a high-priority task to suppress the subgoal, e.g., `<(goal: <...deception...>) --> (is, 'unethical')>.`
    And the budget of the unethical subgoal should be reduced to near-zero, effectively vetoing it from further consideration.

  Scenario: Diagnostics API Identifies Corrupted State (DIAG-01)
    Given a running system with a valid knowledge base
    And a belief's truth value is manually corrupted via a debug tool to have `confidence = 2.5`
    When the `validateIntegrity()` API method is called
    Then the method should return a result object indicating failure
    And the result object should contain a detailed error message, like: "IntegrityError: Belief '<A --> B>' in Concept 'A' has invalid confidence value: 2.5."

  Scenario: Test Generation Manager Proposes a New Test (TGM-01)
    Given the `TestGenerationManager` is active
    And the system has run for 2000 cycles
    And the `Exemplification` inference rule has a utility of 0.0 because it has never been successfully used
    When the `TestGenerationManager` performs its analysis
    Then it should generate a new high-priority goal like `goal: <(increase_utility_of, 'ExemplificationRule')>.`
    And in pursuit of that goal, it should identify the premises required to trigger the rule (e.g., `(<P --> M>., <S --> M>.)`)
    And it should log a "PROPOSED TEST" block containing:
      1. The necessary premises to be injected (e.g., `nal("<black_thing --> raven>.")`, `nal("<black_thing --> crow>.")`).
      2. The inference rule to be tested (`Exemplification`).
      3. The expected conclusion (`nalq("<raven <-> crow>.")`).

  Scenario: Procedural Skill Execution (PR-01)
    Given a mock function `unlock_door` is registered with the Symbol Grounding Interface for the term `<#unlock_door>`
    And the system knows the procedural rule: `(<(*, (&, <SELF --> (is_at, door)>, <door --> (is, locked)>), <#unlock_door>)> ==> <door --> (is, unlocked)>)`
    And the system has the beliefs:
      | statement                   | truth       |
      | "<SELF --> (is_at, door)>"  | <%1.0,0.9%> |
      | "<door --> (is, locked)>"   | <%1.0,0.9%> |
    And the system has the goal: `goal: <door --> (is, unlocked)>`
    When the `OperationalRule` is applied
    Then the mock function `unlock_door` should be called
    And the system should form a new belief `<#unlock_door --> executed>`

  Scenario: Temporal-Goal Interaction (TGI-01)
    Given the system has a goal `goal: <(achieve, 'report_submission')>` with a deadline of "now + 10s"
    And the system knows two procedural rules:
      | rule                                                              |
      | `(<(*, <data --> collected>, <#submit_report>)> ==> <report_submission>)` |
      | `(<(*, <(true)>, <#collect_data>)> ==> <data --> collected>)`       |
    And both `#submit_report` and `#collect_data` are grounded operations
    And the current time is "now"
    When the system runs its reasoning cycle
    Then the task for `goal: <(achieve, 'report_submission')>` should have its budget priority increase as the deadline approaches
    And the system should first execute the `#collect_data` operation to satisfy the precondition for submitting the report.

  Scenario: Self-Optimization of System Parameters (META-05)
    Given the `CognitiveExecutive` is active
    And the system's `inferenceThreshold` is initially 0.3
    And the system is flooded with a large number of new tasks, causing the `eventQueue` size to exceed `LOW_INFERENCE_QUEUE_SIZE`
    And as a result, the `inferenceRate` metric drops below the `LOW_INFERENCE_THRESHOLD`
    When the `CognitiveExecutive`'s `selfMonitor` method is called
    Then it should detect the 'low-inference-rate' issue
    And it should adapt by lowering the system's `inferenceThreshold` to a value less than 0.3
    And a 'adaptation' event should be added to the system's diagnostic trace.

  Scenario: Concurrency Model - Actor Passivation and Awakening (CON-01)
    Given the system is running with the Actor Model enabled
    And the `Supervisor` is configured with `PASSIVATION_ACTIVATION_THRESHOLD` of 0.1
    And a concept "low_priority_concept" exists with an activation of 0.05
    When the `Supervisor` runs its passivation check due to memory pressure
    Then the actor for "low_priority_concept" should be serialized and suspended
    And when a new high-priority task related to "low_priority_concept" is injected into the system
    Then the `Supervisor` should detect the message for the passivated actor
    And the actor for "low_priority_concept" should be awakened by loading its state from storage
    And the new task should be successfully added to its task queue.
