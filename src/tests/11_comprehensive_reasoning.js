export default {
    name: '11. Comprehensive Reasoning',
    description: 'A complex scenario combining analogy, belief revision, and question answering.',
    config: {
        logLevel: 'info',
    },
    steps: [
        {
            comment: '--- Step 1: Establish an analogy ---',
            action: (nar) => {
                nar.addInput('<robin --> bird>.');
                nar.addInput('<sparrow --> bird>.');
                nar.addInput('<bird --> animal>.');
                nar.addInput('<robin --> flies>.');
                nar.run(20);
            },
            assert: (nar, log) => {
                const belief = nar.query('<sparrow --> flies>?');
                return belief && belief.truth.confidence > 0.5;
            }
        },
        {
            comment: '--- Step 2: Revise a belief ---',
            action: (nar) => {
                nar.addInput('<sparrow --> -flies>.', { truth: { frequency: 1.0, confidence: 0.95 } });
                nar.run(20);
            },
            assert: (nar, log) => {
                const belief = nar.query('<sparrow --> flies>?');
                return belief && belief.truth.confidence < 0.5;
            }
        },
        {
            comment: '--- Step 3: Ask a question ---',
            action: (nar) => {
                nar.addInput('Is a sparrow a type of animal that flies?');
            },
            assert: (nar, log) => {
                const answer = log.find(entry => entry.includes('Answer:'));
                return answer && answer.includes('No');
            }
        }
    ],
};
