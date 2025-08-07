export default {
    name: '37. Unlearning and Forgetting',
    description:
        "Tests the system's ability to forget irrelevant or outdated information over time.",
    // This test is sensitive to memory size and forgetting thresholds, may need adjustment.
    skipped: true, // Skipping as it\'s highly dependent on specific memory config
    steps: [
        {
            comment:
                'Introduce two facts, one normal and one important (higher budget).',
            action: (nar) => {
                // An ordinary fact
                nar.nal('(old_fact --> true). %0.5; 0.5%');
                // An important fact (giving it high confidence and priority)
                nar.nal('(important_fact --> true). %0.99; 0.99%');
                nar.run(10);
            },
            assert: (nar, logs) => {
                const oldConcept = nar.getConcept(nar.term('old_fact').id);
                const importantConcept = nar.getConcept(
                    nar.term('important_fact').id
                );
                return oldConcept && importantConcept;
            },
        },
        {
            comment:
                'Flood the system with a large amount of new, unrelated information.',
            action: (nar) => {
                for (let i = 0; i < 200; i++) {
                    // Add many new facts to compete for memory space
                    nar.nal(`(new_fact_${i} --> property_${i}). %0.6; 0.5%`);
                }
                // Run for many cycles to trigger forgetting mechanisms
                nar.run(500);
            },
        },
        {
            comment:
                'Assert that the less important fact was forgotten while the important one remains.',
            assert: (nar, logs) => {
                const oldConcept = nar.getConcept(nar.term('old_fact').id);
                const importantConcept = nar.getConcept(
                    nar.term('important_fact').id
                );

                // The old concept should have a very low budget (be forgotten) or be gone entirely.
                const isForgotten =
                    !oldConcept || oldConcept.budget.priority < 0.01;
                // The important concept should still have a reasonably high budget.
                const isRemembered =
                    importantConcept && importantConcept.budget.priority > 0.5;

                return isForgotten && isRemembered;
            },
        },
    ],
};
