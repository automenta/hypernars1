export default {
    name: '42. Goal-Driven Learning from Failure',
    description: 'Tests if the system revises its beliefs when its actions lead to goal failure.',
    steps: [
        {
            comment: 'Setup: a goal, a flawed plan, and a condition that causes the plan to fail.',
            action: (nar) => {
                // Goal: have the light on. We represent the goal as a desired state.
                nar.nal('<light_on!> %1.0;0.9%');

                // Flawed belief: that executing `flip_switch` leads to `light_on`.
                nar.nal('<<flip_switch =/> light_on>. %0.9;0.8%');

                // The underlying reality: flipping the switch when there's no power leads to the light being off.
                nar.nal('<(&&, flip_switch, no_power) =/> light_off>. %1.0;0.9%');

                // Initial state: there is no power.
                nar.nal('<no_power>. %1.0;0.9%');

                // Let the system try to achieve the goal. It should choose to execute `flip_switch`.
                nar.run(50);
            },
            assert: (nar, logs) => {
                // The system tries `flip_switch`, observes `light_off` due to `no_power`,
                // and this negative evidence should reduce its confidence in the flawed plan.
                const flawedBelief = nar.getBelief('<<flip_switch =/> light_on>>');

                // The original confidence was 0.8. It must be lower now.
                return flawedBelief && flawedBelief.truth.confidence < 0.8;
            }
        },
        {
            comment: 'Introduce a correct plan and verify the system adopts it.',
            action: (nar) => {
                // Clear logs to see the new goal generation.
                if (nar.logs) nar.logs.length = 0;

                // Provide an alternative path to success.
                nar.nal('<<turn_on_generator =/> power_on>. %1.0;0.9%');
                nar.nal('<power_on =/> !no_power>. %1.0;0.9%');
                nar.nal('<(&&, flip_switch, power_on) =/> light_on>. %1.0;0.9%');

                // Let the system reason again with the original goal still active.
                nar.run(100);
            },
            assert: (nar, logs) => {
                // The system should now understand that `turn_on_generator` is a precondition
                // for achieving its original goal, `light_on`. It should therefore generate
                // `turn_on_generator` as a new instrumental goal.
                const hasNewGoal = logs.some(log => log.includes('<turn_on_generator!>'));
                return hasNewGoal;
            }
        }
    ]
};
