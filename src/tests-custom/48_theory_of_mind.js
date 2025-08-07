export default {
    name: '48. Theory of Mind (False Belief Task)',
    description:
        'Tests if the system can model the beliefs of other agents, even when those beliefs are false.',
    steps: [
        {
            comment:
                'Setup: Sally puts her marble in the box. The system knows this and knows that Sally believes it.',
            action: (nar) => {
                // We represent an agent's belief using a higher-order statement: <(*, agent, belief) ==> believes>.
                // At T1, Sally sees the marble go into the box.
                nar.nal(
                    '<(*, sally, <marble --> in_box>) ==> believes>. %1.0;0.9%'
                );

                // The system also knows the marble is in the box as a fact.
                nar.nal('<marble --> in_box>. %1.0;0.9%');
                nar.run(10);
            },
        },
        {
            comment:
                'The state of the world changes while Sally is not present. Anne moves the marble.',
            action: (nar) => {
                // The marble is moved to the basket. This is the new reality.
                // A strong, recent event overrides the old location.
                nar.nal('<marble --> in_basket>. %1.0;0.99%');
                nar.nal('<marble --> !in_box>. %1.0;0.99%');

                // Crucially, we do not provide any information to suggest Sally is aware of this change.
                nar.run(50);
            },
            assert: (nar, logs) => {
                // Verify the system's own belief has been updated.
                const systemBelief = nar.getBelief('<marble --> in_basket>');
                return systemBelief && systemBelief.truth.expectation() > 0.8;
            },
        },
        {
            comment: "Query the system about Sally's belief.",
            action: (nar) => {
                if (nar.logs) nar.logs.length = 0;
                // Ask the question: "Where is the marble, according to Sally?"
                // NAL representation: <(*, sally, <marble --> ?where>) ==> believes>?
                nar.nal('<(*, sally, <marble --> ?P>) ==> believes>?');
                nar.run(50);
            },
            assert: (nar, logs) => {
                // When asked about Sally's belief, the system should report her outdated belief.
                // The answer should be that Sally believes the marble is "in_box".
                const answerLog = logs.find((log) => log.startsWith('Answer:'));
                if (!answerLog) {
                    return false;
                }

                // Example: Answer: <(*,sally,<marble --> in_box>) ==> believes>. %...%
                const reportsFalseBelief = answerLog.includes(
                    '<marble --> in_box>'
                );
                const doesNotReportTrueState = !answerLog.includes(
                    '<marble --> in_basket>'
                );

                return reportsFalseBelief && doesNotReportTrueState;
            },
        },
    ],
};
