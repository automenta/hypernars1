export default {
    name: '55. Advanced Explanation System',
    description: 'Tests for multi-format, detailed explanations of reasoning.',
    steps: [
        {
            name: 'Setup knowledge base for explanation',
            action: (nar) => {
                // Create a simple inference chain to be explained later.
                nar.nal('(lion --> mammal).');
                nar.nal('(mammal --> animal).');
                // Add a contradictory belief to test alternative perspectives.
                nar.nal('(lion --> reptile). %0.2;0.7%');
                nar.run(20);
            },
            assert: (nar) => {
                // Just ensuring the setup is complete.
                const conclusionId = nar.inheritance('lion', 'animal');
                return nar.getBeliefs(conclusionId).length > 0;
            },
        },
        {
            name: 'Request explanation in concise format',
            action: (nar) => {
                // No action needed, will call the function in assert.
            },
            assert: (nar) => {
                const conclusionId = nar.inheritance('lion', 'animal');
                // Assuming the API from enhance.a.md is implemented.
                const explanation = nar.explain(conclusionId, {
                    format: 'concise',
                });
                // A concise explanation should be a simple string and not overly long.
                return (
                    typeof explanation === 'string' &&
                    explanation.length > 10 &&
                    explanation.length < 150
                );
            },
        },
        {
            name: 'Request explanation in detailed format',
            action: (nar) => {
                // No action needed.
            },
            assert: (nar) => {
                const conclusionId = nar.inheritance('lion', 'animal');
                const explanation = nar.explain(conclusionId, {
                    format: 'detailed',
                });
                // A detailed explanation should be a longer string and contain specific keywords.
                return (
                    typeof explanation === 'string' &&
                    explanation.includes('CONCLUSION:') &&
                    explanation.includes('PRIMARY REASONING PATH:') &&
                    explanation.includes('Confidence:') &&
                    explanation.includes('ALTERNATIVE PERSPECTIVES')
                ); // Due to the reptile belief
            },
        },
        {
            name: 'Request explanation in technical format',
            action: (nar) => {
                // No action needed.
            },
            assert: (nar) => {
                const conclusionId = nar.inheritance('lion', 'animal');
                const explanation = nar.explain(conclusionId, {
                    format: 'technical',
                });
                // A technical explanation might include things like hyperedge IDs, budget values, etc.
                // For this test, we'll just check if it's a string that's different from the others.
                const concise = nar.explain(conclusionId, {
                    format: 'concise',
                });
                const detailed = nar.explain(conclusionId, {
                    format: 'detailed',
                });

                return (
                    typeof explanation === 'string' &&
                    explanation !== concise &&
                    explanation !== detailed
                );
            },
        },
    ],
};
