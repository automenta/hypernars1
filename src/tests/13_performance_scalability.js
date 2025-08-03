import { generateBeliefs, runWithTiming } from '../testing/testUtils.js';

export default {
  name: '13. Performance and Scalability',
  description: 'Tests the performance of the system under a heavy load of beliefs.',
  steps: [
    {
      comment: 'Measure reasoning time after loading 2000 beliefs.',
      action: (nar) => {
        const beliefs = generateBeliefs(2000);
        beliefs.forEach(b => nar.nal(b));

        // Store the execution time in the scratchpad
        nar.scratchpad = { executionTime: runWithTiming(nar, 1000) };
        console.log(`Execution time for 1000 cycles with 2000 beliefs: ${nar.scratchpad.executionTime}ms`);
      },
      assert: (nar, logs) => {
        // Set a reasonable threshold for performance. This can be adjusted.
        const timeThreshold = 5000; // 5 seconds
        return nar.scratchpad.executionTime < timeThreshold;
      }
    }
  ]
};
