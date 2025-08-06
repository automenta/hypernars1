export default {
    name: '10. Memory Management',
    description: 'Tests the system\'s forgetting and memory-pruning mechanisms.',
    skipped: false,
    steps: [
        {
            comment: 'Case 1: Forgetting due to a large number of concepts.',
            action: (nar) => {

                for (let i = 0; i < 1100; i++) {
                    nar.nal(`(<concept_${i} --> property_${i}>).`);
                }

                nar.run(3000);
            },
            assert: (nar, logs) => {

                const pruned = logs.some(l => l.includes('Pruned'));
                return pruned;
            }
        },
        {
            comment: 'Case 2: Belief capacity should trim beliefs.',
            action: (nar) => {

                for (let i = 0; i < 15; i++) {
                    nar.inheritance('test_concept', 'test_property', {truth: new nar.api.TruthValue(0.9, 0.1 * (i % 9))});
                }
                nar.run(200);
            },
            assert: (nar, logs) => {
                const conceptId = nar.inheritance('test_concept', 'test_property');
                const concept = nar.state.hypergraph.get(conceptId);
                if (!concept) return false;
                return concept.beliefs.length <= nar.config.beliefCapacity;
            }
        }
    ]
};
