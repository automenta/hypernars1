import Budget from '../support/Budget.js'; // Assuming Budget class is available for comparison

export default {
    name: '54. Advanced Resource Management (AIKR)',
    description: 'Tests for dynamic budgeting and pruning of reasoning paths.',
    steps: [
        {
            name: 'Allocate resources based on task type',
            action: (nar) => {
                // No action needed in the NAR system itself, we are calling the function directly.
            },
            assert: (nar) => {
                // Assuming the API from enhance.a.md is implemented and we can call it.
                // A 'question' task should get a higher priority budget than a 'derivation' task.
                const questionTask = { type: 'question', args: ['(a --> b)?'] };
                const derivationTask = { type: 'derivation', args: ['(a --> b).', '(b --> c).'] };

                const questionBudget = nar._resources.allocateResources(questionTask);
                const derivationBudget = nar._resources.allocateResources(derivationTask);

                return questionBudget.priority > derivationBudget.priority;
            }
        },
        {
            name: 'Allocate resources based on context',
            action: (nar) => {
                // No action needed in the NAR system itself.
            },
            assert: (nar) => {
                // An urgent task should receive a higher priority budget.
                const normalTask = { type: 'question', args: ['(x --> y)?'] };
                const urgentTask = { type: 'critical-event', args: ['(reactor --> meltdown).'] };

                const normalContext = {};
                const urgentContext = { urgency: 0.9, importance: 0.95 };

                const normalBudget = nar._resources.allocateResources(normalTask, normalContext);
                const urgentBudget = nar._resources.allocateResources(urgentTask, urgentContext);

                return urgentBudget.priority > normalBudget.priority && urgentBudget.durability > normalBudget.durability;
            }
        },
        {
            name: 'Prune low-value reasoning paths',
            action: (nar) => {
                // Add some high-value and low-value items to the event queue for testing.
                // Assumes we can access the event queue for this test.
                nar.eventQueue.add({ name: 'high_value_event', budget: new Budget(0.9, 0.9, 0.9) });
                nar.eventQueue.add({ name: 'low_value_event_1', budget: new Budget(0.1, 0.1, 0.1) });
                nar.eventQueue.add({ name: 'low_value_event_2', budget: new Budget(0.15, 0.1, 0.1) });
            },
            assert: (nar) => {
                // The prune function should return the number of pruned items.
                const prunedCount = nar._resources.pruneLowValuePaths(0.2);

                // Check that the low-value events were pruned and the high-value one remains.
                const queueSize = nar.eventQueue.size();

                return prunedCount === 2 && queueSize === 1 && nar.eventQueue.peek().name === 'high_value_event';
            }
        }
    ]
};
