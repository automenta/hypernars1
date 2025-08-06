export default {
    name: '45. Knowledge Unlearning and Belief Revision',
    description: 'Tests if the system can revise a strongly held belief when faced with contradictory evidence.',
    steps: [
        {
            comment: 'Establish a strong universal belief: all swans are white.',
            action: (nar) => {
                // A very confident, universal statement.
                nar.nal('<swan ==> white>. %1.0;0.95%');
                // Define black as mutually exclusive with white.
                nar.nal('<black <-> !white>. %1.0;0.99%');
            },
            assert: (nar, logs) => {
                const belief = nar.getBelief('<swan ==> white>');
                // Confirm the belief was established with high confidence.
                return belief && belief.truth.confidence > 0.9;
            }
        },
        {
            comment: 'Introduce repeated, undeniable contradictory evidence (black swans).',
            action: (nar) => {
                // Present evidence of multiple black swans.
                for (let i = 0; i < 5; i++) {
                    nar.nal(`<swan${i} ==> swan>. %1.0;0.99%`);
                    nar.nal(`<swan${i} ==> black>. %1.0;0.99%`);
                }
                // Let the system process the contradictions.
                nar.run(150);
            },
            assert: (nar, logs) => {
                // After being shown multiple black swans, the system's belief
                // in "all swans are white" should be significantly weakened.
                const belief = nar.getBelief('<swan ==> white>');

                // The confidence should be much lower than the initial 0.95.
                // A robust system should drastically reduce confidence.
                return belief && belief.truth.confidence < 0.5;
            }
        }
    ]
};
