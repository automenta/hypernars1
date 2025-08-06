export default {
    name: '46. Concept Learning by Example',
    description: 'Tests if the system can generalize a rule from multiple specific instances.',
    steps: [
        {
            comment: 'Provide multiple examples that share a common property (having wings) and belong to the same category (bird).',
            action: (nar) => {
                // Provide specific instances:
                nar.nal('<robin ==> bird>. %1.0;0.9%');
                nar.nal('<robin ==> has_wings>. %1.0;0.9%');

                nar.nal('<sparrow ==> bird>. %1.0;0.9%');
                nar.nal('<sparrow ==> has_wings>. %1.0;0.9%');

                nar.nal('<eagle ==> bird>. %1.0;0.9%');
                nar.nal('<eagle ==> has_wings>. %1.0;0.9%');

                // Let the system perform induction.
                nar.run(150);
            },
            assert: (nar, logs) => {
                // After seeing several examples of birds that have wings,
                // the system should induce a general rule: "birds have wings".
                const generalizedBelief = nar.getBelief('<bird ==> has_wings>');

                // The system should have formed this belief and be reasonably confident in it.
                // The exact confidence depends on the induction mechanism, but it should be significant.
                return generalizedBelief && generalizedBelief.truth.confidence > 0.6;
            }
        }
    ]
};
