export default {
    name: '52. Temporal Consequent Conjunction Rule',
    description: 'Tests if the ConsequentConjunctionRule correctly propagates temporal properties.',
    steps: [
        {
            name: 'Setup temporal implication with conjunction',
            action: (nar) => {
                // Create a temporal implication: A -> (B & C)
                // The temporal property is attached to the implication hyperedge.
                // We need a way to create an implication and attach a temporal property to it.
                // Based on my changes, I can pass a `temporal` object in the options.
                const temporalData = { interval: 30 }; // 30 seconds
                nar.api.implication(
                    nar.api.term('A'),
                    nar.api.addHyperedge('Conjunction', [nar.api.term('B'), nar.api.term('C')]),
                    { temporal: temporalData }
                );
                nar.run(10);
            },
            assert: (nar) => {
                // The rule should derive: A -> B
                // This new implication should have the same temporal property.
                const derivedImplicationId = nar.api.implication(nar.api.term('A'), nar.api.term('B'));
                const derivedHyperedge = nar.state.hypergraph.get(derivedImplicationId);

                return derivedHyperedge && derivedHyperedge.temporal && derivedHyperedge.temporal.interval === 30;
            }
        }
    ]
};
