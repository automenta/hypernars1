export default {
    name: '35. Concept Learning from Patterns',
    description: 'Tests the system\'s ability to form a new concept that represents a recurring pattern or structure.',
    steps: [
        {
            comment: 'Introduce several statements that share a common structure.',
            action: (nar) => {
                nar.nal('((lion --> predator) && (lion --> mammal)). %0.9; 0.9%');
                nar.nal('((tiger --> predator) && (tiger --> mammal)). %0.9; 0.9%');
                nar.nal('((bear --> predator) && (bear --> mammal)). %0.9; 0.9%');
                // Run for enough cycles to allow pattern detection and concept formation
                nar.run(100);
            },
        },
        {
            comment: 'Assert that a new concept representing the pattern has been formed.',
            assert: (nar, logs) => {
                // The pattern is the conjunction of predator and mammal
                const patternTerm = nar.conjunction(nar.term('predator'), nar.term('mammal'));
                const patternConcept = nar.getConcept(patternTerm.id);

                // 1. Check if the concept for the pattern itself was created and is active.
                if (!patternConcept || patternConcept.budget.priority < 0.1) {
                    return false;
                }

                // 2. Check if the system has started to link the instances to the new concept.
                const lionToPatternBelief = nar.getBeliefs(nar.inheritance('lion', patternTerm.id))[0];
                const tigerToPatternBelief = nar.getBeliefs(nar.inheritance('tiger', patternTerm.id))[0];

                return lionToPatternBelief && tigerToPatternBelief && lionToPatternBelief.truth.expectation() > 0.5;
            }
        }
    ]
};
