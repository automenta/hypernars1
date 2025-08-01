export default {
  name: '1. Basic Inference',
  description: 'Demonstrates NAL parsing and a simple forward-inference chain.',
  run: (nar, log) => {
    log("===== 1. BASIC INFERENCE =====");
    nar.nal('((bird * animal) --> flyer). %0.9;0.8%');
    nar.nal('(penguin --> (bird * !flyer)). #0.95#');
    nar.nal('(tweety --> bird).');
    log("Initial beliefs added.");
    nar.run(50);
    const tweetyIsFlyerId = nar.inheritance('tweety', 'flyer');
    const belief = nar.getBeliefs(tweetyIsFlyerId)[0];
    const expectation = belief ? belief.truth.expectation().toFixed(3) : 'N/A';
    log(`Belief that Tweety is a flyer: ${expectation}`);
    return "Basic inference demo complete.";
  }
};
