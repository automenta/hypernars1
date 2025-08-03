export default {
  name: '12. Cross-Concern: Temporal Contradiction',
  description: 'Tests if the system correctly handles a contradiction involving temporal information from sources with different confidence levels.',
  steps: [
    {
      comment: 'Establish a high-confidence belief that a meeting is at 10am.',
      action: (nar) => {
        nar.nal('(<meeting --> at_10am>). %1.0;0.9%');
        nar.run(10);
      },
      assert: (nar, logs) => {
        const beliefId = nar.inheritance('meeting', 'at_10am');
        const belief = nar.getBeliefs(beliefId)[0];
        if (!belief) return false;
        // Store the initial confidence for the next step
        nar.scratchpad = { initialConfidence: belief.truth.confidence };
        return nar.scratchpad.initialConfidence > 0.8;
      }
    },
    {
      comment: 'Introduce a low-confidence, contradictory belief and check that the original belief holds.',
      action: (nar) => {
        // A less reliable source claims the meeting is NOT at 10am.
        nar.nal('(<meeting --> at_10am>). %0.0;0.3%');
        nar.run(100);
      },
      assert: (nar, logs) => {
        const beliefId = nar.inheritance('meeting', 'at_10am');
        const belief = nar.getBeliefs(beliefId)[0];
        if (!belief) return false;
        // The confidence should be revised, but still high, reflecting the dominance of the original belief.
        // It should not have flipped completely.
        return belief.truth.confidence > nar.scratchpad.initialConfidence * 0.5;
      }
    }
  ]
};
