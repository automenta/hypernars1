export default {
    name: '4. Meta-Reasoning',
    description: 'Shows the system adapting its own parameters based on performance.',
    skipped: false, // SKIPPED: Uncovered potential bug where meta-reasoning does not adapt the budgetThreshold as expected.
    steps: [
        {
            action: (nar) => {
                // Lower the threshold to ensure adaptation is triggered for the test
                nar.config.cognitiveExecutive.LOW_INFERENCE_QUEUE_SIZE = 5;

                // Use a scratchpad on the nar object to store state between steps
                nar.scratchpad = {initialThreshold: nar.config.budgetThreshold};

                // Simulating high question load
                nar.ask('(tweety --> ?x)?').catch(e => {
                });
                nar.ask('(penguin --> ?x)?').catch(e => {
                });
                nar.ask('(bird --> ?x)?').catch(e => {
                });

                nar.run(120); // Should trigger meta-reasoning
            },
            assert: (nar, logs) => {
                const initialThreshold = nar.scratchpad.initialThreshold;
                const newThreshold = nar.config.budgetThreshold;
                // Assert that the system has adapted its resource policy
                if (initialThreshold !== newThreshold) {
                    return true;
                }
                return `budgetThreshold did not change. Initial: ${initialThreshold}, New: ${newThreshold}`;
            }
        }
    ]
};
