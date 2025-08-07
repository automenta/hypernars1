export default {
    name: '10. Memory Management',
    description: "Tests the system's forgetting and memory-pruning mechanisms.",
    skipped: false, // SKIPPED: Uncovered potential bug where memory pruning is not occurring as expected.
    steps: [
        {
            comment: 'Case 1: Forgetting due to a large number of concepts.',
            action: (nar) => {
                // Create over 1000 concepts to trigger forgetting
                for (let i = 0; i < 1100; i++) {
                    nar.nal(`(<concept_${i} --> property_${i}>).`);
                }
                // Run for enough cycles to trigger maintenance and forgetting
                nar.run(3000);
            },
            assert: (nar, logs) => {
                // Forgetting is probabilistic, so we check that the system attempted to prune.
                const pruned = logs.some((l) => l.includes('Pruned'));
                return pruned;
            },
        },
        {
            comment: 'Case 2: Belief capacity should trim beliefs.',
            action: (nar) => {
                // Add more beliefs than the default capacity
                for (let i = 0; i < 15; i++) {
                    nar.inheritance('test_concept', 'test_property', {
                        truth: new nar.api.TruthValue(0.9, 0.1 * (i % 9)),
                    });
                }
                nar.run(200);
            },
            assert: (nar, logs) => {
                const conceptId = nar.inheritance(
                    'test_concept',
                    'test_property'
                );
                const concept = nar.state.hypergraph.get(conceptId);
                if (!concept) return false;
                return concept.beliefs.length <= nar.config.beliefCapacity;
            },
        },
    ],
};
