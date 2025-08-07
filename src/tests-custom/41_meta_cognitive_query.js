export default {
    name: '41. Meta-Cognitive Query',
    description: 'Tests if the system can justify its own conclusions.',
    steps: [
        {
            comment: 'Establish a simple inference chain (Socrates is mortal).',
            action: (nar) => {
                nar.nal('<socrates --> man>. %1.0;0.9%');
                nar.nal('<man --> mortal>. %1.0;0.9%');
                nar.run(50);
            },
            assert: (nar, logs) => {
                const conclusion = nar.getBelief('<socrates --> mortal>');
                return conclusion && conclusion.truth.expectation() > 0.8;
            },
        },
        {
            comment: 'Query the justification for the conclusion.',
            action: (nar) => {
                // Clear previous logs to isolate the answer to our question.
                if (nar.logs) {
                    nar.logs.length = 0;
                }
                const justificationQuery =
                    '<(&&, <socrates --> man>, <man --> mortal>) ==> <socrates --> mortal>>?';
                nar.nal(justificationQuery);
                nar.run(50);
            },
            assert: (nar, logs) => {
                // The TestRunner provides the logs. We check for a confident answer.
                const answerLog = logs.find((log) => log.startsWith('Answer:'));
                if (!answerLog) {
                    return false;
                }

                // Example: "Answer: <(&&,<socrates --> man>,<man --> mortal>) ==> <socrates --> mortal>>. %1.00;0.90%"
                const answerContent = answerLog
                    .substring('Answer:'.length)
                    .trim();

                // Regex to extract frequency and confidence.
                const truthValueRegex = /%([0-9.]+);([0-9.]+)%/;
                const match = answerContent.match(truthValueRegex);
                if (!match) {
                    return false;
                }

                const frequency = parseFloat(match[1]);
                const confidence = parseFloat(match[2]);

                // Assert that the system is confident in the validity of the inference rule.
                return frequency > 0.9 && confidence > 0.8;
            },
        },
    ],
};
