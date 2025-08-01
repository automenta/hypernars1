export default {
  name: '5. Explanation',
  description: 'Shows the system generating a human-readable explanation for a belief.',
  run: (nar, log) => {
    log("===== 5. EXPLANATION DEMO =====");

    // Setup the context for the explanation
    nar.nal('((bird * animal) --> flyer). %0.9;0.8%');
    nar.nal('(tweety --> bird).');
    nar.run(50);

    const tweetyIsAnimalId = nar.inheritance('tweety', 'animal');

    log("\n--- Story about why Tweety is an animal ---");
    const explanation = nar.explain(tweetyIsAnimalId, { format: 'story' });
    log(explanation || 'No explanation could be generated.');

    return "Explanation demo complete.";
  }
};
