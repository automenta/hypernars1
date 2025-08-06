export default {
    name: '22. Advanced Goal Management',
    description: 'Tests sub-goaling and means-ends analysis.',
    skipped: false,
    steps: [
        {
            comment: 'Step 1: Provide the necessary background knowledge for the task.',
            action: (nar) => {

                nar.nal('<have(key) ==> open(door)>. %0.99;0.9%');

                nar.nal('<at(table) ==> have(key)>. %0.99;0.9%');

                nar.nal('<walk_to(table) ==> at(table)>. %0.99;0.9%');
            },
        },
        {
            comment: 'Step 2: Set the primary goal to open the door.',
            action: (nar) => {
                nar.addGoal('open(door)', 0.9);
            },
            assert: (nar, logs) => {
                return nar.goalManager.getActiveGoals().some(g => g.description === 'open(door)');
            }
        },
        {
            comment: 'Step 3: Run the system and assert that it achieves the goal through sub-goaling.',
            action: (nar) => {

                nar.run(100);
            },
            assert: (nar, logs) => {

                const goalHyperedgeId = nar.query('open(door)')[0]?.id;
                if (!goalHyperedgeId) {
                    logs.push('[ASSERT FAILED] The goal "open(door)" was not found in the knowledge base.');
                    return false;
                }
                const belief = nar.getBeliefs(goalHyperedgeId)[0];
                if (!belief || belief.truth.expectation() < 0.7) {
                    logs.push(`[ASSERT FAILED] Belief in "open(door)" is too low. Expectation: ${belief?.truth.expectation()}`);
                    return false;
                }
                return true;
            }
        }
    ]
};
