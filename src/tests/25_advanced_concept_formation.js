export default {
  name: '25. Advanced Concept Formation',
  description: 'Tests if the system can generalize from specific examples to form a new, more abstract concept/rule.',
  skipped: false,
  steps: [
    {
      comment: 'Step 1: Provide several specific examples of a pattern.',
      action: (nar) => {
        // Examples: specific mammals and their properties
        nar.nal('<cat --> has_fur>.');
        nar.nal('<dog --> has_fur>.');
        nar.nal('<bear --> has_fur>.');
        nar.nal('<lion --> has_fur>.');

        // Link them to a more abstract category
        nar.nal('<cat --> mammal>.');
        nar.nal('<dog --> mammal>.');
        nar.nal('<bear --> mammal>.');
        nar.nal('<lion --> mammal>.');
      },
    },
    {
      comment: 'Step 2: Run the system for enough cycles to perform induction.',
      action: (nar) => {
        nar.run(200);
      },
    },
    {
        comment: 'Step 3: Assert that the system has formed a general rule.',
        action: (nar) => {
            // No action, just assert.
        },
        assert: (nar, logs) => {
            // The system should have induced the general rule that mammals have fur.
            const generalRuleId = nar.implication('mammal', 'has_fur');
            const belief = nar.getBeliefs(generalRuleId)[0];

            if (!belief) {
                logs.push('[ASSERT FAILED] The general rule "<mammal --> has_fur>" was not formed.');
                return false;
            }

            // The confidence should be reasonably high after seeing multiple examples.
            if (belief.truth.confidence < 0.5) {
                logs.push(`[ASSERT FAILED] Confidence in the general rule is too low. Confidence: ${belief.truth.confidence}`);
                return false;
            }

            return true;
        }
    }
  ]
};
