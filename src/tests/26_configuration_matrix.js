import { SimpleDerivationEngine } from '../core/SimpleDerivationEngine.js';

const baseTest = {
  name: 'Basic Sanity Check',
  description: 'A simple inference task to validate core functionality.',
  steps: [
    {
      action: (nar) => {
        nar.nal('<cat --> mammal>.');
        nar.nal('<mammal --> animal>.');
        nar.run(20);
      },
      assert: (nar, logs) => {
        const belief = nar.getBeliefs(nar.implication('cat', 'animal'))[0];
        if (!belief || belief.truth.confidence < 0.6) {
            logs.push(`[ASSERT FAILED] Basic inference failed; confidence is too low: ${belief?.truth.confidence}`);
            return false;
        }
        return true;
      }
    }
  ]
};

// Now we create variations of this test with different configurations
export default [
  {
    ...baseTest,
    name: '26.1. Config Matrix: Default (Advanced) Engine',
    description: 'Runs the sanity check with the default advanced configuration.',
    config: {
        useAdvanced: true,
    }
  },
  {
    ...baseTest,
    name: '26.2. Config Matrix: Simple Engine',
    description: 'Runs the sanity check with the SimpleDerivationEngine.',
    config: {
        useAdvanced: false, // This will default to the simple modules
    }
  },
  {
    name: '26.3. Config Matrix: Low Belief Capacity',
    description: 'Tests if the system prunes beliefs when capacity is very low.',
    skipped: false, // Skipping due to deeper bug in reasoning engine.
    config: {
        useAdvanced: true,
        beliefCapacity: 1, // Set a very low capacity
    },
    steps: [
      {
        action: (nar) => {
          nar.nal('<a --> b>.'); // First belief
          nar.nal('<c --> d>.'); // Second belief, should prune the first
          nar.run(10);
        },
        assert: (nar, logs) => {
          const firstBeliefExists = nar.getBeliefs(nar.implication('a', 'b')).length > 0;
          const secondBeliefExists = nar.getBeliefs(nar.implication('c', 'd')).length > 0;

          if (firstBeliefExists) {
            logs.push('[ASSERT FAILED] First belief was not pruned despite low capacity.');
            return false;
          }
          if (!secondBeliefExists) {
            logs.push('[ASSERT FAILED] Second belief was unexpectedly pruned.');
            return false;
          }
          return true;
        }
      }
    ]
  },
  {
    name: '26.4. Config Matrix: High Decay Rate',
    description: 'Tests if a high decay rate causes confidence to drop quickly.',
    config: {
        useAdvanced: true,
        decay: 0.99, // Very high decay
    },
    steps: [
      {
        action: (nar) => {
          nar.nal('<a --> b>. %1.0;0.9%');
          nar.run(5); // Run for just a few cycles
        },
        assert: (nar, logs) => {
          const beliefId = nar.implication('a', 'b');
          const belief = nar.getBeliefs(beliefId)[0];
          if (!belief) {
            logs.push('[ASSERT FAILED] Belief was lost entirely.');
            return false;
          }
          const activation = nar.state.activations.get(beliefId) || 0;
          // With high decay, activation should drop significantly
          if (activation > 0.5) {
            logs.push(`[ASSERT FAILED] Activation did not decay as expected. Remained at: ${activation}`);
            return false;
          }
          return true;
        }
      }
    ]
  }
];
