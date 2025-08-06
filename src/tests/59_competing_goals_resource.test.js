export default {
    name: '59. Competing Goals & Resource Allocation',
    description: 'Tests how the system prioritizes and allocates resources to multiple, competing goals.',
    steps: [
        {
            name: 'Setup two competing goals with different priorities',
            action: (nar) => {
                // Goal 1: A high-priority, important goal.
                nar.goal('pass_exam', {priority: 0.9});
                // Goal 2: A low-priority, less important goal.
                nar.goal('watch_movie', {priority: 0.3});

                // Provide knowledge relevant to both goals.
                nar.nal('(study --> pass_exam). %0.9;0.9%');
                nar.nal('(relax --> watch_movie). %0.9;0.9%');
                nar.nal('(library --> study). %0.8;0.9%');
                nar.nal('(couch --> relax). %0.8;0.9%');

                nar.run(50);
            },
            assert: (nar) => {
                // Check that both goals are active.
                const examGoal = nar.goals.getActive('pass_exam');
                const movieGoal = nar.goals.getActive('watch_movie');
                return examGoal && movieGoal;
            }
        },
        {
            name: 'System should allocate more resources to the higher-priority goal',
            action: (nar) => {
                // Present a new piece of information that is relevant to both,
                // forcing the system to decide where to focus its attention.
                nar.nal('(free_time --> (study & relax)).');
                nar.run(100);
            },
            assert: (nar) => {
                // The concepts related to the higher-priority goal ('pass_exam', 'study', 'library')
                // should have higher budget (attention) than the concepts related to the lower-priority goal.
                // We assume the test environment allows inspecting concept budgets.
                const studyConcept = nar.getConcept('study');
                const relaxConcept = nar.getConcept('relax');

                if (!studyConcept || !relaxConcept) {
                    return false; // Concepts not found, test fails.
                }

                // The budget of 'study' should be significantly higher than 'relax'.
                return studyConcept.budget.total() > relaxConcept.budget.total();
            }
        },
        {
            name: 'System should pursue the higher-priority goal more actively',
            action: (nar) => {
                // Ask a question that could be answered by pursuing either goal.
                // This forces a choice.
                nar.nalq('what_to_do_with(free_time)?');
                nar.run(100);
            },
            assert: (nar) => {
                // The system's "answer" should be related to the higher-priority goal.
                // An answer in NARS is often a new belief with high confidence/budget.
                // We expect a belief like "(free_time --> study)" to have been derived
                // with a higher truth expectation than "(free_time --> relax)".
                const studyBelief = nar.getBeliefs(nar.inheritance('free_time', 'study'))[0];
                const relaxBelief = nar.getBeliefs(nar.inheritance('free_time', 'relax'))[0];

                if (!studyBelief || !relaxBelief) {
                    return false; // Beliefs not found, test fails.
                }

                return studyBelief.truth.expectation() > relaxBelief.truth.expectation();
            }
        }
    ]
};
