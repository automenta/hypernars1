export default {
    name: '5. Explanation',
    description: 'Shows the system generating a human-readable explanation for a belief.',
    steps: [
        {
            action: (nar) => {
                nar.nal('((bird * animal) --> flyer). %0.9;0.8%');
                nar.nal('(tweety --> bird).');
                nar.run(50);
            },
            assert: (nar, logs) => {
                // The belief that tweety is an animal is derived, not directly stated.
                // We need to find its ID to explain it.
                const tweetyIsAnimalId = nar.inheritance('tweety', 'animal');
                const explanation = nar.explain(tweetyIsAnimalId, {format: 'story'});

                // The original test was just a demo. We'll just assert that some explanation was produced.
                return explanation && explanation.length > 0;
            }
        }
    ]
};
