export default {
    name: '4. Meta-Reasoning',
    description: 'Shows the system adapting its own parameters based on performance.',
    skipped: false,
    steps: [
        {
            action: (nar) => {

                nar.scratchpad = {initialThreshold: nar.config.budgetThreshold};


                nar.ask('(tweety --> ?x)?').catch(e => {
                });
                nar.ask('(penguin --> ?x)?').catch(e => {
                });
                nar.ask('(bird --> ?x)?').catch(e => {
                });

                nar.run(120);
            },
            assert: (nar, logs) => {
                const initialThreshold = nar.scratchpad.initialThreshold;
                const newThreshold = nar.config.budgetThreshold;

                return initialThreshold !== newThreshold;
            }
        }
    ]
};
