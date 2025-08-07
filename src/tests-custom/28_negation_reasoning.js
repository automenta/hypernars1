const tests = [
    {
        name: 'Reasoning with Negations',
        description:
            "Tests the system's ability to reason with negated statements and detect contradictions.",
        steps: [
            {
                comment:
                    'Step 1: Establish a strong belief that a whale is a mammal.',
                action: (nar) => {
                    nar.nal('(<whale --> mammal>). %1.0;0.9%');
                    nar.run(1); // run one cycle to process the belief
                },
                assert: (nar, logs) => {
                    const belief = nar.getBeliefs(
                        nar.inheritance('whale', 'mammal')
                    )[0];
                    return belief && belief.truth.confidence > 0.8;
                },
            },
            {
                comment:
                    'Step 2: Introduce a belief that a whale is NOT a fish (negation).',
                action: (nar) => {
                    nar.nal('(<whale --> [-fish]>). %1.0;0.9%');
                    nar.run(1);
                },
                assert: (nar, logs) => {
                    const belief = nar.getBeliefs(
                        nar.inheritance('whale', 'Negation(fish)')
                    )[0];
                    return belief && belief.truth.confidence > 0.8;
                },
            },
            {
                comment:
                    'Step 3: Introduce a general rule that mammals are not fish.',
                action: (nar) => {
                    nar.nal(
                        '((<$x --> mammal> ==> <$x --> [-fish]>)). %1.0;0.9%'
                    );
                    nar.run(5); // run a few cycles for the rule to be applied
                },
                assert: (nar, logs) => {
                    const conclusion = nar.api.queryBelief(
                        '(<whale --> [-fish]>)?'
                    );
                    return conclusion && conclusion.truth.confidence > 0.8;
                },
            },
            {
                comment:
                    'Step 4: Introduce a contradictory belief that a whale IS a fish and check for contradiction.',
                action: (nar) => {
                    nar.nal('(<whale --> fish>). %1.0;0.9%');
                    nar.run(10); // run cycles to allow for contradiction detection
                },
                assert: (nar, logs) => {
                    const contradictionDetected = logs.some((log) =>
                        log.includes('Contradiction detected')
                    );
                    return contradictionDetected;
                },
            },
        ],
    },
];

export default tests;
