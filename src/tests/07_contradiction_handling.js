export default {
  name: '7. Contradiction Handling',
  description: 'Tests how the system handles various contradiction scenarios by adding conflicting beliefs to the same hyperedge.',

  run: (nar, log) => {
    log("===== 7. CONTRADICTION HANDLING =====");
    const { TruthValue } = nar.api;

    // Case 1: Strong, direct contradiction
    log("--- Case 1: Strong Contradiction ---");
    const skyBlueId = nar.inheritance('sky', 'blue', { truth: new TruthValue(0.9, 0.9) });
    log('Added belief that "sky is blue" is very true.');
    nar.inheritance('sky', 'blue', { truth: new TruthValue(0.1, 0.9) });
    log('Added belief that "sky is blue" is very false.');
    nar.run(110);

    // Case 2: Weak, below-threshold contradiction
    log("\n--- Case 2: Weak Contradiction ---");
    const moonCheeseId = nar.inheritance('moon', 'cheese', { truth: new TruthValue(0.9, 0.2) });
    log('Added belief that "moon is cheese" is weakly true.');
    nar.inheritance('moon', 'cheese', { truth: new TruthValue(0.1, 0.2) });
    log('Added belief that "moon is cheese" is weakly false.');
    nar.run(110);

    // Case 3: Boundary contradiction
    log("\n--- Case 3: Boundary Contradiction ---");
    const sunConsciousId = nar.inheritance('sun', 'conscious', { truth: new TruthValue(0.8, 0.65) });
    log('Added belief that "sun is conscious" is moderately true.');
    nar.inheritance('sun', 'conscious', { truth: new TruthValue(0.2, 0.65) });
    log('Added belief that "sun is conscious" is moderately false.');
    nar.run(110);
  },

  assert: (nar, logs, { expect }) => {
    // Assert Case 1: Strong contradiction should have been detected and resolved.
    const logCase1 = logs.find(l => l.includes('Contradiction detected for Inheritance(sky,blue)'));
    expect(logCase1).toBeDefined();
    const skyBlueBeliefs = nar.getBeliefs(nar.inheritance('sky', 'blue'));
    // After resolution, there should be fewer than 2 beliefs, or their confidence should be reduced.
    // Let's check that a resolution log message exists.
    const resolutionLog1 = logs.find(l => l.includes('Contradiction resolved for Inheritance(sky,blue)'));
    expect(resolutionLog1).toBeDefined();

    // Assert Case 2: Weak contradiction should NOT have been detected.
    const logCase2 = logs.find(l => l.includes('Contradiction detected for Inheritance(moon,cheese)'));
    expect(logCase2).toBeUndefined();

    // Assert Case 3: Boundary contradiction should NOT be detected, as it's below the threshold.
    const logCase3 = logs.find(l => l.includes('Contradiction detected for Inheritance(sun,conscious)'));
    expect(logCase3).toBeUndefined();
  }
};
