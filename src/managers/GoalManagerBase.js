/**
 * Abstract base class for Goal Managers.
 * Defines the interface for managing goals and goal-directed reasoning.
 */
export class GoalManagerBase {
    constructor(nar) {
        if (this.constructor === GoalManagerBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    /**
     * Adds a new goal to the system.
     * @param {string} description - A description of the goal state.
     * @param {number} utility - The utility of achieving the goal (0-1).
     * @param {object} [constraints={}] - Constraints like deadlines.
     * @param {object} [options={}] - Additional options.
     * @returns {string} The ID of the created goal.
     */
    addGoal(description, utility, constraints = {}, options = {}) {
        throw new Error("Method 'addGoal()' must be implemented.");
    }

    /**
     * The main processing loop for the goal manager.
     * This method is called periodically by the main system to evaluate and pursue goals.
     */
    processGoals() {
        throw new Error("Method 'processGoals()' must be implemented.");
    }

    /**
     * Gets a list of currently active goals.
     * @returns {Array<object>} A list of active goal objects.
     */
    getActiveGoals() {
        throw new Error("Method 'getActiveGoals()' must be implemented.");
    }

    /**
     * Gets all terms related to a specific goal.
     * @param {string} goalId - The ID of the goal.
     * @returns {Set<string>} A set of related term IDs.
     */
    getRelatedTerms(goalId) {
        throw new Error("Method 'getRelatedTerms()' must be implemented.");
    }
}
