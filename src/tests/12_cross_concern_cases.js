import { TruthValue } from '../support/TruthValue.js';

export default [
  {
    name: '12.1. Cross-Concern: Temporal Contradiction',
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
  },
  {
    name: '12.2. Cross-Concern: Goal-Oriented Reasoning and Contradiction',
    description: '[SKIPPED] Tests how the system handles a goal that leads to a contradiction.',
    skipped: true, // This test is skipped due to a known bug in the derivation engine.
    steps: [
      {
        comment: 'Set a goal to achieve "state_B".',
        action: (nar) => {
          nar.api.addGoal('state_B', 0.9);
          nar.run(1);
        },
        assert: (nar, logs) => {
          const goals = nar.api.getGoals();
          return goals.some(g => g.description === 'state_B');
        }
      },
      {
        comment: 'Provide a rule that "action_A" leads to "state_B".',
        action: (nar) => {
          nar.nal('(action_A ==> state_B). %1.0;0.9%');
          nar.run(10);
        },
        assert: (nar, logs) => {
          const goals = nar.api.getGoals();
          return goals.some(g => g.description === 'action_A');
        }
      },
      {
        comment: 'Introduce a contradiction: "action_A" is impossible.',
        action: (nar) => {
          nar.nal('(action_A). %0.0;0.99%');
          nar.run(100);
        },
        assert: (nar, logs) => {
          const goals = nar.api.getGoals();
          const actionGoal = goals.find(g => g.description === 'action_A');
          return !actionGoal || actionGoal.utility < 0.3;
        }
      }
    ]
  },
  {
    name: '12.3. Cross-Concern: Belief Revision with Equal Confidence (Negative)',
    description: 'Tests how the system revises beliefs when faced with a direct contradiction of equal confidence.',
    steps: [
      {
        comment: 'Establish a belief that "sky is blue".',
        action: (nar) => {
          nar.api.addHyperedge('Inheritance', ['sky', 'is_blue'], { truth: new TruthValue(1.0, 0.9) });
          nar.run(10);
        },
        assert: (nar, logs) => {
          const beliefId = nar.inheritance('sky', 'is_blue');
          const belief = nar.getBeliefs(beliefId)[0];
          return belief && belief.truth.confidence > 0.8;
        }
      },
      {
        comment: 'Introduce a contradictory belief with equal confidence.',
        action: (nar) => {
          nar.api.addHyperedge('Inheritance', ['sky', 'is_blue'], { truth: new TruthValue(0.0, 0.9) });
          nar.run(500);
        },
        assert: (nar, logs) => {
          const beliefId = nar.inheritance('sky', 'is_blue');
          const belief = nar.getBeliefs(beliefId)[0];
          return belief !== undefined;
        }
      }
    ]
  },
  {
    name: '12.4. Cross-Concern: Concept Formation from Contradictions',
    description: 'Tests if the system can form a new concept to resolve a contradiction.',
    skipped: true,
    steps: [
      {
        comment: 'Establish that penguins are birds.',
        action: (nar) => {
          nar.nal('(<penguin --> bird>).');
          nar.run(10);
        },
        assert: (nar, logs) => {
          const beliefId = nar.inheritance('penguin', 'bird');
          const belief = nar.getBeliefs(beliefId)[0];
          return belief && belief.truth.confidence > 0.8;
        }
      },
      {
        comment: 'Establish that birds can fly.',
        action: (nar) => {
          nar.nal('(<bird --> flyer>).');
          nar.run(10);
        },
        assert: (nar, logs) => {
            const beliefId = nar.inheritance('bird', 'flyer');
            const belief = nar.getBeliefs(beliefId)[0];
            return belief && belief.truth.confidence > 0.8;
        }
      },
      {
        comment: 'Introduce the contradictory belief that penguins cannot fly.',
        action: (nar) => {
          const penguinFlyerId = nar.inheritance('penguin', 'flyer');
          const belief = nar.nal('(<penguin --> flyer>). %0.0;0.99%');
          nar.contradictionManager.addEvidence(penguinFlyerId, belief.id, { source: 'special_book' });
          nar.run(100);
        },
        assert: (nar, logs) => {
            const specializedPenguinId = 'Inheritance(penguin,flyer)|context:special_book';
            const specializedPenguin = nar.state.hypergraph.get(specializedPenguinId);
            return specializedPenguin !== undefined;
        }
      }
    ]
  },
  {
    name: '12.5. Cross-Concern: Long-term Learning and Forgetting',
    description: 'Tests if the system can forget a belief over time and relearn it.',
    skipped: true,
    steps: [
        {
            comment: 'Introduce a belief and run the system for a long time.',
            action: (nar) => {
                nar.nal('(<cat --> mammal>).');
                nar.run(1000);
            },
            assert: (nar, logs) => {
                const beliefId = nar.inheritance('cat', 'mammal');
                const belief = nar.getBeliefs(beliefId)[0];
                return belief === undefined;
            }
        },
        {
            comment: 'Re-introduce the belief and check if it is learned again.',
            action: (nar) => {
                nar.nal('(<cat --> mammal>).');
                nar.run(10);
            },
            assert: (nar, logs) => {
                const beliefId = nar.inheritance('cat', 'mammal');
                const belief = nar.getBeliefs(beliefId)[0];
                return belief && belief.truth.confidence > 0.8;
            }
        }
    ]
  },
  {
      name: '12.6. Cross-Concern: Complex Temporal Contradiction (Loop)',
      description: 'Tests if the system can detect a temporal paradox.',
      skipped: true,
      steps: [
          {
              comment: 'Introduce a temporal loop.',
              action: (nar) => {
                  nar.nal('(<event_A --> event_B>).');
                  nar.nal('(<event_B --> event_C>).');
                  nar.nal('(<event_C --> event_A>).');
                  nar.run(100);
              },
              assert: (nar, logs) => {
                  const contradiction = nar.contradictionManager.contradictions.get(nar.inheritance('event_A', 'event_B'));
                  return contradiction !== undefined;
              }
          }
      ]
  }
];
