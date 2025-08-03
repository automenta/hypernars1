import { TestRunner } from '../testing/TestRunner.js';

const tests = [
  {
    name: 'Reasoning with Negations',
    description: 'Tests the system\'s ability to reason with negated statements and detect contradictions.',
    steps: [
      {
        comment: 'Step 1: Establish a strong belief that a whale is a mammal.',
        action: (nar) => {
          nar.nal('Inheritance(whale, mammal).', { truth: { frequency: 1.0, confidence: 0.9 } });
        },
        assert: (nar, logs) => {
          nar.run(1); // run one cycle to process the belief
          const belief = nar.state.hypergraph.get('Inheritance(whale, mammal)');
          return belief && belief.hasBelief();
        }
      },
      {
        comment: 'Step 2: Introduce a belief that a whale is NOT a fish (negation).',
        action: (nar) => {
          nar.nal('Inheritance(whale, Negation(fish)).', { truth: { frequency: 1.0, confidence: 0.9 } });
        },
        assert: (nar, logs) => {
          nar.run(1);
          const belief = nar.state.hypergraph.get('Inheritance(whale, Negation(fish))');
          return belief && belief.hasBelief();
        }
      },
      {
        comment: 'Step 3: Introduce a general rule that mammals are not fish.',
        action: (nar) => {
          nar.nal('Implication(Inheritance($x, mammal), Inheritance($x, Negation(fish))).', { truth: { frequency: 1.0, confidence: 0.9 } });
        },
        assert: (nar, logs) => {
          nar.run(5); // run a few cycles for the rule to be applied
          const conclusion = nar.query('Inheritance(whale, Negation(fish))?');
          return conclusion && conclusion.truth.confidence > 0.8;
        }
      },
      {
        comment: 'Step 4: Introduce a contradictory belief that a whale IS a fish and check for contradiction.',
        action: (nar) => {
          nar.nal('Inheritance(whale, fish).', { truth: { frequency: 1.0, confidence: 0.9 } });
        },
        assert: (nar, logs) => {
          nar.run(10); // run cycles to allow for contradiction detection
          const contradictionDetected = logs.some(log => log.includes('Contradiction detected'));
          return contradictionDetected;
        }
      }
    ],
    skipped: false
  }
];

export default tests;
// TestRunner.run(tests);
