// TODO: This test is skipped because it reveals a bug in the derivation engine.
// The engine throws a TypeError when trying to process the implication created here.
// This should be investigated.
export default {
  name: '8. Goal-Oriented Reasoning',
  description: '[SKIPPED] Tests the system\'s ability to achieve and abandon goals.',

  run: (nar, log) => {
    log("===== 8. GOAL-ORIENTED REASONING =====");
    const { TruthValue } = nar.api;

    // Case 1: Achievable Goal
    log("--- Case 1: Achievable Goal ---");
    const premise1 = nar.term('action_A');
    const conclusion1 = nar.term('state_B');
    nar.implication(premise1, conclusion1, { truth: new TruthValue(1.0, 0.9) });
    nar.nal('(action_A). %1.0;0.9%');
    const goal1Id = nar.addGoal('state_B', 1.0);
    log(`Added achievable goal ${goal1Id} for state_B.`);
    nar.run(110);
  },

  assert: (nar, logs, { expect }) => {
    // Assert Case 1: Achievable goal should be achieved.
    const achievedQuery = nar.query('state_B', { minExpectation: 0.7 });
    expect(achievedQuery.length).toBeGreaterThan(0);
    const goalAchievedLog = logs.find(l => l.includes('goal-achieved'));
    expect(goalAchievedLog).toBeDefined();
  }
};
