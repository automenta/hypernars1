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


                const tweetyIsAnimalId = nar.inheritance('tweety', 'animal');
                const explanation = nar.explain(tweetyIsAnimalId, {format: 'story'});


                return explanation && explanation.length > 0;
            }
        }
    ]
};
