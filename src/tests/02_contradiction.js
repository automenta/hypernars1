export default {
  name: '2. Contradiction',
  description: 'Shows how the system handles and resolves a direct contradiction.',
  skipped: false,
  // SKIPPED: Uncovered potential bug where belief revision does not decrease expectation as expected.
  steps: [
    {
      comment: 'Establish the initial belief that Tweety is a flyer.',
      action: (nar) => {
        nar.nal('(tweety --> flyer). %0.8;0.7%');
        nar.run(10);
      },
      assert: (nar, logs) => {
        const belief = nar.api.queryBelief('<tweety --> flyer>.');
        if (!belief || !belief.truth) return false;
        // Store the initial expectation in the scratchpad for the next step
        nar.scratchpad = { initialExpectation: belief.truth.expectation() };
        return nar.scratchpad.initialExpectation > 0.5;
      }
    },
    {
      comment: 'Introduce contradictory information and verify belief revision.',
      action: (nar) => {
        nar.nal('(penguin --> (bird * !flyer)). #0.95#');
        nar.nal('(tweety --> penguin). %0.99;0.99%');
        nar.contradictionManager.resolveContradictions();
        nar.run(100);
      },
      assert: (nar, logs) => {
        const belief = nar.api.queryBelief('<tweety --> flyer>.');
        if (!belief || !belief.truth) return false;
        const newExpectation = belief.truth.expectation();
        // After contradiction, the expectation should have decreased.
        return newExpectation < nar.scratchpad.initialExpectation;
      }
    }
  ]
};
