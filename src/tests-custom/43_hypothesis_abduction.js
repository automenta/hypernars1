export default {
    name: '43. Hypothesis Generation (Abduction)',
    description:
        'Tests if the system can generate potential explanations for an observed event.',
    steps: [
        {
            comment:
                'Provide background knowledge (causes of fever) and then present the observation (fever).',
            action: (nar) => {
                // Clear logs to isolate the generated questions.
                if (nar.logs) nar.logs.length = 0;

                // Background knowledge: Two different causes can lead to fever.
                nar.nal('<flu ==> fever>. %1.0;0.9%');
                nar.nal('<infection ==> fever>. %1.0;0.9%');

                // Observation: The system perceives a fever.
                nar.nal('<fever>. %1.0;0.9%');

                // Let the system reason.
                nar.run(50);
            },
            assert: (nar, logs) => {
                // When observing an event that is the consequence of known implications,
                // the system should perform abduction by asking questions about the possible antecedents.
                // It should become curious about whether the patient has the flu OR an infection.
                const askedAboutFlu = logs.some((log) =>
                    log.includes('<flu?>')
                );
                const askedAboutInfection = logs.some((log) =>
                    log.includes('<infection?>')
                );

                // The system should generate both hypotheses.
                return askedAboutFlu && askedAboutInfection;
            },
        },
    ],
};
