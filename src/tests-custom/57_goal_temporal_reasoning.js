export default {
    name: '57. Goal-Oriented Temporal Reasoning',
    description: 'Tests the integration of the Goal and Temporal systems.',
    steps: [
        {
            name: 'Create a goal with a deadline',
            action: (nar) => {
                // Define a future event that will serve as a deadline.
                nar.temporal.at('conference_starts', '2025-12-01T09:00:00Z');

                // Post a goal that must be achieved before the deadline.
                // This test assumes a goal can be posted with a temporal qualifier.
                nar.goal('presentation_ready', {
                    before: 'conference_starts',
                    priority: 0.95,
                });

                nar.run(20);
            },
            assert: (nar) => {
                // Check if the goal 'presentation_ready' is active and has a temporal constraint.
                const goal = nar.goals.getActive('presentation_ready');
                return (
                    goal &&
                    goal.temporalConstraint &&
                    goal.temporalConstraint.type === 'before' &&
                    goal.temporalConstraint.target === 'conference_starts'
                );
            },
        },
        {
            name: 'Create a goal to maintain a state for a duration',
            action: (nar) => {
                // Define a time interval.
                nar.temporal.during('work_hours', '09:00', '17:00');

                // Post a goal to maintain a state during that interval.
                // This assumes a goal can be tied to maintaining a state.
                nar.goal('maintain(system_online)', {
                    during: 'work_hours',
                    priority: 0.9,
                });

                nar.run(20);
            },
            assert: (nar) => {
                // Check if the maintenance goal is active with the correct temporal scope.
                const goal = nar.goals.getActive('maintain(system_online)');
                return (
                    goal &&
                    goal.temporalConstraint &&
                    goal.temporalConstraint.type === 'during' &&
                    goal.temporalConstraint.target === 'work_hours'
                );
            },
        },
        {
            name: 'System prioritizes goal nearing deadline',
            action: (nar) => {
                // Set the system's time to be very close to the deadline.
                nar.setTime('2025-11-30T23:00:00Z');

                // Add another, less urgent goal.
                nar.goal('organize_desktop', { priority: 0.5 });

                nar.run(50);
            },
            assert: (nar) => {
                // The 'presentation_ready' goal should have a much higher budget/priority now
                // because its deadline is imminent.
                const presentationGoal =
                    nar.goals.getActive('presentation_ready');
                const desktopGoal = nar.goals.getActive('organize_desktop');

                // The budget/urgency of the presentation goal should be significantly higher.
                return (
                    presentationGoal &&
                    desktopGoal &&
                    presentationGoal.budget.total() >
                        desktopGoal.budget.total() * 2
                );
            },
        },
    ],
};
