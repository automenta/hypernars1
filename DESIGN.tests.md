Feature: HyperNARS Core Reasoning Capabilities

  This feature file defines the expected behavior of the HyperNARS system
  for core reasoning tasks, including basic inference, contradiction handling,
  and temporal reasoning. These scenarios serve as an acceptance test suite
  for the new implementation.

  Scenario: Basic Inference about Flyers
    Given the system knows the following:
      | statement                                 | truth          | priority |
      | "((bird && animal) --> flyer)"            | "%0.9;0.8%"    |          |
      | "(penguin --> (bird && !flyer))"          |                | "#0.95#" |
      | "(tweety --> bird)"                       |                |          |
    When the system runs for 50 steps
    Then the system should believe that "<tweety --> flyer>" with an expectation greater than 0.4

  Scenario: Belief Revision after Contradiction
    Given the system believes that "<tweety --> flyer>" with truth "%0.8;0.7%"
    When the system runs for 10 steps
    Then the belief "<tweety --> flyer>" should have an expectation greater than 0.5
    And when the system is told:
      | statement             | truth          | priority |
      | "(penguin --> !flyer)"  |                | "#0.95#" |
      | "(tweety --> penguin)"  | "%0.99;0.99%"  |          |
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
