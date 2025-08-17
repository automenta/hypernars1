export default {
    name: '4. Meta-Reasoning',
    description: 'Shows the system adapting its own parameters based on performance.',
    skipped: false,
    config: {
        cognitiveExecutive: {
            LOW_INFERENCE_QUEUE_SIZE: 5,
        },
    },
    steps: [
        {
            action: (nar) => {
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
