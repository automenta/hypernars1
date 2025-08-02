import { GoalManagerBase } from './GoalManagerBase.js';
import { id }from '../support/utils.js';
import { TruthValue } from '../support/TruthValue.js';

class Goal {
    constructor(id, description, utility, constraints = {}, options = {}) {
        this.id = id;
        this.description = description;
        this.utility = utility;
        this.constraints = constraints;
        this.status = 'active'; // active, achieved, abandoned
        this.priority = options.priority || 0.5;
        this.creationTime = Date.now();
        this.deadline = constraints.deadline || Infinity;
        this.achievers = new Set(); // Actions that can achieve this goal
    }

    get urgency() {
        if (this.deadline === Infinity) return this.priority * this.utility;
        const timeLeft = this.deadline - Date.now();
        if (timeLeft <= 0) return Infinity; // Overdue
        // Urgency increases as deadline approaches
        return (this.priority * this.utility) / Math.log1p(timeLeft / 1000);
    }
}

export class GoalManager extends GoalManagerBase {
    constructor(nar) {
        super(nar);
        this.goals = new Map();
        this.plans = new Map();
    }

    addGoal(description, utility, constraints = {}, options = {}) {
        const goalId = id('Goal', [description, Date.now()]);
        const goal = new Goal(goalId, description, utility, constraints, options);
        this.goals.set(goalId, goal);

        this.nar.api.addHyperedge('Goal', [description], {
            truth: new TruthValue(utility, 0.9),
            goalId: goalId,
        });

        this.nar.emit('goal-added', { goal });
        return goalId;
    }

    processGoals() {
        const activeGoals = this.getActiveGoals();
        if (activeGoals.length === 0) return;

        // Sort goals by urgency and process the most urgent one
        activeGoals.sort((a, b) => b.urgency - a.urgency);
        const mostUrgentGoal = activeGoals[0];

        this._processGoal(mostUrgentGoal.id);
    }

    _processGoal(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal || goal.status !== 'active') return;

        if (this._isGoalAchieved(goal)) {
            goal.status = 'achieved';
            this.nar.emit('goal-achieved', { goalId });
            return;
        }

        if (Date.now() > goal.deadline) {
            goal.status = 'abandoned';
            this.nar.emit('goal-abandoned', { goalId, reason: 'deadline' });
            return;
        }

        // Means-Ends Analysis
        const bestAction = this._findBestAction(goal);

        if (bestAction) {
            this._executeAction(bestAction, goal);
        } else {
            this._decomposeGoal(goal);
        }
    }

    _isGoalAchieved(goal) {
        // Check if the state described by the goal is true in the knowledge base
        // This requires querying the hypergraph.
        const results = this.nar.query(goal.description, { minExpectation: 0.7 });
        return results.length > 0;
    }

    _findBestAction(goal) {
        // Find actions that can achieve the goal's description (consequence)
        // This involves querying for implications like <action ==> goal_description>
        const potentialActions = [];
        const implications = this.nar.query(`<(*, $action) ==> ${goal.description}>?`);

        for (const imp of implications) {
            const actionId = imp.bindings.$action;
            const actionHyperedge = this.nar.state.hypergraph.get(actionId);
            if (actionHyperedge) {
                potentialActions.push(actionHyperedge);
            }
        }

        if (potentialActions.length === 0) return null;

        // For now, just return the first potential action found.
        // A more advanced implementation would score actions based on cost, reliability, etc.
        return potentialActions[0];
    }

    _executeAction(actionHyperedge, goal) {
        // In a real embodied system, this would trigger a physical action.
        // Here, we'll just assert the action's effects into the knowledge base.
        this.nar.emit('action-executed', { actionId: actionHyperedge.id, goalId: goal.id });

        // Assume the action's consequence is its description.
        // A more advanced system would have explicit effects.
        this.nar.api.addHyperedge('Term', [goal.description], {
            truth: new TruthValue(0.9, 0.9) // Assume action is successful
        });
    }

    _decomposeGoal(goal) {
        // Try to break down a complex goal into simpler subgoals.
        // e.g., if goal is "(&&, <a --> b>, <c --> d>)", create two subgoals.
        const parsedGoal = this.nar.expressionEvaluator.parse(goal.description);

        if (parsedGoal.type === 'Conjunction' && parsedGoal.args.length > 1) {
            this.nar.emit('goal-decomposed', { goalId: goal.id, subgoals: parsedGoal.args });
            parsedGoal.args.forEach((subgoalAst, i) => {
                // This is tricky because the subgoal is an AST, not a string.
                // We need a way to turn it back into a string to create the subgoal.
                // This part needs a more robust AST-to-string converter.
                // For now, we'll skip this part of the implementation.
                // const subgoalDescription = this.nar.expressionEvaluator.stringify(subgoalAst);
                // this.addGoal(subgoalDescription, goal.utility * (0.8 - i*0.1), {}, { parent: goal.id });
            });
            // Mark original goal as "waiting" for subgoals
            goal.status = 'waiting';
        } else {
            // Cannot decompose, mark as stalled for now
            this.nar.emit('goal-stalled', { goalId: goal.id, reason: 'cannot_decompose' });
        }
    }

    getActiveGoals() {
        return Array.from(this.goals.values()).filter(g => g.status === 'active');
    }

    getRelatedTerms(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal) return new Set();

        const terms = new Set();
        try {
            const parsed = this.nar.expressionEvaluator.parse(goal.description);
            const extract = (node) => {
                if (node.args) {
                    node.args.forEach(arg => {
                        if (typeof arg === 'string') {
                            terms.add(arg);
                        } else if (typeof arg === 'object' && arg.type) {
                            extract(arg);
                        }
                    });
                }
            };
            extract(parsed);
        } catch (e) {
            // Could not parse, just use the description string
            terms.add(goal.description);
        }
        return terms;
    }
}
