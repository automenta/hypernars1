export default {
    name: '27. Advanced Temporal Reasoning: Paradox',
    description: 'Tests if the system can detect a temporal paradox (e.g., A -> B -> C -> A).',
    skipped: false, // Skipping due to deeper bug in reasoning engine.
    steps: [
        {
            comment: 'Step 1: Introduce a chain of events that forms a temporal loop.',
            action: (nar) => {
                // Use the temporalConstraint API for clarity
                nar.temporalConstraint('event_A', 'event_B', 'before');
                nar.temporalConstraint('event_B', 'event_C', 'before');
                nar.temporalConstraint('event_C', 'event_A', 'before'); // This creates the paradox
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
                // No action, just assert.
            },
            assert: (nar, logs) => {
                // The improved system now proactively detects the paradox and prevents it from being added,
                // logging a warning instead of creating a formal contradiction.
                const paradoxLog = logs.some(log => log.includes('Temporal constraint would create contradiction'));
                if (!paradoxLog) {
                    logs.push('[ASSERT FAILED] The system did not log a warning about the temporal contradiction.');
                    return false;
                }

                // Also check that no formal contradiction was created, as it was prevented.
                const contradictions = nar.getContradictions();
                if (contradictions.length > 0) {
                    logs.push('[ASSERT FAILED] A formal contradiction was created, which should have been prevented.');
                    return false;
                }

                return true;
            }
        }
    ]
};
