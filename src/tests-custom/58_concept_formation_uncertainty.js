export default {
    name: '58. Concept Formation under Uncertainty',
    description: 'Tests the ability to form new concepts from uncertain and contradictory information.',
    steps: [
        {
            name: 'Provide a series of related observations',
            action: (nar) => {
                // Observations about various flying things.
                nar.nal('(sparrow --> has_wings). %1.0;0.9%');
                nar.nal('(sparrow --> sings). %0.9;0.9%');
                nar.nal('(robin --> has_wings). %1.0;0.9%');
                nar.nal('(robin --> sings). %0.8;0.9%');
                nar.nal('(bat --> has_wings). %1.0;0.9%');
                nar.nal('(bat --> !sings). %1.0;0.9%'); // A contradictory example
                nar.nal('(pigeon --> has_wings). %1.0;0.9%');
                nar.nal('(pigeon --> coos). %0.9;0.9%');
                nar.nal('(airplane --> has_wings). %1.0;0.9%');
                nar.nal('(airplane --> is_machine). %1.0;0.9%');

                // Run the system long enough to form concepts.
                nar.run(100);
            },
            assert: (nar) => {
                // This is a preliminary check. The real test is in the next step.
                // We just want to make sure the base knowledge is in the system.
                const sparrowConcept = nar.getConcept('sparrow');
                return sparrowConcept && nar.getBeliefs(nar.inheritance('sparrow', 'has_wings')).length > 0;
            }
        },
        {
            name: 'Check for formation of a new abstract concept',
            action: (nar) => {
                // No new action, we are observing the result of the previous step.
            },
            assert: (nar) => {
                // The system should have formed a new concept representing, for example,
                // the intersection of "has_wings" and "sings".
                // The exact name of this concept is unknown, so we need a way to search for it.
                // We assume a helper function for the test environment that can find concepts
                // based on their relationships.
                const findConcept = (properties) => {
                    return nar.concepts.find(concept => {
                        if (concept.isAtomic) return false; // Not interested in the base concepts
                        const relations = nar.getRelations(concept.id); // Assuming this function exists
                        return properties.every(prop => relations.some(r => r.target === prop));
                    });
                };

                // Search for a concept that is a type of "has_wings" AND a type of "sings".
                // This would be the concept representing "(has_wings * sings)".
                const wingedSingerConcept = findConcept(['has_wings', 'sings']);

                if (!wingedSingerConcept) return false;

                // Now, check if the system has correctly classified instances.
                // Sparrow and Robin should be strongly linked to this new concept.
                const sparrowBelief = nar.getBeliefs(nar.inheritance('sparrow', wingedSingerConcept.id))[0];
                const robinBelief = nar.getBeliefs(nar.inheritance('robin', wingedSingerConcept.id))[0];
                // Bat should be weakly linked or negatively linked.
                const batBelief = nar.getBeliefs(nar.inheritance('bat', wingedSingerConcept.id))[0];

                return sparrowBelief && sparrowBelief.truth.expectation() > 0.7 &&
                    robinBelief && robinBelief.truth.expectation() > 0.6 &&
                    (!batBelief || batBelief.truth.expectation() < 0.5);
            }
        }
    ]
};
