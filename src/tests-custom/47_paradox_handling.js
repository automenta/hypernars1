export default {
    name: '47. Paradox Handling',
    description:
        "Tests the system's stability when reasoning about a logical paradox.",
    steps: [
        {
            comment:
                'Introduce a statement that asserts its own falsehood (Liar Paradox).',
            action: (nar) => {
                // Let L be the name of the statement "L is false".
                // So, we define the meaning of L as the implication "L leads to falsehood".
                nar.nal('<L ==> false>. %1.0;0.9%');

                // Now we assert L itself is true, creating the paradox.
                // This is equivalent to saying, "The statement 'L is false' is, in fact, true."
                nar.nal('<L>. %1.0;0.9%');

                // Let the system grapple with the paradox.
                nar.run(200);
            },
            assert: (nar, logs) => {
                // The system should detect a contradiction between L and its implication.
                // It should not crash. The primary assertion is system stability, which is implicit.
                // A good secondary assertion is to check the final belief state of L.
                const beliefInL = nar.getBelief('<L>');

                if (!beliefInL) {
                    // If the system deleted the concept as unresolvable, that's a valid outcome.
                    return true;
                }

                // A robust NARS should drive the confidence of a paradoxical statement down
                // or have its frequency oscillate around 0.5, representing total uncertainty.
                // The expectation value, which is (frequency - 0.5) * 2 * confidence, should be near 0.
                return Math.abs(beliefInL.truth.expectation()) < 0.2;
            },
        },
    ],
};
