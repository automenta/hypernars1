import { describe, it, expect } from '@jest/globals';
import { TestRunner } from '../testing/TestRunner.js';

const test = {
  name: '29. Inter-edge Contradiction',
  description: 'Tests the system\'s ability to detect and resolve contradictions between different hyperedges.',
  steps: [
    {
      comment: 'Establish the initial belief that Tweety is a flyer.',
      action: (nar) => {
        nar.nal('<tweety --> flyer>. %0.9;0.9%');
      },
      assert: (nar) => {
        const belief = nar.api.queryBelief('<tweety --> flyer>.');
        return belief && belief.truth.confidence > 0.8;
      }
    },
    {
      comment: 'Introduce a contradictory belief via a chain of reasoning.',
      action: (nar) => {
        nar.nal('<tweety --> penguin>. %0.9;0.9%');
        nar.nal('<penguin --> !flyer>. %0.9;0.9%');
        nar.run(20);
      },
      assert: (nar) => {
        const belief = nar.api.queryBelief('<tweety --> flyer>.');
        return belief && belief.truth.expectation < 0.5;
      }
    }
  ]
};

describe(test.name, () => {
  it(test.description, () => {
    const runner = new TestRunner({ useAdvanced: true });
    const result = runner.run(test);
    expect(result.result).toBe(true);
  });
});
