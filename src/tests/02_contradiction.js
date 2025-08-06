export default {
    name: '2. Contradiction',
    description: 'Shows how the system handles and resolves a direct contradiction.',
    skipped: false,

    steps: [
        {
            comment: 'Establish the initial belief that Tweety is a flyer.',
            action: (nar) => {
                nar.nal('(tweety --> flyer). %0.8;0.7%');
                nar.run(10);
            },
            assert: (nar, logs) => {
                const belief = nar.api.queryBelief('<tweety --> flyer>.');
                if (!belief || !belief.truth) return false;

                nar.scratchpad = {initialExpectation: belief.truth.expectation()};
                return nar.scratchpad.initialExpectation > 0.5;
            }
        },
        {
            comment: 'Introduce contradictory information and verify belief revision.',
            action: (nar) => {
                nar.nal('(penguin --> (bird * !flyer)). #0.95#');
                nar.nal('(tweety --> penguin). %0.99;0.99%');
                nar.contradictionManager.resolveContradictions();
                nar.run(100);
            },
            assert: (nar, logs) => {
                const belief = nar.api.queryBelief('<tweety --> flyer>.');
                if (!belief || !belief.truth) return false;
                const newExpectation = belief.truth.expectation();

                return newExpectation < nar.scratchpad.initialExpectation;
            }
        }
    ]
};
