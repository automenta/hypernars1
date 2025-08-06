export default [
    {
        name: '16.1. Concept Formation from Contradictions',
        description: 'Tests if the system can form a new concept to resolve a contradiction.',
        skipped: false, // Skipping due to deeper bug in reasoning engine.
        steps: [
            {
                comment: 'Establish that penguins are birds.',
                action: (nar) => {
                    nar.nal('(<penguin --> bird>).');
                    nar.run(10);
                },
                assert: (nar, logs) => {
                    const beliefId = nar.inheritance('penguin', 'bird');
                    const belief = nar.getBeliefs(beliefId)[0];
                    return belief && belief.truth.confidence > 0.8;
                }
            },
            {
                comment: 'Establish that birds can fly.',
                action: (nar) => {
                    nar.nal('(<bird --> flyer>).');
                    nar.run(10);
                },
                assert: (nar, logs) => {
                    const beliefId = nar.inheritance('bird', 'flyer');
                    const belief = nar.getBeliefs(beliefId)[0];
                    return belief && belief.truth.confidence > 0.8;
                }
            },
            {
                comment: 'Introduce the contradictory belief that penguins cannot fly.',
                action: (nar) => {
                    const penguinFlyerId = nar.inheritance('penguin', 'flyer');
                    const belief = nar.nal('(<penguin --> flyer>). %0.0;0.99%');
                    nar.contradictionManager.addEvidence(penguinFlyerId, belief.id, {source: 'special_book'});
                    nar.run(100);
                },
                assert: (nar, logs) => {
                    const specializedPenguinId = 'Inheritance(penguin,flyer)|context:special_book';
                    const specializedPenguin = nar.state.hypergraph.get(specializedPenguinId);
                    return specializedPenguin !== undefined;
                }
            }
        ]
    }
];
