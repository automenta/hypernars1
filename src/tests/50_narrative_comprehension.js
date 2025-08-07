export default {
    name: '50. Narrative Comprehension',
    description: 'Tests the ability to follow a simple story and track state changes over time.',
    steps: [
        {
            comment: 'Introduce the initial state and the "physics" of the story world.',
            action: (nar) => {
                // Initial state: John is hungry.
                nar.nal('<john --> is_hungry>. %1.0;0.9%');

                // Causal knowledge: If someone eats food, they are no longer hungry.
                nar.nal('<(<#x --> food> & <(&&, $y, #x) =/> eats>) =/> <$y =/> !is_hungry>>. %1.0;0.9%');
                nar.nal('<apple --> food>. %1.0;0.9%');
                nar.run(10);
            }
        },
        {
            comment: 'Present the key event of the narrative: John eats an apple.',
            action: (nar) => {
                // We state this as a new event. Using a timestamp can help with temporal ordering.
                nar.nal('<(&&, john, apple) =/> eats>. %1.0;0.9% {T=1}');
                nar.run(50);
            }
        },
        {
            comment: 'Query the final state of the character.',
            action: (nar) => {
                if (nar.logs) nar.logs.length = 0;
                // Ask: "Is John hungry now?"
                nar.nal('<john --> is_hungry>?');
                nar.run(50);
            },
            assert: (nar, logs) => {
                // The system should have inferred that John is no longer hungry.
                // The answer to the question should be NO, indicated by a low frequency truth value.
                const answerLog = logs.find(log => log.startsWith('Answer:'));
                if (!answerLog) {
                    return false;
                }

                // Example: Answer: <john --> is_hungry>. %0.00;0.90%
                const truthValueRegex = /%([0-9.]+);([0-9.]+)%/;
                const match = answerLog.match(truthValueRegex);
                if (!match) {
                    return false;
                }

                const frequency = parseFloat(match[1]);
                const confidence = parseFloat(match[2]);

                // Assert that the system is confident that John is NOT hungry.
                return frequency < 0.1 && confidence > 0.8;
            }
        }
    ]
};
