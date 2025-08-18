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

                // Simulating high question load by asking enough questions to exceed the LOW_INFERENCE_QUEUE_SIZE threshold (5)
                for (let i = 0; i < 6; i++) {
                    nar.ask(`(? --> thing${i})?`).catch(e => {});
                }

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
