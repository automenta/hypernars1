export default {
    name: '6. Advanced Derivations',
    description: 'Tests advanced derivation rules like Property Inheritance and Induction Inheritance.',
    steps: [
        {
            comment: 'Test Property Inheritance',
            action: (nar) => {
                nar.nal('dog.');
                nar.nal('<(dog * entity) --> mammal>.');
                nar.nal('Property(mammal, has_fur).');
                nar.run(10);
            },
            assert: (nar, logs) => {
                const dogHasFurId = nar.inheritance('dog', 'Property(dog, has_fur)');
                const belief = nar.getBeliefs(dogHasFurId)[0];
                if (!belief) return false;
                return belief.truth.expectation() > 0.5;
            }
        },
        {
            comment: 'Test Induction Inheritance',
            action: (nar) => {
                nar.nal('cat.');
                nar.nal('<(cat * entity) --> mammal>.');
                // The previous step already added '<(dog * entity) --> mammal>.'
                nar.run(10);
            },
            assert: (nar, logs) => {
                const catIsSimilarToDogId = nar.similarity('cat', 'dog');
                const belief = nar.getBeliefs(catIsSimilarToDogId)[0];
                if (!belief) return false;
                return belief.truth.expectation() > 0.5;
            }
        }
    ]
};
