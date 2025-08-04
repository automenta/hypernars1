export default {
    name: '20. Advanced Contradiction',
    description: 'Tests belief revision with multiple contradictory pieces of evidence of varying strength.',
    skipped: false, // Skipping due to deeper bug in reasoning engine.
    steps: [
        {
            comment: 'Establish the initial, incorrect belief that whales are fish.',
            action: (nar) => {
                nar.nal('(whale --> fish). %0.6;0.7%'); // Medium confidence
                nar.run(10);
            },
            assert: (nar, logs) => {
                const beliefId = nar.inheritance('whale', 'fish');
                const belief = nar.getBeliefs(beliefId)[0];
                if (!belief || !belief.truth) return false;
                // Store the initial expectation
                nar.scratchpad = {initialExpectation: belief.truth.expectation()};
                return nar.scratchpad.initialExpectation > 0.5;
            }
        },
        {
            comment: 'Introduce a weak contradiction.',
            action: (nar) => {
                nar.nal('(whale --> !fish). %0.3;0.4%'); // Weak evidence against
                nar.run(50);
            },
            assert: (nar, logs) => {
                const beliefId = nar.inheritance('whale', 'fish');
                const belief = nar.getBeliefs(beliefId)[0];
                if (!belief || !belief.truth) return false;
                const newExpectation = belief.truth.expectation();
                nar.scratchpad.weakContradictionExpectation = newExpectation;
                // Expectation should decrease, but still be positive.
                return newExpectation < nar.scratchpad.initialExpectation && newExpectation > 0;
            }
        },
        {
            comment: 'Introduce a strong contradiction.',
            action: (nar) => {
                nar.nal('(whale --> mammal). %0.99;0.99%');
                nar.nal('(mammal --> !fish). %0.99;0.99%'); // Strong evidence against
                nar.run(100);
            },
            assert: (nar, logs) => {
                const beliefId = nar.inheritance('whale', 'fish');
                const belief = nar.getBeliefs(beliefId)[0];
                if (!belief || !belief.truth) return false;
                const finalExpectation = belief.truth.expectation();
                // Expectation should now be very low, possibly negative (representing belief in !fish).
                return finalExpectation < nar.scratchpad.weakContradictionExpectation && finalExpectation < 0.1;
            }
        }
    ]
};
