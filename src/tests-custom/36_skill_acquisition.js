export default {
    name: '36. Skill Acquisition and Procedural Learning',
    description: 'Tests if the system can learn a new procedural rule (a skill) to achieve a goal more efficiently.',
    steps: [
        {
            comment: 'Setup a multi-step problem to achieve a goal.',
            action: (nar) => {
                // Define the conditions for baking a cake
                nar.nal('(((*, have_flour, have_sugar, have_eggs) ==> can_bake_cake)). %1.0; 0.9%');
                // Provide the individual ingredients
                nar.nal('have_flour. %1.0; 0.9%');
                nar.nal('have_sugar. %1.0; 0.9%');
                nar.nal('have_eggs. %1.0; 0.9%');
                // The system should be able to infer it can bake a cake
                nar.run(50);
            },
            assert: (nar, logs) => {
                const canBakeId = nar.term('can_bake_cake');
                const belief = nar.getBeliefs(canBakeId)[0];
                return belief && belief.truth.expectation() > 0.8;
            }
        },
        {
            comment: 'Introduce a shortcut and see if a new, more efficient rule is learned.',
            action: (nar) => {
                // A cake mix provides flour and sugar
                nar.nal('((*_ have_cake_mix) ==> (*, have_flour, have_sugar)). %1.0; 0.9%');
                // Provide the shortcut ingredient
                nar.nal('have_cake_mix. %1.0; 0.9%');
                // Run to allow the system to derive a new rule
                nar.run(100);
            },
        },
        {
            comment: 'Assert that the new, more efficient skill has been learned.',
            assert: (nar, logs) => {
                // The new skill/rule to check for
                const newRuleTerm = nar.implication(
                    nar.conjunction(nar.term('have_cake_mix'), nar.term('have_eggs'), nar.term('*_')),
                    nar.term('can_bake_cake')
                );

                const newRuleConcept = nar.getConcept(newRuleTerm.id);
                // Check if this new rule has been learned and has a high truth value
                return newRuleConcept && newRuleConcept.beliefs.some(b => b.truth.expectation() > 0.7);
            }
        }
    ]
};
