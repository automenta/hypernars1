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

                // Mock _calculateMetrics to produce a low-inference-rate issue
                nar.cognitiveExecutive._calculateMetrics = () => ({
                    inferenceRate: 0.1, // Lower than LOW_INFERENCE_THRESHOLD (0.3)
                    queueSize: 10, // Higher than LOW_INFERENCE_QUEUE_SIZE (5)
                    contradictionRate: 0,
                    resourceUtilization: 0,
                    questionResponseTime: 1,
                });

                nar.cognitiveExecutive.selfMonitor(); // Should trigger meta-reasoning
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
