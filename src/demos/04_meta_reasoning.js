export default {
  name: '4. Meta-Reasoning',
  description: 'Shows the system adapting its own parameters based on performance.',
  run: (nar, log) => {
    log("===== 4. META-REASONING & ADAPTATION =====");
    const initialThreshold = nar.config.budgetThreshold;
    log(`Initial resource policy (budgetThreshold): ${initialThreshold.toFixed(4)}`);

    log("Simulating high question load to trigger adaptation...");
    nar.ask('(tweety --> ?x)?').catch(e => {});
    nar.ask('(penguin --> ?x)?').catch(e => {});
    nar.ask('(bird --> ?x)?').catch(e => {});

    nar.run(120); // This should trigger a maintenance cycle with meta-reasoning

    const newThreshold = nar.config.budgetThreshold;
    log(`New resource policy (budgetThreshold): ${newThreshold.toFixed(4)}`);

    if (initialThreshold !== newThreshold) {
        log("System has adapted its resource policy.");
    } else {
        log("System did not adapt its resource policy in this short run.");
    }
    return "Meta-reasoning demo complete.";
  }
};
