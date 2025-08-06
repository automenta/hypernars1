export default [
    {
        name: '17.1. Long-term Learning and Forgetting',
        description: 'Tests if the system can forget a belief over time and relearn it.',
        config: {
            decay: 0.1,
        },
        steps: [
            {
                comment: 'Introduce a belief and run the system for a long time.',
                action: (nar) => {
                    nar.nal('(<cat --> mammal>).');
                    nar.run(1000);
                },
                assert: (nar, logs) => {
                    const beliefId = nar.inheritance('cat', 'mammal');
                    const belief = nar.getBeliefs(beliefId)[0];
                    return belief === undefined;
                }
            },
            {
                comment: 'Re-introduce the belief and check if it is learned again.',
                action: (nar) => {
                    nar.nal('(<cat --> mammal>).');
                    nar.run(10);
                },
                assert: (nar, logs) => {
                    const beliefId = nar.inheritance('cat', 'mammal');
                    const belief = nar.getBeliefs(beliefId)[0];
                    return belief && belief.truth.confidence > 0.8;
                }
            }
        ]
    }
];
