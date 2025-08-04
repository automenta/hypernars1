import {GoalManagerBase} from './GoalManagerBase.js';
import {id} from '../support/utils.js';
import {TruthValue} from '../support/TruthValue.js';
import {Goal} from '../support/Goal.js';

const defaultConfig = {
    defaultGoalPriority: 0.5,
    achievedThreshold: 0.7,
    actionCostFactor: 0.5,
    subgoalUtilityFactor: 0.9,
    subgoalPriorityFactor: 0.9,
    urgencyTimeDivisor: 1000,
};

export class GoalManager extends GoalManagerBase {
    constructor(nar) {
        super(nar);
        this.config = {...defaultConfig, ...nar.config.goalManager};
        this.goals = new Map();
        this.plans = new Map();
    }

    addGoal(description, utility, constraints = {}, options = {}) {
        const goalId = id('Goal', [description, Date.now()]);
        const goalOptions = {priority: this.config.defaultGoalPriority, ...options};
        const goal = new Goal(goalId, description, utility, constraints, goalOptions);
        this.goals.set(goalId, goal);

        this.nar.api.addHyperedge('Goal', [description], {
            truth: new TruthValue(utility, 0.9),
            goalId: goalId,
        });

        this.nar.emit('goal-added', {goal});
        return goalId;
    }

    processGoals() {
        const activeGoals = this.getActiveGoals();
        if (activeGoals.length === 0) return;

        activeGoals.sort((a, b) => b.urgency - a.urgency);
        const mostUrgentGoal = activeGoals[0];

        this._processGoal(mostUrgentGoal.id);
    }

    _processGoal(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal || goal.status !== 'active') return;

        if (Date.now() > goal.deadline) {
            goal.status = 'abandoned';
            this.nar.emit('goal-abandoned', {goalId, reason: 'deadline'});
            return;
        }

        if (this._isGoalAchieved(goal)) {
            goal.status = 'achieved';
            this.nar.emit('goal-achieved', {goalId});
            return;
        }

        const bestAction = this._findBestAction(goal);

        if (bestAction) {
            this._executeAction(bestAction, goal);
        } else {
            this._decomposeGoal(goal);
        }
    }

    _isGoalAchieved(goal) {
        const results = this.nar.query(goal.description, {minExpectation: this.config.achievedThreshold});
        return results.length > 0;
    }

    _findBestAction(goal) {
        const implications = this.nar.query(`<$action ==> ${goal.description}>?`);
        if (implications.length === 0) return null;

        let bestAction = null;
        let bestScore = -Infinity;

        for (const imp of implications) {
            const actionId = imp.bindings.$action;
            const actionHyperedge = this.nar.state.hypergraph.get(actionId);
            const implicationHyperedge = this.nar.state.hypergraph.get(imp.id);

            if (actionHyperedge && implicationHyperedge) {
                const reliability = implicationHyperedge.getTruthExpectation();
                const cost = 1.0 - (actionHyperedge.getStrongestBelief()?.budget.priority || this.config.defaultGoalPriority);
                const preconditionsMet = this._checkPreconditions(actionHyperedge);

                const score = (reliability * goal.utility) - (cost * this.config.actionCostFactor);

                if (preconditionsMet && score > bestScore) {
                    bestScore = score;
                    bestAction = actionHyperedge;
                }
            }
        }

        return bestAction;
    }

    _checkPreconditions(actionHyperedge) {
        return true;
    }

    _executeAction(actionHyperedge, goal) {
        this.nar.emit('action-executed', {actionId: actionHyperedge.id, goalId: goal.id});

        this.nar.api.addHyperedge('Term', [goal.description], {
            truth: new TruthValue(0.9, 0.9)
        });
    }

    _decomposeGoal(goal) {
        try {
            const parsedGoal = this.nar.expressionEvaluator.parse(goal.description);

            if (parsedGoal.type === 'Conjunction' && parsedGoal.args.length > 1) {
                this.nar.emit('goal-decomposed', {goalId: goal.id, subgoals: parsedGoal.args});
                parsedGoal.args.forEach((subgoalAst, i) => {
                    const subgoalDescription = this._stringifyAST(subgoalAst);
                    if (subgoalDescription) {
                        this.addGoal(subgoalDescription, goal.utility * this.config.subgoalUtilityFactor, goal.constraints, {
                            priority: goal.priority * this.config.subgoalPriorityFactor,
                            parent: goal.id
                        });
                    }
                });
                goal.status = 'waiting';
            } else {
                this.nar.emit('goal-stalled', {goalId: goal.id, reason: 'cannot_decompose'});
            }
        } catch (e) {
            this.nar.emit('goal-stalled', {goalId: goal.id, reason: 'parse_error', error: e.message});
        }
    }

    _stringifyAST(astNode) {
        if (typeof astNode === 'string') {
            return astNode;
        }
        if (!astNode || !astNode.type) {
            return null;
        }

        const args = astNode.args.map(arg => this._stringifyAST(arg)).join(', ');

        switch (astNode.type) {
            case 'Term':
                return astNode.args[0];
            case 'Inheritance':
                return `<${this._stringifyAST(astNode.args[0])} --> ${this._stringifyAST(astNode.args[1])}>.`;
            case 'Implication':
                return `<${this._stringifyAST(astNode.args[0])} ==> ${this._stringifyAST(astNode.args[1])}>.`;
            case 'Conjunction':
                return `(&&, ${args})`;
            default:
                return `${astNode.type}(${args})`;
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
            terms.add(goal.description);
        }
        return terms;
    }
}
