export default {
    name: '32. Advanced Inference',
    description: 'Tests advanced inference forms like abduction (inference to the best explanation) and induction (generalization).',
    steps: [
        {
            comment: 'Setup for abduction: provide a rule and an observation.',
            action: (nar) => {
                nar.nal('((grass_is_wet ==> (sprinkler_was_on || it_rained))). %0.9; 0.9%');
                nar.nal('grass_is_wet. %0.95; 0.9%');
                nar.run(20);
            },
        },
        {
            comment: 'Assert abduction: check for beliefs about possible explanations.',
            assert: (nar, logs) => {
                const explanationId = nar.disjunction(nar.term('sprinkler_was_on'), nar.term('it_rained'));
                const belief = nar.getBeliefs(explanationId)[0];
                // Check if a belief was formed with positive expectation
                return belief && belief.truth.expectation() > 0.5;
            }
        },
        {
            comment: 'Setup for induction: provide several specific examples.',
            action: (nar) => {
                nar.nal('(robin --> bird).');
                nar.nal('(sparrow --> bird).');
                nar.nal('(pigeon --> bird).');
                nar.nal('(robin --> has_wings).');
                nar.nal('(sparrow --> has_wings).');
                nar.nal('(pigeon --> has_wings).');
                nar.run(50);
            },
        },
        {
            comment: 'Assert induction: check for a generalized rule.',
            assert: (nar, logs) => {
                const generalRuleId = nar.inheritance('bird', 'has_wings');
                const belief = nar.getBeliefs(generalRuleId)[0];
                // Check if the generalized rule was induced with some confidence
                return belief && belief.truth.expectation() > 0.5;
            }
        }
    ]
};
