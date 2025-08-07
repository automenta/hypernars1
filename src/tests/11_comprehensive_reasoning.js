export default {
    name: '11. Comprehensive Reasoning',
    description: 'A complex scenario combining analogy, belief revision, and question answering.',
    skipped: false, // SKIPPED: Uncovered potential bug where belief revision does not decrease confidence as expected.
    config: {
        logLevel: 'info',
    },
    steps: [
        {
            comment: '--- Step 1: Establish an analogy ---',
            action: (nar) => {
                nar.nal('<robin --> bird>.');
                nar.nal('<sparrow --> bird>.');
                nar.nal('<bird --> animal>.');
                nar.nal('<robin --> flies>.');
                nar.run(20);
            },
            assert: (nar, log) => {
                const beliefId = nar.inheritance('sparrow', 'flies');
                const belief = nar.getBeliefs(beliefId)[0];
                if (!belief) return false;
                nar.scratchpad = {initialConfidence: belief.truth.confidence};
                return nar.scratchpad.initialConfidence > 0.5;
            }
        },
        {
            comment: '--- Step 2: Revise a belief ---',
            action: (nar) => {
                nar.nal('<sparrow --> -flies>.', {truth: {frequency: 1.0, confidence: 0.95}});
                nar.run(20);
            },
            assert: (nar, log) => {
                const beliefId = nar.inheritance('sparrow', 'flies');
                const belief = nar.getBeliefs(beliefId)[0];
                if (!belief) return false;
                const newConfidence = belief.truth.confidence;
                return newConfidence < nar.scratchpad.initialConfidence;
            }
        },
        {
            comment: '--- Step 3: Ask a question ---',
            action: (nar) => {
                nar.nal('<sparrow --> (animal && flies)>?');
            },
            assert: (nar, log) => {
                const answer = log.find(entry => entry.includes('Answer:'));
                return answer && answer.includes('No');
            }
        }
    ],
};
