export default [
  {
    name: '15.1. Goal-Oriented Reasoning and Contradiction',
    description: 'Tests how the system handles a goal that leads to a contradiction.',
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
  }
];
