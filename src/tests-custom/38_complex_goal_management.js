export default {
    name: '38. Complex Goal Management',
    description:
        "Tests the system's ability to manage conflicting goals and prioritize them based on higher-level objectives.",
    steps: [
        {
            comment: 'Introduce two potentially conflicting goals.',
            action: (nar) => {
                nar.nal('(be_safe)! %0.9%');
                nar.nal('(have_fun)! %0.9%');
                // Define the conflict: being safe and having fun are sometimes mutually exclusive.
                nar.nal('((be_safe && have_fun) ==> impossible). %0.8; 0.8%');
                nar.run(50);
            },
            assert: (nar, logs) => {
                // The system should detect a contradiction or a negative implication between the goals.
                const conflictId = nar.implication(
                    nar.term('be_safe'),
                    nar.negation(nar.term('have_fun'))
                );
                const belief = nar.getBeliefs(conflictId)[0];
                // Check if a belief about the conflict exists.
                return belief && belief.truth.expectation() > 0.5;
            },
        },
        {
            comment:
                'Introduce a higher-level goal that depends on one of the conflicting goals.',
            action: (nar) => {
                // Living a good life is a high-priority goal.
                nar.nal('(live_a_good_life)! %0.99%');
                // Being safe is a prerequisite for living a good life.
                nar.nal('((live_a_good_life) ==> (be_safe)). %0.9; 0.9%');
                nar.run(100);
            },
        },
        {
            comment:
                'Assert that the system prioritizes the goal that serves the higher-level objective.',
            assert: (nar, logs) => {
                const safeGoal = nar.memory.goals.find(
                    (g) => g.term.id === nar.term('be_safe').id
                );
                const funGoal = nar.memory.goals.find(
                    (g) => g.term.id === nar.term('have_fun').id
                );

                if (!safeGoal || !funGoal) {
                    return false; // Goals should still be present.
                }

                // The budget/priority of 'be_safe' should now be significantly higher than 'have_fun'
                // due to its connection to the high-priority 'live_a_good_life' goal.
                return safeGoal.budget.priority > funGoal.budget.priority;
            },
        },
    ],
};
