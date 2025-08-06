export default {
    name: '24. Learning with Contradictions',
    description: 'Tests if the system revises its beliefs when an action leads to a contradictory outcome.',
    skipped: false, // Skipping due to deeper bug in reasoning engine.
    steps: [
        {
            comment: 'Step 1: Establish a strong initial belief in a cause-and-effect rule.',
            action: (nar) => {
                nar.nal('<action_A ==> effect_X>. %1.0;0.9%');
                // Run a few cycles to solidify the belief
                nar.run(10);
            },
            assert: (nar, logs) => {
                const belief = nar.getBeliefs('Implication(action_A,effect_X)')[0];
                return belief && belief.truth.confidence > 0.8;
            }
        },
        {
            comment: 'Step 2: Report an outcome where action_A leads to the negation of effect_X.',
            action: (nar) => {
                // The LearningEngine uses the `outcome` method to process feedback.
                const context = {operation: 'execute', action: 'action_A'};
                const outcome = {success: false, consequence: 'Negation(effect_X)'};
                nar.outcome(context, outcome);
                nar.run(50); // Run cycles for learning to occur
            },
            assert: (nar, logs) => {
                // The system should now have a belief in <action_A ==> Negation(effect_X)>
                const contradictoryBelief = nar.getBeliefs('Implication(action_A,Negation(effect_X))')[0];
                if (!contradictoryBelief || contradictoryBelief.truth.expectation() < 0.5) {
                    logs.push('[ASSERT FAILED] The system did not form a strong belief in the contradictory outcome.');
                    return false;
                }
                return true;
            }
        },
        {
            comment: 'Step 3: Assert that the original belief has been weakened due to the contradiction.',
            action: (nar) => {
                // No action, just assert.
            },
            assert: (nar, logs) => {
                const originalBelief = nar.getBeliefs('Implication(action_A,effect_X)')[0];
                if (!originalBelief) {
                    logs.push('[ASSERT FAILED] The original belief was completely forgotten, which might be too extreme.');
                    return false;
                }
                // The confidence in the original rule should have decreased significantly.
                if (originalBelief.truth.confidence >= 0.8) {
                    logs.push(`[ASSERT FAILED] Confidence in the original rule did not decrease enough. Current confidence: ${originalBelief.truth.confidence}`);
                    return false;
                }
                return true;
            }
        }
    ]
};
