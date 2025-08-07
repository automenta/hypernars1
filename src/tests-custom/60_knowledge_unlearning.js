export default {
    name: '60. Knowledge Unlearning and Forgetting',
    description:
        'Tests the system ability to revise beliefs and forget old information.',
    steps: [
        {
            name: 'Establish a strong initial belief',
            action: (nar) => {
                // Establish a belief that was once considered true.
                nar.nal('(pluto --> is_planet). %1.0;0.95%');
                nar.run(20);
            },
            assert: (nar) => {
                // Check that the belief is strong.
                const plutoIsPlanetId = nar.inheritance('pluto', 'is_planet');
                const belief = nar.getBeliefs(plutoIsPlanetId)[0];
                return belief && belief.truth.confidence > 0.9;
            },
        },
        {
            name: 'Introduce new, superseding evidence',
            action: (nar) => {
                // Introduce new, high-confidence information that contradicts the old belief.
                // The NARS revision rule should handle this.
                nar.nal('(pluto --> is_planet). %0.0;0.99%'); // A strong negative belief
                nar.run(50);
            },
            assert: (nar) => {
                // The original belief should now be much weaker or flipped entirely.
                const plutoIsPlanetId = nar.inheritance('pluto', 'is_planet');
                const belief = nar.getBeliefs(plutoIsPlanetId)[0];
                // The expectation should now be close to 0.
                return belief && belief.truth.expectation() < 0.1;
            },
        },
        {
            name: 'Test passive forgetting (budget decay)',
            action: (nar) => {
                // Create a new, obscure belief that will not be reinforced.
                nar.nal('(my_car_keys --> are_on_the_table). %1.0;0.9%');
                nar.run(10);
            },
            assert: (nar) => {
                // Store the initial budget for later comparison.
                const keysId = nar.inheritance(
                    'my_car_keys',
                    'are_on_the_table'
                );
                const concept = nar.getConcept(keysId);
                nar.context.initialKeysBudget = concept.budget.total(); // Store in test context
                return nar.context.initialKeysBudget > 0;
            },
        },
        {
            name: 'Run system for many cycles to induce forgetting',
            action: (nar) => {
                // Run the system with unrelated information to simulate time passing.
                for (let i = 0; i < 20; i++) {
                    nar.nal(`(thought_${i} --> is_random).`);
                }
                nar.run(200);
            },
            assert: (nar) => {
                // The budget of the un-reinforced belief should have decayed.
                const keysId = nar.inheritance(
                    'my_car_keys',
                    'are_on_the_table'
                );
                const concept = nar.getConcept(keysId);
                const finalKeysBudget = concept.budget.total();
                // The final budget should be noticeably lower than the initial budget.
                return finalKeysBudget < nar.context.initialKeysBudget;
            },
        },
    ],
};
