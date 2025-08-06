export default [
    {
        name: '21.1. Cross-Functional: Learning, Forgetting, and Re-learning',
        description: 'Tests the interaction between the learning engine and memory manager by learning a fact, forgetting it over time, and then re-learning it.',
        skipped: false,
        steps: [
            {
                comment: 'Step 1: Learn a new, high-confidence fact.',
                action: (nar) => {

                    nar.nal('(<fact_to_forget --> has_property>). %1.0;0.9%');
                    nar.run(10);
                },
                assert: (nar, logs) => {
                    const beliefId = nar.inheritance('fact_to_forget', 'has_property');
                    const belief = nar.getBeliefs(beliefId)?.[0];
                    if (!belief) {
                        console.error('Assertion failed: Belief was not created.');
                        return false;
                    }

                    nar.scratchpad = {initialBudget: belief.budget.total()};
                    return belief.truth.confidence > 0.8;
                }
            },
            {
                comment: 'Step 2: Run the system for many cycles to induce forgetting.',
                action: (nar) => {


                    nar.run(5000);
                },
                assert: (nar, logs) => {
                    const beliefId = nar.inheritance('fact_to_forget', 'has_property');
                    const hyperedge = nar.state.hypergraph.get(beliefId);



                    if (!hyperedge || hyperedge.beliefs.length === 0) {
                        return true;
                    }

                    const currentBudget = hyperedge.getStrongestBelief().budget.total();
                    const wasForgotten = currentBudget < (nar.scratchpad.initialBudget * 0.1);
                    if (!wasForgotten) {
                        console.error(`Assertion failed: Belief was not forgotten. Initial budget: ${nar.scratchpad.initialBudget}, Current budget: ${currentBudget}`);
                    }
                    return wasForgotten;
                }
            },
            {
                comment: 'Step 3: Re-introduce the fact and verify it is re-learned.',
                action: (nar) => {
                    nar.nal('(<fact_to_forget --> has_property>). %1.0;0.9%');
                    nar.run(10);
                },
                assert: (nar, logs) => {
                    const beliefId = nar.inheritance('fact_to_forget', 'has_property');
                    const belief = nar.getBeliefs(beliefId)?.[0];
                    if (!belief) {
                        console.error('Assertion failed: Belief was not re-learned.');
                        return false;
                    }

                    return belief.truth.confidence > 0.8;
                }
            }
        ]
    },
    {
        name: '21.2. Failing Cross-Functional Test: Goal Satisfaction with Unstable Prerequisite',
        description: 'This test is designed to fail. It checks if a goal is pursued even if its prerequisite is backed by a belief with very low, fluctuating confidence.',
        expectedResult: false,
        steps: [
            {
                comment: 'Establish a very unstable belief that action_X leads to goal_Y.',
                action: (nar) => {

                    nar.nal('(action_X ==> goal_Y). %1.0;0.1%');
                    nar.run(5);
                },
                assert: (nar, logs) => {
                    const ruleId = nar.implication('action_X', 'goal_Y');
                    const belief = nar.getBeliefs(ruleId)?.[0];
                    return belief && belief.truth.confidence < 0.2;
                }
            },
            {
                comment: 'Set a high-priority goal for goal_Y.',
                action: (nar) => {
                    nar.api.addGoal('goal_Y', 0.95);
                    nar.run(20);
                },
                assert: (nar, logs) => {




                    const goals = nar.api.getGoals();
                    const actionXGoal = goals.find(g => g.description === 'action_X');
                    if (!actionXGoal) {
                        console.error('Failing test assertion failed: Subgoal for action_X was not created.');
                        return false;
                    }

                    const isHighPriority = actionXGoal.utility > 0.7;
                    if (!isHighPriority) {
                        console.error(`Failing test assertion failed: Subgoal for action_X has low priority (${actionXGoal.utility}), which is the desired behavior. The test is designed to fail if the priority is high.`);
                    }


                    return isHighPriority;
                }
            }
        ]
    }
];
