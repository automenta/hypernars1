export default {
  name: '30. Hyperedge Contradiction',
  description: 'Tests the interaction between Hyperedge and ContradictionManager.',
  steps: [
    {
      comment: 'Create a hyperedge and add a belief.',
      action: (nar) => {
        nar.nal('<a --> b>. %1.0;0.9%');
      },
      assert: (nar, logs) => {
        const belief = nar.api.queryBelief('<a --> b>.');
        return belief && belief.truth.confidence > 0.8;
      }
    },
    {
        comment: 'Add a contradictory belief to the same hyperedge.',
        action: (nar) => {
            nar.nal('<a --> b>. %0.0;0.9%');
        },
        assert: (nar, logs) => {
            const contradictions = nar.api.getContradictions();
            return contradictions.length > 0;
        }
    }
  ]
};
