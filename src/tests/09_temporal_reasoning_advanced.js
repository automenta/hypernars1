export default {
  name: '9. Advanced Temporal Reasoning',
  description: 'Tests for temporal inference chains and paradox detection.',

  run: (nar, log) => {
    log("===== 9. ADVANCED TEMPORAL REASONING =====");

    // Case 1: Temporal Inference Chain
    log("--- Case 1: Temporal Inference Chain ---");
    nar.temporalManager.addConstraint('event_A', 'event_B', 'before');
    log("Added constraint: event_A before event_B");
    nar.temporalManager.addConstraint('event_B', 'event_C', 'before');
    log("Added constraint: event_B before event_C");
    nar.run(110); // Allow time for propagation

    // Case 2: Temporal Paradox
    log("\n--- Case 2: Temporal Paradox ---");
    nar.temporalManager.addConstraint('event_X', 'event_Y', 'before');
    log("Added constraint: event_X before event_Y");
    // This should fail and log a warning, but not throw an error.
    nar.temporalManager.addConstraint('event_Y', 'event_X', 'before');
    log("Attempted to add paradoxical constraint: event_Y before event_X");
  },

  assert: (nar, logs, { expect }) => {
    // Assert Case 1: The system should infer A before C.
    const inferredRelation = nar.temporalManager.inferRelationship('event_A', 'event_C');
    expect(inferredRelation).toBeDefined();
    if (inferredRelation) {
      expect(inferredRelation.relation).toBe('before');
    }

    // Assert Case 2: The system should detect and log the paradox.
    const paradoxLog = logs.find(l => l.includes('Temporal constraint would create contradiction: event_Y before event_X'));
    expect(paradoxLog).toBeDefined();
  }
};
