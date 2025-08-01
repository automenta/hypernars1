export default {
  name: '2. Contradiction',
  description: 'Shows how the system handles and resolves a direct contradiction.',
  run: (nar, log) => {
    log("===== 2. CONTRADICTION & RESOLUTION =====");

    // Ensure the prerequisite belief exists
    nar.nal('(tweety --> flyer). %0.8;0.7%');
    nar.run(10);
    const tweetyIsFlyerId = nar.inheritance('tweety', 'flyer');
    const oldBelief = nar.getBeliefs(tweetyIsFlyerId)[0];
    const oldExp = oldBelief ? oldBelief.truth.expectation().toFixed(3) : 'N/A';
    log(`Initial belief that Tweety is a flyer: ${oldExp}`);

    log("Introducing contradictory belief that Tweety is a penguin (and thus not a flyer)...");
    nar.nal('(penguin --> (bird * !flyer)). #0.95#');
    nar.nal('(tweety --> penguin). %0.99;0.99%');
    nar.run(100);

    const newBelief = nar.getBeliefs(tweetyIsFlyerId)[0];
    const newExp = newBelief ? newBelief.truth.expectation().toFixed(3) : 'N/A';
    log(`New belief that Tweety is a flyer: ${newExp}`);
    return "Contradiction demo complete.";
  }
};
