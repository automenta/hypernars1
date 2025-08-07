export default {
    name: '1. Basic Inference',
    description:
        'Demonstrates NAL parsing and a simple forward-inference chain.',
    steps: [
        {
            action: (nar) => {
                nar.nal('((bird * animal) --> flyer). %0.9;0.8%');
                nar.nal('(penguin --> (bird * !flyer)). #0.95#');
                nar.nal('(tweety --> bird).');
                nar.run(50);
            },
            assert: (nar, logs) => {
                const tweetyIsFlyerId = nar.inheritance('tweety', 'flyer');
                const belief = nar.getBeliefs(tweetyIsFlyerId)[0];
                if (!belief) {
                    return false;
                }
                return belief.truth.expectation() > 0.4;
            },
        },
    ],
};
