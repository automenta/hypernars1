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
