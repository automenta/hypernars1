export default {
    name: '31. Knowledge Representation',
    description:
        "Tests the system's ability to represent and distinguish various forms of knowledge, including facts, rules, goals, and questions.",
    steps: [
        {
            comment: 'Input various types of knowledge into the system.',
            action: (nar) => {
                nar.nal('(lion --> animal).'); // Simple fact
                nar.nal('(lion --> predator). %0.8; 0.7%'); // Uncertain belief
                nar.nal('(human --> mammal). #1.0#'); // Definition
                nar.nal('((#x * animal) ==> warm_blooded).'); // Procedural rule
                nar.nal('(energy --> desired)!'); // Goal
                nar.nal('(lion --> dangerous)?'); // Question
                nar.run(10);
            },
        },
        {
            comment:
                "Assert that the different knowledge types are correctly represented in the system's memory.",
            assert: (nar, logs) => {
                // Check for the simple fact
                const factId = nar.inheritance('lion', 'animal');
                const factBelief = nar.getBeliefs(factId)[0];
                if (!factBelief || factBelief.truth.confidence < 0.9) {
                    return false;
                }

                // Check for the uncertain belief
                const beliefId = nar.inheritance('lion', 'predator');
                const uncertainBelief = nar.getBeliefs(beliefId)[0];
                if (
                    !uncertainBelief ||
                    Math.abs(uncertainBelief.truth.frequency - 0.8) > 0.01
                ) {
                    return false;
                }

                // Check for the definition
                const definitionId = nar.inheritance('human', 'mammal');
                const definitionBelief = nar.getBeliefs(definitionId)[0];
                if (
                    !definitionBelief ||
                    definitionBelief.truth.isEternal() !== true
                ) {
                    return false;
                }

                // Check for the procedural rule
                const ruleId = nar.implication(
                    nar.set(nar.term('#x'), nar.term('animal')),
                    nar.term('warm_blooded')
                );
                if (!nar.getConcept(ruleId)) {
                    return false;
                }

                // Check for the goal
                const goalId = nar.inheritance('energy', 'desired');
                if (!nar.memory.goals.some((g) => g.term.id === goalId)) {
                    return false;
                }

                // Check if the question was processed
                const questionId = nar.inheritance('lion', 'dangerous');
                if (
                    !nar.memory.questions.some((q) => q.term.id === questionId)
                ) {
                    return false;
                }

                return true;
            },
        },
    ],
};
