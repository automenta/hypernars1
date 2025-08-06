export default {
    name: '34. Uncertainty and Belief Revision',
    description: 'Tests how the system handles uncertain information and revises its beliefs when presented with new evidence.',
    steps: [
        {
            comment: 'Establish an initial, uncertain belief.',
            action: (nar) => {
                nar.nal('(weather --> sunny). %0.6; 0.7%'); // Probably sunny
                nar.run(10);
            },
            assert: (nar, logs) => {
                const beliefId = nar.inheritance('weather', 'sunny');
                const belief = nar.getBeliefs(beliefId)[0];
                return belief && Math.abs(belief.truth.frequency - 0.6) < 0.01;
            }
        },
        {
            comment: 'Introduce new, conflicting evidence with high confidence.',
            action: (nar) => {
                nar.nal('(weather --> rainy). %0.9; 0.9%'); // Definitely rainy
                nar.run(20);
            },
            assert: (nar, logs) => {
                const sunnyBeliefId = nar.inheritance('weather', 'sunny');
                const sunnyBelief = nar.getBeliefs(sunnyBeliefId)[0];

                const rainyBeliefId = nar.inheritance('weather', 'rainy');
                const rainyBelief = nar.getBeliefs(rainyBeliefId)[0];

                // Expectation for sunny should decrease, and rainy should be high.
                return sunnyBelief.truth.expectation() < 0.5 && rainyBelief.truth.expectation() > 0.8;
            }
        },
        {
            comment: 'Introduce new evidence that supports the initial belief.',
            action: (nar) => {
                nar.nal('(sky --> clear). %0.95; 0.9%');
                nar.nal('((sky --> clear) ==> (weather --> sunny)). %0.9; 0.9%');
                nar.run(30);
            },
            assert: (nar, logs) => {
                const sunnyBeliefId = nar.inheritance('weather', 'sunny');
                const sunnyBelief = nar.getBeliefs(sunnyBeliefId)[0];

                // The belief in sunny weather should be strengthened again.
                return sunnyBelief.truth.expectation() > 0.6;
            }
        }
    ]
};
