export default {
    name: '44. Competing Goals',
    description:
        'Tests how the system manages and prioritizes mutually exclusive goals.',
    steps: [
        {
            comment: 'Set up two incompatible goals of equal desire.',
            action: (nar) => {
                // Clear logs to see the decision process.
                if (nar.logs) nar.logs.length = 0;

                // Goals: Be warm and be cool, with equal desire.
                nar.nal('<be_warm!> %1.0;0.9%');
                nar.nal('<be_cool!> %1.0;0.9%');

                // Knowledge: Turning on the heater makes it warm, but not cool.
                nar.nal('<<turn_on_heater =/> be_warm>. %1.0;0.9%');
                nar.nal('<<turn_on_heater =/> !be_cool>. %1.0;0.9%');

                // Knowledge: Turning on the AC makes it cool, but not warm.
                nar.nal('<<turn_on_ac =/> be_cool>. %1.0;0.9%');
                nar.nal('<<turn_on_ac =/> !be_warm>. %1.0;0.9%');

                // Let the system reason about the conflict.
                nar.run(100);
            },
            assert: (nar, logs) => {
                // The system is faced with a dilemma. It wants two incompatible states.
                // A rational system should not execute both `turn_on_heater` and `turn_on_ac`.
                // We assume executed actions are logged with "EXE:".
                const executedHeater = logs.some((log) =>
                    log.includes('EXE: turn_on_heater')
                );
                const executedAC = logs.some((log) =>
                    log.includes('EXE: turn_on_ac')
                );

                // The assertion is that it doesn't do both. It might do one, or neither.
                return !(executedHeater && executedAC);
            },
        },
        {
            comment:
                'Introduce a higher-order preference to resolve the conflict.',
            action: (nar) => {
                // Clear logs.
                if (nar.logs) nar.logs.length = 0;

                // Add a new preference: it's more important to be warm than cool.
                // This is represented by giving the 'be_warm' goal a higher desire value (confidence).
                nar.nal('<be_warm!> %1.0;0.95%');

                // Let the system reason again.
                nar.run(100);
            },
            assert: (nar, logs) => {
                // With a clear preference, the system should now choose to turn on the heater.
                const executedHeater = logs.some((log) =>
                    log.includes('EXE: turn_on_heater')
                );
                const executedAC = logs.some((log) =>
                    log.includes('EXE: turn_on_ac')
                );

                // It should execute the preferred action and not the other one.
                return executedHeater && !executedAC;
            },
        },
    ],
};
