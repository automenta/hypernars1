export default {
    name: '9. Advanced Temporal Reasoning',
    description: 'Tests for temporal inference chains and paradox detection.',
    skipped: false, // SKIPPED: Uncovered potential bug where a temporal paradox is not being detected.
    steps: [
        {
            comment: 'Case 1: Temporal Inference Chain',
            action: (nar) => {
                nar.temporalManager.addConstraint('event_A', 'event_B', 'before');
                nar.temporalManager.addConstraint('event_B', 'event_C', 'before');
                nar.run(200);
            },
            assert: (nar, logs) => {
                const inferredRelation = nar.temporalManager.inferRelationship('event_A', 'event_C');
                if (!inferredRelation) return false;
                return inferredRelation.relation === 'before';
            }
        },
        {
            comment: 'Case 2: Temporal Paradox',
            action: (nar) => {
                nar.temporalManager.addConstraint('event_X', 'event_Y', 'before');
                // This should fail and log a warning, but not throw an error.
                nar.temporalManager.addConstraint('event_Y', 'event_X', 'before');
            },
            assert: (nar, logs) => {
                const paradoxLog = logs.some(l => l.includes('Temporal constraint would create contradiction: event_Y before event_X'));
                return paradoxLog;
            }
        }
    ]
};
