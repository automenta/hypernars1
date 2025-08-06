export default {
    name: '8. Goal-Oriented Reasoning',
    description: '[SKIPPED] Tests the system\'s ability to achieve and abandon goals.',
    skipped: false,
    steps: [
        {
            comment: "Case 1: Achievable Goal",
            action: (nar) => {
                const {TruthValue} = nar.api;
                const premise1 = nar.term('action_A');
                const conclusion1 = nar.term('state_B');
                nar.implication(premise1, conclusion1, {truth: new TruthValue(1.0, 0.9)});
                nar.nal('(action_A). %1.0;0.9%');
                nar.addGoal('state_B', 1.0);
                nar.run(110);
            },
            assert: (nar, logs) => {

                const achievedQuery = nar.query('state_B', {minExpectation: 0.7});
                const goalAchievedLog = logs.some(l => l.includes('goal-achieved'));
                return achievedQuery && achievedQuery.length > 0 && goalAchievedLog;
            }
        }
    ]
};
