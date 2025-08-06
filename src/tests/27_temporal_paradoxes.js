export default {
    name: '27. Advanced Temporal Reasoning: Paradox',
    description: 'Tests if the system can detect a temporal paradox (e.g., A -> B -> C -> A).',
    skipped: false,
    steps: [
        {
            comment: 'Step 1: Introduce a chain of events that forms a temporal loop.',
            action: (nar) => {

                nar.temporalConstraint('event_A', 'event_B', 'before');
                nar.temporalConstraint('event_B', 'event_C', 'before');
                nar.temporalConstraint('event_C', 'event_A', 'before');
            },
        },
        {
            comment: 'Step 2: Run the system for enough cycles for the temporal reasoner to detect the issue.',
            action: (nar) => {
                nar.run(50);
            },
        },
        {
            comment: 'Step 3: Assert that a contradiction was detected.',
            action: (nar) => {

            },
            assert: (nar, logs) => {
                const contradictions = nar.getContradictions();
                if (contradictions.length === 0) {
                    logs.push('[ASSERT FAILED] No contradiction was detected for the temporal paradox.');
                    return false;
                }


                const paradoxLog = logs.some(log => log.includes('Temporal constraint would create contradiction'));
                if (!paradoxLog) {
                    logs.push('[ASSERT FAILED] The system did not log a warning about the temporal contradiction.');
                    return false;
                }

                return true;
            }
        }
    ]
};
