export class GoalManagerBase {
    constructor(nar) {
        if (this.constructor === GoalManagerBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.nar = nar;
    }

    addGoal(description, utility, constraints = {}, options = {}) {
        throw new Error("Method 'addGoal()' must be implemented.");
    }

    processGoals() {
        throw new Error("Method 'processGoals()' must be implemented.");
    }

    getActiveGoals() {
        throw new Error("Method 'getActiveGoals()' must be implemented.");
    }

    getRelatedTerms(goalId) {
        throw new Error("Method 'getRelatedTerms()' must be implemented.");
    }
}
