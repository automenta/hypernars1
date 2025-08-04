export default {
    name: '3. Temporal Reasoning',
    description: 'Demonstrates the system\'s ability to reason about time-based events.',
    steps: [
        {
            action: (nar) => {
                const now = Date.now();
                nar.temporalManager.interval('daytime_event', now, now + 4 * 3600 * 1000);
                nar.temporalManager.interval('important_meeting', now + 1 * 3600 * 1000, now + 2 * 3600 * 1000);
                nar.temporalManager.addConstraint('important_meeting', 'daytime_event', 'during', {truth: new nar.api.TruthValue(1, 0.9)});
                nar.run(50); // Allow some cycles for propagation
            },
            assert: (nar, logs) => {
                const inferred = nar.temporalManager.inferRelationship('important_meeting', 'daytime_event');
                if (!inferred) return false;
                return inferred.relation === 'during';
            }
        }
    ]
};
