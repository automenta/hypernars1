export default {
    name: '33. Analogy and Metaphor',
    description:
        "Tests the system's ability to reason by analogy, mapping relationships from a source domain to a target domain.",
    steps: [
        {
            comment:
                'Setup the analogy: define relationships in a source domain (solar system) and a target domain (atom).',
            action: (nar) => {
                // Source domain: A solar system has a sun at its center, and planets orbit it.
                nar.nal('((solar_system * planet) <-> sun). %0.9; 0.9%');
                nar.nal('(sun --> gravitational_center). \%0.9; 0.9\%');

                // Target domain: An atom has a nucleus at its center, and electrons orbit it.
                nar.nal('((atom * electron) <-> nucleus). \%0.9; 0.9\%');

                // Hint at the structural similarity
                nar.nal('(solar_system <-> atom). \%0.8; 0.8\%');

                nar.run(50);
            },
        },
        {
            comment:
                'Assert the analogy: check if the property from the source domain is inferred in the target domain.',
            action: (nar) => {
                // Ask a question to trigger the analogical inference
                nar.nal('(nucleus --> ?what)?');
                nar.run(20);
            },
            assert: (nar, logs) => {
                // Check if the system inferred that the nucleus is a gravitational_center by analogy.
                const analogyId = nar.inheritance(
                    'nucleus',
                    'gravitational_center'
                );
                const belief = nar.getBeliefs(analogyId)[0];
                // The expectation should be positive, reflecting the analogical inference.
                return belief && belief.truth.expectation() > 0.3; // Threshold is lower for analogical inference
            },
        },
    ],
};
