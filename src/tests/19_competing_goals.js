export default [
  {
    name: '19.1. Competing Goals',
    description: 'Tests the system ability to choose between multiple competing goals.',
    steps: [
      {
        comment: 'Establish two competing goals with different utilities.',
        action: (nar) => {
          // Goal 1: Have cake (high utility)
          nar.goalManager.addGoal('have_cake', 0.9);
          // Goal 2: Eat cake (also high utility, but implies not having cake)
          nar.goalManager.addGoal('eat_cake', 0.8);

          // If you eat the cake, you no longer have it.
          nar.nal('(eat_cake ==> !have_cake).');

          nar.run(10);
        },
        assert: (nar, logs) => {
          const goals = nar.goalManager.getActiveGoals();

          // The system should prioritize the higher-utility goal.
          // In a more advanced system, it might try to find a way to do both,
          // but for now, we check if the higher priority goal is still active.
          const haveCakeGoal = goals.find(g => g.description === 'have_cake');
          return haveCakeGoal !== undefined;
        }
      },
      {
        comment: 'Introduce an action that achieves the lower-priority goal.',
        action: (nar) => {
          nar.nal('(get_fork ==> eat_cake).');
          nar.run(50);
        },
        assert: (nar, logs) => {
          const goals = nar.goalManager.getActiveGoals();

          // A simple system might now pursue 'get_fork'.
          // A more advanced system should realize this contradicts the higher-priority goal.
          // For this test, we'll assert that the system does NOT create a goal for 'get_fork',
          // because it would lead to a state that violates the 'have_cake' goal.
          const getForkGoal = goals.find(g => g.description === 'get_fork');
          return getForkGoal === undefined;
        }
      }
    ]
  }
];
