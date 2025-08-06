export default [
    {
        name: '19.1. Competing Goals',
        description: 'Tests the system ability to choose between multiple competing goals.',
        steps: [
            {
                comment: 'Establish two competing goals with different utilities.',
                action: (nar) => {

                    nar.goalManager.addGoal('have_cake', 0.9);

                    nar.goalManager.addGoal('eat_cake', 0.8);


                    nar.nal('(eat_cake ==> !have_cake).');

                    nar.run(10);
                },
                assert: (nar, logs) => {
                    const goals = nar.goalManager.getActiveGoals();




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





                    const getForkGoal = goals.find(g => g.description === 'get_fork');
                    return getForkGoal === undefined;
                }
            }
        ]
    }
];
